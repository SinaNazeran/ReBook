from pathlib import Path

from django.apps import apps

FIELDS = {"avatar": ("accounts.User", "avatar"), "cover": ("books.Book", "cover_image")}
PREFIXES = ("avatars", "book_covers")


def field_for(kind):
    label, field = FIELDS[kind]
    return apps.get_model(label)._meta.get_field(field)


def managed_name(name):
    if not isinstance(name, str) or "\\" in name or "\x00" in name or len(name) > 500:
        return False
    parts = name.split("/")
    return len(parts) == 2 and parts[0] in PREFIXES and parts[1] not in ("", ".", "..")


def safe_storage_path(storage, name):
    if not managed_name(name):
        return False
    try:
        path = Path(storage.path(name))
        root = Path(storage.path(""))
    except NotImplementedError:
        return True  # remote storage keys have no filesystem path
    parent = path.parent
    return (not path.is_symlink() and not parent.is_symlink()
            and path.resolve().parent == parent.resolve()
            and parent.resolve().parent == root.resolve())


def referenced(name, using):
    # Conservatively preserve matching references even across the two fields.
    return any(apps.get_model(label)._base_manager.using(using).filter(**{field: name}).exists()
               for label, field in FIELDS.values())
