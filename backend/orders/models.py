from django.conf import settings
from django.db import models

from books.models import Book


class Order(models.Model):
    """مدل سفارش"""

    class StatusChoices(models.TextChoices):
        PENDING = "pending", "در انتظار پرداخت"
        PAID = "paid", "پرداخت شده"
        SHIPPED = "shipped", "ارسال شده"
        DELIVERED = "delivered", "تحویل داده شده"
        CANCELLED = "cancelled", "لغو شده"

    # ---------- طرفین معامله ----------

    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="purchases",
        verbose_name="خریدار",
    )

    book = models.ForeignKey(
        Book, on_delete=models.CASCADE, related_name="orders", verbose_name="کتاب"
    )

    # ---------- اطلاعات سفارش ----------

    total_price = models.PositiveIntegerField(verbose_name="مبلغ کل (تومان)")

    status = models.CharField(
        max_length=12,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
        verbose_name="وضعیت سفارش",
    )

    shipping_address = models.TextField(verbose_name="آدرس ارسال")

    # ---------- زمان ----------

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ سفارش")

    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین بروزرسانی")

    class Meta:
        verbose_name = "سفارش"
        verbose_name_plural = "سفارش‌ها"
        ordering = ["-created_at"]
        constraints = [
            # هر نسخه از کتاب در هر لحظه فقط یک سفارش باز (در انتظار پرداخت) دارد؛
            # با لغو یا پرداخت آن سفارش، کتاب دوباره آزاد می‌شود
            models.UniqueConstraint(
                fields=["book"],
                condition=models.Q(status="pending"),
                name="one_pending_order_per_book",
            ),
        ]

    def __str__(self):
        return f"سفارش #{self.pk} - {self.buyer.username}"


class Transaction(models.Model):
    """مدل تراکنش مالی"""

    class StatusChoices(models.TextChoices):
        PENDING = "pending", "در انتظار"
        SUCCESS = "success", "موفق"
        FAILED = "failed", "ناموفق"

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="transaction",
        verbose_name="سفارش",
    )

    amount = models.PositiveIntegerField(verbose_name="مبلغ (تومان)")

    status = models.CharField(
        max_length=10,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
        verbose_name="وضعیت تراکنش",
    )

    # شماره پیگیری پرداخت (از درگاه بانکی)
    reference_code = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="کد پیگیری"
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ تراکنش")

    class Meta:
        verbose_name = "تراکنش"
        verbose_name_plural = "تراکنش‌ها"

    def __str__(self):
        return f"تراکنش #{self.pk} - {self.get_status_display()}"
