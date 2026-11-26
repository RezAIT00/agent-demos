// Put the current soundtrack.wav into the already rendered master without
// touching the picture (the video stream is copied bit for bit).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';

const master = path.join(ROOT, 'humanity_2100.mp4');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
const tmp = path.join(ROOT, 'tmp', 'remux.mp4');
const md5 = (f) => spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-map', '0:v:0', '-c', 'copy', '-f', 'md5', '-'], { encoding: 'utf8' }).stdout.trim();
const before = md5(master);
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', master, '-i', path.join(ROOT, 'soundtrack.wav'), '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', '80', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
const same = md5(tmp) === before;
if (!same) { console.error('video stream changed; keeping the old file'); process.exit(1); }
fs.renameSync(tmp, master);
console.log('soundtrack replaced; video stream identical: ' + before);
