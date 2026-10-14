import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.tests import png_of_size
from books.models import Book
from orders.models import Order


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

    def test_book_with_an_order_awaiting_payment_cannot_be_edited(self):
        # ویرایش کتاب را به صف بررسی می‌برد و پرداخت خریدار شکست می‌خورد؛ پس اول باید سفارش لغو شود
        book = self.book("approved")
        buyer = User.objects.create_user(username="buyer", password="pass")
        order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")

        response = self.client.patch(f"/api/books/{book.pk}/update/", {"title": "new"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("معاملات من", response.data["detail"])
        book.refresh_from_db()
        self.assertEqual((book.title, book.status), ("b", "approved"))

        Order.objects.filter(pk=order.pk).update(status="cancelled")
        self.assertEqual(self.client.patch(f"/api/books/{book.pk}/update/", {"title": "new"}).status_code, 200)

    def test_oversized_cover_image_is_rejected(self):
        data = {"title": "b", "author": "a", "price": 100, "cover_image": png_of_size(5.1)}
        response = self.client.post("/api/books/create/", data, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("cover_image", response.data)

    def test_cover_is_shrunk_to_webp_with_its_dimensions(self):
        buf = io.BytesIO()
        Image.new("RGBA", (2000, 3000), "red").save(buf, "PNG")
        cover = SimpleUploadedFile("big.png", buf.getvalue(), "image/png")
        data = {"title": "b", "author": "a", "price": 100, "cover_image": cover}
        with tempfile.TemporaryDirectory() as media, self.settings(MEDIA_ROOT=media):
            self.assertEqual(self.client.post("/api/books/create/", data, format="multipart").status_code, 201)
            book = Book.objects.get()
            self.assertTrue(book.cover_image.name.endswith(".webp"))
            self.assertEqual((book.cover_width, book.cover_height), (1000, 1500))
            with Image.open(book.cover_image.path) as img:
                self.assertEqual(img.size, (1000, 1500))
            book.status = "approved"
            book.save()
            detail = self.client.get(f"/api/books/{book.pk}/").data
            self.assertEqual((detail["cover_width"], detail["cover_height"]), (1000, 1500))

    def test_cover_saved_outside_the_api_is_shrunk_once(self):
        # پنل مدیریت هم از save() مدل رد می‌شود
        buf = io.BytesIO()
        Image.new("RGB", (1200, 1200)).save(buf, "PNG")
        cover = SimpleUploadedFile("admin.png", buf.getvalue(), "image/png")
        with tempfile.TemporaryDirectory() as media, self.settings(MEDIA_ROOT=media):
            book = Book.objects.create(title="b", author="a", price=100, seller=self.seller, cover_image=cover)
            self.assertTrue(book.cover_image.name.endswith(".webp"))
            self.assertEqual((book.cover_width, book.cover_height), (1000, 1000))
            name = book.cover_image.name
            book.status = "approved"
            book.save()
            self.assertEqual(book.cover_image.name, name)

    def test_sold_book_cannot_be_edited_or_deleted(self):
        book = self.book("sold")
        buyer = User.objects.create_user(username="buyer", password="pass")
        order = Order.objects.create(buyer=buyer, book=book, total_price=100, shipping_address="x")

        self.assertEqual(self.client.patch(f"/api/books/{book.pk}/update/", {"price": 1}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/books/{book.pk}/delete/").status_code, 404)
        # سفارش خریدار نباید با حذف کتاب از بین برود
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())

