"""SQLite races use committed fixtures and independent request connections."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.conf import settings
from django.core.cache import cache
from django.db import connection, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from accounts.models import User
from books.models import Book
from notifications.models import Notification
from orders.models import CartItem, IdempotencyRecord, Order, Transaction


@skipUnless(connection.vendor == "sqlite", "SQLite transaction serialization regression")
class SQLiteMutationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="pass")
        self.rival = User.objects.create_user(username="rival", password="pass")

    def book(self):
        return Book.objects.create(
            title="book", author="author", price=100,
            seller=self.seller, status="approved",
        )

    def pending(self, book):
        order = Order.objects.create(
            buyer=self.buyer, book=book, total_price=100, shipping_address="address",
        )
        Transaction.objects.create(order=order, amount=100)
        return order

    def intent(self, user, path, data=None, key=None, method="post", cookies=None):
        return (user, path, data or {}, key, method, cookies)

    def request(self, client, intent):
        _, path, data, key, method, _ = intent
        headers = {"HTTP_IDEMPOTENCY_KEY": key} if key else {}
        return getattr(client, method)(path, data, format="json", **headers)

    def race(self, *intents):
        # Synchronize before entering middleware: a barrier in a write transaction
        # would deadlock the serializer whose behavior these tests exercise.
        gate = Barrier(len(intents))

        def worker(intent):
            connections.close_all()
            client = APIClient()
            if intent[0] is not None:
                client.force_authenticate(intent[0])
            if intent[5]:
                for name, value in intent[5].items():
                    client.cookies[name] = value
            connection.ensure_connection()
            raw_connection = connection.connection
            try:
                gate.wait(timeout=10)
                response = self.request(client, intent)
                return client, response, raw_connection
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(intents)) as pool:
            futures = [pool.submit(worker, intent) for intent in intents]
            results = [future.result(timeout=30) for future in futures]
        self.assertEqual(len({id(result[2]) for result in results}), len(intents))
        responses = []
        # Shared-memory SQLite can reject the competing BEGIN immediately with
        # SQLITE_LOCKED. Retry only after ALL overlapping requests have finished.
        for intent, (client, response, _) in zip(intents, results):
            for _ in range(3):
                if response.status_code != 409:
                    break
                self.assertIn("Retry-After", response)
                response = self.request(client, intent)
            self.assertNotEqual(response.status_code, 409, response.content)
            responses.append(response)
        return responses

    def assert_paid(self, order, book):
        order.refresh_from_db()
        book.refresh_from_db()
        payment = Transaction.objects.get(order=order)
        self.assertEqual((order.status, book.status, payment.status), ("paid", "sold", "success"))
        self.assertEqual(payment.amount, order.total_price)
        self.assertTrue(payment.reference_code)
        self.assertEqual(Order.objects.filter(book=book).count(), 1)
        self.assertEqual(Transaction.objects.filter(order=order).count(), 1)
        self.assertEqual(Notification.objects.filter(notification_type="payment").count(), 2)

    def test_same_key_simultaneous_payments_replay_original_receipt_once(self):
        book = self.book()
        order = self.pending(book)
        intent = self.intent(self.buyer, f"/api/orders/{order.pk}/pay/", key="one-payment")
        first, second = self.race(intent, intent)
        self.assertEqual([first.status_code, second.status_code], [200, 200])
        self.assertEqual(first.json(), second.json())
        self.assertEqual(sum(response.get("Idempotency-Replayed") == "true" for response in (first, second)), 1)
        self.assert_paid(order, book)
        self.assertEqual(first.json()["reference_code"], order.transaction.reference_code)
        self.assertEqual(IdempotencyRecord.objects.filter(user=self.buyer).count(), 1)

    def test_payment_racing_cancellation_has_one_consistent_terminal_state(self):
        book = self.book()
        order = self.pending(book)
        pay, cancel = self.race(
            self.intent(self.buyer, f"/api/orders/{order.pk}/pay/", key="pay-intent"),
            self.intent(self.seller, f"/api/orders/{order.pk}/cancel/", key="cancel-intent"),
        )
        self.assertEqual(sorted([pay.status_code, cancel.status_code]), [200, 400])
        order.refresh_from_db()
        if pay.status_code == 200:
            self.assert_paid(order, book)
            self.assertFalse(Notification.objects.filter(title="لغو سفارش").exists())
        else:
            book.refresh_from_db()
            payment = Transaction.objects.get(order=order)
            self.assertEqual((order.status, book.status, payment.status), ("cancelled", "approved", "failed"))
            self.assertFalse(payment.reference_code)
            self.assertEqual(Notification.objects.filter(title="لغو سفارش").count(), 1)
            self.assertFalse(Notification.objects.filter(notification_type="payment").exists())
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Transaction.objects.count(), 1)

    def test_checkout_racing_rival_reservation_cannot_leave_paid_and_pending(self):
        book = self.book()
        CartItem.objects.create(user=self.buyer, book=book)
        checkout, reserve = self.race(
            self.intent(self.buyer, "/api/orders/checkout/", {
                "books": [{"id": book.pk, "price": 100}], "shipping_address": "address",
            }, key="checkout"),
            self.intent(self.rival, "/api/orders/create/", {
                "book": book.pk, "shipping_address": "address",
            }, key="reserve-intent"),
        )
        self.assertEqual(sum(response.status_code < 300 for response in (checkout, reserve)), 1)
        self.assertIn(400, [checkout.status_code, reserve.status_code])
        self.assertEqual(Order.objects.filter(book=book).count(), 1)
        order = Order.objects.get(book=book)
        book.refresh_from_db()
        payment = Transaction.objects.get(order=order)
        if checkout.status_code < 300:
            self.assertEqual(order.buyer_id, self.buyer.pk)
            self.assert_paid(order, book)
        else:
            self.assertEqual(order.buyer_id, self.rival.pk)
            self.assertEqual((order.status, book.status, payment.status), ("pending", "approved", "pending"))
            self.assertFalse(Notification.objects.filter(notification_type="payment").exists())

    def seller_mutation_race(self, method, suffix, data):
        book = self.book()
        order = self.pending(book)
        pay, mutate = self.race(
            self.intent(self.buyer, f"/api/orders/{order.pk}/pay/", key="pay-intent"),
            self.intent(self.seller, f"/api/books/{book.pk}/{suffix}/", data, method=method),
        )
        if method == "delete" and mutate.status_code == 204:
            # Deleting a pending listing first may remove its unpaid order.
            # A successful payment followed by CASCADE must never be accepted.
            self.assertEqual(pay.status_code, 404, pay.content)
            self.assertFalse(Book.objects.filter(pk=book.pk).exists())
            self.assertFalse(Order.objects.filter(pk=order.pk).exists())
            self.assertFalse(Transaction.objects.filter(order_id=order.pk).exists())
            self.assertFalse(Notification.objects.filter(notification_type="payment").exists())
            return
        self.assertEqual(pay.status_code, 200, pay.content)
        self.assertIn(mutate.status_code, (400, 404), mutate.content)
        self.assert_paid(order, book)
        self.assertEqual(book.title, "book")

    def test_seller_edit_racing_payment_cannot_revert_sold_book(self):
        self.seller_mutation_race("patch", "update", {"title": "changed"})

    def test_seller_delete_racing_payment_preserves_paid_ledger(self):
        self.seller_mutation_race("delete", "delete", {})

    def test_two_authenticated_adds_at_49_items_respect_50_item_limit(self):
        existing = [self.book() for _ in range(49)]
        CartItem.objects.bulk_create(CartItem(user=self.buyer, book=book) for book in existing)
        candidates = [self.book(), self.book()]
        responses = self.race(*[
            self.intent(self.buyer, "/api/orders/cart/", {"book": book.pk})
            for book in candidates
        ])
        self.assertEqual(sorted(response.status_code for response in responses), [200, 400])
        ids = set(CartItem.objects.filter(user=self.buyer).values_list("book_id", flat=True))
        self.assertEqual(len(ids), 50)
        self.assertTrue({book.pk for book in existing} <= ids)
        self.assertEqual(len(ids & {book.pk for book in candidates}), 1)

    def test_two_guest_clients_sharing_session_preserve_both_additions(self):
        client = APIClient()
        session = client.session
        session["established"] = True
        session.save()
        cookies = {settings.SESSION_COOKIE_NAME: session.session_key}
        books = [self.book(), self.book()]
        responses = self.race(*[
            self.intent(None, "/api/orders/cart/", {"book": book.pk}, cookies=cookies)
            for book in books
        ])
        self.assertEqual([response.status_code for response in responses], [200, 200])
        for name, value in cookies.items():
            client.cookies[name] = value
        payload = client.get("/api/orders/cart/").json()
        self.assertEqual({item["book"]["id"] for item in payload["items"]}, {book.pk for book in books})
        self.assertEqual((payload["count"], payload["total"]), (2, 200))
        self.assertFalse(CartItem.objects.exists())

    def test_two_guest_logins_merging_into_same_cart_respect_cap(self):
        existing = [self.book() for _ in range(49)]
        CartItem.objects.bulk_create(CartItem(user=self.buyer, book=book) for book in existing)
        candidates = [self.book(), self.book()]
        intents = []
        for book in candidates:
            session = APIClient().session
            session["cart"] = [book.pk]
            session.save()
            intents.append(self.intent(None, "/api/accounts/login/", {
                "username": self.buyer.username, "password": "pass",
            }, cookies={settings.SESSION_COOKIE_NAME: session.session_key}))
        responses = self.race(*intents)
        self.assertEqual([response.status_code for response in responses], [200, 200])
        self.assertTrue(all(response.json()["user"]["id"] == self.buyer.pk for response in responses))
        ids = set(CartItem.objects.filter(user=self.buyer).values_list("book_id", flat=True))
        self.assertEqual(len(ids), 50)
        self.assertTrue({book.pk for book in existing} <= ids)
        self.assertEqual(len(ids & {book.pk for book in candidates}), 1)
