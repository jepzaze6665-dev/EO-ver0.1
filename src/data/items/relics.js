// RELICS — the items that change the gameplay loop most. An effect = WHEN (trigger) + IF (condition) + WHAT (effect)
// + how often (cooldown) / how long (duration). The combat code never knows a relic by name (G3 runs these).
//   effects: [{ trigger, condition?: { type, value }, effect: { type, ...params }, cooldown?, duration?, text }]
// dropSource: where it comes from (boss / map id) — for loot tables, codex, collections, achievements later.
export const RELICS = {
  relic_oath_mirror: {
    name: 'Oath Mirror', type: 'relic', rarity: 'legendary', icon: 'sigil', color: '#ffb040',
    description: 'Perfect Guard reflects a portion of the blocked damage.',
    tags: ['guard', 'counter'], allowedClasses: ['all'], dropSource: 'boss_a1', signature: true,
    modifiers: [{ type: 'counterDamage', value: 0.15 }],
    effects: [
      { trigger: 'onPerfectGuard', effect: { type: 'reflectDamage', value: 0.15 }, cooldown: 8,
        text: 'Perfect Guard: reflect 15% of the blocked damage to the attacker (8 s cooldown).' },
    ],
  },
  relic_last_bastion: {
    name: 'Last Bastion', type: 'relic', rarity: 'epic', icon: 'heart', color: '#e0e8ff',
    description: 'When you are nearly broken, the stone holds.',
    tags: ['defense', 'survival'], allowedClasses: ['all'], dropSource: 'boss_b1', signature: true,
    modifiers: [],
    effects: [
      { trigger: 'onLowHP', condition: { type: 'hpBelow', value: 0.3 }, effect: { type: 'modifyStat', stat: 'damageReduction', value: 0.25 },
        duration: 6, cooldown: 30, text: 'HP below 30%: take 25% less damage for 6 s (30 s cooldown).' },
    ],
  },
  relic_dawn_core: {
    name: 'Dawn Core', type: 'relic', rarity: 'epic', icon: 'heart', color: '#ffe08a',
    description: 'Each shield you raise for others warms your own guard.',
    tags: ['barrier', 'support', 'guard'], allowedClasses: ['all'], dropSource: 'boss_a2', signature: true,
    modifiers: [{ type: 'barrierStrength', value: 0.1 }],
    effects: [
      { trigger: 'onBarrierCreated', effect: { type: 'gainResource', resource: 'primary', value: 10 }, cooldown: 4,
        text: 'Creating a barrier: +10 class resource (4 s cooldown).' },
    ],
  },
};
