import hashlib
import json
import re
from functools import wraps

from django.db import transaction
from django.utils import timezone
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from orders.models import IdempotencyRecord


def idempotent(method):
    """Only successful responses persist, in the same transaction as their effects.

    Legacy callers without a key keep their guarded, non-replaying behavior.
    Updated first-party clients send one key for every retriable intent.
    """
    @wraps(method)
    def wrapped(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if key is not None and not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            return Response({"detail": "کلید تکرار درخواست معتبر نیست."}, status=400)
        with transaction.atomic():
            if key:
                scope = {"user": request.user, "operation": request.path, "key": key}
                payload = json.dumps(request.data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
                fingerprint = hashlib.sha256(payload.encode()).hexdigest()
                record = IdempotencyRecord.objects.filter(**scope).first()
                if record and record.expires_at <= timezone.now():
                    record.delete()
                    record = None
                if record:
                    if record.fingerprint != fingerprint:
                        return Response({"detail": "این کلید پیش‌تر برای درخواست دیگری استفاده شده است."}, status=409)
                    response = Response(record.response_body, status=record.response_status)
                    response["Idempotency-Replayed"] = "true"
                    return response
            response = method(self, request, *args, **kwargs)
            if response.status_code >= 400:
                transaction.set_rollback(True)
            elif key:
                IdempotencyRecord.objects.create(
                    **scope, fingerprint=fingerprint, response_status=response.status_code,
                    response_body=json.loads(JSONRenderer().render(response.data)),
                )
            return response
    return wrapped
