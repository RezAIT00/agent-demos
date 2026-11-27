"""Vectorised signed distance functions (units: cm) and the mesher that turns them into triangles.

Every shape is a callable f(P) -> distances for an (N, 3) array of points.
"""
import numpy as np
from skimage import measure
import fast_simplification


def v(*a):
    return np.array(a, dtype=np.float32)


def sat(x):
    return np.clip(x, 0.0, 1.0)


def smooth(a, b, x):
    """smoothstep from a to b (b may be below a)."""
    t = sat((x - a) / (b - a))
    return t * t * (3.0 - 2.0 * t)


# ------------------------------------------------------------------ primitives
def round_cone(a, b, r1, r2):
    """Capsule with different radii at the two ends (Quilez)."""
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2

    def f(P):
        pa = P - a
        y = pa @ ba
        z = y - l2
        q = pa * l2 - ba * y[:, None]
        x2 = np.einsum("ij,ij->i", q, q)
        y2 = y * y * l2
        z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
        m2 = (np.sign(y) * a2 * y2) < k
        d = np.where(m2, np.sqrt(x2 + y2) * il2 - r1, d)
        m1 = (np.sign(z) * a2 * z2) > k
        d = np.where(m1, np.sqrt(x2 + z2) * il2 - r2, d)
        return d.astype(np.float32)

    return f


def capsule(a, b, r):
    return round_cone(a, b, r, r - 1e-3)


def chain(pts, radii):
    parts = [round_cone(pts[i], pts[i + 1], radii[i], radii[i + 1]) for i in range(len(pts) - 1)]
    return union(*parts)


def ellipsoid(c, r, rot=None):
    c, r = np.asarray(c, np.float32), np.asarray(r, np.float32)

    def f(P):
        q = P - c
        if rot is not None:
            q = q @ rot
        k0 = np.linalg.norm(q / r, axis=1)
        k1 = np.linalg.norm(q / (r * r), axis=1)
        return np.where(k1 > 1e-9, k0 * (k0 - 1.0) / np.maximum(k1, 1e-9), -float(r.min())).astype(np.float32)

    return f


def box(c, half, round_=0.0, rot=None):
    c, half = np.asarray(c, np.float32), np.asarray(half, np.float32)

    def f(P):
        q = P - c
        if rot is not None:
            q = q @ rot
        q = np.abs(q) - (half - round_)
        return (np.linalg.norm(np.maximum(q, 0.0), axis=1) + np.minimum(q.max(axis=1), 0.0) - round_).astype(np.float32)

    return f


def torus(c, R, r, rot=None, squash=(1.0, 1.0)):
    """Ring around the local Z axis; squash scales the ring in local x and y."""
    c = np.asarray(c, np.float32)

    def f(P):
        q = P - c
        if rot is not None:
            q = q @ rot
        x, y = q[:, 0] / squash[0], q[:, 1] / squash[1]
        ring = np.sqrt(x * x + y * y) - R
        return (np.sqrt(ring * ring + q[:, 2] ** 2) - r).astype(np.float32)

    return f


def rot_xyz(rx=0.0, ry=0.0, rz=0.0):
    """Rotation matrix (degrees) whose columns are the local axes; use as `rot` above."""
    rx, ry, rz = np.radians([rx, ry, rz])
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    X = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return (Z @ Y @ X).astype(np.float32)


def loft(zs, cx, depth, width, power=2.3, back=None, cy=None, cap=True):
    """Superellipse cross sections stacked along z.  depth is the half size in x (front), `back` the
    half size behind the centre line (defaults to depth), width the half size in y."""
    zs = np.asarray(zs, np.float32)
    cx, depth, width = (np.asarray(a, np.float32) * np.ones_like(zs) for a in (cx, depth, width))
    back = depth if back is None else np.asarray(back, np.float32) * np.ones_like(zs)
    cy = np.zeros_like(zs) if cy is None else np.asarray(cy, np.float32) * np.ones_like(zs)
    order = np.argsort(zs)
    zs, cx, depth, width, back, cy = (a[order] for a in (zs, cx, depth, width, back, cy))
    fine = np.linspace(zs[0], zs[-1], 256, dtype=np.float32)

    def soft(a):
        # a light blur so the profile has no corners at the control heights
        y = np.interp(fine, zs, a)
        k = np.hanning(15)
        k /= k.sum()
        return np.convolve(np.pad(y, 7, mode="edge"), k, mode="valid").astype(np.float32)

    CX, D, W, B, CY = soft(cx), soft(depth), soft(width), soft(back), soft(cy)

    def f(P):
        z = P[:, 2]
        c = np.interp(z, fine, CX)
        w = np.interp(z, fine, W)
        x = P[:, 0] - c
        d = np.where(x >= 0, np.interp(z, fine, D), np.interp(z, fine, B))
        y = P[:, 1] - np.interp(z, fine, CY)
        ax, ay = np.abs(x) / d, np.abs(y) / w
        m = np.maximum(ax, ay)
        mm = np.maximum(m, 1e-6)
        q = mm * ((ax / mm) ** power + (ay / mm) ** power) ** (1.0 / power)
        # first order distance: divide by the gradient length of the implicit form
        k = np.sqrt((x / (d * d)) ** 2 + (y / (w * w)) ** 2)
        dist = np.where(k > 1e-6, q * (q - 1.0) / np.maximum(k, 1e-6), -np.minimum(d, w))
        dist = np.clip(dist, -40.0, 60.0)
        if cap:
            dist = np.maximum(dist, np.maximum(zs[0] - z, z - zs[-1]))
        return dist.astype(np.float32)

    return f


def loft_x(xs, zc_half, width, cy=0.0, power=2.4):
    """Cross sections stacked along x (shoes).  zc_half is a list of (bottom, top) per station."""
    xs = np.asarray(xs, np.float32)
    lo = np.array([a for a, _ in zc_half], np.float32)
    hi = np.array([b for _, b in zc_half], np.float32)
    width = np.asarray(width, np.float32)

    def f(P):
        x = P[:, 0]
        w = np.maximum(np.interp(x, xs, width), 0.3)
        b, t = np.interp(x, xs, lo), np.interp(x, xs, hi)
        zc, h = (b + t) * 0.5, np.maximum((t - b) * 0.5, 0.3)
        y = P[:, 1] - cy
        z = P[:, 2] - zc
        # flat sole, rounded upper
        pw = np.where(z < 0, 5.0, power)
        ay, az = np.abs(y) / w, np.abs(z) / h
        q = (ay ** pw + az ** pw) ** (1.0 / pw)
        k = np.sqrt((y / (w * w)) ** 2 + (z / (h * h)) ** 2)
        dist = np.where(k > 1e-6, q * (q - 1.0) / np.maximum(k, 1e-6), -np.minimum(w, h))
        dist = np.clip(dist, -20.0, 30.0)
        return np.maximum(dist, np.maximum(xs[0] - x, x - xs[-1])).astype(np.float32)

    return f


# ------------------------------------------------------------------ operators
def union(*fs):
    def f(P):
        d = fs[0](P)
        for g in fs[1:]:
            d = np.minimum(d, g(P))
        return d

    return f


def smin(a, b, k):
    h = sat(0.5 + 0.5 * (b - a) / k)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def sunion(k, *fs):
    def f(P):
        d = fs[0](P)
        for g in fs[1:]:
            d = smin(d, g(P), k)
        return d

    return f


def ssub(a, b, k):
    """a minus b with a rounded edge."""
    def f(P):
        return smax(a(P), -b(P), k)

    return f


def sinter(k, a, b):
    def f(P):
        return smax(a(P), b(P), k)

    return f


def offset(a, r):
    return lambda P: a(P) - r


def shell(a, thickness):
    return lambda P: np.abs(a(P) + thickness * 0.5) - thickness * 0.5


def halfspace(point, normal):
    """Negative on the side the normal points away from."""
    point, normal = np.asarray(point, np.float32), np.asarray(normal, np.float32)
    normal = normal / np.linalg.norm(normal)
    return lambda P: ((P - point) @ normal).astype(np.float32)


def displace(a, fn):
    return lambda P: a(P) + fn(P)


# ------------------------------------------------------------------ noise
_rng = np.random.default_rng(1234)
_LATTICE = _rng.uniform(-1.0, 1.0, (64, 64, 64)).astype(np.float32)


def value_noise(P, scale, seed=0):
    q = P / np.asarray(scale, np.float32) + (seed * 17.31, seed * 5.77, seed * 11.13)
    i = np.floor(q).astype(np.int32)
    t = (q - i).astype(np.float32)
    t = t * t * (3 - 2 * t)
    i0 = i & 63
    i1 = (i + 1) & 63
    x0, y0, z0 = i0[:, 0], i0[:, 1], i0[:, 2]
    x1, y1, z1 = i1[:, 0], i1[:, 1], i1[:, 2]
    tx, ty, tz = t[:, 0], t[:, 1], t[:, 2]
    c00 = _LATTICE[x0, y0, z0] * (1 - tx) + _LATTICE[x1, y0, z0] * tx
    c10 = _LATTICE[x0, y1, z0] * (1 - tx) + _LATTICE[x1, y1, z0] * tx
    c01 = _LATTICE[x0, y0, z1] * (1 - tx) + _LATTICE[x1, y0, z1] * tx
    c11 = _LATTICE[x0, y1, z1] * (1 - tx) + _LATTICE[x1, y1, z1] * tx
    c0 = c00 * (1 - ty) + c10 * ty
    c1 = c01 * (1 - ty) + c11 * ty
    return c0 * (1 - tz) + c1 * tz


# ------------------------------------------------------------------ meshing
def polygonize(f, lo, hi, voxel, chunk=400000):
    lo, hi = np.asarray(lo, np.float32) - voxel * 2, np.asarray(hi, np.float32) + voxel * 2
    n = np.ceil((hi - lo) / voxel).astype(int) + 1
    axes = [lo[i] + np.arange(n[i], dtype=np.float32) * voxel for i in range(3)]
    vol = np.empty(n, np.float32)
    gx, gy = np.meshgrid(axes[0], axes[1], indexing="ij")
    flat = np.stack([gx.ravel(), gy.ravel()], axis=1)
    per = max(1, chunk // len(flat))
    for k0 in range(0, n[2], per):
        zs = axes[2][k0:k0 + per]
        P = np.concatenate([np.column_stack([flat, np.full(len(flat), z, np.float32)]) for z in zs])
        d = f(P)
        for j, _ in enumerate(zs):
            vol[:, :, k0 + j] = d[j * len(flat):(j + 1) * len(flat)].reshape(n[0], n[1])
    if vol.min() > 0 or vol.max() < 0:
        return np.zeros((0, 3), np.float32), np.zeros((0, 3), np.int64)
    verts, faces, _, _ = measure.marching_cubes(vol, 0.0, spacing=(voxel, voxel, voxel))
    verts = (verts + lo).astype(np.float32)
    return verts, faces.astype(np.int64)


def components_filter(verts, faces, min_faces=40):
    """Drops crumbs left by thin cuts."""
    if len(faces) == 0:
        return verts, faces
    parent = np.arange(len(verts))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]]])
    g = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(verts), len(verts)))
    _, lab = connected_components(g, directed=False)
    counts = np.bincount(lab[faces[:, 0]], minlength=lab.max() + 1)
    keep = counts[lab[faces[:, 0]]] >= min_faces
    faces = faces[keep]
    used = np.unique(faces)
    remap = -np.ones(len(verts), np.int64)
    remap[used] = np.arange(len(used))
    return verts[used], remap[faces]


def decimate(verts, faces, target, agg=5):
    if len(faces) <= target or len(faces) < 12:
        return verts, faces
    reduction = 1.0 - max(target, 8) / len(faces)
    pts, tris = fast_simplification.simplify(verts.astype(np.float32), faces.astype(np.int32), target_reduction=float(reduction), agg=agg)
    return pts.astype(np.float32), tris.astype(np.int64)


def gradient(f, P, h=0.12):
    g = np.zeros_like(P)
    for i in range(3):
        d = np.zeros(3, np.float32)
        d[i] = h
        g[:, i] = f(P + d) - f(P - d)
    n = np.linalg.norm(g, axis=1, keepdims=True)
    return g / np.maximum(n, 1e-9)


def shading_normals(f, verts, faces, crease_deg=62.0, soften=0.6):
    """Normals from the distance field (smooth, free of meshing noise), with hard edges kept where
    the surface really folds.  Returns (verts, faces, normals) with split vertices."""
    # make the winding agree with the outward gradient
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    fn = np.cross(b - a, c - a)
    area = np.linalg.norm(fn, axis=1, keepdims=True)
    fn = fn / np.maximum(area, 1e-9)
    gc = gradient(f, ((a + b + c) / 3.0).astype(np.float32), soften)
    flip = np.einsum("ij,ij->i", fn, gc) < 0
    faces = faces.copy()
    faces[flip] = faces[flip][:, [0, 2, 1]]
    fn[flip] = -fn[flip]
    gv = gradient(f, verts, soften)
    corner = faces.ravel()
    face_of = np.repeat(np.arange(len(faces)), 3)
    sharp = np.einsum("ij,ij->i", gv[corner], fn[face_of]) < np.cos(np.radians(crease_deg))
    # corners on a crease take the face normal and get their own vertex
    key = np.where(sharp, len(verts) + face_of, corner)
    uniq, inverse = np.unique(key, return_inverse=True)
    src = np.zeros(len(uniq), np.int64)
    src[inverse] = corner
    out_v = verts[src]
    out_n = gv[src]
    is_sharp = uniq >= len(verts)
    out_n[is_sharp] = fn[uniq[is_sharp] - len(verts)]
    return out_v, inverse.reshape(-1, 3), out_n.astype(np.float32)
