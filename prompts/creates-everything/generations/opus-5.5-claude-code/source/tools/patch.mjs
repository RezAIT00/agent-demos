// tiny helper: node tools/patch.mjs patchfile.json   [{f,a,b}]
import fs from 'node:fs';
for (const p of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) { let s = fs.readFileSync('src/' + p.f, 'utf8'); if (!s.includes(p.a)) { console.log('MISS', p.f, p.a.slice(0, 90)); continue; } s = s.replace(p.a, () => p.b); fs.writeFileSync('src/' + p.f, s); }
console.log('patched');
