// thumbnail.png: a poster frame rendered by the film's own code.
import fs from 'node:fs';
import path from 'node:path';
import { launch, ROOT } from './cdp.mjs';

const b = await launch({ tag: 'thumb' });
try {
  await b.open(path.join(ROOT, 'index.html'), '?capture=1');
  await b.evaluate('renderThumb(); 1');
  const url = await b.evaluate(`document.getElementById('film').toDataURL('image/png')`);
  fs.writeFileSync(path.join(ROOT, 'thumbnail.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('thumbnail.png written');
} finally { await b.close(); }
