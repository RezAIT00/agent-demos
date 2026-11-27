"""Meshes for the destruction effects and for the tools: volume proxies, shock shell, beam, crater,
rubble, and every machine, projectile and oddity in the arsenal.  All built from primitives here.

  python source/gen/destruct_fx.py          -> build/destruct/meshes/*.nmesh + manifest.json
"""
import json
import math
import os

import numpy as np
from scipy.spatial import ConvexHull

from meshlib import MeshBuilder

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "build", "destruct")
TAU = math.pi * 2


def sphere(mb, centre, radius, slot, nu=24, nv=16, inward=False, scale=(1, 1, 1), color=(1, 1, 1, 1), z_min=-2.0):
    cx, cy, cz = centre
    if not inward:
        # smooth shading: the same rings lofted, with the poles held a hair open so that normals stay defined
        rows, low = [], []
        for j in range(nv + 1):
            th = min(max(math.pi * j / nv, 0.012), math.pi - 0.012)
            ring = [(math.sin(th) * math.cos(TAU * i / nu), math.sin(th) * math.sin(TAU * i / nu), -math.cos(th)) for i in range(nu)]
            rows.append([(cx + d[0] * radius * scale[0], cy + d[1] * radius * scale[1], cz + d[2] * radius * scale[2]) for d in ring])
            low.append(-math.cos(th))
        mb.loft(np.array(rows), lambda r, c: slot if max(low[r], low[r + 1]) >= z_min else None, color=color, smooth=True, closed=True)
        return
    pts = []
    for j in range(nv + 1):
        th = math.pi * j / nv
        row = []
        for i in range(nu + 1):
            ph = TAU * i / nu
            d = (math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), -math.cos(th))
            row.append((cx + d[0] * radius * scale[0], cy + d[1] * radius * scale[1], cz + d[2] * radius * scale[2], d))
        pts.append(row)
    for j in range(nv):
        for i in range(nu):
            quad = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]]
            if max(q[3][2] for q in quad) < z_min:
                continue
            mid = np.mean([q[3] for q in quad], axis=0)
            n = -mid if inward else mid
            p = [q[:3] for q in quad]
            if j == 0:
                p = [p[0], p[2], p[3]]
            elif j == nv - 1:
                p = [p[0], p[1], p[2]]
            mb.poly(p, slot, normal=tuple(n), color=color)


def hull_chunk(mb, rng, size, slot, points=14, jitter=0.35, offset=(0, 0, 0)):
    """An irregular lump: the convex hull of points scattered over a squashed sphere."""
    p = rng.normal(0, 1, (points, 3))
    p /= np.linalg.norm(p, axis=1, keepdims=True)
    p *= (1 - jitter * rng.random((points, 1)))
    p *= np.asarray(size) / 2
    p += np.asarray(offset)
    h = ConvexHull(p)
    centre = p[h.vertices].mean(axis=0)
    for tri in h.simplices:
        a, b, c = p[tri]
        n = np.cross(b - a, c - a)
        if np.dot(n, (a + b + c) / 3 - centre) < 0:
            n = -n
        mb.poly([a, b, c], slot, normal=tuple(n))


# ------------------------------------------------------------------ effect shapes
def volsphere():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 1.02, "fx_volume", 20, 14, inward=True)
    return mb


def dome():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 1.0, "fx_shock", 64, 40, z_min=-0.12)
    return mb


def beam_cylinder():
    mb = MeshBuilder()
    n = 24
    for i in range(n):
        a, b = TAU * i / n, TAU * (i + 1) / n
        pa, pb = (math.cos(a), math.sin(a)), (math.cos(b), math.sin(b))
        mb.raw(np.array([(pa[0], pa[1], 0), (pb[0], pb[1], 0), (pb[0], pb[1], 1), (pa[0], pa[1], 1)], float),
               np.array([(pa[0], pa[1], 0), (pb[0], pb[1], 0), (pb[0], pb[1], 0), (pa[0], pa[1], 0)], float),
               np.zeros((4, 2)), np.zeros((4, 2)), np.ones((4, 4)), np.array([(0, 1, 2), (0, 2, 3)]), "fx_beam")
    return mb


def crater_disc():
    mb = MeshBuilder()
    n, rings = 72, 6
    for j in range(rings):
        r0, r1 = j / rings, (j + 1) / rings
        for i in range(n):
            a, b = TAU * i / n, TAU * (i + 1) / n
            pts = [(r0 * math.cos(a), r0 * math.sin(a), 0), (r1 * math.cos(a), r1 * math.sin(a), 0),
                   (r1 * math.cos(b), r1 * math.sin(b), 0), (r0 * math.cos(b), r0 * math.sin(b), 0)]
            if j == 0:
                pts = pts[:3]
            mb.poly(pts, "fx_crater", normal=(0, 0, 1))
    return mb


def water_wall():
    """A 40 m wide breaking wave, 1 m tall unit, running along +y with the face toward +x."""
    mb = MeshBuilder()
    # a long back, a rounded shoulder and a lip curling over the steep face
    prof = [(-3.4, 0.0), (-2.7, 0.1), (-2.0, 0.27), (-1.45, 0.48), (-1.0, 0.68), (-0.66, 0.82), (-0.34, 0.92), (-0.02, 0.97),
            (0.26, 0.94), (0.45, 0.86), (0.54, 0.76), (0.46, 0.69), (0.34, 0.66), (0.28, 0.54), (0.36, 0.4), (0.54, 0.24),
            (0.78, 0.1), (1.05, 0.03), (1.35, 0.0)]
    n = 200
    ys = np.linspace(-20.0, 20.0, n + 1)
    rows = []
    for y in ys:
        k = 1.0 - max(0.0, abs(y) - 15.0) / 5.0
        # unrelated wavelengths, so no two stretches of crest match
        wob = 1.0 + 0.035 * math.sin(y * 0.41 + 0.3) + 0.028 * math.sin(y * 0.97 + 2.1) + 0.016 * math.sin(y * 2.63) + 0.01 * math.sin(y * 6.1 + 1.0)
        reach = 0.97 + 0.07 * math.sin(y * 0.29 + 1.7) + 0.035 * math.sin(y * 1.31)
        # the lip wanders at three unrelated scales: evenly spaced scallops read as teeth
        def ragged(pz, y=y):
            return 0.075 * math.sin(y * 0.53 + pz * 2.2) + 0.04 * math.sin(y * 1.43 + 4.0 - pz * 3.1) + 0.018 * math.sin(y * 4.9 + pz * 5.0)

        rows.append([(px * 2.2 * reach + ragged(pz) * pz, y, pz * wob * k) for px, pz in prof])
    S = np.array(rows)
    mb.loft(S, lambda r, c: "fx_water", closed=False)
    return mb


def water_sheet():
    """Flat 1 x 1 m patch subdivided for waves, used for floodwater."""
    mb = MeshBuilder()
    n = 48
    for i in range(n):
        for j in range(n):
            x0, x1, y0, y1 = i / n - 0.5, (i + 1) / n - 0.5, j / n - 0.5, (j + 1) / n - 0.5
            mb.poly([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], "fx_water", normal=(0, 0, 1))
    return mb


# ------------------------------------------------------------------ marks
def scar():
    """A ragged hole knocked in a surface: dark broken core, chips of the layers round it. Radius 1, +z out."""
    rng = np.random.default_rng(88)
    mb = MeshBuilder()
    n = 17
    ring = [(math.cos(TAU * k / n) * rng.uniform(0.45, 1.0), math.sin(TAU * k / n) * rng.uniform(0.45, 1.0)) for k in range(n)]
    for k in range(n):
        a, b = ring[k], ring[(k + 1) % n]
        mb.poly([(0, 0, 0.005), (a[0] * 0.72, a[1] * 0.72, 0.012), (b[0] * 0.72, b[1] * 0.72, 0.012)], "interior_dark", normal=(0, 0, 1))
        mb.poly([(a[0] * 0.72, a[1] * 0.72, 0.012), (a[0], a[1], 0.004), (b[0], b[1], 0.004), (b[0] * 0.72, b[1] * 0.72, 0.012)], "concrete", normal=(0, 0, 1))
    for _ in range(9):
        c = rng.uniform(-0.7, 0.7, 2)
        hull_chunk(mb, rng, rng.uniform(0.08, 0.26, 3) * (1, 1, 0.5), "brick_brown", 8, 0.4, offset=(c[0], c[1], 0.02))
    return mb


# ------------------------------------------------------------------ particle bits (1 unit = 1 cm in use)
def chip():
    mb = MeshBuilder()
    hull_chunk(mb, np.random.default_rng(41), (0.011, 0.009, 0.007), "fx_particle", 9, 0.35)
    return mb


def shard():
    mb = MeshBuilder()
    for n in ((0, 0, 1), (0, 0, -1)):
        mb.poly([(-0.006, -0.004, 0.0004), (0.008, -0.002, 0.0), (-0.001, 0.007, -0.0004)], "fx_particle", normal=n)
    return mb


def splinter():
    mb = MeshBuilder()
    mb.tube([(-0.012, 0, 0), (0.002, 0.001, 0), (0.013, 0, 0)], [0.0012, 0.0017, 0.0002], 4, "fx_particle", smooth=False)
    return mb


def paper():
    mb = MeshBuilder()
    for n in ((0, 0, 1), (0, 0, -1)):
        mb.poly([(-0.006, -0.0045, 0), (0.006, -0.0045, 0.0012), (0.006, 0.0045, 0), (-0.006, 0.0045, -0.001)], "fx_particle", normal=n)
    return mb


# ------------------------------------------------------------------ rubble
def rubble(kind):
    rng = np.random.default_rng(900 + kind)
    mb = MeshBuilder()
    if kind < 4:
        sizes = [(1.5, 1.2, 0.8), (1.0, 1.3, 0.55), (0.7, 0.65, 0.6), (2.2, 1.4, 0.45)]
        hull_chunk(mb, rng, sizes[kind], "wall", 16, 0.3)
        for _ in range(3):
            off = rng.normal(0, 0.5, 3) * (1, 1, 0.3)
            hull_chunk(mb, rng, rng.uniform(0.2, 0.55, 3), "wall", 9, 0.4, offset=off)
    elif kind == 4:      # a broken slab with bars sticking out
        mb.obox((0, 0, 0), (2.6, 1.7, 0.22), 7, "concrete", pitch=4)
        hull_chunk(mb, rng, (0.8, 0.7, 0.3), "concrete", 10, 0.4, offset=(1.2, 0.3, 0.05))
        for k in range(6):
            y = -0.7 + 0.28 * k
            a = np.array((1.2, y, 0.0))
            mid = a + np.array((0.45, rng.uniform(-0.12, 0.12), rng.uniform(-0.1, 0.25)))
            end = mid + np.array((0.4, rng.uniform(-0.3, 0.3), rng.uniform(-0.35, 0.4)))
            mb.tube([a, mid, end], 0.014, 6, "rust")
    else:                # twisted steel
        for k in range(3):
            a = rng.normal(0, 0.45, 3) * (1, 1, 0.35)
            b = a + rng.normal(0, 1.1, 3) * (1, 1, 0.4)
            mid = (a + b) / 2 + rng.normal(0, 0.35, 3)
            mb.tube([a, mid, b], 0.06, 4, "rust")
    return mb


# ------------------------------------------------------------------ tools: small things
def cylinder_x(mb, x0, x1, r, slot, centre=(0.0, 0.0), segments=20):
    mb.tube([(x0, centre[0], centre[1]), (x1, centre[0], centre[1])], r, segments, slot, caps=True)


def pebble():
    mb = MeshBuilder()
    hull_chunk(mb, np.random.default_rng(3), (0.07, 0.06, 0.045), "granite", 20, 0.2)
    return mb


def baseball():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 0.037, "paint_white", 16, 12)
    for s in (-1, 1):
        path = [(0.0375 * math.cos(t) * math.cos(s * 0.5 * math.sin(2 * t)), 0.0375 * math.sin(t) * math.cos(s * 0.5 * math.sin(2 * t)),
                 0.0375 * math.sin(s * 0.5 * math.sin(2 * t)) + 0.006 * s) for t in np.linspace(0, TAU, 40)]
        mb.tube(path, 0.0022, 5, "paint_red", caps=False)
    return mb


def marble():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 0.02, "curtain_green", 10, 8)
    return mb


def hand_tool(kind):
    """Hand tools stand with the grip at the origin and the head toward +x."""
    mb = MeshBuilder()
    if kind == "claw_hammer":
        mb.tube([(0, 0, 0), (0.32, 0, 0)], 0.017, 10, "wood")
        mb.box((0.30, -0.075, -0.022), (0.35, 0.045, 0.022), "steel")
        mb.tube([(0.325, 0.045, 0.0), (0.3, 0.1, 0.0), (0.262, 0.122, 0.0)], [0.018, 0.011, 0.003], 8, "steel")
    elif kind == "crowbar":
        mb.tube([(0, 0, 0), (0.72, 0, 0), (0.82, 0.04, 0), (0.84, 0.11, 0), (0.8, 0.145, 0)], [0.016, 0.016, 0.015, 0.012, 0.005], 8, "paint_red")
        mb.tube([(0, 0, 0), (-0.09, -0.025, 0)], [0.016, 0.004], 8, "steel")
    elif kind == "pickaxe":
        mb.tube([(0, 0, 0), (0.86, 0, 0)], 0.022, 10, "wood")
        mb.tube([(0.78, -0.34, 0.0), (0.84, -0.18, 0), (0.87, 0, 0), (0.84, 0.18, 0), (0.79, 0.31, 0)], [0.004, 0.022, 0.034, 0.024, 0.012], 8, "paint_darkgray")
    elif kind == "sledgehammer":
        mb.tube([(0, 0, 0), (0.82, 0, 0)], 0.021, 10, "paint_yellow")
        mb.tube([(0.84, -0.12, 0), (0.84, 0.12, 0)], 0.062, 14, "iron_black")
    elif kind == "fire_axe":
        mb.tube([(0, 0, 0), (0.78, 0, 0)], 0.019, 10, "paint_red")
        mb.poly([(0.72, 0.0, 0.012), (0.86, 0.0, 0.012), (0.9, 0.19, 0.004), (0.7, 0.19, 0.004)], "steel", normal=(0, 0, 1))
        mb.poly([(0.72, 0.0, -0.012), (0.86, 0.0, -0.012), (0.9, 0.19, -0.004), (0.7, 0.19, -0.004)], "steel", normal=(0, 0, -1))
        mb.box((0.74, -0.08, -0.015), (0.82, 0.0, 0.015), "paint_red")
    elif kind == "hydrant_wrench":
        mb.tube([(0, 0, 0), (0.46, 0, 0)], 0.017, 10, "paint_darkgray")
        mb.tube([(0.46, 0, 0), (0.52, 0.06, 0), (0.57, 0.045, 0), (0.58, -0.015, 0), (0.53, -0.05, 0)], 0.016, 8, "iron_black")
    elif kind == "chainsaw":
        mb.box((-0.05, -0.1, -0.1), (0.3, 0.1, 0.13), "paint_orange")
        mb.tube([(0.02, -0.12, 0.1), (0.02, -0.12, 0.24), (0.22, -0.12, 0.22), (0.24, -0.12, 0.12)], 0.016, 8, "plastic_black")
        mb.box((0.3, -0.008, -0.05), (0.88, 0.008, 0.05), "steel")
        for i in range(22):
            x = 0.31 + i * 0.026
            for z in (0.05, -0.068):
                mb.box((x, -0.011, z), (x + 0.012, 0.011, z + 0.018), "iron_black")
    elif kind == "cutting_torch":
        mb.tube([(0, 0, 0), (0.34, 0, 0), (0.42, 0.03, 0), (0.46, 0.09, 0)], [0.018, 0.012, 0.011, 0.009], 10, "gold")
        mb.tube([(0.0, 0.035, 0), (0.28, 0.035, 0)], 0.008, 8, "paint_red")
        mb.tube([(0.0, -0.035, 0), (0.28, -0.035, 0)], 0.008, 8, "paint_darkgreen")
    elif kind == "jackhammer":
        mb.tube([(0, -0.25, 0), (0, 0.25, 0)], 0.022, 10, "rubber")
        mb.box((0.04, -0.09, -0.09), (0.52, 0.09, 0.09), "paint_yellow")
        mb.tube([(0.52, 0, 0), (0.68, 0, 0)], 0.045, 12, "iron_black")
        mb.tube([(0.68, 0, 0), (0.98, 0, 0)], [0.022, 0.004], 8, "steel")
    return mb


def grenade():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 0.045, "paint_olive", 18, 14, scale=(1, 1, 1.22))
    mb.box((-0.014, -0.014, 0.05), (0.014, 0.014, 0.075), "galvanized")
    mb.tube([(0.0, 0.0, 0.07), (0.045, 0.0, 0.055), (0.05, 0.0, -0.01)], 0.006, 6, "galvanized")
    return mb


def dynamite():
    mb = MeshBuilder()
    cylinder_x(mb, -0.12, 0.12, 0.022, "paint_red")
    mb.tube([(0.12, 0, 0), (0.17, 0, 0.03), (0.2, 0.02, 0.07)], 0.004, 5, "fabric_cream")
    return mb


def firecracker():
    mb = MeshBuilder()
    for k in range(7):
        cylinder_x(mb, -0.04, 0.04, 0.008, "paint_red", centre=((k % 3 - 1) * 0.017, (k // 3) * 0.016), segments=10)
    mb.tube([(0.04, 0, 0.01), (0.09, 0.01, 0.045)], 0.002, 5, "fabric_cream")
    return mb


def charge_block(long=False):
    """A flat demolition charge with wiring; stuck against whatever it will cut."""
    mb = MeshBuilder()
    if long:
        mb.box((-1.5, -0.03, -0.05), (1.5, 0.03, 0.05), "paint_darkgray")
        for i in range(12):
            x = -1.4 + i * 0.254
            mb.box((x, 0.03, -0.035), (x + 0.04, 0.038, 0.035), "paint_orange")
    else:
        mb.box((-0.17, -0.05, -0.12), (0.17, 0.05, 0.12), "paint_cream")
        mb.box((-0.1, 0.05, -0.06), (0.1, 0.075, 0.06), "plastic_black")
        mb.box((-0.03, 0.075, -0.02), (0.01, 0.085, 0.02), "paint_red")
    mb.tube([(0.0, 0.07, 0.05), (0.2, 0.09, 0.16), (0.32, 0.05, -0.02), (0.45, 0.04, -0.3)], 0.006, 5, "paint_red")
    return mb


def thermite_pot():
    mb = MeshBuilder()
    mb.tube([(0, 0, 0), (0, 0, 0.26)], [0.1, 0.13], 18, "rust")
    mb.tube([(0, 0, 0.26), (0, 0, 0.29)], 0.14, 18, "iron_black")
    return mb


def propane_tank():
    mb = MeshBuilder()
    cylinder_x(mb, -0.28, 0.28, 0.17, "paint_white")
    for s in (-1, 1):
        sphere(mb, (0.28 * s, 0, 0), 0.17, "paint_white", 18, 10, scale=(0.45, 1, 1))
    mb.tube([(0.35, 0, 0), (0.43, 0, 0)], 0.04, 10, "gold")
    return mb


def road_flare():
    mb = MeshBuilder()
    cylinder_x(mb, -0.16, 0.14, 0.015, "paint_red", segments=10)
    cylinder_x(mb, 0.14, 0.18, 0.017, "plastic_black", segments=10)
    return mb


def mortar_tube():
    mb = MeshBuilder()
    mb.tube([(0, 0, 0.05), (0.38, 0, 0.82)], 0.075, 16, "paint_olive")
    mb.box((-0.3, -0.26, 0.0), (0.2, 0.26, 0.05), "iron_black")
    for s in (-1, 1):
        mb.tube([(0.27, 0.0, 0.6), (0.55, 0.3 * s, 0.0)], 0.018, 8, "iron_black")
    return mb


# ------------------------------------------------------------------ projectiles, ordnance
def shell(calibre, length, body="paint_olive"):
    mb = MeshBuilder()
    r = calibre / 2
    mb.tube([(-length * 0.5, 0, 0), (-length * 0.42, 0, 0), (length * 0.1, 0, 0), (length * 0.3, 0, 0), (length * 0.43, 0, 0), (length * 0.5, 0, 0)],
            [r * 0.82, r, r, r * 0.8, r * 0.46, r * 0.04], 20, body)
    mb.tube([(-length * 0.3, 0, 0), (-length * 0.25, 0, 0)], r * 1.03, 20, "gold", caps=False)
    return mb


def finned_rocket(length, radius, body="paint_white", nose="paint_red"):
    mb = MeshBuilder()
    cylinder_x(mb, -length * 0.5, length * 0.3, radius, body)
    mb.tube([(length * 0.3, 0, 0), (length * 0.42, 0, 0), (length * 0.5, 0, 0)], [radius, radius * 0.65, 0.01], 20, nose)
    for k in range(4):
        a = TAU * k / 4
        c, s = math.cos(a), math.sin(a)
        pts = [(-length * 0.5, radius * c, radius * s), (-length * 0.3, radius * c, radius * s),
               (-length * 0.44, radius * 2.6 * c, radius * 2.6 * s), (-length * 0.52, radius * 2.6 * c, radius * 2.6 * s)]
        nrm = (0, -s, c)
        mb.poly(pts, "paint_darkgray", normal=nrm)
        mb.poly(pts, "paint_darkgray", normal=tuple(-v_ for v_ in nrm))
    return mb


def mortar_bomb():
    mb = shell(0.09, 0.42)
    for k in range(6):
        a = TAU * k / 6
        mb.obox((-0.26, 0.035 * math.cos(a), 0.035 * math.sin(a)), (0.09, 0.006, 0.05), 0, "iron_black", roll=math.degrees(a) + 90)
    return mb


def cannonball():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 0.18, "iron_black", 28, 20)
    return mb


def canister(length=1.6, radius=0.3, slot="paint_gray", band="paint_yellow"):
    mb = MeshBuilder()
    cylinder_x(mb, -length / 2, length / 2, radius, slot)
    for x in (-length * 0.3, length * 0.3):
        cylinder_x(mb, x - 0.04, x + 0.04, radius * 1.04, band)
    for s in (-1, 1):
        sphere(mb, (length / 2 * s, 0, 0), radius, slot, 20, 10, scale=(0.4, 1, 1))
    return mb


def rod():
    """A tungsten rod: very long, thin, sharp."""
    mb = MeshBuilder()
    mb.tube([(-3.0, 0, 0), (2.2, 0, 0), (3.0, 0, 0)], [0.17, 0.17, 0.005], 20, "steel_bright")
    for x in (-2.8, -1.2, 0.4):
        mb.tube([(x, 0, 0), (x + 0.12, 0, 0)], 0.2, 20, "iron_black")
    return mb


# ------------------------------------------------------------------ vehicles and plant
def wheel_pair(mb, x, half, radius, width=0.35):
    for s in (-1, 1):
        mb.tube([(x, s * (half - width / 2), radius), (x, s * (half + width / 2), radius)], radius, 22, "rubber")
        mb.tube([(x, s * (half + width / 2), radius), (x, s * (half + width / 2 + 0.02), radius)], radius * 0.5, 14, "galvanized")


def shopping_cart():
    mb = MeshBuilder()
    for z in (0.55, 0.78, 1.0):
        w = 0.24 + (z - 0.55) * 0.14
        loop = [(-0.45, -w, z), (0.45, -w * 0.9, z), (0.45, w * 0.9, z), (-0.45, w, z), (-0.45, -w, z)]
        mb.tube(loop, 0.008, 6, "chrome", caps=False)
    for i in range(9):
        x = -0.45 + 0.9 * i / 8
        for s in (-1, 1):
            mb.tube([(x, s * 0.23, 0.55), (x, s * 0.3, 1.0)], 0.005, 5, "chrome")
        mb.tube([(x, -0.23, 0.55), (x, 0.23, 0.55)], 0.005, 5, "chrome")
    for x, y in ((-0.35, -0.2), (0.38, -0.18), (0.38, 0.18), (-0.35, 0.2)):
        mb.tube([(x, y, 0.07), (x, y, 0.55)], 0.012, 6, "chrome")
        mb.tube([(x, y - 0.02, 0.06), (x, y + 0.02, 0.06)], 0.06, 12, "rubber")
    mb.tube([(-0.56, -0.27, 1.04), (-0.56, 0.27, 1.04)], 0.018, 8, "paint_red")
    # two boosters strapped under the basket
    for s in (-1, 1):
        mb.merge(finned_rocket(0.8, 0.065), offset=(-0.12, 0.33 * s, 0.62))
    return mb


def garbage_truck():
    mb = MeshBuilder()
    mb.box((-4.3, -1.25, 0.75), (-3.2, 1.25, 2.5), "paint_darkgreen")
    mb.obox((-1.1, 0, 2.15), (4.4, 2.5, 2.5), 0, "paint_white")
    for i in range(6):
        x = -3.0 + i * 0.72
        mb.box((x, -1.29, 0.95), (x + 0.08, 1.29, 3.4), "paint_white")
    mb.box((1.35, -1.2, 0.85), (3.4, 1.2, 2.0), "paint_darkgreen")
    mb.box((1.5, -1.18, 2.0), (3.28, 1.18, 3.0), "carglass")
    for y in (-1.19, 1.19):
        mb.box((1.45, y - 0.03, 2.0), (1.56, y + 0.03, 3.0), "paint_darkgreen")
        mb.box((3.24, y - 0.03, 2.0), (3.34, y + 0.03, 3.0), "paint_darkgreen")
    mb.box((1.4, -1.24, 3.0), (3.4, 1.24, 3.14), "paint_darkgreen")
    mb.box((3.4, -1.25, 0.65), (3.62, 1.25, 1.05), "chrome")
    mb.box((-4.3, -1.28, 0.55), (3.3, 1.28, 0.85), "iron_black")
    for x in (2.55, -1.7, -3.1):
        wheel_pair(mb, x, 1.12, 0.55, 0.42)
    return mb


def monster_truck():
    mb = MeshBuilder()
    mb.box((-2.4, -1.15, 2.15), (2.5, 1.15, 2.85), "paint_blue")
    mb.box((-0.5, -1.05, 2.85), (1.1, 1.05, 3.65), "carglass")
    mb.box((-0.55, -1.1, 3.65), (1.15, 1.1, 3.78), "paint_blue")
    for s in (-1, 1):
        mb.tube([(-1.8, 0.8 * s, 1.2), (1.9, 0.8 * s, 1.2)], 0.09, 8, "chrome")
        for x in (-1.7, 1.8):
            mb.tube([(x, 0.75 * s, 1.15), (x * 0.8, 0.85 * s, 2.2)], 0.07, 8, "paint_red")
    for x in (-1.75, 1.85):
        wheel_pair(mb, x, 1.65, 1.15, 0.85)
        mb.tube([(x, -1.7, 1.15), (x, 1.7, 1.15)], 0.12, 10, "iron_black")
    return mb


def road_roller():
    mb = MeshBuilder()
    mb.tube([(2.0, -1.15, 0.85), (2.0, 1.15, 0.85)], 0.85, 36, "paint_darkgray")
    mb.tube([(-1.8, -1.15, 0.85), (-1.8, 1.15, 0.85)], 0.85, 36, "paint_darkgray")
    mb.box((-1.9, -1.2, 1.35), (1.2, 1.2, 2.05), "paint_yellow")
    mb.box((1.1, -1.3, 1.6), (2.9, 1.3, 1.9), "paint_yellow")
    for s in (-1, 1):
        mb.box((1.8, 1.2 * s - 0.07, 0.7), (2.2, 1.2 * s + 0.07, 1.75), "paint_yellow")
        for x in (-1.1, 0.2):
            mb.tube([(x, 0.95 * s, 2.05), (x, 0.95 * s, 3.25)], 0.05, 8, "iron_black")
    mb.box((-1.35, -1.15, 3.25), (0.45, 1.15, 3.38), "paint_yellow")
    mb.box((-0.9, -0.25, 2.05), (-0.45, 0.25, 2.55), "rubber")
    return mb


def tracks(mb, length, half, height=0.8, width=0.55):
    for s in (-1, 1):
        y = s * half
        mb.box((-length / 2, y - width / 2, 0.12), (length / 2, y + width / 2, height), "iron_black")
        for x in (-length / 2, length / 2):
            mb.tube([(x, y - width / 2, height * 0.55), (x, y + width / 2, height * 0.55)], height * 0.45, 16, "iron_black")
        for i in range(int(length / 0.3)):
            x = -length / 2 + i * 0.3
            mb.box((x, y - width / 2 - 0.03, 0.0), (x + 0.16, y + width / 2 + 0.03, 0.13), "rust")


def bulldozer():
    mb = MeshBuilder()
    tracks(mb, 3.8, 1.05)
    mb.box((-1.7, -0.95, 0.8), (1.6, 0.95, 1.75), "paint_yellow")
    mb.box((0.5, -0.65, 1.75), (1.6, 0.65, 2.35), "paint_yellow")
    mb.box((-1.3, -0.8, 1.75), (0.35, 0.8, 3.05), "carglass")
    mb.box((-1.4, -0.9, 3.05), (0.45, 0.9, 3.2), "paint_yellow")
    mb.tube([(1.2, -0.4, 2.35), (1.2, -0.4, 3.2)], 0.09, 10, "iron_black")
    # the blade, gently curved
    for i, (dx, z) in enumerate(((2.65, 0.15), (2.5, 0.55), (2.45, 0.95), (2.52, 1.35), (2.68, 1.72))):
        mb.box((dx, -2.1, z), (dx + 0.16, 2.1, z + 0.42), "paint_darkgray")
    for s in (-1, 1):
        mb.tube([(1.0, 1.3 * s, 0.8), (2.55, 1.5 * s, 0.9)], 0.11, 8, "paint_yellow")
    return mb


def excavator_base():
    mb = MeshBuilder()
    tracks(mb, 4.2, 1.2, 0.85, 0.6)
    mb.box((-2.2, -1.35, 1.0), (1.5, 1.35, 2.1), "paint_yellow")
    mb.box((0.0, 0.25, 2.1), (1.5, 1.3, 3.35), "carglass")
    mb.box((-0.05, 0.2, 3.35), (1.55, 1.35, 3.48), "paint_yellow")
    mb.box((-2.4, -1.35, 1.0), (-2.2, 1.35, 2.35), "iron_black")
    return mb


def arm_segment():
    """1 m long boom along +x, tapering; the excavator and crushers scale it."""
    mb = MeshBuilder()
    mb.box((0.0, -0.17, -0.22), (1.0, 0.17, 0.22), "paint_yellow")
    mb.tube([(0.06, 0.0, 0.3), (0.92, 0.0, 0.26)], 0.055, 8, "chrome")
    for x in (0.0, 1.0):
        mb.tube([(x, -0.24, 0), (x, 0.24, 0)], 0.13, 14, "iron_black")
    return mb


def claw():
    mb = MeshBuilder()
    for y in (-0.55, 0.0, 0.55):
        for s in (-1, 1):
            mb.tube([(0.0, y, 0.0), (0.55, y, 0.55 * s), (1.15, y, 0.42 * s), (1.45, y, 0.08 * s)], [0.13, 0.12, 0.085, 0.015], 8, "iron_black")
    mb.tube([(0.0, -0.7, 0), (0.0, 0.7, 0)], 0.17, 12, "paint_darkgray")
    return mb


def crane_mast():
    """4 m of square lattice mast, base at the origin."""
    mb = MeshBuilder()
    corners = [(-0.9, -0.9), (0.9, -0.9), (0.9, 0.9), (-0.9, 0.9)]
    for x, y in corners:
        mb.box((x - 0.07, y - 0.07, 0.0), (x + 0.07, y + 0.07, 4.0), "paint_yellow")
    for z0 in (0.0, 2.0):
        for i in range(4):
            a, b = corners[i], corners[(i + 1) % 4]
            mb.tube([(a[0], a[1], z0), (b[0], b[1], z0 + 2.0)], 0.04, 5, "paint_yellow")
            mb.tube([(a[0], a[1], z0 + 2.0), (b[0], b[1], z0 + 2.0)], 0.04, 5, "paint_yellow")
    return mb


def crane_jib():
    """4 m of triangular jib along +x."""
    mb = MeshBuilder()
    rail = [(-0.6, 0.0), (0.6, 0.0), (0.0, 1.05)]
    for y, z in rail:
        mb.box((0.0, y - 0.06, z - 0.06), (4.0, y + 0.06, z + 0.06), "paint_yellow")
    for x0 in (0.0, 2.0):
        for i in range(3):
            a, b = rail[i], rail[(i + 1) % 3]
            mb.tube([(x0, a[0], a[1]), (x0 + 1.0, b[0], b[1])], 0.035, 5, "paint_yellow")
            mb.tube([(x0 + 1.0, b[0], b[1]), (x0 + 2.0, a[0], a[1])], 0.035, 5, "paint_yellow")
    return mb


def wrecking_ball():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 1.1, "iron_black", 36, 26, scale=(1, 1, 1.12))
    mb.tube([(0, 0, 1.2), (0, 0, 1.55)], 0.16, 12, "rust")
    for i in range(8):
        a, b = i / 8 * TAU, 0
        mb.box((1.095 * math.cos(a) - 0.06, 1.095 * math.sin(a) - 0.06, -0.06), (1.095 * math.cos(a) + 0.06, 1.095 * math.sin(a) + 0.06, 0.06), "rust")
    return mb


def chain_link():
    mb = MeshBuilder()
    path = [(0.12 * math.cos(t), 0.0, 0.2 * math.sin(t)) for t in np.linspace(0, TAU, 17)]
    mb.tube(path, 0.035, 8, "iron_black", caps=False)
    return mb


def pile_hammer():
    mb = MeshBuilder()
    mb.tube([(0, 0, 0.0), (0, 0, 2.6)], 0.55, 24, "iron_black")
    mb.tube([(0, 0, 2.6), (0, 0, 3.4)], 0.8, 24, "paint_yellow")
    for s in (-1, 1):
        mb.box((-0.12, 0.85 * s - 0.1, 0.0), (0.12, 0.85 * s + 0.1, 8.0), "paint_yellow")
    return mb


def ibeam():
    mb = MeshBuilder()
    for z0, z1 in ((0.38, 0.44), (-0.44, -0.38)):
        mb.box((-4.5, -0.22, z0), (4.5, 0.22, z1), "rust")
    mb.box((-4.5, -0.03, -0.38), (4.5, 0.03, 0.38), "rust")
    return mb


def container():
    mb = MeshBuilder()
    mb.box((-3.0, -1.2, 0.0), (3.0, 1.2, 2.6), "paint_navy")
    for i in range(24):
        x = -2.9 + i * 0.245
        for s in (-1, 1):
            mb.box((x, 1.2 * s - 0.035, 0.15), (x + 0.11, 1.2 * s + 0.035, 2.45), "paint_navy")
    for s in (-1, 1):
        for x in (-3.02, 2.92):
            mb.box((x, 1.18 * s - 0.08, 0.0), (x + 0.1, 1.18 * s + 0.08, 2.64), "rust")
    for y in (-0.55, 0.55):
        mb.tube([(3.04, y, 0.2), (3.04, y, 2.4)], 0.025, 6, "galvanized")
    return mb


# ------------------------------------------------------------------ oddities
def rubber_duck():
    """Roughly 8 m long, beak toward +x."""
    mb = MeshBuilder()
    sphere(mb, (0, 0, 2.6), 3.0, "paint_yellow", 36, 26, scale=(1.25, 1.0, 0.86))
    sphere(mb, (2.0, 0, 5.9), 1.9, "paint_yellow", 32, 22)
    mb.tube([(3.55, 0, 5.75), (4.2, 0, 5.65), (4.75, 0, 5.78)], [0.82, 0.55, 0.2], 20, "paint_orange")
    for s in (-1, 1):
        sphere(mb, (3.2, 1.15 * s, 6.65), 0.27, "plastic_black", 14, 10)
        sphere(mb, (3.38, 1.18 * s, 6.77), 0.08, "paint_white", 8, 6)
        sphere(mb, (-0.35, 2.75 * s, 2.9), 1.3, "paint_yellow", 20, 14, scale=(1.45, 0.34, 0.75))
    mb.tube([(-3.2, 0, 3.4), (-4.1, 0, 4.0), (-4.5, 0, 4.7)], [1.25, 0.62, 0.08], 20, "paint_yellow")
    return mb


def bowling_ball():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 4.0, "paint_burgundy", 64, 44)
    for d in ((0.2, 0.15, 0.97), (-0.12, 0.28, 0.95), (0.05, -0.2, 0.98)):
        c = np.array(d) / np.linalg.norm(d) * 3.93
        sphere(mb, tuple(c), 0.36, "plastic_black", 16, 12)
    return mb


def pinball():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 2.4, "chrome", 56, 40)
    return mb


def anvil():
    mb = MeshBuilder()
    mb.box((-0.38, -0.22, 0.0), (0.38, 0.22, 0.14), "iron_black")
    mb.box((-0.2, -0.13, 0.14), (0.22, 0.13, 0.34), "iron_black")
    mb.box((-0.46, -0.19, 0.34), (0.34, 0.19, 0.55), "iron_black")
    mb.tube([(0.34, 0, 0.46), (0.62, 0, 0.47), (0.84, 0, 0.5)], [0.13, 0.08, 0.012], 16, "iron_black")
    mb.box((-0.455, -0.185, 0.55), (0.335, 0.185, 0.57), "steel")
    return mb


def piano():
    mb = MeshBuilder()
    outline = [(-1.35, -0.76), (0.15, -0.76), (0.75, -0.48), (0.9, -0.08), (1.35, 0.12), (1.42, 0.46), (1.2, 0.72), (-1.35, 0.76)]
    for i in range(len(outline)):
        a, b = outline[i], outline[(i + 1) % len(outline)]
        mb.quad((a[0], a[1], 0.65), (b[0], b[1], 0.65), (b[0], b[1], 1.02), (a[0], a[1], 1.02), "paint_black",
                normal=(b[1] - a[1], a[0] - b[0], 0))
    mb.poly([(x, y, 1.02) for x, y in outline], "paint_black", normal=(0, 0, 1))
    mb.poly([(x, y, 0.65) for x, y in outline], "paint_black", normal=(0, 0, -1))
    mb.obox((0.0, 0.3, 1.5), (2.2, 0.9, 0.05), 0, "paint_black", roll=48)
    mb.box((-1.6, -0.72, 0.68), (-1.35, 0.72, 0.78), "paint_black")
    for i in range(36):
        y = -0.68 + i * 0.0378
        mb.box((-1.6, y, 0.78), (-1.37, y + 0.033, 0.8), "paint_white")
        if i % 7 not in (2, 6):
            mb.box((-1.5, y + 0.022, 0.8), (-1.37, y + 0.044, 0.825), "plastic_black")
    for x, y in ((-1.15, -0.62), (-1.15, 0.62), (1.05, 0.35)):
        mb.tube([(x, y, 0.65), (x, y, 0.06)], [0.085, 0.045], 12, "paint_black")
        mb.tube([(x, y - 0.03, 0.05), (x, y + 0.03, 0.05)], 0.05, 10, "gold")
    return mb


def boot():
    """A 20 m boot, toe toward +x, sole at z = 0."""
    mb = MeshBuilder()
    prof = [(-4.2, 3.0, 6.0), (-2.0, 3.4, 6.6), (0.5, 3.3, 5.4), (3.0, 3.5, 4.0), (6.0, 3.6, 3.4), (8.0, 3.0, 2.8), (9.2, 1.6, 1.8)]
    rings = []
    for x, w, h in prof:
        ring = []
        for k in range(24):
            a = TAU * k / 24
            cy, cz = math.cos(a), math.sin(a)
            ring.append((x, w * math.copysign(abs(cy) ** 0.75, cy), 1.0 + h * 0.5 + h * 0.5 * math.copysign(abs(cz) ** 0.75, cz)))
        rings.append(ring)
    mb.loft(np.array(rings), lambda r, c: "paint_brown", closed=True)
    for end, nx in ((0, -1), (len(rings) - 1, 1)):
        mb.poly(rings[end], "paint_brown", normal=(nx, 0, 0))
    mb.tube([(-1.6, 0, 6.0), (-1.9, 0, 11.0), (-2.2, 0, 17.0)], [3.1, 2.9, 3.2], 28, "paint_brown")
    mb.tube([(-2.2, 0, 16.4), (-2.22, 0, 17.4)], 3.4, 28, "fabric_black")
    mb.box((-4.5, -3.7, 0.0), (9.4, 3.7, 1.1), "rubber")
    for i in range(12):
        x = -4.1 + i * 1.1
        mb.box((x, -3.75, -0.35), (x + 0.6, 3.75, 0.05), "rubber")
    for i in range(6):
        z = 6.8 + i * 1.5
        mb.tube([(1.3 - i * 0.13, -1.7, z), (1.35 - i * 0.13, 1.7, z + 0.7)], 0.17, 8, "fabric_cream")
        mb.tube([(1.3 - i * 0.13, 1.7, z), (1.35 - i * 0.13, -1.7, z + 0.7)], 0.17, 8, "fabric_cream")
    return mb


def balloon(slot):
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 2.6, slot, 32, 24, scale=(1, 1, 1.22))
    mb.tube([(0, 0, -3.15), (0, 0, -3.5)], [0.28, 0.08], 12, slot)
    return mb


def spring_coil():
    mb = MeshBuilder()
    path = [(3.4 * math.cos(t * TAU), 3.4 * math.sin(t * TAU), t * 1.15) for t in np.linspace(0, 6, 150)]
    mb.tube(path, 0.36, 12, "steel")
    mb.tube([(0, 0, -0.35), (0, 0, 0.0)], 4.0, 32, "paint_red")
    mb.tube([(0, 0, 6.9), (0, 0, 7.4)], 4.0, 32, "paint_red")
    return mb


def magnet():
    """A huge horseshoe magnet hanging poles-down, centre at the origin."""
    mb = MeshBuilder()
    arc = [(5.0 * math.cos(a), 0.0, 5.0 * math.sin(a)) for a in np.linspace(0, math.pi, 24)]
    path = [(5.0, 0.0, -4.0)] + arc + [(-5.0, 0.0, -4.0)]
    mb.tube(path, 1.5, 18, "paint_red")
    for x in (-5.0, 5.0):
        mb.tube([(x, 0, -4.0), (x, 0, -6.2)], 1.52, 18, "steel_bright")
    mb.tube([(0, 0, 6.4), (0, 0, 8.0)], 0.5, 10, "iron_black")
    return mb


# ------------------------------------------------------------------ the other side
def gravity_device():
    mb = MeshBuilder()
    cylinder_x(mb, -0.3, 0.25, 0.09, "paint_darkgray")
    mb.tube([(0.25, 0, 0), (0.33, 0, 0)], 0.13, 20, "chrome")
    for k in range(3):
        a = TAU * k / 3 + 0.5
        mb.tube([(0.3, 0.11 * math.cos(a), 0.11 * math.sin(a)), (0.55, 0.19 * math.cos(a), 0.19 * math.sin(a)),
                 (0.7, 0.07 * math.cos(a), 0.07 * math.sin(a))], [0.022, 0.018, 0.006], 8, "chrome")
    sphere(mb, (0.45, 0, 0), 0.06, "glow_cyan", 14, 10)
    mb.box((-0.2, -0.03, -0.24), (-0.08, 0.03, -0.06), "rubber")
    return mb


def sonic_dish():
    mb = MeshBuilder()
    mb.box((-1.0, -0.8, 0.0), (1.0, 0.8, 0.5), "paint_darkgray")
    mb.tube([(0, 0, 0.5), (0, 0, 1.5)], 0.18, 12, "galvanized")
    prof = [(0.0, 0.0), (0.55, 0.06), (1.0, 0.24), (1.35, 0.55)]
    for i in range(len(prof) - 1):
        (r0, x0), (r1, x1) = prof[i], prof[i + 1]
        for k in range(36):
            a, b = TAU * k / 36, TAU * (k + 1) / 36
            pts = [(x0, r0 * math.cos(a), 1.9 + r0 * math.sin(a)), (x1, r1 * math.cos(a), 1.9 + r1 * math.sin(a)),
                   (x1, r1 * math.cos(b), 1.9 + r1 * math.sin(b)), (x0, r0 * math.cos(b), 1.9 + r0 * math.sin(b))]
            if i == 0:
                pts = pts[:3]
            mb.poly(pts, "chrome", normal=(1, 0, 0))
            mb.poly(pts, "paint_darkgray", normal=(-1, 0, 0))
    mb.tube([(0.0, 0, 1.9), (0.9, 0, 1.9)], 0.05, 8, "iron_black")
    sphere(mb, (0.95, 0, 1.9), 0.12, "glow_cyan", 12, 8)
    return mb


def cryo_canister():
    mb = canister(0.55, 0.14, "steel_bright", "glow_cyan")
    return mb


def saucer():
    """A 30 m flying saucer, centre at the origin."""
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(0.3, -2.6), (5.0, -2.3), (10.0, -1.2), (15.0, -0.15), (14.6, 0.35), (9.0, 1.5), (5.2, 2.2), (4.8, 2.4)], "alien_hull", segments=72)
    sphere(mb, (0, 0, 2.2), 5.0, "alien_dome", 48, 28, scale=(1, 1, 0.74), z_min=-0.05)
    for k in range(24):
        a = TAU * k / 24
        sphere(mb, (13.4 * math.cos(a), 13.4 * math.sin(a), -0.55), 0.42, "glow_cyan" if k % 2 else "glow_green", 10, 8)
    mb.lathe((0, 0, 0), [(3.2, -2.48), (2.6, -3.1), (1.4, -3.25), (0.2, -3.25)], "iron_black", segments=48)
    sphere(mb, (0, 0, -3.2), 1.15, "glow_green", 24, 14, scale=(1, 1, 0.4))
    return mb


def tripod_body():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 4.2, "alien_hull", 40, 28, scale=(1.35, 1.0, 0.7))
    sphere(mb, (4.6, 0, 0.3), 1.5, "alien_dome", 24, 18)
    sphere(mb, (5.9, 0, 0.3), 0.55, "glow_red", 16, 12)
    for k in range(3):
        a = TAU * k / 3 + math.pi
        mb.tube([(3.2 * math.cos(a), 2.4 * math.sin(a), -1.4), (4.0 * math.cos(a), 3.0 * math.sin(a), -2.8)], [0.9, 0.6], 14, "iron_black")
    return mb


def tripod_leg():
    """1 m leg segment along -z from the origin; scaled by the walker."""
    mb = MeshBuilder()
    mb.tube([(0, 0, 0), (0, 0, -1.0)], [0.045, 0.028], 12, "alien_hull")
    sphere(mb, (0, 0, 0), 0.06, "iron_black", 12, 8, scale=(1, 1, 0.35))
    return mb


def tripod_foot():
    mb = MeshBuilder()
    mb.lathe((0, 0, 0), [(1.9, 0.0), (1.5, 0.5), (0.5, 1.1), (0.25, 1.4)], "alien_hull", segments=24)
    return mb


def antimatter_capsule():
    mb = MeshBuilder()
    sphere(mb, (0, 0, 0), 0.22, "glow_violet", 24, 18)
    for axis in range(3):
        path = []
        for t in np.linspace(0, TAU, 33):
            q = [0.42 * math.cos(t), 0.42 * math.sin(t), 0.0]
            q = q[-axis:] + q[:-axis] if axis else q
            path.append(tuple(q))
        mb.tube(path, 0.032, 8, "chrome", caps=False)
    return mb


def meteor(seed, size, glow=True):
    rng = np.random.default_rng(seed)
    mb = MeshBuilder()
    # a lumpy body: displaced sphere
    nu, nv = 48, 32
    dirs = []
    bumps = rng.normal(0, 1, (40, 3))
    bumps /= np.linalg.norm(bumps, axis=1, keepdims=True)
    amp = rng.uniform(-0.16, 0.2, 40)

    def radius(d):
        w = np.exp((bumps @ d - 1.0) * 14.0)
        return size / 2 * (1.0 + float(w @ amp))

    grid = []
    for j in range(nv + 1):
        th = math.pi * j / nv
        row = []
        for i in range(nu + 1):
            ph = TAU * (i % nu) / nu
            d = np.array((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), -math.cos(th)))
            row.append(d * radius(d))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            quad = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            if j == 0:
                quad = [quad[0], quad[2], quad[3]]
            elif j == nv - 1:
                quad = [quad[0], quad[1], quad[2]]
            mid = np.mean(quad, axis=0)
            mb.poly(quad, "meteor_rock" if glow else "granite_black", normal=tuple(mid))
    return mb


def vent_cone():
    """A volcanic spatter cone with a glowing throat, 1 m tall unit."""
    mb = MeshBuilder()
    rng = np.random.default_rng(55)
    prof = [(2.6, 0.0), (1.9, 0.32), (1.2, 0.78), (0.78, 1.0), (0.55, 0.93)]
    n = 40
    rings = []
    for r, z in prof:
        rings.append([(r * (1 + 0.12 * rng.normal()) * math.cos(TAU * k / n), r * (1 + 0.12 * rng.normal()) * math.sin(TAU * k / n),
                       z * (1 + 0.05 * rng.normal())) for k in range(n)])
    mb.loft(np.array(rings), lambda r, c: "granite_black", closed=True, smooth=False)
    mb.poly(rings[-1], "meteor_rock", normal=(0, 0, 1))
    return mb


def hailstone():
    mb = MeshBuilder()
    hull_chunk(mb, np.random.default_rng(77), (0.22, 0.2, 0.18), "ice_clear", 22, 0.18)
    return mb


def ice_crystal():
    mb = MeshBuilder()
    rng = np.random.default_rng(12)
    for _ in range(9):
        d = rng.normal(0, 1, 3)
        d[2] = abs(d[2]) * 1.4
        d /= np.linalg.norm(d)
        length = rng.uniform(0.5, 1.4)
        mb.tube([(0, 0, 0), tuple(d * length * 0.75), tuple(d * length)], [0.11, 0.08, 0.004], 6, "ice_clear", smooth=False)
    return mb


def all_meshes():
    out = {
        "fx_volsphere": volsphere(), "fx_dome": dome(), "fx_beam": beam_cylinder(), "fx_craterdisc": crater_disc(),
        "fx_waterwall": water_wall(), "fx_watersheet": water_sheet(),
        "fx_scar": scar(), "fx_chip": chip(), "fx_shard": shard(), "fx_splinter": splinter(), "fx_paper": paper(),
        "tl_pebble": pebble(), "tl_baseball": baseball(), "tl_marble": marble(), "tl_grenade": grenade(), "tl_dynamite": dynamite(),
        "tl_firecracker": firecracker(), "tl_charge": charge_block(), "tl_linearcharge": charge_block(True), "tl_thermite": thermite_pot(),
        "tl_propane": propane_tank(), "tl_flare": road_flare(), "tl_mortartube": mortar_tube(), "tl_mortarbomb": mortar_bomb(),
        "tl_cannonball": cannonball(), "tl_tankshell": shell(0.12, 0.7, "steel"), "tl_howitzer": shell(0.155, 0.9),
        "tl_navalshell": shell(0.41, 1.7, "paint_gray"), "tl_rocket": finned_rocket(1.5, 0.07), "tl_bigrocket": finned_rocket(5.5, 0.34),
        "tl_fireworkrocket": finned_rocket(0.5, 0.05, "paint_blue", "gold"), "tl_thermobaric": canister(1.8, 0.28),
        "tl_penetrator": shell(0.4, 3.6, "paint_darkgray"), "tl_rod": rod(),
        "tl_cart": shopping_cart(), "tl_garbagetruck": garbage_truck(), "tl_monstertruck": monster_truck(), "tl_roadroller": road_roller(),
        "tl_bulldozer": bulldozer(), "tl_excavator": excavator_base(), "tl_arm": arm_segment(), "tl_claw": claw(),
        "tl_cranemast": crane_mast(), "tl_cranejib": crane_jib(), "tl_wreckingball": wrecking_ball(), "tl_chainlink": chain_link(),
        "tl_piledriver": pile_hammer(), "tl_ibeam": ibeam(), "tl_container": container(),
        "tl_duck": rubber_duck(), "tl_bowlingball": bowling_ball(), "tl_pinball": pinball(), "tl_anvil": anvil(), "tl_piano": piano(),
        "tl_boot": boot(), "tl_balloon_red": balloon("paint_red"), "tl_balloon_blue": balloon("paint_blue"),
        "tl_balloon_yellow": balloon("paint_yellow"), "tl_spring": spring_coil(), "tl_magnet": magnet(),
        "tl_gravitygun": gravity_device(), "tl_sonicdish": sonic_dish(), "tl_cryo": cryo_canister(), "tl_saucer": saucer(),
        "tl_tripod": tripod_body(), "tl_tripodleg": tripod_leg(), "tl_tripodfoot": tripod_foot(), "tl_antimatter": antimatter_capsule(),
        "tl_meteor": meteor(5, 1.0), "tl_rock": meteor(9, 1.0, False), "tl_vent": vent_cone(), "tl_hail": hailstone(),
        "tl_icecrystal": ice_crystal(),
    }
    for kind in ("claw_hammer", "crowbar", "pickaxe", "sledgehammer", "fire_axe", "hydrant_wrench", "chainsaw", "cutting_torch", "jackhammer"):
        out["tl_" + kind] = hand_tool(kind)
    for k in range(6):
        out["rubble%d" % k] = rubble(k)
    return out


def main():
    os.makedirs(os.path.join(OUT, "meshes"), exist_ok=True)
    manifest = []
    for name, mb in all_meshes().items():
        mb.save(os.path.join(OUT, "meshes", name + ".nmesh"))
        nanite = not name.startswith("fx_")
        manifest.append(dict(name=name, nanite=nanite, cards=6 if nanite else 0, preserve=False, tris=mb.tri_count))
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(dict(meshes=manifest), fh)
    print("destruction meshes: %d, %.0fk triangles" % (len(manifest), sum(m["tris"] for m in manifest) / 1000))


if __name__ == "__main__":
    main()
