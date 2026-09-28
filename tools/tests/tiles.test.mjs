// Tile skins (tools/build-tiles.js -> assets/tiles) + the props a grid's terrain names. Run: node tools/tests/tiles.test.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { T } from '../../src/core/constants.js';
import { LEVELS } from '../../src/world/levels/index.js';
const require = createRequire(import.meta.url);
const png = require('../png.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);
const tiles = JSON.parse(readFileSync(new URL('assets/tiles/tiles.json', ROOT)));
const props = JSON.parse(readFileSync(new URL('assets/props/props.json', ROOT)));

console.log('tile skins');
test('every grid skin exists; rows name real tile types or wall faces; png size matches', () => {
  for (const L of Object.values(LEVELS)) if (L.skin) ok(tiles[L.skin], `${L.id}: skin ${L.skin}`);
  for (const [id, s] of Object.entries(tiles)) {
    ok(existsSync(new URL(s.file, ROOT)), `${id}: ${s.file}`);
    const im = png.read(new URL(s.file, ROOT));
    ok(im.width === s.tile * s.variants && im.height === s.tile * Object.keys(s.rows).length, `${id}: ${im.width}x${im.height}`);
    for (const name of Object.keys(s.rows)) ok(name.startsWith('face:') ? ['cliff', 'wall', 'cave'].includes(name.slice(5)) : T[name] !== undefined, `${id}: row ${name}`);
  }
});
test('skin tiles repeat without a seam (opposite edges match closely)', () => {
  for (const [id, s] of Object.entries(tiles)) {
    const im = png.read(new URL(s.file, ROOT));
    for (const [name, row] of Object.entries(s.rows)) {
      if (name.startsWith('face:')) continue;
      for (let v = 0; v < s.variants; v++) {
        let diff = 0, n = 0;
        const px = (x, y) => { const i = ((row * s.tile + y) * im.width + v * s.tile + x) * 4; return im.data[i] + im.data[i + 1] + im.data[i + 2]; };
        for (let k = 0; k < s.tile; k++) { diff += Math.abs(px(0, k) - px(s.tile - 1, k)) + Math.abs(px(k, 0) - px(k, s.tile - 1)); n += 2; }
        ok(diff / n < 120, `${id}.${name}[${v}]: edge difference ${(diff / n).toFixed(0)}`);
      }
    }
  }
});
test('every prop named by the A2 terrain exists in props.json', () => {
  const src = readFileSync(new URL('src/maps/ancientValley.js', ROOT), 'utf8');
  const names = new Set(src.match(/'v_[a-z_]+'/g).map((s) => s.slice(1, -1)));
  for (const n of names) ok(props[n], `missing prop ${n}`);
  ok(names.size > 30, 'uses the owner\'s A2 props');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
