from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, SupportTicket
from .serializers import NotificationSerializer, SupportTicketSerializer


class NotificationListView(generics.ListAPIView):
    """لیست اعلان‌های کاربر"""

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


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

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)
