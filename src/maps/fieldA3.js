import { Z } from '../core/constants.js';

// A3 — ANCIENT RUINS + GUARDIAN GATE: the area before the Major Boss. It should feel like "something important
// is close": harder monsters, the first Elite, the ruins' old defences waking up, a wounded scout, the sealed gate.
//  - monsterMod: every monster spawned here is ruin-hardened (tougher, more EXP, +2 level) — Monster opts.areaMod
//  - Elite: a Crystal Beast guards the Ancient Shrine (content.spawns, `elite: true`, killed once)
//  - Environmental mechanic: rune-ward pylons (content.hazards kind 'beam') fire across the shrine yard and the gate
//    antechamber on a rhythm; each ward sleeps once its seal is dealt with (shrine investigated / gate opened)
//  - NPC / lore: Guild scout Kael in the courtyard (dialogue: world/narrative.js 'kael'), the shrine lore stones
//  - Boss entrance: the arena gate asks before you step through (exit `confirm`)
// Terrain + base spawns: maps/ruins.js (ruins + gate).
export const FIELD_A3 = {
  id: 'a3', name: 'ANCIENT RUINS', short: 'A3', sub: 'Route A · A3 — Before the Gate · Lv. 7 – 10',
  grid: 'whispering', type: 'field', route: 'A', nextMap: 'city2', bossId: 'boss_a3', // its Major Boss waits in the Guardian Arena map
  requires: [{ type: 'boss_defeated', boss: 'boss_a2', label: 'Defeat GRUKK THE THORNBOUND (A2 boss)' }],
  hiddenAreas: ['sealed_archive'],
  region: { zones: [Z.RUINS, Z.GATE] },
  spawn: [103, 71],
  monsterMod: { hp: 1.35, power: 1.15, exp: 1.4, level: 2 },
  exits: [
    { id: 'forest_path', rect: [100, 68, 101, 73], to: 'a2', entry: [90.5, 71], label: 'Deep Forest' },
    { id: 'side_gate', rect: [100, 110, 102, 113], to: 'a1', entry: [90.5, 112], label: 'Whispering Forest', requires: { flag: 'ruinsGate' } },
    {
      id: 'arena_gate', rect: [131, 47, 139, 48], to: 'arena', entry: [135, 42], label: 'Guardian Arena', requires: { flag: 'gateOpened' },
      confirm: {
        title: 'The Heart of the Forest',
        text: 'Beyond this gate the Guardian of the Forest sleeps.\nOnce it wakes, the arena seals behind you until one of you falls.\n\nEnter the Guardian Arena?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
  content: {
    npcs: [
      { id: 'kael', name: 'Kael', role: 'Wounded Guild Scout', tx: 128, ty: 86, look: 'scout' },
    ],
    spawns: [
      { id: 'a3_shrine_warden', type: 'crystal_beast', elite: true, unique: true, count: 1, tx: 136, ty: 74, radius: 0 },
    ],
    hazards: [
      { id: 'ward_shrine', kind: 'beam', name: 'Rune Ward', tx: 129, ty: 77, len: 14, angle: 0, width: 10, period: 3.4, windup: 0.9, power: 18, while: { notFlag: 'shrineInvestigated' } },
      { id: 'ward_gate', kind: 'beam', name: 'Rune Ward', tx: 131, ty: 61, len: 10, angle: 0, width: 10, period: 3, windup: 0.8, power: 20, while: { notFlag: 'gateOpened' } },
    ],
  },
};
