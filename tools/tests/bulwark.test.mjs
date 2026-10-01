// Unit tests for Class 2 BULWARK SENTINEL + its generic pieces (knockResist / poiseResist stats, guardBlockMult).
// Run:  node tools/tests/bulwark.test.mjs
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { SkillSystem } from '../../src/combat/skillSystem.js';
import { StatusSet } from '../../src/status/status.js';
import { RESOURCES } from '../../src/data/resources.js';
import { ITEMS } from '../../src/items/items.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { SKILL_TIERS } from '../../src/data/skillTiers.js';
import { BulwarkSentinel as B } from '../../src/skills/bulwarkSentinel.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const noop = new Proxy({}, { get: () => () => {} });
function fakeGame(allyCount = 0, foes = []) {
  const g = {
    time: 10, hitboxes: [], vfx: noop, audio: noop, camera: noop, marks: { apply() {}, get: () => 0 },
    combat: { spawnHitbox(h) { g.hitboxes.push(h); return h; } },
    world: { hostiles: () => foes, setFlag() {} }, events: { emit() {} }, after() {}, slowMo() {},
    members: [], players: () => g.members,
  };
  const mk = (x) => { const m = { x, y: 0, hp: 360, maxHp: 360, dead: false, game: g }; m.status = new StatusSet(m); return m; };
  const p = mk(0);
  p.cls = B; p.stats = { ...B.base };
  Object.defineProperty(p, 'primaryResource', { get: () => B.resource });
  p.resources = new ResourcePool(B.resources, RESOURCES, { stats: () => p.stats });
  p.gainResource = (n, raw) => p.resources.gain(B.resource, n, { raw });
  p.startAction = (a) => { p.started = a; };
  p.skillSys = new SkillSystem(p, [...B.skills, B.special]);
  g.members.push(p);
  for (let i = 0; i < allyCount; i++) g.members.push(mk(-40 - i * 20));
  return { g, p };
}
const play = (act) => { if (act.start) act.start(); for (const [, fn] of act.events || []) fn(); };
const skill = (id) => [...B.skills, B.special].find((s) => s.id === id);

console.log('bulwark sentinel');
test('class data: registered + playable Class 2 of the Aegis, own preset / gear / Bastion, low mobility', () => {
  ok(CLASSES.bulwark_sentinel === B && CLASS_TREE.bulwark_sentinel.playable && CLASS_TREE.bulwark_sentinel.parent === 'aegis_guardian', 'registry');
  ok(B.preset === 'bs' && typeof B.signatureWeapon === 'string' && RESOURCES.bastion.max === 100, 'preset / gear / resource');
  ok(B.base.speed < CLASSES.aegis_guardian.base.speed && B.base.def > CLASSES.aegis_guardian.base.def, 'slower + tougher than the Aegis');
  ok(B.base.knockResist > 0 && B.base.poiseResist > 0 && B.base.tenacity > 0, 'Unbroken stats');
  for (const s of [...B.skills, B.special]) ok(SKILL_TIERS[s.tier] && s.cooldown > 0, s.id);
});
test('Bastion from hits: capped per hit, doubled in Iron Bastion', () => {
  const { g, p } = fakeGame();
  B.on.damageTaken(p, g, { target: p, source: {}, amount: 1000 });
  ok(p.resources.get('bastion') === B.charge.hurtMax, 'cap ' + p.resources.get('bastion'));
  p.resources.set('bastion', 0); p.status.add('iron_bastion', 8);
  B.on.damageTaken(p, g, { target: p, source: {}, amount: 1000 });
  ok(p.resources.get('bastion') === B.charge.hurtMax * 2, 'x2 ' + p.resources.get('bastion'));
  ok(near(p.status.damageTakenMult(), 0.6) && near(p.status.moveMult(), 0.55), 'stance modifiers');
});
test('FORTIFIED at 70: status + drain, ends under 10, lockout before it can start again', () => {
  const { g, p } = fakeGame();
  p.resources.set('bastion', 69); B.tick(p, g, 0.1); ok(!p.status.has('fortified'), 'below');
  p.resources.set('bastion', 70); B.tick(p, g, 0.1); ok(p.status.has('fortified') && p.status.flag('unshakable'), 'on');
  B.tick(p, g, 1); ok(p.resources.get('bastion') < 70, 'drains');
  p.resources.set('bastion', 5); B.tick(p, g, 0.1); ok(!p.status.has('fortified'), 'ends');
  p.resources.set('bastion', 90); B.tick(p, g, 0.1); ok(!p.status.has('fortified'), 'lockout');
  g.time += 20; B.tick(p, g, 0.1); ok(p.status.has('fortified'), 'again later');
});
test('Counterweight: grows with damage taken, capped, x1.5 in the Citadel under the hard cap, spent, forgotten', () => {
  const { g, p } = fakeGame();
  ok(near(B.counterPower(p, 0), B.weight.basePower), 'base');
  for (let i = 0; i < 50; i++) B.on.damageTaken(p, g, { target: p, source: {}, amount: 100 });
  ok(p.weight === p.maxHp * B.weight.capShare, 'stored weight capped');
  ok(near(B.counterPower(p, 0), B.weight.maxPower), 'power capped');
  p.status.add('citadel', 10);
  const cp = B.counterPower(p, 0); ok(cp > B.weight.maxPower && cp <= B.weight.hardCap, 'citadel ' + cp);
  B.counterPower(p, 1); ok(p.weight === 0, 'spent');
  p.weight = 50; p.lastWeightT = g.time - 7; B.tick(p, g, 0.1); ok(p.weight === 0, 'forgotten');
});
test('Shieldwall: only members behind the wall (inside width / depth) are covered', () => {
  const w = { x: 0, y: 0, ang: 0, half: 70, depth: 120 }; // facing +x: behind = negative x
  ok(B.behindWall(w, { x: -40, y: 0 }) && B.behindWall(w, { x: -100, y: 60 }), 'behind');
  ok(!B.behindWall(w, { x: 40, y: 0 }) && !B.behindWall(w, { x: -40, y: 90 }) && !B.behindWall(w, { x: -150, y: 0 }), 'front / wide / too far');
  const { g, p } = fakeGame(1);
  play(skill('shieldwall').cast(p, g, 0));
  B.tick(p, g, 0.05);
  ok(p.status.has('shieldwall') && g.members[1].status.has('shieldwall'), 'caster + ally behind');
  for (let t = 0; t < 6.1; t += 0.1) { B.tick(p, g, 0.1); for (const m of g.members) m.status.update(0.1); }
  ok(!p.walls.length && !g.members[1].status.has('shieldwall'), 'ends');
});
test('Absolute Provocation: taunts every foe in range, Bastion capped at 16', () => {
  const foes = [...Array(8)].map((_, i) => { const m = { x: 30 + i * 10, y: 0, dead: false }; m.status = new StatusSet(m); return m; });
  foes.push(Object.assign({ x: 500, y: 0, dead: false }, {}));
  foes[8].status = new StatusSet(foes[8]);
  const { g, p } = fakeGame(0, foes);
  play(skill('absolute_provocation').cast(p, g, 0));
  ok(foes.slice(0, 8).every((f) => f.status.has('taunted')) && !foes[8].status.has('taunted'), 'range');
  ok(p.resources.get('bastion') === 16, 'cap ' + p.resources.get('bastion'));
});
test("Citadel of One: 50 Bastion, fortress status (slow, double dodge cost, no knockback), allies warded", () => {
  const { g, p } = fakeGame(1);
  p.resources.set('bastion', 49); ok(!p.skillSys.use('citadel_of_one', p, g, 0).ok, 'needs 50');
  p.resources.set('bastion', 50); play(p.skillSys.use('citadel_of_one', p, g, 0).result);
  ok(p.status.has('citadel') && p.status.flag('unshakable') && near(p.status.modifier('dodgeCostMult'), 2) && p.status.moveMult() <= 0.35 + 1e-9, 'fortress');
  B.tick(p, g, 0.05); ok(g.members[1].status.has('citadel_ward'), 'ally ward');
});
test('generic: guardBlockMult on FORTIFIED / Citadel halves what a block lets through', () => {
  const s = new StatusSet({}); s.add('fortified', 5); ok(near(s.modifier('guardBlockMult'), 0.5), 'fortified');
});
test('Iron Will: under 40% HP -> +50% DEF', () => {
  const { g, p } = fakeGame(); p.hp = 100; B.tick(p, g, 0.05); ok(p.status.has('iron_will') && near(p.status.modifier('defenseMult'), 1.5), 'on');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
