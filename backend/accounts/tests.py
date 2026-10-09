import io
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from .models import User


def png_of_size(megabytes):
    """یک PNG معتبر که با بایت‌های اضافه به حجم دلخواه رسیده"""
    buf = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buf, "PNG")
    return SimpleUploadedFile("x.png", buf.getvalue() + b"\0" * int(megabytes * 1024 * 1024), "image/png")


class AccountTests(APITestCase):
    def setUp(self):
        # شمارنده throttle در cache بین تست‌ها باقی می‌ماند
        cache.clear()

    def register(self, username, password="Kt7-reader-pass", **extra):
        data = {"username": username, "password": password, "password_confirm": password, **extra}
        return self.client.post("/api/accounts/register/", data)

    def test_weak_passwords_are_rejected(self):
        for password in ("12345678", "password", "alice-the-reader"):
            with self.subTest(password=password):
                response = self.register("alice-the-reader", password)
                self.assertEqual(response.status_code, 400)
                self.assertIn("password", response.data)

    def test_several_users_can_register_without_phone(self):
        for username in ("u1", "u2"):
            self.assertEqual(self.register(username, phone="").status_code, 201)
        self.assertEqual(User.objects.filter(phone__isnull=True).count(), 2)

    def test_profile_exposes_is_staff_read_only(self):
        user = User.objects.create_user(username="u", password="x")
        self.client.force_authenticate(user)
        response = self.client.patch("/api/accounts/profile/", {"is_staff": True, "phone": ""})
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.data["is_staff"], False)
        user.refresh_from_db()
        self.assertFalse(user.is_staff)

    def test_oversized_avatar_is_rejected(self):
        self.client.force_authenticate(User.objects.create_user(username="u", password="x"))
        response = self.client.patch("/api/accounts/profile/", {"avatar": png_of_size(3.1)}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("avatar", response.data)

    def test_avatar_is_shrunk_to_webp(self):
        user = User.objects.create_user(username="u", password="x")
        self.client.force_authenticate(user)
        buf = io.BytesIO()
        Image.new("RGB", (1600, 1200)).save(buf, "JPEG")
        avatar = SimpleUploadedFile("me.jpg", buf.getvalue(), "image/jpeg")
        with tempfile.TemporaryDirectory() as media, self.settings(MEDIA_ROOT=media):
            response = self.client.patch("/api/accounts/profile/", {"avatar": avatar}, format="multipart")
            self.assertEqual(response.status_code, 200)
            user.refresh_from_db()
            self.assertTrue(user.avatar.name.endswith(".webp"))
            with Image.open(user.avatar.path) as img:
                self.assertEqual(img.size, (400, 300))

    def test_unauthenticated_gets_401_but_forbidden_stays_403(self):
        # api.js فقط با 401 کاربر را از حالت ورود خارج می‌کند
        self.assertEqual(self.client.get("/api/accounts/profile/").status_code, 401)
        self.client.force_authenticate(User.objects.create_user(username="u", password="x"))
        self.assertEqual(self.client.get("/api/accounts/users/").status_code, 403)

    def test_login_requires_csrf_token(self):
        User.objects.create_user(username="u", password="Kt7-reader-pass")
        client = APIClient(enforce_csrf_checks=True)
        credentials = {"username": "u", "password": "Kt7-reader-pass"}
        self.assertEqual(client.post("/api/accounts/login/", credentials).status_code, 403)

        client.get("/api/accounts/csrf/")
        token = client.cookies["csrftoken"].value
        response = client.post("/api/accounts/login/", credentials, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)

    def test_login_is_throttled(self):
        User.objects.create_user(username="victim", password="Kt7-reader-pass")
        statuses = [
            self.client.post("/api/accounts/login/", {"username": "victim", "password": "guess"}).status_code
            for _ in range(11)
        ]
        self.assertEqual(statuses[:10], [401] * 10)
        self.assertEqual(statuses[10], 429)
