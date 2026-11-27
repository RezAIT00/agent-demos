"""Materials for broken things: rest-pose twins of every surface material, and glass shards."""
import importlib

import matlib
importlib.reload(matlib)
from matlib import *  # noqa
import materials
importlib.reload(materials)

DEBRIS_DIR = MAT_DIR + "/Debris"


def shards():
    code = """
float3 cell = floor(WP / 17.0);
float sparkle = step(0.93, frac(sin(dot(cell, float3(12.9898, 78.233, 37.719))) * 43758.5453));
Roughness = lerp(0.07, 0.015, sparkle);
Specular = 1.0;
Metallic = 0.42 + 0.5 * sparkle;
return lerp(float3(0.05, 0.085, 0.078), float3(0.55, 0.66, 0.66), sparkle * 0.75);
"""
    m = build("M_Shard", code, [("WP", WPOS)], [("Roughness", 1), ("Specular", 1), ("Metallic", 1)],
              {"BaseColor": "", "Roughness": "Roughness", "Specular": "Specular", "Metallic": "Metallic"},
              two_sided=True, usage=("geomcollection", "ism", "nanite"))
    instance("MI_shard", m, path=DEBRIS_DIR)


def run():
    meta = materials.import_all()
    ensure_mpc()
    master = materials.make_surface_master("M_SurfaceDebris", debris=True)
    materials.make_surface_instances(master, meta, suffix="_D", path=DEBRIS_DIR)
    shards()
    unreal.NYCBuilderLibrary.finish_all_compilation()
    print("destruction materials done")
