from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import TransactionTestCase, override_settings
from PIL import Image

from accounts.models import User
from books.models import Book


def image(name="image.png", size=(10, 10)):
    data = BytesIO()
    Image.new("RGB", size, "red").save(data, format="PNG")
    return SimpleUploadedFile(name, data.getvalue(), content_type="image/png")


class FileFixture(TransactionTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="rebook-file-test-")
        self.addCleanup(self.directory.cleanup)
        self.settings = override_settings(MEDIA_ROOT=self.directory.name)
        self.settings.enable()
        self.addCleanup(self.settings.disable)
        self.user = User.objects.create(username="files", avatar=image())
        self.book = Book.objects.create(title="b", author="a", price=100,
                                        seller=self.user, cover_image=image())
        self.storage = self.book.cover_image.storage


class FileLifecycleTests(FileFixture):
    def test_stale_unrelated_save_preserves_the_current_file_and_dimensions(self):
        for instance, field, unrelated in ((self.book, "cover_image", "title"), (self.user, "avatar", "address")):
            stale = type(instance).objects.get(pk=instance.pk)
            setattr(instance, field, image("latest.png", size=(20, 30)))
            instance.save()
            latest = getattr(instance, field).name
            setattr(stale, unrelated, "changed unrelated field")
            stale.save()
            instance.refresh_from_db()
            self.assertEqual(getattr(instance, field).name, latest)
            self.assertTrue(self.storage.exists(latest))
            self.assertEqual(getattr(instance, unrelated), "changed unrelated field")
            if field == "cover_image":
                self.assertEqual((instance.cover_width, instance.cover_height), (20, 30))

    def test_deferred_loading_and_refresh_keep_the_file_snapshot_current(self):
        for fields in (None, ["avatar"]):
            stale = User.objects.only("id", "address").get(pk=self.user.pk)
            self.assertEqual(stale.avatar.name, self.user.avatar.name)
            stale.refresh_from_db(fields=fields)
            self.user.avatar = image("latest.png")
            self.user.save()
            latest = self.user.avatar.name
            stale.address = "changed"
            stale.save()
            self.user.refresh_from_db()
            self.assertEqual(self.user.avatar.name, latest)
            self.assertTrue(self.storage.exists(latest))

    def test_deleting_stale_or_deferred_instances_cleans_the_actual_database_file(self):
        for model, field in ((Book, "cover_image"), (User, "avatar")):
            for deferred in (False, True):
                data = ({"title": "delete", "author": "a", "price": 100, "seller": self.user}
                        if model is Book else {"username": f"delete-user-{deferred}"})
                instance = model.objects.create(**data, **{field: image("initial.png")})
                stale = model.objects.only("id").get(pk=instance.pk) if deferred else (
                    model.objects.get(pk=instance.pk)
                )
                setattr(instance, field, image("current.png"))
                instance.save()
                latest = getattr(instance, field).name
                stale.delete()
                self.assertFalse(self.storage.exists(latest))

    def test_replacements_delete_old_files_only_after_commit(self):
        for instance, field in ((self.book, "cover_image"), (self.user, "avatar")):
            old = getattr(instance, field).name
            with transaction.atomic():
                setattr(instance, field, image("replacement.png"))
                instance.save()
                self.assertTrue(self.storage.exists(old))
                current = getattr(instance, field).name
                self.assertTrue(self.storage.exists(current))
            self.assertFalse(self.storage.exists(old))
            self.assertTrue(self.storage.exists(current))

    def test_model_and_queryset_cascade_deletion_remove_files(self):
        cover = self.book.cover_image.name
        self.book.delete()
        self.assertFalse(self.storage.exists(cover))
        nested = Book.objects.create(title="cascade", author="a", price=100,
                                     seller=self.user, cover_image=image())
        cover, avatar = nested.cover_image.name, self.user.avatar.name
        User.objects.filter(pk=self.user.pk).delete()
        self.assertFalse(self.storage.exists(cover))
        self.assertFalse(self.storage.exists(avatar))

    def test_rollback_preserves_old_file_and_the_restored_database_reference(self):
        old = self.book.cover_image.name
        with self.assertRaises(RuntimeError), transaction.atomic():
            self.book.cover_image = image("rolled-back.png")
            self.book.save()
            new = self.book.cover_image.name
            raise RuntimeError("rollback")
        self.book.refresh_from_db()
        self.assertEqual(self.book.cover_image.name, old)
        self.assertTrue(self.storage.exists(old))
        self.assertTrue(self.storage.exists(new))  # the sweep handles uncommitted uploads
        with self.assertRaises(RuntimeError), transaction.atomic():
            self.book.delete()
            raise RuntimeError("rollback deletion")
        self.assertTrue(self.storage.exists(old))

    def test_shared_reference_survives_until_its_last_owner_removes_it(self):
        old = self.user.avatar.name
        other = User.objects.create(username="shared", avatar=old)
        self.user.avatar = image("new.png")
        self.user.save()
        self.assertTrue(self.storage.exists(old))
        other.delete()
        self.assertFalse(self.storage.exists(old))

    def test_omitted_update_fields_do_not_schedule_the_unsaved_file_change(self):
        old = self.user.avatar.name
        self.user.avatar = image("not-saved.png")
        self.user.address = "new address"
        self.user.save(update_fields=["address"])
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar.name, old)
        self.assertTrue(self.storage.exists(old))

    def test_clearing_a_file_deletes_it_without_changing_other_fields(self):
        old = self.user.avatar.name
        self.user.avatar = None
        self.user.save(update_fields=["avatar"])
        self.assertFalse(self.storage.exists(old))

    def test_storage_failure_does_not_turn_a_committed_update_into_an_error(self):
        old = self.book.cover_image.name
        with patch.object(self.storage, "delete", side_effect=OSError("storage unavailable")):
            self.book.cover_image = image("after-failure.png")
            self.book.save()
        self.book.refresh_from_db()
        self.assertTrue(self.storage.exists(self.book.cover_image.name))
        self.assertTrue(self.storage.exists(old))
