from ipaddress import ip_address, ip_network

from django.conf import settings


class TrustedProxyHTTPSMiddleware:
    """هدر پروتکل پیش از SecurityMiddleware و CSRF فقط از پراکسی معتبر پذیرفته می‌شود."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            peer = ip_address(request.META.get("REMOTE_ADDR", ""))
            trusted = any(peer in ip_network(network) for network in settings.HTTPS_TRUSTED_PROXIES)
        except ValueError:
            trusted = False
        protocol = request.META.get("HTTP_X_FORWARDED_PROTO", "")
        if not trusted or protocol not in ("http", "https"):
            request.META.pop("HTTP_X_FORWARDED_PROTO", None)
        return self.get_response(request)
