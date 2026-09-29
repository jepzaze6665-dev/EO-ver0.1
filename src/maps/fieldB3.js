import { Z } from '../core/constants.js';

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
  id: 'b3', name: 'FROSTPEAK', short: 'B3', sub: 'Route B · B3 — Frostpeak · Lv. 14 – 17', grid: 'frostpeak',
  type: 'field', route: 'B', nextMap: 'city2', bossId: 'boss_b3',
  requires: [{ type: 'boss_defeated', boss: 'boss_b2', label: 'Defeat the Amethyst Colossus (B2 Boss)' }],
  hiddenAreas: [],
  region: { zones: [Z.FROSTPEAK] },
  spawn: [81.5, 196],
  content: {
    interactables: [
      { id: 'b3_gate_notice', kind: 'sign', tx: 76, ty: 196, prompt: 'Read Banner', title: 'Frostpeak — South Gate', text: NOTICE },
      { id: 'ws_b3_camp', kind: 'waystone', tx: 128, ty: 118, name: 'Nomad Camp', prompt: 'Waystone' },
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
