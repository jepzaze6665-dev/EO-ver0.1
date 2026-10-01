// Unit tests for the Stormcaller (Class 2 of the Astral Weaver). Run:  node tools/tests/stormcaller.test.mjs
// The live-game behaviour (chains, wires, bursts, class change) is checked by C.stormChecks in tools/combatTest.js.
import { KIT_PIECES } from '../../src/data/classKits.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { THREADS } from '../../src/data/threads.js';
import { ITEMS } from '../../src/items/items.js';
import { SKILL_ICONS } from '../../src/data/skillIcons.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { StatusSet } from '../../src/status/status.js';
import { ThreadSystem } from '../../src/combat/threadSystem.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const SC = CLASSES.stormcaller;
const all = [...SC.skills, SC.special];

console.log('stormcaller');
test('registered, playable Class 2 of the Astral Weaver, own preset / weapon / resource', () => {
  ok(SC && CLASS_TREE.stormcaller.playable && CLASS_TREE.stormcaller.parent === 'astral_weaver', 'tree');
  ok(SC.preset === 'sm' && SC.resource === 'storm_charge' && RESOURCES.storm_charge, 'preset / resource');
  ok(KIT_PIECES[SC.kit.weapon] && KIT_PIECES[SC.kit.armor] && SC.signatureWeapon === 'storm_staff', 'gear');
});
test('kit: 5 actives + ultimate + Storm Burst special, all with a tier, icon art and a description', () => {
  ok(SC.skills.filter((s) => s.type === 'active').length === 5 && SC.skills.some((s) => s.ultimate) && SC.special.id === 'storm_burst', 'counts');
  for (const s of all) ok(s.tier && s.desc && SKILL_ICONS[s.id], s.id);
  ok(SC.defaultLoadout.every((id) => SC.skills.some((s) => s.id === id)), 'default loadout');
  ok(SC.passives.length >= 2, 'passives');
});
test('different from the Weaver: no skill id shared, own resource', () => {
  const aw = new Set([...CLASSES.astral_weaver.skills, CLASSES.astral_weaver.special].map((s) => s.id));
  ok(all.every((s) => !aw.has(s.id)) && CLASSES.astral_weaver.resource !== SC.resource);
});
test('Storm Charge: 0-100, tiers CHARGED 40 / SUPERCHARGED 80 give lightning damage, chain range, +1 jump', () => {
  const pool = new ResourcePool(['storm_charge'], RESOURCES);
  pool.gain('storm_charge', 500); ok(pool.get('storm_charge') === 100, 'cap ' + pool.get('storm_charge'));
  pool.drain('storm_charge', 999); ok(pool.get('storm_charge') === 0, 'floor');
  pool.set('storm_charge', 50); let st = pool.tierStats(); ok(st.lightningDmg === 0.1 && !st.stormChain, JSON.stringify(st));
  pool.set('storm_charge', 90); st = pool.tierStats(); ok(st.lightningDmg === 0.2 && st.stormChain === 1 && st.stormRange === 0.3, JSON.stringify(st));
});
test('SHOCK stacks to 3, each +3% damage taken, ticks lightning damage sized by the caster', () => {
  const s = new StatusSet({});
  for (let i = 0; i < 5; i++) s.add('shock', 4, { damage: 5 });
  ok(s.stacks('shock') === 3, 'stacks ' + s.stacks('shock'));
  ok(Math.abs(s.damageTakenMult() - 1.03 ** 3) < 1e-6, 'mult ' + s.damageTakenMult());
  s.update(1.01); const t = s.drainTicks(); ok(t.length === 1 && t[0].amount === 15 && t[0].type === 'lightning', JSON.stringify(t));
});
test('STILL AIR -15% damage, TAILWIND +20% speed, STATIC GUARD -30% damage taken', () => {
  const s = new StatusSet({});
  s.add('still_air', 1); s.add('tailwind', 1); s.add('static_guard', 1);
  ok(Math.abs(s.damageMult() - 0.85) < 1e-9 && Math.abs(s.moveMult() - 1.2) < 1e-9 && Math.abs(s.damageTakenMult() - 0.7) < 1e-9);
});
test('lightning thread: a live wire (touch shock, lightning burst), max 3 per owner', () => {
  const d = THREADS.lightning_thread;
  ok(d.touch.status === 'shock' && d.touch.type === 'lightning' && d.burst.type === 'lightning' && d.visual.style === 'lightning', 'data');
  const ts = new ThreadSystem(THREADS), owner = { id: 1 };
  for (let i = 0; i < 5; i++) ts.create(owner, 'lightning_thread', { x: 0, y: i * 10 }, { x: 100, y: i * 10 });
  ok(ts.count(owner, 'lightning_thread') === 3, 'cap ' + ts.count(owner));
});
test('chain target: nearest foe in reach not hit yet, a shocked one wins over an equally close one', () => {
  const foe = (id, x, shocked) => ({ id, x, y: 0, radius: 10, status: { has: (s) => s === 'shock' && shocked } });
  const a = foe(1, 0), b = foe(2, 120), c = foe(3, -130, true), far = foe(4, 900);
  const g = { world: { hostiles: () => [a, b, c, far] } }, p = { cls: SC, stats: {} };
  ok(SC.chainTarget(p, g, a, new Set([1])) === c, 'shocked first');
  ok(SC.chainTarget(p, g, a, new Set([1, 3])) === b, 'then nearest');
  ok(SC.chainTarget(p, g, a, new Set([1, 2, 3])) === null, 'nothing in reach');
  ok(SC.chainTarget({ cls: SC, stats: { stormRange: 5 } }, g, a, new Set([1, 2, 3])) === far, 'stormRange widens the reach');
});
test('storm velocity is capped per second; Storm Burst needs 30', () => {
  ok(SC.velocity.perSec > 0 && SC.velocity.perSec <= 6, 'perSec');
  ok(SC.special.requirements.some((r) => r.type === 'resource' && r.min === SC.burst.min));
});
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
