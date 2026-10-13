import { Z } from '../core/constants.js';

// QUEST DATA — every quest of the slice. The Quest System (quests/quests.js) reads this; it never names a quest.
//
//  id, name, description        : text (UI reads it)
//  giver                        : NPC id that offers it (dialogue option 'quest:<id>'); marks the NPC with "!"
//  autoStart                    : accepted automatically on New Game
//  side                         : optional quest (tracked below the main ones)
//  priority                     : higher = its objective drives the HUD arrow first (default 0)
//  ordered                      : objectives unlock one after another (tracker shows them all)
//  requirements                 : progression/requirements.js conditions to accept (level, quest, flag, ...)
//  rewards                      : { exp, gold, items: { id: n } } — given once, on completion (via 'questCompleted')
//  objectives[]                 : { id, text, type, ...type fields, marker?: [tileX, tileY] (minimap / HUD arrow),
//                                   markerMap?: map id the marker is on (default: a map of the start grid),
//                                   finalizes?: completing it also completes every earlier objective }
//    kill    { target: monster type | 'any', count, flawless? }  ← 'enemyDefeated' (flawless: a hit from that type resets it)
//    collect { item, count }                             ← inventory count ('itemCollected')
//    talk    { npc }                                     ← 'npcTalked' (a last talk objective = turn-in)
//    reach   { map } or { zone }                         ← 'mapEntered' / 'zoneEnter'
//    boss    { boss }  boss id (data/bosses.js) or its monster id ← 'bossDefeated'
//    flag    { flag }                                    ← world flag set
export const QUESTS = {
  beyond_lumina: {
    id: 'beyond_lumina', name: 'FIRST STEPS BEYOND LUMINA', giver: 'guide', autoStart: true, ordered: true,
    description: 'Captain Aldric of the Adventurer Guild wants proof you can survive beyond the village gate.',
    objectives: [
      { id: 'talk', text: 'Talk to Village Guide', type: 'talk', npc: 'guide', marker: [35, 47] },
      { id: 'exit', text: 'Enter the Whispering Forest by the Dungeon Gate', type: 'reach', map: 'a1', marker: [48, 43] },
      { id: 'hunt', text: 'Defeat Monsters', type: 'kill', target: 'any', count: 5, marker: [38, 121], markerMap: 'a1' },
      { id: 'return', text: 'Return to Village Guide', type: 'talk', npc: 'guide', marker: [35, 47] },
    ],
    rewards: { exp: 120, gold: 80, items: { hp_potion: 2 } },
    requirements: [],
  },
  first_steps: {
    id: 'first_steps', name: 'FIRST STEPS OF SHADOW', giver: 'guide', side: true,
    description: 'Aldric wants you to master your class techniques.',
    objectives: [
      { id: 'mark', text: 'Build 3 Shadow Marks', classText: 'marks', type: 'flag', flag: 'tut_marks' },
      { id: 'perfect', text: 'Perform a Perfect Dodge', classText: 'perfect', type: 'flag', flag: 'tut_perfect' },
      { id: 'break', text: 'Unleash Shadow Break', classText: 'break', type: 'flag', flag: 'tut_break' },
    ],
    rewards: { exp: 80, gold: 60, items: { shadow_tonic: 2 } },
    requirements: [{ type: 'quest', id: 'beyond_lumina', label: 'Finish First Steps Beyond Lumina' }],
  },
  // Q1 (owner 2026-10-10): quests are only the tutorial, the secret chains and (Q2+) the class-change quests. The old
  // route / map quests (whispers, route_a, burning_rift, fallen_city, eastern_road, crystal_depths, frostpeak_climb, asteria,
  // forest_hunts) are gone: progress = boss gates + exploration; their EXP / gold moved into the boss rewards.
  // Valehaven is a SECRET city (W2): this quest starts when you first find it (data/worldTriggers.js valehaven_found)
  valley: {
    id: 'valley', name: 'THE HIDDEN VALLEY', giver: null,
    description: 'Behind the Sealed Path lies Valehaven, a Guild camp-city nobody in Lumina speaks of. Meet its people.',
    objectives: [
      { id: 'enter', text: 'Find Valehaven', type: 'reach', map: 'valehaven', marker: [32, 22], markerMap: 'valehaven' },
      { id: 'wren', text: 'Talk to Scout Wren', type: 'talk', npc: 'scout', marker: [31, 22], markerMap: 'valehaven' },
    ],
    rewards: { exp: 200, gold: 100 },
    requirements: [],
  },
  depths: {
    id: 'depths', name: 'THE SEALED DEPTHS', giver: null,
    description: 'An ancient dungeon lies sealed beneath the valley. Its lock answers to power not yet found.',
    objectives: [
      { id: 'find', text: 'Find a way to unseal the Depths', type: 'flag', flag: '__future__' },
    ],
    rewards: {},
    requirements: [],
  },
  // ---------------- SECRET: the Ashen Pilgrim's trials (A2 secret boss Varkharon). The pilgrim appears at a random spot of
  // each Route A field map (data/wanderers.js); each trial pays one Cinder Shard; three shards are forged into
  // Varkharon's Seal at the gargoyle in the Quiet Hollow (A2). No markers: finding things is the point.
  ember_trial_a1: {
    id: 'ember_trial_a1', name: 'THE COLD ALTARS', giver: 'ashen_pilgrim', side: true, ordered: true,
    description: 'Three altars of the old fire-keepers stand cold somewhere in the Whispering Forest. The pilgrim asks you to wake them.',
    objectives: [
      { id: 'altars', text: 'Rekindle the three cold altars of the forest', type: 'flag', flag: 'emberAltarsLit' },
      { id: 'return', text: 'Return to the Ashen Pilgrim (wherever the ash leads)', type: 'talk', npc: 'ashen_pilgrim' },
    ],
    rewards: { exp: 250, items: { cinder_shard: 1 } },
    requirements: [{ type: 'boss_defeated', boss: 'boss_a1', label: 'Defeat the Guardian of the Forest' }],
  },
  ember_trial_a2: {
    id: 'ember_trial_a2', name: 'UNTOUCHED BY STONE', giver: 'ashen_pilgrim', side: true, ordered: true,
    description: 'Slay three Crag Rhinos without letting one touch you. One hit from a rhino and the count starts again.',
    objectives: [
      { id: 'rhinos', text: 'Slay Crag Rhinos without being hit by one', type: 'kill', target: 'rock_rhino', count: 3, flawless: true },
      { id: 'return', text: 'Return to the Ashen Pilgrim (wherever the ash leads)', type: 'talk', npc: 'ashen_pilgrim' },
    ],
    rewards: { exp: 700, items: { cinder_shard: 1 } },
    requirements: [{ type: 'boss_defeated', boss: 'mini_sunken_horn', label: 'Defeat the Sunken Horn' }],
  },
  ember_trial_a3: {
    id: 'ember_trial_a3', name: 'THE DRAGON THAT WATCHES', giver: 'ashen_pilgrim', side: true, ordered: true,
    description: 'A stone dragon in the Rune Citadel only listens while its runes are burning. Touch it then — and only then.',
    objectives: [
      { id: 'statue', text: 'Wake the stone dragon of the Rune Citadel', type: 'flag', flag: 'runeDragonAwake' },
      { id: 'return', text: 'Return to the Ashen Pilgrim (wherever the ash leads)', type: 'talk', npc: 'ashen_pilgrim' },
    ],
    rewards: { exp: 1200, items: { cinder_shard: 1 } },
    requirements: [{ type: 'boss_defeated', boss: 'mini_archive_warden', label: 'Defeat the Archive Warden' }],
  },
};
