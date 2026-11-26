// Assembles src/ into the single-file game: blockworld.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const shared = ['noise.js', 'blocks.js', 'worldgen.js', 'mesher.js', 'lod.js', 'texgen.js', 'worker.js'].map((f) => read('src/shared/' + f)).join('\n');
const mainDir = path.join(root, 'src/main');
const main = fs.readdirSync(mainDir).filter((f) => f.endsWith('.js')).sort().map((f) => `// ─── ${f} ───\n` + fs.readFileSync(path.join(mainDir, f), 'utf8')).join('\n');
for (const [name, src] of [['shared', shared], ['main', main]]) if (src.includes('</script')) throw new Error(name + ' contains a closing script tag');
const page = read('src/page.html')
  .replace('/*__STYLE__*/', () => read('src/style.css'))
  .replace('/*__SHARED__*/', () => shared)
  .replace('/*__MAIN__*/', () => main);
fs.writeFileSync(path.join(root, 'blockworld.html'), page);

// syntax check both script bodies so mistakes surface at build time
const tmp = path.join(root, 'tools/.check.mjs');
fs.writeFileSync(tmp, "import * as THREE from 'three';\n" + main);
fs.writeFileSync(tmp.replace('.check', '.checkshared'), shared);
console.log('built blockworld.html', (page.length / 1024).toFixed(0), 'KB');
