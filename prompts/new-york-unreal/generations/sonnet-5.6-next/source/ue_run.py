"""Run a source/ue module function in the dev-loop editor.

  python source/ue_run.py all_materials "run(reimport_textures=True)" [timeout]
"""
import os
import sys

from ue_send import ROOT, send

if __name__ == "__main__":
    module, call = sys.argv[1], sys.argv[2]
    timeout = float(sys.argv[3]) if len(sys.argv) > 3 else 1800.0
    code = (
        "import sys, importlib\n"
        "sys.path.insert(0, r'%s')\n"
        "import %s as _m\n"
        "importlib.reload(_m)\n"
        "_m.%s\n" % (os.path.join(ROOT, "source", "ue"), module, call)
    )
    ok, _ = send(code, timeout)
    sys.exit(0 if ok else 1)
