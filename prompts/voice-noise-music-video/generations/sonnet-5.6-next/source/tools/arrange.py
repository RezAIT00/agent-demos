""""Take On Me" (a-ha), performed by the user's own noises. Personal-use cover.

Writes out/song.wav (song only), out/soundtrack.wav (original recording, then the
song), out/stems/*.wav and out/events.json, which drives the animation.

Riff notes follow the open-source robsoncouto/arduino-songs transcription;
verse and chorus pitches follow noobnotes.net moved down one octave to singing
range. Note lengths are this arrangement's own.

The vocal line is "sung" syllable by syllable. The six noises cannot say words,
so every sung syllable is given the noise whose vowel is closest to it. The
vowel colours of the recording were measured (formants F1/F2, see VOWELS below).
No words are stored anywhere: the score holds only pitch, length and noise.
"""
import json
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, sosfilt
import sampler
import kit as drumkit

OUT = os.path.join(sampler.ROOT, "out")
STEMS = os.path.join(OUT, "stems")
os.makedirs(STEMS, exist_ok=True)

sr, voices = sampler.load_voices()
KIT = drumkit.make_kit()

BPM = 169.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
EIGHTH = BEAT / 2
SONG_BARS = 50
VERSE_AT, VERSE_BARS = 8, 8  # the sung verse is inserted after the first riff
TAIL = 2.2
SONG_LEN = SONG_BARS * BAR + TAIL
SONG_AT = 9.20  # where the song starts in the final soundtrack

SECTIONS = [("silence", 0, 4), ("riff_a", 4, 8), ("verse", 8, 16), ("riff_b", 16, 20),
            ("hush", 20, 24), ("chorus_1", 24, 28), ("chorus_2", 28, 32), ("chorus_3", 32, 36),
            ("chorus_4", 36, 40), ("finale", 40, 48), ("end", 48, 50)]
# Measured from the recording (median F1/F2 of each noise's steady part, Hz):
#   eee 260/2380 (ee)   ooo 310/890 (oo)   dum 640/1090 (uh/aw)
#   nyaa 720/1360 (a, with a "ny" start)   ahh 745/1250 (ah)   mmm = closed-mouth hum

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8,
        "A": 9, "A#": 10, "B": 11}


def midi(name):
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


_raw = False


def at(bar, beat=0.0):
    """Bars are numbered as in the first version; bars from VERSE_AT on are pushed
    back to make room for the verse. Set _raw to address the verse bars directly."""
    if not _raw and bar >= VERSE_AT:
        bar += VERSE_BARS
    return bar * BAR + beat * BEAT


N = int(SONG_LEN * sr)
stems = {k: np.zeros((N, 2)) for k in
         ["lead", "vocal", "echo", "pad", "bass", "arp", "kick", "snare", "hats", "cymbal"]}
events = []
cache = {}


def log(t, d, inst, role, m=None, vel=1.0, line=None, new=True):
    e = {"t": round(SONG_AT + t, 4), "d": round(d, 4), "i": inst, "r": role,
         "m": m, "v": round(vel, 3)}
    if line is not None:  # a sung syllable: which line it belongs to, and whether it starts one
        e["ln"] = line
        e["n"] = 1 if new else 0
    events.append(e)


def put(stem, y, t, gain=1.0, pan=0.0):
    """Mix mono `y` into a stereo stem at time t (equal-power pan)."""
    i = int(round(t * sr))
    n = min(len(y), N - i)
    if n <= 0:
        return
    a = (pan + 1) * np.pi / 4
    stems[stem][i:i + n, 0] += y[:n] * gain * np.cos(a)
    stems[stem][i:i + n, 1] += y[:n] * gain * np.sin(a)


def sing(stem, name, m, t, dur, gain=1.0, pan=0.0, role=None, detune=0.0, show=True,
         line=None, new=True, **kw):
    """Play one note on one noise, level-matched so mix gains mean something."""
    key = (name, m, round(dur, 4), detune, tuple(sorted(kw.items())))
    if key not in cache:
        y = voices[name].play(hz(m + detune / 100), dur, **kw)
        body = y[: int(dur * sr)]
        cache[key] = y * (0.2 / (np.sqrt(np.mean(body ** 2)) + 1e-9))
    put(stem, cache[key], t, gain, pan)
    if show:
        log(t, dur, name, role or stem, m, gain, line, new)


def hit(name, t, gain=1.0, pan=0.0, show=True):
    stem = {"kick": "kick", "snare": "snare", "hat": "hats", "openhat": "hats",
            "crash": "cymbal"}.get(name, "snare")
    put(stem, KIT[name], t, gain, pan)
    if show:
        log(t, 0.1, name, "drum", None, gain)


# ---------------------------------------------------------------- score
R = None
RIFF = ["F#5", "F#5", "D5", "B4", R, "B4", R, "E5",
        R, "E5", R, "E5", "G#5", "G#5", "A5", "B5",
        "A5", "A5", "A5", "E5", R, "D5", R, "F#5",
        R, "F#5", R, "F#5", "E5", "E5", "F#5", "E5"]
RIFF_CHORDS = [("B2", ["B3", "D4", "F#4"]), ("E2", ["B3", "E4", "G#4"]),
               ("A2", ["A3", "C#4", "E4"]), ("D2", ["A3", "D4", "F#4"])]
CHORUS_CHORDS = [("A2", ["A3", "C#4", "E4"]), ("G#2", ["G#3", "C#4", "E4"]),
                 ("F#2", ["A3", "C#4", "F#4"]), ("D2", ["A3", "D4", "F#4"])]

# (bar, beat, note, beats long) relative to the chorus start
CHORUS = [
    (0, 0, "A2", 4), (1, 0, "G#3", 4), (2, 0, "A3", 4),
    (4, 0, "A3", 4), (5, 0, "E4", 4), (6, 0, "F#4", 4),
    (8, 0, "C#4", 4), (9, 0, "G#4", 4), (10, 0, "A4", 7),
    (12, 0, "B4", 2), (12, 2, "C#5", 2), (13, 0, "B4", 2), (13, 2, "A4", 2),
    (14, 0, "E5", 8),
]
ECHO = [(0, 0, "E4", 1), (0, 1, "F#4", 1), (0, 2, "E4", 1.8)]


def riff(start_bar, gain=1.0, octave_double=True, harmony=False, show=True, stem="lead"):
    for k, name in enumerate(RIFF):
        if name is R:
            continue
        t = at(start_bar) + k * EIGHTH
        m = midi(name)
        accent = 1.0 if k % 2 == 0 else 0.86
        sing(stem, "nyaa", m, t, EIGHTH * 0.78, gain * 0.9 * accent, 0.06, "riff",
             formant=1.42, skip=0.20, release=0.035, show=show)
        if octave_double:
            sing(stem, "eee", m - 12, t, EIGHTH * 0.74, gain * 0.46 * accent, -0.28, "riff",
                 formant=1.22, skip=0.05, release=0.035, show=show)
        if harmony:
            sing(stem, "ooo", m, t, EIGHTH * 0.7, gain * 0.30 * accent, 0.42, "riff",
                 formant=1.35, skip=0.05, release=0.03, show=False, detune=7)


def pad(bar, chord, beats=4, gain=1.0, name="mmm"):
    for j, n in enumerate(chord):
        pan = (-0.65, 0.0, 0.65)[j]
        sing("pad", name, midi(n), at(bar), beats * BEAT * 0.97, 0.20 * gain, pan, "pad",
             release=0.16, vibrato_cents=7, vibrato_hz=4.4 + j * 0.5, show=(j == 0))
        sing("pad", "ooo", midi(n) + 12, at(bar), beats * BEAT * 0.97, 0.07 * gain, -pan, "pad",
             release=0.16, detune=9, formant=1.15, show=False)


def bassline(bar, root, pattern=(0, 0, 12, 0, 0, 0, 12, 0), gain=1.0):
    for k, step in enumerate(pattern):
        if step is None:
            continue
        sing("bass", "dum", midi(root) + step, at(bar) + k * EIGHTH, EIGHTH * 0.80,
             gain * (1.0 if k % 2 == 0 else 0.82), 0.0, "bass", release=0.03, skip=0.03)


def arp(bar, chord, gain=1.0, name="eee"):
    order = [0, 1, 2, 1]
    for k in range(16):
        m = midi(chord[order[k % 4]]) + (24 if k % 8 >= 4 else 12)
        sing("arp", name, m, at(bar) + k * BEAT / 4, BEAT / 4 * 0.5, 0.17 * gain,
             0.7 if k % 2 else -0.7, "arp", formant=1.3, skip=0.08, release=0.04,
             show=(k % 2 == 0))


def beat_rock(bar, gain=1.0, four=False, busy=False):
    kicks = [0, 1, 2, 3] if four else [0, 2, 2.5]
    for b in kicks:
        hit("kick", at(bar, b), 0.95 * gain)
    for b in (1, 3):
        hit("snare", at(bar, b), 0.72 * gain, 0.03)
    steps = 16 if busy else 8
    for k in range(steps):
        t = at(bar) + k * BAR / steps
        off = (k % 2 == 1)
        hit("hat", t, (0.18 if off else 0.30) * gain, 0.32, show=(k % 2 == 0))
    if four:
        hit("openhat", at(bar, 3.5), 0.22 * gain, -0.3)


def fill(bar, beats=2):
    names = ["tom_hi", "tom_hi", "tom_mid", "tom_mid", "tom_lo", "tom_lo", "snare", "snare"]
    count = int(beats * 4)
    for k in range(count):
        name = names[int(k * len(names) / count)]
        hit(name, at(bar, 4 - beats) + k * BEAT / 4, 0.45 + 0.4 * k / count,
            -0.5 + k / count)


def riser_into(bar, bars, gain=0.5):
    y = drumkit.riser(bars * BAR)
    put("cymbal", y, at(bar) - bars * BAR, gain * 0.6)
    log(at(bar) - bars * BAR, bars * BAR, "riser", "fx", None, gain)


# ---------------------------------------------------------------- sung syllables
# Each syllable gets the noise whose vowel is closest (see SECTIONS note above).
FIRST_SKIP = {"ahh": 0.05, "ooo": 0.05, "eee": 0.05, "nyaa": 0.10, "dum": 0.0, "mmm": 0.0}


def syl(line, noise, note, bar, e8, n8, new=True, gain=1.0, pan=0.0):
    """One sung syllable: `n8` eighth-notes long, starting `e8` eighths into `bar`."""
    t, d, m = at(bar) + e8 * EIGHTH, n8 * EIGHTH * 0.94, midi(note)
    form = float(np.clip(1.0 + (m - 57) * 0.016, 1.0, 1.34))
    vib = 20 if n8 >= 3 else 0
    rel = 0.11 if n8 >= 3 else 0.06
    skip = FIRST_SKIP[noise]
    sing("vocal", noise, m, t, d, gain, pan, "vocal", formant=form, vibrato_cents=vib,
         release=rel, skip=skip, glide_from=hz(m - 1.2), glide_time=0.05, line=line, new=new)
    sing("vocal", noise, m, t, d, 0.30 * gain, -0.35, "vocal", formant=form, vibrato_cents=vib,
         release=rel, skip=skip, detune=9, show=False)
    sing("vocal", noise, m + 12, t, d, 0.10 * gain, 0.35, "vocal", formant=1.3, vibrato_cents=vib,
         release=rel, skip=skip, detune=-7, show=False)


# (line, noise, note, bar, eighth, eighths long, starts a syllable). The words are not
# stored: only which noise stands in for each syllable and the tune it is sung on.
VERSE = [
    (0, "eee", "E4", 8, 0, 1, 1), (0, "dum", "D4", 8, 1, 1, 1), (0, "eee", "D4", 8, 2, 1, 1),
    (0, "nyaa", "C#4", 8, 3, 1, 1), (0, "eee", "B3", 8, 4, 3.6, 1),
    (1, "ahh", "C#4", 9, 0, 1, 1), (1, "ooo", "C#4", 9, 1, 1, 1), (1, "ooo", "C#4", 9, 2, 1, 1),
    (1, "dum", "A3", 9, 3, 1, 1), (1, "ahh", "F#4", 9, 4, 1, 1), (1, "ooo", "F#4", 9, 5, 1, 1),
    (1, "eee", "F#4", 9, 6, 2, 1),
    (2, "ahh", "E4", 10, 0, 1, 1), (2, "eee", "D4", 10, 1, 1, 1), (2, "eee", "D4", 10, 2, 1, 1),
    (2, "nyaa", "D4", 10, 3, 1, 1), (2, "eee", "C#4", 10, 4, 1, 1), (2, "eee", "B3", 10, 5, 3, 1),
    (3, "ooo", "E3", 11, 0, 1, 1), (3, "eee", "C#4", 11, 1, 1, 1), (3, "nyaa", "C#4", 11, 2, 1, 1),
    (3, "dum", "C#4", 11, 3, 1, 1), (3, "mmm", "B3", 11, 4, 1, 1), (3, "eee", "A3", 11, 5, 1, 1),
    (3, "eee", "B3", 11, 6, 2, 0),
    (3, "ooo", "C#4", 12, 0, 1, 1), (3, "ahh", "B3", 12, 1, 1, 1), (3, "ahh", "C#4", 12, 2, 1, 0),
    (3, "ooo", "A3", 12, 3, 5, 1),
    (4, "ahh", "D4", 13, 0, 1, 1), (4, "eee", "D4", 13, 1, 1, 1), (4, "nyaa", "D4", 13, 2, 1, 1),
    (4, "eee", "D4", 13, 3, 1, 1), (4, "eee", "C#4", 13, 4, 1, 0), (4, "eee", "B3", 13, 5, 3, 0),
    (5, "ahh", "F#3", 14, 0, 1, 1), (5, "eee", "A3", 14, 1, 1, 1), (5, "dum", "A3", 14, 2, 1, 1),
    (5, "eee", "A3", 14, 3, 1, 1), (5, "dum", "A3", 14, 4, 1, 1), (5, "dum", "A3", 14, 5, 1, 1),
    (5, "dum", "A3", 14, 6, 2, 1), (5, "ooo", "G#3", 15, 0, 1, 1), (5, "eee", "F#3", 15, 1, 3, 1),
]


# 0-3  the silent world wakes up
for b in range(4):
    root, chord = RIFF_CHORDS[b]
    pad(b, chord, gain=0.75 + 0.1 * b)
    if b < 2:
        sing("bass", "dum", midi(root), at(b), BEAT * 1.6, 0.9, 0, "bass", release=0.2)
        hit("kick", at(b), 0.7)
    else:
        bassline(b, root, gain=0.75)
        for q in range(4):
            hit("kick", at(b, q), 0.65 + 0.05 * q)
        for k in range(8):
            hit("hat", at(b) + k * EIGHTH, 0.14 + 0.02 * k, 0.3)
# a music-box hint of the riff, one note per beat
for k, n in enumerate(["F#5", "D5", "B4", "E5", "G#5", "A5", "B5", "E5"]):
    sing("arp", "ooo", midi(n), at(0, k), BEAT * 0.35, 0.42, (-1) ** k * 0.4, "chime",
         formant=1.3, skip=0.1, release=0.35)
riser_into(4, 1.5, 0.6)
fill(3, 1.5)

# 4-11  the riff
hit("crash", at(4), 0.55)
for b in range(4, 12):
    root, chord = RIFF_CHORDS[b % 4]
    beat_rock(b, four=(b >= 8))
    bassline(b, root)
    pad(b, chord, gain=0.8)
    if b >= 8:
        arp(b, chord, gain=0.75)
riff(4)
riff(8, harmony=True)
hit("crash", at(8), 0.45)
fill(11, 1)

# 8-15 (raw bars)  the verse: the noises sing, the riff steps back
_raw = True
hit("crash", at(8), 0.40)
for b in range(8, 16):
    root, chord = RIFF_CHORDS[b % 4]
    beat_rock(b, gain=0.8)
    bassline(b, root, gain=0.85)
    pad(b, chord, gain=0.85)
    if b >= 12:
        arp(b, chord, gain=0.55 if b < 14 else 0.72, name="ooo")
for line, noise, note, bar, e8, n8, new in VERSE:
    syl(line, noise, note, bar, e8, n8, new=bool(new))
fill(15, 1)
_raw = False
riser_into(8, 0.75, 0.45)  # old numbering: bar 8 is where the riff returns (raw bar 16)

# 12-15  the Hush: the riff goes muffled, then fights its way back
for b in range(12, 16):
    root, chord = [("B2", ["B3", "D4", "F#4"]), ("G2", ["B3", "D4", "G4"]),
                   ("A2", ["A3", "C#4", "E4"]), ("E2", ["B3", "E4", "G#4"])][b - 12]
    pad(b, chord, gain=1.15)
    if b < 14:
        sing("bass", "dum", midi(root), at(b), BAR * 0.9, 0.8, 0, "bass", release=0.2,
             vibrato_cents=12)
        hit("kick", at(b), 0.9)
        hit("snare", at(b, 2), 0.55)
    else:
        bassline(b, root, pattern=(0,) * 8, gain=0.95)
        for q in range(4):
            hit("kick", at(b, q), 0.9)
riff(12, gain=0.95, show=True, stem="lead")
for k in range(8):
    hit("snare", at(14) + k * EIGHTH, 0.20 + 0.04 * k)
for k in range(12):
    hit("snare", at(15) + k * BEAT / 4, 0.32 + 0.035 * k)
riser_into(16, 2, 0.85)

# 16-31  chorus
hit("crash", at(16), 0.8)
for b in range(16, 32):
    root, chord = CHORUS_CHORDS[(b - 16) % 4]
    if b < 30:
        beat_rock(b, four=True, busy=(b >= 24))
        bassline(b, root, pattern=(0, 12, 0, 12, 0, 12, 0, 12))
    pad(b, chord, gain=1.05)
    if b >= 20 and b < 30:
        arp(b, chord, gain=0.9 if b >= 24 else 0.65, name="ooo" if b < 24 else "eee")
for line in (16, 20, 24, 28):
    if line > 16:
        hit("crash", at(line), 0.5)

# which noise stands in for each chorus syllable, and which caption line it belongs to
CHORUS_SYL = ["eee", "dum", "eee", "eee", "eee", "dum", "ahh", "eee", "dum",
              "eee", "nyaa", "eee", "dum", "ooo"]
CHORUS_LINE = [10, 10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 13, 13, 13]
ECHO_SYL = ["eee", "dum", "eee"]
for k, (bar, beat, name, beats) in enumerate(CHORUS):
    t, d, m = at(16 + bar, beat), beats * BEAT * 0.96, midi(name)
    form = float(np.clip(1.0 + (m - 57) * 0.016, 1.0, 1.34))
    vib = 26 if beats >= 4 else 0
    who = CHORUS_SYL[k]
    sing("vocal", who, m, t, d, 1.0, 0.0, "vocal", formant=form, vibrato_cents=vib,
         release=0.12, glide_from=hz(m - 1.5), glide_time=0.07, line=CHORUS_LINE[k], new=True)
    sing("vocal", who, m, t, d, 0.34, -0.35, "vocal", formant=form, vibrato_cents=vib,
         release=0.12, detune=9, show=False)
    sing("vocal", who, m + 12, t, d, 0.12 if m >= 57 else 0.20, 0.35, "vocal", formant=1.3,
         skip=0.1, vibrato_cents=vib, release=0.1, detune=-7, show=False)
for line in (0, 4):
    for k, (_, beat, name, beats) in enumerate(ECHO):
        for who, pan, g in ((ECHO_SYL[k], -0.6, 0.55), ("ooo", 0.6, 0.24)):
            sing("echo", who, midi(name), at(16 + line + 3, beat), beats * BEAT * 0.9,
                 g, pan, "echo", formant=1.18, release=0.1, vibrato_cents=10)
fill(19, 1)
fill(23, 1)
fill(27, 2)
# bars 28-29 punch every syllable, 30-31 open up for the highest note
for bar, beat, *_ in CHORUS[9:13]:
    hit("crash", at(16 + bar, beat), 0.28, show=False)
hit("crash", at(30), 1.0)
hit("kick", at(30), 1.0)
for b in (30, 31):
    root, chord = CHORUS_CHORDS[(b - 16) % 4]
    sing("bass", "dum", midi(root), at(b), BAR * 0.95, 0.95, 0, "bass", release=0.2)
    for q in range(4):
        hit("kick", at(b, q), 0.9)
    for k in range(16):
        hit("hat", at(b) + k * BEAT / 4, 0.16, 0.3, show=False)
    arp(b, chord, gain=0.8)
sing("vocal", "ahh", midi("E4"), at(30), BAR * 1.95, 0.42, 0.45, "vocal", formant=1.15,
     vibrato_cents=22, release=0.15, show=False)
sing("vocal", "eee", midi("B4"), at(30), BAR * 1.95, 0.30, -0.45, "vocal", formant=1.2,
     vibrato_cents=24, release=0.15, show=False)
fill(31, 2)

# 32-39  finale: the riff with everybody in
hit("crash", at(32), 0.85)
hit("crash", at(36), 0.6)
for b in range(32, 40):
    root, chord = RIFF_CHORDS[b % 4]
    beat_rock(b, four=True, busy=(b >= 36))
    bassline(b, root)
    pad(b, chord, gain=0.85)
    arp(b, chord, gain=0.8)
riff(32, harmony=True)
riff(36, harmony=True)
# the high "Ahh" and low "Ooo" hold the chord under the last four bars
for k, n in enumerate(["D5", "E5", "E5", "F#5"]):
    sing("vocal", "ahh", midi(n), at(36 + k), BAR * 0.95, 0.30, 0.0, "vocal", formant=1.3,
         vibrato_cents=24, release=0.15)
fill(39, 1.5)

# 40-41  last chord
hit("crash", at(40), 1.0)
hit("kick", at(40), 1.0)
hit("snare", at(40), 0.6)
for who, n, pan, g in (("nyaa", "A5", 0.1, 0.55), ("ahh", "A4", 0.0, 0.75),
                       ("eee", "E5", -0.5, 0.35), ("ooo", "C#5", 0.5, 0.45),
                       ("mmm", "A3", -0.3, 0.5), ("mmm", "E4", 0.3, 0.4),
                       ("dum", "A2", 0.0, 1.1)):
    sing("vocal" if who in ("ahh", "nyaa") else "pad" if who != "dum" else "bass",
         who, midi(n), at(40), BAR * 1.5, g, pan, "finalchord",
         formant=1.2 if midi(n) > 64 else 1.0, vibrato_cents=18 if who != "dum" else 0,
         release=0.9, skip=0.0)


# ---------------------------------------------------------------- mix
def sos(x, kind, f, order=2):
    return sosfilt(butter(order, f, kind, fs=sr, output="sos"), x, axis=0)


def comb(x, delay, fb, damp):
    d = int(delay * sr)
    y = np.zeros_like(x)
    prev = np.zeros(d)
    for s in range(d, len(x), d):
        e = min(s + d, len(x))
        block = x[s - d:e - d] + fb * prev[:e - s]
        smooth = (1 - damp) * block + damp * np.concatenate([[block[0]], block[:-1]])
        y[s:e] = smooth
        prev = np.pad(smooth, (0, d - len(smooth)))
    return y


def allpass(x, delay, g=0.65):
    d = int(delay * sr)
    y = np.zeros_like(x)
    for s in range(0, len(x), d):
        e = min(s + d, len(x))
        xd = x[s - d:e - d] if s >= d else np.zeros(e - s)
        yd = y[s - d:e - d] if s >= d else np.zeros(e - s)
        y[s:e] = -g * x[s:e] + xd + g * yd
    return y


def reverb(x, rt60=1.7):
    """Room echo: nothing but delayed, quieter copies of the input."""
    out = np.zeros_like(x)
    for ch, times in enumerate(([0.0297, 0.0371, 0.0411, 0.0437, 0.0533],
                                [0.0313, 0.0359, 0.0427, 0.0461, 0.0509])):
        wet = sum(comb(x[:, ch], d, 10 ** (-3 * d / rt60), 0.35) for d in times) / 5
        out[:, ch] = allpass(allpass(wet, 0.0051), 0.0017)
    return out


def pingpong(x, time, fb=0.42, repeats=5):
    out = np.zeros_like(x)
    d = int(time * sr)
    src = x.mean(axis=1)
    for r in range(1, repeats + 1):
        if r * d >= len(x):
            break
        out[r * d:, r % 2] += src[:-r * d] * fb ** r
    return out


# tone shaping per stem
stems["lead"] = sos(stems["lead"], "highpass", 260)
stems["lead"] += 0.55 * sos(stems["lead"], "highpass", 2800)
stems["vocal"] = sos(stems["vocal"], "highpass", 95)
stems["vocal"] += 0.45 * sos(stems["vocal"], "highpass", 2600)
stems["echo"] = sos(stems["echo"], "highpass", 300)
stems["pad"] = sos(sos(stems["pad"], "highpass", 190), "lowpass", 5200)
stems["arp"] = sos(stems["arp"], "highpass", 500)
stems["bass"] = sos(stems["bass"], "lowpass", 2400)
stems["bass"] = np.tanh(stems["bass"] * 3.2) / 3.2 * 1.25

# the Hush muffles the riff: a low-pass that stays shut, then opens
a, b = int(at(12) * sr), int(at(16) * sr)
seg = stems["lead"][a:b].copy()
bands = [380, 700, 1300, 2600, 6000, 14000]
filtered = [sos(seg, "lowpass", f, 4) for f in bands]
curve = np.interp(np.linspace(0, 4, b - a), [0, 2, 3, 3.5, 4], [0, 0.4, 2.0, 3.6, 5])
mixed = np.zeros_like(seg)
for k in range(len(bands)):
    w = np.clip(1 - np.abs(curve - k), 0, 1)[:, None]
    mixed += filtered[k] * w
stems["lead"][a:b] = mixed * 1.15

LEVEL = {"lead": 1.08, "vocal": 1.02, "echo": 0.80, "pad": 0.78, "bass": 0.74,
         "arp": 0.95, "kick": 0.58, "snare": 0.44, "hats": 0.46, "cymbal": 0.38}
for k in stems:
    stems[k] *= LEVEL[k]

# duck the sustained parts under every kick
duck = np.ones(N)
shape = 1 - 0.42 * np.exp(-np.arange(int(0.28 * sr)) / (0.075 * sr))
for e in events:
    if e["i"] == "kick":
        i = int((e["t"] - SONG_AT) * sr)
        n = min(len(shape), N - i)
        duck[i:i + n] = np.minimum(duck[i:i + n], shape[:n])
duck = uniform_filter1d(duck, int(0.004 * sr))
for k in ("pad", "bass", "arp"):
    stems[k] *= duck[:, None]

send = (stems["lead"] * 0.22 + stems["vocal"] * 0.34 + stems["echo"] * 0.5 +
        stems["pad"] * 0.30 + stems["arp"] * 0.30 + stems["snare"] * 0.26 +
        stems["cymbal"] * 0.18)
wet = reverb(sos(send, "highpass", 250))
echoes = pingpong(stems["vocal"] * 0.28 + stems["echo"] * 0.4 + stems["arp"] * 0.35 +
                  stems["lead"] * 0.10, BEAT * 0.75)
mix = sum(stems.values()) + wet * 0.62 + sos(echoes, "highpass", 400) * 0.55
mix = sos(mix, "highpass", 36, 4)
mix += 0.22 * sos(mix, "highpass", 5000)  # air


def limit(x, ceiling):
    need = np.minimum(1.0, ceiling / (np.abs(x).max(axis=1) + 1e-12))
    win = int(0.006 * sr)
    g = uniform_filter1d(minimum_filter1d(need, win * 2 + 1), win)
    return x * g[:, None]


def write(path, x):
    wavfile.write(path, sr, (np.clip(x, -1, 1) * 32767).astype(np.int16))


def lufs(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(out.rsplit("I:", 1)[1].split("LUFS")[0])


# glue, then bring to streaming loudness
mix /= np.percentile(np.abs(mix), 99.7) + 1e-9
mix = np.tanh(mix * 0.62) / 0.62
fade = int(0.8 * sr)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
song_path = os.path.join(OUT, "song.wav")
gain = 0.5
for _ in range(4):
    out = limit(mix * gain, 10 ** (-1.3 / 20))
    write(song_path, out)
    gain *= 10 ** ((-13.5 - lufs(song_path)) / 20)
out = limit(mix * gain, 10 ** (-1.3 / 20))
write(song_path, out)
for k, v in stems.items():
    wavfile.write(os.path.join(STEMS, k + ".wav"), sr, v.astype(np.float32))

# soundtrack: the untouched original recording, a short pick-up, then the song
orig_wav = os.path.join(OUT, "original_stereo.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i",
                os.path.join(sampler.ROOT, "noises", "original.m4a"),
                "-ar", str(sr), "-ac", "2", "-c:a", "pcm_s16le", orig_wav], check=True)
_, orig = wavfile.read(orig_wav)
orig = orig.astype(np.float64) / 32768
total = np.zeros((int(SONG_AT * sr) + N, 2))
total[:len(orig)] += orig
pick = drumkit.riser(1.25) * 0.20
i = int((SONG_AT - 1.25) * sr)
total[i:i + len(pick)] += pick[:, None]
total[int(SONG_AT * sr):] += out[:len(total) - int(SONG_AT * sr)]
write(os.path.join(OUT, "soundtrack.wav"), total)

events.sort(key=lambda e: e["t"])
meta = {"bpm": BPM, "beat": BEAT, "bar": BAR, "songAt": SONG_AT,
        "duration": len(total) / sr, "originalLength": len(orig) / sr,
        "sections": [{"name": n, "start": SONG_AT + a * BAR, "end": SONG_AT + b * BAR}
                     for n, a, b in SECTIONS],
        "original": [{"i": k, "start": a, "end": b} for k, a, b in [
            ("ahh", 1.02, 1.61), ("ooo", 2.20, 2.76), ("mmm", 3.24, 3.81),
            ("nyaa", 4.20, 4.85), ("dum", 5.41, 5.99), ("eee", 6.57, 7.10)]],
        "events": events}

# loudness curves for lip-sync and audio-reactive drawing, 60 values a second
step = sr // 60


def curve60(x):
    mono = x.mean(axis=1) if x.ndim == 2 else x
    v = np.array([np.sqrt(np.mean(mono[i:i + step] ** 2) + 1e-12)
                  for i in range(0, len(mono), step)])
    return [round(float(q), 3) for q in np.clip(v / (np.percentile(v, 99) + 1e-9), 0, 1)]


meta["env"] = {"mix": curve60(total)}
orig_mono = orig.mean(axis=1)
meta["originalEnv"] = curve60(orig_mono)
meta["originalWave"] = [round(float(v), 4) for v in orig_mono[::8]]  # 6 kHz outline
with open(os.path.join(OUT, "events.json"), "w") as f:
    json.dump(meta, f, separators=(",", ":"))

print(f"song {SONG_LEN:.2f}s, soundtrack {len(total)/sr:.2f}s, {len(events)} events, "
      f"integrated {lufs(song_path):.1f} LUFS")
