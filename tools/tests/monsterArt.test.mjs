// Monster sheet art (tools/build-monsters.js -> assets/monsters, frame choice data/monsterArt.js).
// Run:  node tools/tests/monsterArt.test.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { MONSTER_ART } from '../../src/data/monsterArt.js';
import { MONSTERS } from '../../src/monsters/monsterTypes.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';
const require = createRequire(import.meta.url);
const png = require('../png.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('assets/monsters/monsters.json', ROOT)));
const opaque = (im, x0, y0, w, h) => {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (im.data[(y * im.width + x) * 4 + 3] > 60) n++;
  return n;
};
const specFrames = (m, spec) => {
  if (Array.isArray(spec) && Array.isArray(spec[0])) { const parts = spec.map((s) => specFrames(m, s)); return parts.every(Boolean) ? parts.flat() : null; } // list of pieces
  const [row, idx] = Array.isArray(spec) ? spec : [spec, null];
  const all = m.anims[row];
  return all && (idx ? idx.map((i) => all[i]) : all);
};

console.log('monster art');
test('every art entry names a built atlas whose png exists and matches its cells', () => {
  for (const [id, art] of Object.entries(MONSTER_ART)) {
    const m = meta[art.sheet];
    ok(m, `${id}: no atlas '${art.sheet}' in monsters.json`);
    ok(existsSync(new URL(m.file, ROOT)), `${id}: missing ${m.file}`);
    const im = png.read(new URL(m.file, ROOT));
    for (const fr of Object.values(m.anims).flat()) ok(fr[0] + m.fw <= im.width && fr[1] + m.fh <= im.height, `${id}: frame outside the png`);
  }
});
test('every anim points at existing rows / frames, and every frame has art (no empty cell)', () => {
  for (const [id, art] of Object.entries(MONSTER_ART)) {
    const m = meta[art.sheet], im = png.read(new URL(m.file, ROOT));
    const specs = { ...art.anims };
    for (const [aid, a] of Object.entries(art.attacks || {})) { if (a.windup) specs[aid + '.windup'] = a.windup; if (a.attack) specs[aid + '.attack'] = a.attack; }
    for (const [name, spec] of Object.entries(specs)) {
      const fr = specFrames(m, spec);
      ok(fr && fr.length && fr.every(Boolean), `${id}.${name}: bad spec ${JSON.stringify(spec)}`);
      for (const [x, y] of fr) ok(opaque(im, x, y, m.fw, m.fh) > 30, `${id}.${name}: empty frame at ${x},${y}`);
    }
    for (const need of ['idle', 'move', 'windup', 'attack', 'hurt']) ok(art.anims[need], `${id}: needs '${need}'`);
  }
});
test('background removed: the atlas corners are transparent', () => {
  for (const m of Object.values(meta)) {
    const im = png.read(new URL(m.file, ROOT));
    ok(opaque(im, 0, 0, 3, 3) === 0 && opaque(im, im.width - 3, im.height - 3, 3, 3) === 0, `${m.file} corner not transparent`);
  }
});
test('Guardian poses map to anims that exist', () => {
  const g = MONSTER_ART.forest_guardian;
  for (const [pose, anim] of Object.entries(g.poses)) if (typeof anim === 'string') ok(g.anims[anim] || anim === 'move', `pose ${pose} -> ${anim}`);
  for (const anim of Object.values(g.poses.corrupted)) ok(g.anims[anim], `corrupted -> ${anim}`);
});
test('monsters using sheet art: sprite key covered, loot table exists', () => {
  const keys = new Set(Object.values(MONSTER_ART).flatMap((a) => a.replaces));
  ok(keys.has(MONSTERS.rabbit.sprite) && keys.has(MONSTERS.wolf.sprite), 'rabbit / wolf art');
  ok(LOOT_TABLES[MONSTERS.rabbit.loot], 'rabbit loot');
  ok(MONSTERS.rabbit.enrage && MONSTERS.rabbit.enrage.below < 1, 'rabbit enrage data');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
