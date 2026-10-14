import random
import string

from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from books.models import Book
from books.views import visible_books
from notifications.models import Notification
from orders import cart
from orders.models import Order, Transaction
from orders.request_serializers import CheckoutRequestSerializer

PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")



class CheckoutView(APIView):
    """پرداخت آزمایشی کل سبد: برای هر کتاب یک سفارش پرداخت‌شده، همه با هم یا هیچ‌کدام.

    books = [{id, price}] همان چیزی است که خریدار در سبد دید؛ اگر کتابی یا قیمتی عوض شده باشد چیزی ساخته نمی‌شود.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "payment"

    @staticmethod
    def changed_message(book_id, book, in_cart):
        """نام کتاب فقط وقتی نمایش داده می‌شود که کاربر اجازهٔ دیدنش را دارد."""
        if book is not None:
            return f"«{book.title}» دیگر در سبدت نیست؛ دوباره نگاهش کن."
        if book_id in in_cart:
            return "یکی از کتاب‌های سبدت دیگر در دسترس نیست؛ دوباره نگاهش کن."
        return "سبدت عوض شده است؛ دوباره نگاهش کن."

    def post(self, request):
        user = request.user
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = serializer.validated_data["shipping_address"]
        items = serializer.validated_data["books"]
        seen_prices = {}
        for item in items:
            seen_prices.setdefault(item["id"], item["price"])
        ids = list(seen_prices)

        in_cart = set(cart.get_ids(request))
        # درخواست تکراری پس از پاسخی که نرسید: همه‌ی این کتاب‌ها را خود همین خریدار پرداخت کرده و از سبد رفته‌اند
        if not in_cart.intersection(ids) and Order.objects.filter(
            buyer=user, book_id__in=ids, status=Order.StatusChoices.PAID
        ).count() == len(ids):
            return Response(
                {"detail": "این خرید پیش‌تر انجام شده است؛ سفارش‌ها و کد پیگیری در «معاملات من» هستند."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        books = {book.pk: book for book in visible_books(user).filter(pk__in=ids).select_related("seller")}
        pending = cart.pending_buyers(ids)
        for book_id in ids:
            book = books.get(book_id)
            if book is None or book_id not in in_cart:
                return Response({"detail": self.changed_message(book_id, book, in_cart)}, status=status.HTTP_400_BAD_REQUEST)
            reason = cart.unavailable_reason(book, user, pending)
            if reason:
                return Response({"detail": f"«{book.title}»: {reason}."}, status=status.HTTP_400_BAD_REQUEST)
            # قیمت کتاب تأییدشده با ویرایش فروشنده عوض نمی‌شود (به صف بررسی برمی‌گردد)، اما مدیر می‌تواند عوضش کند.
            # هر کتاب جدا سنجیده می‌شود: دو تغییر با جمع برابر هم دیده می‌شوند
            if book.price != seen_prices[book_id]:
                return Response(
                    {"detail": f"قیمت «{book.title}» عوض شده است؛ دوباره نگاهش کن."},
                    status=status.HTTP_400_BAD_REQUEST,
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

