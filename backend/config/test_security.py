from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from config.security import security_settings


class SecurityHeaderTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        options = override_settings(**security_settings({"DJANGO_CORS_ALLOWED_ORIGINS": "https://frontend.example"}, False))
        options.enable()
        self.addCleanup(options.disable)

    @override_settings(DEBUG=False, ALLOWED_HOSTS=["testserver"])
    def test_https_api_has_csp_and_hsts(self):
        response = APIClient().get("/api/accounts/csrf/", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn("Content-Security-Policy", response)
        self.assertIn("Strict-Transport-Security", response)
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["Strict-Transport-Security"], "max-age=300")
        self.assertNotIn("unsafe-inline", response["Content-Security-Policy"].split("script-src")[1].split(";")[0])

    @override_settings(DEBUG=False, ALLOWED_HOSTS=["testserver"])
    def test_production_http_redirects_without_trusting_spoofed_protocol(self):
        response = APIClient().get("/api/accounts/csrf/?x=1", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, 301)
        self.assertEqual(response["Location"], "https://testserver/api/accounts/csrf/?x=1")

    @override_settings(HTTPS_TRUSTED_PROXIES=["10.0.0.0/24"], ALLOWED_HOSTS=["testserver"])
    def test_trusted_proxy_https_avoids_redirect_and_sets_hsts(self):
        response = APIClient().get("/api/accounts/csrf/", REMOTE_ADDR="10.0.0.2", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Strict-Transport-Security"], "max-age=300")
        for protocol in ("https,http", "invalid"):
            response = APIClient().get("/api/accounts/csrf/", REMOTE_ADDR="10.0.0.2", HTTP_X_FORWARDED_PROTO=protocol)
            self.assertEqual(response.status_code, 301)

    @override_settings(ALLOWED_HOSTS=["testserver"])
    def test_only_allowlisted_origin_gets_credentialed_cors(self):
        client = APIClient()
        allowed = client.get("/api/accounts/csrf/", secure=True, HTTP_ORIGIN="https://frontend.example")
        self.assertEqual(allowed["Access-Control-Allow-Origin"], "https://frontend.example")
        self.assertEqual(allowed["Access-Control-Allow-Credentials"], "true")
        for origin in ("https://evil.example", "http://localhost:5173"):
            response = client.get("/api/accounts/csrf/", secure=True, HTTP_ORIGIN=origin)
            self.assertNotIn("Access-Control-Allow-Origin", response)

    def test_production_rejects_missing_insecure_or_wildcard_origins(self):
        for value in ("", "http://frontend.example", "https://*.example", "https://example/path"):
            with self.subTest(value=value), self.assertRaises(ImproperlyConfigured):
                security_settings({"DJANGO_CORS_ALLOWED_ORIGINS": value}, False)

    def test_cookie_and_development_settings(self):
        production = security_settings({"DJANGO_CORS_ALLOWED_ORIGINS": "https://frontend.example"}, False)
        self.assertTrue(production["SESSION_COOKIE_SECURE"])
        self.assertTrue(production["CSRF_COOKIE_SECURE"])
        development = security_settings({}, True)
        self.assertFalse(development["SECURE_SSL_REDIRECT"])
        self.assertFalse(development["SESSION_COOKIE_SECURE"])
        self.assertIn("http://localhost:5173", development["CORS_ALLOWED_ORIGINS"])
