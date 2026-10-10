import random
import string

from django.db import IntegrityError, models
from django.db import transaction as db_transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from books.models import Book
from books.views import visible_books
from notifications.models import Notification

from . import cart
from .models import Order, Transaction
from .serializers import OrderSerializer


class OrderCreateView(generics.CreateAPIView):
    """ثبت سفارش جدید"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # اگر دو خریدار هم‌زمان سفارش دهند، هر دو از validate_book رد می‌شوند
        # و قید پایگاه داده فقط اولی را می‌پذیرد
        try:
            with db_transaction.atomic():
                order = serializer.save()
        except IntegrityError:
            raise serializers.ValidationError(
                {"book": ["این کتاب در انتظار پرداخت خریدار دیگری است."]}
            ) from None

        # ساخت تراکنش مرتبط
        Transaction.objects.create(
            order=order, amount=order.total_price, status="pending"
        )

        # ارسال اعلان به فروشنده
        Notification.objects.create(
            user=order.book.seller,
            title="سفارش جدید",
            message=f"کتاب «{order.book.title}» سفارش داده شد.",
            notification_type="order",
        )


class MyOrdersView(generics.ListAPIView):
    """لیست سفارش‌های خریدار"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # فهرست شخصی و کوچک؛ جدول MyOrders همه را یکجا نشان می‌دهد

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user)


class MySalesView(generics.ListAPIView):
    """لیست فروش‌های فروشنده"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # فهرست شخصی و کوچک؛ جدول MyOrders همه را یکجا نشان می‌دهد

    def get_queryset(self):
        return Order.objects.filter(book__seller=self.request.user)


class OrderDetailView(generics.RetrieveAPIView):
    """جزئیات سفارش"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(models.Q(buyer=user) | models.Q(book__seller=user))


class FakePaymentView(APIView):
    """
    شبیه‌سازی پرداخت آنلاین
    در نسخه واقعی باید به درگاه بانکی متصل شود
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(pk=order_id, buyer=request.user)
        except Order.DoesNotExist:
            return Response(
                {"detail": "سفارش یافت نشد."}, status=status.HTTP_404_NOT_FOUND
            )

        # شبیه‌سازی پرداخت موفق
        reference_code = "".join(random.choices(string.digits, k=10))
        now = timezone.now()

        # به‌روزرسانی شرطی: اگر دو درخواست هم‌زمان برسند فقط یکی موفق می‌شود
        # (select_for_update روی SQLite کاری نمی‌کند، اما این روش روی هر دیتابیسی درست است)
        with db_transaction.atomic():
            if not Order.objects.filter(pk=order.pk, status="pending").update(
                status="paid", updated_at=now
            ):
                return Response(
                    {"detail": "این سفارش در انتظار پرداخت نیست (پرداخت یا لغو شده)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # تغییر وضعیت کتاب به فروخته شده؛ اگر قبلاً فروخته شده، کل پرداخت برگردانده می‌شود
            if not Book.objects.filter(pk=order.book_id, status="approved").update(
                status="sold", updated_at=now
            ):
                db_transaction.set_rollback(True)
                return Response(
                    {"detail": "این کتاب دیگر قابل خرید نیست."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            Transaction.objects.filter(order=order).update(
                status="success", reference_code=reference_code
            )

        # اعلان به خریدار
        Notification.objects.create(
            user=request.user,
            title="پرداخت موفق",
            message=f"پرداخت سفارش #{order.pk} با موفقیت انجام شد. کد پیگیری: {reference_code}",
            notification_type="payment",
        )

        # اعلان به فروشنده
        Notification.objects.create(
            user=order.book.seller,
            title="پرداخت سفارش",
            message=f"خریدار کتاب «{order.book.title}» پرداخت را انجام داد.",
            notification_type="payment",
        )

        return Response({"message": "پرداخت موفق", "reference_code": reference_code})


class OrderCancelView(APIView):
    """لغو سفارش در انتظار پرداخت؛ توسط خریدار یا فروشندهٔ کتاب

    فروشنده هم می‌تواند لغو کند تا خریداری که پرداخت نمی‌کند کتاب را برای همیشه قفل نکند.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        user = request.user
        try:
            order = Order.objects.select_related("book", "buyer").get(
                models.Q(buyer=user) | models.Q(book__seller=user), pk=order_id
            )
        except Order.DoesNotExist:
            return Response(
                {"detail": "سفارش یافت نشد."}, status=status.HTTP_404_NOT_FOUND
            )

        # به‌روزرسانی شرطی، مثل پرداخت: اگر هم‌زمان پرداخت شود، فقط یکی موفق می‌شود
        with db_transaction.atomic():
            if not Order.objects.filter(pk=order.pk, status="pending").update(
                status="cancelled", updated_at=timezone.now()
            ):
                return Response(
                    {"detail": "فقط سفارش در انتظار پرداخت را می‌توان لغو کرد."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            Transaction.objects.filter(order=order).update(status="failed")

        # اعلان به طرف دیگر معامله
        if order.buyer_id == user.id:
            recipient = order.book.seller
            message = f"خریدار سفارش کتاب «{order.book.title}» را لغو کرد؛ کتاب دوباره قابل خرید است."
        else:
            recipient = order.buyer
            message = f"فروشنده سفارشت برای کتاب «{order.book.title}» را لغو کرد."
        Notification.objects.create(
            user=recipient, title="لغو سفارش", message=message, notification_type="order"
        )

        return Response({"message": "سفارش لغو شد."})


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


PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


class CheckoutView(APIView):
    """پرداخت آزمایشی کل سبد: برای هر کتاب یک سفارش پرداخت‌شده، همه با هم یا هیچ‌کدام.

    books = [{id, price}] همان چیزی است که خریدار در سبد دید؛ اگر کتابی یا قیمتی عوض شده باشد چیزی ساخته نمی‌شود.
    """

    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def changed_message(book_id, book, in_cart):
        """کتابی که دیگر در سبد نیست یا دیده نمی‌شود، با نامش؛ نام کتاب بیرون از سبد و دیده‌نشده فاش نمی‌شود"""
        if book is not None:
            return f"«{book.title}» دیگر در سبدت نیست؛ دوباره نگاهش کن."
        if book_id in in_cart:
            title = Book.objects.filter(pk=book_id).values_list("title", flat=True).first()
            return f"«{title}» دیگر در دسترس نیست؛ دوباره نگاهش کن."
        return "سبدت عوض شده است؛ دوباره نگاهش کن."

    def post(self, request):
        user = request.user
        address = str(request.data.get("shipping_address") or "").strip()
        items = request.data.get("books") or []
        if not isinstance(items, list) or len(items) > cart.MAX_ITEMS:
            return Response({"detail": "سبد ارسال‌شده معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        seen_prices = {}
        try:
            for item in items:
                seen_prices.setdefault(int(item["id"]), int(item["price"]))
        except (TypeError, ValueError, KeyError):
            return Response({"detail": "سبد ارسال‌شده معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        ids = list(seen_prices)

        if not ids:
            return Response({"detail": "سبد خالی است."}, status=status.HTTP_400_BAD_REQUEST)
        if not address:
            return Response(
                {"shipping_address": ["آدرس ارسال را بنویس تا فروشنده‌ها بدانند کتاب‌ها را کجا بفرستند."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
