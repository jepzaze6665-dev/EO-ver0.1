// UNIVERSAL ITEMS (Item Build I3) — any class (allowedClasses ['all']). Not stronger than class items: they fill gaps
// (sustain, status resistance, boss fights) that any build may want.
export const UNIVERSAL_ITEMS = {
  armor_pathfinder: {
    name: 'Pathfinder Mail', type: 'armor_core', rarity: 'uncommon', icon: 'cloak', color: '#a0c890',
    description: 'Road armour: light, patched, made to keep walking.',
    tags: ['mobility', 'sustain'], allowedClasses: ['all'],
    modifiers: [{ type: 'maxHP', value: 0.08 }, { type: 'movementSpeed', value: 0.05 }, { type: 'statusResistance', value: 0.1 }, { type: 'defense', value: -0.05 }],
    effects: [],
  },
  relic_ember_war: {
    name: 'Ember of War', type: 'relic', rarity: 'epic', icon: 'heart', color: '#ff8a40',
    description: 'It flares when a great foe changes its rage. Costs a little of your own fire.',
    tags: ['boss', 'burst'], allowedClasses: ['all'],
    modifiers: [{ type: 'maxHP', value: -0.05 }],
    effects: [
      { trigger: 'onBossPhase', effect: { type: 'modifyStat', stat: 'attack', value: 0.15 }, duration: 10, cooldown: 20,
        text: 'A boss enters a new phase: +15% Attack for 10 s (20 s cooldown).' },
    ],
  },
  rune_second_wind: {
    name: 'Second Wind', type: 'rune', rarity: 'uncommon', icon: 'rune', color: '#8fe0a0',
    description: 'One deep breath, once in a while.', tags: ['sustain'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onLowHP', condition: { type: 'hpBelow', value: 0.35 }, effect: { type: 'heal', value: 0.12 }, cooldown: 40,
        text: 'Falling below 35% HP: heal 12% max HP (40 s cooldown).' },
    ],
  },
  rune_executioner: {
    name: "Executioner's Rune", type: 'rune', rarity: 'rare', icon: 'rune', color: '#ff9a70',
    description: 'One good cut calls the next.', tags: ['critical', 'burst'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onCrit', effect: { type: 'nextHitBonus', value: 0.2 }, duration: 2, cooldown: 4,
        text: 'Critical hit: your next hit within 2 s deals +20% damage (4 s cooldown).' },
    ],
  },
  rune_hunters_sigil: {
    name: "Hunter's Sigil", type: 'rune', rarity: 'rare', icon: 'rune', color: '#f0d070',
    description: 'A clean strike leaves a sign on the prey.', tags: ['mark', 'critical'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onCrit', effect: { type: 'addMark', value: 1 }, cooldown: 5,
        text: 'Critical hit: +1 class mark (5 s cooldown) — a Shadow Mark on you, or your mark on the foe. Classes without a mark gain nothing.' },
    ],
  },
  charm_wanderer: {
    name: "Wanderer's Charm", type: 'charm', rarity: 'common', icon: 'charm', color: '#d0c8a0',
    description: 'A lucky stone from a far road.', tags: ['mobility', 'utility'], allowedClasses: ['all'],
    modifiers: [{ type: 'movementSpeed', value: 0.06 }, { type: 'statusResistance', value: 0.1 }, { type: 'attack', value: -0.05 }], effects: [],
  },
};
