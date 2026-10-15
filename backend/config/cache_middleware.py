from django.utils.http import http_date


class APICachePolicyMiddleware:
    """Explicit storage policy, including redirects, errors, and contention."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path_info.startswith("/api/"):
            ttl = getattr(response, "category_cache_ttl", None)
            if (ttl is not None and response.status_code == 200
                    and request.method in ("GET", "HEAD") and not request.COOKIES
                    and not response.cookies):
                response["Cache-Control"] = f"public, max-age={ttl}, must-revalidate"
                response["Date"] = http_date()
            else:
                response["Cache-Control"] = "private, no-store"
        return response
