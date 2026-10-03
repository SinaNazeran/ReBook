from django.contrib import admin

from .models import Order, Transaction


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "buyer", "book", "total_price", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("buyer__username", "book__title")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "amount", "status", "reference_code", "created_at")
    list_filter = ("status",)
