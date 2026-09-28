import { Z } from '../core/constants.js';

// CITY 2 — VALEHAVEN: the Guild's camp-city in the Ancient Valley, where Route A and Route B meet (safe zone).
// It opens when EITHER route's Major Boss falls (requires: any of boss_a3 / boss_b3) — never both.
// Placeholder city for V2.2: Scout Wren, a waystone, a notice and the Sealed Depths door (the next content hook).
// Terrain: maps/ruins.js buildValley (the valley itself, tile rows 1..29).
export const CITY_2 = {
  id: 'city2', name: 'VALEHAVEN', short: 'City 2', sub: 'City 2 · Ancient Valley · Safe Zone', grid: 'whispering', type: 'city', safe: true,
  region: { zones: [Z.VALLEY] },
  spawn: [32, 24],
  requires: [{
    type: 'any', label: 'Defeat a Major Boss (Route A: Guardian of the Forest · Route B: B3)',
    of: [{ type: 'boss_defeated', boss: 'boss_a3' }, { type: 'boss_defeated', boss: 'boss_b3' }],
  }],
  exits: [
    { id: 'forest_road', rect: [29, 28, 35, 29], to: 'a2', entry: [32, 34], label: 'Deep Forest' },
    { id: 'guardian_road', rect: [55, 17, 56, 18], to: 'arena', entry: [136, 14.5], label: 'Guardian Arena' },
  ],
  content: {
    interactables: [
      { id: 'ws_city2', kind: 'waystone', tx: 38, ty: 22, name: 'Valehaven', prompt: 'Waystone' },
      {
        id: 'city2_notice', kind: 'sign', tx: 29, ty: 24, prompt: 'Read Guild Notice', title: 'Valehaven — Guild Notice',
        text: 'VALEHAVEN · CITY 2 (Guild camp)\n• Both roads from Lumina end here: the Forest Road (Route A) and the Eastern Road (Route B, not surveyed yet).\n• The Sealed Depths lie north of the standing stones. Its door answers to power not yet found.\n• Merchants and the Guild hall arrive with the next caravan.',
      },
    ],
  },
};
