from django.contrib.auth.models import AbstractUser
from django.db import models

from config.images import shrink_new_upload
from uploads.lifecycle import file_save, remember_file


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
        with file_save(self, "avatar", "avatar", using=kwargs.get("using"), update_fields=kwargs.get("update_fields")):
            shrink_new_upload(self.avatar, (400, 400))
            super().save(*args, **kwargs)

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        remember_file(instance, "avatar")
        return instance

    def refresh_from_db(self, using=None, fields=None, from_queryset=None):
        fields = tuple(fields) if fields is not None else None
        super().refresh_from_db(using=using, fields=fields, from_queryset=from_queryset)
        if fields is None or "avatar" in fields:
            remember_file(self, "avatar")
