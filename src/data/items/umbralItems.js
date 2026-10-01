// UMBRAL LINE ITEMS (Item Build I3) — Umbral Sword and its Class 2 (allowedClasses 'line:umbral_sword').
// Builds: CRITICAL (Shadow Fang, Assassin's Charm, Full Moon), BLEED (Bloodletter's Hook + Red Thirst), MOBILITY (Nightglass
// Edge, Duskweave Coat), SHADOW RESOURCE (Shadow Hunger), last-stand BURST (Heart of the Eclipse). Set ECLIPSE = Shadow Fang +
// Heart of the Eclipse + Assassin's Charm (data/items/sets.js). Every item pays for its strength (a minus line or a condition).
// Effects only use generic triggers / effects (data/items/rules.js): "mark" = the wearer's class mark, whatever class it is.
const UMBRAL = ['line:umbral_sword'];

export const UMBRAL_ITEMS = {
  core_shadow_fang: {
    name: 'Shadow Fang', type: 'weapon_core', rarity: 'rare', icon: 'sword', color: '#b060ff',
    description: 'A blade core that drinks the dark. It bites deep — and leaves you thin-skinned.',
    tags: ['shadow', 'critical', 'assassin'], allowedClasses: UMBRAL, setId: 'eclipse',
    modifiers: [{ type: 'critChance', value: 0.1 }, { type: 'shadowDamage', value: 0.1 }, { type: 'maxHP', value: -0.08 }],
    effects: [
      { trigger: 'onCrit', effect: { type: 'gainResource', resource: 'primary', value: 4 }, cooldown: 0.8,
        text: 'Critical hit: +4 class resource (0.8 s cooldown).' },
    ],
  },
  core_nightglass: {
    name: 'Nightglass Edge', type: 'weapon_core', rarity: 'epic', icon: 'sword', color: '#7ab0ff',
    description: 'Thin as a sliver of night. Fast hands, no guard.',
    tags: ['mobility', 'burst', 'assassin'], allowedClasses: UMBRAL,
    modifiers: [{ type: 'attackSpeed', value: 0.15 }, { type: 'physicalDamage', value: 0.1 }, { type: 'defense', value: -0.15 }],
    effects: [
      { trigger: 'onDodge', effect: { type: 'nextHitBonus', value: 0.25 }, duration: 2, cooldown: 3,
        text: 'Dodge: your next hit within 2 s deals +25% damage (3 s cooldown).' },
    ],
  },
  armor_duskweave: {
    name: 'Duskweave Coat', type: 'armor_core', rarity: 'rare', icon: 'cloak', color: '#8a70c0',
    description: 'Cloth that forgets where you stood. Light, quick, and little else.',
    tags: ['mobility', 'sustain'], allowedClasses: UMBRAL,
    modifiers: [{ type: 'movementSpeed', value: 0.08 }, { type: 'defense', value: -0.1 }],
    effects: [
      { trigger: 'onDash', effect: { type: 'modifyStat', stat: 'damageReduction', value: 0.15 }, duration: 1.5, cooldown: 5,
        text: 'Dash skill: -15% damage taken for 1.5 s (5 s cooldown).' },
    ],
  },
  relic_heart_eclipse: {
    name: 'Heart of the Eclipse', type: 'relic', rarity: 'legendary', icon: 'heart', color: '#ff80ff',
    description: 'It beats only when you are close to the end.',
    tags: ['shadow', 'burst', 'sustain'], allowedClasses: UMBRAL, setId: 'eclipse',
    modifiers: [{ type: 'shadowDamage', value: 0.08 }, { type: 'maxHP', value: -0.06 }],
    effects: [
      { trigger: 'onLowHP', condition: { type: 'hpBelow', value: 0.3 }, effect: { type: 'modifyStat', stat: 'shadowDamage', value: 0.3 },
        duration: 8, cooldown: 30, text: 'Falling below 30% HP: +30% Shadow Damage for 8 s (30 s cooldown).' },
    ],
  },
  relic_bloodletter: {
    name: "Bloodletter's Hook", type: 'relic', rarity: 'epic', icon: 'sword', color: '#e04050',
    description: 'A barbed hook. Wounds that keep bleeding, crits that land softer.',
    tags: ['bleed', 'assassin'], allowedClasses: UMBRAL,
    modifiers: [{ type: 'critDamage', value: -0.15 }],
    effects: [
      { trigger: 'onHit', effect: { type: 'applyStatus', status: 'bleed', duration: 4, power: 0.15 }, cooldown: 0.6,
        text: 'Hit: BLEED for 4 s (15% ATK per second per stack, up to 5 stacks; 0.6 s cooldown).' },
    ],
  },
  rune_red_thirst: {
    name: 'Red Thirst', type: 'rune', rarity: 'uncommon', icon: 'rune', color: '#ff6070',
    description: 'Blood that is already flowing is easy to take.', tags: ['bleed', 'sustain'], allowedClasses: UMBRAL,
    modifiers: [],
    effects: [
      { trigger: 'onHit', condition: { type: 'targetHasStatus', status: 'bleed' }, effect: { type: 'heal', value: 0.02 }, cooldown: 1,
        text: 'Hit a bleeding foe: heal 2% max HP (1 s cooldown).' },
    ],
  },
  rune_full_moon: {
    name: 'Full Moon', type: 'rune', rarity: 'rare', icon: 'rune', color: '#f0c8ff',
    description: 'When the marks are full, the blade sees every gap.', tags: ['mark', 'critical'], allowedClasses: UMBRAL,
    modifiers: [],
    effects: [
      { trigger: 'onMarksFull', effect: { type: 'modifyStat', stat: 'critChance', value: 0.15 }, duration: 4, cooldown: 6,
        text: 'Marks full: +15% Critical Chance for 4 s (6 s cooldown).' },
    ],
  },
  rune_shadow_hunger: {
    name: 'Shadow Hunger', type: 'rune', rarity: 'rare', icon: 'rune', color: '#9060e0',
    description: 'Spent marks feed the gauge.', tags: ['shadow', 'resource', 'mark'], allowedClasses: UMBRAL,
    modifiers: [],
    effects: [
      { trigger: 'onSkillCast', condition: { type: 'skillIs', tag: 'consumes-marks' }, effect: { type: 'gainResource', resource: 'primary', value: 15 },
        cooldown: 5, text: 'Cast a skill that spends marks (Shadow Break, Eclipse Sever): +15 class resource (5 s cooldown).' },
    ],
  },
  charm_assassin: {
    name: "Assassin's Charm", type: 'charm', rarity: 'uncommon', icon: 'charm', color: '#c080ff',
    description: 'A black thread knotted nine times.', tags: ['critical', 'assassin'], allowedClasses: UMBRAL, setId: 'eclipse',
    modifiers: [{ type: 'critChance', value: 0.06 }, { type: 'maxHP', value: -0.06 }], effects: [],
  },
};
