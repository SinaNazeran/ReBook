from django.contrib import admin

from notifications.models import Notification

from .models import Book, Category, Wishlist


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "created_at")
    list_select_related = ("parent",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "author",
        "seller",
        "price",
        "condition",
        "status",
        "created_at",
    )
    list_filter = ("status", "condition", "category", "created_at")
    search_fields = ("title", "author", "isbn")
    list_editable = ("status",)

    # با این تنظیم، ادمین می‌تواند وضعیت تأیید را
    # مستقیماً از لیست تغییر دهد بدون ورود به صفحه ویرایش

    def save_model(self, request, obj, form, change):
        # هم فرم ویرایش و هم ویرایش در لیست از همین‌جا ذخیره می‌کنند
        super().save_model(request, obj, form, change)
        if not change or "status" not in form.changed_data:
            return
        if obj.status == Book.StatusChoices.APPROVED:
            Notification.objects.create(
                user=obj.seller,
                book=obj,
                title="آگهی‌ات تأیید شد",
                message=f"آگهی «{obj.title}» تأیید شد و حالا در فهرست کتاب‌ها دیده می‌شود.",
                notification_type=Notification.TypeChoices.BOOK_APPROVED,
            )
        elif obj.status == Book.StatusChoices.REJECTED:
            Notification.objects.create(
                user=obj.seller,
                book=obj,
                title="آگهی‌ات تأیید نشد",
                message=(
                    f"آگهی «{obj.title}» تأیید نشد. ویرایشش کن و دوباره برای بررسی بفرست؛ "
                    "دلیلش را از پشتیبانی بپرس."
                ),
                notification_type=Notification.TypeChoices.BOOK_REJECTED,
            )


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "added_at")
