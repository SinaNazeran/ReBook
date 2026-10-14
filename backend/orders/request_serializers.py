from rest_framework import serializers

from config.serializer_fields import (
    MAX_BOOK_ID,
    MAX_PRICE,
    StrictCharField,
    StrictIntegerField,
)
from orders.cart import MAX_ITEMS


class CartAddSerializer(serializers.Serializer):
    book = StrictIntegerField(min_value=1, max_value=MAX_BOOK_ID)


class CheckoutItemSerializer(serializers.Serializer):
    id = StrictIntegerField(min_value=1, max_value=MAX_BOOK_ID)
    price = StrictIntegerField(min_value=0, max_value=MAX_PRICE)


class CheckoutRequestSerializer(serializers.Serializer):
    books = CheckoutItemSerializer(many=True, allow_empty=False, max_length=MAX_ITEMS)
    shipping_address = StrictCharField(
        max_length=2000,
        error_messages={
            "blank": "آدرس ارسال را بنویس تا فروشنده‌ها بدانند کتاب‌ها را کجا بفرستند.",
            "required": "آدرس ارسال را بنویس تا فروشنده‌ها بدانند کتاب‌ها را کجا بفرستند.",
        },
    )
