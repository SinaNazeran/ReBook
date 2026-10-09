from django.conf import settings
from django.db import models

from config.images import shrink_new_upload


class Category(models.Model):
    """دسته‌بندی کتاب‌ها"""

    name = models.CharField(max_length=100, verbose_name="نام دسته‌بندی")

    slug = models.SlugField(
        max_length=100, unique=True, allow_unicode=True, verbose_name="اسلاگ"
    )

    description = models.TextField(blank=True, null=True, verbose_name="توضیحات")

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="children",
        verbose_name="دسته‌بندی والد",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")

    class Meta:
        verbose_name = "دسته‌بندی"
        verbose_name_plural = "دسته‌بندی‌ها"

    def __str__(self):
        return self.name


class Book(models.Model):
    """مدل اصلی کتاب"""

    class ConditionChoices(models.TextChoices):
        """وضعیت ظاهری کتاب"""

        NEW = "new", "نو"
        LIKE_NEW = "like_new", "در حد نو"
        GOOD = "good", "خوب"
        FAIR = "fair", "قابل قبول"
        POOR = "poor", "فرسوده"

    class StatusChoices(models.TextChoices):
        """وضعیت تأیید کتاب توسط ادمین"""

        PENDING = "pending", "در انتظار تأیید"
        APPROVED = "approved", "تأیید شده"
        REJECTED = "rejected", "رد شده"
        SOLD = "sold", "فروخته شده"

    # ---------- اطلاعات اصلی کتاب ----------

    title = models.CharField(max_length=200, verbose_name="عنوان کتاب")

    author = models.CharField(max_length=200, verbose_name="نویسنده")

    publisher = models.CharField(
        max_length=200, blank=True, null=True, verbose_name="انتشارات"
    )

    isbn = models.CharField(max_length=13, blank=True, null=True, verbose_name="شابک")

    description = models.TextField(blank=True, null=True, verbose_name="توضیحات")

    # ---------- قیمت و وضعیت ----------

    price = models.PositiveIntegerField(verbose_name="قیمت (تومان)")

    condition = models.CharField(
        max_length=10,
        choices=ConditionChoices.choices,
        default=ConditionChoices.GOOD,
        verbose_name="وضعیت ظاهری",
    )

    status = models.CharField(
        max_length=10,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
        verbose_name="وضعیت تأیید",
    )

    # ---------- تصویر ----------

    cover_image = models.ImageField(
        upload_to="book_covers/",
        blank=True,
        null=True,
        width_field="cover_width",
        height_field="cover_height",
        verbose_name="تصویر جلد",
    )

    # ابعاد جلد را خود ImageField پر می‌کند؛ صفحه‌ی کتاب با آن جای جلد را پیش از بارگیری نگه می‌دارد
    cover_width = models.PositiveIntegerField(
        blank=True, null=True, editable=False, verbose_name="عرض جلد"
    )

    cover_height = models.PositiveIntegerField(
        blank=True, null=True, editable=False, verbose_name="ارتفاع جلد"
    )

    # ---------- روابط ----------

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="books_for_sale",
        verbose_name="فروشنده",
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="books",
        verbose_name="دسته‌بندی",
    )

    # ---------- زمان ----------

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")

    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین بروزرسانی")

    class Meta:
        verbose_name = "کتاب"
        verbose_name_plural = "کتاب‌ها"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.author}"

    def save(self, *args, **kwargs):
        # بزرگ‌ترین جلدی که لازم است: ستون جلد در صفحه‌ی کتاب روی نمایشگر 2x
        shrink_new_upload(self.cover_image, (1000, 1500))
        super().save(*args, **kwargs)


class Wishlist(models.Model):
    """لیست علاقه‌مندی‌ها"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlists",
        verbose_name="کاربر",
    )

    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name="wishlisted_by",
        verbose_name="کتاب",
    )

    added_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ افزودن")

    class Meta:
        verbose_name = "علاقه‌مندی"
        verbose_name_plural = "علاقه‌مندی‌ها"
        unique_together = ("user", "book")

    def __str__(self):
        return f"{self.user.username} - {self.book.title}"
