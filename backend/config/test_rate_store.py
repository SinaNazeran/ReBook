import os
import time
from concurrent.futures import ThreadPoolExecutor
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

import fakeredis
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from redis import Redis
from rest_framework.test import APIClient, APIRequestFactory

from config.client_ip import client_ip
from config.rate_store import RateLimitUnavailable, consume


@override_settings(RATE_LIMIT_REDIS_URL="redis://test/0", RATE_LIMITS={"test": (10, 60)})
class RedisCounterTests(SimpleTestCase):
    def setUp(self):
        self.server = fakeredis.FakeServer()
        self.clients = [fakeredis.FakeRedis(server=self.server, protocol=2) for _ in range(2)]

    def test_independent_clients_share_one_budget(self):
        for _ in range(5):
            for client in self.clients:
                with patch("config.rate_store.redis_client", return_value=client):
                    self.assertEqual(consume("test", "ip:1"), 0)
        with patch("config.rate_store.redis_client", return_value=self.clients[1]):
            self.assertGreater(consume("test", "ip:1"), 0)
            self.assertEqual(consume("test", "ip:2"), 0)
        for key in self.clients[0].scan_iter():
            self.assertGreater(self.clients[0].ttl(key), 0)
            self.assertNotIn(b"ip:", key)

    def test_concurrent_requests_cannot_exceed_budget(self):
        with patch("config.rate_store.redis_client", return_value=self.clients[0]), ThreadPoolExecutor(max_workers=8) as pool:
            waits = list(pool.map(lambda _: consume("test", "same-client"), range(40)))
        self.assertEqual(waits.count(0), 10)
        self.assertTrue(all(wait > 0 for wait in waits if wait != 0))
        self.assertEqual(self.clients[0].zcard(self.clients[0].keys()[0]), 10)

    def test_expired_entries_release_budget(self):
        client = self.clients[0]
        with patch("config.rate_store.redis_client", return_value=client):
            for _ in range(10):
                consume("test", "same-client")
            key = client.keys()[0]
            for member in client.zrange(key, 0, -1):
                client.zadd(key, {member: 0})
            self.assertEqual(consume("test", "same-client"), 0)
            self.assertEqual(client.zcard(key), 1)

    def test_unavailable_redis_never_falls_back_to_local_cache(self):
        self.server.connected = False
        with patch("config.rate_store.redis_client", return_value=self.clients[0]), self.assertRaises(RateLimitUnavailable):
            consume("test", "same-client")


class ProxyAndOutageTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()

    @override_settings(RATE_LIMIT_PROXY_COUNT=1, RATE_LIMIT_TRUSTED_PROXIES=["10.0.0.0/24"])
    def test_only_trusted_peers_can_supply_forwarded_addresses(self):
        for peer, forwarded, expected in (
            ("198.51.100.3", "203.0.113.4", "198.51.100.3"),
            ("10.0.0.1", "198.51.100.8, 203.0.113.4", "203.0.113.4"),
            ("10.0.0.1", "invalid", "10.0.0.1"),
        ):
            with self.subTest(peer=peer, forwarded=forwarded):
                request = self.factory.get("/", REMOTE_ADDR=peer, HTTP_X_FORWARDED_FOR=forwarded)
                self.assertEqual(client_ip(request), expected)

    @override_settings(RATE_LIMIT_REDIS_URL="", RATE_LIMIT_ALLOW_LOCAL=False)
    def test_missing_production_redis_returns_503_before_query_or_login(self):
        client = APIClient()
        self.assertEqual(client.get("/api/books/").status_code, 503)
        self.assertEqual(client.post("/admin/login/", {"username": "x", "password": "x"}).status_code, 503)

    @override_settings(RATE_LIMIT_REDIS_URL="", RATE_LIMIT_ALLOW_LOCAL=True,
                       RATE_LIMITS={"api_read": (2, 60), "api_write": (2, 60)})
    def test_read_and_write_limits_apply_to_unscoped_endpoints(self):
        client = APIClient()
        for _ in range(2):
            self.assertEqual(client.get("/api/accounts/csrf/").status_code, 200)
        self.assertEqual(client.get("/api/accounts/csrf/").status_code, 429)

    @override_settings(RATE_LIMIT_PROXY_COUNT=0, RATE_LIMIT_TRUSTED_PROXIES=["127.0.0.1"])
    def test_direct_mode_ignores_forwarded_headers(self):
        request = self.factory.get("/", REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="203.0.113.4")
        self.assertEqual(client_ip(request), "127.0.0.1")


@skipUnless(os.environ.get("REDIS_TEST_URL"), "Set REDIS_TEST_URL for live Redis integration tests")
class LiveRedisTests(SimpleTestCase):
    def setUp(self):
        self.url = os.environ["REDIS_TEST_URL"]
        self.prefix = "rebook:test:" + uuid4().hex
        self.client = Redis.from_url(self.url, protocol=2)
        self.options = override_settings(
            RATE_LIMIT_REDIS_URL=self.url, RATE_LIMIT_PREFIX=self.prefix,
            RATE_LIMITS={"test": (10, 60), "api_read": (2, 60)}, RATE_LIMIT_ALLOW_LOCAL=False,
        )
        self.options.enable()
        self.addCleanup(self.options.disable)
        self.addCleanup(self.cleanup_keys)

    def cleanup_keys(self):
        for key in self.client.scan_iter(match=self.prefix + ":*"):
            self.client.delete(key)
        self.client.close()

    def test_atomic_budget_across_connections(self):
        second = Redis.from_url(self.url, protocol=2)
        self.addCleanup(second.close)
        # اتصال‌های مستقل نقش workerهای برنامه را دارند.
        with patch("config.rate_store.redis_client", side_effect=[self.client, second] * 20), ThreadPoolExecutor(max_workers=8) as pool:
            waits = list(pool.map(lambda _: consume("test", "same-client"), range(40)))
        self.assertEqual(waits.count(0), 10)
        key = next(second.scan_iter(match=self.prefix + ":*"))
        self.assertEqual(second.zcard(key), 10)
        self.assertGreater(second.pttl(key), 0)

    def test_window_expiry_releases_budget(self):
        with self.settings(RATE_LIMITS={"test": (10, 1)}):
            for _ in range(10):
                self.assertEqual(consume("test", "same-client"), 0)
            self.assertGreater(consume("test", "same-client"), 0)
            time.sleep(1.1)
            self.assertEqual(consume("test", "same-client"), 0)

    def test_api_uses_live_redis_and_returns_retry_after(self):
        client = APIClient()
        for _ in range(2):
            self.assertEqual(client.get("/api/accounts/csrf/").status_code, 200)
        response = client.get("/api/accounts/csrf/")
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response["Retry-After"]), 0)
