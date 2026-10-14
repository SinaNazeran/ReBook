from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from config.serializer_fields import StrictCharField

from .models import User


class LoginRequestSerializer(serializers.Serializer):
    username = StrictCharField(max_length=150)
    password = StrictCharField(max_length=4096, trim_whitespace=False, write_only=True)


class UserRegistrationSerializer(serializers.ModelSerializer):
    """سریالایزر ثبت‌نام"""

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "phone",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
        )

    def validate_phone(self, value):
        # phone یکتاست؛ چند رشته خالی تداخل دارند (IntegrityError) ولی چند NULL مجاز است
        return value or None

    def validate(self, data):
        """بررسی تطابق رمز عبور و قوانین AUTH_PASSWORD_VALIDATORS"""
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError("رمز عبور و تکرار آن یکسان نیستند.")
        # کاربر ذخیره‌نشده تا شباهت رمز به نام کاربری و ایمیل هم بررسی شود
        user = User(**{k: v for k, v in data.items() if k not in ("password", "password_confirm")})
        try:
            validate_password(data["password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)}) from e
        return data

    def create(self, validated_data):
        """ساخت کاربر جدید"""
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """سریالایزر پروفایل"""

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "first_name",
            "last_name",
            "address",
            "avatar",
            "is_staff",
            "created_at",
        )
        # is_staff فقط برای نمایش لینک پنل مدیریت است و نباید قابل تغییر باشد
        read_only_fields = ("id", "username", "is_staff", "created_at")

    def validate_phone(self, value):
        return value or None

    def validate_avatar(self, image):
        # سقف حجم سمت سرور، هم‌اندازه بررسی Profile.jsx
        if image and image.size > 3 * 1024 * 1024:
            raise serializers.ValidationError("حجم تصویر پروفایل نباید بیشتر از ۳ مگابایت باشد.")
        return image


class UserListSerializer(serializers.ModelSerializer):
    """سریالایزر لیست کاربران (برای ادمین)"""

    class Meta:
        model = User
        fields = ("id", "username", "email", "phone", "is_active", "created_at")
