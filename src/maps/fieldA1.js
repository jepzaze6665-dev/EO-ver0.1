import { Z } from '../core/constants.js';

// A1 — WHISPERING FOREST (forest edge, south of the river). Tutorial combat area: the first pack waits at the
// Forest Entrance (tutorial wolves, never corrupted), Wolf Hollow west, the Abandoned Camp (goblin) south-west.
// Optional Area: Crystal Glade (Crystal Beasts Lv.6 — harder than the rest of A1, rare chest + crystal nodes).
// Area Boss: HOLLOW FANG in the Howling Den (east of the River Crossing waystone) — data/bosses.js boss_a1.
// Boss Gate: a barrier on the bridge (gates) + the exits to A2 stay closed until the boss falls (A2 `requires`).
// Terrain + base spawns: maps/forest.js (the forest south of tile row 98). Extra content below: `content`.

const COMBAT_NOTICE = [
  'Hunters of Lumina — read before you fight:',
  '• [Tab] targets the nearest beast (or click one). Its name and HP appear at the top of the screen.',
  '• Left click attacks · keys 1–4 use skills · 5 is your ultimate · Q is your class special.',
  '• Red shapes on the ground mean an attack is coming. [Space] dodges — dodge through it at the last moment.',
  '• Beasts drop gold, materials and EXP. Potions: [R] heals · [F] restores your class resource.',
  '• Wolf Hollow lies west. The River Crossing to the north leads on to the Deep Forest —',
  '  but HOLLOW FANG, the pack alpha, holds the crossing. Its den is beside the waystone.',
].join('\n');
const GLADE_WARNING = [
  'WARNING — CRYSTAL GLADE',
  'Crystal Beasts (Lv. 6) nest ahead. Their armour turns blades.',
  'Strike the glowing core on their backs — or come back stronger.',
].join('\n');

export const FIELD_A1 = {
  id: 'a1', name: 'WHISPERING FOREST', short: 'A1', sub: 'Route A · A1 — Forest Edge · Lv. 1 – 4',
  type: 'field', route: 'A', nextMap: 'a2', bossId: 'boss_a1', requires: [], hiddenAreas: [],
  region: { zones: [Z.FOREST], minTy: 98 },
  // Boss Gate: the River Crossing is barred until Hollow Fang (Howling Den, beside the River Crossing waystone) falls
  gates: [
    { id: 'a1_river_gate', rect: [47, 100, 52, 101], requires: [{ type: 'map_unlocked', map: 'a2', label: 'Defeat HOLLOW FANG, the A1 boss (Howling Den)' }], color: '255,176,112', label: 'River Crossing' },
  ],
  spawn: [47.5, 150],
  // map-owned content (world/world.js loads it): signs / NPC-free guidance for the tutorial area
  content: {
    optional: 'Crystal Glade',
    interactables: [
      { id: 'a1_hunters_notice', kind: 'sign', tx: 52, ty: 146, prompt: "Read Hunter's Notice", title: "Hunter's Notice", text: COMBAT_NOTICE },
      { id: 'a1_glade_warning', kind: 'sign', tx: 62, ty: 121, prompt: 'Read Warning', title: 'Warning', text: GLADE_WARNING },
      { id: 'a1_glade_warning_east', kind: 'sign', tx: 74, ty: 130, prompt: 'Read Warning', title: 'Warning', text: GLADE_WARNING },
    ],
    spawns: [
      // Forest Entrance meadow: Whisper Hares (Lv. 1, the first thing to fight)
      { id: 'a1_hares', type: 'rabbit', count: 3, tx: 57, ty: 147, radius: 3, cond: 'always' },
    ],
  },
  exits: [
    { id: 'to_lumina', rect: [44, 156, 51, 157], to: 'lumina', entry: [47.5, 161.5], label: 'Lumina Village' },
    { id: 'to_lumina_lane', rect: [63, 156, 67, 157], to: 'lumina', entry: [65.5, 161.5], label: 'Lumina Village' },
    { id: 'bridge_north', rect: [48, 98, 52, 99], to: 'a2', entry: [50, 94.5], label: 'Deep Forest' },
    { id: 'log_bridge', rect: [21, 98, 24, 99], to: 'a2', entry: [22.5, 95], label: 'Deep Forest', requires: { flag: 'logBridge' } },
    { id: 'ruins_side', rect: [92, 110, 95, 113], to: 'a3', entry: [104, 112], label: 'Ancient Ruins', requires: { flag: 'ruinsGate' } },
  ],
};
