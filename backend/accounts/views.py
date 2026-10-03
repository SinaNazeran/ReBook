from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import User
from .serializers import (
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # لاگین خودکار کاربر پس از ثبت‌نام (ایجاد session)
        login(request, user)

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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"detail": "نام کاربری و رمز عبور الزامی است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
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
