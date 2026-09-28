import { Z } from '../core/constants.js';

// A1 — WHISPERING FOREST (W2: the whole original world grid except Lumina and the hidden valley).
// One field map, depth grows from south to north-east:
//   Forest Entrance (Whisper Hares, tutorial wolves) -> Wolf Hollow -> River Crossing -> Deep Forest (corrupted beasts,
//   miasma, thorns) -> Stone Circle -> Ancient Forest Path -> Ancient Ruins (ruin-hardened monsters, rune wards, Elite)
//   -> Guardian Gate -> A1 BOSS: the Guardian of the Forest (its own map: maps/majorBossArena.js, `arena`).
// Optional: Crystal Glade (Lv. 6 beasts), mini-bosses Hollow Fang (Howling Den) + the Thornbound Elder (Thornwood Glade) — they gate
// nothing any more (quest forest_hunts). Hidden: Hidden Cave, Behind the Waterfall, Moonlit Shrine, Sealed Archive,
// and the Sealed Path to the secret city Valehaven (opens once the forest heals).
// Terrain + base spawns: maps/forest.js + maps/ruins.js (world/levels/whispering.js). Extra content below: `content`.

const COMBAT_NOTICE = [
  'Hunters of Lumina — read before you fight:',
  '• [Tab] targets the nearest beast (or click one). Its name and HP appear at the top of the screen.',
  '• Left click attacks · keys 1–4 use skills · 5 is your ultimate · Q is your class special.',
  '• Red shapes on the ground mean an attack is coming. [Space] dodges — dodge through it at the last moment.',
  '• Beasts drop gold, materials and EXP. Potions: [R] heals · [F] restores your class resource.',
  '• Wolf Hollow lies west. HOLLOW FANG, the pack alpha, dens beside the River Crossing waystone —',
  '  hunt it if you dare. The road itself runs on, north over the river.',
].join('\n');
const GLADE_WARNING = [
  'WARNING — CRYSTAL GLADE',
  'Crystal Beasts (Lv. 6) nest ahead. Their armour turns blades.',
  'Strike the glowing core on their backs — or come back stronger.',
].join('\n');
const CROSSROADS = [
  'CROSSROADS OF THE DEEP FOREST',
  '← Elder Tree            ↑ Stone Circle · Thornwood Glade            → Ancient Forest Path (Ruins)',
  '"The ground rots where the fog is thickest. Do not linger in the green mire —',
  ' and watch for the thorns: they rise without a sound."',
].join('\n');
const CORRUPTED = { notFlag: 'guardianDefeated' }; // hazards fade when the forest is restored
const MIRE = [{ id: 'poison', dur: 3 }, { id: 'slow', dur: 1.2 }];

export const FIELD_A1 = {
  id: 'a1', name: 'WHISPERING FOREST', short: 'A1', sub: 'Route A · A1 — Whispering Forest · Lv. 1 – 10',
  grid: 'whispering', type: 'field', route: 'A', nextMap: 'a2', bossId: 'boss_a1', // the boss waits in the Guardian Arena
  requires: [],
  hiddenAreas: ['hidden_cave', 'behind_waterfall', 'moonlit_shrine', 'sealed_archive'],
  region: { zones: [Z.FOREST, Z.CAVE, Z.RUINS, Z.GATE] },
  spawn: [47.5, 150],
  // difficulty by part of the map (world.js populate): north of the river the beasts are corrupted until the Guardian
  // falls; in the ruins they are hardened (tougher, more EXP, +2 level — Monster opts.areaMod)
  corruptedMonsters: { maxTy: 97 },
  monsterMods: [{ zones: [Z.RUINS, Z.GATE], mod: { hp: 1.35, power: 1.15, exp: 1.4, level: 2 } }],
  content: {
    optional: 'Crystal Glade',
    npcs: [
      { id: 'kael', name: 'Kael', role: 'Wounded Guild Scout', tx: 128, ty: 86, look: 'scout' },
    ],
    interactables: [
      { id: 'a1_hunters_notice', kind: 'sign', tx: 52, ty: 146, prompt: "Read Hunter's Notice", title: "Hunter's Notice", text: COMBAT_NOTICE },
      { id: 'a1_glade_warning', kind: 'sign', tx: 62, ty: 121, prompt: 'Read Warning', title: 'Warning', text: GLADE_WARNING },
      { id: 'a1_glade_warning_east', kind: 'sign', tx: 74, ty: 130, prompt: 'Read Warning', title: 'Warning', text: GLADE_WARNING },
      { id: 'a2_crossroads', kind: 'sign', tx: 47, ty: 71, prompt: 'Read Signpost', title: 'Signpost', text: CROSSROADS },
    ],
    spawns: [
      // Forest Entrance meadow: Whisper Hares (Lv. 1, the first thing to fight)
      { id: 'a1_hares', type: 'rabbit', count: 3, tx: 57, ty: 147, radius: 3, cond: 'always' },
      // Ancient Shrine: the first Elite (killed once)
      { id: 'a3_shrine_warden', type: 'treant', elite: true, unique: true, count: 1, tx: 136, ty: 74, radius: 0 },
    ],
    hazards: [
      // Deep Forest: miasma bogs (poison + slow while inside) and thorn eruptions (telegraphed strike + root)
      { id: 'mire_deep', kind: 'miasma', name: 'Green Mire', tx: 53, ty: 79, r: 2.6, interval: 1, statuses: MIRE, while: CORRUPTED },
      { id: 'mire_glade', kind: 'miasma', name: 'Green Mire', tx: 42, ty: 69, r: 1.8, interval: 1, statuses: MIRE, while: CORRUPTED },
      { id: 'mire_path', kind: 'miasma', name: 'Green Mire', tx: 85, ty: 68, r: 1.8, interval: 1, statuses: MIRE, while: CORRUPTED },
      { id: 'thorns_circle', kind: 'thorns', name: 'Corrupted Thorns', tx: 66, ty: 61, r: 1.6, period: 4.5, windup: 0.9, power: 16, root: 0.8, while: CORRUPTED },
      { id: 'thorns_bend', kind: 'thorns', name: 'Corrupted Thorns', tx: 61, ty: 65, r: 1.4, period: 5.5, windup: 0.9, power: 16, root: 0.8, while: CORRUPTED },
      { id: 'thorns_path', kind: 'thorns', name: 'Corrupted Thorns', tx: 82, ty: 70, r: 1.4, period: 5, windup: 0.9, power: 16, root: 0.8, while: CORRUPTED },
      // Ancient Ruins: rune-ward pylons fire across the shrine yard / gate antechamber until their seals are dealt with
      { id: 'ward_shrine', kind: 'beam', name: 'Rune Ward', tx: 129, ty: 77, len: 14, angle: 0, width: 10, period: 3.4, windup: 0.9, power: 18, while: { notFlag: 'shrineInvestigated' } },
      { id: 'ward_gate', kind: 'beam', name: 'Rune Ward', tx: 131, ty: 61, len: 10, angle: 0, width: 10, period: 3, windup: 0.8, power: 20, while: { notFlag: 'gateOpened' } },
    ],
  },
  exits: [
    { id: 'to_lumina', rect: [44, 156, 51, 157], to: 'lumina', entry: [47.5, 161.5], label: 'Lumina Village' },
    { id: 'to_lumina_lane', rect: [63, 156, 67, 157], to: 'lumina', entry: [65.5, 161.5], label: 'Lumina Village' },
    // the Sealed Path (hidden road, north-west): Valehaven, the secret city — open once the forest heals
    { id: 'valley_road', rect: [29, 30, 35, 31], to: 'valehaven', entry: [32, 25], label: 'Sealed Path' },
    {
      id: 'arena_gate', rect: [131, 47, 139, 48], to: 'arena', entry: [135, 42], label: 'Guardian Arena', requires: { flag: 'gateOpened' },
      confirm: {
        title: 'The Heart of the Forest',
        text: 'Beyond this gate the Guardian of the Forest sleeps.\nOnce it wakes, the arena seals behind you until one of you falls.\n\nEnter the Guardian Arena?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
};
