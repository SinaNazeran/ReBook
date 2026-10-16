"""ساخت آیکن‌های رستری از مستطیل‌های نشان SVG با Pillow محیط مجازی پروژه."""

from pathlib import Path
from xml.etree import ElementTree

from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parents[1] / "public"
SVG = ElementTree.parse(PUBLIC / "favicon.svg").getroot()
if SVG.attrib.get("viewBox") != "0 0 32 32":
    raise ValueError("Expected the existing 32×32 brand mark")
if any(child.tag != "{http://www.w3.org/2000/svg}rect" for child in SVG):
    raise ValueError("The brand mark changed: update the rectangle renderer first")


def render(size, *, opaque=False, padding=1):
    # نمونه‌برداری چندبرابری، نوارهای عطف را در اندازه‌های کوچک خوانا نگه می‌دارد.
    resolution = size * 4
    image = Image.new("RGBA", (resolution, resolution), "white" if opaque else (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = resolution * padding / 32
    offset = resolution * (1 - padding) / 2
    for rect in SVG:
        x, y = (float(rect.get(key, "0")) for key in ("x", "y"))
        width, height = (float(rect.get(key)) for key in ("width", "height"))
        draw.rounded_rectangle(
            (offset + x * scale, offset + y * scale,
             offset + (x + width) * scale - 1, offset + (y + height) * scale - 1),
            radius=float(rect.get("rx", "0")) * scale,
            fill=rect.get("fill"),
        )
    return image.resize((size, size), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    # اندازه‌های ICO جداگانه رندر می‌شوند تا از کوچک‌سازی زنجیره‌ای جلوگیری شود.
    render(48).save(PUBLIC / "favicon.ico", format="ICO", bitmap_format="bmp",
                    sizes=[(16, 16), (32, 32), (48, 48)],
                    append_images=[render(16), render(32)])
    render(180, opaque=True).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    for size in (192, 512):
        render(size).save(PUBLIC / f"icon-{size}.png", optimize=True)
    # همه اجزای نشان در دایره امن با شعاع ۴۰٪ قرار می‌گیرند؛ پس‌زمینه کامل است.
    render(512, opaque=True, padding=0.8).convert("RGB").save(
        PUBLIC / "icon-maskable-512.png", optimize=True,
    )
