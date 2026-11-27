"""The landmarks that make it New York: modelled individually."""
import math

import numpy as np

import citydata as D
import city as C
from building import Building, make_style, FACES, face_geom, MOD
from meshlib import MeshBuilder, v


def style(city, name, **over):
    s = make_style(name, city.rng)
    o = over.pop("o", None)
    s.update(over)
    if o:
        s["o"].update(o)
    s["tint"] = (1.0, 1.0, 1.0)
    return s


def rect_c(cx, cy, wx, wy):
    return (cx - wx / 2, cx + wx / 2, cy - wy / 2, cy + wy / 2)


def floods(city, rect, z, color, intensity, reach=40.0, height=18.0, step=16.0, kind=C.LK_LANDMARK, faces="SNWE", offset=2.2, aim=1.0):
    """Facade floodlights sitting on a ledge, aimed back up the wall."""
    for f in faces:
        (lx, ly), L = face_geom(rect, f)
        n_, r, _ = FACES[f]
        k = max(1, int(L / step))
        for i in range(k):
            a = L * (i + 0.5) / k
            pos = (lx + r[0] * a + n_[0] * offset, ly + r[1] * a + n_[1] * offset, z + 0.6)
            city.light(pos, (-n_[0] * 0.32 * aim, -n_[1] * 0.32 * aim, 1.0), color, intensity, reach, 42.0, kind, shadows=False, source=20, volumetric=0.25)


# =========================================================================== Empire State
def empire_state(city):
    x0, x1, y0, y1 = D.LOTS["esb"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = style(city, "deco", mod="deco", base="rust", base_floors=2, cornice="string", tank=0.0, ac=0.0, pier=(0.7, 0.9),
              o={"wall": "limestone", "trim": "limestone_trim", "spandrel": "aluminium", "frame": "paint_darkgray", "glass": "glass_office"})
    # (x width, y width, z0, z1) following the real setback stack
    steps = [(x1 - x0, y1 - y0, 0.0, 24.0), (53.0, 106.0, 24.0, 84.0), (47.0, 86.0, 84.0, 101.0), (43.0, 72.0, 101.0, 122.0),
             (38.0, 56.0, 122.0, 268.0), (33.0, 48.0, 268.0, 288.0), (28.0, 39.0, 288.0, 305.0), (24.0, 31.0, 305.0, 320.0)]
    tiers = [(rect_c(cx, cy, wx, wy), za, zb) for wx, wy, za, zb in steps]
    b = Building(city, (x0, x1, y0, y1), 320.0, s, "SNWE", detail=0, tiers=tiers, signs=False, clutter=False)
    b.build()
    sh = city.shell(cx, cy, "landmark")
    # the shaft's shoulders: shallow projecting wings on the long faces give the notched plan
    for dz0, dz1, wx, wy in ((122.0, 250.0, 42.5, 24.0),):
        wing = rect_c(cx, cy, wx, wy)
        wb = Building(city, wing, dz1, s, "SN", detail=0, tiers=[(wing, dz0, dz1)], signs=False, clutter=False)
        wb.s["cornice"] = None
        for f in "SN":
            wb.band(wing, f, dz0, dz1, "deco", 3.5, 0.4)
        sh.quad((wing[0], wing[2], dz1), (wing[1], wing[2], dz1), (wing[1], wing[3], dz1), (wing[0], wing[3], dz1), "roof", normal=(0, 0, 1))
        for f in "WE":
            (lx, ly), L = face_geom(wing, f)
            n_, r, _ = FACES[f]
            sh.quad((lx, ly, dz0), (lx + r[0] * L, ly + r[1] * L, dz0), (lx + r[0] * L, ly + r[1] * L, dz1), (lx, ly, dz1), "limestone", normal=(n_[0], n_[1], 0))
    # steel mullion blades that catch the light up the shaft
    shaft = rect_c(cx, cy, 38.0, 56.0)
    for f in "SNWE":
        (lx, ly), L = face_geom(shaft, f)
        n_, r, yaw = FACES[f]
        n, sx, p = b.bays(L, "deco", s["_pier"])
        for i in range(n + 1):
            a = p + i * 1.75 * sx
            m = MeshBuilder()
            m.box((-0.05, 0.14, 122.0), (0.05, 0.22, 268.0), "steel_bright", faces="xXY")
            sh.merge(m, offset=(lx + r[0] * a, ly + r[1] * a, 0), yaw=yaw)
    # the 86th floor terrace rail and the mooring mast
    top = rect_c(cx, cy, 24.0, 31.0)
    sh.box((top[0] - 0.4, top[2] - 0.4, 320.0), (top[1] + 0.4, top[3] + 0.4, 321.0), "limestone_trim")
    for f in "SNWE":
        (lx, ly), L = face_geom(top, f)
        n_, r, yaw = FACES[f]
        a = 0.0
        while a <= L:
            sh.tube([(lx + r[0] * a, ly + r[1] * a, 321.0), (lx + r[0] * a + n_[0] * 0.3, ly + r[1] * a + n_[1] * 0.3, 323.2)], 0.07, 4, "steel", caps=False)
            a += 1.0
    sh.box((cx - 8.5, cy - 10.5, 321.0), (cx + 8.5, cy + 10.5, 330.0), "aluminium", faces="xXyYZ")
    sh.box((cx - 8.7, cy - 10.7, 323.0), (cx + 8.7, cy + 10.7, 327.5), "crown_glow", faces="xXyY")
    # mast: octagonal glazed core with four stepped wings
    sh.lathe((cx, cy, 330.0), [(6.2, 0), (5.4, 6), (5.0, 7), (4.6, 28), (4.9, 28.6), (4.9, 30)], "aluminium", segments=16)
    for k in range(16):
        ang = k * math.pi / 8
        sh.tube([(cx + 5.45 * math.cos(ang), cy + 5.45 * math.sin(ang), 330.5), (cx + 4.72 * math.cos(ang), cy + 4.72 * math.sin(ang), 358)], 0.13, 4, "steel_bright", caps=False)
    sh.lathe((cx, cy, 332.0), [(5.5, 0), (4.74, 25.5)], "mast_glow", segments=16)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for za, zb, reach, w in ((330, 343, 9.8, 2.6), (343, 350, 8.0, 2.2), (350, 356, 6.4, 1.8), (356, 361, 5.4, 1.4)):
            lo = (cx + (dx * 3.5 if dx else -w / 2), cy + (dy * 3.5 if dy else -w / 2), za)
            hi = (cx + (dx * reach if dx else w / 2), cy + (dy * reach if dy else w / 2), zb)
            sh.box((min(lo[0], hi[0]), min(lo[1], hi[1]), za), (max(lo[0], hi[0]), max(lo[1], hi[1]), zb), "aluminium")
    sh.lathe((cx, cy, 360.0), [(5.1, 0), (4.4, 4), (4.4, 7), (3.6, 9), (3.0, 13), (1.9, 15.5), (1.5, 19), (0.8, 21)], "aluminium", segments=20)
    sh.lathe((cx, cy, 364.2), [(4.45, 0), (4.45, 2.6)], "crown_glow", segments=20)
    # broadcast antenna
    for za, zb, r0, r1 in ((381, 396, 1.3, 1.1), (396, 414, 0.8, 0.65), (414, 430, 0.45, 0.35), (430, 443, 0.18, 0.08)):
        sh.cylinder((cx, cy, za), zb - za, r0, "paint_gray", segments=10, r1=r1)
        z = za + 1.0
        while z < zb - 1:
            sh.box((cx - r0 - 0.5, cy - 0.12, z), (cx + r0 + 0.5, cy + 0.12, z + 0.5), "paint_white")
            z += 2.6
    city.inst("beacon", (cx, cy, 443.2), 0, 1.4, custom=(1.0, 0.04, 0.02, 0.1))
    # floodlighting: warm white on the upper setbacks, holiday colour on the mast
    for wx, wy, z, inten in ((38.0, 56.0, 268.0, 26000), (33.0, 48.0, 288.0, 22000), (28.0, 39.0, 305.0, 20000)):
        floods(city, rect_c(cx, cy, wx, wy), z, (1.0, 0.93, 0.82), inten, reach=36, step=11)
    floods(city, rect_c(cx, cy, 47.0, 86.0), 101.0, (1.0, 0.9, 0.72), 9000, reach=30, step=18)
    floods(city, rect_c(cx, cy, 17.0, 21.0), 321.2, (1.0, 0.08, 0.05), 30000, reach=44, step=30, faces="SN", offset=3.5)
    floods(city, rect_c(cx, cy, 17.0, 21.0), 321.2, (0.05, 1.0, 0.22), 30000, reach=44, step=30, faces="WE", offset=3.5)
    return (cx, cy, 443.0)


# =========================================================================== Chrysler
def chrysler(city):
    x0, x1, y0, y1 = D.LOTS["chrysler"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = style(city, "deco", mod="decon", base="rust", base_floors=2, cornice="string", tank=0.0, pier=(1.0, 1.3),
              o={"wall": "brick_white", "trim": "granite_black", "spandrel": "paint_gray", "frame": "paint_darkgray", "glass": "glass_office"})
    steps = [(x1 - x0, y1 - y0, 0.0, 62.0), (51.0, 51.0, 62.0, 88.0), (40.0, 40.0, 88.0, 116.0), (31.0, 31.0, 116.0, 214.0), (26.0, 26.0, 214.0, 242.0)]
    tiers = [(rect_c(cx, cy, wx, wy), za, zb) for wx, wy, za, zb in steps]
    b = Building(city, (x0, x1, y0, y1), 242.0, s, "SNWE", detail=0, tiers=tiers, signs=False, clutter=False)
    b.build()
    sh = city.shell(cx, cy, "landmark")
    # dark horizontal brick banding and the black frieze below the radiator-cap ornaments
    for z in (118.0, 121.0, 213.0):
        for wx in (31.4,):
            sh.box((cx - wx / 2, cy - wx / 2, z), (cx + wx / 2, cy + wx / 2, z + 1.1), "brick_black", faces="xXyY")
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        px, py = cx + sx * 15.5, cy + sy * 15.5
        _winged_cap(sh, (px, py, 119.0), math.degrees(math.atan2(sy, sx)))
        # eagle heads leaning out from the corners of the 61st floor
        _eagle(sh, (cx + sx * 13.0, cy + sy * 13.0, 238.0), math.degrees(math.atan2(sy, sx)))
    # ---- the crown: seven stacked sunburst arches --------------------------------------------
    half = [13.2, 11.2, 9.4, 7.7, 6.1, 4.7, 3.4]
    spring = [242.0, 249.5, 256.4, 262.8, 268.8, 274.2, 279.2]
    rise = [13.0, 11.8, 10.6, 9.4, 8.4, 7.4, 6.4]
    for i in range(7):
        w, z0, h = half[i], spring[i], rise[i]
        seg = 24
        prof = []
        for k in range(seg + 1):
            t = -1 + 2 * k / seg
            prof.append((t * w, z0 + h * (1 - abs(t) ** 2.1) ** 0.62))
        for f in "SNWE":
            n_, r, yaw = FACES[f]
            m = MeshBuilder()
            # arched face plate, then the barrel vault running back to the centre
            for k in range(seg):
                (ax, az), (bx, bz) = prof[k], prof[k + 1]
                m.quad((ax, w, z0 - 2.0), (bx, w, z0 - 2.0), (bx, w, bz), (ax, w, az), "chrysler_steel", normal=(0, 1, 0))
                nn = ((az - bz), 0.0, (bx - ax))
                m.quad((ax, w, az), (bx, w, bz), (bx, 0.0, bz), (ax, 0.0, az), "chrysler_steel", normal=nn)
                m.quad((ax * 1.02, w + 0.28, az + 0.12), (bx * 1.02, w + 0.28, bz + 0.12), (bx * 0.985, w + 0.28, bz - 0.35), (ax * 0.985, w + 0.28, az - 0.35), "chrome", normal=(0, 1, 0))
                m.quad((ax * 1.02, w + 0.28, az + 0.12), (bx * 1.02, w + 0.28, bz + 0.12), (bx, w, bz), (ax, w, az), "chrome", normal=nn)
            # triangular windows fanning round the arch
            nt = 9 - i
            for t_i in range(max(nt, 3)):
                u = -0.8 + 1.6 * (t_i + 0.5) / max(nt, 3)
                edge_x = u * w
                edge_z = z0 + h * (1 - abs(u) ** 2.1) ** 0.62
                hub = (0.0, z0 - h * 0.18)
                dx, dz = edge_x - hub[0], edge_z - hub[1]
                ln = math.hypot(dx, dz)
                dx, dz = dx / ln, dz / ln
                tip = (edge_x - dx * 0.75, edge_z - dz * 0.75)
                height = min(h * 0.5, 4.4)
                base_c = (tip[0] - dx * height, tip[1] - dz * height)
                hw = height * 0.23
                p = [(base_c[0] - dz * hw, w + 0.31, base_c[1] + dx * hw), (base_c[0] + dz * hw, w + 0.31, base_c[1] - dx * hw), (tip[0], w + 0.31, tip[1])]
                m.poly(p, "chrysler_window", normal=(0, 1, 0))
            sh.merge(m, offset=(cx, cy, 0.0), yaw=yaw)
    sh.lathe((cx, cy, 284.0), [(2.5, 0), (1.6, 5.0), (0.95, 11.0), (0.5, 20.0), (0.18, 29.0), (0.04, 35.0)], "chrome", segments=8)
    floods(city, rect_c(cx, cy, 31.0, 31.0), 214.2, (0.95, 0.97, 1.0), 14000, reach=40, step=12)
    floods(city, rect_c(cx, cy, 26.0, 26.0), 242.0, (0.92, 0.95, 1.0), 9000, reach=34, step=9, offset=1.6)
    return (cx, cy, 319.0)


def _winged_cap(sh, p, yaw):
    m = MeshBuilder()
    m.lathe((0, 0, 0), [(0.0, 0.0), (1.2, 0.2), (1.5, 1.2), (0.9, 2.2), (0.0, 2.5)], "chrome", segments=12)
    for s in (-1, 1):
        m.poly([(0.6, s * 0.7, 0.8), (3.4, s * 2.4, 2.0), (4.2, s * 3.0, 3.6), (1.0, s * 0.9, 2.2)], "chrome", normal=(0.6, s * -0.4, 0.2))
        m.poly([(0.6, s * 0.7, 0.8), (3.4, s * 2.4, 2.0), (4.2, s * 3.0, 3.6), (1.0, s * 0.9, 2.2)], "chrome", normal=(-0.6, s * 0.4, -0.2))
    sh.merge(m, offset=p, yaw=yaw)


def _eagle(sh, p, yaw):
    m = MeshBuilder()
    m.tube([(0, 0, 0), (2.4, 0, 0.3), (4.3, 0, 0.55)], [1.05, 0.7, 0.55], 10, "chrome")
    m.sphere((4.7, 0, 0.7), 0.72, "chrome", segments=10, rings=7, scale=(1.2, 0.8, 0.85))
    m.tube([(5.35, 0, 0.7), (6.2, 0, 0.35), (6.35, 0, -0.1)], [0.36, 0.2, 0.03], 8, "chrome")
    for s in (-1, 1):
        m.poly([(0.3, s * 0.6, 0.4), (3.4, s * 0.62, 0.55), (2.2, s * 1.35, -0.5), (0.2, s * 1.2, -0.8)], "chrome", normal=(0, s, 0.3))
    sh.merge(m, offset=p, yaw=yaw)


# =========================================================================== Public Library
def lion(seed=0):
    """A couchant marble lion on its plinth, facing local +X.  Origin at the base of the pedestal."""
    mb = MeshBuilder()
    # pedestal
    mb.box((-2.1, -0.95, 0.0), (2.1, 0.95, 0.25), "marble_trim")
    mb.box((-1.95, -0.82, 0.25), (1.95, 0.82, 1.35), "marble_trim")
    mb.sweep([(0.0, 0.0), (0.08, 0.04), (0.16, 0.16), (0.16, 0.28), (0.0, 0.3)], [(-1.95, -0.82), (1.95, -0.82), (1.95, 0.82), (-1.95, 0.82)], "marble_trim", z=1.3)
    mb.box((-1.85, -0.72, 1.58), (1.85, 0.72, 1.74), "marble_trim")
    z = 1.74
    S = "stone_lion"

    def blob(c, r, sc, seg=20, rings=14, noise=0.0, sd=0):
        mb.sphere((c[0], c[1], c[2] + z), r, S, segments=seg, rings=rings, scale=sc, noise=noise, seed=sd)

    def limb(pts, radii, seg=12):
        mb.tube([(p[0], p[1], p[2] + z) for p in pts], radii, seg, S)

    # torso: a long lofted barrel from rump to chest
    secs = [(-1.45, 0.42, 0.34, 0.30), (-1.15, 0.50, 0.46, 0.44), (-0.65, 0.48, 0.40, 0.43), (-0.1, 0.52, 0.43, 0.47),
            (0.35, 0.62, 0.50, 0.56), (0.72, 0.74, 0.44, 0.58), (0.92, 0.80, 0.30, 0.42)]
    rings = []
    ang = np.linspace(0, 2 * math.pi, 25)[:-1]
    for x, zc, ry, rz in secs:
        rings.append([(x, ry * math.cos(a), max(zc + rz * math.sin(a), 0.02) + z) for a in ang])
    mb.loft(np.array(rings), lambda r_, c_: S, closed=True)
    blob((-1.45, 0, 0.42), 0.34, (0.55, 1.0, 0.9))
    # haunches and hind legs folded under
    for s in (-1, 1):
        blob((-0.95, s * 0.38, 0.40), 0.40, (1.15, 0.55, 0.98))
        limb([(-0.9, s * 0.52, 0.28), (-0.35, s * 0.58, 0.16), (0.08, s * 0.56, 0.1)], [0.2, 0.14, 0.11])
        blob((0.14, s * 0.56, 0.095), 0.13, (1.45, 0.95, 0.72))
        # fore legs stretched straight out
        limb([(0.62, s * 0.30, 0.46), (0.82, s * 0.34, 0.18), (1.35, s * 0.32, 0.13), (1.72, s * 0.32, 0.11)], [0.24, 0.17, 0.12, 0.105])
        blob((1.76, s * 0.32, 0.1), 0.135, (1.4, 1.0, 0.72))
        for k in (-1, 0, 1):
            blob((1.9, s * 0.32 + k * 0.075, 0.07), 0.052, (1.1, 0.8, 0.8), seg=8, rings=6)
    # tail wrapped along the flank
    limb([(-1.5, 0.12, 0.3), (-1.72, 0.45, 0.12), (-1.3, 0.72, 0.09), (-0.55, 0.78, 0.09), (-0.2, 0.74, 0.1)], [0.09, 0.075, 0.062, 0.055, 0.05], seg=8)
    blob((-0.1, 0.73, 0.11), 0.095, (1.5, 0.8, 0.8), seg=10, rings=8, noise=0.12, sd=3)
    # mane: layered ruff built from many locks
    blob((0.78, 0, 0.98), 0.50, (0.92, 0.98, 1.08), seg=34, rings=24, noise=0.07, sd=11 + seed)
    blob((0.66, 0, 0.74), 0.50, (0.88, 0.95, 1.0), seg=28, rings=20, noise=0.075, sd=12 + seed)
    blob((0.98, 0, 0.70), 0.34, (0.75, 0.95, 1.18), seg=24, rings=18, noise=0.08, sd=13 + seed)
    rng = np.random.default_rng(31 + seed)
    for _ in range(190):
        th = rng.uniform(0.35, 2.75)
        ph = rng.uniform(-2.45, 2.45)
        d = np.array((math.sin(th) * math.cos(ph) * 0.75, math.sin(th) * math.sin(ph), math.cos(th)))
        base = np.array((0.74, 0, 0.9)) + d * np.array((0.5, 0.49, 0.55))
        if base[0] > 1.05 and base[2] > 0.88 and abs(base[1]) < 0.3:
            continue
        tip = base + np.array((-0.13, d[1] * 0.04, -0.16)) + rng.uniform(-0.04, 0.04, 3)
        limb([tuple(base), tuple(base + (tip - base) * 0.35 + d * 0.052), tuple((base + tip) / 2 + d * 0.048), tuple(tip)], [0.055, 0.052, 0.036, 0.006], seg=8)
    # head
    blob((1.07, 0, 1.17), 0.29, (0.95, 0.92, 1.0), seg=24, rings=18)
    blob((1.29, 0, 1.075), 0.165, (1.05, 1.05, 0.82))
    blob((1.43, 0, 1.12), 0.062, (0.9, 1.5, 0.8), seg=10, rings=8)
    for s in (-1, 1):
        blob((1.36, s * 0.082, 1.045), 0.092, (1.0, 0.95, 0.78), seg=12, rings=9)
        blob((1.265, s * 0.15, 1.255), 0.058, (0.8, 1.2, 0.62), seg=10, rings=8)
        blob((1.12, s * 0.21, 1.40), 0.085, (0.55, 1.0, 1.05), seg=10, rings=8)
        limb([(1.23, s * 0.03, 1.285), (1.3, s * 0.13, 1.3), (1.21, s * 0.22, 1.27)], [0.035, 0.045, 0.02], seg=6)
    blob((1.27, 0, 0.955), 0.1, (1.0, 0.95, 0.62), seg=12, rings=9)
    limb([(1.12, 0, 1.33), (1.31, 0, 1.2), (1.42, 0, 1.135)], [0.075, 0.062, 0.05], seg=8)
    return mb


def _column(mb, x, y, z0, h, r, slot="marble_trim", segments=20):
    mb.box((x - r * 1.45, y - r * 1.45, z0), (x + r * 1.45, y + r * 1.45, z0 + r * 0.5), slot)
    mb.lathe((x, y, z0 + r * 0.5), [(r * 1.35, 0), (r * 1.35, r * 0.2), (r * 1.1, r * 0.35), (r * 1.2, r * 0.55), (r, r * 0.75)], slot, segments)
    shaft0, shaft1 = z0 + r * 1.25, z0 + h - r * 2.5
    mb.lathe((x, y, shaft0), [(r, 0), (r * 1.01, (shaft1 - shaft0) * 0.33), (r * 0.85, shaft1 - shaft0)], slot, segments)
    for k in range(segments):
        a = k * 2 * math.pi / segments
        mb.tube([(x + r * 1.0 * math.cos(a), y + r * 1.0 * math.sin(a), shaft0 + 0.2), (x + r * 0.855 * math.cos(a), y + r * 0.855 * math.sin(a), shaft1 - 0.2)], r * 0.045, 4, slot, caps=False)
    # Corinthian capital: bell, two rings of leaves and the abacus
    mb.lathe((x, y, shaft1), [(r * 0.92, 0), (r * 0.9, r * 0.2), (r * 1.0, r * 1.2), (r * 1.45, r * 2.1)], slot, segments)
    for ring, (zz, rr, hh) in enumerate(((0.15, 0.93, 0.85), (0.8, 1.02, 0.9))):
        for k in range(10):
            a = (k + ring * 0.5) * 2 * math.pi / 10
            ca, sa = math.cos(a), math.sin(a)
            base = (x + ca * r * rr, y + sa * r * rr, shaft1 + r * zz)
            mid = (x + ca * r * (rr + 0.2), y + sa * r * (rr + 0.2), shaft1 + r * (zz + hh * 0.7))
            tip = (x + ca * r * (rr + 0.45), y + sa * r * (rr + 0.45), shaft1 + r * (zz + hh * 0.62))
            mb.tube([base, mid, tip], [r * 0.17, r * 0.12, r * 0.03], 5, slot)
    mb.box((x - r * 1.5, y - r * 1.5, z0 + h - r * 0.4), (x + r * 1.5, y + r * 1.5, z0 + h), slot)


def _statue(mb, x, y, z, h, slot="marble_trim"):
    """Standing draped figure, small enough that silhouette is all that matters."""
    mb.lathe((x, y, z), [(h * 0.14, 0), (h * 0.12, h * 0.35), (h * 0.1, h * 0.55), (h * 0.13, h * 0.72), (h * 0.05, h * 0.8)], slot, segments=10)
    mb.sphere((x, y, z + h * 0.88), h * 0.075, slot, segments=10, rings=7)
    mb.tube([(x - h * 0.12, y, z + h * 0.72), (x - h * 0.17, y + h * 0.03, z + h * 0.52)], h * 0.035, 6, slot)
    mb.tube([(x + h * 0.12, y, z + h * 0.72), (x + h * 0.2, y - h * 0.05, z + h * 0.6)], h * 0.035, 6, slot)


def library(city):
    """Main branch of the public library.  Front faces +Y (Fifth Avenue)."""
    import kits
    x0, x1 = -146.0, -25.0
    yf, yb = -38.0, -108.0        # front and back wall planes
    cx = (x0 + x1) / 2
    sh = city.shell(cx, (yf + yb) / 2, "library")
    z_t = 2.6                     # terrace level
    h_wall = 18.6
    # terrace, plaza and the front steps
    sh.box((x0 - 6.0, yb - 2.0, 0.15), (x1 + 6.0, yf + 7.0, z_t), "marble", faces="xXyYZ", slots={"Z": "plaza"})
    sh.sweep([(0.0, -0.25), (0.14, -0.2), (0.14, 0.0), (0.0, 0.04)], [(x0 - 6, yb - 2), (x1 + 6, yb - 2), (x1 + 6, yf + 7), (x0 - 6, yf + 7)], "marble_trim", z=z_t)
    # the grand stair: two flights with a landing
    steps = 16
    rise = (z_t - 0.15) / (steps + 1)
    y = yf + 7.0
    for i in range(steps):
        top = z_t - rise * (i + 1)
        sh.box((cx - 20.0, y, 0.15), (cx + 20.0, y + 0.42, top), "marble_trim", faces="xXYZ")
        y += 0.42
        if i == 7:
            # the landing half way down
            sh.box((cx - 20.0, y, 0.15), (cx + 20.0, y + 1.6, top), "marble_trim", faces="xXYZ")
            y += 1.6
    # lions on pedestals either side of the stair
    lion_y = yf + 15.2
    for k, sx in enumerate((-1, 1)):
        m = lion(k * 7)
        sh2 = city.shell(cx + sx * 23.0, lion_y, "lions")
        sh2.merge(m, offset=(cx + sx * 23.0, lion_y, 0.15), yaw=90.0, scale=(1.18, 1.18, 1.18))
    # balustrades along the terrace edge
    for a, b in ((x0 - 6.0, cx - 21.5), (cx + 21.5, x1 + 6.0)):
        sh.box((a, yf + 6.55, z_t + 0.85), (b, yf + 6.95, z_t + 1.02), "marble_trim")
        sh.box((a, yf + 6.55, z_t), (b, yf + 6.95, z_t + 0.12), "marble_trim")
        x = a + 0.25
        while x < b:
            sh.lathe((x, yf + 6.75, z_t + 0.12), [(0.07, 0), (0.15, 0.18), (0.06, 0.42), (0.1, 0.66), (0.1, 0.73)], "marble_trim", segments=8)
            x += 0.42
    # flagpoles on bronze bases and big stone urns
    for sx in (-1, 1):
        px, py = cx + sx * 33.0, yf + 17.0
        sh.lathe((px, py, 0.15), [(1.0, 0), (1.05, 0.25), (0.6, 0.6), (0.8, 1.0), (0.5, 1.7), (0.18, 2.2)], "bronze", segments=14)
        sh.tube([(px, py, 2.2), (px, py, 21.0)], [0.13, 0.06], 8, "paint_white")
        sh.sphere((px, py, 21.15), 0.17, "gold", segments=10, rings=7)
        ux = cx + sx * 21.5
        sh.lathe((ux, yf + 6.3, z_t), [(0.55, 0), (0.55, 0.3), (0.24, 0.55), (0.35, 0.75), (0.95, 1.45), (1.05, 1.7), (0.8, 1.72)], "marble_trim", segments=18)
    # ---- main block ---------------------------------------------------------------------------
    pav_w, end_w = 37.0, 17.0
    sections = [(x0, x0 + end_w, 1.6, "end"), (x0 + end_w, cx - pav_w / 2, 0.0, "wing"), (cx - pav_w / 2, cx + pav_w / 2, 3.2, "porch"),
                (cx + pav_w / 2, x1 - end_w, 0.0, "wing"), (x1 - end_w, x1, 1.6, "end")]
    for a, b, proj, kind in sections:
        y = yf + proj
        L = b - a
        if kind == "wing":
            n = int(round(L / 5.3))
            w = L / n
            for i in range(n):
                m = MeshBuilder()
                # local x runs to the viewer's right, which is +X for a +Y facing wall
                top = kits.arch_opening(m, w, 8.4, w / 2 - 1.45, w / 2 + 1.45, 1.1, 5.6, 0.7, slot="marble", ring="marble_trim", ring_w=0.32)
                kits.arch_glass(m, w / 2 - 1.45, w / 2 + 1.45, 1.1, 5.6, 0.7, glass="glass_lobby")
                kits.sill(m, (w / 2 - 1.45, w / 2 + 1.45, 1.1, top), depth=0.7, proj=0.18, h=0.24, slot="marble_trim")
                o = (w / 2 - 1.35, w / 2 + 1.35, 9.9, 14.9)
                kits.wall_front(m, w, h_wall - 2.4, [o], slot="marble", z0=8.4)
                kits.reveals(m, o, 0.6, "marble")
                kits.casement(m, o, 0.55, cols=3, rows=3, glass="glass_lobby", slot="bronze")
                kits.sill(m, o, depth=0.55, proj=0.2, h=0.22, slot="marble_trim")
                kits.lintel(m, o, h=0.4, proj=0.28, ext=0.25, slot="marble_trim")
                sh.merge(m, offset=(a + i * w, y, z_t))
            for i in range(n + 1):
                _column(sh, a + i * w, y + 0.34, z_t + 8.6, h_wall - 11.1, 0.43)
        elif kind == "end":
            m = MeshBuilder()
            w = L
            top = kits.arch_opening(m, w, 8.4, w / 2 - 2.3, w / 2 + 2.3, 0.9, 5.4, 0.9, slot="marble", ring="marble_trim", ring_w=0.45)
            kits.arch_glass(m, w / 2 - 2.3, w / 2 + 2.3, 0.9, 5.4, 0.9, glass="glass_lobby")
            ops = [(w / 2 - 2.0, w / 2 + 2.0, 9.9, 14.8)]
            kits.wall_front(m, w, h_wall - 2.4, ops, slot="marble", z0=8.4)
            kits.reveals(m, ops[0], 1.0, "marble")
            kits.casement(m, ops[0], 0.9, cols=3, rows=3, glass="glass_lobby", slot="bronze")
            sh.merge(m, offset=(a, y, z_t))
            for dx in (1.7, 3.7, w - 3.7, w - 1.7):
                _column(sh, a + dx, y + 0.55, z_t + 8.6, h_wall - 11.1, 0.52)
            # pediment
            zb = z_t + h_wall - 0.2
            tri = [(a + 0.6, y + 0.9, zb), (b - 0.6, y + 0.9, zb), ((a + b) / 2, y + 0.9, zb + 3.1)]
            sh.poly(tri, "marble", normal=(0, 1, 0))
            for p, q in ((tri[0], tri[2]), (tri[2], tri[1])):
                sh.quad(p, q, (q[0], y - 0.6, q[2]), (p[0], y - 0.6, p[2]), "marble_trim", normal=(0, 0, 1))
                sh.tube([(p[0], y + 1.05, p[2]), (q[0], y + 1.05, q[2])], 0.22, 6, "marble_trim")
        else:
            # the three-arch entrance portico with paired columns
            bay = L / 3.0
            for i in range(3):
                m = MeshBuilder()
                top = kits.arch_opening(m, bay, h_wall - 2.4, bay / 2 - 3.1, bay / 2 + 3.1, 0.02, 9.2, 2.4, slot="marble", ring="marble_trim", ring_w=0.6, segments=18)
                kits.arch_glass(m, bay / 2 - 3.1, bay / 2 + 3.1, 4.9, 9.2, 2.4, segments=18, glass="glass_lobby")
                kits.glass_pane(m, (bay / 2 - 3.1, bay / 2 + 3.1, 0.0, 4.2), -2.37, "glass_lobby")
                m.box((bay / 2 - 3.1, -2.4, 4.2), (bay / 2 + 3.1, -2.05, 4.95), "marble_trim", faces="zZY")
                for k in range(5):
                    xk = bay / 2 - 3.1 + 6.2 * k / 4
                    m.box((xk - 0.07, -2.36, 0.0), (xk + 0.07, -2.22, 4.2), "bronze", faces="xXY")
                m.sphere((bay / 2, 0.15, top + 0.4), 0.4, "marble_trim", segments=10, rings=7, scale=(1.0, 0.55, 1.2))
                sh.merge(m, offset=(a + i * bay, y, z_t))
            for i in range(4):
                xc = a + i * bay
                off = (0.85 if i == 0 else -0.85 if i == 3 else 0.0)
                for dx in ((-0.85, 0.85) if 0 < i < 3 else (off, off * 2.9)):
                    _column(sh, xc + dx, y + 1.05, z_t, h_wall - 2.6, 0.66)
                zf = z_t + h_wall + 0.3
                _statue(sh, xc + (1.3 if i == 0 else -1.3 if i == 3 else 0.0), y + 0.9, zf + 3.3, 2.7)
            # attic storey above the portico
            zf = z_t + h_wall
            sh.box((a + 0.4, y - 2.0, zf), (b - 0.4, y + 0.3, zf + 3.3), "marble", faces="xXyYZ")
            for i in range(3):
                xa = a + i * bay + 3.0
                xb = a + (i + 1) * bay - 3.0
                sh.box((xa, y + 0.3, zf + 0.7), (xb, y + 0.42, zf + 2.6), "marble_trim", faces="xXYzZ")
            sh.sweep([(0.0, -0.35), (0.14, -0.3), (0.45, -0.1), (0.5, 0.05), (0.0, 0.1)], [(a + 0.4, y - 2), (b - 0.4, y - 2), (b - 0.4, y + 0.3), (a + 0.4, y + 0.3)], "marble_trim", z=zf + 3.3)
        # side returns of projecting sections
        if proj > 0:
            for xx, nx in ((a, -1), (b, 1)):
                sh.quad((xx, yf, z_t), (xx, y, z_t), (xx, y, z_t + h_wall - 2.4), (xx, yf, z_t + h_wall - 2.4), "marble", normal=(nx, 0, 0))
        # entablature, frieze, cornice and parapet
        zc = z_t + h_wall - 2.4
        sh.box((a, yf - 0.4, zc), (b, y + 0.42, zc + 0.5), "marble_trim", faces="xXYzZ")
        sh.box((a, yf - 0.4, zc + 0.5), (b, y + 0.3, zc + 1.35), "marble", faces="xXY")
        path = [(a, y + 0.3), (b, y + 0.3)][::-1]
        sh.sweep([(0.0, 0.0), (0.1, 0.05), (0.1, 0.28), (0.55, 0.42), (0.62, 0.62), (0.85, 0.82), (0.85, 0.92), (0.0, 0.98)], path, "marble_trim", closed=False, z=zc + 1.35)
        x = a + 0.2
        while x < b - 0.2:
            sh.box((x, y + 0.3, zc + 1.4), (x + 0.2, y + 0.62, zc + 1.62), "marble_trim", faces="xXYz")
            x += 0.42
        if kind == "wing":
            sh.box((a, y - 0.3, z_t + h_wall - 0.1), (b, y + 0.1, z_t + h_wall + 1.15), "marble", faces="xXyYZ")
        # belt course between the floors
        sh.box((a, yf, z_t + 8.35), (b, y + 0.32, z_t + 8.62), "marble_trim", faces="xXYzZ")
        sh.box((a, yf, z_t), (b, y + 0.28, z_t + 0.75), "marble_trim", faces="xXYZ")
    # roof, with the low skylight monitors
    zr = z_t + h_wall - 0.2
    sh.quad((x0, yb, zr), (x1, yb, zr), (x1, yf, zr), (x0, yf, zr), "roof", normal=(0, 0, 1))
    for a in (x0 + 8, cx - 18, x1 - 44):
        sh.box((a, -92, zr), (a + 36, -66, zr + 3.2), "copper_green")
    # north and south sides
    for xs, nx, f in ((x0, -1, "S"), (x1, 1, "N")):
        L = yf - yb
        n = int(L // 5.6)
        w = L / n
        for i in range(n):
            m = MeshBuilder()
            top = kits.arch_opening(m, w, 8.4, w / 2 - 1.35, w / 2 + 1.35, 1.2, 5.4, 0.6, slot="marble", ring="marble_trim", ring_w=0.3)
            kits.arch_glass(m, w / 2 - 1.35, w / 2 + 1.35, 1.2, 5.4, 0.6, glass="glass_lobby")
            o = (w / 2 - 1.3, w / 2 + 1.3, 9.9, 14.6)
            kits.wall_front(m, w, h_wall, [o], slot="marble", z0=8.4)
            kits.reveals(m, o, 0.5, "marble")
            kits.casement(m, o, 0.45, cols=3, rows=3, glass="glass_office", slot="bronze")
            kits.sill(m, o, depth=0.45, proj=0.18, h=0.2, slot="marble_trim")
            n_, r, yaw = FACES[f]
            origin = (xs, yb if f == "N" else yf, z_t)
            origin = (xs, (yf if nx > 0 else yb), z_t)
            r0 = (r[0], r[1])
            sh.merge(m, offset=(origin[0] + r0[0] * i * w, origin[1] + r0[1] * i * w, z_t), yaw=yaw)
        sh.sweep([(0.0, 0.0), (0.12, 0.05), (0.55, 0.42), (0.8, 0.8), (0.0, 0.95)], [(xs, yb), (xs, yf)] if nx > 0 else [(xs, yf), (xs, yb)], "marble_trim", closed=False, z=z_t + h_wall - 1.05)
    # west front on the park: tall narrow stack windows under the reading room arches
    L = x1 - x0
    n = 48
    w = L / n
    for i in range(n):
        m = MeshBuilder()
        o = (w / 2 - 0.46, w / 2 + 0.46, 1.4, 9.4)
        kits.wall_front(m, w, 10.2, [o], slot="marble")
        kits.reveals(m, o, 0.5, "marble")
        kits.casement(m, o, 0.45, cols=1, rows=7, glass="glass_office", slot="bronze")
        sh.merge(m, offset=(x1 - i * w, yb, z_t), yaw=180.0)
    n = 14
    w = L / n
    for i in range(n):
        m = MeshBuilder()
        kits.arch_opening(m, w, h_wall - 10.2, w / 2 - 2.6, w / 2 + 2.6, 0.9, 4.4, 0.8, slot="marble", ring="marble_trim", ring_w=0.4, segments=14)
        kits.arch_glass(m, w / 2 - 2.6, w / 2 + 2.6, 0.9, 4.4, 0.8, segments=14, glass="glass_lobby")
        sh.merge(m, offset=(x1 - i * w, yb, z_t + 10.2), yaw=180.0)
    sh.sweep([(0.0, 0.0), (0.12, 0.05), (0.55, 0.42), (0.8, 0.8), (0.0, 0.95)], [(x0, yb), (x1, yb)], "marble_trim", closed=False, z=z_t + h_wall - 0.4)
    city.footprints.append(((x0, x1, yb, yf), 22.0))
    # night: the front is washed from the terrace and the arches glow from inside
    x = x0 + 5.0
    while x < x1 - 3:
        proj = 3.4 if abs(x - cx) < pav_w / 2 else 1.8
        city.light((x, yf + proj + 2.6, z_t + 0.35), (0.0, -0.42, 1.0), (1.0, 0.84, 0.6), 2600, 26, 46.0, C.LK_LANDMARK, shadows=False, volumetric=0.5)
        x += 8.6
    for i in range(-1, 2):
        city.light((cx + i * 12.3, yf + 3.4, z_t + 6.0), (0.0, 1.0, -0.5), (1.0, 0.74, 0.42), 2400, 20, -1, C.LK_LOBBY, shadows=False, rect=(500, 400))
    for sx in (-1, 1):
        city.light((cx + sx * 23.0 + 1.8, lion_y + 5.2, 0.45), (-0.3 - sx * 0.05, -1.0, 0.62), (1.0, 0.84, 0.62), 1500, 15, 34.0, C.LK_LANDMARK, shadows=True)
        city.light((cx + sx * 23.0 - 3.5, lion_y + 1.5, 5.4), (0.75, -0.3, -0.62), (0.82, 0.88, 1.0), 520, 12, 42.0, C.LK_PARK, shadows=False)
    return (cx, lion_y)


# =========================================================================== Grand Central
def grand_central(city):
    """South front on 42nd Street: three vast arches, paired columns, the clock group."""
    import kits
    x0, x1, y0, y1 = D.LOTS["gct"]
    cy = 320.0
    W = 92.0
    ya, yb = cy - W / 2, cy + W / 2
    xf = x0 + 5.0
    sh = city.shell(xf + 20, cy, "gct")
    H = 27.0
    bay = 17.0
    widths = [(W - 3 * bay) / 2]
    # south face points -X; local x of a module runs toward +Y
    def place(m, y_left, z=0.0):
        sh.merge(m, offset=(xf, y_left, z), yaw=90.0)

    side = (W - 3 * bay) / 2
    for y_left in (ya, yb - side):
        m = MeshBuilder()
        ops = [(side / 2 - 3.0, side / 2 + 3.0, 7.0, 19.5)]
        kits.wall_front(m, side, H, ops + [(side / 2 - 2.2, side / 2 + 2.2, 0.0, 5.0)], slot="limestone")
        kits.reveals(m, ops[0], 0.8, "limestone")
        kits.casement(m, ops[0], 0.75, cols=3, rows=6, glass="glass_lobby", slot="bronze")
        kits.reveals(m, (side / 2 - 2.2, side / 2 + 2.2, 0.0, 5.0), 1.2, "limestone_dark")
        kits.glass_pane(m, (side / 2 - 2.2, side / 2 + 2.2, 0.0, 5.0), -1.15, "glass_lobby")
        kits.lintel(m, ops[0], h=0.7, proj=0.4, ext=0.5)
        place(m, y_left)
    for i in range(3):
        m = MeshBuilder()
        kits.arch_opening(m, bay, H, bay / 2 - 5.2, bay / 2 + 5.2, 6.6, 16.8, 1.4, slot="limestone", ring="limestone_trim", ring_w=0.9, segments=24)
        # the great window: arched glass split by a lattice of bronze mullions
        kits.arch_glass(m, bay / 2 - 5.2, bay / 2 + 5.2, 6.6, 16.8, 1.4, segments=24, glass="glass_lobby")
        for k in range(1, 6):
            xk = bay / 2 - 5.2 + 10.4 * k / 6
            zz = 16.8 + math.sqrt(max(5.2 ** 2 - (xk - bay / 2) ** 2, 0))
            m.box((xk - 0.08, -1.37, 6.6), (xk + 0.08, -1.2, zz - 0.1), "bronze", faces="xXY")
        for z in (8.6, 10.6, 12.6, 14.6, 16.8, 18.9):
            half = math.sqrt(max(5.2 ** 2 - max(z - 16.8, 0) ** 2, 0))
            m.box((bay / 2 - half, -1.37, z - 0.07), (bay / 2 + half, -1.22, z + 0.07), "bronze", faces="zZY")
        kits.wall_front(m, bay / 2 + 5.2, 6.0, [], slot="granite", x0=bay / 2 - 5.2, y=0.02)
        for k in range(3):
            o = (bay / 2 - 4.6 + k * 3.2, bay / 2 - 4.6 + k * 3.2 + 2.8, 0.1, 4.4)
            kits.glass_pane(m, o, 0.06, "glass_lobby")
            kits.frame_rect(m, o, 0.07, 0.12, 0.08, "bronze")
        m.sphere((bay / 2, 0.3, 22.9), 0.75, "limestone_trim", segments=10, rings=7, scale=(1.0, 0.6, 1.2))
        place(m, ya + side + i * bay)
    # four pairs of giant columns
    for i in range(4):
        yc = ya + side + i * bay
        for dy in (-1.35, 1.35):
            _column(sh, xf - 1.3, yc + dy, 6.4, 18.2, 0.82, slot="limestone_trim")
        sh.box((xf - 2.6, yc - 2.7, 5.6), (xf, yc + 2.7, 6.4), "limestone_trim")
        sh.box((xf - 2.6, yc - 2.7, 24.6), (xf, yc + 2.7, 25.4), "limestone_trim")
    # entablature and cornice
    sh.box((xf - 0.6, ya, 25.4), (xf + 1.0, yb, 27.4), "limestone", faces="xyYZ")
    sh.sweep([(0.0, 0.0), (0.3, 0.1), (0.3, 0.45), (1.1, 0.75), (1.35, 1.15), (0.0, 1.25)], [(xf - 0.6, yb), (xf - 0.6, ya)], "limestone_trim", closed=False, z=27.4)
    sh.box((xf - 0.5, ya, 28.65), (xf + 0.8, yb, 30.4), "limestone", faces="xyYZ")
    # the clock and the sculpture group that crowns the centre
    zk = 33.6
    sh.box((xf - 1.0, cy - 8.0, 30.4), (xf + 0.6, cy + 8.0, 31.6), "limestone_trim")
    m = MeshBuilder()
    m.lathe((0, 0, 0), [(0.0, 0.45), (1.85, 0.42), (1.95, 0.0)], "clockface", segments=36)
    for r_ in (2.05, 2.55):
        m.lathe((0, 0, 0), [(r_ + 0.18, 0.0), (r_ + 0.14, 0.4), (r_ - 0.14, 0.4), (r_ - 0.18, 0.0)], "gold" if r_ < 2.3 else "limestone_trim", segments=36)
    for k in range(12):
        a = k * math.pi / 6
        m.obox((1.55 * math.cos(a), 1.55 * math.sin(a), 0.47), (0.3, 0.09, 0.03), math.degrees(a), "paint_black")
    m.obox((0.0, 0.55, 0.5), (0.12, 1.2, 0.04), 0.0, "paint_black")
    m.obox((0.4, 0.2, 0.52), (0.9, 0.09, 0.04), 25.0, "paint_black")
    sh.merge(m, offset=(xf - 1.15, cy, zk), pitch=90.0)
    # winged figure above the clock, two reclining figures beside it, an eagle at the crest
    _statue(sh, xf - 0.7, cy, zk + 2.4, 5.4, slot="limestone_trim")
    for s in (-1, 1):
        sh.poly([(xf - 0.8, cy + s * 0.5, zk + 6.2), (xf - 0.8, cy + s * 3.4, zk + 8.6), (xf - 0.8, cy + s * 2.6, zk + 6.4), (xf - 0.8, cy + s * 0.6, zk + 5.0)], "limestone_trim", normal=(-1, 0, 0))
        sh.tube([(xf - 0.6, cy + s * 2.7, zk - 0.8), (xf - 0.6, cy + s * 4.6, zk - 1.2), (xf - 0.6, cy + s * 7.2, zk - 2.0)], [0.75, 0.6, 0.3], 10, "limestone_trim")
        _statue(sh, xf - 0.7, cy + s * 3.5, zk - 1.5, 3.8, slot="limestone_trim")
    for yy in (ya + side, yb - side):
        _statue(sh, xf - 0.2, yy, 30.4, 2.4, slot="limestone_trim")
    # mansard roof and the body behind
    bx0, bx1 = xf + 1.0, x1
    sh.box((bx0, ya, 0.0), (bx1, yb, 28.6), "limestone", faces="XyY")
    pts = [(bx0 + 0.2, ya + 0.5), (bx1, ya + 0.5), (bx1, yb - 0.5), (bx0 + 0.2, yb - 0.5)]
    inset = [(bx0 + 6.0, ya + 6.5), (bx1 - 5.0, ya + 6.5), (bx1 - 5.0, yb - 6.5), (bx0 + 6.0, yb - 6.5)]
    for i in range(4):
        a, b_ = pts[i], pts[(i + 1) % 4]
        c_, d_ = inset[(i + 1) % 4], inset[i]
        mid = ((a[0] + b_[0]) / 2 - (bx0 + bx1) / 2, (a[1] + b_[1]) / 2 - cy)
        sh.quad((a[0], a[1], 28.8), (b_[0], b_[1], 28.8), (c_[0], c_[1], 35.4), (d_[0], d_[1], 35.4), "copper_green", normal=(mid[0], mid[1], 20))
    sh.quad((inset[0][0], inset[0][1], 35.4), (inset[1][0], inset[1][1], 35.4), (inset[2][0], inset[2][1], 35.4), (inset[3][0], inset[3][1], 35.4), "roof", normal=(0, 0, 1))
    # wings to the property line
    for a_, b2 in ((y0, ya), (yb, y1)):
        if b2 - a_ > 2:
            rect = (xf + 3.0, x1, a_, b2)
            s = style(city, "stone", mod="pw2", base="rust", base_floors=2, top="pwarch", tank=0.0, o={"wall": "limestone", "glass": "glass_office"})
            Building(city, rect, 24.0, s, "SWE", detail=0, signs=False, clutter=False).build()
    city.footprints.append(((x0, x1, y0, y1), 30.0))
    for i in range(7):
        yy = ya + 4 + i * (W - 8) / 6
        city.light((xf - 5.0, yy, 7.3), (0.45, 0.0, 1.0), (1.0, 0.82, 0.56), 5200, 30, 40.0, C.LK_LANDMARK, shadows=False, volumetric=0.5)
    city.light((xf - 7.0, cy, 30.0), (1.0, 0.0, 0.5), (1.0, 0.9, 0.72), 2600, 18, 40.0, C.LK_LANDMARK, shadows=False)
    park_viaduct(city, xf, cy, ya, yb)


def park_viaduct(city, xf, cy, ya, yb):
    """The Park Avenue ramp that climbs from 40th Street, crosses 42nd and wraps the terminal."""
    sh = city.shell(0.0, cy, "viaduct")
    hz = 6.4

    def deck(xa, xb, y0, y1, za, zb):
        sh.quad((xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za), "road_dark", normal=(-(zb - za), 0, (xb - xa)))
        sh.quad((xa, y0, za - 0.9), (xb, y0, zb - 0.9), (xb, y1, zb - 0.9), (xa, y1, za - 0.9), "paint_darkgray", normal=(0, 0, -1))
        for yy, ny in ((y0, -1), (y1, 1)):
            sh.quad((xa, yy, za - 0.9), (xb, yy, zb - 0.9), (xb, yy, zb + 0.25), (xa, yy, za + 0.25), "limestone_dark", normal=(0, ny, 0))
            sh.tube([(xa, yy, za + 1.15), (xb, yy, zb + 1.15)], 0.09, 6, "paint_darkgreen")
            n = int((xb - xa) / 0.45) + 1
            for i in range(n):
                t = i / max(n - 1, 1)
                xx, zz = xa + (xb - xa) * t, za + (zb - za) * t
                sh.box((xx - 0.025, yy - 0.025, zz + 0.2), (xx + 0.025, yy + 0.025, zz + 1.15), "paint_darkgreen", faces="xXyY")

    deck(-150.0, -62.0, cy - 8.5, cy + 8.5, 0.2, hz)
    deck(-62.0, -14.0, cy - 8.5, cy + 8.5, hz, hz)
    deck(-14.0, xf - 4.5, cy - 8.5, cy + 8.5, hz, hz)
    sh.box((-62.0, cy - 8.5, 0.2), (-40.0, cy + 8.5, hz - 0.9), "granite", faces="xXyY")
    # steel arch over 42nd Street
    for yy in (cy - 8.3, cy + 8.3):
        pts = [(-14.5 + 29.0 * k / 16, yy, 3.6 + 1.75 * math.sin(math.pi * k / 16)) for k in range(17)]
        sh.tube(pts, 0.3, 8, "paint_darkgreen")
        for k in range(1, 16, 2):
            sh.tube([pts[k], (pts[k][0], yy, hz - 0.8)], 0.1, 5, "paint_darkgreen", caps=False)
    for xx in (-15.0, 14.0):
        for yy in (cy - 8.0, cy + 8.0):
            sh.box((xx - 0.7, yy - 0.7, 0.15), (xx + 0.7, yy + 0.7, hz - 0.9), "granite")
    # wings that carry the roadway round the sides of the terminal
    for s in (-1, 1):
        y_in, y_out = cy + s * 8.5, cy + s * (46.0 + 4.0)
        lo, hi = min(y_in, y_out), max(y_in, y_out)
        sh.box((xf - 4.5, lo, hz - 0.9), (xf - 0.1, hi, hz), "limestone_dark", slots={"Z": "road_dark"})
        sh.box((xf - 4.75, lo, hz), (xf - 4.45, hi, hz + 1.1), "limestone")
        for yy in np.arange(lo + 4, hi - 1, 9.0):
            sh.box((xf - 4.4, yy - 0.5, 0.15), (xf - 3.4, yy + 0.5, hz - 0.9), "granite")
    city.add_cover(-40.0, xf, cy - 8.5, cy + 8.5, hz - 0.9)
    for xx in (-54.0, -26.0, 2.0):
        for s in (-1, 1):
            city.light((xx, cy + s * 7.9, hz + 3.2), (0, -s * 0.3, -1), (1.0, 0.78, 0.5), 1500, 20, 70.0, C.LK_STREET)
            sh.tube([(xx, cy + s * 8.2, hz), (xx, cy + s * 8.2, hz + 3.4)], 0.08, 6, "paint_darkgreen")
            sh.sphere((xx, cy + s * 8.2, hz + 3.55), 0.24, "lamp_globe", segments=10, rings=7)


# =========================================================================== glass supertalls
def prism_tower(sh, levels, slot, close_top=True):
    """Loft between horizontal polygons [(z, [(x, y), ...]), ...] with flat facets."""
    for (za, pa), (zb, pb) in zip(levels[:-1], levels[1:]):
        n = len(pa)
        cxa = sum(p[0] for p in pa) / n
        cya = sum(p[1] for p in pa) / n
        for i in range(n):
            a, b = pa[i], pa[(i + 1) % n]
            c_, d_ = pb[(i + 1) % n], pb[i]
            mx, my = (a[0] + b[0] + c_[0] + d_[0]) / 4 - cxa, (a[1] + b[1] + c_[1] + d_[1]) / 4 - cya
            quad = [(a[0], a[1], za), (b[0], b[1], za), (c_[0], c_[1], zb), (d_[0], d_[1], zb)]
            pts = []
            for q in quad:
                if not pts or np.linalg.norm(np.array(q) - np.array(pts[-1])) > 0.05:
                    pts.append(q)
            if len(pts) > 2 and np.linalg.norm(np.array(pts[0]) - np.array(pts[-1])) < 0.05:
                pts.pop()
            if len(pts) >= 3:
                sh.poly(pts, slot, normal=(mx, my, 0.001))
    if close_top:
        z, p = levels[-1]
        sh.poly([(q[0], q[1], z) for q in p], "roof", normal=(0, 0, 1))


def octagon(cx, cy, wx, wy, chx, chy=None):
    chy = chx if chy is None else chy
    hx, hy = wx / 2, wy / 2
    return [(cx - hx + chx, cy - hy), (cx + hx - chx, cy - hy), (cx + hx, cy - hy + chy), (cx + hx, cy + hy - chy),
            (cx + hx - chx, cy + hy), (cx - hx + chx, cy + hy), (cx - hx, cy + hy - chy), (cx - hx, cy - hy + chy)]


def square(cx, cy, wx, wy):
    return [(cx - wx / 2, cy - wy / 2), (cx + wx / 2, cy - wy / 2), (cx + wx / 2, cy + wy / 2), (cx - wx / 2, cy + wy / 2)]


def spire(sh, x, y, z0, z1, r0, slot="paint_white", beacon=None, city=None):
    sh.cylinder((x, y, z0), z1 - z0, r0, slot, segments=8, r1=r0 * 0.15)
    z = z0 + 6
    while z < z1 - 8:
        r = r0 * (1 - 0.85 * (z - z0) / (z1 - z0))
        sh.lathe((x, y, z), [(r + 0.5, 0), (r + 0.5, 0.35)], slot, segments=8)
        z += 9
    if city is not None:
        city.inst("beacon", (x, y, z1 + 0.2), 0, 1.2, custom=(1.0, 0.04, 0.02, 0.4))


def one_vanderbilt(city):
    x0, x1, y0, y1 = D.LOTS["onev"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sh = city.shell(cx, cy, "landmark")
    W, Hh = x1 - x0, y1 - y0
    # four interlocking tapering planes
    levels = [(0, square(cx, cy, W, Hh)), (28, square(cx, cy, W, Hh)), (120, square(cx + 1.0, cy, W - 6, Hh - 5)),
              (240, square(cx + 2.5, cy - 1, W - 15, Hh - 13)), (320, square(cx + 3.5, cy - 2, W - 24, Hh - 22))]
    prism_tower(sh, levels, "far_onev", close_top=False)
    top = square(cx + 3.5, cy - 2, W - 24, Hh - 22)
    peak = [(top[0][0] + 6, top[0][1] + 6, 352.0), (top[1][0] - 3, top[1][1] + 5, 372.0), (top[2][0] - 4, top[2][1] - 4, 397.0), (top[3][0] + 5, top[3][1] - 3, 366.0)]
    for i in range(4):
        a, b = top[i], top[(i + 1) % 4]
        mx, my = (a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy
        sh.poly([(a[0], a[1], 320), (b[0], b[1], 320), peak[(i + 1) % 4], peak[i]], "far_onev", normal=(mx, my, 0.001))
    sh.poly(peak, "far_onev", normal=(0, 0, 1))
    spire(sh, cx + 5.5, cy + 1.5, 380, 427, 1.4, "steel_bright", city=city)
    for z in (322.0, 346.0):
        floods(city, rect_c(cx + 3.5, cy - 2, W - 25, Hh - 23), z, (0.86, 0.92, 1.0), 6000, reach=36, step=14, offset=0.8)
    # lit retail base
    for f in "SWE":
        (lx, ly), L = face_geom((x0, x1, y0, y1), f)
        n_, r, yaw = FACES[f]
        k = int(L // 4.8)
        for i in range(k):
            sx = L / (k * 4.8)
            city.inst("lobby", (lx + r[0] * i * 4.8 * sx + n_[0] * 0.12, ly + r[1] * i * 4.8 * sx + n_[1] * 0.12, 0.0), yaw, (sx, 1, 1.5),
                      override="lobbyglass=glass_lobby;wall=terracotta")
    city.footprints.append(((x0, x1, y0, y1), 300.0))


def bofa_tower(city):
    x0, x1, y0, y1 = D.LOTS["bofa"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sh = city.shell(cx, cy, "landmark")
    W, Hh = x1 - x0, y1 - y0
    levels = [(0, octagon(cx, cy, W, Hh, 0.6)), (40, octagon(cx, cy, W, Hh, 3.0)), (140, octagon(cx, cy, W - 3, Hh - 4, 12.0, 8.0)),
              (230, octagon(cx - 1, cy, W - 9, Hh - 14, 9.0, 17.0)), (262, octagon(cx - 2, cy + 1, W - 13, Hh - 22, 5.0, 12.0))]
    prism_tower(sh, levels, "far_crystal", close_top=False)
    top = octagon(cx - 2, cy + 1, W - 13, Hh - 22, 5.0, 12.0)
    hi = [(p[0], p[1], 262 + max(0.0, 26.0 * ((p[0] - (cx - 2)) / (W - 13) + 0.5)) + 6 * ((p[1] - cy) / (Hh - 22))) for p in top]
    for i in range(8):
        a, b = top[i], top[(i + 1) % 8]
        mx, my = (a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy
        sh.poly([(a[0], a[1], 262), (b[0], b[1], 262), hi[(i + 1) % 8], hi[i]], "far_crystal", normal=(mx, my, 0.001))
    spire(sh, cx + 8, cy + 4, 268, 366, 1.6, "paint_white", city=city)
    city.footprints.append(((x0, x1, y0, y1), 260.0))


def grace_building(city):
    """White travertine grid whose north and south walls swoop out as they meet the street."""
    x0, x1, y0, y1 = D.LOTS["grace"]
    sh = city.shell((x0 + x1) / 2, (y0 + y1) / 2, "landmark")
    H = 192.0
    xa, xb = x0 + 9.0, x1 - 9.0

    def inset(z):
        return 9.0 * (1.0 - min(z / 62.0, 1.0)) ** 2.4

    zs = [0, 3, 6, 10, 15, 21, 28, 36, 46, 55, 62, H]
    for za, zb in zip(zs[:-1], zs[1:]):
        ia, ib = inset(za), inset(zb)
        for sgn, base in ((-1, xa), (1, xb)):
            pa, pb = base + sgn * ia, base + sgn * ib
            sh.quad((pa, y0, za), (pa, y1, za), (pb, y1, zb), (pb, y0, zb), "far_grace", normal=(sgn, 0, (ia - ib) / max(zb - za, 0.1)))
        for yy, ny in ((y0, -1), (y1, 1)):
            sh.quad((xa - ia, yy, za), (xb + ia, yy, za), (xb + ib, yy, zb), (xa - ib, yy, zb), "far_grace", normal=(0, ny, 0))
    sh.quad((xa, y0, H), (xb, y0, H), (xb, y1, H), (xa, y1, H), "roof", normal=(0, 0, 1))
    sh.box((xa + 6, y0 + 8, H), (xb - 6, y1 - 8, H + 7), "paint_white", faces="xXyYZ")
    city.footprints.append(((x0, x1, y0, y1), H))


def metlife_slab(city):
    """The octagonal precast slab that closes the view up Park Avenue."""
    x0, x1, y0, y1 = D.LOTS["metlife"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sh = city.shell(cx, cy, "landmark")
    poly = [(cx - 19, cy - 30), (cx - 19, cy + 30), (cx - 8, cy + 58), (cx + 8, cy + 58), (cx + 19, cy + 30), (cx + 19, cy - 30), (cx + 8, cy - 58), (cx - 8, cy - 58)]
    prism_tower(sh, [(0, poly), (44, poly)], "far_metlife")
    inner = [(cx + (px - cx) * 0.9, cy + (py - cy) * 0.93) for px, py in poly]
    prism_tower(sh, [(44, inner), (238, inner)], "far_metlife")
    for z in (122.0, 232.0):
        sh.prism([(cx + (px - cx) * 0.925, cy + (py - cy) * 0.955) for px, py in poly], z, z + 7.0, "concrete_light")
    sh.prism([(cx + (px - cx) * 0.62, cy + (py - cy) * 0.62) for px, py in poly], 238, 246, "concrete_panel")
    city.footprints.append(((x0, x1, y0, y1), 220.0))


def radiator_building(city):
    """Black brick and gilded terracotta on the south side of Bryant Park."""
    x0, x1, y0, y1 = D.LOTS["radiator"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = style(city, "deco", mod="decon", base="rust", base_floors=1, cornice="deco", tank=0.0, pier=(0.7, 0.9),
              o={"wall": "brick_black", "trim": "gold", "spandrel": "brick_black", "frame": "paint_black", "glass": "glass_office"})
    steps = [(30.0, 30.0, 0.0, 58.0), (25.0, 24.0, 58.0, 72.0), (19.0, 19.0, 72.0, 84.0), (13.0, 13.0, 84.0, 93.0)]
    tiers = [(rect_c(cx, cy, wx, wy), a, b) for wx, wy, a, b in steps]
    Building(city, (x0, x1, y0, y1), 93.0, s, "NWE", detail=0, tiers=tiers, signs=False, clutter=False).build()
    sh = city.shell(cx, cy, "landmark")
    for wx, wy, a, b in steps:
        r = rect_c(cx, cy, wx, wy)
        for px, py in ((r[0], r[2]), (r[0], r[3]), (r[1], r[2]), (r[1], r[3]), (cx, r[2]), (cx, r[3]), (r[0], cy), (r[1], cy)):
            sh.box((px - 0.55, py - 0.55, b - 2.5), (px + 0.55, py + 0.55, b + 2.2), "gold")
            sh.lathe((px, py, b + 2.2), [(0.7, 0), (0.25, 1.3), (0.35, 1.7), (0.0, 3.4)], "gold", segments=6)
        floods(city, r, b - 0.2, (1.0, 0.62, 0.2), 3400, reach=17, step=7.5, offset=1.2)
    sh.box((cx - 4, cy - 4, 93), (cx + 4, cy + 4, 99), "gold")
    sh.lathe((cx, cy, 99), [(3.5, 0), (2.0, 2.5), (1.4, 3.0), (0.0, 7.5)], "gold", segments=8)
    floods(city, rect_c(cx, cy, 8, 8), 93.2, (1.0, 0.58, 0.16), 5000, reach=18, step=5, offset=1.4)


def daily_news(city):
    """Unbroken white brick stripes with russet spandrels, flat top."""
    x0, x1, y0, y1 = D.LOTS["dailynews"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = style(city, "deco", mod="decon", cornice=None, tank=0.0, pier=(0.6, 0.8),
              o={"wall": "brick_white", "spandrel": "brick_red", "trim": "brick_white", "frame": "paint_darkgray"})
    tiers = [((x0, x1, y0, y1), 0, 36.0), (rect_c(cx, cy, 52, 46), 36, 100.0), (rect_c(cx, cy, 44, 30), 100, 145.0)]
    Building(city, (x0, x1, y0, y1), 145.0, s, "SNWE", detail=1, tiers=tiers, signs=False).build()


def tudor_city(city):
    sh = city.shell(5.0, 960.0, "tudor")
    for rect, h in (((14.0, 60.0, 925.0, 1000.0), 52.0), ((-62.0, -14.0, 935.0, 1005.0), 46.0), ((-130.0, -84.0, 930.0, 1000.0), 40.0),
                    ((84.0, 130.0, 928.0, 1000.0), 58.0)):
        s = style(city, "brick", mod="pw1", base="rust", base_floors=1, top="pwattic", cornice="coping", tank=0.7, ground="none",
                  o={"wall": "brick_brown", "trim": "limestone_trim", "frame": "paint_cream", "glass": "glass_home"})
        Building(city, rect, h, s, "SNWE", detail=1).build()
        x0, x1, yy0, yy1 = rect
        k = yy0
        while k < yy1 - 6:
            sh.poly([(x0, k, h + 1.0), (x0, k + 7, h + 1.0), (x0, k + 3.5, h + 6.2)], "brick_brown", normal=(-1, 0, 0))
            sh.poly([(x1, k, h + 1.0), (x1, k + 7, h + 1.0), (x1, k + 3.5, h + 6.2)], "brick_brown", normal=(1, 0, 0))
            for a, b in ((k, k + 3.5), (k + 7, k + 3.5)):
                sh.quad((x0, a, h + 1.0), (x1, a, h + 1.0), (x1, b, h + 6.2), (x0, b, h + 6.2), "copper_green", normal=(0, a - b, 3.5))
            k += 7.0
    # the stone bridge over 42nd Street that photographers line for the sunrise and sunset
    yb = 905.0
    sh.box((-15.0, yb - 5, 5.6), (15.0, yb + 5, 7.0), "limestone_dark")
    for yy in (yb - 5, yb + 5):
        sh.box((-15.0, yy - 0.2, 7.0), (15.0, yy + 0.2, 8.05), "limestone")
    for xx in (-13.0, 13.0):
        sh.box((xx - 2.0, yb - 5, 0.15), (xx + 2.0, yb + 5, 5.6), "limestone_dark")


def un_secretariat(city):
    cx, cy = D.LANDMARKS_FAR["un"]
    sh = city.shell(cx, cy, "landmark")
    sh.box((cx - 44, cy - 11, 0), (cx + 44, cy + 11, 154), "far_un", faces="xXyY")
    sh.box((cx - 44.4, cy - 11.2, 0), (cx - 44, cy + 11.2, 156), "marble")
    sh.box((cx + 44, cy - 11.2, 0), (cx + 44.4, cy + 11.2, 156), "marble")
    sh.quad((cx - 44, cy - 11, 154), (cx + 44, cy - 11, 154), (cx + 44, cy + 11, 154), (cx - 44, cy + 11, 154), "roof", normal=(0, 0, 1))
    city.footprints.append(((cx - 44, cx + 44, cy - 11, cy + 11), 150.0))


# =========================================================================== distant silhouettes
def far_landmarks(city):
    P = D.LANDMARKS_FAR

    token = [False]

    def S(key):
        x, y = P[key]
        token[0] = city.begin(kind="landmark", name=key, rect=[x - 25, x + 25, y - 25, y + 25], h=200.0, style="glass",
                              wall="limestone", trim="limestone_trim", glass="curtain_blue", frame="anodized", party="concrete_panel",
                              fh=4.0, bay=1.6, tiers=[[x - 22, x + 22, y - 22, y + 22, 0.0, 200.0]])
        return x, y, city.shell(x, y, "farmark")

    def done(x, y, w, h):
        city.footprints.append(((x - w, x + w, y - w, y + w), h))
        if city.cur is not None:
            rec = city.records[city.cur]
            rec["rect"] = [x - w, x + w, y - w, y + w]
            rec["h"] = float(h)
            rec["tiers"] = [[x - w * 0.85, x + w * 0.85, y - w * 0.85, y + w * 0.85, 0.0, float(h)]]
        city.end(token[0])
        token[0] = False

    # One World Trade Center: square base twisting into a rotated square
    x, y, sh = S("wtc")
    h = 62.0
    base = [(x - 31, y - 31), (x, y - 31), (x + 31, y - 31), (x + 31, y), (x + 31, y + 31), (x, y + 31), (x - 31, y + 31), (x - 31, y)]
    top = [(x - 22, y - 22), (x, y - 31), (x + 22, y - 22), (x + 31, y), (x + 22, y + 22), (x, y + 31), (x - 22, y + 22), (x - 31, y)]
    top = [(x - 11, y - 11), (x, y - 31), (x + 11, y - 11), (x + 31, y), (x + 11, y + 11), (x, y + 31), (x - 11, y + 11), (x - 31, y)]
    diamond = [(x + (px - x) * 0.78, y + (py - y) * 0.78) for px, py in top]
    prism_tower(sh, [(0, base), (60, base), (417, diamond)], "far_wtc")
    spire(sh, x, y, 417, 541, 2.4, "paint_white", city=city)
    done(x, y, 32, 410)
    # Woolworth: slim gothic tower with a green pyramid
    x, y, sh = S("woolworth")
    sh.box((x - 28, y - 25, 0), (x + 28, y + 25, 120), "far_stone", faces="xXyYZ")
    sh.box((x - 13, y - 13, 120), (x + 13, y + 13, 188), "far_stone", faces="xXyYZ")
    sh.box((x - 9, y - 9, 188), (x + 9, y + 9, 207), "far_stone", faces="xXyYZ")
    sh.lathe((x, y, 207), [(10.5, 0), (4.0, 20), (1.5, 24), (0.0, 34)], "copper_green", segments=8)
    done(x, y, 28, 200)
    # Flatiron wedge
    x, y, sh = S("flatiron")
    prism_tower(sh, [(0, [(x - 28, y - 14), (x - 28, y + 16), (x + 30, y + 2), (x + 30, y - 2)]), (87, [(x - 28, y - 14), (x - 28, y + 16), (x + 30, y + 2), (x + 30, y - 2)])], "far_stone")
    done(x, y, 30, 87)
    # Madison Square clock tower: campanile, pyramid roof and gilded lantern
    x, y, sh = S("mettower")
    sh.box((x - 12, y - 13, 0), (x + 12, y + 13, 160), "far_stone", faces="xXyYZ")
    sh.box((x - 9, y - 10, 160), (x + 9, y + 10, 176), "far_stone", faces="xXyYZ")
    prism_tower(sh, [(176, square(x, y, 20, 22)), (200, square(x, y, 4, 4))], "limestone")
    sh.lathe((x, y, 200), [(2.4, 0), (2.4, 6), (0.0, 13)], "gold", segments=8)
    for f, (dx, dy) in (("n", (1, 0)), ("s", (-1, 0)), ("e", (0, 1)), ("w", (0, -1))):
        m = MeshBuilder()
        m.lathe((0, 0, 0), [(0.0, 0.3), (3.7, 0.25), (3.9, 0.0)], "clockface", segments=24)
        sh.merge(m, offset=(x + dx * 12.2, y + dy * 13.2, 118), yaw=math.degrees(math.atan2(dy, dx)), pitch=90.0)
    floods(city, rect_c(x, y, 18, 20), 176, (1.0, 0.86, 0.62), 30000, reach=44, step=10)
    done(x, y, 13, 180)
    # New York Life: stepped block under a gold pyramid
    x, y, sh = S("nylife")
    sh.box((x - 34, y - 42, 0), (x + 34, y + 42, 70), "far_stone", faces="xXyYZ")
    sh.box((x - 24, y - 28, 70), (x + 24, y + 28, 112), "far_stone", faces="xXyYZ")
    sh.box((x - 16, y - 17, 112), (x + 16, y + 17, 146), "far_stone", faces="xXyYZ")
    prism_tower(sh, [(146, octagon(x, y, 30, 31, 8)), (180, octagon(x, y, 4, 4, 1.2))], "gold_roof")
    sh.lathe((x, y, 180), [(2.0, 0), (1.2, 4), (0.0, 9)], "gold_roof", segments=8)
    floods(city, rect_c(x, y, 31, 32), 146, (1.0, 0.66, 0.24), 60000, reach=50, step=11, offset=3)
    done(x, y, 34, 150)
    # 30 Rockefeller Plaza: thin stepped limestone slab
    x, y, sh = S("rock")
    for wx, wy, a, b in ((34, 100, 0, 150), (30, 82, 150, 200), (26, 66, 200, 232), (22, 50, 232, 259)):
        sh.box((x - wx / 2, y - wy / 2, a), (x + wx / 2, y + wy / 2, b), "far_deco", faces="xXyYZ")
    floods(city, rect_c(x, y, 24, 52), 232, (1.0, 0.92, 0.78), 30000, reach=44, step=13, offset=3)
    done(x, y, 40, 259)
    # 432 Park: a square grid, six windows a face
    x, y, sh = S("p432")
    sh.box((x - 14.25, y - 14.25, 0), (x + 14.25, y + 14.25, 426), "far_432", faces="xXyYZ")
    city.inst("beacon", (x, y, 427), 0, 1.5, custom=(1.0, 0.04, 0.02, 0.7))
    done(x, y, 15, 426)
    x, y, sh = S("cpt")
    sh.box((x - 18, y - 24, 0), (x + 18, y + 24, 300), "far_crystal", faces="xXyYZ")
    sh.box((x - 16, y - 16, 300), (x + 16, y + 16, 442), "far_crystal", faces="xXyYZ")
    sh.box((x - 10, y - 14, 442), (x + 12, y + 14, 472), "far_crystal", faces="xXyYZ")
    done(x, y, 22, 440)
    x, y, sh = S("steinway")
    z = 90.0
    sh.box((x - 15, y - 9, 0), (x + 15, y + 9, 90), "far_stone", faces="xXyYZ")
    for i, (za, zb) in enumerate(((90, 255), (255, 300), (300, 340), (340, 374), (374, 402), (402, 424), (424, 435))):
        sh.box((x - 9, y - 9, za), (x + 9 - i * 2.2, y + 9, zb), "far_bronze", faces="xXyYZ")
    done(x, y, 10, 420)
    # Citigroup: aluminium shaft with the 45-degree wedge top
    x, y, sh = S("citi")
    sh.box((x - 24, y - 24, 35), (x + 24, y + 24, 230), "far_citi", faces="xXyYz")
    for dx, dy in ((0, -20), (0, 20), (-20, 0), (20, 0)):
        sh.box((x + dx - 4, y + dy - 4, 0), (x + dx + 4, y + dy + 4, 35), "aluminium")
    sh.poly([(x - 24, y - 24, 230), (x + 24, y - 24, 230), (x + 24, y + 24, 278), (x - 24, y + 24, 278)], "aluminium", normal=(-0.7, 0, 0.7))
    sh.quad((x - 24, y + 24, 230), (x + 24, y + 24, 230), (x + 24, y + 24, 278), (x - 24, y + 24, 278), "far_citi", normal=(0, 1, 0))
    for xx, nx in ((x - 24, -1), (x + 24, 1)):
        sh.poly([(xx, y - 24, 230), (xx, y + 24, 230), (xx, y + 24, 278)], "aluminium", normal=(nx, 0, 0))
    done(x, y, 25, 260)
    # Hudson Yards
    for key, hh, w in (("hy30", 387.0, 30.0), ("hy10", 268.0, 26.0)):
        x, y, sh = S(key)
        prism_tower(sh, [(0, square(x, y, w * 2, w * 1.7)), (hh - 40, square(x, y, w * 1.5, w * 1.2)), (hh - 38, square(x, y, w * 1.45, w * 1.15))], "far_wtc", close_top=False)
        q = square(x, y, w * 1.45, w * 1.15)
        hi = [(q[0][0], q[0][1], hh - 30), (q[1][0], q[1][1], hh), (q[2][0], q[2][1], hh - 8), (q[3][0], q[3][1], hh - 38)]
        for i in range(4):
            a, b = q[i], q[(i + 1) % 4]
            sh.poly([(a[0], a[1], hh - 38), (b[0], b[1], hh - 38), hi[(i + 1) % 4], hi[i]], "far_wtc", normal=((a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - y, 0.001))
        sh.poly(hi, "far_wtc", normal=(0, 0, 1))
        done(x, y, w, hh - 20)
    x, y, sh = S("conde")
    sh.box((x - 28, y - 30, 0), (x + 28, y + 30, 205), "far_crystal", faces="xXyYZ")
    sh.box((x - 20, y - 20, 205), (x + 20, y + 20, 247), "far_stone", faces="xXyYZ")
    spire(sh, x, y, 247, 340, 2.2, "paint_white", city=city)
    done(x, y, 30, 230)
    x, y, sh = S("times")
    sh.box((x - 24, y - 30, 0), (x + 24, y + 30, 228), "far_nyt", faces="xXyYZ")
    spire(sh, x, y, 228, 319, 1.4, "paint_white", city=city)
    done(x, y, 30, 228)


def midtown_named(city):
    """Named neighbours of the hero corner that use the modular kit with their own massing."""
    def block(key, h, st, steps=None, streets="SNWE", detail=0, signs=True):
        r = D.LOTS[key]
        cx, cy = (r[0] + r[1]) / 2, (r[2] + r[3]) / 2
        wx, wy = r[1] - r[0], r[3] - r[2]
        tiers = None
        if steps:
            tiers = [(rect_c(cx, cy, wx * fx, wy * fy), a, b) for fx, fy, a, b in steps]
        Building(city, r, h, st, streets, detail=detail, tiers=tiers, signs=signs).build()

    block("five_hundred", 212.0, style(city, "deco", mod="decon", base="rust", base_floors=2, tank=0.0,
                                       o={"wall": "limestone", "spandrel": "terracotta", "frame": "paint_darkgray"}),
          [(1, 1, 0, 70), (0.86, 0.9, 70, 104), (0.7, 0.76, 104, 168), (0.58, 0.62, 168, 194), (0.42, 0.46, 194, 212)])
    block("salmon", 131.0, style(city, "stone", mod="pw1", base="rust", base_floors=2, top="pwarch", o={"wall": "limestone", "trim": "limestone_trim"}),
          [(1, 1, 0, 74), (0.84, 0.82, 74, 100), (0.6, 0.55, 100, 131)])
    block("lincoln", 205.0, style(city, "brick", mod="pw2", base="rust", base_floors=2, top="pwarch", tank=0.0, o={"wall": "brick_buff"}),
          [(1, 1, 0, 78), (0.9, 0.78, 78, 118), (0.74, 0.58, 118, 168), (0.5, 0.4, 168, 205)])
    block("bowery", 74.0, style(city, "stone", mod="pw1", base="rust", base_floors=2, top="pwarch", o={"wall": "limestone_dark"}))
    block("chanin", 198.0, style(city, "deco", mod="deco", base="rust", base_floors=1, tank=0.0,
                                 o={"wall": "brick_buff", "spandrel": "bronze", "trim": "terracotta"}),
          [(1, 1, 0, 66), (0.82, 0.84, 66, 96), (0.6, 0.64, 96, 160), (0.46, 0.5, 160, 184), (0.3, 0.34, 184, 198)])
    hx0, hx1, hy0, hy1 = D.LOTS["hsbc"]
    Building(city, D.LOTS["hsbc"], 96.0, style(city, "glass", mod="cw", o={"glass": "curtain_dark", "spg": "spandrel_dark", "mullion": "paint_black"}),
             "SNWE", detail=0, tiers=[((hx0, hx1, hy0, hy1), 0.0, 27.0), ((hx0 + 2, hx1 - 2, hy0, -37.0), 27.0, 96.0)]).build()
    block("hyatt", 106.0, style(city, "glass", mod="cwsplit", o={"glass": "curtain_silver", "spg": "spandrel_blue", "mullion": "anodized"}))
