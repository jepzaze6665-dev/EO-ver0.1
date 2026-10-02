// Class-select art (tools/build-class-art.js -> assets/ui/class). Run: node tools/tests/classArt.test.mjs
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { CLASSES } from '../../src/skills/classes.js';
const require = createRequire(import.meta.url);
const png = require('../png.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);

test('every class has a splash + an emblem, both with a see-through background', () => {
  for (const id of Object.keys(CLASSES)) for (const k of ['splash', 'emblem']) {
    const f = new URL(`assets/ui/class/${id}_${k}.png`, ROOT);
    ok(existsSync(f), `missing ${id}_${k}`);
    const im = png.read(f);
    ok(im.data[3] === 0, `${id}_${k}: corner not transparent`);
  }
});

test('splash bodies are solid (dark costumes not eaten): the middle column of the figure is opaque', () => {
  for (const id of Object.keys(CLASSES)) {
    const im = png.read(new URL(`assets/ui/class/${id}_splash.png`, ROOT));
    let solid = 0, n = 0;
    for (let y = Math.floor(im.height * 0.3); y < im.height * 0.7; y++) { const x = Math.floor(im.width / 2); n++; if (im.data[(y * im.width + x) * 4 + 3] > 200) solid++; }
    ok(solid / n > 0.6, `${id}: only ${Math.round((solid / n) * 100)}% of the body column is solid`);
  }
});

test('the class select screen uses the class art', () => {
  const src = readFileSync(new URL('src/ui/panels.js', ROOT), 'utf8');
  ok(src.includes('assets/ui/class/${sel}_splash.png') && src.includes('assets/ui/class/${id}_emblem.png'), 'panels.classSelect');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
