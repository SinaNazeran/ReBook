import random
import string

from django.db import models
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from books.models import Book
from notifications.models import Notification

from .models import Order, Transaction
from .serializers import OrderSerializer


class OrderCreateView(generics.CreateAPIView):
    """ثبت سفارش جدید"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        order = serializer.save()

        # ساخت تراکنش مرتبط
        Transaction.objects.create(
            order=order, amount=order.total_price, status="pending"
        )

        # ارسال اعلان به فروشنده
        Notification.objects.create(
            user=order.book.seller,
            title="سفارش جدید",
            message=f'کتاب "{order.book.title}" سفارش داده شد.',
            notification_type="order",
        )


class MyOrdersView(generics.ListAPIView):
    """لیست سفارش‌های خریدار"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user)


class MySalesView(generics.ListAPIView):
    """لیست فروش‌های فروشنده"""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

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
                    {"detail": "این سفارش قبلاً پرداخت شده."},
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
            message=f'خریدار کتاب "{order.book.title}" پرداخت را انجام داد.',
            notification_type="payment",
        )

        return Response({"message": "پرداخت موفق", "reference_code": reference_code})
