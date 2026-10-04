from rest_framework import serializers

from books.models import Book
from books.serializers import BookListSerializer

from .models import Order, Transaction


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ("id", "amount", "status", "reference_code", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    book_detail = BookListSerializer(source="book", read_only=True)
    transaction = TransactionSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "book",
            "book_detail",
            "total_price",
            "status",
            "status_display",
            "shipping_address",
            "transaction",
            "created_at",
        )
        read_only_fields = ("id", "total_price", "status", "created_at")

    def validate_book(self, book):
        if book.status != Book.StatusChoices.APPROVED:
            raise serializers.ValidationError("این کتاب قابل خرید نیست.")
        user = self.context["request"].user
        if book.seller == user:
            raise serializers.ValidationError("نمی‌توانید کتاب خودتان را بخرید.")
        # یک سفارش باز برای هر نسخه (قید one_pending_order_per_book در مدل)
        pending = book.orders.filter(status=Order.StatusChoices.PENDING)
        if pending.filter(buyer=user).exists():
            raise serializers.ValidationError(
                "این کتاب را قبلاً سفارش داده‌اید؛ از «معاملات من» پرداخت یا لغوش کنید."
            )
        if pending.exists():
            raise serializers.ValidationError("این کتاب در انتظار پرداخت خریدار دیگری است.")
        return book

    def create(self, validated_data):
        """ساخت سفارش جدید"""
        book = validated_data["book"]
        validated_data["buyer"] = self.context["request"].user
        validated_data["total_price"] = book.price
        return super().create(validated_data)
