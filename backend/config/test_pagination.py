from urllib.parse import urlsplit

from django.core.cache import cache, caches
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book, Category, Wishlist
from notifications.models import Notification, SupportTicket
from orders.models import Order


class BoundedListTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="page-user", password="pass")
        cls.other = User.objects.create_user(username="page-other", password="pass")
        cls.books = Book.objects.bulk_create(
            Book(title=f"book-{i}", author="a", price=100, seller=cls.user, status="approved")
            for i in range(135)
        )
        Category.objects.bulk_create(Category(name=f"c{i}", slug=f"c{i}") for i in range(135))
        Wishlist.objects.bulk_create(Wishlist(user=cls.user, book=b) for b in cls.books)
        Order.objects.bulk_create(
            Order(buyer=cls.user, book=b, total_price=100, shipping_address="x", status="paid")
            for b in cls.books
        )
        Notification.objects.bulk_create(
            Notification(user=cls.user, title=f"n{i}", message="m") for i in range(135)
        )
        SupportTicket.objects.bulk_create(
            SupportTicket(user=cls.user, subject=f"t{i}", message="m") for i in range(135)
        )
        other_book = Book.objects.create(
            title="other", author="a", price=100, seller=cls.other, status="pending"
        )
        Wishlist.objects.create(user=cls.other, book=other_book)
        Order.objects.create(buyer=cls.other, book=other_book, total_price=100, shipping_address="x")
        Notification.objects.create(user=cls.other, title="other", message="m")
        SupportTicket.objects.create(user=cls.other, subject="other", message="m")
        # Equal timestamps must still give deterministic page boundaries.
        stamp = timezone.now()
        for model, field in ((Book, "created_at"), (Order, "created_at"),
                             (Wishlist, "added_at"), (Notification, "created_at"),
                             (SupportTicket, "created_at")):
            model.objects.all().update(**{field: stamp})

    def setUp(self):
        cache.clear()
        caches["categories"].clear()
        self.client.force_authenticate(self.user)

    endpoints = (
        "/api/books/my-books/", "/api/books/wishlist/", "/api/orders/my-orders/",
        "/api/orders/my-sales/", "/api/notifications/", "/api/notifications/support/",
        "/api/books/categories/",
    )

    def test_every_list_is_bounded_and_all_rows_are_reachable(self):
        for endpoint in self.endpoints:
            cache.clear()
            with self.subTest(endpoint=endpoint):
                first = self.client.get(endpoint, {"page_size": 12})
                self.assertEqual(first.status_code, 200)
                self.assertTrue(isinstance(first.data, dict), "Expected paginated response")
                self.assertEqual(first.data["count"], 135)
                self.assertEqual(len(first.data["results"]), 12)
                ids = [row["id"] for row in first.data["results"]]
                next_url = first.data["next"]
                while next_url:
                    parts = urlsplit(next_url)
                    response = self.client.get(f"{parts.path}?{parts.query}")
                    self.assertEqual(response.status_code, 200)
                    self.assertLessEqual(len(response.data["results"]), 12)
                    ids.extend(row["id"] for row in response.data["results"])
                    next_url = response.data["next"]
                self.assertEqual(len(ids), 135)
                self.assertEqual(len(set(ids)), 135)
                self.assertEqual(ids, sorted(ids, reverse=endpoint != "/api/books/categories/"))

    def test_page_sizes_cannot_remove_the_bound(self):
        for endpoint in self.endpoints:
            for size, expected in ((None, 12), (999999, 120), (0, 12), (-1, 12), ("bad", 12)):
                with self.subTest(endpoint=endpoint, size=size):
                    response = self.client.get(endpoint, {} if size is None else {"page_size": size})
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(isinstance(response.data, dict), "Expected paginated response")
                    self.assertEqual(len(response.data["results"]), expected)
                    self.assertIsNotNone(response.data["next"])

    def test_catalog_membership_is_user_scoped_on_later_pages(self):
        response = self.client.get("/api/books/", {"page": 11, "ordering": "price"})
        self.assertEqual(len(response.data["results"]), 12)
        self.assertTrue(all(row.get("is_wishlisted") for row in response.data["results"]))
        self.client.force_authenticate(self.other)
        response = self.client.get("/api/books/", {"page": 11, "ordering": "price"})
        self.assertTrue(all(row.get("is_wishlisted") is False for row in response.data["results"]))
        self.client.force_authenticate(None)
        response = self.client.get("/api/books/", {"page": 11, "ordering": "price"})
        self.assertTrue(all(row.get("is_wishlisted") is False for row in response.data["results"]))

    def test_invalid_page_is_explicit_and_mark_all_includes_unseen_rows(self):
        for endpoint in self.endpoints:
            self.assertEqual(self.client.get(endpoint, {"page": 999}).status_code, 404)
        self.client.post("/api/notifications/read-all/")
        self.assertEqual(self.client.get("/api/notifications/unread-count/").data, {"count": 0})
        self.assertTrue(Notification.objects.filter(user=self.other, is_read=False).exists())

    def test_collection_query_itself_has_a_database_limit(self):
        tables = (
            "books_book", "books_wishlist", "orders_order", "orders_order",
            "notifications_notification", "notifications_supportticket", "books_category",
        )
        for endpoint, table in zip(self.endpoints, tables, strict=True):
            with self.subTest(endpoint=endpoint):
                with CaptureQueriesContext(connection) as queries:
                    self.client.get(endpoint, {"page_size": 12})
                selects = [query["sql"] for query in queries if query["sql"].startswith("SELECT")]
                self.assertTrue(any(f'FROM "{table}"' in sql and "LIMIT 12" in sql for sql in selects))

    def test_admin_user_collection_is_bounded_and_sorted_by_id(self):
        User.objects.bulk_create(User(username=f"admin-page-{i}") for i in range(135))
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        response = self.client.get("/api/accounts/users/", {"page_size": 999999})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 137)
        ids = [row["id"] for row in response.data["results"]]
        self.assertEqual(len(ids), 120)
        self.assertEqual(ids, sorted(ids))
        self.assertIsNotNone(response.data["next"])
