"""Configures the traffic actor and other runtime actors after the map is assembled."""
import json
import os
import shutil

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
MESH_DIR = "/Game/NYC/Meshes"
KINDS = {"cab": 0, "sedan": 1, "suv": 2, "van": 3, "truck": 4, "bus": 5}


def mesh(name):
    path = "%s/%s" % (MESH_DIR, name)
    return unreal.load_asset(path) if unreal.EditorAssetLibrary.does_asset_exist(path) else None


def run(weather, mats, spawn):
    vpath = os.path.join(ROOT, "build", "vehicles", "vehicles.json")
    if not os.path.exists(vpath):
        return
    data_dir = os.path.join(unreal.Paths.project_content_dir(), "NYC", "Data")
    os.makedirs(data_dir, exist_ok=True)
    for name in ("traffic.json", "destruction.json"):
        shutil.copyfile(os.path.join(ROOT, "build", "city", name), os.path.join(data_dir, name))
    with open(vpath) as f:
        info = json.load(f)
    traffic = spawn(unreal.NYCTraffic, "NYC_Traffic")
    types = []
    for name, v in info.items():
        t = unreal.NYCVehicleType()
        t.set_editor_property("name", name)
        t.set_editor_property("kind", KINDS[v["kind"]])
        t.set_editor_property("body", mesh(name))
        t.set_editor_property("wheel", mesh(v["wheel"]))
        t.set_editor_property("wheels", [unreal.Vector(x * 100, y * 100, float(s)) for x, y, s in v["wheels"]])
        t.set_editor_property("wheel_radius", v["wheelRadius"] * 100)
        t.set_editor_property("length", v["length"] * 100)
        t.set_editor_property("head_lamp", unreal.Vector(*[c * 100 for c in v["head"]]))
        tx, ty, tz = v["tail"]
        t.set_editor_property("tail_lamp", unreal.Vector(tx * 100, abs(ty) * 100, tz * 100))
        types.append(t)
    traffic.set_editor_property("types", types)
    traffic.set_editor_property("lamp_mesh", mesh("lampdisc"))
    traffic.set_editor_property("ped_face_mesh", mesh("pedface"))
    traffic.set_editor_property("ped_meshes", [mesh("ped%d" % i) for i in range(8) if mesh("ped%d" % i)])
    traffic.set_editor_property("umbrella_meshes", [mesh("umbrella%d" % i) for i in range(4) if mesh("umbrella%d" % i)])
    traffic.set_editor_property("spray_mesh", mesh("fx_spray"))
    film = os.path.join(ROOT, "source", "ue", "film_actors.py")
    if os.path.exists(film):
        import importlib
        import film_actors
        importlib.reload(film_actors)
        film_actors.run(weather, traffic)
    print("traffic configured with", len(types), "vehicle types")
