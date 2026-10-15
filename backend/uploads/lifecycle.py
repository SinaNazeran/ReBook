from contextlib import contextmanager
from uuid import uuid4

from django.db import router, transaction

from uploads.cleanup import enqueue


def remember_file(instance, field):
    if field in instance.__dict__:
        value = instance.__dict__[field]
        instance._loaded_upload_name = getattr(value, "name", value)


@contextmanager
def file_save(instance, kind, field, using=None, update_fields=None):
    using = using or router.db_for_write(type(instance), instance=instance)
    with transaction.atomic(using=using):
        tracks_file = update_fields is None or field in update_fields
        old = None
        if tracks_file and instance.pk:
            old = type(instance)._base_manager.using(using).filter(pk=instance.pk).values_list(field, flat=True).first()
        value = getattr(instance, field)
        if (tracks_file and hasattr(instance, "_loaded_upload_name")
                and value._committed and value.name == instance._loaded_upload_name
                and old != instance._loaded_upload_name):
            # An unrelated save of a stale instance must not resurrect a pruned key.
            setattr(instance, field, old)
            value = getattr(instance, field)
        if tracks_file and value and not value._committed:
            value.name = f"{uuid4().hex}.webp"
        yield
        if tracks_file and old and old != getattr(instance, field).name:
            enqueue(kind, old, using)
        if tracks_file:
            remember_file(instance, field)


def deleting_file(sender, instance, using, **kwargs):
    kind, field = ("avatar", "avatar") if sender._meta.label_lower == "accounts.user" else ("cover", "cover_image")
    # Collector's transaction is active; read before deleting even if the caller
    # supplied a stale/deferred object. Its Python file attribute is not authority.
    name = sender._base_manager.using(using).filter(pk=instance.pk).values_list(field, flat=True).first()
    enqueue(kind, name, using)
