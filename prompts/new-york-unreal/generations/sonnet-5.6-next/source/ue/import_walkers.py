"""Imports the generated walker meshes and copies walkers.json into the project.  Run inside the editor:
import_walkers.run()   (after materials_walkers.run(), so the meshes pick up M_Walker)

Only meshes whose file changed since the last import are rebuilt (run(force=True) rebuilds them all).
"""
import hashlib
import json
import os
import shutil
import time

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
SRC = os.path.join(ROOT, "build", "walkers")
DIR = "/Game/NYC/Walkers"
EAL = unreal.EditorAssetLibrary
LIB = unreal.NYCBuilderLibrary


def run(force=False):
    with open(os.path.join(SRC, "manifest.json")) as f:
        manifest = json.load(f)
    material = unreal.load_asset(DIR + "/M_Walker")
    if material is None:
        raise RuntimeError("run materials_walkers.run() first")
    cache_path = os.path.join(SRC, "imported.json")
    cache = {}
    if os.path.exists(cache_path) and not force:
        with open(cache_path) as f:
            cache = json.load(f)
    t0, done = time.time(), 0
    for m in manifest["meshes"]:
        src = os.path.join(SRC, "meshes", m["name"] + ".nmesh")
        with open(src, "rb") as f:
            key = hashlib.md5(f.read()).hexdigest()
        asset = "%s/%s" % (DIR, m["name"])
        if cache.get(m["name"]) == key and EAL.does_asset_exist(asset):
            continue
        mesh = LIB.import_n_mesh(src, asset, {"walker": material}, False, 0, False)
        if mesh is None:
            raise RuntimeError("failed to import " + m["name"])
        LIB.save_asset_object(mesh)
        cache[m["name"]] = key
        done += 1
        if done % 20 == 0:
            unreal.SystemLibrary.collect_garbage()
    with open(cache_path, "w") as f:
        json.dump(cache, f)
    data = os.path.join(unreal.Paths.project_content_dir(), "NYC", "Data")
    os.makedirs(data, exist_ok=True)
    shutil.copyfile(os.path.join(SRC, "walkers.json"), os.path.join(data, "walkers.json"))
    LIB.finish_all_compilation()
    print("walkers: imported %d of %d meshes in %.0f s; walkers.json copied to Content/NYC/Data" % (done, len(manifest["meshes"]), time.time() - t0))
