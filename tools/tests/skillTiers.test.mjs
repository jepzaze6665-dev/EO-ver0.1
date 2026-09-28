// Combat 2.0 phase C7 — skill commitment tiers. Run:  node tools/tests/skillTiers.test.mjs
import { SKILL_TIERS, staminaCost, tierProblems } from '../../src/data/skillTiers.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const skillsOf = (c) => [...c.skills.filter((s) => !s.basic), c.special].filter(Boolean);

console.log('skill tiers');
test('three tiers, stamina rises with commitment (fast < medium < high)', () => {
  const t = SKILL_TIERS; ok(t.fast.stamina < t.medium.stamina && t.medium.stamina < t.high.stamina, 'order');
  ok(t.fast.maxDur < t.medium.maxDur && t.high.superArmor, 'limits');
});
test('staminaCost: own value > tier default > 0', () => {
  ok(staminaCost({ tier: 'fast' }) === SKILL_TIERS.fast.stamina, 'tier'); ok(staminaCost({ tier: 'high', stamina: 0 }) === 0, 'explicit 0');
  ok(staminaCost({ stamina: 9 }) === 9, 'own'); ok(staminaCost({}) === 0 && staminaCost(null) === 0, 'none');
});
test('tierProblems flags slow "fast" skills, late cancels and un-armoured high-impact skills', () => {
  ok(tierProblems({ tier: 'fast' }, { dur: 0.9, cancelAt: 0.1 }).length === 1, 'too long');
  ok(tierProblems({ tier: 'medium' }, { dur: 0.5, cancelAt: 0.6 }).length === 1, 'late cancel');
  ok(tierProblems({ tier: 'high' }, { dur: 1, cancelAt: 99 }).includes('needs superArmor'), 'armour');
  ok(tierProblems({ tier: 'high' }, { dur: 1, cancelAt: 99, superArmor: true }).length === 0, 'ok');
  ok(tierProblems({ tier: 'nope' }, null).length === 1, 'unknown');
});
test('every class skill (1-5 + special) names a tier; ultimates are high impact', () => {
  for (const [id, c] of Object.entries(CLASSES)) for (const s of skillsOf(c)) {
    ok(SKILL_TIERS[s.tier], `${id}.${s.id} tier`);
    if (s.ultimate || s.type === 'ultimate') ok(s.tier === 'high', `${id}.${s.id} ultimate must be high`);
  }
});
test('skill stamina stays in the spec range (0 or 5-35); basic attacks free', () => {
  for (const [id, c] of Object.entries(CLASSES)) {
    for (const s of skillsOf(c)) { const st = staminaCost(s); ok(st === 0 || (st >= 5 && st <= 35), `${id}.${s.id} = ${st}`); }
    ok(!c.skills.some((s) => s.basic && staminaCost(s)), id + ' basic free');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
