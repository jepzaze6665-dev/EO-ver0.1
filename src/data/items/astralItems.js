// ASTRAL LINE ITEMS (Item Build I3) — Astral Weaver and its Class 2 (allowedClasses 'line:astral_weaver').
// Astral hits are 'magic', so ASTRAL damage = the magicDamage modifier. Builds: STAR MARK (Star Loom Core, Shattered Orrery),
// THREAD CONTROL (Weaver's Spindle), RESOURCE / COOLDOWN (Fallen Constellation, Comet Tail), BURST (Supernova), SURVIVAL
// (Starveil Robe). Set CONSTELLATION = Star Loom Core + Starveil Robe + Supernova (data/items/sets.js).
const ASTRAL = ['line:astral_weaver'];

export const ASTRAL_ITEMS = {
  core_star_loom: {
    name: 'Star Loom Core', type: 'weapon_core', rarity: 'rare', icon: 'staff', color: '#8ad8ff',
    description: 'A loom fragment still humming with starlight. Heavy to carry.',
    tags: ['astral', 'star_mark', 'cooldown'], allowedClasses: ASTRAL, setId: 'constellation',
    modifiers: [{ type: 'magicDamage', value: 0.12 }, { type: 'resourceGeneration', value: 0.1 }, { type: 'movementSpeed', value: -0.06 }],
    effects: [
      { trigger: 'onMarkTriggered', effect: { type: 'reduceCooldown', tag: 'magic', value: 1 }, cooldown: 2,
        text: 'Your mark detonates (Constellation Break): magic skills recover 1 s (2 s cooldown).' },
    ],
  },
  core_fallen_constellation: {
    name: 'Fallen Constellation', type: 'weapon_core', rarity: 'epic', icon: 'staff', color: '#c8b0ff',
    description: 'Stars that fell together. Cheaper to call down, never as bright.',
    tags: ['astral', 'resource', 'aoe'], allowedClasses: ['astral_weaver'],
    modifiers: [{ type: 'resourceCost', value: -0.15 }, { type: 'magicDamage', value: -0.08 }, { type: 'cooldownReduction', value: 0.05 }],
    skillModifiers: [
      { skillId: 'starfall_fate', stat: 'cost', operation: 'MULTIPLY', value: 0.7 },
      { skillId: 'starfall_fate', stat: 'damage', operation: 'MULTIPLY', value: 0.85 },
    ],
    modText: 'Starfall costs 30% less Astral Charge but deals 15% less damage.',
    effects: [],
  },
  armor_starveil: {
    name: 'Starveil Robe', type: 'armor_core', rarity: 'rare', icon: 'cloak', color: '#a0c8ff',
    description: 'Woven from the night sky. It catches the blow you did not see.',
    tags: ['sustain', 'utility', 'barrier'], allowedClasses: ASTRAL, setId: 'constellation',
    modifiers: [{ type: 'maxHP', value: 0.1 }, { type: 'barrierStrength', value: 0.15 }, { type: 'magicDamage', value: -0.06 }],
    effects: [
      { trigger: 'onDamageTaken', condition: { type: 'hpBelow', value: 0.5 }, effect: { type: 'barrier', value: 0.1 }, duration: 4, cooldown: 15,
        text: 'Hit while below 50% HP: barrier of 10% max HP for 4 s (15 s cooldown).' },
    ],
  },
  relic_orrery: {
    name: 'Shattered Orrery', type: 'relic', rarity: 'legendary', icon: 'sigil', color: '#5af0ff',
    description: 'Its rings still turn. Every falling star winds it a little further.',
    tags: ['star_mark', 'resource'], allowedClasses: ASTRAL,
    modifiers: [{ type: 'critChance', value: -0.05 }],
    effects: [
      { trigger: 'onMarkTriggered', effect: { type: 'gainResource', resource: 'primary', value: 12 }, cooldown: 1.5,
        text: 'Your mark detonates: +12 class resource (1.5 s cooldown).' },
    ],
  },
  relic_spindle: {
    name: "Weaver's Spindle", type: 'relic', rarity: 'epic', icon: 'sigil', color: '#80e0c0',
    description: 'Threads spun on it hold fast. Your hands grow slow at the wheel.',
    tags: ['thread', 'control'], allowedClasses: ASTRAL,
    modifiers: [{ type: 'cooldownReduction', value: -0.05 }],
    effects: [
      { trigger: 'onSkillHit', condition: { type: 'skillIs', tag: 'thread' }, effect: { type: 'applyStatus', status: 'slow', duration: 1.5 }, cooldown: 2,
        text: 'A thread skill hits: SLOW the foe for 1.5 s (2 s cooldown).' },
    ],
  },
  rune_comet_tail: {
    name: 'Comet Tail', type: 'rune', rarity: 'uncommon', icon: 'rune', color: '#ffe08a',
    description: 'Moving fast leaves light behind.', tags: ['mobility', 'resource'], allowedClasses: ASTRAL,
    modifiers: [],
    effects: [
      { trigger: 'onDash', effect: { type: 'gainResource', resource: 'primary', value: 6 }, cooldown: 3,
        text: 'Dash skill: +6 class resource (3 s cooldown).' },
    ],
  },
  rune_supernova: {
    name: 'Supernova', type: 'rune', rarity: 'rare', icon: 'rune', color: '#ffb0ff',
    description: 'A full sky wants to burst.', tags: ['burst', 'resource'], allowedClasses: ASTRAL, setId: 'constellation',
    modifiers: [],
    effects: [
      { trigger: 'onFullResource', effect: { type: 'nextHitBonus', value: 0.4 }, duration: 5, cooldown: 10,
        text: 'Class resource full: your next hit within 5 s deals +40% damage (10 s cooldown).' },
    ],
  },
  charm_starfocus: {
    name: 'Starfocus Charm', type: 'charm', rarity: 'uncommon', icon: 'charm', color: '#8ab8ff',
    description: 'A lens of frozen starlight.', tags: ['astral'], allowedClasses: ASTRAL,
    modifiers: [{ type: 'magicDamage', value: 0.08 }, { type: 'defense', value: -0.08 }], effects: [],
  },
};
