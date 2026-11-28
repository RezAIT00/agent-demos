"""Turn short recorded noises into playable instruments.

Only the user's own recording is used as sound material. Pitched notes are
replayed with TD-PSOLA: two-period slices of the real waveform are re-spaced to
set the pitch and re-visited to set the length. That keeps the vowel character
far better than simply speeding the audio up.
"""
import os
import numpy as np
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "noises", "original.wav")

# name: (clip start, clip end, sustain start, sustain end) in seconds of original.wav.
# Chosen from the spectrogram: sustain skips onsets, vowel glides and tails.
PITCHED = {
    "ahh":  (1.00, 1.66, 1.13, 1.47),
    "ooo":  (2.17, 2.82, 2.30, 2.62),
    "mmm":  (3.21, 3.86, 3.34, 3.71),
    "nyaa": (4.17, 4.91, 4.54, 4.76),
    "dum":  (5.37, 6.05, 5.52, 5.74),
    "eee":  (6.55, 7.13, 6.68, 6.97),
}


def load_source():
    sr, x = wavfile.read(SOURCE)
    return sr, x.astype(np.float64)


def save(path, sr, y, peak_db=-1.0):
    y = y / (np.abs(y).max() + 1e-12) * 10 ** (peak_db / 20)
    wavfile.write(path, sr, (y * 32767).astype(np.int16))


def pitch_track(x, sr, lo=65.0, hi=190.0, hop=0.005, size=0.035):
    """f0 every `hop` seconds by normalised autocorrelation, median smoothed."""
    n, h = int(size * sr), int(hop * sr)
    times, f0 = [], []
    a, b = int(sr / hi), int(sr / lo) + 1
    for start in range(0, len(x) - n, h):
        s = x[start:start + n] - x[start:start + n].mean()
        spec = np.fft.rfft(s, 2 * n)
        ac = np.fft.irfft(np.abs(spec) ** 2)[:n]
        e = np.concatenate([[0], np.cumsum(s ** 2)])
        lags = np.arange(n)
        nsdf = 2 * ac / (e[n - lags] + e[n] - e[lags] + 1e-12)
        k = a + int(np.argmax(nsdf[a:b]))
        y0, y1, y2 = nsdf[k - 1], nsdf[k], nsdf[k + 1]
        d = np.clip(0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 - 1e-12), -1, 1)
        times.append((start + n / 2) / sr)
        f0.append(sr / (k + d) if y1 > 0.5 else np.nan)
    times, f0 = np.array(times), np.array(f0)
    good = ~np.isnan(f0)
    f0 = np.interp(times, times[good], f0[good])
    pad = np.pad(f0, 4, mode="edge")
    f0 = np.array([np.median(pad[i:i + 9]) for i in range(len(f0))])
    return times, f0


def pitch_marks(x, sr, times, f0):
    """One mark per vocal-fold cycle, kept phase-aligned by cross-correlation."""
    def period(i):
        return sr / np.interp(i / sr, times, f0)

    def step(i, direction):
        t = period(i)
        half = int(t / 2)
        ref = x[i - half:i + half]
        best, best_score = None, -np.inf
        for lag in range(int(t * 0.85), int(t * 1.15) + 1):
            j = i + direction * lag
            if j - half < 0 or j + half > len(x):
                continue
            cand = x[j - half:j + half]
            score = np.dot(ref, cand) / (np.linalg.norm(ref) * np.linalg.norm(cand) + 1e-12)
            if score > best_score:
                best, best_score = j, score
        return best

    mid = len(x) // 2
    t = int(period(mid))
    anchor = mid - t // 2 + int(np.argmax(np.abs(x[mid - t // 2:mid + t // 2])))
    marks = [anchor]
    for direction in (1, -1):
        i = anchor
        while True:
            j = step(i, direction)
            if j is None:
                break
            marks.append(j)
            i = j
    return np.array(sorted(marks))


class Voice:
    """A pitched noise that can be played at any frequency for any length."""

    def __init__(self, x, sr, start, end, sus_start, sus_end):
        self.sr = sr
        self.x = x[int(start * sr):int(end * sr)].copy()
        times, f0 = pitch_track(self.x, sr)
        self.times, self.f0 = times, f0
        self.marks = pitch_marks(self.x, sr, times, f0)
        a, b = (sus_start - start) * sr, (sus_end - start) * sr
        self.sustain = np.where((self.marks >= a) & (self.marks <= b))[0]
        self.base_hz = float(np.median(f0[(times * sr >= a) & (times * sr <= b)]))
        periods = np.gradient(self.marks.astype(float))
        self.periods = periods
        self.rms = np.array([
            np.sqrt(np.mean(self.x[max(0, m - int(p)):m + int(p)] ** 2) + 1e-12)
            for m, p in zip(self.marks, periods)
        ])
        self.level = float(np.median(self.rms[self.sustain]))
        loud = np.where(self.rms > 0.12 * self.level)[0]
        self.first = int(loud[0])

    def _source_index(self, t):
        """Which source cycle to use `t` seconds into a note.

        Plays the real onset once, then sweeps back and forth over the steady
        part at natural speed so the loop keeps its human wobble and never jumps.
        """
        sus = self.sustain
        pos = self.marks[self.first] + t * self.sr
        a, b = self.marks[sus[0]], self.marks[sus[-1]]
        if pos > b:
            span = b - a
            phase = (pos - b) % (2 * span)
            pos = b - phase if phase <= span else a + (phase - span)
        i = int(np.searchsorted(self.marks, pos))
        i = min(max(i, 1), len(self.marks) - 1)
        return i if self.marks[i] - pos < pos - self.marks[i - 1] else i - 1

    def play(self, hz, dur, release=0.06, vibrato_cents=0.0, vibrato_hz=5.5,
             glide_from=None, glide_time=0.05, formant=1.0, skip=0.0):
        """Render `dur` seconds (plus release) at `hz`. `hz` is exact: wobble is removed.

        formant > 1 shrinks each slice, giving a brighter, smaller-sounding voice.
        skip starts that many seconds into the noise (to jump past a slow onset).
        """
        sr = self.sr
        total = int((dur + release) * sr)
        pad = int(sr * 0.05)
        out = np.zeros(total + 2 * pad)
        t_out = 0.0
        while t_out < total:
            t = t_out / sr
            f = hz
            if glide_from and t < glide_time:
                f = glide_from * (hz / glide_from) ** (t / glide_time)
            if vibrato_cents and t > 0.18:
                depth = vibrato_cents * min(1.0, (t - 0.18) / 0.25)
                f *= 2 ** (depth * np.sin(2 * np.pi * vibrato_hz * t) / 1200)
            i = self._source_index(t + skip)
            m, p = int(self.marks[i]), int(round(self.periods[i]))
            lo, hi = m - p, m + p
            if lo >= 0 and hi <= len(self.x):
                grain = self.x[lo:hi] * np.hanning(hi - lo)
                half = p
                if formant != 1.0:
                    size = int(round(len(grain) / formant))
                    grain = np.interp(np.linspace(0, len(grain) - 1, size),
                                      np.arange(len(grain)), grain)
                    half = size // 2
                # Even out loudness inside the sustain, keep the natural onset.
                if self.marks[i] >= self.marks[self.sustain[0]]:
                    grain = grain * np.clip(self.level / self.rms[i], 0.6, 1.7)
                # Denser grains add energy; compensate so all pitches match.
                grain = grain * np.sqrt(min(1.0, (sr / f) / half))
                at = pad + int(round(t_out)) - half
                if at >= 0 and at + len(grain) <= len(out):
                    out[at:at + len(grain)] += grain
            t_out += sr / f
        y = out[pad:pad + total]
        fade_in, fade_out = int(0.006 * sr), int(release * sr)
        y[:fade_in] *= np.linspace(0, 1, fade_in)
        if fade_out:
            y[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
        return y * (0.12 / self.level)


def load_voices():
    sr, x = load_source()
    return sr, {name: Voice(x, sr, *span) for name, span in PITCHED.items()}
