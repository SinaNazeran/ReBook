from django.db import OperationalError
from django.http import Http404
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from config.mutation_middleware import is_contention


def exception_handler(exc, context):
    """پیام 404 فارسی برای همهٔ ویوها

    get_object_or_404 در ویوهای generic پیام انگلیسی و ترجمه‌نشدهٔ جنگو را می‌فرستد
    ("No Book matches the given query.")؛ جایش NotFound پیش‌فرض DRF می‌نشیند
    که با LANGUAGE_CODE = "fa-ir" ترجمه می‌شود. NotFoundهایی که خود ویوها
    با پیام فارسی می‌سازند دست نمی‌خورند.
    """
    if isinstance(exc, OperationalError) and is_contention(exc):
        response = Response({"detail": "عملیات دیگری در جریان است؛ کمی بعد دوباره تلاش کن."}, status=409)
        response["Retry-After"] = "1"
        return response
    if isinstance(exc, Http404):
        exc = NotFound()
    return drf_exception_handler(exc, context)
