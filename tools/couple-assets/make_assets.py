"""Builds the two photos of the "Наша история" section from the pictures kept beside this script.

Sources: source-beach.webp (the two of them by the sea), source-dinner.webp (dinner at sunset).
Writes into public/media/: couple-beach.webp, couple-dinner.webp - resized to a sensible width for the web (they are
shown at up to about 470 CSS px), recompressed, otherwise untouched: no crop, no filter, nothing drawn on them.

Usage (needs Pillow): python make_assets.py
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))


def save(name, dst, max_width, quality=85):
    im = Image.open(os.path.join(HERE, name)).convert('RGB')
    if im.width > max_width:
        im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
    path = os.path.join(OUT, dst)
    im.save(path, 'WEBP', quality=quality, method=6)
    print(f'{dst:20s} {im.width}x{im.height}  {os.path.getsize(path) // 1024} kB')


save('source-beach.webp', 'couple-beach.webp', 960)
save('source-dinner.webp', 'couple-dinner.webp', 1400)
