from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from books.models import Book
from orders import cart
from orders.models import CartItem, Order


class CartTests(APITestCase):
    def setUp(self):
        cache.clear()  # شمارنده‌ی throttle در LocMem میان تست‌ها می‌ماند
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="pass")

    def book(self, status="approved", price=100, seller=None):
        return Book.objects.create(
            title="b", author="a", price=price, seller=seller or self.seller, status=status
        )

    def add(self, book_or_id):
        value = getattr(book_or_id, "pk", book_or_id)
        return self.client.post("/api/orders/cart/", {"book": value})

    def test_guest_adds_and_removes(self):
        book = self.book()
        response = self.add(book)
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data["count"], response.data["total"]), (1, 100))
        self.assertEqual(self.client.get("/api/orders/cart/").data["count"], 1)
        self.assertEqual(self.client.delete(f"/api/orders/cart/{book.pk}/").data["count"], 0)

    def test_guest_cart_belongs_to_its_session(self):
        self.add(self.book())
        self.assertEqual(APIClient().get("/api/orders/cart/").data["count"], 0)

    def test_adding_twice_keeps_one(self):
        book = self.book()
        self.client.force_authenticate(self.buyer)
        self.add(book)
        self.assertEqual(self.add(book).data["count"], 1)
        self.assertEqual(CartItem.objects.count(), 1)

    def test_cannot_add_own_sold_or_reserved_book(self):
        reserved = self.book()
        other = User.objects.create_user(username="other", password="pass")
        Order.objects.create(buyer=other, book=reserved, total_price=100, shipping_address="x")
        self.client.force_authenticate(self.buyer)
        for book in (self.book(seller=self.buyer), self.book(status="sold"), reserved):
            with self.subTest(book=book.pk):
                response = self.add(book)
                self.assertEqual(response.status_code, 400)
                self.assertIn("detail", response.data)
        self.assertFalse(CartItem.objects.exists())

    def test_unreviewed_or_unknown_book_is_404(self):
        self.client.force_authenticate(self.buyer)
        for value in (self.book(status="pending").pk, 99999):
            with self.subTest(value=value):
                self.assertEqual(self.add(value).status_code, 404)

    def test_book_sold_after_adding_shows_reason_and_leaves_total(self):
        sold, kept = self.book(), self.book(price=250)
        self.client.force_authenticate(self.buyer)
        self.add(sold)
        self.add(kept)
        Book.objects.filter(pk=sold.pk).update(status="sold")
        data = self.client.get("/api/orders/cart/").data
        item = next(i for i in data["items"] if i["book"]["id"] == sold.pk)
        self.assertEqual((item["available"], item["reason"]), (False, "فروخته شد"))
        self.assertEqual((data["count"], data["total"]), (2, 250))

    def test_book_back_in_review_is_hidden_but_kept(self):
        book = self.book()
        self.client.force_authenticate(self.buyer)
        self.add(book)
        Book.objects.filter(pk=book.pk).update(status="pending", title="unreviewed")
        self.assertEqual(self.client.get("/api/orders/cart/").data["count"], 0)
        Book.objects.filter(pk=book.pk).update(status="approved")
        self.assertEqual(self.client.get("/api/orders/cart/").data["count"], 1)

    def test_deleted_book_drops_out_of_guest_cart(self):
        book = self.book()
        self.add(book)
        book.delete()
        response = self.client.get("/api/orders/cart/")
        self.assertEqual((response.status_code, response.data["count"]), (200, 0))

    def test_cart_writes_require_csrf_token(self):
        book = self.book()
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post("/api/orders/cart/", {"book": book.pk}).status_code, 403)

        client.get("/api/accounts/csrf/")
        token = client.cookies["csrftoken"].value
        self.assertEqual(client.post("/api/orders/cart/", {"book": book.pk}, HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(client.delete(f"/api/orders/cart/{book.pk}/").status_code, 403)
        response = client.delete(f"/api/orders/cart/{book.pk}/", HTTP_X_CSRFTOKEN=token)
        self.assertEqual((response.status_code, response.data["count"]), (200, 0))

    def test_cart_is_capped(self):
        self.client.force_authenticate(self.buyer)
        CartItem.objects.bulk_create(
            CartItem(user=self.buyer, book=self.book()) for _ in range(cart.MAX_ITEMS)
        )
        self.assertEqual(self.add(self.book()).status_code, 400)



class CartMergeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="Kt7-reader-pass")

    def book(self, seller=None):
        return Book.objects.create(
            title="b", author="a", price=100, seller=seller or self.seller, status="approved"
        )

    def account_cart(self, user):
        return set(CartItem.objects.filter(user=user).values_list("book_id", flat=True))

    def test_login_moves_guest_cart_into_account(self):
        already, new, own = self.book(), self.book(), self.book(seller=self.buyer)
        CartItem.objects.create(user=self.buyer, book=already)
        for book in (already, new, own):  # مهمان نمی‌داند کدام آگهی مال خودش است
            self.client.post("/api/orders/cart/", {"book": book.pk})

        response = self.client.post(
            "/api/accounts/login/", {"username": "buyer", "password": "Kt7-reader-pass"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.account_cart(self.buyer), {already.pk, new.pk})
        self.assertNotIn(cart.SESSION_KEY, self.client.session)

    def test_register_moves_guest_cart_into_new_account(self):
        book = self.book()
        self.client.post("/api/orders/cart/", {"book": book.pk})
        response = self.client.post(
            "/api/accounts/register/",
            {
                "username": "mina",
                "email": "mina@example.com",
                "password": "Kt7-reader-pass",
                "password_confirm": "Kt7-reader-pass",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.account_cart(User.objects.get(username="mina")), {book.pk})

    def test_merge_stops_at_the_cap_and_keeps_newest_guest_books(self):
        CartItem.objects.bulk_create(
            CartItem(user=self.buyer, book=self.book()) for _ in range(cart.MAX_ITEMS - 2)
        )
        older, newer, newest = self.book(), self.book(), self.book()
        for book in (older, newer, newest):
            self.client.post("/api/orders/cart/", {"book": book.pk})
        self.client.post("/api/accounts/login/", {"username": "buyer", "password": "Kt7-reader-pass"})
        ids = self.account_cart(self.buyer)
        self.assertEqual(len(ids), cart.MAX_ITEMS)
        self.assertTrue({newer.pk, newest.pk} <= ids)
        self.assertNotIn(older.pk, ids)

    def test_logout_empties_visible_cart_but_keeps_account_cart(self):
        self.client.post("/api/accounts/login/", {"username": "buyer", "password": "Kt7-reader-pass"})
        self.client.post("/api/orders/cart/", {"book": self.book().pk})
        self.client.post("/api/accounts/logout/")
        self.assertEqual(self.client.get("/api/orders/cart/").data["count"], 0)
        self.assertEqual(CartItem.objects.filter(user=self.buyer).count(), 1)

