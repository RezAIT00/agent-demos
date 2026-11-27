"""Start a Movie Render Queue job in the dev-loop editor and wait for it to finish."""
import json
import os
import sys
import time

from ue_send import ROOT, send

STATUS = os.path.join(ROOT, "build", "render_status.json")


def render(jobs, timeout=3600, quiet=False, **kw):
    if os.path.exists(STATUS):
        os.remove(STATUS)
    code = (
        "import sys, importlib\n"
        "sys.path.insert(0, r'%s')\n"
        "import render as _r\n"
        "importlib.reload(_r)\n"
        "_r.render(%r, **%r)\n" % (os.path.join(ROOT, "source", "ue"), jobs, kw)
    )
    for attempt in range(20):
        ok, out = send(code, 600, quiet=True)
        if ok or "already running" not in out:
            break
        time.sleep(3.0)     # the previous job is still winding down
    if not ok:
        raise RuntimeError(out)
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(STATUS):
            try:
                with open(STATUS) as f:
                    s = json.load(f)
            except (ValueError, PermissionError):
                s = {}
            if s.get("state") == "done":
                if not quiet:
                    print("render %s in %.1f s" % ("ok" if s["success"] else "FAILED", s["seconds"]))
                return s
        time.sleep(1.0)
    raise TimeoutError("render did not finish")
