"""The delivery checks for a finished film: clean full decode, streams as specified, frame count and
durations that agree, loudness, true peak, no clipping, and the flash / flicker analysis.

  python source/tools/verify_delivery.py nyc_film.mp4 nyc_film_x.mp4 [--film] [--excuse a-b,...] [--cuts ...]
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "sound"))
import numpy as np     # noqa: E402
import synth as S      # noqa: E402


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-print_format", "json", "-show_streams", "-show_format", path],
                       capture_output=True, text=True)
    return json.loads(r.stdout)


def decoded_audio(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:a:0", "-f", "f32le", "-ar", "48000", "-ac", "2", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--film", action="store_true")
    ap.add_argument("--cuts", default="")
    ap.add_argument("--excuse", default="")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    out = {}
    ok = True
    for i, f in enumerate(a.files):
        info = probe(f)
        v = next(s for s in info["streams"] if s["codec_type"] == "video")
        au = next(s for s in info["streams"] if s["codec_type"] == "audio")
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "null", "-"], capture_output=True, text=True)
        samples = decoded_audio(f)
        lufs, tp = S.loudness(f)
        head = open(f, "rb").read(64 * 1024)
        faststart = head.find(b"moov") >= 0 and (head.find(b"mdat") < 0 or head.find(b"moov") < head.find(b"mdat"))
        frames = int(v["nb_read_frames"])
        row = dict(
            size_mb=round(os.path.getsize(f) / 1e6, 1),
            video="%s %sx%s %s %s fps" % (v["codec_name"], v["width"], v["height"], v["pix_fmt"], v["r_frame_rate"]),
            video_mbit=round(float(v.get("bit_rate", 0)) / 1e6, 2),
            audio="%s %s Hz %s ch %.0f kbit/s" % (au["codec_name"], au["sample_rate"], au["channels"], float(au.get("bit_rate", 0)) / 1000),
            frames=frames, video_seconds=round(float(v["duration"]), 3), audio_seconds=round(float(au["duration"]), 3),
            decode_errors=dec.stderr.strip()[:500], faststart=bool(faststart),
            lufs=lufs, true_peak_dbtp=tp, clipped_samples=int(np.sum(np.abs(samples) >= 0.999)))
        row["pass"] = (dec.returncode == 0 and not row["decode_errors"] and abs(row["video_seconds"] - frames / 24.0) < 0.05
                       and abs(row["video_seconds"] - row["audio_seconds"]) < 0.1 and abs(lufs + 14.0) <= 0.6 and tp <= -1.0
                       and row["clipped_samples"] == 0 and faststart)
        ok &= row["pass"]
        out[os.path.basename(f)] = row
        print(os.path.basename(f), json.dumps(row, indent=1))
    cmd = [sys.executable, os.path.join(HERE, "check_video.py"), a.files[0]]
    if a.film:
        cmd.append("--film")
    if a.cuts:
        cmd += ["--cuts", a.cuts]
    if a.excuse:
        cmd += ["--excuse", a.excuse]
    r = subprocess.run(cmd, capture_output=True, text=True)
    flash = json.loads(r.stdout)
    out["flash_and_flicker"] = flash
    print(r.stdout)
    ok &= flash["flash_limit_ok"]
    out["all_pass"] = bool(ok)
    print("ALL CHECKS PASS" if ok else "SOME CHECKS FAILED")
    if a.json:
        with open(a.json, "w") as fh:
            json.dump(out, fh, indent=1)


if __name__ == "__main__":
    main()
