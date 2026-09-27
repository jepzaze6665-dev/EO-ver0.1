import { Z } from '../core/constants.js';

// QUEST DATA — every quest of the slice. The Quest System (quests/quests.js) reads this; it never names a quest.
//
//  id, name, description        : text (UI reads it)
//  giver                        : NPC id that offers it (dialogue option 'quest:<id>'); marks the NPC with "!"
//  autoStart                    : accepted automatically on New Game
//  side                         : optional quest (tracked below the main ones)
//  ordered                      : objectives unlock one after another (tracker shows them all)
//  requirements                 : progression/requirements.js conditions to accept (level, quest, flag, ...)
//  rewards                      : { exp, gold, items: { id: n } } — given once, on completion (via 'questCompleted')
//  objectives[]                 : { id, text, type, ...type fields, marker?: [tileX, tileY] (minimap / HUD arrow),
//                                   finalizes?: completing it also completes every earlier objective }
//    kill    { target: monster type | 'any', count }     ← 'enemyDefeated'
//    collect { item, count }                             ← inventory count ('itemCollected')
//    talk    { npc }                                     ← 'npcTalked' (a last talk objective = turn-in)
//    reach   { map } or { zone }                         ← 'mapEntered' / 'zoneEnter'
//    boss    { boss }                                    ← 'bossDefeated'
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
  valley: {
    id: 'valley', name: 'PATH TO ANCIENT VALLEY', giver: null,
    description: 'With the Guardian at peace, the thorns sealing the northern road have withered.',
    objectives: [
      { id: 'gd', text: 'Guardian Defeated', type: 'flag', flag: 'guardianDefeated' },
      { id: 'fr', text: 'Forest Restored', type: 'flag', flag: 'forestRestored' },
      { id: 'enter', text: 'Enter Ancient Valley', type: 'reach', map: 'valley', marker: [32, 26] },
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
