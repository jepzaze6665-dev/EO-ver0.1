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
// owner (Level rework L1): reaching LV 30 is enough — either route (A or B) gets there
const CLASS2_BASE = [
  { type: 'level', min: 30 },
];

export const CLASS_TREE = {
  // ---------------- tier 1 (playable starting classes)
  astral_weaver: { id: 'astral_weaver', name: 'Astral Weaver', tier: 1, playable: true },
  umbral_sword: { id: 'umbral_sword', name: 'Umbral Sword', tier: 1, playable: true },
  aegis_guardian: { id: 'aegis_guardian', name: 'Aegis Guardian', tier: 1, playable: true },

  // ---------------- tier 2 — Astral Weaver
  stormcaller: {
    id: 'stormcaller', name: 'Stormcaller', tier: 2, parent: 'astral_weaver', playable: true, resource: 'Storm Charge',
    role: 'Ranged DPS · AoE · Mobility', description: 'A mage who turns movement into lightning: move, shock, chain, unleash the Tempest.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'constellation_breaks', min: 15 }],
    trial: 'trial_stormcaller',
  },
  void_scribe: {
    id: 'void_scribe', name: 'Void Scribe', tier: 2, parent: 'astral_weaver', playable: true, resource: 'Void Ink',
    role: 'Control Mage · DoT · Debuff · Summoner', description: 'Writes slow death onto the enemy: scripts, debuffs and phantoms.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'thread_catches', min: 40 }],
    trial: 'trial_void_scribe',
  },
  lumen_oracle: {
    id: 'lumen_oracle', name: 'Lumen Oracle', tier: 2, parent: 'astral_weaver', playable: true, resource: 'Lumen',
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
    id: 'duskrunner', name: 'Duskrunner', tier: 2, parent: 'umbral_sword', playable: true, resource: 'Momentum',
    role: 'Mobility DPS · Single-Target Assassin · Combo', description: 'Never stops moving: every dodge and dash builds momentum, momentum makes every skill hit harder.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'perfect_dodges', min: 15 }],
    trial: 'trial_duskrunner',
  },
  blade_of_echoes: {
    id: 'blade_of_echoes', name: 'Blade of Echoes', tier: 2, parent: 'umbral_sword', playable: true, resource: 'Echo',
    role: 'Duelist · Counter DPS · Boss Specialist', description: 'Reads the enemy, counters it and replays its own remembered blows.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'ultimates', min: 8 }],
    trial: 'trial_blade_of_echoes',
  },

  // ---------------- tier 2 — Aegis Guardian
  warden_of_dawn: {
    id: 'warden_of_dawn', name: 'Warden of Dawn', tier: 2, parent: 'aegis_guardian', playable: true, resource: 'Dawnlight',
    role: 'Support Tank · Barrier Tank · Party Protector', description: 'Shields the whole party in dawnlight: barriers, a chain of light, holy ground and a sanctuary.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'barrier_absorbed', min: 400 }],
    trial: 'trial_warden_of_dawn',
  },
  bulwark_sentinel: {
    id: 'bulwark_sentinel', name: 'Bulwark Sentinel', tier: 2, parent: 'aegis_guardian', playable: true, resource: 'Bastion',
    role: 'Main Tank · Damage Mitigation · Frontline', description: 'An unbreakable wall: the more it blocks, the stronger it stands — taunts, shieldwalls and a fortress of one.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'blocks', min: 60 }],
    trial: 'trial_bulwark_sentinel',
  },
  oathbreaker: {
    id: 'oathbreaker', name: 'Oathbreaker', tier: 2, parent: 'aegis_guardian', playable: true, resource: 'Broken Oath',
    role: 'Counter Tank · Aggro DPS · Bruiser', description: 'Breaks the oath of pure defence: takes the blows, guards, and returns the pain as ruin.',
    requirements: [...CLASS2_BASE, { type: 'counter', counter: 'judgments', min: 15 }],
    trial: 'trial_oathbreaker',
  },
  // Secret classes / Awakenings are added the same way, e.g.
  //   eclipse_herald: { tier: 4, hidden: true, reveal: [{ type: 'flag', flag: '...' }], requirements: [...], ... }
  // (none exist yet — the unit tests register a mock one to prove the path works)
};

// ---- class trials: timed or untimed challenges measured with the same counters (progress since start)
// CLASS QUEST (Quest rework Q2): a trial may name `chapters` = the steps of its quest, in order (progression.js):
//   { type: 'talk', npc, text }               speak with that NPC (the line's master in Valehaven)
//   { type: 'counters', text }                the trial's `objectives` (class records counted from this chapter on)
//   { type: 'item', item, count, text }       carry the item (a relic: interactable kind 'trialRelic' gives it)
//   { type: 'boss', boss, text }              defeat that boss (the shadow duel, data/shadowDuels.js)
// A trial without chapters = one counters chapter (the old rule).
export function trialChapters(def) {
  return def && def.chapters && def.chapters.length ? def.chapters : [{ type: 'counters', text: '' }];
}
export const TRIALS = {
  trial_stormcaller: {
    title: 'Trial of the Gathering Storm', objectives: [{ counter: 'kills', count: 25 }, { counter: 'constellation_breaks', count: 8 }],
    chapters: [
      { type: 'talk', npc: 'master_astral', text: 'Speak with Master Corvin in Valehaven' },
      { type: 'counters', text: 'Prove the storm answers you' },
      { type: 'item', item: 'relic_storm', text: 'Find the Thunderglass Shard in Frostwind Plains (it only shows in the blizzard)' },
      { type: 'boss', boss: 'shadow_stormcaller', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_void_scribe: {
    title: 'Trial of the Unwritten', objectives: [{ counter: 'thread_catches', count: 30 }],
    chapters: [
      { type: 'talk', npc: 'master_astral', text: 'Speak with Master Corvin in Valehaven' },
      { type: 'counters', text: 'Prove the void writes through you' },
      { type: 'item', item: 'relic_void', text: 'Find the Unwritten Page in the Scribe’s Vault of the Rune Citadel (light its rune switch)' },
      { type: 'boss', boss: 'shadow_void_scribe', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_lumen_oracle: {
    title: 'Trial of the First Light', objectives: [{ counter: 'shield_absorbed', count: 200 }, { counter: 'kills', count: 10 }],
    chapters: [
      { type: 'talk', npc: 'master_astral', text: 'Speak with Master Corvin in Valehaven' },
      { type: 'counters', text: 'Prove your light keeps others standing' },
      { type: 'item', item: 'relic_lumen', text: 'Find the First Light Mote in the Whispering Forest (follow the fireflies)' },
      { type: 'boss', boss: 'shadow_lumen_oracle', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_nightfall_reaper: {
    title: 'Trial of the Long Night', objectives: [{ counter: 'shadow_breaks', count: 8 }],
    chapters: [
      { type: 'talk', npc: 'master_umbral', text: 'Speak with Master Ilsa in Valehaven' },
      { type: 'counters', text: 'Prove the night answers you' },
      { type: 'item', item: 'relic_nightfall', text: 'Find the Nightfall Ember in the Whispering Forest (follow the fireflies)' },
      { type: 'boss', boss: 'shadow_nightfall_reaper', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_duskrunner: {
    title: 'Trial of the Endless Road', objectives: [{ counter: 'perfect_dodges', count: 6 }],
    chapters: [
      { type: 'talk', npc: 'master_umbral', text: 'Speak with Master Ilsa in Valehaven' },
      { type: 'counters', text: 'Prove you never stop moving' },
      { type: 'item', item: 'relic_dusk', text: 'Find the Stormrunner Sigil in Frostwind Plains (it only shows in the blizzard)' },
      { type: 'boss', boss: 'shadow_duskrunner', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_blade_of_echoes: {
    title: 'Trial of the Resounding Blade', objectives: [{ counter: 'ultimates', count: 3 }, { counter: 'kills', count: 20 }],
    chapters: [
      { type: 'talk', npc: 'master_umbral', text: 'Speak with Master Ilsa in Valehaven' },
      { type: 'counters', text: 'Prove your blade remembers' },
      { type: 'item', item: 'relic_echo', text: 'Find the Drowned Echo at the bottom of Mirror Lake (drain it at the Sunken Temple)' },
      { type: 'boss', boss: 'shadow_blade_of_echoes', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_warden_of_dawn: {
    title: 'Trial of the Rising Sun', objectives: [{ counter: 'barrier_absorbed', count: 250 }],
    chapters: [
      { type: 'talk', npc: 'master_aegis', text: 'Speak with Master Halvard in Valehaven' },
      { type: 'counters', text: 'Prove your shield shelters others' },
      { type: 'item', item: 'relic_dawn', text: 'Find the Sunken Sunstone on the bed of Mirror Lake (drain it at the Sunken Temple)' },
      { type: 'boss', boss: 'shadow_warden_of_dawn', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_bulwark_sentinel: {
    title: 'Trial of the Unmoving Wall', objectives: [{ counter: 'blocks', count: 30 }],
    chapters: [
      { type: 'talk', npc: 'master_aegis', text: 'Speak with Master Halvard in Valehaven' },
      { type: 'counters', text: 'Prove nothing moves you' },
      { type: 'item', item: 'relic_bulwark', text: 'Find the Bronze Phalanx Crest in the Bronze Vault of the Rune Citadel (light both rune switches)' },
      { type: 'boss', boss: 'shadow_bulwark_sentinel', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
  trial_oathbreaker: {
    title: 'Trial of the Broken Oath', objectives: [{ counter: 'judgments', count: 8 }],
    chapters: [
      { type: 'talk', npc: 'master_aegis', text: 'Speak with Master Halvard in Valehaven' },
      { type: 'counters', text: 'Prove the broken oath still burns' },
      { type: 'item', item: 'relic_oath', text: 'Find the Frostbitten Oath in Frostwind Plains (it only shows in the blizzard)' },
      { type: 'boss', boss: 'shadow_oathbreaker', text: 'Defeat your shadow in the Proving Ground' },
    ],
  },
};
