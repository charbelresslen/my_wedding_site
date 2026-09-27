"""The site's burgundy, for the flower pictures (shared by the make_assets.py scripts in the folders next to this file).

The flowers were delivered cream and gold. recolour() keeps the picture's own light and shade: each pixel's brightness is
looked up in a ramp from dark burgundy to a soft rose highlight, so the petals keep their folds and the stamens their
glow, and only the colour changes (the transparency is untouched).

The middle of each flower (the pearl and the ring of small gold beads around it) is painted cream, like the page
background, instead of burgundy: pass the flowers' middles as `centres`, a list of (x, y, r) = a point inside the pearl
(measured in the picture with its transparent margins cut off) and the radius of the whole middle, ring included. The
cream keeps the light and shade of the beads (a lookup of the picture's brightness in CREAM), so they still read as
pearls. Where a petal is folded over the ring, a fourth item [(dx, dy, r), ...] lists circles, measured from the point,
that stay burgundy.

Two flowers were delivered burgundy already (the peony that follows the timeline, and the little flower in the diamond of
the rail's top finial): cream_spheres() paints their pearl and beads cream and leaves the stalks and petals as they are.

Edit RAMP (petals), CREAM or SPHERE (the middles) to change every flower of the site, then run the scripts again:
  tools/hero-assets/make_assets.py         the flowers under the photo of the first section
  tools/invitation-assets/make_assets.py   the peonies of the invitation section
  tools/location-assets/make_assets.py     the peony and the sprig of the location section
  tools/gift-assets/make_assets.py         the flowers of the gift section
  tools/timeline-assets/make_assets.py     the flower that follows the timeline and the rail's top finial
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# brightness (0-255) -> colour: the cream petals of the originals (about 225-250) become mid burgundy, the folds darker
RAMP = [
    (0, (22, 4, 3)),
    (90, (52, 8, 6)),
    (150, (84, 15, 8)),      # the site's ink colour #540f08
    (195, (106, 22, 21)),
    (225, (132, 33, 35)),
    (245, (160, 58, 60)),
    (255, (196, 104, 102)),
]

# brightness -> colour of the middles: the lit side of a bead is the page background #fdf4eb, the shade a warm beige
CREAM = [
    (0, (170, 138, 118)),
    (80, (190, 160, 138)),
    (140, (226, 202, 182)),
    (190, (248, 233, 218)),
    (225, (253, 244, 235)),   # the site's background colour #fdf4eb
    (255, (255, 251, 246)),
]

# brightness -> colour of the spheres of the two burgundy flowers: their own light and shade, in cream (the lit side is
# almost the page background, the shaded side a warm beige, the highlights white)
SPHERE = [
    (0, (150, 118, 100)),
    (15, (176, 144, 124)),
    (30, (212, 186, 166)),
    (50, (240, 222, 206)),
    (80, (252, 240, 228)),
    (140, (254, 247, 240)),
    (255, (255, 252, 248)),
]


def look_up(y, table):
    xs = [p[0] for p in table]
    return np.stack([np.interp(y, xs, [p[1][c] for p in table]) for c in range(3)], axis=-1)


def brightness(rgb):
    """brightness the way the eye sees it (0-255)"""
    rgb = np.asarray(rgb, dtype=float)
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def saturation_value(rgb):
    rgb = np.asarray(rgb, dtype=float)
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0), mx / 255.0


def visible_box(im):
    """(left, top, right, bottom) of the visible content: the transparent margins cut off"""
    return im.split()[3].point(lambda v: 255 if v > 10 else 0).getbbox()


def convex_hull(points):
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def components(mask):
    """8-connected components of a boolean mask: (label array, count)"""
    h, w = mask.shape
    lab = np.zeros((h, w), dtype=np.int32)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        stack = [(y0, x0)]
        while stack:
            y, x = stack.pop()
            for yy in (y - 1, y, y + 1):
                for xx in (x - 1, x, x + 1):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
    return lab, n


def fill_holes(mask):
    padded = np.ones((mask.shape[0] + 2, mask.shape[1] + 2), dtype=bool)
    padded[1:-1, 1:-1] = ~mask
    lab, _ = components(padded)
    return ~(lab == lab[0, 0])[1:-1, 1:-1]


def middle_mask(im, centres):
    """soft mask (0-1) of the middles of the flowers of a cream and gold picture"""
    a = np.array(im.convert('RGBA'))
    left, top, _, _ = visible_box(im)
    height, width = a.shape[:2]
    mask = np.zeros((height, width), dtype=bool)
    for (x, y, r, *cuts) in centres:
        x, y = x + left, y + top
        pad = int(2.2 * r) + 6
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(width, x + pad + 1), min(height, y + pad + 1)
        win = a[y0:y1, x0:x1]
        sat, val = saturation_value(win[..., :3])
        solid = win[..., 3] > 200
        yy, xx = np.mgrid[y0:y1, x0:x1]
        strict = (sat >= 0.58) & (val >= 0.55) & solid          # the bright gold of the beads
        relaxed = (sat >= 0.48) & (val >= 0.45) & solid         # the same in shade
        petal = (val >= 0.90) & (sat <= 0.26)                   # white petals
        near = np.hypot(xx - x, yy - y) <= 1.25 * r
        if not (strict & near).any():
            print(f'  warning: no gold beads near the point ({x - left}, {y - top}), the middle is left as it is')
            continue
        cy, cx = np.nonzero(strict & near)
        cx, cy = cx.mean() + x0, cy.mean() + y0
        dist = np.hypot(xx - cx, yy - cy)
        reach = np.percentile(dist[strict & (dist <= 1.35 * r)], 90)
        # the shaded beads count only where they touch a bright one, so the petals' golden tint stays out
        nearby = np.array(Image.fromarray((strict * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
        cloud = (relaxed & nearby | strict) & (dist <= 1.6 * reach)
        radius = min(np.percentile(dist[cloud], 92), 1.35 * reach + 2)
        pts = [(int(px), int(py)) for px, py in zip(xx[cloud & (dist <= radius)], yy[cloud & (dist <= radius)])]
        polygon = np.array(convex_hull(pts), dtype=float)
        centre = polygon.mean(axis=0)
        vec = polygon - centre
        polygon = polygon + vec / np.maximum(np.hypot(vec[:, 0], vec[:, 1]), 1e-6)[:, None]   # half a bead wider
        canvas = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(canvas).polygon([(px - x0, py - y0) for px, py in polygon.tolist()], fill=255)
        # the ring of beads with the pearl inside it (where petals hide part of the ring, the pearl is a disc in the hull);
        # a petal folded over the ring stays a petal
        ring = fill_holes(np.array(Image.fromarray((cloud * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0)
        ring = np.array(Image.fromarray((ring * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) > 0
        pearl = (np.array(canvas) > 0) & (dist <= 0.75 * reach)
        piece = (ring | pearl) & ~petal
        for (dx, dy, cr) in (cuts[0] if cuts else ()):
            piece &= np.hypot(xx - (x + dx), yy - (y + dy)) > cr
        piece = fill_holes(piece)                                # the pearl's white highlights sit inside
        wide = np.array(Image.fromarray((piece * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        piece = np.array(Image.fromarray((fill_holes(wide) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 0   # small gaps closed
        lab, n = components(piece)
        if n > 1:
            piece = lab == 1 + int(np.argmax([(lab == k).sum() for k in range(1, n + 1)]))
        soft = Image.fromarray((piece * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1.3, 0.12 * radius)))
        mask[y0:y1, x0:x1] |= np.array(soft) > 127
    return np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))) / 255.0


def recolour(im, centres=()):
    """the cream and gold picture in burgundy; the middles of the flowers listed in `centres` in cream"""
    a = np.array(im.convert('RGBA'))
    source = a[..., :3].astype(float)
    y = brightness(source)
    out = look_up(y, RAMP)
    if centres:
        m = middle_mask(im, centres)[..., None]
        out = out * (1 - m) + look_up(y, CREAM) * m
    a[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def _disc(r):
    return [(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx * dx + dy * dy <= r * r + 0.5]


def _shift(mask, dx, dy):
    out = np.zeros_like(mask)
    y0, y1 = max(0, dy), min(mask.shape[0], mask.shape[0] + dy)
    x0, x1 = max(0, dx), min(mask.shape[1], mask.shape[1] + dx)
    out[y0:y1, x0:x1] = mask[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return out


def _erode(mask, r):
    out = np.ones_like(mask)
    for dx, dy in _disc(r):
        out &= _shift(mask, dx, dy)
    return out


def _dilate(mask, r):
    out = np.zeros_like(mask)
    for dx, dy in _disc(r):
        out |= _shift(mask, dx, dy)
    return out


def find_pearl(y, x, z, radii, search):
    """the pearl near (x, z) in the brightness picture y: the circle whose thin bright rim is brightest -> (x, z, radius)"""
    half = max(radii) + search + 4
    x0, z0 = max(0, x - half), max(0, z - half)
    win = y[z0:z + half + 1, x0:x + half + 1]
    zz, xx = np.mgrid[z0:z0 + win.shape[0], x0:x0 + win.shape[1]]

    def rim(cx, cz, r):
        d = np.hypot(xx - cx, zz - cz)
        return win[(d >= r - 1.5) & (d <= r + 1.5)].mean()

    step = 2 if search >= 8 else 1
    best = max(((rim(cx, cz, r), cx, cz, r)
                for cz in range(z - search, z + search + 1, step)
                for cx in range(x - search, x + search + 1, step)
                for r in radii), key=lambda t: t[0])
    if step > 1:      # then look at the neighbours of the best one, pixel by pixel
        _, bx, bz, _ = best
        best = max(((rim(cx, cz, r), cx, cz, r)
                    for cz in range(bz - 1, bz + 2) for cx in range(bx - 1, bx + 2) for r in radii), key=lambda t: t[0])
    return best[1], best[2], best[3]


def cream_spheres(im, x, y, radii, search=20, reach=0, threshold=20, bead=7, min_area=150):
    """the spheres in the middle of a flower that is already burgundy painted cream: the pearl (found near (x, y); its
    radius is one of `radii`) and, when `reach` is given, the beads of the ring around it up to that distance from the
    pearl's centre. The stalks that carry the beads and the petals stay as they are."""
    a = np.array(im.convert('RGBA'))
    source = a[..., :3].astype(float)
    bright = brightness(source)
    height, width = bright.shape
    px, py, pr = find_pearl(bright, x, y, radii, search)
    yy, xx = np.mgrid[0:height, 0:width]
    dist = np.hypot(xx - px, yy - py)
    mask = dist <= pr + 2
    if reach:
        smooth = np.array(Image.fromarray(np.clip(bright, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(float)
        half = reach + 4
        x0, y0, x1, y1 = max(0, px - half), max(0, py - half), min(width, px + half + 1), min(height, py + half + 1)
        ring = ((smooth >= threshold) & (dist <= reach) & (dist > pr + 3))[y0:y1, x0:x1]
        beads = _dilate(_erode(ring, bead), bead)                 # round beads stay, the thin stalks between them go
        lab, n = components(beads)
        for k in range(1, n + 1):
            if (lab == k).sum() >= min_area:
                mask[y0:y1, x0:x1] |= lab == k
    soft = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))) / 255.0
    out = source * (1 - soft[..., None]) + look_up(bright, SPHERE) * soft[..., None]
    a[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')
