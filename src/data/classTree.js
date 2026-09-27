// CLASS PROGRESSION DATA — the class tree, class records (achievement counters) and class trials.
// Adding Class 2, an Awakening or a Secret Class = adding a node here (+ its class data file when it
// becomes playable). progression/progression.js and progression/requirements.js never name a class.
//
// Node:   { id, name, tier, parent, role, resource, description, playable, trial, requirements, hidden, hint }
//   tier       : 1 starting class · 2 Class 2 · 3 Awakening · 4 Secret (any tier may be hidden)
//   playable   : false until the class data exists in skills/classes.js (Nightfall Reaper: playable since Phase 15-16)
//   hidden     : not shown (not even as "???") until `reveal` requirements are met -> secret classes
//   requirements: see progression/requirements.js (level, quest, flag, counter, item, secrets, trial,
//                 class, any, all). The node's trial must also be passed before it unlocks.

// ---- class records: counted from game events, stored per class (event -> match -> +1 or +field)
// '$player' in a match means "the player entity"
export const CLASS_COUNTERS = {
  kills: { label: 'Enemies defeated', event: 'enemyKilled', match: { source: '$player' } },
  constellation_breaks: { label: 'Constellation Breaks', event: 'markTriggered', match: { markId: 'star_mark', source: '$player' } },
  thread_catches: { label: 'Foes caught by threads', event: 'threadTouched', match: { owner: '$player', first: true } },
  shield_absorbed: { label: 'Damage absorbed by shields', event: 'shieldAbsorbed', match: { target: '$player' }, sum: 'amount' },
  shadow_breaks: { label: 'Shadow Breaks', event: 'skillUsed', match: { skillId: 'shadow_break', caster: '$player' } },
  perfect_dodges: { label: 'Perfect Dodges', event: 'perfectDodge' },
  ambushes: { label: 'Ambushes', event: 'statusRemoved', match: { id: 'veiled', target: '$player' } },
  ultimates: { label: 'Ultimates unleashed', event: 'skillUsed', match: { caster: '$player', 'skill.ultimate': true } },
  blocks: { label: 'Attacks blocked', event: 'guardBlocked', match: { player: '$player' } },
  perfect_guards: { label: 'Perfect Guards', event: 'perfectGuard', match: { player: '$player' } },
  judgments: { label: 'Judgments', event: 'markConsumed', match: { markId: 'guardian_mark' } },
  barrier_absorbed: { label: 'Damage absorbed by barriers', event: 'shieldAbsorbed', match: { target: '$player', statusSource: '$player' }, sum: 'amount' },
};

// shared by every Class 2 path: the story so far proves the character is ready
const CLASS2_BASE = [
  { type: 'level', min: 13 },
  { type: 'quest', id: 'whispers', label: 'Defeat the Forest Guardian' },
];

export const CLASS_TREE = {
  // ---------------- tier 1 (playable starting classes)
  astral_weaver: { id: 'astral_weaver', name: 'Astral Weaver', tier: 1, playable: true },
  umbral_sword: { id: 'umbral_sword', name: 'Umbral Sword', tier: 1, playable: true },
  aegis_guardian: { id: 'aegis_guardian', name: 'Aegis Guardian', tier: 1, playable: true },

  // ---------------- tier 2 — Astral Weaver
  stormcaller: {
    id: 'stormcaller', name: 'Stormcaller', tier: 2, parent: 'astral_weaver', playable: false, resource: 'Storm Charge',
    role: 'Ranged DPS · AoE · Mobility', description: 'A mage who turns movement into lightning: move, shock, chain, unleash the Tempest.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'constellation_breaks', min: 15 }],
    trial: 'trial_stormcaller',
  },
  void_scribe: {
    id: 'void_scribe', name: 'Void Scribe', tier: 2, parent: 'astral_weaver', playable: false, resource: 'Void Ink',
    role: 'Control Mage · DoT · Debuff · Summoner', description: 'Writes slow death onto the enemy: scripts, debuffs and phantoms.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'thread_catches', min: 40 }],
    trial: 'trial_void_scribe',
  },
  lumen_oracle: {
    id: 'lumen_oracle', name: 'Lumen Oracle', tier: 2, parent: 'astral_weaver', playable: false, resource: 'Lumen',
    role: 'Support Mage · Healer · Barrier · Purifier', description: 'Turns the battlefield into holy ground: heals, barriers, purification, judgment.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'shield_absorbed', min: 300 }],
    trial: 'trial_lumen_oracle',
  },

  // ---------------- tier 2 — Umbral Sword
  nightfall_reaper: {
    id: 'nightfall_reaper', name: 'Nightfall Reaper', tier: 2, parent: 'umbral_sword', playable: true, resource: 'Nightfall Gauge',
    role: 'AoE DPS · Assassin · Execute', description: 'Harvests marked foes in a single devastating night.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'shadow_breaks', min: 20 }],
    trial: 'trial_nightfall_reaper',
  },
  duskrunner: {
    id: 'duskrunner', name: 'Duskrunner', tier: 2, parent: 'umbral_sword', playable: false, resource: 'Momentum',
    role: 'Mobility Skirmisher', description: 'Never stops moving: every dodge and dash builds momentum.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'perfect_dodges', min: 15 }],
    trial: 'trial_duskrunner',
  },
  blade_of_echoes: {
    id: 'blade_of_echoes', name: 'Blade of Echoes', tier: 2, parent: 'umbral_sword', playable: false, resource: 'Echo',
    role: 'Combo Duelist', description: 'Every strike leaves an echo that strikes again.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'ultimates', min: 8 }],
    trial: 'trial_blade_of_echoes',
  },

  // ---------------- tier 2 — Aegis Guardian
  warden_of_dawn: {
    id: 'warden_of_dawn', name: 'Warden of Dawn', tier: 2, parent: 'aegis_guardian', playable: false, resource: 'Dawnlight',
    role: 'Holy Protector · Party Support', description: 'Shields the whole party in dawnlight.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'barrier_absorbed', min: 400 }],
    trial: 'trial_warden_of_dawn',
  },
  bulwark_sentinel: {
    id: 'bulwark_sentinel', name: 'Bulwark Sentinel', tier: 2, parent: 'aegis_guardian', playable: false, resource: 'Bastion',
    role: 'Immovable Tank', description: 'An unbreakable wall: the more it blocks, the stronger it stands.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'blocks', min: 60 }],
    trial: 'trial_bulwark_sentinel',
  },
  oathbreaker: {
    id: 'oathbreaker', name: 'Oathbreaker', tier: 2, parent: 'aegis_guardian', playable: false, resource: 'Broken Oath',
    role: 'Offensive Tank · Punisher', description: 'Breaks the oath of pure defence to punish those who strike the shield.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'judgments', min: 15 }],
    trial: 'trial_oathbreaker',
  },
  // Secret classes / Awakenings are added the same way, e.g.
  //   eclipse_herald: { tier: 4, hidden: true, reveal: [{ type: 'flag', flag: '...' }], requirements: [...], ... }
  // (none exist yet — the unit tests register a mock one to prove the path works)
};

// ---- class trials: timed or untimed challenges measured with the same counters (progress since start)
export const TRIALS = {
  trial_stormcaller: { title: 'Trial of the Gathering Storm', objectives: [{ counter: 'kills', count: 25 }, { counter: 'constellation_breaks', count: 8 }] },
  trial_void_scribe: { title: 'Trial of the Unwritten', objectives: [{ counter: 'thread_catches', count: 30 }] },
  trial_lumen_oracle: { title: 'Trial of the First Light', objectives: [{ counter: 'shield_absorbed', count: 200 }, { counter: 'kills', count: 10 }] },
  trial_nightfall_reaper: { title: 'Trial of the Long Night', objectives: [{ counter: 'shadow_breaks', count: 8 }] },
  trial_duskrunner: { title: 'Trial of the Endless Road', objectives: [{ counter: 'perfect_dodges', count: 6 }] },
  trial_blade_of_echoes: { title: 'Trial of the Resounding Blade', objectives: [{ counter: 'ultimates', count: 3 }, { counter: 'kills', count: 20 }] },
  trial_warden_of_dawn: { title: 'Trial of the Rising Sun', objectives: [{ counter: 'barrier_absorbed', count: 250 }] },
  trial_bulwark_sentinel: { title: 'Trial of the Unmoving Wall', objectives: [{ counter: 'blocks', count: 30 }] },
  trial_oathbreaker: { title: 'Trial of the Broken Oath', objectives: [{ counter: 'judgments', count: 8 }] },
};
