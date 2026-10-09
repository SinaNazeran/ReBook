from rest_framework import serializers

from .models import ContactMessage, Notification, SupportTicket


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "title",
            "message",
            "notification_type",
            "is_read",
            "created_at",
        )
        read_only_fields = ("id", "title", "message", "notification_type", "created_at")


class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ("id", "subject", "message", "status", "admin_reply", "created_at")
        read_only_fields = ("id", "status", "admin_reply", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class ContactMessageSerializer(serializers.ModelSerializer):
    # CharField فاصله‌های دو سر را می‌برد، پس پیام تمام‌فاصله خالی حساب می‌شود
    message = serializers.CharField(min_length=10, max_length=5000)

    class Meta:
        model = ContactMessage
        fields = ("name", "email", "subject", "message")
