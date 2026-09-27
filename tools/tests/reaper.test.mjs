// Unit tests for Phase 15-16: Nightfall Reaper + the generic pieces it needed
// (resource tiers, execute damage, 'markedFoe' requirement, SummonSystem). Run:  node tools/tests/reaper.test.mjs
import { computeDamage } from '../../src/combat/damageSystem.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { SkillSystem, REQUIREMENTS } from '../../src/combat/skillSystem.js';
import { MarkSystem } from '../../src/combat/markSystem.js';
import { SummonSystem } from '../../src/combat/summonSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { MARKS } from '../../src/data/marks.js';
import { SUMMONS, SUMMON_RULES } from '../../src/data/summons.js';
import { NightfallReaper as R } from '../../src/skills/nightfallReaper.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const mid = () => 0.5;

// ---- a fake game: real Mark / Summon systems, recorded hitboxes, no-op feedback
const noop = new Proxy({}, { get: () => () => {} });
let NEXT = 100;
const foe = (x = 0, y = 0, hp = 100) => ({ id: NEXT++, x, y, hp, maxHp: hp, radius: 10, dead: false, status: { add() {} }, knockback() {} });
function fakeGame(foes = []) {
  const g = {
    time: 0, hitboxes: [], timers: [],
    vfx: noop, audio: noop, camera: noop,
    marks: new MarkSystem(MARKS),
    summons: new SummonSystem(SUMMONS),
    world: { hostiles: () => foes, map: { moveCircle(e, dx, dy) { e.x += dx; e.y += dy; } }, setFlag() {} },
    combat: { spawnHitbox(h) { g.hitboxes.push(h); return h; }, dealDamage() {} },
    after(t, fn) { g.timers.push(fn); },
    runTimers() { while (g.timers.length) g.timers.shift()(); },
    mouseWorld: () => ({ x: 50, y: 0 }),
    slowMo() {},
  };
  const p = {
    id: 1, x: 0, y: 0, facing: 0, aim: 0, cls: R, game: g, dead: false,
    stats: { ...R.base }, resources: new ResourcePool(R.resources, RESOURCES, { stats: () => p.stats }),
    status: { add() {} },
    get primaryResource() { return R.resource; },
    gainResource(n, raw) { p.resources.gain(R.resource, n, { raw }); },
    markedFoes(id, range = Infinity) { return foes.filter((m) => !m.dead && g.marks.get(m, id) > 0 && Math.hypot(m.x - p.x, m.y - p.y) <= range); },
    beginDodge() {},
  };
  return { g, p };
}
// run an action timeline's events in order
const play = (act) => { if (act.start) act.start(); for (const [, fn] of act.events || []) fn(); };

console.log('core additions');
test('resource tiers: none below 50, DUSK at 50, NIGHTFALL at 80; stats sum the active tier only', () => {
  const pool = new ResourcePool(['nightfall_gauge'], RESOURCES);
  eq(pool.tier('nightfall_gauge'), -1); ok(!pool.tierDef('nightfall_gauge'), 'no tier');
  pool.set('nightfall_gauge', 50); eq(pool.tier('nightfall_gauge'), 0); ok(pool.tierDef('nightfall_gauge').label === 'DUSK', 'dusk');
  eq(pool.tierStats().shadowDmg, 0.1, 'dusk shadowDmg');
  pool.set('nightfall_gauge', 100); eq(pool.tier('nightfall_gauge'), 1);
  const s = pool.tierStats(); eq(s.shadowDmg, 0.2); eq(s.crit, 0.1); eq(s.aoe, 0.2);
  eq(new ResourcePool(['shadow_gauge'], RESOURCES).tier('shadow_gauge'), -1, 'resources without tiers');
});
test('execute stats: bonus only under the HP line, only for the chosen type, never for DoT ticks', () => {
  const a = { stats: { atk: 10, executeDmg: 0.5, executeAt: 0.35, executeType: 'shadow' } };
  const hit = (hpRatio, type = 'shadow', extra = {}) => computeDamage(a, { hpRatio }, { power: 2, type, ...extra }, mid);
  eq(hit(0.9).amount, 20); eq(hit(0.3).amount, 30); ok(hit(0.3).tags.includes('execute'), 'tag');
  eq(hit(0.3, 'physical').amount, 20, 'other type');
  eq(hit(0.3, 'shadow', { dot: true }).amount, 20, 'dot');
  eq(computeDamage({ stats: { atk: 10 } }, { hpRatio: 0.1 }, { power: 2, type: 'shadow' }, mid).amount, 20, 'no execute stat');
});
test("requirement 'markedFoe' reads caster.markedFoes(mark, range)", () => {
  const r = { type: 'markedFoe', mark: 'reaper_mark', range: 300 };
  ok(!REQUIREMENTS.markedFoe({ markedFoes: () => [] }, r), 'none'); ok(REQUIREMENTS.markedFoe({ markedFoes: () => [{}] }, r), 'one');
  ok(!REQUIREMENTS.markedFoe({}, r), 'caster without the method never passes');
});

console.log('summonSystem');
test('create / follow / act timer / timeout, events in order', () => {
  const ev = [], sys = new SummonSystem(SUMMONS, { onEvent: (n, d) => ev.push([n, d.reason]) });
  const owner = { id: 1, x: 0, y: 0, facing: 0 };
  const s = sys.create(owner, 'shadow_doppel', 100, 0);
  ok(s && sys.count(owner) === 1 && ev[0][0] === 'summonCreated', 'created');
  sys.update(1.2); ok(Math.hypot(s.x - owner.x, s.y - owner.y) < 100, 'follows its owner');
  ok(ev.some(([n]) => n === 'summonReady'), 'acts on its timer');
  sys.update(SUMMONS.shadow_doppel.duration);
  ok(sys.count() === 0 && ev.slice(-1)[0][0] === 'summonExpired' && ev.slice(-1)[0][1] === 'timeout', 'times out');
});
test('maxPerOwner replaces the oldest; owner death removes them; hard cap; busy summons hold still', () => {
  const sys = new SummonSystem(SUMMONS), owner = { id: 1, x: 0, y: 0 };
  const a = sys.create(owner, 'shadow_doppel', 0, 0), b = sys.create(owner, 'shadow_doppel', 0, 0);
  ok(sys.count(owner) === 1 && sys.list[0] === b && !sys.list.includes(a), 'replaced');
  sys.act(b, 'atk1', 0.4); b.x = 500; sys.update(0.2); eq(b.x, 500, 'busy: no follow');
  owner.dead = true; sys.update(0.1); eq(sys.count(), 0, 'owner gone');
  for (let i = 0; i < 30; i++) sys.create({ id: 10 + i, x: 0, y: 0 }, 'shadow_doppel', 0, 0);
  ok(sys.count() <= SUMMON_RULES.maxTotal, 'capped');
  ok(sys.create({ id: 99, dead: true }, 'shadow_doppel', 0, 0) === null && sys.create({ id: 98 }, 'shadow_doppel', NaN, 0) === null, 'invalid input refused');
});

console.log('nightfall reaper');
test('class data matches the shared schema', () => {
  ok(R.id && R.stableId && R.name && R.preset === 'rp' && R.anims, 'identity + preset');
  ok(RESOURCES[R.resource] && RESOURCES[R.resource].tiers, 'resource with tiers'); ok(MARKS[R.enemyMark] && MARKS[R.enemyMark].onMax === 'hold', 'enemy mark (hold)');
  ok(R.skills.length === 5 && R.special && typeof R.basic === 'function' && R.passives.length === 2, 'kit: 4 actives + ultimate, Q special, 2 passives');
  const ids = [...R.skills, R.special].map((s) => s.id);
  ok(new Set(ids).size === ids.length, 'unique skill ids');
  for (const s of [...R.skills, R.special]) {
    ok(s.id && s.name && s.type && typeof s.cast === 'function' && s.cooldown > 0 && s.icon, 'skill ' + s.id);
    for (const r of s.requirements || []) ok(REQUIREMENTS[r.type], 'requirement type ' + r.type);
  }
  for (const id of R.defaultLoadout) ok(R.skills.some((s) => s.id === id && s.type !== 'ultimate'), 'loadout ' + id);
  for (const id of R.doppel.mirror) ok(typeof R.echo[id] === 'function' && ids.includes(id), 'clone can copy ' + id);
  for (const [k, v] of Object.entries(R.charge)) ok(Number.isFinite(v) && v > 0, 'charge rule ' + k);
  ok(new SkillSystem({ stats: {}, primaryResource: R.resource, resources: {} }, [...R.skills, R.special]), 'registers in SkillSystem');
});
test("Reaper's Arc: marks every target; +25% per mark it ALREADY had; gauge capped per cast", () => {
  const a = foe(20, 0), b = foe(-20, 0), { g, p } = fakeGame([a, b]);
  g.marks.apply(a, 'reaper_mark', { stacks: 2 });
  play(R.skills.find((s) => s.id === 'reapers_arc').cast(p, g, 0)); g.runTimers();
  const hb = g.hitboxes[0];
  eq(hb.powerFor(a), 1.8 * 1.5, 'marked x2'); eq(hb.powerFor(b), 1.8, 'unmarked');
  for (let i = 0; i < 10; i++) hb.onHit(i % 2 ? a : b);
  eq(g.marks.get(a, 'reaper_mark'), 3); eq(g.marks.get(b, 'reaper_mark'), 3);
  eq(p.resources.get(R.resource), R.charge.skillCap, 'capped');
});
test('Mark Explosion consumes all stacks: power 0.7 per stack, gauge per stack, 0 when unmarked', () => {
  const a = foe(), { g, p } = fakeGame([a]);
  eq(R.explode(p, g, a), 0); eq(g.hitboxes.length, 0, 'nothing to explode');
  g.marks.apply(a, 'reaper_mark', { stacks: 3 });
  eq(R.explode(p, g, a), 3); eq(g.marks.get(a, 'reaper_mark'), 0, 'consumed');
  eq(g.hitboxes[0].power, 0.7 * 3); ok(g.hitboxes[0].big, 'full explosion is big');
  eq(p.resources.get(R.resource), 3 * R.charge.markExplosion);
});
test('Phantom Reap: 3 path hits + a final reap that scales with marks and detonates them', () => {
  const a = foe(60, 0), { g, p } = fakeGame([a]);
  g.marks.apply(a, 'reaper_mark', { stacks: 2 });
  play(R.skills.find((s) => s.id === 'phantom_reap').cast(p, g, 0));
  eq(g.hitboxes.length, 4, 'multi-hit');
  const fin = g.hitboxes[3];
  eq(fin.powerFor(a), 1.4 + 1.4); fin.onHit(a);
  eq(g.marks.get(a, 'reaper_mark'), 0, 'detonated'); eq(g.hitboxes.length, 5, 'explosion hitbox');
});
test('Nightfall Zone: 7 pulses (slow, a mark every 2nd pulse) + a collapse that roots and pulls in', () => {
  const a = foe(30, 0), { g, p } = fakeGame([a]);
  const st = []; a.status.add = (id) => st.push(id);
  let pulled = 0; a.knockback = () => pulled++;
  R.zone(p, g, { x: 0, y: 0 });
  g.runTimers();
  eq(g.hitboxes.length, 8, 'pulses + collapse');
  g.hitboxes.forEach((h) => h.onHit(a));
  ok(st.filter((x) => x === 'slow').length === 7 && st.includes('root'), 'slow per pulse, root on collapse');
  eq(g.marks.get(a, 'reaper_mark'), 3, 'marked (capped)'); eq(pulled, 1, 'pulled to the centre');
});
test('Shadow Doppel: one clone at a time; its copies deal less; the clone never consumes marks', () => {
  const a = foe(30, 0), { g, p } = fakeGame([a]);
  const s1 = R.summonDoppel(p, g), s2 = R.summonDoppel(p, g);
  ok(g.summons.count(p) === 1 && g.summons.list[0] === s2 && s1 !== s2, 'refreshed, not stacked');
  R.echo.reapers_arc(p, g, s2);
  eq(g.hitboxes[0].power, 1.8 * SUMMONS.shadow_doppel.powerMult, 'weaker copy');
  g.marks.apply(a, 'reaper_mark', { stacks: 2 });
  R.echo.phantom_reap(p, g, s2); g.hitboxes[1].onHit(a);
  eq(g.marks.get(a, 'reaper_mark'), 3, 'adds a mark instead of detonating');
});
test("Reaper's Step: needs a marked foe in range; lands on the far side of the foe nearest the cursor", () => {
  const near = foe(80, 0), far = foe(0, 200), out = foe(900, 0), { g, p } = fakeGame([near, far, out]);
  const sp = R.special, req = sp.requirements[0];
  ok(!REQUIREMENTS[req.type](p, req), 'nobody marked');
  g.marks.apply(out, 'reaper_mark', {}); ok(!REQUIREMENTS[req.type](p, req), 'out of range');
  g.marks.apply(near, 'reaper_mark', { stacks: 2 }); g.marks.apply(far, 'reaper_mark', {});
  ok(REQUIREMENTS[req.type](p, req), 'marked foe in range');
  play(sp.cast(p, g, 0));
  ok(p.x > near.x && Math.abs(p.y) < 1e-6, `behind the target: ${p.x},${p.y}`);
  g.hitboxes[0].onHit(near); eq(g.marks.get(near, 'reaper_mark'), 0, 'target detonated');
});
test('Funeral Eclipse: spends the whole gauge, power grows with it, executes non-bosses under 20%', () => {
  const low = foe(20, 0, 100), boss = foe(-20, 0, 1000), { g, p } = fakeGame([low, boss]);
  boss.isBoss = true; boss.hp = 100; low.hp = 15;
  let executed = null; g.combat.dealDamage = (src, t, o) => { executed = { t, o }; };
  const ult = R.skills.find((s) => s.ultimate);
  p.resources.set(R.resource, 30); // what is left after the 50 cost
  const act = ult.cast.call(ult, p, g, 0); play(act); g.runTimers();
  eq(p.resources.get(R.resource), 0, 'all spent');
  const big = g.hitboxes.find((h) => h.big && h.shape === 'circle' && h.power >= 3);
  eq(big.power, 3 + 2 * 0.8, 'power from 80 gauge');
  eq(big.powerFor(boss), big.power * 1.5, 'boss under the line: bonus, not execute');
  big.onHit(boss); ok(executed === null, 'bosses are never executed');
  big.onHit(low); ok(executed && executed.t === low && executed.o.power > low.hp, 'executed');
  ok(g.summons.count(p) === 1, 'shadow clone summoned');
});
test('Death Harvest: a nearby death feeds the gauge (+kill bonus for your own kills) and hastes; far deaths only the kill bonus', () => {
  const { g, p } = fakeGame([]);
  const st = []; p.status.add = (id) => st.push(id);
  R.on.enemyKilled(p, g, { target: foe(50, 0), source: p });
  eq(p.resources.get(R.resource), R.charge.kill + R.charge.harvest); ok(st.includes('haste'), 'haste');
  R.on.enemyKilled(p, g, { target: foe(900, 0), source: p });
  eq(p.resources.get(R.resource), 2 * R.charge.kill + R.charge.harvest, 'far kill');
  R.on.enemyKilled(p, g, { target: foe(900, 0), source: { id: 7 } });
  eq(p.resources.get(R.resource), 2 * R.charge.kill + R.charge.harvest, 'far + not mine: nothing');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
