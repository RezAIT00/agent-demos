// Concatenate src/ into one self-contained index.html
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORDER = ['math', 'mesh', 'shaders', 'env', 'gl', 'bike', 'pelican', 'falcon', 'props', 'type', 'eye2d', 'fx', 'timeline', 'kit', 'shots_a', 'shots_b', 'shots_c', 'extras', 'main'];
export function build(quiet = true) {
  const parts = ORDER.filter(n => fs.existsSync(path.join(root, 'src', n + '.js'))).map(n => '// ===== src/' + n + '.js =====\n' + fs.readFileSync(path.join(root, 'src', n + '.js'), 'utf8'));
  const js = parts.join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>BEAK VELOCITY</title><link rel="icon" href="data:,">
<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}canvas#c{width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}</style></head>
<body><canvas id="c" width="1920" height="1080"></canvas>
<script>
'use strict';
window.ERRS=[];window.addEventListener('error',e=>{window.ERRS.push(String(e.message)+' @'+e.lineno);window.FAILED=window.FAILED||String(e.message)+' @'+e.lineno;});
try{
${js}
}catch(e){window.FAILED=String(e&&e.stack||e);console.error(window.FAILED);}
</script></body></html>
`;
  fs.writeFileSync(path.join(root, 'index.html'), html);
  if (!quiet) console.log('index.html', (html.length / 1024).toFixed(1), 'KB from', parts.length, 'modules');
  return html;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build(false);
