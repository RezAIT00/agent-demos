// Render selected times to PNG for review:  node shot.mjs outdir 1.5,3,5 [query]
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './browser.mjs';
const [out, times, query = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { browser, page, info } = await openPage(query);
console.log(info);
for (const t of times.split(',').map(Number)) {
  const t0 = Date.now();
  const url = await page.evaluate(t => { window.renderAt(t); return window.slow.frameData(); }, t);
  const f = path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`);
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log(f, (Date.now() - t0) + ' ms');
}
await browser.close();
