"""Play-mode frame rate at 2560x1440: the game is run offscreen in real time with the frame cap and vsync off,
at the Epic scalability level that Play uses, over fixed viewpoints, weather states and two destructions.

  python source/tools/perf.py build/perf/before.json [--res 2560x1440]
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "source"))
from run_game import run  # noqa: E402

CLEAR = dict(TimeOfDay=13.0, CloudCover=0.18, Storm=0.0, Rain=0.0, Snow=0.0, Fog=0.0, Wind=0.25, Wetness=0.0, Puddles=0.0, SnowCover=0.0, ExposureBias=0.4)
STORM = dict(CLEAR, TimeOfDay=20.5, CloudCover=1.0, Storm=1.0, Rain=1.0, Wind=0.85, Wetness=1.0, Puddles=0.6, LightningPerMinute=10.0)
SNOW = dict(CLEAR, TimeOfDay=1.0, CloudCover=0.95, Storm=0.1, Snow=0.85, Fog=0.15, Wind=0.3, SnowCover=0.8)

# label, camera (loc, rot as pitch/yaw/roll, or look), weather, fly-to, tool events
SCENES = [
    ("fifth_avenue_day", dict(loc=[2600, 150, 230], rot=[5, 180, 0]), CLEAR, [-2600, 150, 230], []),
    ("42nd_street_day", dict(loc=[150, -9000, 300], rot=[7, 90, 0]), CLEAR, [150, -4500, 300], []),
    ("above_bryant_park", dict(loc=[21000, -42000, 24000], rot=[-16, 132, 0]), CLEAR, [15000, -36000, 21000], []),
    ("high_over_midtown", dict(loc=[90000, -60000, 62000], rot=[-24, 148, 0]), CLEAR, [70000, -48000, 52000], []),
    ("library_night_storm", dict(loc=[-5600, -900, 260], rot=[6, -105, 0]), STORM, [-5600, -2600, 260], []),
    ("bryant_park_snow", dict(loc=[-9500, -24500, 420], rot=[8, 60, 0]), SNOW, [-8500, -23000, 420], []),
    ("wrecking_ball", dict(loc=[1309, 9951, 1400], look=[-1512, 6067, 2134]), dict(CLEAR, TimeOfDay=8.5, ExposureBias=1.0), None,
     [("wrecking_ball", [1309, 9951, 1400], [-1512, 6067, 2134])]),
    ("gas_main", dict(loc=[989, 2957, 1000], look=[0, 6000, 200]), dict(CLEAR, TimeOfDay=8.5, ExposureBias=1.0), None,
     [("gas_main", [989, 2957, 1000], [0, 6000, 0])]),
    ("tactical_nuke", dict(loc=[-85000, 3000, 47000], look=[0, 7200, 8000]), dict(CLEAR, TimeOfDay=16.0, ExposureBias=0.8), None,
     [("tactical_nuke", [-85000, 3000, 47000], [0, 7200, 0])]),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--res", default="2560x1440")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    out = os.path.abspath(a.out).replace("\\", "/")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    events, t = [], 0.5
    only = [x for x in a.only.split(",") if x]
    for label, cam, weather, fly, tools in SCENES:
        if only and label not in only:
            continue
        events.append(dict(t=t, do="reset"))
        events.append(dict(t=t + 0.1, do="camera", **cam))
        events.append(dict(t=t + 0.15, do="weather", **weather))
        t += 6.0       # streaming, Lumen and the weather settle
        for tool, frm, at in tools:
            events.append(dict(t=t, do="tool", id=tool, **{"from": frm, "at": at}))
        seconds = 12.0 if tools else 7.0
        ev = dict(t=t + 0.02, do="perf", label=label, seconds=seconds)
        if fly:
            ev["to"] = fly
        events.append(ev)
        t += seconds + 1.0
    events.append(dict(t=t + 1.0, do="quit"))
    script = out.replace(".json", "_script.json")
    report = out.replace(".json", ".jsonl")
    if os.path.exists(report):
        os.remove(report)
    with open(script, "w") as f:
        json.dump(dict(warmup_frames=200, camera=SCENES[0][1], weather=CLEAR, report=report, events=events), f, indent=1)
    ok, took, log = run(script, a.res, 1800, log="perf_%s.log" % os.path.basename(out)[:-5], realtime=True)
    rows = [json.loads(line) for line in open(report, encoding="utf-8-sig") if line.startswith("{")] if os.path.exists(report) else []
    settings = []
    for line in open(log, encoding="utf-8", errors="replace"):
        if "ScreenPercentage" in line and "Set CVar" in line:
            settings.append(line.split("Set CVar")[1].strip())
    with open(out, "w") as f:
        json.dump(dict(resolution=a.res, ok=ok, rows=rows, settings=settings), f, indent=1)
    print("%-22s %8s %10s %9s %9s %8s %8s %8s" % ("scene", "avg fps", "median ms", "p95 ms", "p99 ms", "gpu ms", "game ms", "rt ms"))
    for r in rows:
        print("%-22s %8.1f %10.2f %9.2f %9.2f %8.2f %8.2f %8.2f" % (r["label"], r["avg_fps"], r["median_ms"], r["p95_ms"], r["p99_ms"], r["gpu_ms"], r["game_ms"], r["render_ms"]))
    sys.exit(0 if ok and rows else 1)


if __name__ == "__main__":
    main()
