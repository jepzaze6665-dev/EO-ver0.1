// Combat 2.0 phase C6 — attack slots + enemy targeting (pure). Run:  node tools/tests/attackSlots.test.mjs
import { AttackSlots } from '../../src/combat/attackSlots.js';
import { pickTarget, scoreTarget } from '../../src/combat/targeting.js';
import { ATTACK_SLOTS } from '../../src/data/attackSlots.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const R = { ...ATTACK_SLOTS, capacity: 3, releaseDelay: 0.25 };

console.log('attack slots');
test('capacity: 3 normal attackers, the 4th waits', () => {
  const s = new AttackSlots(R), P = {};
  ok(s.request('a', P, 1) && s.request('b', P, 1) && s.request('c', P, 1), 'three'); ok(!s.request('d', P, 1), 'fourth waits');
});
test('heavy attacks cost more', () => {
  const s = new AttackSlots(R), P = {};
  ok(s.costOf({ heavy: true }) > s.costOf({}), 'cost'); ok(s.request('g', P, 2) && s.request('w', P, 1) && !s.request('x', P, 1), 'heavy + 1 fills it');
});
test('asking again while holding is free (no double count)', () => {
  const s = new AttackSlots(R), P = {}; s.request('a', P, 1); s.request('a', P, 1); ok(s.used(P) === 1, 'used ' + s.used(P));
});
test('released points come back after the delay (a beat between attackers)', () => {
  const s = new AttackSlots(R), P = {}; s.request('a', P, 3); s.release('a');
  ok(!s.request('b', P, 3), 'still cooling'); s.update(0.3); ok(s.request('b', P, 3), 'free again');
});
test('slots are per target (party-ready): a second player has its own capacity', () => {
  const s = new AttackSlots(R), P1 = {}, P2 = {}; s.request('a', P1, 3); ok(s.request('b', P2, 3), 'other player free');
});
test('an oversized attack still goes when nobody is attacking; prune drops stale holders', () => {
  const s = new AttackSlots(R), P = {}; ok(s.request('boss', P, 9), 'alone'); s.prune((a) => a === 'boss'); ok(s.used(P) === 0, 'pruned');
});

console.log('targeting');
const pl = (o) => ({ x: 0, y: 0, hp: 100, maxHp: 100, status: { has: () => false }, ...o });
const foe = (o) => ({ x: 0, y: 0, status: { get: () => null }, def: {}, ...o });
test('nearest player by default; dead players are never picked', () => {
  const a = pl({ x: 100 }), b = pl({ x: 300 }); ok(pickTarget(foe(), [b, a]) === a, 'nearest');
  ok(pickTarget(foe(), [pl({ x: 10, dead: true }), b]) === b, 'skip dead');
});
test('taunt beats everything', () => {
  const a = pl({ x: 50 }), tank = pl({ x: 600 }); ok(pickTarget(foe({ status: { get: (id) => (id === 'taunted' ? { source: tank } : null) } }), [a, tank]) === tank, 'taunter');
});
test('vulnerable / low-HP players draw attention; skirmishers pressure ranged players', () => {
  const a = pl({ x: 100 }), weak = pl({ x: 250, hp: 20 }); ok(pickTarget(foe(), [a, weak]) === weak, 'low hp');
  const melee = pl({ x: 100, cls: { ratings: { range: 1 } } }), mage = pl({ x: 180, cls: { ratings: { range: 5 } } });
  ok(pickTarget(foe({ def: { role: 'skirmisher' } }), [melee, mage]) === mage, 'wolf -> mage');
  ok(pickTarget(foe({ def: { role: 'bruiser' } }), [melee, mage]) === melee, 'goblin -> nearest');
});
test('sticks to its current target unless another is clearly better', () => {
  const a = pl({ x: 100 }), b = pl({ x: 90 }); ok(pickTarget(foe({ target: a }), [a, b]) === a, 'sticky');
  ok(scoreTarget(foe(), pl({ dead: true })) === -Infinity, 'dead = -inf');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
