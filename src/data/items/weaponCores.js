// WEAPON CORES — the gameplay heart of the weapon. A core never changes the weapon you SEE (the class's signature
// weapon is drawn by the class sprite); it changes stats, resource gain and how fights are played.
// Format: see data/items/rules.js (modifier / trigger / condition / effect names). Prototype values — tune freely.
export const WEAPON_CORES = {
  core_ironheart: {
    name: 'Ironheart Core', type: 'weapon_core', rarity: 'rare', icon: 'shield', color: '#c8d0e0',
    description: 'A core of folded iron. Every blow you take steels the next block.',
    tags: ['guard', 'defense'], allowedClasses: ['all'],
    modifiers: [{ type: 'defense', value: 0.15 }, { type: 'guardGeneration', value: 0.25 }],
    effects: [],
  },
  core_counter: {
    name: 'Counter Core', type: 'weapon_core', rarity: 'rare', icon: 'sword', color: '#ff7a6a',
    description: 'Built to answer. Your counters cut deeper, your shields grow thinner.',
    tags: ['counter', 'risk'], allowedClasses: ['all'],
    modifiers: [{ type: 'counterDamage', value: 0.3 }, { type: 'barrierStrength', value: -0.2 }],
    effects: [],
  },
  core_vanguard: {
    name: 'Vanguard Core', type: 'weapon_core', rarity: 'uncommon', icon: 'shield', color: '#f0c850',
    description: 'Stand at the front. Foes look at you first — and you are slower to leave.',
    tags: ['aggro', 'defense'], allowedClasses: ['all'],
    modifiers: [{ type: 'maxHP', value: 0.15 }, { type: 'aggro', value: 0.5 }, { type: 'movementSpeed', value: -0.08 }],
    effects: [],
  },
};
