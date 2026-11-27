"""The destruction film's soundtrack.  The final render logs every sound the destruction system asked for
(time, place, loudness, pitch) and where the camera was on each frame; this places the synthesized sound for
each one in stereo, as heard from the camera: quieter and duller with distance, panned by direction and,
for the far ones, arriving late.

  venv\\Scripts\\python.exe source\\sound\\destruction_audio.py [--out build/audio/destruction_film.wav]
"""
import argparse
import math
import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "film"))
from synth import SR, bp, city_hum, fade, hp, lp, master, rng_for, secs, wind  # noqa: E402
import destruction_data  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
SOUNDS = os.path.join(ROOT, "build", "audio", "destruction")
SAVED = os.path.join(ROOT, "NYC", "Saved")

# how much of the mix each family may take
TRIM = {"pop": 0.55, "tick_glass": 0.45, "glass": 0.42, "crack_charge": 0.75, "fire": 0.35, "blast_small": 0.6, "blast_med": 0.85,
        "crunch": 0.6, "dust_surge": 0.75, "thock": 0.5}
# the loudest events of each shot keep a little extra
BIG = {"nuke", "nuke_big", "asteroid_impact", "asteroid_incoming", "meteor_huge", "meteor_impact", "kinetic_impact", "tornado",
       "blackhole_pop", "boot_stomp"}

_cache = {}


def sound(name):
    if name not in _cache:
        path = os.path.join(SOUNDS, name + ".wav")
        if not os.path.exists(path):
            _cache[name] = None
        else:
            sr, x = wavfile.read(path)
            x = x.astype(np.float64) / 32768.0
            if x.ndim > 1:
                x = x.mean(axis=1)
            _cache[name] = x
    return _cache[name]


def read_log(name):
    events, camera = [], []
    path = os.path.join(SAVED, "NYCDestructionAudio_%s.csv" % name)
    for line in open(path, encoding="utf-8-sig"):
        p = line.strip().split(",")
        if p[0] == "S":
            events.append((float(p[1]), p[2], np.array([float(p[3]), float(p[4]), float(p[5])]) / 100.0, float(p[6]), float(p[7])))
        elif p[0] == "C":
            camera.append((float(p[1]), np.array([float(p[2]), float(p[3]), float(p[4])]) / 100.0, float(p[5]), float(p[6])))
    return events, camera


def camera_at(camera, t):
    if not camera:
        return np.zeros(3), 0.0
    lo, hi = 0, len(camera) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if camera[mid][0] < t:
            lo = mid + 1
        else:
            hi = mid
    return camera[lo][1], camera[lo][2]


def resample(x, pitch):
    if abs(pitch - 1.0) < 0.015:
        return x
    n = int(len(x) / pitch)
    return np.interp(np.arange(n) * pitch, np.arange(len(x)), x)


def mix_shot(shot, log):
    """One shot on its own bus, from the first rendered frame (the trimmed head included)."""
    events, camera = log
    seconds = shot.seconds
    bus = np.zeros((secs(seconds + 6.0), 2))
    scheduled = []
    for t, name, pos, volume, pitch in events:
        eye, yaw = camera_at(camera, t)
        offset = pos - eye
        dist = float(np.linalg.norm(offset))
        near = 24.0 + 70.0 * min(volume, 2.0)
        if name in BIG:
            near *= 5.0
        gain = min(volume, 2.0) * TRIM.get(name, 1.0) * min(1.0, max(near / max(dist, near), 0.07) ** 0.85)
        # sound is slow: the far ones arrive after what the eye saw (shortened so that the cut keeps them)
        delay = min(dist / 343.0, 1.6) * (0.75 if dist > 60.0 else 0.2)
        angle = math.atan2(offset[1], offset[0]) - math.radians(yaw)
        pan = max(-1.0, min(1.0, math.sin(angle))) * min(1.0, 0.35 + dist / 90.0) * 0.8
        scheduled.append((t + delay, name, gain, pan, pitch, dist))
    # thousands of panes and charges become a handful of voices: the loudest of each kind in every tenth of a second
    scheduled.sort(key=lambda e: -e[2])
    taken, voices = {}, []
    for e in scheduled:
        slot = (e[1], int(e[0] / (0.09 if e[1] not in ("glass", "fire", "blast_med", "blast_small", "crunch") else 0.17)))
        if slot in taken:
            continue
        taken[slot] = True
        voices.append(e)
    counts = {}
    limit = {"fire": 14, "glass": 40, "blast_small": 22, "blast_med": 26, "dust_surge": 10, "crunch": 18}
    for t, name, gain, pan, pitch, dist in voices:
        counts[name] = counts.get(name, 0) + 1
        if counts[name] > limit.get(name, 60):
            continue
        x = sound(name)
        if x is None:
            print("  missing sound", name)
            continue
        x = resample(x, pitch)
        if dist > 90.0:
            x = lp(x, max(700.0, 15000.0 / (1.0 + dist / 160.0)))
        a = (pan + 1.0) * math.pi / 4.0
        stereo = np.stack([x * math.cos(a), x * math.sin(a)], axis=1)
        # a few samples between the ears for width
        d = int(abs(pan) * 0.00055 * SR)
        if d:
            side = 0 if pan > 0 else 1
            stereo[d:, side] = stereo[:-d, side].copy()
            stereo[:d, side] = 0.0
        i = secs(max(t, 0.0))
        m = min(len(stereo), len(bus) - i)
        if m > 0:
            bus[i:i + m] += stereo[:m] * gain
    return bus, len(voices)


def bed(shot, index):
    """The city under the shot: traffic hum by day, a gale in the storm, high thin air above the roofs."""
    n = secs(shot.seconds + 6.0)
    r = rng_for(900 + index)
    weather = shot.weather(0.0)
    height = shot.cam(0.0)[0][2]
    storm = weather.get("Storm", 0.0)
    out = np.zeros((n, 2))
    hum = city_hum(n, r, 700.0)
    out += hum * (0.55 if height < 40 else 0.35 if height < 400 else 0.14)
    if storm > 0.3:
        out += wind(n, r, 0.8, 0.5) * 0.5
        rain = bp(r.standard_normal((n, 2)), 1500, 9000) * 0.018
        out += rain
    elif height > 100:
        out += wind(n, r, 0.45, 0.2) * min(0.5, height / 1600.0)
    return out


def build():
    shots = destruction_data.SHOTS
    total = sum(s.shown for s in shots) / 24.0
    film = np.zeros((secs(total), 2))
    at = 0.0
    for index, s in enumerate(shots):
        shown = s.shown / 24.0
        bus, voices = mix_shot(s, read_log(s.name))
        bus += bed(s, index)
        head = secs(s.head / 24.0)
        # the cut: what is still ringing falls away over a short tail into the next shot
        tail = secs(0.45 if index < len(shots) - 1 else 0.0)
        piece = bus[head:head + secs(shown) + tail].copy()
        piece = fade(piece, 0.012, 0.45 if tail else 1.6)
        i = secs(at)
        m = min(len(piece), len(film) - i)
        film[i:i + m] += piece[:m]
        print("  %-16s at %6.2f s  %4d voices  peak %.2f" % (s.name, at, voices, float(np.max(np.abs(piece)))))
        at += shown
    # gentle glue: quiet shots stay present, the huge ones do not flatten everything else
    env = np.sqrt(signal.fftconvolve(np.mean(film ** 2, axis=1), np.ones(secs(0.4)) / secs(0.4), mode="same").clip(0))
    ref = np.percentile(env, 70) + 1e-6
    comp = np.minimum(1.0, (ref * 2.2 / np.maximum(env, ref * 2.2)) ** 0.45)
    smooth = np.convolve(comp, np.ones(secs(0.03)) / secs(0.03), mode="same")
    film *= smooth[:, None]
    film = np.tanh(film * 0.9) / 0.9
    return fade(film, 0.05, 1.4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "build", "audio", "destruction_film.wav"))
    a = ap.parse_args()
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    x = build()
    i, tp = master(a.out, x, -14.0, -1.2)
    print("soundtrack %.2f s: %.1f LUFS, true peak %.1f dBTP -> %s" % (len(x) / SR, i, tp, a.out))


if __name__ == "__main__":
    main()
