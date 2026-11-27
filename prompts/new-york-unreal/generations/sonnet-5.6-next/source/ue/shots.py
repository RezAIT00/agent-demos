"""Builds Level Sequences from plain descriptions (camera path + weather keys).  Editor side."""
import math
import os
import sys

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import importlib
import seqlib
importlib.reload(seqlib)

MAP = "/Game/NYC/Maps/NYC_Midtown"
SEQ_DIR = "/Game/NYC/Sequences"

# every weather property gets a track so a sequence never inherits state from the saved map
WEATHER_DEFAULTS = dict(TimeOfDay=14.8, CloudCover=0.2, Storm=0.0, Rain=0.0, Snow=0.0, Fog=0.0, Wetness=0.0,
                        Puddles=0.0, SnowCover=0.0, Wind=0.25, ExposureBias=0.0, HazeScale=1.0, FogCeiling=215.0,
                        Warmth=0.0, NearRain=1.0, FogCutoffKm=0.0)


def find_actor(cls_name):
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in eas.get_all_level_actors():
        if a.get_class().get_name() == cls_name:
            return a
    return None


def ensure_map(path=MAP):
    ues = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    world = ues.get_editor_world()
    if world is None or world.get_path_name().split(".")[0] != path:
        unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(path)


def look_at(pos, target):
    """(roll, pitch, yaw) that points a camera at `target`; both in metres."""
    dx, dy, dz = (target[i] - pos[i] for i in range(3))
    return (0.0, math.degrees(math.atan2(dz, math.hypot(dx, dy))), math.degrees(math.atan2(dy, dx)))


def build_shot(name, frames, cam_fn, focal, weather_fn, aperture=8.0, focus_m=None, shot_id=0, sim_start=100.0,
               map_path=MAP, fps=24, folder=SEQ_DIR):
    """cam_fn(i, t) -> ((x, y, z) metres, (roll, pitch, yaw)); weather_fn(i, t) -> dict of controller values.
    t runs from 0 to 1 across the shot."""
    ensure_map(map_path)
    seq = seqlib.fresh_sequence("%s/%s" % (folder, name), frames, fps)
    cam_keys, wkeys = [], {}
    for i in range(frames + 1):
        t = i / max(frames - 1, 1)
        pos, rot = cam_fn(i, min(t, 1.0 + 1.0 / max(frames - 1, 1)))
        cam_keys.append((i, (pos[0] * 100, pos[1] * 100, pos[2] * 100, rot[0], rot[1], rot[2])))
        w = dict(WEATHER_DEFAULTS)
        w.update(weather_fn(i, min(t, 1.0)))
        for k, v in w.items():
            wkeys.setdefault(k, []).append((i, float(v)))
    # unwrap yaw so interpolation never spins the long way round
    prev = None
    fixed = []
    for f, v in cam_keys:
        v = list(v)
        if prev is not None:
            while v[5] - prev > 180:
                v[5] -= 360
            while v[5] - prev < -180:
                v[5] += 360
        prev = v[5]
        fixed.append((f, tuple(v)))
    seqlib.add_camera(seq, frames, fixed, focal, aperture=aperture, focus_cm=(focus_m * 100 if focus_m else None))

    weather = find_actor("NYCWeatherController")
    if weather is None:
        raise RuntimeError("no weather controller in " + map_path)
    wb = seq.add_possessable(weather)
    for k, keys in wkeys.items():
        if all(abs(v - keys[0][1]) < 1e-6 for _, v in keys):
            keys = [keys[0], (frames, keys[0][1])]
        seqlib.add_float(wb, k, frames + 1, keys)
    # shot clock: advances in real time, so motion blur samples see rain and cars move
    seqlib.add_float(wb, "SimTime", frames + 1, [(0, sim_start), (frames, sim_start + frames / fps)])
    seqlib.add_float(wb, "ShotStart", frames + 1, [(0, sim_start), (frames, sim_start)])
    it = wb.add_track(unreal.MovieSceneIntegerTrack)
    it.set_property_name_and_path("ShotId", "ShotId")
    isec = it.add_section()
    isec.set_range(0, frames + 1)
    isec.get_all_channels()[0].add_key(unreal.FrameNumber(0), int(shot_id))
    bt = wb.add_track(unreal.MovieSceneBoolTrack)
    bt.set_property_name_and_path("bExternalClock", "bExternalClock")
    bsec = bt.add_section()
    bsec.set_range(0, frames + 1)
    bsec.get_all_channels()[0].add_key(unreal.FrameNumber(0), True)
    unreal.EditorAssetLibrary.save_loaded_asset(seq)
    return "%s/%s" % (folder, name)


def still(name, pos, target, focal, weather, aperture=8.0, focus_m=None, shot_id=0, sim_start=100.0, map_path=MAP,
          roll=0.0):
    rot = look_at(pos, target)
    rot = (roll, rot[1], rot[2])
    return build_shot("STILL_" + name, 1, lambda i, t: (pos, rot), focal, lambda i, t: weather, aperture=aperture,
                      focus_m=focus_m, shot_id=shot_id, sim_start=sim_start, map_path=map_path, folder=SEQ_DIR + "/Stills")
