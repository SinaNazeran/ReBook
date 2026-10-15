from django.db import models
from django.utils import timezone


class FileDeletion(models.Model):
    kind = models.CharField(max_length=10, choices=[("avatar", "avatar"), ("cover", "cover")])
    name = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.CharField(max_length=100, blank=True)
    older_than = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["kind", "name"], name="unique_file_deletion")]
