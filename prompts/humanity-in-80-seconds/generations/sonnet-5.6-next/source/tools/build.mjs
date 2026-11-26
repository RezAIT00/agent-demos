// Concatenate src/*.js into one self-contained index.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort();

const scripts = files.map((f) => {
  const code = fs.readFileSync(path.join(src, f), 'utf8');
  if (code.includes('</script')) throw new Error(f + ' contains a closing script tag');
  return `<script>\n// ==== src/${f} ====\n${code}</script>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Same Fire</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{margin:0;background:#000;height:100%}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center}
  #film{width:min(100vw, calc((100vh - 40px) * 16 / 9));height:auto;display:block;cursor:pointer}
  #bar{display:flex;gap:10px;align-items:center;width:min(96vw,1200px);height:40px;color:#aaa}
  #bar[hidden]{display:none}
  #scrub{flex:1}
</style>
</head>
<body>
<canvas id="film" width="1920" height="1080"></canvas>
<div id="bar" hidden><button id="play">play</button><input id="scrub" type="range" min="0" max="80" step="0.001" value="0"><span id="stamp"></span></div>
<script>addEventListener('error', (e) => { window.FAILED = String(e.message) + ' @' + e.lineno; });</script>
${scripts}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`index.html: ${files.length} sources, ${(html.length / 1024).toFixed(0)} KiB`);
