"""Opens the project in a fresh editor on its default map, quits, and reports every error line in the log.
Only the process started here is touched.

  python source/tools/load_check.py [--timeout 600]
"""
import argparse
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EDITOR = r"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", type=int, default=600)
    a = ap.parse_args()
    log = os.path.join(ROOT, "logs", "load_check.log")
    if os.path.exists(log):
        os.remove(log)
    cmd = [EDITOR, os.path.join(ROOT, "NYC", "NYC.uproject"), "-RenderOffScreen", "-unattended", "-nosplash", "-nopause",
           "-ExecCmds=QUIT_EDITOR", "-abslog=%s" % log]
    t0 = time.time()
    p = subprocess.Popen(cmd, cwd=ROOT)
    try:
        p.wait(timeout=a.timeout)
        exited = True
    except subprocess.TimeoutExpired:
        p.kill()
        exited = False
    lines = open(log, encoding="utf-8", errors="replace").read().splitlines() if os.path.exists(log) else []
    loaded = [l for l in lines if "NYC_Midtown" in l and ("Load map complete" in l or "LogEditorServer" in l or "MAP LOAD" in l or "LogLoad" in l)]
    errors = [l for l in lines if re.search(r"\bError:", l) or "Fatal error" in l or "Ensure condition failed" in l
              or "Failed to compile Material" in l or "Failed to load" in l]
    print("exited cleanly:", exited, " seconds:", round(time.time() - t0))
    print("default map lines:", len(loaded))
    for l in loaded[:4]:
        print("   ", l.split("]", 2)[-1][:220])
    print("error lines:", len(errors))
    for l in errors[:25]:
        print("   ", l.split("]", 2)[-1][:260])


if __name__ == "__main__":
    main()
