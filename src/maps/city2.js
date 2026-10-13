import { Z } from '../core/constants.js';

// CITY 2 — ASTERIA CITY (own grid: world/levels/asteria.js, terrain maps/asteriaCity.js). The living half of Asteria:
// the Rune Knight guarded the road to it for three hundred years. Safe zone. Opens when a Major Boss falls
// (Route A: the Rune Knight, Route B: boss_b3 later); the road runs north out of the Sanctum.
// Services: waystone, storage, the Asterian Bazaar (shop), the forge (smith), the Adventurer Guild (quest 'asteria').
export const CITY2 = {
  id: 'city2', name: 'ASTERIA CITY', short: 'Asteria', sub: 'City 2 · Safe Zone', grid: 'asteria',
  type: 'city', safe: true, route: 'A',
  // either route's Major Boss opens it
  requires: [{ type: 'any', of: [{ type: 'boss_defeated', boss: 'boss_a3' }, { type: 'boss_defeated', boss: 'boss_b3' }], label: 'Defeat a Major Boss (Route A: the Rune Knight · Route B: the Crystal Warden)' }],
  region: { zones: [Z.ASTERIA] },
  spawn: [56.5, 66],
  // owner 2026-10-13: NO exits — the Dungeon Gate in the plaza is the only way out; the Sanctum / Summit boss roads
  // arrive inside the (closed) South / East gates
  exits: [],
  content: {
    npcs: [
      { id: 'a_guildmaster', name: 'Guildmaster Seraphine', role: 'Adventurer Guild', tx: 85, ty: 52, look: 'guildmaster' },
      { id: 'a_merchant', name: 'Odo', role: 'Asterian Bazaar', tx: 42, ty: 63, look: 'merchant' },
      { id: 'a_smith', name: 'Hilde', role: 'Master Smith', tx: 42, ty: 76, look: 'smith' },
      { id: 'a_gate_guard', name: 'Sir Callum', role: 'Gate Knight', tx: 60, ty: 95, look: 'knight' },
      { id: 'a_scholar', name: 'Archivist Imre', role: 'Hall of Records', tx: 68, ty: 76, look: 'elder' },
      { id: 'a_citizen', name: 'Mira', role: 'Citizen', tx: 50, ty: 66, look: 'villager', wander: 3 },
      { id: 'a_child', name: 'Tobin', role: 'Citizen', tx: 58, ty: 86, look: 'child', wander: 3 },
    ],
    interactables: [
      { id: 'asteria_gate', kind: 'dungeonGate', tx: 56, ty: 47, prompt: 'Dungeon Gate' },
      { id: 'ws_asteria', kind: 'waystone', tx: 51, ty: 63, name: 'Asteria City', prompt: 'Waystone' },
      { id: 'a_storage', kind: 'storage', tx: 62, ty: 64, prompt: 'Open Storage' },
      {
        id: 'a_notice', kind: 'sign', tx: 52, ty: 94, prompt: 'Read Notice', title: 'Asteria City — South Gate',
        text: 'ASTERIA CITY (City 2)\n• South Gate: the road to the Sanctum (Route A). East Gate: the road to Frostpeak (Route B).\n• Crystal Plaza — waystone and storage by the fountain.\n• Grand Bazaar (west) · Forge Row (south-west) · Adventurer Guild (east).\n• The Keep (north) is closed to travelers.\n\n"The Warden in the Sanctum kept the dead city from the living one. If you walked past him, the city owes you." — City Watch',
      },
    ],
  },
};
