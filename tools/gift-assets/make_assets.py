"""Builds the pictures of the gift section ("О подарках") from the source pictures kept beside this script.

Sources (transparent cut-outs):
  source-wall.webp                  the wall with the big empty panel the text is written on
  source-flower-top-left.png        the flower cluster for the top-left corner (cream and gold in the original)
  source-flower-bottom-right.png    the flower cluster for the bottom-right corner
  reference-screenshot.png          the example card the section is modelled on

Writes into public/media/: gift-wall.webp, gift-flower-tl.webp, gift-flower-br.webp.
The flowers are recoloured to the site's burgundy by ../burgundy.py (the same burgundy as every other flower of the
site; edit its RAMP to make them all darker, lighter or more rose), with the pearl and the ring of beads in the middle of
each flower cream like the page background.
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

# the middles of the flowers: (x, y, r) = a point inside the pearl and the radius of the whole middle, measured in the
# picture with its transparent margins cut off (see ../burgundy.py)
TOP_LEFT = [(230, 115, 16), (132, 180, 19), (73, 276, 9), (104, 346, 8)]
BOTTOM_RIGHT = [(413, 234, 9), (375, 319, 12), (290, 354, 19), (236, 481, 14), (156, 475, 8)]


def trim(im):
    alpha = np.array(im.split()[3])
    ys, xs = np.nonzero(alpha > 10)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def save(im, name, quality):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=quality, alpha_quality=100, method=6)
    print(f'{name:20s} {im.width}x{im.height}  {os.path.getsize(path) // 1024} kB')


save(Image.open(os.path.join(HERE, 'source-wall.webp')).convert('RGBA'), 'gift-wall.webp', 86)
save(trim(recolour(Image.open(os.path.join(HERE, 'source-flower-top-left.png')), TOP_LEFT)), 'gift-flower-tl.webp', 90)
save(trim(recolour(Image.open(os.path.join(HERE, 'source-flower-bottom-right.png')), BOTTOM_RIGHT)), 'gift-flower-br.webp', 90)
