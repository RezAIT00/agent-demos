"""Interior pieces that only show once a facade is broken open: steel frame, floor slabs, partitions and
office furniture.  Unit sized; the destruction system scales and places them."""
import numpy as np

from meshlib import MeshBuilder


def column():
    """I section 0.32 x 0.30, 1 m tall, base at z = 0."""
    mb = MeshBuilder()
    mb.box((-0.16, -0.15, 0.0), (0.16, -0.125, 1.0), "rust")
    mb.box((-0.16, 0.125, 0.0), (0.16, 0.15, 1.0), "rust")
    mb.box((-0.012, -0.125, 0.0), (0.012, 0.125, 1.0), "rust")
    return mb


def beam():
    """I section 0.16 wide, 0.36 deep, 1 m long along +x, top at z = 0."""
    mb = MeshBuilder()
    mb.box((0.0, -0.08, -0.022), (1.0, 0.08, 0.0), "rust")
    mb.box((0.0, -0.08, -0.36), (1.0, 0.08, -0.338), "rust")
    mb.box((0.0, -0.01, -0.338), (1.0, 0.01, -0.022), "rust")
    return mb


def slab():
    """1 x 1 m floor tile, 0.25 thick, top at z = 0."""
    mb = MeshBuilder()
    mb.box((0.0, 0.0, -0.25), (1.0, 1.0, 0.0), "concrete")
    return mb


def partition():
    """Plaster wall 1 m long, 1 m tall, 0.12 thick."""
    mb = MeshBuilder()
    mb.box((0.0, -0.06, 0.0), (1.0, 0.06, 1.0), "stucco")
    return mb


def desk():
    mb = MeshBuilder()
    mb.box((-0.75, -0.4, 0.72), (0.75, 0.4, 0.76), "wood")
    for sx in (-0.7, 0.66):
        for sy in (-0.36, 0.32):
            mb.box((sx, sy, 0.0), (sx + 0.04, sy + 0.04, 0.72), "paint_darkgray")
    mb.box((-0.3, -0.22, 0.76), (0.3, -0.18, 1.14), "plastic_black")
    # a chair pushed back from it
    mb.box((-0.24, 0.55, 0.44), (0.24, 1.0, 0.5), "fabric_navy")
    mb.box((-0.24, 0.96, 0.5), (0.24, 1.02, 1.0), "fabric_navy")
    mb.box((-0.03, 0.74, 0.0), (0.03, 0.8, 0.44), "paint_black")
    return mb


def shelf():
    mb = MeshBuilder()
    for z in (0.05, 0.55, 1.05, 1.55, 2.0):
        mb.box((-0.6, -0.18, z), (0.6, 0.18, z + 0.03), "wood")
    for x in (-0.6, 0.57):
        mb.box((x, -0.18, 0.0), (x + 0.03, 0.18, 2.03), "wood")
    for i, z in enumerate((0.08, 0.58, 1.08, 1.58)):
        x = -0.55
        k = 0
        while x < 0.45:
            w = 0.05 + 0.04 * ((k * 7 + i * 3) % 3)
            slot = ("cardboard", "paint_navy", "paint_burgundy", "paint_cream", "paint_olive")[(k + i) % 5]
            mb.box((x, -0.13, z), (x + w, 0.12, z + 0.27 + 0.04 * ((k + i) % 3)), slot)
            x += w + 0.012
            k += 1
    return mb


def broken(module):
    """The same facade module with its glass gone: jagged fragments left in the frames and a dark
    room behind each opening so that nothing can be seen through the building."""
    src = module.mb
    p, n, uv0, uv1, col, tri, ts = src.arrays()
    mb = MeshBuilder()
    glass = None
    for i, name in enumerate(src.slots):
        if "glass" in name and name != "spg":
            glass = glass or name
            continue
        use = tri[ts == i]
        if len(use) == 0:
            continue
        ids, back = np.unique(use.reshape(-1), return_inverse=True)
        mb.raw(p[ids], n[ids], uv0[ids], uv1[ids], col[ids], back.reshape(-1, 3), name)
    if glass is None or not module.windows:
        return None
    rng = np.random.default_rng(sum(map(ord, module.name)) * 131)
    for x0, x1, z0, z1, depth in module.windows:
        y = -depth + 0.004
        size = (x1 - x0, z1 - z0)

        def shard(a, b, tip):
            pts = [(a[0], y, a[1]), (b[0], y, b[1]), (tip[0], y, tip[1])]
            uv = [(q[0] - x0, q[2] - z0) for q in pts]
            mb.poly(pts, glass, normal=(0, 1, 0), uv=uv, uv1=[size] * 3, color=(1, 1, 1, 0.0))

        edges = (((x0, z0), (x1, z0), (0, 1)), ((x1, z0), (x1, z1), (-1, 0)), ((x1, z1), (x0, z1), (0, -1)),
                 ((x0, z1), (x0, z0), (1, 0)))
        for a, b, inward in edges:
            length = abs(b[0] - a[0]) + abs(b[1] - a[1])
            if length < 0.05:
                continue
            s = 0.0
            while s < length - 0.02:
                w = min(float(rng.uniform(0.07, 0.26)), length - s)
                u0 = (a[0] + (b[0] - a[0]) * s / length, a[1] + (b[1] - a[1]) * s / length)
                u1 = (a[0] + (b[0] - a[0]) * (s + w) / length, a[1] + (b[1] - a[1]) * (s + w) / length)
                if rng.random() < 0.78:
                    reach = float(rng.random() ** 2.2) * min(0.34, 0.38 * min(size)) + 0.015
                    slide = float(rng.uniform(0.15, 0.85))
                    tip = (u0[0] + (u1[0] - u0[0]) * slide + inward[0] * reach,
                           u0[1] + (u1[1] - u0[1]) * slide + inward[1] * reach)
                    shard(u0, u1, tip)
                s += w
        back = y - 0.95
        e = 0.03
        f = y - 0.03
        mb.quad((x0 - e, back, z0 - e), (x1 + e, back, z0 - e), (x1 + e, back, z1 + e), (x0 - e, back, z1 + e), "interior_dark", normal=(0, 1, 0))
        mb.quad((x0 - e, f, z0 - e), (x1 + e, f, z0 - e), (x1 + e, back, z0 - e), (x0 - e, back, z0 - e), "interior_dark", normal=(0, 0, 1))
        mb.quad((x0 - e, f, z1 + e), (x1 + e, f, z1 + e), (x1 + e, back, z1 + e), (x0 - e, back, z1 + e), "interior_dark", normal=(0, 0, -1))
        mb.quad((x0 - e, f, z0 - e), (x0 - e, back, z0 - e), (x0 - e, back, z1 + e), (x0 - e, f, z1 + e), "interior_dark", normal=(1, 0, 0))
        mb.quad((x1 + e, f, z0 - e), (x1 + e, back, z0 - e), (x1 + e, back, z1 + e), (x1 + e, f, z1 + e), "interior_dark", normal=(-1, 0, 0))
    return mb


def broken_modules(modules):
    out = {}
    for name, m in modules.items():
        mb = broken(m)
        if mb is not None:
            out[name + "_broken"] = mb
    return out


def all_meshes():
    return {"skel_column": column(), "skel_beam": beam(), "skel_slab": slab(), "skel_partition": partition(),
            "skel_desk": desk(), "skel_shelf": shelf()}
