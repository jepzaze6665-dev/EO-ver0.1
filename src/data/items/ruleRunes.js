// RULE RUNES (Character Build B3) — runes that CHANGE A RULE of play (data/items/gearRules.js) instead of adding numbers.
// One at a time (Equipment.check 'oneRule'). Each has an upside and a real price; `ruleText` is shown in the tooltip.
const R = (name, color, description, tags, rules, ruleText) => ({
  name, type: 'rune', rarity: 'epic', icon: 'rune', color, description, tags, allowedClasses: ['all'],
  modifiers: [], effects: [], rules, ruleText,
});

export const RULE_RUNES = {
  rune_blood_step: R('Blood Step', '#e04050', 'Your legs run on blood now, not breath.', ['mobility', 'risk'],
    [{ type: 'blood_dodge', hp: 0.05 }], 'Dodging costs 5% max HP instead of stamina (never below 1 HP).'),
  rune_overclock: R('Overclock', '#7ae0ff', 'Spin the wheel faster. It burns more to turn.', ['resource', 'burst'],
    [{ type: 'overclock', cost: 1.8, cooldown: 0.6 }], 'Skills recover 40% faster but cost 80% more resource.'),
  rune_still_blade: R('Still Blade', '#d8e0ff', 'The calm before the cut.', ['counter'],
    [{ type: 'stillness', still: 0.4, stillMult: 1.3, moveMult: 0.9 }], 'Standing still 0.4 s: +30% damage. While moving: -10% damage.'),
  rune_reckless: R('Reckless Oath', '#ff6040', 'Swear to hit harder than you get hit. Then keep the oath.', ['risk', 'burst'],
    [{ type: 'reckless', dealt: 1.25, taken: 1.25 }], 'You deal 25% more damage and take 25% more damage.'),
  rune_desperation: R('Desperation', '#ff9040', 'Strength that only comes when it is almost over.', ['risk', 'survival'],
    [{ type: 'desperation', below: 0.35, lowMult: 1.35, above: 0.8, highMult: 0.9 }], 'Below 35% HP: +35% damage. Above 80% HP: -10% damage.'),
  rune_blood_pact: R('Blood Pact', '#c02040', 'Every wound you give feeds you a little.', ['bleed', 'sustain'],
    [{ type: 'blood_pact', share: 0.04, capPerHit: 0.02 }], 'Hits heal you for 4% of the damage dealt (max 2% max HP per hit). -10% max HP.'),
};
RULE_RUNES.rune_blood_pact.modifiers = [{ type: 'maxHP', value: -0.1 }];
