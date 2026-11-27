"""Bare winter London planes (recursive branching) and Bryant Park in December."""
import math

import numpy as np

import city as C
import citydata as D
import kits
from meshlib import MeshBuilder, norm, v


def plane_tree(seed, height=11.0, trunk_r=0.24, levels=5, lit=False, spread=1.0):
    rng = np.random.default_rng(seed)
    mb = MeshBuilder()
    lights = []

    def perp(d):
        ref = v(0, 0, 1) if abs(d[2]) < 0.9 else v(1, 0, 0)
        a = norm(np.cross(d, ref))
        return a, np.cross(d, a)

    def branch(p, d, length, r, level):
        segs = 4 if level < 2 else 3
        pts, radii = [p], [r]
        q, dd = p.copy(), d.copy()
        for i in range(segs):
            wob = rng.normal(0, 0.13 if level else 0.05, 3)
            dd = norm(dd + wob + v(0, 0, 0.07 if level > 1 else 0.02))
            q = q + dd * (length / segs)
            pts.append(q.copy())
            radii.append(r * (1 - 0.34 * (i + 1) / segs))
        sides = [12, 9, 6, 4, 3, 3][min(level, 5)]
        slot = "bark" if level < 4 else "twig"
        mb.tube(pts, radii, sides, slot, caps=False)
        if lit and level <= 2:
            for i in range(segs):
                a, b = pts[i], pts[i + 1]
                seg_len = np.linalg.norm(b - a)
                n = int(seg_len / 0.11) + 1
                u, w = perp(norm(b - a))
                for k in range(n):
                    t = k / n
                    ang = (k * 1.9 + i * 3.1)
                    rr = radii[i] + 0.015
                    lights.append(a + (b - a) * t + (u * math.cos(ang) + w * math.sin(ang)) * rr)
        if level >= levels:
            return
        a, b = perp(dd)
        kids = int(rng.integers(3, 5)) if level < 3 else int(rng.integers(3, 6))
        phase = rng.uniform(0, 6.28)
        for k in range(kids):
            ang = phase + 2 * math.pi * k / kids + rng.uniform(-0.4, 0.4)
            tilt = rng.uniform(0.42, 0.95) * spread
            nd = norm(dd * math.cos(tilt) + (a * math.cos(ang) + b * math.sin(ang)) * math.sin(tilt) + v(0, 0, 0.24))
            along = 1.0 if k < 2 else rng.uniform(0.45, 0.95)
            idx = along * segs
            i0 = min(int(idx), segs - 1)
            sp = pts[i0] + (pts[i0 + 1] - pts[i0]) * (idx - i0)
            branch(sp, nd, length * rng.uniform(0.62, 0.8), radii[min(i0 + 1, segs)] * rng.uniform(0.55, 0.72), level + 1)

    fork = height * 0.28
    mb.lathe((0, 0, -0.05), [(trunk_r * 1.55, 0), (trunk_r * 1.15, 0.25), (trunk_r, 0.7)], "bark", segments=14)
    trunk = [v(0, 0, 0.6), v(rng.normal(0, 0.05), rng.normal(0, 0.05), fork * 0.6), v(rng.normal(0, 0.1), rng.normal(0, 0.1), fork)]
    mb.tube(trunk, [trunk_r, trunk_r * 0.92, trunk_r * 0.85], 14, "bark", caps=False)
    if lit:
        for k in range(int(fork / 0.05)):
            z = 0.5 + k * 0.05 * (fork - 0.5) / fork
            ang = k * 0.9
            lights.append(v(math.cos(ang) * (trunk_r + 0.015), math.sin(ang) * (trunk_r + 0.015), z))
    top = trunk[-1]
    n = int(rng.integers(3, 6))
    for k in range(n):
        ang = 2 * math.pi * k / n + rng.uniform(-0.3, 0.3)
        tilt = rng.uniform(0.3, 0.8) * spread
        d = norm(v(math.sin(tilt) * math.cos(ang), math.sin(tilt) * math.sin(ang), math.cos(tilt)))
        branch(top.copy(), d, height * rng.uniform(0.24, 0.32), trunk_r * rng.uniform(0.5, 0.66), 1)
    branch(top.copy(), v(rng.normal(0, 0.1), rng.normal(0, 0.1), 1.0), height * 0.3, trunk_r * 0.6, 1)
    # fine twig sprays that give a winter crown its haze
    for p in lights:
        _bulb(mb, p, 0.017, "fairy_light")
    return mb


def _bulb(mb, c, r, slot):
    x, y, z = c
    top, bot = (x, y, z + r), (x, y, z - r)
    ring = [(x + r, y, z), (x, y + r, z), (x - r, y, z), (x, y - r, z)]
    for i in range(4):
        a, b = ring[i], ring[(i + 1) % 4]
        mid = np.array(a) + np.array(b) - 2 * np.array(c)
        mb.poly([a, b, top], slot, normal=mid + (0, 0, r))
        mb.poly([b, a, bot], slot, normal=mid - (0, 0, r))


def holiday_tree(height=17.0, seed=4):
    """The tall evergreen dressed for the season."""
    rng = np.random.default_rng(seed)
    mb = MeshBuilder()
    mb.cylinder((0, 0, 0), 1.4, 0.34, "bark", segments=10)
    tiers = 46
    for i in range(tiers):
        t = i / (tiers - 1)
        z = 1.0 + t * (height - 1.8)
        rad = (1 - t) * height * 0.24 + 0.45
        n = int(11 + rad * 7)
        for k in range(n):
            a = 2 * math.pi * (k + 0.37 * i) / n + rng.uniform(-0.25, 0.25)
            ca, sa = math.cos(a), math.sin(a)
            r = rad * rng.uniform(0.6, 1.12)
            zz = z + rng.uniform(-0.22, 0.22)
            root = v(0.15 * ca, 0.15 * sa, zz + 0.45)
            tip = v(r * ca, r * sa, zz - rng.uniform(0.05, 0.45))
            side = v(-sa, ca, 0) * (0.11 + rad * 0.075)
            mid = root + (tip - root) * 0.62 + v(0, 0, 0.05)
            mb.poly([root, mid + side, tip], "needle", normal=(ca * 0.3, sa * 0.3, 1))
            mb.poly([root, tip, mid - side], "needle", normal=(ca * 0.3, sa * 0.3, 1))
            mb.poly([root, tip, mid + v(0, 0, -0.28)], "needle", normal=(-sa, ca, 0))
            if rng.random() < 0.75:
                _bulb(mb, tip + v(0, 0, 0.05), 0.045, ["fairy_light", "fairy_light", "fairy_light", "fairy_blue", "fairy_red"][int(rng.integers(5))])
            if rng.random() < 0.42:
                _bulb(mb, mid + side * 0.8 + v(0, 0, 0.04), 0.035, "fairy_light")
    _bulb(mb, v(0, 0, height + 0.15), 0.42, "fairy_light")
    return mb


def bench():
    mb = MeshBuilder()
    for x in (-0.8, 0.8):
        mb.box((x - 0.04, -0.28, 0), (x + 0.04, 0.22, 0.44), "iron_black")
        mb.tube([(x, -0.25, 0.4), (x, -0.36, 0.92)], 0.03, 6, "iron_black")
    for i in range(5):
        y = -0.24 + i * 0.11
        mb.box((-0.9, y, 0.43), (0.9, y + 0.085, 0.465), "wood")
    for i in range(4):
        z = 0.55 + i * 0.1
        mb.box((-0.9, -0.31 - 0.02 * i, z), (0.9, -0.275 - 0.02 * i, z + 0.075), "wood")
    return mb


def cafe_set():
    """The little green folding table and chairs."""
    mb = MeshBuilder()
    mb.lathe((0, 0, 0.72), [(0.38, 0), (0.38, 0.02), (0.0, 0.02)], "paint_darkgreen", segments=14)
    mb.cylinder((0, 0, 0), 0.72, 0.025, "paint_darkgreen", segments=6)
    for ang in (0.5, 2.7, 4.6):
        c = v(0.68 * math.cos(ang), 0.68 * math.sin(ang), 0)
        ch = MeshBuilder()
        for sx in (-0.19, 0.19):
            ch.tube([(sx, -0.19, 0), (sx, 0.17, 0.45)], 0.012, 4, "paint_darkgreen")
            ch.tube([(sx, 0.19, 0), (sx, -0.2, 0.9)], 0.012, 4, "paint_darkgreen")
        for y in np.arange(-0.17, 0.18, 0.07):
            ch.box((-0.2, y, 0.44), (0.2, y + 0.045, 0.455), "paint_darkgreen")
        for z in (0.72, 0.82):
            ch.box((-0.2, -0.2, z), (0.2, -0.18, z + 0.06), "paint_darkgreen")
        mb.merge(ch, offset=c, yaw=math.degrees(ang) - 90)
    return mb


def kiosk(seed=0):
    """A holiday-market booth: dark green frame, glass walls, warm light and a pitched roof."""
    mb = MeshBuilder()
    w, d, h = 3.2, 2.4, 2.65
    G = "paint_darkgreen"
    for x in (-w / 2, w / 2):
        for y in (-d / 2, d / 2):
            mb.box((x - 0.05, y - 0.05, 0), (x + 0.05, y + 0.05, h), G)
    mb.box((-w / 2, -d / 2, 0), (w / 2, d / 2, 0.08), G)
    mb.box((-w / 2 + 0.02, -d / 2, 0.08), (w / 2 - 0.02, -d / 2 + 0.05, 0.9), G)
    for x, s in ((-w / 2, -1), (w / 2, 1)):
        mb.box((min(x, x - s * 0.05), -d / 2, 0.08), (max(x, x - s * 0.05), d / 2, 0.9), G)
    mb.box((-w / 2, d / 2 - 0.35, 0.85), (w / 2, d / 2 + 0.08, 0.93), "wood")
    mb.box((-w / 2, d / 2 - 0.08, 0.08), (w / 2, d / 2 - 0.03, 0.85), G)
    room = (-w / 2, w / 2, 0.0, h)
    # back and side glazing show an interior-mapped stall
    pts = [(w / 2, -d / 2 + 0.03, 0.9), (-w / 2, -d / 2 + 0.03, 0.9), (-w / 2, -d / 2 + 0.03, h - 0.1), (w / 2, -d / 2 + 0.03, h - 0.1)]
    mb.poly(pts, "glass_kiosk", normal=(0, -1, 0), uv=[(0, 0.9), (w, 0.9), (w, h - 0.1), (0, h - 0.1)], uv1=[(w, h)] * 4)
    for x, s in ((-w / 2 + 0.03, -1), (w / 2 - 0.03, 1)):
        pts = [(x, -d / 2, 0.9), (x, d / 2, 0.9), (x, d / 2, h - 0.1), (x, -d / 2, h - 0.1)]
        if s < 0:
            pts = pts[::-1]
        uvs = [(p[1] + d / 2, p[2]) for p in pts]
        mb.poly(pts, "glass_kiosk", normal=(s, 0, 0), uv=uvs, uv1=[(d, h)] * 4)
    # open counter: shelves of goods and a glowing ceiling
    rng = np.random.default_rng(seed + 9)
    for z in (1.35, 1.8):
        mb.box((-w / 2 + 0.1, -d / 2 + 0.08, z), (w / 2 - 0.1, -d / 2 + 0.34, z + 0.03), "wood")
        x = -w / 2 + 0.18
        while x < w / 2 - 0.25:
            ww, hh = rng.uniform(0.09, 0.22), rng.uniform(0.1, 0.32)
            mb.box((x, -d / 2 + 0.12, z + 0.03), (x + ww, -d / 2 + 0.28, z + 0.03 + hh), ["paint_red", "paint_cream", "paint_blue", "paint_yellow", "paint_white", "fabric_green"][int(rng.integers(6))])
            x += ww + rng.uniform(0.03, 0.1)
    for _ in range(14):
        x, y = rng.uniform(-1.4, 1.4), rng.uniform(d / 2 - 0.3, d / 2 - 0.02)
        mb.sphere((x, y, 1.02), rng.uniform(0.04, 0.11), ["paint_red", "paint_cream", "gold", "paint_white"][int(rng.integers(4))], segments=8, rings=5)
    mb.box((-w / 2 + 0.2, -d / 2 + 0.2, h - 0.09), (w / 2 - 0.2, d / 2 - 0.25, h - 0.06), "kiosk_light", faces="z")
    mb.box((-w / 2, -d / 2, h), (w / 2, d / 2 + 0.45, h + 0.14), G)
    quad = [(-w / 2 + 0.2, d / 2 + 0.46, h + 0.0), (w / 2 - 0.2, d / 2 + 0.46, h + 0.0), (w / 2 - 0.2, d / 2 + 0.46, h + 0.42), (-w / 2 + 0.2, d / 2 + 0.46, h + 0.42)]
    mb.poly(quad, "sign_shop", normal=(0, 1, 0), uv=[(0, 1), (1, 1), (1, 0), (0, 0)])
    for s in (-1, 1):
        mb.quad((-w / 2 - 0.1, s * (d / 2 + 0.1), h + 0.14), (w / 2 + 0.1, s * (d / 2 + 0.1), h + 0.14),
                (w / 2 + 0.1, 0, h + 0.62), (-w / 2 - 0.1, 0, h + 0.62), "kiosk_roof", normal=(0, s * 0.5, 1))
    for x, s in ((-w / 2 - 0.1, -1), (w / 2 + 0.1, 1)):
        mb.poly([(x, -d / 2 - 0.1, h + 0.14), (x, d / 2 + 0.1, h + 0.14), (x, 0, h + 0.62)], G, normal=(s, 0, 0))
    x = -w / 2
    while x < w / 2 + 0.01:
        _bulb(mb, (x, d / 2 + 0.47, h - 0.03), 0.03, "fairy_light")
        x += 0.14
    return mb


def carousel():
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(3.6, 0), (3.6, 0.28), (3.4, 0.3), (0.0, 0.3)], "wood", segments=36)
    mb.cylinder((0, 0, 0.3), 3.1, 0.45, "gold", segments=16)
    mb.lathe((0, 0, 3.35), [(3.75, 0), (3.75, 0.45), (3.55, 0.52), (1.4, 1.35), (0.3, 1.75), (0.0, 2.2)], "carousel_roof", segments=16)
    mb.lathe((0, 0, 3.33), [(0.0, 0.0), (3.7, 0.02)], "kiosk_light", segments=16)
    for k in range(60):
        a = 2 * math.pi * k / 60
        _bulb(mb, (3.78 * math.cos(a), 3.78 * math.sin(a), 3.42), 0.055, "fairy_light")
    for k in range(12):
        a = 2 * math.pi * k / 12
        x, y = 2.7 * math.cos(a), 2.7 * math.sin(a)
        mb.tube([(x, y, 0.3), (x, y, 3.35)], 0.03, 6, "gold", caps=False)
        z = 1.15 + 0.28 * (k % 3)
        mb.sphere((x, y, z), 0.36, ["paint_white", "paint_cream", "paint_brown"][k % 3], segments=10, rings=7, scale=(1.35 if k % 2 else 0.7, 0.7 if k % 2 else 1.35, 0.85))
        tx, ty = -math.sin(a), math.cos(a)
        mb.tube([(x + tx * 0.3, y + ty * 0.3, z + 0.1), (x + tx * 0.55, y + ty * 0.55, z + 0.55)], [0.14, 0.1], 8, "paint_white")
    return mb


def rink_boards(w, h):
    mb = MeshBuilder()
    pts = []
    r = 4.0
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(9):
            a = math.radians(a0 + 90 * k / 8)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 0.05:
            continue
        yaw = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        mb.obox((mx, my, 0.5), (L + 0.03, 0.1, 1.0), yaw, "paint_white")
        mb.obox((mx, my, 1.03), (L + 0.03, 0.16, 0.07), yaw, "paint_blue")
        mb.obox((mx, my, 0.1), (L + 0.03, 0.13, 0.18), yaw, "paint_yellow")
        k = int(L / 0.5) + 1
        for j in range(k):
            t = (j + 0.5) / k
            px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            _bulb(mb, (px * 1.004, py * 1.004, 1.1), 0.025, "fairy_light")
    mb.poly([(p[0], p[1], 0.04) for p in pts], "ice", normal=(0, 0, 1))
    return mb


def all_meshes():
    return {"tree0": plane_tree(11, 10.5, 0.2, 5), "tree1": plane_tree(23, 11.5, 0.22, 5), "tree2": plane_tree(37, 9.5, 0.18, 5, spread=1.15),
            "planetree0": plane_tree(101, 17.5, 0.42, 5, spread=1.05), "planetree1": plane_tree(131, 16.0, 0.38, 5, spread=1.1),
            "littree0": plane_tree(171, 13.0, 0.3, 5, lit=True), "littree1": plane_tree(191, 12.0, 0.27, 5, lit=True, spread=1.1),
            "holidaytree": holiday_tree(), "bench": bench(), "cafeset": cafe_set(), "kiosk0": kiosk(0), "kiosk1": kiosk(1),
            "kiosk2": kiosk(2), "carousel": carousel()}


def bryant_park(city):
    c = city
    rng = c.rng
    x0, x1, y0, y1 = D.LOTS["bryant"]
    base = 0.2
    sh = c.shell((x0 + x1) / 2, (y0 + y1) / 2, "park")
    sh.quad((x0, y0, base), (x1, y0, base), (x1, y1, base), (x0, y1, base), "park_paving", normal=(0, 0, 1), color=(1, 0, 0.3, 1))
    # the lawn, which in December carries the rink
    lx0, lx1, ly0, ly1 = -114.0, -56.0, -264.0, -150.0
    sh.box((lx0 - 3, ly0 - 3, base), (lx1 + 3, ly1 + 3, base + 0.06), "grass_dry", faces="Z")
    sh.sweep([(0.0, 0.0), (0.35, 0.0), (0.35, 0.34), (0.0, 0.34)], [(lx0 - 3, ly0 - 3), (lx1 + 3, ly0 - 3), (lx1 + 3, ly1 + 3), (lx0 - 3, ly1 + 3)], "limestone_dark", z=base)
    rw, rh = lx1 - lx0 - 8, ly1 - ly0 - 22
    rcx, rcy = (lx0 + lx1) / 2, (ly0 + ly1) / 2 - 6
    sh.merge(rink_boards(rw, rh), offset=(rcx, rcy, base + 0.08))
    for dx in (-rw / 2 - 1.0, rw / 2 + 1.0):
        for dy in (-rh * 0.34, 0.0, rh * 0.34):
            px, py = rcx + dx, rcy + dy
            sh.tube([(px, py, base), (px, py, base + 7.0)], 0.09, 8, "paint_darkgreen")
            sh.box((px - 0.35, py - 0.2, base + 6.8), (px + 0.35, py + 0.2, base + 7.15), "canopy_light")
            c.light((px - 0.5 * np.sign(dx), py, base + 6.7), (-np.sign(dx) * 0.75, 0.0, -1.0), (0.78, 0.88, 1.0), 6500, 32, 58.0, C.LK_PARK, shadows=True)
    # the holiday tree at the library end of the lawn
    htx, hty = rcx, ly1 - 5.0
    c.inst("holidaytree", (htx, hty, base), 0.0, 1.0)
    for a in range(4):
        ang = a * math.pi / 2 + 0.4
        c.light((htx + 4.6 * math.cos(ang), hty + 4.6 * math.sin(ang), 2.0), (-math.cos(ang), -math.sin(ang), 1.3), (1.0, 0.76, 0.46), 500, 18, 55.0, C.LK_HOLIDAY, shadows=False)
    c.light((htx, hty, 9.0), (0, 0, -1), (1.0, 0.72, 0.4), 900, 20, 0.0, C.LK_HOLIDAY, shadows=False)
    # allees of plane trees along the north and south sides, three rows deep
    for row, x in enumerate((-47.5, -39.5, -31.5, -122.5, -130.5, -138.5)):
        y = y0 + 14.0 + (row % 2) * 3.0
        while y < y1 - 12:
            lit = row in (0, 3) and rng.random() < 0.65
            mesh = ("littree%d" % int(rng.integers(2))) if lit else ("planetree%d" % int(rng.integers(2)))
            c.inst(mesh, (x + float(rng.uniform(-0.5, 0.5)), y, base), float(rng.uniform(0, 360)), float(rng.uniform(0.85, 1.08)))
            y += 9.2
    # holiday market: two lanes of booths facing each other
    for x, yaw in ((-24.0, 180.0), (-146.5, 0.0)):
        y = y0 + 20.0
        while y < y1 - 16:
            k = int(rng.integers(3))
            c.inst("kiosk%d" % k, (x, y, base), yaw, 1.0, custom=(float(rng.integers(48)), 0.8, 0.0, float(rng.random())))
            if rng.random() < 0.6:
                c.light((x + (-1.9 if yaw > 90 else 1.9), y, base + 2.45), (0, 0, -1), (1.0, 0.74, 0.44), float(rng.uniform(320, 520)), 8, -1, C.LK_HOLIDAY, shadows=False, rect=(280, 60), volumetric=0.4)
            c.add_cover(x - 1.8, x + 1.8, y - 1.8, y + 1.8, base + 2.7)
            y += 4.4 if rng.random() < 0.8 else 8.0
    y = ly0 - 14.0
    x = -108.0
    while x < -58:
        c.inst("kiosk%d" % int(rng.integers(3)), (x, y, base), 90.0, 1.0, custom=(float(rng.integers(48)), 0.8, 0.0, float(rng.random())))
        if rng.random() < 0.6:
            c.light((x, y + 1.9, base + 2.45), (0, 0, -1), (1.0, 0.74, 0.44), 420, 8, -1, C.LK_HOLIDAY, shadows=False, rect=(280, 60), volumetric=0.4)
        x += 4.4
    c.inst("carousel", (-136.0, -128.0, base), 0.0, 1.0)
    c.light((-136.0, -128.0, base + 3.0), (0, 0, -1), (1.0, 0.72, 0.42), 900, 14, 0.0, C.LK_HOLIDAY, shadows=False)
    # furniture and lamps
    for x in (-52.0, -118.0):
        y = y0 + 18.0
        while y < y1 - 12:
            c.inst("parklamp", (x, y, base), 0.0, 1.1)
            c.light((x, y, base + 3.85), (0, 0, -1), (1.0, 0.74, 0.46), 160, 12, 0.0, C.LK_PARK, shadows=False, volumetric=1.2)
            y += 17.0
    for _ in range(46):
        x = float(rng.choice([-43.5, -35.5, -126.5, -134.5]))
        y = float(rng.uniform(y0 + 14, y1 - 14))
        c.inst("cafeset", (x + float(rng.uniform(-1, 1)), y, base), float(rng.uniform(0, 360)), 1.0, rt=False)
    for y in np.arange(y0 + 20, y1 - 20, 7.0):
        c.inst("bench", (-53.5, float(y), base), -90.0, rt=False)
        c.inst("bench", (-116.5, float(y), base), 90.0, rt=False)
    # the pink granite fountain at the Sixth Avenue end
    fx, fy = -84.0, y0 + 8.0
    sh.lathe((fx, fy, base), [(5.4, 0), (5.5, 0.75), (5.0, 0.8), (4.8, 0.45), (0.0, 0.45)], "granite_pink", segments=40)
    sh.lathe((fx, fy, base + 0.45), [(1.2, 0), (0.5, 0.6), (0.75, 1.4), (2.4, 1.9), (2.45, 2.05), (1.9, 2.0), (0.4, 2.1), (0.35, 3.0), (1.1, 3.3), (0.2, 3.35), (0.15, 4.0)], "granite_pink", segments=28)
    # balustrade wall on the avenue edge, with stair openings
    y = y0 + 0.6
    for xa, xb in ((x0 + 2, -104.0), (-98.0, -72.0), (-66.0, x1 - 2)):
        sh.box((xa, y - 0.3, base), (xb, y + 0.3, base + 0.95), "limestone_dark")
        sh.box((xa, y - 0.38, base + 0.95), (xb, y + 0.38, base + 1.08), "limestone_trim")
