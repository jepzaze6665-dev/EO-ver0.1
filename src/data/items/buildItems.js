// BUILD ITEMS (Character Build B4) — one BUILD-MAKING LEGENDARY per archetype (data/archetypes.js) + a few pieces for the
// archetypes that had none (burn, summon, counter). Any class (owner: free cross-role builds). Each legendary turns a
// mechanic into a play style through the generic B4 effects (items/effectSystem.js: detonateStatus, spreadStatus,
// aftershock, nova, executeTarget; trigger onPerfectDodge) and pays with a minus line.
const ALL = ['all'];
const L = (o) => ({ rarity: 'legendary', allowedClasses: ALL, levelRequirement: 25, ...o });

export const BUILD_ITEMS = {
  // ---------------- legendaries (one per archetype)
  relic_crimson_rupture: L({
    name: 'Crimson Rupture', type: 'relic', icon: 'heart', color: '#ff3050',
    description: 'Let them bleed. Then open the dam.', tags: ['bleed'],
    modifiers: [{ type: 'attackSpeed', value: -0.05 }],
    effects: [{ trigger: 'onSkillHit', condition: { type: 'targetHasStatus', status: 'bleed' },
      effect: { type: 'detonateStatus', status: 'bleed', value: 6 }, cooldown: 2.5,
      text: 'Skill hit on a BLEEDING foe: the bleed bursts at once for 6 ticks of every stack (2.5 s cooldown).' }],
  }),
  core_wildfire_heart: L({
    name: 'Wildfire Heart', type: 'weapon_core', icon: 'sword', color: '#ff7a20',
    description: 'A coal that never cooled. Everything it touches wants to burn.', tags: ['fire', 'burn'],
    modifiers: [{ type: 'magicDamage', value: 0.08 }, { type: 'defense', value: -0.1 }],
    effects: [
      { trigger: 'onHit', effect: { type: 'applyStatus', status: 'burn', duration: 3, power: 0.12 }, cooldown: 1,
        text: 'Hit: BURN for 3 s (1 s cooldown).' },
      { trigger: 'onKill', condition: { type: 'targetHasStatus', status: 'burn' }, effect: { type: 'spreadStatus', status: 'burn', radius: 130, max: 4 }, cooldown: 0.5,
        text: 'A burning foe dies: its BURN jumps to up to 4 foes nearby.' },
    ],
  }),
  armor_mirrorstep: L({
    name: 'Mirrorstep Mantle', type: 'armor_core', icon: 'cloak', color: '#e0f0ff',
    description: 'Where you were a moment ago, a blade is waiting.', tags: ['counter'],
    modifiers: [{ type: 'maxHP', value: -0.08 }],
    effects: [{ trigger: 'onPerfectDodge', effect: { type: 'nova', power: 1.6, radius: 100, color: '220,240,255' }, cooldown: 2,
      text: 'Perfect Dodge: a mirror blade bursts around you for 160% ATK (2 s cooldown).' }],
  }),
  relic_choir_shades: L({
    name: 'Choir of Shades', type: 'relic', icon: 'heart', color: '#a090ff',
    description: 'Every cut you make, something else makes again.', tags: ['summon', 'clone'],
    modifiers: [{ type: 'resourceGeneration', value: -0.1 }],
    effects: [{ trigger: 'onSkillHit', effect: { type: 'aftershock', value: 0.45, delay: 0.6 }, cooldown: 0.4,
      text: 'Skill hit: a shade strikes the same foe 0.6 s later for 45% of that damage.' }],
  }),
  armor_overflowing_ward: L({
    name: 'Overflowing Ward', type: 'armor_core', icon: 'cloak', color: '#ffe8a0',
    description: 'A shield too full to hold itself.', tags: ['barrier'],
    modifiers: [{ type: 'barrierStrength', value: 0.1 }, { type: 'attack', value: -0.08 }],
    effects: [{ trigger: 'onBarrierCreated', effect: { type: 'nova', power: 1.2, radius: 110, dmgType: 'magic', color: '255,230,150' }, cooldown: 3,
      text: 'Creating a barrier: it flares, hitting foes around you for 120% ATK (3 s cooldown).' }],
  }),
  core_galeblade: L({
    name: 'Galeblade', type: 'weapon_core', icon: 'sword', color: '#7ae0ff',
    description: 'A blade that only cuts while it moves.', tags: ['mobility'],
    modifiers: [{ type: 'movementSpeed', value: 0.06 }, { type: 'defense', value: -0.12 }],
    effects: [{ trigger: 'onDash', effect: { type: 'nova', power: 1.4, radius: 80, color: '140,230,255' }, cooldown: 1.5,
      text: 'Dash skill: a gust cuts every foe around you for 140% ATK (1.5 s cooldown).' }],
  }),
  relic_gamblers_eye: L({
    name: "Gambler's Eye", type: 'relic', icon: 'heart', color: '#ff70c0',
    description: 'Win once, and the table deals you in again.', tags: ['critical'],
    modifiers: [{ type: 'critChance', value: 0.05 }, { type: 'maxHP', value: -0.06 }],
    effects: [{ trigger: 'onCrit', effect: { type: 'reduceCooldown', all: true, value: 0.4 }, cooldown: 0.3,
      text: 'Critical hit: every skill recovers 0.4 s (0.3 s cooldown).' }],
  }),
  relic_brand_hunt: L({
    name: 'Brand of the Hunt', type: 'relic', icon: 'heart', color: '#c080ff',
    description: 'The mark is a promise. This keeps it.', tags: ['mark'],
    modifiers: [{ type: 'defense', value: -0.08 }],
    effects: [{ trigger: 'onMarkTriggered', effect: { type: 'nova', at: 'target', power: 2, radius: 90, color: '200,140,255' }, cooldown: 2,
      text: 'Your mark detonates on a foe: a second blast hits every foe near it for 200% ATK (2 s cooldown).' }],
  }),
  armor_unmoving: L({
    name: 'Unmoving Mountain', type: 'armor_core', icon: 'shield', color: '#c8b080',
    description: 'Hit the mountain, and the mountain answers.', tags: ['tank', 'defense'],
    modifiers: [{ type: 'defense', value: 0.15 }, { type: 'movementSpeed', value: -0.1 }],
    effects: [{ trigger: 'onDamageTaken', effect: { type: 'nova', power: 0.8, radius: 90, color: '220,200,150' }, cooldown: 3,
      text: 'When hit: the ground shakes, hitting foes around you for 80% ATK (3 s cooldown).' }],
  }),
  core_headsman: L({
    name: "Headsman's Verdict", type: 'weapon_core', icon: 'sword', color: '#ff4040',
    description: 'Mercy is a slow blade.', tags: ['risk', 'burst'],
    modifiers: [{ type: 'physicalDamage', value: 0.08 }, { type: 'attackSpeed', value: -0.1 }],
    effects: [{ trigger: 'onHit', effect: { type: 'executeTarget', below: 0.12 }, cooldown: 0.5,
      text: 'Hit a foe under 12% HP: it dies (not bosses or elites; 0.5 s cooldown).' }],
  }),

  // ---------------- pieces for the thin archetypes
  charm_ember: { name: 'Ember Charm', type: 'charm', rarity: 'rare', icon: 'charm', color: '#ff9a40', allowedClasses: ALL,
    description: 'Warm to the touch. Always.', tags: ['fire'],
    modifiers: [{ type: 'magicDamage', value: 0.06 }, { type: 'defense', value: -0.04 }], effects: [] },
  rune_kindling: { name: 'Kindling', type: 'rune', rarity: 'rare', icon: 'rune', color: '#ff8030', allowedClasses: ALL,
    description: 'A spark looking for somewhere to land.', tags: ['burn'], modifiers: [],
    effects: [{ trigger: 'onSkillHit', effect: { type: 'applyStatus', status: 'burn', duration: 3, power: 0.08 }, cooldown: 2,
      text: 'Skill hit: BURN for 3 s (2 s cooldown).' }] },
  armor_ashen_robe: { name: 'Ashen Robe', type: 'armor_core', rarity: 'epic', icon: 'cloak', color: '#c06030', allowedClasses: ALL,
    description: 'Cloth woven from what the fire left.', tags: ['fire', 'burn'],
    modifiers: [{ type: 'magicDamage', value: 0.1 }, { type: 'maxHP', value: -0.05 }], effects: [] },
  rune_echo_knot: { name: 'Echo Knot', type: 'rune', rarity: 'rare', icon: 'rune', color: '#9a8aff', allowedClasses: ALL,
    description: 'Tie it, and every motion happens twice.', tags: ['summon'], modifiers: [],
    effects: [{ trigger: 'onSkillHit', effect: { type: 'aftershock', value: 0.2, delay: 0.5 }, cooldown: 1.5,
      text: 'Skill hit: a faint echo strikes again for 20% (1.5 s cooldown).' }] },
  charm_shade_thread: { name: 'Thread of Shades', type: 'charm', rarity: 'rare', icon: 'charm', color: '#8070d0', allowedClasses: ALL,
    description: 'A black thread that never stays where you put it.', tags: ['summon', 'thread'],
    modifiers: [{ type: 'cooldownReduction', value: 0.05 }, { type: 'maxHP', value: -0.04 }], effects: [] },
  rune_riposte: { name: 'Riposte Sigil', type: 'rune', rarity: 'rare', icon: 'rune', color: '#ffe080', allowedClasses: ALL,
    description: 'Missed me. My turn.', tags: ['counter'], modifiers: [],
    effects: [{ trigger: 'onPerfectDodge', effect: { type: 'nextHitBonus', value: 0.4 }, duration: 2, cooldown: 3,
      text: 'Perfect Dodge: your next hit within 2 s deals +40% (3 s cooldown).' }] },
  charm_duelist: { name: "Duelist's Knot", type: 'charm', rarity: 'rare', icon: 'charm', color: '#ffd060', allowedClasses: ALL,
    description: 'Worn by people who wait for the other side to move.', tags: ['counter'],
    modifiers: [{ type: 'counterDamage', value: 0.1 }, { type: 'attack', value: -0.03 }], effects: [] },
};
