"""Render review stills and tile them into one sheet.

  python source/review.py sheetname view:state [view:state ...] [--res 1920x1080] [--samples 1] [--warmup 40]
"""
import os
import subprocess
import sys

from ue_send import ROOT, send
from render_client import render


def main():
    args = [a for a in sys.argv[1:]]
    opts = {"--res": "1920x1080", "--samples": "1", "--warmup": "48", "--cols": "2", "--thumb": "960"}
    for k in list(opts):
        if k in args:
            i = args.index(k)
            opts[k] = args[i + 1]
            del args[i:i + 2]
    sheet, pairs = args[0], [tuple(a.split(":")) for a in args[1:]]
    code = ("import sys, importlib\nsys.path.insert(0, r'%s')\nimport views; importlib.reload(views)\nviews.make(%r)\n"
            % (os.path.join(ROOT, "source", "ue"), pairs))
    ok, out = send(code, 900, quiet=True)
    if not ok:
        print(out)
        sys.exit(1)
    out_dir = os.path.join(ROOT, "renders", "review", sheet)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    jobs = [dict(seq="/Game/NYC/Sequences/Stills/STILL_%s_%s" % p, out=out_dir, name="%s_%s" % p) for p in pairs]
    w, h = (int(v) for v in opts["--res"].split("x"))
    render(jobs, res=(w, h), tsamples=int(opts["--samples"]), warmup=int(opts["--warmup"]), engine_warmup=32, timeout=1800)
    files = [os.path.join(out_dir, "%s_%s.0000.png" % p) for p in pairs]
    sheet_path = os.path.join(ROOT, "build", "sheet_%s.png" % sheet)
    subprocess.run([sys.executable, os.path.join(ROOT, "source", "tools", "sheet.py"), sheet_path, opts["--cols"], opts["--thumb"]] + files, check=True)
    print(sheet_path)


if __name__ == "__main__":
    main()
