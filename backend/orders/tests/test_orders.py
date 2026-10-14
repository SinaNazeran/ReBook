from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book
from notifications.models import Notification
from orders.models import Order, Transaction


class FakePaymentTests(APITestCase):
    def test_paying_twice_returns_detail_message(self):
        # getErrorMessage() در فرانت فقط کلید detail را می‌خواند، نه error
        seller = User.objects.create_user(username="seller", password="pass")
        buyer = User.objects.create_user(username="buyer", password="pass")
        book = Book.objects.create(title="b", author="a", price=100, seller=seller, status="approved")
        order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")
        Transaction.objects.create(order=order, amount=100)

        self.client.force_authenticate(buyer)
        self.assertEqual(self.client.post(f"/api/orders/{order.pk}/pay/").status_code, 200)

        response = self.client.post(f"/api/orders/{order.pk}/pay/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_sold_book_cannot_be_paid_again_by_another_order(self):
        seller = User.objects.create_user(username="seller", password="pass")
        buyer_a = User.objects.create_user(username="a", password="pass")
        buyer_b = User.objects.create_user(username="b", password="pass")
        book = Book.objects.create(title="b", author="a", price=100, seller=seller, status="approved")

        def open_order(buyer):
            order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")
            Transaction.objects.create(order=order, amount=100)
            return order

        # فقط یک سفارش باز برای هر کتاب مجاز است؛ سفارش دوم پس از پرداخت اولی ساخته می‌شود
        orders = [open_order(buyer_a)]
        self.client.force_authenticate(buyer_a)
        self.assertEqual(self.client.post(f"/api/orders/{orders[0].pk}/pay/").status_code, 200)
        orders.append(open_order(buyer_b))

        self.client.force_authenticate(buyer_b)
        response = self.client.post(f"/api/orders/{orders[1].pk}/pay/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)
        # پرداخت ناموفق باید کامل برگردانده شود
        orders[1].refresh_from_db()
        self.assertEqual(orders[1].status, "pending")
        self.assertEqual(orders[1].transaction.status, "pending")



class OrderCreateTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="pass")

    def order(self, user, status):
        book = Book.objects.create(title="b", author="a", price=100, seller=self.seller, status=status)
        self.client.force_authenticate(user)
        return self.client.post("/api/orders/create/", {"book": book.pk, "shipping_address": "x"})

    def test_approved_book_can_be_ordered(self):
        self.assertEqual(self.order(self.buyer, "approved").status_code, 201)

    def test_unavailable_book_cannot_be_ordered(self):
        for status in ("pending", "rejected", "sold"):
            with self.subTest(status=status):
                response = self.order(self.buyer, status)
                self.assertEqual(response.status_code, 400)
                self.assertIn("book", response.data)

    def test_seller_cannot_order_own_book(self):
        self.assertEqual(self.order(self.seller, "approved").status_code, 400)



class OnePendingOrderPerBookTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.book = Book.objects.create(
            title="b", author="a", price=100, seller=self.seller, status="approved"
        )

    def order(self, user):
        self.client.force_authenticate(user)
        return self.client.post("/api/orders/create/", {"book": self.book.pk, "shipping_address": "x"})

    def test_second_buyer_is_rejected_while_an_order_is_pending(self):
        self.assertEqual(self.order(self.buyer).status_code, 201)
        response = self.order(self.other)
        self.assertEqual(response.status_code, 400)
        self.assertIn("book", response.data)

    def test_same_buyer_cannot_open_a_second_order(self):
        self.assertEqual(self.order(self.buyer).status_code, 201)
        self.assertEqual(self.order(self.buyer).status_code, 400)
        self.assertEqual(Order.objects.filter(book=self.book).count(), 1)

    def test_book_can_be_ordered_again_after_cancel(self):
        order_id = self.order(self.buyer).data["id"]
        self.client.post(f"/api/orders/{order_id}/cancel/")
        self.assertEqual(self.order(self.other).status_code, 201)

    def test_database_rejects_two_pending_orders_for_one_book(self):
        Order.objects.create(buyer=self.buyer, book=self.book, total_price=100, shipping_address="x")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Order.objects.create(buyer=self.other, book=self.book, total_price=100, shipping_address="x")



class OrderCancelTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="pass")
        book = Book.objects.create(title="b", author="a", price=100, seller=self.seller, status="approved")
        self.order = Order.objects.create(buyer=self.buyer, book=book, total_price=100, shipping_address="x")
        Transaction.objects.create(order=self.order, amount=100)

    def cancel(self, user):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/orders/{self.order.pk}/cancel/")

    def test_buyer_cancels_and_seller_is_notified(self):
        self.assertEqual(self.cancel(self.buyer).status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "cancelled")
        self.assertEqual(self.order.transaction.status, "failed")
        self.assertTrue(Notification.objects.filter(user=self.seller, title="لغو سفارش").exists())

    def test_seller_can_release_a_stuck_order_and_buyer_is_notified(self):
        self.assertEqual(self.cancel(self.seller).status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.buyer, title="لغو سفارش").exists())

    def test_stranger_gets_404(self):
        stranger = User.objects.create_user(username="x", password="pass")
        self.assertEqual(self.cancel(stranger).status_code, 404)

    def test_paid_order_cannot_be_cancelled(self):
        self.client.force_authenticate(self.buyer)
        self.client.post(f"/api/orders/{self.order.pk}/pay/")
        response = self.cancel(self.buyer)
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_cancelled_order_cannot_be_paid(self):
        self.cancel(self.buyer)
        response = self.client.post(f"/api/orders/{self.order.pk}/pay/")
        self.assertEqual(response.status_code, 400)
        self.order.book.refresh_from_db()
        self.assertEqual(self.order.book.status, "approved")



class PersonalOrderListsTests(APITestCase):
    def test_my_orders_and_my_sales_are_not_cut_at_one_page(self):
        seller = User.objects.create_user(username="seller", password="pass")
        buyer = User.objects.create_user(username="buyer", password="pass")
        book = Book.objects.create(title="b", author="a", price=100, seller=seller, status="sold")
        Order.objects.bulk_create(
            Order(buyer=buyer, book=book, total_price=100, shipping_address="x", status="paid")
            for _ in range(15)
        )
        self.client.force_authenticate(buyer)
        self.assertEqual(self.client.get("/api/orders/my-orders/").data["count"], 15)
        self.client.force_authenticate(seller)
        self.assertEqual(self.client.get("/api/orders/my-sales/").data["count"], 15)

    def test_sales_show_buyer_username_but_no_contact_details(self):
        seller = User.objects.create_user(username="seller", password="pass")
        buyer = User.objects.create_user(
            username="buyer", password="pass", email="b@example.com", phone="09120000000"
        )
        book = Book.objects.create(title="b", author="a", price=100, seller=seller, status="approved")
        Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")
        self.client.force_authenticate(seller)
        sale = self.client.get("/api/orders/my-sales/").data["results"][0]
        self.assertEqual(sale["buyer_detail"], {"id": buyer.pk, "username": "buyer"})

