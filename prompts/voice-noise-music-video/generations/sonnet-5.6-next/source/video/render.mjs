// Renders every frame in headless Edge and pipes them to ffmpeg with the soundtrack.
//   node render.mjs [output.mp4]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStage } from './stage.mjs';

const FPS = 24;
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, '..', 'out', 'take-on-me_six-noises_MV.mp4');

const { page, problems, close } = await openStage();
const duration = await page.evaluate(() => D.duration);
const total = Math.floor(duration * FPS);

const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', path.join(here, '..', 'out', 'soundtrack.wav'),
  '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error('ffmpeg exit ' + code)) : res()));

const started = Date.now();
for (let i = 0; i < total; i++) {
  const url = await page.evaluate(t => { renderFrame(t); return window.OUTPUT.toDataURL('image/jpeg', 0.95); }, i / FPS);
  if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 120 === 0) console.log(`frame ${i}/${total}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  if (problems.length) throw new Error('page error during render: ' + problems[0]);
}
ff.stdin.end();
await done;
await close();
console.log(`done: ${total} frames in ${((Date.now() - started) / 1000).toFixed(0)}s -> ${out}`);
