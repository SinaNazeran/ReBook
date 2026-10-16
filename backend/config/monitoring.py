import logging

from django.conf import settings
from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_safe
from redis.exceptions import RedisError
from rest_framework import permissions, serializers
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from config.observability import BROWSER_KINDS, PAGE_NAMES
from config.rate_store import redis_client
from config.throttling import RedisRateThrottle

logger = logging.getLogger("rebook.monitoring")


@require_safe
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            if cursor.fetchone()[0] != 1:
                raise RuntimeError()
        if settings.RATE_LIMIT_REDIS_URL:
            if not redis_client(settings.RATE_LIMIT_REDIS_URL).ping():
                raise RuntimeError()
        elif not settings.RATE_LIMIT_ALLOW_LOCAL:
            raise RuntimeError()
    except (DatabaseError, RedisError, OSError, RuntimeError, ValueError, IndexError):
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


class BrowserReport(serializers.Serializer):
    kind = serializers.ChoiceField(choices=BROWSER_KINDS)
    page = serializers.ChoiceField(choices=PAGE_NAMES)
    request_id = serializers.UUIDField(required=False)
    status = serializers.IntegerField(min_value=500, max_value=599, required=False)

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - self.fields.keys():
            raise serializers.ValidationError({"non_field_errors": ["قالب گزارش معتبر نیست."]})
        return super().to_internal_value(data)


@method_decorator(csrf_protect, name="dispatch")
class ClientErrorsView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RedisRateThrottle]
    throttle_scope = "client_errors"
    parser_classes = [JSONParser]
    http_method_names = ["post", "options"]

    def post(self, request):
        if len(request.body) > 2048:
            return Response({"detail": "گزارش بیش از حد بزرگ است."}, status=413)
        report = BrowserReport(data=request.data)
        report.is_valid(raise_exception=True)
        data = dict(report.validated_data)
        if "request_id" in data:
            data["reported_request_id"] = str(data.pop("request_id"))
        logger.warning("browser_report", extra={"browser_event": data})
        return Response(status=202)
