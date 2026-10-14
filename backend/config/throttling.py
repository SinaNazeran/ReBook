from rest_framework.exceptions import APIException
from rest_framework.throttling import BaseThrottle

from config.client_ip import client_ip
from config.rate_store import RateLimitUnavailable, consume


class RateLimitServiceUnavailable(APIException):
    status_code = 503
    default_detail = "سرویس موقتاً در دسترس نیست؛ کمی بعد دوباره امتحان کن."
    default_code = "rate_limit_unavailable"


class RedisRateThrottle(BaseThrottle):
    def allow_request(self, request, view):
        read = request.method in ("GET", "HEAD", "OPTIONS")
        scopes = ["api_read" if read else "api_write"]
        scope = getattr(view, "throttle_scope", None)
        if scope and (not read or scope == "cart"):
            scopes.append(scope)
        identities = [f"ip:{client_ip(request)}"]
        if request.user.is_authenticated:
            identities.append(f"user:{request.user.pk}")
        self.retry_after = 0
        try:
            for scope in scopes:
                # ورودی‌های احراز هویت، حتی با session، سهمیهٔ IP مشترک دارند.
                for identity in identities[:1] if scope == "auth" else identities:
                    self.retry_after = max(self.retry_after, consume(scope, identity))
        except RateLimitUnavailable as exc:
            raise RateLimitServiceUnavailable() from exc
        return self.retry_after == 0

    def wait(self):
        return self.retry_after
