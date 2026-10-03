from rest_framework.test import APITestCase

from accounts.models import User
from accounts.tests import png_of_size
from orders.models import Order

from .models import Book


class BookListOrderingTests(APITestCase):
    def setUp(self):
        seller = User.objects.create_user(username="seller", password="pass")
        for price in (300, 100, 200):
            Book.objects.create(
                title=f"b{price}", author="a", price=price, seller=seller, status="approved"
            )

    def test_allowed_ordering_is_applied(self):
        response = self.client.get("/api/books/", {"ordering": "price"})
        prices = [b["price"] for b in response.data["results"]]
        self.assertEqual(prices, [100, 200, 300])

    def test_invalid_ordering_falls_back_instead_of_500(self):
        response = self.client.get("/api/books/", {"ordering": "not_a_field"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 3)

    def test_price_filters(self):
        response = self.client.get("/api/books/", {"min_price": "150", "max_price": "۲۵۰"})
        self.assertEqual([b["price"] for b in response.data["results"]], [200])

    def test_invalid_price_filters_are_ignored_instead_of_500(self):
        response = self.client.get("/api/books/", {"min_price": "abc", "max_price": "-5"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 3)


class BookDetailVisibilityTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            username="seller", password="pass", email="s@example.com", phone="09120000000"
        )

    def book(self, status):
        return Book.objects.create(title="b", author="a", price=100, seller=self.seller, status=status)

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
        self.assertEqual(self.client.get("/api/books/wishlist/").data["count"], 0)


class BookUpdateDeleteTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.client.force_authenticate(self.seller)

    def book(self, status):
        return Book.objects.create(title="b", author="a", price=100, seller=self.seller, status=status)

    def test_editing_approved_book_sends_it_back_for_approval(self):
        book = self.book("approved")
        response = self.client.patch(f"/api/books/{book.pk}/update/", {"title": "new"})
        self.assertEqual(response.status_code, 200)
        book.refresh_from_db()
        self.assertEqual((book.title, book.status), ("new", "pending"))

    def test_oversized_cover_image_is_rejected(self):
        data = {"title": "b", "author": "a", "price": 100, "cover_image": png_of_size(5.1)}
        response = self.client.post("/api/books/create/", data, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("cover_image", response.data)

    def test_sold_book_cannot_be_edited_or_deleted(self):
        book = self.book("sold")
        buyer = User.objects.create_user(username="buyer", password="pass")
        order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")

        self.assertEqual(self.client.patch(f"/api/books/{book.pk}/update/", {"price": 1}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/books/{book.pk}/delete/").status_code, 404)
        # سفارش خریدار نباید با حذف کتاب از بین برود
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())
