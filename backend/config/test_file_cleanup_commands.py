from datetime import timedelta
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils import timezone

from config.test_file_lifecycle import FileFixture, image


class FileCleanupCommandTests(FileFixture):
    def test_apply_continuation_does_not_skip_the_files_left_after_deletion(self):
        import os

        stamp = (timezone.now() - timedelta(days=2)).timestamp()
        names = [self.storage.save(f"book_covers/orphan-{i}.webp", ContentFile(b"old")) for i in range(6)]
        for name in names:
            os.utime(self.storage.path(name), (stamp, stamp))
        output = StringIO()
        call_command("sweep_orphan_uploads", prefix="book_covers", limit=4, apply=True, stdout=output)
        offset = int(output.getvalue().split("next-offset=")[-1].split()[0])
        call_command("sweep_orphan_uploads", prefix="book_covers", limit=4, offset=offset,
                     apply=True, stdout=StringIO())
        self.assertFalse(any(self.storage.exists(name) for name in names))

    def test_failed_deletion_is_durable_and_retries_only_when_due(self):
        from uploads.models import FileDeletion

        old = self.user.avatar.name
        with patch.object(self.storage, "delete", side_effect=OSError("private provider detail")):
            self.user.avatar = image("retry.png")
            self.user.save()
        job = FileDeletion.objects.get(name=old)
        self.assertEqual(job.attempts, 1)
        self.assertEqual(job.last_error, "OSError")
        call_command("retry_file_deletions", stdout=StringIO())
        self.assertTrue(self.storage.exists(old))
        FileDeletion.objects.update(next_attempt_at=timezone.now() - timedelta(seconds=1))
        call_command("retry_file_deletions", stdout=StringIO())
        self.assertFalse(self.storage.exists(old))
        self.assertFalse(FileDeletion.objects.exists())

    def test_retry_batch_is_bounded_and_shared_or_unsafe_files_survive(self):
        from uploads.models import FileDeletion

        orphan = self.storage.save("avatars/orphan.webp", ContentFile(b"old"))
        other = self.storage.save("avatars/other.webp", ContentFile(b"old"))
        FileDeletion.objects.bulk_create([
            FileDeletion(kind="avatar", name=orphan), FileDeletion(kind="avatar", name=other),
        ])
        call_command("retry_file_deletions", limit=1, stdout=StringIO())
        self.assertEqual(FileDeletion.objects.count(), 1)
        self.assertFalse(self.storage.exists(orphan))
        self.assertTrue(self.storage.exists(other))
        FileDeletion.objects.create(kind="avatar", name=self.user.avatar.name)
        outside = Path(self.directory.name).parent / (Path(self.directory.name).name + "-outside")
        outside.write_bytes(b"keep")
        self.addCleanup(outside.unlink, missing_ok=True)
        FileDeletion.objects.create(kind="avatar", name="../" + outside.name)
        call_command("retry_file_deletions", stdout=StringIO())
        self.assertTrue(self.storage.exists(self.user.avatar.name))
        self.assertTrue(outside.exists())

    def test_missing_file_retry_is_idempotent(self):
        from uploads.models import FileDeletion

        FileDeletion.objects.create(kind="avatar", name="avatars/missing.webp")
        call_command("retry_file_deletions", stdout=StringIO())
        self.assertFalse(FileDeletion.objects.exists())

    def test_retry_failure_is_reported_and_recent_sweep_candidates_are_rechecked(self):
        from uploads.models import FileDeletion

        name = self.storage.save("avatars/retry.webp", ContentFile(b"old"))
        FileDeletion.objects.create(kind="avatar", name=name)
        with (patch.object(self.storage, "delete", side_effect=OSError("provider detail")),
              self.assertRaises(CommandError)):
            call_command("retry_file_deletions", stdout=StringIO())
        self.assertTrue(self.storage.exists(name))
        self.assertEqual(FileDeletion.objects.get(name=name).attempts, 1)
        FileDeletion.objects.create(kind="avatar", name="avatars/fresh.webp",
                                    older_than=timezone.now() - timedelta(days=1))
        fresh = self.storage.save("avatars/fresh.webp", ContentFile(b"fresh"))
        call_command("retry_file_deletions", stdout=StringIO())
        self.assertTrue(self.storage.exists(fresh))

    def test_commands_reject_unbounded_or_unsafe_options(self):
        for command, options in (
            ("retry_file_deletions", {"limit": 5001}),
            ("sweep_orphan_uploads", {"limit": 0}),
            ("sweep_orphan_uploads", {"offset": -1}),
            ("sweep_orphan_uploads", {"grace_hours": 0}),
        ):
            with self.subTest(command=command, options=options), self.assertRaises(CommandError):
                call_command(command, stdout=StringIO(), **options)

    def test_sweep_rejects_remote_listing_and_cleanup_supports_storage_without_paths(self):
        from uploads.models import FileDeletion

        with override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}):
            with self.assertRaises(CommandError):
                call_command("sweep_orphan_uploads", stdout=StringIO())
            name = self.storage.save("avatars/remote.webp", ContentFile(b"old"))
            FileDeletion.objects.create(kind="avatar", name=name)
            call_command("retry_file_deletions", stdout=StringIO())
            self.assertFalse(self.storage.exists(name))

    def test_symlink_guard_preserves_files_instead_of_following_a_link(self):
        from uploads.models import FileDeletion

        name = self.storage.save("avatars/guard.webp", ContentFile(b"keep"))
        FileDeletion.objects.create(kind="avatar", name=name)
        with patch("uploads.storage.Path.is_symlink", return_value=True):
            call_command("retry_file_deletions", stdout=StringIO())
        self.assertTrue(self.storage.exists(name))

    def test_sweep_defaults_to_dry_run_and_respects_grace_and_live_references(self):
        import os

        old = self.storage.save("avatars/old.webp", ContentFile(b"orphan"))
        fresh = self.storage.save("avatars/fresh.webp", ContentFile(b"fresh"))
        stamp = (timezone.now() - timedelta(days=2)).timestamp()
        for name in (old, self.user.avatar.name):
            os.utime(self.storage.path(name), (stamp, stamp))
        output = StringIO()
        call_command("sweep_orphan_uploads", prefix="avatars", stdout=output)
        self.assertIn(old, output.getvalue())
        self.assertTrue(self.storage.exists(old))
        call_command("sweep_orphan_uploads", prefix="avatars", apply=True, stdout=StringIO())
        self.assertFalse(self.storage.exists(old))
        self.assertTrue(self.storage.exists(fresh))
        self.assertTrue(self.storage.exists(self.user.avatar.name))

    def test_sweep_never_follows_subdirectories_and_can_resume_a_bounded_scan(self):
        nested = Path(self.storage.path("avatars/nested"))
        nested.mkdir()
        keep = nested / "unmanaged.txt"
        keep.write_text("keep")
        output = StringIO()
        call_command("sweep_orphan_uploads", prefix="avatars", limit=1, stdout=output)
        self.assertIn("next-offset=1", output.getvalue())
        call_command("sweep_orphan_uploads", prefix="avatars", offset=1, apply=True, stdout=StringIO())
        self.assertTrue(keep.exists())

    def test_rollback_leaves_no_cleanup_job_and_its_orphan_can_be_swept_later(self):
        import os

        from django.db import transaction

        from uploads.models import FileDeletion

        old = self.user.avatar.name
        with self.assertRaises(RuntimeError), transaction.atomic():
            self.user.avatar = image("rollback.png")
            self.user.save()
            orphan = self.user.avatar.name
            raise RuntimeError("rollback")
        self.assertFalse(FileDeletion.objects.exists())
        stamp = (timezone.now() - timedelta(days=2)).timestamp()
        os.utime(self.storage.path(orphan), (stamp, stamp))
        call_command("sweep_orphan_uploads", prefix="avatars", apply=True, stdout=StringIO())
        self.assertFalse(self.storage.exists(orphan))
        self.assertTrue(self.storage.exists(old))
