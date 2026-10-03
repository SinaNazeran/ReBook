from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """تنظیمات نمایش کاربر در پنل ادمین"""

    list_display = ("username", "email", "phone", "is_active", "created_at")

    list_filter = ("is_active", "created_at")

    search_fields = ("username", "email", "phone")

    fieldsets = UserAdmin.fieldsets + (
        ("اطلاعات اضافه", {"fields": ("phone", "address", "avatar")}),
    )
