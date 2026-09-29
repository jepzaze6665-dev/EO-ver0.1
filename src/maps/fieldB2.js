import { Z } from '../core/constants.js';

// B2 — CRYSTAL CAVERNS (own grid: world/levels/caverns.js, terrain maps/crystalCaverns.js). Route B's second map: a
// cave system of glowing crystal under the Frostpeak foothills, entered from the Frost Arena's south road once Hoarfang
// falls. Monsters from the owner's sheets (desgin/monster/B/B2): Prism Slime, Shardback Spider, Glimmer Bat and the
// Mossgem Tortoise. The Heart of the Caverns (NE) holds the B2 boss, the Amethyst Colossus (maps/crystalHeart.js).
const NOTICE = [
  'GUILD MARKER — scratched into the tunnel wall',
  '"Crystal Caverns. The lake is crossable by the old bridge. The miners left in a hurry — the Heart woke up."',
  'The Heart of the Caverns (north-east): the crystal there moves. Do not go alone.',
].join('\n');

export const FIELD_B2 = {
  id: 'b2', name: 'CRYSTAL CAVERNS', short: 'B2', sub: 'Route B · B2 — Crystal Caverns · Lv. 10 – 13', grid: 'caverns',
  type: 'field', route: 'B', nextMap: 'b3', bossId: 'boss_b2',
  requires: [{ type: 'boss_defeated', boss: 'boss_b1', label: 'Defeat Hoarfang (B1 Boss)' }],
  hiddenAreas: [],
  region: { zones: [Z.CAVERNS] },
  spawn: [7, 12],
  content: {
    interactables: [
      { id: 'b2_tunnel_notice', kind: 'sign', tx: 12, ty: 15, prompt: 'Read Marker', title: 'Frozen Tunnel', text: NOTICE },
      { id: 'ws_b2_hall', kind: 'waystone', tx: 36, ty: 36, name: 'Glittering Hall', prompt: 'Waystone' },
      { id: 'b2_arch_sign', kind: 'sign', tx: 144, ty: 168, prompt: 'Read Inscription', title: 'The Abyssal Arch', text: 'Beyond the arch the road climbs to Frostpeak (B3).\nThe frost that sealed it melted when the Heart fell silent.' },
    ],
    spawns: [
      { id: 'b2_hall_slimes', type: 'crystal_slime', count: 3, tx: 42, ty: 40, radius: 4 },
      { id: 'b2_field_bats', type: 'crystal_bat', count: 2, tx: 60, ty: 60, radius: 4 },
      { id: 'b2_field_spider', type: 'cave_spider', count: 1, tx: 52, ty: 50, radius: 2 },
      { id: 'b2_gallery_slimes', type: 'crystal_slime', count: 2, tx: 76, ty: 30, radius: 3 },
      { id: 'b2_mine_spiders', type: 'cave_spider', count: 3, tx: 32, ty: 94, radius: 5 },
      { id: 'b2_lake_bats', type: 'crystal_bat', count: 3, tx: 92, ty: 90, radius: 6 },
      { id: 'b2_ruins_tortoise', type: 'moss_tortoise', count: 2, tx: 143, ty: 78, radius: 4 },
      { id: 'b2_plaza_spiders', type: 'cave_spider', count: 2, tx: 148, ty: 118, radius: 4 },
      { id: 'b2_grotto_slimes', type: 'crystal_slime', count: 3, tx: 26, ty: 156, radius: 4 },
      { id: 'b2_grotto_bat', type: 'crystal_bat', count: 1, tx: 30, ty: 150, radius: 2 },
      { id: 'b2_pool_tortoise', type: 'moss_tortoise', count: 1, tx: 114, ty: 150, radius: 2 },
      { id: 'b2_pool_slimes', type: 'crystal_slime', count: 2, tx: 58, ty: 130, radius: 3 },
      // Elite: a Mossgem Tortoise sleeps in the Sealed Crystal Vault (killed once)
      { id: 'b2_vault_warden', type: 'moss_tortoise', elite: true, unique: true, count: 1, tx: 88, ty: 176, radius: 0 },
    ],
  },
  exits: [
    { id: 'north_tunnel', rect: [2, 11, 2, 13], to: 'frost_arena', entry: [142, 163], label: 'The Frost Arena' },
    { id: 'abyssal_arch', rect: [147, 170, 149, 170], to: 'b3', entry: [81.5, 201], label: 'Frostpeak (B3)' },
    {
      id: 'heart_gate', rect: [121, 26, 121, 32], to: 'crystal_heart', entry: [128, 29], label: 'Heart of the Caverns',
      confirm: {
        title: 'Heart of the Caverns',
        text: 'The crystal ahead hums like a heartbeat — and something in it stands up.\nOnce the Colossus wakes, the Heart seals until one of you falls.\n\nEnter the Heart of the Caverns?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
};
