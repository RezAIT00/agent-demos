// Deterministic frame-by-frame capture of slow-light.html?render=1 piped into ffmpeg.
//   node tools/render.mjs            -> slow-light.mp4  (1080x1080, 30 fps, 600 frames) + stills/
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { openPage } from './browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30, FRAMES = 600;
const out = path.join(root, 'slow-light.mp4');
const started = Date.now();
const { browser, page, info, errors, exe } = await openPage();
console.log('browser:', exe);
console.log('page:', JSON.stringify(info));

const ff = spawn('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-frames:v', String(FRAMES),
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '15', '-profile:v', 'high',
  '-x264-params', 'aq-mode=3:deblock=-1,-1:colorprim=bt709:transfer=bt709:colormatrix=bt709',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart', '-an', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let i = 0; i < FRAMES; i++) {
  const url = await page.evaluate(t => { window.renderAt(t); return window.slow.frameData(); }, i / FPS);
  if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await once(ff.stdin, 'drain');
  if (i % 60 === 59) console.log(`frame ${i + 1}/${FRAMES}  ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
ff.stdin.end();
const [code] = await once(ff, 'close');
await browser.close();
if (code !== 0) throw new Error('ffmpeg exited with ' + code);
const bad = errors.filter(e => !/warning X4000/.test(e));
console.log('page errors:', bad.length ? bad : 'none');

// four stills pulled from the finished video
fs.mkdirSync(path.join(root, 'stills'), { recursive: true });
for (const [name, frame] of [['01-moonlit_t01.0', 30], ['02-front-on-the-street_t03.9', 117], ['03-all-lamps_t11.9', 356], ['04-puddles-remember_t17.4', 522]]) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', out, '-vf', `select=eq(n\\,${frame}),scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=rgb24`, '-frames:v', '1', path.join(root, 'stills', name + '.png')]);
}
console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
