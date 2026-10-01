// CHARMS — small trade-offs. Modifiers only (no effects): a charm nudges a build, it never rebuilds it.
export const CHARMS = {
  charm_heavy: {
    name: 'Heavy Charm', type: 'charm', rarity: 'common', icon: 'charm', color: '#a89880',
    description: 'A lump of lead on a cord.', tags: ['defense'], allowedClasses: ['all'],
    modifiers: [{ type: 'maxHP', value: 0.08 }, { type: 'movementSpeed', value: -0.05 }], effects: [],
  },
  charm_swift: {
    name: 'Swift Charm', type: 'charm', rarity: 'common', icon: 'charm', color: '#7ad8a0',
    description: 'A feather that never stops moving.', tags: ['mobility'], allowedClasses: ['all'],
    modifiers: [{ type: 'movementSpeed', value: 0.08 }, { type: 'defense', value: -0.08 }], effects: [],
  },
  charm_focus: {
    name: 'Focus Charm', type: 'charm', rarity: 'uncommon', icon: 'charm', color: '#8ab8ff',
    description: 'A cold bead that quiets the mind.', tags: ['cooldown'], allowedClasses: ['all'],
    modifiers: [{ type: 'cooldownReduction', value: 0.08 }, { type: 'maxHP', value: -0.06 }], effects: [],
  },
  charm_guardian: {
    name: 'Guardian Charm', type: 'charm', rarity: 'uncommon', icon: 'charm', color: '#f0c850',
    description: 'A tiny bronze shield. Monsters hate it.', tags: ['aggro', 'taunt'], allowedClasses: ['all'],
    modifiers: [{ type: 'aggro', value: 0.3 }, { type: 'tauntPower', value: 0.2 }], effects: [],
  },
};
