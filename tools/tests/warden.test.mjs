// Unit tests for Class 2 WARDEN OF DAWN + the generic pieces it needed (status flags unshakable / debuffImmune,
// status tenacity, Dawnlight resource). Run:  node tools/tests/warden.test.mjs
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { SkillSystem } from '../../src/combat/skillSystem.js';
import { StatusSet } from '../../src/status/status.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { ITEMS } from '../../src/items/items.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { SKILL_TIERS } from '../../src/data/skillTiers.js';
import { WardenOfDawn as W } from '../../src/skills/wardenOfDawn.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const noop = new Proxy({}, { get: () => () => {} });
// a small world: the Warden + optional allies (game.players()), hostiles, a bus that records events
function fakeGame(allyCount = 0) {
  const events = [];
  const g = {
    time: 10, hitboxes: [], timers: [], vfx: noop, audio: noop, camera: noop, marks: { apply() {} },
    combat: { inCombat: true, spawnHitbox(h) { g.hitboxes.push(h); return h; } },
    world: { hostiles: () => [], setFlag() {} },
    events: { emit: (n, e) => events.push([n, e]) },
    after(t, fn) { g.timers.push(fn); }, slowMo() {},
    members: [],
    players: () => g.members.filter((m) => !m.dead && !m.downed),
  };
  const mk = (x, cls = W) => {
    const m = { x, y: 0, dead: false, hp: 300, maxHp: 300, cls, game: g, stats: { ...W.base }, aim: 0 };
    m.status = new StatusSet(m);
    m.heal = (n) => { const b = m.hp; m.hp = Math.min(m.maxHp, m.hp + n); return m.hp - b; };
    return m;
  };
  const p = mk(0);
  Object.defineProperty(p, 'primaryResource', { get: () => W.resource });
  p.resources = new ResourcePool(W.resources, RESOURCES, { stats: () => p.stats });
  p.gainResource = (n, raw) => p.resources.gain(W.resource, n, { raw });
  p.startAction = (a) => { p.started = a; };
  p.skillSys = new SkillSystem(p, [...W.skills, W.special]);
  g.members.push(p);
  const allies = [];
  for (let i = 0; i < allyCount; i++) { const a = mk(60 + i * 20); allies.push(a); g.members.push(a); }
  return { g, p, allies, events };
}
const play = (act) => { if (act.start) act.start(); for (const [, fn] of act.events || []) fn(); };
const skill = (id) => [...W.skills, W.special].find((s) => s.id === id);
const tick = (g, p, sec, step = 0.05) => { for (let t = 0; t < sec - 1e-9; t += step) { W.tick(p, g, step); for (const m of g.members) m.status.update(step); } };

console.log('warden of dawn — data');
test('class data: shared schema, registered + playable Class 2 of the Aegis, own preset / gear / resource', () => {
  ok(CLASSES.warden_of_dawn === W && CLASS_TREE.warden_of_dawn.playable && CLASS_TREE.warden_of_dawn.parent === 'aegis_guardian' && W.parentClass === 'aegis_guardian', 'registry + tree');
  for (const k of ['id', 'name', 'description', 'role', 'difficulty', 'signatureWeapon', 'preset', 'resource', 'base', 'skills', 'passives', 'anims']) ok(W[k] !== undefined, 'missing ' + k);
  ok(W.preset === 'wd' && typeof W.signatureWeapon === 'string', 'preset + gear');
  ok(W.skills.some((s) => s.ultimate && s.id === 'dawns_sanctuary') && W.special.hold, 'ultimate + hold guard');
  ok(W.passives.map((x) => x.id).includes('last_light') && W.passives.map((x) => x.id).includes('shared_resolve'), 'passives');
});
test('every skill: tier, cooldown, cost data; skills never share an id', () => {
  const ids = new Set();
  for (const s of [...W.skills, W.special]) {
    ok(SKILL_TIERS[s.tier], `${s.id} tier`); ok(s.cooldown > 0, `${s.id} cooldown`); ok(s.cost >= 0, `${s.id} cost`);
    ok(!ids.has(s.id), 'dup ' + s.id); ids.add(s.id);
  }
});
test('Dawnlight: 0-100, decays after 6 s without gain, tier RADIANT at 60 = barrierPower', () => {
  const d = RESOURCES.dawnlight;
  ok(d.max === 100 && d.start === 0 && d.decay.delay === 6 && d.decay.inCombat > 0 && d.decay.outOfCombat > d.decay.inCombat, 'rules');
  ok(d.tiers[0].at === 60 && d.tiers[0].stats.barrierPower > 0, 'tier');
  const pool = new ResourcePool(['dawnlight'], RESOURCES, { stats: () => ({ dawnGain: 1 }) });
  pool.gain('dawnlight', 500); ok(pool.get('dawnlight') === 100, 'capped at max');
  ok(!pool.spend('dawnlight', 150) && pool.get('dawnlight') === 100, 'unaffordable spend refused');
  pool.update(5, { inCombat: true }); ok(pool.get('dawnlight') === 100, 'no decay before the delay');
  pool.update(2, { inCombat: true }); ok(pool.get('dawnlight') < 100, 'decays after it');
  pool.update(999, { inCombat: false }); ok(pool.get('dawnlight') === 0, 'never negative');
});

console.log('generic status flags');
test('debuffImmune resists debuff / control / dot, not buffs or barriers', () => {
  const s = new StatusSet({});
  s.add('sanctuary', 5);
  ok(s.add('slow', 3) === null && s.add('stun', 1) === null && s.add('burn', 2) === null && !s.has('slow'), 'harmful resisted');
  ok(s.drainEvents().some((e) => e.name === 'statusResisted'), 'statusResisted event');
  s.add('shield', 5, { amount: 40 }); s.add('haste', 2);
  ok(s.has('shield') && s.has('haste'), 'good statuses still apply');
});
test('status tenacity (Dawn Bastion) shortens control, capped', () => {
  const s = new StatusSet({ stats: { tenacity: 0 } });
  s.add('dawn_bastion', 5); s.add('stun', 1);
  ok(near(s.get('stun').t, 0.7), 'stun 1 s -> 0.7 s: ' + s.get('stun').t);
  const s2 = new StatusSet({ stats: { tenacity: 0.5 } });
  s2.add('dawn_bastion', 5); s2.add('stun', 1);
  ok(near(s2.get('stun').t, 0.4) && STATUSES.dawn_bastion.tenacity + 0.5 > 0.6, 'capped at maxTenacity 0.6 -> 0.4 s: ' + s2.get('stun').t);
});
test('unshakable flag on holy ground / march', () => {
  for (const id of ['dawn_bastion', 'sanctuary', 'guardian_march']) { const s = new StatusSet({}); s.add(id, 1); ok(s.flag('unshakable'), id); }
});

console.log('warden of dawn — skills');
test('Dawn Shield: alone -> barrier 20% on yourself; with a hurt ally -> the ally + a small one for you', () => {
  let { g, p } = fakeGame();
  play(skill('dawn_shield').cast(p, g, 0));
  ok(p.status.get('shield').amount === 60 && p.status.get('shield').source === p, 'self 20% of 300');
  ({ g, p } = fakeGame(1)); const a = g.members[1];
  a.hp = 120;
  play(skill('dawn_shield').cast(p, g, 0));
  ok(a.status.get('shield').amount === 60 && p.status.get('shield').amount === 24, `ally ${a.status.get('shield').amount} self ${p.status.get('shield') && p.status.get('shield').amount}`);
});
test('Barrier: stacks but never above 50% max HP; RADIANT tier makes it stronger', () => {
  const { g, p } = fakeGame();
  for (let i = 0; i < 9; i++) W.giveBarrier(p, g, p, 0.2);
  ok(p.status.get('shield').amount === 150, 'cap 150: ' + p.status.get('shield').amount);
  const f2 = fakeGame(); f2.p.stats.barrierPower = 0.2; W.giveBarrier(f2.p, f2.g, f2.p, 0.2);
  ok(f2.p.status.get('shield').amount === 72, 'x1.2: ' + f2.p.status.get('shield').amount);
});
test('Radiant Chain: binds the nearest ally (30% less damage) or yourself (15%); hits feed Dawnlight capped at 24', () => {
  let { g, p, allies } = fakeGame(1);
  play(skill('radiant_chain').cast(p, g, 0));
  const a = allies[0];
  ok(p.chain.target === a && near(a.status.damageTakenMult(), 0.7), 'ally bound');
  const d0 = p.resources.get('dawnlight');
  for (let i = 0; i < 20; i++) W.on.damageTaken(p, g, { target: a, amount: 10 });
  ok(p.resources.get('dawnlight') - d0 === 24, 'capped: +' + (p.resources.get('dawnlight') - d0));
  a.x = 1000; W.tick(p, g, 0.05);
  ok(!p.chain && !a.status.has('radiant_chain'), 'breaks out of range');
  ({ g, p } = fakeGame());
  play(skill('radiant_chain').cast(p, g, 0));
  ok(p.chain.target === p && near(p.status.damageTakenMult(), 0.85), 'solo: self-bind');
});
test('Dawn Bastion: zone r 90 / 6 s, members inside protected, outside not, sears foes, ends on time', () => {
  const { g, p, allies } = fakeGame(2);
  allies[1].x = 400;
  play(skill('dawn_bastion').cast(p, g, 0));
  tick(g, p, 0.6);
  ok(p.status.has('dawn_bastion') && allies[0].status.has('dawn_bastion') && !allies[1].status.has('dawn_bastion'), 'inside / outside');
  ok(g.hitboxes.some((h) => h.shape === 'circle' && h.r === 90 && h.type === 'holy'), 'holy burn');
  tick(g, p, 6);
  ok(!(p.zones || []).length && !allies[0].status.has('dawn_bastion'), 'ended');
});
test('Grace of Dawn: heals the lowest ally 12% (60% of it on yourself); overheal -> barrier', () => {
  const { g, p, allies } = fakeGame(1);
  allies[0].hp = 100;
  play(skill('grace_of_dawn').cast(p, g, 0));
  ok(allies[0].hp === 136, 'ally +36: ' + allies[0].hp);
  const f = fakeGame(); f.p.hp = 100;
  play(skill('grace_of_dawn').cast(f.p, f.g, 0));
  ok(f.p.hp === 100 + Math.round(300 * 0.12 * 0.6), 'self x0.6: ' + f.p.hp);
  const h = fakeGame(); play(skill('grace_of_dawn').cast(h.p, h.g, 0));
  ok(h.p.hp === 300 && h.p.status.get('shield') && h.p.status.get('shield').amount > 0, 'full HP -> barrier');
});
test('Guardian March: high-impact, cannot be cancelled, moves forward, march status', () => {
  const { g, p } = fakeGame();
  const act = skill('guardian_march').cast(p, g, 0);
  ok(act.superArmor && act.cancelAt >= act.dur && act.lunge.dist >= 80, 'commitment');
  play(act);
  ok(p.status.has('guardian_march') && g.hitboxes.length === 3, 'status + 3 shoves');
});
test("Dawn's Sanctuary: 60 Dawnlight, zone r 150 / 8 s, cleanse + barrier + debuff immunity for the party", () => {
  const { g, p, allies } = fakeGame(1);
  p.resources.set('dawnlight', 59);
  ok(!p.skillSys.use('dawns_sanctuary', p, g, 0).ok, 'needs 60');
  p.resources.set('dawnlight', 60);
  allies[0].status.add('slow', 5);
  const r = p.skillSys.use('dawns_sanctuary', p, g, 0); play(r.result);
  ok(p.resources.get('dawnlight') === 0, 'spent');
  ok(!allies[0].status.has('slow') && allies[0].status.get('shield') && allies[0].status.has('sanctuary'), 'cleanse + barrier + status');
  ok(allies[0].status.add('slow', 2) === null, 'debuff immune');
  tick(g, p, 8.2);
  ok(!(p.zones || []).length && !allies[0].status.has('sanctuary'), 'ended');
});
test('Last Light: an ally under 35% -> you take 20% less, 12 s cooldown', () => {
  const { g, p, allies } = fakeGame(1);
  allies[0].hp = 90;
  W.on.damageTaken(p, g, { target: allies[0], amount: 5 });
  ok(p.status.has('last_light') && near(p.status.damageTakenMult(), 0.8), 'triggered');
  p.status.remove('last_light');
  W.on.damageTaken(p, g, { target: allies[0], amount: 5 });
  ok(!p.status.has('last_light'), 'cooldown');
  g.time += 12;
  W.on.damageTaken(p, g, { target: allies[0], amount: 5 });
  ok(p.status.has('last_light'), 'again after 12 s');
});
test('Shared Resolve: +30% DEF while an ally carries your protection, +12% for yourself only', () => {
  const { g, p, allies } = fakeGame(1);
  W.giveBarrier(p, g, allies[0], 0.1); W.tick(p, g, 0.05);
  ok(near(p.status.get('shared_resolve').mult, 1.3), 'ally');
  const f = fakeGame(); W.giveBarrier(f.p, f.g, f.p, 0.1); W.tick(f.p, f.g, 0.05);
  ok(near(f.p.status.get('shared_resolve').mult, 1.12), 'self');
});
test('guard gains: block +6, perfect guard +20 + riposte; barrier soak feeds at most 6 per hit', () => {
  const { g, p } = fakeGame();
  W.onGuardBlock(p); ok(p.resources.get('dawnlight') === 6, 'block');
  W.onPerfectGuard(p, g, { x: 20, y: 0 }); ok(p.resources.get('dawnlight') === 26 && p.started && p.started.name === 'dawn_counter', 'perfect');
  W.on.shieldAbsorbed(p, g, { statusSource: p, amount: 500 }); ok(p.resources.get('dawnlight') === 32, 'soak capped');
  W.on.shieldAbsorbed(p, g, { statusSource: {}, amount: 50 }); ok(p.resources.get('dawnlight') === 32, "someone else's barrier: nothing");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
