from unittest.mock import patch

from django.core.cache import cache, caches
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book, Category, Wishlist


class CachePolicyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="cache-user", password="pass")
        cls.other = User.objects.create_user(username="cache-other", password="pass")
        cls.book = Book.objects.create(title="cache-book", author="a", price=100,
                                      seller=cls.other, status="approved")
        Wishlist.objects.create(user=cls.user, book=cls.book)
        Category.objects.bulk_create(Category(name=f"category {i}", slug=f"cat-{i}") for i in range(15))

    def setUp(self):
        cache.clear()
        if "categories" in caches:
            caches["categories"].clear()

    def tearDown(self):
        caches["categories"].clear()

    def test_private_errors_and_mutations_never_allow_storage(self):
        for path in ("/api/accounts/profile/", "/api/orders/cart/", "/api/missing/"):
            response = self.client.get(path)
            self.assertIn("no-store", response.get("Cache-Control", ""))
        response = self.client.post("/api/orders/checkout/", {}, format="json")
        self.assertIn("no-store", response.get("Cache-Control", ""))

    def test_catalog_membership_is_not_reused_between_accounts(self):
        for user, expected in ((self.user, True), (self.other, False), (None, False)):
            self.client.force_authenticate(user)
            response = self.client.get("/api/books/")
            self.assertEqual(response.data["results"][0]["is_wishlisted"], expected)
            self.assertIn("no-store", response.get("Cache-Control", ""))

    def test_category_page_hits_avoid_database_queries_and_keep_pagination(self):
        first = self.client.get("/api/books/categories/?page_size=12")
        self.assertEqual(len(first.data["results"]), 12)
        with self.assertNumQueries(0):
            second = self.client.get("/api/books/categories/?page_size=12")
        self.assertEqual(second.data, first.data)
        self.assertIn("max-age=60", first.get("Cache-Control", ""))
        last = self.client.get("/api/books/categories/?page_size=12&page=2")
        self.assertEqual(len(last.data["results"]), 3)

    def test_category_cache_expires_and_does_not_extend_client_freshness(self):
        with patch("time.time", return_value=1000):
            first = self.client.get("/api/books/categories/")
        Category.objects.filter(pk=first.data["results"][0]["id"]).update(name="changed")
        with patch("time.time", return_value=1030):
            second = self.client.get("/api/books/categories/")
        self.assertNotEqual(second.data["results"][0]["name"], "changed")
        self.assertIn("max-age=30", second.get("Cache-Control", ""))
        with patch("time.time", return_value=1061):
            third = self.client.get("/api/books/categories/")
        self.assertEqual(third.data["results"][0]["name"], "changed")

    @override_settings(ALLOWED_HOSTS=["testserver", "other.example"])
    def test_cached_links_use_current_host_and_errors_are_not_cached(self):
        self.client.get("/api/books/categories/?page_size=1")
        response = self.client.get("/api/books/categories/?page_size=1", HTTP_HOST="other.example")
        self.assertTrue(response.data["next"].startswith("http://other.example/"))
        for path in ("?page=99999", "?page=invalid"):
            response = self.client.get("/api/books/categories/" + path)
            self.assertEqual(response.status_code, 404)
            self.assertIn("no-store", response.get("Cache-Control", ""))

    def test_authenticated_category_response_and_browsable_html_are_not_public(self):
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/books/categories/")
        self.assertIn("no-store", response.get("Cache-Control", ""))
        self.client.force_authenticate(None)
        response = self.client.get("/api/books/categories/", HTTP_ACCEPT="text/html")
        self.assertIn("no-store", response.get("Cache-Control", ""))

    @override_settings(CORS_ALLOWED_ORIGINS=["https://frontend.example"])
    def test_freshness_headers_are_readable_cross_origin_and_cookie_requests_stay_private(self):
        response = self.client.get("/api/books/categories/", HTTP_ORIGIN="https://frontend.example")
        self.assertIn("Date", response["Access-Control-Expose-Headers"])
        self.assertIn("Age", response["Access-Control-Expose-Headers"])
        self.assertIn("Date", response)
        self.client.cookies["unrelated"] = "present"
        response = self.client.get("/api/books/categories/")
        self.assertIn("no-store", response["Cache-Control"])
