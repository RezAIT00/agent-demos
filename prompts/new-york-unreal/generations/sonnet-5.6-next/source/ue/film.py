"""Builds the film's Level Sequences and the scripted vehicles from source/film/filmdata.py."""
import importlib
import os
import sys

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
for sub in ("ue", "film"):
    sys.path.insert(0, os.path.join(ROOT, "source", sub))
import filmdata
importlib.reload(filmdata)
import shots
importlib.reload(shots)

SEQ_DIR = "/Game/NYC/Sequences/Film"


def hero_cars():
    out = []
    for s in filmdata.SHOTS:
        for type_name, color, keys in s.heroes:
            h = unreal.NYCHeroCar()
            h.set_editor_property("shot", s.id)
            h.set_editor_property("type_name", type_name)
            h.set_editor_property("color", unreal.LinearColor(color[0], color[1], color[2], 1.0))
            h.set_editor_property("keys", [unreal.Vector4(t, x * 100, y * 100, yaw) for t, x, y, yaw in keys])
            out.append(h)
    return out


def clear_zones():
    out = []
    for s in filmdata.SHOTS:
        for x0, x1, y0, y1 in s.clear:
            z = unreal.NYCClearZone()
            z.set_editor_property("shot", s.id)
            z.set_editor_property("min", unreal.Vector2D(x0 * 100, y0 * 100))
            z.set_editor_property("max", unreal.Vector2D(x1 * 100, y1 * 100))
            out.append(z)
    return out


def build(only=None):
    """Creates one sequence per shot.  Rain, traffic and lightning run on the shot clock."""
    made = []
    for s in filmdata.SHOTS:
        if only and s.id not in only:
            continue
        focus = None
        if s.focus:
            focus = s.focus[0]
        path = shots.build_shot("S%02d_%s" % (s.id, s.name), s.frames, lambda i, t, s=s: s.camera(i), s.focal,
                                lambda i, t, s=s: s.weather(t), aperture=s.aperture, focus_m=focus, shot_id=s.id,
                                sim_start=s.sim_start, folder=SEQ_DIR)
        made.append(path)
    print("\n".join(made))
    return made


def sequence_path(s):
    return "%s/S%02d_%s" % (SEQ_DIR, s.id, s.name)
