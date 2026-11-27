"""Everything out to the horizon: the rest of Manhattan, the rivers, the boroughs, New Jersey
and the East River bridges."""
import math

import numpy as np

import citydata as D
from blocks import zone
from meshlib import MeshBuilder, triangulate

# style indices understood by FarFacade.ush
S_LIME, S_BUFF, S_RED, S_BROWN, S_WHITE, S_GLASS_B, S_GLASS_D, S_GLASS_G, S_CONC, S_BLACKGLASS = range(10)


def farbox_mesh():
    mb = MeshBuilder()
    mb.box((0, 0, 0), (1, 1, 1), "farbox", faces="xXyYZ")
    return mb


def farwoods_mesh(seed=2):
    """A clump of bare winter crowns for parks seen from far off."""
    mb = MeshBuilder()
    rng = np.random.default_rng(seed)
    for _ in range(18):
        x, y = rng.uniform(-14, 14), rng.uniform(-14, 14)
        h = rng.uniform(7, 15)
        mb.tube([(x, y, 0), (x, y, h * 0.5)], 0.3, 4, "farbark", caps=False)
        for k in range(9):
            c = np.array((x + rng.uniform(-3, 3), y + rng.uniform(-3, 3), h * rng.uniform(0.45, 1.0)))
            for j in range(5):
                d = rng.normal(0, 1, 3)
                d /= np.linalg.norm(d)
                e = rng.normal(0, 1, 3)
                e /= np.linalg.norm(e)
                mb.poly([c, c + d * 2.3, c + d * 1.4 + e * 0.5], "farbark", normal=np.cross(d, e))
    return mb


def farroof_mesh():
    mb = MeshBuilder()
    mb.box((-0.5, -0.5, 0), (0.5, 0.5, 1), "farroof", faces="xXyYZ")
    return mb


def far_height(rng, x, y):
    u = rng.random()
    if -950 < x < 2100 and -1150 < y < 1150:
        if u < 0.09:
            return rng.uniform(120, 215)
        return rng.uniform(26, 105) ** 1.0
    if -2700 < x <= -950:
        if u < 0.05:
            return rng.uniform(80, 170)
        return rng.uniform(16, 62)
    if -4400 < x <= -2700:
        if u < 0.03:
            return rng.uniform(50, 100)
        return rng.uniform(11, 28)
    if x <= -4400:
        if math.hypot(x + 5300, y + 100) < 950 or math.hypot(x + 5900, y - 300) < 700:
            return rng.uniform(60, 235) if u < 0.62 else rng.uniform(25, 70)
        return rng.uniform(14, 55)
    if y < -1150:
        if -1100 < x < -300 and -1700 < y < -1150:
            return rng.uniform(90, 255) if u < 0.4 else rng.uniform(20, 60)
        if u < 0.07:
            return rng.uniform(80, 170)
        return rng.uniform(10, 34)
    if x >= 2100:
        if u < 0.1:
            return rng.uniform(70, 150)
        return rng.uniform(18, 58)
    if u < 0.08:
        return rng.uniform(70, 165)
    return rng.uniform(14, 52)


def style_for(rng, h):
    if h > 110:
        return int(rng.choice([S_GLASS_B, S_GLASS_D, S_GLASS_G, S_LIME, S_BUFF, S_BLACKGLASS, S_WHITE], p=[.22, .2, .1, .18, .14, .08, .08]))
    if h > 40:
        return int(rng.choice([S_LIME, S_BUFF, S_RED, S_BROWN, S_WHITE, S_GLASS_B, S_GLASS_D, S_CONC], p=[.2, .24, .14, .12, .13, .05, .05, .07]))
    return int(rng.choice([S_RED, S_BROWN, S_BUFF, S_WHITE, S_LIME, S_CONC], p=[.38, .24, .18, .1, .05, .05]))


class FarCity:
    def __init__(self, city):
        self.c = city
        self.rng = np.random.default_rng(2024)
        self.manhattan = D.poly_xy(D.MANHATTAN)
        self.park = D.poly_xy(D.CENTRAL_PARK)
        self.count = 0
        self.keepout = []
        for key, (x, y) in D.LANDMARKS_FAR.items():
            r = 45.0 if key not in ("wtc", "rock", "cpt", "citi") else 60.0
            self.keepout.append((x - r, x + r, y - r, y + r))

    def blocked(self, rect):
        return any(D.rects_overlap(rect, k) for k in self.keepout)

    def box(self, x0, y0, wx, wy, h, style, yaw=0.0, z=0.0, rt=True):
        c = self.c
        ref = c.inst("farbox", (x0, y0, z), yaw, (wx, wy, h), custom=(float(style), float(self.rng.random()), float(self.rng.random()), float(self.rng.random())),
                     rt=rt, layer="far")
        c.far_records.append((float(x0), float(y0), float(wx), float(wy), float(z), float(h), float(yaw), ref, int(style)))
        self.count += 1

    def building(self, x0, x1, y0, y1, h, style=None, detail_roof=False, near=False):
        rng = self.rng
        st = style_for(rng, h) if style is None else style
        wx, wy = x1 - x0, y1 - y0
        if h > 60 and rng.random() < 0.6 and min(wx, wy) > 18:
            z1 = h * rng.uniform(0.38, 0.65)
            self.box(x0, y0, wx, wy, z1, st, rt=near)
            ix, iy = wx * rng.uniform(0.08, 0.2), wy * rng.uniform(0.08, 0.2)
            z2 = h if rng.random() < 0.6 else z1 + (h - z1) * rng.uniform(0.55, 0.85)
            self.box(x0 + ix, y0 + iy, wx - 2 * ix, wy - 2 * iy, z2 - z1, st, z=z1, rt=near)
            if z2 < h:
                self.box(x0 + ix * 1.9, y0 + iy * 1.9, max(wx - 3.8 * ix, 6), max(wy - 3.8 * iy, 6), h - z2, st, z=z2, rt=near)
        else:
            self.box(x0, y0, wx, wy, h, st, rt=near)
        if detail_roof:
            if rng.random() < 0.8:
                bw, bd = rng.uniform(3, 8), rng.uniform(3, 8)
                if wx > bw + 2 and wy > bd + 2 and h < 60:
                    self.c.inst("farroof", (x0 + rng.uniform(bw / 2 + 1, wx - bw / 2 - 1), y0 + rng.uniform(bd / 2 + 1, wy - bd / 2 - 1), h),
                                0.0, (bw, bd, rng.uniform(2, 4.5)), layer="far", rt=False)
            if 16 < h < 62 and rng.random() < 0.34 and min(wx, wy) > 7:
                self.c.inst("watertower", (x0 + rng.uniform(2.5, wx - 2.5), y0 + rng.uniform(2.5, wy - 2.5), h), float(rng.uniform(0, 360)),
                            float(rng.uniform(0.85, 1.2)), layer="far", rt=False)

    def manhattan_blocks(self):
        rng = self.rng
        avenue_y = [-2120.0, -1960.0, -1785.0, -1500.0, -1215.0, -931.0, -621.0, -311.0, 0.0, 155.0, 320.0, 470.0, 630.0, 845.0,
                    1075.0, 1300.0, 1515.0, 1730.0, 1945.0, 2160.0]
        for n in range(-55, 130):
            xa = D.street_x(n) + D.street_width(n) / 2
            xb = D.street_x(n + 1) - D.street_width(n + 1) / 2
            for ya, yb in zip(avenue_y[:-1], avenue_y[1:]):
                p, q = ya + 15.0, yb - 15.0
                cx, cy = (xa + xb) / 2, (p + q) / 2
                if not D.point_in_poly(cx, cy, self.manhattan) or D.point_in_poly(cx, cy, self.park):
                    continue
                if 28 <= n <= 54 and zone(cx, cy) < 2:
                    continue
                dist = math.hypot(cx, cy)
                if dist > 9000:
                    continue
                coarse = dist > 3800
                for hx0, hx1 in ((xa, (xa + xb) / 2), ((xa + xb) / 2, xb)):
                    y = p
                    while y < q - 8:
                        w = float(rng.uniform(26, 75) if coarse else rng.uniform(11, 46))
                        w = min(w, q - y)
                        if q - (y + w) < 8:
                            w = q - y
                        rect = (hx0, hx1, y, y + w)
                        corners = [(rect[i], rect[j]) for i in (0, 1) for j in (2, 3)]
                        if all(D.point_in_poly(px, py, self.manhattan) for px, py in corners) and not self.blocked(rect) and zone((hx0 + hx1) / 2, y + w / 2) == 2:
                            h = float(far_height(rng, (hx0 + hx1) / 2, y + w / 2))
                            if y <= p + 1 or y + w >= q - 1:
                                h *= 1.18
                            inset = float(rng.uniform(0, 2.5))
                            self.building(hx0 + (0 if hx0 == xa else 0.1), hx1 - (inset if hx1 != xb else 0), y + 0.05, y + w - 0.05, h,
                                          detail_roof=dist < 2600, near=dist < 1300)
                        y += w

    def central_park(self):
        rng = self.rng
        xs = [p[0] for p in self.park]
        ys = [p[1] for p in self.park]
        x = min(xs)
        while x < max(xs):
            y = min(ys)
            while y < max(ys):
                px, py = x + rng.uniform(-10, 10), y + rng.uniform(-10, 10)
                if D.point_in_poly(px, py, self.park) and rng.random() < 0.78:
                    self.c.inst("farwoods", (px, py, 0.0), float(rng.uniform(0, 360)), float(rng.uniform(0.9, 1.4)), layer="far", rt=False, shadow=math.hypot(px, py) < 3000)
                y += 30.0
            x += 30.0

    def region(self, poly_ll, spacing, yaw_deg, height_fn, max_dist):
        rng = self.rng
        poly = D.poly_xy(poly_ll)
        c, s = math.cos(math.radians(yaw_deg)), math.sin(math.radians(yaw_deg))
        R = int(max_dist / spacing[0]) + 2
        Q = int(max_dist / spacing[1]) + 2
        for i in range(-R, R):
            for j in range(-Q, Q):
                u, w = i * spacing[0], j * spacing[1]
                x, y = u * c - w * s, u * s + w * c
                d = math.hypot(x, y)
                if d > max_dist or not D.point_in_poly(x, y, poly):
                    continue
                far = d > 4500
                if far and rng.random() < 0.35:
                    continue
                pieces = 1 if far else int(rng.integers(1, 4))
                for k in range(pieces):
                    wx = spacing[0] * rng.uniform(0.55, 0.78)
                    wy = spacing[1] / pieces * rng.uniform(0.6, 0.86)
                    off = k * spacing[1] / pieces
                    bx, by = x - off * s, y + off * c
                    if not D.point_in_poly(bx + wx / 2, by + wy / 2, poly):
                        continue
                    h = float(height_fn(rng, bx, by))
                    self.box(bx, by, wx, wy, h, style_for(rng, h), yaw=yaw_deg, rt=False)

    def boroughs(self):
        lic = D.geo(40.7465, -73.9445)
        dtbk = D.geo(40.6920, -73.9860)
        wburg = D.geo(40.7180, -73.9610)
        jc = D.geo(40.7175, -74.0340)
        fortlee = D.geo(40.8500, -73.9720)

        def cluster(rng, x, y, centre, radius, lo, hi, share):
            return math.hypot(x - centre[0], y - centre[1]) < radius and rng.random() < share

        def queens(rng, x, y):
            if cluster(rng, x, y, lic, 650, 0, 0, 0.45):
                return rng.uniform(60, 215)
            if cluster(rng, x, y, dtbk, 700, 0, 0, 0.32):
                return rng.uniform(50, 180)
            if cluster(rng, x, y, wburg, 600, 0, 0, 0.14):
                return rng.uniform(40, 120)
            return rng.uniform(6, 19) if rng.random() < 0.96 else rng.uniform(24, 60)

        def jersey(rng, x, y):
            if cluster(rng, x, y, jc, 750, 0, 0, 0.5):
                return rng.uniform(60, 240)
            if cluster(rng, x, y, fortlee, 500, 0, 0, 0.15):
                return rng.uniform(50, 120)
            return rng.uniform(6, 18) if rng.random() < 0.97 else rng.uniform(24, 70)

        self.region(D.QUEENS_BROOKLYN, (78.0, 150.0), 8.0, queens, 8500)
        self.region(D.NEW_JERSEY, (85.0, 165.0), -12.0, jersey, 9000)
        self.region(D.BRONX, (110.0, 200.0), 0.0, lambda rng, x, y: rng.uniform(8, 36), 11000)
        self.region(D.ROOSEVELT, (60.0, 50.0), 0.0, lambda rng, x, y: rng.uniform(15, 55), 6000)

    def ground_and_water(self):
        c = self.c
        for index, (key, poly, z) in enumerate((("manhattan", D.MANHATTAN, -0.06), ("queens", D.QUEENS_BROOKLYN, -0.08),
                                               ("jersey", D.NEW_JERSEY, -0.08), ("bronx", D.BRONX, -0.1), ("roosevelt", D.ROOSEVELT, -0.07))):
            pts = D.poly_xy(poly)
            mb = c.shells.setdefault(("farground", index, 0), MeshBuilder())
            slot = "farground" if key == "manhattan" else "farground_boro"
            mb.prism(pts, -3.5, z, "limestone_dark", top=slot, sides=True)
        water = c.shells.setdefault(("water", 0, 0), MeshBuilder())
        S, N = 60000.0, 24
        for i in range(N):
            for j in range(N):
                x0, x1 = -S / 2 + S * i / N, -S / 2 + S * (i + 1) / N
                y0, y1 = -S / 2 + S * j / N, -S / 2 + S * (j + 1) / N
                water.quad((x0, y0, -2.2), (x1, y0, -2.2), (x1, y1, -2.2), (x0, y1, -2.2), "water", normal=(0, 0, 1))
        # low wooded ridges that close the horizon beyond the far shores
        ridge = c.shells.setdefault(("ridge", 0, 0), MeshBuilder())
        rng = np.random.default_rng(77)
        n = 180
        for ring_r, h_lo, h_hi in ((15000.0, 30.0, 120.0), (21000.0, 90.0, 260.0)):
            hs = np.convolve(rng.uniform(h_lo, h_hi, n + 8), np.ones(7) / 7, mode="valid")[:n]
            pts = []
            for i in range(n):
                a = 2 * math.pi * i / n
                pts.append((ring_r * math.cos(a), ring_r * math.sin(a)))
            for i in range(n):
                j = (i + 1) % n
                a, b = pts[i], pts[j]
                ai = (a[0] * 1.08, a[1] * 1.08)
                bi = (b[0] * 1.08, b[1] * 1.08)
                ridge.quad((a[0], a[1], -2.0), (b[0], b[1], -2.0), (bi[0], bi[1], hs[j]), (ai[0], ai[1], hs[i]), "farridge", normal=(-a[0], -a[1], ring_r))

    # ------------------------------------------------------------------ bridges
    def bridge(self, a, b, tower_t, tower_h, deck_z, style):
        c = self.c
        sh = c.shells.setdefault(("bridge", int(a[0]) % 997, int(a[1]) % 997), MeshBuilder())
        a, b = np.array((a[0], a[1], 0.0)), np.array((b[0], b[1], 0.0))
        axis = b - a
        L = np.linalg.norm(axis)
        axis /= L
        side = np.array((-axis[1], axis[0], 0.0))
        yaw = math.degrees(math.atan2(axis[1], axis[0]))
        mid = (a + b) / 2
        sh.obox((mid[0], mid[1], deck_z), (L, 24.0, 2.6), yaw, "paint_darkgray")
        mat = "limestone_dark" if style == "stone" else "paint_gray"
        for t in tower_t:
            p = a + axis * L * t
            if style == "stone":
                for s in (-9.0, 0.0, 9.0):
                    q = p + side * s
                    sh.obox((q[0], q[1], tower_h * 0.44), (12.0, 4.5, tower_h * 0.88), yaw, mat)
                sh.obox((p[0], p[1], tower_h * 0.92), (13.0, 24.0, tower_h * 0.16), yaw, mat)
                sh.obox((p[0], p[1], deck_z * 0.5), (15.0, 28.0, deck_z), yaw, mat)
            else:
                for s in (-11.0, 11.0):
                    q = p + side * s
                    sh.obox((q[0], q[1], tower_h * 0.5), (7.0, 3.4, tower_h), yaw, mat)
                for z in (deck_z + 6, tower_h * 0.72, tower_h - 2):
                    sh.obox((p[0], p[1], z), (5.0, 24.0, 3.0), yaw, mat)
        spans = [0.0] + list(tower_t) + [1.0]
        for s in (-11.0, 11.0):
            for i in range(len(spans) - 1):
                t0, t1 = spans[i], spans[i + 1]
                h0 = tower_h * 0.95 if t0 in tower_t else deck_z + 3
                h1 = tower_h * 0.95 if t1 in tower_t else deck_z + 3
                pts = []
                for k in range(25):
                    u = k / 24
                    t = t0 + (t1 - t0) * u
                    sag = 4 * u * (1 - u) * (tower_h - deck_z) * (0.82 if t0 in tower_t and t1 in tower_t else 0.18)
                    p = a + axis * L * t + side * s
                    pts.append((p[0], p[1], h0 + (h1 - h0) * u - sag))
                sh.tube(pts, 0.45, 5, "paint_gray", caps=False)
                for k in range(1, 24):
                    p = pts[k]
                    sh.tube([p, (p[0], p[1], deck_z + 1.0)], 0.09, 3, "paint_gray", caps=False)
                    if k % 2 == 0:
                        c.inst("beacon", (p[0], p[1], p[2] + 0.5), 0.0, 0.9, custom=(1.0, 0.86, 0.6, 0.9), layer="far", rt=False, shadow=False)
        k = 0.0
        while k < L:
            for s in (-12.0, 12.0):
                p = a + axis * k + side * s
                c.inst("beacon", (p[0], p[1], deck_z + 5.0), 0.0, 0.75, custom=(1.0, 0.62, 0.25, 0.9), layer="far", rt=False, shadow=False)
            k += 32.0

    def bridges(self):
        self.bridge(D.geo(40.7128, -74.0040), D.geo(40.6995, -73.9895), (0.34, 0.68), 84.0, 40.0, "stone")
        self.bridge(D.geo(40.7135, -73.9960), D.geo(40.7005, -73.9880), (0.3, 0.7), 100.0, 42.0, "steel")
        self.bridge(D.geo(40.7155, -73.9780), D.geo(40.7110, -73.9640), (0.28, 0.74), 102.0, 42.0, "steel")
        self.bridge(D.geo(40.7610, -73.9640), D.geo(40.7545, -73.9440), (0.22, 0.46, 0.72), 106.0, 40.0, "steel")

    def build(self):
        self.ground_and_water()
        self.manhattan_blocks()
        self.central_park()
        self.boroughs()
        self.bridges()
        return self.count
