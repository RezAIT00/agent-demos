"""Street furniture meshes and their placement, including the signal assemblies."""
import math

import numpy as np

import city as C
import citydata as D
from meshlib import MeshBuilder
from streets import street_numbers, street_gap, avenue_gap, avenues_for_interval
from signs import STREET_CELLS, ONEWAY_CELL, NOSTAND_CELL, SUBWAY_CELL

CH = D.CURB_H


def quad_uv(mb, x0, x1, z0, z1, y, slot, ny=1):
    """A sign face in the module convention: u runs left to right as read, v downward."""
    if ny > 0:
        pts = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    else:
        pts = [(x1, y, z0), (x0, y, z0), (x0, y, z1), (x1, y, z1)]
    mb.poly(pts, slot, normal=(0, ny, 0), uv=[(0, 1), (1, 1), (1, 0), (0, 0)])


# =========================================================================== meshes
def signquad(w, h, slot):
    mb = MeshBuilder()
    quad_uv(mb, 0.0, w, 0.0, h, 0.0, slot)
    return mb


def blade(slot="sign_street"):
    """Two-sided street-name blade, centred, in the x-z plane."""
    mb = MeshBuilder()
    quad_uv(mb, -0.62, 0.62, -0.13, 0.13, 0.013, slot, 1)
    quad_uv(mb, -0.62, 0.62, -0.13, 0.13, -0.013, slot, -1)
    mb.box((-0.64, -0.012, -0.145), (0.64, 0.012, 0.145), "paint_darkgreen", faces="xXzZ")
    return mb


def small_sign(w, h):
    mb = MeshBuilder()
    quad_uv(mb, -w / 2, w / 2, -h / 2, h / 2, 0.012, "sign_street", 1)
    mb.quad((-w / 2, -0.01, -h / 2), (w / 2, -0.01, -h / 2), (w / 2, -0.01, h / 2), (-w / 2, -0.01, h / 2), "galvanized", normal=(0, -1, 0))
    return mb


def streetlight():
    """Cobra head on a tapered pole.  +y is toward the road."""
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.2, 0), (0.2, 0.5), (0.15, 0.6), (0.125, 0.9)], "galvanized", segments=10)
    mb.tube([(0, 0, 0.9), (0, 0, 8.4)], [0.125, 0.075], 10, "galvanized", caps=False)
    arm = [(0, 0, 8.2), (0, 0.25, 8.75), (0, 0.8, 9.05), (0, 2.35, 9.1)]
    mb.tube(arm, 0.045, 8, "galvanized", caps=False)
    mb.tube([(0, 0, 7.5), (0, 1.15, 9.02)], 0.02, 5, "galvanized", caps=False)
    mb.sphere((0, 2.62, 9.08), 0.2, "paint_gray", segments=14, rings=8, scale=(0.85, 1.9, 0.55))
    mb.box((-0.13, 2.46, 8.93), (0.13, 2.86, 8.985), "street_lens", faces="zxXyY")
    mb.box((-0.04, 2.42, 9.15), (0.04, 2.5, 9.28), "plastic_black")
    return mb


def parklamp():
    """The ornate cast-iron post with a glazed lantern used in the park and on the terrace."""
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.24, 0), (0.22, 0.12), (0.13, 0.35), (0.16, 0.55), (0.085, 0.8), (0.06, 3.0), (0.09, 3.06), (0.05, 3.2)], "paint_darkgreen", segments=12)
    mb.lathe((0, 0, 3.2), [(0.1, 0), (0.22, 0.12), (0.26, 0.5), (0.2, 0.56)], "lamp_globe", segments=12)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        mb.tube([(0.11 * math.cos(a), 0.11 * math.sin(a), 3.2), (0.265 * math.cos(a), 0.265 * math.sin(a), 3.72)], 0.012, 4, "paint_darkgreen")
    mb.lathe((0, 0, 3.74), [(0.3, 0), (0.12, 0.14), (0.04, 0.18), (0.06, 0.25), (0.0, 0.34)], "paint_darkgreen", segments=12)
    return mb


def signal_pole():
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.26, 0), (0.25, 0.12), (0.17, 0.5), (0.13, 0.62)], "paint_darkgreen", segments=12)
    mb.tube([(0, 0, 0.62), (0, 0, 6.5)], [0.125, 0.095], 10, "paint_darkgreen", caps=True)
    mb.sphere((0, 0, 6.55), 0.11, "paint_darkgreen", segments=8, rings=6)
    mb.box((-0.14, -0.17, 1.15), (0.14, -0.1, 1.5), "galvanized")
    return mb


def mast_arm():
    """Reaches along +y from the top of a signal pole."""
    mb = MeshBuilder()
    mb.tube([(0, 0, 5.75), (0, 2.0, 6.0), (0, 6.4, 6.02)], [0.085, 0.07, 0.05], 8, "paint_darkgreen")
    mb.tube([(0, 0, 6.45), (0, 4.2, 6.04)], 0.022, 5, "paint_darkgreen", caps=False)
    return mb


def signal_head():
    """Three-section head, lenses facing +y, centred on the yellow lamp."""
    mb = MeshBuilder()
    mb.box((-0.19, -0.14, -0.55), (0.19, 0.12, 0.55), "paint_yellow")
    mb.box((-0.045, -0.05, 0.55), (0.045, 0.05, 0.72), "paint_darkgreen")
    for z in (0.34, 0.0, -0.34):
        mb.lathe((0, 0, 0), [(0.0, 0.0)], "plastic_black")
        ring = MeshBuilder()
        ring.lathe((0, 0, 0), [(0.15, 0.0), (0.152, 0.015), (0.125, 0.016), (0.123, 0.0)], "plastic_black", segments=16)
        mb.merge(ring, offset=(0, 0.121, z), roll=-90.0)
        pts = []
        for k in range(11):
            a = math.pi * (-0.08 + 1.16 * k / 10)
            pts.append((0.145 * math.cos(a), 0.145 * math.sin(a)))
        for i in range(10):
            (ax, az), (bx, bz) = pts[i], pts[i + 1]
            mb.quad((ax, 0.12, z + az), (bx, 0.12, z + bz), (bx, 0.34, z + bz * 0.97), (ax, 0.34, z + az * 0.97), "plastic_black", normal=(ax, 0, az))
            mb.quad((ax * 0.97, 0.12, z + az * 0.97), (bx * 0.97, 0.12, z + bz * 0.97), (bx * 0.95, 0.34, z + bz * 0.94), (ax * 0.95, 0.34, z + az * 0.94), "plastic_black", normal=(-ax, 0, -az))
    return mb


def lamp_disc():
    mb = MeshBuilder()
    m = MeshBuilder()
    m.lathe((0, 0, 0), [(0.122, 0.0), (0.1, 0.022), (0.05, 0.034), (0.0, 0.037)], "signal_lamp", segments=18)
    mb.merge(m, roll=-90.0)
    return mb


def ped_head():
    mb = MeshBuilder()
    mb.box((-0.23, -0.1, -0.24), (0.23, 0.08, 0.24), "plastic_black")
    return mb


def ped_face():
    mb = MeshBuilder()
    quad_uv(mb, -0.19, 0.19, -0.2, 0.2, 0.085, "ped_signal")
    return mb


def hydrant():
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.2, 0), (0.2, 0.05), (0.14, 0.07), (0.125, 0.12), (0.12, 0.52), (0.165, 0.54), (0.165, 0.6), (0.13, 0.62)], "iron_black", segments=14)
    mb.lathe((0, 0, 0.62), [(0.13, 0), (0.12, 0.06), (0.075, 0.12), (0.0, 0.14)], "galvanized", segments=14)
    mb.cylinder((0, 0, 0.75), 0.07, 0.035, "galvanized", segments=6)
    for ang, r, ln in ((0, 0.085, 0.2), (180, 0.062, 0.185), (90, 0.062, 0.185)):
        a = math.radians(ang)
        mb.tube([(0.08 * math.cos(a), 0.08 * math.sin(a), 0.42), (ln * math.cos(a), ln * math.sin(a), 0.42)], r, 10, "iron_black")
        mb.tube([(ln * math.cos(a), ln * math.sin(a), 0.42), ((ln + 0.035) * math.cos(a), (ln + 0.035) * math.sin(a), 0.42)], r * 1.1, 8, "galvanized")
    return mb


def mailbox():
    mb = MeshBuilder()
    for x in (-0.24, 0.24):
        for y in (-0.2, 0.2):
            mb.box((x - 0.035, y - 0.035, 0), (x + 0.035, y + 0.035, 0.22), "paint_blue")
    mb.box((-0.3, -0.27, 0.2), (0.3, 0.27, 1.05), "paint_blue", faces="xXyYz")
    arc = [(0.27 * math.cos(math.pi * k / 10), 1.05 + 0.24 * math.sin(math.pi * k / 10)) for k in range(11)]
    for i in range(10):
        (ya, za), (yb, zb) = arc[i], arc[i + 1]
        mb.quad((-0.3, ya, za), (0.3, ya, za), (0.3, yb, zb), (-0.3, yb, zb), "paint_blue", normal=(0, (ya + yb), (za + zb) - 2.1))
    for s, x in ((-1, -0.3), (1, 0.3)):
        mb.poly([(x, y, z) for y, z in arc], "paint_blue", normal=(s, 0, 0))
    mb.box((-0.22, 0.27, 0.9), (0.22, 0.3, 0.97), "chrome")
    mb.box((-0.2, 0.271, 0.45), (0.2, 0.276, 0.68), "paint_white", faces="Y")
    return mb


def newsbox():
    mb = MeshBuilder()
    mb.box((-0.06, -0.06, 0), (0.06, 0.06, 0.32), "iron_black")
    mb.box((-0.17, -0.14, 0), (0.17, 0.14, 0.04), "iron_black")
    mb.box((-0.25, -0.2, 0.32), (0.25, 0.2, 1.12), "newsbox")
    mb.box((-0.2, 0.2, 0.68), (0.2, 0.215, 1.02), "glass_dark", faces="Y")
    quad_uv(mb, -0.22, 0.22, 0.4, 0.62, 0.217, "sign_news")
    mb.box((-0.06, 0.2, 1.045), (0.06, 0.235, 1.08), "chrome")
    return mb


def litter_basket(full=True):
    """The green steel-strap corner basket."""
    mb = MeshBuilder()
    n = 26
    for k in range(n):
        a = 2 * math.pi * k / n
        mb.tube([(0.25 * math.cos(a), 0.25 * math.sin(a), 0.03), (0.31 * math.cos(a), 0.31 * math.sin(a), 0.92)], 0.011, 4, "basket_green", caps=False)
    for z, r in ((0.04, 0.252), (0.36, 0.273), (0.66, 0.292), (0.93, 0.312)):
        mb.lathe((0, 0, z), [(r + 0.014, 0), (r + 0.018, 0.022), (r - 0.008, 0.026), (r - 0.008, 0)], "basket_green", segments=26)
    mb.lathe((0, 0, 0.05), [(0.0, 0.0), (0.22, 0.0), (0.285, 0.8), (0.31, 0.87)], "trash_bag", segments=14)
    if full:
        rng = np.random.default_rng(3)
        for _ in range(16):
            p = (rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18), rng.uniform(0.78, 0.97))
            mb.sphere(p, rng.uniform(0.035, 0.085), ["cardboard", "paint_white", "paint_white", "paint_red", "paint_gray"][int(rng.integers(5))],
                      segments=7, rings=5, scale=(1.2, 1, 0.6), noise=0.28, seed=int(rng.integers(99)))
    return mb


def trash_bags(seed=0):
    mb = MeshBuilder()
    rng = np.random.default_rng(seed + 50)
    n = int(rng.integers(5, 10))
    for i in range(n):
        x = rng.uniform(-0.9, 0.9)
        y = rng.uniform(-0.35, 0.35)
        r = rng.uniform(0.24, 0.38)
        z = r * 0.62 + (0.32 if i > n * 0.62 else 0.0)
        slot = "trash_bag" if rng.random() < 0.82 else "bag_clear"
        mb.sphere((x, y, z), r, slot, segments=20, rings=14, scale=(rng.uniform(0.9, 1.15), rng.uniform(0.85, 1.1), rng.uniform(0.68, 0.85)), noise=0.085, seed=seed * 17 + i)
        top = (x + rng.uniform(-0.05, 0.05), y, z + r * 0.66)
        mb.tube([top, (top[0] + rng.uniform(-0.06, 0.06), top[1], top[2] + 0.12)], [0.075, 0.012], 7, slot)
    for _ in range(int(rng.integers(1, 4))):
        mb.obox((rng.uniform(-1.3, 1.3), rng.uniform(-0.3, 0.45), 0.06), (rng.uniform(0.5, 0.9), rng.uniform(0.4, 0.7), 0.1), rng.uniform(0, 180), "cardboard")
    return mb


def manhole():
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.46, 0.0), (0.45, 0.006), (0.4, 0.006), (0.392, 0.002), (0.37, 0.002), (0.362, 0.007), (0.0, 0.007)], "castiron_road", segments=36)
    for r in (0.11, 0.23, 0.31):
        n = int(r * 60)
        for k in range(n):
            a = 2 * math.pi * k / n
            mb.obox((r * math.cos(a), r * math.sin(a), 0.0085), (0.05, 0.026, 0.004), math.degrees(a), "castiron_road", faces="xXyYZ")
    return mb


def utility_plate():
    mb = MeshBuilder()
    mb.box((-0.55, -0.4, 0.0), (0.55, 0.4, 0.006), "castiron_road", faces="xXyYZ")
    for x in np.arange(-0.48, 0.49, 0.12):
        for y in np.arange(-0.34, 0.35, 0.11):
            mb.obox((x, y, 0.0075), (0.07, 0.022, 0.004), 45 if int(x * 100) % 2 else -45, "castiron_road", faces="xXyYZ")
    return mb


def catchbasin():
    mb = MeshBuilder()
    mb.box((-0.55, -0.21, 0.0), (0.55, 0.21, 0.004), "paint_black", faces="Z")
    for x in np.arange(-0.52, 0.53, 0.095):
        mb.box((x - 0.022, -0.2, 0.004), (x + 0.022, 0.2, 0.012), "castiron_road", faces="xXyYZ")
    for y in (-0.205, 0.205):
        mb.box((-0.56, y - 0.02, 0.004), (0.56, y + 0.02, 0.013), "castiron_road", faces="xXyYZ")
    return mb


def vent_grate():
    """Subway ventilation grating set in the sidewalk, long axis along x."""
    mb = MeshBuilder()
    mb.box((-2.4, -0.72, 0.0), (2.4, 0.72, 0.003), "paint_black", faces="Z")
    for x in np.arange(-2.36, 2.37, 0.075):
        mb.box((x - 0.012, -0.68, 0.003), (x + 0.012, 0.68, 0.012), "galvanized", faces="xXZ")
    for y in (-0.7, -0.23, 0.23, 0.7):
        mb.box((-2.4, y - 0.025, 0.003), (2.4, y + 0.025, 0.0135), "galvanized", faces="yYZ")
    return mb


def tactile():
    mb = MeshBuilder()
    mb.box((-0.62, -0.31, 0.0), (0.62, 0.31, 0.008), "tactile_red", faces="xXyYZ")
    for x in np.arange(-0.54, 0.55, 0.12):
        for y in np.arange(-0.24, 0.25, 0.12):
            mb.lathe((x, y, 0.008), [(0.028, 0), (0.018, 0.007), (0.0, 0.008)], "tactile_red", segments=8)
    return mb


def subway_entrance():
    """Stairwell down to the trains: railings on three sides, globe lamps and the station sign.
    Long axis along x; people enter from +x.  The stairs are faked with a dark recessed box."""
    mb = MeshBuilder()
    L, W = 4.6, 1.9
    steps = 9
    for i in range(steps):
        x1 = L / 2 - i * 0.45
        z = 0.02 + 0.012 * 0
        mb.box((x1 - 0.45, -W / 2, 0.003), (x1, W / 2, 0.006 + 0.0006 * (steps - i)), "stair_dark" if i > 4 else ("stair_mid" if i > 1 else "stair_lit"), faces="Z")
        mb.box((x1 - 0.03, -W / 2, 0.007), (x1, W / 2, 0.012), "paint_yellow" if i == 0 else "galvanized", faces="Z")
    G = "paint_darkgreen"
    runs = [((-L / 2, -W / 2), (L / 2, -W / 2)), ((-L / 2, W / 2), (L / 2, W / 2)), ((-L / 2, -W / 2), (-L / 2, W / 2))]
    for (ax, ay), (bx, by) in runs:
        mb.tube([(ax, ay, 1.08), (bx, by, 1.08)], 0.04, 6, G)
        mb.tube([(ax, ay, 0.16), (bx, by, 0.16)], 0.025, 5, G)
        n = max(2, int(math.hypot(bx - ax, by - ay) / 0.13))
        for i in range(n + 1):
            x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            mb.box((x - 0.011, y - 0.011, 0.0), (x + 0.011, y + 0.011, 1.08), G, faces="xXyY")
        mb.box((min(ax, bx) - 0.07, min(ay, by) - 0.07, 0.0), (max(ax, bx) + 0.07, max(ay, by) + 0.07, 0.09), "granite", faces="xXyYZ")
    for x, y in ((L / 2, -W / 2), (L / 2, W / 2)):
        mb.tube([(x, y, 0), (x, y, 2.35)], 0.055, 8, G)
        mb.lathe((x, y, 2.35), [(0.07, 0), (0.17, 0.08), (0.2, 0.22), (0.16, 0.34)], "globe_green", segments=14)
        mb.lathe((x, y, 2.69), [(0.16, 0), (0.1, 0.09), (0.0, 0.13)], "globe_white", segments=14)
    for y in (-W / 2, W / 2):
        mb.tube([(L / 2 - 0.5, y, 1.08), (L / 2 - 0.5, y, 2.15)], 0.03, 6, G)
    quad_uv(mb, -1.0, 1.0, 2.05, 2.55, W / 2 + 0.03, "sign_subway", 1)
    m = MeshBuilder()
    quad_uv(m, -1.0, 1.0, 2.05, 2.55, 0.0, "sign_subway", 1)
    mb.merge(m, offset=(L / 2 + 0.02, 0, 0), yaw=-90.0)
    for x in (-1.0, 1.0):
        mb.tube([(x, W / 2, 1.08), (x, W / 2, 2.1)], 0.03, 6, G)
    mb.box((-1.03, W / 2 - 0.02, 2.02), (1.03, W / 2 + 0.025, 2.58), "paint_black", faces="yzZxX")
    return mb


def steam_stack():
    """The orange-and-white chimney set over a leaking steam main."""
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.42, 0), (0.42, 0.05), (0.3, 0.12), (0.24, 0.3)], "paint_orange", segments=18)
    z = 0.3
    for i in range(5):
        slot = "paint_orange" if i % 2 == 0 else "paint_white"
        mb.lathe((0, 0, z), [(0.215, 0), (0.205, 0.46)], slot, segments=18)
        z += 0.46
    mb.lathe((0, 0, z), [(0.225, 0), (0.24, 0.08), (0.19, 0.09), (0.18, 0.02)], "plastic_black", segments=18)
    return mb


def bus_shelter():
    mb = MeshBuilder()
    for x in (-2.1, 2.1):
        for y in (-0.7, 0.5):
            mb.box((x - 0.04, y - 0.04, 0), (x + 0.04, y + 0.04, 2.55), "steel")
    mb.box((-2.3, -0.85, 2.55), (2.3, 0.8, 2.66), "paint_darkgray")
    mb.box((-2.15, -0.7, 2.53), (2.15, 0.65, 2.55), "canopy_light", faces="z")
    mb.quad((-2.05, -0.7, 0.25), (2.05, -0.7, 0.25), (2.05, -0.7, 2.3), (-2.05, -0.7, 2.3), "glass_clear", normal=(0, 1, 0))
    mb.box((2.08, -0.65, 0.35), (2.16, 0.45, 2.15), "paint_darkgray")
    m = MeshBuilder()
    quad_uv(m, -0.5, 0.5, 0.45, 2.05, 0.0, "sign_ad")
    mb.merge(m, offset=(2.075, -0.1, 0.0), yaw=90.0)
    mb.merge(m, offset=(2.168, -0.1, 0.0), yaw=-90.0)
    mb.box((-1.7, -0.55, 0.45), (0.9, -0.2, 0.52), "steel")
    for x in (-1.5, 0.7):
        mb.box((x - 0.03, -0.45, 0), (x + 0.03, -0.35, 0.45), "steel")
    return mb


def food_cart():
    mb = MeshBuilder()
    mb.box((-1.15, -0.55, 0.55), (1.15, 0.55, 1.35), "steel_bright")
    mb.box((-1.15, -0.55, 1.35), (1.15, -0.45, 2.15), "steel_bright")
    for x in (-1.1, 1.05):
        mb.box((x, -0.5, 1.35), (x + 0.05, 0.5, 2.15), "steel")
    quad_uv(mb, -1.1, 1.1, 1.8, 2.15, 0.52, "sign_cart")
    mb.box((-1.25, -0.65, 2.15), (1.25, 0.65, 2.24), "paint_red")
    mb.box((-1.05, -0.45, 2.12), (1.05, 0.45, 2.148), "canopy_light", faces="z")
    mb.box((-1.05, 0.55, 0.65), (1.05, 0.565, 1.25), "paint_yellow", faces="Y")
    for x in (-0.75, 0.75):
        m = MeshBuilder()
        m.lathe((0, 0, -0.08), [(0.0, 0), (0.3, 0.0), (0.33, 0.04), (0.33, 0.12), (0.3, 0.16), (0.0, 0.16)], "rubber", segments=16)
        mb.merge(m, offset=(x, 0.62, 0.33), roll=90.0)
        mb.merge(m, offset=(x, -0.62, 0.33), roll=90.0)
    mb.box((-0.95, -0.4, 1.36), (0.95, 0.35, 1.42), "paint_darkgray")
    return mb


def bike_rack():
    mb = MeshBuilder()
    for x in (-0.55, 0.0, 0.55):
        mb.tube([(x, -0.28, 0), (x, -0.28, 0.72), (x, -0.16, 0.86), (x, 0.16, 0.86), (x, 0.28, 0.72), (x, 0.28, 0)], 0.026, 7, "galvanized", caps=False)
    return mb


def bollard():
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.13, 0), (0.12, 0.86), (0.135, 0.88), (0.135, 0.94), (0.06, 0.99), (0.0, 1.0)], "iron_black", segments=12)
    return mb


def muni_meter():
    mb = MeshBuilder()
    mb.box((-0.04, -0.04, 0), (0.04, 0.04, 1.0), "galvanized")
    mb.box((-0.2, -0.14, 1.0), (0.2, 0.14, 1.62), "paint_darkgreen")
    mb.box((-0.14, 0.14, 1.3), (0.14, 0.15, 1.52), "glass_dark", faces="Y")
    mb.box((-0.24, -0.17, 1.66), (0.24, 0.17, 1.69), "solar_panel")
    return mb


def tree_pit():
    mb = MeshBuilder()
    mb.box((-0.75, -0.75, 0.0), (0.75, 0.75, 0.004), "soil", faces="Z")
    for k in np.arange(-0.72, 0.73, 0.12):
        mb.box((k - 0.012, -0.74, 0.004), (k + 0.012, -0.22, 0.016), "iron_black", faces="xXZ")
        mb.box((k - 0.012, 0.22, 0.004), (k + 0.012, 0.74, 0.016), "iron_black", faces="xXZ")
    for s in (-1, 1):
        mb.box((s * 0.78 - 0.025, -0.8, 0.0), (s * 0.78 + 0.025, 0.8, 0.45), "iron_black")
    return mb


def planter():
    mb = MeshBuilder()
    mb.box((-0.9, -0.45, 0), (0.9, 0.45, 0.62), "concrete_light", faces="xXyY")
    mb.box((-0.96, -0.51, 0.62), (0.96, 0.51, 0.72), "concrete_light")
    mb.box((-0.82, -0.37, 0.6), (0.82, 0.37, 0.66), "soil", faces="Z")
    return mb


def planter_shrub():
    mb = MeshBuilder()
    rng = np.random.default_rng(8)
    for i in range(7):
        x, y = rng.uniform(-0.6, 0.6), rng.uniform(-0.35, 0.35)
        h = rng.uniform(0.45, 1.0)
        mb.lathe((x, y, 0.0), [(h * 0.34, 0.06), (h * 0.1, h * 0.72), (0.0, h)], "needle", segments=9)
        for k in range(46):
            a, t = rng.uniform(0, 6.28), rng.uniform(0.05, 0.9)
            r = h * 0.36 * (1 - t) + 0.03
            p = np.array((x + r * math.cos(a), y + r * math.sin(a), h * t))
            q = p + np.array((0.12 * math.cos(a), 0.12 * math.sin(a), -0.03))
            side = np.array((-math.sin(a), math.cos(a), 0.0)) * 0.045
            mb.poly([p - side, q, p + side], "needle", normal=(math.cos(a), math.sin(a), 0.8))
    return mb


def beacon():
    mb = MeshBuilder()
    mb.sphere((0, 0, 0), 0.45, "beacon_red", segments=10, rings=7)
    return mb


def all_meshes():
    m = {
        "signquad": signquad(4.0, 1.0, "sign_shop"), "ghostquad": signquad(4.0, 2.5, "sign_ghost"),
        "billboard": signquad(8.0, 4.0, "sign_billboard"), "blade": blade(), "oneway": small_sign(0.95, 0.32),
        "nostanding": small_sign(0.32, 0.46), "streetlight": streetlight(), "parklamp": parklamp(),
        "signalpole": signal_pole(), "mastarm": mast_arm(), "signalhead": signal_head(), "lampdisc": lamp_disc(),
        "pedhead": ped_head(), "pedface": ped_face(), "hydrant": hydrant(), "mailbox": mailbox(), "newsbox": newsbox(),
        "litterbasket": litter_basket(True), "trashbags0": trash_bags(0), "trashbags1": trash_bags(1), "trashbags2": trash_bags(2),
        "manhole": manhole(), "utility_plate": utility_plate(), "catchbasin": catchbasin(), "ventgrate": vent_grate(),
        "tactile": tactile(), "subway": subway_entrance(), "steamstack": steam_stack(), "busshelter": bus_shelter(),
        "foodcart": food_cart(), "bikerack": bike_rack(), "bollard": bollard(), "munimeter": muni_meter(),
        "treepit": tree_pit(), "planter": planter(), "planter_shrub": planter_shrub(), "beacon": beacon(),
    }
    return m


# =========================================================================== placement
NEWS_COLORS = ["paint_red", "paint_blue", "paint_yellow", "paint_white", "paint_darkgreen", "paint_orange", "paint_darkgray"]


class Furnisher:
    def __init__(self, city, streets):
        self.c = city
        self.st = streets
        self.lamps = []      # signal lamps for the traffic actor
        self.peds = []       # pedestrian walking paths
        self.crossings = []

    # ------------------------------------------------------------------ signals
    def head(self, x, y, z, yaw, group, offset):
        """A vehicle signal head plus its three lamps."""
        self.c.inst("signalhead", (x, y, z), yaw, rt=False)
        a = math.radians(yaw)
        fx, fy = -math.sin(a), math.cos(a)
        for k, dz in enumerate((0.34, 0.0, -0.34)):
            self.lamps.append((x + fx * 0.122, y + fy * 0.122, z + dz, yaw, k, group, offset))

    def ped(self, x, y, z, yaw, group, offset):
        self.c.inst("pedhead", (x, y, z), yaw, rt=False)
        a = math.radians(yaw)
        fx, fy = -math.sin(a), math.cos(a)
        self.lamps.append((x + fx * 0.002, y + fy * 0.002, z, yaw, 3, group, offset))

    def intersections(self):
        c = self.c
        for name, (ya, row, road, d) in D.AVENUES.items():
            if not (D.SIM_Y[0] - 10 <= ya <= D.SIM_Y[1]):
                continue
            for n in street_numbers(*D.SIM_X):
                sx = D.street_x(n)
                if avenue_gap(name, sx + 20) and avenue_gap(name, sx - 20):
                    continue
                if street_gap(n, ya - 25) and street_gap(n, ya + 25):
                    continue
                rs = D.street_road_width(n)
                off = D.signal_offset(name, sx)
                ex, ey = rs / 2 + 0.75, road / 2 + 0.75
                self.st.signals.append((sx, ya, off))
                ave_dirs = [1, -1] if d == 0 else [d]
                sd = D.street_dir(n)
                st_dirs = [1, -1] if sd == 0 else [sd]
                poles = set()
                mast = set()
                for dd in ave_dirs:
                    x = sx + dd * ex
                    yaw = 90.0 if dd > 0 else -90.0            # lenses face oncoming traffic
                    yr, yl = ya + dd * ey, ya - dd * ey
                    poles.add((x, yr))
                    arm_yaw = 180.0 if dd > 0 else 0.0         # arm reaches from the kerb over the road
                    c.inst("mastarm", (x, yr, CH), arm_yaw, rt=False)
                    for reach in (2.6, min(6.1, road * 0.42)):
                        self.head(x, yr - dd * reach, 5.45, yaw, 0, off)
                    poles.add((x, yl))
                    self.head(x - dd * 0.28, yl, 3.75, yaw, 0, off)
                for e in st_dirs:
                    y = ya + e * ey
                    xr, xl = sx - e * ex, sx + e * ex
                    yaw = 180.0 if e > 0 else 0.0
                    poles.add((xr, y))
                    poles.add((xl, y))
                    self.head(xr, y - e * 0.3, 3.75, yaw, 1, off)
                    self.head(xl, y - e * 0.3, 3.75, yaw, 1, off)
                for (px, py) in poles:
                    sgx = 1 if px > sx else -1
                    sgy = 1 if py > ya else -1
                    c.inst("signalpole", (px, py, CH), 0.0)
                    # walk signals: crossing the avenue runs with the street phase and vice versa
                    self.ped(px, py - sgy * 0.24, 2.85, 180.0 if sgy > 0 else 0.0, 1, off)
                    self.ped(px - sgx * 0.24, py, 2.35, 90.0 if sgx > 0 else -90.0, 0, off)
                    if (sgx > 0) == (sgy > 0):
                        ave_label = STREET_CELLS.get(name, STREET_CELLS["5th"])
                        st_label = STREET_CELLS.get("st%d" % n, STREET_CELLS["st42"])
                        c.inst("blade", (px, py, 3.25 + 2.0), 90.0, custom=(float(st_label), 0.35, 0, 0), rt=False, shadow=False)
                        c.inst("blade", (px, py, 3.25 + 2.3), 0.0, custom=(float(ave_label), 0.35, 0, 0), rt=False, shadow=False)
                    if sd != 0 and sgx < 0:
                        c.inst("oneway", (px, py - sgy * 0.15, 4.35), 90.0 if sgx > 0 else -90.0, custom=(float(ONEWAY_CELL[(sd * (-1 if sgx > 0 else 1)) > 0]), 0.3, 0, 0), rt=False, shadow=False)
                    if d != 0 and sgy < 0:
                        c.inst("oneway", (px - sgx * 0.15, py, 4.35), 180.0 if sgy > 0 else 0.0, custom=(float(ONEWAY_CELL[d > 0]), 0.3, 0, 0), rt=False, shadow=False)

    # ------------------------------------------------------------------ streetlights
    def streetlights(self):
        c = self.c
        rng = c.rng

        def lamp(x, y, yaw, near):
            c.inst("streetlight", (x, y, CH), yaw, rt=False)
            a = math.radians(yaw)
            fx, fy = -math.sin(a), math.cos(a)
            sodium = rng.random() < 0.12
            col = (1.0, 0.56, 0.2) if sodium else (1.0, 0.79, 0.56)
            pos = (x + fx * 2.66, y + fy * 2.66, CH + 8.86)
            c.light(pos, (fx * 0.16, fy * 0.16, -1.0), col, float(rng.uniform(3800, 5200)), 30, 76.0, C.LK_STREET,
                    shadows=near, source=14, volumetric=1.0)

        for name, (ya, row, road, d) in D.AVENUES.items():
            if not -960 < ya < 1100:
                continue
            x = -1000.0
            side = 1
            while x < 760:
                x += 27.0 + float(rng.uniform(-2, 2))
                side = -side
                if avenue_gap(name, x):
                    continue
                if any(abs(x - D.street_x(n)) < D.street_road_width(n) / 2 + 3 for n in range(28, 55)):
                    x += 9
                    continue
                near = c_near(x, ya)
                if not near and (abs(x) > 700 or rng.random() < 0.25):
                    continue
                lamp(x, ya + side * (road / 2 + 0.55), 180.0 if side > 0 else 0.0, near)
        for n in street_numbers(-780, 560):
            sx = D.street_x(n)
            road = D.street_road_width(n)
            y = -900.0
            side = 1
            while y < 1060:
                y += 33.0 + float(rng.uniform(-2, 2))
                side = -side
                if street_gap(n, y) or any(abs(y - a[0]) < a[2] / 2 + 3 for a in D.AVENUES.values()):
                    continue
                near = c_near(sx, y)
                if not near and rng.random() < 0.4:
                    continue
                lamp(sx + side * (road / 2 + 0.55), y, 90.0 if side > 0 else -90.0, near)

    # ------------------------------------------------------------------ everything on the sidewalk
    def kerbside(self):
        c = self.c
        rng = c.rng
        for n in range(33, 48):
            xa = D.street_x(n) + D.street_road_width(n) / 2
            xb = D.street_x(n + 1) - D.street_road_width(n + 1) / 2
            aves = avenues_for_interval(n)
            for (ya, ra, _, na), (yb, rb, _, nb) in zip(aves[:-1], aves[1:]):
                p, q = ya + ra / 2, yb - rb / 2
                if not (-720 < (p + q) / 2 < 760 and -760 < (xa + xb) / 2 < 470):
                    continue
                if (na == "6th" and nb == "5th" and n in (40, 41)):
                    continue
                if na == "Vanderbilt" and nb == "Lexington":
                    continue
                near = c_near((xa + xb) / 2, (p + q) / 2)
                dens = 1.0 if near else 0.4
                # four kerbs: (along axis, fixed coordinate, inward sign, start, end, yaw facing the road)
                sides = [("y", xa, 1, p, q, 90.0), ("y", xb, -1, p, q, -90.0), ("x", p, 1, xa, xb, 180.0), ("x", q, -1, xa, xb, 0.0)]
                for axis, fixed, inward, s0, s1, yaw in sides:
                    def at(s, depth):
                        return (fixed + inward * depth, s, CH) if axis == "y" else (s, fixed + inward * depth, CH)

                    L = s1 - s0
                    if L < 14:
                        continue
                    taken = []

                    def free(s, w):
                        return all(abs(s - t) > (w + tw) / 2 for t, tw in taken)

                    def put(mesh, s, depth, w, yw=None, **kw):
                        if free(s, w) and s0 + 4.5 < s < s1 - 4.5:
                            taken.append((s, w))
                            c.inst(mesh, at(s, depth), yaw if yw is None else yw, **kw)
                            return True
                        return False

                    # corners: a basket at each, a mailbox or paper boxes at some
                    for s in (s0 + 5.0, s1 - 5.0):
                        if rng.random() < 0.9 * dens:
                            put("litterbasket", s, 0.75, 0.9, yw=float(rng.uniform(0, 360)))
                    if rng.random() < 0.4 * dens:
                        put("mailbox", s0 + 6.4, 0.85, 1.0)
                    if rng.random() < 0.5 * dens:
                        s = s1 - 6.3
                        for k in range(int(rng.integers(2, 5))):
                            if put("newsbox", s - k * 0.62, 0.8, 0.58, override="newsbox=" + NEWS_COLORS[int(rng.integers(len(NEWS_COLORS)))],
                                   custom=(float(rng.integers(8)), 0.15, 0.0, 0.0)):
                                pass
                    for _ in range(int(L / 55) + 1):
                        if rng.random() < 0.75 * dens:
                            put("hydrant", float(rng.uniform(s0 + 8, s1 - 8)), 0.62, 1.4)
                    side_street = axis == "x" and False
                    is_street = axis == "x"
                    on_avenue_side = axis == "x"
                    # axis "y" runs along a cross street, axis "x" along an avenue
                    along_street = axis == "y"
                    if along_street and rng.random() < 0.85:
                        s = s0 + float(rng.uniform(9, 20))
                        while s < s1 - 8:
                            if rng.random() < 0.62 * (1.0 if near else 0.55) and free(s, 2.0):
                                taken.append((s, 1.8))
                                if any(math.hypot(at(s, 1.05)[0] - tx, at(s, 1.05)[1] - ty) < tr for tx, ty, tr in NO_TREES):
                                    s += 6.0
                                    continue
                                c.inst("treepit", at(s, 1.05), 0.0, rt=False)
                                c.inst("tree%d" % int(rng.integers(3)), at(s, 1.05), float(rng.uniform(0, 360)), float(rng.uniform(0.62, 0.92)))
                            s += float(rng.uniform(8, 14))
                    for _ in range(int(L / 40)):
                        r = rng.random()
                        s = float(rng.uniform(s0 + 8, s1 - 8))
                        if r < 0.3 * dens:
                            put("trashbags%d" % int(rng.integers(3)), s, 0.9, 3.0, yw=(90.0 if axis == "y" else 0.0) + float(rng.uniform(-9, 9)))
                        elif r < 0.42 * dens:
                            put("bikerack", s, 0.8, 1.8)
                        elif r < 0.56 * dens:
                            put("munimeter", s, 0.55, 0.8)
                        elif r < 0.66 * dens:
                            put("ventgrate", s, 2.2, 5.2, yw=90.0 if axis == "y" else 0.0, shadow=False)
                    # NO STANDING signs on posts
                    for s in (s0 + 11.0, s1 - 11.0):
                        if rng.random() < 0.6 * dens and free(s, 0.4):
                            pos = at(s, 0.45)
                            c.inst("bollard", pos, 0.0, (0.28, 0.28, 2.8), override="iron_black=galvanized", rt=False)
                            c.inst("nostanding", (pos[0], pos[1], CH + 2.55), (0.0 if axis == "y" else 90.0), custom=(float(NOSTAND_CELL), 0.2, 0, 0), rt=False, shadow=False)
        # hand-placed set dressing where the camera comes close
        place = [("busshelter", (-24.0, 12.3), 0.0), ("busshelter", (-12.4, -72.0), 90.0),
                 ("subway", (-17.8 - 2.6, 12.9), 180.0), ("subway", (-13.0, -36.0), 90.0),
                 ("foodcart", (13.0, 66.0), 180.0), ("foodcart", (-96.0, 11.8), 0.0),
                 ("steamstack", (-2.4, -19.5), 0.0), ("steamstack", (-131.0, 5.6), 0.0), ("steamstack", (11.7, 52.0), 0.0)]
        for mesh, (x, y), yaw in place:
            c.inst(mesh, (x, y, CH if mesh != "steamstack" or abs(y) > 9 else 0.0), yaw, custom=(0.0, 0.6, 0.0, 0.3))
            if mesh == "steamstack":
                self.st.steam.append((x, y, 2.7 if abs(y) > 9 else 2.55, 1.35))
            if mesh in ("busshelter", "foodcart"):
                c.light((x, y, 2.35 if mesh == "busshelter" else 1.95), (0, 0, -1), (1.0, 0.9, 0.75), 500 if mesh == "busshelter" else 700, 7, -1, C.LK_SIGN, shadows=False, rect=(180, 60), volumetric=0.3)
            if mesh == "busshelter":
                dx, dy = (2.3, 0.85) if yaw in (0.0, 180.0) else (0.85, 2.3)
                c.add_cover(x - dx, x + dx, y - dy, y + dy, 2.6)
            if mesh == "subway":
                c.light((x, y, 2.8), (0, 0, -1), (0.35, 1.0, 0.5), 60, 5, 0.0, C.LK_SIGN, shadows=False)

    # ------------------------------------------------------------------ walking routes for pedestrians
    def ped_paths(self):
        for k in range(3):
            rx, ry = 14.0 + k * 3.6, 36.0 + k * 5.5
            self.peds.append(tuple((-85.0 + rx * math.cos(a), -213.0 + ry * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 28)[:-1]))
        for sx, ya, off in self.st.signals:
            if not (-260 < sx < 180 and -350 < ya < 480):
                continue
            road = min((abs(a[0] - ya), a[2]) for a in D.AVENUES.values())[1]
            rs = min((abs(D.street_x(n) - sx), D.street_road_width(n)) for n in range(34, 52))[1]
            for s in (-1, 1):
                x = sx + s * (rs / 2 + 1.95)
                self.crossings.append((x, ya - road / 2 - 0.9, x, ya + road / 2 + 0.9, 1, off))
                y = ya + s * (road / 2 + 1.95)
                self.crossings.append((sx - rs / 2 - 0.9, y, sx + rs / 2 + 0.9, y, 0, off))
        for n in range(37, 46):
            xa = D.street_x(n) + D.street_road_width(n) / 2
            xb = D.street_x(n + 1) - D.street_road_width(n + 1) / 2
            aves = avenues_for_interval(n)
            for (ya, ra, _, na), (yb, rb, _, nb) in zip(aves[:-1], aves[1:]):
                p, q = ya + ra / 2, yb - rb / 2
                if not (-420 < (p + q) / 2 < 520 and -420 < (xa + xb) / 2 < 280):
                    continue
                if na == "6th" and nb == "5th" and n == 41:
                    continue
                if na == "6th" and nb == "5th" and n == 40:
                    xb2 = D.street_x(42) - D.street_road_width(42) / 2
                    xb = xb2
                if na == "Vanderbilt" and nb == "Lexington":
                    continue
                for off in (1.9, 2.9):
                    self.peds.append(((xa + off, p + off), (xb - off, p + off), (xb - off, q - off), (xa + off, q - off)))


# kept clear of trunks so nothing stands right in front of a film camera: (x, y, radius)
NO_TREES = [(12.6, 27.0, 17.0), (50.0, 7.0, 14.0), (13.5, 5.0, 12.0), (6.5, -1.0, 14.0), (-7.0, 192.0, 16.0), (2.2, -350.0, 16.0),
            (-58.0, -5.0, 12.0)]


def c_near(x, y):
    return (-380 < x < 230 and -380 < y < 560) or (-760 < x <= -380 and -100 < y < 100)
