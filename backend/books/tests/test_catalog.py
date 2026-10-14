from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book, Category, Wishlist


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

    def test_invalid_price_filters_are_rejected_instead_of_500(self):
        response = self.client.get("/api/books/", {"min_price": "abc", "max_price": "-5"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("min_price", response.data)
        self.assertIn("max_price", response.data)



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

