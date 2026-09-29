// Unit tests for Skill Levels (Skill System S2). Run:  node tools/tests/skillLevels.test.mjs
import { levelMods, maxLevel, upgradeCheck, pointsSpent, pointsEarned, SKILL_LEVEL_RULES } from '../../src/progression/skillLevels.js';
import { SkillSystem } from '../../src/combat/skillSystem.js';
import { applySkillMods } from '../../src/combat/combat.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const UB = CLASSES.umbral_sword;
const skill = (id) => UB.skills.find((s) => s.id === id);

console.log('skill levels');
test('Umbral actives have 5 levels, each with a text; ult + special have 1', () => {
  for (const s of UB.skills.filter((x) => x.type === 'active')) {
    eq(maxLevel(s), 5, s.id);
    ok(s.levels.every((l) => l.text), s.id + ' texts');
  }
  eq(maxLevel(UB.skills.find((s) => s.type === 'ultimate')), 1); eq(maxLevel(UB.special), 1);
});
test('Lv 5 changes behaviour (a flag or value), not only numbers', () => {
  for (const s of UB.skills.filter((x) => x.levels)) {
    const m = levelMods(s, 5);
    ok(Object.keys(m.flags).length || Object.keys(m.values).length, s.id + ' Lv5 has no new behaviour');
  }
});
test('no big power creep: Lv 5 power ≤ ×1.3', () => {
  for (const s of UB.skills.filter((x) => x.levels)) ok(levelMods(s, 5).power <= 1.3, s.id);
});
test('levelMods clamps and defaults', () => {
  eq(levelMods(skill('shadow_slash'), 99).flags.shadowTrail, true);
  eq(levelMods(skill('shadow_slash'), 1).power, 1);
  eq(levelMods({ id: 'x' }, 3).power, 1);
});
test('upgradeCheck: max / character level / points', () => {
  const s = skill('twin_fang');
  eq(upgradeCheck(s, 5, 30, 99).reason, 'max');
  eq(upgradeCheck(s, 1, 2, 99).reason, 'level'); // Lv 2 needs character LV 3
  eq(upgradeCheck(s, 1, SKILL_LEVEL_RULES.charLevelFor[1], 0).reason, 'points');
  ok(upgradeCheck(s, 1, 3, 1).ok, 'ok');
});
test('points: earned from level, spent by the class skills', () => {
  eq(pointsEarned(1), 0); eq(pointsEarned(10), 9);
  const byId = { a: {}, b: {} };
  eq(pointsSpent({ skills: { a: { level: 3 }, b: { level: 1 }, gone: { level: 5 } } }, byId), 2);
  eq(pointsSpent({ skills: { a: { level: 5 } } }, byId), 6);
});
test('SkillSystem uses caster.skillMods for cooldown + cost', () => {
  const spent = [];
  const caster = {
    stats: { cdr: 0 }, primaryResource: 'r',
    resources: { canAfford: () => true, spend: (r, n) => spent.push(n), has: () => false },
    skillMods: () => ({ cooldown: 0.5, cost: 0.75 }),
  };
  const sys = new SkillSystem(caster, [{ id: 'k', cooldown: 4, cost: 20, cast: () => null }]);
  sys.use('k');
  eq(spent[0], 15); eq(sys.cooldowns.remaining('k'), 2);
});
test('applySkillMods scales power + size of the running cast only', () => {
  const owner = { castMods: { power: 1.2, area: 1.5 } };
  const hb = applySkillMods({ owner, power: 2, r: 40, len: 0 }, ['r', 'len']);
  ok(Math.abs(hb.power - 2.4) < 1e-9, 'power'); eq(hb.r, 60);
  eq(applySkillMods({ owner, power: 2, noSkillMods: true }, []).power, 2);
  eq(applySkillMods({ owner: {}, power: 2 }, []).power, 2);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
