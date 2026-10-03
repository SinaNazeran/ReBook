from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book

from .models import Order, Transaction


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
        orders = []
        for buyer in (buyer_a, buyer_b):
            order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")
            Transaction.objects.create(order=order, amount=100)
            orders.append(order)

        self.client.force_authenticate(buyer_a)
        self.assertEqual(self.client.post(f"/api/orders/{orders[0].pk}/pay/").status_code, 200)

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
