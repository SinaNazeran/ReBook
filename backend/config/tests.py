from django.core.cache import cache
from django.db import transaction
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book
from notifications.models import Notification
from orders.models import CartItem, Order, Transaction


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class RequestValidationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password=" pass ")
        self.book = Book.objects.create(
            title="b", author="a", price=100, seller=self.seller, status="approved"
        )
        CartItem.objects.create(user=self.buyer, book=self.book)

    def assert_no_checkout_effects(self):
        self.assertFalse(Order.objects.exists())
        self.assertFalse(Transaction.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, "approved")
        self.assertTrue(CartItem.objects.filter(user=self.buyer, book=self.book).exists())

    def test_non_object_bodies_are_400(self):
        for endpoint in ("accounts/login", "orders/cart", "orders/checkout"):
            self.client.force_authenticate(self.buyer if endpoint.endswith("checkout") else None)
            for payload in ([], [1], "text", 42, True):
                with self.subTest(endpoint=endpoint, payload=payload):
                    cache.clear()
                    response = self.client.post(f"/api/{endpoint}/", payload, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertTrue(response.data)
        self.assert_no_checkout_effects()

    def test_login_rejects_invalid_credentials_without_authenticating(self):
        for data in (
            {}, {"username": "buyer"}, {"username": [], "password": "pass"},
            {"username": 123, "password": "pass"}, {"username": "buyer", "password": {}},
            {"username": "x" * 151, "password": "pass"},
            {"username": "buyer", "password": "x" * 4097},
        ):
            with self.subTest(data=str(data)[:50]):
                cache.clear()
                response = self.client.post("/api/accounts/login/", data, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_preserves_password_whitespace(self):
        response = self.client.post(
            "/api/accounts/login/", {"username": "buyer", "password": " pass "}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    def test_cart_rejects_invalid_book_ids_without_adding(self):
        for value in (True, 1.9, 1.0, [], {}, None, 0, -1, 2**63, "9" * 5000, "abc"):
            with self.subTest(value=str(value)[:30]):
                cache.clear()
                response = self.client.post("/api/orders/cart/", {"book": value}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertNotIn("cart", self.client.session)

    def test_checkout_rejects_invalid_items_without_side_effects(self):
        self.client.force_authenticate(self.buyer)
        base = {"id": self.book.pk, "price": 100}
        invalid_items = [None, {}, [], 42, "item"]
        invalid_items += [{**base, "id": value} for value in (True, 1.9, 1.0, 0, -1, 2**63, "9" * 5000)]
        invalid_items += [{**base, "price": value} for value in (True, 100.9, 100.0, -1, 2**31, "9" * 5000)]
        for item in invalid_items:
            with self.subTest(item=str(item)[:60]), transaction.atomic():
                response = self.client.post(
                    "/api/orders/checkout/", {"books": [item], "shipping_address": "x"}, format="json"
                )
                self.assertEqual(response.status_code, 400)
                self.assert_no_checkout_effects()

    def test_checkout_rejects_invalid_addresses_without_side_effects(self):
        self.client.force_authenticate(self.buyer)
        for address in ({"city": "x"}, [], 123, True, None, " ", "x" * 2001):
            with self.subTest(address=str(address)[:30]), transaction.atomic():
                response = self.client.post(
                    "/api/orders/checkout/",
                    {"books": [{"id": self.book.pk, "price": 100}], "shipping_address": address},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assert_no_checkout_effects()

    def test_checkout_accepts_integer_strings_and_trims_address(self):
        self.client.force_authenticate(self.buyer)
        response = self.client.post(
            "/api/orders/checkout/",
            {"books": [{"id": str(self.book.pk), "price": "100"}], "shipping_address": " x "},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Order.objects.get().shipping_address, "x")

    def test_catalog_rejects_invalid_price_bounds(self):
        for field in ("min_price", "max_price"):
            for value in ("9" * 5000, str(2**31), "-1", "1.9", "abc"):
                with self.subTest(field=field, value=value[:30]):
                    response = self.client.get("/api/books/", {field: value})
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(field, response.data)

    def test_catalog_accepts_blank_zero_and_persian_price_bounds(self):
        for params, count in (({"min_price": "", "max_price": ""}, 1),
                              ({"min_price": "۰", "max_price": "۱۰۰"}, 1),
                              ({"min_price": "101"}, 0)):
            with self.subTest(params=params):
                response = self.client.get("/api/books/", params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["count"], count)
