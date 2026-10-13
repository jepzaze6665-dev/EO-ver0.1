import { Z } from '../core/constants.js';
import { LEVEL_SCALING } from '../data/levelScaling.js';

// B3 — FROSTPEAK (own grid: world/levels/frostpeak.js, terrain maps/frostpeak.js). Route B's last map: the mountain above
// the caverns, climbed from the South Gate to the Summit Citadel. Monsters from the owner's sheets (desgin/monster/B/B3):
// Glacier Wolf, Frost Yeti, Frost Imp, Storm Eagle. The Summit Citadel holds the B3 MAJOR boss (the Crystal Warden, next
// phase) — its zone is its own map, not walkable from here yet.
const NOTICE = [
  'SOUTH GATE — a frozen Guild banner',
  '"Frostpeak. The camp on the east terrace takes in travelers. The stairs climb past the lakes to the summit."',
  'Something on the summit keeps the whole mountain frozen. Nobody who climbed to it has come back down.',
].join('\n');

export const FIELD_B3 = {
  id: 'b3', name: 'FROSTPEAK', short: 'B3', sub: 'Route B · B3 — Frostpeak · Lv. 31 – 45',
  // LEVEL REWORK L3: old band -> new band; Route B monsters are tougher and pay more (data/levelScaling.js routeMod.B)
  levelBand: { from: [14, 18], to: [31, 45], exp: 1.05 }, monsterMod: LEVEL_SCALING.routeMod.B, grid: 'frostpeak',
  type: 'field', route: 'B', nextMap: 'city2', bossId: 'boss_b3',
  requires: [{ type: 'boss_defeated', boss: 'boss_b2', label: 'Defeat the Amethyst Colossus (B2 Boss)' }],
  hiddenAreas: [],
  region: { zones: [Z.FROSTPEAK] },
  // ALTITUDE COLD (world/mechanics/altitude.js): colder the higher you climb; campfires at the camps, warm embers on the paths
  mechanics: [{
    type: 'altitude_cold', low: 160, high: 40, rate: 5,
    fires: [[70, 148], [132, 112], [52, 106], [84, 112], [32, 80], [86, 78], [28, 36], [138, 64], [148, 30]],
    embers: [[80, 165], [70, 134], [79, 124], [40, 92], [84, 92], [110, 100], [49, 71], [96, 52], [125, 94], [140, 44], [30, 52], [150, 42]],
  }],
  spawn: [81.5, 196],
  content: {
    interactables: [
      // EXPLORATION (world/discoveries.js counts them): chests + a lore tablet off the main road
      { id: 'b3_chest_lookout', kind: 'chest', tx: 152, ty: 29, loot: [{ item: 'hp_potion', count: 3 }], gold: 300 },
      { id: 'b3_chest_cave', kind: 'chest', tx: 20, ty: 139, loot: [{ item: 'rune_iron_will', count: 1 }], gold: 250, rare: true },
      { id: 'b3_chest_plateau', kind: 'chest', tx: 28, ty: 73, loot: [{ item: 'crystal_shard', count: 3 }], gold: 260 },
      { id: 'b3_chest_fortress', kind: 'chest', tx: 148, ty: 157, loot: [{ item: 'hp_potion', count: 2 }, { item: 'crystal_shard', count: 2 }], gold: 280 },
      { id: 'b3_lore_hermit', kind: 'lore', tx: 23, ty: 36, lore: 'hermit_notes', prompt: 'Read Notes' },
      { id: 'b3_gate_notice', kind: 'sign', tx: 76, ty: 196, prompt: 'Read Banner', title: 'Frostpeak — South Gate', text: NOTICE },
      { id: 'ws_b3_camp', kind: 'waystone', tx: 128, ty: 118, name: 'Nomad Camp', prompt: 'Checkpoint' },
      { id: 'b3_summit_sign', kind: 'sign', tx: 86, ty: 60, prompt: 'Read Inscription', title: 'The Summit Gate', text: 'Beyond the gate something vast is breathing.\nThe Crystal Warden has kept this summit since the eclipse was young.' },
    ],
    spawns: [
      { id: 'b3_slope_wolves', type: 'glacier_wolf', count: 3, tx: 74, ty: 176, radius: 5 },
      { id: 'b3_slope_imps', type: 'frost_imp', count: 3, tx: 100, ty: 180, radius: 4 },
      { id: 'b3_lake_eagles', type: 'snow_eagle', count: 2, tx: 66, ty: 152, radius: 6 },
      { id: 'b3_lake_yeti', type: 'yeti', count: 1, tx: 84, ty: 144, radius: 2 },
      { id: 'b3_east_imps', type: 'frost_imp', count: 3, tx: 120, ty: 158, radius: 4 },
      { id: 'b3_cave_wolves', type: 'glacier_wolf', count: 2, tx: 22, ty: 140, radius: 3 },
      { id: 'b3_terrace_eagle', type: 'snow_eagle', count: 2, tx: 52, ty: 102, radius: 4 },
      { id: 'b3_plateau_yeti', type: 'yeti', count: 2, tx: 30, ty: 80, radius: 5 },
      { id: 'b3_plateau_imps', type: 'frost_imp', count: 3, tx: 36, ty: 72, radius: 4 },
      { id: 'b3_switch_wolves', type: 'glacier_wolf', count: 3, tx: 140, ty: 62, radius: 4 },
      { id: 'b3_windcut_eagles', type: 'snow_eagle', count: 2, tx: 84, ty: 80, radius: 5 },
      // Elite: a Frost Yeti guards the Hermit's Shrine (killed once)
      { id: 'b3_shrine_warden', type: 'yeti', elite: true, unique: true, count: 1, tx: 26, ty: 38, radius: 0 },
    ],
  },
  exits: [
    { id: 'south_gate', rect: [78, 205, 84, 205], to: 'b2', entry: [148, 180], label: 'Crystal Caverns' },
    {
      id: 'summit_gate', rect: [88, 52, 92, 52], to: 'summit', entry: [90, 44], label: 'The Summit Citadel',
      confirm: {
        title: 'The Summit Citadel',
        text: 'The Crystal Warden waits on the summit — its armour changes as it fights.\nOnce it rises, the citadel seals until one of you falls.\n\nEnter the Summit Citadel?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
};
