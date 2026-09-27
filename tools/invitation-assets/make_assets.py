"""Builds the assets of the invitation section from the two source pictures kept beside this script
(wall-source.webp = the ZAGS wall, flowers-source.webp = the peony cluster as it was delivered, lying on its side).

  public/media/zags-wall.webp      the ZAGS wall, cropped to its useful middle part
  public/media/peony-left.webp     the flower cluster standing up in the bottom-left corner (peony at the bottom,
                                   leaf pointing to the middle of the card, stems rising toward the left edge),
                                   recoloured from cream and gold to the site's burgundy, the middles of the
                                   flowers cream like the page background (see ../burgundy.py)
  public/media/peony-right.webp    its mirror image for the right corner

Usage (needs Pillow and numpy): python make_assets.py [angle_degrees]   (default 98)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from burgundy import recolour  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))
ANGLE = float(sys.argv[1]) if len(sys.argv) > 1 else 98.0

# ---------------- the wall ----------------
wall = Image.open(os.path.join(HERE, 'wall-source.webp')).convert('RGB')  # already sRGB
TOP, BOTTOM = 150, 1500
wall = wall.crop((0, TOP, wall.width, BOTTOM))
wall.save(os.path.join(OUT, 'zags-wall.webp'), 'WEBP', quality=86, method=6)
print('wall', wall.size, os.path.getsize(os.path.join(OUT, 'zags-wall.webp')) // 1024, 'kB')

# ---------------- the flowers ----------------
src = Image.open(os.path.join(HERE, 'flowers-source.webp')).convert('RGBA')
# the middles of the three flowers: (x, y, r) = a point inside the pearl and the radius of the whole middle, measured in the
# picture with its transparent margins cut off (a fourth item lists circles that stay burgundy: a petal over the ring)
MIDDLES = [(310, 94, 22, [(21, -18, 7)]), (185, 85, 11), (157, 107, 11)]
src = recolour(src.crop(src.split()[3].getbbox()), MIDDLES)
# The picture as delivered lies on its side (peony on the right, stems to the left, leaf pointing down). Mirrored and
# then turned COUNTER-clockwise by ANGLE it stands up like the corner flowers of the reference card: the peony at the
# bottom, its leaf pointing to the middle of the card, the stems rising and leaning a little toward the left edge.
left = ImageOps.mirror(src).rotate(ANGLE, expand=True, resample=Image.BICUBIC)
left = left.crop(left.split()[3].getbbox())

# a soft, burgundy-tinted shadow baked in (so the browser does no filter work), padded so it is not clipped
PAD = 14
canvas = Image.new('RGBA', (left.width + PAD * 2, left.height + PAD * 2), (0, 0, 0, 0))
alpha = left.split()[3]
shadow_a = Image.new('L', canvas.size, 0)
shadow_a.paste(alpha, (PAD + 2, PAD + 5))
shadow_a = shadow_a.filter(ImageFilter.GaussianBlur(5)).point(lambda v: int(v * 0.30))
shadow = Image.new('RGBA', canvas.size, (70, 14, 10, 0))
shadow.putalpha(shadow_a)
canvas.alpha_composite(shadow)
flower = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
flower.paste(left, (PAD, PAD))
canvas.alpha_composite(flower)


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, 'WEBP', quality=90, alpha_quality=100, method=6)
    print(name, img.size, os.path.getsize(path) // 1024, 'kB')


save(canvas, 'peony-left.webp')
save(ImageOps.mirror(canvas), 'peony-right.webp')
