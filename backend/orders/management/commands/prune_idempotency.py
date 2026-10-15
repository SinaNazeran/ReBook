from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from orders.models import IdempotencyRecord


class Command(BaseCommand):
    help = "Delete one bounded batch of expired idempotency receipts."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=1000)

    def handle(self, *args, **options):
        limit = options["limit"]
        if not 1 <= limit <= 5000:
            raise CommandError("--limit must be between 1 and 5000")
        with transaction.atomic():
            ids = list(IdempotencyRecord.objects.filter(expires_at__lte=timezone.now())
                       .order_by("id").values_list("id", flat=True)[:limit])
            deleted, _ = IdempotencyRecord.objects.filter(pk__in=ids).delete()
        if options["verbosity"]:
            self.stdout.write(f"Deleted {deleted} expired receipts.")
