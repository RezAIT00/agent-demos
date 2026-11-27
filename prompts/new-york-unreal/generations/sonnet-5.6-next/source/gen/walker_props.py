"""Things held in the hand.  Each is modelled around the grip point (the origin) and weighted wholly
to a hand's prop bone, so the same skinning (and motion vectors) as the body moves it."""
import math
import os

import numpy as np

from walker_sdf import *  # noqa: F401,F403
from walker_bodies import B, PROP, NYLON, GLOSS, LEATHER, CANVAS, PLAIN, WOOL, write_nmesh

# kind, hand ("R" or "L"), mesh name
PROP_LIST = [
    dict(name="umbrella0", kind="umbrella", hand="R"), dict(name="umbrella1", kind="umbrella", hand="R"),
    dict(name="briefcaseR", kind="briefcase", hand="R"), dict(name="briefcaseL", kind="briefcase", hand="L"),
    dict(name="shopbagR", kind="shopbag", hand="R"), dict(name="shopbagL", kind="shopbag", hand="L"),
    dict(name="phone", kind="phone", hand="R"), dict(name="coffee", kind="coffee", hand="R"),
]


class Mesh:
    def __init__(self):
        self.p, self.n, self.fab, self.det, self.part, self.t = [], [], [], [], [], []
        self.nv = 0

    def add(self, P, N, T, fabric, detail=0.0, part=PROP):
        P = np.asarray(P, np.float32)
        self.p.append(P)
        self.n.append(np.asarray(N, np.float32))
        self.fab.append(np.full(len(P), fabric))
        self.det.append(np.full(len(P), detail, np.float32))
        self.part.append(np.full(len(P), part))
        self.t.append(np.asarray(T, np.int64) + self.nv)
        self.nv += len(P)

    def solid(self, f, lo, hi, voxel, tris, fabric, detail=0.0, part=PROP, soft=0.2):
        verts, faces = polygonize(f, lo, hi, voxel)
        if not len(faces):
            return
        verts, faces = decimate(verts, faces, tris)
        verts, faces, normals = shading_normals(f, verts, faces, 55.0, soft)
        self.add(verts, normals, faces, fabric, detail, part)

    def tube(self, path, radius, sides, fabric, detail=0.0):
        path = [np.asarray(p, np.float64) for p in path]
        rings, normals = [], []
        ref = np.array((0.0, 1.0, 0.0))
        for i in range(len(path)):
            t = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]
            t /= np.linalg.norm(t)
            a = np.cross(t, ref)
            if np.linalg.norm(a) < 1e-4:
                a = np.cross(t, (1.0, 0.0, 0.0))
            a /= np.linalg.norm(a)
            b = np.cross(t, a)
            ang = np.linspace(0, 2 * math.pi, sides, endpoint=False)
            d = np.outer(np.cos(ang), a) + np.outer(np.sin(ang), b)
            rings.append(path[i] + d * radius)
            normals.append(d)
        P = np.concatenate(rings)
        N = np.concatenate(normals)
        T = []
        for i in range(len(path) - 1):
            for j in range(sides):
                a0, a1 = i * sides + j, i * sides + (j + 1) % sides
                b0, b1 = a0 + sides, a1 + sides
                T += [(a0, a1, b1), (a0, b1, b0)]
        T = np.array(T)
        fa = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
        flip = np.einsum("ij,ij->i", fa, N[T[:, 0]]) < 0
        T[flip] = T[flip][:, [0, 2, 1]]
        self.add(P, N, T, fabric, detail)

    def save(self, path, bone):
        P = np.concatenate(self.p)
        n = len(P)
        uv0 = np.stack([np.full(n, bone), np.concatenate(self.part) + 32 * np.concatenate(self.fab)], axis=1).astype(np.float64)
        uv1 = np.tile((1.0, 0.0), (n, 1))
        col = np.stack([np.ones(n), np.concatenate(self.det), np.zeros(n), np.ones(n)], axis=1)
        write_nmesh(path, P, np.concatenate(self.n), uv0, uv1, col, np.concatenate(self.t))
        return n, sum(len(t) for t in self.t)


def umbrella(variant, lod):
    m = Mesh()
    R = 55.0 if variant == 0 else 49.0
    apex, drop = 84.0, 27.0 if variant == 0 else 23.0
    ribs = 8
    radial = {0: 9, 1: 6, 2: 3}[lod]
    across = {0: 6, 1: 3, 2: 1}[lod]

    def surf(a, t, under=False):
        k = (a / (2 * math.pi) * ribs) % 1.0
        sag = math.sin(math.pi * k)  # the fabric is scalloped between the ribs
        # a rounded crown that curves over and down to the rim
        phi = t * 1.30
        r = R * math.sin(phi) / math.sin(1.30) * (1.0 - 0.085 * sag * t ** 3)
        z = apex - drop * (1.0 - math.cos(phi)) / (1.0 - math.cos(1.30)) + 3.4 * sag * t ** 4 - 0.9 * sag * math.sin(math.pi * t)
        return np.array((r * math.cos(a), r * math.sin(a), z - (0.16 if under else 0.0)))

    for under in (False, True):
        pts, nrm, tri = [], [], []
        cols = ribs * across
        for i in range(radial + 1):
            t = i / radial
            for j in range(cols + 1):
                a = 2 * math.pi * j / cols
                p = surf(a, max(t, 0.004), under)
                da = surf(a + 0.01, max(t, 0.05), under) - surf(a - 0.01, max(t, 0.05), under)
                dt = surf(a, min(t + 0.01, 1.0), under) - surf(a, max(t - 0.01, 0.004), under)
                n = np.cross(da, dt)
                n /= max(np.linalg.norm(n), 1e-9)
                if (n[2] < 0) != under:
                    n = -n
                pts.append(p)
                nrm.append(n)
        for i in range(radial):
            for j in range(cols):
                a0 = i * (cols + 1) + j
                a1, b0 = a0 + 1, a0 + cols + 1
                tri += [(a0, a1, b0 + 1), (a0, b0 + 1, b0)]
        P, N, T = np.array(pts), np.array(nrm), np.array(tri)
        fa = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
        flip = np.einsum("ij,ij->i", fa, N[T[:, 0]] + N[T[:, 2]]) < 0
        T[flip] = T[flip][:, [0, 2, 1]]
        m.add(P, N, T, NYLON, 1.0)
    sides = 7 if lod == 0 else 5
    m.tube([(0, 0, -7.0), (0, 0, apex + 1.0)], 0.62, sides, GLOSS, 0.0)
    m.tube([(0, 0, apex), (0, 0, apex + 5.0)], 0.5, sides, GLOSS, 0.0)
    hook = [(0, 0, -5.0), (0, 0, -9.5), (1.0, 0, -12.0), (3.4, 0, -13.0), (5.6, 0, -11.6), (6.2, 0, -9.2)]
    m.tube(hook if variant == 0 else [(0, 0, -11.0), (0, 0, -4.0)], 1.35, sides, LEATHER, 0.0)
    m.tube([(0, 0, -5.0), (0, 0, 5.0)], 1.3, sides, LEATHER, 0.0)
    if lod < 2:
        for k in range(ribs):
            a = 2 * math.pi * k / ribs
            m.tube([surf(a, t, True) + np.array((0, 0, -0.35)) for t in np.linspace(0.04, 1.0, 6)], 0.26, 4, GLOSS, 1.0)
            # the rib tips poke a little past the cloth
            tip = surf(a, 1.0, True)
            m.tube([tip + np.array((0, 0, -0.2)), tip * np.array((1.035, 1.035, 1.0)) + np.array((0, 0, -1.4))], 0.34, 4, GLOSS, 1.0)
        if lod == 0:
            for k in range(ribs):
                a = 2 * math.pi * k / ribs
                m.tube([(0, 0, apex - 31.0), tuple(surf(a, 0.52, True) + np.array((0, 0, -0.7)))], 0.22, 4, GLOSS, 1.0)
    return m


def briefcase(lod):
    m = Mesh()
    k = {0: 1.0, 1: 0.3, 2: 0.1}[lod]
    body = box((0, 0, -22.0), (19.5, 4.2, 13.8), 2.0)
    seam = lambda P: (0.22 * np.exp(-((P[:, 2] + 13.0) / 0.4) ** 2)).astype(np.float32)
    m.solid(displace(body, seam), (-21, -6, -37), (21, 6, -7), 0.7, int(700 * k) + 24, LEATHER)
    m.tube([(-5.2, 0, -8.4), (-4.6, 0, -2.2), (-2.4, 0, -0.2), (2.4, 0, -0.2), (4.6, 0, -2.2), (5.2, 0, -8.4)], 1.0, 6 if lod == 0 else 4, LEATHER)
    if lod == 0:
        for x in (-8.5, 8.5):
            m.solid(box((x, 0, -10.6), (1.5, 4.55, 1.1), 0.3), (x - 3, -6, -13), (x + 3, 6, -8), 0.4, 80, GLOSS, 0.0)
    return m


def shopbag(lod):
    m = Mesh()
    k = {0: 1.0, 1: 0.35, 2: 0.12}[lod]
    zs = [-40.0, -38.0, -30.0, -20.0, -12.0]
    bag = loft(zs, [0] * 5, [13.0, 13.8, 14.2, 13.6, 12.8], [5.6, 6.6, 6.2, 4.6, 3.3], power=4.5)
    crinkle = lambda P: (0.5 * value_noise(P, (5.0, 3.0, 4.0), 81)).astype(np.float32)
    f = displace(bag, crinkle)
    hollow = box((0, 0, -9.5), (11.8, 2.4, 5.0), 0.8)
    f = ssub(f, hollow, 0.4)
    m.solid(f, (-17, -10, -42), (17, 10, -9), 0.7, int(900 * k) + 30, CANVAS, 0.0, soft=0.4)
    for y in (-2.0, 2.0):
        m.tube([(-4.6, y * 1.5, -12.4), (-3.2, y * 0.8, -5.0), (0.0, y * 0.35, -0.3), (3.2, y * 0.8, -5.0), (4.6, y * 1.5, -12.4)],
               0.42, 5 if lod == 0 else 3, PLAIN)
    return m


def phone(lod):
    m = Mesh()
    k = {0: 1.0, 1: 0.35, 2: 0.15}[lod]
    slab = box((3.6, 0, 1.55), (7.4, 3.7, 0.48), 0.42)
    m.solid(slab, (-6, -6, -1), (13, 6, 4), 0.34, int(260 * k) + 20, GLOSS, 0.0)
    # lit screen just proud of the face toward the reader
    q = np.array([(-3.4, -3.35, 2.08), (10.6, -3.35, 2.08), (10.6, 3.35, 2.08), (-3.4, 3.35, 2.08)])
    m.add(q, np.tile((0, 0, 1.0), (4, 1)), np.array([(0, 1, 2), (0, 2, 3)]), PLAIN, 0.5)
    return m


def coffee(lod):
    m = Mesh()
    k = {0: 1.0, 1: 0.35, 2: 0.15}[lod]
    cup = round_cone((0.6, 0, -4.6), (0.6, 0, 6.4), 3.0, 3.75)
    cup = sinter(0.3, cup, lambda P: np.maximum(-5.2 - P[:, 2], P[:, 2] - 6.8).astype(np.float32))
    m.solid(cup, (-5, -5, -7), (6, 5, 8), 0.4, int(420 * k) + 20, PLAIN, 0.0)
    sleeve = sinter(0.2, round_cone((0.6, 0, -2.6), (0.6, 0, 3.2), 3.45, 3.78), lambda P: np.maximum(-2.2 - P[:, 2], P[:, 2] - 2.8).astype(np.float32))
    m.solid(sleeve, (-5, -5, -4), (6, 5, 5), 0.42, int(240 * k) + 16, CANVAS, 0.0)
    lid = sinter(0.3, round_cone((0.6, 0, 6.4), (0.6, 0, 8.0), 3.95, 3.35), lambda P: np.maximum(6.5 - P[:, 2], P[:, 2] - 8.3).astype(np.float32))
    m.solid(lid, (-5, -5, 5), (6, 5, 10), 0.36, int(200 * k) + 16, GLOSS, 0.0)
    return m


def main(out):
    stats = []
    for spec in PROP_LIST:
        bone = B["propR"] if spec["hand"] == "R" else B["propL"]
        for lod in range(3):
            if spec["kind"] == "umbrella":
                m = umbrella(int(spec["name"][-1]), lod)
            else:
                m = {"briefcase": briefcase, "shopbag": shopbag, "phone": phone, "coffee": coffee}[spec["kind"]](lod)
            n, t = m.save(os.path.join(out, "meshes", "prop_%s_l%d.nmesh" % (spec["name"], lod)), bone)
            if lod == 0:
                stats.append("%s %dt" % (spec["name"], t))
    print("props:", ", ".join(stats))


if __name__ == "__main__":
    import sys
    main(sys.argv[1])
