"""Takes the brown jacket and the vest off the man third from the left in source-people.webp: a white shirt with its
sleeves down to the cuffs, a black tie carried on down to the belt, a belt, and the trousers up to it.

The user's picture has no version of him without a jacket and the source cannot be regenerated from here, so the part of
the figure that changes (his body from the collar down to the hips) is painted over, by the numbers below, on top of the
original pixels: the head, the collar, the cuffs and hands, the trousers and everything around him stay exactly as they
are. Every coordinate is in pixels of the 1672x941 source-people.webp.

  python -c "import shirtsleeves"   (imported by make_assets.py; apply(array) takes and returns an RGBA float array)
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# the box that holds him (everything else is left alone) and where the work happens inside it
X0, X1, Y0, Y1 = 440, 700, 110, 470

# the part of his body that is clothing to be replaced: the shoulders and chest down to the belt, the sleeves down to
# the cuffs (the middle of the hips, between the sleeves, is handled by HIPS below)
BODY = [(524, 124), (538, 126), (541, 160), (607, 160), (606, 143), (620, 146), (688, 186), (688, 425), (676, 423), (656, 411), (652, 410), (652, 392), (517, 392), (517, 418), (503, 425), (488, 432), (474, 424), (476, 360), (477, 300), (476, 252), (466, 236), (447, 214), (446, 200), (450, 183), (470, 166), (500, 148)]
# the outline of the shirt itself: the shoulders slope from the neck and end at the arm, which hangs a little away from
# the body; the padded shoulders of the jacket (outside this line) become empty
SIL = [(524, 120), (541, 126), (541, 160), (607, 160), (606, 140), (624, 148), (646, 160), (664, 174), (677, 193), (684, 222), (689, 280), (689, 440),
       (652, 440), (652, 392), (517, 392), (517, 440), (468, 440), (468, 300), (470, 240), (473, 212), (480, 190), (494, 172), (514, 158), (536, 150)]
TIE_LEFT = [(206, 576), (240, 575), (300, 573), (340, 571), (360, 570), (390, 588)]
TIE_RIGHT = [(206, 600), (240, 601), (300, 603), (340, 605), (360, 606), (390, 588)]
TIE_POLY = [(x, y) for y, x in TIE_LEFT] + [(x, y) for y, x in TIE_RIGHT[::-1]]
# where each arm leaves the body (y, x): the arm's inner edge, and the side of the body beside it. Between the two the
# picture is empty - the elbow stands out from the waist, and the forearm comes back to the pocket
ARM_L = [(238, 506), (256, 505), (300, 505), (345, 505), (385, 511), (391, 516)]
SIDE_L = [(238, 506), (256, 509), (300, 513), (345, 514), (385, 517), (391, 516)]
SIDE_R = [(238, 654), (256, 652), (300, 655), (345, 656), (385, 655), (391, 653)]
ARM_R = [(238, 654), (256, 657), (300, 661), (345, 664), (385, 661), (391, 653)]
# the hips between the two sleeves, from the belt down to where his own trousers start (the jacket's hem and the
# vest's point lay over them)
HIPS = (517, 386, 652, 424)

# the white of the shirt as it is in the picture (the V of the collar), and its shadow
SHIRT = np.array([248.0, 247.0, 246.0])
# the brown of the tie, the trousers and the belt, taken from the picture
TIE = np.array([115.0, 76.0, 53.0])
BELT_Y = (387, 393)
BELT = np.array([56.0, 36.0, 24.0])
BUCKLE_X = 588

# the outer edges of the two collar wings (they were outlined by the dark jacket); the lower edges are in the picture
COLLAR_EDGES = [[(538, 127), (538, 138), (542, 156), (547, 172), (556, 183)], [(556, 183), (564, 176), (571, 168)],
                [(605.5, 141), (605.5, 157), (606.5, 172), (607.5, 186)], [(607.5, 186), (601, 178), (594, 169)]]

# where the sleeve meets the body (the crease), as (y, x) points
CREASE_L = [(205, 498), (228, 500), (256, 505), (300, 505), (345, 505), (385, 511), (400, 517), (424, 515)]
CREASE_R = [(205, 655), (228, 655), (256, 657), (300, 661), (345, 664), (385, 661), (400, 655), (424, 656)]


def _poly_mask(points, size, blur=0.7):
    ss = 4
    mask = Image.new('L', (size[0] * ss, size[1] * ss), 0)
    ImageDraw.Draw(mask).polygon([((x - X0) * ss, (y - Y0) * ss) for x, y in points], fill=255)
    mask = mask.resize(size, Image.LANCZOS)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur * 0.6))
    return np.asarray(mask, dtype=float) / 255.0


def _smooth(field, sigma):
    """A gaussian blur of a 2-D float array (PIL cannot blur float images)."""
    radius = max(1, int(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    k /= k.sum()
    padded = np.pad(np.asarray(field, dtype=float), radius, mode='edge')
    rows = np.apply_along_axis(lambda r: np.convolve(r, k, mode='valid'), 1, padded)
    return np.apply_along_axis(lambda c: np.convolve(c, k, mode='valid'), 0, rows)


def _hsv(rgb):
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn
    sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rc = (mx == r) & nz
    gc = (mx == g) & nz & ~rc
    bc = nz & ~rc & ~gc
    h[rc] = ((g - b)[rc] / d[rc]) % 6
    h[gc] = (b - r)[gc] / d[gc] + 2
    h[bc] = (r - g)[bc] / d[bc] + 4
    return h * 60.0, sat, mx


def _interp_x(points, ys):
    py, px = zip(*points)
    return np.interp(ys, py, px)


def apply(arr):
    """arr: RGBA float array of the whole picture (0-255). Returns a copy with the jacket and the vest gone."""
    out = arr.copy()
    box = out[Y0:Y1, X0:X1]
    h, w = box.shape[:2]
    size = (w, h)
    rgb = box[..., :3] / 255.0
    hue, sat, val = _hsv(rgb)
    yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(float)

    # --- 1. which pixels are jacket / vest (dark brown) and lie inside the body outline ----------------------------
    very_dark = val < 0.3
    greyish_dark = (val < 0.5) & (sat < 0.35)
    brown = np.clip((0.72 - val) / 0.14, 0, 1) * (((hue > 8) & (hue < 50) & (sat > 0.2)) | very_dark | greyish_dark)
    body = _poly_mask(BODY, size)
    hips = np.zeros((h, w))
    hips[HIPS[1] - Y0:HIPS[3] - Y0, HIPS[0] - X0:HIPS[2] - X0] = 1.0
    hips = _smooth(hips, 0.6) * np.clip((HIPS[3] - yy) / 9.0, 0, 1)

    # the pocket square is replaced too (it is white, so the colour test above would leave it)
    tie_box = _poly_mask([(567, 150), (603, 150), (603, 222), (567, 222)], size, 0.5)
    tie_px = ((sat > 0.15) & (val < 0.82)).astype(float)
    tie_px = np.asarray(Image.fromarray((tie_px * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)), dtype=float) / 255.0
    tie_keep = tie_box * tie_px
    # below the knot only the new blade is kept: the fringe of the old, narrower one beside it goes with the rest
    new_blade = np.asarray(Image.fromarray((_poly_mask(TIE_POLY, size, 0.5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=float) / 255.0
    tie_keep = tie_keep * np.where(yy < 205, 1.0, new_blade)
    square = _poly_mask([(634, 214), (672, 214), (672, 246), (634, 246)], size, 0.6) * (val > 0.55)
    replace = np.clip(np.maximum(brown * body, square), 0, 1)
    # under the tips of the collar everything is shirt now: the vest's edges (and the half-brown fringe along them) go
    below_tips = _poly_mask([(541, 186), (640, 186), (640, 270), (541, 270)], size, 0.6) * np.clip((yy - 186) / 8.0, 0, 1)
    outer_bands = _poly_mask([(530, 126), (541, 126), (548, 158), (556, 192), (530, 192)], size, 0.5) + _poly_mask([(603, 146), (613, 146), (613, 216), (603, 216)], size, 0.5)
    beads = ((val < 0.93) & (sat < 0.62)) * np.clip(outer_bands, 0, 1)
    replace = np.clip(np.maximum(replace, beads), 0, 1)
    replace = np.clip(np.maximum(replace, below_tips), 0, 1)
    # keep the tie knot and the top of the blade as drawn, down to where the new blade is fully in
    replace = replace * (1 - tie_keep * (yy < 216))

    # what lies outside the new outline is no longer there at all
    air = _poly_mask([(x, y) for y, x in ARM_L] + [(x, y) for y, x in SIDE_L[::-1]], size, 0.8) +           _poly_mask([(x, y) for y, x in SIDE_R] + [(x, y) for y, x in ARM_R[::-1]], size, 0.8)
    air = np.clip(air, 0, 1)
    sil = _poly_mask(SIL, size, 0.9) * (1 - air)
    erase = np.maximum(replace * (1 - sil) * (1 - np.clip(hips * 3, 0, 1)), air)
    replace = replace * sil
    # the gap the picture had between his sleeve and the arm of the lady beside him (the jacket stood clear of it there):
    # a shirt sleeve hangs against her arm instead, so the gap is filled
    gap = ((box[..., 3] < 200) & (body > 0.5) & (sil > 0.5) & (yy > 230)).astype(float)
    gap = np.asarray(Image.fromarray((gap * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)), dtype=float) / 255.0
    gap = gap * (body > 0.5) * (sil > 0.5) * (yy > 230) * (1 - air)
    gap = np.clip(_smooth(gap, 0.7) * 1.3, 0, 1)
    replace = np.maximum(replace, gap)

    # --- 2. the shirt: white, with the light and shadow a real one has ----------------------------------------------
    # per row: the extent of the clothing, for the roundness of the shoulders/chest
    cloth = np.clip(body * 1.0, 0, 1)
    ys = np.arange(Y0, Y1, dtype=float)
    left_edge = np.full(h, np.nan)
    right_edge = np.full(h, np.nan)
    for i in range(h):
        cols = np.nonzero((replace[i] > 0.5) & (cloth[i] > 0.5))[0]
        if len(cols):
            left_edge[i], right_edge[i] = cols.min() + X0, cols.max() + X0
    ok = ~np.isnan(left_edge)
    left_edge = np.interp(ys, ys[ok], left_edge[ok])
    right_edge = np.interp(ys, ys[ok], right_edge[ok])
    left_edge = _smooth_1d(left_edge, 7)
    right_edge = _smooth_1d(right_edge, 7)
    side_l = _interp_x(SIDE_L, ys)
    side_r = _interp_x(SIDE_R, ys)
    blend = np.clip((ys - 205) / 53.0, 0, 1)
    body_l = (1 - blend) * left_edge + blend * side_l
    body_r = (1 - blend) * right_edge + blend * side_r
    centre = (body_l + body_r) / 2.0
    half = np.maximum((body_r - body_l) / 2.0, 8.0)
    sx = (xx - centre[:, None]) / half[:, None]
    shade = 1.0 - 0.13 * np.clip(np.abs(sx), 0, 1.0) ** 2.6

    # arms: round, a little darker on their outer side; a soft crease where they meet the body
    cl = _interp_x(CREASE_L, ys)[:, None]
    cr = _interp_x(CREASE_R, ys)[:, None]
    arm_zone = np.clip((ys[:, None] - 205) / 14.0, 0, 1) * np.ones((1, w))
    left_arm = (xx < cl) * arm_zone
    right_arm = (xx > cr) * arm_zone
    lw = np.maximum(cl - left_edge[:, None], 6.0)
    rw = np.maximum(right_edge[:, None] - cr, 6.0)
    u_l = (xx - (left_edge[:, None] + cl) / 2) / (lw / 2)
    u_r = (xx - (cr + right_edge[:, None]) / 2) / (rw / 2)
    arm_shade = 1 - 0.11 * np.clip(np.where(left_arm > 0, u_l, u_r), -1.1, 1.1) ** 2
    in_arm = np.clip(left_arm + right_arm, 0, 1)
    shade = shade * (1 - in_arm) + arm_shade * in_arm
    crease = np.exp(-((xx - cl) ** 2) / (2 * 2.0**2)) * (ys[:, None] > 208) + np.exp(-((xx - cr) ** 2) / (2 * 2.0**2)) * (ys[:, None] > 208)
    shade = shade * (1 - 0.40 * crease * arm_zone)
    # the body beside each crease sits in the arm's soft shadow
    side = np.exp(-((xx - (side_l[:, None] + 5)) ** 2) / (2 * 5.0**2)) + np.exp(-((xx - (side_r[:, None] - 5)) ** 2) / (2 * 5.0**2))
    shade = shade * (1 - 0.14 * side * arm_zone)
    # shadow under the collar and, softly, down the front on either side of the tie
    neck = np.exp(-((yy - 192) ** 2) / (2 * 8.0**2)) * np.exp(-((xx - 588) ** 2) / (2 * 40.0**2))
    shade = shade * (1 - 0.05 * neck)
    # the shirt is tucked in: a little darker, with a few folds, where it meets the belt
    waist = np.clip((yy - 352) / 40.0, 0, 1)
    shade = shade * (1 - 0.06 * waist)
    # elbow folds (soft, slanting)
    folds = np.zeros((h, w))
    for (fx, fy, length, tilt) in [(498, 322, 11, 0.5), (499, 334, 12, 0.4), (500, 346, 10, 0.35), (500, 358, 8, 0.3), (668, 326, 11, -0.5), (667, 338, 12, -0.4), (666, 350, 10, -0.35), (666, 362, 8, -0.3), (590, 372, 30, 0.1), (560, 376, 22, 0.25), (618, 376, 22, -0.25), (538, 300, 14, 1.6), (540, 330, 12, 1.4), (640, 300, 14, -1.6), (638, 330, 12, -1.4)]:
        f = Image.new('L', size, 0)
        ImageDraw.Draw(f).line([(fx - X0 - length, fy - Y0 - tilt * length), (fx - X0 + length, fy - Y0 + tilt * length)], fill=255, width=3)
        folds = np.maximum(folds, np.asarray(f.filter(ImageFilter.GaussianBlur(3.0)), dtype=float) / 255.0)
    # the sleeves: pleats where the cloth gathers above each cuff, and the creases of the elbows
    sleeve_folds = np.zeros((h, w))
    for (x_a, y_a, x_b, y_b, width) in [(497, 404, 499, 425, 3), (504, 401, 505, 421, 3), (510, 399, 511, 419, 2),
                                         (662, 398, 661, 417, 3), (668, 400, 668, 420, 3), (674, 402, 674, 423, 2),
                                         (490, 336, 506, 345, 3), (490, 347, 507, 353, 3), (491, 358, 506, 362, 2),
                                         (684, 338, 664, 347, 3), (684, 349, 664, 355, 3), (683, 360, 665, 364, 2)]:
        f = Image.new('L', size, 0)
        ImageDraw.Draw(f).line([(x_a - X0, y_a - Y0), (x_b - X0, y_b - Y0)], fill=255, width=width)
        sleeve_folds = np.maximum(sleeve_folds, np.asarray(f.filter(ImageFilter.GaussianBlur(1.5)), dtype=float) / 255.0)
    # the seam round each shoulder (where the sleeve is sewn on), as a soft crease
    seam = Image.new('L', size, 0)
    for line in ([(515, 160), (496, 172), (487, 190), (486, 215), (492, 240), (499, 262)], [(640, 160), (659, 172), (672, 190), (674, 215), (667, 240), (660, 262)]):
        ImageDraw.Draw(seam).line([(x - X0, y - Y0) for x, y in line], fill=255, width=2, joint='curve')
    seam = np.asarray(seam.filter(ImageFilter.GaussianBlur(1.3)), dtype=float) / 255.0
    shade = shade * (1 - 0.20 * folds) * (1 - 0.26 * sleeve_folds) * (1 - 0.14 * seam)
    shade = np.clip(shade, 0.70, 1.02)

    shirt = SHIRT[None, None, :] * shade[..., None]
    shirt = shirt * np.array([1.0, 0.994, 0.985])[None, None, :] ** ((1 - shade)[..., None] * 18)

    # --- 3. the tie carried on down to the belt ---------------------------------------------------------------------
    tie_poly = TIE_POLY
    tie_mask = _poly_mask(tie_poly, size, 0.6) * np.clip((yy - 207) / 8.0, 0, 1)
    ty = np.clip((yy - 206) / 184.0, 0, 1)
    # the blade's own cross-section, taken from the picture just above (row 212, the tie is brown from 573 to 599)
    src_row = arr[212, 573:600, :3]
    left_tie = _interp_x(TIE_LEFT, ys)[:, None]
    right_tie = _interp_x(TIE_RIGHT, ys)[:, None]
    t = np.clip((xx - left_tie) / np.maximum(right_tie - left_tie, 1.0), 0, 1)
    cross = np.stack([np.interp(t * (len(src_row) - 1), np.arange(len(src_row)), src_row[:, c]) for c in range(3)], -1)
    cross = cross * (1 - 0.10 * ty[..., None])  # a little darker towards the tip

    # --- 4. the hips: his trousers up to the belt, the jacket's hem and the vest's point gone ----------------------------
    below = arr[HIPS[3] + 2:HIPS[3] + 12, HIPS[0]:HIPS[2], :3].mean(0)          # the trousers just under the hips, per column
    trouser = np.zeros((h, w, 3))
    cols = np.arange(X0, X1)
    for c in range(3):
        trouser[..., c] = np.interp(cols, np.arange(HIPS[0], HIPS[2]), _smooth_1d(below[:, c], 6))[None, :]
    trouser = trouser * (1 - 0.06 * np.clip((HIPS[3] - yy) / (HIPS[3] - HIPS[1]), 0, 1))[..., None]
    occlusion = 0.16 * (np.exp(-((xx - HIPS[0]) ** 2) / (2 * 5.0**2)) + np.exp(-((xx - HIPS[2]) ** 2) / (2 * 5.0**2)))
    detail = np.zeros((h, w))
    for (x_from, x_to, y_from, y_to, strength) in [(534, 519, BELT_Y[1], HIPS[3] + 4, 0.20), (642, 651, BELT_Y[1], HIPS[3] + 4, 0.20),
                                                   (564, 562, BELT_Y[1], HIPS[3] + 4, 0.09), (613, 615, BELT_Y[1], HIPS[3] + 4, 0.09)]:
        line = Image.new('L', size, 0)
        ImageDraw.Draw(line).line([(x_from - X0, y_from - Y0), (x_to - X0, y_to - Y0)], fill=int(255 * strength), width=2)
        detail = np.maximum(detail, np.asarray(line.filter(ImageFilter.GaussianBlur(0.9)), dtype=float) / 255.0)
    trouser = trouser * (1 - np.clip(occlusion + detail, 0, 0.4))[..., None]

    # --- 5. put it all together ---------------------------------------------------------------------------------------
    result = rgb * 255.0
    result = result * (1 - replace[..., None]) + shirt * replace[..., None]
    result = result * (1 - hips[..., None]) + trouser * hips[..., None]
    result = result * (1 - tie_mask[..., None]) + cross * tie_mask[..., None]

    # the tie is black: its own light and shade, without the brown
    tie_all = np.clip(np.maximum(tie_mask, tie_keep * (yy < 218) * np.clip((yy - 157) / 3.0, 0, 1)), 0, 1)[..., None]
    lum = (result @ np.array([0.30, 0.59, 0.11]))[..., None]
    black = lum * 0.30 + 9.0
    black = black * np.array([1.0, 1.0, 1.05])[None, None, :]
    result = result * (1 - tie_all) + black * tie_all

    # the belt, with the tie lying over its buckle; the fly continues up to it
    belt = np.zeros((h, w))
    belt[BELT_Y[0] - Y0:BELT_Y[1] - Y0, 517 - X0:652 - X0] = 1.0
    belt = _smooth(belt, 0.5) * (1 - np.clip(tie_mask * 2, 0, 1))
    belt_shade = 1 + 0.18 * np.exp(-((yy - (BELT_Y[0] + 2)) ** 2) / 2.0)
    result = result * (1 - belt[..., None]) + (BELT[None, None, :] * belt_shade[..., None]) * belt[..., None]
    fly = np.zeros((h, w))
    fly[BELT_Y[1] - Y0:HIPS[3] + 4 - Y0, 590 - X0:592 - X0] = 1.0
    fly = _smooth(fly, 0.6) * hips
    result = result * (1 - 0.35 * fly[..., None])

    # where the white shirt meets the white collar, cuffs, and the bright background of the neighbours: a hairline so
    # that those still read as separate things (the jacket's dark colour used to do that)
    white = ((val > 0.78) & (sat < 0.2)).astype(float)
    dark_before = (brown * body) > 0.04
    near_white = np.asarray(Image.fromarray((white * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=float) / 255.0
    edge = near_white * dark_before * (1 - white) * (1 - tie_keep)
    edge_zone = (yy > 405) & ((xx < 520) | (xx > 648))
    edge = _smooth(edge * edge_zone, 0.6)
    result = result * (1 - 0.9 * edge[..., None]) + np.array([186.0, 178.0, 172.0])[None, None, :] * 0.9 * edge[..., None]

    # the collar: its outer edges (the jacket's dark colour used to outline them) and a faint shadow under its tips
    SS = 4
    big = Image.new('L', (w * SS, h * SS), 0)
    pen = ImageDraw.Draw(big)
    for line in COLLAR_EDGES:
        pen.line([((x - X0) * SS, (y - Y0) * SS) for x, y in line], fill=255, width=int(1.7 * SS), joint='curve')
    line_mask = np.asarray(big.resize((w, h), Image.LANCZOS), dtype=float) / 255.0
    shadow = np.asarray(big.filter(ImageFilter.GaussianBlur(2.2 * SS)).resize((w, h), Image.LANCZOS), dtype=float) / 255.0
    # a soft shadow under the collar, on the shirt, and the collar's own fine edge
    under = np.clip(shadow * 3.0, 0, 1) * (yy > 168) * sil
    result = result * (1 - 0.10 * under[..., None])
    outline = np.clip(line_mask * 0.80, 0, 1)
    result = result * (1 - outline[..., None]) + np.array([176.0, 170.0, 166.0])[None, None, :] * outline[..., None]

    # a little grain, so the painted part is not smoother than the picture around it
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 0.9, (h, w, 1))
    changed = np.clip(replace + hips + tie_mask, 0, 1)[..., None]
    result = np.clip(result + grain * changed, 0, 255)

    box[..., :3] = result
    box[..., 3] = np.maximum(box[..., 3] * (1 - erase), 255.0 * gap)
    return out


def _slope_shoulders(box, replace, xx, yy, drop=9.0):
    """A jacket's shoulders are padded and square, a shirt's slope away from the neck: take the top few pixels of the
    clothing off, more towards the tips (nothing else is touched: only pixels that were clothing)."""
    h, w = replace.shape
    alpha = box[..., 3]
    for ix in range(w):
        x = ix + X0
        if 541 > x >= 446:
            d = drop * _smoothstep((541 - x) / 95.0)
        elif 607 < x <= 688:
            d = drop * _smoothstep((x - 607) / 81.0)
        else:
            continue
        rows = np.nonzero(replace[:, ix] > 0.5)[0]
        if not len(rows):
            continue
        cut = rows.min() + d
        keep = np.clip((np.arange(h) - cut) / 1.6 + 0.5, 0, 1)
        affected = replace[:, ix] > 0.3
        alpha[:, ix] = np.where(affected, alpha[:, ix] * keep, alpha[:, ix])


def _smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def _smooth_1d(values, sigma):
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2)
    k /= k.sum()
    padded = np.pad(values, (len(k) // 2, len(k) // 2), mode='edge')
    return np.convolve(padded, k, mode='valid')


if __name__ == '__main__':
    import sys

    src = np.asarray(Image.open(sys.argv[1]).convert('RGBA'), dtype=float)
    Image.fromarray(apply(src).round().astype(np.uint8), 'RGBA').save(sys.argv[2])
