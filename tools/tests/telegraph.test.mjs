// Telegraph tiers (src/combat/telegraph.js telegraphTier, pure). Run: node tools/tests/telegraph.test.mjs
import { telegraphTier } from '../../src/combat/telegraph.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const mob = { hp: 10, def: {} }, elite = { hp: 10, def: {}, elite: true }, boss = { isBoss: true, hp: 1 };

test('ordinary monster attack = 1, heavy / guard break / elite = 2', () => {
  ok(telegraphTier({ shape: 'cone', r: 40, owner: mob }) === 1, 'plain');
  ok(telegraphTier({ shape: 'cone', r: 40, owner: mob, heavy: true }) === 2, 'heavy');
  ok(telegraphTier({ shape: 'cone', r: 40, owner: mob, guardBreak: true }) === 2, 'guard break');
  ok(telegraphTier({ shape: 'cone', r: 40, owner: elite }) === 2, 'elite');
});

test('unblockable, big boss moves and boss mechanics = 3; small boss moves and hazards = 2; tier overrides', () => {
  ok(telegraphTier({ shape: 'circle', r: 30, owner: mob, unblockable: true }) === 3, 'unblockable');
  ok(telegraphTier({ shape: 'circle', r: 120, owner: boss }) === 3, 'big boss area');
  ok(telegraphTier({ shape: 'cone', r: 50, owner: boss }) === 2, 'boss claw');
  ok(telegraphTier({ shape: 'circle', r: 50, owner: { b: boss } }) === 3, 'mechanic');
  ok(telegraphTier({ shape: 'circle', r: 50, owner: { x: 1, y: 1 } }) === 2, 'hazard');
  ok(telegraphTier({ shape: 'circle', r: 50, owner: mob, tier: 3 }) === 3, 'override');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
