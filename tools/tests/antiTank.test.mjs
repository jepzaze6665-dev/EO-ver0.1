// Combat 2.0 phase C10 — anti-tanking rules. Run:  node tools/tests/antiTank.test.mjs
import { ANTI_TANK } from '../../src/data/antiTank.js';
import { Poise } from '../../src/combat/poiseSystem.js';
import { STATUSES } from '../../src/data/statuses.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const hitPoise = (dmg, maxHp, heavy) => Math.min(ANTI_TANK.hitPoise.max, Math.max(ANTI_TANK.hitPoise.min, (dmg / maxHp) * ANTI_TANK.hitPoise.perHpShare)) + (heavy ? ANTI_TANK.heavyBonus : 0);

console.log('anti-tanking');
test('no single hit (even heavy) can stagger the player', () => {
  ok(ANTI_TANK.hitPoise.max + ANTI_TANK.heavyBonus < ANTI_TANK.poise.max, 'max single hit < poise');
});
test('face-tanking staggers: a handful of ordinary hits in a row breaks poise', () => {
  const p = new Poise(ANTI_TANK.poise.max, ANTI_TANK.poise); let n = 0;
  while (!p.hit(hitPoise(14, 250)) && n < 20) n++;
  ok(n + 1 >= 3 && n + 1 <= 6, `${n + 1} hits`);
});
test('heavy blows stagger faster (2-3 in a row)', () => {
  const p = new Poise(ANTI_TANK.poise.max, ANTI_TANK.poise); let n = 0;
  while (!p.hit(hitPoise(32, 250, true)) && n < 20) n++;
  ok(n + 1 <= 3, `${n + 1} hits`);
});
test('spaced-out hits never stagger (poise regenerates between them)', () => {
  const p = new Poise(ANTI_TANK.poise.max, ANTI_TANK.poise); let broke = false;
  for (let i = 0; i < 20; i++) { if (p.hit(hitPoise(14, 250))) broke = true; p.update(ANTI_TANK.poise.regenDelay + 1); }
  ok(!broke, 'regen');
});
test('stagger is short, exposed is a real but small penalty; statuses exist', () => {
  ok(ANTI_TANK.staggerTime > 0 && ANTI_TANK.staggerTime <= 1, 'stagger time');
  ok(STATUSES.staggered.flags.includes('cannotAct') && STATUSES.exposed.modifiers.damageTakenMult > 1 && STATUSES.exposed.modifiers.damageTakenMult <= 1.25, 'statuses');
  ok(ANTI_TANK.endure.fromHp > 0.5 && ANTI_TANK.endure.fromHp <= 1, 'endure');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
