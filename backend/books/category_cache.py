import time

from django.core.cache import caches
from rest_framework.response import Response
from rest_framework.utils.urls import replace_query_param


class CachedCategoryPagesMixin:
    """Cache only public category data; rebuild links for the current request."""

    def list(self, request, *args, **kwargs):
        # Unknown parameters and legacy "last" pages retain ordinary DRF behavior.
        try:
            page = int(request.query_params.get("page", "1"))
        except ValueError:
            return super().list(request, *args, **kwargs)
        if page < 1 or set(request.query_params) - {"page", "page_size"}:
            return super().list(request, *args, **kwargs)
        size = self.paginator.get_page_size(request)
        store = caches["categories"]
        key = f"category-page:v1:{page}:{size}"
        entry = store.get(key)
        now = time.time()
        if entry is None or entry["expires"] <= now:
            response = super().list(request, *args, **kwargs)
            entry = {"expires": now + 60, "count": response.data["count"],
                     "results": response.data["results"], "next": bool(response.data["next"]),
                     "previous": bool(response.data["previous"])}
            store.set(key, entry, timeout=60)
        url = request.build_absolute_uri()
        response = Response({
            "count": entry["count"],
            "next": replace_query_param(url, "page", page + 1) if entry["next"] else None,
            "previous": replace_query_param(url, "page", page - 1) if entry["previous"] else None,
            "results": entry["results"],
        })
        if not request.user.is_authenticated and request.accepted_renderer.format == "json":
            response.category_cache_ttl = max(0, int(entry["expires"] - now))
        return response
