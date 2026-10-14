"""محدودیت پنجرهٔ لغزان: Redis در تولید، cache محلی فقط برای توسعه."""

import hashlib
import hmac
import math
import threading
import time
from functools import lru_cache
from uuid import uuid4

from django.conf import settings
from django.core.cache import cache
from redis import Redis

SCRIPT = """
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local window = tonumber(ARGV[2]) * 1000
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    return math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return 0
"""
LOCAL_LOCK = threading.Lock()


class RateLimitUnavailable(Exception):
    pass


@lru_cache(maxsize=4)
def redis_client(url):
    return Redis.from_url(url, protocol=2, socket_connect_timeout=1, socket_timeout=1, max_connections=32)


def consume(scope, identity):
    limit, duration = settings.RATE_LIMITS[scope]
    digest = hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()
    key = f"{settings.RATE_LIMIT_PREFIX}:{scope}:{digest}"
    url = settings.RATE_LIMIT_REDIS_URL
    if url:
        try:
            return int(redis_client(url).eval(SCRIPT, 1, key, limit, duration, uuid4().hex))
        except Exception as exc:
            # اتصال ناموفق یا خطای اسکریپت نباید محدودیت را خاموش کند.
            raise RateLimitUnavailable() from exc
    if not settings.RATE_LIMIT_ALLOW_LOCAL:
        raise RateLimitUnavailable()
    # cache.clear() تست‌ها را جدا می‌کند؛ قفل فقط در توسعه، نه جایگزین Redis تولید.
    with LOCAL_LOCK:
        now = time.monotonic()
        history = [stamp for stamp in cache.get(key, []) if stamp > now - duration]
        if len(history) >= limit:
            return max(1, math.ceil(history[0] + duration - now))
        cache.set(key, [*history, now], duration)
        return 0
