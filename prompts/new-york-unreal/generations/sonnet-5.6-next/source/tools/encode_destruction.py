"""The destruction film: trims each shot's lead-in, joins the frames, encodes both delivery files with the
same settings as film 1 and prints the cut points for the checks.

  python source/tools/encode_destruction.py [renders/destruction] [build/audio/destruction_film.wav]
"""
import glob
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "film"))
from encode import COLOUR, ROOT, run  # noqa: E402
import destruction_data  # noqa: E402


def main():
    render = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "renders/destruction")
    audio = os.path.join(ROOT, sys.argv[2] if len(sys.argv) > 2 else "build/audio/destruction_film.wav")
    seq = os.path.join(ROOT, "build", "seq_destruction")
    if os.path.isdir(seq):
        shutil.rmtree(seq)
    os.makedirs(seq)
    k, cuts = 0, []
    for i, s in enumerate(destruction_data.SHOTS):
        frames = sorted(glob.glob(os.path.join(render, "D%02d" % (i + 1), "*.png")))
        if len(frames) < s.frames:
            sys.exit("%s has %d of %d frames" % (s.name, len(frames), s.frames))
        if k:
            cuts.append(k)
        for f in frames[s.head:s.frames]:
            os.link(f, os.path.join(seq, "f_%06d.png" % k))
            k += 1
    print("frames: %d (%.2f s)" % (k, k / 24.0))
    print("cuts:", ",".join(str(c) for c in cuts), flush=True)
    with open(os.path.join(ROOT, "logs", "destruction_cuts.txt"), "w") as f:
        f.write(",".join(str(c) for c in cuts))
    master = os.path.join(ROOT, "nyc_destruction.mp4")
    run(["ffmpeg", "-v", "error", "-stats", "-y", "-framerate", "24", "-i", os.path.join(seq, "f_%06d.png"), "-i", audio,
         "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p", "-c:v", "libx264", "-preset", "slow",
         "-crf", "16", *COLOUR, "-r", "24", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart",
         "-t", "%.6f" % (k / 24.0), master])
    log = os.path.join(ROOT, "build", "x264_2pass_d")
    base = ["ffmpeg", "-v", "error", "-y", "-i", master, "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-b:v", "10000k", "-maxrate", "14000k", "-bufsize", "20000k", *COLOUR,
            "-passlogfile", log]
    run(base + ["-pass", "1", "-an", "-f", "null", "NUL"])
    run(base + ["-pass", "2", "-c:a", "copy", "-movflags", "+faststart", os.path.join(ROOT, "nyc_destruction_x.mp4")])
    shutil.rmtree(seq)
    print("done")


if __name__ == "__main__":
    main()
