// Secret class WYRMBLOOD REAVER + the generic HP-cost rule. Run:  node tools/tests/wyrmblood.test.mjs
import { SkillSystem, SKILL_FAIL } from '../../src/combat/skillSystem.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { SKILL_TIERS } from '../../src/data/skillTiers.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// a duck-typed caster (SkillSystem only needs these)
function caster(hp, maxHp = 200) {
  const c = {
    hp, maxHp, paid: [],
    resources: { canAfford: () => true, spend() {}, has: () => false, get: () => 0 },
    spendHp(n, why) { const p = Math.min(n, this.hp - 1); this.hp -= p; this.paid.push([p, why]); return p; },
  };
  return c;
}
const skill = { id: 'cut', cooldown: 1, hpCost: 0.1, cast: () => ({}) };

console.log('wyrmblood reaver');
test('HP cost: paid from HP (share of max HP) when the skill is used', () => {
  const c = caster(150), s = new SkillSystem(c, [skill]);
  const r = s.use('cut');
  ok(r.ok && c.hp === 130 && c.paid[0][0] === 20 && c.paid[0][1] === 'skill:cut', `hp ${c.hp} paid ${JSON.stringify(c.paid)}`);
});
test('HP cost: refused (reason hp) when HP is not above the cost — a cast never kills, nothing is spent', () => {
  const c = caster(21), s = new SkillSystem(c, [skill]);
  const r = s.use('cut');
  ok(!r.ok && r.reason === SKILL_FAIL.HP && c.hp === 21 && s.cooldowns.ready('cut'), `reason ${r.reason} hp ${c.hp}`);
});
test('HP cost follows skill-level cost modifiers', () => {
  const c = caster(150); c.skillMods = () => ({ cooldown: 1, cost: 0.5 });
  const s = new SkillSystem(c, [skill]);
  ok(s.hpCostFor(skill) === 10, `cost ${s.hpCostFor(skill)}`);
});
test('class data: registered, hidden tier-4 node of the Umbral line, needs an Umbral Class 2 + LV 50 + the Heart', () => {
  const cls = CLASSES.wyrmblood_reaver, n = CLASS_TREE.wyrmblood_reaver;
  ok(cls && cls.preset === 'wr' && cls.resource === 'wyrm_fury' && RESOURCES.wyrm_fury, 'class / resource');
  ok(n && n.tier === 4 && n.hidden && n.parent === 'umbral_sword' && n.playable, 'tree node');
  const req = JSON.stringify(n.requirements);
  ok(req.includes('"min":50') && req.includes('heart_of_varkharon') && ['nightfall_reaper', 'duskrunner', 'blade_of_echoes'].every((id) => req.includes(id)), req);
  ok(n.reveal && n.reveal[0].flag === 'dragon_slain', 'revealed by the dragon kill');
});
test('every active skill costs HP, tiers are valid, the special / ultimate spend Fury', () => {
  const cls = CLASSES.wyrmblood_reaver;
  for (const s of cls.skills.filter((x) => x.type === 'active')) ok(s.hpCost > 0 && s.hpCost <= 0.2 && SKILL_TIERS[s.tier], s.id);
  const ult = cls.skills.find((s) => s.ultimate);
  ok(ult && ult.cost === 90 && !ult.hpCost, 'ultimate = 90 Fury');
  ok(cls.special.requirements[0].resource === 'wyrm_fury' && cls.special.requirements[0].min === 30, 'Vein Burst needs 30 Fury');
});
test("passives: Dragon's Thirst multiplier, Cursed Vein flags, statuses exist", () => {
  const cls = CLASSES.wyrmblood_reaver, p = (share) => ({ hp: share * 100, maxHp: 100, cls });
  ok(cls.hitMult(p(1)) === 1 && cls.hitMult(p(0.49)) === 1.2 && cls.hitMult(p(0.29)) === 1.4, 'thirst table');
  ok(cls.noEndure === true && cls.potionMult === 0.6, 'cursed vein');
  ok(STATUSES.blood_pact && STATUSES.blood_awaken && STATUSES.blood_awaken.flags.includes('deathless'), 'statuses');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
