"""Concatenates src/ into one self-contained index.html (no external requests, no asset files)."""
import json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, 'src')
ORDER = ['core.js', 'gl.js', 'shaders.js', 'mesh.js', 'rig.js', 'chars.js', 'poses.js', 'lettering.js', 'fxcore.js',
         'world.js', 'fx.js', 'closeups.js', 'anim.js', 'camera.js', 'film.js', 'renderer.js', 'main.js']


def read(p):
    with open(os.path.join(SRC, p), encoding='utf-8') as f:
        return f.read()


parts = []
glyphs = read('glyphs.json')
parts.append('const GLYPHS = ' + glyphs + ';')
if os.path.exists(os.path.join(SRC, 'hits.json')):
    parts.append('const HITDATA = ' + json.dumps(json.loads(read('hits.json')), separators=(',', ':')) + ';')
for name in ORDER:
    if os.path.exists(os.path.join(SRC, name)):
        parts.append('// ===================== ' + name + ' =====================\n' + read(name))
    else:
        print('note: missing', name, file=sys.stderr)
js = '\n'.join(parts)
assert '</script' not in js.lower()
html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>IRO x SUMI</title>
<style>html,body{margin:0;background:#000;height:100%}canvas{display:block;width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;margin:auto;cursor:pointer}</style>
</head><body>
<canvas id="c" width="1920" height="1080"></canvas>
<script>
'use strict';
""" + js + """
</script>
</body></html>
"""
with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
print('index.html', round(len(html) / 1024, 1), 'KB')
