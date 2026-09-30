import { Z } from '../core/constants.js';

// THE GILDED VAULT — A2's SECRET boss arena (owner 2026-09-30: "a secret boss entrance + a secret boss near the Golden
// Arch"). The valley kings sealed their sun-forged beast under the Golden Arch. Way in: the paved stair south of the
// Golden Arch (maps/ancientValley.js), barred by the golden seal (fieldA2 gate `golden_seal`) until the three SUN SIGILS
// of the valley are lit (fieldA2 `sigil` interactables -> world trigger `golden_vault_open`). Built like the Magma
// Rift: its own map, the entrance asks first, a round arena, exits sealed + camera held while AURUM fights
// (data/bosses.js secret_a2). Not on the route panel; the world map lists it once found (`secret`).
// Terrain: maps/ancientValley.js (zone GILDED_VAULT, rows 140+ around the vault).
export const GILDED_VAULT = {
  id: 'gilded_vault', name: 'THE GILDED VAULT', short: 'Secret', sub: 'Ancient Valley · Secret Boss · beneath the Golden Arch', grid: 'ancient_valley',
  type: 'boss_arena', route: 'A', parent: 'a2', bossId: 'secret_a2', secret: true,
  requires: [{ type: 'event', id: 'golden_vault_open', label: 'The golden seal is closed' }],
  region: { zones: [Z.GILDED_VAULT] },
  spawn: [146.5, 143],
  exits: [
    { id: 'vault_stair', rect: [143, 140, 149, 140], to: 'a2', entry: [146.5, 137], label: 'Golden Arch' },
  ],
};
