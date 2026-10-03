from django.conf import settings
from django.db import models


class Notification(models.Model):
    """اعلان‌های سیستمی"""

    class TypeChoices(models.TextChoices):
        ORDER = "order", "سفارش"
        PAYMENT = "payment", "پرداخت"
        BOOK_APPROVED = "book_approved", "تأیید کتاب"
        BOOK_REJECTED = "book_rejected", "رد کتاب"
        SYSTEM = "system", "سیستمی"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="کاربر",
    )

    title = models.CharField(max_length=200, verbose_name="عنوان")

    message = models.TextField(verbose_name="متن پیام")

    notification_type = models.CharField(
        max_length=15,
        choices=TypeChoices.choices,
        default=TypeChoices.SYSTEM,
        verbose_name="نوع اعلان",
    )

    is_read = models.BooleanField(default=False, verbose_name="خوانده شده؟")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")

    class Meta:
        verbose_name = "اعلان"
        verbose_name_plural = "اعلان‌ها"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.user.username}"


class SupportTicket(models.Model):
    """تیکت پشتیبانی - ارتباط با مدیریت"""

    class StatusChoices(models.TextChoices):
        OPEN = "open", "باز"
        IN_PROGRESS = "in_progress", "در حال بررسی"
        CLOSED = "closed", "بسته شده"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets",
        verbose_name="کاربر",
    )

    subject = models.CharField(max_length=200, verbose_name="موضوع")

    message = models.TextField(verbose_name="متن پیام")

    status = models.CharField(
        max_length=15,
        choices=StatusChoices.choices,
        default=StatusChoices.OPEN,
        verbose_name="وضعیت",
    )

    admin_reply = models.TextField(blank=True, null=True, verbose_name="پاسخ مدیر")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")

    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین بروزرسانی")

    class Meta:
        verbose_name = "تیکت پشتیبانی"
        verbose_name_plural = "تیکت‌های پشتیبانی"

    def __str__(self):
        return f"{self.subject} - {self.user.username}"
