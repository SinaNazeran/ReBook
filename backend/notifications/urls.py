from django.urls import path

from . import views

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notification-list"),
    path(
        "unread-count/",
        views.UnreadNotificationCountView.as_view(),
        name="notification-unread-count",
    ),
    path(
        "<int:pk>/read/",
        views.MarkNotificationReadView.as_view(),
        name="notification-read",
    ),
    path(
        "read-all/",
        views.MarkAllNotificationsReadView.as_view(),
        name="notification-read-all",
    ),
    path(
        "support/create/",
        views.SupportTicketCreateView.as_view(),
        name="support-create",
    ),
    path("support/", views.MySupportTicketsView.as_view(), name="support-list"),
]
