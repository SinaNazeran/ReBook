from rest_framework import serializers

from accounts.models import User

from .models import Book, Category, Wishlist


class SellerSerializer(serializers.ModelSerializer):
    """اطلاعات عمومی فروشنده (بدون ایمیل و شماره تماس)"""

    class Meta:
        model = User
        fields = ("id", "username")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description", "parent")


class BookListSerializer(serializers.ModelSerializer):
    """سریالایزر لیست کتاب‌ها (اطلاعات خلاصه)"""

    seller_name = serializers.CharField(source="seller.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    condition_display = serializers.CharField(
        source="get_condition_display", read_only=True
    )
    # شناسه‌ی دسته‌بندی سطح اول؛ کارت کتاب رنگ «مجموعه» را از آن می‌گیرد
    category_root = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = (
            "id",
            "title",
            "author",
            "price",
            "cover_image",
            "condition",
            "condition_display",
            "status",
            "seller_name",
            "category_name",
            "category_root",
            "created_at",
        )

    def get_category_root(self, obj):
        # فقط دو سطح (والد/زیرشاخه) داریم؛ اگر عمق بیشتر شد باید تا ریشه بالا رفت
        if obj.category is None:
            return None
        return obj.category.parent_id or obj.category_id


class BookDetailSerializer(serializers.ModelSerializer):
    """سریالایزر جزئیات کتاب (اطلاعات کامل)"""

    seller = SellerSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    condition_display = serializers.CharField(
        source="get_condition_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_wishlisted = serializers.SerializerMethodField()
    open_order = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = "__all__"

    def get_is_wishlisted(self, book):
        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            return False
        return book.wishlisted_by.filter(user=request.user).exists()

    def get_open_order(self, book):
        """سفارش در انتظار پرداخت این نسخه (حداکثر یکی، با قید one_pending_order_per_book).

        بقیه فقط می‌بینند که نسخه رزرو است؛ شناسه فقط به خود خریدار داده می‌شود
        تا همان‌جا پرداخت یا لغوش کند.
        """
        order = book.orders.filter(status="pending").only("id", "buyer_id").first()
        if order is None:
            return None
        request = self.context.get("request")
        is_mine = bool(request and request.user.is_authenticated and order.buyer_id == request.user.id)
        return {"id": order.id if is_mine else None, "is_mine": is_mine}


class BookCreateSerializer(serializers.ModelSerializer):
    """سریالایزر ثبت کتاب جدید"""

    class Meta:
        model = Book
        fields = (
            "title",
            "author",
            "publisher",
            "isbn",
            "description",
            "price",
            "condition",
            "cover_image",
            "category",
        )

    def validate_cover_image(self, image):
        # سقف حجم سمت سرور، هم‌اندازه MAX_IMAGE_SIZE_MB در CreateBook.jsx
        if image and image.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("حجم تصویر جلد نباید بیشتر از ۵ مگابایت باشد.")
        return image

    def create(self, validated_data):
        """فروشنده به صورت خودکار از کاربر فعلی گرفته می‌شود"""
        validated_data["seller"] = self.context["request"].user
        validated_data["status"] = "pending"
        return super().create(validated_data)


class WishlistSerializer(serializers.ModelSerializer):
    book = BookListSerializer(read_only=True)

    class Meta:
        model = Wishlist
        fields = ("id", "book", "added_at")
