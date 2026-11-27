"""All surface textures, generated with numpy.  Output: build/tex/*.png plus build/tex/textures.json.

Each surface gets <name>_a (sRGB albedo), <name>_n (DirectX normal) and <name>_r
(R roughness, G ambient occlusion, B height).  Every texture tiles; sizes in metres are in the json.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "build", "tex")
META = {}
FILES = []


# --------------------------------------------------------------------------- noise
def _fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def perlin(size, cx, cy=None, seed=0):
    """Tileable gradient noise in [-1, 1]; (cx, cy) lattice cells across the image."""
    cy = cx if cy is None else cy
    w, h = (size, size) if np.isscalar(size) else size
    rng = np.random.default_rng(seed)
    ang = rng.uniform(0, 2 * np.pi, (cy, cx))
    gx, gy = np.cos(ang), np.sin(ang)
    x = (np.arange(w) + 0.5) / w * cx
    y = (np.arange(h) + 0.5) / h * cy
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    xf, yf = x - xi, y - yi
    X0, Y0 = np.meshgrid(xi % cx, yi % cy)
    X1, Y1 = (X0 + 1) % cx, (Y0 + 1) % cy
    FX, FY = np.meshgrid(xf, yf)

    def dot(ix, iy, dx, dy):
        return gx[iy, ix] * dx + gy[iy, ix] * dy

    n00 = dot(X0, Y0, FX, FY)
    n10 = dot(X1, Y0, FX - 1, FY)
    n01 = dot(X0, Y1, FX, FY - 1)
    n11 = dot(X1, Y1, FX - 1, FY - 1)
    u, v_ = _fade(FX), _fade(FY)
    a = n00 + u * (n10 - n00)
    b = n01 + u * (n11 - n01)
    return (a + v_ * (b - a)) * 1.414


def fbm(size, cells, octaves=5, gain=0.5, seed=0, cy=None):
    cy = cells if cy is None else cy
    out, amp, tot = 0.0, 1.0, 0.0
    w = size if np.isscalar(size) else min(size)
    for o in range(octaves):
        cx_, cy_ = cells * 2 ** o, cy * 2 ** o
        if max(cx_, cy_) > w:
            break
        out = out + amp * perlin(size, cx_, cy_, seed + o * 101)
        tot += amp
        amp *= gain
    return out / tot


def worley(size, cells, seed=0, warp=None):
    """Returns (F1, F2, cell_id) with distances in cell units."""
    rng = np.random.default_rng(seed)
    jx = rng.uniform(0, 1, (cells, cells))
    jy = rng.uniform(0, 1, (cells, cells))
    t = (np.arange(size) + 0.5) / size * cells
    X, Y = np.meshgrid(t, t)
    if warp is not None:
        X = X + warp[0]
        Y = Y + warp[1]
    XI, YI = np.floor(X).astype(int), np.floor(Y).astype(int)
    f1 = np.full(X.shape, 9.0)
    f2 = np.full(X.shape, 9.0)
    cid = np.zeros(X.shape, np.int64)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = (XI + dx), (YI + dy)
            mx, my = cx % cells, cy % cells
            d = np.hypot(cx + jx[my, mx] - X, cy + jy[my, mx] - Y)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            cid = np.where(closer, my * cells + mx, cid)
            f1 = np.minimum(f1, d)
    return f1, f2, cid


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    if np.ndim(t) == 2 and np.ndim(a) in (1, 3):
        t = t[..., None]
    return a + (np.asarray(b) - np.asarray(a)) * t


def rgb(*c):
    return np.array(c, np.float64) / 255.0


# --------------------------------------------------------------------------- writers
def save_img(name, arr, kind):
    os.makedirs(OUT, exist_ok=True)
    a = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    mode = "L" if a.ndim == 2 else ("RGB" if a.shape[2] == 3 else "RGBA")
    p = os.path.join(OUT, name + ".png")
    Image.fromarray(a, mode).save(p, compress_level=3)
    FILES.append((p, name, kind))


def normal_from_height(h_m, texel_m, strength=1.0):
    """h_m: height in metres; texel_m: metres per pixel."""
    gx = (np.roll(h_m, -1, 1) - np.roll(h_m, 1, 1)) / (2 * texel_m) * strength
    gy = (np.roll(h_m, -1, 0) - np.roll(h_m, 1, 0)) / (2 * texel_m) * strength
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def surface(name, albedo, height_m, rough, tile_m, ao=None, strength=1.0):
    size = albedo.shape[0]
    if ao is None:
        blur = gaussian_filter(height_m, size / 180.0, mode="wrap")
        rng_ = max(np.ptp(height_m), 1e-6)
        ao = np.clip(1.0 - np.maximum(blur - height_m, 0) / rng_ * 1.4, 0.35, 1.0)
    hn = (height_m - height_m.min()) / max(np.ptp(height_m), 1e-6)
    save_img(name + "_a", albedo, "color")
    save_img(name + "_n", normal_from_height(height_m, tile_m / size, strength), "normal")
    save_img(name + "_r", np.stack([rough, ao, hn], -1), "linear")
    META[name] = {"tile": [tile_m, tile_m]}


# --------------------------------------------------------------------------- surfaces
def brick(name, palette, mortar_col, seed, size=1024, bw=0.203, bh=0.057, mw=0.0105, across=10, rows=32,
          tone_var=0.09, rough=0.86, dark_chance=0.07):
    pw, ph = bw + mw, bh + mw
    W, H = across * pw, rows * ph
    rng = np.random.default_rng(seed)
    u = (np.arange(size) + 0.5) / size * W
    vv = (np.arange(size) + 0.5) / size * H
    U, Vv = np.meshgrid(u, vv)
    jitter = fbm(size, 24, 4, seed=seed + 5) * 0.0028
    U2 = U + jitter
    V2 = Vv + fbm(size, 24, 4, seed=seed + 6) * 0.0022
    row = np.floor(V2 / ph).astype(int) % rows
    off = (row % 2) * pw * 0.5
    col = np.floor((U2 + off) / pw).astype(int) % across
    lu = np.mod(U2 + off, pw)
    lv = np.mod(V2, ph)
    d = np.minimum(np.minimum(lu - mw / 2, pw - mw / 2 - lu), np.minimum(lv - mw / 2, ph - mw / 2 - lv))
    brick_m = smooth(-0.0012, 0.0022, d)
    ids = row * across + col
    n = rows * across
    pick = rng.integers(0, len(palette), n)
    tone = 1 + rng.normal(0, tone_var, n)
    tone[rng.random(n) < dark_chance] *= 0.68
    pal = np.stack(palette)
    base = pal[pick[ids]] * tone[ids][..., None]
    mott = fbm(size, 40, 4, seed=seed + 1)
    grain = fbm(size, 256, 2, seed=seed + 2)
    base = base * (1 + 0.16 * mott[..., None] + 0.14 * grain[..., None])
    mort = mortar_col * (1 + 0.18 * grain[..., None] + 0.1 * mott[..., None])
    alb = lerp(mort, base, brick_m)
    hgt = brick_m * 0.0045 + grain * 0.0006 + mott * 0.0008 * brick_m + (rng.normal(0, 0.0006, n))[ids] * brick_m
    r = np.clip(rough + 0.08 * (1 - brick_m) + 0.04 * grain, 0, 1)
    size_ = size
    surface(name, alb, hgt, r, W, strength=1.0)
    META[name]["tile"] = [W, H]


def ashlar(name, base_col, seed, size=1024, tile=3.6, block_w=1.2, block_h=0.45, joint=0.006, tone_var=0.045,
           grain_amt=0.07, vein=0.0, vein_col=None, rough=0.78, stain=0.06, speck=0.0, depth=0.004):
    across = max(1, round(tile / block_w))
    rows = max(2, round(tile / block_h))
    if rows % 2:
        rows += 1
    pw, ph = tile / across, tile / rows
    rng = np.random.default_rng(seed)
    t = (np.arange(size) + 0.5) / size * tile
    U, Vv = np.meshgrid(t, t)
    row = np.floor(Vv / ph).astype(int) % rows
    offs = rng.uniform(0, pw, rows)
    offs[:] = (np.arange(rows) % 2) * pw * 0.5
    Uo = U + offs[row]
    col = np.floor(Uo / pw).astype(int) % across
    lu, lv = np.mod(Uo, pw), np.mod(Vv, ph)
    d = np.minimum(np.minimum(lu, pw - lu), np.minimum(lv, ph - lv))
    face = smooth(joint * 0.25, joint * 0.9, d)
    ids = row * across + col
    n = rows * across
    tone = 1 + rng.normal(0, tone_var, n)
    warm = rng.normal(0, tone_var * 0.35, n)
    base = base_col * np.stack([tone + warm, tone, tone - warm], -1)[ids]
    mott = fbm(size, 7, 6, 0.55, seed=seed + 1)
    grain = fbm(size, 200, 3, 0.6, seed=seed + 2)
    alb = base * (1 + stain * mott[..., None] * 1.6 + grain_amt * grain[..., None])
    if vein > 0:
        warp = fbm(size, 5, 5, 0.6, seed=seed + 7)
        warp2 = fbm(size, 9, 4, 0.6, seed=seed + 8)
        xx = U / tile * 3 + Vv / tile * 5 + warp * 1.7 + warp2 * 0.6
        vm = (1 - np.abs(np.sin(xx * np.pi))) ** 9 * smooth(-0.2, 0.5, fbm(size, 4, 3, seed=seed + 9))
        alb = lerp(alb, vein_col, np.clip(vm * vein, 0, 1))
    if speck > 0:
        f1, _, cid = worley(size, 220, seed + 11)
        r2 = np.random.default_rng(seed + 12).random(220 * 220)
        val = r2[cid]
        alb = alb * (1 + speck * ((val > 0.82).astype(float) * 1.6 - (val < 0.2).astype(float) * 0.7))[..., None]
    alb = lerp(alb * 0.62, alb, face)
    hgt = face * depth + grain * 0.0004 + mott * 0.0012
    r = np.clip(rough + 0.1 * (1 - face) + 0.05 * grain, 0, 1)
    surface(name, alb, hgt, r, tile)


def asphalt(size=2048, tile=4.0):
    f1, f2, cid = worley(size, 330, 3)
    r2 = np.random.default_rng(4).random(330 * 330)
    stone = smooth(0.55, 0.30, f1)
    tone = r2[cid]
    base = rgb(54, 54, 56) * (1 + 0.14 * fbm(size, 6, 6, 0.55, seed=5))[..., None]
    sc = lerp(rgb(46, 46, 48), rgb(112, 108, 102), smooth(0.55, 1.0, tone))
    alb = lerp(base, sc, stone * smooth(0.12, 0.5, tone))
    f1b, _, cid2 = worley(size, 900, 8)
    r3 = np.random.default_rng(9).random(900 * 900)
    alb = alb * (1 + 0.5 * (r3[cid2] > 0.93) * smooth(0.5, 0.2, f1b) - 0.25 * (r3[cid2] < 0.1))[..., None]
    hgt = stone * (0.3 + tone) * 0.0022 + fbm(size, 300, 3, seed=6) * 0.0006 + fbm(size, 20, 4, seed=7) * 0.001
    rough = np.clip(0.82 - 0.12 * stone * tone + 0.05 * fbm(size, 40, 3, seed=10), 0, 1)
    surface("asphalt", alb, hgt, rough, tile, strength=1.2)


def sidewalk(size=2048, slab=1.524):
    tile = slab * 2
    t = (np.arange(size) + 0.5) / size * tile
    U, Vv = np.meshgrid(t, t)
    d = np.minimum(np.minimum(np.mod(U, slab), slab - np.mod(U, slab)),
                   np.minimum(np.mod(Vv, slab), slab - np.mod(Vv, slab)))
    face = smooth(0.004, 0.012, d)
    ids = (np.floor(U / slab).astype(int) % 2) + 2 * (np.floor(Vv / slab).astype(int) % 2)
    tone = np.array([1.0, 0.93, 1.05, 0.97])[ids]
    mott = fbm(size, 5, 7, 0.55, seed=21)
    grain = fbm(size, 400, 2, 0.6, seed=22)
    f1, _, cid = worley(size, 420, 23)
    r2 = np.random.default_rng(24).random(420 * 420)[cid]
    alb = rgb(134, 130, 123) * (tone * (1 + 0.12 * mott + 0.09 * grain))[..., None]
    alb = alb * (1 + 0.35 * ((r2 > 0.9) * smooth(0.5, 0.25, f1)) - 0.3 * ((r2 < 0.06) * smooth(0.5, 0.25, f1)))[..., None]
    # control joints darker, a couple of hairline cracks
    wx, wy = fbm(size, 6, 5, seed=25) * 1.2, fbm(size, 6, 5, seed=26) * 1.2
    a1, a2, _ = worley(size, 3, 27, warp=(wx, wy))
    crack = smooth(0.012, 0.0, a2 - a1) * smooth(0.12, 0.45, fbm(size, 3, 3, seed=28))
    alb = lerp(alb, alb * 0.45, crack)
    alb = lerp(alb * 0.5, alb, face)
    hgt = face * 0.006 + grain * 0.0004 + mott * 0.0015 - crack * 0.002
    rough = np.clip(0.8 + 0.06 * grain - 0.05 * smooth(0, 0.6, mott), 0, 1)
    surface("sidewalk", alb, hgt, rough, tile)


def concrete(name, col, seed, tile=4.0, size=1024, stain=0.1, panel=0.0):
    mott = fbm(size, 4, 7, 0.58, seed=seed)
    grain = fbm(size, 256, 2, seed=seed + 1)
    streak = fbm(size, 40, 5, 0.6, seed=seed + 2, cy=3)
    alb = col * (1 + stain * mott + 0.06 * grain + 0.07 * streak)[..., None]
    hgt = grain * 0.0004 + mott * 0.001
    f1, _, cid = worley(size, 90, seed + 3)
    pits = smooth(0.16, 0.08, f1) * (np.random.default_rng(seed + 4).random(90 * 90)[cid] > 0.6)
    hgt = hgt - pits * 0.0015
    alb = lerp(alb, alb * 0.7, pits)
    if panel > 0:
        t = (np.arange(size) + 0.5) / size * tile
        U, Vv = np.meshgrid(t, t)
        d = np.minimum(np.mod(U, panel), np.mod(Vv, panel))
        j = smooth(0.012, 0.004, d)
        hgt -= j * 0.004
        alb = lerp(alb, alb * 0.6, j)
    surface(name, alb, hgt, np.clip(0.82 + 0.08 * grain, 0, 1), tile)


def brownstone():
    size, tile = 1024, 2.4
    mott = fbm(size, 5, 7, 0.6, seed=41)
    grain = fbm(size, 220, 3, seed=42)
    layer = fbm(size, 4, 6, 0.62, seed=43, cy=30)
    alb = lerp(rgb(104, 68, 52), rgb(132, 92, 70), smooth(-0.35, 0.45, mott))
    alb = alb * (1 + 0.1 * layer + 0.1 * grain)[..., None]
    t = (np.arange(size) + 0.5) / size * tile
    U, Vv = np.meshgrid(t, t)
    bh, bw = 0.4, 1.2
    row = np.floor(Vv / bh).astype(int)
    lu, lv = np.mod(U + (row % 2) * 0.6, bw), np.mod(Vv, bh)
    d = np.minimum(np.minimum(lu, bw - lu), np.minimum(lv, bh - lv))
    face = smooth(0.002, 0.006, d)
    alb = lerp(alb * 0.7, alb, face)
    hgt = face * 0.003 + grain * 0.0007 + mott * 0.002 + layer * 0.0008
    surface("brownstone", alb, hgt, np.clip(0.84 + 0.07 * grain, 0, 1), tile)


def terracotta(name, col, seed):
    ashlar(name, col, seed, tile=2.4, block_w=0.4, block_h=0.2, joint=0.007, tone_var=0.05, grain_amt=0.04,
           rough=0.48, stain=0.07, depth=0.005)


def roof_gravel():
    size, tile = 1024, 3.0
    f1, f2, cid = worley(size, 150, 51)
    tone = np.random.default_rng(52).random(150 * 150)[cid]
    stone = smooth(0.6, 0.3, f1)
    patch = smooth(0.05, 0.35, fbm(size, 3, 5, seed=53))
    alb = lerp(rgb(52, 50, 48), lerp(rgb(68, 64, 58), rgb(136, 126, 112), tone), stone)
    alb = lerp(alb, rgb(38, 38, 40) * (1 + 0.15 * fbm(size, 30, 4, seed=54))[..., None], patch)
    hgt = stone * (0.4 + tone) * 0.006 * (1 - patch)
    rough = np.clip(0.9 - 0.35 * patch, 0, 1)
    surface("roof", alb, hgt, rough, tile)


def wood():
    size, tile = 1024, 2.4
    t = (np.arange(size) + 0.5) / size * tile
    U, Vv = np.meshgrid(t, t)
    sw = tile / 18
    idx = np.floor(U / sw).astype(int) % 18
    rng = np.random.default_rng(61)
    tone = (1 + rng.normal(0, 0.13, 18))[idx]
    lu = np.mod(U, sw)
    gap = smooth(0.003, 0.012, np.minimum(lu, sw - lu))
    grain = fbm(size, 160, 4, 0.6, seed=62, cy=5)
    weather = fbm(size, 5, 6, seed=63, cy=2)
    alb = lerp(rgb(104, 78, 56), rgb(122, 112, 100), smooth(-0.3, 0.35, weather))
    alb = alb * (tone * (1 + 0.28 * grain))[..., None]
    alb = lerp(alb * 0.35, alb, gap)
    hgt = gap * 0.006 + grain * 0.0012 + np.sin(lu / sw * np.pi) * 0.004
    surface("wood", alb, hgt, np.clip(0.82 + 0.1 * grain, 0, 1), tile)


def bark():
    size, tile = 1024, 1.2
    wx, wy = fbm(size, 7, 5, seed=71) * 0.9, fbm(size, 7, 5, seed=72) * 0.9
    f1, f2, cid = worley(size, 9, 73, warp=(wx, wy))
    r = np.random.default_rng(74).random(81)[cid]
    pal = np.stack([rgb(168, 158, 128), rgb(122, 112, 88), rgb(92, 82, 66), rgb(142, 138, 112), rgb(186, 176, 150)])
    alb = pal[(r * 4.99).astype(int)]
    edge = smooth(0.0, 0.06, f2 - f1)
    grain = fbm(size, 128, 4, seed=75)
    alb = alb * (1 + 0.18 * grain)[..., None]
    alb = lerp(alb * 0.7, alb, edge)
    hgt = r * 0.003 + grain * 0.001 + (1 - edge) * -0.001
    surface("bark", alb, hgt, np.full((size, size), 0.9), tile)


def metal(name, col, seed, rust=0.0, tile=2.0, rough=0.45, size=512):
    mott = fbm(size, 6, 6, 0.55, seed=seed)
    grain = fbm(size, 128, 3, seed=seed + 1)
    alb = col * (1 + 0.07 * mott + 0.04 * grain)[..., None]
    r = np.clip(rough + 0.1 * mott + 0.05 * grain, 0.05, 1)
    hgt = grain * 0.00015 + mott * 0.0003
    if rust > 0:
        m = smooth(0.25 - rust * 0.4, 0.55 - rust * 0.4, fbm(size, 5, 7, 0.62, seed=seed + 2))
        rc = lerp(rgb(92, 48, 28), rgb(138, 84, 44), smooth(-0.3, 0.4, fbm(size, 30, 4, seed=seed + 3)))
        alb = lerp(alb, rc, m)
        r = lerp(r, 0.85, m)
        hgt = hgt + m * 0.0008
    surface(name, alb, hgt, r, tile)


# --------------------------------------------------------------------------- masks
def noise_rgba(size=1024):
    chans = [fbm(size, 4, 7, 0.55, seed=81), fbm(size, 11, 6, 0.55, seed=82),
             fbm(size, 32, 5, 0.55, seed=83), fbm(size, 96, 3, 0.55, seed=84)]
    out = []
    for c in chans:
        c = (c - c.mean()) / (c.std() * 4.4) + 0.5
        out.append(c)
    save_img("noise", np.stack(out, -1), "data")


def grime(size=1024):
    # R: vertical rain streaks, G: blotches, B: fine speckle, A: crack network
    streak = fbm(size, 90, 5, 0.6, seed=91, cy=3) * 0.7 + fbm(size, 220, 3, seed=92, cy=6) * 0.3
    streak = smooth(-0.08, 0.55, streak)
    blot = smooth(-0.15, 0.5, fbm(size, 5, 8, 0.6, seed=93))
    speck = smooth(-0.2, 0.6, fbm(size, 128, 3, seed=94))
    wx, wy = fbm(size, 8, 5, seed=95) * 1.4, fbm(size, 8, 5, seed=96) * 1.4
    f1, f2, _ = worley(size, 7, 97, warp=(wx, wy))
    crack = smooth(0.035, 0.004, f2 - f1) * smooth(-0.1, 0.3, fbm(size, 4, 4, seed=98))
    f1b, f2b, _ = worley(size, 23, 99, warp=(wx * 3, wy * 3))
    crack = np.maximum(crack, 0.6 * smooth(0.05, 0.008, f2b - f1b) * smooth(0.12, 0.4, fbm(size, 5, 4, seed=100)))
    save_img("grime", np.stack([streak, blot, speck, crack], -1), "data")


def gum(size=1024):
    """Gum spots and litter flecks for sidewalks (R gum, G pale litter), 6 m tile."""
    rng = np.random.default_rng(111)
    g = np.zeros((size, size))
    lit = np.zeros((size, size))
    yy, xx = np.mgrid[-14:15, -14:15]

    def stamp(img, cx, cy, rx, ry, ang, val):
        ca, sa = np.cos(ang), np.sin(ang)
        a = (xx * ca + yy * sa) / rx
        b = (-xx * sa + yy * ca) / ry
        m = np.clip((1 - np.sqrt(a * a + b * b)) * 3, 0, 1) * val
        iy = (cy + yy) % size
        ix = (cx + xx) % size
        img[iy, ix] = np.maximum(img[iy, ix], m)

    for _ in range(620):
        r = rng.uniform(2.0, 4.6)
        stamp(g, rng.integers(size), rng.integers(size), r, r * rng.uniform(0.7, 1.0), rng.uniform(0, 3.1), rng.uniform(0.35, 1.0))
    for _ in range(260):
        stamp(lit, rng.integers(size), rng.integers(size), rng.uniform(2.0, 9.0), rng.uniform(1.2, 3.0), rng.uniform(0, 3.1), rng.uniform(0.3, 1.0))
    save_img("gum", np.stack([g, lit, np.zeros_like(g)], -1), "data")


def snow_surface(size=1024, tile=3.0):
    h = fbm(size, 5, 6, 0.55, seed=121) * 0.018 + fbm(size, 40, 4, 0.6, seed=122) * 0.0035
    grain = fbm(size, 300, 2, seed=123)
    h += grain * 0.0008
    save_img("snow_n", normal_from_height(h, tile / size), "normal")


def drops_glass(size=512):
    """Static droplets + runnels for wet glass and car paint: RG = normal xy, B = mask."""
    rng = np.random.default_rng(131)
    hgt = np.zeros((size, size))
    yy, xx = np.mgrid[-9:10, -9:10]
    for _ in range(1500):
        r = rng.uniform(1.2, 4.5) if rng.random() < 0.97 else rng.uniform(5, 8)
        cx, cy = rng.integers(size), rng.integers(size)
        m = np.sqrt(np.clip(1 - (xx ** 2 + (yy * 0.85) ** 2) / (r * r), 0, 1)) * r
        iy, ix = (cy + yy) % size, (cx + xx) % size
        hgt[iy, ix] = np.maximum(hgt[iy, ix], m)
    n = normal_from_height(hgt, 1.0, 0.9)
    save_img("drops", np.stack([n[..., 0], n[..., 1], np.clip(hgt, 0, 1)], -1), "linear")


def water_normal(size=512, tile=14.0):
    h = fbm(size, 7, 6, 0.55, seed=141) * 0.09 + fbm(size, 24, 4, seed=142) * 0.015
    save_img("water_n", normal_from_height(h, tile / size), "normal")


def cloud_volume(res=128, tiles=8):
    """3D Perlin-Worley cloud noise, laid out as a tiles x tiles... atlas of res slices.

    R: base Perlin-Worley, G/B/A: Worley at rising frequencies (erosion detail)."""
    def worley3(cells, seed):
        rng = np.random.default_rng(seed)
        j = rng.uniform(0, 1, (cells, cells, cells, 3))
        t = (np.arange(res) + 0.5) / res * cells
        out = np.zeros((res, res, res), np.float32)
        for zi in range(res):
            Z = t[zi]
            X, Y = np.meshgrid(t, t)
            XI, YI = X.astype(int), Y.astype(int)
            zc = int(Z)
            best = np.full(X.shape, 9.0)
            for dz in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        cx, cy, cz = XI + dx, YI + dy, zc + dz
                        p = j[cz % cells, cy % cells, cx % cells]
                        d = (cx + p[..., 0] - X) ** 2 + (cy + p[..., 1] - Y) ** 2 + (cz + p[..., 2] - Z) ** 2
                        best = np.minimum(best, d)
            out[zi] = np.clip(1 - np.sqrt(best), 0, 1)
        return out

    def perlin3(cells, seed):
        rng = np.random.default_rng(seed)
        g = rng.normal(size=(cells, cells, cells, 3))
        g /= np.linalg.norm(g, axis=-1, keepdims=True)
        t = (np.arange(res) + 0.5) / res * cells
        i = t.astype(int)
        f = t - i
        out = np.zeros((res, res, res), np.float32)
        X, Y = np.meshgrid(f, f)
        XI, YI = np.meshgrid(i, i)
        for zi in range(res):
            zc, zf = i[zi], f[zi]
            acc = 0
            for dz in (0, 1):
                wz = _fade(zf) if dz else 1 - _fade(zf)
                for dy in (0, 1):
                    wy = _fade(Y) if dy else 1 - _fade(Y)
                    for dx in (0, 1):
                        wx = _fade(X) if dx else 1 - _fade(X)
                        gv = g[(zc + dz) % cells, (YI + dy) % cells, (XI + dx) % cells]
                        d = gv[..., 0] * (X - dx) + gv[..., 1] * (Y - dy) + gv[..., 2] * (zf - dz)
                        acc = acc + wx * wy * wz * d
            out[zi] = acc
        return out

    pf = perlin3(4, 151) + 0.5 * perlin3(8, 152) + 0.25 * perlin3(16, 153) + 0.125 * perlin3(32, 154)
    pf = np.clip(pf * 0.75 + 0.5, 0, 1)
    w4, w8, w16, w32 = worley3(4, 161), worley3(8, 162), worley3(16, 163), worley3(32, 164)
    wf1 = w4 * 0.625 + w8 * 0.25 + w16 * 0.125
    wf2 = w8 * 0.625 + w16 * 0.25 + w32 * 0.125
    pw = np.clip((pf - (wf1 - 1)) / (2 - wf1), 0, 1)

    def stretch(a):
        lo, hi = np.percentile(a, 1), np.percentile(a, 99.5)
        return np.clip((a - lo) / (hi - lo), 0, 1)

    vol = np.stack([stretch(pw), stretch(wf1), stretch(wf2), stretch(w16 * 0.7 + w32 * 0.3)], -1)
    cols = 16
    rows = res // cols
    atlas = np.zeros((rows * res, cols * res, 4), np.float32)
    for z in range(res):
        r, c = divmod(z, cols)
        atlas[r * res:(r + 1) * res, c * res:(c + 1) * res] = vol[z]
    save_img("cloudvol_atlas", atlas, "data")
    META["cloudvol"] = {"res": res}


def main():
    print("bricks")
    brick("brick_red", [rgb(138, 70, 52), rgb(124, 62, 48), rgb(150, 82, 60), rgb(112, 58, 46)], rgb(168, 158, 144), 1)
    brick("brick_buff", [rgb(186, 154, 112), rgb(172, 140, 100), rgb(196, 166, 124), rgb(160, 132, 98)], rgb(180, 172, 158), 2,
          tone_var=0.06, dark_chance=0.03)
    brick("brick_brown", [rgb(106, 74, 56), rgb(92, 64, 50), rgb(118, 84, 62), rgb(78, 56, 46)], rgb(140, 130, 118), 3)
    brick("brick_white", [rgb(196, 190, 178), rgb(204, 198, 186), rgb(186, 180, 168)], rgb(158, 152, 142), 4,
          tone_var=0.04, rough=0.62, dark_chance=0.03)
    brick("brick_black", [rgb(36, 33, 32), rgb(44, 40, 38), rgb(30, 28, 28)], rgb(60, 56, 52), 5, tone_var=0.1,
          rough=0.55, dark_chance=0.0)
    brick("brick_gray", [rgb(138, 132, 124), rgb(124, 120, 114), rgb(150, 144, 134)], rgb(160, 154, 146), 6, tone_var=0.06)
    print("stone")
    ashlar("limestone", rgb(190, 178, 156), 11, vein=0.0, speck=0.04)
    ashlar("limestone_dark", rgb(150, 138, 118), 12, speck=0.05, stain=0.1)
    ashlar("marble", rgb(210, 204, 190), 13, tile=4.0, block_w=1.33, block_h=0.5, vein=0.55, vein_col=rgb(140, 134, 124),
           rough=0.6, stain=0.06, tone_var=0.04)
    ashlar("granite", rgb(92, 82, 76), 14, tile=2.4, block_w=1.2, block_h=0.6, joint=0.004, speck=0.3, rough=0.32,
           tone_var=0.03, stain=0.03, depth=0.002)
    ashlar("granite_pink", rgb(146, 122, 108), 15, tile=2.4, block_w=1.2, block_h=0.6, joint=0.004, speck=0.26, rough=0.4)
    brownstone()
    terracotta("terracotta", rgb(196, 176, 144), 16)
    terracotta("terracotta_white", rgb(204, 200, 188), 17)
    concrete("concrete", rgb(138, 134, 126), 31)
    concrete("concrete_panel", rgb(166, 158, 144), 32, panel=1.0, stain=0.07)
    concrete("stucco", rgb(176, 164, 142), 33, tile=3.0, stain=0.07)
    print("ground")
    asphalt()
    sidewalk()
    roof_gravel()
    print("misc")
    wood()
    bark()
    metal("metal_paint", rgb(200, 200, 200), 171)
    metal("metal_rust", rgb(70, 66, 62), 172, rust=0.35, rough=0.55)
    metal("steel", rgb(168, 170, 172), 173, rough=0.32)
    noise_rgba()
    grime()
    gum()
    snow_surface()
    drops_glass()
    water_normal()
    print("cloud volume")
    cloud_volume()
    with open(os.path.join(OUT, "textures.json"), "w") as f:
        json.dump({"meta": META, "files": FILES}, f, indent=1)
    print("textures:", len(FILES))


if __name__ == "__main__":
    main()
