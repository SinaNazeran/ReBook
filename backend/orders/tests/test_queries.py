from django.contrib import admin
from django.core.cache import cache
from django.db import connection
from django.test import RequestFactory
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book, Category
from orders.models import Order, Transaction


class OrderReadQueryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.seller = User.objects.create_user(username="query-seller", password="pass")
        cls.buyer = User.objects.create_user(username="query-buyer", password="pass")
        cls.other = User.objects.create_user(username="query-other", password="pass")
        root = Category.objects.create(name="root", slug="root")
        child = Category.objects.create(name="child", slug="child", parent=root)
        books = Book.objects.bulk_create(
            Book(title=f"query-{i}", author="a", price=100, seller=cls.seller,
                 category=child, status="sold") for i in range(15)
        )
        cls.orders = Order.objects.bulk_create(
            Order(book=book, buyer=cls.buyer, total_price=100, shipping_address="x", status="paid")
            for book in books
        )
        Transaction.objects.bulk_create(Transaction(order=order, amount=100) for order in cls.orders)
        cls.uncategorized = Book.objects.create(
            title="no-category", author="a", price=100, seller=cls.seller, status="sold"
        )
        cls.no_transaction = Order.objects.create(
            book=cls.uncategorized, buyer=cls.buyer, total_price=100, shipping_address="x", status="paid"
        )

    def setUp(self):
        cache.clear()

    def test_list_query_count_stays_constant_as_the_page_grows(self):
        for path, user in (("/api/orders/my-orders/", self.buyer),
                           ("/api/orders/my-sales/", self.seller)):
            self.client.force_authenticate(user)
            for size in (1, 12, 120):
                with self.subTest(path=path, page_size=size):
                    with self.assertNumQueries(2):
                        response = self.client.get(path, {"page_size": size})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.data["count"], 16)
                    self.assertEqual(len(response.data["results"]), min(size, 16))

    def test_joined_optional_relations_do_not_hide_orders_or_change_public_fields(self):
        self.client.force_authenticate(self.buyer)
        with self.assertNumQueries(1):
            response = self.client.get(f"/api/orders/{self.no_transaction.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["transaction"])
        self.assertIsNone(response.data["book_detail"]["category_root"])
        self.assertEqual(response.data["buyer_detail"], {"id": self.buyer.pk, "username": self.buyer.username})
        self.assertEqual(response.data["book_detail"]["seller_name"], self.seller.username)

    def test_order_detail_uses_one_query_with_populated_relations(self):
        self.client.force_authenticate(self.seller)
        with self.assertNumQueries(1):
            response = self.client.get(f"/api/orders/{self.orders[0].pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["transaction"])
        self.assertEqual(response.data["book_detail"]["category_name"], "child")

    def test_relation_joins_preserve_ownership_filters(self):
        self.client.force_authenticate(self.other)
        for path in ("/api/orders/my-orders/", "/api/orders/my-sales/"):
            response = self.client.get(path)
            self.assertEqual(response.data["count"], 0)
            self.assertEqual(response.data["results"], [])
        self.assertEqual(self.client.get(f"/api/orders/{self.orders[0].pk}/").status_code, 404)


class CategoryAdminQueryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(username="category-admin", password="pass")
        root = Category.objects.create(name="root", slug="root")
        Category.objects.bulk_create(
            Category(name=f"child-{i}", slug=f"child-{i}", parent=root) for i in range(12)
        )

    def test_admin_category_parent_rendering_does_not_add_per_row_queries(self):
        request = RequestFactory().get("/admin/books/category/")
        request.user = self.admin
        changelist = admin.site._registry[Category].get_changelist_instance(request)
        with self.assertNumQueries(1):
            names = [(category.name, str(category.parent) if category.parent else None)
                     for category in changelist.result_list]
        self.assertEqual(len(names), 13)
        self.assertEqual(sum(parent == "root" for _, parent in names), 12)
        self.assertIn(("root", None), names)

    def test_rendered_changelist_has_no_repeated_parent_fetches(self):
        self.client.force_login(self.admin)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/admin/books/category/")
            response.render()
        self.assertEqual(response.status_code, 200)
        parent_reads = [q["sql"] for q in queries
                        if 'FROM "books_category"' in q["sql"] and 'WHERE "books_category"."id" =' in q["sql"]]
        self.assertEqual(parent_reads, [])
