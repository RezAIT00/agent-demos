"""Cuts a short clip (with sound) around every major hit into work/clips/, for review."""
import json, os, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
HITS = json.load(open(os.path.join(ROOT, 'src', 'hits.json'), encoding='utf-8'))
master, wav = sys.argv[1], sys.argv[2]
out = os.path.join(ROOT, 'work', 'clips'); os.makedirs(out, exist_ok=True)
for h in HITS['hits']:
    a = max(0, h['f'] - 20); b = min(1200, h['f'] + 34)
    p = os.path.join(out, '%s_f%d.mp4' % (h['id'], h['f']))
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.4f' % (a / 24), '-t', '%.4f' % ((b - a) / 24), '-i', master, '-ss', '%.4f' % (a / 24), '-t', '%.4f' % ((b - a) / 24), '-i', wav,
                    '-vf', 'scale=960:540:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '192k', p], check=True)
print('wrote', len(HITS['hits']), 'clips to', out)
