from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.throttling import RedisRateThrottle
from orders.cart import merge_session_cart

from .models import User
from .serializers import (
    LoginRequestSerializer,
    UserListSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)


# DRF فقط برای کاربر لاگین‌شده CSRF را بررسی می‌کند؛ بدون این، سایت دیگری می‌تواند
# مرورگر قربانی را با حساب مهاجم لاگین کند (login CSRF)
@method_decorator(csrf_protect, name="dispatch")
class RegisterView(generics.CreateAPIView):
    """ثبت‌نام کاربر جدید"""

    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RedisRateThrottle]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # لاگین خودکار کاربر پس از ثبت‌نام (ایجاد session)
        login(request, user)
        # سبد مهمان (در همین session) به حساب منتقل می‌شود
        merge_session_cart(request)

        # context لازم است تا آدرس avatar کامل (با دامنه بک‌اند) برگردد
        profile_serializer = UserProfileSerializer(user, context={"request": request})
        return Response(
            {
                "message": "ثبت‌نام با موفقیت انجام شد.",
                "user": profile_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """ورود کاربر"""

    permission_classes = [permissions.AllowAny]
    # جلوگیری از حدس زدن رمز عبور (brute force)
    throttle_classes = [RedisRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        credentials = LoginRequestSerializer(data=request.data)
        credentials.is_valid(raise_exception=True)
        username = credentials.validated_data["username"]
        password = credentials.validated_data["password"]

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            # سبد مهمان (در همین session) به حساب منتقل می‌شود
            merge_session_cart(request)
            serializer = UserProfileSerializer(user, context={"request": request})
            return Response({"message": "ورود موفقیت‌آمیز", "user": serializer.data})
        else:
            return Response(
                {"detail": "نام کاربری یا رمز عبور اشتباه است."},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    """خروج کاربر"""

    def post(self, request):
        logout(request)
        return Response({"message": "خروج موفقیت‌آمیز"})


class ProfileView(generics.RetrieveUpdateAPIView):
    """مشاهده و ویرایش پروفایل"""

    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "uploads"

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    """لیست کاربران (فقط ادمین)"""

    queryset = User.objects.all()
    serializer_class = UserListSerializer
    permission_classes = [permissions.IsAdminUser]


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFTokenView(APIView):
    """
    تنظیم کوکی csrftoken در مرورگر.
    فرانت‌اند باید این endpoint را یک‌بار (مثلاً هنگام بارگذاری اولیه‌ی برنامه)
    فراخوانی کند تا کوکی csrftoken در دسترس قرار بگیرد.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})
