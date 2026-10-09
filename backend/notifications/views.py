from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Notification, SupportTicket
from .serializers import (
    ContactMessageSerializer,
    NotificationSerializer,
    SupportTicketSerializer,
)


class NotificationListView(generics.ListAPIView):
    """لیست اعلان‌های کاربر"""

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    # ponytail: کل فهرست یکجا؛ اگر کاربری صدها اعلان جمع کرد، صفحه‌بندی و «نمایش بیشتر» اضافه شود
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class UnreadNotificationCountView(APIView):
    """تعداد اعلان‌های خوانده‌نشده برای نشان نوار بالا (به‌جای دریافت کل فهرست در هر بار)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"count": count})


class MarkNotificationReadView(APIView):
    """علامت‌گذاری اعلان به عنوان خوانده شده"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({"message": "اعلان خوانده شد."})
        except Notification.DoesNotExist:
            return Response({"detail": "اعلان یافت نشد."}, status=404)


class MarkAllNotificationsReadView(APIView):
    """خواندن همه اعلان‌ها"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True
        )
        return Response({"message": "همه اعلان‌ها خوانده شدند."})


class SupportTicketCreateView(generics.CreateAPIView):
    """ارسال تیکت پشتیبانی"""

    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]


class MySupportTicketsView(generics.ListAPIView):
    """لیست تیکت‌های کاربر"""

    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # فهرست شخصی و کوچک

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)


# مهمان هم می‌فرستد و DRF برای مهمان CSRF را بررسی نمی‌کند؛ مثل LoginView صریح محافظت می‌شود
@method_decorator(csrf_protect, name="dispatch")
class ContactMessageCreateView(generics.CreateAPIView):
    """فرم «تماس با ما» برای مهمان؛ پیام در پنل مدیریت خوانده می‌شود"""

    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]
    # ponytail: فقط CSRF و محدودیت نرخ جلوی هرزنامه را می‌گیرد؛ اگر پیام بی‌ربط زیاد شد، فیلد تله (honeypot) اضافه شود
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"
