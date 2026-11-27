"""Winter New Yorkers, built from distance fields.

  python source/gen/walker_bodies.py build/walkers [variant ids...]

Writes <out>/meshes/walker_<vv>_l<k>.nmesh (four levels of detail per body), the hand-held props,
<out>/manifest.json for the importer and <out>/walkers.json (skeletons, palettes, styling) which the
C++ walker system reads at run time.

Units are centimetres.  +X forward, +Y right (left limbs are at -Y), feet flat on z = 0.

Vertex encoding (read by Walker.ush):
  UV0.x  = bone0 + 32 * bone1 + 1024 * bone2        UV0.y = part + 32 * fabric
  UV1    = (weight0, weight1)                       weight2 = 1 - weight0 - weight1
  colour = (baked ambient occlusion, detail mask, 0, 1)
"""
import json
import math
import multiprocessing as mp
import os
import struct
import sys

import numpy as np

from walker_sdf import *  # noqa: F401,F403

# ------------------------------------------------------------------ bones (matches WalkerPose.h)
BONES = ["pelvis", "spine", "chest", "neck", "head", "uarmL", "farmL", "handL", "uarmR", "farmR", "handR",
         "thighL", "shinL", "footL", "toeL", "thighR", "shinR", "footR", "toeR",
         "flapFL", "flapFR", "flapBL", "flapBR", "propR", "propL"]
B = {n: i for i, n in enumerate(BONES)}
NB = len(BONES)

# parts (palette / shading selector)
COAT, LINING, LEGS, SHOE, SOLE, SKIN, HAIR, HAT, SCARF, BAG, GLOVE, HARDWARE, FACE, TRIM, SHIRT, PROP = range(16)
# fabrics
WOOL, PUFFER, LEATHER, DENIM, KNIT, CANVAS, NYLON, FUR, PLAIN, GLOSS = range(10)

# coat construction styles, painted per pixel by the shader
ST_OVERCOAT, ST_PEACOAT, ST_TRENCH, ST_PUFFER, ST_PARKA, ST_BOMBER, ST_DENIM, ST_WRAP = range(8)


def rgb(*a):
    return [float(x) for x in a]


BLACK, CHARCOAL, NAVY = rgb(0.011, 0.011, 0.013), rgb(0.032, 0.033, 0.037), rgb(0.011, 0.019, 0.052)
CAMEL, TAN, GREY = rgb(0.30, 0.175, 0.072), rgb(0.25, 0.175, 0.095), rgb(0.115, 0.117, 0.125)
LGREY, OLIVE, BURGUNDY = rgb(0.27, 0.27, 0.28), rgb(0.047, 0.056, 0.024), rgb(0.085, 0.011, 0.018)
RED, CREAM, FOREST = rgb(0.30, 0.018, 0.012), rgb(0.55, 0.49, 0.38), rgb(0.011, 0.052, 0.032)
COBALT, BROWN, MUSTARD = rgb(0.014, 0.048, 0.21), rgb(0.072, 0.036, 0.017), rgb(0.36, 0.21, 0.018)
WHITE, TEAL, PINK = rgb(0.62, 0.62, 0.60), rgb(0.012, 0.085, 0.095), rgb(0.45, 0.17, 0.17)
DENIM_MID, DENIM_DARK, DENIM_BLACK = rgb(0.055, 0.105, 0.20), rgb(0.018, 0.032, 0.072), rgb(0.017, 0.018, 0.021)
KHAKI, SLATE = rgb(0.17, 0.13, 0.07), rgb(0.05, 0.058, 0.072)
LBLACK, LBROWN, LTAN = rgb(0.009, 0.008, 0.008), rgb(0.050, 0.022, 0.010), rgb(0.18, 0.085, 0.032)

SKINS = [rgb(0.56, 0.35, 0.25), rgb(0.50, 0.30, 0.20), rgb(0.38, 0.215, 0.135), rgb(0.25, 0.135, 0.080),
         rgb(0.135, 0.072, 0.043), rgb(0.075, 0.042, 0.028), rgb(0.47, 0.31, 0.215)]
HAIRS = [rgb(0.007, 0.0055, 0.0045), rgb(0.022, 0.012, 0.007), rgb(0.055, 0.028, 0.013), rgb(0.11, 0.038, 0.013),
         rgb(0.33, 0.21, 0.085), rgb(0.17, 0.162, 0.155), rgb(0.17, 0.105, 0.048)]


# ------------------------------------------------------------------ the sixteen bodies
def V(**kw):
    base = dict(female=False, height=176, girth=1.0, coat="overcoat", style=ST_OVERCOAT, hem=54, fabric=WOOL,
                legs="trousers", leg_fabric=CANVAS, shoes="shoes", hair="short", hat=None, scarf=False, hood=None,
                gloves=True, bag=None, vee=0.0, collar="lapel",
                coats=[BLACK], legcols=[CHARCOAL, BLACK], accents=[CHARCOAL, BURGUNDY, GREY], bagcols=[LBLACK],
                shoecols=[LBLACK, LBROWN], pace=1.0, age=0.0, umbrella=1.0, props=("briefcase", "shopbag", "phone", "coffee"))
    base.update(kw)
    return base


VARIANTS = [
    V(height=181, coat="overcoat", hat="beanie", scarf=True, shoes="boots", vee=0,
      coats=[BLACK, CHARCOAL, NAVY, BROWN], accents=[GREY, BURGUNDY, FOREST, CHARCOAL, MUSTARD]),
    V(female=True, height=167, coat="wrap", style=ST_WRAP, hem=47, hair="bun", scarf=True, shoes="tallboots", legs="tights",
      leg_fabric=KNIT, bag="handbag", coats=[CAMEL, CREAM, BLACK, GREY, BURGUNDY], accents=[CREAM, BLACK, BURGUNDY, LGREY],
      legcols=[BLACK, CHARCOAL], bagcols=[LBLACK, LBROWN, LTAN], shoecols=[LBLACK, LBROWN], props=("shopbag", "phone", "coffee")),
    V(height=178, coat="puffer", style=ST_PUFFER, hem=84, fabric=PUFFER, legs="jeans", leg_fabric=DENIM, shoes="sneakers",
      hat="pompom", bag="backpack", collar="stand", coats=[NAVY, BLACK, OLIVE, COBALT, CHARCOAL],
      legcols=[DENIM_MID, DENIM_DARK, DENIM_BLACK], accents=[BURGUNDY, MUSTARD, GREY, FOREST], bagcols=[BLACK, SLATE, OLIVE],
      shoecols=[WHITE, GREY, BLACK], props=("phone", "coffee")),
    V(female=True, height=170, coat="puffer_long", style=ST_PUFFER, hem=50, fabric=PUFFER, legs="tights", leg_fabric=NYLON,
      shoes="boots", hair="pony", hood="down", collar="stand", gloves=True,
      coats=[RED, BLACK, FOREST, CREAM, NAVY, LGREY], legcols=[BLACK, CHARCOAL], shoecols=[LBLACK, LTAN],
      props=("shopbag", "phone", "coffee")),
    V(height=185, coat="suit_overcoat", hem=57, hair="short", gloves=False, vee=1.0, shoes="shoes", pace=1.12,
      coats=[CHARCOAL, BLACK, NAVY, GREY], legcols=[CHARCOAL, BLACK, NAVY], accents=[BURGUNDY, NAVY, CHARCOAL],
      props=("briefcase", "phone", "coffee"), umbrella=1.2),
    V(female=True, height=163, coat="wool", hem=62, hat="knit", hair="long", legs="jeans", leg_fabric=DENIM, shoes="boots",
      bag="tote", scarf=True, coats=[GREY, LGREY, PINK, NAVY, BLACK, TEAL], accents=[CREAM, BURGUNDY, BLACK, MUSTARD],
      legcols=[DENIM_DARK, DENIM_MID, DENIM_BLACK], bagcols=[CREAM, BLACK, TAN], props=("phone", "coffee")),
    V(height=177, girth=1.06, coat="parka", style=ST_PARKA, hem=74, fabric=CANVAS, hood="up_fur", legs="cargo",
      shoes="workboots", collar="stand", coats=[OLIVE, BLACK, NAVY, KHAKI, SLATE], legcols=[KHAKI, CHARCOAL, BLACK],
      accents=[BROWN, KHAKI], shoecols=[LTAN, LBROWN, LBLACK], props=("shopbag", "phone"), umbrella=0.2),
    V(female=True, height=165, coat="peacoat", style=ST_PEACOAT, hem=80, legs="skirt", leg_fabric=WOOL, hair="long", hat="earmuffs",
      shoes="tallboots", scarf=True, gloves=True, bag="handbag", coats=[BLACK, NAVY, BURGUNDY, FOREST],
      legcols=[BLACK, CHARCOAL, BROWN], accents=[CREAM, RED, GREY, MUSTARD], props=("shopbag", "phone", "coffee")),
    V(height=172, girth=1.04, coat="tweed", hem=66, hat="flatcap", hair="short", scarf=True, shoes="shoes", age=1.0, pace=0.86,
      coats=[BROWN, CHARCOAL, SLATE, OLIVE], legcols=[GREY, CHARCOAL, BROWN, KHAKI], accents=[BURGUNDY, FOREST, KHAKI],
      props=("shopbag", "coffee"), umbrella=1.3),
    V(height=174, girth=0.95, coat="bomber", style=ST_BOMBER, hem=91, fabric=LEATHER, legs="jeans", leg_fabric=DENIM,
      shoes="sneakers", hair="short", hood="down", collar="rib", gloves=False, coats=[LBLACK, LBROWN, CHARCOAL, OLIVE],
      accents=[LGREY, GREY, BURGUNDY, FOREST], legcols=[DENIM_BLACK, DENIM_DARK], shoecols=[WHITE, BLACK, RED],
      props=("phone", "coffee"), pace=1.05),
    V(female=True, height=160, coat="puffer", style=ST_PUFFER, hem=82, fabric=PUFFER, legs="jeans", leg_fabric=DENIM,
      shoes="boots", hat="pompom", hair="long", bag="backpack", collar="stand",
      coats=[CREAM, WHITE, PINK, BLACK, TEAL], legcols=[DENIM_MID, DENIM_DARK], accents=[CREAM, CHARCOAL, PINK],
      bagcols=[BLACK, BROWN, BURGUNDY], shoecols=[LTAN, LBLACK], props=("phone", "coffee")),
    V(height=183, coat="trench", style=ST_TRENCH, hem=55, fabric=CANVAS, hat="fedora", shoes="shoes", gloves=True, vee=1.0,
      coats=[TAN, KHAKI, BLACK, NAVY], legcols=[CHARCOAL, BROWN, BLACK], accents=[NAVY, BURGUNDY],
      props=("briefcase", "phone"), umbrella=1.3),
    V(female=True, height=169, coat="wool", hem=52, hood="up", legs="trousers", shoes="boots", hair="long",
      coats=[FOREST, BLACK, BURGUNDY, CHARCOAL, COBALT], legcols=[BLACK, CHARCOAL, NAVY], bag="messenger",
      bagcols=[LBROWN, LBLACK], props=("shopbag", "phone"), umbrella=0.15),
    V(height=179, girth=1.17, coat="puffer", style=ST_PUFFER, hem=82, fabric=PUFFER, legs="trousers", shoes="workboots",
      hat="beanie", collar="stand", coats=[BLACK, CHARCOAL, NAVY, BURGUNDY], legcols=[CHARCOAL, DENIM_DARK, BLACK],
      accents=[BLACK, GREY, NAVY, MUSTARD], shoecols=[LTAN, LBLACK], props=("shopbag", "coffee", "phone"), pace=0.94),
    V(female=True, height=173, coat="trench", style=ST_TRENCH, hem=63, fabric=CANVAS, hair="bob", legs="trousers",
      shoes="shoes", bag="messenger", scarf=True, vee=0, coats=[NAVY, TAN, BLACK, KHAKI],
      accents=[CREAM, RED, TAN, TEAL], legcols=[CHARCOAL, BLACK, GREY], bagcols=[LBROWN, LTAN, LBLACK],
      props=("briefcase", "phone", "coffee"), pace=1.1),
    V(height=176, girth=0.93, coat="denim", style=ST_DENIM, hem=90, fabric=DENIM, legs="jeans", leg_fabric=DENIM,
      shoes="sneakers", hat="beanie", hood="down", bag="backpack", collar="point", gloves=False,
      coats=[DENIM_MID, DENIM_DARK, BLACK], accents=[LGREY, MUSTARD, RED, CHARCOAL], legcols=[DENIM_BLACK, KHAKI],
      bagcols=[BLACK, OLIVE, COBALT], shoecols=[WHITE, BLACK], props=("phone", "coffee"), pace=1.02, umbrella=0.5),
]


# ------------------------------------------------------------------ skeleton
class Body:
    def __init__(self, spec, index):
        self.spec = spec
        self.index = index
        f = spec["female"]
        s = spec["height"] / 176.0
        g = spec["girth"]
        self.s, self.g, self.f = s, g, f
        J = np.zeros((NB, 3), np.float32)

        def put(name, x, y, z):
            J[B[name]] = (x * s, y * s, z * s)

        sh = 16.4 if f else 18.4
        sh *= 1.0 + (g - 1.0) * 0.5
        hip = 9.4 if f else 9.4
        put("pelvis", -1.0, 0, 96.5)
        put("spine", -2.0, 0, 108.0)
        put("chest", -2.2, 0, 124.0)
        put("neck", -1.2, 0, 149.0)
        put("head", 0.0, 0, 156.8)
        for side, tag in ((-1, "L"), (1, "R")):
            put("uarm" + tag, -1.5, side * sh, 142.8)
            put("farm" + tag, -2.4, side * (sh + 3.8), 113.2)
            put("hand" + tag, 0.2, side * (sh + 5.9), 87.6)
            put("thigh" + tag, 0.0, side * hip, 93.5)
            put("shin" + tag, 0.6, side * (hip + 0.2), 50.5)
            put("foot" + tag, 0.0, side * (hip + 0.4), 8.5)
            put("toe" + tag, 13.0, side * (hip + 0.4), 0.0)
        put("flapFL", 4.0, -8.0, 97.0)
        put("flapFR", 4.0, 8.0, 97.0)
        put("flapBL", -5.0, -8.0, 97.0)
        put("flapBR", -5.0, 8.0, 97.0)
        self.J = J
        self.gripL = J[B["handL"]] + np.array((0.9, -0.2, -7.2), np.float32) * s
        self.gripR = J[B["handR"]] + np.array((0.9, 0.2, -7.2), np.float32) * s
        self.rng = np.random.default_rng(900 + index)

    def j(self, name):
        return self.J[B[name]].copy()

    # ---------------------------------------------------------- torso profile of the outer garment
    def coat_profile(self):
        """Control rows (z at 176 cm, centre x, front depth, back depth, half width)."""
        c = self.spec["coat"]
        f = self.f
        rows = {
            # shoulders first, hem last
            "base": [(151.5, -1.4, 5.8, 5.8, 6.4), (148.8, -1.8, 7.4, 7.4, 11.4), (145.0, -1.8, 9.2, 9.2, 17.6),
                     (139.0, -1.2, 11.4, 10.6, 18.8), (130.0, -0.7, 12.4, 11.2, 17.8), (119.0, -0.8, 11.4, 10.4, 16.2),
                     (108.0, -1.0, 11.3, 10.6, 15.9), (99.0, -1.2, 12.0, 11.8, 17.9), (88.0, -1.0, 11.8, 11.6, 18.4),
                     (74.0, -0.8, 12.0, 11.8, 18.8), (60.0, -0.8, 12.6, 12.4, 19.6), (44.0, -0.8, 13.0, 12.8, 20.2)],
        }["base"]
        grow = {"overcoat": 0.35, "suit_overcoat": 0.2, "wool": 0.15, "wrap": 0.2, "peacoat": 0.55, "tweed": 0.45, "trench": 0.3,
                "puffer": 1.9, "puffer_long": 1.6, "parka": 1.6, "bomber": 0.9, "denim": 0.35}[c]
        out = []
        for z, cx, df, db, w in rows:
            if f:
                if z > 136:
                    w *= 0.91
                    df *= 0.93
                    db *= 0.92
                elif z > 124:
                    w *= 0.89
                    df *= 1.02
                    db *= 0.90
                elif z > 104:
                    w *= 0.86
                    df *= 0.89
                    db *= 0.88
                else:
                    w *= 0.99
                    df *= 0.95
                    db *= 0.98
            if c in ("wrap",) and 104 < z < 114:
                w *= 0.93
                df *= 0.93
                db *= 0.93
            if c in ("wrap", "wool", "trench") and z < 90:
                flare = (90 - z) / 46.0
                w *= 1.0 + 0.07 * flare
                df *= 1.0 + 0.05 * flare
            gg = self.g
            waist = math.exp(-((z - 108) / 17.0) ** 2)
            belly = max(gg - 1.0, 0.0) * waist
            scale_w = 1.0 + (gg - 1.0) * 0.55
            out.append((z * self.s, cx * self.s, (df * scale_w * (1 + belly * 0.9) + grow * 0.8) * self.s,
                        (db * scale_w + grow * 0.7) * self.s, (w * (scale_w + belly * 0.25) + grow) * self.s))
        return out

    def front_x(self, z):
        rows = sorted(self.coat_profile())
        zs = [r[0] for r in rows]
        return float(np.interp(z, zs, [r[1] + r[2] for r in rows]))

    def back_x(self, z):
        rows = sorted(self.coat_profile())
        zs = [r[0] for r in rows]
        return float(np.interp(z, zs, [r[1] - r[3] for r in rows]))

    def half_w(self, z):
        rows = sorted(self.coat_profile())
        zs = [r[0] for r in rows]
        return float(np.interp(z, zs, [r[4] for r in rows]))


# ------------------------------------------------------------------ garments
class Part:
    def __init__(self, name, f, lo, hi, voxel, part, fabric, tris, weights, ao_group="body", solid=None, normal_soft=0.55):
        self.name, self.f, self.lo, self.hi, self.voxel = name, f, np.asarray(lo, np.float32), np.asarray(hi, np.float32), voxel
        self.part, self.fabric, self.tris, self.weights = part, fabric, tris, weights
        self.ao_group = ao_group
        self.solid = solid or f
        self.normal_soft = normal_soft


def torso_weights(body, P):
    s = body.s
    z = P[:, 2] / s
    x = P[:, 0] / s
    y = P[:, 1] / s
    W = np.zeros((len(P), NB), np.float32)
    chest = smooth(112, 130, z)
    pelvis = 1.0 - smooth(98, 113, z)
    spine = np.clip(1.0 - chest - pelvis, 0, 1)
    neck = smooth(148.2, 153.5, z) * smooth(11.5, 7.0, np.hypot(x + 1.2, y))
    W[:, B["pelvis"]] = pelvis
    W[:, B["spine"]] = spine
    W[:, B["chest"]] = chest * (1 - neck)
    W[:, B["neck"]] = chest * neck
    return W


def skirt_split(body, P, W, top=95.0, full=70.0, strength=1.0):
    """Hands the pelvis weight of everything below the hips to the four coat flap bones."""
    s = body.s
    z, x, y = P[:, 2] / s, P[:, 0] / s, P[:, 1] / s
    low = smooth(top, full, z) * strength
    front = smooth(-5.5, 5.5, x + 0.8)
    left = smooth(4.5, -4.5, y)
    base = W[:, B["pelvis"]].copy()
    W[:, B["pelvis"]] = base * (1 - low)
    W[:, B["flapFL"]] += base * low * front * left
    W[:, B["flapFR"]] += base * low * front * (1 - left)
    W[:, B["flapBL"]] += base * low * (1 - front) * left
    W[:, B["flapBR"]] += base * low * (1 - front) * (1 - left)
    return W


def arm_weights(body, P, tag, W, amount):
    """Moves `amount` of each vertex's weight onto one arm's bones."""
    sh, el, wr = body.j("uarm" + tag), body.j("farm" + tag), body.j("hand" + tag)
    up = (el - sh) / np.linalg.norm(el - sh)
    axis = (wr - sh) / np.linalg.norm(wr - sh)
    fore = smooth(-4.8, 4.8, (P - el) @ axis)
    # right at the shoulder the sleeve belongs partly to the trunk, which keeps the cap round
    along = (P - sh) @ up
    own = smooth(-3.5, 10.5, along)
    a = amount * own
    keep = 1.0 - a
    W *= keep[:, None]
    W[:, B["uarm" + tag]] += a * (1 - fore)
    W[:, B["farm" + tag]] += a * fore
    return W


def sleeve_field(body, tag, grow, cuff_gap=1.0):
    s = body.s
    side = -1 if tag == "L" else 1
    sh, el, wr = body.j("uarm" + tag), body.j("farm" + tag), body.j("hand" + tag)
    top = sh + np.array((0.2, -side * 1.7, -0.8), np.float32) * s
    end = wr + (el - wr) / np.linalg.norm(el - wr) * cuff_gap * s
    k = 1.0 + (body.g - 1.0) * 0.6
    r0 = (5.9 if not body.f else 5.2) * k + grow
    r1 = (4.65 if not body.f else 4.05) * k + grow * 0.85
    r2 = (3.75 if not body.f else 3.25) * k + grow * 0.6
    mid_u = sh + (el - sh) * 0.45
    mid_f = el + (wr - el) * 0.3
    f = sunion(2.2 * s, round_cone(top, mid_u, r0 * s, (r0 + r1) * 0.52 * s), round_cone(mid_u, el, (r0 + r1) * 0.52 * s, r1 * s),
               round_cone(el, mid_f, r1 * s, (r1 + 0.25) * s), round_cone(mid_f, end, (r1 + 0.25) * s, r2 * s))
    return sinter(0.5, f, halfspace(end, wr - el))


def make_coat(body):
    sp = body.spec
    s = body.s
    rows = body.coat_profile()
    hem = sp["hem"] * s
    rows = [r for r in rows if r[0] > hem - 14]
    zs = [r[0] for r in rows]
    torso = loft(zs, [r[1] for r in rows], [r[2] for r in rows], [r[4] for r in rows], power=2.45, back=[r[3] for r in rows], cap=False)
    top = max(zs)
    torso_cut = sinter(0.9 * s, torso, lambda P: np.maximum(hem - P[:, 2], P[:, 2] - top).astype(np.float32))
    puffy = sp["coat"] in ("puffer", "puffer_long")
    grow = {"overcoat": 0.35, "suit_overcoat": 0.15, "wool": 0.1, "wrap": 0.15, "peacoat": 0.5, "tweed": 0.4, "trench": 0.25,
            "puffer": 1.55, "puffer_long": 1.4, "parka": 1.2, "bomber": 0.8, "denim": 0.15}[sp["coat"]]
    armL = sleeve_field(body, "L", grow)
    armR = sleeve_field(body, "R", grow)
    caps = []
    for tag, side in (("L", -1), ("R", 1)):
        shp = body.j("uarm" + tag)
        caps.append(ellipsoid(shp + np.array((-0.2, -side * 3.2, -2.0), np.float32) * s, np.array((7.0, 6.0, 5.6), np.float32) * s * (1 + grow * 0.05)))
    # Trunk and sleeves are meshed separately.  Arms hang against the sides at rest, so one surface would
    # weld the two together down the flank and stretch into a web as soon as an arm swung.
    core = sunion(2.6 * s, torso_cut, caps[0], caps[1])

    elbow_z = body.j("farmL")[2]

    def detail(P, sleeve):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        d = np.zeros(len(P), np.float32)
        arm = np.full(len(P), sleeve)
        if puffy:
            spacing = 6.8 * s
            baffle = np.abs(np.sin(np.pi * (z - 3.0) / spacing)) ** 0.55
            seam = baffle - 0.62
            fade = smooth(152 * s, 144 * s, z)
            d -= (0.95 * seam * fade).astype(np.float32)
            d += (0.16 * value_noise(P, (4.5, 4.5, 3.0), 2)).astype(np.float32)
        else:
            amp = {LEATHER: 0.22, CANVAS: 0.24, DENIM: 0.2}.get(sp["fabric"], 0.17)
            d += (amp * value_noise(P, (7.5, 7.5, 3.6), 3)).astype(np.float32)
            d += (amp * 0.6 * value_noise(P, (3.4, 3.4, 8.0), 4)).astype(np.float32)
            # creases gather inside the elbow and above the hips
            elbow = np.exp(-((z - elbow_z) / (6.5 * s)) ** 2) * arm
            d += (0.20 * elbow * np.sin(z * 1.25 / s + y * 0.5 + 4.5 * value_noise(P, (5, 5, 5), 5))).astype(np.float32)
            waist = np.exp(-((z - 108 * s) / (7.0 * s)) ** 2) * (~arm)
            d += (0.13 * waist * np.sin(z * 0.95 / s + y * 0.3 + 4.0 * value_noise(P, (8, 8, 8), 6))).astype(np.float32)
        if sp["coat"] not in ("bomber", "puffer", "puffer_long", "denim", "parka"):
            # hanging folds in the skirt of a long coat
            skirt = smooth(96 * s, 66 * s, z) * (~arm)
            ang = np.arctan2(y, x + 1.0)
            d += (0.55 * skirt * np.sin(ang * 9.0 + 2.0 * value_noise(P, (14, 14, 30), 8))).astype(np.float32)
        # the front closure sits proud of the cloth
        front = (~arm) * (x > 0) * smooth(hem, hem + 3, z) * smooth(147 * s, 142 * s, z)
        d -= (0.34 * front * np.exp(-((y - 0.9) / 1.15) ** 2)).astype(np.float32)
        d += (0.30 * front * np.exp(-((y + 0.45) / 0.35) ** 2)).astype(np.float32)
        if sp["style"] in (ST_TRENCH, ST_WRAP):
            belt = smooth(2.7 * s, 2.0 * s, np.abs(z - 108 * s)) * (~arm)
            d -= (0.75 * belt).astype(np.float32)
        if sp["style"] == ST_BOMBER:
            band = smooth(hem + 5.0 * s, hem + 4.0 * s, z) * (~arm)
            d += (1.1 * band).astype(np.float32)
        # cuffs
        for tag in ("L", "R"):
            wr, el = body.j("hand" + tag), body.j("farm" + tag)
            ax = (wr - el) / np.linalg.norm(wr - el)
            t = (P - wr) @ ax
            near = np.linalg.norm(P - wr, axis=1) < 9 * s
            if puffy or sp["style"] in (ST_BOMBER,):
                d += (0.55 * near * smooth(-4.6 * s, -3.8 * s, t)).astype(np.float32)
            else:
                d -= (0.32 * near * smooth(-5.2 * s, -4.6 * s, t)).astype(np.float32)
        return d

    extras = []

    # collars
    nk = body.j("neck")
    if sp["collar"] == "stand":
        inner = round_cone(nk + np.array((0.2, 0, -3), np.float32) * s, nk + np.array((1.0, 0, 9), np.float32) * s, 5.7 * s, 5.5 * s)
        outer = round_cone(nk + np.array((-0.2, 0, -3), np.float32) * s, nk + np.array((0.6, 0, 6.8), np.float32) * s, 8.6 * s, 7.3 * s)
        ring = ssub(outer, inner, 0.5)
        top_cut = halfspace(nk + np.array((0, 0, 6.6), np.float32) * s, (-0.12, 0, 1))
        extras.append(sinter(0.5, ring, top_cut))
    elif sp["collar"] == "rib":
        extras.append(torus(nk + np.array((0.8, 0, 1.6), np.float32) * s, 6.3 * s, 1.35 * s, rot=rot_xyz(0, 13, 0), squash=(1.0, 1.04)))
    elif sp["collar"] in ("lapel", "point"):
        roll = torus(nk + np.array((0.3, 0, 1.2), np.float32) * s, 7.1 * s, 1.55 * s, rot=rot_xyz(0, 17, 0), squash=(0.96, 1.06))
        # open at the throat
        gap = ellipsoid(nk + np.array((10.5, 0, -1.0), np.float32) * s, np.array((7.0, 4.6, 6.0), np.float32) * s)
        extras.append(ssub(roll, gap, 0.7))
        lapels = []
        for side in (-1, 1):
            pts = [(146.5, side * 6.4), (141.5, side * 8.4), (134.0, side * 5.0), (124.5, side * 1.4)]
            path = [(body.front_x(z * s) - 0.15 * s, y * s, z * s) for z, y in pts]
            path[0] = (path[0][0] - 1.5 * s, path[0][1], path[0][2])
            lapels.append(chain(path, [1.35 * s, 1.5 * s, 1.15 * s, 0.7 * s]))
        extras.append(union(*lapels))
    coat = displace(core, lambda P: detail(P, False))
    if extras:
        coat = sunion(0.9 * s, coat, *extras)

    # a belt knot and hanging tails
    if sp["style"] == ST_WRAP:
        z0 = 108 * s
        knot_at = np.array((body.front_x(z0) + 0.6 * s, -4.0 * s, z0), np.float32)
        knot = ellipsoid(knot_at, np.array((1.9, 2.6, 2.0), np.float32) * s)
        tails = []
        for dy, ln in ((-1.4, 17), (1.3, 22)):
            a = knot_at + np.array((0.0, dy * s, -1.0 * s), np.float32)
            b = np.array((body.front_x(z0 - ln * s) + 0.7 * s, -4.0 * s + dy * 2.2 * s, z0 - ln * s), np.float32)
            tails.append(round_cone(a, b, 1.15 * s, 0.95 * s))
        coat = union(coat, knot, *tails)

    def weights(P):
        W = torso_weights(body, P)
        long_coat = sp["hem"] < 78
        W = skirt_split(body, P, W, top=100.5, full=80.0 if long_coat else 86.0, strength=1.0 if long_coat else 0.6)
        # the rounded shoulder cap belongs to the trunk mesh but rides partly with the upper arm
        dT = torso_cut(P)
        for tag, cap, side in (("L", caps[0], -1), ("R", caps[1], 1)):
            amount = smooth(-1.7, 1.7, dT - cap(P)) * smooth(6.0 * s, 11.0 * s, side * P[:, 1])
            W = arm_weights(body, P, tag, W, amount.astype(np.float32))
        return W

    wide = body.half_w(145 * s) + 14 * s
    lo = (-26 * s, -max(wide, 34 * s), hem - 3)
    hi = (28 * s, max(wide, 34 * s), 162 * s)
    voxel = 0.62 if sp["style"] != ST_PUFFER else 0.68
    out = [Part("coat", coat, lo, hi, voxel, COAT, sp["fabric"], (6600, 1750, 470, 140), weights, normal_soft=0.5)]

    sleeves = []
    for tag, field in (("L", armL), ("R", armR)):
        sh, el, wr = body.j("uarm" + tag), body.j("farm" + tag), body.j("hand" + tag)

        def cloth(P, field=field, top=float(sh[2])):
            # the top of the sleeve draws in a little so that it tucks under the shoulder cap
            return (field(P) + detail(P, True) + 1.25 * s * smooth(top - 10.0 * s, top - 0.5 * s, P[:, 2])).astype(np.float32)

        def sleeve_weights(P, tag=tag):
            return arm_weights(body, P, tag, torso_weights(body, P), np.ones(len(P), np.float32))

        pad = 11.0 * s
        sleeves.append(cloth)
        out.append(Part("sleeve" + tag, cloth, np.minimum(np.minimum(sh, el), wr) - pad, np.maximum(np.maximum(sh, el), wr) + pad,
                        voxel, COAT, sp["fabric"], (1500, 400, 110, 36), sleeve_weights, ao_group="arm" + tag, normal_soft=0.5))

    # bags and straps drape over the whole outer garment as it hangs at rest
    return out, (armL, armR, torso_cut), union(coat, *sleeves)


def make_legs(body):
    sp = body.spec
    s = body.s
    kind = sp["legs"]
    g = 1.0 + (body.g - 1.0) * 0.7
    thick = {"trousers": 1.0, "jeans": 0.94, "cargo": 1.1, "tights": 0.80, "skirt": 0.80}[kind]
    if body.f:
        thick *= 0.95
    legs = []
    for tag, side in (("L", -1), ("R", 1)):
        hip, knee, ankle = body.j("thigh" + tag), body.j("shin" + tag), body.j("foot" + tag)
        mid = hip + (knee - hip) * 0.45
        calf = knee + (ankle - knee) * 0.28
        low = ankle + np.array((0.0, 0, 2.2 if kind == "tights" else 0.8), np.float32) * s
        ankle_r = {"tights": 3.4, "skirt": 3.4, "jeans": 4.5, "trousers": 5.0, "cargo": 5.3}[kind]
        top = hip + np.array((-0.6, -side * 0.6, 2.0), np.float32) * s
        calf_r = 5.55 * thick * (0.97 if kind in ("tights", "skirt") else 1.0)
        legs.append(sunion(1.6 * s,
                           round_cone(top, mid, 8.3 * thick * g * s, 6.9 * thick * g * s),
                           round_cone(mid, knee, 6.9 * thick * g * s, 5.15 * thick * s),
                           round_cone(knee, calf + np.array((-0.7, 0, 0), np.float32) * s, 5.1 * thick * s, calf_r * s),
                           round_cone(calf + np.array((-0.7, 0, 0), np.float32) * s, low, calf_r * s, ankle_r * thick ** 0.35 * s)))
    seat = ellipsoid(body.j("pelvis") + np.array((-0.4, 0, -2.2), np.float32) * s, np.array((10.2 * g, 14.8 * g, 9.6), np.float32) * s)
    base = sunion(3.2 * s, sunion(0.9 * s, legs[0], legs[1]), seat)
    knee_z = body.j("shinL")[2]
    ankle_z = body.j("footL")[2]

    def detail(P):
        z = P[:, 2]
        d = np.zeros(len(P), np.float32)
        if kind in ("tights", "skirt"):
            return d
        amp = 0.2 if kind == "jeans" else 0.15
        d += (amp * value_noise(P, (5.5, 5.5, 2.6), 11)).astype(np.float32)
        knee = np.exp(-((z - knee_z) / (6.0 * s)) ** 2) * smooth(1.5, -3.0, P[:, 0])
        d += (0.38 * knee * np.sin(z * 1.45 / s + 3.0 * value_noise(P, (5, 5, 5), 12))).astype(np.float32)
        brk = np.exp(-((z - ankle_z - 7 * s) / (5.0 * s)) ** 2)
        d += (0.34 * brk * np.sin(z * 1.8 / s + 3.0 * value_noise(P, (4, 4, 4), 13))).astype(np.float32)
        # pressed crease down the front of suit trousers
        if kind == "trousers":
            for side in (-1, 1):
                crease = np.exp(-((P[:, 1] - side * 9.8 * s) / 0.8) ** 2) * (P[:, 0] > 1) * smooth(94 * s, 80 * s, z)
                d -= (0.22 * crease).astype(np.float32)
        return d

    f = displace(base, detail)
    waist = 103.0 * s
    floor_z = ankle_z + (0.5 if kind in ("tights", "skirt") else -1.2) * s
    boot = {"boots": 19.0, "tallboots": 37.0, "workboots": 18.0}.get(sp["shoes"])
    if boot and kind in ("tights", "skirt"):
        floor_z = boot * s
    f = sinter(0.6, f, lambda P: np.maximum(P[:, 2] - waist, floor_z - P[:, 2]).astype(np.float32))

    def weights(P):
        z, y = P[:, 2] / s, P[:, 1] / s
        W = np.zeros((len(P), NB), np.float32)
        pel = smooth(83.0, 99.0, z)
        left = smooth(3.0, -3.0, y)
        shin = smooth(55.5, 45.5, z)
        for tag, lw in (("L", left), ("R", 1 - left)):
            W[:, B["thigh" + tag]] += (1 - pel) * (1 - shin) * lw
            W[:, B["shin" + tag]] += (1 - pel) * shin * lw
        W[:, B["pelvis"]] = pel
        return W

    out = [Part("legs", f, (-18 * s, -22 * s, floor_z - 1), (18 * s, 22 * s, waist + 1), 0.62, LEGS,
                sp["leg_fabric"] if kind != "skirt" else KNIT, (3000, 850, 230, 70), weights)]
    if kind == "skirt":
        hem = 58.0 * s
        zs = [58 * s, 70 * s, 84 * s, 96 * s, 103 * s]
        skirt = loft(zs, [-0.8 * s] * 5, [13.0 * s, 12.2 * s, 11.6 * s, 11.2 * s, 10.0 * s],
                     [19.6 * s, 18.6 * s, 17.8 * s, 16.6 * s, 13.6 * s], power=2.2, cap=False)
        folds = lambda P: (0.5 * smooth(92 * s, 66 * s, P[:, 2]) * np.sin(np.arctan2(P[:, 1], P[:, 0]) * 13.0)).astype(np.float32)
        sk = sinter(0.7, displace(skirt, folds), lambda P: np.maximum(hem - P[:, 2], P[:, 2] - 101 * s).astype(np.float32))

        def sk_weights(P):
            W = torso_weights(body, P)
            return skirt_split(body, P, W, top=96.0, full=72.0, strength=1.0)

        out.append(Part("skirt", sk, (-20 * s, -24 * s, hem - 1), (20 * s, 24 * s, 104 * s), 0.7, LEGS, WOOL, (1500, 480, 150, 50), sk_weights))
    return out


def make_shoe(body, tag):
    sp = body.spec
    s = body.s
    side = -1 if tag == "L" else 1
    kind = sp["shoes"]
    ankle = body.j("foot" + tag)
    ax, ay = ankle[0], ankle[1]
    xs = np.array([-7.0, -5.6, -2.0, 3.0, 8.0, 12.5, 16.0, 19.0, 21.0]) * s
    chunky = {"shoes": 0.0, "boots": 0.35, "tallboots": 0.1, "sneakers": 0.45, "workboots": 0.7}[kind]
    top = np.array([6.0, 9.6, 10.2, 9.4, 7.6, 6.2, 5.2, 4.2, 2.6])
    if kind == "shoes":
        top = np.array([5.4, 7.8, 8.2, 8.0, 6.6, 5.2, 4.4, 3.6, 2.2])
    if kind == "tallboots":
        top = np.array([6.0, 10.0, 11.0, 10.0, 7.4, 5.8, 4.8, 3.9, 2.4])
    top = (top + np.array([0.2, 0.5, 0.5, 0.6, 0.8, 0.8, 0.7, 0.6, 0.2]) * chunky) * s
    bottom = np.array([1.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 1.1]) * s
    wid = (np.array([2.3, 3.9, 4.2, 4.1, 4.65, 5.0, 4.75, 3.9, 1.8]) + chunky * 0.7) * s
    if body.f:
        wid = wid * 0.92
    prof = loft_x(ax + xs, list(zip(bottom, top)), wid, cy=ay, power=2.5)
    fields = [prof]
    shaft_top = {"shoes": 10.0, "boots": 22.0, "tallboots": 41.0, "sneakers": 11.5, "workboots": 21.0}[kind]
    knee = body.j("shin" + tag)
    covered = sp["legs"] in ("trousers", "jeans", "cargo")
    if covered:
        shaft_top = min(shaft_top, 11.5)
    if kind in ("boots", "workboots", "tallboots") and not covered:
        up = (knee - ankle) / (knee[2] - ankle[2])
        a = ankle + np.array((-0.4, 0, -1.0), np.float32) * s
        b = ankle + up * (shaft_top * s - ankle[2])
        if kind == "tallboots":
            m = ankle + up * (15 * s)
            shaft = sunion(1.5 * s, round_cone(a, m, 4.6 * s, 4.4 * s), round_cone(m, b + np.array((-0.6, 0, 0), np.float32) * s, 4.4 * s, 5.35 * s))
        else:
            shaft = round_cone(a, b, (4.8 + chunky) * s, (5.2 + chunky * 0.8) * s)
        shaft = sinter(0.5, shaft, lambda P, t=shaft_top * s: (P[:, 2] - t).astype(np.float32))
        fields.append(shaft)
    else:
        fields.append(sinter(0.5, ellipsoid(ankle + np.array((-0.6, 0, 0.2), np.float32) * s, np.array((4.6, 4.3, 3.4), np.float32) * s),
                             lambda P, t=shaft_top * s: (P[:, 2] - t).astype(np.float32)))
    f = sunion(1.4 * s, *fields)
    sole_h = {"shoes": 1.5, "boots": 2.2, "tallboots": 1.9, "sneakers": 3.0, "workboots": 2.9}[kind] * s

    def groove(P):
        return (-0.22 * smooth(sole_h + 0.15, sole_h - 0.25, P[:, 2])).astype(np.float32)

    f = displace(f, groove)
    f = sinter(0.35, f, lambda P: (-P[:, 2]).astype(np.float32))

    def weights(P):
        W = np.zeros((len(P), NB), np.float32)
        rel = (P[:, 0] - ax) / s
        toe = smooth(11.0, 14.0, rel) * smooth(9.0, 6.0, P[:, 2] / s)
        shin = smooth(10.5, 18.0, P[:, 2] / s)
        W[:, B["toe" + tag]] = toe * (1 - shin)
        W[:, B["shin" + tag]] = shin
        W[:, B["foot" + tag]] = np.clip(1.0 - toe * (1 - shin) - shin, 0, 1)
        return W

    lo = (ax - 9 * s, ay - 8 * s, -0.5)
    hi = (ax + 23 * s, ay + 8 * s, shaft_top * s + 1)
    return Part("shoe" + tag, f, lo, hi, 0.5, SHOE, LEATHER if kind != "sneakers" else CANVAS, (850, 230, 60, 16), weights,
                ao_group="foot" + tag), sole_h


def make_hand(body, tag):
    sp = body.spec
    s = body.s * (0.92 if body.f else 1.0)
    side = -1 if tag == "L" else 1
    wr, el = body.j("hand" + tag), body.j("farm" + tag)
    down = (wr - el) / np.linalg.norm(wr - el)
    glove = sp["gloves"]
    puff = 0.28 if glove else 0.0
    inward = np.array((0.0, -side, 0.0), np.float32)
    fwd = np.array((1.0, 0.0, 0.0), np.float32)

    def at(d, x=0.0, i=0.0):
        return wr + down * d * s + fwd * x * s + inward * i * s

    cuff = round_cone(at(-3.4), at(1.2), (3.0 + puff) * s, (2.75 + puff) * s)
    palm = sunion(1.2 * s, round_cone(at(0.6, -0.2), at(5.4, -0.3), (2.35 + puff) * s, (2.2 + puff) * s),
                  round_cone(at(1.6, 1.1), at(6.0, 1.5), (1.7 + puff) * s, (1.45 + puff) * s),
                  round_cone(at(1.6, -1.3), at(6.0, -1.9), (1.7 + puff) * s, (1.4 + puff) * s))
    fingers = []
    for k, (fx, ln) in enumerate(((2.15, 0.96), (0.65, 1.06), (-0.85, 1.0), (-2.25, 0.84))):
        a = at(5.6, fx * 0.82, 0.1)
        m = at(5.6 + 3.5 * ln, fx * 0.9, 0.9)
        t = at(5.6 + 5.3 * ln, fx * 0.88, 2.85)
        fingers.append(chain([a, m, t], [(0.98 + puff) * s, (0.9 + puff) * s, (0.74 + puff) * s]))
    thumb = chain([at(1.8, 1.9, 0.4), at(4.6, 3.2, 1.2), at(6.9, 3.0, 2.3)], [(1.45 + puff) * s, (1.1 + puff) * s, (0.82 + puff) * s])
    f = sunion((0.75 if glove else 0.35) * s, sunion(0.9 * s, cuff, palm), sunion((0.55 if glove else 0.2) * s, *fingers), thumb)

    def weights(P):
        W = np.zeros((len(P), NB), np.float32)
        t = (P - wr) @ down / s
        hand = smooth(-1.6, 1.2, t)
        W[:, B["hand" + tag]] = hand
        W[:, B["farm" + tag]] = 1 - hand
        return W

    pts = np.array([at(-4), at(12, 4, 4), at(12, -4, 4), at(12, 4, -3), at(12, -4, -3)])
    lo = pts.min(0) - 4
    hi = pts.max(0) + 4
    return Part("hand" + tag, f, lo, hi, 0.34, GLOVE if glove else SKIN, LEATHER if glove else PLAIN, (760, 190, 44, 12), weights,
                ao_group="hand" + tag, normal_soft=0.3)


def head_frame(body):
    """Head features are laid out relative to this point."""
    return body.j("head")


def make_head(body):
    s = body.s * (0.955 if body.f else 1.0)
    H = head_frame(body)
    fem = body.f

    def p(x, y, z):
        return H + np.array((x, y, z), np.float32) * s

    def el(c, r):
        return ellipsoid(p(*c), np.array(r, np.float32) * s)

    jaw_w = 0.9 if fem else 1.0
    cranium = el((0.0, 0, 10.4), (9.6, 7.65, 9.0))
    face = el((2.3, 0, 5.6), (7.0, 6.35 * jaw_w, 7.9))
    chin = el((6.3, 0, 0.35), (2.45, 2.7 * jaw_w, 2.0))
    jaws = [round_cone(p(0.4, side * 4.6 * jaw_w, 3.6), p(6.0, side * 1.5, 0.35), 2.35 * s, 1.75 * s) for side in (-1, 1)]
    cheeks = [el((5.6, side * 3.6, 6.2), (2.8, 2.4, 2.4)) for side in (-1, 1)]
    neck = round_cone(p(-1.3, 0, -10.5), p(0.3, 0, 3.4), (4.7 if fem else 5.35) * s, (4.4 if fem else 4.95) * s)
    skull = sunion(2.6 * s, cranium, face, chin, *jaws, *cheeks)
    nose_k = 0.88 if fem else 1.0
    nose = sunion(0.75 * s, round_cone(p(8.55, 0, 9.5), p(9.55 + 0.75 * nose_k, 0, 5.9), 0.62 * s, 1.05 * nose_k * s),
                  el((9.3, 0.95, 5.55), (0.95, 0.72, 0.72)), el((9.3, -0.95, 5.55), (0.95, 0.72, 0.72)))
    brows = union(*[capsule(p(7.6, side * 4.1, 10.75), p(8.45, side * 1.15, 11.05), (0.85 if fem else 1.12) * s) for side in (-1, 1)])
    f = sunion(1.5 * s, skull, brows)
    f = sunion(0.95 * s, f, nose)
    sockets = union(*[el((9.75, side * 3.05, 9.25), (2.0, 2.0, 1.18)) for side in (-1, 1)])
    f = ssub(f, sockets, 1.15 * s)
    eyes = union(*[el((7.55, side * 3.05, 9.1), (1.28, 1.38, 1.02)) for side in (-1, 1)])
    f = sunion(0.42 * s, f, eyes)
    lips = sunion(0.55 * s, el((8.42, 0, 3.18), (0.98, 2.1, 0.6)), el((8.3, 0, 2.34), (0.96, 1.85, 0.64)))
    f = sunion(0.6 * s, f, lips)
    mouth = lambda P: (0.07 * np.exp(-((P[:, 2] - H[2] - 2.78 * s) / (0.27 * s)) ** 2) * (P[:, 0] > H[0] + 7.6 * s)
                       * smooth(2.5 * s, 1.7 * s, np.abs(P[:, 1]))).astype(np.float32)
    f = displace(f, mouth)
    ears = union(*[ssub(ellipsoid(p(-0.5, side * 7.55, 7.7), np.array((1.85, 1.0, 2.9), np.float32) * s, rot=rot_xyz(0, -12, side * 8)),
                        ellipsoid(p(-0.1, side * 8.55, 7.9), np.array((1.0, 0.75, 1.75), np.float32) * s), 0.35 * s) for side in (-1, 1)])
    f = sunion(0.55 * s, f, ears)
    f = sunion(1.9 * s, f, neck)
    f = sinter(0.8, f, lambda P: (H[2] - 11.0 * s - P[:, 2]).astype(np.float32))

    def weights(P):
        W = np.zeros((len(P), NB), np.float32)
        z = (P[:, 2] - H[2]) / s
        x = (P[:, 0] - H[0]) / s
        head = smooth(-1.8, 3.0, z + 0.25 * np.maximum(x - 3.0, 0))
        low = smooth(-9.0, -5.0, z)
        W[:, B["head"]] = head
        W[:, B["neck"]] = (1 - head) * low
        W[:, B["chest"]] = (1 - head) * (1 - low)
        return W

    return Part("head", f, p(-12, -11, -12), p(13, 11, 21), 0.31 * s, FACE, PLAIN, (4200, 900, 210, 60), weights,
                ao_group="head", normal_soft=0.3), skull, (cranium, face)


def make_hair(body, skull):
    sp = body.spec
    style = sp["hair"]
    if style is None or sp["hood"] in ("up", "up_fur"):
        return None
    s = body.s * (0.955 if body.f else 1.0)
    H = head_frame(body)

    def p(x, y, z):
        return H + np.array((x, y, z), np.float32) * s

    thick = {"short": 0.62, "long": 0.95, "bob": 1.1, "bun": 0.75, "pony": 0.75}[style]

    def hairline(P):
        x = (P[:, 0] - H[0]) / s
        z = (P[:, 2] - H[2]) / s
        y = np.abs(P[:, 1]) / s
        line = np.interp(x, [-12, -6.5, -2.6, -0.4, 2.2, 4.6, 6.4, 8.0, 11.0], [1.8, 2.4, 4.2, 10.8, 11.2, 12.6, 14.4, 15.4, 15.6])
        line = line - 0.9 * smooth(4.0, 7.5, y) * (x > 3.0)
        return ((line - z) * s).astype(np.float32)

    cap = sinter(0.55 * s, offset(skull, thick * s), hairline)
    fields = [cap]
    if style in ("long", "bob"):
        end = -9.0 if style == "long" else 0.2
        back = sunion(2.5 * s, round_cone(p(-3.8, 3.4, 12.5), p(-4.6, 4.9, end), 5.6 * s, 4.6 * s),
                      round_cone(p(-3.8, -3.4, 12.5), p(-4.6, -4.9, end), 5.6 * s, 4.6 * s),
                      round_cone(p(-4.8, 0, 13.5), p(-6.0, 0, end + 1), 6.4 * s, 4.9 * s))
        sides = union(*[round_cone(p(0.2, side * 6.4, 14.0), p(-0.6, side * 7.4, end + 1.2), 2.7 * s, 2.25 * s) for side in (-1, 1)])
        drape = sunion(1.6 * s, back, sides)
        drape = sinter(0.8 * s, drape, lambda P: (P[:, 0] - H[0] - 3.4 * s).astype(np.float32))
        fields.append(drape)
    if style == "bun":
        fields.append(ellipsoid(p(-9.4, 0, 10.5), np.array((4.1, 4.5, 4.1), np.float32) * s))
    if style == "pony":
        fields.append(chain([p(-8.8, 0, 12.5), p(-11.8, 0, 7.0), p(-11.6, 0, -1.0), p(-10.2, 0, -7.5)],
                            [3.1 * s, 3.0 * s, 2.1 * s, 0.9 * s]))
    f = sunion(1.1 * s, *fields)
    strands = lambda P: (0.30 * value_noise(P, (1.25, 1.25, 4.2), 21) + 0.16 * value_noise(P, (0.8, 0.8, 2.0), 22)).astype(np.float32)
    f = displace(f, strands)
    hat = sp["hat"]
    if hat in ("beanie", "pompom", "knit", "fedora", "flatcap"):
        lim = lambda P: (P[:, 2] - H[2] - (hat_line(hat, (P[:, 0] - H[0]) / s) + 1.2) * s).astype(np.float32)
        f = sinter(0.5, f, lim)

    def weights(P):
        W = np.zeros((len(P), NB), np.float32)
        z = (P[:, 2] - H[2]) / s
        head = smooth(-7.0, 3.5, z)
        W[:, B["head"]] = head
        W[:, B["neck"]] = (1 - head) * smooth(-11.0, -5.0, z)
        W[:, B["chest"]] = 1 - W[:, B["head"]] - W[:, B["neck"]]
        return W

    lo = p(-16, -12, -12)
    hi = p(12, 12, 23)
    return Part("hair", f, lo, hi, 0.46 * s, HAIR, PLAIN, (2200, 620, 150, 44), weights, ao_group="head", normal_soft=0.45)


def hat_line(hat, x):
    """Height (relative to the head point) of the lower edge of a hat, as a function of x."""
    if hat == "flatcap":
        return 13.8 + 0.1 * x
    if hat == "fedora":
        return 13.7 + 0.06 * x
    return 9.6 + 0.40 * x


def make_hats(body, skull):
    sp = body.spec
    s = body.s * (0.955 if body.f else 1.0)
    H = head_frame(body)

    def p(x, y, z):
        return H + np.array((x, y, z), np.float32) * s

    def el(c, r, rot=None):
        return ellipsoid(p(*c), np.array(r, np.float32) * s, rot=rot)

    def head_w(P):
        W = np.zeros((len(P), NB), np.float32)
        W[:, B["head"]] = 1
        return W

    out = []
    hat = sp["hat"]
    long_hair = sp["hair"] in ("long", "bob", "bun", "pony")
    puff = 0.75 if long_hair else 0.0
    if hat in ("beanie", "pompom", "knit"):
        slouch = 1.6 if hat == "knit" else 0.0
        crown = sunion(2.5 * s, el((-0.35, 0, 11.2), (10.7 + puff * 0.6, 8.85 + puff, 10.1)),
                       el((-3.6 - slouch * 0.5, 0, 15.2 + slouch), (7.6, 7.2, 6.4)))
        line = lambda P: ((hat_line(hat, (P[:, 0] - H[0]) / s) - (P[:, 2] - H[2]) / s) * s).astype(np.float32)
        cap = sinter(0.5 * s, crown, line)
        fold = sinter(0.4 * s, offset(crown, 0.55 * s), lambda P: np.maximum(line(P), -line(P) - 3.3 * s))
        wr = lambda P: (0.16 * value_noise(P, (3.0, 3.0, 2.2), 31)).astype(np.float32)
        out.append(Part("hat", displace(union(cap, fold), wr), p(-15, -13, 0), p(13, 13, 25), 0.46 * s, HAT, KNIT,
                        (1300, 380, 110, 36), head_w, ao_group="head"))
        if hat == "pompom":
            pom = el((-3.6, 0, 22.6), (3.5, 3.5, 3.3))
            pom = displace(pom, lambda P: (0.55 * value_noise(P, (0.9, 0.9, 0.9), 33)).astype(np.float32))
            out.append(Part("pom", pom, p(-9, -5, 17), p(2, 5, 28), 0.42 * s, HAT, FUR, (360, 110, 36, 12), head_w, ao_group="head"))
    elif hat == "flatcap":
        top = el((1.6, 0, 15.6), (11.0, 9.1, 4.5), rot=rot_xyz(0, 7, 0))
        cut = lambda P: ((hat_line(hat, (P[:, 0] - H[0]) / s) - (P[:, 2] - H[2]) / s) * s).astype(np.float32)
        brim = el((9.6, 0, 14.35), (4.9, 6.6, 0.75), rot=rot_xyz(0, 9, 0))
        f = sunion(0.8 * s, sinter(0.5 * s, top, cut), brim)
        out.append(Part("hat", f, p(-13, -12, 10), p(18, 12, 23), 0.42 * s, HAT, WOOL, (1100, 320, 90, 30), head_w, ao_group="head"))
    elif hat == "fedora":
        crown = sinter(1.2 * s, round_cone(p(0.3, 0, 12.0), p(-0.2, 0, 19.2), 9.7 * s, 7.9 * s),
                       lambda P: np.maximum((H[2] + 13.4 * s) - P[:, 2], P[:, 2] - (H[2] + 22.6 * s)).astype(np.float32))
        dent = el((0.4, 0, 24.0), (6.8, 2.6, 2.6))
        pinch = union(el((7.2, 5.2, 21.0), (3.0, 2.2, 4.0)), el((7.2, -5.2, 21.0), (3.0, 2.2, 4.0)))
        crown = ssub(ssub(crown, dent, 1.2 * s), pinch, 1.4 * s)
        brim = el((0.6, 0, 13.95), (14.2, 13.0, 0.62), rot=rot_xyz(0, 3.5, 0))
        f = sunion(0.7 * s, crown, brim)
        out.append(Part("hat", f, p(-16, -15, 11), p(17, 15, 25), 0.44 * s, HAT, WOOL, (1500, 420, 130, 40), head_w, ao_group="head"))
        band = torus(p(0.2, 0, 15.2), 9.15 * s, 0.75 * s, squash=(1.02, 0.98))
        out.append(Part("band", band, p(-12, -12, 13), p(12, 12, 18), 0.4 * s, HARDWARE, PLAIN, (300, 90, 0, 0), head_w, ao_group="head"))
    elif hat == "earmuffs":
        muffs = union(*[el((-0.3, side * 9.1, 8.2), (3.0, 1.9, 3.5)) for side in (-1, 1)])
        muffs = displace(muffs, lambda P: (0.35 * value_noise(P, (0.8, 0.8, 0.8), 41)).astype(np.float32))
        out.append(Part("muffs", muffs, p(-5, -13, 3), p(5, 13, 14), 0.4 * s, HAT, FUR, (600, 180, 60, 20), head_w, ao_group="head"))
        arc = [p(-0.6, 9.4 * math.cos(a), 8.2 + 12.2 * math.sin(a)) for a in np.linspace(0, math.pi, 11)]
        out.append(Part("muffband", chain(arc, [0.75 * s] * 11), p(-3, -12, 6), p(2, 12, 23), 0.36 * s, HARDWARE, PLAIN,
                        (260, 80, 24, 0), head_w, ao_group="head"))

    if sp["hood"] in ("up", "up_fur"):
        outer = sunion(3.0 * s, el((-1.1, 0, 10.6), (12.8, 11.3, 12.9)), el((-6.5, 0, 14.5), (8.2, 8.4, 8.0)),
                       el((-3.6, 0, 0.0), (9.6, 10.2, 9.5)))
        inner = sunion(2.6 * s, el((-0.2, 0, 10.4), (11.1, 9.5, 11.2)), el((-1.5, 0, 0.5), (7.0, 7.4, 8.5)))
        hole = el((12.4, 0, 6.6), (10.4, 8.0, 11.2))
        f = ssub(ssub(outer, inner, 0.5 * s), hole, 0.9 * s)
        f = sinter(1.0 * s, f, lambda P: (H[2] - 8.5 * s - P[:, 2]).astype(np.float32))
        f = displace(f, lambda P: (0.28 * value_noise(P, (4.5, 4.5, 4.0), 51)).astype(np.float32))
        cape = sinter(1.0 * s, el((-3.2, 0, -7.6), (11.4, 14.0, 5.6)), lambda P: (H[2] - 12.0 * s - P[:, 2]).astype(np.float32))
        cape = ssub(cape, el((3.0, 0, -4.0), (7.0, 6.6, 6.5)), 0.8 * s)
        f = sunion(1.8 * s, f, cape)

        def hood_w(P):
            W = np.zeros((len(P), NB), np.float32)
            z = (P[:, 2] - H[2]) / s
            head = smooth(-5.0, 6.0, z)
            W[:, B["head"]] = head
            W[:, B["chest"]] = (1 - head) * smooth(2.0, -8.0, z)
            W[:, B["neck"]] = 1 - W[:, B["head"]] - W[:, B["chest"]]
            return W

        out.append(Part("hood", f, p(-18, -17, -15), p(15, 17, 27), 0.55 * s, COAT, sp["fabric"], (2400, 640, 170, 56), hood_w,
                        ao_group="head"))
        if sp["hood"] == "up_fur":
            rim = []
            for a in np.linspace(0, 2 * math.pi, 29):
                yy, zz = 8.5 * math.cos(a), 6.6 + 11.6 * math.sin(a)
                rim.append(p(8.3 - 1.0 * math.sin(a), yy, zz))
            fur = chain(rim, [1.5 * s] * len(rim))
            fur = sinter(0.6, fur, lambda P: (H[2] - 4.5 * s - P[:, 2]).astype(np.float32))
            fur = displace(fur, lambda P: (0.75 * value_noise(P, (0.75, 0.75, 0.75), 53)).astype(np.float32))
            out.append(Part("fur", fur, p(3, -13, -7), p(14, 13, 21), 0.42 * s, TRIM, FUR, (1300, 330, 90, 24), hood_w,
                            ao_group="head", normal_soft=0.3))
    elif sp["hood"] == "down":
        bz = 142.5 * body.s
        bx = body.back_x(bz)
        lump = sunion(2.0 * s, ellipsoid(np.array((bx - 1.2 * s, 0, bz), np.float32), np.array((4.4, 10.8, 6.4), np.float32) * s,
                                         rot=rot_xyz(0, -18, 0)),
                      torus(body.j("neck") + np.array((-0.8, 0, 0.5), np.float32) * s, 7.9 * s, 2.0 * s, rot=rot_xyz(0, 20, 0), squash=(1.0, 1.1)))
        front = ellipsoid(body.j("neck") + np.array((10.0, 0, -2.5), np.float32) * s, np.array((8.0, 5.2, 6.5), np.float32) * s)
        lump = ssub(lump, front, 0.9)
        lump = displace(lump, lambda P: (0.3 * value_noise(P, (3.5, 3.5, 3.0), 55)).astype(np.float32))

        def down_w(P):
            return torso_weights(body, P)

        part = SCARF if sp["coat"] in ("bomber", "denim") else COAT
        fab = KNIT if part == SCARF else sp["fabric"]
        out.append(Part("hooddown", lump, (bx - 10 * s, -16 * s, 133 * s), (12 * s, 16 * s, 157 * s), 0.55 * s, part, fab,
                        (900, 260, 80, 28), down_w))
    return out


def make_scarf(body):
    if not body.spec["scarf"]:
        return []
    s = body.s
    nk = body.j("neck")
    ring = sunion(1.2 * s,
                  torus(nk + np.array((0.9, 0, 3.1), np.float32) * s, 6.15 * s, 2.55 * s, rot=rot_xyz(0, 15, 0), squash=(1.0, 1.06)),
                  torus(nk + np.array((0.4, 0, 6.2), np.float32) * s, 5.1 * s, 1.95 * s, rot=rot_xyz(4, 9, 0), squash=(1.0, 1.02)))
    ends = []
    for cy, bottom, width in ((3.9, 122.0, 3.7), (-1.2, 133.0, 3.3)):
        zs = np.linspace(bottom * s, 149.5 * s, 8)
        cx = [body.front_x(z) + (1.05 + 0.9 * smooth(143 * s, 149.5 * s, z) * 0 + (0.55 if cy > 0 else 0.15)) * s for z in zs]
        cx[-1] -= 2.6 * s
        cx[-2] -= 0.9 * s
        ends.append(loft(zs, cx, [0.95 * s] * 8, [width * s] * 6 + [width * 0.85 * s, width * 0.7 * s], power=3.0,
                         cy=[cy * s] * 8))
    f = sunion(1.0 * s, ring, union(*ends))
    f = displace(f, lambda P: (0.34 * value_noise(P, (2.8, 2.8, 1.8), 61) + 0.16 * np.sin(P[:, 1] * 2.4 / s) * (P[:, 2] < 146 * s)).astype(np.float32))

    def weights(P):
        W = torso_weights(body, P)
        z = P[:, 2] / s
        up = smooth(149.0, 154.5, z)
        W *= (1 - up * 0.75)[:, None]
        W[:, B["neck"]] += up * 0.75
        return W

    return [Part("scarf", f, (-12 * s, -14 * s, 119 * s), (body.front_x(125 * s) + 6 * s, 14 * s, 164 * s), 0.46 * s, SCARF, KNIT,
                 (1800, 480, 130, 40), weights, normal_soft=0.4)]


def strap(body, pts, radius, name, fabric=LEATHER, part=BAG, tris=(420, 130, 40, 0)):
    s = body.s
    f = chain(pts, [radius * s] * len(pts))
    arr = np.array(pts)

    def weights(P):
        return torso_weights(body, P)

    return Part(name, f, arr.min(0) - 3, arr.max(0) + 3, 0.42 * s, part, fabric, tris, weights, ao_group="body", normal_soft=0.3)


def drape(field, pts, lift, step=2.2):
    """Resamples a strap path and settles it onto a surface, `lift` cm proud of it."""
    pts = [np.asarray(p, np.float32) for p in pts]
    dense = []
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(np.linalg.norm(b - a) / step))
        dense += [a + (b - a) * (i / n) for i in range(n)]
    dense.append(pts[-1])
    P = np.array(dense, np.float32)
    for _ in range(14):
        d = field(P)
        g = gradient(field, P, 0.4)
        P = P - g * ((d - lift) * 0.75)[:, None]
    # take the kinks out
    for _ in range(3):
        P[1:-1] = (P[:-2] + 2 * P[1:-1] + P[2:]) * 0.25
        d = field(P)
        g = gradient(field, P, 0.4)
        P = P - g * (np.minimum(d - lift, 0.0))[:, None]
    return [q for q in P]


def surface_path(body, keys, lift=0.55):
    """Lays a strap on the coat: keys are (z at 176 cm, y, which side 'f' front, 'b' back, 't' over the top)."""
    s = body.s
    out = []
    for z, y, where in keys:
        zz = z * s
        w = body.half_w(zz)
        k = max(1.0 - min(abs(y * s) / max(w, 1.0), 0.97) ** 2.4, 0.03) ** (1 / 2.4)
        mid = (body.front_x(zz) + body.back_x(zz)) * 0.5
        if where == "f":
            x = mid + (body.front_x(zz) - mid) * k + lift * s
        elif where == "b":
            x = mid + (body.back_x(zz) - mid) * k - lift * s
        else:
            x = mid
        out.append(np.array((x, y * s, zz + (lift * s if where == "t" else 0.0)), np.float32))
    return out


def make_bag(body, coat_field):
    sp = body.spec
    s = body.s
    kind = sp["bag"]
    out = []
    if kind is None:
        return out

    def chest_w(P):
        return torso_weights(body, P)

    if kind == "backpack":
        bz = 124.0 * s
        bx = body.back_x(bz) - 5.2 * s
        pack = box((bx, 0, bz), np.array((6.0, 12.6, 17.0), np.float32) * s, 4.6 * s)
        pocket = box((bx - 4.6 * s, 0, bz - 6.0 * s), np.array((2.8, 9.4, 8.2), np.float32) * s, 2.4 * s)
        f = sunion(0.9 * s, pack, pocket)
        zipper = lambda P: (0.3 * np.exp(-((P[:, 2] - bz - 9.5 * s) / (0.45 * s)) ** 2) * (P[:, 0] < bx)
                            + 0.14 * value_noise(P, (5, 5, 5), 71)).astype(np.float32)
        out.append(Part("pack", displace(f, zipper), (bx - 10 * s, -15 * s, bz - 20 * s), (bx + 9 * s, 15 * s, bz + 20 * s), 0.6 * s,
                        BAG, CANVAS, (1500, 420, 130, 50), chest_w))
        for side in (-1, 1):
            on = surface_path(body, [(139.0, side * 8.0, "b"), (146.5, side * 8.6, "b"), (148.0, side * 9.4, "t"), (145.0, side * 9.8, "f"),
                                     (137.0, side * 10.4, "f"), (128.0, side * 12.0, "f"), (120.0, side * 14.0, "f"),
                                     (114.0, side * 15.5, "f")], lift=1.2)
            pts = [np.array((bx + 3.0 * s, side * 7.6 * s, 136.0 * s), np.float32)] + drape(coat_field, on, 0.75 * s)
            pts += drape(coat_field, [pts[-1], np.array((-1.5 * s, side * (body.half_w(113 * s) + 2.0 * s), 111.5 * s), np.float32),
                                      np.array((body.back_x(111 * s) - 1.0 * s, side * 10.5 * s, 111.0 * s), np.float32)], 0.7 * s)
            out.append(strap(body, pts, 1.15, "strap%d" % (side + 1), CANVAS))
    elif kind == "messenger":
        bz = 92.0 * s
        by = -(body.half_w(bz) + 4.0 * s)
        bagf = box((-2.0 * s, by, bz), np.array((12.6, 4.2, 11.0), np.float32) * s, 2.6 * s, rot=rot_xyz(0, 0, -7))
        flap = box((-2.0 * s, by - 1.6 * s, bz + 3.8 * s), np.array((12.9, 3.2, 7.0), np.float32) * s, 1.6 * s, rot=rot_xyz(0, 0, -7))
        out.append(Part("satchel", sunion(0.5 * s, bagf, flap), (-18 * s, by - 8 * s, bz - 14 * s), (14 * s, by + 8 * s, bz + 14 * s),
                        0.55 * s, BAG, LEATHER, (800, 240, 80, 30), chest_w, ao_group="bag"))
        front = [np.array((1.0 * s, by - 0.5 * s, 101.0 * s), np.float32)]
        front += surface_path(body, [(108.0, -14.0, "f"), (121.0, -6.0, "f"), (133.0, 2.0, "f"), (143.0, 8.5, "f"), (150.2, 10.0, "t")], 0.85)
        back = surface_path(body, [(143.0, 8.5, "b"), (131.0, 1.0, "b"), (118.0, -8.0, "b"), (106.0, -14.5, "b")], 0.85)
        back.append(np.array((-6.0 * s, by - 0.5 * s, 101.0 * s), np.float32))
        mid = drape(coat_field, front[1:] + back[:-1], 0.65 * s)
        out.append(strap(body, [front[0]] + mid + [back[-1]], 0.95, "strap"))
    elif kind in ("handbag", "tote"):
        side = -1
        bz = (101.0 if kind == "handbag" else 94.0) * s
        by = side * (body.half_w(bz) + (3.6 if kind == "handbag" else 3.9) * s)
        if kind == "handbag":
            bagf = box((-1.5 * s, by, bz), np.array((12.0, 4.0, 8.4), np.float32) * s, 2.4 * s)
            fab, size = LEATHER, (800, 240, 80, 28)
        else:
            zs = np.array([-13.0, -9.0, 0.0, 9.0, 12.0]) * s + bz
            bagf = loft(zs, [-1.5 * s] * 5, np.array([11.5, 13.6, 13.0, 12.0, 11.4]) * s, np.array([3.0, 4.4, 3.8, 2.4, 1.9]) * s,
                        power=3.2, cy=[by] * 5)
            bagf = displace(bagf, lambda P: (0.3 * value_noise(P, (4, 4, 4), 73)).astype(np.float32))
            fab, size = CANVAS, (800, 240, 80, 28)
        out.append(Part("bag", bagf, (-18 * s, by - 8 * s, bz - 16 * s), (15 * s, by + 8 * s, bz + 14 * s), 0.55 * s, BAG, fab,
                        size, chest_w, ao_group="bag"))
        top = bz + 7.5 * s
        over = surface_path(body, [(130.0, side * 17.5, "f"), (139.0, side * 15.0, "f"), (146.0, side * 13.5, "t"),
                                   (139.0, side * 15.0, "b"), (130.0, side * 17.5, "b")], 1.3)
        path = [np.array((6.0 * s, by + 0.6 * s, top), np.float32)] + drape(coat_field, over, 0.62 * s)
        path += [np.array((-9.0 * s, by + 0.6 * s, top), np.float32)]
        out.append(strap(body, path, 0.72, "strap", LEATHER))
    return out


# ------------------------------------------------------------------ assembly
def build_parts(body):
    parts, arms, outer = make_coat(body)
    parts += make_legs(body)
    soles = {}
    for tag in "LR":
        shoe, sole_h = make_shoe(body, tag)
        parts.append(shoe)
        soles[tag] = sole_h
        parts.append(make_hand(body, tag))
    head, skull, _ = make_head(body)
    parts.append(head)
    hair = make_hair(body, skull)
    if hair:
        parts.append(hair)
    parts += make_hats(body, skull)
    parts += make_scarf(body)
    parts += make_bag(body, outer)
    return parts, soles


def ambient_occlusion(parts, P, N, group):
    """Occlusion from the garments themselves.  Parts that move apart from each other do not occlude."""
    arms_free = {"handL": ("body",), "handR": ("body",)}
    use = []
    for q in parts:
        if q.ao_group.startswith("hand") and group != q.ao_group:
            continue
        if group.startswith("hand") and q.ao_group == "body":
            continue
        # arms swing clear of the trunk: neither may leave its shadow baked into the other
        if (q.ao_group.startswith("arm") and group != q.ao_group) or (group.startswith("arm") and q.ao_group == "body"):
            continue
        use.append(q)
    occ = np.zeros(len(P), np.float32)
    weights = ((0.7, 0.34), (1.8, 0.30), (3.8, 0.22), (7.5, 0.14))
    for dist, w in weights:
        S = (P + N * dist).astype(np.float32)
        d = np.full(len(S), dist, np.float32)
        for q in use:
            near = np.all((S > q.lo - 8.0) & (S < q.hi + 8.0), axis=1)
            if near.any():
                d[near] = np.minimum(d[near], q.f(S[near]))
        occ += w * np.clip((dist - d) / dist, 0, 1)
    return np.clip(1.0 - occ * 0.92, 0.18, 1.0)


def encode_weights(W):
    """Keeps the three strongest bones per vertex."""
    idx = np.argsort(-W, axis=1)[:, :3]
    val = np.take_along_axis(W, idx, axis=1)
    val = np.maximum(val, 0)
    total = val.sum(axis=1, keepdims=True)
    bad = total[:, 0] < 1e-5
    val[bad] = (1, 0, 0)
    total[bad] = 1
    val = val / total
    idx[val < 1e-4] = 0
    return idx, val


def write_nmesh(path, pos, nrm, uv0, uv1, col, tris, slot="walker"):
    with open(path, "wb") as f:
        f.write(struct.pack("<IIIII", 0x48534D4E, 1, len(pos), len(tris), 1))
        b = slot.encode()
        f.write(struct.pack("<H", len(b)))
        f.write(b)
        f.write(pos.astype("<f4").tobytes())
        f.write(nrm.astype("<f4").tobytes())
        f.write(uv0.astype("<f4").tobytes())
        f.write(uv1.astype("<f4").tobytes())
        f.write(np.clip(col * 255.0 + 0.5, 0, 255).astype(np.uint8).tobytes())
        f.write(tris.astype("<u4").tobytes())
        f.write(np.zeros(len(tris), "<u2").tobytes())


def mesh_body(index, out_dir, quiet=True):
    spec = VARIANTS[index]
    body = Body(spec, index)
    parts, soles = build_parts(body)
    dense = {}
    for q in parts:
        verts, faces = polygonize(q.f, q.lo, q.hi, q.voxel)
        if len(faces):
            verts, faces = components_filter(verts, faces, 60)
        dense[q.name] = (verts, faces)
    stats = []
    for lod in range(4):
        pos, nrm, uv0, uv1, col, tri = [], [], [], [], [], []
        base = 0
        for q in parts:
            target = q.tris[lod]
            verts, faces = dense[q.name]
            if target <= 0 or len(faces) == 0:
                continue
            verts, faces = decimate(verts, faces, target, 5 if lod < 2 else 8)
            if len(faces) == 0:
                continue
            crease = 62.0 if lod < 2 else 80.0
            verts, faces, normals = shading_normals(q.f, verts, faces, crease, q.normal_soft * (1.0 + lod * 0.8))
            W = q.weights(verts)
            bone, w = encode_weights(W)
            ao = ambient_occlusion(parts, verts, normals, q.ao_group)
            part = np.full(len(verts), q.part, np.int64)
            fab = np.full(len(verts), q.fabric, np.int64)
            detail = np.zeros(len(verts), np.float32)
            z = verts[:, 2]
            if q.name == "coat" or q.name.startswith("sleeve"):
                # the underside at the hem and inside the cuffs reads as lining
                lining = (normals[:, 2] < -0.82) & (z < spec["hem"] * body.s + 2.0)
                part[lining] = LINING
            if q.name.startswith("shoe"):
                sole = z < soles[q.name[-1]]
                part[sole] = SOLE
                detail = np.clip((z / soles[q.name[-1]]), 0, 1).astype(np.float32)
            pos.append(verts)
            nrm.append(normals)
            uv0.append(np.stack([bone[:, 0] + 32 * bone[:, 1] + 1024 * bone[:, 2], part + 32 * fab], axis=1).astype(np.float64))
            uv1.append(w[:, :2])
            col.append(np.stack([ao, detail, np.zeros_like(ao), np.ones_like(ao)], axis=1))
            tri.append(faces + base)
            base += len(verts)
        P = np.concatenate(pos)
        T = np.concatenate(tri)
        name = "walker_%02d_l%d" % (index, lod)
        write_nmesh(os.path.join(out_dir, "meshes", name + ".nmesh"), P, np.concatenate(nrm), np.concatenate(uv0), np.concatenate(uv1),
                    np.concatenate(col), T)
        stats.append((name, len(P), len(T)))
    s = body.s
    z_v = 126.0 * s
    info = dict(
        name="w%02d" % index, female=spec["female"], height=spec["height"], girth=spec["girth"], pace=spec["pace"], age=spec["age"],
        joints=[[round(float(c), 3) for c in body.J[i]] for i in range(NB)],
        gripL=[round(float(c), 3) for c in body.gripL], gripR=[round(float(c), 3) for c in body.gripR],
        foot=dict(ankle=float(body.j("footL")[2]), heel=-5.5 * s, ball=13.0 * s, tip=20.5 * s),
        hipClear=float(max(body.half_w(97 * s), 15.0 * s)),
        armOut=float(max(body.half_w(92 * s) / s - 18.0, 0.0) * 0.011),
        longHem=float(spec["hem"] * s), style=spec["style"], vee=spec["vee"], veeBottom=z_v,
        headPoint=[float(c) for c in head_frame(body)], headScale=float(s * (0.955 if spec["female"] else 1.0)),
        hasBag=spec["bag"] is not None, bag=spec["bag"], backpack=spec["bag"] == "backpack", hoodUp=spec["hood"] in ("up", "up_fur"),
        gloves=spec["gloves"], hat=spec["hat"], scarf=spec["scarf"], umbrella=spec["umbrella"], props=list(spec["props"]),
        palettes=dict(coat=spec["coats"], legs=spec["legcols"], accent=spec["accents"], bag=spec["bagcols"], shoe=spec["shoecols"]),
        frontX=[float(body.front_x(z * s)) for z in (96, 108, 120, 132, 144)],
    )
    with open(os.path.join(out_dir, "info_%02d.json" % index), "w") as f:
        json.dump(info, f)
    return stats


def _job(args):
    return args[0], mesh_body(*args)


def main():
    out = os.path.abspath(sys.argv[1])
    os.makedirs(os.path.join(out, "meshes"), exist_ok=True)
    ids = [int(a) for a in sys.argv[2:]] or list(range(len(VARIANTS)))
    jobs = [(i, out) for i in ids]
    if len(jobs) > 1:
        with mp.Pool(min(8, len(jobs))) as pool:
            results = pool.map(_job, jobs)
    else:
        results = [_job(jobs[0])]
    for i, stats in results:
        print("variant %02d:" % i, "  ".join("%s %dv/%dt" % (n[-2:], nv, nt) for n, nv, nt in stats))
    import walker_props as props
    props.main(out)
    variants = []
    for i in range(len(VARIANTS)):
        p = os.path.join(out, "info_%02d.json" % i)
        if os.path.exists(p):
            with open(p) as f:
                variants.append(json.load(f))
    with open(os.path.join(out, "walkers.json"), "w") as f:
        json.dump(dict(bones=BONES, variants=variants, skins=SKINS, hairs=HAIRS, props=props.PROP_LIST), f)
    manifest = []
    for fn in sorted(os.listdir(os.path.join(out, "meshes"))):
        if fn.endswith(".nmesh"):
            manifest.append(dict(name=fn[:-6], nanite=False, cards=0, preserve=False))
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(dict(meshes=manifest), f)


if __name__ == "__main__":
    main()
