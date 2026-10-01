// ARMOR CORES — the defensive build. Like every item: gameplay only, the class outfit is never swapped.
export const ARMOR_CORES = {
  armor_fortress: {
    name: 'Fortress Armor', type: 'armor_core', rarity: 'rare', icon: 'cloak', color: '#c8a050',
    description: 'Walls you wear. Very hard to kill, slow to move.',
    tags: ['defense', 'tank'], allowedClasses: ['all'],
    modifiers: [{ type: 'defense', value: 0.2 }, { type: 'maxHP', value: 0.12 }, { type: 'movementSpeed', value: -0.1 }],
    effects: [],
  },
  armor_guardian: {
    name: 'Guardian Armor', type: 'armor_core', rarity: 'rare', icon: 'cloak', color: '#8ad0ff',
    description: 'Armor of a protector: stronger barriers, a steadier guard.',
    tags: ['barrier', 'guard', 'support'], allowedClasses: ['all'],
    modifiers: [{ type: 'barrierStrength', value: 0.25 }, { type: 'damageReduction', value: 0.05 }, { type: 'guardGeneration', value: 0.15 }],
    effects: [],
  },
  armor_risk: {
    name: 'Risk Armor', type: 'armor_core', rarity: 'epic', icon: 'cloak', color: '#ff5a7a',
    description: 'Half the plates are missing on purpose. Pain feeds you.',
    tags: ['risk', 'counter', 'resource'], allowedClasses: ['all'],
    modifiers: [{ type: 'defense', value: -0.2 }, { type: 'resourceGeneration', value: 0.25 }, { type: 'counterDamage', value: 0.15 }],
    effects: [],
  },
};
