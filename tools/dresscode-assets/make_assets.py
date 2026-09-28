"""Builds the picture of the dress-code section from the source picture kept beside this script.

Sources:
  source-people.webp      the guests in the palette's colours (transparent cut-out, 1448x1086)
  source-palette.jpg      the user's circles: burgundy, dark brown, mocha, dusty pink (their colours were read from it)
  reference-screenshot.png  the example card the section is modelled on

Writes public/media/dress-people.webp: the figures trimmed to their outline (no empty space above and below),
the last woman's dress recoloured from white to the site's own cream (see RECOLOUR_TARGET - matches --bg in
src/styles.css and the "Кремовый" swatch in dress-code.ts, so nothing in the picture reads as plain white), and
shrunk to 1200 px wide. Prints the size for the width/height attributes in the template.
The circles of the palette are not pictures: they are drawn in CSS from the colours in dress-code.ts.
Usage (needs Pillow and numpy): python make_assets.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media'))

# --bg in src/styles.css - the last woman's dress is recoloured to match it exactly (see recolour_last_dress below).
RECOLOUR_TARGET = (253, 244, 235)
# Only the rightmost figure - never touches anyone else in the lineup even if their outfit is also light.
RECOLOUR_X_FROM = 1240


def recolour_last_dress(im):
    """Multiply-blends the dress fabric (light, low-saturation pixels in the rightmost figure's column) towards
    RECOLOUR_TARGET, keeping every fold's own shading - only the hue shifts, from white to cream. Skin, hair and
    the clutch purse are all more saturated and/or darker than the dress, so a simple saturation/value threshold
    (tuned by hand against this exact source image) already keeps them untouched; the mask is feathered afterwards
    so the recolour has no hard edge where it meets skin or hair."""
    arr = np.array(im).astype(float)
    h, w = arr.shape[:2]
    region = np.zeros((h, w), dtype=bool)
    region[:, RECOLOUR_X_FROM:] = True

    alpha, mx, mn = arr[..., 3], arr[..., :3].max(axis=-1), arr[..., :3].min(axis=-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    val = mx / 255
    raw_mask = (sat < 0.16) & (val > 0.55) & (alpha > 10) & region

    mask = np.array(Image.fromarray((raw_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)))
    mask = (mask / 255.0)[..., None]

    target = np.array(RECOLOUR_TARGET, dtype=float) / 255.0
    recoloured = arr[..., :3] * target
    arr[..., :3] = arr[..., :3] * (1 - mask) + recoloured * mask
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


im = Image.open(os.path.join(HERE, 'source-people.webp')).convert('RGBA')
im = recolour_last_dress(im)
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
