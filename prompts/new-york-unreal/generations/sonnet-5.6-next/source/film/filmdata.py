"""Film 1: "42nd Street, one day and one night".  Pure data, shared by the sequence builder (in
Unreal) and by the sound design (in the venv).  Positions in metres, +x uptown, +y east."""
import math

FPS = 24


def ease(t):
    return t * t * (3 - 2 * t)


def soft(t, k=0.35):
    """Mostly linear with gentle ends, like a drone or a dolly."""
    return t * (1 - k) + ease(t) * k


def lerp(a, b, t):
    return a + (b - a) * t


def vlerp(a, b, t):
    return tuple(lerp(x, y, t) for x, y in zip(a, b))


def ramp(t, a, b):
    return ease(min(max((t - a) / max(b - a, 1e-6), 0.0), 1.0))


def bez(p0, p1, p2, t):
    return vlerp(vlerp(p0, p1, t), vlerp(p1, p2, t), t)


def noise1(x, seed):
    i = math.floor(x)
    f = x - i

    def h(n):
        s = math.sin(n * 127.1 + seed * 311.7) * 43758.5453
        return (s - math.floor(s)) * 2 - 1

    return lerp(h(i), h(i + 1), ease(f))


def look(pos, target, roll=0.0):
    dx, dy, dz = (target[i] - pos[i] for i in range(3))
    return (roll, math.degrees(math.atan2(dz, math.hypot(dx, dy))), math.degrees(math.atan2(dy, dx)))


class Shot:
    def __init__(self, sid, name, seconds, focal, cam, weather, aperture=8.0, focus=None, handheld=0.0, sim_start=100.0,
                 heroes=(), clear=()):
        self.id, self.name, self.seconds, self.focal = sid, name, seconds, focal
        self.cam, self.weather = cam, weather      # cam(t) -> (pos, target); weather(t) -> dict
        self.aperture, self.focus, self.handheld, self.sim_start = aperture, focus, handheld, sim_start
        self.heroes, self.clear = list(heroes), list(clear)

    @property
    def frames(self):
        return int(round(self.seconds * FPS))

    def camera(self, frame):
        """(position, (roll, pitch, yaw)) at a frame, with the operator's small movements."""
        t = frame / max(self.frames - 1, 1)
        pos, target = self.cam(t)
        roll, pitch, yaw = look(pos, target)
        if self.handheld > 0:
            s = frame / FPS
            a = self.handheld
            seed = self.id * 13.0
            pos = (pos[0] + a * 0.012 * (noise1(s * 1.3, seed) + 0.4 * noise1(s * 4.1, seed + 1)),
                   pos[1] + a * 0.012 * (noise1(s * 1.1, seed + 2) + 0.4 * noise1(s * 3.7, seed + 3)),
                   pos[2] + a * 0.010 * (noise1(s * 1.7, seed + 4) + 0.5 * noise1(s * 3.9, seed + 5)))
            scale = a * min(1.0, 35.0 / self.focal)
            yaw += scale * (0.20 * noise1(s * 0.9, seed + 6) + 0.05 * noise1(s * 5.0, seed + 7))
            pitch += scale * (0.15 * noise1(s * 1.2, seed + 8) + 0.04 * noise1(s * 5.5, seed + 9))
            roll += scale * 0.16 * noise1(s * 0.8, seed + 10)
        return pos, (roll, pitch, yaw)


def W(**kw):
    return kw


def path(p0, p1, t0, t1, k=0.35, mid=None, tmid=None):
    def cam(t):
        u = soft(t, k)
        pos = bez(p0, mid, p1, u) if mid else vlerp(p0, p1, u)
        tgt = bez(t0, tmid, t1, u) if tmid else vlerp(t0, t1, u)
        return pos, tgt
    return cam


SNOWDAY = dict(SnowCover=1.0)

SHOTS = [
    Shot(1, "aerial_afternoon", 6.0, 27.0,
         path((330.0, -655.0, 338.0), (236.0, -486.0, 294.0), (-300.0, 20.0, 118.0), (-250.0, 130.0, 128.0), 0.25),
         lambda t: W(TimeOfDay=14.92 + 0.07 * t, CloudCover=0.3, ExposureBias=0.3, FogCutoffKm=80.0), sim_start=190.0),
    Shot(2, "fifth_to_empire", 5.5, 42.0,
         path((52.0, 6.4, 2.15), (45.0, 5.6, 2.25), (-650.0, -52.0, 150.0), (-690.0, -64.0, 176.0), 0.5),
         lambda t: W(TimeOfDay=15.40 + 0.03 * t, CloudCover=0.28, ExposureBias=-0.05, HazeScale=0.5), handheld=0.8, sim_start=280.0 + 9.0,
         clear=[(18.0, 80.0, -2.0, 13.0)]),
    Shot(3, "library_lion", 4.5, 55.0,
         path((-53.6, -4.8, 1.7), (-56.0, -9.6, 2.2), (-65.4, -25.2, 3.1), (-64.8, -24.6, 3.5), 0.6),
         lambda t: W(TimeOfDay=15.5 + 0.02 * t, CloudCover=0.3, ExposureBias=1.75), aperture=2.8, focus=(19.0, 23.0),
         handheld=0.7, sim_start=470.0),
    Shot(4, "east_to_chrysler", 5.0, 22.0,
         path((-7.6, 184.0, 2.1), (-6.9, 201.0, 2.3), (34.0, 462.0, 74.0), (42.0, 490.0, 122.0), 0.7),
         lambda t: W(TimeOfDay=16.05 + 0.06 * t, CloudCover=0.42, ExposureBias=0.5), handheld=0.6, sim_start=560.0 + 52.0,
         clear=[(-11.0, 11.0, 160.0, 215.0)]),
    Shot(5, "rooftop_dusk", 7.0, 24.0,
         path((-48.6, 66.4, 82.3), (-50.8, 65.6, 82.0), (-640.0, -78.0, 168.0), (-655.0, -66.0, 178.0), 0.3),
         lambda t: W(TimeOfDay=16.34 + 0.86 * ramp(t, 0.02, 0.98), CloudCover=0.5 + 0.48 * ramp(t, 0.05, 0.8),
                     Storm=0.38 * ramp(t, 0.3, 1.0), Wind=0.25 + 0.2 * t, ExposureBias=-0.42 + 0.72 * ramp(t, 0.0, 0.6)), sim_start=650.0),
    Shot(6, "rain_begins", 5.0, 28.0,
         path((14.4, 4.9, 1.75), (12.6, 4.2, 1.7), (-44.0, -24.0, 4.2), (-40.0, -28.0, 4.6), 0.5),
         lambda t: W(TimeOfDay=17.12 + 0.12 * t, CloudCover=1.0, Storm=0.36 + 0.08 * t, Rain=0.68 * ramp(t, 0.02, 0.55),
                     Wetness=0.92 * ramp(t, 0.08, 0.95), Puddles=0.5 * ramp(t, 0.35, 1.0), Wind=0.4), handheld=0.9, sim_start=830.0 + 4.0),
    Shot(7, "cab_in_the_rain", 7.0, 40.0,
         path((6.2, -0.75, 0.82), (7.1, -0.95, 0.9), (30.0, -4.0, 1.25), (28.0, -4.1, 1.35), 0.6),
         lambda t: W(TimeOfDay=20.0 + 0.02 * t, CloudCover=1.0, Storm=0.55, Rain=0.82, Wetness=1.0, Puddles=0.8, Wind=0.35,
                     NearRain=1.0, ExposureBias=-0.65), aperture=2.0, focus=(14.0, 11.2), handheld=0.55, sim_start=900.0 + 56.0,
         heroes=[("cab0", (0.84, 0.47, 0.004), [(0.0, 52.0, -3.6, 180.0), (1.0, 41.0, -3.6, 180.0), (2.2, 29.5, -3.6, 180.0), (3.3, 21.4, -3.6, 180.0),
                                                (4.3, 18.75, -3.6, 180.0), (7.4, 18.7, -3.6, 180.0)]),
                 ("suv0", (0.06, 0.063, 0.068), [(0.0, 74.0, 0.0, 180.0), (2.5, 47.0, 0.0, 180.0), (4.5, 31.0, 0.0, 180.0), (6.0, 24.6, 0.0, 180.0), (7.4, 23.9, 0.0, 180.0)])],
         clear=[(-60.0, 140.0, -12.0, 12.0), (-11.0, 11.0, -90.0, 90.0)]),
    Shot(8, "lightning_on_empire", 6.0, 29.0,
         path((70.0, -228.0, 228.0), (40.0, -204.0, 222.0), (-690.0, -92.0, 390.0), (-690.0, -86.0, 398.0), 0.3),
         lambda t: W(TimeOfDay=20.9 + 0.02 * t, CloudCover=1.0, Storm=1.0, Rain=1.0, Wetness=1.0, Puddles=0.9, Wind=0.8, NearRain=0.5),
         sim_start=1000.0),
    Shot(9, "flash_on_42nd", 6.0, 32.0,
         path((12.7, 27.4, 1.05), (12.5, 25.6, 1.12), (0.4, 6.0, 2.1), (0.0, -2.0, 2.4), 0.4),
         lambda t: W(TimeOfDay=21.05 + 0.02 * t, CloudCover=1.0, Storm=0.95, Rain=1.0, Wetness=1.0, Puddles=0.9, Wind=0.7, NearRain=1.0),
         aperture=2.4, focus=(9.0, 8.0), handheld=1.1, sim_start=1100.0 + 55.0,
         heroes=[("cab1", (0.84, 0.47, 0.004), [(0.0, 7.9, 63.0, -90.0), (6.5, 7.9, -14.0, -90.0)]),
                 ("suv1", (0.006, 0.006, 0.007), [(0.0, 4.6, 98.0, -90.0), (6.5, 4.6, 30.0, -90.0)])],
         clear=[(-12.0, 12.0, -80.0, 120.0), (-60.0, 60.0, -13.0, 13.0)]),
    Shot(10, "storm_behind_chrysler", 5.0, 24.0,
         path((-9.5, 172.0, 44.0), (-8.2, 190.0, 50.0), (34.0, 462.0, 150.0), (42.0, 490.0, 172.0), 0.35),
         lambda t: W(TimeOfDay=21.3 + 0.02 * t, CloudCover=1.0, Storm=0.92, Rain=0.85, Wetness=1.0, Puddles=0.8, Wind=0.95, NearRain=0.6,
                     ExposureBias=0.1), handheld=0.8, sim_start=1200.0),
    Shot(11, "fog_takes_the_towers", 5.5, 27.0,
         path((268.0, -520.0, 262.0), (224.0, -446.0, 250.0), (-260.0, 70.0, 150.0), (-250.0, 90.0, 170.0), 0.25),
         lambda t: W(TimeOfDay=23.35 + 0.05 * t, CloudCover=0.72, Fog=0.82 + 0.18 * ramp(t, 0.0, 0.8), Rain=0.12 * (1 - ramp(t, 0.0, 0.4)),
                     Wetness=0.9, Puddles=0.55, FogCeiling=252.0 - 78.0 * ramp(t, 0.05, 0.95), Wind=0.22), sim_start=1300.0),
    Shot(12, "snow_on_bryant_park", 6.0, 27.0,
         path((-93.5, -284.0, 5.4), (-90.0, -267.0, 4.1), (-86.0, -150.0, 8.0), (-85.0, -150.0, 11.0), 0.4),
         lambda t: W(TimeOfDay=1.1 + 0.05 * t, CloudCover=0.95, Storm=0.08, Snow=0.95, SnowCover=0.3 + 0.35 * t, Fog=0.1, Wetness=0.5,
                     Puddles=0.2, Wind=0.28, ExposureBias=0.45), handheld=0.4, sim_start=1400.0),
    Shot(13, "lions_in_snow", 4.5, 58.0,
         path((-55.0, -9.0, 5.3), (-57.3, -12.7, 4.75), (-63.9, -23.6, 2.85), (-63.6, -23.4, 3.0), 0.6),
         lambda t: W(TimeOfDay=7.18 + 0.03 * t, CloudCover=0.88, Snow=0.24 * (1 - 0.45 * t), SnowCover=1.0, Wetness=0.1, ExposureBias=1.45),
         aperture=2.8, focus=(20.0, 22.5), handheld=0.6, sim_start=1500.0),
    Shot(14, "sunrise_down_42nd", 7.0, 70.0,
         path((2.3, -356.0, 5.4), (2.1, -342.0, 5.2), (-2.4, 392.0, 20.0), (-2.6, 392.0, 25.0), 0.35),
         lambda t: W(TimeOfDay=7.385 + 0.1 * t, CloudCover=0.13, SnowCover=1.0, Wetness=0.18, Puddles=0.05, ExposureBias=-0.1),
         handheld=0.25, sim_start=1600.0 + 52.0, clear=[(-11.0, 11.0, -372.0, -322.0)]),
    Shot(15, "morning_over_midtown", 6.5, 26.0,
         path((420.0, -560.0, 405.0), (700.0, -800.0, 580.0), (-230.0, 60.0, 130.0), (-660.0, 90.0, 80.0), 0.55, mid=(545.0, -665.0, 490.0)),
         lambda t: W(TimeOfDay=8.0 + 0.12 * t, CloudCover=0.2, SnowCover=1.0, Wetness=0.35, Puddles=0.18, FogCutoffKm=80.0), sim_start=1700.0),
]


# Each strike is two flashes inside a third of a second; strikes in one shot are never closer than
# 1.4 s, so no one-second window can hold more than two flashes.  (shot, seconds, to, from, power, visible bolt)
ESB_TIP = (-691.5, -80.0, 443.0)
STRIKES = [
    # shot 8: the aerial storm, onto the Empire State's mast, then inside the cloud
    (8, 1.30, ESB_TIP, (-560.0, -330.0, 1150.0), 1.25, True),
    (8, 3.95, (-900.0, 420.0, 150.0), (-760.0, 330.0, 1100.0), 0.6, False),
    # shot 9: the close street flash (cloud lightning, no channel in frame)
    (9, 2.10, (60.0, -260.0, 120.0), (-40.0, -420.0, 900.0), 1.1, False),
    (9, 4.60, (240.0, 160.0, 200.0), (260.0, 120.0, 900.0), 0.8, False),
    # shot 10: a channel behind the Chrysler Building
    (10, 1.05, (170.0, 600.0, 120.0), (60.0, 520.0, 900.0), 1.0, True),
    (10, 3.40, (-20.0, 640.0, 150.0), (120.0, 760.0, 950.0), 0.7, True),
]


def total_frames():
    return sum(s.frames for s in SHOTS)


def shot_start(sid):
    """Time in seconds at which a shot begins in the cut film."""
    t = 0.0
    for s in SHOTS:
        if s.id == sid:
            return t
        t += s.seconds
    raise KeyError(sid)
