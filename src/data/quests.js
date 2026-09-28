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
//    kill    { target: monster type | 'any', count }     ← 'enemyDefeated'
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
      { id: 'talk', text: 'Talk to Village Guide', type: 'talk', npc: 'guide', marker: [36, 176] },
      { id: 'exit', text: 'Exit Lumina Village', type: 'reach', map: 'a1', marker: [47, 152] },
      { id: 'hunt', text: 'Defeat Monsters', type: 'kill', target: 'any', count: 5, marker: [38, 121] },
      { id: 'return', text: 'Return to Village Guide', type: 'talk', npc: 'guide', marker: [36, 176] },
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
  // the progression spine: every field map's boss is a gate (data/bosses.js, data/routes.js). Started by a world trigger
  // when FIRST STEPS BEYOND LUMINA is done (data/worldTriggers.js route_a_begins). W2: A1 = the whole Whispering Forest,
  // its boss is the Guardian; A2 = the Ancient Valley (next quest steps arrive with A2's content).
  route_a: {
    id: 'route_a', name: 'ROUTE A — THE FOREST ROAD', giver: null, ordered: true, priority: 1,
    description: 'Every land keeps a guardian, and the road past it stays shut until it falls. Cross the Whispering Forest (A1) and take the north road into the Ancient Valley (A2).',
    objectives: [
      { id: 'river', text: 'Cross the river into the Deep Forest', type: 'flag', flag: 'riverCrossed', marker: [50, 96] },
      { id: 'ruins', text: 'Follow the Ancient Forest Path to the Ruins', type: 'reach', zone: Z.RUINS, marker: [103, 71] },
      { id: 'gate', text: 'Unseal the Guardian Gate (Ancient Shrine)', type: 'flag', flag: 'gateOpened', marker: [136, 70] },
      { id: 'guardian', text: 'Defeat the Guardian of the Forest (A1 Boss)', type: 'boss', boss: 'boss_a1', marker: [132.5, 28] },
      { id: 'a2', text: 'Take the north road into the Ancient Valley (A2)', type: 'reach', map: 'a2', marker: [136, 11] },
    ],
    rewards: { exp: 150, gold: 150, items: { hp_potion: 2 } },
    requirements: [{ type: 'quest', id: 'beyond_lumina', label: 'Finish First Steps Beyond Lumina' }],
  },
  // A2 spine (W3c): started on the first visit to the Ancient Valley (data/worldTriggers.js a2_first_visit)
  burning_rift: {
    id: 'burning_rift', name: 'THE BURNING RIFT', giver: null, ordered: true, priority: 1,
    description: 'The valley kings fled their summer court when the mountain woke. Something still burns in the rift to the north.',
    objectives: [
      { id: 'rift', text: 'Climb north to the Magma Rift', type: 'flag', flag: 'riftFound', marker: [84, 44], markerMap: 'a2' },
      { id: 'boss', text: 'Defeat the Magma Beast (A2 Boss)', type: 'boss', boss: 'boss_a2', marker: [84, 22], markerMap: 'rift' },
    ],
    rewards: { exp: 250, gold: 200, items: { hp_potion: 3 } },
    requirements: [],
  },
  // A3 spine (W4): started on the first visit to the Rune Citadel
  fallen_city: {
    id: 'fallen_city', name: 'THE FALLEN CITY', giver: null, ordered: true, priority: 1,
    description: 'Asteria fell with its knights still at their posts. Climb the avenue to the Golden Gate and the Sanctum beyond.',
    objectives: [
      { id: 'plaza', text: 'Reach the Winged Plaza', type: 'flag', flag: 'wingedPlaza', marker: [84, 118], markerMap: 'a3' },
      { id: 'gate', text: 'Find the Golden Gate', type: 'flag', flag: 'goldenGate', marker: [84, 56], markerMap: 'a3' },
      { id: 'boss', text: 'Defeat the Rune Knight (A3 Major Boss)', type: 'boss', boss: 'boss_a3', marker: [84, 24], markerMap: 'sanctum' },
    ],
    rewards: { exp: 400, gold: 300, items: { hp_potion: 3 } },
    requirements: [],
  },
  // Route B spine for B1 (starts on the first visit to Frostwind Plains)
  eastern_road: {
    id: 'eastern_road', name: 'THE EASTERN ROAD', giver: null, ordered: true, priority: 1,
    description: 'East of Lumina the snow never melts. The Guild wants the road to the Crystal Caverns open — something in the Frost Arena says otherwise.',
    objectives: [
      { id: 'cross', text: 'Reach the Frostwind Crossroads', type: 'flag', flag: 'b1Crossroads', marker: [81, 57], markerMap: 'b1' },
      { id: 'arena', text: 'Climb the stairs to the Frost Arena', type: 'reach', map: 'frost_arena', marker: [142, 123], markerMap: 'b1' },
      { id: 'boss', text: 'Defeat Hoarfang (B1 Boss)', type: 'boss', boss: 'boss_b1', marker: [142, 146], markerMap: 'frost_arena' },
    ],
    rewards: { exp: 250, gold: 150, items: { hp_potion: 3 } },
    requirements: [],
  },
  // City 2 (W5): starts on the first visit to Asteria City (data/worldTriggers.js city2_first_visit)
  asteria: {
    id: 'asteria', name: 'THE LIVING CITY', giver: null, ordered: true, priority: 1,
    description: 'Beyond the Sanctum lies the half of Asteria the runes never took. The Adventurer Guild keeps its hall here.',
    objectives: [
      { id: 'plaza', text: 'Reach the Crystal Plaza', type: 'flag', flag: 'asteriaPlaza', marker: [80, 72], markerMap: 'city2' },
      { id: 'guild', text: 'Meet Guildmaster Seraphine (Guild Quarter)', type: 'talk', npc: 'a_guildmaster', marker: [123, 64], markerMap: 'city2' },
    ],
    rewards: { exp: 300, gold: 250, items: { hp_potion: 3 } },
    requirements: [],
  },
  // A1's optional mini-bosses (W2): the old area bosses keep their arenas and rewards, but lock nothing
  forest_hunts: {
    id: 'forest_hunts', name: 'HUNTS OF THE WHISPERING FOREST', giver: null, side: true,
    description: 'Two beasts rule parts of the forest. Neither blocks the road — but the Guild pays well for their trophies.',
    objectives: [
      { id: 'fang', text: 'Defeat Hollow Fang (Howling Den) · optional', type: 'boss', boss: 'mini_hollow_fang', marker: [58.5, 113] },
      { id: 'grukk', text: 'Defeat the Thornbound Elder (Thornwood Glade) · optional', type: 'boss', boss: 'mini_grukk', marker: [29.5, 60] },
    ],
    rewards: { exp: 120, gold: 120, items: { shadow_tonic: 1 } },
    requirements: [{ type: 'quest', id: 'beyond_lumina', label: 'Finish First Steps Beyond Lumina' }],
  },
  whispers: {
    id: 'whispers', name: 'WHISPERS IN THE FOREST', giver: 'elder',
    description: 'A fog has swallowed the Whispering Forest and the beasts have turned savage. Find the source.',
    objectives: [
      { id: 'enter', text: 'Enter Whispering Forest', type: 'reach', zone: Z.FOREST, marker: [47, 150] },
      { id: 'wolves', text: 'Defeat Forest Wolves', type: 'kill', target: 'wolf', count: 5, marker: [38, 121] },
      { id: 'shrine', text: 'Investigate Ancient Shrine', type: 'flag', flag: 'shrineInvestigated', marker: [136, 70] },
      { id: 'discover', text: 'Discover Guardian', type: 'flag', flag: 'guardianDiscovered', marker: [136, 52] },
      { id: 'defeat', text: 'Defeat Guardian', type: 'boss', boss: 'guardian', finalizes: true, marker: [132.5, 28] },
      { id: 'report', text: 'Report to Elder Maren', type: 'talk', npc: 'elder', marker: [46, 172] },
    ],
    rewards: { exp: 400, gold: 250, items: { hp_potion: 3 } },
    requirements: [],
  },
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
};
