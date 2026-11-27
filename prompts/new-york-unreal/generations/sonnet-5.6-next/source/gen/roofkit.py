"""Rooftop equipment, fire escapes, window units, awnings, sidewalk sheds and scaffolding."""
import math

import numpy as np

from meshlib import MeshBuilder, v


def water_tower():
    """The wooden tank on braced steel legs.  Origin at the roof under its centre."""
    mb = MeshBuilder()
    r, leg_h, tank_h = 1.9, 3.1, 3.6
    legs = [(-1.35, -1.35), (1.35, -1.35), (1.35, 1.35), (-1.35, 1.35)]
    for x, y in legs:
        mb.box((x - 0.08, y - 0.08, 0), (x + 0.08, y + 0.08, leg_h), "iron_black", faces="xXyY")
    for i in range(4):
        (ax, ay), (bx, by) = legs[i], legs[(i + 1) % 4]
        mb.tube([(ax, ay, 0.35), (bx, by, leg_h - 0.35)], 0.028, 5, "iron_black", caps=False)
        mb.tube([(bx, by, 0.35), (ax, ay, leg_h - 0.35)], 0.028, 5, "iron_black", caps=False)
        mb.tube([(ax, ay, leg_h * 0.55), (bx, by, leg_h * 0.55)], 0.035, 5, "iron_black", caps=False)
        mb.tube([(ax, ay, leg_h), (bx, by, leg_h)], 0.09, 6, "rust", caps=False)
    for k in (-0.85, 0.0, 0.85):
        mb.box((-1.55, k - 0.07, leg_h + 0.02), (1.55, k + 0.07, leg_h + 0.2), "rust")
    z0 = leg_h + 0.2
    mb.lathe((0, 0, z0), [(0.0, 0.0), (r, 0.0), (r * 1.0, 0.02), (r * 0.965, tank_h)], "wood", segments=28)
    for k in range(9):
        z = 0.14 + (tank_h - 0.3) * (k / 8) ** 1.25
        rr = r * (1.0 - 0.035 * z / tank_h) + 0.018
        mb.lathe((0, 0, z0 + z), [(rr, 0.0), (rr + 0.004, 0.0), (rr + 0.004, 0.05), (rr, 0.05)], "iron_black", segments=28)
    mb.lathe((0, 0, z0 + tank_h), [(r * 1.06, 0.0), (r * 0.62, 0.55), (0.14, 1.08), (0.14, 1.24), (0.0, 1.34)], "roofing_dark", segments=24)
    mb.lathe((0, 0, z0 + tank_h - 0.05), [(r * 0.965, 0.0), (r * 1.06, 0.05)], "wood", segments=24)
    # ladder
    for sy in (-0.22, 0.22):
        mb.tube([(r + 0.14, sy, 0.2), (r + 0.06, sy, z0 + tank_h + 0.35)], 0.022, 5, "iron_black")
    z = 0.4
    while z < z0 + tank_h:
        mb.tube([(r + 0.13 - 0.08 * z / (z0 + tank_h), -0.22, z), (r + 0.13 - 0.08 * z / (z0 + tank_h), 0.22, z)], 0.012, 4, "iron_black", caps=False)
        z += 0.33
    mb.tube([(0.2, 0.2, 0), (0.2, 0.2, z0)], 0.1, 8, "rust", caps=False)
    return mb


def bulkhead():
    mb = MeshBuilder()
    mb.box((-2.0, -1.5, 0), (2.0, 1.5, 3.0), "bulk", faces="xXyY")
    mb.box((-2.1, -1.6, 3.0), (2.1, 1.6, 3.16), "concrete")
    mb.box((-0.6, 1.5, 0.0), (0.45, 1.54, 2.15), "paint_darkgray", faces="Y")
    mb.box((1.0, 1.5, 1.5), (1.6, 1.56, 2.1), "galvanized", faces="xXYzZ")
    return mb


def hvac(kind=0):
    mb = MeshBuilder()
    if kind == 0:
        mb.box((-1.3, -0.8, 0.2), (1.3, 0.8, 1.35), "galvanized")
        for x in (-0.62, 0.62):
            mb.lathe((x, 0, 1.35), [(0.52, 0.0), (0.5, 0.14), (0.46, 0.14), (0.44, 0.03), (0.0, 0.03)], "paint_gray", segments=18)
            for a in range(6):
                ang = a * math.pi / 6
                mb.tube([(x - 0.46 * math.cos(ang), -0.46 * math.sin(ang), 1.47), (x + 0.46 * math.cos(ang), 0.46 * math.sin(ang), 1.47)], 0.008, 4, "iron_black", caps=False)
        for z in np.arange(0.35, 1.2, 0.09):
            mb.box((-1.2, 0.8, z), (-0.1, 0.83, z + 0.045), "paint_darkgray", faces="YzZ")
        for x in (-1.15, 1.05):
            mb.box((x, -0.75, 0.0), (x + 0.1, 0.75, 0.2), "rust")
    elif kind == 1:
        mb.cylinder((0, 0, 0), 1.6, 0.95, "galvanized", segments=18)
        mb.lathe((0, 0, 1.6), [(1.05, 0), (0.85, 0.25), (0.0, 0.3)], "galvanized", segments=18)
        mb.tube([(0.95, 0, 0.6), (1.7, 0, 0.6), (1.9, 0, 0.35), (1.9, 0, 0.0)], 0.28, 10, "galvanized", caps=False)
    else:
        mb.box((-2.2, -0.35, 0.35), (2.2, 0.35, 0.95), "galvanized")
        for x in np.arange(-2.2, 2.21, 0.74):
            mb.box((x - 0.03, -0.39, 0.33), (x + 0.03, 0.39, 0.99), "paint_gray")
        for x in (-1.7, 0.0, 1.7):
            mb.box((x - 0.06, -0.3, 0), (x + 0.06, 0.3, 0.35), "rust")
        mb.box((2.2, -0.35, 0.0), (2.9, 0.35, 0.95), "galvanized")
    return mb


def vents():
    mb = MeshBuilder()
    for x, y, h, r in [(0, 0, 1.1, 0.14), (0.8, 0.3, 0.7, 0.1), (-0.5, 0.7, 1.5, 0.09), (0.3, -0.8, 0.5, 0.18)]:
        mb.cylinder((x, y, 0), h, r, "galvanized", segments=8)
        mb.lathe((x, y, h), [(r * 1.7, 0.02), (r * 0.4, 0.2), (0.0, 0.22)], "galvanized", segments=8)
    return mb


def antenna():
    mb = MeshBuilder()
    mb.tube([(0, 0, 0), (0, 0, 7.5)], [0.09, 0.03], 6, "paint_gray")
    for z, w in ((5.0, 0.9), (6.1, 0.7), (6.9, 0.4)):
        mb.tube([(-w, 0, z), (w, 0, z)], 0.018, 4, "paint_gray")
    for ang in (0.4, 2.5, 4.4):
        mb.box((0.18 * math.cos(ang) - 0.05, 0.18 * math.sin(ang) - 0.05, 3.2), (0.18 * math.cos(ang) + 0.05, 0.18 * math.sin(ang) + 0.05, 4.5), "paint_white")
    return mb


def skylight():
    mb = MeshBuilder()
    mb.box((-1.2, -0.8, 0), (1.2, 0.8, 0.35), "galvanized", faces="xXyY")
    mb.quad((-1.2, -0.8, 0.35), (1.2, -0.8, 0.35), (1.2, 0, 0.85), (-1.2, 0, 0.85), "glass_dark", normal=(0, -1, 1.6))
    mb.quad((-1.2, 0.8, 0.35), (1.2, 0.8, 0.35), (1.2, 0, 0.85), (-1.2, 0, 0.85), "glass_dark", normal=(0, 1, 1.6))
    for s, x in ((-1, -1.2), (1, 1.2)):
        mb.poly([(x, -0.8, 0.35), (x, 0.8, 0.35), (x, 0, 0.85)], "galvanized", normal=(s, 0, 0))
    return mb


def chimney():
    mb = MeshBuilder()
    mb.box((-0.45, -0.3, 0), (0.45, 0.3, 1.7), "brick_brown", faces="xXyY")
    mb.box((-0.52, -0.37, 1.7), (0.52, 0.37, 1.84), "concrete")
    for x in (-0.2, 0.2):
        mb.cylinder((x, 0, 1.84), 0.42, 0.13, "terracotta", segments=8, r1=0.1)
    return mb


# ------------------------------------------------------------------ wall-mounted
def ac_unit():
    """Window air conditioner.  Origin: centre of the sill, +y out of the wall."""
    mb = MeshBuilder()
    mb.box((-0.31, -0.2, 0.01), (0.31, 0.2, 0.41), "ac_case")
    for z in np.arange(0.07, 0.36, 0.05):
        mb.box((-0.27, 0.2, z), (0.27, 0.212, z + 0.022), "paint_darkgray", faces="YzZ")
    mb.box((-0.34, -0.16, 0.41), (0.34, 0.12, 0.425), "ac_case")
    for x in (-0.24, 0.24):
        mb.tube([(x, 0.16, 0.0), (x, -0.02, -0.18)], 0.012, 4, "iron_black")
    # accordion side panels that fill the rest of the sash
    for s in (-1, 1):
        mb.box((min(s * 0.31, s * 0.56), -0.09, 0.0), (max(s * 0.31, s * 0.56), -0.07, 0.4), "paint_gray", faces="Y")
    return mb


def fire_escape(width=4.4, floor_h=3.1, bottom=False):
    """One storey of fire escape: grated balcony, railing and the stair down.  Origin at the
    balcony floor, x centred, +y out of the wall."""
    mb = MeshBuilder()
    w2 = width / 2
    depth = 1.15
    s = "iron_black"
    # grating: slats with gaps so light falls through
    y = 0.06
    while y < depth:
        mb.box((-w2, y, -0.03), (w2, y + 0.045, 0.0), s, faces="yYzZ")
        y += 0.11
    for x in (-w2, -w2 / 3, w2 / 3, w2):
        mb.box((x - 0.02, 0.0, -0.075), (x + 0.02, depth, -0.03), s)
    mb.box((-w2, depth - 0.02, -0.075), (w2, depth + 0.02, 0.02), s)
    # braces back to the wall
    for x in (-w2 + 0.15, w2 - 0.15):
        mb.tube([(x, 0.0, -0.8), (x, depth - 0.1, -0.06)], 0.022, 4, s, caps=False)
    # railing
    for z in (0.52, 1.02):
        rr = 0.028 if z > 0.9 else 0.014
        mb.tube([(-w2, 0.02, z), (-w2, depth, z), (w2, depth, z), (w2, 0.02, z)], rr, 4, s, caps=False)
    x = -w2
    while x <= w2 + 1e-3:
        mb.box((x - 0.011, depth - 0.011, 0.0), (x + 0.011, depth + 0.011, 1.02), s, faces="xXyY")
        x += 0.17
    for sx in (-w2, w2):
        yy = 0.2
        while yy < depth:
            mb.box((sx - 0.011, yy - 0.011, 0.0), (sx + 0.011, yy + 0.011, 1.02), s, faces="xXyY")
            yy += 0.22
    if not bottom:
        # diagonal stair to the balcony below
        x0, x1 = -w2 + 0.45, w2 - 0.75
        for yy in (0.28, 0.82):
            mb.tube([(x0, yy, -floor_h + 0.02), (x1, yy, 0.0)], 0.032, 4, s)
            mb.tube([(x0, yy, -floor_h + 0.9), (x1, yy, 0.88)], 0.014, 4, s)
        n = 11
        for i in range(1, n):
            t = i / n
            x = x0 + (x1 - x0) * t
            z = -floor_h + floor_h * t
            mb.box((x - 0.09, 0.28, z - 0.012), (x + 0.09, 0.82, z + 0.012), s)
    else:
        # counterweighted drop ladder
        for x in (w2 - 0.55, w2 - 0.12):
            mb.box((x - 0.018, depth + 0.03, -2.0), (x + 0.018, depth + 0.07, 1.0), s)
        z = -1.95
        while z < 0.0:
            mb.box((w2 - 0.55, depth + 0.035, z), (w2 - 0.12, depth + 0.065, z + 0.025), s)
            z += 0.28
    return mb


def awning(width=3.6, drop=0.75, proj=1.15, flat=False):
    """Origin at the wall, top centre of the awning."""
    mb = MeshBuilder()
    w2 = width / 2
    if flat:
        mb.box((-w2, 0.0, -0.22), (w2, proj, 0.0), "awning")
        mb.box((-w2 + 0.05, 0.05, -0.235), (w2 - 0.05, proj - 0.05, -0.222), "canopy_light", faces="z")
        for x in (-w2 + 0.2, w2 - 0.2):
            mb.tube([(x, proj - 0.15, 0.0), (x, 0.0, 0.85)], 0.014, 4, "iron_black")
        return mb
    seg = 8
    prof = [(0.0, 0.0), (proj * 0.35, -drop * 0.16), (proj * 0.7, -drop * 0.44), (proj, -drop)]
    for i in range(len(prof) - 1):
        (y0, z0), (y1, z1) = prof[i], prof[i + 1]
        mb.quad((-w2, y0, z0), (w2, y0, z0), (w2, y1, z1), (-w2, y1, z1), "awning", normal=(0, -(z1 - z0), (y1 - y0)))
        mb.quad((-w2, y0, z0 - 0.02), (w2, y0, z0 - 0.02), (w2, y1, z1 - 0.02), (-w2, y1, z1 - 0.02), "awning", normal=(0, (z1 - z0), -(y1 - y0)))
    for s, x in ((-1, -w2), (1, w2)):
        mb.poly([(x, 0.0, 0.0)] + [(x, y, z) for y, z in prof[1:]] + [(x, proj, -drop - 0.01), (x, 0.0, -drop * 0.55)], "awning", normal=(s, 0, 0))
    # scalloped valance
    n = int(width / 0.3)
    for i in range(n):
        a = -w2 + width * i / n
        b = -w2 + width * (i + 1) / n
        mb.poly([(a, proj, -drop), (b, proj, -drop), (b, proj, -drop - 0.17), ((a + b) / 2, proj, -drop - 0.24), (a, proj, -drop - 0.17)], "awning", normal=(0, 1, 0))
    mb.tube([(-w2, proj, -drop), (w2, proj, -drop)], 0.016, 4, "galvanized")
    return mb


# ------------------------------------------------------------------ sidewalk shed + scaffold
def sidewalk_shed(width=2.4, depth=3.0):
    """One bay of the plywood sidewalk bridge that wraps so many Midtown buildings.
    Origin at the building line, ground level; x along the facade, +y toward the kerb."""
    mb = MeshBuilder()
    deck = 3.05
    for y in (0.18, depth - 0.1):
        mb.box((-0.05, y - 0.05, 0.0), (0.05, y + 0.05, deck), "galvanized", faces="xXyY")
        mb.box((-0.1, y - 0.1, 0.0), (0.1, y + 0.1, 0.03), "galvanized")
    mb.box((0.0, 0.05, deck), (width, depth, deck + 0.14), "shed_wood", faces="zZyYxX")
    for y in (0.18, depth - 0.1):
        mb.box((0.0, y - 0.06, deck - 0.2), (width, y + 0.06, deck), "galvanized")
    for x in (width * 0.5,):
        mb.box((x - 0.04, 0.05, deck - 0.12), (x + 0.04, depth, deck), "galvanized")
    # cross bracing along the kerb side
    mb.tube([(0.0, depth - 0.1, 2.0), (0.75, depth - 0.1, deck - 0.15)], 0.022, 5, "galvanized", caps=False)
    mb.tube([(width, depth - 0.1, 2.0), (width - 0.75, depth - 0.1, deck - 0.15)], 0.022, 5, "galvanized", caps=False)
    # the tall painted parapet
    mb.box((0.0, depth - 0.02, deck + 0.14), (width, depth + 0.03, deck + 1.35), "shed", faces="yYzZ")
    mb.box((0.0, depth + 0.03, deck + 1.28), (width, depth + 0.07, deck + 1.38), "shed", faces="YzZ")
    mb.box((width - 0.04, depth + 0.03, deck + 0.16), (width + 0.0, depth + 0.045, deck + 1.28), "paint_darkgreen", faces="Y")
    # caged lamp under the deck
    mb.box((width * 0.5 - 0.35, depth * 0.5 - 0.06, deck - 0.14), (width * 0.5 + 0.35, depth * 0.5 + 0.06, deck - 0.1), "tube_light", faces="zyYxX")
    return mb


def scaffold(width=2.4, level_h=2.0):
    """One lift of facade scaffold with plank deck and debris netting frame."""
    mb = MeshBuilder()
    d0, d1 = 0.35, 1.45
    for y in (d0, d1):
        mb.tube([(0, y, 0), (0, y, level_h)], 0.025, 5, "galvanized", caps=False)
        mb.tube([(0, y, level_h), (width, y, level_h)], 0.025, 5, "galvanized", caps=False)
        mb.tube([(0, y, 1.05), (width, y, 1.05)], 0.018, 4, "galvanized", caps=False)
    mb.tube([(0, d1, 0), (width, d1, level_h)], 0.018, 4, "galvanized", caps=False)
    for z in (0.15, level_h * 0.55, level_h):
        mb.tube([(0, d0, z), (0, d1, z)], 0.02, 4, "galvanized", caps=False)
    y = d0 + 0.04
    while y < d1 - 0.2:
        mb.box((0.0, y, level_h), (width, y + 0.22, level_h + 0.05), "wood", faces="zZyY")
        y += 0.245
    return mb


def netting(width=2.4, level_h=2.0):
    mb = MeshBuilder()
    mb.quad((0, 1.52, 0), (width, 1.52, 0), (width, 1.52, level_h), (0, 1.52, level_h), "netting", normal=(0, 1, 0))
    return mb


def dentil():
    mb = MeshBuilder()
    mb.box((-0.07, 0.0, 0.0), (0.07, 0.17, 0.16), "trim", faces="xXYz")
    return mb


def bracket(scale=1.0):
    """Scrolled cornice bracket."""
    mb = MeshBuilder()
    prof = [(0.0, 0.0), (0.12, 0.02), (0.14, 0.14), (0.1, 0.3), (0.2, 0.42), (0.38, 0.52), (0.42, 0.66), (0.0, 0.66)]
    w = 0.16
    for s, x in ((-1, -w / 2), (1, w / 2)):
        mb.poly([(x, y * scale, z * scale) for y, z in prof], "trim", normal=(s, 0, 0))
    for i in range(len(prof) - 1):
        (y0, z0), (y1, z1) = prof[i], prof[i + 1]
        mb.quad((-w / 2, y0 * scale, z0 * scale), (w / 2, y0 * scale, z0 * scale), (w / 2, y1 * scale, z1 * scale),
                (-w / 2, y1 * scale, z1 * scale), "trim", normal=(0, (z1 - z0), -(y1 - y0)))
    return mb


def flagpole():
    mb = MeshBuilder()
    mb.tube([(0, 0, 0), (0, 2.2, 0.8)], [0.045, 0.025], 6, "steel")
    mb.sphere((0, 2.22, 0.81), 0.06, "gold", segments=8, rings=5)
    return mb


def all_meshes():
    return {
        "watertower": water_tower(), "bulkhead": bulkhead(), "hvac0": hvac(0), "hvac1": hvac(1), "hvac2": hvac(2),
        "vents": vents(), "antenna": antenna(), "skylight": skylight(), "chimney": chimney(), "acunit": ac_unit(),
        "fireescape": fire_escape(), "fireescape_bot": fire_escape(bottom=True), "awning": awning(),
        "awning_flat": awning(flat=True, proj=1.4), "shed": sidewalk_shed(), "scaffold": scaffold(),
        "netting": netting(), "dentil": dentil(), "bracket": bracket(), "flagpole": flagpole(),
    }
