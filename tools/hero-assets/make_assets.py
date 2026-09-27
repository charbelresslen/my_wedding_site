"""Builds the two flower pictures of the first section (the corners under the photo, on both sides of the names).

Sources (transparent cut-outs, cream and gold as delivered, kept beside this script):
  source-flower-left.webp     the cluster in the bottom-left corner
  source-flower-right.webp    the cluster in the bottom-right corner

Writes into public/media/: flower-left.webp, flower-right.webp, recoloured to the site's burgundy, with the pearl and the
ring of beads in the middle of each flower cream like the page background (see ../burgundy.py).
Usage (needs Pillow and numpy): python make_assets.py
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from burgundy import recolour  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))

# the middles of the flowers: (x, y, r) = a point inside the pearl and the radius of the whole middle, measured in the
# picture with its transparent margins cut off (a fourth item lists circles that stay burgundy: a petal over the ring)
LEFT = [(149, 336, 17), (97, 409, 24)]
RIGHT = [(257, 403, 24, [(14, 19, 9)])]


def save(im, name, quality):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=quality, alpha_quality=100, method=6)
    print(f'{name:18s} {im.width}x{im.height}  {os.path.getsize(path) // 1024} kB')


for src, dst, centres in (('source-flower-left.webp', 'flower-left.webp', LEFT), ('source-flower-right.webp', 'flower-right.webp', RIGHT)):
    save(recolour(Image.open(os.path.join(HERE, src)).convert('RGBA'), centres), dst, 90)
