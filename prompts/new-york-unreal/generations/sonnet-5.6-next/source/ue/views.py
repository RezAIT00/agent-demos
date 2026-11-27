"""Named camera views and weather states used for review renders."""
import importlib
import os
import sys

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import shots
importlib.reload(shots)

# name: (position m, target m, focal mm)
VIEWS = {
    "lionhi": ((-56.2, -10.9, 5.0), (-63.75, -23.5, 2.92), 58.0),
    "fifth": ((38.0, 2.6, 2.1), (-420.0, -8.0, 62.0), 35.0),
    "library": ((-62.0, 7.5, 1.8), (-92.0, -45.0, 9.5), 24.0),
    "lion": ((-54.8, -7.2, 2.0), (-65.0, -24.8, 3.3), 55.0),
    "east42": ((1.5, -74.0, 2.3), (30.0, 480.0, 105.0), 32.0),
    "aerialnw": ((265.0, -520.0, 305.0), (-250.0, 80.0, 120.0), 27.0),
    "bryant": ((-70.0, -318.0, 17.0), (-96.0, -120.0, 16.0), 24.0),
    "south": ((-1160.0, 190.0, 335.0), (-120.0, 120.0, 150.0), 30.0),
    "high": ((900.0, -250.0, 520.0), (-600.0, 60.0, 60.0), 28.0),
    "street40": ((-168.0, -40.0, 2.0), (-166.0, -230.0, 28.0), 28.0),
    "murray": ((-402.5, 178.0, 2.2), (-399.0, 300.0, 9.0), 35.0),
    "oncoming": ((-9.0, -1.6, 1.15), (60.0, -4.5, 1.6), 40.0),
    "kiosks": ((-96.0, -246.0, 3.2), (-100.0, -150.0, 3.0), 28.0),
    # straight down 42nd from west of Sixth Avenue, where the early December sunrise lines up
    "henge": ((2.2, -352.0, 5.2), (-2.5, 400.0, 22.0), 75.0),
    "fogup": ((-150.0, -262.0, 3.0), (-620.0, -85.0, 185.0), 24.0),
    "storm_esb": ((140.0, -330.0, 210.0), (-690.0, -80.0, 430.0), 28.0),
    "dbgroofa": ((-20.0, 95.0, 150.0), (-62.0, 60.0, 80.0), 30.0),
    "dbgroofb": ((-80.0, 215.0, 120.0), (-112.0, 256.0, 46.0), 30.0),
    "gct": ((-7.0, 196.0, 2.2), (40.0, 470.0, 105.0), 22.0),
    "lionsnow": ((-56.6, -11.8, 2.6), (-63.8, -23.5, 3.1), 58.0),
    "rooftop": ((-60.0, 62.0, 112.0), (-640.0, -50.0, 190.0), 32.0),
}

STATES = {
    "fl1": dict(TimeOfDay=7.2, CloudCover=0.88, Snow=0.24, SnowCover=1.0, Wetness=0.1, ExposureBias=1.5),
    "fl2": dict(TimeOfDay=7.35, CloudCover=0.9, Snow=0.24, SnowCover=1.0, Wetness=0.1, ExposureBias=1.65),
    "ov1": dict(TimeOfDay=8.5, CloudCover=0.82, Snow=0.22, SnowCover=1.0, Wetness=0.1, ExposureBias=1.7),
    "ov2": dict(TimeOfDay=9.6, CloudCover=0.95, Snow=0.25, SnowCover=1.0, Wetness=0.1, ExposureBias=1.9),
    "ov3": dict(TimeOfDay=11.0, CloudCover=0.88, Snow=0.2, SnowCover=1.0, Wetness=0.1, ExposureBias=1.4),
    "dawn2": dict(TimeOfDay=7.0, CloudCover=0.7, Snow=0.2, SnowCover=1.0, Wetness=0.1, ExposureBias=1.5),
    "m74": dict(TimeOfDay=7.45, CloudCover=0.2, Snow=0.06, SnowCover=1.0, Wetness=0.1, ExposureBias=0.4),
    "m79": dict(TimeOfDay=7.9, CloudCover=0.15, Snow=0.04, SnowCover=1.0, Wetness=0.1, ExposureBias=0.1),
    "m86": dict(TimeOfDay=8.6, CloudCover=0.15, Snow=0.04, SnowCover=1.0, Wetness=0.1, ExposureBias=0.0),
    "m95": dict(TimeOfDay=9.5, CloudCover=0.3, Snow=0.04, SnowCover=1.0, Wetness=0.1, ExposureBias=-0.1),
    "s13": dict(TimeOfDay=6.87, CloudCover=0.3, Snow=0.08, SnowCover=1.0, Wetness=0.15, ExposureBias=1.05),
    "s13bare": dict(TimeOfDay=6.87, CloudCover=0.3, Snow=0.0, SnowCover=0.0, Wetness=0.15, ExposureBias=1.05),
    "day": dict(TimeOfDay=13.2, CloudCover=0.22),
    "golden": dict(TimeOfDay=15.45, CloudCover=0.26),
    "sunset": dict(TimeOfDay=16.25, CloudCover=0.35),
    "blue": dict(TimeOfDay=16.9, CloudCover=0.5),
    "overcast": dict(TimeOfDay=12.5, CloudCover=0.97, Storm=0.12),
    "night": dict(TimeOfDay=19.0, CloudCover=0.45),
    "rain": dict(TimeOfDay=20.0, CloudCover=1.0, Storm=0.5, Rain=0.75, Wetness=1.0, Puddles=0.75),
    "storm": dict(TimeOfDay=21.0, CloudCover=1.0, Storm=1.0, Rain=1.0, Wetness=1.0, Puddles=0.9, Wind=0.8),
    "fog": dict(TimeOfDay=23.4, CloudCover=0.7, Fog=1.0, Wetness=0.8, Puddles=0.4, FogCeiling=200.0),
    "snow": dict(TimeOfDay=1.0, CloudCover=0.95, Snow=0.85, SnowCover=0.65, Fog=0.12, Wetness=0.4),
    "settled": dict(TimeOfDay=6.75, CloudCover=0.35, SnowCover=1.0, Wetness=0.2),
    "sunrise": dict(TimeOfDay=7.42, CloudCover=0.14, SnowCover=1.0, Wetness=0.2),
    "morning": dict(TimeOfDay=8.6, CloudCover=0.18, SnowCover=1.0, Wetness=0.35, Puddles=0.2),
}


def make(pairs, extra=None):
    """pairs: list of (view, state).  Returns the sequence paths."""
    out = []
    for view, state in pairs:
        pos, target, focal = VIEWS[view]
        w = dict(STATES[state])
        w.update(extra or {})
        out.append(shots.still("%s_%s" % (view, state), pos, target, focal, w, shot_id=900 if state == "storm" else 0))
    print("\n".join(out))
    return out
