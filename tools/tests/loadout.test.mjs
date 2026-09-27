// Unit tests for the skill loadout (keys 1-4 chosen by the player, 5 = ultimate). Run:  node tools/tests/loadout.test.mjs
import { Loadout, ACTIVE_SLOTS } from '../../src/player/loadout.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const same = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const UB = CLASSES.umbral_sword, AW = CLASSES.astral_weaver;

console.log('loadout');
test('defaults: class defaultLoadout, else the first 4 non-ultimate skills', () => {
  same(new Loadout(UB).serialize(), UB.defaultLoadout, 'UB');
  same(new Loadout(AW).serialize(), ['star_needle', 'astral_thread', 'comet_step', 'thread_burst'], 'AW');
});
test('bindings: keys 1-4 + ultimate on 5, all real skills', () => {
  const b = new Loadout(UB).bindings();
  same(b.map((x) => x.key), ['1', '2', '3', '4', '5'], 'keys');
  ok(b[4].skill.type === 'ultimate', 'ultimate on 5');
  ok(b.every((x) => typeof x.skill.cast === 'function'), 'castable');
});
test('assign: put a pool skill on a slot; swapping when it is already equipped', () => {
  const l = new Loadout(UB);
  ok(l.assign(3, 'shadow_veil'), 'assign'); same(l.slots, ['shadow_slash', 'twin_fang', 'shade_step', 'shadow_veil'], 'after assign');
  ok(l.assign(0, 'shade_step'), 'swap'); same(l.slots, ['shade_step', 'twin_fang', 'shadow_slash', 'shadow_veil'], 'after swap');
});
test('rejects: ultimate, special, unknown ids, bad slot numbers', () => {
  const l = new Loadout(UB), before = l.serialize();
  ok(!l.assign(0, 'eclipse_sever'), 'ultimate'); ok(!l.assign(0, 'shadow_break'), 'special'); ok(!l.assign(0, 'nope'), 'unknown');
  ok(!l.assign(-1, 'shadow_veil') && !l.assign(ACTIVE_SLOTS, 'shadow_veil') && !l.assign(NaN, 'shadow_veil'), 'slot range');
  same(l.serialize(), before, 'unchanged');
});
test('load from save: keeps valid unique ids, repairs broken data', () => {
  same(new Loadout(UB, ['phantom_edge', 'shadow_veil', 'twin_fang', 'shadow_slash']).serialize(), ['phantom_edge', 'shadow_veil', 'twin_fang', 'shadow_slash'], 'valid');
  const fixed = new Loadout(UB, ['phantom_edge', 'phantom_edge', 'eclipse_sever', 'ghost']).serialize();
  ok(fixed[0] === 'phantom_edge' && new Set(fixed).size === ACTIVE_SLOTS && fixed.every((id) => new Loadout(UB).has(id)), 'repaired ' + fixed);
  same(new Loadout(UB, undefined).serialize(), UB.defaultLoadout, 'old save without loadout');
});
test('every class: pool ≥ 4, one ultimate, ids unique', () => {
  for (const c of Object.values(CLASSES)) {
    const l = new Loadout(c);
    ok(l.pool().length >= ACTIVE_SLOTS, c.id + ' pool'); ok(l.ultimate(), c.id + ' ultimate');
    ok(new Set(c.skills.map((s) => s.id)).size === c.skills.length, c.id + ' unique ids');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
