"""Roadways, kerbs, sidewalks, markings and everything set into the ground.
Also writes the lane graph that the traffic simulation and parked cars use."""
import math

import numpy as np

import citydata as D
from meshlib import MeshBuilder

PAINT_Z = 0.006
FONT = {
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "N": ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
}


def street_numbers(xlo, xhi):
    return [n for n in range(20, 62) if xlo <= D.street_x(n) <= xhi]


def street_gap(n, y):
    """True where a cross street does not exist."""
    if n == 41 and -300 < y < -12:
        return True
    if n in (43, 44, 45) and 245 < y < 455:
        return True
    return False


def avenue_gap(name, x):
    if name == "Park" and D.street_x(42) + 15.0 < x < D.street_x(46) - 10:
        return True
    return False


def avenues_for_interval(n):
    """Avenue centre lines bounding the blocks between street n and n+1, west to east."""
    names = [k for k in D.AVENUES]
    out = [(D.AVENUES[k][0], D.AVENUES[k][2], D.AVENUES[k][1], k) for k in names]
    if 42 <= n < 46:
        out = [a for a in out if a[3] != "Park"]
        out.append((D.VANDERBILT_Y, 11.0, 18.3, "Vanderbilt"))
    out.sort()
    return out


def track_value(off, lanes):
    t = 0.0
    for c, d, kind, w in lanes:
        if kind in ("drive", "bus"):
            u = (abs(off - c) - 0.85) / 0.24
            t = max(t, math.exp(-u * u))
    return t


def cross_columns(half, lanes):
    cols = {-half, -half + 0.35, -half + 1.35, half - 1.35, half - 0.35, half, 0.0}
    for c, d, kind, w in lanes:
        if kind in ("drive", "bus"):
            for o in (-1.3, -0.85, -0.4, 0.4, 0.85, 1.3):
                if abs(c + o) < half:
                    cols.add(c + o)
    out = []
    for x in sorted(cols):
        if not out or x - out[-1] > 0.12:
            out.append(x)
    out[-1] = half
    return out


class Streets:
    def __init__(self, city):
        self.c = city
        self.lanes = []          # lane graph for traffic
        self.signals = []        # signalised intersections
        self.parked = []         # (x, y, yaw)
        self.steam = []          # (x, y, z, strength)

    # ------------------------------------------------------------------ helpers
    def to_world(self, axis, along, across):
        """axis 'a': road runs along X (an avenue); 's': along Y (a street)."""
        return (along, across) if axis == "a" else (across, along)

    def quad(self, axis, a0, a1, c0, c1, z, slot, colors=None, layer="street"):
        p = [self.to_world(axis, a0, c0), self.to_world(axis, a1, c0), self.to_world(axis, a1, c1), self.to_world(axis, a0, c1)]
        pts = [(q[0], q[1], z) for q in p]
        sh = self.c.shell((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2, layer)
        sh.poly(pts, slot, normal=(0, 0, 1), color=colors if colors is not None else (1, 0, 0, 1))

    def strip(self, axis, centre, a0, a1, half, lanes, gutter=1.0, step=22.0, slot="road"):
        cols = cross_columns(half, lanes)
        n = max(1, int(math.ceil((a1 - a0) / step)))
        for k in range(n):
            b0, b1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
            for i in range(len(cols) - 1):
                o0, o1 = cols[i], cols[i + 1]
                col = []
                for o in (o0, o0, o1, o1):
                    g = max(0.0, 1.0 - (half - abs(o)) / 1.35) * gutter
                    t = track_value(o, lanes) * (1.0 if gutter > 0 else 0.45)
                    col.append((1.0, g, t, 1.0))
                self.quad(axis, b0, b1, centre + o0, centre + o1, 0.0, slot, colors=col)

    def paint(self, axis, centre, a0, a1, off0, off1, slot, lanes, z=PAINT_Z):
        if a1 - a0 < 0.05:
            return
        n = max(1, int(math.ceil((a1 - a0) / 24.0)))
        half_cols = []
        for o in (off0, off0, off1, off1):
            half_cols.append((1.0, 0.0, track_value(o, lanes), 1.0))
        for k in range(n):
            b0, b1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
            self.quad(axis, b0, b1, centre + off0, centre + off1, z, slot, colors=half_cols)

    def lettering(self, axis, centre, off, along, text, direction, width=2.1, letter_len=4.2, gap=1.6):
        """Elongated stencil letters, read by a driver travelling in `direction`."""
        n = len(text)
        cw = width / (n * 5 + (n - 1) * 1.3)
        ch = letter_len / 7
        # "right" for the driver: along an avenue heading +X is +Y; along a street heading +Y is -X
        right = direction if axis == "a" else -direction
        for i, letter in enumerate(text):
            rows = FONT[letter]
            u0 = -width / 2 + i * cw * 6.3
            for r, row in enumerate(rows):
                j = 0
                while j < 5:
                    if row[j] == "1":
                        k = j
                        while k < 5 and row[k] == "1":
                            k += 1
                        fwd0 = along + direction * ((6 - r) * ch)
                        fwd1 = along + direction * ((7 - r) * ch)
                        o0 = off + right * (u0 + j * cw)
                        o1 = off + right * (u0 + k * cw)
                        self.quad(axis, min(fwd0, fwd1), max(fwd0, fwd1), centre + min(o0, o1), centre + max(o0, o1), PAINT_Z + 0.002, "road_white")
                        j = k
                    else:
                        j += 1

    def arrow(self, axis, centre, off, along, direction, turn=0):
        def P(f, r, z=PAINT_Z + 0.002):
            right = direction if axis == "a" else -direction
            x, y = self.to_world(axis, along + direction * f, centre + off + right * r)
            return (x, y, z)

        x, y, _ = P(0, 0)
        sh = self.c.shell(x, y, "street")
        col = (1, 0, 0.2, 1)
        if turn == 0:
            sh.poly([P(0, -0.1), P(0, 0.1), P(2.4, 0.1), P(2.4, -0.1)], "road_white", normal=(0, 0, 1), color=col)
            sh.poly([P(2.4, -0.45), P(2.4, 0.45), P(3.9, 0.0)], "road_white", normal=(0, 0, 1), color=col)
        else:
            sh.poly([P(0, -0.1), P(0, 0.1), P(2.0, 0.1), P(2.0, -0.1)], "road_white", normal=(0, 0, 1), color=col)
            sh.poly([P(2.0, -0.1), P(2.7, -0.1 + turn * 0.55), P(2.9, turn * 0.5), P(2.3, turn * 0.0 + 0.1)], "road_white", normal=(0, 0, 1), color=col)
            sh.poly([P(2.2, turn * 0.8), P(3.55, turn * 0.25), P(3.1, turn * 1.35)], "road_white", normal=(0, 0, 1), color=col)

    def bike_symbol(self, axis, centre, off, along, direction):
        def ring(cf, cr, rad):
            pts = []
            for k in range(15):
                a = 2 * math.pi * k / 14
                x, y = self.to_world(axis, along + direction * (cf + rad * 1.7 * math.cos(a)), centre + off + cr + rad * math.sin(a))
                pts.append((x, y, PAINT_Z + 0.004))
            sh = self.c.shell(pts[0][0], pts[0][1], "street")
            for i in range(14):
                a, b = pts[i], pts[i + 1]
                cx_, cy_ = self.to_world(axis, along + direction * cf, centre + off + cr)
                sh.poly([a, b, (b[0] + (cx_ - b[0]) * 0.18, b[1] + (cy_ - b[1]) * 0.18, b[2]), (a[0] + (cx_ - a[0]) * 0.18, a[1] + (cy_ - a[1]) * 0.18, a[2])],
                        "road_white", normal=(0, 0, 1), color=(1, 0, 0, 1))
        ring(0.0, 0.0, 0.34)
        ring(1.5, 0.0, 0.34)

    # ------------------------------------------------------------------ markings for one mid-block segment
    def mark_segment(self, axis, centre, a0, a1, half, lanes, signal_ends=(True, True)):
        L = a1 - a0
        if L < 14:
            return
        # ladder crosswalks sit in line with the sidewalks at both ends
        for end, inward in ((a0, 1), (a1, -1)):
            c0, c1 = sorted((end + inward * 0.35, end + inward * 3.55))
            o = -half + 0.45
            while o < half - 0.5:
                self.paint(axis, centre, c0, c1, o, o + 0.58, "road_white", lanes)
                o += 1.17
        body0, body1 = a0 + 6.6, a1 - 6.6
        directions = sorted({d for _, d, k, _ in lanes if k in ("drive", "bus") and d != 0})
        for d in directions:
            ls = [(c, w) for c, dd, k, w in lanes if dd == d and k in ("drive", "bus")]
            lo = min(c - w / 2 for c, w in ls)
            hi = max(c + w / 2 for c, w in ls)
            stop = a1 - 4.9 if d > 0 else a0 + 4.9
            self.paint(axis, centre, stop - 0.28, stop + 0.28, lo + 0.1, hi - 0.1, "road_white", lanes)
        for i in range(len(lanes) - 1):
            c, d, k, w = lanes[i]
            c2, d2, k2, w2 = lanes[i + 1]
            edge = (c + w / 2 + c2 - w2 / 2) / 2
            if "median" in (k, k2) or "buffer" in (k, k2):
                if "buffer" in (k, k2):
                    self.paint(axis, centre, body0, body1, edge - 0.06, edge + 0.06, "road_white", lanes)
                continue
            if d * d2 < 0:
                for s in (-0.17, 0.07):
                    self.paint(axis, centre, body0 - 1.5, body1 + 1.5, edge + s, edge + s + 0.11, "road_yellow", lanes)
            elif k == "drive" and k2 == "drive":
                a = body0
                while a < body1 - 2:
                    self.paint(axis, centre, a, min(a + 3.0, body1), edge - 0.06, edge + 0.06, "road_white", lanes)
                    a += 9.0
            elif "bus" in (k, k2):
                self.paint(axis, centre, body0, body1, edge - 0.1, edge + 0.1, "road_white", lanes)
            elif "park" in (k, k2):
                self.paint(axis, centre, body0, body1, edge - 0.05, edge + 0.05, "road_white", lanes)
        for c, d, kind, w in lanes:
            if kind == "bus":
                self.paint(axis, centre, body0, body1, c - w / 2 + 0.14, c + w / 2 - 0.14, "road_buslane", lanes, z=0.003)
                if L > 45:
                    mid = (a0 + a1) / 2
                    self.lettering(axis, centre, c, mid - d * 7.0, "BUS", d, width=w * 0.7)
                    self.lettering(axis, centre, c, mid + d * 0.5, "ONLY", d, width=w * 0.78)
            elif kind == "bike":
                self.paint(axis, centre, a0 + 3.8, a1 - 3.8, c - w / 2 + 0.1, c + w / 2 - 0.1, "road_bikelane", lanes, z=0.003)
                for s in (-w / 2 + 0.1, w / 2 - 0.2):
                    self.paint(axis, centre, a0 + 3.8, a1 - 3.8, c + s, c + s + 0.1, "road_white", lanes, z=0.008)
                if L > 40:
                    self.bike_symbol(axis, centre, c, (a0 + a1) / 2, d)
            elif kind == "buffer":
                a = body0
                while a < body1 - 1.5:
                    p = [self.to_world(axis, a, centre + c - w / 2 + 0.1), self.to_world(axis, a + 0.35, centre + c - w / 2 + 0.1),
                         self.to_world(axis, a + 1.25, centre + c + w / 2 - 0.1), self.to_world(axis, a + 0.9, centre + c + w / 2 - 0.1)]
                    self.c.shell(p[0][0], p[0][1], "street").poly([(q[0], q[1], PAINT_Z) for q in p], "road_white", normal=(0, 0, 1), color=(1, 0, 0, 1))
                    a += 3.2
        # turn arrows on the outer travel lanes at the approach
        rng = self.c.rng
        for d in directions:
            drive = sorted(c for c, dd, k, w in lanes if dd == d and k == "drive")
            if not drive or L < 40:
                continue
            at = a1 - 17.0 if d > 0 else a0 + 17.0
            if rng.random() < 0.7:
                self.arrow(axis, centre, drive[0], at, d, 0)
            if len(drive) > 1 and rng.random() < 0.6:
                self.arrow(axis, centre, drive[-1], at, d, 1)

    # ------------------------------------------------------------------ roads
    def build_roads(self):
        c = self.c
        xs = street_numbers(*D.DETAIL_X)
        for name, (yc, row, road, d) in list(D.AVENUES.items()) + [("Vanderbilt", (D.VANDERBILT_Y, 18.3, 11.0, -1))]:
            if not (D.DETAIL_Y[0] <= yc <= D.DETAIL_Y[1]):
                continue
            lanes = D.avenue_lanes(name) if name != "Vanderbilt" else [(-3.6, -1, "park", 2.8), (0.5, -1, "drive", 4.0)]
            half = road / 2
            lo, hi = D.DETAIL_X
            if name == "Vanderbilt":
                lo, hi = D.street_x(42) + D.street_road_width(42) / 2, D.street_x(47)
            zones = [(D.street_x(n) - D.street_road_width(n) / 2, D.street_x(n) + D.street_road_width(n) / 2, n) for n in street_numbers(lo - 20, hi + 20)]
            prev = lo
            for z0, z1, n in zones + [(hi, hi, None)]:
                a0, a1 = prev, min(z0, hi)
                if a1 - a0 > 1.0 and not avenue_gap(name, (a0 + a1) / 2):
                    self.strip("a", yc, a0, a1, half, [l for l in lanes if l[2] != "median"])
                    if -1100 < (a0 + a1) / 2 < 800 and -720 < yc < 940:
                        self.mark_segment("a", yc, a0, a1, half, lanes)
                    if name == "Park":
                        self.median(yc, a0, a1)
                if n is not None and z1 > lo and z0 < hi and not avenue_gap(name, (z0 + z1) / 2):
                    self.strip("a", yc, max(z0, lo), min(z1, hi), half, lanes, gutter=0.0)
                prev = max(z1, lo)
        aves = sorted([(v[0], v[2]) for v in D.AVENUES.values()])
        for n in xs:
            xc = D.street_x(n)
            road = D.street_road_width(n)
            lanes = D.street_lanes(n)
            half = road / 2
            edges = [D.DETAIL_Y[0]]
            for ya, w in aves:
                if D.DETAIL_Y[0] < ya < D.DETAIL_Y[1]:
                    edges += [ya - w / 2, ya + w / 2]
            edges.append(D.DETAIL_Y[1])
            for i in range(0, len(edges), 2):
                a0, a1 = edges[i], edges[i + 1]
                segs = [(a0, a1)]
                if 43 <= n < 47 and a0 < D.VANDERBILT_Y < a1:
                    segs = [(a0, D.VANDERBILT_Y - 5.5), (D.VANDERBILT_Y + 5.5, a1)]
                for s0, s1 in segs:
                    mid = (s0 + s1) / 2
                    if s1 - s0 < 1 or street_gap(n, mid):
                        continue
                    self.strip("s", xc, s0, s1, half, lanes)
                    if -900 < xc < 600 and -720 < mid < 940:
                        self.mark_segment("s", xc, s0, s1, half, lanes)

    def median(self, yc, a0, a1):
        """Planted mall down the middle of Park Avenue."""
        if a1 - a0 < 12:
            return
        sh = self.c.shell((a0 + a1) / 2, yc, "street")
        sh.box((a0 + 4.5, yc - 4.6, 0.0), (a1 - 4.5, yc + 4.6, 0.22), "curb", faces="xXyY")
        sh.quad((a0 + 4.5, yc - 4.6, 0.22), (a1 - 4.5, yc - 4.6, 0.22), (a1 - 4.5, yc + 4.6, 0.22), (a0 + 4.5, yc + 4.6, 0.22), "soil", normal=(0, 0, 1))
        a = a0 + 9
        while a < a1 - 9:
            self.c.inst("planter_shrub", (a, yc, 0.22), float(self.c.rng.uniform(0, 360)), float(self.c.rng.uniform(0.9, 1.4)))
            a += 4.2

    # ------------------------------------------------------------------ sidewalks
    @staticmethod
    def rounded(x0, x1, y0, y1, r, seg=7):
        r = max(0.05, min(r, (x1 - x0) / 2 - 0.05, (y1 - y0) / 2 - 0.05))
        pts = []
        for (cx, cy, a0) in ((x1 - r, y1 - r, 0.0), (x0 + r, y1 - r, 90.0), (x0 + r, y0 + r, 180.0), (x1 - r, y0 + r, 270.0)):
            for k in range(seg + 1):
                a = math.radians(a0 + 90.0 * k / seg)
                pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        return pts

    def block(self, x0, x1, y0, y1, detailed=True):
        """One block's sidewalk: kerb face, granite nosing and concentric bands that carry wear."""
        c = self.c
        c.add_raised(x0, x1, y0, y1)
        sh = c.shell((x0 + x1) / 2, (y0 + y1) / 2, "sidewalk")
        R = 3.4
        insets = [0.0, 0.19, 0.75, 1.9, 3.3]
        loops = [self.rounded(x0 + i, x1 - i, y0 + i, y1 - i, R - i * 0.6) for i in insets]
        wear = [(1.0, 1.0, 0.0), (1.0, 0.85, 0.1), (1.0, 0.45, 0.35), (1.0, 0.0, 0.85), (1.0, 0.0, 0.35)]
        n = len(loops[0])
        for i in range(n):
            j = (i + 1) % n
            a, b = loops[0][i], loops[0][j]
            e = (b[0] - a[0], b[1] - a[1])
            if abs(e[0]) + abs(e[1]) < 1e-3:
                continue
            out = (e[1], -e[0], 0.0)
            sh.quad((a[0], a[1], 0.0), (b[0], b[1], 0.0), (b[0], b[1], D.CURB_H), (a[0], a[1], D.CURB_H), "curb", normal=out, color=(0.75, 1.0, 0.0, 1))
        for k in range(len(loops) - 1):
            slot = "curbstone" if k == 0 else "sidewalk"
            A, B = loops[k], loops[k + 1]
            for i in range(n):
                j = (i + 1) % n
                pts = [(A[i][0], A[i][1], D.CURB_H), (A[j][0], A[j][1], D.CURB_H), (B[j][0], B[j][1], D.CURB_H), (B[i][0], B[i][1], D.CURB_H)]
                col = [(wear[k][0], wear[k][1], wear[k][2], 1), (wear[k][0], wear[k][1], wear[k][2], 1),
                       (wear[k + 1][0], wear[k + 1][1], wear[k + 1][2], 1), (wear[k + 1][0], wear[k + 1][1], wear[k + 1][2], 1)]
                clean, ccol = [], []
                for p, cc in zip(pts, col):
                    if not clean or abs(p[0] - clean[-1][0]) + abs(p[1] - clean[-1][1]) > 1e-3:
                        clean.append(p)
                        ccol.append(cc)
                if len(clean) > 2 and abs(clean[0][0] - clean[-1][0]) + abs(clean[0][1] - clean[-1][1]) < 1e-3:
                    clean.pop()
                    ccol.pop()
                if len(clean) >= 3:
                    sh.poly(clean, slot, normal=(0, 0, 1), color=ccol)
        inner = loops[-1]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for i in range(n):
            j = (i + 1) % n
            a, b = inner[i], inner[j]
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) < 1e-3:
                continue
            sh.poly([(a[0], a[1], D.CURB_H), (b[0], b[1], D.CURB_H), (cx, cy, D.CURB_H)], "sidewalk", normal=(0, 0, 1),
                    color=[(1, 0, 0.35, 1), (1, 0, 0.35, 1), (1, 0, 0.0, 1)])
        if not detailed:
            return
        # tactile warning plates at the corners and catch basins in the gutter beside them
        for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
            px = x1 - 1.5 if sx > 0 else x0 + 1.5
            py = y1 - 1.5 if sy > 0 else y0 + 1.5
            c.inst("tactile", (px, py, D.CURB_H + 0.004), math.degrees(math.atan2(sy, sx)) - 90, shadow=False)
            gx = x1 + 0.22 if sx > 0 else x0 - 0.22
            gy = y1 - 6.2 if sy > 0 else y0 + 6.2
            c.inst("catchbasin", (gx, gy, 0.004), 0.0, shadow=False, rt=False)

    def build_sidewalks(self):
        for n in range(28, 55):
            xa = D.street_x(n) + D.street_road_width(n) / 2
            xb = D.street_x(n + 1) - D.street_road_width(n + 1) / 2
            if xb < D.DETAIL_X[0] or xa > D.DETAIL_X[1]:
                continue
            aves = avenues_for_interval(n)
            for (ya, ra, _, na), (yb, rb, _, nb) in zip(aves[:-1], aves[1:]):
                p, q = ya + ra / 2, yb - rb / 2
                if q < D.DETAIL_Y[0] or p > D.DETAIL_Y[1] or q - p < 8:
                    continue
                detailed = -900 < (xa + xb) / 2 < 600 and -720 < (p + q) / 2 < 940
                # superblocks
                if na == "6th" and nb == "5th" and n == 40:
                    self.block(xa, D.street_x(42) - D.street_road_width(42) / 2, p, q, detailed)
                    continue
                if na == "6th" and nb == "5th" and n == 41:
                    continue
                if na == "Vanderbilt" and nb == "Lexington":
                    if n == 42:
                        self.block(xa, D.street_x(46) - D.street_road_width(46) / 2, p, q, detailed)
                    continue
                self.block(xa, xb, p, q, detailed)

    # ------------------------------------------------------------------ ground hardware
    def build_hardware(self):
        c = self.c
        rng = c.rng
        for name, (yc, row, road, d) in D.AVENUES.items():
            if not -700 < yc < 900:
                continue
            lanes = D.avenue_lanes(name)
            x = -760.0
            while x < 520:
                x += float(rng.uniform(7, 22))
                if avenue_gap(name, x):
                    continue
                lane = lanes[int(rng.integers(len(lanes)))]
                if lane[2] in ("median",):
                    continue
                pos = (x, yc + lane[0] + float(rng.uniform(-0.7, 0.7)), 0.003)
                c.inst("manhole" if rng.random() < 0.8 else "utility_plate", pos, float(rng.uniform(0, 360)), float(rng.uniform(0.85, 1.15)), shadow=False, rt=False)
                if rng.random() < 0.055:
                    self.steam.append((pos[0], pos[1], 0.05, float(rng.uniform(0.4, 1.0))))
        for n in street_numbers(-760, 520):
            xc = D.street_x(n)
            y = -640.0
            while y < 860:
                y += float(rng.uniform(9, 26))
                if street_gap(n, y) or any(abs(y - a[0]) < a[2] / 2 for a in D.AVENUES.values()):
                    continue
                off = float(rng.uniform(-D.street_road_width(n) / 2 + 1.5, D.street_road_width(n) / 2 - 1.5))
                pos = (xc + off, y, 0.003)
                c.inst("manhole" if rng.random() < 0.8 else "utility_plate", pos, float(rng.uniform(0, 360)), float(rng.uniform(0.8, 1.1)), shadow=False, rt=False)
                if rng.random() < 0.045:
                    self.steam.append((pos[0], pos[1], 0.05, float(rng.uniform(0.35, 0.9))))
        # a few placed on purpose where the close shots are
        for p in ((3.4, 17.5, 0.9), (-30.0, -1.8, 0.7), (-3.6, -26.0, 1.0), (-118.0, -3.4, 0.75), (-6.2, 31.0, 0.55)):
            c.inst("manhole", (p[0], p[1], 0.003), 20.0, 1.0, shadow=False, rt=False)
            self.steam.append((p[0], p[1], 0.05, p[2]))

    # ------------------------------------------------------------------ lane graph
    def build_lane_graph(self):
        """Straight lanes across the simulation window with their stop lines."""
        xlo, xhi = D.SIM_X
        ylo, yhi = D.SIM_Y
        sim_streets = street_numbers(xlo - 40, xhi + 40)
        for name in ("7th", "6th", "5th", "Madison", "Park", "Lexington", "3rd", "2nd"):
            yc = D.AVENUES[name][0]
            if not (ylo - 20 <= yc <= yhi + 20):
                continue
            for c_, d, kind, w in D.avenue_lanes(name):
                if kind not in ("drive", "bus", "park"):
                    continue
                spans = [(-1250.0, 880.0)]
                if name == "Park":
                    spans = [(-1250.0, D.street_x(40) + 6)] if True else spans
                    spans += [(D.street_x(46) + 12, 880.0)]
                for sa, sb in spans:
                    stops = []
                    for n in street_numbers(sa, sb):
                        sx, rw = D.street_x(n), D.street_road_width(n)
                        s_line = (sx - rw / 2 - 4.9 - 0.4) if d > 0 else (sx + rw / 2 + 4.9 + 0.4)
                        stops.append((s_line, n, 0, D.signal_offset(name, sx)))
                    if kind == "park":
                        self.parking(("a", yc + c_, d, sa, sb, [D.street_x(n) for n in street_numbers(sa, sb)], [D.street_road_width(n) for n in street_numbers(sa, sb)]))
                        continue
                    self.add_lane("a", yc + c_, d, sa, sb, stops, kind, name)
        for n in sim_streets:
            xc = D.street_x(n)
            lanes = D.street_lanes(n)
            spans = [(-900.0, 1100.0)]
            if n == 41:
                spans = [(-900.0, -313.0 + 0), (2.0, 1100.0)]
                spans = [(-900.0, -326.0), (10.0, 1100.0)]
            if n in (43, 44, 45):
                spans = [(-900.0, 226.0), (486.0, 1100.0)]
            for c_, d, kind, w in lanes:
                for sa, sb in spans:
                    cross = [(v[0], v[2], k) for k, v in D.AVENUES.items() if sa + 12 < v[0] < sb - 12]
                    if kind == "park":
                        self.parking(("s", xc + c_, d, sa, sb, [q[0] for q in cross], [q[1] for q in cross]))
                        continue
                    stops = []
                    for ya, rw, aname in sorted(cross):
                        s_line = (ya - rw / 2 - 4.9 - 0.4) if d > 0 else (ya + rw / 2 + 4.9 + 0.4)
                        stops.append((s_line, aname, 1, D.signal_offset(aname, xc)))
                    self.add_lane("s", xc + c_, d, sa, sb, stops, kind, "%d" % n)

    def add_lane(self, axis, fixed, d, a, b, stops, kind, road):
        start, end = (a, b) if d > 0 else (b, a)
        length = abs(end - start)
        out = []
        for s_line, _, group, off in stops:
            s = (s_line - start) * d
            if 6 < s < length - 6:
                out.append((s, group, off))
        out.sort()
        p0 = (start, fixed) if axis == "a" else (fixed, start)
        direction = (float(d), 0.0) if axis == "a" else (0.0, float(d))
        self.lanes.append(dict(p0=p0, dir=direction, length=length, kind=kind, road=road, axis=axis,
                               stops=[(float(s), int(g), float(o)) for s, g, o in out]))

    def parking(self, spec):
        axis, fixed, d, a, b, crossings, widths = spec
        rng = self.c.rng
        bounds = sorted(zip(crossings, widths))
        edges = [a]
        for x, w in bounds:
            edges += [x - w / 2 - 7.5, x + w / 2 + 7.5]
        edges.append(b)
        for i in range(0, len(edges) - 1, 2):
            s0, s1 = edges[i], edges[i + 1]
            s = s0 + float(rng.uniform(0, 4))
            while s < s1 - 5.5:
                if rng.random() < 0.74:
                    x, y = (s + 2.6, fixed) if axis == "a" else (fixed, s + 2.6)
                    if -760 < x < 560 and -660 < y < 900:
                        yaw = (0.0 if d >= 0 else 180.0) if axis == "a" else (90.0 if d >= 0 else -90.0)
                        self.parked.append((x, y + 0.0, yaw + float(rng.uniform(-1.5, 1.5))))
                        s += 5.9 + float(rng.uniform(0, 1.2))
                        continue
                s += 5.4

    def build(self):
        self.build_roads()
        self.build_sidewalks()
        self.build_hardware()
        self.build_lane_graph()
