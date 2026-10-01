// BOSS SIGNATURE ITEMS (Item Build I4) — one per boss that had none yet. Each drops at 100% on the boss's first kill
// (lootTables: bosses pay once) and is marked `signature` + `dropSource`. Like every boss item: a BUILD OPTION with a
// clear price, never needed to beat the next map (owner spec §20 / §22: sidegrades, not a power ladder).
// (Guardian = Oath Mirror, Magma Beast = Dawn Core, Hoarfang = Last Bastion live in relics.js since G6.)
export const BOSS_ITEMS = {
  // A3 major boss — the Rune Knight switches sword / shield stance: casting raises a shield for a moment
  core_runeblade: {
    name: "Runeknight's Blade", type: 'weapon_core', rarity: 'epic', icon: 'sword', color: '#7ac8ff',
    description: 'The Rune Knight\'s blade, still answering its old commands. Heavy in the swing, sure in the guard.',
    tags: ['burst', 'guard', 'boss'], allowedClasses: ['all'], dropSource: 'boss_a3', signature: true,
    modifiers: [{ type: 'attack', value: 0.1 }, { type: 'critDamage', value: 0.2 }, { type: 'attackSpeed', value: -0.1 }],
    effects: [
      { trigger: 'onSkillCast', effect: { type: 'modifyStat', stat: 'defense', value: 0.3 }, duration: 3, cooldown: 8,
        text: 'Cast a skill: SHIELD STANCE, +30% Defense for 3 s (8 s cooldown).' },
    ],
  },
  // B2 boss — the Amethyst Colossus's crystal armour grows back
  armor_amethyst_shell: {
    name: 'Amethyst Shell', type: 'armor_core', rarity: 'epic', icon: 'cloak', color: '#c080ff',
    description: 'Plates of living amethyst from the Colossus. They regrow after a blow — and weigh like stone.',
    tags: ['defense', 'barrier', 'boss'], allowedClasses: ['all'], dropSource: 'boss_b2', signature: true,
    modifiers: [{ type: 'defense', value: 0.25 }, { type: 'damageReduction', value: 0.05 }, { type: 'movementSpeed', value: -0.1 }, { type: 'attackSpeed', value: -0.05 }],
    effects: [
      { trigger: 'onDamageTaken', effect: { type: 'barrier', value: 0.12 }, duration: 5, cooldown: 12,
        text: 'Hit: crystal regrows, barrier of 12% max HP for 5 s (12 s cooldown).' },
    ],
  },
  // B3 major boss — the Crystal Warden's last ward
  relic_warden_prism: {
    name: "Warden's Prism", type: 'relic', rarity: 'legendary', icon: 'sigil', color: '#bfe6ff',
    description: 'The heart-prism of the Crystal Warden. It bends time a little — and light through your body.',
    tags: ['cooldown', 'sustain', 'boss'], allowedClasses: ['all'], dropSource: 'boss_b3', signature: true,
    modifiers: [{ type: 'cooldownReduction', value: 0.08 }, { type: 'maxHP', value: -0.08 }],
    effects: [
      { trigger: 'onLowHP', condition: { type: 'hpBelow', value: 0.4 }, effect: { type: 'barrier', value: 0.25 }, duration: 6, cooldown: 45,
        text: 'Falling below 40% HP: PRISM WARD, barrier of 25% max HP for 6 s (45 s cooldown).' },
    ],
  },
  // A2 SECRET boss — Varkharon, the Sealed Cinder King (MYTHIC = red): huge offence, paid for with your own body
  relic_cinder_crown: {
    name: "Cinder King's Crown", type: 'relic', rarity: 'mythic', icon: 'heart', color: '#ff3030', levelRequirement: 45,
    description: 'A crown of black stone and living fire, torn from the sealed king. It burns everything — its wearer too.',
    tags: ['fire', 'burst', 'boss', 'secret'], allowedClasses: ['all'], dropSource: 'boss_varkharon', signature: true,
    modifiers: [{ type: 'attack', value: 0.15 }, { type: 'critDamage', value: 0.2 }, { type: 'maxHP', value: -0.12 }, { type: 'defense', value: -0.1 }],
    effects: [
      { trigger: 'onHit', effect: { type: 'applyStatus', status: 'burn', duration: 3, power: 0.12 }, cooldown: 1,
        text: 'Hit: BURN for 3 s (12% ATK per tick per stack; 1 s cooldown).' },
      { trigger: 'onLowHP', condition: { type: 'hpBelow', value: 0.25 }, effect: { type: 'modifyStat', stat: 'attack', value: 0.25 }, duration: 8, cooldown: 40,
        text: 'Falling below 25% HP: KING\'S WRATH, +25% Attack for 8 s (40 s cooldown).' },
    ],
  },
};
