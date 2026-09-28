"""Builds the picture of the dress-code section from the source picture kept beside this script.

Sources:
  source-people.webp      the guests in the palette's colours (transparent cut-out, 1672x941 - a second version the
                          user regenerated themselves after the first one turned out to have the end figures' arms
                          cropped right at its own canvas edge, with no way to recover that from the file alone)
  source-palette.jpg      the user's circles: burgundy, dark brown, mocha, dusty pink (their colours were read from it)
  reference-screenshot.png  the example card the section is modelled on

Writes public/media/dress-people.webp: the full figures trimmed to their outline (nothing cropped away - see
EDGE_PAD below for why there is still a transparent margin left and right of them), at their own real colours -
the last woman's dress is NOT recoloured (an earlier version of this script multiply-blended it towards an assumed
"cream" target, which just made it look like a different, wrong dress next to the actual photo - the source's own
colour is already the right one) - and shrunk to 1200 px wide. Prints the size for the width/height attributes in
the template.
The circles of the palette are not pictures: they are drawn in CSS from the colours in dress-code.ts - the
"Кремовый" one is sampled from this same dress (see the bottom of this script), so it always matches it exactly.
Usage (needs Pillow and numpy): python make_assets.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))

# The source's tight alpha crop lands exactly on the leftmost man's jacket corner and the rightmost woman's dress
# fabric - both edges of the printed guest lineup sit precisely on those pixels with nothing beyond them (the source
# canvas itself is exactly as wide as its content, x 0 to 1447 of 1448). Trimming any further in than that would
# throw away real, already-visible content - the whole figure must stay. EDGE_PAD only adds transparent space AROUND
# the full, untouched crop, so the picture does not touch its own canvas edge, let alone the screen's.
EDGE_PAD = 40

im = Image.open(os.path.join(HERE, 'source-people.webp')).convert('RGBA')
alpha = np.array(im.split()[3])
ys, xs = np.nonzero(alpha > 10)
im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
padded = Image.new('RGBA', (im.width + 2 * EDGE_PAD, im.height), (0, 0, 0, 0))
padded.paste(im, (EDGE_PAD, 0), im)
im = padded
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

# the "Кремовый" circle's colour: sampled straight from the last woman's dress (a flat, well-lit patch on the main
# skirt panel, in the ORIGINAL source-people.webp's own coordinates, before this script's crop/pad/resize move
# everything around) - paste this into SHADES in dress-code.ts whenever source-people.webp is replaced.
dress_src = np.array(Image.open(os.path.join(HERE, 'source-people.webp')).convert('RGB')).astype(int)
dress_patch = dress_src[510:525, 1590:1605].reshape(-1, 3)
print('dress (cream swatch) colour', '#%02x%02x%02x' % tuple(int(v) for v in np.median(dress_patch, axis=0)))
