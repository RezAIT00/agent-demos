// DELIVERY CHECKS: container, frame count, durations, full decode, loudness,
// true peak and clipping, for both MP4s and the WAV. Writes checks.txt.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 29, ...opts });
const out = [];
const verdict = [];
const check = (name, ok, detail = '') => { verdict.push(ok); out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`); };

function loudness(file) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  return {
    i: Number(/I:\s+(-?[\d.]+) LUFS/.exec(tail)[1]),
    lra: Number(/LRA:\s+(-?[\d.]+) LU/.exec(tail)[1]),
    tp: Number(/True peak:[\s\S]*?Peak:\s+(-?[\d.]+) dBFS/.exec(tail)[1]),
  };
}
function samples(file) {
  const r = run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'], { encoding: 'buffer' });
  const a = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2);
  let peak = 0, clipped = 0;
  for (const v of a) { const m = Math.abs(v); if (m > peak) peak = m; if (m >= 0.9999) clipped++; }
  return { frames: a.length / 2, peak, clipped };
}
const atoms = (file) => {
  const fd = fs.openSync(file, 'r'), size = fs.statSync(file).size, order = [];
  let pos = 0;
  const h = Buffer.alloc(16);
  while (pos < size && order.length < 12) {
    fs.readSync(fd, h, 0, 16, pos);
    let len = h.readUInt32BE(0);
    order.push(h.toString('latin1', 4, 8));
    if (len === 1) len = Number(h.readBigUInt64BE(8));
    if (len < 8) break;
    pos += len;
  }
  fs.closeSync(fd);
  return order;
};

for (const name of ['humanity_2100.mp4', 'humanity_2100_x.mp4']) {
  const file = path.join(ROOT, name);
  out.push(`\n--- ${name} ---`);
  if (!fs.existsSync(file)) { check(`${name} exists`, false); continue; }
  const p = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).stdout);
  const v = p.streams.find((s) => s.codec_type === 'video'), a = p.streams.find((s) => s.codec_type === 'audio');
  const mb = fs.statSync(file).size / 1048576;
  out.push(`size ${mb.toFixed(1)} MiB, total bitrate ${(p.format.bit_rate / 1e6).toFixed(2)} Mbit/s, video ${(v.bit_rate / 1e6).toFixed(2)} Mbit/s, audio ${(a.bit_rate / 1000).toFixed(0)} kbit/s`);
  check('H.264, 1920x1080, yuv420p, 24 fps', v.codec_name === 'h264' && v.width === 1920 && v.height === 1080 && v.pix_fmt === 'yuv420p' && v.r_frame_rate === '24/1', `${v.codec_name} ${v.profile} ${v.width}x${v.height} ${v.pix_fmt} ${v.r_frame_rate}`);
  check('exactly 1,920 video frames (counted by decoding)', Number(v.nb_read_frames) === 1920, v.nb_read_frames);
  check('video duration 80.000 s', Math.abs(Number(v.duration) - 80) < 0.0005, `${v.duration} s`);
  check('audio stream duration matches (80.000 s)', Math.abs(Number(a.duration) - 80) < 0.0005, `${a.duration} s, ${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch`);
  check('container duration 80.000 s', Math.abs(Number(p.format.duration) - 80) < 0.0015, `${p.format.duration} s`);
  const order = atoms(file);
  check('+faststart (moov before mdat)', order.indexOf('moov') >= 0 && order.indexOf('moov') < order.indexOf('mdat'), order.join(' '));
  const dec = run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  check('full decode with ffmpeg -v error is clean', dec.status === 0 && dec.stderr.trim() === '', dec.stderr.trim().slice(0, 300) || 'no messages');
  const l = loudness(file), s = samples(file);
  check('integrated loudness about -14 LUFS', Math.abs(l.i + 14) <= 0.5, `${l.i.toFixed(1)} LUFS, loudness range ${l.lra.toFixed(1)} LU`);
  check('true peak at or below -1 dBTP', l.tp <= -1.0, `${l.tp.toFixed(1)} dBTP`);
  check('no clipped samples after decoding', s.clipped === 0, `${s.clipped} clipped, sample peak ${(20 * Math.log10(s.peak)).toFixed(2)} dBFS`);
  out.push(`decoded audio length: ${s.frames} sample frames = ${(s.frames / 48000).toFixed(4)} s`);
}
{
  const file = path.join(ROOT, 'soundtrack.wav');
  out.push('\n--- soundtrack.wav ---');
  const l = loudness(file), s = samples(file);
  check('WAV is exactly 80.000 s (3,840,000 sample frames)', s.frames === 3840000, `${s.frames}`);
  check('WAV about -14 LUFS, true peak <= -1 dBTP, no clipping', Math.abs(l.i + 14) <= 0.5 && l.tp <= -1 && s.clipped === 0, `${l.i.toFixed(1)} LUFS, ${l.tp.toFixed(1)} dBTP, ${s.clipped} clipped, LRA ${l.lra.toFixed(1)} LU`);
}
const du = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? du(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
out.push('\n--- folder ---');
const total = du(ROOT);
check('output folder under 3 GB', total < 3e9, `${(total / 1048576).toFixed(0)} MiB`);

const text = `DELIVERY CHECKS\n${'='.repeat(70)}\n${out.join('\n')}\n\nOVERALL: ${verdict.every(Boolean) ? 'PASS' : 'FAIL'} (${verdict.filter(Boolean).length}/${verdict.length})\n`;
fs.writeFileSync(path.join(ROOT, 'checks.txt'), text);
console.log(text);
if (!verdict.every(Boolean)) process.exitCode = 1;
