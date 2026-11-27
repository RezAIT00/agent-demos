"""Fills the blocks around the landmarks with lots, then builds them."""
import math

import numpy as np

import citydata as D
from building import Building, make_style, MOD
from streets import avenues_for_interval


def zone(x, y):
    """0 hero (full kit), 1 mid (chunked kit), 2 far (boxes)."""
    if (-335 < x < 190 and -345 < y < 525) or (-775 < x <= -335 and -105 < y < 105):
        return 0
    if -960 < x < 660 and -735 < y < 910:
        return 1
    return 2


MIX = {
    "core": [("stone", .24), ("brick", .2), ("deco", .19), ("glass", .23), ("ribbon", .09), ("loft", .05)],
    "fifth": [("stone", .36), ("brick", .3), ("loft", .18), ("deco", .1), ("glass", .06)],
    "garment": [("loft", .48), ("brick", .27), ("deco", .13), ("castiron", .08), ("stone", .04)],
    "murray": [("postwar", .36), ("brick", .38), ("deco", .16), ("glass", .1)],
    "east": [("walkup", .36), ("postwar", .36), ("brick", .18), ("glass", .1)],
    "north": [("glass", .34), ("ribbon", .18), ("deco", .18), ("stone", .16), ("brick", .14)],
}


def neighbourhood(x, y):
    if x > 82 and y < -18:
        return "north"
    if -165 <= x < 180 and -660 < y < 660:
        return "core"
    if x >= 180:
        return "north" if y < 200 else "core" if y < 660 else "east"
    if abs(y) < 165:
        return "fifth"
    if y < 0:
        return "garment"
    if y < 650:
        return "murray"
    return "east"


def choose(rng, mix):
    r = rng.random() * sum(w for _, w in mix)
    for name, w in mix:
        r -= w
        if r <= 0:
            return name
    return mix[-1][0]


def height_for(rng, hood, corner):
    if hood == "core":
        h = rng.uniform(62, 168) if corner else rng.uniform(26, 96)
        if corner and rng.random() < 0.16:
            h = rng.uniform(150, 200)
    elif hood == "north":
        h = rng.uniform(70, 185) if corner else rng.uniform(30, 125)
    elif hood == "fifth":
        h = rng.uniform(40, 76) if corner else rng.uniform(30, 70)
    elif hood == "garment":
        h = rng.uniform(44, 96)
        if rng.random() < 0.08:
            h = rng.uniform(100, 150)
    elif hood == "murray":
        h = rng.uniform(36, 96) if corner else rng.uniform(15, 48)
    else:
        h = rng.uniform(30, 78) if corner else rng.uniform(15, 30)
    return float(h)


def setbacks(rng, rect, h, kind, street):
    """The 1916-zoning wedding cake: full lot to the street wall, then step back."""
    x0, x1, y0, y1 = rect
    wx, wy = x1 - x0, y1 - y0
    if h < 52 or kind in ("walkup", "brownstone", "castiron", "postwar"):
        return None
    if kind in ("glass", "ribbon"):
        if rng.random() < 0.55 or min(wx, wy) < 24:
            return None
        base = float(rng.uniform(16, 38))
        ix, iy = wx * rng.uniform(0.06, 0.16), wy * rng.uniform(0.06, 0.16)
        return [(rect, 0.0, base), ((x0 + ix, x1 - ix, y0 + iy, y1 - iy), base, h)]
    first = float(rng.uniform(34, min(62, h * 0.7)))
    tiers = [(rect, 0.0, first)]
    z = first
    cur = list(rect)
    steps = int(rng.integers(1, 4))
    remaining = h - first
    for i in range(steps):
        dz = remaining / steps * float(rng.uniform(0.8, 1.2)) if i < steps - 1 else h - z
        inset = float(rng.uniform(2.2, 4.8))
        sides = {"S": "S" in street, "N": "N" in street, "W": "W" in street, "E": "E" in street}
        nx0 = cur[0] + (inset if sides["S"] or rng.random() < 0.4 else 0)
        nx1 = cur[1] - (inset if sides["N"] or rng.random() < 0.4 else 0)
        ny0 = cur[2] + (inset if sides["W"] or rng.random() < 0.4 else 0)
        ny1 = cur[3] - (inset if sides["E"] or rng.random() < 0.4 else 0)
        if nx1 - nx0 < 11 or ny1 - ny0 < 9:
            break
        cur = [nx0, nx1, ny0, ny1]
        top = min(h, z + max(dz, 7.0))
        tiers.append((tuple(cur), z, top))
        z = top
        if z >= h - 1:
            break
    if z < h - 0.5:
        r, a, b = tiers[-1]
        tiers[-1] = (r, a, h)
    return tiers


def free_intervals(a, b, blocked):
    out = [(a, b)]
    for lo, hi in blocked:
        nxt = []
        for s, e in out:
            if hi <= s or lo >= e:
                nxt.append((s, e))
                continue
            if lo - s > 0.5:
                nxt.append((s, lo - 0.3))
            if e - hi > 0.5:
                nxt.append((hi + 0.3, e))
        out = nxt
    return out


def plan_blocks(city):
    """Returns a list of lot plans for the hero and mid zones."""
    rng = np.random.default_rng(1913)
    reserved = list(D.LOTS.items())
    # whole areas that are handled by hand
    extra = [(-155.4, -15.0, -296.0, -15.0), (15.0, 330.0, 242.0, 398.0), (-2000.0, 2000.0, 224.0, 242.0),
             (-75.0, 75.0, 920.0, 1010.0), (-135.0, -80.0, 920.0, 1010.0), (75.0, 135.0, 920.0, 1010.0)]
    plans = []
    for n in range(30, 52):
        xa = D.street_x(n) + D.street_width(n) / 2
        xb = D.street_x(n + 1) - D.street_width(n + 1) / 2
        if xb < -960 or xa > 660:
            continue
        aves = avenues_for_interval(n)
        for (ya_c, _, rowa, na), (yb_c, _, rowb, nb) in zip(aves[:-1], aves[1:]):
            ya, yb = ya_c + rowa / 2, yb_c - rowb / 2
            if yb < -735 or ya > 910 or yb - ya < 12:
                continue
            depth = xb - xa

            def blocked_for(x0, x1):
                out = []
                for _, r in reserved:
                    if min(x1, r[1]) - max(x0, r[0]) > 1.0 and min(yb, r[3]) - max(ya, r[2]) > 0.5:
                        out.append((r[2], r[3]))
                for r in extra:
                    if min(x1, r[1]) - max(x0, r[0]) > 1.0 and min(yb, r[3]) - max(ya, r[2]) > 0.5:
                        out.append((r[2], r[3]))
                return out

            def add(rect, hood, corner, street, style=None, h=None):
                x0, x1, y0, y1 = rect
                if x1 - x0 < 5 or y1 - y0 < 4.5:
                    return
                z = zone((x0 + x1) / 2, (y0 + y1) / 2)
                if z > 1:
                    return
                kind = style or choose(rng, MIX[hood])
                hh = h if h is not None else height_for(rng, hood, corner)
                if kind in ("glass",) and hh < 55:
                    kind = "brick"
                if kind in ("castiron", "walkup") and hh > 34:
                    hh = float(rng.uniform(18, 30))
                if kind == "loft" and hh > 100:
                    kind = "deco"
                if y1 - y0 < 11 and hh > 70:
                    hh = float(rng.uniform(30, 62))
                plans.append(dict(rect=rect, h=hh, kind=kind, street=street, zone=z, corner=corner))

            # avenue-end lots
            ends = []
            for side, y_edge in (("W", ya), ("E", yb)):
                w = float(rng.uniform(22, 40))
                w = min(w, (yb - ya) * 0.42)
                y0, y1 = (y_edge, y_edge + w) if side == "W" else (y_edge - w, y_edge)
                ends.append((y0, y1))
                hood = neighbourhood((xa + xb) / 2, (y0 + y1) / 2)
                split = rng.random() < (0.55 if hood in ("murray", "east", "garment") else 0.34)
                halves = [(xa, xa + depth / 2, ["S"]), (xa + depth / 2, xb, ["N"])] if split else [(xa, xb, ["S", "N"])]
                for hx0, hx1, faces in halves:
                    blk = blocked_for(hx0, hx1)
                    for s, e in free_intervals(y0, y1, blk):
                        street = list(faces)
                        if abs(s - ya) < 0.5:
                            street.append("W")
                        if abs(e - yb) < 0.5:
                            street.append("E")
                        add((hx0, hx1, s, e), hood, True, street)
            mid0, mid1 = ends[0][1], ends[1][0]
            for half, faces in (((xa, xa + depth / 2), ["S"]), ((xa + depth / 2, xb), ["N"])):
                for s, e in free_intervals(mid0, mid1, blocked_for(*half)):
                    y = s
                    while y < e - 4:
                        hood = neighbourhood((half[0] + half[1]) / 2, y + 6)
                        brown = hood == "murray" and 35 <= n <= 39 and rng.random() < 0.82
                        if brown:
                            k = int(rng.integers(3, 8))
                            h = float(rng.uniform(13.5, 18.0))
                            for _ in range(k):
                                w = float(rng.uniform(5.6, 7.2))
                                if y + w > e:
                                    break
                                depth_in = float(rng.uniform(16, 21))
                                rect = (half[0] + 1.9, half[0] + 1.9 + depth_in, y, y + w) if faces == ["S"] else (half[1] - 1.9 - depth_in, half[1] - 1.9, y, y + w)
                                add(rect, hood, False, faces, style="brownstone", h=h + float(rng.uniform(-0.8, 0.8)))
                                y += w
                            if y >= e - 5.6:
                                if e - y > 4:
                                    add((half[0], half[1], y, e), hood, False, faces)
                                y = e
                            continue
                        if hood == "east":
                            w = float(rng.uniform(7.5, 18))
                        elif hood in ("fifth", "garment"):
                            w = float(rng.uniform(12, 32))
                        else:
                            w = float(rng.uniform(13, 38))
                        if e - (y + w) < 8:
                            w = e - y
                        street = list(faces)
                        if abs(y - ya) < 0.5:
                            street.append("W")
                        if abs(y + w - yb) < 0.5:
                            street.append("E")
                        style = None
                        if hood == "garment" and 38 <= n <= 39 and -310 < y < -160 and rng.random() < 0.45:
                            style = "castiron"
                        add((half[0], half[1], y, y + w), hood, False, street, style=style)
                        y += w
    return plans


# Roofs the film stands on: no setbacks, no random clutter, and a composed foreground.
FILM_ROOFS = {
    (-76.2, -45.7, 44.0, 73.9): [("watertower", (-65.6, 67.4), 20.0, 0.92), ("bulkhead", (-52.0, 47.8), 90.0, 0.8),
                                 ("hvac0", (-67.5, 61.0), 0.0, 1.0), ("vents", (-61.0, 66.5), 40.0, 1.1),
                                 ("hvac2", (-71.5, 55.0), 90.0, 1.0), ("antenna", (-73.5, 46.5), 0.0, 1.2), ("skylight", (-52.0, 60.0), 0.0, 1.0)],
    (-45.7, -15.2, 242.3, 275.9): [("watertower", (-32.4, 255.6), 210.0, 0.82), ("bulkhead", (-21.5, 247.5), 0.0, 0.8),
                                    ("hvac1", (-25.5, 262.0), 0.0, 1.0), ("vents", (-37.5, 266.0), 10.0, 1.2),
                                    ("hvac0", (-19.5, 268.0), 90.0, 1.0), ("chimney", (-40.5, 258.5), 0.0, 1.0), ("hvac2", (-30.0, 272.5), 0.0, 0.9)],
}


def film_roof(rect):
    for key, items in FILM_ROOFS.items():
        if all(abs(a - b) < 0.6 for a, b in zip(key, rect)):
            return items
    return None


def build_blocks(city):
    plans = plan_blocks(city)
    # everyone's footprint first, so party walls know what hides them
    for p in plans:
        city.footprints.append((p["rect"], p["h"]))
    sheds = 0
    stats = {"hero": 0, "mid": 0}
    for p in plans:
        city.footprints.remove((p["rect"], p["h"]))
        st = make_style(p["kind"], city.rng)
        dressing = film_roof(p["rect"])
        tiers = None if dressing else setbacks(city.rng, p["rect"], p["h"], p["kind"], p["street"])
        b = Building(city, p["rect"], p["h"], st, p["street"], detail=p["zone"], tiers=tiers, signs=True, clutter=dressing is None)
        b.build()
        for mesh, (x, y), yaw, scale in dressing or []:
            city.inst(mesh, (x, y, p["h"] + 0.05), yaw, scale)
        stats["hero" if p["zone"] == 0 else "mid"] += 1
    return plans, stats


# --------------------------------------------------------------------------- sidewalk sheds
def add_shed(city, rect, face, a0, a1, lifts=0):
    """A run of sidewalk bridge along one face, optionally with scaffold above it."""
    from building import FACES, face_geom
    (lx, ly), L = face_geom(rect, face)
    n_, r, yaw = FACES[face]
    a1 = min(a1, L)
    n = max(1, int((a1 - a0) / 2.4))
    sx = (a1 - a0) / (n * 2.4)
    for i in range(n):
        a = a0 + i * 2.4 * sx
        city.inst("shed", (lx + r[0] * a, ly + r[1] * a, 0.15), yaw, (sx, 1.0, 1.0))
        if i % 2 == 1:
            m = a + 1.2 * sx
            city.light((lx + r[0] * m + n_[0] * 1.5, ly + r[1] * m + n_[1] * 1.5, 2.98), (0, 0, -1), (1.0, 0.86, 0.62), 260, 8, 78.0, 5, shadows=False, volumetric=0.5)
        for k in range(lifts):
            city.inst("scaffold", (lx + r[0] * a, ly + r[1] * a, 3.35 + k * 2.0), yaw, (sx, 1.0, 1.0), rt=False)
            if k < lifts:
                city.inst("netting", (lx + r[0] * a, ly + r[1] * a, 3.35 + k * 2.0), yaw, (sx, 1.0, 1.0), shadow=False, rt=False)
    pts = [(lx + r[0] * s + n_[0] * d, ly + r[1] * s + n_[1] * d) for s in (a0, a1) for d in (0.0, 3.05)]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    city.add_cover(min(xs), max(xs), min(ys), max(ys), 3.05)
    for i in range(int((a1 - a0) / 0.7)):
        a = a0 + 0.35 + i * 0.7 + float(city.rng.uniform(-0.2, 0.2))
        city.drips.append((lx + r[0] * a + n_[0] * 3.06, ly + r[1] * a + n_[1] * 3.06, 3.2))
