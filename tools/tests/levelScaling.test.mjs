// Unit tests for level scaling (Level rework L1). Run:  node tools/tests/levelScaling.test.mjs
import { scaleFor, remapLevel, partyScale, playerPower, playerHp, bossScale } from '../../src/progression/levelScaling.js';
import { BOSSES } from '../../src/data/bosses.js';
import { LEVELS } from '../../src/data/levels.js';
import { expToNext } from '../../src/progression/experience.js';
import { CLASS_TREE } from '../../src/data/classTree.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const near = (a, b, e = 1e-9, msg = '') => { if (Math.abs(a - b) > e) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('level scaling');
test('owner rules: cap 50, every Class 2 needs LV 30 and nothing story-bound', () => {
  eq(LEVELS.maxLevel, 50);
  for (const n of Object.values(CLASS_TREE).filter((x) => x.tier === 2)) {
    const lv = (n.requirements || []).find((r) => r.type === 'level');
    ok(lv && lv.min === 30, n.id + ' level');
    ok(!(n.requirements || []).some((r) => r.type === 'quest' && r.id === 'whispers'), n.id + ' still needs the A1 boss');
  }
});
test('same level = no change', () => {
  const s = scaleFor(10, 10); eq(s.hp, 1); eq(s.power, 1); eq(s.exp, 1);
});
test('moving up: hp / def follow player damage, power follows player HP', () => {
  const s = scaleFor(10, 30);
  near(s.hp, playerPower(30) / playerPower(10)); near(s.power, playerHp(30) / playerHp(10));
  ok(s.hp > 1 && s.power > 1, 'stronger');
  ok(s.hp < 2 && s.power < 2, 'not absurd: the player also grows');
});
test('EXP keeps the kills per level (× slope for a wider band)', () => {
  const s = scaleFor(10, 20, 2);
  near(s.exp, (expToNext(20) / expToNext(10)) * 2);
});
test('moving down never goes below the floor', () => {
  const s = scaleFor(45, 1); ok(s.hp >= 0.5 && s.exp >= 0.5, 'floor');
});
test('remapLevel: old band -> new band (clamped) with its slope', () => {
  const band = { from: [1, 10], to: [1, 14] };
  eq(remapLevel(1, band).level, 1); eq(remapLevel(10, band).level, 14); eq(remapLevel(99, band).level, 14);
  near(remapLevel(5, band).slope, 13 / 9);
  eq(remapLevel(7, null).level, 7);
});
test('party scaling (future party system): solo = 1', () => {
  eq(partyScale(1).hp, 1); eq(partyScale(4).hp, 1 + 3 * 0.75); eq(partyScale(0).hp, 1);
});
test('owner level table: Route A bosses 14 / 26 / 38, Route B 17 / 31 / 45', () => {
  const lv = (id) => BOSSES[id].level;
  eq(lv('boss_a1'), 14); eq(lv('boss_a2'), 26); eq(lv('boss_a3'), 38);
  eq(lv('boss_b1'), 17); eq(lv('boss_b2'), 31); eq(lv('boss_b3'), 45);
});
test('Route B bosses are harder than their level alone; B3 the hardest (shorter telegraphs)', () => {
  const k = (id) => bossScale(BOSSES[id]).hp / scaleFor(BOSSES[id].nativeLevel, BOSSES[id].level).hp;
  ok(k('boss_b1') > 1 && k('boss_b2') > k('boss_b1') && k('boss_b3') > k('boss_b2'), 'B difficulty climbs');
  eq(k('boss_a2'), 1, 'Route A: level only');
  ok(bossScale(BOSSES.boss_b3).windup < 1, 'B3 telegraphs shorter');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
