# scripts/generate-photos-qr.py
# Table/room QR pointing to the photo gallery. Style matches assets/invitation-qr.
# Run: python3 scripts/generate-photos-qr.py   (needs: pip install segno pillow)
import segno
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

URL = "https://walters-pierce-wedding.com/photos"
OUT = Path("assets/photos-qr")
OUT.mkdir(parents=True, exist_ok=True)

GREEN, GOLD, CREAM = "#00330a", "#D4AF37", "#FFFDF7"

qr = segno.make(URL, error="h")  # level H: 30% redundancy tolerates the monogram
qr.save(OUT / "photos-qr-plain.png", scale=20, border=4, dark="black", light="white")
qr.save(OUT / "photos-qr-branded-base.png", scale=20, border=4, dark=GREEN, light=CREAM)

# Center monogram: gold ring + "P"
img = Image.open(OUT / "photos-qr-branded-base.png").convert("RGB")
w, h = img.size
d = ImageDraw.Draw(img)
r = w // 10
cx, cy = w // 2, h // 2
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CREAM, outline=GOLD, width=max(4, w // 150))
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", int(r * 1.1))
except OSError:
    font = ImageFont.load_default()
d.text((cx, cy), "P", font=font, fill=GREEN, anchor="mm")
img.save(OUT / "photos-qr-branded.png")
(OUT / "photos-qr-branded-base.png").unlink()
print(f"Wrote {OUT}/photos-qr-branded.png and photos-qr-plain.png")
