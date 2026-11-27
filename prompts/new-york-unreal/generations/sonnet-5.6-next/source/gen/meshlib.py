"""Small mesh-building library. Units are METRES here; files are written in Unreal centimetres.

Axes: +X = uptown (grid north), +Y = grid east, +Z = up.  Faces are described with their
outward normal and the library fixes the winding, so callers never think about it.
"""
import math
import struct

import numpy as np

WHITE = (1.0, 1.0, 1.0, 1.0)


def v(x, y, z):
    return np.array((x, y, z), dtype=np.float64)


def norm(a):
    n = np.linalg.norm(a)
    return a / n if n > 1e-12 else a


def box_uv(p, n):
    """World-scale box projection: UVs are in metres, V points down walls."""
    ax, ay, az = abs(n[0]), abs(n[1]), abs(n[2])
    if az >= ax and az >= ay:
        return (p[:, 0], p[:, 1])
    if ax >= ay:
        return (p[:, 1] * (1 if n[0] > 0 else -1), -p[:, 2])
    return (p[:, 0] * (-1 if n[1] > 0 else 1), -p[:, 2])


class MeshBuilder:
    def __init__(self):
        self.pos, self.nrm, self.uv0, self.uv1, self.col = [], [], [], [], []
        self.tri, self.tslot = [], []
        # metres of chamfer on box edges (0 = sharp).  Chamfer vertices carry the normals of the two faces they
        # join, so an edge catches light as a soft line instead of a razor change of shade.
        self.bevel = 0.0
        self.slots = []
        self._slot_index = {}
        self.nv = 0

    # ------------------------------------------------------------------ basics
    def slot(self, name):
        i = self._slot_index.get(name)
        if i is None:
            i = len(self.slots)
            self.slots.append(name)
            self._slot_index[name] = i
        return i

    def raw(self, p, n, uv0, uv1, col, tris, slot):
        """Append pre-built arrays: p (N,3), n (N,3), uv (N,2), col (N,4), tris (M,3)."""
        p = np.asarray(p, np.float64)
        k = len(p)
        if k == 0 or len(tris) == 0:
            return
        self.pos.append(p)
        self.nrm.append(np.asarray(n, np.float64))
        self.uv0.append(np.asarray(uv0, np.float64))
        self.uv1.append(np.asarray(uv1, np.float64))
        self.col.append(np.asarray(col, np.float64))
        t = np.asarray(tris, np.int64) + self.nv
        self.tri.append(t)
        s = self.slot(slot) if isinstance(slot, str) else slot
        self.tslot.append(np.full(len(t), s, np.int64))
        self.nv += k

    def poly(self, pts, slot, normal=None, uv=None, uv1=None, color=WHITE):
        """Convex planar polygon (fan). `normal` is the outward direction."""
        p = np.asarray(pts, np.float64)
        k = len(p)
        # Newell normal
        q = np.roll(p, -1, axis=0)
        nw = np.array((
            np.sum((p[:, 1] - q[:, 1]) * (p[:, 2] + q[:, 2])),
            np.sum((p[:, 2] - q[:, 2]) * (p[:, 0] + q[:, 0])),
            np.sum((p[:, 0] - q[:, 0]) * (p[:, 1] + q[:, 1])),
        ))
        ln = np.linalg.norm(nw)
        if ln < 1e-10:
            return
        nw = nw / ln
        flip = False
        if normal is not None:
            want = norm(np.asarray(normal, np.float64))
            if np.dot(nw, want) < 0:
                flip = True
                nw = -nw
        n = np.tile(nw, (k, 1))
        if uv is None:
            u0, u1 = box_uv(p, nw)
            uv = np.stack([u0, u1], axis=1)
        uv = np.asarray(uv, np.float64)
        if uv1 is None:
            uv1 = np.zeros((k, 2))
        col = np.asarray(color, np.float64)
        if col.ndim == 1:
            col = np.tile(col, (k, 1))
        idx = np.arange(k)
        tris = np.stack([np.zeros(k - 2, np.int64), idx[1:-1], idx[2:]], axis=1)
        if flip:
            tris = tris[:, [0, 2, 1]]
        self.raw(p, n, uv, uv1, col, tris, slot)

    def quad(self, p0, p1, p2, p3, slot, normal=None, uv=None, uv1=None, color=WHITE):
        self.poly([p0, p1, p2, p3], slot, normal, uv, uv1, color)

    def box(self, lo, hi, slot, faces="xXyYzZ", color=WHITE, slots=None):
        """Axis-aligned box. `faces` picks sides (lower case = min side, upper = max side)."""
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        if x1 - x0 < 1e-5 or y1 - y0 < 1e-5 or z1 - z0 < 1e-5:
            return
        defs = {
            "x": ([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (-1, 0, 0)),
            "X": ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0)),
            "y": ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
            "Y": ([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)),
            "z": ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1)),
            "Z": ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        }
        b = self.bevel
        if b > 0.0 and min(x1 - x0, y1 - y0, z1 - z0) > 2.6 * b:
            self._bevelled_box((x0, y0, z0), (x1, y1, z1), slot, faces, color, slots, b)
            return
        for f in faces:
            pts, n = defs[f]
            s = slots.get(f, slot) if slots else slot
            self.poly(pts, s, n, color=color)

    def _bevelled_box(self, lo, hi, slot, faces, color, slots, b):
        axis_of = {"x": (0, 0), "X": (0, 1), "y": (1, 0), "Y": (1, 1), "z": (2, 0), "Z": (2, 1)}
        have = {axis_of[f]: f for f in faces}
        normal = lambda ax, side: np.array([(1.0 if side else -1.0) if k == ax else 0.0 for k in range(3)])

        def point(ax, side, others):
            """A corner of face (ax, side); others = {axis: side} for the two in-plane axes.  The corner is pulled in
            along every in-plane axis whose neighbouring face exists."""
            v = [0.0, 0.0, 0.0]
            v[ax] = (hi if side else lo)[ax]
            for k, s_ in others.items():
                v[k] = (hi if s_ else lo)[k]
                if (k, s_) in have:
                    v[k] += -b if s_ else b
            return tuple(v)

        for (ax, side), f in have.items():
            u, w = [k for k in range(3) if k != ax]
            pts = [point(ax, side, {u: su, w: sw}) for su, sw in ((0, 0), (1, 0), (1, 1), (0, 1))]
            self.poly(pts, slots.get(f, slot) if slots else slot, normal(ax, side), color=color)
        worn = (0.0, -1.0)

        def soft(pts, nrms, s):
            p = np.array(pts, np.float64)
            n = np.array(nrms, np.float64)
            geo = np.cross(p[1] - p[0], p[2] - p[0])
            if np.linalg.norm(geo) < 1e-12:
                return
            order = list(range(len(p)))
            if np.dot(geo, n.mean(axis=0)) < 0:
                order = order[::-1]
            p, n = p[order], n[order]
            u0, u1 = box_uv(p, norm(n.mean(axis=0)))
            tris = [(0, i, i + 1) for i in range(1, len(p) - 1)]
            col = np.asarray(color, np.float64)
            col = np.tile(col, (len(p), 1)) if col.ndim == 1 else col[:len(p)]
            self.raw(p, n, np.stack([u0, u1], axis=1), np.tile(worn, (len(p), 1)), col, tris, s)

        # strips along every edge shared by two faces
        done = set()
        for a in have:
            for c in have:
                if a[0] >= c[0] or (a, c) in done:
                    continue
                done.add((a, c))
                third = 3 - a[0] - c[0]
                pts, ns = [], []
                for end in (0, 1):
                    pts.append(point(a[0], a[1], {c[0]: c[1], third: end}))
                    ns.append(normal(*a))
                for end in (1, 0):
                    pts.append(point(c[0], c[1], {a[0]: a[1], third: end}))
                    ns.append(normal(*c))
                soft(pts, ns, slots.get(have[a], slot) if slots else slot)
        # and a small triangle wherever three faces meet
        for sx in (0, 1):
            for sy in (0, 1):
                for sz in (0, 1):
                    keys = [(0, sx), (1, sy), (2, sz)]
                    if all(k in have for k in keys):
                        sides = {0: sx, 1: sy, 2: sz}
                        pts = [point(ax, sd, {k: v for k, v in sides.items() if k != ax}) for ax, sd in keys]
                        soft(pts, [normal(*k) for k in keys], slot)

    def obox(self, center, size, yaw, slot, color=WHITE, faces="xXyYzZ", pitch=0.0, roll=0.0):
        """Box of `size` centred at `center`, rotated."""
        sx, sy, sz = (s * 0.5 for s in size)
        tmp = MeshBuilder()
        tmp.box((-sx, -sy, -sz), (sx, sy, sz), slot, faces=faces, color=color)
        self.merge(tmp, offset=center, yaw=yaw, pitch=pitch, roll=roll)

    # ------------------------------------------------------------------ solids
    def tube(self, path, radius, segments, slot, caps=True, color=WHITE, smooth=True):
        """Tube along a polyline. `radius` may be a scalar or one value per path point."""
        path = [np.asarray(p, np.float64) for p in path]
        n = len(path)
        if n < 2:
            return
        rad = np.full(n, radius, np.float64) if np.isscalar(radius) else np.asarray(radius, np.float64)
        tangents = []
        for i in range(n):
            a = path[max(i - 1, 0)]
            b = path[min(i + 1, n - 1)]
            tangents.append(norm(b - a))
        ref = v(0, 0, 1) if abs(tangents[0][2]) < 0.9 else v(1, 0, 0)
        side = norm(np.cross(ref, tangents[0]))
        rings, normals, vcoord = [], [], [0.0]
        ang = np.linspace(0, 2 * math.pi, segments + 1)
        for i in range(n):
            t = tangents[i]
            side = norm(side - t * np.dot(side, t))
            up = np.cross(t, side)
            dirs = np.outer(np.cos(ang), side) + np.outer(np.sin(ang), up)
            rings.append(path[i] + dirs * rad[i])
            normals.append(dirs)
            if i:
                vcoord.append(vcoord[-1] + np.linalg.norm(path[i] - path[i - 1]))
        s1 = segments + 1
        p = np.concatenate(rings)
        nn = np.concatenate(normals)
        circ = 2 * math.pi * float(np.mean(rad))
        uv = np.zeros((n * s1, 2))
        for i in range(n):
            uv[i * s1:(i + 1) * s1, 0] = np.linspace(0, circ, s1)
            uv[i * s1:(i + 1) * s1, 1] = vcoord[i]
        tris = []
        for i in range(n - 1):
            for j in range(segments):
                a = i * s1 + j
                b = a + 1
                c = a + s1
                d = c + 1
                tris.append((a, b, d))
                tris.append((a, d, c))
        tris = np.array(tris)
        # orient: face normal must agree with vertex normals
        fa, fb, fc = p[tris[:, 0]], p[tris[:, 1]], p[tris[:, 2]]
        fn = np.cross(fb - fa, fc - fa)
        if np.sum(np.einsum("ij,ij->i", fn, nn[tris[:, 0]])) < 0:
            tris = tris[:, [0, 2, 1]]
        if not smooth:
            for t3 in tris:
                self.poly(p[t3], slot, normal=nn[t3].mean(axis=0), color=color)
        else:
            col = np.tile(np.asarray(color), (len(p), 1))
            self.raw(p, nn, uv, np.zeros((len(p), 2)), col, tris, slot)
        if caps:
            for i, d in ((0, -tangents[0]), (n - 1, tangents[-1])):
                if rad[i] > 1e-4:
                    self.poly(rings[i][:-1], slot, normal=d, color=color)

    def cylinder(self, base, height, r0, slot, segments=12, r1=None, caps=True, color=WHITE, smooth=True):
        base = np.asarray(base, np.float64)
        self.tube([base, base + v(0, 0, height)], [r0, r0 if r1 is None else r1], segments, slot,
                  caps=caps, color=color, smooth=smooth)

    def lathe(self, center, profile, slot, segments=24, color=WHITE, arc=(0.0, 2 * math.pi)):
        """Revolve [(radius, z), ...] about the vertical axis through `center`. Smooth around, sharp along."""
        cx, cy, cz = center
        ang = np.linspace(arc[0], arc[1], segments + 1)
        ca, sa = np.cos(ang), np.sin(ang)
        vlen = 0.0
        for k in range(len(profile) - 1):
            (r0, z0), (r1, z1) = profile[k], profile[k + 1]
            dr, dz = r1 - r0, z1 - z0
            ln = math.hypot(dr, dz)
            if ln < 1e-6:
                continue
            nr, nz = dz / ln, -dr / ln
            p = np.zeros((2 * (segments + 1), 3))
            n = np.zeros_like(p)
            uv = np.zeros((2 * (segments + 1), 2))
            for row, (r, z, vv) in enumerate(((r0, z0, vlen), (r1, z1, vlen + ln))):
                o = row * (segments + 1)
                p[o:o + segments + 1] = np.stack([cx + r * ca, cy + r * sa, np.full(segments + 1, cz + z)], 1)
                n[o:o + segments + 1] = np.stack([nr * ca, nr * sa, np.full(segments + 1, nz)], 1)
                uv[o:o + segments + 1, 0] = (ang - arc[0]) * max(r0, r1)
                uv[o:o + segments + 1, 1] = -vv
            vlen += ln
            tris = []
            for j in range(segments):
                a, b = j, j + 1
                c, d = a + segments + 1, b + segments + 1
                tris.append((a, b, d))
                tris.append((a, d, c))
            tris = np.array(tris)
            fa, fb, fc = p[tris[:, 0]], p[tris[:, 1]], p[tris[:, 2]]
            fn = np.cross(fb - fa, fc - fa)
            if np.sum(np.einsum("ij,ij->i", fn, n[tris[:, 0]] + n[tris[:, 2]])) < 0:
                tris = tris[:, [0, 2, 1]]
            self.raw(p, n, uv, np.zeros((len(p), 2)), np.tile(np.asarray(color), (len(p), 1)), tris, slot)

    def sphere(self, center, radius, slot, segments=12, rings=8, scale=(1, 1, 1), color=WHITE, noise=0.0, seed=0):
        rng = np.random.default_rng(seed)
        th = np.linspace(0, math.pi, rings + 1)
        ph = np.linspace(0, 2 * math.pi, segments + 1)
        pts = np.zeros(((rings + 1) * (segments + 1), 3))
        nrm = np.zeros_like(pts)
        jitter = rng.uniform(-noise, noise, (rings + 1, segments + 1))
        jitter[:, -1] = jitter[:, 0]
        jitter[0, :] = jitter[0, 0]
        jitter[-1, :] = jitter[-1, 0]
        for i, t in enumerate(th):
            for j, f in enumerate(ph):
                d = v(math.sin(t) * math.cos(f), math.sin(t) * math.sin(f), math.cos(t))
                k = i * (segments + 1) + j
                pts[k] = np.asarray(center) + d * radius * (1 + jitter[i, j]) * np.asarray(scale)
                nrm[k] = norm(d / np.asarray(scale))
        tris = []
        for i in range(rings):
            for j in range(segments):
                a = i * (segments + 1) + j
                b = a + 1
                c = a + segments + 1
                d = c + 1
                tris += [(a, c, d), (a, d, b)]
        tris = np.array(tris)
        fa, fb, fc = pts[tris[:, 0]], pts[tris[:, 1]], pts[tris[:, 2]]
        fn = np.cross(fb - fa, fc - fa)
        if np.sum(np.einsum("ij,ij->i", fn, nrm[tris[:, 0]])) < 0:
            tris = tris[:, [0, 2, 1]]
        uv = pts[:, :2].copy()
        self.raw(pts, nrm, uv, np.zeros((len(pts), 2)), np.tile(np.asarray(color), (len(pts), 1)), tris, slot)

    def prism(self, poly2d, z0, z1, slot, top=None, bottom=None, color=WHITE, sides=True, cap_top=True, cap_bottom=False):
        """Vertical extrusion of a simple (possibly concave) 2D polygon [(x,y), ...]."""
        pts = [np.array(p, np.float64) for p in poly2d]
        area = 0.0
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            area += a[0] * b[1] - b[0] * a[1]
        if area < 0:
            pts = pts[::-1]
        if sides:
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                e = b - a
                if np.linalg.norm(e) < 1e-4:
                    continue
                out = (e[1], -e[0], 0.0)
                self.quad((a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1), slot,
                          normal=out, color=color)
        for flag, z, nz, s in ((cap_top, z1, 1, top or slot), (cap_bottom, z0, -1, bottom or slot)):
            if flag:
                for t in triangulate(pts):
                    self.poly([(p[0], p[1], z) for p in t], s, normal=(0, 0, nz), color=color)

    def sweep(self, profile, path, slot, closed=True, color=WHITE, z=0.0):
        """Sweep a moulding profile [(out, up), ...] around a 2D footprint (CCW => out points away)."""
        pts = [np.array(p[:2], np.float64) for p in path]
        area = 0.0
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            area += a[0] * b[1] - b[0] * a[1]
        if closed and area < 0:
            pts = pts[::-1]
        n = len(pts)

        def edge_normal(a, b):
            e = b - a
            e = e / max(np.linalg.norm(e), 1e-9)
            return np.array((e[1], -e[0]))

        miters = []
        for i in range(n):
            ns = []
            if closed or i > 0:
                ns.append(edge_normal(pts[(i - 1) % n], pts[i]))
            if closed or i < n - 1:
                ns.append(edge_normal(pts[i], pts[(i + 1) % n]))
            if len(ns) == 1:
                miters.append(ns[0])
            else:
                s = ns[0] + ns[1]
                d = 1.0 + float(np.dot(ns[0], ns[1]))
                miters.append(s / max(d, 0.2))
        last = n if closed else n - 1
        for i in range(last):
            j = (i + 1) % n
            en = edge_normal(pts[i], pts[j])
            for k in range(len(profile) - 1):
                (o0, u0), (o1, u1) = profile[k], profile[k + 1]
                a = pts[i] + miters[i] * o0
                b = pts[j] + miters[j] * o0
                c = pts[j] + miters[j] * o1
                d = pts[i] + miters[i] * o1
                do, du = o1 - o0, u1 - u0
                ln = math.hypot(do, du)
                if ln < 1e-6:
                    continue
                # outward profile normal: rotate (do, du) clockwise
                no, nu = du / ln, -do / ln
                nrm = (en[0] * no, en[1] * no, nu)
                self.quad((a[0], a[1], z + u0), (b[0], b[1], z + u0), (c[0], c[1], z + u1), (d[0], d[1], z + u1),
                          slot, normal=nrm, color=color)

    def loft(self, sections, slot_fn, color=WHITE, smooth=True, closed=False):
        """Surface through rows of points: sections (R, C, 3). slot_fn(r, c) names each cell's material."""
        S = np.asarray(sections, np.float64)
        R, C = S.shape[:2]
        du = np.gradient(S, axis=0)
        if closed:
            dv = (np.roll(S, -1, axis=1) - np.roll(S, 1, axis=1)) * 0.5
        else:
            dv = np.gradient(S, axis=1)
        N = np.cross(du, dv)
        ln = np.linalg.norm(N, axis=2, keepdims=True)
        N = N / np.maximum(ln, 1e-9)
        # point normals away from the loft's central axis
        axis = S.mean(axis=1, keepdims=True)
        if np.sum(N * (S - axis)) < 0:
            N = -N
        cells = {}
        cmax = C if closed else C - 1
        for r in range(R - 1):
            for c in range(cmax):
                s = slot_fn(r, c)
                if s is None:
                    continue
                cells.setdefault(s, []).append((r, c))
        for s, lst in cells.items():
            vmap = {}
            P, Nn, UV, tris = [], [], [], []

            def vid(r, c):
                key = (r, c)
                i = vmap.get(key)
                if i is None:
                    i = len(P)
                    vmap[key] = i
                    P.append(S[r, c])
                    Nn.append(N[r, c])
                    UV.append((S[r, c][0], S[r, c][2]))
                return i

            for r, c in lst:
                c2 = (c + 1) % C
                a, b, d, e = vid(r, c), vid(r, c2), vid(r + 1, c2), vid(r + 1, c)
                for t in ((a, b, d), (a, d, e)):
                    p0, p1, p2 = P[t[0]], P[t[1]], P[t[2]]
                    fn = np.cross(p1 - p0, p2 - p0)
                    if np.dot(fn, fn) < 1e-14:
                        continue
                    if np.dot(fn, Nn[t[0]] + Nn[t[1]] + Nn[t[2]]) < 0:
                        t = (t[0], t[2], t[1])
                    tris.append(t)
            if not tris:
                continue
            if smooth:
                k = len(P)
                self.raw(np.array(P), np.array(Nn), np.array(UV), np.zeros((k, 2)),
                         np.tile(np.asarray(color), (k, 1)), np.array(tris), s)
            else:
                for t in tris:
                    p3 = np.array([P[i] for i in t])
                    self.poly(p3, s, normal=sum(Nn[i] for i in t), color=color)

    # ------------------------------------------------------------------ composing
    def merge(self, other, offset=(0, 0, 0), yaw=0.0, pitch=0.0, roll=0.0, scale=(1, 1, 1), color_mul=None):
        if other.nv == 0:
            return
        p, n, uv0, uv1, col, tri, ts = other.arrays()
        sc = np.asarray(scale, np.float64)
        p = p * sc
        n = n / sc
        R = rot_matrix(yaw, pitch, roll)
        p = p @ R.T + np.asarray(offset, np.float64)
        n = n @ R.T
        n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        if sc[0] * sc[1] * sc[2] < 0:
            tri = tri[:, [0, 2, 1]]
        if color_mul is not None:
            col = col * np.asarray(color_mul)
        remap = np.array([self.slot(s) for s in other.slots], np.int64)
        self.pos.append(p)
        self.nrm.append(n)
        self.uv0.append(uv0)
        self.uv1.append(uv1)
        self.col.append(col)
        self.tri.append(tri + self.nv)
        self.tslot.append(remap[ts])
        self.nv += len(p)

    def arrays(self):
        if self.nv == 0:
            z3 = np.zeros((0, 3))
            return z3, z3, np.zeros((0, 2)), np.zeros((0, 2)), np.zeros((0, 4)), np.zeros((0, 3), np.int64), np.zeros(0, np.int64)
        if len(self.pos) > 1:
            self.pos = [np.concatenate(self.pos)]
            self.nrm = [np.concatenate(self.nrm)]
            self.uv0 = [np.concatenate(self.uv0)]
            self.uv1 = [np.concatenate(self.uv1)]
            self.col = [np.concatenate(self.col)]
            self.tri = [np.concatenate(self.tri)]
            self.tslot = [np.concatenate(self.tslot)]
        return (self.pos[0], self.nrm[0], self.uv0[0], self.uv1[0], self.col[0], self.tri[0], self.tslot[0])

    @property
    def tri_count(self):
        return sum(len(t) for t in self.tri)

    def save(self, path):
        p, n, uv0, uv1, col, tri, ts = self.arrays()
        if len(tri) == 0:
            raise ValueError("empty mesh " + path)
        with open(path, "wb") as f:
            f.write(struct.pack("<IIIII", 0x48534D4E, 1, len(p), len(tri), len(self.slots)))
            for s in self.slots:
                b = s.encode("utf-8")
                f.write(struct.pack("<H", len(b)))
                f.write(b)
            f.write((p * 100.0).astype("<f4").tobytes())
            f.write(n.astype("<f4").tobytes())
            f.write(uv0.astype("<f4").tobytes())
            f.write(uv1.astype("<f4").tobytes())
            f.write(np.clip(col * 255.0 + 0.5, 0, 255).astype(np.uint8).tobytes())
            f.write(tri.astype("<u4").tobytes())
            f.write(ts.astype("<u2").tobytes())


def rot_matrix(yaw=0.0, pitch=0.0, roll=0.0):
    """Degrees. yaw about +Z (+X toward +Y), pitch lifts +X toward +Z, roll about +X."""
    y, p, r = math.radians(yaw), math.radians(pitch), math.radians(roll)
    Rz = np.array(((math.cos(y), -math.sin(y), 0), (math.sin(y), math.cos(y), 0), (0, 0, 1)))
    Ry = np.array(((math.cos(p), 0, -math.sin(p)), (0, 1, 0), (math.sin(p), 0, math.cos(p))))
    Rx = np.array(((1, 0, 0), (0, math.cos(r), -math.sin(r)), (0, math.sin(r), math.cos(r))))
    return Rz @ Ry @ Rx


def triangulate(pts):
    """Ear clipping for a CCW simple polygon of 2D points. Returns list of triangles."""
    idx = list(range(len(pts)))
    out = []

    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def inside(p, a, b, c):
        return cross(a, b, p) >= -1e-9 and cross(b, c, p) >= -1e-9 and cross(c, a, p) >= -1e-9

    guard = 0
    while len(idx) > 3 and guard < 20000:
        guard += 1
        found = False
        for i in range(len(idx)):
            ia, ib, ic = idx[i - 1], idx[i], idx[(i + 1) % len(idx)]
            a, b, c = pts[ia], pts[ib], pts[ic]
            if cross(a, b, c) <= 1e-9:
                continue
            if any(inside(pts[j], a, b, c) for j in idx if j not in (ia, ib, ic)):
                continue
            out.append((a, b, c))
            idx.pop(i)
            found = True
            break
        if not found:
            idx.pop(0)
    if len(idx) == 3:
        out.append(tuple(pts[j] for j in idx))
    return out


class Layout:
    """Instance lists grouped for ANYCCityActor (binary .nlayout)."""

    def __init__(self, tile=450.0):
        self.groups = {}
        self.tile = tile

    def add(self, mesh, pos, yaw=0.0, scale=(1, 1, 1), custom=(), override="", shadow=True, rt=True, layer="city"):
        if np.isscalar(scale):
            scale = (scale, scale, scale)
        key = (layer, mesh, override, shadow, rt, len(custom),
               int(math.floor(pos[0] / self.tile)), int(math.floor(pos[1] / self.tile)))
        rows = self.groups.setdefault(key, [])
        rows.append((pos[0] * 100.0, pos[1] * 100.0, pos[2] * 100.0, yaw, scale[0], scale[1], scale[2], *custom))
        return key, len(rows) - 1

    def count(self):
        return sum(len(g) for g in self.groups.values())

    def save(self, path):
        """Writes the file and returns {group key: index in the file}."""
        order = {}
        with open(path, "wb") as f:
            f.write(struct.pack("<II", 0x59414C4E, len(self.groups)))
            for key, rows in sorted(self.groups.items(), key=lambda kv: str(kv[0])):
                order[key] = len(order)
                layer, mesh, override, shadow, rt, ncustom, tx, ty = key
                for s in ("%s_%s_%d_%d" % (layer, mesh, tx, ty), mesh, override):
                    b = s.encode("utf-8")
                    f.write(struct.pack("<H", len(b)))
                    f.write(b)
                f.write(struct.pack("<BBI", (1 if shadow else 0) | (2 if rt else 0), ncustom, len(rows)))
                f.write(np.asarray(rows, dtype="<f4").tobytes())
        return order
