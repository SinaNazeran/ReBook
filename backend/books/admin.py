from django.contrib import admin

from .models import Book, Category, Wishlist


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "created_at")
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


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "added_at")
