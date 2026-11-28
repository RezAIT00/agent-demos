"""Peak and short-window loudness around the main hits, to balance the mix by numbers."""
import json, subprocess, sys
import numpy as np

SR = 48000
src = sys.argv[1] if len(sys.argv) > 1 else 'snowflake.wav'
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
cues = json.load(open('cues.json'))['cues']
db = lambda v: 20 * np.log10(max(v, 1e-9))

def stat(t0, t1):
    seg = x[int(t0 * SR):int(t1 * SR)]
    return db(np.abs(seg).max()), db(np.sqrt((seg ** 2).mean()))

print('%-10s %7s  %8s %8s | %s' % ('cue', 't', 'peak', 'rms40', 'rms of the 150 ms before'))
for c in cues:
    if c['id'] not in ('glint', 'condense', 'freeze', 'flash', 'rib1', 'arms', 'burst', 'dry', 'updraught', 'sector', 'facets', 'grown', 'bubble', 'touchdown', 'arm', 'settle'):
        continue
    t = c['frame'] / 30
    p, r = stat(t, t + 0.040)
    _, before = stat(max(0, t - 0.16), max(0.001, t - 0.01))
    print('%-10s %7.3f  %8.1f %8.1f | %8.1f' % (c['id'], t, p, r, before))
print('whole mix peak %.1f dBFS, rms %.1f dBFS' % stat(0, 20))
