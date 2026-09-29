// Unit tests for spawn density (more monsters per map). Run:  node tools/tests/spawnDensity.test.mjs
import { densify, ordinary } from '../../src/world/spawnDensity.js';
import { DIFFICULTY } from '../../src/data/difficulty.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const T = 32;
// open 120×120 field with a wall column at tx 60 (the right half is another map)
const map = { w: 120, h: 120, isTerrainSolid: (tx) => tx === 60, zoneAt: () => 1 };
const mapAt = (x) => (x < 60 * T ? 'left' : 'right');
const at = (tx, ty, extra = {}) => ({ def: { type: 'wolf', count: 2, radius: 2, x: (tx + 0.5) * T, y: (ty + 0.5) * T, ...extra } });
const world = () => [at(10, 10), at(30, 20), at(20, 40), at(40, 45, { count: 3 }), at(15, 70),
  at(25, 25, { tutorial: true, count: 3 }), at(45, 80, { unique: true, count: 1 }), at(50, 60, { elite: true, count: 1 }), at(80, 30)];
const rules = DIFFICULTY.spawnDensity;
const count = (list, f = () => true) => list.filter((sp) => f(sp.def)).reduce((s, sp) => s + sp.def.count, 0);

console.log('spawn density');
test('ordinary monsters of each map reach ×density (±1)', () => {
  const sps = world(); const before = { left: count(sps, (d) => ordinary(d) && mapAt(d.x) === 'left') };
  const extra = densify(sps, map, mapAt, rules, 3);
  const after = count([...sps, ...extra], (d) => (ordinary(d) || d.extra) && mapAt(d.x) === 'left');
  ok(Math.abs(after - Math.round(before.left * rules.density)) <= 1, `left ${before.left} -> ${after}`);
});
test('new packs stay in their own map, on open ground, spaced out', () => {
  const sps = world(); const extra = densify(sps, map, mapAt, rules, 3);
  ok(extra.length > 0, 'some new packs');
  for (const sp of extra) {
    ok(mapAt(sp.def.x) === 'left' || mapAt(sp.def.x) === 'right', 'map');
    ok(!map.isTerrainSolid(Math.floor(sp.def.x / T)), 'open');
    ok(sp.def.extra && !sp.def.id, 'marked extra, no id');
  }
  const all = [...sps, ...extra].map((s) => s.def);
  for (const a of extra) for (const b of all) if (a.def !== b && b !== a.def) ok(a.def === b || Math.hypot(a.def.x - b.x, a.def.y - b.y) >= rules.gap * T - 1 || b === a.def, 'gap');
});
test('tutorial / unique / elite spawns are never touched or copied', () => {
  const sps = world(); const extra = densify(sps, map, mapAt, rules, 3);
  eq(sps[5].def.count, 3, 'tutorial'); eq(sps[6].def.count, 1, 'unique'); eq(sps[7].def.count, 1, 'elite');
  ok(extra.every((sp) => !sp.def.tutorial && !sp.def.unique && !sp.def.elite), 'no special copies');
});
test('deterministic: the same seed gives the same packs; density 1 = nothing', () => {
  const a = densify(world(), map, mapAt, rules, 9).map((s) => `${s.def.x},${s.def.y},${s.def.count}`).join();
  const b = densify(world(), map, mapAt, rules, 9).map((s) => `${s.def.x},${s.def.y},${s.def.count}`).join();
  eq(a, b);
  eq(densify(world(), map, mapAt, { ...rules, density: 1 }, 9).length, 0);
});
test('most extra monsters come as NEW packs (packs grow by +1 at most)', () => {
  const sps = world(); const before = sps.map((s) => s.def.count);
  const extra = densify(sps, map, mapAt, rules, 3);
  sps.forEach((s, i) => ok(s.def.count - before[i] <= rules.packBonus, 'pack +1 at most'));
  const grown = sps.reduce((s, sp, i) => s + sp.def.count - before[i], 0);
  ok(count(extra) >= grown, `new ${count(extra)} vs grown ${grown}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
