import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.tests import png_of_size
from orders.models import Order

from .models import Book, Category, Wishlist


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


class BookListCategoryFilterTests(APITestCase):
    def setUp(self):
        seller = User.objects.create_user(username="seller", password="pass")
        novel = Category.objects.create(name="رمان", slug="roman")
        iranian = Category.objects.create(name="رمان ایرانی", slug="roman-irani", parent=novel)
        poetry = Category.objects.create(name="شعر", slug="poetry")
        for title, category in (("parent", novel), ("child", iranian), ("other", poetry)):
            Book.objects.create(
                title=title, author="a", price=1000, seller=seller,
                category=category, status="approved",
            )

    def titles(self, slug):
        response = self.client.get("/api/books/", {"category": slug})
        return sorted(b["title"] for b in response.data["results"])

    def test_parent_category_includes_its_children(self):
        self.assertEqual(self.titles("roman"), ["child", "parent"])

    def test_child_category_is_not_widened(self):
        self.assertEqual(self.titles("roman-irani"), ["child"])

    def test_category_root_is_the_top_level_category(self):
        # رنگ مجموعه در کارت کتاب از دسته‌ی سطح اول می‌آید؛ زیرشاخه رنگ والد را می‌گیرد
        Book.objects.create(title="none", author="a", price=1000, seller=User.objects.get(), status="approved")
        roots = {b["title"]: b["category_root"] for b in self.client.get("/api/books/").data["results"]}
        novel_id = Category.objects.get(slug="roman").id
        self.assertEqual(roots["parent"], novel_id)
        self.assertEqual(roots["child"], novel_id)
        self.assertEqual(roots["other"], Category.objects.get(slug="poetry").id)
        self.assertIsNone(roots["none"])


class CategoryListTests(APITestCase):
    def test_all_categories_are_returned_without_pagination(self):
        # فهرست کشویی دسته‌بندی‌ها باید کامل باشد، نه فقط ۱۲ مورد اول
        Category.objects.bulk_create(Category(name=f"c{i}", slug=f"c{i}") for i in range(15))
        response = self.client.get("/api/books/categories/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 15)


class PersonalBookListsTests(APITestCase):
    def test_my_books_and_wishlist_are_not_cut_at_one_page(self):
        seller = User.objects.create_user(username="seller", password="pass")
        buyer = User.objects.create_user(username="buyer", password="pass")
        books = Book.objects.bulk_create(
            Book(title=f"b{i}", author="a", price=1000, seller=seller, status="approved")
            for i in range(15)
        )
        Wishlist.objects.bulk_create(Wishlist(user=buyer, book=book) for book in books)

        self.client.force_authenticate(seller)
        self.assertEqual(len(self.client.get("/api/books/my-books/").data), 15)
        self.client.force_authenticate(buyer)
        self.assertEqual(len(self.client.get("/api/books/wishlist/").data), 15)


class BookListPaginationTests(APITestCase):
    def setUp(self):
        seller = User.objects.create_user(username="seller", password="pass")
        Book.objects.bulk_create(
            Book(title=f"b{i}", author="a", price=1000, seller=seller, status="approved")
            for i in range(30)
        )

    def test_default_page_size_is_12(self):
        response = self.client.get("/api/books/")
        self.assertEqual(response.data["count"], 30)
        self.assertEqual(len(response.data["results"]), 12)
        self.assertIsNotNone(response.data["next"])

    def test_page_size_loads_several_pages_at_once(self):
        response = self.client.get("/api/books/", {"page_size": 24})
        self.assertEqual(len(response.data["results"]), 24)
        self.assertIsNotNone(response.data["next"])

    def test_page_size_is_capped_at_120(self):
        seller = User.objects.get(username="seller")
        Book.objects.bulk_create(
            Book(title=f"x{i}", author="a", price=1000, seller=seller, status="approved")
            for i in range(100)
        )
        response = self.client.get("/api/books/", {"page_size": 100000})
        self.assertEqual(len(response.data["results"]), 120)
        self.assertIsNotNone(response.data["next"])


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
