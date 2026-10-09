# Cart, About and Contact: design

Date: 2026-10-10 · Branch: `redesign` · Status: approved in conversation, awaiting spec review

## Goal

Add a shopping cart, an About page and a Contact page to ReBook. They must follow standard UX and development practice, fit the current architecture (`CLAUDE.md`), stay inside the Pocket Series design (`DESIGN.md`) and keep `PRODUCT.md`'s honesty rules: no invented numbers, people, testimonials or contact channels, and payment is described as simulated.

No new dependencies, plugins or MCPs are needed.

## Decisions made with the owner

| Topic | Decision |
|---|---|
| Who can use the cart | Everyone. Guests too; a guest cart merges into the account at login. |
| Storage | One server cart: Django session for guests, `CartItem` rows for users (approach B). |
| Checkout | One address and one simulated payment for the whole cart; one `Order` per book, all or nothing. |
| Book page | «افزودن به سبد» is the only way to start a purchase. The one-step purchase modal no longer creates orders. |
| Book cards | Unchanged; no cart button on cards. |
| Contact | Public form. Guests → new `ContactMessage`; logged-in users → existing support ticket. No phone or email shown. |
| About | Product only: no team, numbers or testimonials. |

Facts the design depends on: every listing is one physical copy (no quantity), a cart usually spans several sellers, and editing a book sends it back to `pending` (so its price can't change while it is approved).

## 1. Cart backend

### Storage

- `orders.models.CartItem(user FK CASCADE, book FK CASCADE, added_at auto_now_add)`, `unique_together = ("user", "book")`, ordered by `-added_at`. Persian `verbose_name`s.
- Guest cart: `request.session["cart"]`, a list of book ids in the order added. Every write sets `request.session.modified = True`. Reading never creates a session.
- Django's `login()` keeps an anonymous session's data (`cycle_key`), and `logout()` flushes it. So the guest cart survives login and the cart reads empty after logout, while the account's `CartItem` rows stay.

### Helper module `orders/cart.py`

Plain functions; each one picks `CartItem` when `request.user.is_authenticated`, the session otherwise:

- `get_ids(request)` → list of book ids. For guests it prunes ids whose book no longer exists.
- `add(request, book)`, `remove(request, book_id)`, `clear(request, ids)`.
- `unavailable_reason(book, user)` → `None` or a Persian reason (rules below).
- `merge_session_cart(request)`: called right after `login()` in `LoginView` and `RegisterView`. It takes the session ids that still exist and aren't the user's own listings, `get_or_create`s a `CartItem` for each (no duplicates), and deletes the session key.

### Availability rules

A copy can be **added** only if it's buyable right now:
- its status is `approved`
- the requester isn't its seller
- it has no pending order by another buyer
- it has no pending order by the requester

Otherwise the add is a 400 with `{"detail": <reason>}`.

A copy already in the cart can stop being buyable. The cart then shows it with a reason:

| Condition | Reason |
|---|---|
| `sold` | «فروخته شد» |
| pending order by someone else | «در انتظار پرداخت خریدار دیگر» |
| pending order by you | «سفارش بازش در معاملات من است» |
| your own listing (only possible via stale data) | «آگهی خودت است» |

Copies that aren't in `visible_books(user)` (`pending` or `rejected` after an edit) are **left out of the response entirely**, so unreviewed content never reaches the buyer. Their rows stay and reappear if the book is approved again. Deleted books leave through the cascade.

### Endpoints (under `/api/orders/`)

| Method + path | Permission | Behaviour |
|---|---|---|
| `GET cart/` | AllowAny | `{items: [{book, available, reason}], count, total}`. `book` uses `BookListSerializer` (same shape as a card). `count` = visible items; `total` = sum of available items' prices. |
| `POST cart/` `{book}` | AllowAny, `csrf_protect`, throttle `cart` | Adds a buyable copy and returns the cart. Adding a copy that's already there changes nothing (200). Cap: 50 items → 400. Unknown or invisible id → 404. |
| `DELETE cart/<int:book_id>/` | AllowAny, `csrf_protect`, throttle `cart` | Removes it (no-op if absent) and returns the cart. |
| `POST checkout/` `{books: [ids], shipping_address}` | IsAuthenticated | See below. |

`DEFAULT_THROTTLE_RATES` gains `"cart": "60/min"`. `GET` and the writes share one `CartView`, so the throttle counts all of them. That's fine, because the frontend only reads the cart once per auth change. Errors use `{"detail": ...}` or per-field lists, never `{"error": ...}`.

Building the response takes a fixed number of queries, not one per book: `select_related("seller", "category")` on the books, plus one query for every pending order on them, which feeds `unavailable_reason`. `BookListSerializer` gets `context={"request": request}` so cover URLs are absolute.

### Checkout

`books` is the list of ids the user confirmed on the cart page; duplicate ids are ignored. Validation runs **before** writing:
- `books` isn't empty
- `shipping_address` isn't blank
- every id is in the user's cart and `unavailable_reason` is `None`

The first failure is a 400 whose `detail` names the book; nothing is created.

Then, inside one `transaction.atomic()`, with one random 10-digit `reference_code`:
1. For each book: `Book.objects.filter(pk=id, status="approved").update(status="sold", updated_at=now)`. If any update returns 0, call `set_rollback(True)` and return 400 «"<title>" دیگر قابل خرید نیست.».
2. `Order(buyer, book, total_price=book.price, shipping_address, status="paid")`.
3. `Transaction(order, amount=book.price, status="success", reference_code=code)`.
4. Remove the bought ids from the cart.

After the transaction:
- The buyer gets one notification, «پرداخت موفق», which names how many books were paid for and gives the tracking code.
- Each seller gets one «پرداخت سفارش» per book, with titles in «».

Response: `{"reference_code": code, "orders": [ids]}`.

Orders are created as `paid` directly because the payment is instant. Selling a copy twice is still impossible, because the conditional update guarantees it. If a pending order comes in at the same moment through the old `orders/create/`, its payment later fails with today's «این کتاب دیگر قابل خرید نیست», which is existing behaviour. `OrderCreateView`, pay and cancel stay as they are for pending orders that already exist.

### Tests (`orders/tests.py`, `cache.clear()` in `setUp`)

- A guest adds and removes; `GET` reflects it, and a fresh client sees an empty cart.
- A user adds; adding twice is a no-op; adding your own book is a 400; adding a sold or reserved book is a 400.
- A book sold after being added shows `available: false` with its reason and is left out of `total`.
- A book that went back to `pending` after being added is left out of the response.
- Merge at login: guest ids move to `CartItem`, ids already in the account aren't duplicated, own books are skipped, and the session cart ends up empty. The same holds for register.
- Checkout of 2 books from 2 sellers:
  - both books are sold
  - 2 paid orders exist with one shared code, plus 2 successful transactions
  - the cart is empty
  - both sellers and the buyer are notified
- Checkout including one stale (sold) book: 400 with the title, zero orders, the other book still `approved`.
- Checkout while logged out: 401. Checkout with a blank address or an empty list: 400.

## 2. Cart UI

### State

`context/CartContext.jsx`, provided inside `AuthProvider`:
- It holds `{items, count, total, loading, error}` with `add(id)`, `remove(id)`, `refresh()` and `inCart(id)`.
- It fetches only after `AuthContext.loading` is false, then again whenever `user?.id` changes. That covers login merge, register, logout and `auth:unauthorized`.
- `add` and `remove` replace the state with the cart the server returns. There are no optimistic guesses about availability.

`services/api.js` gains `cartAPI = { getCart, addToCart, removeFromCart, checkout }`.

### Navbar

- A cart link to `/cart` with a count badge, for everyone, next to notifications on desktop.
- On phones it sits in the collapsed bar next to «فروش کتاب»; buying now goes only through the cart, so the cart can't hide behind the menu.
- `aria-label` «سبد خرید، N کتاب» in Persian digits.
- **Width rule:** measure the bar at 320 and 375. If it overflows, «فروش کتاب» moves into the menu below 360px. The cart always stays visible.

### Book page

- Approved and buyable, not in the cart: primary «افزودن به سبد» in the panel and the mobile buy bar. It works for guests (no login redirect).
- In the cart: the primary becomes a link «در سبد است · مشاهده‌ی سبد», with a small «حذف از سبد» in the panel. After adding, focus moves to that link and a polite live region says «به سبد اضافه شد».
- In the cart but no longer buyable (reserved or sold while on the page): the existing status sentence plus «حذف از سبد».
- Owner, sold, reserved and your-open-order states are unchanged. «پرداخت آزمایشی» / «لغو سفارش» for your own pending order still use `PurchaseModal`.
- `PurchaseModal`: the create-order branch (and its auto-cancel-on-failed-payment code) is removed. The modal only pays an existing pending order (book page and «معاملات من»).
- `utils/authReturn.js`:
  - The book-page reason becomes «برای نشان کردن این کتاب وارد شو؛ بعد به همان صفحه برمی‌گردی.»
  - A new `/cart` case: «برای پرداخت سبد خرید وارد شو؛ بعد به سبدت برمی‌گردی.»

### `/cart` page

`pages/Cart.jsx`: a public, lazy route inside a neutral `.series-paper`, with its own `<title>` «سبد خرید | ری‌بوک».

1. **Cart:**
   - Available copies as `.ledger` rows: `CoverThumb`, title (`<bdi>`) linking to the book, seller username (`.latin-id`), condition, `.price-tag`, «حذف».
   - Copies that are no longer buyable go in a separate group, «دیگر قابل خرید نیست», each with its reason and «حذف». They're left out of the total.
   - A summary panel (sticky on lg) with the count and total, plus «هر کتاب را فروشنده‌ی خودش جداگانه می‌فرستد.»
   - Action: «ادامه‌ی خرید» for users, or «برای پرداخت وارد شو» for guests. The guest action goes to `/login` with `state.from` = `/cart`.
   - The action is disabled when no copy is available.
2. **Checkout** (same page; local step state; «بازگشت به سبد»):
   - The address (`Form` wrapper, pre-filled from `user.address`, required, inline error).
   - A one-line note that the payment is simulated and no money moves.
   - The button «پرداخت آزمایشی <total> تومان», disabled while busy.
   - It sends the ids shown. On a 400 for a stale book: refresh the cart, show an inline alert with the server's `detail`, and go back to step 1.
3. **Receipt:**
   - Built from the items captured before the post-checkout refresh.
   - The bookplate lists every title. It uses the book's series ink for one book and `--rb-brand` for several.
   - One tracking code (`.latin-id`, `dir="ltr"`) with a copy button.
   - Links to «معاملات من» and «مرور کتاب‌ها».
   - It reuses the existing `.bookplate` / `.receipt-code` styles. The receipt is wrapped in `.purchase-receipt`, because the stamp motion in `depth.css` and the code styles in `App.css` are scoped to that class.

**States:** skeleton ledger rows while loading, an inline error with «تلاش دوباره», and an empty cart with `EmptyShelf` + «مرور کتاب‌ها».

## 3. About and Contact

### About (`/about`, public, frontend only)

`pages/About.jsx`, `<title>` «درباره‌ی ری‌بوک | ری‌بوک». Content is true statements about the product only:

1. **Why ReBook:** a second life for books (the footer line «جایی برای دادن زندگی دوباره به کتاب‌هایتان»).
2. **Buying:** find a copy → cart → simulated payment → each seller ships their own book → track it in «معاملات من».
3. **Selling:** `components/SellSteps.jsx`, extracted from Home's three-step rail (ثبت آگهی → بررسی → فروش) and used by both pages. This is where the review step is explained.
4. **Condition grades:** the five grades with `ConditionMeasure` + `CONDITION_NOTES` (shared with the book page and CreateBook).
5. **Honesty:** sellers' contact details are never shown (only the username), and payment is simulated for now.
6. **Closing:** «مرور کتاب‌ها» / «فروش کتاب».

### Contact backend

- `notifications.models.ContactMessage(name ≤100, email EmailField, subject ≤200, message TextField, is_handled bool default False, created_at)`, newest first, Persian `verbose_name`s.
- Admin: `list_display` (subject, name, email, is_handled, created_at), `list_filter` is_handled, `list_editable` is_handled, `search_fields` email/subject.
- `POST /api/notifications/contact/` (`ContactMessageCreateView`):
  - `AllowAny`, `csrf_protect`, `ScopedRateThrottle` with scope `contact` (`"contact": "10/hour"`).
  - The serializer enforces message length 10–5000 (after trimming).
  - Returns 201.
- Tests: a guest sends a message (201, saved), a bad email or short message is a 400, the 11th request in an hour is a 429.

### Contact page (`/contact`)

`pages/Contact.jsx`, `<title>` «تماس با ما | ری‌بوک».

- **Guests:**
  - Fields: name, email (`dir="ltr"`, `.latin-id`), subject, message. Visible labels, the shared `Form` (`aria-invalid` + linked errors), and inline validation before sending.
  - Success replaces the form with «پیامت ثبت شد و تیم ری‌بوک آن را می‌خواند. اگر پاسخی لازم باشد، به همین ایمیل فرستاده می‌شود.»
- **Logged in:**
  - Fields: subject + message only, sent through the existing `notificationAPI.createTicket`.
  - Success says the message is a support ticket and the reply appears in «پشتیبانی» (linked).
- **Both:** a short side note that order problems are best raised from «پشتیبانی» while logged in. No phone number, email address or social links.

### Links

The footer gets «درباره‌ی ما» (`/about`) and «تماس با ما» (`/contact`). The navbar is unchanged apart from the cart.

## Routes

`App.jsx` gains `/cart`, `/about` and `/contact` as public lazy routes, above the `*` catch-all.

## Visual work and verification

- Visual work: `/impeccable` (layout, then harden) within DESIGN.md's Pocket Series world. Persian typography rules apply. Where there's a real open visual choice, build switchable variants on the real page for the owner to pick. DESIGN.md is updated afterwards (Cart Ledger, Contact form, About sections).
- Backend: `manage.py test` (all apps) and ruff, run through the hooks.
- Frontend: `npm run lint`, `npm run build`.
- Screenshots at 1440 and 375 (plus 320 for the navbar) with `.claude/tools/shot.mjs` / `shot-auth.mjs`. Add a cart fixture first, because a real 401 on `orders/cart/` logs the fake user out.
- Keyboard: `kbd.mjs` on `/cart` and `/contact` (focus after add, checkout errors, form errors).
- End to end: an extended `/smoke`. A guest adds two books from two sellers → logs in (the cart merges) → checks out → one tracking code → both sales listed for the sellers. Run through Playwright MCP if it's connected, otherwise CDP.

## Documentation to update

- `CLAUDE.md`:
  - Architecture → book and order lifecycle: cart, checkout, and `PurchaseModal` now only paying existing pending orders.
  - The `cart` and `contact` throttle scopes (tests `cache.clear()`).
  - `ContactMessage` and `cartAPI` in the list of API objects.
- `PRODUCT.md`: the buyer flow goes through the cart; Contact is a real channel (admin inbox and support tickets).
- `.claude/skills/smoke/SKILL.md`: the purchase step goes through «افزودن به سبد» → `/cart` → checkout, because the book page no longer has «خرید».
- `DESIGN.md`: Cart Ledger, Checkout, Contact form, About sections.
- `.claude/REDESIGN-GUIDE.md`: a progress entry with commits, shots and gotchas.

## Open items for the owner

- Confirm the copy, in particular the guest Contact success message (true only if someone answers by email) and `CONDITION_NOTES`, which About now repeats.
- Known limit: Contact spam is held back by CSRF and the throttle only. Add a honeypot if junk shows up in the admin.
