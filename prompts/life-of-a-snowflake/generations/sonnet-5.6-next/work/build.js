// Inlines the source modules into the single self-contained snowflake.html
const fs = require('fs');
const path = require('path');
const here = __dirname;
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const strip = (s) => s.replace(/^if \(typeof module !== 'undefined'\) module\.exports.*$/m, '');
const sim = strip(read('sim.js')) + '\n' + strip(read('src/weather.js'));
const modules = fs.readdirSync(path.join(here, 'src')).filter((f) => /^\d\d_.*\.js$/.test(f)).sort();
const app = modules.map((f) => read('src/' + f)).join('\n');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diary of a Snowflake</title>
<style>
  html, body { margin: 0; height: 100%; background: #04070d; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { width: min(100vw, 100vh); height: min(100vw, 100vh); display: block; }
  #status { position: fixed; left: 0; right: 0; bottom: 6vh; text-align: center; padding: 0 16px; color: #8fa9c8; font: 13px/1.5 ui-monospace, Consolas, monospace; letter-spacing: .02em; }
</style>
<script type="importmap">{"imports":{"three":"${THREE_URL}"}}</script>
</head>
<body>
<canvas id="view"></canvas>
<div id="status">loading…</div>
<!-- Growth model (Gravner–Griffeath on a hexagonal lattice) and the weather it falls through. -->
<script type="text/js-sim" id="sim-source">
${sim}
</script>
<script type="module">
import * as THREE from 'three';
${app}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(here, '..', 'snowflake.html'), html);
console.log('built snowflake.html', (html.length / 1024).toFixed(0) + ' kB', modules.join(' '));
