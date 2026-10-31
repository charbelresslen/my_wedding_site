"""Builds the pictures of the timeline section ("Программа дня") from the source pictures kept beside this script.

Sources (all transparent cut-outs, burgundy):
  source-rule.webp         the long ornamental separator under the title
  source-arrival.webp      bride and groom with roses         -> 16:30 the ceremony
  source-welcome.webp      two glasses in an arch with roses  -> 17:30 guests meet in the banquet hall
  source-banquet.webp      a domed serving dish with roses    -> 18:30 the banquet
  source-stick-first.webp  the FIRST timeline stick: finial at the top, a long plain rod below (cut off)
  source-stick-last.webp   the LAST timeline stick: a long plain rod ending in a finial at the bottom
  source-flower.webp       the peony that follows the timeline on scroll

Writes into public/media/:
  timeline-rule.webp, timeline-arrival.webp, timeline-welcome.webp, timeline-banquet.webp,
  timeline-gathering.webp (16:10, guests gather at the ZAGS: the rose spray right of the groom, cut out of the arrival
  picture and made symmetrical) and timeline-finale.webp (23:30, the evening ends: the entwined hearts at the foot of the arch of the
  welcome picture) - the user has no pictures of their own for those two steps yet, so these are cut from theirs,
  with clean edges (no fading, like all the other pictures).
  timeline-flower.webp, timeline-top.webp (finial of the first stick), timeline-rod.webp (a short piece of plain rod,
  stretched by the page to any length), timeline-bottom.webp (finial of the last stick).
The pearl and the ring of beads in the middle of the flower, and the pearl of the little flower in the diamond of the
top finial, are painted cream like the page background (cream_spheres in ../burgundy.py); the rest stays burgundy.

Prints the pixel sizes to put in the width/height attributes of the <img> tags.
Usage (needs Pillow and numpy): python make_assets.py
"""
import os
import sys

import numpy as np
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
def clear_haze(arr, below=14):
    """The cut-outs carry a faint haze (alpha of a few units) all round the art; it shows up as a thin tinted line
    wherever the picture is cropped through it, so anything that faint is made fully transparent."""
    arr = arr.copy()
    arr[..., 3][arr[..., 3] < below] = 0
    return arr


# 16:10 - the rose spray to the right of the groom, made symmetrical: only its right half (right of the line through the
# middles of the two roses, which are round) is used, mirrored onto the left. That keeps clear of the groom's trouser
# leg and cuff, which lie on its left, and leaves no cut edge anywhere.
arrival = trim(load('source-arrival.webp'))
A, B = arrival.size
spray = clear_haze(np.array(arrival.crop((int(A * 0.66) + 62, int(B * 0.30), A, int(B * 0.93)))))
AXIS = 150
right = spray[:, AXIS:]
both = np.concatenate([right[:, ::-1], right], axis=1)
save(fit_width(trim(Image.fromarray(both, 'RGBA')), 330), 'timeline-gathering.webp')

# 23:30 - the entwined hearts with their leaves and the two curls under them, from the foot of the arch. The glasses' feet
# above and the roses to either side are cut away, and so is everything that runs on beyond the emblem: the scroll
# bands to the sides and the curls hanging from them. What is left ends of its own accord - on the two leaves, on the
# curls, and on the end of each upper ribbon, which is rounded off - so there is no cut edge and no fading anywhere.
# (The coordinates are those of the crop; the knot is not symmetrical, so the two sides share the same cut but not the pixels.)
welcome = trim(load('source-welcome.webp'))
hearts = clear_haze(np.array(welcome.crop((419, 988, 816, welcome.height))))
rows, cols = hearts.shape[:2]
MID = 198                                                  # the middle column
yy, xx = np.mgrid[0:rows, 0:MID + 1]
keep = np.ones((rows, MID + 1))
keep[:12] = 0                                              # the feet of the glasses
keep[xx < 57] = 0                                          # the roses and the outer curls
# the upper ribbon: cut across it and round the end off (a circle of its own half-width)
C, d, n, half = np.array([80.0, 34.0]), np.array([0.91, 0.41]), np.array([-0.41, 0.91]), 19.0
along = (xx - C[0]) * d[0] + (yy - C[1]) * d[1]
across = (xx - C[0]) * n[0] + (yy - C[1]) * n[1]
strip = np.abs(across) <= half + 2
cap = np.hypot(xx - (C[0] + half * d[0]), yy - (C[1] + half * d[1])) <= half
keep[strip & (along < half) & ~cap] = 0
keep[strip & (along < 0)] = 0
# the lower band and the curl hanging from it: only what belongs to the inner curl stays
curl = ((xx - 128) / 40.0) ** 2 + ((yy - 150) / 36.0) ** 2 <= 1
keep[(((xx < 104) & (yy > 124)) | ((xx < 75) & (yy > 88))) & ~curl] = 0
keep = np.concatenate([keep, keep[:, :-1][:, ::-1]], axis=1)
hearts[..., 3] = (hearts[..., 3] * keep).round().astype(np.uint8)
save(trim(Image.fromarray(hearts, 'RGBA')), 'timeline-finale.webp')

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
