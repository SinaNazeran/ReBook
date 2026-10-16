from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from config.monitoring import ClientErrorsView, health

urlpatterns = [
    path("api/health", health, name="health"),
    path("api/client-errors/", ClientErrorsView.as_view(), name="client-errors"),
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/books/", include("books.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/notifications/", include("notifications.urls")),
]

# در حالت توسعه، فایل‌های مدیا و استاتیک سرو شوند
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
