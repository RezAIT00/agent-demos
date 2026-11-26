// Per-second loudness profile of a WAV/MP4 (K-weighted via ffmpeg), plus
// waveform and spectrogram pictures for looking at the mix.
//   node tools/audio/profile.mjs soundtrack.wav tmp/stills
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const input = path.resolve(process.argv[2] || 'soundtrack.wav');
const outDir = path.resolve(process.argv[3] || 'tmp/stills');

const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', input, '-af', 'aformat=sample_rates=48000,ebur128=metadata=1:peak=true,ametadata=print:file=-', '-vn', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const mom = [];
let tm = 0;
for (const line of r.stdout.split('\n')) {
  let m = /pts_time:([\d.]+)/.exec(line);
  if (m) tm = Number(m[1]);
  m = /lavfi\.r128\.M=(-?[\d.]+)/.exec(line);
  if (m) mom.push([tm, Number(m[1])]);
}
const rows = [];
for (let s = 0; s < 80; s++) {
  const v = mom.filter(([t]) => t >= s + 0.35 && t < s + 1.35).map(([, x]) => x);
  rows.push(v.length ? Math.max(...v) : -120);
}
console.log('loudest momentary LUFS in each second');
for (let s = 0; s < 80; s += 8) console.log(String(s).padStart(3) + ' | ' + rows.slice(s, s + 8).map((x) => x.toFixed(1).padStart(6)).join(' '));

spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-lavfi', 'showwavespic=s=1920x360:split_channels=0:colors=#7fd0ff', '-frames:v', '1', path.join(outDir, 'wave.png')]);
spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-lavfi', 'aformat=channel_layouts=mono,showspectrumpic=s=1920x620:legend=0:fscale=log:scale=log:color=magma:start=30:stop=12000:drange=90', '-frames:v', '1', path.join(outDir, 'spectrum.png')]);
