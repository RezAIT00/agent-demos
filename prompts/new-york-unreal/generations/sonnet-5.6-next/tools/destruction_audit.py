"""Triggers every destruction tool on a freshly rebuilt city, checks that something actually broke, and
saves a before and an after still of each.

  venv\\Scripts\\python.exe tools\\destruction_audit.py                 all tools
  venv\\Scripts\\python.exe tools\\destruction_audit.py --only grenade,tornado
  venv\\Scripts\\python.exe tools\\destruction_audit.py --sheet-only

Stills go to stills/destruction/NN_id_before.png and _after.png, the numbers to
stills/destruction/audit.json, and every pair onto destruction_sheet.png.  The game is started offscreen,
one instance at a time, a batch of tools per run; if a run dies the audit carries on after the tool that
was running and reports it as failed.  Close any editor that has this project open first.
"""
import argparse
import glob
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "source"))
from run_game import run  # noqa: E402

OUT = os.path.join(ROOT, "stills", "destruction")
ARSENAL = os.path.join(ROOT, "NYC", "Source", "NYC", "Private", "NYCArsenal.cpp")


def tool_ids():
    """The registry order, smallest first, read from the table in NYCArsenal.cpp."""
    text = open(ARSENAL, encoding="utf-8").read()
    table = text[text.index("ArsenalOrder[] = {"):text.index("TArray<FNYCTool> Build()")]
    return re.findall(r'TEXT\("([a-z0-9_]+)"\)', table)


def read_reports():
    rows = {}
    for path in glob.glob(os.path.join(OUT, "audit_*.jsonl")):
        for line in open(path, encoding="utf-8-sig", errors="replace"):
            line = line.strip()
            if line.startswith("{"):
                r = json.loads(line)
                rows[r["id"]] = r
    return rows


def launch(ids, res, timeout, tag):
    script = os.path.join(ROOT, "build", "audit", "batch.json")
    os.makedirs(os.path.dirname(script), exist_ok=True)
    with open(script, "w") as fh:
        json.dump(dict(warmup_frames=150, camera=dict(loc=[2600, 150, 900], look=[-1500, 6000, 600], fov=64),
                       weather=dict(TimeOfDay=13.85, CloudCover=0.3, ExposureBias=1.35),
                       audit=dict(tools=ids, out=OUT.replace("\\", "/")), events=[]), fh)
    ok, took, log = run(script, res, timeout, 30, log="audit_%s.log" % tag)
    return ok, took, log


def log_problems(log):
    """Errors and ensures written while the game ran (not counting the engine's own start-up chatter)."""
    found = []
    if not os.path.exists(log):
        return found
    tool = "start-up"
    for line in open(log, encoding="utf-8", errors="replace"):
        m = re.search(r"LogNYC: Display: Tool (\w+) at", line)
        if m:
            tool = m.group(1)
        if "Ensure condition failed" in line or "Fatal error" in line or ("LogNYC" in line and ("Error" in line or "Warning" in line)):
            text = line.split("]", 2)[-1].strip()
            found.append("%s: %s" % (tool, text[:200]))
    return found


def difference(a, b):
    """Share of the picture that visibly changed between the two stills."""
    import numpy as np
    from PIL import Image
    x = np.asarray(Image.open(a).convert("RGB").resize((480, 270)), np.float32)
    y = np.asarray(Image.open(b).convert("RGB").resize((480, 270)), np.float32)
    return float((np.abs(x - y).max(axis=2) > 18).mean())


def sheet(ids, rows):
    from PIL import Image, ImageDraw, ImageFont
    cw, ch, label, cols = 384, 216, 22, 4
    cells = []
    for n, i in enumerate(ids, 1):
        pair = [os.path.join(OUT, "%02d_%s_%s.png" % (n, i, k)) for k in ("before", "after")]
        if all(os.path.exists(p) for p in pair):
            cells.append((n, i, pair))
    if not cells:
        return None
    try:
        font = ImageFont.truetype("segoeui.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    nrows = (len(cells) + cols - 1) // cols
    img = Image.new("RGB", (cols * (cw * 2 + 8), nrows * (ch + label)), (14, 14, 16))
    d = ImageDraw.Draw(img)
    for k, (n, i, pair) in enumerate(cells):
        x, y = (k % cols) * (cw * 2 + 8), (k // cols) * (ch + label)
        for j, p in enumerate(pair):
            img.paste(Image.open(p).convert("RGB").resize((cw, ch), Image.LANCZOS), (x + j * cw, y + label))
        r = rows.get(i, {})
        text = "%02d  %s   [tier %s]   parts %s  fragments %s  panes %s  objects %s  vehicles %s  craters %s" % (
            n, r.get("name", i), r.get("tier", "?"), r.get("elements", "-"), r.get("pieces", "-"), r.get("windows", "-"),
            r.get("props", "-"), r.get("vehicles", "-"), r.get("craters", "-"))
        d.text((x + 4, y + 3), text, fill=(235, 235, 235), font=font)
        d.line([(x + cw, y + label), (x + cw, y + label + ch)], fill=(255, 200, 40), width=2)
    out = os.path.join(ROOT, "destruction_sheet.png")
    img.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--res", default="1920x1080")
    ap.add_argument("--timeout", type=int, default=2400)
    ap.add_argument("--sheet-only", action="store_true")
    a = ap.parse_args()
    ids = tool_ids()
    if len(ids) != len(set(ids)):
        sys.exit("the arsenal order table lists a tool twice")
    os.makedirs(OUT, exist_ok=True)
    wanted = [i for i in a.only.split(",") if i] or ids
    unknown = [i for i in wanted if i not in ids]
    if unknown:
        sys.exit("unknown tools: %s" % ", ".join(unknown))
    problems, crashed, started = [], [], time.time()
    if not a.sheet_only:
        # drop earlier results for the tools about to run
        for i in wanted:
            for p in glob.glob(os.path.join(OUT, "??_%s_*.png" % i)):
                os.remove(p)
        keep = {k: v for k, v in read_reports().items() if k not in wanted}
        for p in glob.glob(os.path.join(OUT, "audit_*.jsonl")):
            os.remove(p)
        if keep:
            with open(os.path.join(OUT, "audit_kept.jsonl"), "w") as fh:
                fh.write("".join(json.dumps(v) + "\n" for v in keep.values()))
        queue = list(wanted)
        run_no = 0
        while queue:
            batch, queue = queue[:a.batch], queue[a.batch:]
            run_no += 1
            ok, took, log = launch(batch, a.res, a.timeout, "%02d" % run_no)
            rows = read_reports()
            done = [i for i in batch if i in rows]
            print("run %d: %d of %d tools in %.0f s%s" % (run_no, len(done), len(batch), took, "" if ok else "  (game did not exit cleanly)"), flush=True)
            problems += log_problems(log)
            left = [i for i in batch if i not in rows]
            if left:
                crashed.append(left[0])
                print("  failed while running: %s" % left[0], flush=True)
                queue = left[1:] + queue
    rows = read_reports()
    results, failed = [], []
    for n, i in enumerate(ids, 1):
        r = rows.get(i)
        before, after = (os.path.join(OUT, "%02d_%s_%s.png" % (n, i, k)) for k in ("before", "after"))
        if r is None or not (os.path.exists(before) and os.path.exists(after)):
            if i in wanted or a.sheet_only:
                failed.append((i, "no result"))
            continue
        broke = r["elements"] + r["windows"] + r["props"] + r["vehicles"] + r["craters"] + r["pieces"]
        changed = difference(before, after)
        r.update(broken_total=broke, picture_changed=round(changed, 4), broke=broke > 0, visible=changed > 0.002)
        results.append(r)
        if broke == 0:
            failed.append((i, "nothing broke"))
        elif changed <= 0.002:
            failed.append((i, "the picture did not change"))
    out = sheet(ids, rows)
    with open(os.path.join(OUT, "audit.json"), "w") as fh:
        json.dump(dict(tools=len(ids), checked=len(results), passed=sum(1 for r in results if r["broke"] and r["visible"]),
                       failed=failed, crashed=crashed, log_problems=sorted(set(problems)), results=results), fh, indent=1)
    print("\n%d tools registered, %d checked, %d passed, %d failed, %.0f s" % (
        len(ids), len(results), sum(1 for r in results if r["broke"] and r["visible"]), len(failed), time.time() - started))
    for i, why in failed:
        print("  FAIL %-18s %s" % (i, why))
    if problems:
        print("log problems:")
        for p in sorted(set(problems))[:30]:
            print("  " + p)
    if out:
        print("sheet:", out)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
