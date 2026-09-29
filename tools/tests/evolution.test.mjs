// Unit tests for Skill Evolution (Skill System S4). Run:  node tools/tests/evolution.test.mjs
import { evolutionsOf, evolutionById, evolutionCheck, withEvolution, EVOLUTION_RULES } from '../../src/progression/skillEvolution.js';
import { levelMods } from '../../src/progression/skillLevels.js';
import { ClassProgress } from '../../src/progression/classProgress.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const slash = CLASSES.umbral_sword.skills.find((s) => s.id === 'shadow_slash');
const ctx = (o = {}) => ({ skillLevel: 1, masteryLevel: 0, charLevel: 1, current: null, ...o });

console.log('skill evolution');
test('every class skill has 0-3 evolutions, each changes behaviour (flag) and explains it', () => {
  for (const c of Object.values(CLASSES)) for (const s of [...c.skills, c.special].filter(Boolean)) {
    const evs = s.evolutions || [];
    ok(evs.length <= EVOLUTION_RULES.maxOptions, s.id + ' too many');
    for (const e of evs) {
      ok(e.id && e.name && e.desc && e.changes && e.changes.behavior, `${s.id}/${e.id} texts`);
      ok(e.flags && Object.keys(e.flags).length, `${s.id}/${e.id} is only numbers`);
      ok(e.requirements && e.requirements.skillLevel && e.requirements.masteryLevel, `${s.id}/${e.id} requirements`);
    }
    eq(new Set(evs.map((e) => e.id)).size, evs.length, s.id + ' duplicate ids');
  }
});
test('Shadow Slash: Fang / Wave / Phantom Cut', () => {
  eq(evolutionsOf(slash).map((e) => e.id).join(), 'shadow_fang,shadow_wave,phantom_cut');
});
test('requirements: skill level + mastery (+ flag / item)', () => {
  eq(evolutionCheck(slash, 'shadow_fang', ctx()).reason, 'requirements');
  eq(evolutionCheck(slash, 'shadow_fang', ctx({ skillLevel: 3, masteryLevel: 2 })).missing.join(), 'Mastery III');
  ok(evolutionCheck(slash, 'shadow_fang', ctx({ skillLevel: 3, masteryLevel: 3 })).ok, 'ok');
  eq(evolutionCheck(slash, 'phantom_cut', ctx({ skillLevel: 3, masteryLevel: 3 })).missing.join(), 'Skill Lv 5');
  const custom = { evolutions: [{ id: 'x', requirements: { skillLevel: 1, masteryLevel: 1, flag: 'f', item: 'i' } }] };
  eq(evolutionCheck(custom, 'x', ctx({ masteryLevel: 1 })).missing.length, 2);
  ok(evolutionCheck(custom, 'x', ctx({ masteryLevel: 1, hasFlag: () => true, hasItem: () => true })).ok, 'flag+item');
});
test('only ONE branch: a chosen skill refuses the others', () => {
  const c = ctx({ skillLevel: 5, masteryLevel: 4, current: 'shadow_wave' });
  eq(evolutionCheck(slash, 'shadow_fang', c).reason, 'other_chosen');
  eq(evolutionCheck(slash, 'shadow_wave', c).reason, 'chosen');
  eq(evolutionCheck(slash, 'nope', ctx()).reason, 'unknown');
});
test('withEvolution multiplies numbers on top of the level and adds flags', () => {
  const m = withEvolution(levelMods(slash, 5), evolutionById(slash, 'shadow_wave'));
  ok(Math.abs(m.power - 1.3 * 0.75) < 1e-9, 'power'); ok(Math.abs(m.area - 1.15 * 1.35) < 1e-9, 'area');
  ok(m.flags.wave && m.flags.shadowTrail, 'both flags'); eq(m.evolution, 'shadow_wave');
  eq(withEvolution(levelMods(slash, 1), null).power, 1);
});
test('the original skill data is never changed; the choice lives in classProgress (saved)', () => {
  const before = JSON.stringify(slash.levels);
  const cp = new ClassProgress(); cp.switchTo('umbral_sword');
  cp.skill('umbral_sword', 'shadow_slash').evolution = 'phantom_cut';
  eq(JSON.stringify(slash.levels), before);
  eq(new ClassProgress().load(cp.serialize()).peekSkill('umbral_sword', 'shadow_slash').evolution, 'phantom_cut');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
