from rest_framework import serializers

# بازه‌های قابل‌حمل برای BigAutoField و PositiveIntegerField پایگاه داده.
MAX_BOOK_ID = 2**63 - 1
MAX_PRICE = 2**31 - 1


class StrictIntegerField(serializers.IntegerField):
    """فقط عدد صحیح یا رشتهٔ ارقام؛ اعشار و بولین به عدد تبدیل نمی‌شوند."""

    def to_internal_value(self, data):
        if type(data) is int:
            return data
        if isinstance(data, str):
            if len(data) > 19:
                self.fail("max_string_length")
            if data.isdecimal():
                return int(data)
        self.fail("invalid")


class StrictCharField(serializers.CharField):
    """ورودی عددی، بولین یا ساختار JSON جای متن پذیرفته نمی‌شود."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)
