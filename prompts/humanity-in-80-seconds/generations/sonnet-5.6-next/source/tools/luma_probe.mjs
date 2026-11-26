// Quick look at mean luma straight from the page over chosen windows: the largest
// frame-to-frame step and any one-frame crest, before spending time on a render.
//   node tools/luma_probe.mjs 24.8-27.9 59.3-61.0
import path from 'node:path';
import { launch, ROOT } from './cdp.mjs';

const b = await launch({ tag: 'luma' });
try {
  await b.open(path.join(ROOT, 'index.html'), '?capture=1');
  await b.evaluate(`window.__y = (k) => { renderAt(k/24); const c = window.__c || (window.__c = Object.assign(document.createElement('canvas'), {width:192, height:108}));
    const x = c.getContext('2d', {willReadFrequently:true}); x.drawImage(document.getElementById('film'),0,0,192,108); const d = x.getImageData(0,0,192,108).data;
    let s = 0; for (let i=0;i<d.length;i+=4) s += 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; return s/(192*108); }; 1`);
  for (const w of process.argv.slice(2)) {
    const [a, z] = w.split('-').map(Number);
    const ys = [];
    for (let k = Math.round(a * 24); k <= Math.round(z * 24); k++) ys.push([k, await b.evaluate(`__y(${k})`)]);
    let worst = [0, 0];
    const crests = [];
    for (let i = 1; i < ys.length; i++) {
      const d = ys[i][1] - ys[i - 1][1];
      if (Math.abs(d) > Math.abs(worst[1])) worst = [ys[i][0], d];
      if (i + 1 < ys.length) {
        const u = ys[i][1] - ys[i - 1][1], v = ys[i][1] - ys[i + 1][1];
        if (u * v > 0 && Math.min(Math.abs(u), Math.abs(v)) > 1.7) crests.push(`f${ys[i][0]} (${u.toFixed(1)})`);
      }
    }
    console.log(`${w}: largest step ${worst[1].toFixed(2)} at t=${(worst[0] / 24).toFixed(3)}; one-frame crests: ${crests.join(', ') || 'none'}`);
  }
} finally { await b.close(); }
