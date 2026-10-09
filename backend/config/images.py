from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageOps


def shrink_new_upload(field_file, max_size):
    """عکس تازه‌آپلودشده را پیش از ذخیره کوچک و WebP می‌کند (API و پنل مدیریت هر دو از save() مدل رد می‌شوند).

    چرخش EXIF گوشی اعمال و بقیه‌ی متادیتا (مثل موقعیت مکانی) دور ریخته می‌شود.
    فایلی که قبلاً ذخیره شده دست نمی‌خورد، پس ذخیره‌های بعدی مدل دوباره فشرده نمی‌کنند.
    """
    if not field_file or field_file._committed:
        return
    field_file.seek(0)
    img = ImageOps.exif_transpose(Image.open(field_file))
    img.thumbnail(max_size)
    img = img.convert("RGBA" if img.has_transparency_data else "RGB")
    buf = BytesIO()
    img.save(buf, "WEBP", quality=82)
    shrunk = ContentFile(buf.getvalue(), name=f"{Path(field_file.name).stem}.webp")
    # مقداردهی از راه descriptor، تا ImageField ابعاد (width_field/height_field) را هم به‌روز کند
    setattr(field_file.instance, field_file.field.attname, shrunk)
