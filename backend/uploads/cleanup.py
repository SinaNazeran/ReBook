from datetime import timedelta
from functools import partial

from django.db import transaction
from django.utils import timezone

from uploads.models import FileDeletion
from uploads.storage import field_for, managed_name, referenced, safe_storage_path


def enqueue(kind, name, using="default", older_than=None):
    if not name or not managed_name(name):
        return
    job, _ = FileDeletion.objects.using(using).get_or_create(
        kind=kind, name=name, defaults={"older_than": older_than},
    )
    transaction.on_commit(partial(process_deletion, job.pk, using), using=using, robust=True)


def process_deletion(pk, using="default"):
    # SQLite IMMEDIATE serializes the final reference check with managed saves.
    with transaction.atomic(using=using):
        job = FileDeletion.objects.using(using).select_for_update().filter(pk=pk).first()
        if job is None or job.next_attempt_at > timezone.now():
            return "deferred"
        storage = field_for(job.kind).storage
        if not safe_storage_path(storage, job.name) or referenced(job.name, using):
            job.delete(using=using)
            return "preserved"
        try:
            fresh = bool(job.older_than and storage.get_modified_time(job.name) > job.older_than)
            if not fresh:
                storage.delete(job.name)
        except FileNotFoundError:
            fresh = False  # already deleted is a successful idempotent retry
        except Exception as exc:  # noqa: BLE001 -- storage adapters have provider-specific errors; retain the job.
            job.attempts += 1
            job.last_error = type(exc).__name__[:100]
            job.next_attempt_at = timezone.now() + timedelta(seconds=min(86400, 60 * 2 ** min(job.attempts, 11)))
            job.save(using=using, update_fields=["attempts", "last_error", "next_attempt_at"])
            return "failed"
        job.delete(using=using)
        return "preserved" if fresh else "deleted"
