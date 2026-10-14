from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User
from notifications.models import SupportTicket


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class RateLimitEndpointTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="reader", password="secret")

    def test_forwarded_header_does_not_reset_login_budget(self):
        for _ in range(10):
            response = self.client.post("/api/accounts/login/", {"username": "reader", "password": "wrong"})
            self.assertEqual(response.status_code, 401)
        response = self.client.post(
            "/api/accounts/login/", {"username": "reader", "password": "wrong"},
            HTTP_X_FORWARDED_FOR="198.51.100.2",
        )
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response["Retry-After"]), 0)

    def test_support_burst_is_limited_without_extra_rows(self):
        self.client.force_authenticate(self.user)
        for _ in range(10):
            self.assertEqual(self.client.post(
                "/api/notifications/support/create/", {"subject": "s", "message": "m"}
            ).status_code, 201)
        response = self.client.post("/api/notifications/support/create/", {"subject": "s", "message": "m"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(SupportTicket.objects.count(), 10)

    def test_admin_login_has_the_same_authentication_budget(self):
        for _ in range(10):
            response = self.client.post("/admin/login/", {"username": "reader", "password": "wrong"})
            self.assertEqual(response.status_code, 200)
        response = self.client.post("/admin/login/", {"username": "reader", "password": "wrong"})
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response["Retry-After"]), 0)
