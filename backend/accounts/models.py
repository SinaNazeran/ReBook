from django.contrib.auth.models import AbstractUser
from django.db import models

from config.images import shrink_new_upload


class User(AbstractUser):
    """
    مدل کاربر سفارشی
    """

    # ---------- فیلدهای اضافه ----------

    phone = models.CharField(
        max_length=11,
        blank=True,
        null=True,
        unique=True,
        verbose_name='شماره موبایل'
    )

    address = models.TextField(
        blank=True,
        null=True,
        verbose_name='آدرس'
    )

    avatar = models.ImageField(
        upload_to='avatars/',
        blank=True,
        null=True,
        verbose_name='تصویر پروفایل'
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='تاریخ عضویت'
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='آخرین بروزرسانی'
    )

    class Meta:
        verbose_name = 'کاربر'
        verbose_name_plural = 'کاربران'

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # بزرگ‌ترین نمایش آواتار ۷rem (پروفایل) است؛ ۴۰۰ پیکسل برای نمایشگر 2x هم کافی است
        shrink_new_upload(self.avatar, (400, 400))
        super().save(*args, **kwargs)