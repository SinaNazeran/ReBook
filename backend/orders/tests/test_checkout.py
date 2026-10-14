from django.core.cache import cache
from rest_framework.test import APITestCase

from accounts.models import User
from books.models import Book
from notifications.models import Notification
from orders import cart
from orders.models import CartItem, Order, Transaction


class CheckoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.seller_a = User.objects.create_user(username="seller_a", password="pass")
        self.seller_b = User.objects.create_user(username="seller_b", password="pass")
        self.buyer = User.objects.create_user(username="buyer", password="pass")
        self.a = Book.objects.create(title="a", author="x", price=100, seller=self.seller_a, status="approved")
        self.b = Book.objects.create(title="b", author="x", price=250, seller=self.seller_b, status="approved")
        for book in (self.a, self.b):
            CartItem.objects.create(user=self.buyer, book=book)
        self.client.force_authenticate(self.buyer)

    def checkout(self, books=None, prices=None, address="تهران، خیابان انقلاب"):
        # قیمتی که خریدار در سبد دید، نه قیمت فعلی پایگاه داده
        seen = {self.a.pk: 100, self.b.pk: 250, **(prices or {})}
        ids = [self.a.pk, self.b.pk] if books is None else books
        return self.client.post(
            "/api/orders/checkout/",
            {
                "books": [{"id": book_id, "price": seen.get(book_id, 0)} for book_id in ids],
                "shipping_address": address,
            },
            format="json",
        )

    def test_checkout_sells_every_book_with_one_code(self):
        response = self.checkout()
        self.assertEqual(response.status_code, 201)
        orders = Order.objects.filter(buyer=self.buyer)
        self.assertEqual(sorted(orders.values_list("status", flat=True)), ["paid", "paid"])
        codes = set(
            Transaction.objects.filter(order__in=orders, status="success").values_list("reference_code", flat=True)
        )
        self.assertEqual(codes, {response.data["reference_code"]})
        self.assertEqual(set(Book.objects.values_list("status", flat=True)), {"sold"})
        self.assertFalse(CartItem.objects.filter(user=self.buyer).exists())
        for user in (self.seller_a, self.seller_b, self.buyer):
            with self.subTest(user=user.username):
                self.assertTrue(Notification.objects.filter(user=user, notification_type="payment").exists())

    def test_stale_book_rejects_the_whole_checkout(self):
        Book.objects.filter(pk=self.a.pk).update(status="sold")
        response = self.checkout()
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)
        self.assertFalse(Order.objects.exists())
        self.b.refresh_from_db()
        self.assertEqual(self.b.status, "approved")

    def test_second_submit_creates_nothing(self):
        self.assertEqual(self.checkout().status_code, 201)
        self.assertEqual(self.checkout().status_code, 400)
        self.assertEqual(Order.objects.count(), 2)

    def test_changed_price_is_rejected(self):
        Book.objects.filter(pk=self.b.pk).update(price=300)
        response = self.checkout()
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_book_outside_the_cart_is_rejected(self):
        other = Book.objects.create(title="c", author="x", price=50, seller=self.seller_a, status="approved")
        response = self.checkout(books=[self.a.pk, other.pk])
        self.assertEqual(response.status_code, 400)
        self.assertIn("«c»", response.data["detail"])
        self.assertFalse(Order.objects.exists())

    def test_private_book_title_is_not_disclosed(self):
        private_title = "عنوان خصوصی پس از ویرایش فروشنده"
        for book_status in ("pending", "rejected"):
            for in_cart in (True, False):
                with self.subTest(status=book_status, in_cart=in_cart):
                    Book.objects.filter(pk=self.b.pk).update(status=book_status, title=private_title)
                    if in_cart:
                        CartItem.objects.get_or_create(user=self.buyer, book=self.b)
                    else:
                        CartItem.objects.filter(user=self.buyer, book=self.b).delete()
                    response = self.checkout()
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("detail", response.data)
                    self.assertNotIn(private_title, str(response.data))
                    self.assertFalse(Order.objects.exists())
                    self.assertFalse(Transaction.objects.exists())
                    self.assertFalse(Notification.objects.exists())
                    self.a.refresh_from_db()
                    self.assertEqual(self.a.status, "approved")

    def test_swapped_prices_with_the_same_sum_are_rejected(self):
        Book.objects.filter(pk=self.a.pk).update(price=150)
        Book.objects.filter(pk=self.b.pk).update(price=200)
        response = self.checkout()
        self.assertEqual(response.status_code, 400)
        self.assertIn("«a»", response.data["detail"])
        self.assertFalse(Order.objects.exists())

    def test_oversized_or_malformed_list_is_400(self):
        too_many = [{"id": n, "price": 1} for n in range(cart.MAX_ITEMS + 1)]
        for books in (too_many, "12", [self.a.pk], [{"id": self.a.pk}], {"id": self.a.pk, "price": 100}):
            with self.subTest(books=str(books)[:30]):
                response = self.client.post(
                    "/api/orders/checkout/",
                    {"books": books, "shipping_address": "تهران"},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_blank_address_or_empty_list_is_400(self):
        self.assertEqual(self.checkout(address="   ").status_code, 400)
        self.assertEqual(self.checkout(books=[]).status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_duplicate_ids_buy_once(self):
        self.assertEqual(self.checkout(books=[self.a.pk, self.a.pk, self.b.pk]).status_code, 201)
        self.assertEqual(Order.objects.count(), 2)

    def test_guest_gets_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.checkout().status_code, 401)


    def test_retry_after_success_says_already_bought(self):
        # پاسخ اولی گم شده و خریدار دوباره می‌زند: باید بداند خرید انجام شده، نه اینکه «سبدت عوض شده»
        self.assertEqual(self.checkout().status_code, 201)
        response = self.checkout()
        self.assertEqual(response.status_code, 400)
        self.assertIn("معاملات من", response.data["detail"])
        self.assertEqual(Order.objects.count(), 2)

