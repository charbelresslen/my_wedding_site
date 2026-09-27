"""Builds the pictures of the timeline section ("Программа дня") from the source pictures kept beside this script.

Sources (all transparent cut-outs, burgundy):
  source-rule.webp         the long ornamental separator under the title
  source-arrival.webp      bride and groom with roses         -> 16:00 arrival at the ZAGS
  source-welcome.webp      two glasses in an arch with roses  -> 18:00 welcome drink
  source-banquet.webp      a domed serving dish with roses    -> 19:00 banquet dinner
  source-stick-first.webp  the FIRST timeline stick: finial at the top, a long plain rod below (cut off)
  source-stick-last.webp   the LAST timeline stick: a long plain rod ending in a finial at the bottom
  source-flower.webp       the peony that follows the timeline on scroll

Writes into public/media/:
  timeline-rule.webp, timeline-arrival.webp, timeline-welcome.webp, timeline-banquet.webp,
  timeline-flower.webp, timeline-top.webp (finial of the first stick), timeline-rod.webp (a short piece of plain rod,
  stretched by the page to any length), timeline-bottom.webp (finial of the last stick).
The pearl and the ring of beads in the middle of the flower, and the pearl of the little flower in the diamond of the
top finial, are painted cream like the page background (cream_spheres in ../burgundy.py); the rest stays burgundy.

Prints the pixel sizes to put in the width/height attributes of the <img> tags.
Usage (needs Pillow and numpy): python make_assets.py
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from burgundy import cream_spheres  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))


def load(name):
    return Image.open(os.path.join(HERE, name)).convert('RGBA')


def trim(im, pad=0):
    left, top, right, bottom = im.split()[3].point(lambda v: 255 if v >= 10 else 0).getbbox()
    return im.crop((max(0, left - pad), max(0, top - pad), min(im.width, right + pad), min(im.height, bottom + pad)))


def fit_width(im, width):
    if im.width <= width:
        return im
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def save(im, name, quality=88):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=quality, alpha_quality=100, method=6)
    print(f'{name:26s} {im.width}x{im.height}  {os.path.getsize(path) // 1024} kB')


# ---------------- long separator, art, flower ----------------
save(fit_width(trim(load('source-rule.webp')), 1000), 'timeline-rule.webp')
for src, dst in (('source-arrival.webp', 'timeline-arrival.webp'),
                 ('source-welcome.webp', 'timeline-welcome.webp'),
                 ('source-banquet.webp', 'timeline-banquet.webp')):
    save(fit_width(trim(load(src)), 560), dst)
# the pearl is at about (620, 490) of the trimmed picture; its ring of beads reaches about 124 px from it
flower = cream_spheres(trim(load('source-flower.webp')), 620, 490, radii=range(50, 66), reach=124)
save(fit_width(flower, 256), 'timeline-flower.webp', quality=90)

# ---------------- the rail: two finials and a piece of plain rod (all cut from the same columns, so they line up) ----------------
X0, X1 = 252, 414          # the columns that hold the finial and the rod (the rod is about 27 px wide, centred)
first = load('source-stick-first.webp')
last = load('source-stick-last.webp')
top = first.crop((X0, 0, X1, 430))                                                 # spear, diamond with a flower, ball, a bit of rod
top = cream_spheres(top, 82, 185, radii=range(6, 11), search=4)                     # the pearl of the little flower in the diamond
save(top, 'timeline-top.webp', quality=92)
save(first.crop((X0, 1000, X1, 1120)), 'timeline-rod.webp', quality=92)              # plain rod (uniform along its length)
save(last.crop((X0, 1592, X1, last.height)), 'timeline-bottom.webp', quality=92)    # a short stub of rod, ball, diamond with a gem, spear
