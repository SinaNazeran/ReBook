"""Allowlisted diagnostics: never serialize arbitrary messages, requests, or locals."""

import json
import logging
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from traceback import walk_tb
from uuid import UUID, uuid4

active_request = ContextVar("rebook_log_request", default=None)
BACKEND = Path(__file__).resolve().parent.parent
BROWSER_KINDS = ("render_error", "unhandled_error", "unhandled_rejection", "api_server_error")
PAGE_NAMES = ("home", "catalog", "book-detail", "book-edit", "login", "register", "cart", "about", "contact",
              "profile", "create-book", "my-books", "my-orders", "wishlist", "notifications", "support", "unknown")


def safe_browser_data(data):
    if not isinstance(data, dict) or data.get("kind") not in BROWSER_KINDS or data.get("page") not in PAGE_NAMES:
        return {}
    result = {"kind": data["kind"], "page": data["page"]}
    if isinstance(data.get("status"), int) and 500 <= data["status"] <= 599:
        result["status"] = data["status"]
    try:
        result["reported_request_id"] = str(UUID(str(data["reported_request_id"])))
    except (KeyError, ValueError, TypeError, AttributeError):
        pass
    return result


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.rebook_request_id = uuid4().hex
        token = active_request.set(request)
        try:
            response = self.get_response(request)
            response["X-Request-ID"] = request.rebook_request_id
            return response
        finally:
            active_request.reset(token)


class SafeJSONFormatter(logging.Formatter):
    def format(self, record):
        event = {
            "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": logging.getLevelName(record.levelno),
            "event": "browser_report" if hasattr(record, "browser_event") else "server_diagnostic",
            "source": "security" if record.name.startswith("django.security") else "django" if record.name.startswith("django.") else "application",
        }
        request = getattr(record, "request", None) or active_request.get()
        if getattr(request, "rebook_request_id", None):
            event["request_id"] = request.rebook_request_id
            event["route"] = getattr(getattr(request, "resolver_match", None), "route", None) or "unmatched"
            event["method"] = request.method if request.method in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} else "OTHER"
        status = getattr(record, "status_code", None)
        if isinstance(status, int) and 100 <= status <= 599:
            event["status"] = status
        if record.exc_info and record.exc_info[0]:
            event["exception"] = record.exc_info[0].__name__
            frames = []
            for frame, line in walk_tb(record.exc_info[2]):
                filename = Path(frame.f_code.co_filename).resolve()
                if filename.is_relative_to(BACKEND):
                    frames.append({"file": filename.relative_to(BACKEND).as_posix(),
                                   "function": frame.f_code.co_name, "line": line})
            event["frames"] = frames[-8:]
        # This attribute is constructed only by the validated collector, not from a log message.
        if hasattr(record, "browser_event"):
            event["browser"] = safe_browser_data(record.browser_event)
        return json.dumps(event, ensure_ascii=True, separators=(",", ":"))


LOGGING = {
    "version": 1, "disable_existing_loggers": False,
    "formatters": {"safe_json": {"()": "config.observability.SafeJSONFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "safe_json"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.server": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "rebook.monitoring": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
