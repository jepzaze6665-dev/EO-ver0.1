// Boss effects (tools/build-boss-vfx.js -> assets/vfx/boss) + signature mechanics named by boss data.
// Run:  node tools/tests/bossVfx.test.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { liveBosses } from '../../src/data/bosses.js';
import { MECHANIC_TYPES } from '../../src/boss/mechanics.js';
const require = createRequire(import.meta.url);
const png = require('../png.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('assets/vfx/boss.json', ROOT)));

console.log('boss vfx');
test('3 boss sheets x 13 effects built; strip sizes match the files', () => {
  for (const p of ['g', 'm', 'r']) ok(Object.keys(meta).filter((k) => k.startsWith(p + '_')).length === 13, `prefix ${p}`);
  for (const [n, v] of Object.entries(meta)) {
    ok(existsSync(new URL(v.file, ROOT)), `${n}: file`);
    const im = png.read(new URL(v.file, ROOT));
    ok(im.width === v.fw * v.frames && im.height === v.fh && v.frames >= 4, `${n}: ${im.width}x${im.height} vs ${v.fw}x${v.fh} x${v.frames}`);
  }
});
test('every effect a live boss names exists; every mechanic type is known', () => {
  for (const b of liveBosses()) {
    for (const [k, n] of Object.entries((b.look && b.look.vfx) || {})) ok(meta[n], `${b.id}.vfx.${k}: ${n}`);
    for (const m of b.mechanics || []) ok(MECHANIC_TYPES.includes(m.type), `${b.id}: mechanic ${m.type}`);
  }
});
test('every live boss has something of its own (a signature mechanic or its own fight code)', () => {
  for (const b of liveBosses()) if (b.type !== 'mini') ok(b.impl !== 'area' || (b.mechanics || []).length, `${b.id}: no signature mechanic`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
