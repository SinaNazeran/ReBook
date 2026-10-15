from django.db import models
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .category_cache import CachedCategoryPagesMixin
from .models import Book, Category, Wishlist
from .request_serializers import CatalogPriceSerializer
from .serializers import (
    BookCreateSerializer,
    BookDetailSerializer,
    BookListSerializer,
    CategorySerializer,
    WishlistSerializer,
)

# مقادیر مجاز برای پارامتر ordering (هم‌راستا با ORDERING_OPTIONS در BookList.jsx)
ALLOWED_ORDERINGS = {"-created_at", "created_at", "price", "-price"}


def visible_books(user):
    """کتاب‌هایی که این کاربر اجازهٔ دیدنشان را دارد؛ کتاب تأییدنشده فقط برای فروشنده‌اش"""
    visible = models.Q(status__in=["approved", "sold"])
    if user.is_authenticated:
        visible |= models.Q(seller=user)
    return Book.objects.filter(visible)


class CategoryListView(CachedCategoryPagesMixin, generics.ListAPIView):
    """لیست دسته‌بندی‌ها"""

    queryset = Category.objects.order_by("id")
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class BookListView(generics.ListAPIView):
    """لیست کتاب‌ها با امکان جستجو و فیلتر"""

    serializer_class = BookListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # سریالایزر لیست برای هر کتاب seller و category را می‌خواند؛ بدون این، هر کارت دو کوئری اضافه دارد
        queryset = Book.objects.filter(status="approved").select_related("seller", "category")

        search = self.request.query_params.get("search", None)
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) | models.Q(author__icontains=search)
            )

        category = self.request.query_params.get("category", None)
        if category:
            # دسته‌بندی والد، کتاب‌های زیردسته‌هایش را هم شامل می‌شود
            # فقط یک سطح زیردسته؛ اگر درخت عمیق‌تر شد، شناسهٔ همهٔ نوادگان را جمع کنید
            queryset = queryset.filter(
                models.Q(category__slug=category) | models.Q(category__parent__slug=category)
            )

        condition = self.request.query_params.get("condition", None)
        if condition:
            queryset = queryset.filter(condition=condition)

        # فیلتر خالی یعنی بدون حد؛ مقدار نامعتبر پیش از تبدیل عدد و کوئری رد می‌شود.
        price_params = {
            key: self.request.query_params[key]
            for key in ("min_price", "max_price")
            if self.request.query_params.get(key, "") != ""
        }
        prices = CatalogPriceSerializer(data=price_params)
        prices.is_valid(raise_exception=True)
        if "min_price" in prices.validated_data:
            queryset = queryset.filter(price__gte=prices.validated_data["min_price"])
        if "max_price" in prices.validated_data:
            queryset = queryset.filter(price__lte=prices.validated_data["max_price"])

        ordering = self.request.query_params.get("ordering")
        if ordering not in ALLOWED_ORDERINGS:
            ordering = "-created_at"
        queryset = queryset.order_by(ordering, "-id" if ordering.startswith("-") else "id")
        if self.request.user.is_authenticated:
            membership = Wishlist.objects.filter(user=self.request.user, book_id=models.OuterRef("pk"))
            queryset = queryset.annotate(is_wishlisted=models.Exists(membership))
        else:
            queryset = queryset.annotate(is_wishlisted=models.Value(False, output_field=models.BooleanField()))

        return queryset


class BookDetailView(generics.RetrieveAPIView):
    """جزئیات یک کتاب"""

    serializer_class = BookDetailSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return visible_books(self.request.user)


class BookCreateView(generics.CreateAPIView):
    """ثبت کتاب جدید - هر کاربر لاگین شده‌ای می‌تواند"""

    serializer_class = BookCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "uploads"

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)


class MyBooksView(generics.ListAPIView):
    """لیست کتاب‌هایی که این کاربر برای فروش گذاشته"""

    serializer_class = BookListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Book.objects.filter(seller=self.request.user).select_related("seller", "category").order_by("-created_at", "-id")


class BookUpdateView(generics.UpdateAPIView):
    """ویرایش کتاب (فقط کسی که آن را ثبت کرده)"""

    serializer_class = BookCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "uploads"

    def get_queryset(self):
        # کتاب فروخته‌شده بخشی از سابقه سفارش خریدار است و نباید تغییر کند
        return Book.objects.filter(seller=self.request.user).exclude(status="sold")

    def update(self, request, *args, **kwargs):
        # ویرایش کتاب را به صف بررسی می‌برد و پرداخت سفارش باز خریدار شکست می‌خورد؛ پس اول باید آن سفارش لغو شود
        if self.get_object().orders.filter(status="pending").exists():
            return Response(
                {
                    "detail": "خریداری این کتاب را سفارش داده و پرداختش مانده است؛ "
                    "اگر لازم است تغییرش بدهی، اول سفارش را از «معاملات من» لغو کن."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # هر ویرایش دوباره به تأیید مدیر نیاز دارد
        serializer.save(status="pending")


class BookDeleteView(generics.DestroyAPIView):
    """حذف کتاب (فقط کسی که آن را ثبت کرده)"""

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # حذف کتاب فروخته‌شده، سفارش و تراکنش خریدار را هم (CASCADE) پاک می‌کرد
        return Book.objects.filter(seller=self.request.user).exclude(status="sold")


class WishlistView(generics.ListAPIView):
    """لیست علاقه‌مندی‌ها"""

    serializer_class = WishlistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Wishlist.objects.filter(
            user=self.request.user, book__in=visible_books(self.request.user)
        ).select_related("book__seller", "book__category").order_by("-added_at", "-id")


class WishlistToggleView(APIView):
    """افزودن/حذف از علاقه‌مندی‌ها"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, book_id):
        try:
            book = visible_books(request.user).get(pk=book_id)
        except Book.DoesNotExist:
            return Response(
                {"detail": "کتاب یافت نشد."}, status=status.HTTP_404_NOT_FOUND
            )

        wishlist_item, created = Wishlist.objects.get_or_create(
            user=request.user, book=book
        )

        if not created:
            wishlist_item.delete()
            return Response(
                {"message": "از علاقه‌مندی‌ها حذف شد.", "wishlisted": False}
            )

        return Response({"message": "به علاقه‌مندی‌ها اضافه شد.", "wishlisted": True})
