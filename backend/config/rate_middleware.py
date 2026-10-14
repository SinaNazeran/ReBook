from django.http import JsonResponse

from config.client_ip import client_ip
from config.rate_store import RateLimitUnavailable, consume


class AdminLoginRateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and request.path_info.rstrip("/") == "/admin/login":
            try:
                wait = consume("auth", f"ip:{client_ip(request)}")
            except RateLimitUnavailable:
                return JsonResponse({"detail": "سرویس موقتاً در دسترس نیست."}, status=503)
            if wait:
                response = JsonResponse({"detail": "درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کن."}, status=429)
                response["Retry-After"] = str(wait)
                return response
        return self.get_response(request)
