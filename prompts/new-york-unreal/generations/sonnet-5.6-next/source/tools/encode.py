"""Frames + wav -> the delivery files, then the delivery checks.

  python source/tools/encode.py <render_dir> <audio.wav> <out.mp4> [--x out_x.mp4]

render_dir holds one folder of PNG frames per shot (S01, S02 ...).  The master is H.264 crf 16,
yuv420p, BT.709, +faststart with 320 kbit/s AAC; the _x version is 1080p at about 10 Mbit/s.
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COLOUR = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode:
        sys.exit(r.returncode)


def gather(render_dir, tag):
    """Hard links every frame into one numbered sequence (no copies)."""
    seq = os.path.join(ROOT, "build", "seq_" + tag)
    if os.path.isdir(seq):
        shutil.rmtree(seq)
    os.makedirs(seq)
    k = 0
    for d in sorted(glob.glob(os.path.join(render_dir, "S*"))):
        for f in sorted(glob.glob(os.path.join(d, "*.png"))):
            os.link(f, os.path.join(seq, "f_%06d.png" % k))
            k += 1
    return seq, k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("render_dir")
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--x", default="")
    a = ap.parse_args()
    seq, count = gather(os.path.abspath(a.render_dir), os.path.splitext(os.path.basename(a.out))[0])
    print("frames:", count, flush=True)
    pattern = os.path.join(seq, "f_%06d.png")
    master = os.path.abspath(a.out)
    run(["ffmpeg", "-v", "error", "-stats", "-y", "-framerate", "24", "-i", pattern, "-i", os.path.abspath(a.audio),
         "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p", "-c:v", "libx264", "-preset", "slow",
         "-crf", "16", *COLOUR, "-r", "24", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart",
         "-t", "%.6f" % (count / 24.0), master])
    if a.x:
        log = os.path.join(ROOT, "build", "x264_2pass")
        base = ["ffmpeg", "-v", "error", "-y", "-i", master, "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
                "-c:v", "libx264", "-preset", "slow", "-b:v", "10000k", "-maxrate", "14000k", "-bufsize", "20000k", *COLOUR,
                "-passlogfile", log]
        run(base + ["-pass", "1", "-an", "-f", "null", "NUL"])
        run(base + ["-pass", "2", "-c:a", "copy", "-movflags", "+faststart", os.path.abspath(a.x)])
    shutil.rmtree(seq)


if __name__ == "__main__":
    main()
