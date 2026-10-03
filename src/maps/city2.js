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
  spawn: [80, 150],
  exits: [
    // Route A arrives by the South Gate (from the Sanctum), Route B by the East Gate (from Frostpeak) — two separate roads
    { id: 'south_road', rect: [77, 157, 83, 157], to: 'sanctum', entry: [84, 9], label: 'The Sanctum (Route A)' },
    { id: 'east_road', rect: [158, 66, 158, 68], to: 'summit', entry: [90, 14], label: 'Frostpeak Summit (Route B)' },
  ],
  content: {
    npcs: [
      { id: 'a_guildmaster', name: 'Guildmaster Seraphine', role: 'Adventurer Guild', tx: 123, ty: 64, look: 'guildmaster' },
      { id: 'a_merchant', name: 'Odo', role: 'Asterian Bazaar', tx: 50, ty: 74, look: 'merchant' },
      { id: 'a_smith', name: 'Hilde', role: 'Master Smith', tx: 37, ty: 94, look: 'smith' },
      { id: 'a_gate_guard', name: 'Sir Callum', role: 'Gate Knight', tx: 86, ty: 132, look: 'knight' },
      { id: 'a_scholar', name: 'Archivist Imre', role: 'Hall of Records', tx: 112, ty: 94, look: 'elder' },
      { id: 'a_citizen', name: 'Mira', role: 'Citizen', tx: 70, ty: 72, look: 'villager', wander: 3 },
      { id: 'a_child', name: 'Tobin', role: 'Citizen', tx: 90, ty: 106, look: 'child', wander: 3 },
    ],
    interactables: [
      { id: 'ws_asteria', kind: 'waystone', tx: 86, ty: 76, name: 'Asteria City', prompt: 'Waystone' },
      { id: 'a_storage', kind: 'storage', tx: 74, ty: 76, prompt: 'Open Storage' },
      {
        id: 'a_notice', kind: 'sign', tx: 74, ty: 128, prompt: 'Read Notice', title: 'Asteria City — South Gate',
        text: 'ASTERIA CITY (City 2)\n• South Gate: the road to the Sanctum (Route A). East Gate: the road to Frostpeak (Route B).\n• Crystal Plaza — waystone and storage by the fountain.\n• Grand Bazaar (west) · Forge Row (south-west) · Adventurer Guild (east).\n• The Keep (north) is closed to travelers.\n\n"The Warden in the Sanctum kept the dead city from the living one. If you walked past him, the city owes you." — City Watch',
      },
    ],
  },
};
