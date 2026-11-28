"""Confirm the video opens on the untouched recording, and that only it feeds the song."""
import os
import numpy as np
from scipy.io import wavfile

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out")
sr, track = wavfile.read(os.path.join(OUT, "soundtrack.wav"))
_, orig = wavfile.read(os.path.join(OUT, "original_stereo.wav"))
a = track[:len(orig)].astype(int)
b = orig.astype(int)
print(f"original: {len(orig)/sr:.2f}s   largest sample difference in the opening: "
      f"{np.abs(a - b).max()} of 32767")
