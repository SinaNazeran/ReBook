from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.db import OperationalError
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from books.models import Book
from orders.models import CartItem, IdempotencyRecord, Order


class IdempotencyRecordTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.seller = User.objects.create_user(username="record-seller", password="pass")
        cls.buyer = User.objects.create_user(username="record-buyer", password="pass")

    def setUp(self):
        cache.clear()
        self.client = APIClient(raise_request_exception=False)
        self.client.force_authenticate(self.buyer)

    def checkout(self, book):
        return self.client.post("/api/orders/checkout/", {
            "books": [{"id": book.pk, "price": 100}], "shipping_address": "x",
        }, format="json", HTTP_IDEMPOTENCY_KEY="record-intent-001")

    def book(self):
        book = Book.objects.create(title="b", author="a", price=100, seller=self.seller, status="approved")
        CartItem.objects.create(user=self.buyer, book=book)
        return book

    def test_expired_key_can_start_a_new_intent_without_replaying_old_response(self):
        first = self.checkout(self.book())
        IdempotencyRecord.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        second = self.checkout(self.book())
        self.assertEqual((first.status_code, second.status_code), (201, 201))
        self.assertNotEqual(first.data["orders"], second.data["orders"])
        self.assertEqual(IdempotencyRecord.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 2)

    def test_failed_receipt_storage_rolls_back_the_purchase(self):
        book = self.book()
        with patch.object(IdempotencyRecord.objects, "create", side_effect=RuntimeError("audit fault")):
            response = self.checkout(book)
        self.assertEqual(response.status_code, 500)
        book.refresh_from_db()
        self.assertEqual(book.status, "approved")
        self.assertFalse(Order.objects.exists())
        self.assertTrue(CartItem.objects.filter(book=book).exists())

    @override_settings(CORS_ALLOWED_ORIGINS=["https://frontend.example"])
    def test_cross_origin_checkout_allows_the_idempotency_header(self):
        response = self.client.options("/api/orders/checkout/", HTTP_ORIGIN="https://frontend.example",
                                       HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
                                       HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,idempotency-key,x-csrftoken")
        self.assertEqual(response.status_code, 200)
        self.assertIn("idempotency-key", response["Access-Control-Allow-Headers"])

    @override_settings(CORS_ALLOWED_ORIGINS=["https://frontend.example"])
    def test_contention_response_retains_cors_and_can_be_retried(self):
        with patch("config.mutation_middleware.transaction.atomic", side_effect=OperationalError("database is locked")):
            response = self.client.post("/api/orders/checkout/", {}, HTTP_ORIGIN="https://frontend.example")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response["Retry-After"], "1")
        self.assertEqual(response["Access-Control-Allow-Origin"], "https://frontend.example")

    def test_prune_is_bounded_and_preserves_live_receipts(self):
        expired = timezone.now() - timedelta(seconds=1)
        IdempotencyRecord.objects.bulk_create(
            IdempotencyRecord(user=self.buyer, operation="audit", key=f"expired-{i}", fingerprint="f",
                              response_status=200, response_body={}, expires_at=expired) for i in range(3)
        )
        live = IdempotencyRecord.objects.create(user=self.buyer, operation="audit", key="live-key",
                                               fingerprint="f", response_status=200, response_body={})
        call_command("prune_idempotency", limit=1, verbosity=0)
        self.assertEqual(IdempotencyRecord.objects.filter(expires_at__lt=timezone.now()).count(), 2)
        call_command("prune_idempotency", verbosity=0)
        self.assertEqual(list(IdempotencyRecord.objects.values_list("id", flat=True)), [live.pk])


class GuestReadOnlyTests(APITestCase):
    def test_reading_a_deleted_guest_book_does_not_save_a_stale_session(self):
        cache.clear()
        seller = User.objects.create_user(username="read-seller", password="pass")
        book = Book.objects.create(title="b", author="a", price=100, seller=seller, status="approved")
        self.client.post("/api/orders/cart/", {"book": book.pk})
        book.delete()
        with patch("django.contrib.sessions.backends.db.SessionStore.save") as save:
            response = self.client.get("/api/orders/cart/")
        self.assertEqual(response.data["count"], 0)
        save.assert_not_called()
