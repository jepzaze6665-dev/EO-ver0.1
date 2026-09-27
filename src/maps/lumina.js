import { T, Z, TILE } from '../core/constants.js';
import { makeHouse, makeWell } from './villageArt.js';

// LUMINA VILLAGE — 48x48 safe hub (tiles x 24..71, y 158..205). Forest Gate on the north edge.
export function buildLumina(b) {
  const X0 = 24, Y0 = 158, X1 = 71, Y1 = 205;
  b.zoneRect(X0, Y0, X1, Y1, Z.VILLAGE);
  const sq = b.m.addSubArea({ name: 'Town Square', zone: Z.VILLAGE });
  const res = b.m.addSubArea({ name: 'Residential Quarter', zone: Z.VILLAGE });
  const gate = b.m.addSubArea({ name: 'Forest Gate', zone: Z.VILLAGE });
  b.subRect(X0, Y0, X1, Y1, res);

  // ground: rounded grassy plateau inside the surrounding woods
  b.ellipse(48, 182, 23, 23, T.GRASS, { noise: 2 });
  b.rect(27, 161, 69, 203, T.GRASS);
  b.ellipse(40, 196, 6, 4, T.FLOWERS, { noise: 1.5, only: [T.GRASS] });
  b.ellipse(60, 168, 4, 3, T.FLOWERS, { noise: 1.5, only: [T.GRASS] });

  // roads (several connected paths, not a plain square)
  b.line([[48, 157], [48, 170], [48, 182]], 3, T.DIRT);
  b.line([[30, 184], [41, 182], [55, 182], [67, 180]], 2.6, T.DIRT);
  b.line([[48, 182], [48, 200]], 2.6, T.DIRT);
  b.line([[31, 184], [31, 196], [40, 200], [48, 200], [57, 200], [65, 196], [66, 181]], 2.2, T.DIRT);
  b.line([[35, 176], [41, 172], [48, 170]], 2, T.DIRT);
  b.line([[48, 170], [56, 172], [62, 176]], 2, T.DIRT);
  b.line([[66, 172], [65, 164], [64, 158]], 2, T.DIRT); // NE lane to bramble shortcut
  b.rect(64, 157, 65, 160, T.DIRT); // keep the lane open where it meets the forest (the line left a wall at row 159)
  b.disc(48, 182, 7.5, T.COBBLE, { noise: 0.6 });
  b.subDisc(48, 182, 9, sq);
  b.subRect(42, 158, 54, 166, gate);

  // tree-line walls around the village
  b.edgeTrees(X0 - 2, Y0 - 1, X1 + 2, Y1 + 2, ['tree_round_a', 'tree_round_b', 'tree_pine_a', 'tree_round_c', 'tree_large_a', 'tree_small_a', 'bush_a'], 0.8);

  // fences around residential edges
  for (const [x, y] of [[29, 203], [33, 203], [60, 203], [64, 203], [27, 190], [69, 190]])
    b.prop('fence_wood', x, y, { layer: 'y' });

  // ---- Town square landmarks
  b.prop('big_fountain', 48, 182, { dy: 14, solid: true, footprint: [[-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]], light: { r: 70, color: '#5ab8ff', a: 0.45 } });
  b.light(48, 181, 90, '#8ac8ff', { a: 0.25 });
  for (const [x, y] of [[42, 177], [54, 177], [42, 187], [54, 187]]) {
    b.prop('lamppost', x, y, { solid: true, light: { r: 78, color: '#ffb050', a: 0.75, flicker: true, oy: -128 } });
  }
  b.prop('bench_a', 44, 187, { dy: 6 });
  b.prop('bench_b', 52, 187, { dy: 6 });
  b.prop('flowerbox_a', 45, 176, {});
  b.prop('flowerbox_b', 51, 176, {});

  // ---- Adventurer Guild (west)
  b.rect(31, 171, 35, 174, T.BUILDING);
  b.prop('guild_hall', 33, 174, { dy: 2, scale: 1.25 });
  b.prop('guild_sign', 36, 175, { dx: 4 });
  b.prop('banner_blue', 30, 175, {});
  b.npc({ id: 'guide', name: 'Captain Aldric', role: 'Adventurer Guide', tx: 36, ty: 176, look: 'guide' });

  // ---- Quest board + elder (north-center)
  b.prop('notice_board', 44, 170, { solid: true });
  b.interact({ id: 'quest_board', kind: 'sign', tx: 44, ty: 170, prompt: 'Read Quest Board', text: 'board' });
  b.npc({ id: 'elder', name: 'Elder Maren', role: 'Quest', tx: 46, ty: 172, look: 'elder' });

  // ---- Blacksmith (east)
  b.rect(60, 171, 65, 173, T.BUILDING);
  const smithHouse = makeHouse(6, 'slate', 11, { chimney: true });
  b.propPx('house', (62.5 + 0.5) * TILE, 174 * TILE - 2, { canvas: smithHouse });
  b.prop('forge', 60, 176, { solid: true, light: { r: 70, color: '#ff7a30', a: 0.9, flicker: true, oy: -30 } });
  b.prop('anvil', 62, 177, { solid: true });
  b.prop('weapon_rack', 65, 176, { solid: true });
  b.prop('barrel_a', 66, 177, {});
  b.npc({ id: 'smith', name: 'Borin', role: 'Blacksmith', tx: 63, ty: 178, look: 'smith' });

  // ---- Item shop (south-east of square)
  b.prop('shop_stall', 58, 190, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('crate_potions', 61, 190, { solid: true });
  b.prop('potion_shelf', 56, 189, { dy: -8 });
  b.npc({ id: 'merchant', name: 'Lysa', role: 'Item Merchant', tx: 58, ty: 191, look: 'merchant' });

  // ---- Storage & waystone
  b.prop('crate_a', 37, 190, {});
  b.interact({ id: 'storage', kind: 'storage', tx: 38, ty: 190, prompt: 'Open Storage' });
  b.prop('cloth_crate', 38, 190, { solid: true });
  b.interact({ id: 'ws_village', kind: 'waystone', tx: 41, ty: 187, name: 'Lumina Village', prompt: 'Waystone' });

  // ---- Residential houses
  const houses = [
    [30, 194, 4, 'red'], [36, 197, 4, 'blue'], [57, 197, 4, 'green'], [63, 193, 4, 'red'],
    [30, 164, 4, 'green'], [66, 185, 3, 'blue'], [37, 203, 3, 'slate'], [59, 203, 3, 'blue'],
  ];
  houses.forEach(([x, y, w, style], i) => {
    const c = makeHouse(w, style, 20 + i);
    b.rect(x - Math.floor(w / 2), y - 2, x - Math.floor(w / 2) + w - 1, y, T.BUILDING);
    b.propPx('house', (x - Math.floor(w / 2) + w / 2) * TILE, (y + 1) * TILE - 2, { canvas: c });
    b.light(x, y + 1, 40, '#ffb050', { a: 0.35 });
  });
  b.propPx('well', 53 * TILE, 196 * TILE, { canvas: makeWell(), solid: true });
  b.prop('hay', 69, 196, {}); b.prop('cart', 68, 199, { solid: true });
  b.prop('barrel_b', 34, 191, {}); b.prop('firewood', 27, 187, {});
  b.prop('sack', 64, 190, {}); b.prop('flowerpot_a', 39, 193, {});
  b.prop('bell_shrine', 26, 180, { solid: true });
  b.npc({ id: 'child', name: 'Pip', role: 'Villager', tx: 51, ty: 185, look: 'child', wander: 3 });
  b.npc({ id: 'villager', name: 'Hanna', role: 'Villager', tx: 40, ty: 199, look: 'villager', wander: 2 });

  // ---- Forest Gate (north)
  b.prop('village_gate', 48, 160, { dy: 6, scale: 0.55 });
  b.rect(43, 159, 45, 160, T.BUILDING); b.rect(51, 159, 53, 160, T.BUILDING);
  b.npc({ id: 'guard', name: 'Tomas', role: 'Gate Guard', tx: 51, ty: 162, look: 'guard' });
  b.prop('signpost', 45, 163, {});
  b.interact({ id: 'sign_gate', kind: 'sign', tx: 45, ty: 163, prompt: 'Read Sign', text: 'NORTH — Whispering Forest\nSOUTH — Lumina Village\n"Travelers: stay on the path after dusk."' });
  b.prop('lantern_post', 44, 161, { light: { r: 60, color: '#ffb050', a: 0.7, flicker: true, oy: -40 } });
  b.prop('lantern_post', 52, 161, { light: { r: 60, color: '#ffb050', a: 0.7, flicker: true, oy: -40 } });

  b.regions.playerSpawn = { x: 48.5 * TILE, y: 191 * TILE };
  b.regions.villageRespawn = { x: 48.5 * TILE, y: 190 * TILE };
}
