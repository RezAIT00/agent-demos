"""Writes DESTRUCTION.md from the arsenal's own source: the registry order (smallest first) and each
tool's description, plus what the last audit measured.  The document cannot drift from the code."""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "NYC", "Source", "NYC", "Private")
sys.path.insert(0, os.path.join(ROOT, "tools"))
from destruction_audit import tool_ids  # noqa: E402

TIERS = ["", "Hand tools", "Charges and fire", "Machines and demolition", "Artillery and ordnance",
         "Hazards, weather and ground", "Absurd", "Alien technology", "World ending"]

STRING = r'TEXT\("((?:[^"\\]|\\.)*)"\)'
PATTERN = re.compile(r"Tool\(" + STRING + r",\s*" + STRING + r",\s*(\d),\s*" + STRING +
                     r",\s*ENYCTarget::(\w+),[^\n]*?\n\s*" + STRING + r",\s*" + STRING)


def parse():
    tools = {}
    for path in sorted(glob.glob(os.path.join(SRC, "NYCTools*.cpp"))):
        text = open(path, encoding="utf-8").read()
        for m in PATTERN.finditer(text):
            tid, name, tier, category, target, does, built = m.groups()
            tools[tid] = dict(name=name, tier=int(tier), category=category, target=target,
                              does=does.replace('\\"', '"'), built=built.replace('\\"', '"'), file=os.path.basename(path))
    return tools


def main():
    tools = parse()
    ids = tool_ids()
    missing = [i for i in ids if i not in tools]
    if missing:
        sys.exit("no description found for: %s" % ", ".join(missing))
    audit = {}
    path = os.path.join(ROOT, "stills", "destruction", "audit.json")
    if os.path.exists(path):
        audit = {r["id"]: r for r in json.load(open(path))["results"]}
    out = ["# The destruction arsenal", "",
           "%d tools, listed smallest to biggest. This is the order of the in-game selector (Tab) and of the audit." % len(ids),
           "This file is generated from the code by `tools/make_destruction_md.py`.", "",
           "## How destruction works (shared by every tool)", "",
           "- **Buildings** switch to a destructible form the first time something touches them. The 2,284 detailed buildings "
           "keep their look: each facade bay stays an instance until hit, and the shell is cut into pieces when needed. "
           "Behind the facades is a steel frame (slabs, columns, I-beams), inner walls, partitions and furniture.",
           "- **Fracture** happens at runtime as Chaos Geometry Collections, built in C++ from the struck parts. Break lines are crooked (neighbouring cells share the same crooked edge). Masonry pieces are 34 cm thick or more, shell walls 38 cm (24 cm for concrete), floor slabs 25 cm. Broken faces show their own finish: brick core with lime mortar, raw concrete with aggregate, or cracked plaster on the room side, and slabs and concrete walls carry bent rebar stubs. Densities are real (masonry 1,950, concrete 2,350 kg/m3), damping is near zero, and large pieces turn slowly while small ones tumble. Window frames break bar by bar. This uses editor binaries (see NOTES.md). Falling clusters break again when they land, and radial and vortex physics fields push or pull loose pieces. This uses editor binaries (see NOTES.md).",
           "- **Anchors:** after a local blow, the wall pieces on the rim of the struck bay stay in a second, wholly anchored Chaos collection, so the hole keeps a ragged edge. They are released if the building later comes down.",
           "- **Gravel:** every stony break also throws fist- to suitcase-sized lumps on computed paths (fall, bounce, skid, rest), which stay where they land and repeat exactly in film takes.",
           "- **Played live,** very large blasts break into fewer, larger pieces, and their collections are built over several frames to keep the frame rate up. Film takes keep every piece.",
           "- **No people:** the first tool used clears the pedestrians until the city is rebuilt; the destruction film and the audit never show them.",
           "- **Structure** is checked floor by floor. When a floor loses too much support, or support becomes badly off "
           "centre, the building fails as a pancake, a topple or a shear. Falling floors damage neighbours, which can cascade.",
           "- **Street objects** (cars, trees, poles, hydrants, mailboxes, bags, shelters, stalls, manhole lids) become rigid "
           "bodies or fragments. Cars crumple, lose glass and can burn. Hydrants spray water. Traffic treats wrecks as "
           "obstacles. Big blasts also fell distant buildings, out to the far-district boxes.",
           "- **Effects** are 14 Niagara systems built by script (sparks, embers, dust, smoke, flame, shock ring, water, "
           "water jet, chips, glass, splinters, paper, motes) and ray-marched volumes (dust, smoke, flame, fireball, "
           "mist, mushroom cloud, tornado funnel, energy) that are lit by the sun and sky and shaded by nearby buildings.",
           "- **Flash limit:** no more than two bright onsets in any one-second window. Extra flashes are softened into slow swells.",
           "- **Sound:** every event plays a synthesized sound (`source/sound/destruct_sounds.py`).",
           "- **Reset:** Backspace restores every building, object, car and light.", "",
           "'Audit' lines are what one use broke on a fresh scene in `tools/destruction_audit`: building parts removed, "
           "fragments made, window panes broken, street objects, vehicles and craters. Before and after stills are in "
           "`stills/destruction/`, and all of them are on `destruction_sheet.png`.", ""]
    tier = 0
    for n, tid in enumerate(ids, 1):
        t = tools[tid]
        if t["tier"] != tier:
            tier = t["tier"]
            out += ["## Tier %d: %s" % (tier, TIERS[tier]), ""]
        out.append("### %d. %s" % (n, t["name"]))
        out.append("*%s · `%s` · %s*" % (t["category"], tid, t["file"]))
        out.append("")
        out.append("- **Does:** %s" % t["does"])
        out.append("- **Built:** %s" % t["built"])
        r = audit.get(tid)
        if r:
            bits = [("parts", r["elements"]), ("fragments", r["pieces"]), ("panes", r["windows"]), ("street objects", r["props"]),
                    ("vehicles", r["vehicles"]), ("craters", r["craters"]), ("buildings collapsed", r["collapses"])]
            out.append("- **Audit:** %s" % (", ".join("{:,} {}".format(v, k if v != 1 else k.replace("buildings", "building").rstrip("s") if k != "buildings collapsed" else "building collapsed") for k, v in bits if v) or "nothing"))
        out.append("")
    with open(os.path.join(ROOT, "DESTRUCTION.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print("DESTRUCTION.md: %d tools" % len(ids))


if __name__ == "__main__":
    main()
