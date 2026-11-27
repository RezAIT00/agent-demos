"""Assembles one building from facade modules, plus the geometry unique to it."""
import math

import numpy as np

import city as C
from meshlib import MeshBuilder

# face -> (outward normal, rightward direction as seen from outside, yaw of module +X)
FACES = {
    "S": ((-1, 0), (0, 1), 90.0),
    "N": ((1, 0), (0, -1), -90.0),
    "W": ((0, -1), (-1, 0), 180.0),
    "E": ((0, 1), (1, 0), 0.0),
}


def face_geom(rect, f):
    """Returns (left corner (x, y), length) for face f of rect (x0, x1, y0, y1)."""
    x0, x1, y0, y1 = rect
    if f == "S":
        return (x0, y0), y1 - y0
    if f == "N":
        return (x1, y1), y1 - y0
    if f == "W":
        return (x1, y0), x1 - x0
    return (x0, y1), x1 - x0


def pick(rng, items):
    return items[int(rng.integers(len(items)))]


# module name -> (width, height) as modelled
MOD = {"pw1": (2.2, 3.55), "pw2": (3.3, 3.55), "pw2k": (3.3, 3.55), "pwarch": (2.2, 3.8), "pwattic": (2.2, 3.1),
       "rust": (2.4, 3.6), "rustblank": (2.4, 3.6), "deco": (1.75, 3.5), "decon": (1.45, 3.5), "pb": (3.1, 3.1),
       "loft": (3.4, 3.75), "cw": (1.52, 4.0), "cwfin": (1.52, 4.0), "cwsplit": (1.4, 4.0), "ribbon": (3.0, 3.65),
       "ci": (2.3, 4.1), "ciflat": (2.3, 4.1), "bs": (2.1, 3.35), "bsp": (2.1, 4.1), "wu": (2.35, 3.1),
       "lotline": (2.6, 3.55),
       "ch_pw": (9.4, 10.5), "ch_deco": (8.75, 10.5), "ch_pb": (9.3, 9.3), "ch_loft": (10.2, 11.25),
       "ch_cw": (9.12, 12.0), "ch_wu": (9.4, 9.3), "ch_ribbon": (9.0, 10.95)}


def make_style(name, rng):
    """A concrete material and module choice for one building."""
    frames = ["paint_black", "paint_darkgreen", "paint_white", "paint_darkgray", "paint_brown", "paint_cream", "bronze"]
    s = dict(kind=name, base=None, base_floors=0, top=None, cornice="classic", pier=(0.4, 1.1), bulk="brick_brown",
             tank=0.65, ac=0.0, escapes=0.0, party="brick_brown", chunk="ch_pw", ground="shops", crown=False)
    o = {}
    if name == "stone":
        wall = pick(rng, ["limestone", "limestone", "limestone_dark", "terracotta", "terracotta_white", "marble"])
        s.update(mod=pick(rng, ["pw1", "pw1", "pw2", "pw2k"]), base="rust", base_floors=int(rng.integers(1, 3)),
                 top=pick(rng, ["pwarch", "pwattic", None]), ac=0.07, chunk="ch_pw",
                 party=pick(rng, ["brick_buff", "brick_brown", "brick_gray"]))
        o = {"wall": wall, "trim": "limestone_trim", "frame": pick(rng, frames),
             "glass": pick(rng, ["glass_office", "glass_office", "glass_home"])}
    elif name == "brick":
        wall = pick(rng, ["brick_buff", "brick_buff", "brick_brown", "brick_red", "brick_gray", "brick_white"])
        s.update(mod=pick(rng, ["pw1", "pw2", "pw1"]), base="rust", base_floors=int(rng.integers(1, 3)),
                 top=pick(rng, ["pwarch", "pwattic", None, None]), ac=0.12, chunk="ch_pw",
                 party=pick(rng, [wall, "brick_brown", "brick_red"]))
        o = {"wall": wall, "trim": pick(rng, ["limestone_trim", "terracotta", "limestone_trim", "brownstone"]),
             "frame": pick(rng, frames), "glass": pick(rng, ["glass_office", "glass_home"])}
    elif name == "deco":
        wall = pick(rng, ["limestone", "brick_buff", "brick_white", "terracotta_white", "brick_gray", "limestone"])
        s.update(mod=pick(rng, ["deco", "deco", "decon"]), base="rust", base_floors=1, cornice="deco", pier=(0.5, 1.2),
                 chunk="ch_deco", tank=0.45, ac=0.03, party=wall)
        o = {"wall": wall, "trim": "limestone_trim", "frame": pick(rng, ["paint_black", "paint_darkgreen", "anodized_bronze", "anodized"]),
             "spandrel": pick(rng, ["terracotta", "bronze", "paint_darkgray", "aluminium", "brick_brown", "paint_darkgreen"]),
             "glass": "glass_office"}
    elif name == "glass":
        tone = pick(rng, ["curtain_blue", "curtain_dark", "curtain_green", "curtain_silver", "curtain_clear", "curtain_bronze", "curtain_blue", "curtain_dark"])
        spg = {"curtain_blue": "spandrel_blue", "curtain_clear": "spandrel_blue"}.get(tone, "spandrel_dark")
        mull = "anodized_bronze" if tone == "curtain_bronze" else pick(rng, ["anodized", "paint_black", "anodized", "paint_darkgray"])
        s.update(mod=pick(rng, ["cw", "cw", "cwfin", "cwsplit"]), cornice=None, pier=(0.05, 0.12), chunk="ch_cw", tank=0.0,
                 party="concrete_panel", ground="lobby", bulk="paint_gray")
        o = {"glass": tone, "spg": spg, "mullion": mull, "frame": mull, "wall": "aluminium", "trim": "aluminium"}
    elif name == "ribbon":
        s.update(mod="ribbon", cornice="coping", pier=(0.2, 0.6), chunk="ch_ribbon", tank=0.15, party="concrete_panel",
                 ground="lobby", bulk="concrete")
        wall = pick(rng, ["concrete_light", "brick_white", "concrete_panel", "brick_buff", "paint_darkgray"])
        o = {"wall": wall, "trim": pick(rng, ["concrete_light", "aluminium"]), "mullion": pick(rng, ["anodized", "paint_black"]),
             "glass": pick(rng, ["curtain_dark", "glass_office", "curtain_bronze"])}
    elif name == "postwar":
        wall = pick(rng, ["brick_white", "brick_white", "brick_buff", "brick_red", "brick_brown"])
        s.update(mod="pb", cornice="coping", pier=(0.4, 1.4), chunk="ch_pb", tank=0.5, ac=0.3, party=wall)
        o = {"wall": wall, "trim": "concrete_light", "frame": pick(rng, ["anodized", "paint_darkgray", "paint_white"]), "glass": "glass_home"}
    elif name == "loft":
        wall = pick(rng, ["brick_buff", "brick_red", "brick_brown", "terracotta", "limestone_dark", "brick_gray"])
        s.update(mod="loft", base="rust", base_floors=1, top=pick(rng, [None, "pwarch"]), pier=(0.5, 1.0), chunk="ch_loft",
                 ac=0.05, escapes=0.15, party=wall, tank=0.8)
        o = {"wall": wall, "trim": pick(rng, ["limestone_trim", "terracotta"]), "frame": pick(rng, ["paint_black", "paint_darkgreen", "paint_darkgray", "paint_burgundy"]), "glass": "glass_office"}
    elif name == "castiron":
        paint = pick(rng, ["paint_cream", "paint_white", "paint_gray", "paint_darkgreen", "paint_cream"])
        s.update(mod=pick(rng, ["ci", "ci", "ciflat"]), pier=(0.25, 0.45), chunk="ch_loft", escapes=0.6, tank=0.55,
                 cornice="bracket", party="brick_red")
        o = {"wall": paint, "trim": paint, "frame": pick(rng, ["paint_black", "paint_darkgray", "paint_white"]), "glass": pick(rng, ["glass_office", "glass_home"])}
    elif name == "brownstone":
        wall = pick(rng, ["brownstone", "brownstone", "brownstone_dark", "brick_red", "brownstone", "limestone_dark"])
        s.update(mod="bs", base="bsp", base_floors=1, cornice="bracket", pier=(0.12, 0.3), chunk="ch_wu", ground="stoop",
                 tank=0.04, ac=0.18, party="brick_red")
        o = {"wall": wall, "trim": pick(rng, ["brownstone_dark", "brownstone", "limestone_dark"]), "frame": pick(rng, ["paint_black", "paint_white", "paint_darkgreen", "paint_brown"]), "glass": "glass_home"}
    elif name == "walkup":
        wall = pick(rng, ["brick_red", "brick_red", "brick_brown", "brick_buff", "stucco_tint", "brick_white"])
        s.update(mod="wu", cornice="bracket", pier=(0.2, 0.55), chunk="ch_wu", escapes=0.9, tank=0.28, ac=0.3, party="brick_red")
        o = {"wall": wall, "trim": pick(rng, ["limestone_trim", "brownstone", "paint_cream", "paint_darkgreen"]), "frame": pick(rng, ["paint_white", "paint_black", "paint_darkgray"]), "glass": "glass_home"}
    else:
        raise ValueError(name)
    s["o"] = o
    s["tint"] = tuple(float(x) for x in np.clip(rng.normal(1.0, 0.055) + rng.normal(0, 0.022, 3), 0.84, 1.14))
    return s


def ov(o, extra=None):
    d = dict(o)
    d.update(extra or {})
    return ";".join("%s=%s" % kv for kv in sorted(d.items()))


class Building:
    def __init__(self, city, rect, height, style, street_faces, detail=0, tiers=None, name="", signs=True, clutter=True):
        self.c = city
        self.rect = rect
        self.h = height
        self.s = style
        self.street = set(street_faces)
        self.detail = detail
        self.tiers = tiers or [(rect, 0.0, height)]
        self.name = name
        self.signs = signs
        self.clutter = clutter

    # ------------------------------------------------------------------ helpers
    def sh(self, rect=None):
        r = rect or self.rect
        return self.c.shell((r[0] + r[1]) / 2, (r[2] + r[3]) / 2)

    def mat(self, key, default):
        return self.s["o"].get(key, default)

    def occluded_height(self, rect, f):
        """Height up to which a neighbour hides this lot-line face."""
        x0, x1, y0, y1 = rect
        (lx, ly), L = face_geom(rect, f)
        nx, ny = FACES[f][0]
        cover = []
        for (r, h) in self.c.footprints:
            if r == self.rect:
                continue
            if f in ("S", "N"):
                edge = x0 if f == "S" else x1
                other = r[1] if f == "S" else r[0]
                lo, hi = max(y0, r[2]), min(y1, r[3])
            else:
                edge = y0 if f == "W" else y1
                other = r[3] if f == "W" else r[2]
                lo, hi = max(x0, r[0]), min(x1, r[1])
            if abs(other - edge) < 0.8 and hi - lo > 0:
                cover.append((hi - lo, h))
        total = sum(c[0] for c in cover)
        if total < 0.75 * L:
            return 0.0
        return min(h for w, h in cover if w > 0.5)

    # ------------------------------------------------------------------ facades
    def bays(self, L, mod, pier):
        w = MOD[mod][0]
        usable = max(L - 2 * pier, w * 0.75)
        n = max(1, int(round(usable / w)))
        sx = usable / (n * w)
        return n, sx, (L - n * w * sx) / 2

    def band(self, rect, f, z0, z1, mod, floor_h, pier, ac=0.0, escapes=False):
        """Rows of one module across a face between z0 and z1."""
        c = self.c
        (lx, ly), L = face_geom(rect, f)
        n_, r, yaw = FACES[f]
        if L < 1.2 or z1 - z0 < 1.5:
            return
        nf = max(1, int(round((z1 - z0) / floor_h)))
        fh = (z1 - z0) / nf
        n, sx, p = self.bays(L, mod, pier)
        mw, mh = MOD[mod]
        sh = self.sh(rect)
        wall = self.mat("wall", "limestone")
        if p > 0.02:
            for a, b in ((0.0, p), (L - p, L)):
                q = [(lx + r[0] * a, ly + r[1] * a), (lx + r[0] * b, ly + r[1] * b)]
                sh.quad((q[0][0], q[0][1], z0), (q[1][0], q[1][1], z0), (q[1][0], q[1][1], z1), (q[0][0], q[0][1], z1),
                        wall, normal=(n_[0], n_[1], 0), color=(1, 1, 1, 1))
        override = ov(self.s["o"])
        for j in range(nf):
            z = z0 + j * fh
            for i in range(n):
                a = p + i * mw * sx
                pos = (lx + r[0] * a, ly + r[1] * a, z)
                c.inst(mod, pos, yaw, (sx, 1.0, fh / mh), tint=self.s["tint"], override=override)
                if ac > 0 and self.detail == 0 and z > 4.0 and c.rng.random() < ac:
                    wx = a + mw * sx * 0.5 + (0.0 if mod not in ("pw2", "pw2k") else mw * sx * (0.21 if c.rng.random() < 0.5 else -0.21))
                    c.inst("acunit", (lx + r[0] * wx + n_[0] * 0.03, ly + r[1] * wx + n_[1] * 0.03, z + 0.86 * fh / mh), yaw)
        if escapes and n >= 2 and nf >= 2:
            starts = [int(c.rng.integers(0, n - 1))]
            if n >= 6:
                starts = [1, n - 3]
            for s0 in starts:
                cx = p + (s0 + 1) * mw * sx
                width = 2 * mw * sx * 0.96
                for j in range(0, nf):
                    z = z0 + j * fh + 0.06
                    if z < 3.4:
                        continue
                    m = "fireescape_bot" if (j == 0 or z - fh < 3.4) else "fireescape"
                    c.inst(m, (lx + r[0] * cx + n_[0] * 0.02, ly + r[1] * cx + n_[1] * 0.02, z), yaw, (width / 4.4, 1.0, 1.0))

    def chunks(self, rect, f, z0, z1):
        c = self.c
        (lx, ly), L = face_geom(rect, f)
        n_, r, yaw = FACES[f]
        if L < 1.5 or z1 - z0 < 2.0:
            return
        mod = self.s["chunk"]
        mw, mh = MOD[mod]
        cols = max(1, int(round(L / mw)))
        rows = max(1, int(round((z1 - z0) / mh)))
        sx, sz = L / (cols * mw), (z1 - z0) / (rows * mh)
        override = ov(self.s["o"])
        for j in range(rows):
            for i in range(cols):
                a = i * mw * sx
                c.inst(mod, (lx + r[0] * a, ly + r[1] * a, z0 + j * mh * sz), yaw, (sx, 1.0, sz), tint=self.s["tint"], override=override)

    def blank(self, rect, f, z0, z1, windows=True):
        """Party wall: plain brick, with the odd lot-line window and sometimes a faded painted sign."""
        c = self.c
        (lx, ly), L = face_geom(rect, f)
        n_, r, yaw = FACES[f]
        if z1 - z0 < 0.3:
            return
        sh = self.sh(rect)
        party = self.s["party"]
        columns = []
        if windows and self.detail == 0 and z1 - z0 > 9 and L > 9 and c.rng.random() < 0.55:
            k = int(c.rng.integers(1, 3))
            slots = int(L // 2.6)
            if slots > 2:
                columns = sorted(set(int(c.rng.integers(1, slots - 1)) for _ in range(k)))
        fh = 3.55
        nf = int((z1 - z0) // fh)
        edges = [0.0]
        for col in columns:
            a = col * 2.6
            edges += [a, a + 2.6]
        edges.append(L)

        def wq(a, b, za, zb):
            if b - a < 0.02 or zb - za < 0.02:
                return
            p0 = (lx + r[0] * a, ly + r[1] * a)
            p1 = (lx + r[0] * b, ly + r[1] * b)
            sh.quad((p0[0], p0[1], za), (p1[0], p1[1], za), (p1[0], p1[1], zb), (p0[0], p0[1], zb), party, normal=(n_[0], n_[1], 0))

        for i in range(0, len(edges) - 1, 2):
            wq(edges[i], edges[i + 1], z0, z1)
        over = ov({"wall": party, "trim": "concrete", "frame": "paint_darkgray", "glass": "glass_home"})
        for col in columns:
            a = col * 2.6
            for j in range(nf):
                c.inst("lotline", (lx + r[0] * a, ly + r[1] * a, z0 + j * fh), yaw, (1, 1, 1), tint=self.s["tint"], override=over)
            wq(a, a + 2.6, z0 + nf * fh, z1)
        if self.signs and self.detail == 0 and not columns and z1 - z0 > 8 and L > 8 and c.rng.random() < 0.3:
            w = min(L - 1.5, 9.0)
            hh = w * 0.62
            if z1 - z0 > hh + 1.5:
                a = (L - w) / 2
                zc = z1 - hh - 1.0
                c.inst("ghostquad", (lx + r[0] * a + n_[0] * 0.03, ly + r[1] * a + n_[1] * 0.03, zc), yaw, (w / 4.0, 1, hh / 2.5),
                       custom=(float(c.rng.integers(8)), 1.0, 0.0, float(c.rng.random())), shadow=False, rt=False)

    # ------------------------------------------------------------------ ground floor
    def ground_shops(self, rect, f, gh):
        c = self.c
        (lx, ly), L = face_geom(rect, f)
        n_, r, yaw = FACES[f]
        if L < 3.0:
            return
        n = max(1, int(round(L / 4.4)))
        sx = L / (n * 4.0)
        over_base = dict(self.s["o"])
        lobby_at = int(c.rng.integers(n)) if (self.s["ground"] == "lobby" or (n >= 4 and c.rng.random() < 0.55)) else -1
        for i in range(n):
            a = i * 4.0 * sx
            pos = (lx + r[0] * a, ly + r[1] * a, 0.0)
            mid = a + 2.0 * sx
            cx, cy = lx + r[0] * mid, ly + r[1] * mid
            if i == lobby_at or (self.s["ground"] == "lobby" and n >= 3 and c.rng.random() < 0.55):
                sxl = 4.0 * sx / 4.8
                c.inst("lobby", pos, yaw, (sxl, 1, gh / 6.0), tint=self.s["tint"],
                       override=ov(over_base, {"lobbyglass": "glass_lobby", "wall": self.mat("wall", "granite")}))
                if i == lobby_at:
                    c.inst("awning_flat", (cx, cy, min(3.6, gh - 1.0)), yaw - 90 + 90, (3.4 / 3.6, 1.3, 1.0),
                           override="awning=bronze", shadow=True)
                    self.cover_front(cx, cy, n_, r, 1.7, 1.9, 3.5)
                if self.detail == 0:
                    c.light((cx + n_[0] * 0.5, cy + n_[1] * 0.5, 3.2), (n_[0], n_[1], -1.1), (1.0, 0.82, 0.58), 1600, 12, -1,
                            C.LK_LOBBY, shadows=False, rect=(220, 60), volumetric=0.5)
                continue
            shutter = c.rng.random() < 0.07
            variant = "shopgate" if shutter else "shop%d" % int(c.rng.integers(3))
            frame = pick(c.rng, ["paint_black", "paint_black", "paint_darkgreen", "bronze", "paint_darkgray", "paint_burgundy", "paint_white", "anodized", "paint_navy"])
            c.inst(variant, pos, yaw, (sx, 1.0, gh / 4.6), tint=self.s["tint"],
                   override=ov(over_base, {"glass": "glass_shop", "shopframe": frame}))
            if self.signs:
                idx = float(c.rng.integers(48))
                zs = 3.5 * gh / 4.6
                c.inst("signquad", (lx + r[0] * (a + 0.25 * sx) + n_[0] * 0.075, ly + r[1] * (a + 0.25 * sx) + n_[1] * 0.075, zs), yaw,
                       (sx * 3.5 / 4.0, 1.0, gh / 4.6 * 0.76 / 1.0), custom=(idx, 1.0, 0.0, float(c.rng.random())), shadow=False)
            awn = c.rng.random()
            if not shutter and awn < (0.34 if self.detail == 0 else 0.2):
                fab = pick(c.rng, ["fabric_green", "fabric_red", "fabric_navy", "fabric_black", "fabric_cream", "fabric_stripe", "fabric_green", "fabric_black"])
                c.inst("awning", (cx, cy, 3.4 * gh / 4.6), yaw, (sx * 0.95, 1.0, 1.0), override="awning=" + fab)
                self.cover_front(cx, cy, n_, r, 1.9 * sx, 1.2, 3.25 * gh / 4.6)
                if self.detail == 0:
                    for k in range(5):
                        t = -1.7 * sx + 0.85 * sx * k + c.rng.uniform(-0.2, 0.2)
                        c.drips.append((cx + r[0] * t + n_[0] * 1.16, cy + r[1] * t + n_[1] * 1.16, 2.45 * gh / 4.6))
            if not shutter and self.detail == 0 and self.near_hero(cx, cy):
                warm = pick(c.rng, [(1.0, 0.78, 0.52), (1.0, 0.86, 0.66), (0.9, 0.94, 1.0), (1.0, 0.72, 0.45)])
                c.light((cx + n_[0] * 0.35, cy + n_[1] * 0.35, 2.75 * gh / 4.6), (n_[0], n_[1], -0.75), warm,
                        float(c.rng.uniform(700, 1500)), 11, -1, C.LK_SHOP, shadows=False,
                        rect=(260 * sx, 120), volumetric=0.4)

    def near_hero(self, x, y):
        return (-340 < x < 190 and -340 < y < 520) or (-720 < x <= -340 and -90 < y < 90)

    def cover_front(self, cx, cy, n_, r, half, proj, z):
        pts = [(cx + r[0] * s + n_[0] * d, cy + r[1] * s + n_[1] * d) for s in (-half, half) for d in (0.0, proj)]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        self.c.add_cover(min(xs), max(xs), min(ys), max(ys), z)

    def stoop(self, rect, f, gh):
        """Brownstone front: raised parlour floor, stone stoop, iron rails, garden-level windows."""
        c = self.c
        (lx, ly), L = face_geom(rect, f)
        n_, r, yaw = FACES[f]
        sh = self.sh(rect)
        trim = self.mat("trim", "brownstone_dark")
        wall = self.mat("wall", "brownstone")
        mb = MeshBuilder()
        W = L
        door_x = W * 0.24
        # garden level: wall with two barred windows
        ops = []
        x = W * 0.5
        while x + 1.1 < W - 0.3:
            ops.append((x, x + 1.0, 0.45, 1.35))
            x += 1.8
        import kits
        kits.wall_front(mb, W, gh, ops, slot=wall)
        for o in ops:
            kits.reveals(mb, o, 0.2, wall)
            kits.glass_pane(mb, o, -0.17, "glass_home")
            for k in range(1, 8):
                bx = o[0] + (o[1] - o[0]) * k / 8
                mb.box((bx - 0.01, -0.02, o[2]), (bx + 0.01, 0.0, o[3]), "iron_black", faces="xXY")
        mb.box((0.0, 0.0, gh - 0.16), (W, 0.09, gh), trim, faces="YzZ")
        # stoop
        steps = 8
        run, rise = 0.28, gh / (steps + 0.0)
        sw = 1.45
        for i in range(steps):
            z1 = gh - rise * i
            y0 = 0.5 + run * i
            mb.box((door_x - sw / 2, y0 - (0.5 if i == 0 else 0.0), 0.0), (door_x + sw / 2, y0 + run, z1 - 0.02), wall, faces="xXYZ", slots={"Z": trim})
        for s in (-1, 1):
            xr = door_x + s * (sw / 2 + 0.06)
            mb.tube([(xr, 0.05, gh + 0.92), (xr, 0.55, gh + 0.9), (xr, 0.5 + run * steps, rise + 0.9)], 0.035, 6, "iron_black")
            for i in range(steps + 1):
                y = 0.55 + run * i * 0.98
                z = gh - rise * i
                mb.box((xr - 0.012, y - 0.012, max(z - rise, 0)), (xr + 0.012, y + 0.012, z + 0.9), "iron_black", faces="xXyY")
            mb.box((xr - 0.09, 0.5 + run * steps - 0.09, 0), (xr + 0.09, 0.5 + run * steps + 0.09, 1.15), trim)
        # front fence round the areaway
        y = 1.6
        x = door_x + sw / 2 + 0.2
        mb.tube([(x, y, 0.95), (W - 0.1, y, 0.95)], 0.025, 5, "iron_black")
        while x < W - 0.1:
            mb.box((x - 0.01, y - 0.01, 0), (x + 0.01, y + 0.01, 1.05), "iron_black", faces="xXyY")
            x += 0.14
        # entrance door in the parlour floor
        mb.box((door_x - 0.68, 0.0, gh), (door_x + 0.68, 0.1, gh + 3.0), trim, faces="xXY")
        mb.box((door_x - 0.52, 0.1, gh), (door_x + 0.52, 0.13, gh + 2.55), pick(c.rng, ["paint_black", "paint_burgundy", "paint_darkgreen", "paint_navy", "wood"]), faces="xXY")
        kits.glass_pane(mb, (door_x - 0.3, door_x + 0.3, gh + 1.45, gh + 2.25), 0.14, "glass_home")
        mb.box((door_x - 0.85, 0.0, gh + 3.0), (door_x + 0.85, 0.34, gh + 3.16), trim)
        mb.sphere((door_x + 0.64, 0.2, gh + 2.2), 0.07, "porch_light", segments=8, rings=5)
        origin = (lx, ly, 0.0)
        sh.merge(mb, offset=origin, yaw=yaw)
        # parlour floor windows beside the door
        px = door_x + 0.8
        if W - px > 1.6:
            n = max(1, int(round((W - px - 0.15) / 2.1)))
            sx = (W - px - 0.15) / (n * 2.1)
            for i in range(n):
                a = px + i * 2.1 * sx
                c.inst("bsp", (lx + r[0] * a, ly + r[1] * a, gh), yaw, (sx, 1.0, 1.0), tint=self.s["tint"], override=ov(self.s["o"]))
            sh_end = px + n * 2.1 * sx
        else:
            sh_end = px
        # solid wall around the door bay and the end pier
        def wq(a, b, za, zb):
            if b - a < 0.02:
                return
            sh.quad((lx + r[0] * a, ly + r[1] * a, za), (lx + r[0] * b, ly + r[1] * b, za), (lx + r[0] * b, ly + r[1] * b, zb),
                    (lx + r[0] * a, ly + r[1] * a, zb), wall, normal=(n_[0], n_[1], 0))
        wq(0.0, px, gh, gh + 4.1)
        wq(sh_end, L, gh, gh + 4.1)

    # ------------------------------------------------------------------ roof and trim
    def cornice(self, rect, z, kind, faces):
        if not faces or kind is None:
            return
        c = self.c
        sh = self.sh(rect)
        x0, x1, y0, y1 = rect
        trim = self.mat("trim", "limestone_trim")
        prof = {
            "classic": [(0.0, -1.05), (0.12, -1.05), (0.12, -0.8), (0.2, -0.76), (0.2, -0.5), (0.62, -0.4), (0.66, -0.16), (0.82, -0.04), (0.82, 0.06), (0.0, 0.1)],
            "bracket": [(0.0, -0.95), (0.07, -0.95), (0.07, -0.34), (0.42, -0.24), (0.46, -0.04), (0.54, 0.04), (0.54, 0.1), (0.0, 0.16)],
            "coping": [(0.0, -0.28), (0.07, -0.28), (0.07, 0.06), (0.0, 0.1)],
            "deco": [(0.0, -0.6), (0.08, -0.6), (0.08, -0.34), (0.16, -0.3), (0.16, -0.04), (0.1, 0.06), (0.0, 0.08)],
            "string": [(0.0, -0.3), (0.09, -0.29), (0.13, -0.1), (0.26, -0.05), (0.26, 0.06), (0.0, 0.1)],
        }[kind]
        slot = trim if kind != "bracket" else pick(c.rng, [trim, "paint_darkgreen", "paint_brown", "paint_cream", "copper_green"]) if "cslot" not in self.s else self.s["cslot"]
        if kind == "bracket" and "cslot" not in self.s:
            self.s["cslot"] = slot
        if set(faces) == set("SNWE"):
            sh.sweep(prof, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], slot, closed=True, z=z)
        else:
            for f in faces:
                (lx, ly), L = face_geom(rect, f)
                n_, r, yaw = FACES[f]
                pts = [(lx, ly), (lx + r[0] * L, ly + r[1] * L)]
                # open paths: order points so that "out" is the face normal
                d = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
                if (d[1], -d[0]) != (0, 0) and (d[1] * n_[0] - d[0] * n_[1]) < 0:
                    pts = pts[::-1]
                sh.sweep(prof, pts, slot, closed=False, z=z)
        if self.detail == 0:
            for f in faces:
                (lx, ly), L = face_geom(rect, f)
                n_, r, yaw = FACES[f]
                if kind == "classic":
                    a = 0.25
                    while a < L - 0.2:
                        c.inst("dentil", (lx + r[0] * a + n_[0] * 0.12, ly + r[1] * a + n_[1] * 0.12, z - 0.66), yaw, tint=self.s["tint"], override="trim=" + slot, shadow=False, rt=False)
                        a += 0.34
                    a = 0.5
                    while a < L - 0.4:
                        c.inst("bracket", (lx + r[0] * a + n_[0] * 0.12, ly + r[1] * a + n_[1] * 0.12, z - 1.02), yaw, (0.8, 1.15, 0.9), tint=self.s["tint"], override="trim=" + slot, rt=False)
                        a += 1.9
                elif kind == "bracket":
                    a = 0.2
                    while a < L - 0.15:
                        c.inst("bracket", (lx + r[0] * a + n_[0] * 0.06, ly + r[1] * a + n_[1] * 0.06, z - 0.9), yaw, (1.0, 0.95, 1.0), tint=self.s["tint"], override="trim=" + slot, rt=False)
                        a += 1.05
                elif kind == "deco":
                    w = MOD[self.s["mod"]][0]
                    n, sx, p = self.bays(L, self.s["mod"], self.s["_pier"])
                    for i in range(n + 1):
                        a = p + i * w * sx
                        big = (i % 3 == 0)
                        hh = 1.9 if big else 1.0
                        q = MeshBuilder()
                        q.box((-0.17, -0.1, -0.7), (0.17, 0.2, hh * 0.7), self.mat("wall", "limestone"))
                        q.box((-0.1, -0.06, hh * 0.7), (0.1, 0.13, hh), trim)
                        sh.merge(q, offset=(lx + r[0] * a, ly + r[1] * a, z), yaw=yaw)

    def parapet(self, rect, z, h=1.05, slot=None):
        sh = self.sh(rect)
        x0, x1, y0, y1 = rect
        wall = slot or self.s["party"]
        t = 0.32
        for lo, hi in (((x0, y0, z), (x0 + t, y1, z + h)), ((x1 - t, y0, z), (x1, y1, z + h)),
                       ((x0 + t, y0, z), (x1 - t, y0 + t, z + h)), ((x0 + t, y1 - t, z), (x1 - t, y1, z + h))):
            sh.box(lo, hi, wall, faces="xXyYZ", slots={"Z": "concrete"})
        sh.quad((x0 + t, y0 + t, z + 0.03), (x1 - t, y0 + t, z + 0.03), (x1 - t, y1 - t, z + 0.03), (x0 + t, y1 - t, z + 0.03), "roof", normal=(0, 0, 1))

    def roof_clutter(self, rect, z, inner=None, top=True):
        c = self.c
        if not self.clutter:
            return
        x0, x1, y0, y1 = rect
        w, d = x1 - x0, y1 - y0
        if w < 4 or d < 4:
            return

        def spot(margin):
            for _ in range(12):
                px = c.rng.uniform(x0 + margin, x1 - margin) if w > 2 * margin else (x0 + x1) / 2
                py = c.rng.uniform(y0 + margin, y1 - margin) if d > 2 * margin else (y0 + y1) / 2
                if inner and inner[0] - margin < px < inner[1] + margin and inner[2] - margin < py < inner[3] + margin:
                    continue
                return px, py
            return None

        area = w * d
        if top:
            p = spot(2.6)
            if p:
                c.inst("bulkhead", (p[0], p[1], z), float(c.rng.integers(4)) * 90, (min(1.0, w / 8), min(1.0, d / 8), 1.0),
                       override="bulk=" + self.s["bulk"] if self.s["bulk"] != "brick_brown" else "bulk=" + self.s["party"])
            if c.rng.random() < self.s["tank"] and 12 < z < 150 and min(w, d) > 6:
                p = spot(2.4)
                if p:
                    sc = float(c.rng.uniform(0.82, 1.18))
                    lift = float(c.rng.choice([0.0, 0.0, 1.6, 3.0]))
                    c.inst("watertower", (p[0], p[1], z + lift), float(c.rng.uniform(0, 360)), (sc, sc, sc))
                    if lift > 0:
                        self.sh(rect).box((p[0] - 1.7 * sc, p[1] - 1.7 * sc, z), (p[0] + 1.7 * sc, p[1] + 1.7 * sc, z + lift), self.s["party"], faces="xXyYZ", slots={"Z": "roof"})
        n = int(min(9, area / 90)) + int(c.rng.integers(0, 3)) if top else int(c.rng.integers(0, 3))
        for _ in range(n):
            p = spot(1.8)
            if not p:
                continue
            kind = pick(c.rng, ["hvac0", "hvac0", "hvac1", "hvac2", "vents", "vents", "skylight"])
            if self.s["kind"] in ("brownstone", "walkup"):
                kind = pick(c.rng, ["chimney", "chimney", "vents", "skylight", "hvac1"])
            c.inst(kind, (p[0], p[1], z), float(c.rng.integers(4)) * 90, float(c.rng.uniform(0.8, 1.2)), rt=self.detail == 0)
        if top and c.rng.random() < 0.22:
            p = spot(1.0)
            if p:
                c.inst("antenna", (p[0], p[1], z), float(c.rng.uniform(0, 360)), float(c.rng.uniform(0.8, 1.7)), rt=False)

    # ------------------------------------------------------------------ build
    def build(self):
        o = self.s["o"]
        mod = MOD[self.s["mod"]]
        token = self.c.begin(kind="building", name=self.name, rect=[float(v) for v in self.rect], h=float(self.h),
                             style=self.s["kind"], wall=o.get("wall", self.s.get("party", "limestone")),
                             trim=o.get("trim", "limestone_trim"), glass=o.get("glass", "glass_office"),
                             frame=o.get("frame", "paint_black"), party=self.s["party"], fh=float(mod[1]), bay=float(mod[0]),
                             tiers=[[float(q) for q in list(r) + [a, b]] for r, a, b in self.tiers])
        self._build()
        self.c.end(token)

    def _build(self):
        c = self.c
        s = self.s
        floor_h = MOD[s["mod"]][1]
        pier = float(c.rng.uniform(*s["pier"]))
        s["_pier"] = pier
        gh = {"stoop": 1.75, "lobby": 5.6, "shops": 4.8}.get(s["ground"], 0.0)
        if s["ground"] == "shops":
            gh = float(c.rng.uniform(4.4, 5.2))
        gh = min(gh, self.h * 0.5)
        for ti, (rect, z0, z1) in enumerate(self.tiers):
            is_top = ti == len(self.tiers) - 1
            for f in "SNWE":
                (lx, ly), L = face_geom(rect, f)
                on_lot_edge = abs(face_geom(rect, f)[0][0 if f in "SN" else 1] - face_geom(self.rect, f)[0][0 if f in "SN" else 1]) < 0.3
                street = f in self.street or not on_lot_edge
                za = z0
                if not street:
                    occ = self.occluded_height(rect, f)
                    za = max(z0, occ)
                    if za >= z1 - 0.5:
                        continue
                    if self.detail == 0 or occ > 0:
                        self.blank(rect, f, za, z1)
                    else:
                        self.chunks(rect, f, za, z1)
                    continue
                if ti == 0 and f in self.street and gh > 0:
                    if s["ground"] == "stoop":
                        self.stoop(rect, f, gh)
                    else:
                        self.ground_shops(rect, f, gh)
                    za = gh + (4.1 if s["ground"] == "stoop" else 0.0)
                    if z1 - za < 2.0:
                        continue
                elif ti == 0 and gh > 0:
                    self.blank(rect, f, 0.0, gh, windows=False)
                    za = gh
                if self.detail > 0:
                    self.chunks(rect, f, za, z1)
                    continue
                if ti == 0 and s["base"] and s["ground"] != "stoop" and z1 - za > 12:
                    bh = s["base_floors"] * 3.7
                    base_over = dict(s["o"])
                    self.band(rect, f, za, za + bh, s["base"], 3.7, pier * 0.8)
                    za += bh
                    if f in self.street:
                        self.cornice(rect, za + 0.02, "string", [f])
                top_h = 0.0
                if is_top and s["top"] and z1 - za > floor_h * 3:
                    top_h = MOD[s["top"]][1]
                    self.band(rect, f, z1 - top_h - 0.9, z1 - 0.9, s["top"], top_h, pier)
                    if f in self.street:
                        self.cornice(rect, z1 - top_h - 0.9, "string", [f])
                    (lx2, ly2), L2 = face_geom(rect, f)
                    n_, r, yaw = FACES[f]
                    self.sh(rect).quad((lx2, ly2, z1 - 0.9), (lx2 + r[0] * L2, ly2 + r[1] * L2, z1 - 0.9),
                                       (lx2 + r[0] * L2, ly2 + r[1] * L2, z1), (lx2, ly2, z1), s["o"].get("wall", "limestone"),
                                       normal=(n_[0], n_[1], 0))
                    top_h += 0.9
                esc = f in self.street and c.rng.random() < s["escapes"] and ti == 0
                self.band(rect, f, za, z1 - top_h, s["mod"], floor_h, pier, ac=s["ac"], escapes=esc)
            # trim, parapet and roof
            vis = [f for f in "SNWE" if f in self.street or abs(face_geom(rect, f)[0][0 if f in "SN" else 1] - face_geom(self.rect, f)[0][0 if f in "SN" else 1]) > 0.3]
            if s["cornice"]:
                self.cornice(rect, z1, s["cornice"], vis)
            if s["kind"] == "glass":
                self.parapet(rect, z1, 1.4, "spandrel_dark")
            else:
                self.parapet(rect, z1, 1.05 if s["cornice"] not in ("classic", "bracket") else 0.7)
            inner = self.tiers[ti + 1][0] if not is_top else None
            self.roof_clutter(rect, z1 + 0.03, inner, top=is_top)
        c.footprints.append((self.rect, self.h))
