"""Builds every material.  Run inside the editor:  all_materials.run()"""
import importlib
import os
import sys

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))


def run(reimport_textures=False):
    import matlib
    importlib.reload(matlib)
    import materials
    importlib.reload(materials)
    materials.import_all(force=reimport_textures)
    materials.run()
    import materials_city
    importlib.reload(materials_city)
    materials_city.run()
    import materials_sky
    importlib.reload(materials_sky)
    materials_sky.run()
    for extra in ("materials_vehicles", "materials_fx", "materials_effects", "materials_destruct"):
        if os.path.exists(os.path.join(ROOT, "source", "ue", extra + ".py")):
            mod = importlib.import_module(extra)
            importlib.reload(mod)
            mod.run()
    exec(open(os.path.join(ROOT, "source", "ue", "check_materials.py")).read(), {})
