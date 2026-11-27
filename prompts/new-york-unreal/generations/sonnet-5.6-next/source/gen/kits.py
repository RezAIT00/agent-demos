"""Facade module kit.

Module space: x runs along the facade (to the right as seen from the street) from 0 to W,
y = 0 is the wall face with +y pointing out of the building, z from 0 to H.
Material slots are named after material instances ("wall", "trim", "frame" and "spandrel" are
generic and overridden per building).
"""
import math

import numpy as np

from meshlib import MeshBuilder

# default material for each generic slot
SLOT_DEFAULTS = {"wall": "limestone", "trim": "limestone_trim", "frame": "paint_black", "glass": "glass_home",
                 "spandrel": "terracotta", "shopframe": "paint_black", "awning": "fabric_green",
                 "mullion": "anodized", "spg": "spandrel_dark"}


class Module:
    def __init__(self, name, w, h):
        self.name, self.w, self.h = name, w, h
        self.mb = MeshBuilder()
        self.mb.bevel = 0.012
        self.windows = []      # (x0, x1, z0, z1, depth)


def wall_front(mb, W, H, openings, slot="wall", y=0.0, x0=0.0, z0=0.0):
    """Flat wall face with rectangular holes. Openings must not overlap and share nothing."""
    xs = sorted({x0, W} | {o[0] for o in openings} | {o[1] for o in openings})
    zs = sorted({z0, H} | {o[2] for o in openings} | {o[3] for o in openings})
    for i in range(len(xs) - 1):
        # merge vertical runs of solid cells to keep the triangle count low
        run = None
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            hole = any(o[0] < cx < o[1] and o[2] < cz < o[3] for o in openings)
            if not hole and run is None:
                run = zs[j]
            if (hole or j == len(zs) - 2) and run is not None:
                top = zs[j] if hole else zs[j + 1]
                above = [o for o in openings if o[0] - 1e-6 <= cx <= o[1] + 1e-6 and abs(o[2] - top) < 1e-6]
                tag = None
                if above:
                    o = above[0]
                    across = lambda x: (x - o[0]) / max(o[1] - o[0], 1e-3) - 0.5
                    tag = [(across(xs[i]), 1.0 + top - run), (across(xs[i + 1]), 1.0 + top - run), (across(xs[i + 1]), 1.0), (across(xs[i]), 1.0)]
                mb.quad((xs[i], y, run), (xs[i + 1], y, run), (xs[i + 1], y, top), (xs[i], y, top), slot, normal=(0, 1, 0), uv1=tag)
                run = None


def reveals(mb, o, depth, slot="wall", y=0.0):
    x0, x1, z0, z1 = o
    yb = y - depth
    mb.quad((x0, y, z0), (x0, yb, z0), (x0, yb, z1), (x0, y, z1), slot, normal=(1, 0, 0), color=(0.9, 1, 1, 1))
    mb.quad((x1, y, z0), (x1, yb, z0), (x1, yb, z1), (x1, y, z1), slot, normal=(-1, 0, 0), color=(0.9, 1, 1, 1))
    mb.quad((x0, y, z1), (x1, y, z1), (x1, yb, z1), (x0, yb, z1), slot, normal=(0, 0, -1), color=(0.86, 1, 1, 1))
    mb.quad((x0, y, z0), (x1, y, z0), (x1, yb, z0), (x0, yb, z0), slot, normal=(0, 0, 1))


def glass_pane(mb, o, y, slot="glass", idx=0.0, room=None):
    """Glass quad whose UVs are metres from the room window's lower-left corner."""
    x0, x1, z0, z1 = o
    rx0, rx1, rz0, rz1 = room or o
    pts = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    uv = [(p[0] - rx0, p[2] - rz0) for p in pts]
    mb.poly(pts, slot, normal=(0, 1, 0), uv=uv, uv1=[(rx1 - rx0, rz1 - rz0)] * 4, color=(1, 1, 1, idx))


def frame_rect(mb, o, y, fw, thick, slot="frame"):
    x0, x1, z0, z1 = o
    f = "yYzZxX".replace("y", "")
    mb.box((x0, y, z0), (x0 + fw, y + thick, z1), slot, faces="XY")
    mb.box((x1 - fw, y, z0), (x1, y + thick, z1), slot, faces="xY")
    mb.box((x0 + fw, y, z0), (x1 - fw, y + thick, z0 + fw), slot, faces="ZY")
    mb.box((x0 + fw, y, z1 - fw), (x1 - fw, y + thick, z1), slot, faces="zY")


def double_hung(mb, o, depth, idx=0.0, glass="glass", fw=0.055, room=None):
    """Two sashes, the upper one set slightly proud of the lower, as on real sash windows."""
    x0, x1, z0, z1 = o
    mid = z0 + (z1 - z0) * 0.5
    yb = -depth
    frame_rect(mb, o, yb + 0.005, fw * 0.8, 0.075)
    lo = (x0 + fw * 0.7, x1 - fw * 0.7, z0 + fw * 0.7, mid + 0.02)
    hi = (x0 + fw * 0.7, x1 - fw * 0.7, mid - 0.02, z1 - fw * 0.7)
    frame_rect(mb, lo, yb + 0.012, fw, 0.03)
    frame_rect(mb, hi, yb + 0.045, fw, 0.03)
    glass_pane(mb, lo, yb + 0.022, glass, idx, room or o)
    glass_pane(mb, hi, yb + 0.055, glass, idx, room or o)


def casement(mb, o, depth, cols=2, rows=1, idx=0.0, glass="glass", fw=0.05, transom=0.0, slot="frame"):
    x0, x1, z0, z1 = o
    yb = -depth
    frame_rect(mb, o, yb + 0.01, fw, 0.07, slot)
    glass_pane(mb, (x0 + fw * 0.5, x1 - fw * 0.5, z0 + fw * 0.5, z1 - fw * 0.5), yb + 0.03, glass, idx, o)
    for c in range(1, cols):
        x = x0 + (x1 - x0) * c / cols
        mb.box((x - fw / 2, yb + 0.03, z0 + fw), (x + fw / 2, yb + 0.075, z1 - fw), slot, faces="xXY")
    zr = [z0 + (z1 - z0) * r / rows for r in range(1, rows)]
    if transom > 0:
        zr.append(z1 - transom)
    for z in zr:
        mb.box((x0 + fw, yb + 0.03, z - fw / 2), (x1 - fw, yb + 0.072, z + fw / 2), slot, faces="zZY")


def sill(mb, o, proj=0.09, h=0.11, ext=0.07, depth=0.2, slot="trim"):
    x0, x1, z0, _ = o
    mb.box((x0 - ext, -depth + 0.07, z0 - h), (x1 + ext, proj, z0), slot, faces="xXYzZ")


def lintel(mb, o, h=0.24, proj=0.035, ext=0.1, slot="trim", key=False):
    x0, x1, _, z1 = o
    mb.box((x0 - ext, 0.0, z1), (x1 + ext, proj, z1 + h), slot, faces="xXYzZ")
    if key:
        cx = (x0 + x1) / 2
        mb.poly([(cx - 0.09, proj + 0.03, z1 - 0.02), (cx + 0.09, proj + 0.03, z1 - 0.02),
                 (cx + 0.14, proj + 0.03, z1 + h + 0.06), (cx - 0.14, proj + 0.03, z1 + h + 0.06)], slot, normal=(0, 1, 0))


def arch_opening(mb, W, H, x0, x1, z0, zs, depth, segments=10, slot="wall", ring="trim", ring_w=0.18):
    """Opening with a round head springing at zs. Returns the arch crown height."""
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    top = zs + r
    wall_front(mb, W, H, [(x0, x1, z0, top)], slot)
    pts = [(cx - r * math.cos(math.pi * i / segments), zs + r * math.sin(math.pi * i / segments)) for i in range(segments + 1)]
    for i in range(segments):
        (ax, az), (bx, bz) = pts[i], pts[i + 1]
        # spandrel between the arch and the square head
        mb.quad((ax, 0, az), (bx, 0, bz), (bx, 0, top), (ax, 0, top), slot, normal=(0, 1, 0))
        n = (cx - (ax + bx) / 2, 0, zs - (az + bz) / 2)
        mb.quad((ax, 0, az), (bx, 0, bz), (bx, -depth, bz), (ax, -depth, az), slot, normal=n, color=(0.88, 1, 1, 1))
        # voussoir ring
        k = (r + ring_w) / r
        oax, oaz = cx + (ax - cx) * k, zs + (az - zs) * k
        obx, obz = cx + (bx - cx) * k, zs + (bz - zs) * k
        mb.quad((ax, 0.045, az), (bx, 0.045, bz), (obx, 0.045, obz), (oax, 0.045, oaz), ring, normal=(0, 1, 0))
        mb.quad((oax, 0.045, oaz), (obx, 0.045, obz), (obx, 0.0, obz), (oax, 0.0, oaz), ring,
                normal=(-n[0], 0, -n[2]))
    reveals(mb, (x0, x1, z0, zs), depth, slot)
    return top


def arch_glass(mb, x0, x1, z0, zs, depth, segments=10, idx=0.0, glass="glass"):
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    top = zs + r
    y = -depth + 0.03
    pts = [(x0, y, z0), (x1, y, z0)]
    pts += [(cx + r * math.cos(math.pi * i / segments), y, zs + r * math.sin(math.pi * i / segments)) for i in range(segments + 1)]
    uv = [(p[0] - x0, p[2] - z0) for p in pts]
    mb.poly(pts, glass, normal=(0, 1, 0), uv=uv, uv1=[(x1 - x0, top - z0)] * len(pts), color=(1, 1, 1, idx))
    mb.box((cx - 0.025, y, z0), (cx + 0.025, y + 0.045, top - 0.02), "frame", faces="xXY")
    mb.box((x0, y, zs - 0.03), (x1, y + 0.045, zs + 0.03), "frame", faces="zZY")
    mb.box((x0, y, z0), (x0 + 0.06, y + 0.05, zs), "frame", faces="XY")
    mb.box((x1 - 0.06, y, z0), (x1, y + 0.05, zs), "frame", faces="xY")
    for i in range(segments):
        a0, a1 = math.pi * i / segments, math.pi * (i + 1) / segments
        mb.quad((cx + r * math.cos(a0), y + 0.05, zs + r * math.sin(a0)), (cx + r * math.cos(a1), y + 0.05, zs + r * math.sin(a1)),
                (cx + (r - 0.06) * math.cos(a1), y + 0.05, zs + (r - 0.06) * math.sin(a1)),
                (cx + (r - 0.06) * math.cos(a0), y + 0.05, zs + (r - 0.06) * math.sin(a0)), "frame", normal=(0, 1, 0))


# =========================================================================== modules
def _simple(name, W, H, openings, depth, unit="hung", sill_kw=None, lintel_kw=None, cols=2):
    m = Module(name, W, H)
    wall_front(m.mb, W, H, openings)
    for i, o in enumerate(openings):
        reveals(m.mb, o, depth)
        if unit == "hung":
            double_hung(m.mb, o, depth, idx=i * 0.13)
        else:
            casement(m.mb, o, depth, cols=cols, idx=i * 0.13)
        if sill_kw is not None:
            sill(m.mb, o, depth=depth, **sill_kw)
        if lintel_kw is not None:
            lintel(m.mb, o, **lintel_kw)
        m.windows.append((o[0], o[1], o[2], o[3], depth))
    return m


def prewar_single():
    return _simple("pw1", 2.2, 3.55, [(0.52, 1.68, 0.85, 2.92)], 0.24, "hung", {}, {"h": 0.22})


def prewar_pair():
    return _simple("pw2", 3.3, 3.55, [(0.38, 1.52, 0.85, 2.92), (1.78, 2.92, 0.85, 2.92)], 0.24, "hung", {"ext": 0.05}, {"ext": 0.05})


def prewar_pair_key():
    return _simple("pw2k", 3.3, 3.55, [(0.4, 1.54, 0.82, 2.86), (1.76, 2.9, 0.82, 2.86)], 0.26, "hung", {"ext": 0.05},
                   {"ext": 0.07, "h": 0.3, "key": True})


def prewar_arch():
    m = Module("pwarch", 2.2, 3.8)
    top = arch_opening(m.mb, 2.2, 3.8, 0.5, 1.7, 0.7, 2.55, 0.28)
    arch_glass(m.mb, 0.5, 1.7, 0.7, 2.55, 0.28)
    sill(m.mb, (0.5, 1.7, 0.7, top), depth=0.28, h=0.16, proj=0.13)
    m.mb.box((1.01, 0.045, top + 0.0), (1.19, 0.1, top + 0.32), "trim", faces="xXYzZ")
    return m


def prewar_attic():
    m = _simple("pwattic", 2.2, 3.1, [(0.55, 1.65, 0.75, 2.2)], 0.24, "case", {"h": 0.14, "proj": 0.14}, {"h": 0.2, "proj": 0.07})
    for x in (0.12, 1.88):
        m.mb.box((x, 0.0, 0.62), (x + 0.2, 0.07, 2.45), "trim", faces="xXYzZ")
        m.mb.box((x + 0.04, 0.07, 0.8), (x + 0.16, 0.1, 2.25), "trim", faces="xXYzZ")
    return m


def rusticated(name="rust", W=2.4, H=3.6, opening=(0.55, 1.85, 0.75, 2.9)):
    """Stone base: courses separated by deep joints."""
    m = Module(name, W, H)
    course, gap = 0.45, 0.05
    z = 0.0
    while z < H - 0.01:
        top = min(z + course - gap, H)
        ops = []
        if opening and opening[2] < top and opening[3] > z:
            ops = [(opening[0], opening[1], max(opening[2], z), min(opening[3], top))]
        wall_front(m.mb, W, top, ops, y=0.06, z0=z)
        for (ax, bx) in ([(0, opening[0]), (opening[1], W)] if ops else [(0, W)]):
            m.mb.quad((ax, 0.06, top), (bx, 0.06, top), (bx, 0.0, top), (ax, 0.0, top), "wall", normal=(0, 0, 1))
            m.mb.quad((ax, 0.06, z), (bx, 0.06, z), (bx, 0.0, z), (ax, 0.0, z), "wall", normal=(0, 0, -1), color=(0.8, 1, 1, 1))
            gz = min(top + gap, H)
            if gz > top:
                m.mb.quad((ax, 0.0, top), (bx, 0.0, top), (bx, 0.0, gz), (ax, 0.0, gz), "wall", normal=(0, 1, 0), color=(0.7, 1, 1, 1))
        z += course
    if opening:
        o = opening
        reveals(m.mb, o, 0.32, y=0.06)
        casement(m.mb, o, 0.26, cols=2, transom=0.5, glass="glass")
        sill(m.mb, o, depth=0.26, proj=0.13, h=0.16)
        m.windows.append((o[0], o[1], o[2], o[3], 0.26))
    return m


def deco(name="deco", W=1.75, H=3.5):
    m = Module(name, W, H)
    o = (0.34, W - 0.34, 1.05, 3.3)
    wall_front(m.mb, W, H, [(o[0], o[1], 0.0, H)])
    # recessed spandrel with flutes under each window; the piers read as unbroken verticals
    reveals(m.mb, (o[0], o[1], 0.0, H), 0.2)
    sp = (o[0], o[1], 0.0, o[2])
    m.mb.quad((sp[0], -0.1, 0.0), (sp[1], -0.1, 0.0), (sp[1], -0.1, o[2]), (sp[0], -0.1, o[2]), "spandrel", normal=(0, 1, 0))
    fw = (o[1] - o[0]) / 7
    for k in (1, 3, 5):
        m.mb.box((o[0] + fw * k, -0.1, 0.2), (o[0] + fw * (k + 1), -0.055, o[2] - 0.16), "spandrel", faces="xXYzZ")
    m.mb.quad((o[0], -0.1, o[2]), (o[1], -0.1, o[2]), (o[1], -0.2, o[2]), (o[0], -0.2, o[2]), "spandrel", normal=(0, 0, 1))
    m.mb.quad((o[0], -0.1, o[3]), (o[1], -0.1, o[3]), (o[1], -0.1, H), (o[0], -0.1, H), "spandrel", normal=(0, 1, 0))
    casement(m.mb, o, 0.2, cols=2, rows=2, glass="glass", fw=0.045)
    for x0, x1 in ((0.0, 0.16), (W - 0.16, W)):
        m.mb.box((x0, 0.0, 0.0), (x1, 0.15, H), "wall", faces="xXY")
    m.windows.append((o[0], o[1], o[2], o[3], 0.2))
    return m


def postwar():
    m = _simple("pb", 3.1, 3.1, [(0.4, 2.7, 0.92, 2.5)], 0.14, "case", {"proj": 0.045, "h": 0.07, "ext": 0.03, "slot": "trim"},
                None, cols=3)
    return m


def loft_wide():
    """Garment-district loft: big steel windows between slim brick piers."""
    m = _simple("loft", 3.4, 3.75, [(0.32, 3.08, 0.75, 3.15)], 0.22, "case", {"h": 0.14, "ext": 0.04},
                {"h": 0.3, "ext": 0.0}, cols=3)
    m.mb.box((0.32, -0.21, 2.45), (3.08, -0.14, 2.52), "frame", faces="zZY")
    m.mb.box((0.0, 0.0, 0.0), (0.16, 0.08, 3.75), "wall", faces="xXY")
    m.mb.box((3.24, 0.0, 0.0), (3.4, 0.08, 3.75), "wall", faces="xXY")
    return m


def curtain(name="cw", W=1.52, H=4.0, fin=0.07, spandrel_h=0.95, split=0.0):
    m = Module(name, W, H)
    vis = (0.0, W, spandrel_h, H)
    # vision glass shares one room across bays; UVs follow the building so rooms span mullions
    glass_pane(m.mb, vis, -0.03, "glass")
    glass_pane(m.mb, (0.0, W, 0.0, spandrel_h), -0.025, "spg")
    m.mb.box((-0.03, -0.03, 0.0), (0.03, min(fin, 0.028), H), "mullion", faces="xXY")
    for z in (0.0, spandrel_h):
        m.mb.box((0.03, -0.03, z - 0.028), (W - 0.03, 0.025, z + 0.028), "mullion", faces="zZY")
    if split > 0:
        m.mb.box((0.03, -0.03, split - 0.018), (W - 0.03, 0.005, split + 0.018), "mullion", faces="zZY")
    m.windows.append((0.0, W, spandrel_h, H, 0.03))
    return m


def ribbon():
    m = Module("ribbon", 3.0, 3.65)
    o = (0.0, 3.0, 1.35, 3.35)
    wall_front(m.mb, 3.0, 3.65, [o])
    reveals(m.mb, o, 0.12)
    glass_pane(m.mb, o, -0.09)
    for k in range(3):
        m.mb.box((k * 1.0 - 0.03, -0.1, 1.35), (k * 1.0 + 0.03, -0.042, 3.35), "mullion", faces="xXY")
    m.mb.box((0.0, 0.0, 1.22), (3.0, 0.14, 1.35), "trim", faces="YzZ")
    m.mb.box((0.0, 0.0, 3.35), (3.0, 0.1, 3.45), "trim", faces="YzZ")
    m.windows.append((o[0], o[1], o[2], o[3], 0.12))
    return m


def _column(mb, x, z0, z1, r, slot="trim"):
    h = z1 - z0
    mb.lathe((x, 0.04, z0), [(r * 1.5, 0), (r * 1.5, 0.08), (r * 1.15, 0.12), (r * 1.15, 0.18), (r, 0.22),
                             (r * 0.86, h - 0.3), (r * 1.05, h - 0.27), (r * 0.95, h - 0.22), (r * 1.35, h - 0.1),
                             (r * 1.55, h - 0.08), (r * 1.55, h)], slot, segments=10, arc=(0.0, math.pi))


def cast_iron(arched=True):
    m = Module("ci" if arched else "ciflat", 2.3, 4.1)
    W, H = 2.3, 4.1
    if arched:
        arch_opening(m.mb, W, H - 0.55, 0.34, 1.96, 0.55, 2.4, 0.3, ring_w=0.1)
        arch_glass(m.mb, 0.34, 1.96, 0.55, 2.4, 0.3)
    else:
        o = (0.3, 2.0, 0.55, 3.3)
        wall_front(m.mb, W, H - 0.55, [o])
        reveals(m.mb, o, 0.3)
        casement(m.mb, o, 0.3, cols=2, transom=0.65)
        m.windows.append((o[0], o[1], o[2], o[3], 0.3))
    for x in (0.0, W):
        _column(m.mb, x, 0.32, H - 0.55, 0.11)
    # sill band and the entablature that caps every storey
    m.mb.box((0.0, 0.0, 0.0), (W, 0.1, 0.12), "trim", faces="YzZ")
    m.mb.box((0.0, 0.0, 0.3), (W, 0.07, 0.4), "trim", faces="YzZ")
    z = H - 0.55
    m.mb.box((0.0, -0.01, z), (W, 0.2, z + 0.12), "trim", faces="YzZ")
    m.mb.box((0.0, -0.01, z + 0.12), (W, 0.12, z + 0.35), "trim", faces="YzZ")
    m.mb.box((0.0, -0.01, z + 0.4), (W, 0.34, z + 0.47), "trim", faces="YzZ")
    m.mb.box((0.0, -0.01, z + 0.47), (W, 0.42, z + 0.55), "trim", faces="YzZ")
    k = 0.06
    while k < W - 0.08:
        m.mb.box((k, 0.12, z + 0.3), (k + 0.09, 0.28, z + 0.4), "trim", faces="xXYz")
        k += 0.19
    return m


def brownstone(parlor=False):
    H = 4.1 if parlor else 3.35
    m = Module("bsp" if parlor else "bs", 2.1, H)
    o = (0.5, 1.6, 0.55 if parlor else 0.72, H - 0.62)
    wall_front(m.mb, 2.1, H, [o])
    reveals(m.mb, o, 0.26)
    double_hung(m.mb, o, 0.26)
    sill(m.mb, o, depth=0.26, proj=0.12, h=0.13)
    x0, x1, z0, z1 = o
    # moulded surround and hood on consoles
    m.mb.box((x0 - 0.14, 0.0, z0), (x0 - 0.02, 0.055, z1), "trim", faces="xXY")
    m.mb.box((x1 + 0.02, 0.0, z0), (x1 + 0.14, 0.055, z1), "trim", faces="xXY")
    m.mb.box((x0 - 0.16, 0.0, z1), (x1 + 0.16, 0.08, z1 + 0.2), "trim", faces="xXYzZ")
    m.mb.box((x0 - 0.26, 0.0, z1 + 0.2), (x1 + 0.26, 0.24, z1 + 0.29), "trim", faces="xXYzZ")
    for x in (x0 - 0.13, x1 + 0.03):
        m.mb.poly([(x, 0.0, z1 - 0.22), (x, 0.2, z1 + 0.2), (x, 0.0, z1 + 0.2)], "trim", normal=(-1, 0, 0))
        m.mb.poly([(x + 0.1, 0.0, z1 - 0.22), (x + 0.1, 0.2, z1 + 0.2), (x + 0.1, 0.0, z1 + 0.2)], "trim", normal=(1, 0, 0))
        m.mb.quad((x, 0.0, z1 - 0.22), (x + 0.1, 0.0, z1 - 0.22), (x + 0.1, 0.2, z1 + 0.2), (x, 0.2, z1 + 0.2), "trim",
                  normal=(0, 1, -0.6))
    if parlor:
        m.mb.poly([(x0 - 0.26, 0.2, z1 + 0.29), (x1 + 0.26, 0.2, z1 + 0.29), ((x0 + x1) / 2, 0.2, z1 + 0.56)], "trim", normal=(0, 1, 0))
        for sx, ex in ((x0 - 0.26, (x0 + x1) / 2), (x1 + 0.26, (x0 + x1) / 2)):
            m.mb.quad((sx, 0.2, z1 + 0.29), (ex, 0.2, z1 + 0.56), (ex, 0.0, z1 + 0.56), (sx, 0.0, z1 + 0.29), "trim",
                      normal=(0, 0, 1))
    m.windows.append((o[0], o[1], o[2], o[3], 0.26))
    return m


def walkup():
    m = _simple("wu", 2.35, 3.1, [(0.64, 1.72, 0.78, 2.55)], 0.2, "hung", {"h": 0.1, "proj": 0.09}, None)
    o = (0.64, 1.72, 0.78, 2.55)
    m.mb.poly([(o[0] - 0.12, 0.06, o[3]), (o[1] + 0.12, 0.06, o[3]), (o[1] + 0.16, 0.06, o[3] + 0.2),
               ((o[0] + o[1]) / 2, 0.06, o[3] + 0.33), (o[0] - 0.16, 0.06, o[3] + 0.2)], "trim", normal=(0, 1, 0))
    m.mb.box((o[0] - 0.16, 0.0, o[3] + 0.19), (o[1] + 0.16, 0.07, o[3] + 0.23), "trim", faces="xXzZ")
    m.mb.box((o[0] - 0.12, 0.0, o[3]), (o[1] + 0.12, 0.06, o[3] + 0.19), "trim", faces="xXz")
    return m


def blank_window():
    """Sparse lot-line window for the party walls that rise above a neighbour."""
    return _simple("lotline", 2.6, 3.55, [(0.9, 1.7, 1.0, 2.55)], 0.18, "case", {"h": 0.07, "proj": 0.05}, None)


# --------------------------------------------------------------------------- ground floor
def storefront(variant=0):
    """4 m shopfront: bulkhead, plate glass, door, transom and a sign band (sign added separately)."""
    W, H = 4.0, 4.6
    m = Module("shop%d" % variant, W, H)
    mb = m.mb
    # stone/brick piers and the lintel above the sign band
    wall_front(mb, W, H, [(0.18, W - 0.18, 0.0, 4.32)])
    mb.box((0.0, 0.0, 0.0), (0.18, 0.06, 4.32), "wall", faces="xXY")
    mb.box((W - 0.18, 0.0, 0.0), (W, 0.06, 4.32), "wall", faces="xXY")
    # sign band backing
    mb.box((0.18, -0.2, 3.45), (W - 0.18, 0.04, 4.32), "shopframe", faces="YzZ")
    reveals(mb, (0.18, W - 0.18, 0.0, 3.45), 0.45, "shopframe")
    top = 3.45
    room = (0.18, W - 0.18, 0.0, top)
    if variant == 0:
        door = (2.78, 3.74)
        panes = [(0.18, door[0])]
    elif variant == 1:
        door = (1.5, 2.5)
        panes = [(0.18, door[0]), (door[1], W - 0.18)]
    else:
        door = (0.3, 1.26)
        panes = [(door[1] + 0.05, W - 0.18)]
    dr = 0.7 if variant == 1 else 0.3
    for a, b in panes:
        mb.box((a, -0.34, 0.0), (b, -0.2, 0.52), "shopframe", faces="xXYZ")
        o = (a, b, 0.52, 2.78)
        frame_rect(mb, o, -0.29, 0.055, 0.07, "shopframe")
        glass_pane(mb, o, -0.27, "glass", 0.0, room)
        n = max(1, int((b - a) / 1.35))
        for k in range(1, n):
            x = a + (b - a) * k / n
            mb.box((x - 0.025, -0.28, 0.52), (x + 0.025, -0.22, 2.78), "shopframe", faces="xXY")
    # transom across the whole front
    tr = (0.18, W - 0.18, 2.86, top)
    mb.box((0.18, -0.34, 2.78), (W - 0.18, -0.2, 2.86), "shopframe", faces="YzZ")
    glass_pane(mb, tr, -0.28, "glass", 0.0, room)
    for k in range(1, 5):
        x = 0.18 + (W - 0.36) * k / 5
        mb.box((x - 0.02, -0.285, 2.86), (x + 0.02, -0.235, top), "shopframe", faces="xXY")
    # recessed door with push bar
    d0, d1 = door
    reveals(mb, (d0, d1, 0.0, 2.78), dr - 0.24, "shopframe", y=-0.24)
    frame_rect(mb, (d0, d1, 0.0, 2.72), -dr, 0.09, 0.05, "shopframe")
    glass_pane(mb, (d0 + 0.09, d1 - 0.09, 0.28, 2.63), -dr + 0.02, "glass", 0.0, room)
    mb.box((d0 + 0.09, -dr, 0.02), (d1 - 0.09, -dr + 0.04, 0.28), "shopframe", faces="Y")
    mb.tube([(d0 + 0.14, -dr + 0.11, 1.08), (d1 - 0.14, -dr + 0.11, 1.08)], 0.022, 6, "chrome")
    mb.quad((d0, -dr, 0.015), (d1, -dr, 0.015), (d1, -0.06, 0.015), (d0, -0.06, 0.015), "granite", normal=(0, 0, 1))
    return m


def shop_gate():
    """A closed roll-down security gate."""
    W, H = 4.0, 4.6
    m = Module("shopgate", W, H)
    mb = m.mb
    wall_front(mb, W, H, [(0.18, W - 0.18, 0.0, 4.32)])
    mb.box((0.0, 0.0, 0.0), (0.18, 0.06, 4.32), "wall", faces="xXY")
    mb.box((W - 0.18, 0.0, 0.0), (W, 0.06, 4.32), "wall", faces="xXY")
    mb.box((0.18, -0.2, 3.45), (W - 0.18, 0.04, 4.32), "shopframe", faces="YzZ")
    reveals(mb, (0.18, W - 0.18, 0.0, 3.45), 0.2, "shopframe")
    mb.box((0.18, -0.2, 3.1), (W - 0.18, -0.02, 3.45), "galvanized", faces="YzZ")
    z = 0.0
    while z < 3.08:
        mb.quad((0.18, -0.15, z), (W - 0.18, -0.15, z), (W - 0.18, -0.115, z + 0.05), (0.18, -0.115, z + 0.05), "galvanized",
                normal=(0, 1, -0.6))
        mb.quad((0.18, -0.115, z + 0.05), (W - 0.18, -0.115, z + 0.05), (W - 0.18, -0.15, z + 0.1), (0.18, -0.15, z + 0.1),
                "galvanized", normal=(0, 1, 0.6))
        z += 0.1
    return m


def lobby():
    W, H = 4.8, 6.0
    m = Module("lobby", W, H)
    mb = m.mb
    o = (0.45, W - 0.45, 0.0, 5.2)
    wall_front(mb, W, H, [o])
    reveals(mb, o, 0.7, "granite_black")
    glass_pane(mb, o, -0.66, "lobbyglass", 0.0)
    frame_rect(mb, o, -0.68, 0.08, 0.09, "bronze")
    for k in range(1, 4):
        x = o[0] + (o[1] - o[0]) * k / 4
        mb.box((x - 0.035, -0.67, 0.0), (x + 0.035, -0.59, 5.2), "bronze", faces="xXY")
    mb.box((o[0], -0.67, 2.9), (o[1], -0.58, 3.02), "bronze", faces="zZY")
    mb.box((0.2, 0.0, 5.28), (W - 0.2, 0.12, 5.55), "granite_black", faces="xXYzZ")
    mb.box((0.0, 0.0, 0.0), (0.45, 0.09, H), "granite", faces="xXY")
    mb.box((W - 0.45, 0.0, 0.0), (W, 0.09, H), "granite", faces="xXY")
    return m


# --------------------------------------------------------------------------- mid-distance chunks
def chunk(name, bay, floor, nb, nf, win, depth, glass="glass", pier=0.0, band=0.0, curtain_like=False):
    """nb x nf windows in one mesh for buildings that are never seen up close."""
    W, H = bay * nb, floor * nf
    m = Module(name, W, H)
    mb = m.mb
    if curtain_like:
        for i in range(nb):
            for j in range(nf):
                o = (i * bay, (i + 1) * bay, j * floor + 0.95, (j + 1) * floor)
                glass_pane(mb, o, -0.02, glass, (i * 3 + j * 7) % 16 / 16)
                glass_pane(mb, (i * bay, (i + 1) * bay, j * floor, j * floor + 0.95), -0.015, "spg")
        for i in range(nb):
            mb.box((i * bay - 0.035, -0.02, 0.0), (i * bay + 0.035, 0.03, H), "mullion", faces="xXY")
        for j in range(nf):
            mb.box((0.0, -0.02, j * floor - 0.03), (W, 0.03, j * floor + 0.03), "mullion", faces="zZY")
        return m
    ops = []
    for i in range(nb):
        for j in range(nf):
            cx = (i + 0.5) * bay
            ops.append((cx - win[0] / 2, cx + win[0] / 2, j * floor + win[2], j * floor + win[2] + win[1]))
    wall_front(mb, W, H, ops)
    for k, o in enumerate(ops):
        reveals(mb, o, depth)
        glass_pane(mb, o, -depth, glass, (k % 16) / 16)
        mid = (o[2] + o[3]) / 2
        mb.quad((o[0], -depth + 0.03, mid - 0.035), (o[1], -depth + 0.03, mid - 0.035), (o[1], -depth + 0.03, mid + 0.035),
                (o[0], -depth + 0.03, mid + 0.035), "frame", normal=(0, 1, 0))
        mb.box((o[0] - 0.06, -0.02, o[2] - 0.1), (o[1] + 0.06, 0.07, o[2]), "trim", faces="YzZ")
    if pier > 0:
        for i in range(nb + 1):
            x = i * bay
            mb.box((max(x - pier / 2, 0), 0.0, 0.0), (min(x + pier / 2, W), 0.12, H), "wall", faces="xXY")
    if band > 0:
        for j in range(nf):
            mb.box((0.0, 0.0, j * floor), (W, 0.07, j * floor + band), "trim", faces="YzZ")
    return m


def all_modules():
    mods = [prewar_single(), prewar_pair(), prewar_pair_key(), prewar_arch(), prewar_attic(), rusticated(),
            rusticated("rustblank", opening=None), deco(), deco("decon", W=1.45), postwar(), loft_wide(),
            curtain(), curtain("cwfin", fin=0.3), curtain("cwsplit", W=1.4, split=2.9), ribbon(), cast_iron(True),
            cast_iron(False), brownstone(False), brownstone(True), walkup(), blank_window(),
            storefront(0), storefront(1), storefront(2), shop_gate(), lobby()]
    mods += [
        chunk("ch_pw", 2.35, 3.5, 4, 3, (1.15, 1.9, 0.85), 0.2),
        chunk("ch_deco", 1.75, 3.5, 5, 3, (1.05, 2.15, 1.05), 0.18, pier=0.5),
        chunk("ch_pb", 3.1, 3.1, 3, 3, (2.3, 1.55, 0.92), 0.13),
        chunk("ch_loft", 3.4, 3.75, 3, 3, (2.75, 2.35, 0.75), 0.18, pier=0.35, band=0.18),
        chunk("ch_cw", 1.52, 4.0, 6, 3, None, 0.0, curtain_like=True),
        chunk("ch_wu", 2.35, 3.1, 4, 3, (1.05, 1.75, 0.78), 0.17, band=0.0),
        chunk("ch_ribbon", 3.0, 3.65, 3, 3, (3.0, 1.9, 1.35), 0.1, band=0.2),
    ]
    return {m.name: m for m in mods}
