# Large fish drawings for the «Виды рыб» hero (20.11.2026): public/fish/hd/<key>.webp, 840×600.
# The hero shows its fish ~286 CSS px wide, so the 336×240 card pictures came out blurry on a phone
# (3 device pixels per CSS pixel). Made from the original drawings in fish_illustrations/ (1024×1024,
# transparent) the same way as the card ones: cropped to the fish, fitted to the box, centred.
# Run from the repo root: python3 web/scripts/fish-hero-images.py
import os
from PIL import Image

SRC = 'fish_illustrations'
OUT = 'web/public/fish/hd'
W, H, MARGIN = 840, 600, 5
RENAME = {'chernomorskaya_seld': 'chernomorskaya_selyd'}  # the drawing's file name vs the species key

os.makedirs(OUT, exist_ok=True)
total = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    key = RENAME.get(f[:-4], f[:-4])
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    im = im.crop(im.split()[-1].getbbox())
    k = min((W - 2 * MARGIN) / im.width, (H - 2 * MARGIN) / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2), im)
    p = os.path.join(OUT, key + '.webp')
    canvas.save(p, 'WEBP', quality=82, method=6)
    total += os.path.getsize(p)
print(len(os.listdir(OUT)), 'files,', round(total / 1024), 'KB')
