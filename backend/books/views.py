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


class CategoryListView(generics.ListAPIView):
    """لیست دسته‌بندی‌ها"""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class BookListView(generics.ListAPIView):
    """لیست کتاب‌ها با امکان جستجو و فیلتر"""

    serializer_class = BookListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Book.objects.filter(status="approved")

        search = self.request.query_params.get("search", None)
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) | models.Q(author__icontains=search)
            )

        category = self.request.query_params.get("category", None)
        if category:
            queryset = queryset.filter(category__slug=category)

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
        # کتاب تأییدنشده فقط برای فروشنده‌اش قابل مشاهده است
        visible = models.Q(status__in=["approved", "sold"])
        if self.request.user.is_authenticated:
            visible |= models.Q(seller=self.request.user)
        return Book.objects.filter(visible)


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

    def get_queryset(self):
        return Book.objects.filter(seller=self.request.user)


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

    def get_queryset(self):
        return Wishlist.objects.filter(user=self.request.user)


class WishlistToggleView(APIView):
    """افزودن/حذف از علاقه‌مندی‌ها"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, book_id):
        try:
            book = Book.objects.get(pk=book_id)
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
