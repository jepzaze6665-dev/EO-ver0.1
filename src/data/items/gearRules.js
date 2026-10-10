// GEAR RULES (Character Build B3) — RULE RUNES change how the game plays for you, not only numbers. An item carries
// `rules: [{ type, ...params }]`; only ONE rule item may be worn at a time (Equipment.check -> EQUIP_FAIL.oneRule).
// The hooks that read them are generic (Player.gearRule(type)): items/gearRules.js has the handlers.
//   blood_dodge  { hp }               dodge spends hp × max HP instead of stamina (never below 1 HP)
//   overclock    { cost, cooldown }   skill resource cost × cost, cooldown × cooldown
//   stillness    { still, stillMult, moveMult }  standing still `still` s: damage × stillMult, else × moveMult
//   reckless     { dealt, taken }     damage dealt × dealt, damage taken × taken
//   desperation  { below, lowMult, above, highMult }  HP under `below` -> × lowMult, HP over `above` -> × highMult
//   blood_pact   { share, capPerHit } every hit on a foe heals share of the damage (≤ capPerHit × max HP)
export const GEAR_RULES = {
  blood_dodge: { name: 'Blood Step', defaults: { hp: 0.05 } },
  overclock: { name: 'Overclock', defaults: { cost: 1.8, cooldown: 0.6 } },
  stillness: { name: 'Still Blade', defaults: { still: 0.4, stillMult: 1.3, moveMult: 0.9 } },
  reckless: { name: 'Reckless', defaults: { dealt: 1.25, taken: 1.25 } },
  desperation: { name: 'Desperation', defaults: { below: 0.35, lowMult: 1.35, above: 0.8, highMult: 0.9 } },
  blood_pact: { name: 'Blood Pact', defaults: { share: 0.04, capPerHit: 0.02 } },
};
export const GEAR_RULE_LIMITS = { maxRuleItems: 1, minCooldownMult: 0.4 };
