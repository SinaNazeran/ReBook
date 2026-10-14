from ipaddress import ip_address, ip_network

from django.conf import settings


def client_ip(request):
    """XFF فقط از پراکسی‌های تعریف‌شده و با تعداد مشخص واسطه پذیرفته می‌شود."""
    peer = request.META.get("REMOTE_ADDR", "")
    try:
        address = ip_address(peer)
    except ValueError:
        return "unknown"
    count = settings.RATE_LIMIT_PROXY_COUNT
    trusted = any(address in ip_network(network) for network in settings.RATE_LIMIT_TRUSTED_PROXIES)
    if count > 0 and trusted:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")
        if len(forwarded) >= count:
            try:
                return str(ip_address(forwarded[-count].strip()))
            except ValueError:
                pass
    return str(address)
