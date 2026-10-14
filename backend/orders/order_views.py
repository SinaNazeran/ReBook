import random
import string

from django.db import IntegrityError, models
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from books.models import Book
from notifications.models import Notification
from orders.models import Order, Transaction
from orders.serializers import OrderSerializer


class OrderCreateView(generics.CreateAPIView):
    """ثبت سفارش جدید"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "payment"

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
    throttle_scope = "payment"

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
    throttle_scope = "payment"

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

