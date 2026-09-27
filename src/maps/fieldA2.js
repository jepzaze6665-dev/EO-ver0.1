import { Z } from '../core/constants.js';

// A2 — DEEP FOREST (north of the river). What changes from A1:
//  - monsters: the fog has turned the beasts savage — corrupted wolves / goblin packs (Goblin Glade, Stone Circle),
//    the corrupted totem ambush, and the Amethyst Behemoth in the Hidden Cave
//  - terrain: corrupted ground, the Stone Circle, the Elder Tree, the Ancient Forest Path east to the ruins
//  - environmental hazards (content.hazards, world/hazardSystem.js): miasma bogs + thorn eruptions on the
//    corrupted ground — gone once the Guardian falls
//  - a crossroads (Elder Tree west · Stone Circle / Goblin Glade north · Ancient Path east) with a signpost
//  - hidden areas: Hidden Cave, Behind the Waterfall, Moonlit Shrine (data/hidden.js)
// Terrain + base spawns: maps/forest.js (tile rows < 98) + the cave.
const CROSSROADS = [
  'CROSSROADS OF THE DEEP FOREST',
  '← Elder Tree            ↑ Stone Circle · Goblin Glade            → Ancient Forest Path (Ruins)',
  '"The ground rots where the fog is thickest. Do not linger in the green mire —',
  ' and watch for the thorns: they rise without a sound."',
].join('\n');

const CORRUPTED = { notFlag: 'guardianDefeated' }; // hazards fade when the forest is restored

export const FIELD_A2 = {
  id: 'a2', name: 'DEEP FOREST', sub: 'Route A · A2 — Beyond the River · Lv. 4 – 7',
  region: { zones: [Z.FOREST, Z.CAVE], maxTy: 97 },
  spawn: [50, 93],
  corruptedMonsters: true, // wolves / goblins spawn corrupted here until the Guardian falls (monsterTypes CORRUPT_MOD)
  exits: [
    { id: 'bridge_south', rect: [48, 96, 52, 97], to: 'a1', entry: [50, 101.5], label: 'Whispering Forest' },
    { id: 'log_bridge', rect: [21, 96, 24, 97], to: 'a1', entry: [22.5, 100.5], label: 'Whispering Forest', requires: { flag: 'logBridge' } },
    { id: 'ancient_path', rect: [93, 68, 95, 73], to: 'a3', entry: [103, 71], label: 'Ancient Ruins' },
    { id: 'valley_road', rect: [29, 30, 35, 31], to: 'valley', entry: [32, 25], label: 'Ancient Valley', requires: { flag: 'guardianDefeated' } },
  ],
  content: {
    interactables: [
      { id: 'a2_crossroads', kind: 'sign', tx: 47, ty: 71, prompt: 'Read Signpost', title: 'Signpost', text: CROSSROADS },
    ],
    hazards: [
      // miasma bogs: poison + slow while you stand in them (walk around, or dash through)
      { id: 'mire_deep', kind: 'miasma', name: 'Green Mire', tx: 53, ty: 79, r: 2.6, interval: 1, statuses: [{ id: 'poison', dur: 3 }, { id: 'slow', dur: 1.2 }], while: CORRUPTED },
      { id: 'mire_glade', kind: 'miasma', name: 'Green Mire', tx: 28, ty: 59, r: 2, interval: 1, statuses: [{ id: 'poison', dur: 3 }, { id: 'slow', dur: 1.2 }], while: CORRUPTED },
      { id: 'mire_path', kind: 'miasma', name: 'Green Mire', tx: 85, ty: 68, r: 1.8, interval: 1, statuses: [{ id: 'poison', dur: 3 }, { id: 'slow', dur: 1.2 }], while: CORRUPTED },
      // thorn eruptions: telegraphed circle, strike + short root (dodge out, or through at the last moment)
      { id: 'thorns_circle', kind: 'thorns', name: 'Corrupted Thorns', tx: 66, ty: 61, r: 1.6, period: 4.5, windup: 0.9, power: 16, root: 0.8, while: CORRUPTED },
      { id: 'thorns_bend', kind: 'thorns', name: 'Corrupted Thorns', tx: 61, ty: 65, r: 1.4, period: 5.5, windup: 0.9, power: 16, root: 0.8, while: CORRUPTED },
      { id: 'thorns_path', kind: 'thorns', name: 'Corrupted Thorns', tx: 82, ty: 70, r: 1.4, period: 5, windup: 0.9, power: 16, root: 0.8, while: CORRUPTED },
    ],
  },
};
