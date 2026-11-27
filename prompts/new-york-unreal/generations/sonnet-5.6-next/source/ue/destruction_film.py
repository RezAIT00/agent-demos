"""Builds the destruction film's Level Sequences from source/film/destruction_data.py, the showrunner actor
they drive, the shot list the showrunner reads, and one empty Chaos cache collection per shot.  Editor side."""
import importlib
import json
import os
import sys

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
for sub in ("ue", "film"):
    sys.path.insert(0, os.path.join(ROOT, "source", sub))
import destruction_data
import shots
import seqlib

SEQ_DIR = "/Game/NYC/Sequences/Destruction"
CACHE_DIR = "/Game/NYC/Cache"
EAL = unreal.EditorAssetLibrary


def reload():
    importlib.reload(destruction_data)
    importlib.reload(shots)
    importlib.reload(seqlib)


def export_shot_list():
    """The events in the units the game uses (cm), indexed in film order."""
    out = []
    for s in destruction_data.SHOTS:
        out.append(dict(id=s.name, events=[
            dict(t=round(t, 4), tool=tool, **{"from": [round(v * 100, 1) for v in a], "at": [round(v * 100, 1) for v in b]})
            for t, tool, a, b in s.events]))
    path = os.path.join(ROOT, "source", "film", "destruction_shots.json")
    with open(path, "w") as f:
        json.dump(dict(shots=out), f, indent=1)
    return path


def ensure_showrunner():
    shots.ensure_map()
    actor = shots.find_actor("NYCShowrunner")
    if actor is None:
        eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        actor = eas.spawn_actor_from_class(unreal.NYCShowrunner, unreal.Vector(0, 0, -2000))
        actor.set_actor_label("NYC_Showrunner")
        unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
        print("showrunner added to the map")
    return actor


def fresh_cache(name):
    """An empty cache collection for a record pass."""
    path = "%s/CC_%s" % (CACHE_DIR, name)
    if EAL.does_asset_exist(path):
        asset = unreal.load_asset(path)
        asset.set_editor_property("caches", [])
        if len(asset.get_editor_property("caches")) != 0:
            raise RuntimeError("could not empty " + path)
        EAL.save_loaded_asset(asset, only_if_is_dirty=False)
        return path
    factory = getattr(unreal, "CacheCollectionFactory", None) or getattr(unreal, "ChaosCacheCollectionFactory", None)
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset("CC_%s" % name, CACHE_DIR, unreal.ChaosCacheCollection,
                                                                    factory() if factory else None)
    if asset is None:
        raise RuntimeError("could not create " + path)
    EAL.save_loaded_asset(asset)
    return path


def fresh_caches(names=None):
    for s in destruction_data.SHOTS:
        if names is None or s.name in names:
            fresh_cache(s.name)
    print("caches reset")


def save_caches(names=None):
    n = 0
    for s in destruction_data.SHOTS:
        if names is not None and s.name not in names:
            continue
        path = "%s/CC_%s" % (CACHE_DIR, s.name)
        asset = unreal.load_asset(path)
        if asset:
            EAL.save_loaded_asset(asset, only_if_is_dirty=False)
            n += 1
    print("saved %d cache collections" % n)


def sequence_path(index, s):
    return "%s/D%02d_%s" % (SEQ_DIR, index + 1, s.name)


def build(only=None):
    reload()
    export_shot_list()
    ensure_showrunner()
    made = []
    for index, s in enumerate(destruction_data.SHOTS):
        if only and s.name not in only:
            continue
        frames = s.frames
        name = "D%02d_%s" % (index + 1, s.name)

        def cam(i, t, s=s):
            pos, target = s.cam(min(t, 1.0))
            roll = 0.0
            return pos, shots.look_at(pos, target)

        shots.build_shot(name, frames, cam, s.focal, lambda i, t, s=s: s.weather(t), aperture=s.aperture,
                         focus_m=s.focus, shot_id=100 + index, sim_start=s.sim_start, folder=SEQ_DIR)
        seq = unreal.load_asset("%s/%s" % (SEQ_DIR, name))
        # the destruction film is set on a morning in early April, when the sun reaches this side of 42nd Street
        weather = shots.find_actor("NYCWeatherController")
        wb = next(b for b in seq.get_bindings() if str(b.get_display_name()) == weather.get_actor_label())
        for prop, value in (("Month", 4), ("Day", 3)):
            track = wb.add_track(unreal.MovieSceneIntegerTrack)
            track.set_property_name_and_path(prop, prop)
            sec = track.add_section()
            sec.set_range(0, frames + 1)
            sec.get_all_channels()[0].add_key(unreal.FrameNumber(0), value)
        runner = shots.find_actor("NYCShowrunner")
        rb = seq.add_possessable(runner)
        it = rb.add_track(unreal.MovieSceneIntegerTrack)
        it.set_property_name_and_path("Shot", "Shot")
        isec = it.add_section()
        isec.set_range(0, frames + 1)
        isec.get_all_channels()[0].add_key(unreal.FrameNumber(0), int(index))
        # the destruction clock is the sequence's own time, in seconds
        seqlib.add_float(rb, "ShotTime", frames + 1, [(0, 0.0), (frames, frames / 24.0)])
        EAL.save_loaded_asset(seq)
        made.append(sequence_path(index, s))
    print("\n".join(made))
    return made
