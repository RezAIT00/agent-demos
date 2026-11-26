// Render stills (and optionally a contact sheet) from index.html.
//   node tools/stills.mjs 0 12.5 40          -> tmp/stills/t012.50.png ...
//   node tools/stills.mjs --sheet [out.png]  -> one frame every 2 s + final frame
//   node tools/stills.mjs --grid out.png 1 2 3 ...  -> a sheet of the given times
import fs from 'node:fs';
import path from 'node:path';
import { launch, ROOT } from './cdp.mjs';

const argv = process.argv.slice(2);
const outDir = path.join(ROOT, 'tmp', 'stills');
fs.mkdirSync(outDir, { recursive: true });
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

const b = await launch({ tag: 'stills' });
try {
  await b.open(path.join(ROOT, 'index.html'), '?capture=1');
  const sheet = async (times, out, cols) => {
    await b.evaluate(`window.__sheet = async function(times, cols){
      const cw = 480, ch = 270, lab = 30;
      const rows = Math.ceil(times.length/cols);
      const c = document.createElement('canvas'); c.width = cols*cw + (cols+1)*6; c.height = rows*(ch+lab) + (rows+1)*6;
      const x = c.getContext('2d'); x.fillStyle = '#16161c'; x.fillRect(0,0,c.width,c.height);
      for (let i=0;i<times.length;i++){
        const t = times[i]; const h = renderAt(t);
        const cx = 6 + (i%cols)*(cw+6), cy = 6 + Math.floor(i/cols)*(ch+lab+6);
        x.drawImage(document.getElementById('film'), cx, cy, cw, ch);
        FONT.draw(x, t.toFixed(2)+' s   ' + h.year + '   ' + h.rate, cx+4, cy+ch+22, 14, {color:'#e8e8f0', weight:1.8, halo:0});
      }
      return c.toDataURL('image/png');
    }; 1`);
    save(out, await b.evaluate(`__sheet(${JSON.stringify(times)}, ${cols})`, { awaitPromise: true }));
    console.log('sheet ->', out);
  };
  if (argv[0] === '--sheet') {
    const times = [];
    for (let s = 0; s < 80; s += 2) times.push(s);
    times.push(1919 / 24);
    await sheet(times, path.resolve(argv[1] || path.join(ROOT, 'contact_sheet.png')), 6);
  } else if (argv[0] === '--grid') {
    const times = argv.slice(2).map(Number);
    await sheet(times, path.resolve(argv[1]), times.length <= 4 ? 2 : times.length <= 9 ? 3 : 4);
  } else {
    for (const a of argv) {
      const t = Number(a);
      const t0 = Date.now();
      await b.evaluate(`renderAt(${t}); 1`);
      const url = await b.evaluate(`document.getElementById('film').toDataURL('image/png')`);
      const file = path.join(outDir, `t${t.toFixed(2).padStart(6, '0')}.png`);
      save(file, url);
      console.log(file, `${Date.now() - t0} ms`);
    }
  }
  const bad = b.logs.filter((l) => /EXCEPTION|error|WebGL/i.test(l));
  if (bad.length) console.log('page log:\n' + bad.slice(0, 20).join('\n'));
} catch (e) {
  console.error(String(e));
  console.error(b.logs.slice(0, 40).join('\n'));
  process.exitCode = 1;
} finally {
  await b.close();
}
