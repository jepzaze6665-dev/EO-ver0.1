// Combat 2.0 phase C4 — Poise + Guard Break data. Run:  node tools/tests/poise.test.mjs
import { Poise } from '../../src/combat/poiseSystem.js';
import { POISE } from '../../src/data/poise.js';
import { STAMINA } from '../../src/data/stamina.js';
import { STATUSES } from '../../src/data/statuses.js';
import { MONSTERS } from '../../src/monsters/monsterTypes.js';
import { BOSSES, liveBosses } from '../../src/data/bosses.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('poise');
test('hits lower poise; reaching 0 breaks it once and refills', () => {
  const p = new Poise(20); ok(!p.hit(10) && p.value === 10, 'half'); ok(p.hit(10), 'break'); ok(p.value === 20 && p.breaks === 1, 'refilled');
});
test('break immunity: no stun-lock right after a break', () => {
  const p = new Poise(10); p.hit(10); ok(!p.hit(10) && !p.hit(10), 'immune'); p.update(POISE.monster.breakImmunity + 0.1); ok(p.hit(10), 'breakable again');
});
test('regenerates only after the delay without damage', () => {
  const p = new Poise(100); p.hit(60);
  p.update(POISE.monster.regenDelay * 0.5); ok(p.value === 40, 'waits'); p.update(POISE.monster.regenDelay); ok(p.value > 40, 'regens');
  for (let i = 0; i < 50; i++) p.update(0.1); ok(p.value === 100, 'full');
});
test('heavy wind-up armour, counter window and big hits scale poise damage', () => {
  const base = Poise.amount(10);
  ok(Poise.amount(10, { heavy: true }) < base, 'heavy armour'); ok(Poise.amount(10, { counter: true }) > base, 'counter'); ok(Poise.amount(10, { big: true }) > base, 'big');
  ok(Poise.amount(undefined) === POISE.defaultHit, 'default');
});
test('canBreak=false holds at 0; the next allowed hit breaks', () => {
  const p = new Poise(10); ok(!p.hit(20, { canBreak: false }) && p.value === 0, 'held'); ok(p.hit(1), 'breaks when allowed');
});
test('data: every monster and live boss has poise', () => {
  for (const [id, m] of Object.entries(MONSTERS)) if (!m.defeat) ok(m.poise > 0, 'monster ' + id); // bosses: their own poise
  for (const b of liveBosses(BOSSES)) ok(b.impl !== 'area' || b.stats.poise > 0, 'boss ' + b.id);
});
test('Guard Break data: parry-able stun, partial damage, status exists', () => {
  const gb = STAMINA.guardBreak; ok(gb.stun > 0 && gb.stun < 1.5 && gb.damageTaken > 0 && gb.damageTaken < 1, 'numbers');
  ok(STATUSES.guard_broken && STATUSES.guard_broken.flags.includes('cannotAct'), 'status');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
