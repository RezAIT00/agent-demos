"""Shared state for the city generator: per-tile shell meshes, instances, lights and shelter."""
import math
import os
import struct

import numpy as np
from PIL import Image

from meshlib import MeshBuilder, Layout

SHELL_TILE = 90.0

# shelter map (must match NYC_COVER_* in Common.ush): origin (x, y) metres and size
COVER_X0, COVER_Y0, COVER_SIZE, COVER_RES = -720.0, -520.0, 1280.0, 4096

LK_STREET, LK_SHOP, LK_SIGN, LK_LANDMARK, LK_HOLIDAY, LK_LOBBY, LK_PARK = range(7)


class City:
    def __init__(self, seed=7):
        self.rng = np.random.default_rng(seed)
        self.layout = Layout(tile=420.0)
        self.shells = {}
        self.lights = []
        self.cover = np.zeros((COVER_RES, COVER_RES), np.float32)   # [row = x, col = y]
        self.footprints = []        # (rect, height) of every building, for party walls and traffic audio
        self.drips = []             # (x, y, z) ledge edges that drip after rain
        self.raised = np.zeros((2048, 2048), np.uint8)      # where the ground is at kerb height
        self.records = []           # one per destructible building
        self.far_records = []       # one per distant box
        self.cur = None

    # ------------------------------------------------------------------ destruction records
    def begin(self, **info):
        """Everything added until end() belongs to this building.  Nested calls join the outer one."""
        if self.cur is not None:
            return False
        info["refs"] = []
        info["shells"] = set()
        self.cur = len(self.records)
        self.records.append(info)
        return True

    def end(self, token):
        if token:
            self.cur = None

    def shell(self, x, y, layer="shell"):
        if self.cur is not None and layer in ("shell", "landmark", "library", "gct", "farmark"):
            # a building owns its own shell mesh, so it can be hidden on its own
            key = ("bld", self.cur, 0)
            self.records[self.cur]["shells"].add("bld_%d_0" % self.cur)
        else:
            key = (layer, int(math.floor(x / SHELL_TILE)), int(math.floor(y / SHELL_TILE)))
        mb = self.shells.get(key)
        if mb is None:
            mb = self.shells[key] = MeshBuilder()
        return mb

    def inst(self, mesh, pos, yaw=0.0, scale=(1, 1, 1), tint=(1.0, 1.0, 1.0), seed=None, override="", shadow=True,
             rt=True, layer="city", custom=None):
        if custom is None:
            custom = (tint[0], tint[1], tint[2], float(self.rng.random()) if seed is None else seed)
        ref = self.layout.add(mesh, pos, yaw, scale, custom, override, shadow, rt, layer)
        if self.cur is not None:
            self.records[self.cur]["refs"].append(ref)
        return ref

    def light(self, pos, direction, color, intensity, radius, cone, kind, shadows=True, rect=(100.0, 50.0),
              source=8.0, volumetric=1.0):
        """pos and radius in metres. cone > 0 spot (candela), 0 point (candela), < 0 rect (lumens)."""
        d = np.asarray(direction, float)
        d = d / np.linalg.norm(d)
        self.lights.append((pos[0] * 100, pos[1] * 100, pos[2] * 100, d[0], d[1], d[2], color[0], color[1], color[2],
                            intensity, radius * 100, cone, rect[0], rect[1], kind, 1.0 if shadows else 0.0, source,
                            volumetric, 0.0, 0.0))

    def add_cover(self, x0, x1, y0, y1, z):
        s = COVER_RES / COVER_SIZE
        i0, i1 = int((x0 - COVER_X0) * s), int(math.ceil((x1 - COVER_X0) * s))
        j0, j1 = int((y0 - COVER_Y0) * s), int(math.ceil((y1 - COVER_Y0) * s))
        i0, i1 = max(i0, 0), min(i1, COVER_RES)
        j0, j1 = max(j0, 0), min(j1, COVER_RES)
        if i1 > i0 and j1 > j0:
            self.cover[i0:i1, j0:j1] = np.maximum(self.cover[i0:i1, j0:j1], z)

    def add_raised(self, x0, x1, y0, y1):
        s = 2048 / COVER_SIZE
        i0, i1 = max(int((x0 - COVER_X0) * s + 0.5), 0), min(int((x1 - COVER_X0) * s + 0.5), 2048)
        j0, j1 = max(int((y0 - COVER_Y0) * s + 0.5), 0), min(int((y1 - COVER_Y0) * s + 0.5), 2048)
        if i1 > i0 and j1 > j0:
            self.raised[i0:i1, j0:j1] = 255

    def save_raised(self, path):
        Image.fromarray(self.raised).save(path)

    def save_cover(self, path):
        # texture u = world y, v = world x  (see NycSheltered)
        a = np.clip(self.cover / 64.0, 0, 1) * 65535.0
        Image.fromarray(a.astype(np.uint16)).save(path)

    def save_lights(self, path):
        with open(path, "wb") as f:
            f.write(struct.pack("<II", 0x5447494C, len(self.lights)))
            f.write(np.asarray(self.lights, "<f4").tobytes())

    def save_shells(self, out_dir):
        names = []
        for (layer, tx, ty), mb in sorted(self.shells.items()):
            if mb.nv == 0:
                continue
            name = "%s_%s_%s" % (layer, ("m%d" % -tx) if tx < 0 else str(tx), ("m%d" % -ty) if ty < 0 else str(ty))
            mb.save(os.path.join(out_dir, name + ".nmesh"))
            names.append((layer, name, mb.tri_count))
        return names
