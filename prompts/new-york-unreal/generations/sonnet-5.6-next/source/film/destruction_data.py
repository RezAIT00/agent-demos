"""The destruction film: smallest to biggest.  Pure data, shared by the sequence builder (in Unreal), the
showrunner's shot list and the sound mix (in the venv).  Positions in metres, +x uptown, +y east.

The stage is the avenue beside the white-brick block whose front stands at x = -15.1, y = 44..77."""
from filmdata import FPS, ease, look, noise1, soft, vlerp  # noqa: F401  (look is re-exported)


class Shot:
    def __init__(self, name, seconds, focal, cam, weather, events, aperture=8.0, focus=None, sim_start=300.0, title="", trim=0.0):
        self.name, self.seconds, self.focal = name, seconds, focal
        self.cam, self.weather, self.events = cam, weather, events      # events: (t, tool, from, at)
        self.aperture, self.focus, self.sim_start, self.title = aperture, focus, sim_start, title
        self.trim = trim      # seconds rendered (the physics needs them) but cut from the head of the shot

    @property
    def frames(self):
        return int(round(self.seconds * FPS))

    @property
    def head(self):
        return int(round(self.trim * FPS))

    @property
    def shown(self):
        return self.frames - self.head


def move(p0, p1, q0, q1=None, k=0.5, drift=0.012):
    """A dolly from p0 to p1 looking from q0 to q1, with a breath of operator drift."""
    q1 = q1 or q0

    def cam(t):
        u = soft(t, k)
        pos = vlerp(p0, p1, u)
        tgt = vlerp(q0, q1, u)
        wob = (noise1(t * 3.1, 3) * drift, noise1(t * 2.6, 7) * drift, noise1(t * 3.7, 11) * drift)
        return tuple(a + b for a, b in zip(pos, wob)), tgt

    return cam


def held(cam, amount, seconds, seed):
    """A person holding the camera: a slow float of the body and a finer tremor of the hands."""
    def out(t):
        pos, tgt = cam(t)
        s = t * seconds
        pos = tuple(p + amount * 0.011 * (noise1(s * (1.1 + 0.3 * i), seed + i) + 0.45 * noise1(s * (3.6 + 0.4 * i), seed + 20 + i))
                    for i, p in enumerate(pos))
        dist = max(sum((b - a) ** 2 for a, b in zip(pos, tgt)) ** 0.5, 1.0)
        turn = dist * amount * 0.0034
        tgt = tuple(q + turn * k * (noise1(s * (0.9 + 0.2 * i), seed + 40 + i) + 0.25 * noise1(s * (4.9 + 0.5 * i), seed + 60 + i))
                    for i, (q, k) in enumerate(zip(tgt, (1.0, 1.0, 0.72))))
        return pos, tgt

    return out


def chase(p0, p1, q0, q1, t0, t1, k=0.35):
    """A drifting camera whose aim swings from q0 to q1 between shot fractions t0 and t1."""
    def cam(t):
        pos = vlerp(p0, p1, soft(t, k))
        u = min(max((t - t0) / (t1 - t0), 0.0), 1.0)
        return pos, vlerp(q0, q1, ease(u))

    return cam


def W(**kw):
    def weather(t):
        return {k: (v(t) if callable(v) else v) for k, v in kw.items()}

    return weather


FRONT = -15.12
AIM = (0.0, 72.0, 0.0)                   # the middle of the avenue, where the big things land


def clear_day(exposure, hour=13.85, cloud=0.32, **extra):
    base = dict(TimeOfDay=hour, CloudCover=cloud, Wind=0.25, ExposureBias=exposure)
    base.update(extra)
    return W(**base)


SHOTS = [
    # 1  the smallest bang
    Shot("firecracker", 3.0, 42.0,
         move((9.35, 49.95, 0.78), (9.6, 50.17, 0.7), (11.35, 51.65, 0.2)),
         clear_day(3.0, hour=8.4),
         [(0.12, "firecracker", (10.2, 50.65, 1.55), (11.2, 51.52, 0.08))], aperture=2.8, focus=2.55),
    # 2  a hand tool against brick
    Shot("sledgehammer", 3.6, 24.0,
         move((-8.55, 66.5, 2.45), (-9.3, 65.75, 2.35), (FRONT, 60.5, 3.35), (FRONT, 60.6, 3.0)),
         clear_day(1.95, hour=8.44),
         [(0.08, "sledgehammer", (-13.3, 61.8, 1.7), (FRONT, 60.67, 2.25))], aperture=5.6, focus=6.4, trim=0.5),
    # 3  a grenade at a storefront
    Shot("grenade", 4.0, 28.0,
         move((-5.6, 69.4, 2.35), (-6.5, 68.7, 2.2), (-14.8, 59.6, 2.2)),
         clear_day(1.55, hour=8.46),
         [(0.15, "grenade", (-7.0, 66.0, 1.7), (FRONT, 57.9, 2.0))], trim=0.6),
    # 4  twenty tonnes with no brakes
    Shot("garbage_truck", 5.0, 30.0,
         move((3.9, 44.5, 3.1), (2.6, 46.4, 2.6), (-8.0, 70.0, 2.6), (-14.0, 61.0, 2.8)),
         clear_day(1.45, hour=8.5),
         [(0.05, "garbage_truck", (-6.0, 92.0, 4.0), (FRONT, 60.67, 2.0))], trim=0.6),
    # 5  the wrecking ball
    Shot("wrecking_ball", 5.6, 33.0,
         move((11.8, 95.0, 12.0), (9.4, 90.0, 13.4), (-14.5, 63.0, 19.0), (-15.0, 61.5, 20.0)),
         clear_day(0.95, hour=8.55),
         [(0.05, "wrecking_ball", (13.1, 99.5, 14.0), (FRONT, 60.67, 21.3))], trim=0.4),
    # 6  the street's own gas
    Shot("gas_main", 4.4, 26.0,
         move((7.6, 20.0, 9.5), (6.4, 23.5, 8.2), (-1.0, 62.0, 2.0), (-1.0, 66.0, 3.5)),
         clear_day(1.15, hour=8.6),
         [(0.1, "gas_main", (3.0, 22.0, 8.0), (0.0, 60.0, 0.0))]),
    # 7  a controlled implosion, and the dust that comes down the avenue afterwards
    Shot("implosion", 11.2, 28.0,
         move((11.2, 128.0, 19.5), (9.6, 119.0, 13.5), (-17.0, 62.0, 15.0), (-12.0, 72.0, 7.0), 0.35),
         clear_day(1.05, hour=8.63),
         [(0.2, "implosion", (12.5, 122.8, 21.6), (FRONT, 60.67, 4.2))], trim=2.2),
    # 8  an absurd interlude: the ball comes straight at the lens
    Shot("bowling_ball", 4.2, 30.0,
         move((5.6, 79.0, 3.4), (6.6, 80.5, 3.1), (-0.5, 46.0, 3.6), (-0.4, 68.0, 3.8)),
         clear_day(1.3, hour=8.68),
         [(0.0, "bowling_ball", (0.0, 20.0, 6.0), AIM)]),
    # 9  tornado
    Shot("tornado", 6.6, 24.0,
         move((5.4, 158.0, 13.0), (4.2, 150.0, 11.0), (0.0, 80.0, 24.0), (0.0, 92.0, 21.0)),
         W(TimeOfDay=14.6, CloudCover=0.97, Storm=0.75, Rain=0.12, Wind=0.9, ExposureBias=1.5, Wetness=0.5),
         [(0.0, "tornado", (0.0, -4.0, 28.0), AIM)]),
    # 10  the saucer, at dusk
    Shot("death_ray", 5.6, 24.0,
         move((7.0, -8.0, 27.0), (5.0, -1.0, 24.0), (0.0, 74.0, 24.0), (0.0, 76.0, 20.0)),
         W(TimeOfDay=17.25, CloudCover=0.4, Wind=0.2, ExposureBias=1.75),
         [(0.0, "ufo_death_ray", (6.0, -8.0, 30.0), AIM)], trim=0.6),
    # 11  pocket black hole
    Shot("black_hole", 6.2, 28.0,
         move((8.2, 4.0, 22.0), (6.6, 10.0, 20.0), (0.0, 72.0, 14.0)),
         W(TimeOfDay=17.4, CloudCover=0.62, Wind=0.4, ExposureBias=1.7),
         [(0.0, "black_hole", (4.0, -2.0, 26.0), AIM)]),
    # 12  a meteor
    Shot("meteor", 8.4, 28.0,
         chase((-392.0, 8.0, 352.0), (-350.0, 30.0, 326.0), (150.0, 150.0, 292.0), (6.0, 82.0, 35.0), 0.17, 0.50),
         clear_day(1.15, hour=17.45, cloud=0.28, FogCutoffKm=80.0),
         [(0.0, "meteor_large", (-370.0, 20.0, 340.0), AIM)], trim=0.8),
    # 13  tactical warhead
    Shot("tactical_nuke", 10.0, 28.0,
         move((-905.0, 22.0, 492.0), (-852.0, 42.0, 472.0), (0.0, 72.0, 105.0), (0.0, 72.0, 168.0), 0.4, 0.05),
         clear_day(0.75, hour=17.55, cloud=0.22, FogCutoffKm=80.0),
         [(0.0, "tactical_nuke", (-880.0, 30.0, 482.0), AIM)], trim=1.2),
    # 14  the end of it
    Shot("asteroid", 12.8, 28.0,
         move((60.0, -2850.0, 880.0), (-40.0, -3050.0, 1020.0), (200.0, 150.0, 330.0), (0.0, 100.0, 300.0), 0.4, 0.2),
         W(TimeOfDay=17.6, CloudCover=0.2, Wind=0.3, ExposureBias=0.3, HazeScale=0.45, FogCutoffKm=80.0),
         [(0.0, "asteroid", (0.0, -2928.0, 950.0), AIM)]),
]


# the shots filmed from the street or a window are hand-held; the long aerial ones are not
HANDHELD = dict(firecracker=0.35, sledgehammer=0.75, grenade=0.85, garbage_truck=0.9, wrecking_ball=0.55,
                gas_main=0.5, implosion=0.35, bowling_ball=0.7, tornado=0.6, death_ray=0.25, black_hole=0.25)
for _i, _s in enumerate(SHOTS):
    if _s.name in HANDHELD:
        _s.cam = held(_s.cam, HANDHELD[_s.name], _s.seconds, 17.0 * _i + 5.0)
    if _s.name == "grenade":
        _s.aperture, _s.focus = 2.8, 14.5


def total_frames():
    return sum(s.shown for s in SHOTS)


if __name__ == "__main__":
    print(len(SHOTS), "shots,", total_frames(), "frames,", round(total_frames() / FPS, 1), "s")
