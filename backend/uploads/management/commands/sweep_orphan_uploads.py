import os
from datetime import timedelta
from itertools import islice

from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from uploads.cleanup import enqueue
from uploads.storage import PREFIXES, field_for, referenced, safe_storage_path


class Command(BaseCommand):
    help = "Inspect a bounded slice of local uploads; dry-run unless --apply is supplied."
    requires_migrations_checks = True

    def add_arguments(self, parser):
        parser.add_argument("--prefix", choices=PREFIXES, default="avatars")
        parser.add_argument("--limit", type=int, default=500)
        parser.add_argument("--offset", type=int, default=0)
        parser.add_argument("--grace-hours", type=int, default=24)
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 5000 or not 0 <= options["offset"] <= 10000000:
            raise CommandError("--limit must be 1..5000 and --offset 0..10000000")
        if not 1 <= options["grace_hours"] <= 8760:
            raise CommandError("--grace-hours must be between 1 and 8760")
        prefix = options["prefix"]
        kind = "avatar" if prefix == "avatars" else "cover"
        storage = field_for(kind).storage
        if not isinstance(storage, FileSystemStorage):
            raise CommandError("Orphan scanning requires local FileSystemStorage; remote storage needs a listing adapter.")
        if not safe_storage_path(storage, f"{prefix}/probe"):
            raise CommandError("Upload directory must be a real directory inside the configured storage root.")
        cutoff = timezone.now() - timedelta(hours=options["grace_hours"])
        scanned = errors = removed = 0
        candidates = []
        try:
            entries = os.scandir(storage.path(prefix))
        except FileNotFoundError:
            self.stdout.write("scanned=0 candidates=0 next-offset=0 done")
            return
        with entries:
            for entry in islice(entries, options["offset"], options["offset"] + options["limit"]):
                scanned += 1
                if not entry.is_file(follow_symlinks=False):
                    continue
                name = f"{prefix}/{entry.name}"
                try:
                    if (not safe_storage_path(storage, name) or storage.get_modified_time(name) > cutoff
                            or referenced(name, "default")):
                        continue
                    candidates.append(name)
                    self.stdout.write(f"{'QUEUE' if options['apply'] else 'WOULD DELETE'} {name}")
                except FileNotFoundError:
                    continue
                except (OSError, ValueError) as exc:
                    errors += 1
                    self.stderr.write(f"Inspection failed: {type(exc).__name__}")
        # Finish the bounded scan before deleting. Restart after removals rather
        # than skipping entries whose directory positions just changed.
        if options["apply"]:
            for name in candidates:
                with transaction.atomic():
                    enqueue(kind, name, older_than=cutoff)
                if not storage.exists(name):
                    removed += 1
        next_offset = 0 if removed else options["offset"] + scanned
        done = " done" if not removed and scanned < options["limit"] else ""
        self.stdout.write(f"scanned={scanned} candidates={len(candidates)} next-offset={next_offset}{done}")
        if errors:
            raise CommandError(f"{errors} files could not be inspected; no unsafe deletion was attempted.")
