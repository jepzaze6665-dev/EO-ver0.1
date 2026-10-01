// Unit tests for the Lumen Oracle (Class 2 of the Astral Weaver). Run:  node tools/tests/lumenOracle.test.mjs
// Heals / barriers / purify / radiant thread / judgment with a real ally are checked in the game by C.lumenChecks.
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { THREADS } from '../../src/data/threads.js';
import { ITEMS } from '../../src/items/items.js';
import { SKILL_ICONS } from '../../src/data/skillIcons.js';
import { StatusSet } from '../../src/status/status.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const LO = CLASSES.lumen_oracle;
const all = [...LO.skills, LO.special];
// a tiny party member: hp / maxHp / heal like Player.heal
const member = (hp, maxHp = 300) => ({ hp, maxHp, dead: false, status: new StatusSet({}), heal(n) { const b = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); return Math.round(this.hp - b); } });
const oracle = () => {
  const gained = [];
  const p = member(300); p.cls = LO; p.stats = {}; p.lumenBudget = LO.lumen.perSec; p.resources = { gain: (id, n) => gained.push(n) }; p.gained = gained;
  return p;
};
const g = { events: { emit() {} }, vfx: { text() {} } };

console.log('lumen oracle');
test('registered, playable Class 2 of the Astral Weaver, own preset / weapon / resource', () => {
  ok(LO && CLASS_TREE.lumen_oracle.playable && CLASS_TREE.lumen_oracle.parent === 'astral_weaver', 'tree');
  ok(LO.preset === 'lo' && LO.resource === 'lumen' && RESOURCES.lumen && typeof LO.signatureWeapon === 'string', 'data');
});
test('kit: 5 actives + ultimate + Lumen Burst, each with a tier, icon art and a description; own skills', () => {
  ok(LO.skills.filter((s) => s.type === 'active').length === 5 && LO.skills.some((s) => s.ultimate) && LO.special.id === 'lumen_burst', 'counts');
  for (const s of all) ok(s.tier && s.desc && SKILL_ICONS[s.id], s.id);
  const others = new Set(['astral_weaver', 'stormcaller', 'void_scribe'].flatMap((id) => [...CLASSES[id].skills, CLASSES[id].special].map((s) => s.id)));
  ok(all.every((s) => !others.has(s.id)), 'shares a skill id');
});
test('only REAL healing writes Lumen (a full-HP target gives nothing); heals give Guiding Light', () => {
  const p = oracle(), full = member(300), hurt = member(100);
  ok(LO.healTarget(p, g, full, 0.1) === 0 && p.gained.length === 0, 'full HP');
  const got = LO.healTarget(p, g, hurt, 0.1);
  ok(got === 30 && p.gained.length === 1 && Math.abs(p.gained[0] - (30 / 300) * LO.lumen.healShare) < 1e-9, `healed ${got} lumen ${p.gained}`);
  ok(hurt.status.has('guiding_light'), 'guiding light');
});
test('heals on yourself count less (a healer, not a tank); Lumen is budgeted per second', () => {
  const p = oracle(); p.hp = 100;
  ok(LO.healTarget(p, g, p, 0.1) === Math.round(300 * 0.1 * LO.heal.selfMult), 'self heal');
  const q = oracle(); let sum = 0;
  for (let i = 0; i < 30; i++) { const m = member(1); LO.healTarget(q, g, m, 0.5); }
  for (const n of q.gained) sum += n;
  ok(sum <= LO.lumen.perSec + 1e-9, 'budget ' + sum);
});
test('barriers stack but never above 45% max HP', () => {
  const p = oracle(), t = member(300);
  for (let i = 0; i < 5; i++) LO.giveBarrier(p, g, t, LO.barrier.share);
  ok(t.status.get('shield').amount === Math.round(300 * LO.barrier.cap), 'amount ' + t.status.get('shield').amount);
});
test('purify removes exactly what the class data lists (statuses + categories), nothing else', () => {
  const p = oracle(), t = member(200);
  for (const id of ['poison', 'burn', 'slow', 'curse', 'taunted', 'haste']) t.status.add(id, 5);
  const n = LO.purifyTarget(p, g, t);
  ok(n === 4 && t.status.has('taunted') && t.status.has('haste'), `${n} left ${t.status.list().map((s) => s.id)}`);
  for (const id of LO.purify.statuses) ok(STATUSES[id], 'unknown status ' + id);
});
test('Judgment of Light: +25% light damage on a Light-Marked foe; the radiant thread marks what it touches', () => {
  const p = oracle(), foe = member(100);
  ok(LO.lightMult(p, foe) === 1, 'unmarked');
  foe.status.add('light_mark', 5);
  ok(LO.lightMult(p, foe) === 1 + LO.lightMark.bonus, 'marked');
  ok(THREADS.radiant_thread.touch.status === 'light_mark' && THREADS.radiant_thread.touch.type === 'light', 'thread');
});
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
