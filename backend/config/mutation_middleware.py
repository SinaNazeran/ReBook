from django.db import OperationalError, transaction
from django.http import JsonResponse


def is_contention(exc):
    code = getattr(exc.__cause__, "sqlite_errorcode", None)
    return (code is not None and (code & 255) in (5, 6)) or str(exc) in (
        "database is locked", "database table is locked", "database table is locked: django_session",
    )


class MutationTransactionMiddleware:
    """SQLite IMMEDIATE begins before lazy session reads and ends after session saving.

    The database serializes writers across processes. Never replace this with
    a Python lock or SQLite's ineffective select_for_update(). Reads stay outside.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ("GET", "HEAD", "OPTIONS") or not request.path_info.startswith("/api/"):
            return self.get_response(request)
        try:
            with transaction.atomic():
                response = self.get_response(request)
                if response.status_code >= 400:
                    transaction.set_rollback(True)
                return response
        except OperationalError as exc:
            if not is_contention(exc):
                raise
            response = JsonResponse({"detail": "عملیات دیگری در جریان است؛ کمی بعد دوباره تلاش کن."}, status=409)
            response["Retry-After"] = "1"
            return response
