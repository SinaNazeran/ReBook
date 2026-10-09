from django.contrib import admin

from .models import ContactMessage, Notification, SupportTicket


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "notification_type", "is_read", "created_at")
    list_filter = ("notification_type", "is_read")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "user", "status", "created_at")
    list_filter = ("status",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "name", "email", "is_handled", "created_at")
    list_filter = ("is_handled",)
    list_editable = ("is_handled",)
    search_fields = ("email", "subject")
