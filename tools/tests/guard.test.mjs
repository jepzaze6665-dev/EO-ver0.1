// Unit tests for the generic guard (block) rule + Aegis Guardian data. Run:  node tools/tests/guard.test.mjs
import { evaluateBlock, GUARD_RULES } from '../../src/combat/guardSystem.js';
import { AegisGuardian } from '../../src/skills/aegisGuardian.js';
import { MARKS } from '../../src/data/marks.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { StatusSet } from '../../src/status/status.js';
import { REQUIREMENTS } from '../../src/combat/skillSystem.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const G = AegisGuardian.guard;
const on = (since) => ({ active: true, since });

console.log('guardSystem');
test('no guard / inactive guard -> not blocked', () => {
  ok(evaluateBlock(null, on(0), 0, 10, 0, 1) === null, 'no data');
  ok(evaluateBlock(G, { active: false, since: 0 }, 0, 10, 0, 1) === null, 'inactive');
});
test('frontal hit after the perfect window: reduced by data', () => {
  const r = evaluateBlock(G, on(0), 0, 10, 0, 1);
  ok(r && !r.perfect && Math.abs(r.mult - (1 - G.reduction)) < 1e-9, JSON.stringify(r));
});
test('hit inside the perfect window: PERFECT, no damage', () => {
  const r = evaluateBlock(G, on(1), 0, 10, 0, 1 + G.perfectWindow - 0.01);
  ok(r && r.perfect && r.mult === 0, JSON.stringify(r));
  ok(!evaluateBlock(G, on(1), 0, 10, 0, 1 + G.perfectWindow + 0.01).perfect, 'just after the window');
});
test('arc: hits from behind or the far side are not covered', () => {
  ok(evaluateBlock(G, on(0), 0, -10, 0, 1) === null, 'behind');
  ok(evaluateBlock(G, on(0), 0, 0, 10, 1) === null, 'side (90° > arc)');
  ok(evaluateBlock(G, on(0), Math.PI, -10, 0, 1) !== null, 'facing west, hit from west');
  ok(evaluateBlock(G, on(0), 3.1, -10, -0.5, 1) !== null, 'angle wrap around ±π');
});
test('bad data is clamped: no 100% block, no huge windows, NaN ignored', () => {
  const r = evaluateBlock({ arc: 99, reduction: 5, perfectWindow: 99 }, on(0), 0, 10, 0, 5);
  ok(r && r.mult >= 1 - GUARD_RULES.maxReduction - 1e-9 && !r.perfect, JSON.stringify(r));
  ok(evaluateBlock(G, on(0), 0, NaN, 0, 1) === null && evaluateBlock(G, on(0), 0, 0, 0, 1) === null, 'NaN / zero vector');
});

console.log('aegis guardian data');
test('class data matches the shared schema and core data', () => {
  const c = AegisGuardian;
  ok(RESOURCES[c.resource] && MARKS[c.enemyMark] && STATUSES.taunted, 'resource / mark / status exist');
  ok(c.skills.filter((s) => s.type === 'ultimate').length === 1 && c.special && c.special.hold, 'kit');
  for (const s of [...c.skills, c.special]) {
    ok(s.id && s.name && typeof s.cast === 'function' && s.cooldown > 0, 'skill ' + s.id);
    for (const r of s.requirements || []) ok(REQUIREMENTS[r.type], 'requirement ' + r.type);
  }
  for (const [k, v] of Object.entries(c.charge)) ok(Number.isFinite(v) && v > 0, 'charge ' + k);
  ok(c.defaultLoadout.every((id) => c.skills.some((s) => s.id === id)), 'loadout ids');
});
test('taunted status: monster damage -20%, flag set', () => {
  const st = new StatusSet({ id: 1 });
  st.add('taunted', 8);
  ok(Math.abs(st.damageMult() - 0.8) < 1e-9 && st.flag('taunted'), 'taunted');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
