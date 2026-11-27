"""Imports the generated meshes and assembles the main map.  Run inside the editor.

  build_level.run(meshes=True, level=True)
"""
import hashlib
import importlib
import json
import os
import struct
import sys
import time

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
sys.path.insert(0, os.path.join(ROOT, "source", "gen"))

MAP = "/Game/NYC/Maps/NYC_Midtown"
MESH_DIR = "/Game/NYC/Meshes"
MAT_DIR = "/Game/NYC/Materials"
EAL = unreal.EditorAssetLibrary
LIB = unreal.NYCBuilderLibrary

SLOT_ALIAS = {"wall": "limestone", "trim": "limestone_trim", "frame": "paint_black", "glass": "glass_home", "spandrel": "terracotta",
              "shopframe": "paint_black", "awning": "fabric_green", "mullion": "aluminium", "spg": "spandrel_dark",
              "lobbyglass": "glass_lobby", "newsbox": "paint_red", "bulk": "brick_brown", "shed": "shed_green"}


def all_materials():
    out = {}
    for path in EAL.list_assets(MAT_DIR, recursive=True):
        asset = path.split(".")[0]
        name = asset.split("/")[-1]
        if name.startswith("MI_"):
            out[name[3:]] = unreal.load_asset(asset)
    return out


def slot_names(path):
    with open(path, "rb") as f:
        magic, version, nv, nt, ns = struct.unpack("<IIIII", f.read(20))
        out = []
        for _ in range(ns):
            n = struct.unpack("<H", f.read(2))[0]
            out.append(f.read(n).decode())
    return out


def import_meshes(folder, mats, force=False):
    """Imports every mesh listed in <folder>/manifest.json whose file changed since last time."""
    with open(os.path.join(folder, "manifest.json")) as f:
        manifest = json.load(f)
    cache_path = os.path.join(folder, "imported.json")
    cache = {}
    if os.path.exists(cache_path) and not force:
        with open(cache_path) as f:
            cache = json.load(f)
    missing = set()
    done = 0
    t0 = time.time()
    for m in manifest["meshes"]:
        src = os.path.join(folder, "meshes", m["name"] + ".nmesh")
        with open(src, "rb") as f:
            key = hashlib.md5(f.read()).hexdigest() + "|%s%s%s" % (m["nanite"], m["cards"], m.get("preserve"))
        asset = "%s/%s" % (MESH_DIR, m["name"])
        if cache.get(m["name"]) == key and EAL.does_asset_exist(asset):
            continue
        slots = {}
        for s in slot_names(src):
            mat = mats.get(SLOT_ALIAS.get(s, s))
            if mat is None:
                missing.add(s)
            else:
                slots[s] = mat
        mesh = LIB.import_n_mesh(src, asset, slots, m["nanite"], m["cards"], bool(m.get("preserve", False)))
        if mesh is None:
            print("FAILED to import", m["name"])
            continue
        LIB.save_asset_object(mesh)
        cache[m["name"]] = key
        done += 1
        if done % 150 == 0:
            with open(cache_path, "w") as f:
                json.dump(cache, f)
            unreal.log("NYC imported %d meshes" % done)
            unreal.SystemLibrary.collect_garbage()
    with open(cache_path, "w") as f:
        json.dump(cache, f)
    if missing:
        print("slots without material:", sorted(missing))
    print("%s: imported %d meshes in %.0f s" % (os.path.basename(folder), done, time.time() - t0))
    return manifest


def spawn(cls, label, loc=(0, 0, 0), rot=(0, 0, 0)):
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    a = eas.spawn_actor_from_class(cls, unreal.Vector(*loc), unreal.Rotator(roll=rot[0], pitch=rot[1], yaw=rot[2]))
    a.set_actor_label(label)
    return a


def build_map(manifest, mats):
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if EAL.does_asset_exist(MAP):
        les.load_level(MAP)
        for a in eas.get_all_level_actors():
            eas.destroy_actor(a)
        unreal.SystemLibrary.collect_garbage()
    else:
        les.new_level(MAP)
    city_dir = os.path.join(ROOT, "build", "city")
    shells = os.path.join(city_dir, "shells.nlayout")
    a = spawn(unreal.NYCCityActor, "City_Architecture")
    print("shell meshes placed:", LIB.load_layout(a, shells, MESH_DIR, mats))
    b = spawn(unreal.NYCCityActor, "City_Instances")
    print("instances placed:", LIB.load_layout(b, os.path.join(city_dir, "city.nlayout"), MESH_DIR, mats))
    lf = spawn(unreal.NYCLightField, "City_Lights")
    print("lights:", lf.load_file(os.path.join(city_dir, "city.nlights")))
    w = spawn(unreal.NYCWeatherController, "NYC_WeatherController")
    w.set_editor_property("collection", unreal.load_asset(MAT_DIR + "/MPC_Weather"))
    w.set_editor_property("cloud_material", unreal.load_asset(MAT_DIR + "/M_Cloud"))
    w.set_editor_property("bolt_material", unreal.load_asset(MAT_DIR + "/M_Bolt"))
    for prop, name in (("rain_mesh", "fx_rain"), ("snow_mesh", "fx_snow"), ("splash_mesh", "fx_splash"), ("drip_mesh", "fx_drips")):
        if EAL.does_asset_exist("%s/%s" % (MESH_DIR, name)):
            w.set_editor_property(prop, unreal.load_asset("%s/%s" % (MESH_DIR, name)))
    if os.path.exists(os.path.join(ROOT, "source", "ue", "setup_actors.py")):
        import setup_actors
        importlib.reload(setup_actors)
        setup_actors.run(w, mats, spawn)
    spawn(unreal.PlayerStart, "PlayerStart", (2600, 150, 230), (0, 0, 180))
    w.call_method("ApplyWeather")
    les.save_current_level()
    print("map saved")


def run(meshes=True, level=True, force=False):
    mats = all_materials()
    manifest = None
    for folder in ("city", "vehicles", "fx", "destruct"):
        d = os.path.join(ROOT, "build", folder)
        if os.path.exists(os.path.join(d, "manifest.json")):
            if meshes:
                m = import_meshes(d, mats, force)
            else:
                with open(os.path.join(d, "manifest.json")) as f:
                    m = json.load(f)
            if folder == "city":
                manifest = m
    LIB.finish_all_compilation()
    if level:
        build_map(manifest, mats)
