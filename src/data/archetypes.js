// BUILD ARCHETYPES (Character Build B1, data only) — the "axes" a build is made of. Points come from:
//   - every WORN item whose tags meet the archetype's `tags` (1 point per item per archetype; an item may list its own
//     `archetypes: [ids]` instead of being read from its tags)
//   - every CHOSEN skill evolution that names `archetype: '<id>'` (ARCHETYPE_RULES.evolutionPoints each)
// Reaching a tier's points turns its bonus on (same format as a set bonus: modifiers join the item ModifierSet = same
// caps; effects run in ItemEffectSystem). items/archetypeSystem.js counts. Any class may use any archetype (owner).
// Bonuses stay small: an archetype rewards FOCUS, the real build power is in the items / evolutions themselves.
export const ARCHETYPE_RULES = {
  evolutionPoints: 2,
  // a build "is" an archetype from this many points (UI label)
  focusAt: 3,
};

export const ARCHETYPES = {
  bleed: {
    name: 'Bleed', color: '#e04050', icon: 'blood',
    description: 'Many small cuts that keep on bleeding.',
    tags: ['bleed'],
    tiers: [
      { points: 3, modifiers: [{ type: 'attackSpeed', value: 0.06 }], text: '+6% Attack Speed.' },
      { points: 5, text: 'Hit: BLEED for 4 s (1 s cooldown).',
        effects: [{ trigger: 'onHit', effect: { type: 'applyStatus', status: 'bleed', duration: 4, power: 0.1 }, cooldown: 1,
          text: 'Hit: BLEED for 4 s (10% ATK per second; 1 s cooldown).' }] },
    ],
  },
  burn: {
    name: 'Burn', color: '#ff8a30', icon: 'fire',
    description: 'Set them alight and let the fire work.',
    tags: ['fire', 'burn'],
    tiers: [
      { points: 3, modifiers: [{ type: 'magicDamage', value: 0.06 }], text: '+6% Magic Damage.' },
      { points: 5, text: 'Skill hit: BURN for 3 s (2 s cooldown).',
        effects: [{ trigger: 'onSkillHit', effect: { type: 'applyStatus', status: 'burn', duration: 3, power: 0.12 }, cooldown: 2,
          text: 'Skill hit: BURN for 3 s (2 s cooldown).' }] },
    ],
  },
  counter: {
    name: 'Counter', color: '#ffd060', icon: 'counter',
    description: 'Wait, read, punish.',
    tags: ['counter'],
    tiers: [
      { points: 3, modifiers: [{ type: 'counterDamage', value: 0.1 }], text: '+10% Counter Damage.' },
      { points: 5, text: 'Dodge: next hit +30% (4 s cooldown).',
        effects: [{ trigger: 'onDodge', effect: { type: 'nextHitBonus', value: 0.3 }, duration: 2, cooldown: 4,
          text: 'Dodge: your next hit within 2 s deals +30% (4 s cooldown).' }] },
    ],
  },
  summon: {
    name: 'Summoner', color: '#a0a0ff', icon: 'summon',
    description: 'Clones, phantoms and threads fight beside you.',
    tags: ['summon', 'clone', 'thread'],
    tiers: [
      { points: 3, modifiers: [{ type: 'cooldownReduction', value: 0.05 }], text: '+5% Cooldown Reduction.' },
      { points: 5, modifiers: [{ type: 'resourceGeneration', value: 0.12 }], text: '+12% Resource Generation.' },
    ],
  },
  barrier: {
    name: 'Barrier', color: '#ffe8a0', icon: 'barrier',
    description: 'Shields for you and the party.',
    tags: ['barrier', 'support'],
    tiers: [
      { points: 3, modifiers: [{ type: 'barrierStrength', value: 0.1 }], text: '+10% Barrier Strength.' },
      { points: 5, text: 'Low HP: barrier 12% max HP (25 s cooldown).',
        effects: [{ trigger: 'onLowHP', effect: { type: 'barrier', value: 0.12 }, cooldown: 25,
          text: 'Falling below 30% HP: barrier of 12% max HP (25 s cooldown).' }] },
    ],
  },
  momentum: {
    name: 'Momentum', color: '#7ae0ff', icon: 'wind',
    description: 'Never stand still.',
    tags: ['mobility'],
    tiers: [
      { points: 3, modifiers: [{ type: 'movementSpeed', value: 0.05 }], text: '+5% Movement Speed.' },
      { points: 5, text: 'Dash skill: -1 s on your other skills (5 s cooldown).',
        effects: [{ trigger: 'onDash', effect: { type: 'reduceCooldown', all: true, value: 1 }, cooldown: 5,
          text: 'Dash skill: every skill recovers 1 s (5 s cooldown).' }] },
    ],
  },
  critical: {
    name: 'Critical', color: '#ff70c0', icon: 'crit',
    description: 'Look for the gap, hit it hard.',
    tags: ['critical'],
    tiers: [
      { points: 3, modifiers: [{ type: 'critChance', value: 0.05 }], text: '+5% Critical Chance.' },
      { points: 5, modifiers: [{ type: 'critDamage', value: 0.2 }], text: '+20% Critical Damage.' },
    ],
  },
  mark: {
    name: 'Marked Prey', color: '#c080ff', icon: 'mark',
    description: 'Mark them, then cash the marks in.',
    tags: ['mark', 'star_mark', 'shadow'],
    tiers: [
      { points: 3, modifiers: [{ type: 'shadowDamage', value: 0.06 }, { type: 'magicDamage', value: 0.04 }], text: '+6% Shadow Damage, +4% Magic Damage.' },
      { points: 5, text: 'Kill: +1 mark (3 s cooldown).',
        effects: [{ trigger: 'onKill', effect: { type: 'addMark', value: 1 }, cooldown: 3, text: 'Kill: +1 mark (3 s cooldown).' }] },
    ],
  },
  bulwark: {
    name: 'Bulwark', color: '#c8b080', icon: 'shield',
    description: 'Stand in front, take the hits.',
    tags: ['guard', 'defense', 'tank', 'taunt', 'aggro', 'survival'],
    tiers: [
      { points: 3, modifiers: [{ type: 'defense', value: 0.08 }], text: '+8% Defense.' },
      { points: 5, modifiers: [{ type: 'maxHP', value: 0.08 }, { type: 'damageReduction', value: 0.04 }], text: '+8% HP, -4% damage taken.' },
    ],
  },
  execute: {
    name: 'Executioner', color: '#ff4040', icon: 'skull',
    description: 'Big hits, big risks.',
    tags: ['burst', 'risk', 'boss'],
    tiers: [
      { points: 3, modifiers: [{ type: 'physicalDamage', value: 0.06 }], text: '+6% Physical Damage.' },
      { points: 5, text: 'Kill: next hit +40% (6 s cooldown).',
        effects: [{ trigger: 'onKill', effect: { type: 'nextHitBonus', value: 0.4 }, duration: 4, cooldown: 6,
          text: 'Kill: your next hit within 4 s deals +40% (6 s cooldown).' }] },
    ],
  },
};
