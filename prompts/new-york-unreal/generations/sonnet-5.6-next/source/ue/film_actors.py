"""Scripted film events stored on the level actors: lightning strikes, hero vehicles and the
patches of road kept clear for them.  Shot numbers match source/ue/film.py."""
import os
import sys

import unreal

sys.path.insert(0, os.path.join(os.path.abspath(os.path.join(unreal.Paths.project_dir(), "..")), "source", "film"))


def strike(shot, t, to, frm=None, seed=1, power=1.0, bolt=True):
    s = unreal.NYCStrike()
    s.set_editor_property("shot", shot)
    s.set_editor_property("time", float(t))
    frm = frm or (to[0] + 160.0, to[1] - 220.0, 1150.0)
    s.set_editor_property("from_", unreal.Vector(frm[0] * 100, frm[1] * 100, frm[2] * 100))
    s.set_editor_property("to", unreal.Vector(to[0] * 100, to[1] * 100, to[2] * 100))
    s.set_editor_property("seed", seed)
    s.set_editor_property("power", float(power))
    s.set_editor_property("visible_bolt", bolt)
    return s


SEEDS = [11, 29, 5, 7, 41, 57]


def run(weather, traffic):
    import importlib
    import filmdata
    importlib.reload(filmdata)
    made = [strike(sh, t, to, frm, SEEDS[i], power, bolt) for i, (sh, t, to, frm, power, bolt) in enumerate(filmdata.STRIKES)]
    # an extra stroke for the review stills
    made.append(strike(900, -0.045, filmdata.ESB_TIP, (-560.0, -330.0, 1150.0), 11, 1.25, True))
    weather.set_editor_property("strikes", made)
    try:
        import film
        import importlib
        importlib.reload(film)
        heroes, zones = film.hero_cars(), film.clear_zones()
    except ImportError:
        heroes, zones = [], []
    traffic.set_editor_property("hero_cars", heroes)
    traffic.set_editor_property("clear_zones", zones)
