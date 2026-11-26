// Frame-exact capture: headless Edge renders t = k/24 for k = 0..1919, and each
// PNG is piped straight into ffmpeg. No frame sequence is written to disk.
//   node tools/render.mjs [--out humanity_2100.mp4] [--from 0 --to 1920]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launch, ROOT } from './cdp.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };
const from = Number(arg('from', 0)), to = Number(arg('to', 1920));
const out = path.resolve(ROOT, arg('out', 'humanity_2100.mp4'));
const wav = path.join(ROOT, 'soundtrack.wav');
const full = from === 0 && to === 1920;

const ffArgs = ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', '24', '-i', '-'];
if (full) ffArgs.push('-i', wav);
ffArgs.push('-map', '0:v:0');
if (full) ffArgs.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
ffArgs.push(
  '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-threads', '12',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', '24', '-movflags', '+faststart',
);
if (full) ffArgs.push('-t', '80');
ffArgs.push(out);

const started = Date.now();
const browser = await launch({ tag: 'render' });
let ff;
try {
  await browser.open(path.join(ROOT, 'index.html'), '?capture=1');
  const grab = async (k) => {
    const url = await browser.evaluate(`renderAt(${k}/24); document.getElementById('film').toDataURL('image/png')`);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };
  // purity: a frame must not depend on what was rendered before it
  const probes = [37, 611, 1203, 1777];
  const first = [];
  for (const k of probes) first.push(crypto.createHash('sha256').update(await grab(k)).digest('hex'));

  ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); });
  for (let k = from; k < to; k++) {
    const png = await grab(k);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (k % 120 === 0) console.log(`frame ${k} / ${to}  ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await done;

  let pure = true;
  for (let i = probes.length - 1; i >= 0; i--) {
    const again = crypto.createHash('sha256').update(await grab(probes[i])).digest('hex');
    if (again !== first[i]) pure = false;
  }
  const secs = (Date.now() - started) / 1000;
  console.log(`rendered ${to - from} frames in ${secs.toFixed(0)} s -> ${out}`);
  console.log(`purity check (frames ${probes.join(', ')}, before vs after, reverse order): ${pure ? 'identical' : 'DIFFERENT'}`);
  const errs = browser.logs.filter((l) => /EXCEPTION|error/i.test(l));
  if (errs.length) console.log(errs.slice(0, 10).join('\n'));
  if (full) fs.writeFileSync(path.join(ROOT, 'tmp', 'render_info.json'), JSON.stringify({ seconds: secs, pure, frames: to - from }));
} finally {
  if (ff && ff.exitCode === null) ff.kill();   // only the encoder this script started
  await browser.close();
}
