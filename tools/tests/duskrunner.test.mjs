// Unit tests for Class 2 DUSKRUNNER + the generic pieces it needed (SkillSystem recast, momentum tiers,
// attack speed / dodge cost stats). Run:  node tools/tests/duskrunner.test.mjs
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { SkillSystem, REQUIREMENTS } from '../../src/combat/skillSystem.js';
import { SummonSystem } from '../../src/combat/summonSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { SUMMONS } from '../../src/data/summons.js';
import { ITEMS } from '../../src/items/items.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { Duskrunner as D, stageValue } from '../../src/skills/duskrunner.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// ---- a fake game / player: real ResourcePool + SummonSystem, recorded hitboxes, no-op feedback
const noop = new Proxy({}, { get: () => () => {} });
function fakeGame() {
  const flags = new Set();
  const g = {
    time: 0, hitboxes: [], timers: [], vfx: noop, audio: noop, camera: noop,
    summons: new SummonSystem(SUMMONS),
    combat: { inCombat: true, spawnHitbox(h) { g.hitboxes.push(h); return h; } },
    world: { map: { circleBlocked: () => false }, setFlag: (f) => flags.add(f), flags },
    input: { moveVector: () => ({ x: 0, y: 0 }) },
    after(t, fn) { g.timers.push(fn); }, slowMo() {},
  };
  const statuses = new Map();
  const p = {
    x: 0, y: 0, radius: 7, facing: 0, aim: 0, cls: D, game: g, dead: false, idleT: 0, moving: false, maxHp: 200,
    stats: { ...D.base }, resources: null,
    status: {
      has: (id) => statuses.has(id), add: (id) => statuses.set(id, true), remove: (id) => statuses.delete(id),
      modifier: (k) => [...statuses.keys()].reduce((m, id) => m * ((STATUSES[id].modifiers || {})[k] ?? 1), 1),
    },
    get primaryResource() { return D.resource; },
    gainResource(n, raw) { p.resources.gain(D.resource, n, { raw }); },
    beginDodge() {}, dodgeCost: () => 22,
    cooldownCut: 0, reduceCooldowns(s) { p.cooldownCut += s; },
  };
  p.resources = new ResourcePool([...D.resources, 'stamina'], RESOURCES, { stats: () => p.stats });
  return { g, p };
}
const play = (act) => { if (act.start) act.start(); for (const [, fn] of act.events || []) fn(); };
const skill = (id) => [...D.skills, D.special].find((s) => s.id === id);

console.log('core additions');
test('SkillSystem recast: 2nd press within the window runs recast.cast (no cooldown / cost check), once', () => {
  const calls = [];
  const s = { id: 'x', cooldown: 5, cost: 10, cast: () => calls.push('first'), recast: { window: 1, cast: () => calls.push('again') } };
  const caster = { stats: {}, primaryResource: 'momentum', resources: new ResourcePool(['momentum'], RESOURCES) };
  caster.resources.set('momentum', 15);
  const sys = new SkillSystem(caster, [s]);
  ok(sys.use('x').ok && calls.join() === 'first', 'first cast');
  eq(caster.resources.get('momentum'), 5, 'cost paid once');
  ok(sys.recastLeft('x') > 0, 'recast open');
  const r = sys.use('x');
  ok(r.ok && r.recast && calls.join() === 'first,again', 'recast ran without cooldown / cost');
  eq(caster.resources.get('momentum'), 5, 'recast is free');
  ok(!sys.use('x').ok, 'no third use: cooldown');
  sys.cooldowns.clear('x'); caster.resources.set('momentum', 50);
  sys.use('x'); sys.update(1.1); ok(sys.recastLeft('x') === 0, 'the window closes');
});
test('momentum tiers: FLOW 30 / RUSH 60 / MAX 100 add attack speed, speed, cheaper dodges, cdr', () => {
  const pool = new ResourcePool(['momentum'], RESOURCES);
  eq(pool.tier('momentum'), -1);
  pool.set('momentum', 30); ok(pool.tierDef('momentum').label === 'FLOW', 'flow'); eq(pool.tierStats().attackSpeed, 0.1);
  pool.set('momentum', 60); eq(pool.tierStats().dodgeCostCut, 0.25); eq(pool.tierStats().cdr, 0.1);
  pool.set('momentum', 100); ok(pool.tierDef('momentum').label === 'MAX MOMENTUM', 'max'); eq(pool.tierStats().attackSpeed, 0.3);
});

console.log('duskrunner');
test('class data matches the shared schema; registered, playable, own gear + preset', () => {
  ok(CLASSES.duskrunner === D && CLASS_TREE.duskrunner.playable && CLASS_TREE.duskrunner.parent === 'umbral_sword', 'registry + tree');
  ok(D.preset === 'dr' && D.anims && RESOURCES[D.resource].tiers, 'preset + resource with tiers');
  ok(typeof D.signatureWeapon === 'string', 'signature gear exists');
  ok(D.skills.length === 5 && D.special && typeof D.basic === 'function' && D.passives.length === 2, 'kit: 4 actives + ultimate, Q, 2 passives');
  const ids = [...D.skills, D.special].map((s) => s.id);
  ok(new Set(ids).size === ids.length, 'unique ids');
  for (const s of [...D.skills, D.special]) {
    ok(s.id && s.name && s.type && typeof s.cast === 'function' && s.cooldown > 0 && s.icon && s.tier, 'skill ' + s.id);
    for (const r of s.requirements || []) ok(REQUIREMENTS[r.type], 'requirement type ' + r.type);
  }
  for (const id of D.defaultLoadout) ok(D.skills.some((s) => s.id === id && s.type !== 'ultimate'), 'loadout ' + id);
  ok(STATUSES.silent_run && STATUSES.overdrive && SUMMONS.mirage, 'statuses + summon');
});
test('MOMENTUM COMBO: Dusk Barrage hits 3 / 5 / 7 / 9 by momentum (data table)', () => {
  const t = D.barrage.hits;
  eq(stageValue(t, 0), 3); eq(stageValue(t, 49), 3); eq(stageValue(t, 50), 5); eq(stageValue(t, 80), 7); eq(stageValue(t, 100), 9);
  for (const [m, n] of [[10, 3], [55, 5], [85, 7], [100, 9]]) {
    const { g, p } = fakeGame();
    p.resources.set('momentum', m);
    play(skill('dusk_barrage').cast(p, g, 0));
    eq(g.hitboxes.length, n, `momentum ${m}`);
  }
});
test('Blue Fang: stronger with momentum; the MAX afterimage cuts the line again', () => {
  const a = fakeGame(); play(skill('blue_fang').cast(a.p, a.g, 0));
  const b = fakeGame(); b.p.resources.set('momentum', 100); play(skill('blue_fang').cast(b.p, b.g, 0));
  ok(b.g.hitboxes[0].power > a.g.hitboxes[0].power * 1.5, 'more power at full momentum');
  eq(a.g.timers.length, 0, 'no afterimage below MAX'); eq(b.g.timers.length, 1, 'afterimage at MAX');
  b.g.timers[0](); eq(b.g.hitboxes.length, 2, 'second cut');
});
test('Mirage Shift: leaves a Mirage; the recast returns to it and cuts the path; a lost Mirage fizzles', () => {
  const { g, p } = fakeGame(), s = skill('mirage_shift');
  play(s.cast(p, g, 0));
  ok(g.summons.count(p, 'mirage') === 1, 'mirage placed');
  p.x = 100; p.y = 0;
  play(s.recast.cast(p, g, 0));
  ok(p.x === 0 && p.y === 0 && g.summons.count(p, 'mirage') === 0, 'back at the mirage');
  ok(g.hitboxes.length === 1 && g.hitboxes[0].shape === 'line', 'path cut');
  const act = s.recast.cast(p, g, 0); play(act);
  ok(act.dur < 0.2 && g.hitboxes.length === 1, 'no mirage -> fizzle, no hit');
});
test('Flash Step: dash + recast (second, stronger dash)', () => {
  const { g, p } = fakeGame(), s = skill('flash_step');
  const a1 = s.cast(p, g, 0); play(a1);
  const a2 = s.recast.cast(p, g, 1); play(a2);
  ok(a1.dash && a2.dash && a2.dash.dist > a1.dash.dist && s.recast.window > 0, 'two dashes');
  ok(g.hitboxes[1].power > g.hitboxes[0].power, 'second hits harder');
});
test('tick: standing still in a fight drains momentum, moving builds it; Endless Run locks it at 100', () => {
  const { g, p } = fakeGame();
  p.resources.set('momentum', 50);
  p.idleT = 1; D.tick(p, g, 1); ok(p.resources.get('momentum') < 50 - D.momentum.idleDrain * 0.9, 'idle drain');
  p.idleT = 0; p.moving = true; const before = p.resources.get('momentum'); D.tick(p, g, 1); ok(p.resources.get('momentum') > before, 'moving gain');
  g.combat.inCombat = false; p.idleT = 5; const m0 = p.resources.get('momentum'); D.tick(p, g, 1); eq(p.resources.get('momentum'), m0, 'out of combat: no idle drain (pool decay handles it)');
  p.status.add('overdrive'); p.resources.set('momentum', 10); D.tick(p, g, 0.5);
  eq(p.resources.get('momentum'), 100, 'overdrive pins 100'); ok(p.cooldownCut > 0, 'cooldowns tick faster');
});
test('a heavy hit knocks momentum down (not in overdrive); light hits do not', () => {
  const { g, p } = fakeGame();
  p.resources.set('momentum', 80);
  D.on.damageTaken(p, g, { target: p, amount: 5, opts: {} }); eq(p.resources.get('momentum'), 80, 'light hit');
  D.on.damageTaken(p, g, { target: p, amount: 5, opts: { heavy: true } }); eq(p.resources.get('momentum'), 80 - D.momentum.heavyHitLoss, 'heavy');
  D.on.damageTaken(p, g, { target: p, amount: 40, opts: {} }); eq(p.resources.get('momentum'), 80 - 2 * D.momentum.heavyHitLoss, 'big hit (12%+ max HP)');
  p.status.add('overdrive'); D.on.damageTaken(p, g, { target: p, amount: 99, opts: { heavy: true } }); eq(p.resources.get('momentum'), 30, 'overdrive ignores it');
});
test('Ghost Step: a Perfect Dodge opens a free-dodge window; Silent Run ambush ends the stealth', () => {
  const { g, p } = fakeGame();
  D.onPerfectDodge(p, g); ok(p.ghostStepT > 0, 'window');
  p.resources.set('stamina', 50); D.on.playerDodged(p, g, { player: p });
  eq(p.resources.get('stamina'), 72, 'refunded'); eq(p.ghostStepT, 0, 'used up');
  p.status.add('silent_run'); p.resources.set('momentum', 0);
  D.on.damageDealt(p, g, { source: p, opts: {} });
  ok(!p.status.has('silent_run') && p.resources.get('momentum') === D.charge.ambush, 'ambush');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
