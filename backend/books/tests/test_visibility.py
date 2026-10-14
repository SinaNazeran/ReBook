from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book
from orders.models import Order


class BookDetailVisibilityTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            username="seller", password="pass", email="s@example.com", phone="09120000000"
        )

    def book(self, status):
        return Book.objects.create(title="b", author="a", price=100, seller=self.seller, status=status)

    def test_missing_book_404_message_is_persian(self):
        # پیام پیش‌فرض get_object_or_404 جنگو انگلیسی است ("No Book matches the given query.")
        response = self.client.get("/api/books/999999/")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("matches", response.data["detail"])
        self.assertRegex(response.data["detail"], "[؀-ۿ]")

    def test_seller_contact_details_are_not_public(self):
        response = self.client.get(f"/api/books/{self.book('approved').pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data["seller"]), {"id", "username"})

    def test_is_wishlisted_reflects_current_user(self):
        book = self.book("approved")
        url = f"/api/books/{book.pk}/"
        self.assertIs(self.client.get(url).data["is_wishlisted"], False)

        reader = User.objects.create_user(username="reader", password="pass")
        book.wishlisted_by.create(user=reader)
        self.client.force_authenticate(reader)
        self.assertIs(self.client.get(url).data["is_wishlisted"], True)

    def test_unapproved_book_is_visible_only_to_its_seller(self):
        for status in ("pending", "rejected"):
            with self.subTest(status=status):
                url = f"/api/books/{self.book(status).pk}/"
                self.client.force_authenticate(None)
                self.assertEqual(self.client.get(url).status_code, 404)
                self.client.force_authenticate(self.seller)
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_open_order_is_shown_without_leaking_its_id_to_others(self):
        book = self.book("approved")
        url = f"/api/books/{book.pk}/"
        self.assertIsNone(self.client.get(url).data["open_order"])

        buyer = User.objects.create_user(username="buyer", password="pass")
        order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")

        # برای بقیه فقط «رزرو شده»، بدون شناسه‌ی سفارش
        self.assertEqual(self.client.get(url).data["open_order"], {"id": None, "is_mine": False})
        self.client.force_authenticate(buyer)
        self.assertEqual(self.client.get(url).data["open_order"], {"id": order.pk, "is_mine": True})

        Order.objects.filter(pk=order.pk).update(status="cancelled")
        self.assertIsNone(self.client.get(url).data["open_order"])

    def test_unapproved_book_cannot_be_wishlisted_by_others(self):
        reader = User.objects.create_user(username="reader", password="pass")
        self.client.force_authenticate(reader)
        pending = self.book("pending")
        response = self.client.post(f"/api/books/{pending.pk}/wishlist-toggle/")
        self.assertEqual(response.status_code, 404)

        # کتابی که پس از افزودن به علاقه‌مندی‌ها رد شده، دیگر نمایش داده نمی‌شود
        approved = self.book("approved")
        self.client.post(f"/api/books/{approved.pk}/wishlist-toggle/")
        Book.objects.filter(pk=approved.pk).update(status="rejected")
        self.assertEqual(self.client.get("/api/books/wishlist/").data, [])

