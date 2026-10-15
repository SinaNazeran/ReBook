from unittest.mock import patch

from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from books.models import Book
from notifications.models import Notification
from orders.models import CartItem, Order, Transaction


class AtomicMutationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.seller = User.objects.create_user(username="atomic-seller", password="pass")
        cls.buyer = User.objects.create_user(username="atomic-buyer", password="pass")
        cls.other = User.objects.create_user(username="atomic-other", password="pass")

    def setUp(self):
        cache.clear()
        self.client = APIClient(raise_request_exception=False)
        self.client.force_authenticate(self.buyer)
        self.book = Book.objects.create(title="b", author="a", price=100, seller=self.seller, status="approved")

    def pending(self, transaction=True):
        order = Order.objects.create(book=self.book, buyer=self.buyer, total_price=100, shipping_address="x")
        if transaction:
            Transaction.objects.create(order=order, amount=100)
        return order

    def checkout(self, key="checkout-intent-001", address="x"):
        return self.client.post("/api/orders/checkout/", {
            "books": [{"id": self.book.pk, "price": 100}], "shipping_address": address,
        }, format="json", HTTP_IDEMPOTENCY_KEY=key)

    def test_failed_transaction_creation_rolls_back_the_order(self):
        with patch.object(Transaction.objects, "create", side_effect=RuntimeError("audit fault")):
            response = self.client.post("/api/orders/create/", {"book": self.book.pk, "shipping_address": "x"})
        self.assertEqual(response.status_code, 500)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_notification_failure_rolls_back_payment_and_allows_retry(self):
        order = self.pending()
        path = f"/api/orders/{order.pk}/pay/"
        with patch.object(Notification.objects, "create", side_effect=RuntimeError("audit fault")):
            response = self.client.post(path, HTTP_IDEMPOTENCY_KEY="pay-intent-001")
        self.assertEqual(response.status_code, 500)
        order.refresh_from_db()
        self.book.refresh_from_db()
        self.assertEqual((order.status, self.book.status, order.transaction.status), ("pending", "approved", "pending"))
        self.assertEqual(self.client.post(path, HTTP_IDEMPOTENCY_KEY="pay-intent-001").status_code, 200)

    def test_notification_failure_rolls_back_cancellation(self):
        order = self.pending()
        with patch.object(Notification.objects, "create", side_effect=RuntimeError("audit fault")):
            response = self.client.post(f"/api/orders/{order.pk}/cancel/")
        self.assertEqual(response.status_code, 500)
        order.refresh_from_db()
        self.assertEqual((order.status, order.transaction.status), ("pending", "pending"))

    def test_notification_failure_rolls_back_checkout_and_cart_removal(self):
        CartItem.objects.create(user=self.buyer, book=self.book)
        with patch.object(Notification.objects, "create", side_effect=RuntimeError("audit fault")):
            response = self.checkout()
        self.assertEqual(response.status_code, 500)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, "approved")
        self.assertFalse(Order.objects.exists())
        self.assertTrue(CartItem.objects.filter(user=self.buyer, book=self.book).exists())
        self.assertEqual(self.checkout().status_code, 201)

    def test_payment_without_transaction_fails_without_selling_the_book(self):
        order = self.pending(transaction=False)
        response = self.client.post(f"/api/orders/{order.pk}/pay/")
        self.assertEqual(response.status_code, 400)
        order.refresh_from_db()
        self.book.refresh_from_db()
        self.assertEqual((order.status, self.book.status), ("pending", "approved"))

    def test_checkout_replays_the_original_receipt_without_duplicate_effects(self):
        CartItem.objects.create(user=self.buyer, book=self.book)
        first = self.checkout()
        second = self.checkout()
        self.assertEqual((first.status_code, second.status_code), (201, 201))
        self.assertEqual(first.data, second.data)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Transaction.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(second["Idempotency-Replayed"], "true")

    def test_reused_key_with_changed_request_is_a_conflict(self):
        CartItem.objects.create(user=self.buyer, book=self.book)
        self.assertEqual(self.checkout().status_code, 201)
        response = self.checkout(address="different")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Order.objects.count(), 1)

    def test_payment_and_cancellation_retry_replay_success(self):
        order = self.pending()
        path = f"/api/orders/{order.pk}/pay/"
        first = self.client.post(path, HTTP_IDEMPOTENCY_KEY="order-pay-001")
        second = self.client.post(path, HTTP_IDEMPOTENCY_KEY="order-pay-001")
        self.assertEqual((first.status_code, second.status_code), (200, 200))
        self.assertEqual(first.data, second.data)
        self.assertEqual(Notification.objects.count(), 2)

    def test_cancel_replay_does_not_duplicate_notifications(self):
        order = self.pending()
        path = f"/api/orders/{order.pk}/cancel/"
        first = self.client.post(path, HTTP_IDEMPOTENCY_KEY="cancel-intent-001")
        second = self.client.post(path, HTTP_IDEMPOTENCY_KEY="cancel-intent-001")
        self.assertEqual((first.status_code, second.status_code), (200, 200))
        self.assertEqual(first.data, second.data)
        self.assertEqual(Notification.objects.count(), 1)

    def test_mismatched_transaction_amount_cannot_be_paid(self):
        order = self.pending()
        Transaction.objects.filter(order=order).update(amount=1)
        response = self.client.post(f"/api/orders/{order.pk}/pay/")
        self.assertEqual(response.status_code, 400)
        order.refresh_from_db()
        self.book.refresh_from_db()
        self.assertEqual((order.status, self.book.status), ("pending", "approved"))

    def test_invalid_key_is_rejected_before_effects_and_anonymous_replay_is_denied(self):
        CartItem.objects.create(user=self.buyer, book=self.book)
        self.assertEqual(self.checkout(key="bad key").status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self.checkout().status_code, 201)
        self.client.force_authenticate(None)
        self.assertEqual(self.checkout().status_code, 401)

    def test_order_creation_replays_and_does_not_leak_to_another_user(self):
        data = {"book": self.book.pk, "shipping_address": "private address"}
        first = self.client.post("/api/orders/create/", data, HTTP_IDEMPOTENCY_KEY="create-order-001")
        second = self.client.post("/api/orders/create/", data, HTTP_IDEMPOTENCY_KEY="create-order-001")
        self.assertEqual((first.status_code, second.status_code), (201, 201))
        self.assertEqual(first.data, second.data)
        self.client.force_authenticate(self.other)
        response = self.client.post("/api/orders/create/", data, HTTP_IDEMPOTENCY_KEY="create-order-001")
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("private address", str(response.data))
        self.assertEqual(Order.objects.count(), 1)
