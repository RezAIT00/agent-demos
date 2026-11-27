"""Soundtrack of film 1, built from the shot list, the weather curves, the lightning times and the
traffic log the renderer wrote (every vehicle's position relative to the camera, frame by frame).

  python source/sound/film1_audio.py [--out build/audio/film1.wav]
"""
import argparse
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "source", "film"))

import filmdata                       # noqa: E402
import synth as S                     # noqa: E402

SR = S.SR


def read_log(shot):
    path = os.path.join(ROOT, "NYC", "Saved", "NYCAudio_%02d.csv" % shot)
    cams, cars = [], {}
    if not os.path.exists(path):
        return cams, cars
    with open(path) as fh:
        cam = None
        for line in fh:
            p = line.strip().split(",")
            if p[0] == "C":
                cam = (float(p[1]), float(p[2]) / 100, float(p[3]) / 100, float(p[4]) / 100, float(p[5]), float(p[6]))
                cams.append(cam)
            elif p[0] == "V" and cam is not None:
                t, key, kind = float(p[1]), int(p[2]), int(p[3])
                x, y, speed, brake = float(p[4]) / 100, float(p[5]) / 100, float(p[6]) / 100, int(p[7])
                dx, dy, dz = x - cam[1], y - cam[2], 1.0 - cam[3]
                dist = math.sqrt(dx * dx + dy * dy + dz * dz)
                bearing = math.atan2(dy, dx) - math.radians(cam[4])
                cars.setdefault((key, kind), []).append((t, dist, math.sin(bearing) * 0.85, speed, brake))
    return cams, cars


def traffic(shot, n, rng, wet, snow, reach=95.0, gain=1.0):
    cams, cars = read_log(shot.id)
    bus = np.zeros((n, 2))
    chosen = sorted(cars.items(), key=lambda kv: min(r[1] for r in kv[1]))[:26]
    for (key, kind), rows in chosen:
        rows.sort()
        if min(r[1] for r in rows) > reach or len(rows) < 6:
            continue
        a = np.array(rows)
        times = a[:, 0]
        keep = np.concatenate([[True], np.diff(times) > 1e-4])
        a, times = a[keep], times[keep]
        bus += S.vehicle_track(rng, n, times, a[:, 1], a[:, 2], a[:, 3], kind, a[:, 4], wet, snow) * gain
        # brakes: a squeal for a car stopping close by, air for a bus or truck
        stopping = np.where((a[:-1, 3] > 1.2) & (a[1:, 3] <= 1.2) & (a[1:, 1] < 40))[0]
        if len(stopping):
            i = stopping[0]
            level = min(1.0, 9.0 / a[i, 1])
            if kind >= 4:
                S.place(bus, S.pan(S.air_brake(rng), a[i, 2]), times[i] + 0.1, level * 0.8)
            else:
                S.place(bus, S.pan(S.brake_squeal(rng, 0.55), a[i, 2]), times[i] - 0.5, level * 0.6)
    return bus


def curve(shot, n, key, default=0.0):
    ts = np.linspace(0, 1, 64)
    vals = [shot.weather(t).get(key, default) for t in ts]
    return np.interp(np.arange(n) / SR / shot.seconds, ts, vals)


def horns(bus, rng, entries, rt60=1.8):
    """entries: (time, pan, distance gain, kind, [durations])"""
    for at, p, g, kind, durs in entries:
        t = at
        for d in durs:
            h = S.horn(rng, d, kind)
            far = 1.0 - min(g / 0.5, 1.0)
            if far > 0.2:
                h = S.lp(h, 4200 - 3000 * far)
            S.place(bus, S.reverb(S.pan(h, p), rt60, 0.28 + 0.3 * far), t, g)
            t += d + 0.09


def shot_audio(shot, seed):
    """Everything heard during one shot, except thunder.  Returns a stereo array a little longer than the shot."""
    rng = S.rng_for(1000 + seed)
    n = S.secs(shot.seconds + 0.35)
    bus = np.zeros((n, 2))
    rain_c = curve(shot, n, "Rain")
    wet = float(np.mean(curve(shot, n, "Wetness")))
    snow_cover = float(np.mean(curve(shot, n, "SnowCover")))
    wind_c = curve(shot, n, "Wind", 0.2)
    sid = shot.id

    def add(x, g=1.0):
        bus[:len(x)] += x[:n] * g

    if sid == 1:      # high over midtown: wind and the whole city far below
        add(S.wind(n, rng, 0.34, 0.35))
        add(S.lp(S.city_hum(n, rng, 800), 1100), 1.2)
        add(traffic(shot, n, rng, 0, 0, reach=700, gain=2.2))
        horns(bus, rng, [(1.3, -0.5, 0.10, 0, [0.3]), (3.9, 0.4, 0.07, 2, [0.5, 0.2])], 2.6)
        S.place(bus, S.reverb(S.pan(S.siren(rng, 5.0, 4.0), 0.35), 3.0, 0.5), 0.8, 0.14)
    elif sid == 2:    # Fifth Avenue toward the Empire State
        add(S.city_hum(n, rng, 1000), 1.1)
        add(S.distant_voices(n, rng), 0.55)
        add(traffic(shot, n, rng, 0, 0, gain=1.15))
        horns(bus, rng, [(1.1, -0.35, 0.28, 0, [0.16, 0.34]), (4.2, 0.6, 0.12, 1, [0.7])])
        add(S.wind(n, rng, 0.16))
    elif sid == 3:    # the lion
        add(S.city_hum(n, rng, 650), 0.75)
        add(traffic(shot, n, rng, 0, 0, gain=0.55))
        add(S.wind(n, rng, 0.2))
        S.place(bus, S.pan(S.coo(rng), -0.4), 0.7, 0.8)
        S.place(bus, S.pigeon_wings(rng), 2.6, 0.9)
        S.place(bus, S.pan(S.coo(rng), 0.55), 3.3, 0.45)
        horns(bus, rng, [(2.2, 0.7, 0.10, 2, [0.45])])
    elif sid == 4:    # 42nd Street east; a train passes underneath
        add(S.city_hum(n, rng, 950), 1.0)
        add(traffic(shot, n, rng, 0, 0, gain=1.15))
        S.place(bus, S.subway(rng, 4.6), 0.25, 0.68)
        add(S.distant_voices(n, rng), 0.3)
        horns(bus, rng, [(3.2, 0.25, 0.2, 3, [0.8])])
    elif sid == 5:    # rooftop at dusk, weather arriving
        ramp_up = np.linspace(0.3, 0.95, n)
        add(S.wind(n, rng, ramp_up, 0.55))
        add(S.lp(S.city_hum(n, rng, 600), 750), 0.75)
        fan = (S.tone(119.6, n) * 0.02 + S.tone(61.0, n) * 0.025 + S.bp(S.white(n, rng), 180, 700) * 0.02)
        add(S.pan(fan, -0.35), 1.0)
        add(traffic(shot, n, rng, 0, 0, reach=260, gain=1.6))
        S.place(bus, S.reverb(S.pan(S.siren(rng, 4.5, 3.6, 0.02), -0.6), 3.2, 0.55), 1.0, 0.1)
        S.place(bus, S.thunder(S.rng_for(71), 5200, 0.55, False), 4.9, 0.35)
    elif sid == 6:    # first rain on 42nd
        add(S.city_hum(n, rng, 900), 0.75)
        add(S.rain(n, rng, rain_c, 0.55), 0.95)
        add(S.drips(n, rng, 3.0, 0.14))
        add(traffic(shot, n, rng, 0.75, 0, gain=1.05))
        add(S.wind(n, rng, wind_c * 0.6))
        horns(bus, rng, [(2.9, -0.45, 0.2, 1, [0.22, 0.22])])
    elif sid == 7:    # the cab pulls up in the rain
        add(S.rain(n, rng, rain_c, 0.9), 1.0)
        add(S.city_hum(n, rng, 600), 0.5)
        add(S.drips(n, rng, 5.0, 0.2))
        add(traffic(shot, n, rng, 1.0, 0, gain=1.35))
        add(S.wind(n, rng, 0.18))
        for k in range(9):
            w = S.wiper(rng)
            lvl = min(1.0, max(0.0, (k - 2) / 4.0))
            S.place(bus, S.pan(w, 0.18), 0.35 + 0.78 * k, 0.55 * lvl)
        horns(bus, rng, [(5.7, 0.75, 0.09, 2, [0.5])], 2.2)
    elif sid == 8:    # the storm seen from above
        add(S.wind(n, rng, 0.52, 0.8))
        add(S.lp(S.rain(n, rng, rain_c, 0.12), 5200), 0.52)
        add(S.lp(S.city_hum(n, rng, 500), 600), 0.45)
    elif sid == 9:    # the flash on 42nd
        add(S.rain(n, rng, rain_c, 1.0), 0.78)
        add(S.drips(n, rng, 7.0, 0.18))
        add(traffic(shot, n, rng, 1.0, 0, gain=1.0))
        add(S.wind(n, rng, 0.25, 0.4))
        add(S.city_hum(n, rng, 500), 0.4)
        S.place(bus, S.reverb(S.pan(S.horn(rng, 0.7, 0), -0.25), 1.8, 0.35), 3.7, 0.34)
    elif sid == 10:   # storm behind the Chrysler Building
        add(S.wind(n, rng, 0.5, 0.7))
        add(S.rain(n, rng, rain_c, 0.5), 0.52)
        add(traffic(shot, n, rng, 1.0, 0, reach=200, gain=1.3))
        add(S.city_hum(n, rng, 500), 0.55)
    elif sid == 11:   # fog: everything goes soft
        add(S.lp(S.city_hum(n, rng, 380), 420), 1.0)
        add(S.drips(n, rng, 1.2, 0.1))
        add(S.lp(S.rain(n, rng, rain_c, 0.2), 3000), 0.5)
        add(S.wind(n, rng, 0.14, 0.2))
        S.place(bus, S.reverb(S.pan(S.ship_horn(rng, 2.2, 82.0), 0.55), 4.5, 0.75, damp=1000), 1.1, 0.17)
    elif sid == 12:   # snow at the rink
        add(S.lp(S.city_hum(n, rng, 420), 520), 0.9)
        add(S.lp(S.distant_voices(n, rng), 1500), 0.9)
        add(S.wind(n, rng, 0.18, 0.1), 0.7)
        t = 0.25
        while t < shot.seconds:
            S.place(bus, S.reverb(S.pan(S.skate(rng), rng.uniform(-0.8, 0.8)), 1.1, 0.35), t, rng.uniform(0.35, 1.0))
            t += rng.uniform(0.16, 0.5)
        add(traffic(shot, n, rng, 0.3, 1.0, gain=0.6))
    elif sid == 13:   # lions in the snow, before sunrise
        add(S.lp(S.city_hum(n, rng, 330), 420), 0.6)
        add(S.wind(n, rng, 0.16, 0.25), 0.65)
        add(S.lp(traffic(shot, n, rng, 0.2, 1.0, gain=0.55), 900))
        for k, at in enumerate((0.5, 1.08, 1.66, 2.26, 2.86, 3.5)):
            S.place(bus, S.pan(S.snow_step(rng), -0.75 + 0.11 * k), at, 0.75 - 0.07 * k)
        S.place(bus, S.pigeon_wings(rng), 2.9, 0.4)
    elif sid == 14:   # sunrise down 42nd
        add(S.city_hum(n, rng, 800), 0.85)
        add(traffic(shot, n, rng, 0.25, 1.0, gain=1.15))
        add(S.wind(n, rng, 0.22, 0.15))
        S.place(bus, S.subway(rng, 4.2), 2.4, 0.55)
        horns(bus, rng, [(1.5, 0.4, 0.16, 0, [0.26]), (5.3, -0.55, 0.1, 3, [0.65])])
        S.place(bus, S.pan(S.air_brake(rng), -0.5), 3.1, 0.3)
    elif sid == 15:   # morning over midtown
        add(S.wind(n, rng, 0.3, 0.25))
        add(S.lp(S.city_hum(n, rng, 900), 1200), 1.35)
        add(traffic(shot, n, rng, 0.3, 1.0, reach=800, gain=2.0))
        horns(bus, rng, [(1.6, 0.55, 0.07, 1, [0.4]), (4.4, -0.4, 0.05, 0, [0.2, 0.3])], 2.8)
        S.place(bus, S.reverb(S.pan(S.siren(rng, 4.2, 3.9, 0.025), -0.45), 3.2, 0.6), 2.0, 0.09)
    return bus


def strike_events():
    """(film time of the clap, distance m, power, pan) for every stroke of lightning in the film."""
    out = []
    for shot_id, t, to, frm, power, bolt in filmdata.STRIKES:
        if shot_id > len(filmdata.SHOTS):
            continue
        shot = filmdata.SHOTS[shot_id - 1]
        pos, rot = shot.camera(int(t * filmdata.FPS))
        a, b = np.array(frm, float), np.array(to, float)
        p = np.array(pos, float)
        u = np.clip(np.dot(p - a, b - a) / np.dot(b - a, b - a), 0, 1)
        near = a + (b - a) * u
        dist = float(np.linalg.norm(near - p))
        bearing = math.atan2(near[1] - p[1], near[0] - p[0]) - math.radians(rot[2])
        out.append((filmdata.shot_start(shot_id) + t + dist / 343.0, dist, power, math.sin(bearing) * 0.6, shot_id))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "build", "audio", "film1.wav"))
    a = ap.parse_args()
    total = filmdata.total_frames() / filmdata.FPS
    n = S.secs(total)
    mix = np.zeros((n, 2))
    for shot in filmdata.SHOTS:
        x = shot_audio(shot, shot.id)
        x = S.fade(x, 0.07, 0.3)
        S.place(mix, x, filmdata.shot_start(shot.id) - (0.03 if shot.id > 1 else 0.0))
        i = S.secs(filmdata.shot_start(shot.id))
        seg = x[:S.secs(shot.seconds)]
        print("shot %2d %-24s rms %.3f" % (shot.id, shot.name, float(np.sqrt(np.mean(seg ** 2)))), flush=True)
    for k, (at, dist, power, p, shot_id) in enumerate(strike_events()):
        boom = S.thunder(S.rng_for(500 + k), dist, power, True)
        side = np.array([1.0 - max(p, 0) * 0.5, 1.0 + min(p, 0) * 0.5])
        level = 2.7 if dist < 600 else 1.9
        print("thunder at %.2f s, %.0f m away (stroke in shot %d)" % (at, dist, shot_id))
        S.place(mix, boom * side, at, level * min(1.2, 0.55 + 0.5 * power))
    mix = S.fade(mix, 0.35, 0.9)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    lufs, tp = S.master(a.out, mix)
    print("written %s  %.2f s  %.2f LUFS integrated, true peak %.2f dBTP" % (a.out, total, lufs, tp))


if __name__ == "__main__":
    main()
