import json
import logging
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.db import OperationalError
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import path
from rest_framework.test import APIClient, APITestCase


def broken_view(request, pk):
    raise RuntimeError("secret-password private@example.com")


urlpatterns = [path("broken/<int:pk>/", broken_view, name="broken")]


class MonitoringTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_health_is_minimal_uncached_and_supports_head(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertFalse(response.cookies)
        self.assertEqual(self.client.head("/api/health").content, b"")
        self.assertEqual(self.client.post("/api/health").status_code, 405)

    def test_health_reports_database_and_required_redis_outages_without_details(self):
        with patch("config.monitoring.connection.cursor", side_effect=OperationalError("secret-db")):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})
        with override_settings(RATE_LIMIT_ALLOW_LOCAL=False, RATE_LIMIT_REDIS_URL="redis://private"):
            with patch("config.monitoring.redis_client", return_value=Mock(ping=Mock(side_effect=OSError("secret")))):
                self.assertEqual(self.client.get("/api/health").status_code, 503)
            with patch("config.monitoring.redis_client", return_value=Mock(ping=Mock(return_value=True))):
                self.assertEqual(self.client.get("/api/health").status_code, 200)
        with override_settings(RATE_LIMIT_ALLOW_LOCAL=False, RATE_LIMIT_REDIS_URL=""):
            self.assertEqual(self.client.get("/api/health").status_code, 503)

    def test_anonymous_reports_require_csrf_and_reject_unapproved_fields(self):
        client = APIClient(enforce_csrf_checks=True)
        body = {"kind": "render_error", "page": "book-detail"}
        self.assertEqual(client.post("/api/client-errors/", body, format="json").status_code, 403)
        token = client.get("/api/accounts/csrf/").json()["csrfToken"]
        with self.assertLogs("rebook.monitoring", level="WARNING") as logs:
            response = client.post("/api/client-errors/", body, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 202)
        self.assertEqual(logs.records[0].browser_event, body)
        for invalid in ({**body, "message": "secret"}, {**body, "page": "/books/5?secret=1"},
                        {**body, "kind": "forged"}, {**body, "request_id": "bad"}):
            self.assertEqual(client.post("/api/client-errors/", invalid, format="json",
                                         HTTP_X_CSRFTOKEN=token).status_code, 400)
        self.assertEqual(client.post("/api/client-errors/", b"x" * 2049, content_type="application/json",
                                     HTTP_X_CSRFTOKEN=token).status_code, 413)

    def test_reports_are_rate_limited_and_fail_closed_without_redis(self):
        body = {"kind": "unhandled_error", "page": "home"}
        for _ in range(10):
            self.assertEqual(self.client.post("/api/client-errors/", body, format="json").status_code, 202)
        self.assertEqual(self.client.post("/api/client-errors/", body, format="json").status_code, 429)
        cache.clear()
        with override_settings(RATE_LIMIT_ALLOW_LOCAL=False, RATE_LIMIT_REDIS_URL=""):
            self.assertEqual(self.client.post("/api/client-errors/", body, format="json").status_code, 503)

    def test_log_only_reports_do_not_acquire_a_database_writer_transaction(self):
        with patch("config.mutation_middleware.transaction.atomic", side_effect=AssertionError("writer lock")):
            response = self.client.post("/api/client-errors/", {"kind": "render_error", "page": "home"}, format="json")
        self.assertEqual(response.status_code, 202)

    def test_request_context_is_isolated_across_threads_and_cleared_after_response(self):
        from config.observability import (
            RequestIDMiddleware,
            SafeJSONFormatter,
            active_request,
        )

        barrier = Barrier(2)

        def run(_):
            captured = []

            def endpoint(request):
                barrier.wait(timeout=5)
                record = logging.LogRecord("rebook.monitoring", logging.ERROR, "", 0, "secret", (), None)
                captured.append(json.loads(SafeJSONFormatter().format(record))["request_id"])
                return HttpResponse()

            response = RequestIDMiddleware(endpoint)(RequestFactory().get("/private?secret=1"))
            self.assertIsNone(active_request.get())
            self.assertEqual(captured, [response["X-Request-ID"]])
            return response["X-Request-ID"]

        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(run, range(2)))
        self.assertEqual(len(set(ids)), 2)

    @override_settings(ROOT_URLCONF=__name__, DEBUG=False)
    def test_failure_logs_and_response_share_a_generated_id_without_sensitive_data(self):
        from config.observability import SafeJSONFormatter

        client = APIClient(raise_request_exception=False)
        with self.assertLogs("django.request", level="ERROR") as logs:
            response = client.get("/broken/42/?token=secret", HTTP_X_REQUEST_ID="forged", HTTP_COOKIE="private=secret")
        record = logs.records[-1]
        encoded = SafeJSONFormatter().format(record)
        event = json.loads(encoded)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(event["request_id"], response["X-Request-ID"])
        self.assertEqual(len(event["request_id"]), 32)
        self.assertEqual(event["route"], "broken/<int:pk>/")
        self.assertEqual(event["exception"], "RuntimeError")
        self.assertTrue(event["frames"])
        for private in ("secret", "private@", "forged", "/42/", "token=", "Cookie"):
            self.assertNotIn(private, encoded)
        record = logging.LogRecord("django.security.csrf", logging.WARNING, "", 0,
                                   "private@example.com\nforged", (), None)
        self.assertNotIn("private", SafeJSONFormatter().format(record))
        record.browser_event = {"kind": "render_error", "page": "home", "message": "secret", "user": "private"}
        self.assertNotIn("secret", SafeJSONFormatter().format(record))
