"""Builds the picture of the dress-code section from the source picture kept beside this script.

Sources:
  source-people.webp      the guests in the palette's colours (transparent cut-out, 1448x1086)
  source-palette.jpg      the user's circles: burgundy, dark brown, mocha, dusty pink (their colours were read from it)
  reference-screenshot.png  the example card the section is modelled on

Writes public/media/dress-people.webp: the figures trimmed to their outline (no empty space above and below) and
shrunk to 1200 px wide. Prints the size for the width/height attributes in the template.
The circles of the palette are not pictures: they are drawn in CSS from the colours in dress-code.ts.
Usage (needs Pillow and numpy): python make_assets.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))

im = Image.open(os.path.join(HERE, 'source-people.webp')).convert('RGBA')
alpha = np.array(im.split()[3])
ys, xs = np.nonzero(alpha > 10)
im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
path = os.path.join(OUT, 'dress-people.webp')
im.save(path, 'WEBP', quality=80, alpha_quality=100, method=6)
print(f'dress-people.webp {im.width}x{im.height}  {os.path.getsize(path) // 1024} kB')

# the colours the user's circles have (centre of each circle), for the palette in dress-code.ts
circles = np.array(Image.open(os.path.join(HERE, 'source-palette.jpg')).convert('RGB')).astype(int)
h = circles.shape[0]
for cx in (85, 250, 415, 580):
    patch = circles[h // 2 - 12:h // 2 + 12, cx - 12:cx + 12].reshape(-1, 3)
    print('circle colour', '#%02x%02x%02x' % tuple(int(v) for v in np.median(patch, axis=0)))
