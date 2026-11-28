// Inline the source modules into the single self-contained slow-light.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parts = ['a_core', 'b_shaders', 'c_geom', 'd_scene', 'e_actors', 'f_render'];
const js = parts.map(p => fs.readFileSync(path.join(root, 'src', p + '.js'), 'utf8')).join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slow Light (c = 5 m/s)</title>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  body{display:flex;align-items:center;justify-content:center}
  canvas{width:min(100vw,100vh);height:min(100vw,100vh);display:block}
  body.render{display:block}
  body.render canvas{width:1080px;height:1080px}
  #loading{position:fixed;color:#56627a;font:14px system-ui,sans-serif;letter-spacing:.08em}
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
</head>
<body>
<div id="loading">building the street…</div>
<canvas id="c" width="1080" height="1080"></canvas>
<script type="module">
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

${js}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'slow-light.html'), html);
console.log('built slow-light.html', (html.length / 1024).toFixed(0) + ' KB');
