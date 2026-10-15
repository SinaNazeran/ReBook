from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from uploads.cleanup import process_deletion
from uploads.models import FileDeletion


class Command(BaseCommand):
    help = "Retry one bounded batch of due file deletions."
    requires_migrations_checks = True

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 5000:
            raise CommandError("--limit must be between 1 and 5000")
        ids = list(FileDeletion.objects.filter(next_attempt_at__lte=timezone.now())
                   .order_by("next_attempt_at", "id").values_list("id", flat=True)[:options["limit"]])
        counts = Counter(process_deletion(pk) for pk in ids)
        if options["verbosity"]:
            self.stdout.write(f"Processed {len(ids)} jobs: {dict(counts)}")
        if counts["failed"]:
            raise CommandError(f"{counts['failed']} storage deletions failed; jobs retained for retry.")
