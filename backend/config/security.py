from ipaddress import ip_network
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured
from django.utils.csp import CSP


def origins(value, debug):
    result = []
    for origin in value.split(","):
        origin = origin.strip()
        if not origin:
            continue
        parsed = urlsplit(origin)
        if (parsed.scheme not in (("http", "https") if debug else ("https",))
                or not parsed.hostname or "*" in origin or parsed.username or parsed.password
                or parsed.path or parsed.query or parsed.fragment):
            raise ImproperlyConfigured("Origin allowlists must contain explicit scheme://host[:port] origins.")
        try:
            _ = parsed.port
        except ValueError as exc:
            raise ImproperlyConfigured("Invalid origin port.") from exc
        result.append(origin)
    return list(dict.fromkeys(result))


def security_settings(env, debug):
    local = "http://localhost:5173,http://127.0.0.1:5173" if debug else ""
    cors = origins(env.get("DJANGO_CORS_ALLOWED_ORIGINS", local), debug)
    if not debug and not cors:
        raise ImproperlyConfigured("DJANGO_CORS_ALLOWED_ORIGINS is required in production.")
    csrf = origins(env.get("DJANGO_CSRF_TRUSTED_ORIGINS", ",".join(cors)), debug)
    peers = [value.strip() for value in env.get("DJANGO_HTTPS_TRUSTED_PROXIES", "").split(",") if value.strip()]
    try:
        for network in peers:
            ip_network(network)
        hsts = int(env.get("DJANGO_HSTS_SECONDS", "0" if debug else "300"))
        if hsts < 0:
            raise ValueError()
    except ValueError as exc:
        raise ImproperlyConfigured("Invalid HTTPS proxy CIDR or HSTS duration.") from exc
    policy = {
        "default-src": [CSP.SELF], "script-src": [CSP.SELF],
        # پنل مدیریت و رابط React برای styleهای درون‌خطی به این مجوز نیاز دارند.
        "style-src": [CSP.SELF, CSP.UNSAFE_INLINE],
        "img-src": [CSP.SELF, "data:"], "font-src": [CSP.SELF],
        "connect-src": [CSP.SELF], "object-src": [CSP.NONE],
        "base-uri": [CSP.SELF], "frame-ancestors": [CSP.NONE], "form-action": [CSP.SELF],
    }
    return {
        "CORS_ALLOWED_ORIGINS": cors, "CSRF_TRUSTED_ORIGINS": csrf,
        "CORS_ALLOW_CREDENTIALS": True, "CORS_ALLOW_ALL_ORIGINS": False,
        "SESSION_COOKIE_SECURE": not debug or env.get("DJANGO_SECURE_COOKIES") == "1",
        "CSRF_COOKIE_SECURE": not debug or env.get("DJANGO_SECURE_COOKIES") == "1",
        "SECURE_SSL_REDIRECT": not debug, "SECURE_HSTS_SECONDS": hsts,
        "SECURE_HSTS_INCLUDE_SUBDOMAINS": False, "SECURE_HSTS_PRELOAD": False,
        "HTTPS_TRUSTED_PROXIES": peers,
        "SECURE_PROXY_SSL_HEADER": ("HTTP_X_FORWARDED_PROTO", "https"),
        "SECURE_CONTENT_TYPE_NOSNIFF": True, "X_FRAME_OPTIONS": "DENY",
        "SECURE_REFERRER_POLICY": "same-origin",
        "SECURE_CSP": policy if not debug else {
            "object-src": [CSP.NONE], "frame-ancestors": [CSP.NONE], "base-uri": [CSP.SELF],
        },
    }
