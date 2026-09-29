// Unit tests for the level / EXP rules. Run:  node tools/tests/experience.test.mjs
import { expToNext, addExp, normalize, levelStats } from '../../src/progression/experience.js';
import { LEVELS } from '../../src/data/levels.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('experience');
test('new characters start at level 1, cap is 50', () => { eq(LEVELS.start.level, 1); eq(LEVELS.maxLevel, 50); });
test('EXP curve comes from data and grows every level', () => {
  eq(expToNext(1), 60); eq(expToNext(2), 95); eq(expToNext(3), 140);
  for (let l = 1; l < 29; l++) ok(expToNext(l + 1) > expToNext(l), `level ${l}`);
  eq(expToNext(50), 0, 'no next level at the cap');
});
test('a per-level table overrides the formula', () => {
  const rules = { ...LEVELS, table: { 2: 500 } };
  eq(expToNext(2, rules), 500); eq(expToNext(3, rules), expToNext(3));
});
test('addExp levels up (several levels at once) and keeps the rest', () => {
  const s = addExp(1, 0, 60 + 95 + 10);
  eq(s.level, 3); eq(s.exp, 10); eq(s.levelsGained, 2);
  const t = addExp(1, 50, 5); eq(t.level, 1); eq(t.exp, 55); eq(t.levelsGained, 0);
});
test('negative / invalid EXP is ignored (no negative EXP, no level loss)', () => {
  const s = addExp(4, 10, -500); eq(s.level, 4); eq(s.exp, 10);
  const t = addExp(4, 10, NaN); eq(t.level, 4); eq(t.exp, 10);
});
test('stops at the level cap (no infinite EXP)', () => {
  const s = addExp(49, 0, 1e9); eq(s.level, 50); eq(s.exp, 0);
  const t = addExp(50, 0, 500); eq(t.level, 50); eq(t.exp, 0); eq(t.levelsGained, 0);
});
test('normalize repairs bad saves', () => {
  const a = normalize(99, 5); eq(a.level, 50); eq(a.exp, 0);
  const b = normalize(0, -20); eq(b.level, 1); eq(b.exp, 0);
  const c = normalize(2, 1000); ok(c.level > 2 && c.exp < expToNext(c.level), 'overflow EXP turns into levels');
});
test('level stats scale class perLevel by statGrowth (level 1 = base)', () => {
  const per = { hp: 12, atk: 1.5 };
  eq(levelStats(per, 1).hp, 0);
  eq(levelStats(per, 11).atk, 1.5 * 10 * LEVELS.statGrowth);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
