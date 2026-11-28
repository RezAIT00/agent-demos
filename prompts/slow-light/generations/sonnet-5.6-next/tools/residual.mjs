// Debug: lamp light still on screen = frame(t) minus the same frame with the lamps never lit.
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './browser.mjs';
const [out, times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { browser, page } = await openPage('samples=6');
for (const t of times.split(',').map(Number)) {
  for (const dark of [false, true]) {
    const url = await page.evaluate(([t, d]) => { window.setLampsNeverLit(d); window.renderAt(t); return window.slow.frameData(); }, [t, dark]);
    fs.writeFileSync(path.join(out, `${dark ? 'base' : 'lit'}${t.toFixed(2)}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
