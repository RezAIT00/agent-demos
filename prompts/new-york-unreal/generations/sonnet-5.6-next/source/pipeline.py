"""One command to regenerate the project.

  python source/pipeline.py gen cpp materials level          (any subset, always in this order)
  python source/pipeline.py materials=ground,materials_fx level

Material work happens in a freshly started editor with no city loaded: recompiling a material
while the map is open makes Unreal re-register all 400,000 instances for every save.
"""
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ue_send import ROOT, send

PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")


def sh(args, **kw):
    r = subprocess.run(args, cwd=ROOT, **kw)
    if r.returncode:
        sys.exit(r.returncode)


def editor(stop=False):
    args = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", os.path.join(ROOT, "source", "editor.ps1")]
    if stop:
        args.append("-Stop")
    sh(args)


def run_ue(module, call, timeout=1800):
    code = ("import sys, importlib\nsys.path.insert(0, r'%s')\nimport %s as _m\nimportlib.reload(_m)\n_m.%s\n"
            % (os.path.join(ROOT, "source", "ue"), module, call))
    ok, out = send(code, timeout)
    if not ok:
        sys.exit(1)


def editor_alive():
    pid_file = os.path.join(ROOT, "logs", "editor.pid")
    if not os.path.exists(pid_file):
        return False
    pid = open(pid_file).read().strip()
    r = subprocess.run(["tasklist", "/FI", "PID eq %s" % pid, "/NH"], capture_output=True, text=True)
    return "UnrealEditor" in r.stdout


def main():
    steps = sys.argv[1:]
    names = {s.split("=")[0]: (s.split("=", 1)[1] if "=" in s else "") for s in steps}
    t0 = time.time()
    if "gen" in names:
        sh([PY, "source/gen/signs.py"])
        sh([PY, "source/gen/build_city.py"])
        sh([PY, "source/gen/vehicles.py"])
        sh([PY, "source/gen/fx.py"])
        if os.path.exists(os.path.join(ROOT, "source", "gen", "destruct_fx.py")):
            sh([PY, "source/gen/destruct_fx.py"])
    if "cpp" in names or "materials" in names or ("level" in names and editor_alive()):
        editor(stop=True)
    if "cpp" in names:
        r = subprocess.run(["cmd", "/c", os.path.join(ROOT, "source", "build_cpp.bat")], cwd=ROOT, capture_output=True, text=True)
        lines = [l for l in r.stdout.splitlines() if "error" in l.lower() or "Result:" in l]
        print("\n".join(lines[:40]))
        if r.returncode:
            sys.exit(r.returncode)
    if ("materials" in names or "level" in names) or not editor_alive():
        if not editor_alive():
            editor()
    if "materials" in names:
        which = names["materials"]
        if which:
            for mod in which.split(","):
                if ":" in mod:
                    m, parts = mod.split(":")
                    run_ue(m, "run(which=%r)" % (tuple(parts.split("+")),))
                elif mod in ("ground", "surface", "glass"):
                    run_ue("materials", "run(which=(%r,))" % mod)
                else:
                    run_ue(mod, "run()")
        else:
            run_ue("all_materials", "run()")
        run_ue("check_materials", "__name__")
    if "level" in names:
        run_ue("build_level", "run()", 3000)
    print("pipeline done in %.0f s" % (time.time() - t0))


if __name__ == "__main__":
    main()
