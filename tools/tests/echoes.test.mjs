// Unit tests for Class 2 BLADE OF ECHOES + the generic pieces it needed (ActionRecorder, 'recorded' / 'hpBelow'
// requirements, counter stance). Run:  node tools/tests/echoes.test.mjs
import { ActionRecorder } from '../../src/combat/actionRecorder.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { SkillSystem, REQUIREMENTS } from '../../src/combat/skillSystem.js';
import { SummonSystem } from '../../src/combat/summonSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { SUMMONS } from '../../src/data/summons.js';
import { ITEMS } from '../../src/items/items.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { BladeOfEchoes as B } from '../../src/skills/bladeOfEchoes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const noop = new Proxy({}, { get: () => () => {} });
function fakeGame(foes = []) {
  const g = {
    time: 10, hitboxes: [], timers: [], vfx: noop, audio: noop, camera: noop,
    summons: new SummonSystem(SUMMONS),
    combat: { inCombat: true, spawnHitbox(h) { g.hitboxes.push(h); return h; } },
    world: { hostiles: () => foes, map: { circleBlocked: () => false, moveCircle(e, dx, dy) { e.x += dx; e.y += dy; } }, setFlag() {} },
    after(t, fn) { g.timers.push(fn); }, runTimers() { while (g.timers.length) g.timers.shift()(); }, slowMo() {},
  };
  const statuses = new Set();
  const p = {
    x: 0, y: 0, radius: 7, facing: 0, aim: 0, cls: B, game: g, dead: false, hp: 100, maxHp: 200,
    stats: { ...B.base }, memory: new ActionRecorder(B.memory),
    status: { has: (id) => statuses.has(id), add: (id) => statuses.add(id), remove: (id) => statuses.delete(id) },
    get primaryResource() { return B.resource; },
    gainResource(n, raw) { p.resources.gain(B.resource, n, { raw }); },
    heal(n) { p.hp = Math.min(p.maxHp, p.hp + n); return n; },
    started: null, startAction(a) { p.started = a; },
  };
  p.resources = new ResourcePool(B.resources, RESOURCES, { stats: () => p.stats });
  p.skillSys = new SkillSystem(p, [...B.skills, B.special]);
  return { g, p };
}
const play = (act) => { if (act.start) act.start(); for (const [, fn] of act.events || []) fn(); };
const skill = (id) => [...B.skills, B.special].find((s) => s.id === id);

console.log('actionRecorder');
test('records allowed kinds only, forgets after `keep` s, caps entries', () => {
  const r = new ActionRecorder({ keep: 6, max: 3, kinds: ['skill', 'dodge'] });
  ok(r.record({ kind: 'skill', id: 'a' }, 0) && !r.record({ kind: 'walk', id: 'x' }, 0), 'kind filter');
  r.record({ kind: 'dodge', id: 'd' }, 1); r.record({ kind: 'skill', id: 'b' }, 2); r.record({ kind: 'skill', id: 'c' }, 3);
  ok(r.recent(3).map((e) => e.id).join() === 'd,b,c', 'max 3, oldest first');
  ok(r.recent(3, { kinds: ['skill'] }).map((e) => e.id).join() === 'b,c', 'kind query');
  ok(r.recent(3, { n: 1 })[0].id === 'c', 'last n');
  ok(r.recent(7.5).map((e) => e.id).join() === 'b,c', 'forgets after 6 s');
  ok(r.last(7.5, (e) => e.id === 'b').id === 'b' && r.last(20) === null, 'last()');
});
test('no infinite replay: nothing is recorded while replaying', () => {
  const r = new ActionRecorder();
  const out = r.replay(() => { r.record({ kind: 'skill', id: 'x' }, 0); return 5; });
  ok(out === 5 && r.entries.length === 0 && !r.replaying, 'replay blocks recording and restores the flag');
  try { r.replay(() => { throw new Error('boom'); }); } catch { /* */ }
  ok(!r.replaying, 'flag restored after an error');
});
test("requirements 'recorded' and 'hpBelow'", () => {
  const mem = new ActionRecorder({ keep: 6 });
  const c = { memory: mem, game: { time: 5 } };
  const r = { type: 'recorded', ids: ['echo_slash'], within: 6 };
  ok(!REQUIREMENTS.recorded(c, r), 'empty');
  mem.record({ kind: 'skill', id: 'dodge' }, 4); ok(!REQUIREMENTS.recorded(c, r), 'other id');
  mem.record({ kind: 'skill', id: 'echo_slash' }, 4); ok(REQUIREMENTS.recorded(c, r), 'remembered');
  c.game.time = 11; ok(!REQUIREMENTS.recorded(c, r), 'too old');
  ok(!REQUIREMENTS.recorded({}, r), 'no memory');
  ok(REQUIREMENTS.hpBelow({ hp: 30, maxHp: 100 }, { max: 0.4 }) && !REQUIREMENTS.hpBelow({ hp: 50, maxHp: 100 }, { max: 0.4 }), 'hpBelow');
});

console.log('blade of echoes');
test('class data matches the shared schema; registered, playable, own gear + preset', () => {
  ok(CLASSES.blade_of_echoes === B && CLASS_TREE.blade_of_echoes.playable && CLASS_TREE.blade_of_echoes.parent === 'umbral_sword', 'registry + tree');
  ok(B.preset === 'be' && B.anims && RESOURCES[B.resource].tiers, 'preset + resource with tiers');
  ok(ITEMS[B.startingGear.weapon] && ITEMS[B.startingGear.armor], 'gear');
  ok(B.skills.length === 5 && B.special && B.passives.length === 2 && typeof B.basic === 'function', 'kit');
  for (const s of [...B.skills, B.special]) {
    ok(s.id && s.name && s.tier && s.icon && s.cooldown > 0 && typeof s.cast === 'function', 'skill ' + s.id);
    for (const r of s.requirements || []) ok(REQUIREMENTS[r.type], 'requirement ' + r.type);
  }
  ok(STATUSES.last_stand && SUMMONS.rewind_mark && SUMMONS.echo_self, 'status + summons');
  for (const id of B.memory.replayable) ok(id.startsWith('basic') || [...B.skills, B.special].some((s) => s.id === id), 'replayable ' + id);
});
test('Crimson Counter opens a counter window; a Perfect Counter strikes, gives Echo, cuts Rewind Edge, is remembered', () => {
  const { g, p } = fakeGame();
  const act = skill('crimson_counter').cast(p, g, 0);
  ok(act.counter && act.counter.from < act.counter.to && act.dur > act.counter.to, 'window inside the stance');
  p.skillSys.cooldowns.start('rewind_edge', 10);
  B.onPerfectGuard(p, g, { x: 40, y: 0 });
  eq(p.resources.get('echo'), B.charge.counter, 'echo');
  eq(p.skillSys.cooldowns.remaining('rewind_edge'), 10 - B.counter.rewindCut, 'persistent memory');
  ok(p.started && p.started.name === 'counter_strike', 'counter strike');
  play(p.started); ok(g.hitboxes[0].forceCrit && g.hitboxes[0].power >= B.counter.power, 'crit strike');
  ok(p.memory.recent(g.time).some((e) => e.kind === 'counter'), 'recorded');
});
test('Echo Slash: a cut + its delayed echo (stronger with echoPower)', () => {
  const { g, p } = fakeGame();
  play(skill('echo_slash').cast(p, g, 0)); eq(g.hitboxes.length, 1); g.runTimers(); eq(g.hitboxes.length, 2, 'echo cut');
  const lo = g.hitboxes[1].power;
  p.stats.echoPower = 0.5; play(skill('echo_slash').cast(p, g, 0)); g.runTimers();
  ok(g.hitboxes[3].power > lo * 1.4, 'pain remembers');
});
test('Crimson Memory replays the last remembered skill and never records its own replay', () => {
  const { g, p } = fakeGame();
  B.on.skillUsed(p, g, { caster: p, skillId: 'echo_slash' });
  ok(p.skillSys.canUse('crimson_memory').reason !== 'requirement', 'requirement met');
  p.resources.set('echo', 50);
  const r = p.skillSys.use('crimson_memory', p, g, 0);
  ok(r.ok && r.result.name === 'echo_slash', 'recalled echo slash');
  const n = p.memory.entries.length; play(r.result); g.runTimers();
  eq(p.memory.entries.length, n, 'replay not recorded'); eq(g.hitboxes.length, 2, 'the slash + its echo');
  B.on.skillUsed(p, g, { caster: p, skillId: 'crimson_memory' }); eq(p.memory.entries.length, n, 'crimson memory itself not recorded');
});
test('Rewind Edge: remembers the spot; the recast returns there and heals 40% of the HP lost (15 Echo)', () => {
  const { g, p } = fakeGame(), s = skill('rewind_edge');
  play(s.cast(p, g, 0));
  p.x = 200; p.hp = 60; p.resources.set('echo', 30);
  play(s.recast.cast(p, g, 0));
  ok(p.x === 0 && g.summons.count(p, 'rewind_mark') === 0, 'rewound');
  eq(p.hp, 60 + Math.round(40 * B.rewind.heal), 'healed'); eq(p.resources.get('echo'), 15, 'paid');
  const act = s.recast.cast(p, g, 0); play(act); ok(act.dur < 0.2, 'no mark -> fizzle');
});
test('Blade of Recollection replays the recorded steps in order, re-targets, ends with a finale', () => {
  const foe = { x: 60, y: 0, dead: false }, { g, p } = fakeGame([foe]);
  for (const [kind, id] of [['basic', 'basic0'], ['dodge', 'dodge'], ['skill', 'echo_slash'], ['counter', 'crimson_counter']]) B.record(p, { kind, id });
  B.on.skillUsed(p, g, { caster: p, skillId: 'blade_of_recollection' });
  const act = skill('blade_of_recollection').cast(p, g, 0); play(act);
  ok(g.summons.count(p, 'echo_self') === 1, 'crimson copy');
  const before = g.hitboxes.length; g.runTimers();
  eq(g.hitboxes.length - before, 5, '4 replayed steps + finale');
  foe.dead = true; // target gone: still no crash
  const g2 = fakeGame([]); B.record(g2.p, { kind: 'basic', id: 'basic0' });
  play(skill('blade_of_recollection').cast(g2.p, g2.g, 0)); g2.g.runTimers(); ok(g2.g.hitboxes.length >= 2, 'plays with no target');
});
test('taking damage builds Echo (clamped); Last Stand needs low HP', () => {
  const { g, p } = fakeGame();
  B.on.damageTaken(p, g, { target: p, amount: 1, opts: {} }); eq(p.resources.get('echo'), B.charge.hurtMin, 'min');
  B.on.damageTaken(p, g, { target: p, amount: 199, opts: {} }); eq(p.resources.get('echo'), B.charge.hurtMin + B.charge.hurtMax, 'max');
  B.on.damageTaken(p, g, { target: p, amount: 50, opts: { dot: true } }); eq(p.resources.get('echo'), B.charge.hurtMin + B.charge.hurtMax, 'dot ignored');
  p.hp = 150; ok(p.skillSys.canUse('last_stand').reason === 'requirement', 'refused above 40%');
  p.hp = 50; ok(p.skillSys.canUse('last_stand').ok, 'allowed below 40%');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
