import { Z } from '../core/constants.js';
import { LEVEL_SCALING } from '../data/levelScaling.js';

// B1 — FROSTWIND PLAINS (own grid: world/levels/frostwind.js, terrain maps/frostwind.js). Route B's first map: snow
// fields east of Lumina, a frozen lake and the Frost Arena. Monsters from the owner's sheets (desgin/monster/B/B1):
// Snowdrift Hare, Rimefang Wolf (packs, flank), Frost Harrier (diving bird) and Frostback Bear (ice spikes).
// Its boss: HOARFANG in the Frost Arena (SE, its own boss-arena map maps/frostArena.js, up the north stairs).
const NOTICE = [
  "HUNTER'S LODGE — Guild notice",
  '"The Eastern Road is open again. Keep to the packed snow; the wolves hunt the drifts."',
  'The crossroads lie south-east. Past the river, stairs climb to the old Frost Arena — the Winter Alpha dens there.',
].join('\n');

export const FIELD_B1 = {
  id: 'b1', name: 'FROSTWIND PLAINS', short: 'B1', sub: 'Route B · B1 — Frostwind Plains · Lv. 1 – 17',
  // LEVEL REWORK L3: old band -> new band; Route B monsters are tougher and pay more (data/levelScaling.js routeMod.B)
  levelBand: { from: [1, 9], to: [1, 17], exp: 1.5 }, monsterMod: LEVEL_SCALING.routeMod.B, grid: 'frostwind',
  type: 'field', route: 'B', nextMap: 'b2', bossId: 'boss_b1',
  requires: [],
  hiddenAreas: [],
  region: { zones: [Z.FROSTWIND] },
  spawn: [8.5, 21],
  content: {
    interactables: [
      { id: 'b1_lodge_notice', kind: 'sign', tx: 10, ty: 24, prompt: 'Read Notice', title: "Hunter's Lodge", text: NOTICE },
      { id: 'ws_b1_lodge', kind: 'waystone', tx: 14, ty: 18, name: "Hunter's Lodge", prompt: 'Waystone' },
      { id: 'b1_cross_sign', kind: 'sign', tx: 83, ty: 60, prompt: 'Read Sign', title: 'Frostwind Crossroads', text: "↑ Old Watchtower\n→ Nomad Camp · the arena road (south-east)\n← Trapper's Ruins\n↓ the Frozen Mere" },
    ],
    // hares near the lodge, wolves in packs on the roads, harriers over the open snow, bears at the ruins and the camp
    spawns: [
      { id: 'b1_lodge_hares', type: 'snow_hare', count: 3, tx: 34, ty: 38, radius: 4 },
      { id: 'b1_road_wolves', type: 'rime_wolf', count: 2, tx: 58, ty: 50, radius: 3 },
      { id: 'b1_tower_harrier', type: 'frost_harrier', count: 2, tx: 92, ty: 36, radius: 4 },
      { id: 'b1_trapper_wolves', type: 'rime_wolf', count: 3, tx: 38, ty: 70, radius: 4 },
      { id: 'b1_trapper_bear', type: 'frost_bear', count: 1, tx: 30, ty: 60, radius: 2 },
      { id: 'b1_camp_harrier', type: 'frost_harrier', count: 2, tx: 130, ty: 70, radius: 4 },
      { id: 'b1_mine_bear', type: 'frost_bear', count: 1, tx: 138, ty: 92, radius: 2 },
      { id: 'b1_bank_wolves', type: 'rime_wolf', count: 3, tx: 124, ty: 104, radius: 4 },
      { id: 'b1_mere_hares', type: 'snow_hare', count: 2, tx: 70, ty: 92, radius: 3 },
      { id: 'b1_mere_wolves', type: 'rime_wolf', count: 2, tx: 34, ty: 118, radius: 4 },
      { id: 'b1_shrine_harrier', type: 'frost_harrier', count: 2, tx: 28, ty: 146, radius: 3 },
      { id: 'b1_bridge_bear', type: 'frost_bear', count: 1, tx: 108, ty: 160, radius: 2 },
      // Elite: a Frostback Bear guards the Ice Shrine (killed once)
      { id: 'b1_shrine_warden', type: 'frost_bear', elite: true, unique: true, count: 1, tx: 21, ty: 162, radius: 0 },
    ],
  },
  exits: [
    { id: 'eastern_road', rect: [2, 19, 2, 23], to: 'lumina', entry: [68.5, 180], label: 'Lumina Village' },
    {
      id: 'arena_stairs', rect: [140, 123, 144, 123], to: 'frost_arena', entry: [142, 131], label: 'The Frost Arena',
      confirm: {
        title: 'The Frost Arena',
        text: 'Frost-bitten bones line the stairs. Something enormous breathes in the arena above.\nOnce the Winter Alpha rises, the arena seals until one of you falls.\n\nEnter the Frost Arena?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
};
