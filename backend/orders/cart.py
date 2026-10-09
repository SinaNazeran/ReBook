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
