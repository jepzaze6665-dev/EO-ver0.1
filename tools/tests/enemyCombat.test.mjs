// Combat 2.0 phase C5 — enemy commitment + role data. Run:  node tools/tests/enemyCombat.test.mjs
import { ENEMY_COMBAT } from '../../src/data/enemyCombat.js';
import { MONSTERS } from '../../src/monsters/monsterTypes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const mons = Object.entries(MONSTERS).filter(([, m]) => !m.defeat);

console.log('enemy combat');
test('misses always cost the enemy extra recovery', () => {
  ok(ENEMY_COMBAT.missRecoverMult > 1 && ENEMY_COMBAT.bossMissRecoverMult > 1, 'mults');
  for (const [id, m] of mons) for (const a of m.attacks) ok(a.missRecover === undefined || a.missRecover >= 1, `${id}.${a.id}`);
});
test('every attack has startup (telegraph) and recovery (commitment)', () => {
  for (const [id, m] of mons) for (const a of m.attacks) ok(a.windup >= 0.3 && a.recover >= 0.3, `${id}.${a.id} windup ${a.windup} recover ${a.recover}`);
});
test('every monster has a known role', () => {
  for (const [id, m] of mons) ok(ENEMY_COMBAT.roles[m.role], `${id}: role ${m.role}`);
});
test('spec §51 roles: wolf = skirmisher (flank + punish), goblin = bruiser (heavy, punishable miss), crystal = tank', () => {
  const w = MONSTERS.wolf, gb = MONSTERS.goblin, c = MONSTERS.crystal_beast;
  ok(w.role === 'skirmisher' && w.flank && w.punishIdle > 0 && w.attacks.some((a) => a.punish), 'wolf');
  ok(gb.role === 'bruiser' && gb.attacks.some((a) => a.heavy && a.missRecover > ENEMY_COMBAT.missRecoverMult), 'goblin');
  ok(c.role === 'tank' && c.weakPoint && c.armor > 0 && c.turn < 3, 'crystal beast');
});
test('monsters that punish idling have a punish attack', () => {
  for (const [id, m] of mons) if (m.punishIdle) ok(m.attacks.some((a) => a.punish), id);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
