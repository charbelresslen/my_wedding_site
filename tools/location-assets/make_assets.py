"""Builds the pictures of the location section from the source pictures kept beside this script.

Sources:
  source-zags.webp      photo of the Palace of Marriage (ZAGS), Yekaterinburg
  source-hotel.webp     photo of the Grand Avenue hotel (the banquet)
  source-peony.webp     the big peony cluster at the top right of the section (transparent cut-out)
  source-sprig.webp     the corner sprig of flowers on the bottom-left corner of each photo (transparent cut-out)
  source-ornament.webp  the burgundy scroll ornament that sits on the top and bottom edge of each map frame

Writes into public/media/: loc-zags.webp, loc-hotel.webp, loc-peony.webp, loc-sprig.webp, loc-ornament.webp.
The peony and the sprig were delivered cream and gold; they are recoloured to the site's burgundy, with the pearl and the
ring of beads in the middle of each flower cream like the page background (see ../burgundy.py).
Prints the pixel sizes for the width/height attributes and the ornament's baseline position for the CSS.
Usage (needs Pillow and numpy): python make_assets.py
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from burgundy import recolour  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))


def load(name, mode='RGBA'):
    return Image.open(os.path.join(HERE, name)).convert(mode)


def trim(im):
    a = np.array(im.split()[3])
    ys, xs = np.nonzero(a > 10)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def save(im, name, quality):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=quality, alpha_quality=100, method=6)
    print(f'{name:18s} {im.width}x{im.height}  {os.path.getsize(path) // 1024} kB')


for src, dst in (('source-zags.webp', 'loc-zags.webp'), ('source-hotel.webp', 'loc-hotel.webp')):
    im = load(src, 'RGB')
    im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    save(im, dst, 80)

# the middles of the flowers: (x, y, r) = a point inside the pearl and the radius of the whole middle, measured in the
# picture with its transparent margins cut off (see ../burgundy.py)
PEONY = [(142, 64, 19), (157, 207, 26), (203, 310, 11)]
SPRIG = [(149, 336, 17), (97, 409, 24)]
save(trim(recolour(load('source-peony.webp'), PEONY)), 'loc-peony.webp', 90)
save(trim(recolour(load('source-sprig.webp'), SPRIG)), 'loc-sprig.webp', 90)

orn = trim(load('source-ornament.webp'))
orn = orn.resize((1000, round(orn.height * 1000 / orn.width)), Image.LANCZOS)
save(orn, 'loc-ornament.webp', 92)
# the horizontal line the ornament grows out of: the rows that are nearly as wide as the widest one
cover = (np.array(orn.split()[3]) > 128).sum(axis=1)
rows = [i for i, c in enumerate(cover) if c > 0.8 * cover.max()]
centre = (rows[0] + rows[-1] + 1) / 2
print(f'ornament baseline: rows {rows[0]}-{rows[-1]}, centre {centre / orn.height:.4f} of its height, line {rows[-1] - rows[0] + 1}px thick of {orn.width}px wide')
