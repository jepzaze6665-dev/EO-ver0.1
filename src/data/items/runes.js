// RUNES — three rune slots tune a build. Small, conditional effects (same format as relics).
export const RUNES = {
  rune_guarding_soul: {
    name: 'Guarding Soul', type: 'rune', rarity: 'uncommon', icon: 'rune', color: '#c8d0e0',
    description: 'Every block feeds the guard.', tags: ['guard'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onBlock', effect: { type: 'gainResource', resource: 'primary', value: 4 }, cooldown: 0.5,
        text: 'Block: +4 class resource (0.5 s cooldown).' },
    ],
  },
  rune_iron_will: {
    name: 'Iron Will', type: 'rune', rarity: 'uncommon', icon: 'rune', color: '#b0b8c8',
    description: 'The lower you fall, the harder you stand.', tags: ['defense', 'survival'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onDamageTaken', condition: { type: 'hpBelow', value: 0.4 }, effect: { type: 'modifyStat', stat: 'defense', value: 0.2 },
        duration: 4, cooldown: 1, text: 'Hit while below 40% HP: +20% Defense for 4 s.' },
    ],
  },
  rune_retribution: {
    name: 'Retribution', type: 'rune', rarity: 'rare', icon: 'rune', color: '#ff7a6a',
    description: 'A perfect guard sharpens the answer.', tags: ['guard', 'counter'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onPerfectGuard', effect: { type: 'nextHitBonus', value: 0.3 }, duration: 3, cooldown: 2,
        text: 'Perfect Guard: your next hit within 3 s deals +30% damage.' },
    ],
  },
  rune_provocation: {
    name: 'Provocation', type: 'rune', rarity: 'rare', icon: 'rune', color: '#f0a050',
    description: 'Their anger is your rest.', tags: ['taunt', 'aggro', 'cooldown'], allowedClasses: ['all'],
    modifiers: [],
    effects: [
      { trigger: 'onTaunt', effect: { type: 'reduceCooldown', tag: 'defense', value: 1 }, cooldown: 3,
        text: 'Taunt: defensive skills recover 1 s (3 s cooldown).' },
    ],
  },
};
