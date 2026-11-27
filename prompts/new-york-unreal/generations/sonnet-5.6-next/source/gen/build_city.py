"""Regenerates the whole city.   python source/gen/build_city.py

Output (build/city):  meshes/*.nmesh, city.nlayout, city.nlights, traffic.json, manifest.json
and build/tex/cover.png (the shelter map).
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "build", "city")
MESH = os.path.join(OUT, "meshes")

import blocks
import city as C
import citydata as D
import destructkit
import farcity
import kits
import landmarks as L
from meshlib import Layout
import props
import roofkit
import streets
import trees


def shed_runs(city, plans):
    """A handful of sidewalk bridges, on the blocks the street-level cameras walk past."""
    def find(face, pred, want):
        done = 0
        for p in plans:
            r = p["rect"]
            if p["zone"] == 0 and face in p["street"] and pred(r) and done < want:
                length = (r[3] - r[2]) if face in "SN" else (r[1] - r[0])
                if length > 12:
                    blocks.add_shed(city, r, face, 0.6, length - 0.6, lifts=3 if done == 0 else 0)
                    done += 1
        return done

    n = 0
    n += find("S", lambda r: abs(r[0] - 15.24) < 1 and 60 < r[2] < 150, 1)
    n += find("W", lambda r: abs(r[2] - 15.25) < 1 and -225 < r[0] < -190, 1)
    n += find("E", lambda r: abs(r[3] + 15.25) < 1 and -330 < r[0] < -250, 1)
    n += find("N", lambda r: abs(r[1] + 15.24) < 1 and 80 < r[2] < 150, 1)
    return n


PARKED = [("sedan0", .17), ("sedan1", .17), ("suv0", .2), ("suv1", .2), ("van0", .05), ("van1", .05), ("van2", .04),
          ("truck0", .025), ("truck1", .025), ("cab0", .04), ("cab2", .03)]
PAINTS = [(0.006, 0.006, 0.007), (0.006, 0.006, 0.007), (0.012, 0.013, 0.015), (0.68, 0.68, 0.66), (0.58, 0.58, 0.57),
          (0.34, 0.35, 0.37), (0.12, 0.125, 0.135), (0.06, 0.063, 0.068), (0.012, 0.03, 0.11), (0.24, 0.012, 0.008),
          (0.012, 0.05, 0.03), (0.25, 0.2, 0.12)]
# kerbs that stay empty: the library front and the spots where close cameras stand
NO_PARKING = [(-150.0, -16.0, 2.0, 12.0), (-20.0, 45.0, -12.0, 12.0), (-12.0, 12.0, -140.0, -12.0), (-12.0, 12.0, 12.0, 60.0)]


def park_cars(city, st):
    rng = city.rng
    names = [n for n, _ in PARKED]
    probs = [p for _, p in PARKED]
    probs = [p / sum(probs) for p in probs]
    count = 0
    for x, y, yaw in st.parked:
        if any(a < x < b and c < y < d for a, b, c, d in NO_PARKING):
            continue
        if not (-330 < x < 240 and -380 < y < 520) and rng.random() < 0.45:
            continue
        name = names[int(rng.choice(len(names), p=probs))]
        if name.startswith("cab"):
            col = (0.84, 0.47, 0.004)
        elif name.startswith(("van", "truck")):
            col = (0.66, 0.66, 0.63)
        else:
            col = PAINTS[int(rng.integers(len(PAINTS)))]
        city.inst("parked_" + name, (x, y, 0.0), yaw, custom=(col[0], col[1], col[2], float(rng.random())), override="carpaint=carpaint_parked")
        count += 1
    return count


def export_destruction(city, order, shell_names, modules, path):
    """What the destruction system needs to take any building apart."""
    out = []
    for r in city.records:
        d = {k: v for k, v in r.items() if k not in ("refs", "shells")}
        d["refs"] = [v for key, row in r["refs"] for v in (order[key], row)]
        d["shells"] = sorted(s for s in r["shells"] if s in shell_names)
        out.append(d)
    far = [[round(x, 2), round(y, 2), round(wx, 2), round(wy, 2), round(z, 2), round(h, 2), round(yaw, 1), order[ref[0]], ref[1], style]
           for x, y, wx, wy, z, h, yaw, ref, style in city.far_records]
    with open(path, "w") as fh:
        mods = {name: dict(w=float(m.w), h=float(m.h), windows=[[round(float(v), 3) for v in w] for w in m.windows])
                for name, m in modules.items()}
        json.dump(dict(buildings=out, far=far, modules=mods), fh, separators=(",", ":"))
    print("destruction records: %d buildings, %d distant boxes" % (len(out), len(far)))


def main():
    t0 = time.time()
    os.makedirs(MESH, exist_ok=True)
    for f in os.listdir(MESH):
        os.remove(os.path.join(MESH, f))
    manifest = []

    def save(name, mb, nanite=True, cards=12, preserve=False):
        mb.save(os.path.join(MESH, name + ".nmesh"))
        manifest.append(dict(name=name, nanite=nanite, cards=cards, preserve=preserve, tris=mb.tri_count, slots=mb.slots))

    print("kit meshes")
    modules = kits.all_modules()
    for name, m in modules.items():
        save(name, m.mb, cards=6)
    for name, mb in roofkit.all_meshes().items():
        save(name, mb, cards=8, preserve=name.startswith(("fireescape", "scaffold")))
    for name, mb in props.all_meshes().items():
        save(name, mb, nanite=name not in ("busshelter",), cards=6)
    for name, mb in trees.all_meshes().items():
        save(name, mb, cards=6, preserve=("tree" in name))
    for name, mb in destructkit.all_meshes().items():
        save(name, mb, cards=4)
    for name, mb in destructkit.broken_modules(modules).items():
        save(name, mb, cards=3)
    save("farbox", farcity.farbox_mesh(), cards=6)
    save("farwoods", farcity.farwoods_mesh(), cards=2, preserve=True)
    save("farroof", farcity.farroof_mesh(), cards=2)

    city = C.City(seed=7)
    print("streets")
    st = streets.Streets(city)
    st.build()
    print("landmarks")
    tips = {}
    def landmark(key, fn, h, rect, wall="limestone", glass="glass_office", style="stone", fh=3.6, bay=2.2, tiers=None):
        r = [float(q) for q in rect]
        token = city.begin(kind="landmark", name=key, rect=r, h=float(h), style=style, wall=wall, trim="limestone_trim", glass=glass,
                           frame="paint_darkgray", party=wall, fh=fh, bay=bay, tiers=tiers or [r + [0.0, float(h)]])
        out = fn(city)
        city.end(token)
        return out

    def stack(rect, rows):
        cx, cy = (rect[0] + rect[1]) / 2, (rect[2] + rect[3]) / 2
        return [[cx - wx / 2, cx + wx / 2, cy - wy / 2, cy + wy / 2, float(a), float(b)] for wx, wy, a, b in rows]

    esb = D.LOTS["esb"]
    tips["esb"] = landmark("esb", L.empire_state, 320, esb, style="deco", fh=3.5, bay=1.75,
                           tiers=stack(esb, [(61, 129, 0, 24), (53, 106, 24, 84), (47, 86, 84, 101), (43, 72, 101, 122),
                                             (38, 56, 122, 268), (33, 48, 268, 288), (28, 39, 288, 305), (24, 31, 305, 320)]))
    ch = D.LOTS["chrysler"]
    tips["chrysler"] = landmark("chrysler", L.chrysler, 252, ch, wall="brick_white", style="deco", fh=3.5, bay=1.45,
                                tiers=stack(ch, [(60, 62, 0, 62), (51, 51, 62, 88), (40, 40, 88, 116), (31, 31, 116, 214), (26, 26, 214, 252)]))
    landmark("library", L.library, 22, [-146.0, -25.0, -108.0, -38.0], wall="marble", fh=7.0, bay=5.3)
    landmark("gct", L.grand_central, 30, [20.0, 94.0, 274.0, 366.0], wall="limestone", fh=9.0, bay=8.0)
    landmark("onev", L.one_vanderbilt, 380, D.LOTS["onev"], wall="terracotta", glass="curtain_silver", style="glass", fh=4.4, bay=1.5)
    landmark("bofa", L.bofa_tower, 270, D.LOTS["bofa"], wall="aluminium", glass="curtain_clear", style="glass", fh=4.1, bay=1.5)
    landmark("grace", L.grace_building, 192, D.LOTS["grace"], wall="marble", style="ribbon", fh=3.9, bay=2.35)
    landmark("metlife", L.metlife_slab, 240, D.LOTS["metlife"], wall="concrete_panel", fh=3.8, bay=1.65)
    landmark("radiator", L.radiator_building, 99, D.LOTS["radiator"], wall="brick_black", style="deco", fh=3.5, bay=1.45)
    landmark("dailynews", L.daily_news, 145, D.LOTS["dailynews"], wall="brick_white", style="deco", fh=3.5, bay=1.45)
    L.midtown_named(city)
    L.tudor_city(city)
    L.un_secretariat(city)
    L.far_landmarks(city)
    trees.bryant_park(city)
    print("blocks")
    plans, stats = blocks.build_blocks(city)
    print("  buildings", stats, "sheds", shed_runs(city, plans))
    with open(os.path.join(OUT, "plans.json"), "w") as fh:
        json.dump(plans, fh)
    print("street furniture")
    f = props.Furnisher(city, st)
    f.intersections()
    f.streetlights()
    f.kerbside()
    f.ped_paths()
    print("parked cars:", park_cars(city, st))
    print("far city")
    far = farcity.FarCity(city)
    print("  far boxes", far.build())

    print("writing")
    shells = city.save_shells(MESH)
    for layer, name, tris in shells:
        cards = {"library": 32, "gct": 32, "landmark": 32, "shell": 24, "park": 12, "lions": 12, "bld": 16}.get(layer, 8)
        flat = layer in ("street", "sidewalk", "farground", "water", "ridge")
        manifest.append(dict(name=name, nanite=True, cards=2 if flat else cards, preserve=False, tris=tris,
                             slots=None, shell=True, rt=layer not in ("water", "ridge", "farground"), shadow=layer not in ("water", "farground", "street")))
    order = city.layout.save(os.path.join(OUT, "city.nlayout"))
    export_destruction(city, order, {name for _, name, _ in shells}, modules, os.path.join(OUT, "destruction.json"))
    city.save_lights(os.path.join(OUT, "city.nlights"))
    city.save_cover(os.path.join(ROOT, "build", "tex", "cover.png"))
    city.save_raised(os.path.join(ROOT, "build", "tex", "groundz.png"))
    extra = os.path.join(ROOT, "build", "tex", "extra.json")
    with open(extra) as fh:
        files = [x for x in json.load(fh)["files"] if x[1] not in ("cover", "groundz")]
    files += [[os.path.join(ROOT, "build", "tex", "cover.png"), "cover", "gray"],
              [os.path.join(ROOT, "build", "tex", "groundz.png"), "groundz", "gray"]]
    with open(extra, "w") as fh:
        json.dump(dict(files=files), fh, indent=1)
    with open(os.path.join(OUT, "traffic.json"), "w") as fh:
        json.dump(dict(cycle=D.CYCLE, aveGreen=D.AVE_GREEN, yellow=D.YELLOW, allRed=D.ALL_RED,
                       lanes=st.lanes, lamps=f.lamps, parked=st.parked, peds=f.peds, crossings=f.crossings, steam=st.steam,
                       drips=city.drips, signals=st.signals, tips=tips), fh)
    overrides = set()
    for key in city.layout.groups:
        for pair in key[2].split(";"):
            if "=" in pair:
                overrides.add(pair.split("=", 1)[1])
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(dict(meshes=manifest, overrides=sorted(overrides)), fh)
    shell_lay = Layout(tile=1.0e9)
    for m in manifest:
        if m.get("shell"):
            shell_lay.add(m["name"], (0.0, 0.0, 0.0), shadow=m.get("shadow", True), rt=m.get("rt", True), layer="shell")
    shell_lay.save(os.path.join(OUT, "shells.nlayout"))
    unique = sum(m["tris"] for m in manifest)
    by_name = {m["name"]: m["tris"] for m in manifest}
    instanced = sum(len(rows) * by_name.get(key[1], 0) for key, rows in city.layout.groups.items())
    print("meshes %d (%d shells), unique tris %.1fM" % (len(manifest), len(shells), unique / 1e6))
    print("instances %d in %d groups, instanced tris %.1fM, lights %d" % (city.layout.count(), len(city.layout.groups), instanced / 1e6, len(city.lights)))
    print("lanes %d, signal lamps %d, parked %d, steam %d, drips %d" % (len(st.lanes), len(f.lamps), len(st.parked), len(st.steam), len(city.drips)))
    print("done in %.0f s" % (time.time() - t0))


if __name__ == "__main__":
    main()
