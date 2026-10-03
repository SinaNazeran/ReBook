from rest_framework.authentication import SessionAuthentication


class SessionAuthenticationWith401(SessionAuthentication):
    """
    SessionAuthentication پیش‌فرض هدر WWW-Authenticate ندارد، پس DRF برای کاربر
    لاگین‌نشده (یا session منقضی‌شده) 403 برمی‌گرداند. با این هدر پاسخ 401 می‌شود
    و رویداد auth:unauthorized در api.js اجرا می‌شود. دسترسی غیرمجاز کاربر لاگین‌شده
    و خطای CSRF همچنان 403 هستند.
    """

    def authenticate_header(self, request):
        return "Session"
