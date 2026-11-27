"""Cabs, sedans, SUVs, cargo vans, box trucks and city buses, plus their wheels, pedestrians and umbrellas.

Vehicle space: +x forward, +y right, z up, origin on the ground under the middle of the body.
Run:  python source/gen/vehicles.py     (writes build/vehicles/)
"""
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from meshlib import MeshBuilder  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "build", "vehicles")


def atlas_uv(cell, cols=4, rows=8):
    u0, v0 = (cell % cols) / cols, (cell // cols) / rows
    e = 0.002
    return [(u0 + e, v0 + 1 / rows - e), (u0 + 1 / cols - e, v0 + 1 / rows - e), (u0 + 1 / cols - e, v0 + e), (u0 + e, v0 + e)]


def decal_quad(mb, center, right, up, w, h, cell, slot="veh_decal"):
    """A lettered panel: `right` is the reading direction, `up` its top."""
    c, r, u = np.array(center, float), np.array(right, float), np.array(up, float)
    pts = [c - r * w / 2 - u * h / 2, c + r * w / 2 - u * h / 2, c + r * w / 2 + u * h / 2, c - r * w / 2 + u * h / 2]
    n = np.cross(u, r)
    mb.poly(pts, slot, normal=n, uv=atlas_uv(cell))


def curve(x, pts):
    xs, ys = zip(*pts)
    return float(np.interp(x, xs, ys))


def smooth_curve(xs, pts, passes=3):
    vals = np.array([curve(x, pts) for x in xs])
    for _ in range(passes):
        v2 = vals.copy()
        v2[1:-1] = 0.25 * vals[:-2] + 0.5 * vals[1:-1] + 0.25 * vals[2:]
        vals = v2
    return vals


class Spec:
    def __init__(self, **kw):
        self.__dict__.update(kw)


SEDAN = Spec(L=4.86, W=1.86, wheel_r=0.34, axle_f=1.44, axle_r=-1.40, track=0.80,
             top=[(-2.43, 0.72), (-2.38, 0.98), (-2.2, 1.06), (-1.62, 1.10), (-0.86, 1.43), (-0.45, 1.475), (0.28, 1.455), (0.52, 1.40), (1.16, 1.03), (1.6, 0.96), (2.1, 0.86), (2.36, 0.74), (2.43, 0.56)],
             belt=[(-2.43, 0.8), (-1.6, 1.03), (0.0, 0.98), (1.16, 0.96), (2.43, 0.7)],
             bottom=[(-2.43, 0.52), (-2.32, 0.33), (-1.9, 0.27), (1.9, 0.25), (2.3, 0.28), (2.43, 0.42)],
             roof_w=0.70, glass=(-1.62, 1.16), roof=(-0.80, 0.40), pillars=[(-0.2, -0.08), (-1.02, -0.9)])
SUV = Spec(L=4.74, W=1.95, wheel_r=0.38, axle_f=1.42, axle_r=-1.40, track=0.83,
           top=[(-2.37, 0.9), (-2.34, 1.2), (-2.24, 1.62), (-1.95, 1.77), (-0.9, 1.80), (0.25, 1.76), (0.55, 1.68), (1.18, 1.18), (1.7, 1.12), (2.2, 1.0), (2.34, 0.82), (2.37, 0.6)],
           belt=[(-2.37, 1.12), (-1.5, 1.16), (0.0, 1.10), (1.18, 1.10), (2.37, 0.82)],
           bottom=[(-2.37, 0.6), (-2.25, 0.40), (-1.9, 0.34), (1.9, 0.32), (2.26, 0.36), (2.37, 0.5)],
           roof_w=0.77, glass=(-2.22, 1.18), roof=(-1.95, 0.42), pillars=[(-0.24, -0.1), (-1.24, -1.08)])
VAN = Spec(L=5.5, W=2.04, wheel_r=0.36, axle_f=1.88, axle_r=-1.62, track=0.88,
           top=[(-2.75, 1.4), (-2.72, 2.36), (-2.55, 2.52), (-1.0, 2.56), (0.9, 2.52), (1.35, 2.30), (2.05, 1.52), (2.35, 1.33), (2.66, 1.08), (2.75, 0.7)],
           belt=[(-2.75, 1.35), (0.0, 1.35), (2.0, 1.32), (2.75, 0.95)],
           bottom=[(-2.75, 0.65), (-2.66, 0.46), (2.5, 0.40), (2.75, 0.5)],
           roof_w=0.90, glass=(0.62, 2.06), roof=(0.62, 1.30), pillars=[(0.62, 0.72)])


def car_body(spec, paint="carpaint", cargo=False):
    mb = MeshBuilder()
    L, W = spec.L, spec.W
    hl = L / 2
    xs = np.unique(np.concatenate([np.linspace(-hl, hl, 76), np.linspace(-hl, -hl + 0.3, 8), np.linspace(hl - 0.3, hl, 8),
                                   np.linspace(spec.axle_f - 0.5, spec.axle_f + 0.5, 24), np.linspace(spec.axle_r - 0.5, spec.axle_r + 0.5, 24)]))
    top = smooth_curve(xs, spec.top, 2)
    belt = smooth_curve(xs, spec.belt, 4)
    bot = smooth_curve(xs, spec.bottom, 2)
    R = spec.wheel_r + 0.075
    sections = []
    meta = []
    for x, zt, zb, z0 in zip(xs, top, belt, bot):
        u = min(abs(x) / hl, 1.0)
        plan = (1 - u ** 7) ** 0.35 * 0.17 + 0.83 if u < 1 else 0.7
        if u > 0.96:
            plan *= 1 - (u - 0.96) / 0.04 * 0.12
        w = W / 2 * plan
        zbelt = min(zb, zt - 0.012)
        g = float(np.clip((zt - zbelt - 0.06) / 0.3, 0.0, 1.0))
        zmid = z0 + (zbelt - z0) * 0.58
        half = [(0.0, z0 + 0.03), (w * 0.84, z0 + 0.02), (w * 0.965, z0 + 0.1), (w * 1.0, zmid), (w * 0.955, zbelt)]
        wr = min(spec.roof_w, w * 0.93)
        hood = [(w * 0.9, zbelt + (zt - zbelt) * 0.45), (w * 0.82, zt - 0.02), (w * 0.62, zt + 0.004), (w * 0.34, zt + 0.016), (0.0, zt + 0.022)]
        cabin = [(w * 0.915, zbelt + 0.035), (wr, max(zt - 0.095, zbelt + 0.04)), (wr * 0.9, max(zt - 0.022, zbelt + 0.05)), (wr * 0.52, max(zt + 0.012, zbelt + 0.055)), (0.0, max(zt + 0.026, zbelt + 0.06))]
        upper = [(a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g) for a, b in zip(hood, cabin)]
        half += upper
        # open the wheel arches
        for axle in (spec.axle_f, spec.axle_r):
            dx = abs(x - axle)
            if dx < R:
                za = spec.wheel_r + math.sqrt(R * R - dx * dx)
                for k in range(4):
                    if half[k][1] < za:
                        yy = half[k][0] if k >= 2 else min(half[k][0], w * 0.62)
                        half[k] = (yy, min(za + 0.005 * k, zbelt - 0.07 + 0.01 * k))
        ring = [(x, y, z) for y, z in half] + [(x, -y, z) for y, z in half[-2:0:-1]]
        sections.append(ring)
        meta.append((x, g, zt, zbelt))
    S = np.array(sections)
    ncols = S.shape[1]

    def slot(r, c):
        x = (meta[r][0] + meta[r + 1][0]) / 2
        g = (meta[r][1] + meta[r + 1][1]) / 2
        cc = c if c <= 8 else ncols - 1 - c      # mirror the left side
        if cc <= 1:
            return "car_trim"
        if cc <= 3:
            if cc == 2 or any(abs(x - a) < R + 0.07 for a in (spec.axle_f, spec.axle_r)) and S[r][c][2] < spec.wheel_r + R - 0.03:
                return "car_trim" if cc == 2 else paint
            return paint
        if cc == 4:
            return "car_trim" if (g > 0.5 and not cargo) else paint
        in_glass = spec.glass[0] < x < spec.glass[1] and g > 0.12
        if not in_glass:
            return paint
        side_window = cc == 5
        windscreen = x > spec.roof[1] + 0.04
        rear = x < spec.roof[0] - 0.04 and not cargo
        if windscreen:
            return "carglass" if cc >= 6 else ("carglass" if x < spec.glass[1] - 0.45 and cc == 5 else paint)
        if rear:
            return "carglass" if cc >= 7 else ("carglass" if cc == 5 and x > spec.glass[0] + 0.42 else paint)
        if side_window:
            if cargo and x < spec.pillars[0][1]:
                return paint
            if any(a < x < b for a, b in spec.pillars):
                return "car_trim"
            return "carglass"
        return paint

    mb.loft(S, slot, closed=True)
    # close the nose and tail
    for end, nx in ((0, -1), (len(sections) - 1, 1)):
        ring = sections[end]
        cx = (ring[0][0] + nx * 0.015, 0.0, (ring[0][2] + ring[8][2]) / 2)
        for i in range(ncols):
            a, b = ring[i], ring[(i + 1) % ncols]
            mb.poly([a, b, cx], "car_trim" if (i <= 2 or i >= ncols - 3) else paint, normal=(nx, 0, 0))
    return mb, (xs, top, belt, bot)


def details(mb, spec, prof, plate_cell, kind):
    xs, top, belt, bot = prof
    hl, W = spec.L / 2, spec.W
    at = lambda arr, x: float(np.interp(x, xs, arr))
    zf = at(top, hl - 0.2)
    tall = kind in ("suv", "van")
    zh = 0.74 if not tall else 0.86
    if kind == "van":
        zh = 0.92
    for s in (-1, 1):
        # headlamp pods wrapped round the front corners, with a chrome surround
        y = s * (W / 2 - 0.34)
        mb.sphere((hl - 0.085, y, zh), 0.17, "chrome", segments=14, rings=10, scale=(0.55, 1.15, 0.48))
        mb.sphere((hl - 0.05, y, zh), 0.155, "headlight", segments=14, rings=10, scale=(0.46, 1.08, 0.40))
        mb.box((hl - 0.06, y - 0.12, zh - 0.2), (hl + 0.012, y + 0.12, zh - 0.165), "turnlight")
        # tail lamps
        zt_ = 0.9 if not tall else (1.12 if kind == "suv" else 1.3)
        if kind == "sedan" or kind == "cab":
            mb.sphere((-hl + 0.075, s * (W / 2 - 0.29), 0.9), 0.16, "taillight", segments=14, rings=10, scale=(0.5, 1.25, 0.46))
            mb.box((-hl + 0.0, s * (W / 2 - 0.3) - 0.1, 0.775), (-hl + 0.05, s * (W / 2 - 0.3) + 0.1, 0.81), "turnlight")
        else:
            mb.box((-hl - 0.012, s * (W / 2 - 0.21) - 0.085, zt_ - 0.05), (-hl + 0.09, s * (W / 2 - 0.21) + 0.085, zt_ + 0.45), "taillight")
        # mirrors
        mx = spec.glass[1] - 0.12 if kind != "van" else spec.glass[1] - 0.28
        mz = at(belt, mx) + 0.1
        mb.tube([(mx, s * (W / 2 - 0.1), mz - 0.05), (mx - 0.02, s * (W / 2 + 0.07), mz)], 0.022, 6, "car_trim")
        mb.sphere((mx - 0.04, s * (W / 2 + 0.12), mz + 0.02), 0.1, "car_trim", segments=12, rings=8, scale=(0.72, 1.12, 0.72))
        mb.quad((mx - 0.1, s * (W / 2 + 0.05), mz - 0.03), (mx - 0.1, s * (W / 2 + 0.2), mz - 0.03), (mx - 0.1, s * (W / 2 + 0.2), mz + 0.07), (mx - 0.1, s * (W / 2 + 0.05), mz + 0.07), "chrome", normal=(-1, 0, 0))
        # shut lines and handles
        zb0 = at(bot, 0.0) + 0.14
        doors = [spec.glass[1] - 0.18, (spec.pillars[0][0] + spec.pillars[0][1]) / 2] + ([spec.axle_r + spec.wheel_r + 0.16] if kind != "van" else [-0.7])
        for xd in doors:
            pts = []
            for k in range(7):
                z = zb0 + (at(belt, xd) - 0.02 - zb0) * k / 6
                bulge = 1.0 - abs((z - (zb0 + 0.3)) / 1.2) * 0.035
                pts.append((xd, s * (W / 2 * bulge + 0.001), z))
            mb.tube(pts, 0.0055, 4, "car_trim", caps=False)
        for xd in doors[1:]:
            z = at(belt, xd) - 0.1
            mb.box((xd + 0.1, s * (W / 2 - 0.035) - 0.012, z), (xd + 0.26, s * (W / 2 - 0.035) + 0.02, z + 0.035), "chrome")
        # wheel-well liners and arch trim
        for axle in (spec.axle_f, spec.axle_r):
            R = spec.wheel_r + 0.07
            pts = [(axle + R * math.cos(a), spec.wheel_r + R * math.sin(a)) for a in np.linspace(0, math.pi, 15)]
            for i in range(14):
                (ax, az), (bx, bz) = pts[i], pts[i + 1]
                mb.quad((ax, s * (W / 2 - 0.33), az), (bx, s * (W / 2 - 0.33), bz), (bx, s * (W / 2 - 0.03), bz), (ax, s * (W / 2 - 0.03), az),
                        "wheelwell", normal=(axle - ax, 0, spec.wheel_r - az))
                mb.poly([(ax, s * (W / 2 - 0.325), az), (bx, s * (W / 2 - 0.325), bz), (axle, s * (W / 2 - 0.325), spec.wheel_r - 0.05)], "wheelwell", normal=(0, s, 0))
            mb.tube([(p[0], s * (W / 2 - 0.012), p[1]) for p in pts], 0.022 if tall else 0.012, 5, "car_trim", caps=False)
    # grille, lower intake and plates
    gz = zh - 0.02 if not tall else zh - 0.04
    mb.box((hl - 0.06, -0.37, gz - 0.12), (hl + 0.016, 0.37, gz + 0.08), "wheelwell")
    for k in range(4):
        z = gz - 0.095 + k * 0.05
        mb.box((hl + 0.0, -0.36, z), (hl + 0.024, 0.36, z + 0.013), "chrome")
    mb.box((hl - 0.1, -0.62, 0.36), (hl + 0.005, 0.62, 0.52), "car_trim")
    mb.box((-hl - 0.02, -0.66, 0.38), (-hl + 0.1, 0.66, 0.56), "car_trim")
    decal_quad(mb, (hl + 0.028, 0.0, 0.44), (0, -1, 0), (0, 0, 1), 0.31, 0.155, plate_cell, "plate")
    rz = 0.78 if kind in ("sedan", "cab") else 0.72
    decal_quad(mb, (-hl - 0.026, 0.0, rz), (0, 1, 0), (0, 0, 1), 0.31, 0.155, plate_cell, "plate")
    mb.box((-hl - 0.024, -0.18, rz - 0.095), (-hl + 0.02, 0.18, rz + 0.095), "car_trim", faces="x")
    # exhaust and the third brake light
    mb.tube([(-hl + 0.15, 0.5, 0.31), (-hl - 0.05, 0.5, 0.31)], 0.035, 8, "chrome")
    zr = at(top, spec.roof[0])
    mb.box((spec.roof[0] - 0.09, -0.14, zr - 0.015), (spec.roof[0] - 0.02, 0.14, zr + 0.02), "taillight")


def taxi_extras(mb, spec, prof, index):
    xs, top, belt, bot = prof
    at = lambda arr, x: float(np.interp(x, xs, arr))
    zr = at(top, -0.25) + 0.02
    mb.box((-0.33, -0.55, zr + 0.015), (-0.17, 0.55, zr + 0.05), "car_trim")
    # roof advertising panel with the lit medallion lamp above it
    for s, face_r in ((1, (0, -1, 0)), (-1, (0, 1, 0))):
        decal_quad(mb, (-0.25 + s * 0.09, 0.0, zr + 0.2), face_r if s > 0 else face_r, (0, 0, 1), 1.04, 0.27, 4 + index % 4, "veh_ad")
    mb.box((-0.335, -0.54, zr + 0.05), (-0.165, 0.54, zr + 0.345), "car_trim", faces="yYzZ")
    mb.box((-0.31, -0.19, zr + 0.35), (-0.19, 0.19, zr + 0.45), "taxilamp")
    for s in (-1, 1):
        z = at(belt, 0.3) - 0.24
        decal_quad(mb, (0.36, s * (spec.W / 2 + 0.006), z), (-s, 0, 0), (0, 0, 1), 0.88, 0.22, index % 4, "veh_decal_flat")


def wheel(r=0.34, width=0.23, spokes=5, truck=False):
    """Axle along y, outer face toward +y."""
    mb = MeshBuilder()
    m = MeshBuilder()
    hw = width / 2
    rim_r = r * 0.66
    m.lathe((0, 0, 0), [(rim_r, -hw * 0.8), (r * 0.86, -hw), (r * 0.96, -hw * 0.82), (r, -hw * 0.55), (r, hw * 0.55), (r * 0.96, hw * 0.82), (r * 0.86, hw), (rim_r, hw * 0.8)], "tire", segments=40)
    for z in (-hw * 0.3, 0.0, hw * 0.3):
        m.lathe((0, 0, z), [(r + 0.001, -0.006), (r - 0.006, 0.0), (r + 0.001, 0.006)], "wheelwell", segments=40)
    # dished rim
    m.lathe((0, 0, 0), [(rim_r, hw * 0.8), (rim_r * 0.94, hw * 0.78), (rim_r * 0.9, hw * 0.2), (0.0, hw * 0.12)], "rim_dark" if not truck else "rim", segments=36)
    m.lathe((0, 0, 0), [(rim_r * 1.02, hw * 0.76), (rim_r * 1.0, hw * 0.9), (rim_r * 0.92, hw * 0.88), (rim_r * 0.9, hw * 0.74)], "rim", segments=36)
    for k in range(spokes):
        a = 2 * math.pi * k / spokes
        ca, sa = math.cos(a), math.sin(a)

        def P(rad, lat, z):
            return (rad * ca - lat * sa, rad * sa + lat * ca, z)

        pts = [P(0.05, -0.036, hw * 0.74), P(rim_r * 0.93, -0.024, hw * 0.8), P(rim_r * 0.93, 0.024, hw * 0.8), P(0.05, 0.036, hw * 0.74)]
        m.poly(pts, "rim", normal=(0, 0, 1))
        for i in (0, 2):
            p, q = pts[i], pts[(i + 1) % 4]
            m.quad(p, q, (q[0], q[1], hw * 0.3), (p[0], p[1], hw * 0.3), "rim", normal=(-sa if i == 2 else sa, ca if i == 2 else -ca, 0))
    m.lathe((0, 0, 0), [(rim_r * 0.24, hw * 0.74), (rim_r * 0.2, hw * 0.86), (0.0, hw * 0.9)], "rim", segments=18)
    m.lathe((0, 0, -hw * 0.8), [(0.0, 0.0), (rim_r, 0.0)], "wheelwell", segments=24)
    mb.merge(m, roll=-90.0)
    return mb


def rounded_section(w, z0, z1, rt=0.22, rb=0.08, n=6):
    pts = [(0.0, z0)]
    for k in range(n + 1):
        a = -math.pi / 2 + math.pi / 2 * k / n
        pts.append((w - rb + rb * math.cos(a), z0 + rb + rb * math.sin(a)))
    pts.append((w, z0 + (z1 - z0) * 0.42))
    for k in range(n + 1):
        a = math.pi / 2 * k / n
        pts.append((w - rt + rt * math.cos(a), z1 - rt + rt * math.sin(a)))
    pts.append((0.0, z1 + 0.03))
    return pts


def bus(index=0):
    mb = MeshBuilder()
    L, W, hw = 12.2, 2.58, 1.29
    R = 0.58
    axles = (4.15, -2.95)
    xs = np.unique(np.concatenate([np.linspace(-6.1, 6.1, 90), np.linspace(-6.1, -5.9, 6), np.linspace(5.9, 6.1, 6),
                                   np.linspace(axles[0] - 0.65, axles[0] + 0.65, 20), np.linspace(axles[1] - 0.65, axles[1] + 0.65, 20)]))
    secs = []
    for x in xs:
        u = abs(x) / 6.1
        w = hw * (1 - 0.1 * max(0.0, (u - 0.965) / 0.035) ** 2)
        half = rounded_section(w, 0.34, 3.02 - 0.06 * max(0.0, (u - 0.97) / 0.03))
        for axle in axles:
            dx = abs(x - axle)
            if dx < R:
                za = 0.5 + math.sqrt(R * R - dx * dx)
                half = [(min(y, 0.75) if k < 2 else y, max(z, za) if z < 1.35 else z) for k, (y, z) in enumerate(half)]
        secs.append([(x, y, z) for y, z in half] + [(x, -y, z) for y, z in half[-2:0:-1]])
    S = np.array(secs)
    mb.loft(S, lambda r, c: "buspaint", closed=True)
    for end, nx in ((0, -1), (len(secs) - 1, 1)):
        ring = secs[end]
        c0 = (ring[0][0] + nx * 0.02, 0.0, 1.7)
        for i in range(len(ring)):
            mb.poly([ring[i], ring[(i + 1) % len(ring)], c0], "buspaint", normal=(nx, 0, 0))
    # window band with an interior behind it, set just proud of the shell
    for s in (-1, 1):
        y = s * (hw + 0.006)
        pts = [(-5.55, y, 1.45), (5.2, y, 1.45), (5.2, y, 2.55), (-5.55, y, 2.55)]
        uv = [((p[0] + 5.55) if s > 0 else (5.2 - p[0]), p[2] - 1.45) for p in pts]
        mb.poly(pts, "busglass", normal=(0, s, 0), uv=uv, uv1=[(10.75, 1.1)] * 4)
        x = -5.55
        while x <= 5.21:
            mb.box((x - 0.035, y - 0.004, 1.43), (x + 0.035, y + 0.012, 2.57), "car_trim")
            x += 1.343
        mb.box((-5.6, y - 0.004, 2.55), (5.25, y + 0.012, 2.63), "car_trim")
        mb.box((-5.9, y - 0.004, 1.2), (5.9, y + 0.008, 1.38), "busstripe")
        mb.box((-5.9, y - 0.004, 0.36), (5.9, y + 0.006, 0.62), "car_trim")
        decal_quad(mb, (-0.6, s * (hw + 0.02), 0.93), (-s, 0, 0), (0, 0, 1), 2.7, 0.42, 14, "veh_decal_flat")
        for axle in axles:
            pts = [(axle + R * math.cos(a), 0.5 + R * math.sin(a)) for a in np.linspace(0, math.pi, 17)]
            for i in range(16):
                (ax, az), (bx, bz) = pts[i], pts[i + 1]
                mb.quad((ax, s * (hw - 0.45), az), (bx, s * (hw - 0.45), bz), (bx, s * hw, bz), (ax, s * hw, az), "wheelwell", normal=(axle - ax, 0, 0.5 - az))
                mb.poly([(ax, s * (hw - 0.44), az), (bx, s * (hw - 0.44), bz), (axle, s * (hw - 0.44), 0.4)], "wheelwell", normal=(0, s, 0))
            mb.tube([(p[0], s * (hw + 0.01), p[1]) for p in pts], 0.035, 5, "car_trim", caps=False)
    # front: windscreen, destination board, lamps, bike rack; doors on the kerb side
    mb.poly([(6.135, -1.16, 1.15), (6.135, 1.16, 1.15), (6.12, 1.14, 2.5), (6.12, -1.14, 2.5)], "carglass", normal=(1, 0, 0))
    mb.box((6.06, -0.98, 2.56), (6.14, 0.98, 2.92), "car_trim")
    decal_quad(mb, (6.145, 0.0, 2.74), (0, -1, 0), (0, 0, 1), 1.86, 0.3, 12 + index % 2, "veh_sign")
    decal_quad(mb, (-6.145, 0.35, 2.62), (0, 1, 0), (0, 0, 1), 0.9, 0.22, 12 + index % 2, "veh_sign")
    for x0, x1 in ((4.78, 5.78), (-0.75, 0.5)):
        pts = [(x0, hw + 0.02, 0.4), (x1, hw + 0.02, 0.4), (x1, hw + 0.02, 2.55), (x0, hw + 0.02, 2.55)]
        mb.poly(pts, "busglass", normal=(0, 1, 0), uv=[(p[0] - x0, p[2] - 0.4) for p in pts], uv1=[(x1 - x0, 2.15)] * 4)
        for xx in (x0, (x0 + x1) / 2, x1):
            mb.box((xx - 0.025, hw + 0.018, 0.4), (xx + 0.025, hw + 0.035, 2.55), "car_trim")
    for s in (-1, 1):
        mb.box((6.1, s * 0.98 - 0.13, 0.7), (6.15, s * 0.98 + 0.13, 0.86), "headlight")
        mb.box((6.1, s * 0.7 - 0.07, 0.72), (6.15, s * 0.7 + 0.07, 0.84), "turnlight")
        mb.box((-6.16, s * 1.06 - 0.08, 0.75), (-6.1, s * 1.06 + 0.08, 1.2), "taillight")
        mb.box((-6.15, s * 1.05 - 0.12, 2.78), (-6.1, s * 1.05 + 0.12, 2.88), "taillight")
        mb.tube([(6.1, s * 1.15, 2.6), (6.45, s * 1.38, 2.45), (6.45, s * 1.38, 2.15)], 0.028, 6, "car_trim")
        mb.box((6.38, s * 1.38 - 0.11, 1.78), (6.5, s * 1.38 + 0.11, 2.2), "car_trim")
    mb.box((6.05, -1.22, 0.36), (6.2, 1.22, 0.66), "car_trim")
    for z in np.arange(0.8, 2.1, 0.09):
        mb.box((-6.15, -0.8, z), (-6.12, 0.8, z + 0.04), "car_trim")
    mb.box((-4.2, -0.95, 3.02), (-1.2, 0.95, 3.3), "buspaint")
    mb.box((0.4, -0.85, 3.02), (3.4, 0.85, 3.22), "buspaint")
    decal_quad(mb, (6.165, 0.0, 0.51), (0, -1, 0), (0, 0, 1), 0.31, 0.155, 20 + index, "plate")
    return mb


def box_truck(index=0):
    cabspec = Spec(**VAN.__dict__)
    mb = MeshBuilder()
    # cab: the front third of the van shell, shifted forward
    cabm, prof = car_body(Spec(L=2.6, W=2.1, wheel_r=0.44, axle_f=0.55, axle_r=-9.0, track=0.9,
                               top=[(-1.3, 2.35), (-0.9, 2.45), (-0.15, 2.4), (0.15, 2.28), (0.72, 1.58), (1.05, 1.42), (1.25, 1.14), (1.3, 0.8)],
                               belt=[(-1.3, 1.45), (0.7, 1.45), (1.3, 1.0)], bottom=[(-1.3, 0.62), (1.1, 0.56), (1.3, 0.62)],
                               roof_w=0.94, glass=(-0.75, 0.74), roof=(-0.75, 0.12), pillars=[(-0.75, -0.62)]), cargo=True)
    mb.merge(cabm, offset=(2.55, 0, 0))
    for s in (-1, 1):
        mb.box((3.76, s * 0.78 - 0.14, 0.86), (3.86, s * 0.78 + 0.14, 1.04), "headlight")
        mb.box((-4.04, s * 1.0 - 0.11, 0.62), (-3.96, s * 1.0 + 0.11, 0.86), "taillight")
        mb.tube([(3.1, s * 1.0, 1.6), (3.14, s * 1.3, 1.72), (3.14, s * 1.3, 1.5)], 0.025, 6, "car_trim")
        mb.box((3.08, s * 1.3 - 0.08, 1.4), (3.2, s * 1.3 + 0.08, 1.9), "car_trim")
        for x in (3.1, -2.35):
            mb.box((x - 0.55, s * 0.86 - 0.2, 0.9), (x + 0.55, s * 0.86 + 0.24, 0.96), "car_trim")
    mb.box((3.74, -0.55, 0.62), (3.9, 0.55, 0.84), "car_trim")
    mb.box((3.7, -1.04, 0.5), (3.92, 1.04, 0.68), "chrome")
    # chassis and cargo box
    mb.box((-3.9, -0.55, 0.52), (2.2, 0.55, 0.78), "car_trim")
    mb.box((-4.0, -1.22, 1.02), (1.16, 1.22, 3.42), "truckbox", faces="xXyYzZ")
    for x in (-4.0, 1.16):
        for y in (-1.22, 1.22):
            mb.box((x - 0.03, y - 0.03, 1.02), (x + 0.03, y + 0.03, 3.44), "galvanized")
    for z in (1.02, 3.42):
        mb.box((-4.02, -1.25, z - 0.04), (1.18, -1.2, z + 0.04), "galvanized")
        mb.box((-4.02, 1.2, z - 0.04), (1.18, 1.25, z + 0.04), "galvanized")
    for z in np.arange(1.2, 3.3, 0.14):
        mb.box((-4.025, -1.1, z), (-4.0, 1.1, z + 0.11), "truckbox", faces="xzZ")
    for s in (-1, 1):
        decal_quad(mb, (-1.42, s * 1.228, 2.45), (-s, 0, 0), (0, 0, 1), 4.2, 1.05, 8 + index % 4, "veh_decal_flat")
    mb.box((-4.06, -1.15, 0.5), (-3.96, 1.15, 0.6), "paint_darkgray")
    decal_quad(mb, (-4.05, -0.6, 0.78), (0, 1, 0), (0, 0, 1), 0.31, 0.155, 24 + index % 4, "plate")
    decal_quad(mb, (3.925, 0.0, 0.59), (0, -1, 0), (0, 0, 1), 0.31, 0.155, 24 + index % 4, "plate")
    return mb


# name: (builder, wheel mesh, [(x, y, side)], wheel radius, length, headlight (x, y, z), tail (x, y, z))
def build_all():
    out = {}
    info = {}

    def add(name, mb, kind, wheels, wr, length, head, tail, wheel_mesh):
        out[name] = mb
        info[name] = dict(kind=kind, wheels=wheels, wheelRadius=wr, length=length, head=head, tail=tail, wheel=wheel_mesh)

    def car_wheels(spec):
        return [(spec.axle_f, spec.track, 1), (spec.axle_f, -spec.track, -1), (spec.axle_r, spec.track, 1), (spec.axle_r, -spec.track, -1)]

    def make_car(name, spec, kind, idx, cargo=False):
        mb, prof = car_body(spec, cargo=cargo)
        details(mb, spec, prof, 16 + idx, kind)
        if kind == "cab":
            taxi_extras(mb, spec, prof, idx)
        if kind == "van":
            for s in (-1, 1):
                decal_quad(mb, (-0.75, s * (spec.W / 2 + 0.012), 1.82), (-s, 0, 0), (0, 0, 1), 2.7, 0.68, 8 + idx % 4, "veh_decal_flat")
            mb.box((-2.76, -0.02, 0.62), (-2.735, 0.02, 2.4), "car_trim")
        zh = {"sedan": 0.74, "cab": 0.74, "suv": 0.86, "van": 0.92}[kind]
        wm = "wheel_truck" if kind == "van" else ("wheel_suv" if kind == "suv" or spec is SUV else "wheel_car")
        add(name, mb, "cab" if kind == "cab" else kind, car_wheels(spec), spec.wheel_r, spec.L,
            (spec.L / 2 + 0.03, spec.W / 2 - 0.34, zh), (-spec.L / 2 - 0.03, spec.W / 2 - 0.28, 0.95), wm)

    make_car("cab0", SEDAN, "cab", 0)
    make_car("cab1", SEDAN, "cab", 1)
    make_car("cab2", SUV, "cab", 2)
    make_car("cab3", SUV, "cab", 3)
    make_car("sedan0", SEDAN, "sedan", 4)
    make_car("sedan1", SEDAN, "sedan", 5)
    make_car("suv0", SUV, "suv", 6)
    make_car("suv1", SUV, "suv", 7)
    for i in range(3):
        make_car("van%d" % i, VAN, "van", 8 + i, cargo=True)
    for i in range(3):
        add("truck%d" % i, box_truck(i), "truck", [(3.1, 0.92, 1), (3.1, -0.92, -1), (-2.35, 0.98, 1), (-2.35, -0.98, -1)], 0.46, 7.95,
            (3.9, 0.78, 0.95), (-4.07, 1.0, 0.74), "wheel_truck")
    for i in range(2):
        add("bus%d" % i, bus(i), "bus", [(4.15, 1.05, 1), (4.15, -1.05, -1), (-2.95, 1.05, 1), (-2.95, -1.05, -1)], 0.5, 12.3,
            (6.18, 0.98, 0.78), (-6.18, 1.06, 0.95), "wheel_bus")
    wheels = {"wheel_car": wheel(0.34, 0.23, 7), "wheel_suv": wheel(0.38, 0.26, 6), "wheel_truck": wheel(0.40, 0.27, 8, True),
              "wheel_bus": wheel(0.5, 0.31, 10, True)}
    # parked versions carry their wheels
    parked = {}
    for name, mb in out.items():
        i = info[name]
        if i["kind"] in ("bus",):
            continue
        p = MeshBuilder()
        p.merge(mb)
        for x, y, side in i["wheels"]:
            p.merge(wheels[i["wheel"]], offset=(x, y, i["wheelRadius"]), yaw=0.0 if side > 0 else 180.0)
        parked["parked_" + name] = p
    return out, wheels, parked, info


# =========================================================================== pedestrians
def pedestrian(variant):
    """A walking figure for mid and far distance.  Vertex R encodes the limb, UV1 = (x, z - pivot)."""
    rng = np.random.default_rng(200 + variant)
    mb = MeshBuilder()
    coat = ["ped_coat_black", "ped_coat_navy", "ped_coat_tan", "ped_coat_gray", "ped_coat_red", "ped_coat_olive"][variant % 6]
    long_coat = variant % 3 != 1
    legs = "ped_pants_dark" if variant % 4 else "ped_pants_denim"

    def limb_part(code, pivot, build):
        m = MeshBuilder()
        build(m)
        p, n, uv0, uv1, col, tri, ts = m.arrays()
        col = col.copy()
        col[:, 0] = code
        uv1 = np.stack([p[:, 0], p[:, 2] - pivot], axis=1)
        remap = np.array([mb.slot(s) for s in m.slots])
        mb.raw(p, n, uv0, uv1, col, tri, 0) if False else None
        for si, s in enumerate(m.slots):
            mask = ts == si
            if mask.any():
                mb.raw(p, n, uv0, uv1, col, tri[mask], s)

    for side, code in ((-1, 0.2), (1, 0.4)):
        def leg(m, side=side):
            y = side * 0.1
            m.tube([(0, y, 0.93), (0.01, y, 0.52), (-0.01, y * 1.02, 0.09)], [0.085, 0.068, 0.048], 8, legs)
            m.sphere((0.05, y * 1.02, 0.05), 0.07, "ped_shoe", segments=8, rings=6, scale=(1.9, 0.82, 0.75))
        limb_part(code, 0.92, leg)
    for side, code in ((-1, 0.6), (1, 0.8)):
        def arm(m, side=side):
            m.tube([(0, side * 0.215, 1.42), (0.0, side * 0.265, 1.13), (0.04, side * 0.27, 0.87)], [0.062, 0.05, 0.04], 7, coat)
            m.sphere((0.045, side * 0.272, 0.82), 0.042, "ped_skin", segments=7, rings=5, scale=(0.9, 0.75, 1.3))
        limb_part(code, 1.42, arm)

    def body(m):
        low = 0.62 if long_coat else 0.9
        prof = [(low, 0.185 if long_coat else 0.16, 0.135), (0.95, 0.15, 0.118), (1.12, 0.162, 0.115), (1.34, 0.2, 0.125), (1.45, 0.205, 0.11), (1.52, 0.09, 0.07)]
        ang = np.linspace(0, 2 * math.pi, 15)[:-1]
        rings = [[(rx * math.sin(a) * 0.82, ry * 0 + (rx if False else 1) * 0 + math.cos(a) * w_, z) for a in ang]
                 for z, w_, rx, ry in [(p[0], p[1], p[2], 0) for p in prof]]
        m.loft(np.array(rings), lambda r, c: coat, closed=True)
        m.poly([r for r in rings[0]], coat, normal=(0, 0, -1))
        m.tube([(0, 0, 1.5), (0.01, 0, 1.58)], 0.048, 8, "ped_skin")
        m.sphere((0.012, 0, 1.665), 0.102, "ped_skin", segments=12, rings=9, scale=(0.96, 0.9, 1.12))
        if variant % 2 == 0:
            m.sphere((-0.006, 0, 1.70), 0.108, "ped_hair", segments=12, rings=9, scale=(1.02, 0.96, 0.96))
        else:
            m.sphere((0.0, 0, 1.718), 0.112, ["ped_coat_red", "ped_coat_black", "ped_coat_gray"][variant % 3], segments=12, rings=8, scale=(1.0, 0.96, 0.82))
        if variant % 3 == 0:
            m.sphere((-0.17, 0, 1.22), 0.14, "ped_bag", segments=10, rings=8, scale=(0.72, 1.05, 1.35))
        elif variant % 3 == 2:
            m.box((-0.09, 0.27, 0.68), (0.13, 0.38, 0.96), "ped_bag")

    limb_part(0.0, 0.0, body)
    return mb


def umbrella(variant=0):
    mb = MeshBuilder()
    slot = ["umbrella_black", "umbrella_black", "umbrella_red", "umbrella_clear"][variant % 4]
    c = (0.06, 0.12, 2.12)
    n = 8
    rim = [(c[0] + 0.56 * math.cos(2 * math.pi * k / n), c[1] + 0.56 * math.sin(2 * math.pi * k / n), c[2] - 0.17) for k in range(n)]
    mid = [(c[0] + 0.34 * math.cos(2 * math.pi * k / n), c[1] + 0.34 * math.sin(2 * math.pi * k / n), c[2] - 0.045) for k in range(n)]
    apex = (c[0], c[1], c[2] + 0.015)
    for k in range(n):
        j = (k + 1) % n
        mb.poly([mid[k], mid[j], apex], slot, normal=(mid[k][0] - c[0], mid[k][1] - c[1], 1.0))
        mb.quad(rim[k], rim[j], mid[j], mid[k], slot, normal=(rim[k][0] - c[0], rim[k][1] - c[1], 0.7))
    mb.tube([(c[0], c[1], c[2] + 0.06), (c[0], c[1], 1.16)], 0.011, 5, "car_trim")
    return mb


def main():
    os.makedirs(os.path.join(OUT, "meshes"), exist_ok=True)
    bodies, wheels, parked, info = build_all()
    manifest = []

    def save(name, mb, preserve=False):
        mb.save(os.path.join(OUT, "meshes", name + ".nmesh"))
        manifest.append(dict(name=name, nanite=not name.startswith(("ped", "umbrella")), cards=12, preserve=preserve, tris=mb.tri_count))

    for name, mb in list(bodies.items()) + list(wheels.items()) + list(parked.items()):
        save(name, mb)
    for i in range(8):
        save("ped%d" % i, pedestrian(i))
    for i in range(4):
        save("umbrella%d" % i, umbrella(i))
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(dict(meshes=manifest), f)
    with open(os.path.join(OUT, "vehicles.json"), "w") as f:
        json.dump(info, f, indent=1)
    print("vehicle meshes", len(manifest), "tris", {m["name"]: m["tris"] for m in manifest if m["name"] in ("cab0", "bus0", "truck0", "ped0", "wheel_car")})


if __name__ == "__main__":
    main()
