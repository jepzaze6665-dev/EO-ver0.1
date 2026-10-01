import { Z } from '../core/constants.js';

// THE CINDER THRONE — A2's SECRET boss arena: the lair of Varkharon, the Sealed Cinder King. It is not on the route:
// the only way in is the dragon door in the Quiet Hollow (A2, south-east cleft off the Valley Gate), which stays sealed
// until the player brings Varkharon's Seal (three Cinder Shards from the Ashen Pilgrim) — the door is an interactable
// (`sealDoor`, exploration/interactables.js) that sets the flag the A2 exit asks for. Hidden from the world map until
// visited (`secret`). Terrain: maps/ancientValley.js (zone CINDER, round dragon-stone floor in a lava moat). The fight
// itself (boss data, mechanics) arrives in D4; `regions.cinderAnchors` = the three chain posts its fight will use.
export const CINDER_THRONE = {
  id: 'cinder', name: 'THE CINDER THRONE', short: 'Secret', sub: 'A2 · Secret · where the Cinder King was sealed', grid: 'ancient_valley',
  type: 'boss_arena', route: 'A', parent: 'a2', secret: true,
  requires: [],
  region: { zones: [Z.CINDER] },
  spawn: [148, 165],
  exits: [
    { id: 'throne_stairs', rect: [146, 167, 150, 167], to: 'a2', entry: [148, 174], label: 'Quiet Hollow' },
  ],
};
