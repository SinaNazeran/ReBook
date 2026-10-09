# Cart, About and Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ReBook a shopping cart that guests can use (merged into the account at login) with one simulated payment for the whole cart. Also add an honest About page and a Contact page that reaches the team.

**Architecture:** One server cart. Guests keep it in the Django session, users in `CartItem` rows; the rules live in `backend/orders/cart.py`. Checkout creates one paid `Order` per book inside one `atomic()` block. The frontend reads the cart through `CartContext` and one `cartAPI`. Contact sends guest messages to a new `ContactMessage` (read in the Django admin), and logged-in messages become support tickets.

**Tech Stack:** Django 5 + DRF (session auth, `APITestCase`), React 19 + Vite, react-bootstrap on `bootstrap.rtl.min.css`, react-icons, react-toastify. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-cart-about-contact-design.md`

**Deviations from the spec, decided while planning:**
1. Checkout also takes `total`, the sum the user saw. A mismatch is a 400, so nobody is charged a price they didn't see (review focus 2).
2. The cart page loads with `<Loading fullPage />`, like every other ledger page (MyOrders, MyBooks), instead of skeleton rows.
3. The spec's `SellSteps` becomes `components/StepRail.jsx` + `utils/steps.js` (`SELL_STEPS`, `BUY_STEPS`), so About's buying steps share the same rail.
4. `cart.remove(request, ids)` takes a list and replaces the spec's separate `remove` / `clear`.

## Global Constraints

- All commands on Windows from the repo root. Backend: `backend/` with `../venv/Scripts/python.exe`. Frontend: `frontend/` with `npm`.
- **No new dependencies.** Anything not already installed needs the owner's approval first.
- **Commits:** on branch `redesign`; message style `Area: what changed` (see `git log`); **never** add a Claude `Co-Authored-By` or any other attribution line.
- Hooks: editing `backend/**/*.py` runs ruff + `manage.py check`, and `models.py` edits also run `makemigrations --check`. Editing `frontend/**/*.{js,jsx}` runs eslint. Never edit migration files by hand; run `makemigrations`.
- **Persian copy, Persian comments** (the existing code style). Informal «تو» voice. Quotes are «». No letter-spacing, no italics.
- Numbers in the UI use `toLocaleString('fa-IR')`. Tracking codes and usernames stay Latin in `.latin-id` + `<bdi translate="no">`.
- **RTL:** logical CSS properties only (`inset-inline-*`, `margin-inline-*`, `padding-inline-*`); no `left`/`right`. User-entered text goes in `<bdi>` or `dir="auto"`. Email inputs use `dir="ltr"`.
- **API errors** use `{"detail": "..."}` or per-field lists, never `{"error": ...}`. New API calls go in the domain objects in `frontend/src/services/api.js`.
- **Ownership** is enforced by filtering querysets by `request.user`.
- **Honesty (PRODUCT.md):** no invented numbers, people, testimonials, phone numbers or email addresses. Payment is always described as simulated. The review fact is a quiet supporting line.
- **Design:** stay in DESIGN.md's Pocket Series world. Check every page at 375 and 1440 (the navbar also at 320).

## Review Focus

1. **Double submit of checkout** (double-click, or retry after a slow response). The second request must create nothing: a 400, not two sets of orders. Test in Task 3.
2. **The price changed between viewing the cart and paying** (an admin edited it). The user must not be charged an amount they didn't see: a 400 with «قیمت سبد عوض شده است». Test in Task 3.
3. **A guest's session lists a book that has since been deleted.** `GET cart/` must return 200 without it, not a 500. Test in Task 1.
4. **The session expires on the checkout step.** The user lands back on the cart with an error, and the empty guest cart tells them to log in to see their account cart. It never looks like the cart was lost for good. Verified in Task 10 (frontend has no test runner).
5. **Whitespace-only input** (address «   », contact message of spaces). It must be rejected as empty, not saved. Tests in Tasks 3 and 4.

---

### Task 1: Cart storage and cart API (backend)

**Files:**
- Modify: `backend/orders/models.py` (append `CartItem`)
- Create: `backend/orders/cart.py`
- Modify: `backend/orders/views.py` (add `CartView`, `CartItemView`)
- Modify: `backend/orders/urls.py`
- Modify: `backend/config/settings.py:159` (throttle rates)
- Test: `backend/orders/tests.py` (append `CartTests`)

**Interfaces:**
- Produces:
  - `orders.models.CartItem(user, book, added_at)`
  - `orders.cart` exports:
    - `SESSION_KEY = "cart"`
    - `MAX_ITEMS = 50`
    - `get_ids(request) -> list[int]` (newest first)
    - `add(request, book) -> None`
    - `remove(request, book_ids: list[int]) -> None`
    - `pending_buyers(book_ids) -> dict[int, int]` (book_id → buyer_id of its pending order)
    - `unavailable_reason(book, user, pending: dict) -> str | None`
    - `cart_payload(request) -> {"items": [{"book": <BookListSerializer>, "available": bool, "reason": str | None}], "count": int, "total": int}`
  - HTTP:
    - `GET /api/orders/cart/`
    - `POST /api/orders/cart/ {book}`
    - `DELETE /api/orders/cart/<book_id>/`

    All three return `cart_payload`.

- [ ] **Step 1: Write the failing tests.** Append to `backend/orders/tests.py`. Merge the new imports into the existing import block at the top of the file:

```python
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from . import cart
from .models import CartItem, Order, Transaction


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
        for value in (self.book(status="pending").pk, 99999, "abc"):
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

    def test_cart_is_capped(self):
        self.client.force_authenticate(self.buyer)
        CartItem.objects.bulk_create(
            CartItem(user=self.buyer, book=self.book()) for _ in range(cart.MAX_ITEMS)
        )
        self.assertEqual(self.add(self.book()).status_code, 400)
```

- [ ] **Step 2: Run the tests and see them fail**

Run (from `backend/`): `../venv/Scripts/python.exe manage.py test orders.tests.CartTests`
Expected: an import error on `cart` / `CartItem`.

- [ ] **Step 3: Add the model.** Append to `backend/orders/models.py`:

```python
class CartItem(models.Model):
    """یک نسخه در سبد خرید کاربر واردشده؛ سبد مهمان در session است (orders/cart.py)"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart_items",
        verbose_name="کاربر",
    )

    book = models.ForeignKey(
        Book, on_delete=models.CASCADE, related_name="cart_items", verbose_name="کتاب"
    )

    added_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ افزودن")

    class Meta:
        verbose_name = "قلم سبد خرید"
        verbose_name_plural = "اقلام سبد خرید"
        ordering = ["-added_at"]
        unique_together = ("user", "book")

    def __str__(self):
        return f"{self.user.username} - {self.book.title}"
```

Then run (from `backend/`): `../venv/Scripts/python.exe manage.py makemigrations orders && ../venv/Scripts/python.exe manage.py migrate`
Expected: `Create model CartItem`, and the migration applies.

- [ ] **Step 4: Create `backend/orders/cart.py`:**

```python
"""سبد خرید: برای کاربر واردشده ردیف‌های CartItem، برای مهمان فهرست شناسه‌ها در session.

هر نسخه‌ی کتاب یکتاست، پس سبد فقط مجموعه‌ای از شناسه‌هاست و تعداد ندارد.
login() داده‌ی session مهمان را نگه می‌دارد و logout() پاکش می‌کند؛ ادغام در merge_session_cart است.
"""

from books.models import Book
from books.serializers import BookListSerializer
from books.views import visible_books

from .models import CartItem, Order

SESSION_KEY = "cart"
# سقف سبد تا session مهمان بی‌اندازه بزرگ نشود
MAX_ITEMS = 50


def _save_session(request, ids):
    request.session[SESSION_KEY] = ids
    # تغییر درجای فهرست ذخیره نمی‌شود؛ باید صریح گفت
    request.session.modified = True


def get_ids(request):
    """شناسه‌ی کتاب‌های سبد، تازه‌ترین اول"""
    if request.user.is_authenticated:
        return list(
            CartItem.objects.filter(user=request.user).values_list("book_id", flat=True)
        )
    ids = request.session.get(SESSION_KEY, [])
    # کتاب حذف‌شده از سبد مهمان بیرون می‌رود (برای کاربر، CASCADE همین کار را می‌کند)
    existing = set(Book.objects.filter(pk__in=ids).values_list("pk", flat=True))
    kept = [book_id for book_id in ids if book_id in existing]
    if kept != ids:
        _save_session(request, kept)
    return kept[::-1]


def add(request, book):
    if request.user.is_authenticated:
        CartItem.objects.get_or_create(user=request.user, book=book)
        return
    ids = request.session.get(SESSION_KEY, [])
    if book.pk not in ids:
        _save_session(request, [*ids, book.pk])


def remove(request, book_ids):
    if request.user.is_authenticated:
        CartItem.objects.filter(user=request.user, book_id__in=book_ids).delete()
        return
    ids = request.session.get(SESSION_KEY, [])
    kept = [book_id for book_id in ids if book_id not in book_ids]
    if kept != ids:
        _save_session(request, kept)


def pending_buyers(book_ids):
    """خریدارِ سفارش در انتظار پرداختِ هر کتاب (حداکثر یکی، با قید one_pending_order_per_book)"""
    return dict(
        Order.objects.filter(
            book_id__in=book_ids, status=Order.StatusChoices.PENDING
        ).values_list("book_id", "buyer_id")
    )


def unavailable_reason(book, user, pending):
    """None اگر این نسخه همین حالا خریدنی است؛ وگرنه دلیلش برای نمایش در سبد"""
    if book.status == Book.StatusChoices.SOLD:
        return "فروخته شد"
    if book.status != Book.StatusChoices.APPROVED:
        return "دیگر در دسترس نیست"
    if user.is_authenticated and book.seller_id == user.id:
        return "آگهی خودت است"
    buyer_id = pending.get(book.pk)
    if buyer_id is not None:
        if user.is_authenticated and buyer_id == user.id:
            return "سفارش بازش در معاملات من است"
        return "در انتظار پرداخت خریدار دیگر"
    return None


def cart_payload(request):
    """پاسخ همه‌ی درخواست‌های سبد؛ total فقط نسخه‌های خریدنی را جمع می‌زند"""
    ids = get_ids(request)
    # کتابی که پس از ویرایش به صف بررسی برگشته دیده نمی‌شود (محتوای بررسی‌نشده)، اما ردیفش می‌ماند
    books = visible_books(request.user).filter(pk__in=ids).select_related("seller", "category")
    by_id = {book.pk: book for book in books}
    pending = pending_buyers(list(by_id))
    items = []
    for book_id in ids:
        book = by_id.get(book_id)
        if book is None:
            continue
        reason = unavailable_reason(book, request.user, pending)
        items.append(
            {
                "book": BookListSerializer(book, context={"request": request}).data,
                "available": reason is None,
                "reason": reason,
            }
        )
    total = sum(item["book"]["price"] for item in items if item["available"])
    return {"items": items, "count": len(items), "total": total}
```

- [ ] **Step 5: Add the views.** In `backend/orders/views.py`, extend the imports:

```python
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.throttling import ScopedRateThrottle

from books.views import visible_books

from . import cart
```

Then append:

```python
# DRF برای مهمان CSRF را بررسی نمی‌کند و سبد مهمان در session است؛ مثل LoginView صریح محافظت می‌شود
@method_decorator(csrf_protect, name="dispatch")
class CartView(APIView):
    """سبد خرید؛ برای مهمان هم کار می‌کند"""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "cart"

    def get(self, request):
        return Response(cart.cart_payload(request))

    def post(self, request):
        try:
            book = visible_books(request.user).get(pk=request.data.get("book"))
        except (Book.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "کتاب یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        ids = cart.get_ids(request)
        if book.pk not in ids:
            reason = cart.unavailable_reason(book, request.user, cart.pending_buyers([book.pk]))
            if reason:
                return Response(
                    {"detail": f"این کتاب را نمی‌شود به سبد اضافه کرد: {reason}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(ids) >= cart.MAX_ITEMS:
                return Response(
                    {"detail": "سبد پر است؛ اول چند کتاب را بخر یا از سبد بردار."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cart.add(request, book)
        return Response(cart.cart_payload(request))


@method_decorator(csrf_protect, name="dispatch")
class CartItemView(APIView):
    """برداشتن یک نسخه از سبد"""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "cart"

    def delete(self, request, book_id):
        cart.remove(request, [book_id])
        return Response(cart.cart_payload(request))
```

- [ ] **Step 6: Add the URLs and the throttle rate.** In `backend/orders/urls.py`, add inside `urlpatterns`:

```python
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/<int:book_id>/", views.CartItemView.as_view(), name="cart-item"),
```

In `backend/config/settings.py`, replace the throttle line and its comment:

```python
    # محدودیت برای هر IP (مهمان) یا کاربر: ورود/ثبت‌نام، سبد خرید (مهمان هم session می‌سازد)
    "DEFAULT_THROTTLE_RATES": {"auth": "10/min", "cart": "60/min"},
```

- [ ] **Step 7: Run the tests and see them pass**

Run (from `backend/`): `../venv/Scripts/python.exe manage.py test orders`
Expected: all `orders` tests pass, the new `CartTests` included.

- [ ] **Step 8: Commit**

```bash
git add backend/orders backend/config/settings.py
git commit -m "Cart API: session cart for guests, CartItem for users"
```

---

### Task 2: Guest cart merges into the account at login and register (backend)

**Files:**
- Modify: `backend/orders/cart.py` (append `merge_session_cart`)
- Modify: `backend/accounts/views.py` (`RegisterView.create`, `LoginView.post`)
- Test: `backend/orders/tests.py` (append `CartMergeTests`)

**Interfaces:**
- Consumes: `cart.SESSION_KEY`, `CartItem` (Task 1).
- Produces: `orders.cart.merge_session_cart(request) -> None`, called right after `login(request, user)`.

- [ ] **Step 1: Write the failing tests.** Append to `backend/orders/tests.py`:

```python
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

    def test_logout_empties_visible_cart_but_keeps_account_cart(self):
        self.client.post("/api/accounts/login/", {"username": "buyer", "password": "Kt7-reader-pass"})
        self.client.post("/api/orders/cart/", {"book": self.book().pk})
        self.client.post("/api/accounts/logout/")
        self.assertEqual(self.client.get("/api/orders/cart/").data["count"], 0)
        self.assertEqual(CartItem.objects.filter(user=self.buyer).count(), 1)
```

- [ ] **Step 2: Run them and see them fail**

Run: `../venv/Scripts/python.exe manage.py test orders.tests.CartMergeTests`
Expected: the login and register tests FAIL (the account cart is missing the guest's books). The logout test may already pass.

- [ ] **Step 3: Implement.** Append to `backend/orders/cart.py`:

```python
def merge_session_cart(request):
    """پس از login(): سبد مهمان به حساب منتقل می‌شود؛ تکراری و آگهی خود کاربر کنار می‌روند"""
    ids = request.session.pop(SESSION_KEY, [])
    for book in Book.objects.filter(pk__in=ids).exclude(seller=request.user):
        CartItem.objects.get_or_create(user=request.user, book=book)
```

In `backend/accounts/views.py`, add `from orders.cart import merge_session_cart` to the imports. Then add one line after each `login(request, user)`:

```python
        login(request, user)
        # سبد مهمان (در همین session) به حساب منتقل می‌شود
        merge_session_cart(request)
```

That covers `RegisterView.create` and the success branch of `LoginView.post`, which is indented one level deeper. Keep that branch's indentation.

- [ ] **Step 4: Run them and see them pass**

Run: `../venv/Scripts/python.exe manage.py test orders accounts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/orders/cart.py backend/orders/tests.py backend/accounts/views.py
git commit -m "Cart: merge the guest cart into the account at login and register"
```

---

### Task 3: Checkout, one simulated payment for the whole cart (backend)

**Files:**
- Modify: `backend/orders/views.py` (append `CheckoutView`)
- Modify: `backend/orders/urls.py`
- Test: `backend/orders/tests.py` (append `CheckoutTests`)

**Interfaces:**
- Consumes: `cart.get_ids`, `cart.pending_buyers`, `cart.unavailable_reason`, `cart.remove`, `visible_books`.
- Produces:
  - `POST /api/orders/checkout/`, JSON `{"books": [int], "total": int, "shipping_address": str}`
  - **201** `{"reference_code": str, "orders": [int]}`
  - **400** `{"detail": str}`, or `{"shipping_address": [str]}` for a blank address
  - **401** when logged out

- [ ] **Step 1: Write the failing tests.** Append to `backend/orders/tests.py` (`Notification` is already imported):

```python
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

    def checkout(self, books=None, total=350, address="تهران، خیابان انقلاب"):
        return self.client.post(
            "/api/orders/checkout/",
            {
                "books": [self.a.pk, self.b.pk] if books is None else books,
                "total": total,
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
        self.assertEqual(self.checkout(books=[self.a.pk, other.pk], total=150).status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_blank_address_or_empty_list_is_400(self):
        self.assertEqual(self.checkout(address="   ").status_code, 400)
        self.assertEqual(self.checkout(books=[], total=0).status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_duplicate_ids_buy_once(self):
        self.assertEqual(self.checkout(books=[self.a.pk, self.a.pk, self.b.pk]).status_code, 201)
        self.assertEqual(Order.objects.count(), 2)

    def test_guest_gets_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.checkout().status_code, 401)
```

- [ ] **Step 2: Run them and see them fail**

Run: `../venv/Scripts/python.exe manage.py test orders.tests.CheckoutTests`
Expected: FAIL with 404s (the route doesn't exist yet).

- [ ] **Step 3: Implement.** Append to `backend/orders/views.py`:

```python
PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


class CheckoutView(APIView):
    """پرداخت آزمایشی کل سبد: برای هر کتاب یک سفارش پرداخت‌شده، همه با هم یا هیچ‌کدام.

    books و total همان چیزی است که خریدار در سبد دید؛ اگر سبد یا قیمت عوض شده باشد چیزی ساخته نمی‌شود.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        address = str(request.data.get("shipping_address") or "").strip()
        try:
            ids = list(dict.fromkeys(int(book_id) for book_id in request.data.get("books") or []))
            expected_total = int(request.data.get("total"))
        except (TypeError, ValueError):
            return Response({"detail": "سبد ارسال‌شده معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)

        if not ids:
            return Response({"detail": "سبد خالی است."}, status=status.HTTP_400_BAD_REQUEST)
        if not address:
            return Response(
                {"shipping_address": ["آدرس ارسال را بنویس تا فروشنده‌ها بدانند کتاب‌ها را کجا بفرستند."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        in_cart = set(cart.get_ids(request))
        books = {book.pk: book for book in visible_books(user).filter(pk__in=ids).select_related("seller")}
        pending = cart.pending_buyers(ids)
        for book_id in ids:
            book = books.get(book_id)
            if book is None or book_id not in in_cart:
                return Response(
                    {"detail": "سبدت عوض شده است؛ دوباره نگاهش کن."}, status=status.HTTP_400_BAD_REQUEST
                )
            reason = cart.unavailable_reason(book, user, pending)
            if reason:
                return Response({"detail": f"«{book.title}»: {reason}."}, status=status.HTTP_400_BAD_REQUEST)
        # قیمت کتاب تأییدشده با ویرایش فروشنده عوض نمی‌شود (به صف بررسی برمی‌گردد)، اما مدیر می‌تواند عوضش کند
        if sum(book.price for book in books.values()) != expected_total:
            return Response(
                {"detail": "قیمت سبد عوض شده است؛ دوباره نگاهش کن."}, status=status.HTTP_400_BAD_REQUEST
            )

        reference_code = "".join(random.choices(string.digits, k=10))
        now = timezone.now()
        orders = []
        with db_transaction.atomic():
            for book_id in ids:
                book = books[book_id]
                # به‌روزرسانی شرطی، مثل FakePaymentView: هیچ نسخه‌ای دو بار فروخته نمی‌شود
                if not Book.objects.filter(pk=book.pk, status="approved").update(status="sold", updated_at=now):
                    db_transaction.set_rollback(True)
                    return Response(
                        {"detail": f"«{book.title}» دیگر قابل خرید نیست."}, status=status.HTTP_400_BAD_REQUEST
                    )
                order = Order.objects.create(
                    buyer=user,
                    book=book,
                    total_price=book.price,
                    shipping_address=address,
                    status=Order.StatusChoices.PAID,
                )
                Transaction.objects.create(
                    order=order, amount=book.price, status="success", reference_code=reference_code
                )
                orders.append(order)
            cart.remove(request, ids)

        count = str(len(orders)).translate(PERSIAN_DIGITS)
        Notification.objects.create(
            user=user,
            title="پرداخت موفق",
            message=f"پرداخت {count} کتاب با موفقیت انجام شد. کد پیگیری: {reference_code}",
            notification_type="payment",
        )
        Notification.objects.bulk_create(
            Notification(
                user=order.book.seller,
                title="پرداخت سفارش",
                message=f"خریدار کتاب «{order.book.title}» پرداخت را انجام داد.",
                notification_type="payment",
            )
            for order in orders
        )

        return Response(
            {"reference_code": reference_code, "orders": [order.pk for order in orders]},
            status=status.HTTP_201_CREATED,
        )
```

In `backend/orders/urls.py`, add: `path("checkout/", views.CheckoutView.as_view(), name="checkout"),`

- [ ] **Step 4: Run them and see them pass**

Run: `../venv/Scripts/python.exe manage.py test orders`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/orders
git commit -m "Checkout: one simulated payment, one paid order per book, all or nothing"
```

---

### Task 4: Contact messages from guests (backend)

**Files:**
- Modify: `backend/notifications/models.py` (append `ContactMessage`)
- Modify: `backend/notifications/serializers.py`, `backend/notifications/views.py`, `backend/notifications/urls.py`, `backend/notifications/admin.py`
- Modify: `backend/config/settings.py` (throttle rate)
- Test: `backend/notifications/tests.py` (append `ContactMessageTests`)

**Interfaces:**
- Produces:
  - `POST /api/notifications/contact/` with `{name, email, subject, message}` → **201** returns the same fields; **400** returns per-field lists; **429** once throttled.
  - `ContactMessage` in the Django admin.

- [ ] **Step 1: Write the failing tests.** Append to `backend/notifications/tests.py`. Merge the imports at the top: `from django.core.cache import cache` and add `ContactMessage` to the `.models` import.

```python
class ContactMessageTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle «contact» در LocMem

    def send(self, **extra):
        data = {
            "name": "سارا",
            "email": "sara@example.com",
            "subject": "سؤال درباره‌ی ارسال",
            "message": "این یک پیام آزمایشی است.",
            **extra,
        }
        return self.client.post("/api/notifications/contact/", data)

    def test_guest_can_send_a_message(self):
        response = self.send()
        self.assertEqual(response.status_code, 201)
        message = ContactMessage.objects.get()
        self.assertEqual((message.email, message.is_handled), ("sara@example.com", False))

    def test_invalid_input_is_rejected(self):
        for extra in ({"email": "not-an-email"}, {"message": "کوتاه"}, {"message": "            "}, {"name": ""}):
            with self.subTest(extra=extra):
                response = self.send(**extra)
                self.assertEqual(response.status_code, 400)
                self.assertIn(next(iter(extra)), response.data)
        self.assertFalse(ContactMessage.objects.exists())

    def test_eleventh_message_in_an_hour_is_throttled(self):
        for _ in range(10):
            self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.send().status_code, 429)
```

- [ ] **Step 2: Run them and see them fail**

Run: `../venv/Scripts/python.exe manage.py test notifications.tests.ContactMessageTests`
Expected: an import error on `ContactMessage`.

- [ ] **Step 3: Model, migration and admin.** Append to `backend/notifications/models.py`:

```python
class ContactMessage(models.Model):
    """پیام فرم «تماس با ما» از مهمان؛ کاربر واردشده به‌جایش تیکت پشتیبانی می‌فرستد"""

    name = models.CharField(max_length=100, verbose_name="نام")

    email = models.EmailField(verbose_name="ایمیل")

    subject = models.CharField(max_length=200, verbose_name="موضوع")

    message = models.TextField(verbose_name="متن پیام")

    is_handled = models.BooleanField(default=False, verbose_name="رسیدگی شد؟")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ارسال")

    class Meta:
        verbose_name = "پیام تماس"
        verbose_name_plural = "پیام‌های تماس"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.subject} - {self.email}"
```

Run: `../venv/Scripts/python.exe manage.py makemigrations notifications && ../venv/Scripts/python.exe manage.py migrate`

In `backend/notifications/admin.py`, add `ContactMessage` to the import, then append:

```python
@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "name", "email", "is_handled", "created_at")
    list_filter = ("is_handled",)
    list_editable = ("is_handled",)
    search_fields = ("email", "subject")
```

- [ ] **Step 4: Serializer, view, URL and throttle.** In `backend/notifications/serializers.py`, add `ContactMessage` to the import, then append:

```python
class ContactMessageSerializer(serializers.ModelSerializer):
    # CharField فاصله‌های دو سر را می‌برد، پس پیام تمام‌فاصله خالی حساب می‌شود
    message = serializers.CharField(min_length=10, max_length=5000)

    class Meta:
        model = ContactMessage
        fields = ("name", "email", "subject", "message")
```

In `backend/notifications/views.py`, add these imports:

```python
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.throttling import ScopedRateThrottle
```

Add `ContactMessageSerializer` to the serializers import, then append:

```python
# مهمان هم می‌فرستد و DRF برای مهمان CSRF را بررسی نمی‌کند؛ مثل LoginView صریح محافظت می‌شود
@method_decorator(csrf_protect, name="dispatch")
class ContactMessageCreateView(generics.CreateAPIView):
    """فرم «تماس با ما» برای مهمان؛ پیام در پنل مدیریت خوانده می‌شود"""

    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]
    # ponytail: فقط CSRF و محدودیت نرخ جلوی هرزنامه را می‌گیرد؛ اگر پیام بی‌ربط زیاد شد، فیلد تله (honeypot) اضافه شود
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"
```

In `backend/notifications/urls.py`, add `path("contact/", views.ContactMessageCreateView.as_view(), name="contact"),`.

In `backend/config/settings.py`, change the rates to `{"auth": "10/min", "cart": "60/min", "contact": "10/hour"}` and add «پیام تماس» to the comment above it.

- [ ] **Step 5: Run the whole backend suite**

Run: `../venv/Scripts/python.exe manage.py test`
Expected: all apps pass (the 50 existing tests + new ones).

- [ ] **Step 6: Commit**

```bash
git add backend/notifications backend/config/settings.py
git commit -m "Contact: ContactMessage for guests, read in the admin"
```

---

### Task 5: Cart state and the navbar cart (frontend)

**Files:**
- Modify: `frontend/src/services/api.js` (add `cartAPI`, `notificationAPI.sendContactMessage`)
- Create: `frontend/src/context/CartContext.jsx`, `frontend/src/context/useCart.js`
- Modify: `frontend/src/App.jsx` (wrap in `CartProvider`)
- Modify: `frontend/src/components/Navbar.jsx`
- Modify: `frontend/src/App.css` (append a cart section at the end)

**Interfaces:**
- Consumes: the Task 1 and Task 3 endpoints.
- Produces:
  - `cartAPI.getCart()`, `cartAPI.addToCart(bookId)`, `cartAPI.removeFromCart(bookId)`, `cartAPI.checkout({books, total, shipping_address})`
  - `notificationAPI.sendContactMessage(data)`
  - `useCart()` returns `{items, count, total, status: 'loading'|'ready'|'error', add(bookId): Promise, remove(bookId): Promise, refresh(): void, inCart(bookId): boolean}`

- [ ] **Step 1: API objects.** In `frontend/src/services/api.js`, after `orderAPI`, add:

```js
// ============================================
// سبد خرید؛ برای مهمان هم (سبد در session سرور) و پس از ورود به حساب منتقل می‌شود
// ============================================

export const cartAPI = {
  getCart: () => api.get("/orders/cart/"), // { items: [{ book, available, reason }], count, total }
  addToCart: (bookId) => api.post("/orders/cart/", { book: bookId }),
  removeFromCart: (bookId) => api.delete(`/orders/cart/${bookId}/`),
  // books و total همان چیزی است که خریدار دید؛ اگر سرور چیز دیگری ببیند 400 می‌دهد
  checkout: (data) => api.post("/orders/checkout/", data), // → { reference_code, orders }
};
```

In `notificationAPI`, add: `sendContactMessage: (data) => api.post("/notifications/contact/", data), // فرم تماس مهمان`

- [ ] **Step 2: Create `frontend/src/context/CartContext.jsx`:**

```jsx
import { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { cartAPI } from "../services/api";
import { useAuth } from "./useAuth.js";

const CartContext = createContext(null);

const EMPTY_CART = { items: [], count: 0, total: 0 };

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const userId = user?.id;

  // پس از روشن شدن وضعیت ورود، و هر بار که کاربر عوض شد: ورود (سرور سبد مهمان را ادغام کرده)، خروج، پایان session
  useEffect(() => {
    if (authLoading) return undefined;
    let ignore = false;
    cartAPI
      .getCart()
      .then((response) => {
        if (!ignore) {
          setCart(response.data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!ignore) setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [authLoading, userId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // سرور سبد تازه را برمی‌گرداند؛ درباره‌ی خریدنی بودن حدسی زده نمی‌شود
  const add = useCallback(async (bookId) => {
    const response = await cartAPI.addToCart(bookId);
    setCart(response.data);
  }, []);

  const remove = useCallback(async (bookId) => {
    const response = await cartAPI.removeFromCart(bookId);
    setCart(response.data);
  }, []);

  const value = useMemo(
    () => ({
      ...cart,
      status,
      add,
      remove,
      refresh,
      inCart: (bookId) => cart.items.some((item) => item.book.id === bookId),
    }),
    [cart, status, add, remove, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export default CartContext;
```

Create `frontend/src/context/useCart.js`:

```js
import { useContext } from "react";
import CartContext from "./CartContext.jsx";

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart باید داخل CartProvider استفاده شود");
  }
  return context;
}
```

- [ ] **Step 3: Provider.** In `frontend/src/App.jsx`, import `{ CartProvider } from "./context/CartContext.jsx"`. Wrap the `<div className="d-flex flex-column min-vh-100">…</div>` in `<CartProvider>…</CartProvider>`, inside `<AuthProvider>`. `ToastContainer` stays where it is.

- [ ] **Step 4: Navbar cart link.** In `frontend/src/components/Navbar.jsx`:

Add `FiShoppingCart` to the `react-icons/fi` import and `import { useCart } from '../context/useCart.js';`. Inside `Navbar()`:

```jsx
  const { count: cartCount } = useCart();
  const cartLabel = cartCount ? `سبد خرید، ${cartCount.toLocaleString('fa-IR')} کتاب` : 'سبد خرید، خالی';
  // خرید فقط از راه سبد است، پس روی موبایل هم بیرون از منو می‌ماند
  const renderCartLink = (className) => (
    <Link to="/cart" className={`nav-cart ${className}`} aria-label={cartLabel}>
      <FiShoppingCart aria-hidden="true" />
      {cartCount > 0 && (
        <span className="nav-cart-count" aria-hidden="true">
          {cartCount > 99 ? '۹۹+' : cartCount.toLocaleString('fa-IR')}
        </span>
      )}
    </Link>
  );
```

On the mobile row, replace the sell link's `ms-auto me-2` and put the cart before it:

```jsx
        {renderCartLink('d-lg-none ms-auto me-1')}
        {/* در موبایل فروش هم‌ارز خرید است، پس پشت منو پنهان نمی‌شود */}
        <Link to="/create-book" className="btn btn-primary text-nowrap d-lg-none me-2 nav-sell-mobile">
          فروش کتاب
        </Link>
```

In the desktop actions `<Nav>`, insert `{renderCartLink('d-none d-lg-inline-flex')}` just before the desktop «فروش کتاب» link.

- [ ] **Step 5: Navbar CSS.** Append to the end of `frontend/src/App.css`:

```css
/* ==========================================================================
   16. سبد خرید
   ========================================================================== */

/* نشان سبد در نوار تیره: آیکون سفید، شمار کتاب‌ها روی نشان رز */
.nav-cart {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border-radius: var(--bs-border-radius);
  color: #fff;
  font-size: 1.25rem;
}

.nav-cart:hover {
  background-color: rgb(255 255 255 / 0.12);
  color: #fff;
}

.site-navbar .nav-cart:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.nav-cart-count {
  position: absolute;
  inset-block-start: 0.125rem;
  inset-inline-end: 0.125rem;
  min-inline-size: 1.25rem;
  padding-inline: 0.3rem;
  border-radius: 999px;
  background-color: var(--rb-accent);
  color: var(--rb-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.25rem;
  text-align: center;
}
```

- [ ] **Step 6: Lint, build, and the 320px width check**

Run (from `frontend/`): `npm run lint && npm run build`
Expected: no errors.

With both dev servers running, run from the repo root:
`MAXH=200 EVAL2="document.documentElement.scrollWidth" node .claude/tools/shot.mjs http://localhost:5173/books 320 .playwright-mcp/cart/nav-320.png mobile`
Expected: it prints `320` and the screenshot shows brand, cart, «فروش کتاب» and the menu toggle on one row. Repeat at `375`.

**Only if it prints more than the width:** move «فروش کتاب» into the menu below 360px. Append to App.css:

```css
/* زیر ۳۶۰ پیکسل جا برای سبد و فروش کنار هم نیست؛ فروش به منو می‌رود، سبد بیرون می‌ماند */
@media (max-width: 359.98px) {
  .nav-sell-mobile {
    display: none !important;
  }

  .site-navbar .nav-sell-desktop {
    display: flex !important;
  }
}
```

Then add `nav-sell-desktop` to the desktop «فروش کتاب» link's className, and re-run the check.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "Cart state and navbar cart link"
```

---

### Task 6: Book page adds to the cart; the purchase modal only pays existing orders (frontend)

**Files:**
- Create: `frontend/src/components/Receipt.jsx`
- Modify: `frontend/src/components/PurchaseModal.jsx`, `frontend/src/pages/BookDetail.jsx`, `frontend/src/utils/authReturn.js`
- Modify: `frontend/src/App.css` (section 16: bookplate list)

**Interfaces:**
- Consumes: `useCart()` (Task 5).
- Produces: `<Receipt books={[{id, title, author, category_root}]} trackingCode={string} note={string} />`. It renders the bookplate, the note and the copyable code. Its parent must be `.purchase-receipt`.

- [ ] **Step 1: Create `frontend/src/components/Receipt.jsx`.** It is the receipt body moved out of `PurchaseModal`, extended to several books:

```jsx
import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { seriesInk } from '../utils/series';

/**
 * رسید خرید: برچسب «اکس‌لیبریس» که داخل جلد کتاب می‌چسبانند، و کد پیگیری.
 * یک کتاب: مرکب مجموعه‌ی همان کتاب؛ چند کتاب: مرکب برند. والد باید .purchase-receipt باشد (حرکت مهر در depth.css).
 * @param {Array<{id: number, title: string, author?: string, category_root?: number}>} books
 */
function Receipt({ books, trackingCode, note }) {
  const [copied, setCopied] = useState(false);
  const single = books.length === 1 ? books[0] : null;
  const ink = single ? seriesInk(single.category_root) : 'var(--rb-brand)';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
    } catch {
      // کلیپ‌بورد در دسترس نیست (مثلاً http بدون localhost)؛ کد روی صفحه انتخاب‌شدنی است
    }
  };

  return (
    <>
      <div className="bookplate" style={{ '--series': ink }}>
        <p className="bookplate-title display-type">از کتابخانه‌ی تو</p>
        <span className="ornament-rule" aria-hidden="true" />
        {single ? (
          <>
            <p className="bookplate-book display-type">
              <bdi>{single.title}</bdi>
            </p>
            {single.author && (
              <p className="bookplate-author">
                <bdi>{single.author}</bdi>
              </p>
            )}
          </>
        ) : (
          <ul className="bookplate-list">
            {books.map((book) => (
              <li key={book.id} className="bookplate-book display-type">
                <bdi>{book.title}</bdi>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="bookplate-note">{note}</p>
      <div className="receipt-code">
        <span className="receipt-code-label">کد پیگیری</span>
        <bdi translate="no" className="receipt-code-value latin-id" dir="ltr">
          {trackingCode}
        </bdi>
        <Button variant="outline-secondary" size="sm" className="d-inline-flex align-items-center gap-1" onClick={handleCopy}>
          {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
          {copied ? 'کپی شد' : 'کپی'}
        </Button>
      </div>
    </>
  );
}

export default Receipt;
```

Append to App.css section 16:

```css
/* رسید چند کتابی: نام‌ها زیر هم، کوچک‌تر از رسید تک‌کتابی */
.bookplate-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.bookplate-list .bookplate-book {
  font-size: 1.125rem;
}
```

- [ ] **Step 2: Trim `PurchaseModal.jsx` to "pay an existing pending order".**
  - Delete the `address`, `addressError` and `copied` state, the `handleCopy` function, and the `defaultAddress` prop.
  - Remove `FiCopy, FiCheck` from the imports.
  - Delete the `{!existingOrderId && (<Form.Group controlId="shipping-address"> … )}` block.
  - Replace the JSDoc's first line with «پرداخت آزمایشی سفارشی که در انتظار پرداخت مانده (صفحه‌ی کتاب و «معاملات من»). سفارش تازه از راه سبد خرید ثبت می‌شود.» and drop the `defaultAddress` param line.
  - Replace `handleSubmit` with:

```jsx
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await orderAPI.payOrder(existingOrderId);
      setTrackingCode(response.data.reference_code);
      onPaid?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
```

  - In the receipt branch, replace everything inside `<Modal.Body>` (bookplate, note, code row) with:

```jsx
            <Receipt
              books={[{ ...book, category_root: seriesRoot }]}
              trackingCode={trackingCode}
              note="به نام تو ثبت شد و فروشنده خبردار شد. وضعیت ارسال را در «معاملات من» دنبال کن."
            />
```

  - Import `Receipt from './Receipt'`. Remove `seriesInk` from this file if nothing else uses it.
  - Set the title to `'پرداخت سفارش'` and the submit text to `{busy ? 'در حال پرداخت آزمایشی…' : 'پرداخت آزمایشی'}`. Remove the `existingOrderId ?` ternaries. `onStale` stays in the signature (MyOrders passes it), but nothing calls it any more, so delete it from the destructuring and the JSDoc. MyOrders' `onStale={refreshAll}` prop can stay; its `onHide` already refreshes.

- [ ] **Step 3: BookDetail.** In `frontend/src/pages/BookDetail.jsx`:

Imports: add `useRef` to the react import and `import { useCart } from '../context/useCart.js';`.

State, after `notesOpen`:

```jsx
  const { inCart, add: addToCart, remove: removeFromCart } = useCart();
  const [cartBusy, setCartBusy] = useState(false);
  // پیام صفحه‌خوان پس از افزودن/حذف (ناحیه‌ی role="status" همیشه در صفحه است)
  const [cartMessage, setCartMessage] = useState('');
  const focusCartLink = useRef(false);
  const isInCart = book ? inCart(book.id) : false;

  // دکمه‌ی «افزودن» جایش را به پیوند «مشاهده‌ی سبد» می‌دهد؛ فوکوس روی همان می‌آید تا گم نشود
  useEffect(() => {
    if (!isInCart || !focusCartLink.current) return;
    focusCartLink.current = false;
    [...document.querySelectorAll('.buy-cart-link')].find((el) => el.offsetParent !== null)?.focus();
  }, [isInCart]);
```

Replace `handleBuy` with:

```jsx
  // مهمان هم به سبد اضافه می‌کند؛ ورود فقط برای پرداخت لازم است
  const handleAddToCart = async () => {
    setCartBusy(true);
    try {
      await addToCart(book.id);
      focusCartLink.current = true;
      setCartMessage('به سبد اضافه شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
      refreshBook();
    } finally {
      setCartBusy(false);
    }
  };

  const handleRemoveFromCart = async () => {
    setCartBusy(true);
    try {
      await removeFromCart(book.id);
      setCartMessage('از سبد برداشته شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCartBusy(false);
    }
  };
```

Replace the `canBuy` branch of `primaryAction`:

```jsx
  const primaryAction = canBuy ? (
    isInCart ? (
      <Link to="/cart" className="btn btn-primary buy-cart-link d-inline-flex align-items-center gap-2">
        <FiShoppingCart aria-hidden="true" />
        در سبد است · مشاهده‌ی سبد
      </Link>
    ) : (
      <Button variant="primary" onClick={handleAddToCart} disabled={cartBusy} className="d-inline-flex align-items-center gap-2">
        <FiShoppingCart aria-hidden="true" />
        {cartBusy ? 'در حال افزودن…' : 'افزودن به سبد'}
      </Button>
    )
  ) : canPay ? (
```

Leave the `canPay` button as it is.

In `.buy-actions`, after the `canPay` cancel button, add:

```jsx
                {isInCart && (
                  <Button variant="link" className="buy-cart-remove" onClick={handleRemoveFromCart} disabled={cartBusy}>
                    حذف از سبد
                  </Button>
                )}
```

Right after the closing `</div>` of `.buy-actions`, add `<p className="visually-hidden" role="status">{cartMessage}</p>`.

In the `<PurchaseModal …>` element, delete `defaultAddress={user?.address || ''}` and change `existingOrderId={canPay ? openOrder.id : null}` to `existingOrderId={openOrder.id}`. The modal only opens from the `canPay` button now.

- [ ] **Step 4: authReturn.** In `frontend/src/utils/authReturn.js`, replace the `/books/` line and add the `/cart` case before it:

```js
  if (path === '/cart') return 'برای پرداخت سبد خرید وارد شو؛ بعد به سبدت برمی‌گردی.';
  if (path.startsWith('/books/')) return 'برای نشان کردن این کتاب وارد شو؛ بعد به همان صفحه برمی‌گردی.';
```

- [ ] **Step 5: Lint and build, then check the page**

Run (from `frontend/`): `npm run lint && npm run build`
Expected: no errors. Watch for unused imports (`seriesInk`, `FiCopy`, `Alert`); remove anything eslint flags.

Run: `node .claude/tools/shot.mjs http://localhost:5173/books/7 1440 .playwright-mcp/cart/detail-1440.png` and the same at `375 … mobile`.
Expected: «افزودن به سبد» in the buy panel; on 375, in the bottom bar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "Book page: add to cart; purchase modal only pays existing orders"
```

---

### Task 7: The `/cart` page: cart, checkout, receipt (frontend)

**Files:**
- Create: `frontend/src/pages/Cart.jsx`
- Modify: `frontend/src/App.jsx` (lazy route `/cart`)
- Modify: `frontend/src/App.css` (section 16), `frontend/src/styles/depth.css` (panel selector)
- Create: `.claude/tools/fixtures-cart.json`

**Interfaces:**
- Consumes:
  - `useCart()` (Task 5), `useAuth()`
  - `cartAPI.checkout` (Task 5)
  - `Receipt` (Task 6)
  - `CoverThumb`, `StatusMark` (tones `sold`, `closed`), `EmptyShelf`, `Loading`, `Form`
- Produces: the route `/cart`.

- [ ] **Step 1: Create `frontend/src/pages/Cart.jsx`:**

```jsx
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Row, Col, Button, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Form from '../components/Form';
import { cartAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';
import { useCart } from '../context/useCart.js';
import Loading from '../components/Loading';
import CoverThumb from '../components/CoverThumb';
import StatusMark from '../components/StatusMark';
import EmptyShelf from '../components/EmptyShelf';
import Receipt from '../components/Receipt';
import { seriesInk } from '../utils/series';

const toman = (value) => Number(value).toLocaleString('fa-IR');

/** ردیف‌های سبد، با همان ستون‌های «معاملات من»: جلد، نام و مشخصات، مبلغ، وضعیت، اقدام */
function CartList({ items, onRemove, removingId }) {
  return (
    <ul className="ledger">
      {items.map(({ book, available, reason }) => (
        <li key={book.id} className="ledger-row" style={{ '--card-ink': seriesInk(book.category_root) }}>
          <CoverThumb book={book} />
          <div className="ledger-main">
            <Link to={`/books/${book.id}`} className="ledger-name">
              <bdi>{book.title}</bdi>
            </Link>
            <span className="ledger-meta">
              <bdi>{book.author}</bdi>
              <span aria-hidden="true"> · </span>
              <span className="visually-hidden">، </span>
              {book.condition_display}
              <span aria-hidden="true"> · </span>
              <span className="visually-hidden">، </span>
              فروشنده: <bdi translate="no" className="latin-id">{book.seller_name}</bdi>
            </span>
          </div>
          <span className="ledger-amount price-tag">
            {toman(book.price)} <span className="book-card-currency">تومان</span>
          </span>
          <span className="ledger-status">
            {!available && <StatusMark tone={book.status === 'sold' ? 'sold' : 'closed'}>{reason}</StatusMark>}
          </span>
          <span className="ledger-actions">
            <Button
              variant="outline-secondary"
              onClick={() => onRemove(book.id)}
              disabled={removingId !== null}
              aria-label={`حذف «${book.title}» از سبد`}
            >
              {removingId === book.id ? 'در حال حذف…' : 'حذف'}
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Cart() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { items, total, status, remove, refresh } = useCart();
  const [step, setStep] = useState('cart'); // cart | checkout
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  // رسید از کتاب‌هایی ساخته می‌شود که پیش از تازه شدن سبد خریده شدند
  const [receipt, setReceipt] = useState(null);

  const available = items.filter((item) => item.available);
  const unavailable = items.filter((item) => !item.available);

  const handleRemove = async (bookId) => {
    setRemovingId(bookId);
    try {
      await remove(bookId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  const goToCheckout = () => {
    setAddress((current) => current || user?.address || '');
    setError('');
    setStep('checkout');
    // پس از رندر مرحله‌ی پرداخت، فوکوس روی آدرس
    requestAnimationFrame(() => document.getElementById('shipping-address')?.focus());
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!address.trim()) {
      setAddressError('آدرس ارسال را بنویس تا فروشنده‌ها بدانند کتاب‌ها را کجا بفرستند.');
      document.getElementById('shipping-address')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    const books = available.map((item) => item.book);
    try {
      const response = await cartAPI.checkout({
        books: books.map((book) => book.id),
        total,
        shipping_address: address.trim(),
      });
      setReceipt({ books, code: response.data.reference_code });
      refresh();
    } catch (err) {
      const data = err.response?.data;
      if (data?.shipping_address) {
        setAddressError(data.shipping_address[0]);
      } else {
        // سبد روی سرور عوض شده (یا session تمام شده)؛ سبد تازه دیده و دوباره تأیید می‌شود
        setError(getErrorMessage(err));
        setStep('cart');
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  if (receipt) {
    return (
      <div className="series-paper">
        <Container className="ledger-page">
          <title>رسید خرید | ری‌بوک</title>
          <section className="purchase-receipt cart-receipt" aria-labelledby="receipt-title">
            <h1 id="receipt-title" className="ledger-title">
              پرداخت آزمایشی انجام شد
            </h1>
            <Receipt
              books={receipt.books}
              trackingCode={receipt.code}
              note="سفارش‌ها به نام تو ثبت شد و هر فروشنده خبردار شد. هر کتاب را فروشنده‌ی خودش جدا می‌فرستد؛ وضعیت ارسال را در «معاملات من» دنبال کن."
            />
            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link to="/my-orders" className="btn btn-primary">
                معاملات من
              </Link>
              <Link to="/books" className="btn btn-outline-secondary">
                مرور کتاب‌ها
              </Link>
            </div>
          </section>
        </Container>
      </div>
    );
  }

  if (status === 'loading') return <Loading fullPage />;

  let body;
  if (status === 'error') {
    body = (
      <div className="list-state" role="alert">
        <p>سبد بارگذاری نشد. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
        <Button variant="outline-secondary" onClick={refresh}>
          تلاش دوباره
        </Button>
      </div>
    );
  } else if (!items.length) {
    body = (
      <div className="list-state">
        <EmptyShelf />
        <p>سبدت خالی است.</p>
        {!isAuthenticated && (
          <p>
            اگر پیش‌تر در حسابت کتابی به سبد اضافه کرده‌ای،{' '}
            <Link to="/login" state={{ from: location }}>
              وارد شو
            </Link>{' '}
            تا ببینی‌اش.
          </p>
        )}
        <Link to="/books" className="btn btn-primary">
          مرور کتاب‌ها
        </Link>
      </div>
    );
  } else {
    let action;
    if (step === 'checkout') {
      action = (
        <>
          <Button type="submit" form="checkout-form" variant="primary" className="w-100" disabled={busy}>
            {busy ? 'در حال پرداخت آزمایشی…' : `پرداخت آزمایشی ${toman(total)} تومان`}
          </Button>
          <Button variant="link" className="w-100 mt-2" onClick={() => setStep('cart')} disabled={busy}>
            بازگشت به سبد
          </Button>
        </>
      );
    } else if (!available.length) {
      action = (
        <Button variant="primary" className="w-100" disabled>
          ادامه‌ی خرید
        </Button>
      );
    } else if (isAuthenticated) {
      action = (
        <Button variant="primary" className="w-100" onClick={goToCheckout}>
          ادامه‌ی خرید
        </Button>
      );
    } else {
      action = (
        <Link to="/login" state={{ from: location }} className="btn btn-primary w-100">
          برای پرداخت وارد شو
        </Link>
      );
    }

    body = (
      <Row className="g-4 g-lg-5">
        <Col lg={8}>
          {step === 'cart' ? (
            <>
              {available.length > 0 && <CartList items={available} onRemove={handleRemove} removingId={removingId} />}
              {unavailable.length > 0 && (
                <section className="cart-unavailable" aria-labelledby="unavailable-title">
                  <h2 id="unavailable-title" className="support-heading">
                    دیگر قابل خرید نیست
                  </h2>
                  <CartList items={unavailable} onRemove={handleRemove} removingId={removingId} />
                </section>
              )}
            </>
          ) : (
            <Form id="checkout-form" onSubmit={handleCheckout} noValidate className="support-form">
              <Form.Group controlId="shipping-address" className="mb-3">
                <Form.Label>آدرس ارسال</Form.Label>
                <Form.Control
                  as="textarea"
                  name="shipping_address"
                  autoComplete="street-address"
                  rows={3}
                  value={address}
                  isInvalid={Boolean(addressError)}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setAddressError('');
                  }}
                  placeholder="استان، شهر، خیابان، پلاک، کد پستی"
                  required
                  disabled={busy}
                />
                <Form.Control.Feedback type="invalid">{addressError}</Form.Control.Feedback>
              </Form.Group>
              <p className="purchase-note mb-0">
                پرداخت در ری‌بوک فعلاً آزمایشی است: هیچ پولی جابه‌جا نمی‌شود و فقط روند خرید شبیه‌سازی می‌شود.
              </p>
            </Form>
          )}
        </Col>
        <Col lg={4}>
          <aside className="cart-summary" aria-labelledby="summary-title">
            <h2 id="summary-title" className="support-heading">
              خلاصه
            </h2>
            <dl className="purchase-summary">
              <dt>کتاب‌ها</dt>
              <dd>{available.length.toLocaleString('fa-IR')}</dd>
              <dt>مبلغ کل</dt>
              <dd className="purchase-price">
                {toman(total)} <span className="book-card-currency">تومان</span>
              </dd>
            </dl>
            <p className="cart-summary-note">هر کتاب را فروشنده‌ی خودش جداگانه می‌فرستد.</p>
            {action}
          </aside>
        </Col>
      </Row>
    );
  }

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <title>سبد خرید | ری‌بوک</title>
        <header className="ledger-header">
          <h1 className="ledger-title">{step === 'checkout' ? 'پرداخت' : 'سبد خرید'}</h1>
        </header>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {body}
      </Container>
    </div>
  );
}

export default Cart;
```

- [ ] **Step 2: Route.** In `frontend/src/App.jsx`, add `const Cart = lazy(() => import("./pages/Cart"));` with the other lazy pages, and `<Route path="/cart" element={<Cart />} />` with the public routes, above `path="*"`.

- [ ] **Step 3: CSS.** Append to App.css section 16:

```css
/* خلاصه‌ی سبد کنار فهرست؛ روی دسکتاپ با اسکرول همراه می‌ماند */
.cart-summary {
  padding: 1.25rem;
  border: 1px solid var(--rb-rule);
  border-radius: var(--bs-border-radius);
  background-color: var(--rb-surface);
}

@media (min-width: 992px) {
  .cart-summary {
    position: sticky;
    inset-block-start: 6.5rem;
  }
}

.cart-summary-note {
  color: var(--rb-ink-muted);
  font-size: 0.875rem;
}

.cart-unavailable {
  margin-block-start: 2rem;
}

.cart-receipt {
  max-inline-size: 34rem;
  margin-inline: auto;
}
```

The summary must sit at the same depth level and carry the same top series strip as the support form. Run `grep -n "support-form" frontend/src/App.css frontend/src/styles/depth.css`. In each **selector list** where `.support-form,` appears (App.css about line 2452, depth.css about line 194), add `.cart-summary,` on the line above it. Don't touch the plain `.support-form {` rules.

- [ ] **Step 4: Screenshot fixture.** `shot-auth.mjs` fakes a logged-in user. Without a fixture, the real `orders/cart/` returns 401 and logs the fake user out. Create `.claude/tools/fixtures-cart.json`, taking two real approved books from `GET http://localhost:8000/api/books/?page_size=3` (copy their objects exactly):

```json
{
  "orders/cart/": {
    "items": [
      { "book": "<paste book object 1 from /api/books/ results>", "available": true, "reason": null },
      { "book": "<paste book object 2>", "available": true, "reason": null },
      { "book": "<paste book object 3, set its status to \"sold\">", "available": false, "reason": "فروخته شد" }
    ],
    "count": 3,
    "total": "<price 1 + price 2>"
  },
  "books/wishlist/": []
}
```

Fill the placeholders with real values (that is the step: a short Python or node one-liner over the books response is fine). `total` must be a number.

- [ ] **Step 5: Lint, build and screenshots**

Run (from `frontend/`): `npm run lint && npm run build`
Expected: no errors.

From the repo root:
- `FIXFILE=.claude/tools/fixtures-cart.json node .claude/tools/shot-auth.mjs http://localhost:5173/cart 1440 .playwright-mcp/cart/cart-1440.png`
- the same with `375 … mobile`
- `node .claude/tools/shot.mjs http://localhost:5173/cart 1440 .playwright-mcp/cart/empty-guest-1440.png`

Expected:
- Two rows plus a «دیگر قابل خرید نیست» group with «فروخته شد». The summary shows count 2 and the total in Persian digits. On 375 the rows stack and the summary sits below.
- The guest shot shows the empty state with the «وارد شو» line.
- Check «ادامه‌ی خرید» → the checkout step with `EVAL="document.querySelector('.cart-summary .btn-primary').click()"` on the 1440 auth shot. Expected: the address field, the simulated-payment note, and «پرداخت آزمایشی … تومان».

- [ ] **Step 6: Commit**

```bash
git add frontend/src .claude/tools/fixtures-cart.json
git commit -m "Cart page: cart, checkout and receipt"
```

---

### Task 8: About page and the shared step rail (frontend)

**Files:**
- Create: `frontend/src/utils/steps.js`, `frontend/src/components/StepRail.jsx`, `frontend/src/pages/About.jsx`
- Modify: `frontend/src/pages/Home.jsx` (use `StepRail` + `SELL_STEPS`)
- Modify: `frontend/src/App.jsx` (route `/about`), `frontend/src/App.css` (`.sell-steps` column count, about styles)

**Interfaces:**
- Produces:
  - `SELL_STEPS`, `BUY_STEPS`: arrays of `{title, text}`
  - `<StepRail steps={[{title, text}]} />`, which renders `ol.sell-steps` with `--steps` set to the step count

- [ ] **Step 1: Create `frontend/src/utils/steps.js`:**

```js
// مسیر فروشنده، همان‌طور که در محصول رخ می‌دهد؛ بررسی تیم فقط همین‌جا و بی‌سروصدا گفته می‌شود (Home و About)
export const SELL_STEPS = [
  { title: 'ثبت آگهی', text: 'عنوان، عکس جلد، وضعیت و قیمت کتاب را وارد کن.' },
  { title: 'بررسی', text: 'تیم ری‌بوک آگهی را پیش از انتشار بررسی می‌کند.' },
  { title: 'فروش', text: 'وقتی کسی کتاب را سفارش داد، اعلان می‌گیری.' },
];

// مسیر خریدار با سبد خرید (About)
export const BUY_STEPS = [
  { title: 'پیدا کردن', text: 'کتاب را با نام، نویسنده یا مجموعه پیدا کن و وضعیت و قیمت هر نسخه را ببین.' },
  { title: 'سبد خرید', text: 'نسخه‌هایی را که می‌خواهی، حتی از چند فروشنده، به سبد اضافه کن.' },
  { title: 'پرداخت', text: 'یک بار برای کل سبد پرداخت می‌کنی؛ پرداخت فعلاً آزمایشی است و پولی جابه‌جا نمی‌شود.' },
  { title: 'ارسال', text: 'هر فروشنده کتاب خودش را می‌فرستد و وضعیتش را در «معاملات من» می‌بینی.' },
];
```

Create `frontend/src/components/StepRail.jsx`:

```jsx
/** مراحل روی خط مویی (فروش در Home، خرید و فروش در About) */
function StepRail({ steps }) {
  return (
    <ol className="sell-steps" style={{ '--steps': steps.length }}>
      {steps.map(({ title, text }) => (
        <li key={title} className="sell-step">
          <h3 className="sell-step-title">{title}</h3>
          <p className="sell-step-text">{text}</p>
        </li>
      ))}
    </ol>
  );
}

export default StepRail;
```

- [ ] **Step 2: Home uses it.** In `frontend/src/pages/Home.jsx`:
  - Delete the local `SELL_STEPS` const and its comment.
  - Import `StepRail from '../components/StepRail'` and `{ SELL_STEPS } from '../utils/steps'`.
  - Replace the `<ol className="sell-steps">…</ol>` block with `<StepRail steps={SELL_STEPS} />`.

In `frontend/src/App.css` (`@media (min-width: 768px) .sell-steps`, about line 1016), change `repeat(3, minmax(0, 1fr))` to `repeat(var(--steps, 3), minmax(0, 1fr))`.

- [ ] **Step 3: Create `frontend/src/pages/About.jsx`:**

```jsx
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StepRail from '../components/StepRail';
import ConditionMeasure from '../components/ConditionMeasure';
import { SELL_STEPS, BUY_STEPS } from '../utils/steps';
import { CONDITION_LABELS, CONDITION_NOTES } from '../utils/condition';

/**
 * درباره‌ی ری‌بوک: فقط آنچه در خود محصول درست است (PRODUCT.md)؛ بدون آمار، آدم یا نقل‌قول ساختگی.
 * معنای درجه‌ها از همان CONDITION_NOTES صفحه‌ی کتاب و فرم فروش می‌آید تا از هم جدا نشوند.
 */
function About() {
  return (
    <div className="series-paper">
      <Container className="about-page">
        <title>درباره‌ی ری‌بوک | ری‌بوک</title>
        <header className="sell-header">
          <h1 className="sell-title display-type">درباره‌ی ری‌بوک</h1>
          <p className="sell-lead">
            جایی برای دادن زندگی دوباره به کتاب‌هایتان: کتابی را که خوانده‌ای به خواننده‌ی بعدی برسان و کتاب بعدی‌ات را
            دست‌دوم پیدا کن.
          </p>
        </header>

        <section className="about-section" aria-labelledby="about-buy">
          <h2 id="about-buy" className="about-heading display-type">
            خرید
          </h2>
          <StepRail steps={BUY_STEPS} />
        </section>

        <section className="about-section" aria-labelledby="about-sell">
          <h2 id="about-sell" className="about-heading display-type">
            فروش
          </h2>
          <StepRail steps={SELL_STEPS} />
        </section>

        <section className="about-section" aria-labelledby="about-condition">
          <h2 id="about-condition" className="about-heading display-type">
            وضعیت ظاهری، به زبان ساده
          </h2>
          <p className="about-lead">هر فروشنده وضعیت نسخه‌اش را با یکی از این پنج درجه مشخص می‌کند.</p>
          <dl className="about-grades">
            {Object.keys(CONDITION_LABELS).map((key) => (
              <div key={key} className="about-grade">
                <dt>
                  <ConditionMeasure condition={key} label={CONDITION_LABELS[key]} />
                </dt>
                <dd>{CONDITION_NOTES[key]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="about-section" aria-labelledby="about-trust">
          <h2 id="about-trust" className="about-heading display-type">
            چند نکته که بهتر است بدانی
          </h2>
          <ul className="about-facts">
            <li>از فروشنده فقط نام کاربری‌اش دیده می‌شود؛ ایمیل و شماره‌ی تماس هیچ‌کس نمایش داده نمی‌شود.</li>
            <li>آگهی ویرایش‌شده دوباره به صف بررسی می‌رود و تا تأیید، در فهرست دیده نمی‌شود.</li>
            <li>پرداخت فعلاً آزمایشی است: هیچ پولی جابه‌جا نمی‌شود و فقط روند خرید شبیه‌سازی می‌شود.</li>
          </ul>
        </section>

        <div className="about-cta">
          <Link to="/books" className="btn btn-primary">
            مرور کتاب‌ها
          </Link>
          <Link to="/create-book" className="btn btn-outline-primary">
            فروش کتاب
          </Link>
          <Link to="/contact" className="btn btn-link">
            تماس با ما
          </Link>
        </div>
      </Container>
    </div>
  );
}

export default About;
```

Route in `App.jsx`: `const About = lazy(() => import("./pages/About"));` and `<Route path="/about" element={<About />} />`.

CSS, appended to App.css as section 17:

```css
/* ==========================================================================
   17. درباره‌ی ما و تماس با ما
   ========================================================================== */

.about-page {
  padding-block: 2rem 3.5rem;
}

.about-section {
  margin-block-start: 3rem;
}

.about-heading {
  margin-block-end: 1rem;
  font-size: clamp(1.5rem, 1.2rem + 1vw, 2rem);
  line-height: 1.35;
}

.about-lead {
  max-inline-size: 60ch;
  color: var(--rb-ink-muted);
}

.about-grades {
  display: grid;
  gap: 1rem;
  margin: 0;
}

.about-grade {
  display: grid;
  gap: 0.25rem 1.5rem;
}

.about-grade dd {
  margin: 0;
  color: var(--rb-ink-muted);
}

@media (min-width: 768px) {
  .about-grade {
    grid-template-columns: 14rem minmax(0, 1fr);
    align-items: center;
  }
}

.about-facts {
  max-inline-size: 70ch;
  padding-inline-start: 1.25rem;
}

.about-facts li + li {
  margin-block-start: 0.5rem;
}

.about-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-block-start: 3rem;
}
```

- [ ] **Step 4: Lint, build and screenshots**

Run (from `frontend/`): `npm run lint && npm run build`
Expected: no errors.

Take screenshots of `/about` and `/` at 1440 and 375 (`shot.mjs`, `.playwright-mcp/about/`).
Expected:
- About shows 4 buy steps in one row at 1440 (stacked on 375), 3 sell steps, 5 grades with their measures, 3 facts, 3 links.
- Home's sell section looks unchanged; compare with `.playwright-mcp/pullout/` or a fresh `before` shot taken prior to Step 2.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "About page; selling steps shared with Home"
```

---

### Task 9: Contact page and footer links (frontend)

**Files:**
- Create: `frontend/src/pages/Contact.jsx`
- Modify: `frontend/src/App.jsx` (route `/contact`), `frontend/src/components/Footer.jsx`, `frontend/src/App.css` (section 17)

**Interfaces:**
- Consumes:
  - `notificationAPI.sendContactMessage` (Task 5)
  - `notificationAPI.createTicket` (existing, `{subject, message}`)
  - `useAuth()` (`isAuthenticated`, `loading`)

- [ ] **Step 1: Create `frontend/src/pages/Contact.jsx`:**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Button, Alert } from 'react-bootstrap';
import Form from '../components/Form';
import Loading from '../components/Loading';
import { notificationAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE = 10;
const FIELD_ORDER = ['name', 'email', 'subject', 'message'];
const EMPTY_FORM = { name: '', email: '', subject: '', message: '' };

// همان قواعد سرور (ContactMessageSerializer)، تا خطای تایپی پیش از ارسال دیده شود و سهمیه‌ی ارسال را نخورد
function validate(data, isGuest) {
  const errors = {};
  if (isGuest) {
    if (!data.name.trim()) errors.name = 'نامت را بنویس تا بدانیم با چه کسی حرف می‌زنیم.';
    if (!EMAIL_PATTERN.test(data.email.trim())) errors.email = 'یک ایمیل درست بنویس، مثل name@example.com.';
  }
  if (!data.subject.trim()) errors.subject = 'موضوع را در یک خط بنویس.';
  if (data.message.trim().length < MIN_MESSAGE) errors.message = 'پیامت را کمی کامل‌تر بنویس (دست‌کم ۱۰ حرف).';
  return errors;
}

/**
 * تماس با ما. مهمان: پیام در پنل مدیریت خوانده می‌شود (ContactMessage).
 * کاربر واردشده: پیام تیکت پشتیبانی می‌شود و پاسخ در «پشتیبانی» می‌آید.
 * تلفن یا ایمیل عمومی نداریم و ساختگی هم نشان داده نمی‌شود (PRODUCT.md).
 */
function Contact() {
  const { isAuthenticated, loading } = useAuth();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null); // null | 'ticket' | 'message'

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isGuest = !isAuthenticated;
    const errors = validate(formData, isGuest);
    const firstError = FIELD_ORDER.find((name) => errors[name]);
    if (firstError) {
      setFieldErrors(errors);
      document.getElementById(`contact-${firstError}`)?.focus();
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = { subject: formData.subject.trim(), message: formData.message.trim() };
    try {
      if (isGuest) {
        await notificationAPI.sendContactMessage({ ...payload, name: formData.name.trim(), email: formData.email.trim() });
        setSent('message');
      } else {
        await notificationAPI.createTicket(payload);
        setSent('ticket');
      }
      setFormData(EMPTY_FORM);
    } catch (err) {
      const data = err.response?.data;
      const serverErrors =
        data && typeof data === 'object'
          ? Object.fromEntries(FIELD_ORDER.filter((name) => data[name]).map((name) => [name, data[name][0]]))
          : {};
      if (Object.keys(serverErrors).length) {
        setFieldErrors(serverErrors);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading fullPage />;

  const field = (name, label, props = {}) => (
    <Form.Group controlId={`contact-${name}`} className="mb-3">
      <Form.Label>{label}</Form.Label>
      <Form.Control
        name={name}
        value={formData[name]}
        onChange={handleChange}
        required
        aria-required="true"
        isInvalid={Boolean(fieldErrors[name])}
        disabled={submitting}
        {...props}
      />
      <Form.Control.Feedback type="invalid">{fieldErrors[name]}</Form.Control.Feedback>
    </Form.Group>
  );

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <title>تماس با ما | ری‌بوک</title>
        <header className="ledger-header">
          <div>
            <h1 className="ledger-title">تماس با ما</h1>
            <p className="sell-lead mt-2 mb-0">
              {isAuthenticated
                ? 'پیامت به‌صورت تیکت پشتیبانی ثبت می‌شود و پاسخ تیم ری‌بوک در صفحه‌ی «پشتیبانی» می‌آید.'
                : 'سؤال، پیشنهاد یا مشکلی داری؟ بنویس؛ تیم ری‌بوک پیام‌ها را می‌خواند.'}
            </p>
          </div>
        </header>

        <Row className="g-4 g-lg-5">
          <Col lg={7}>
            {sent ? (
              <div className="support-form" role="status">
                <h2 className="support-heading">پیامت ثبت شد</h2>
                {sent === 'ticket' ? (
                  <p>
                    پاسخ تیم ری‌بوک در <Link to="/support">پشتیبانی</Link> می‌آید.
                  </p>
                ) : (
                  <p>تیم ری‌بوک آن را می‌خواند. اگر پاسخی لازم باشد، به همین ایمیل فرستاده می‌شود.</p>
                )}
                <Button variant="outline-secondary" onClick={() => setSent(null)}>
                  پیام دیگر
                </Button>
              </div>
            ) : (
              <Form onSubmit={handleSubmit} noValidate className="support-form" aria-labelledby="contact-form-title">
                <h2 id="contact-form-title" className="support-heading">
                  پیام تازه
                </h2>
                {!isAuthenticated && (
                  <>
                    {field('name', 'نام', { autoComplete: 'name', maxLength: 100 })}
                    {field('email', 'ایمیل', {
                      type: 'email',
                      dir: 'ltr',
                      className: 'latin-id',
                      autoComplete: 'email',
                      spellCheck: false,
                      maxLength: 254,
                    })}
                  </>
                )}
                {field('subject', 'موضوع', { autoComplete: 'off', maxLength: 200 })}
                {field('message', 'پیام', {
                  as: 'textarea',
                  rows: 6,
                  autoComplete: 'off',
                  maxLength: 5000,
                  placeholder: 'اگر درباره‌ی سفارش است، شماره‌ی سفارش یا نام کتاب را هم بنویس.',
                })}
                {error && (
                  <Alert variant="danger" role="alert">
                    {error}
                  </Alert>
                )}
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'در حال ارسال…' : 'ارسال پیام'}
                </Button>
              </Form>
            )}
          </Col>
          <Col lg={5}>
            <aside className="contact-aside" aria-labelledby="contact-aside-title">
              <h2 id="contact-aside-title" className="support-heading">
                پیش از نوشتن
              </h2>
              <ul className="about-facts">
                <li>
                  برای مشکل سفارش یا پرداخت،{' '}
                  {isAuthenticated ? <Link to="/support">پشتیبانی</Link> : 'پس از ورود، صفحه‌ی پشتیبانی'} بهترین راه است:
                  پاسخ همان‌جا کنار تیکت‌هایت می‌آید.
                </li>
                <li>شماره‌ی سفارش یا نام کتاب را بنویس تا زودتر پیدایش کنیم.</li>
                <li>ری‌بوک فعلاً تلفن و ایمیل عمومی ندارد؛ همین فرم راه رسیدن به تیم است.</li>
              </ul>
            </aside>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Contact;
```

- [ ] **Step 2: Route, footer and CSS**
  - `App.jsx`: add `const Contact = lazy(() => import("./pages/Contact"));` and `<Route path="/contact" element={<Contact />} />`.
  - `Footer.jsx`: in `.site-footer-links`, after «پشتیبانی», add:

```jsx
            <li>
              <Link to="/about">درباره‌ی ما</Link>
            </li>
            <li>
              <Link to="/contact">تماس با ما</Link>
            </li>
```

  - Also update the comment above `Footer()`: «… تنها کانال واقعی تماس، فرم «تماس با ما» و تیکت پشتیبانی است».
  - App.css section 17, append:

```css
.contact-aside {
  padding-block-start: 0.25rem;
}
```

- [ ] **Step 3: Lint, build, and a real guest send**

Run (from `frontend/`): `npm run lint && npm run build`
Expected: no errors.

Screenshots of `/contact` at 1440/375, logged out (`shot.mjs`) and logged in (`shot-auth.mjs` with `FIXFILE=.claude/tools/fixtures-cart.json`), plus `/` at 375 for the footer, all in `.playwright-mcp/contact/`.

Expected:
- Logged out: four fields.
- Logged in: subject and message only, and the lead mentions «پشتیبانی».
- The footer wraps cleanly at 375.

Send one guest message through the page, using `EVAL` to fill the fields and click «ارسال پیام». Confirm it appears in `http://localhost:8000/admin/notifications/contactmessage/`, then delete it there.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "Contact page; About and Contact in the footer"
```

---

### Task 10: Design pass and verification

**Files:** whatever the design pass changes (likely `frontend/src/App.css` sections 16–17, `frontend/src/styles/depth.css`, `frontend/src/pages/{Cart,About,Contact}.jsx`). Screenshots go in `.playwright-mcp/{cart,about,contact}/`. Update `.claude/skills/smoke/SKILL.md`.

- [ ] **Step 1: Design pass.** Run `/impeccable layout` and then `/impeccable harden` on `frontend/src/pages/Cart.jsx`, `About.jsx` and `Contact.jsx`, one page at a time. Constraints:
  - DESIGN.md's Pocket Series world: series inks only as thin bands, `.price-tag` saffron, Lalezar via `.display-type`, the One Light / Stack depth rules.
  - The Persian typography rules from CLAUDE.md.
  - The owner wants colourful, detailed pages; minimal results were rejected twice.
  - When a choice is genuinely open (for example how the About sections are dressed, or whether the receipt page carries a series band), **build switchable variants on the real page for the owner to try**, as in earlier passes: a temporary `?variant=` switcher, removed after the pick. Don't pick on the owner's behalf.
  - Behaviour and copy agreed in the spec don't change in this pass.

- [ ] **Step 2: Full checks**
  - From `backend/`: `../venv/Scripts/python.exe manage.py test` → all pass.
  - From `frontend/`: `npm run lint && npm run build` → clean.

- [ ] **Step 3: Contrast, overflow and keyboard**
  - Overflow: for each of `/cart` (with `shot-auth.mjs` + `FIXFILE=.claude/tools/fixtures-cart.json`), `/about`, `/contact` (logged out with `shot.mjs`, logged in with `shot-auth.mjs`), `/books/<id>` and `/`, at 1440, 375 and 320, run with `EVAL2="document.documentElement.scrollWidth"`. Expected: it prints the viewport width every time.
  - Contrast and the technical audit: `/impeccable audit frontend/src/pages/Cart.jsx frontend/src/pages/About.jsx frontend/src/pages/Contact.jsx`. Expected: no contrast or accessibility findings left open; fix what it reports.
  - Keyboard: `AUTH=1 FIXFILE=.claude/tools/fixtures-cart.json node .claude/tools/kbd.mjs http://localhost:5173/cart 1440 20`, and `node .claude/tools/kbd.mjs http://localhost:5173/contact 1440 12`. Expected: every action reachable, no `NOFOCUS`, and errors focus the first invalid field.
  - On a book page (logged out): Tab to «افزودن به سبد», then press Enter (`KEYS='[["Enter","Enter",13]]'`). Focus should land on «در سبد است · مشاهده‌ی سبد». Afterwards remove the book from the cart, so the dev session's cart is empty again.

- [ ] **Step 4: Review focus 4 (session expiry mid-checkout).**
  1. Log in on the dev site as a throwaway user.
  2. Add a book.
  3. Go to the checkout step.
  4. Delete the `sessionid` cookie (DevTools, or CDP `Network.deleteCookies`).
  5. Click «پرداخت آزمایشی».

  Expected: back on the cart step with an error alert, and the guest empty-cart state with «وارد شو تا ببینی‌اش». Logging in again shows the cart.

- [ ] **Step 5: Update the smoke skill.** In `.claude/skills/smoke/SKILL.md`, replace step 4's purchase text with:

> Open it and click «افزودن به سبد» (in the fixed bottom bar on phones). The button becomes «در سبد است · مشاهده‌ی سبد» and the navbar cart shows ۱. Open the cart, click «ادامه‌ی خرید», submit the empty address (it should be marked invalid), fill «آدرس ارسال» and click «پرداخت آزمایشی … تومان». Expect the receipt «پرداخت آزمایشی انجام شد» with a tracking code, and the navbar cart back to empty.

Also add one line to step 4: **add the book to the cart as a guest first, then log in**, and check that the cart still has it (merge at login).

- [ ] **Step 6: Run `/smoke`.** Use Playwright MCP if it's connected; otherwise drive the same flow over CDP. Expected: every step ✅ and the run users cleaned up. Record the run id.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src .claude/skills/smoke/SKILL.md .playwright-mcp
git commit -m "Cart, About, Contact: design pass and verification"
```

(If the design pass produced variants, commit only after the owner picks and the switcher is removed.)

---

### Task 11: Documentation

**Files:** `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md` (via the `impeccable:impeccable-documenter` agent or by hand), `.claude/REDESIGN-GUIDE.md`, `docs/superpowers/specs/2026-10-10-cart-about-contact-design.md` (status line).

- [ ] **Step 1: CLAUDE.md**

In **Auth**, after the `ScopedRateThrottle` sentence, add: «The cart (`cart`, 60/min) and the guest contact form (`contact`, 10/hour) use the same LocMem throttle, so their tests `cache.clear()` too.»

In the list of API objects, add `cartAPI` (`api.js`).

In **Backend apps**, replace the `orders` and `notifications` descriptions with:

> `orders` (Order, a one-to-one Transaction, and `CartItem`; cart rules in `orders/cart.py`), `notifications` (Notification, SupportTicket, ContactMessage)

Replace lifecycle step 3's first sentence with:

> 3. **Cart:** anyone can add an approved copy (`orders/cart/`, AllowAny + `csrf_protect`). Guests keep the cart in `request.session["cart"]`; users in `CartItem`. `LoginView`/`RegisterView` call `merge_session_cart` right after `login()`. `GET cart/` hides books that aren't in `visible_books` (back in review) and marks sold/reserved ones `available: false` with a reason. `CheckoutView` (`orders/checkout/`, `{books, total, shipping_address}`) re-validates everything, then inside one `atomic()` sells each book with the conditional update and creates a **paid** Order + successful Transaction per book, all sharing one reference code; a changed cart or price is a 400 and nothing is created. `OrderCreateView` + pay/cancel stay for pending orders that already exist; `PurchaseModal` only pays those.

Keep the rest of step 3 about pending orders and cancel.

In **Notifications**, add: «`ContactMessage` is the guest contact form (`notifications/contact/`), read and ticked off in the admin; logged-in users' contact messages are support tickets.»

- [ ] **Step 2: PRODUCT.md**
  - Operating Context, buyer flow: `browse → book detail → add to cart (guests too) → cart → log in if needed → one simulated payment for the whole cart → tracking code → notifications`.
  - Evidence: replace the footer-placeholder bullet with «The only contact channels are the Contact form (guests, read in the admin) and support tickets (logged in). There is no public phone or email, and none may be invented.»

- [ ] **Step 3: DESIGN.md.** Add components from the built code: Cart Ledger (the ledger reused, unavailable group, summary panel), Checkout step, Multi-book Receipt, Step Rail (`--steps`), About sections, Contact form + aside, and the Navbar Cart (rose count badge). Use the `impeccable:impeccable-documenter` agent, or edit by hand in the existing section style.

- [ ] **Step 4: REDESIGN-GUIDE.md.** Add a progress entry above «▶ Next: merge», in the same style as the others: what was built, commit hashes, screenshot folders, gotchas met during the work, the smoke run id, and the open owner items (guest contact reply copy, `CONDITION_NOTES`). Update the «Progress (last updated …)» date.

- [ ] **Step 5: Spec status.** In the spec, change `Status:` to `implemented (see plan docs/superpowers/plans/2026-10-10-cart-about-contact.md)`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md PRODUCT.md DESIGN.md .claude/REDESIGN-GUIDE.md docs/superpowers
git commit -m "Docs: cart, checkout, About and Contact"
```
