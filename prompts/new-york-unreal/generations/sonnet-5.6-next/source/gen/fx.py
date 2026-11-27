"""Particle carriers for rain, snow, splashes, drips, steam and tyre spray.  All motion happens in
the vertex shader (FX.ush); these meshes just hold quads and random numbers.

Run after build_city.py:  python source/gen/fx.py
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from meshlib import MeshBuilder  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "build", "fx")


def quads(base, uv1, col, slot):
    """base (N,3) metres; uv1 (N,2); col (N,4).  Four corners share a position."""
    n = len(base)
    p = np.repeat(base, 4, axis=0)
    # tiny distinct offsets keep the importer from treating the triangles as degenerate
    corner = np.array([(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)])
    off = np.zeros((4, 3))
    off[:, 0] = (corner[:, 0] - 0.5) * 0.02
    off[:, 2] = (corner[:, 1] - 0.5) * 0.02
    p = p + np.tile(off, (n, 1))
    uv0 = np.tile(corner, (n, 1))
    u1 = np.repeat(uv1, 4, axis=0)
    c = np.repeat(col, 4, axis=0)
    nrm = np.tile((0.0, -1.0, 0.0), (4 * n, 1))
    base_idx = np.arange(n)[:, None] * 4
    tris = np.concatenate([base_idx + np.array((0, 1, 2)), base_idx + np.array((0, 2, 3))])
    mb = MeshBuilder()
    mb.raw(p, nrm, uv0, u1, c, tris, slot)
    return mb


def main():
    rng = np.random.default_rng(99)
    os.makedirs(os.path.join(OUT, "meshes"), exist_ok=True)
    manifest = []

    def save(name, mb):
        mb.save(os.path.join(OUT, "meshes", name + ".nmesh"))
        manifest.append(dict(name=name, nanite=False, cards=0, preserve=False, tris=mb.tri_count))

    # seeds travel in the vertex positions (full float precision): position = seed * 20 m
    def volume(name, wide, lens, slot):
        n = wide + lens
        # positions are snapped to 4 cm so the 1 cm corner offsets can be rounded away in the shader
        seeds = np.round(((rng.random((n, 3)) - 0.5) * 2000.0) / 4.0) * 4.0 / 2000.0 + 0.5
        uv1 = np.stack([rng.random(n), np.concatenate([np.zeros(wide), np.ones(lens)])], axis=1)
        col = np.ones((n, 4))
        save(name, quads((seeds - 0.5) * 20.0, uv1, col, slot))

    volume("fx_rain", 42000, 5200, "rain")
    volume("fx_snow", 34000, 3800, "snow")

    # splashes: one ring and one droplet card for every cell of an 84 x 84 grid
    cells = 84
    ij = np.stack(np.meshgrid(np.arange(cells), np.arange(cells), indexing="ij"), -1).reshape(-1, 2)
    base = np.zeros((len(ij) * 2, 3))
    base[:, :2] = np.repeat((ij + 0.5) / cells, 2, axis=0)
    base[:, :2] = np.round((base[:, :2] - 0.5) * 2000.0 / 4.0) * 4.0 / 2000.0 + 0.5
    uv1 = np.zeros((len(ij) * 2, 2))
    uv1[1::2, 0] = 1.0
    save("fx_splash", quads((base - 0.5) * 20.0, uv1, np.ones((len(base), 4)), "splash"))

    with open(os.path.join(ROOT, "build", "city", "traffic.json")) as f:
        data = json.load(f)
    drips = np.array(data["drips"], float)
    base = np.repeat(drips, 2, axis=0) + rng.normal(0, 0.03, (len(drips) * 2, 3)) * (1, 1, 0)
    uv1 = np.stack([rng.random(len(base)), base[:, 2] * 100.0], axis=1)
    save("fx_drips", quads(base, uv1, np.ones((len(base), 4)), "drip"))

    steam = data["steam"]
    pos, uv1, col = [], [], []
    for x, y, z, strength in steam:
        k = int(26 + 34 * min(strength, 1.4))
        for i in range(k):
            pos.append((x + rng.normal(0, 0.05), y + rng.normal(0, 0.05), z + 0.05))
            uv1.append((i / k, min(strength, 1.4)))
            col.append(rng.random(4))
    save("fx_steam", quads(np.array(pos), np.array(uv1), np.array(col), "steam"))

    # spray: puffs scattered in a wedge behind the rear wheels (vehicle space, +x forward)
    n = 90
    pos = np.zeros((n, 3))
    t = rng.random(n)
    pos[:, 0] = 0.6 - 3.8 * t ** 1.3
    pos[:, 1] = rng.choice([-0.82, 0.82], n) + rng.normal(0, 0.12 + 0.35 * t, n)
    pos[:, 2] = 0.12 + rng.random(n) * (0.2 + 0.9 * t)
    save("fx_spray", quads(pos, rng.random((n, 2)), np.ones((n, 4)), "spray"))
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(dict(meshes=manifest), f)
    print("fx meshes:", {m["name"]: m["tris"] for m in manifest})


if __name__ == "__main__":
    main()
