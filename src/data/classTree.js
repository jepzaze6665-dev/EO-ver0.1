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
// hint = how to earn it (shown under the counter in the quest tracker and the Class tab)
export const CLASS_COUNTERS = {
  kills: { label: 'Enemies defeated', hint: 'Defeat any monsters yourself, on any field map', event: 'enemyKilled', match: { source: '$player' } },
  constellation_breaks: { label: 'Constellation Breaks', hint: 'The 3rd hit of your basic combo puts a Star Mark on a foe; 3 Star Marks on one foe burst into a Constellation Break', event: 'markTriggered', match: { markId: 'star_mark', source: '$player' } },
  thread_catches: { label: 'Foes caught by threads', hint: 'Lay an Astral Thread (skill 2) where foes will walk across it', event: 'threadTouched', match: { owner: '$player', first: true } },
  shield_absorbed: { label: 'Damage absorbed by shields', hint: 'Let a shield or barrier on you soak enemy hits', event: 'shieldAbsorbed', match: { target: '$player' }, sum: 'amount' },
  shadow_breaks: { label: 'Shadow Breaks', hint: 'Fill 3 Shadow Marks, then press Q for Shadow Break', event: 'skillUsed', match: { skillId: 'shadow_break', caster: '$player' } },
  perfect_dodges: { label: 'Perfect Dodges', hint: 'Dodge (Space) just before an enemy attack lands', event: 'perfectDodge' },
  ambushes: { label: 'Ambushes', hint: 'Hide with Shadow Veil, then strike a foe out of it', event: 'statusRemoved', match: { id: 'veiled', target: '$player' } },
  ultimates: { label: 'Ultimates unleashed', hint: 'Use your ultimate skill (key 5)', event: 'skillUsed', match: { caster: '$player', 'skill.ultimate': true } },
  blocks: { label: 'Attacks blocked', hint: 'Hold your guard toward an enemy attack', event: 'guardBlocked', match: { player: '$player' } },
  perfect_guards: { label: 'Perfect Guards', hint: 'Raise your guard just before an enemy attack lands', event: 'perfectGuard', match: { player: '$player' } },
  judgments: { label: 'Judgments', hint: 'Mark a foe with your basic attacks, then hit it with Guardian Slash', event: 'markConsumed', match: { markId: 'guardian_mark' } },
  barrier_absorbed: { label: 'Damage absorbed by barriers', hint: 'Let barriers you cast yourself soak enemy hits', event: 'shieldAbsorbed', match: { target: '$player', statusSource: '$player' }, sum: 'amount' },
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
  // ---------------- tier 4 — SECRET classes (Varkharon's blood): hidden until the Cinder King falls, then open to a
  // Class 2 of that line at LV 50 carrying the Heart of Varkharon (the class quest comes in a later phase)
  wyrmblood_reaver: {
    id: 'wyrmblood_reaver', name: 'Wyrmblood Reaver', tier: 4, parent: 'umbral_sword', playable: true, resource: 'Wyrm Fury', hidden: true,
    reveal: [{ type: 'flag', flag: 'dragon_slain' }],
    role: 'Secret Class · Blood Duelist · Sustain DPS', description: 'Pays for every skill with his own blood, and drinks it back from every wound he deals.',
    requirements: [
      { type: 'level', min: 50 },
      { type: 'item', item: 'heart_of_varkharon', label: 'Carry the Heart of Varkharon' },
      { type: 'any', of: [{ type: 'class', id: 'nightfall_reaper' }, { type: 'class', id: 'duskrunner' }, { type: 'class', id: 'blade_of_echoes' }], label: 'Be an Umbral Class 2 (Nightfall Reaper, Duskrunner or Blade of Echoes)' },
    ],
  },
};

// ---- class trials: timed or untimed challenges measured with the same counters (progress since start)
// CLASS QUEST (Quest rework Q2): a trial may name `chapters` = the steps of its quest, in order (progression.js):
//   { type: 'talk', npc, text }               speak with that NPC (the line's master in Valehaven)
//   { type: 'counters', text }                the trial's `objectives` (class records counted from this chapter on)
//   { type: 'item', item, count, text }       carry the item (a relic: interactable kind 'trialRelic' gives it)
//   { type: 'boss', boss, text }              defeat that boss (the shadow duel, data/shadowDuels.js)
// A trial without chapters = one counters chapter (the old rule).
export function trialChapters(def) {
  if (!(def && def.chapters && def.chapters.length)) return [{ type: 'counters', text: '' }];
  return def.chapters.map((c) => c.where ? c : { ...c, where: (c.type === 'item' ? RELIC_WHERE[c.item] : CHAPTER_WHERE[c.type]) || '' });
}
// where = how to find it (quest tracker + Class tab). A chapter may carry its own `where`; else these.
const BLIZZARD = 'It only appears while the blizzard blows (about every 2 minutes, for about 30 seconds): wait by a campfire, then run to it.';
const FIREFLIES = 'Stand still out of combat and the fireflies will fly toward it.';
const DRAIN = 'First turn the Temple Wheel inside the Sunken Temple (west side of the valley): Mirror Lake drains. Then walk down onto the lakebed in the south-west. The water comes back when you leave the map.';
export const CHAPTER_WHERE = {
  talk: "Valehaven is a hidden city: in the Whispering Forest (A1) go to the far north-west and take the Sealed Path (its thorns wither once the A1 Guardian is defeated). A '!' floats over the master you need.",
  boss: 'Go back to Valehaven: the Proving Ground is the stone ring at the east end of the city, open now. Your shadow waits inside.',
};
export const RELIC_WHERE = {
  relic_storm: 'Frostwind Plains (B1): walk south from the Frostwind Crossroads toward the Frozen Mere; it lies on the open snow between them. ' + BLIZZARD,
  relic_dusk: 'Frostwind Plains (B1): at the Frostwind Crossroads, where the roads meet in the middle of the plains. ' + BLIZZARD,
  relic_oath: 'Frostwind Plains (B1): the far south-east, just west of the Frost Arena stairs. ' + BLIZZARD,
  relic_nightfall: 'Whispering Forest (A1): just south of the Elder Tree on the west side. ' + FIREFLIES,
  relic_lumen: 'Whispering Forest (A1): about 20 steps east of the Stone Circle, north of the river. ' + FIREFLIES,
  relic_echo: 'Ancient Valley (A2): on the west part of the Mirror Lake bed. ' + DRAIN,
  relic_dawn: 'Ancient Valley (A2): on the east part of the Mirror Lake bed. ' + DRAIN,
  relic_void: "Rune Citadel (A3): the Scribe's Vault is the walled room just east of the Crystal Shrine (west side of the city). Light the rune switch south of the Crystal Shrine [E], then run to the vault door: it stays open only a few seconds.",
  relic_bulwark: 'Rune Citadel (A3): the Bronze Vault is just east of the Bronze Barracks (north-east). Its TWO rune switches must burn at the same time: one north of the Well Court, one between the Golden Gate and the Barracks. Light one and run to the other (16 seconds), or have a party member light the second.',
};
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
