from django.apps import AppConfig
from django.db.models.signals import pre_delete


class UploadsConfig(AppConfig):
    name = "uploads"

    def ready(self):
        from uploads.lifecycle import deleting_file

        for label in ("accounts.User", "books.Book"):
            pre_delete.connect(deleting_file, sender=label, dispatch_uid=f"uploads.delete.{label}")
