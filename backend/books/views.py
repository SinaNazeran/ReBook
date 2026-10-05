from django.db import models
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, Category, Wishlist
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


class CategoryListView(generics.ListAPIView):
    """لیست دسته‌بندی‌ها"""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    # فهرست کوتاه و ثابتی است که فیلتر و فرم ثبت کتاب کاملش را لازم دارند؛
    # با صفحه‌بندی پیش‌فرض (۱۲ مورد) دسته‌بندی‌های آخر هرگز در فهرست کشویی نمی‌آمدند
    pagination_class = None


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
            # ponytail: فقط یک سطح زیردسته؛ اگر درخت عمیق‌تر شد، شناسهٔ همهٔ نوادگان را جمع کنید
            queryset = queryset.filter(
                models.Q(category__slug=category) | models.Q(category__parent__slug=category)
            )

        condition = self.request.query_params.get("condition", None)
        if condition:
            queryset = queryset.filter(condition=condition)

        # مقدار غیرعددی نادیده گرفته می‌شود (isdecimal ارقام فارسی را هم می‌پذیرد)
        min_price = self.request.query_params.get("min_price", "")
        max_price = self.request.query_params.get("max_price", "")
        if min_price.isdecimal():
            queryset = queryset.filter(price__gte=int(min_price))
        if max_price.isdecimal():
            queryset = queryset.filter(price__lte=int(max_price))

        ordering = self.request.query_params.get("ordering")
        if ordering not in ALLOWED_ORDERINGS:
            ordering = "-created_at"
        queryset = queryset.order_by(ordering)

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

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)


class MyBooksView(generics.ListAPIView):
    """لیست کتاب‌هایی که این کاربر برای فروش گذاشته"""

    serializer_class = BookListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # فهرست شخصی و کوچک؛ صفحه‌ی MyBooks همه را یکجا نشان می‌دهد

    def get_queryset(self):
        return Book.objects.filter(seller=self.request.user).select_related("seller", "category")


class BookUpdateView(generics.UpdateAPIView):
    """ویرایش کتاب (فقط کسی که آن را ثبت کرده)"""

    serializer_class = BookCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # کتاب فروخته‌شده بخشی از سابقه سفارش خریدار است و نباید تغییر کند
        return Book.objects.filter(seller=self.request.user).exclude(status="sold")

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
    # فهرست شخصی؛ صفحه‌ی Wishlist و قلب‌های BookList هر دو به فهرست کامل نیاز دارند
    pagination_class = None

    def get_queryset(self):
        return Wishlist.objects.filter(
            user=self.request.user, book__in=visible_books(self.request.user)
        ).select_related("book__seller", "book__category")


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
