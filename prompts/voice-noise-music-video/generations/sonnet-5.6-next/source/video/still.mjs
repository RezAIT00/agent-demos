// Render chosen moments (or a test sketch) to PNG so they can be inspected.
//   node still.mjs <outDir> t1 t2 ...            frames at those seconds
//   node still.mjs <outDir> --sheet name t1 ...  one contact sheet of those frames
//   node still.mjs <outDir> --eval file.js name  run a sketch against the engine
import fs from 'node:fs';
import path from 'node:path';
import { openStage } from './stage.mjs';

const [outDir, ...rest] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { page, close } = await openStage();
const save = (name, url) => fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));

if (rest[0] === '--eval') {
  await page.addScriptTag({ content: fs.readFileSync(rest[1], 'utf8') });
  save(rest[2] + '.png', await page.evaluate(() => window.sketch()));
} else if (rest[0] === '--sheet') {
  const times = rest.slice(2).map(Number);
  const url = await page.evaluate(ts => {
    const cols = 3, cw = 640, ch = 360, c = document.createElement('canvas');
    c.width = cols * cw; c.height = Math.ceil(ts.length / cols) * ch;
    const g = c.getContext('2d');
    ts.forEach((t, i) => {
      renderFrame(t);
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      g.drawImage(window.OUTPUT, x, y, cw, ch);
      g.fillStyle = '#000'; g.fillRect(x, y, 74, 24); g.fillStyle = '#0f0'; g.font = '18px monospace'; g.fillText(t.toFixed(2), x + 6, y + 18);
    });
    return c.toDataURL('image/png');
  }, times);
  save(rest[1] + '.png', url);
} else {
  for (const t of rest.map(Number)) {
    save(`t${t.toFixed(2)}.png`, await page.evaluate(tt => { renderFrame(tt); return window.OUTPUT.toDataURL('image/png'); }, t));
  }
}
await close();
