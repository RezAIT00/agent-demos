// humanity_2100_x.mp4: a smaller two-pass copy of the master for X. The crf 16 master
// is itself only about 7.8 Mbit/s, so the copy targets about 7.1 to be smaller.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';

const src = path.join(ROOT, 'humanity_2100.mp4');
const out = path.join(ROOT, 'humanity_2100_x.mp4');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
const log = path.join(ROOT, 'tmp', 'x2pass');
const video = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '6800k', '-maxrate', '10000k', '-bufsize', '14000k',
  '-g', '48', '-threads', '12', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', log];
const run = (args) => { const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status || 1); };
run(['-i', src, ...video, '-pass', '1', '-an', '-f', 'null', '-']);
// audio comes from the WAV, so it is encoded only once (320k: at 256k the AAC
// encoder overshot the true-peak limit)
run(['-i', src, '-i', path.join(ROOT, 'soundtrack.wav'), '-map', '0:v:0', '-map', '1:a:0', ...video, '-pass', '2', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', '80', '-movflags', '+faststart', out]);
for (const f of fs.readdirSync(path.join(ROOT, 'tmp'))) if (f.startsWith('x2pass')) fs.rmSync(path.join(ROOT, 'tmp', f));
console.log(`humanity_2100_x.mp4  ${(fs.statSync(out).size / 1048576).toFixed(1)} MiB`);
