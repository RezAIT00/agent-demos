"""Runs the project as a game (offscreen) with an nyc.run script, and waits for it to finish.
Only the process started here is ever stopped.

  python source/run_game.py build/test/t1.json [--res 1920x1080] [--timeout 900] [--fps 30]
"""
import argparse
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDITOR = r"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"


def run(script, res="1920x1080", timeout=900, fps=30, extra=(), log="game.log", realtime=False):
    w, h = res.split("x")
    logpath = os.path.join(ROOT, "logs", log)
    cmd = [EDITOR, os.path.join(ROOT, "NYC", "NYC.uproject"), "/Game/NYC/Maps/NYC_Midtown", "-game", "-RenderOffScreen",
           "-windowed", "-ResX=%s" % w, "-ResY=%s" % h, "-ForceRes", "-unattended", "-nosplash", "-nopause", "-nosound",
           *(() if realtime else ("-benchmark", "-fps=%d" % fps, "-deterministic")),
           "-ExecCmds=%snyc.run %s" % ("t.MaxFPS 0,r.VSync 0," if realtime else "", os.path.abspath(script).replace("\\", "/")),
           "-abslog=%s" % logpath, *extra]
    t0 = time.time()
    p = subprocess.Popen(cmd, cwd=ROOT)
    try:
        p.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        p.kill()
        print("game timed out after %d s" % timeout)
        return False, time.time() - t0, logpath
    return p.returncode == 0, time.time() - t0, logpath


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--res", default="1920x1080")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--log", default="game.log")
    ap.add_argument("--realtime", action="store_true", help="wall-clock play, uncapped: for frame-rate measurement")
    a = ap.parse_args()
    ok, took, logpath = run(a.script, a.res, a.timeout, a.fps, log=a.log, realtime=a.realtime)
    print("exit ok" if ok else "exit failed", "after %.0f s, log %s" % (took, logpath))
    if os.path.exists(logpath):
        lines = open(logpath, encoding="utf-8", errors="replace").read().splitlines()
        bad = [l for l in lines if ("Error:" in l or "Fatal" in l or "Ensure" in l or "LogNYC" in l or "Test runner" in l)]
        print("\n".join(bad[:60]))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
