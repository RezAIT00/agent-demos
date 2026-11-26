// Inlines every WGSL + JS source into a single self-contained index.html
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const src = path.join(root,'src');
export function build(){
  const W={}; for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.wgsl')).sort()) W[f.replace('.wgsl','')]=fs.readFileSync(path.join(src,f),'utf8');
  const js=['script.js','math.js','glyphs.js','profile.js','tubes.js','worlds.js','engine.js','main.js'].filter(f=>fs.existsSync(path.join(src,f))).map(f=>'// ---- '+f+'\n'+fs.readFileSync(path.join(src,f),'utf8')).join('\n');
  const wg=Object.entries(W).map(([k,v])=>'WGSL['+JSON.stringify(k)+']='+'String.raw`\n'+v+'`;').join('\n');
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opus 5.5 creates</title>\n'
+'<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}canvas{width:100vw;height:100vh;object-fit:contain;display:block}</style></head>\n'
+'<body><canvas id="c" width="1920" height="1080"></canvas><script>\n"use strict";\nconst WGSL={};\n'+wg+'\n'+js+'\n</script></body></html>';
  fs.writeFileSync(path.join(root,'index.html'),html); return html.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log('index.html',build());
