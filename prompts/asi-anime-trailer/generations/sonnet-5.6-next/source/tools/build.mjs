// Concatenate src/*.js (in filename order) into one self-contained index.html.
//   node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function build() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const src = path.join(root, 'src');
  const files = fs.readdirSync(src).filter(f => f.endsWith('.js')).sort();
  const js = files.map(f => `// ===== src/${f} =====\n` + fs.readFileSync(path.join(src, f), 'utf8').replace(/^'use strict';\r?\n/, '')).join('\n');
  const shell = fs.readFileSync(path.join(src, 'shell.html'), 'utf8');
  const html = shell.replace('/*__SCRIPT__*/', () => `'use strict';\n${js}`);
  fs.writeFileSync(path.join(root, 'index.html'), html);
  return { files, bytes: html.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = build();
  console.log(`index.html built from ${r.files.length} files, ${(r.bytes / 1024).toFixed(0)} KB`);
}
