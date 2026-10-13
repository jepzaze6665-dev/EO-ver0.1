import { T, Z, TILE } from '../core/constants.js';

// LUMINA VILLAGE — City 1 on its OWN grid (world/levels/lumina.js, 96 × 96), laid out as an online HUB (owner 2026-10-13):
//   centre : TOWN SQUARE (fountain) — spawn, waystone, storage, quest board + Elder: everyone meets here
//   ring   : services within ~15 tiles of the square — Adventurer Guild + training yard (W), Blacksmith (NE),
//            Item Shop (SE), Bell Shrine (far W)
//   NO EXITS (owner): the DUNGEON GATE in the square (maps/luminaVillage.js) is the only way out; the old Forest Gate
//            (N) is a closed gate at the end of the north road, the lanes end at the woods
//   outside: Residential Quarter (S), Farmstead (SW), orchard (NW) — for walking around, never on the way
// The old village (tiles 24..71 × 158..205 of the whispering grid) is forest now (maps/worldGen.js).
export const LUMINA_PLACES = {
  square: [48, 48], guild: [30, 46], smith: [66, 40], shop: [62, 58], gate: [48, 9], lane: [70, 4], east: [92, 48],
  homes: [48, 72], farm: [20, 78], orchard: [22, 22], shrine: [16, 46],
};

export function buildLuminaCity(b) {
  const m = b.m, P = LUMINA_PLACES;
  // forest all round, the village carved out of it
  b.rect(0, 0, m.w - 1, m.h - 1, T.CANOPY);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.VILLAGE);
  b.ellipse(48, 50, 41, 40, T.GRASS, { noise: 2.5 });
  b.rect(10, 12, 86, 86, T.GRASS);
  b.ellipse(22, 22, 9, 7, T.GRASS, { noise: 1.5 });
  b.ellipse(20, 78, 11, 8, T.GRASS, { noise: 1.5 });
  b.ellipse(36, 30, 5, 3, T.FLOWERS, { noise: 1.5, only: [T.GRASS] });
  b.ellipse(62, 70, 4, 3, T.FLOWERS, { noise: 1.5, only: [T.GRASS] });
  b.ellipse(40, 60, 3, 2, T.FLOWERS, { noise: 1, only: [T.GRASS] });

  const S = (name) => m.addSubArea({ name, zone: Z.VILLAGE });
  const AR = { square: S('Town Square'), res: S('Residential Quarter'), gate: S('Forest Gate'), guild: S('Adventurer Guild'),
    market: S('Market Corner'), east: S('Eastern Road'), farm: S('Farmstead') };
  b.subRect(0, 0, m.w - 1, m.h - 1, AR.res);

  // ---------------- roads: straight from the square to every gate
  b.rect(46, 11, 50, 40, T.DIRT);                              // north road -> the (closed) Forest Gate
  b.line([[55, 42], [64, 32], [70, 18]], 3, T.DIRT);           // north-east lane (ends in the woods)
  b.rect(57, 47, 84, 49, T.DIRT);                               // east road (ends at the woods)
  b.rect(20, 47, 39, 49, T.DIRT);                               // west road -> guild + shrine
  b.rect(47, 57, 49, 66, T.DIRT);                               // south road -> homes
  b.line([[34, 66], [34, 80], [48, 84], [62, 80], [62, 66], [48, 66], [34, 66]], 2.4, T.DIRT); // residential loop
  b.line([[34, 76], [24, 78]], 2, T.DIRT);                      // to the farm
  b.line([[46, 30], [30, 26], [22, 22]], 2, T.DIRT);            // to the orchard
  b.disc(...P.square, 9.5, T.COBBLE, { noise: 0.5 });
  b.subDisc(...P.square, 11, AR.square);
  b.subRect(40, 0, 56, 16, AR.gate);
  b.subRect(20, 38, 38, 56, AR.guild);
  b.subRect(56, 50, 70, 64, AR.market);
  b.subRect(72, 40, 88, 56, AR.east);
  b.subRect(8, 68, 30, 90, AR.farm);

  b.edgeTrees(0, 0, m.w - 1, m.h - 1, ['tree_round_a', 'tree_round_b', 'tree_pine_a', 'tree_round_c', 'tree_large_a', 'tree_small_a', 'bush_a'], 0.75);

  // ---------------- TOWN SQUARE: the meeting place (spawn, waystone, storage, board, elder)
  b.prop('big_fountain', 48, 48, { dy: 14, solid: true, footprint: [[-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]], light: { r: 70, color: '#5ab8ff', a: 0.45 } });
  b.light(48, 47, 100, '#8ac8ff', { a: 0.25 });
  for (const [x, y] of [[41, 42], [55, 42], [41, 54], [55, 54]]) {
    b.prop('lamppost', x, y, { solid: true, light: { r: 80, color: '#ffb050', a: 0.75, flicker: true, oy: -128 } });
  }
  b.prop('lc_bench', 44, 55, { scale: 0.75 }); b.prop('lc_bench', 52, 55, { flip: true, scale: 0.75 });
  b.prop('lc_pot_lavender', 44, 41, {}); b.prop('lc_pot_barrel', 52, 41, {});
  b.interact({ id: 'ws_village', kind: 'waystone', tx: 43, ty: 50, name: 'Lumina Village', prompt: 'Waystone' });
  b.prop('lc_crates', 54, 50, { solid: true });
  b.interact({ id: 'storage', kind: 'storage', tx: 54, ty: 50, prompt: 'Open Storage' });
  b.prop('gate_board', 45, 39, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.interact({ id: 'quest_board', kind: 'sign', tx: 45, ty: 39, prompt: 'Read Quest Board', text: 'board' });
  b.npc({ id: 'elder', name: 'Elder Maren', role: 'Quest', tx: 51, ty: 40, look: 'elder' });

  // ---------------- Adventurer Guild + training yard (west of the square)
  b.rect(26, 41, 34, 45, T.BUILDING);
  b.prop('lc_guild', 30, 45, { dy: 6, light: { r: 90, color: '#ffc870', a: 0.45, oy: -50 } });
  b.npc({ id: 'guide', name: 'Captain Aldric', role: 'Adventurer Guide', tx: 35, ty: 47, look: 'guide' });
  b.rect(23, 50, 34, 55, T.DIRT);                                 // training yard (dummies: world/levels/lumina.js)
  for (const [x, y] of [[23, 56], [27, 56], [31, 56]]) b.prop('lc_fence_rail', x, y, { layer: 'y' });
  b.prop('lc_weapon_rack', 22, 51, { solid: true });

  // ---------------- Blacksmith (north-east, on the lane)
  b.rect(63, 35, 69, 39, T.BUILDING);
  b.prop('lc_smithy', 66, 39, { dy: 8, light: { r: 80, color: '#ff7a30', a: 0.9, flicker: true, oy: -40 } });
  b.prop('lc_weapon_rack', 70, 41, { solid: true });
  b.prop('lc_ingot_tub', 61, 41, { solid: true });
  b.npc({ id: 'smith', name: 'Borin', role: 'Blacksmith', tx: 65, ty: 42, look: 'smith' });

  // ---------------- Market corner (south-east): Lysa's potion stall + two more stalls
  b.prop('lc_stall_potion', 62, 57, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('lc_stall_food', 58, 61, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('lc_stall_cloth', 67, 61, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('lc_goods', 65, 58, {}); b.prop('lc_sacks', 69, 58, {});
  b.npc({ id: 'merchant', name: 'Lysa', role: 'Item Merchant', tx: 62, ty: 58, look: 'merchant' });

  // ---------------- Forest Gate (north): barred and chained — the way out is the Dungeon Gate now
  b.prop('lc_forest_gate', 48, 10, { dy: 8 });
  b.rect(42, 7, 54, 10, T.BUILDING);
  b.prop('lc_lamp_post', 44, 12, { light: { r: 60, color: '#ffb050', a: 0.7, flicker: true, oy: -40 } });
  b.prop('lc_lamp_post', 53, 12, { flip: true, light: { r: 60, color: '#ffb050', a: 0.7, flicker: true, oy: -40 } });
  b.npc({ id: 'guard', name: 'Tomas', role: 'Gate Guard', tx: 52, ty: 13, look: 'guard' });
  b.prop('signpost', 44, 14, {});
  b.interact({ id: 'sign_gate', kind: 'sign', tx: 44, ty: 14, prompt: 'Read Sign', text: 'NORTH — Whispering Forest\nSOUTH — Lumina Village\n"Travelers: stay on the path after dusk."' });

  // ---------------- east road end
  b.prop('signpost', 84, 46, {});
  b.prop('lc_lamp_post', 80, 46, { light: { r: 55, color: '#ffb050', a: 0.65, flicker: true, oy: -40 } });
  b.prop('lc_cart', 86, 51, { solid: true });
  b.prop('lc_water_barrel', 83, 51, { solid: true });

  // ---------------- Bell shrine (far west, end of the west road)
  b.prop('bell_shrine', 17, 47, { solid: true });
  b.light(17, 47, 60, '#ffd890', { a: 0.4 });

  // ---------------- Residential Quarter (south) — the owner's six cottages round the loop
  const houses = [
    [38, 63, 'red'], [58, 63, 'moss'], [30, 70, 'blue'], [30, 78, 'straw'], [66, 70, 'brown'], [66, 78, 'grey'],
    [42, 75, 'grey'], [55, 75, 'red'], [40, 88, 'straw'], [56, 88, 'blue'],
  ];
  houses.forEach(([x, y, style], i) => {
    // solid footprint instead of BUILDING tiles (the tiles peeked out round the painted cottage)
    const fp = []; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) fp.push([dx, dy]);
    b.prop('lc_house_' + style, x, y, { dy: 6, flip: i % 2 === 1, solid: true, footprint: fp });
    b.light(x, y + 1, 40, '#ffb050', { a: 0.35 });
  });
  b.prop('lc_well', 48, 80, { solid: true });
  b.prop('lc_flower_arch', 48, 65, {});
  for (const [x, y] of [[44, 66], [52, 66], [34, 82], [62, 82]]) b.prop('lc_lamp_post', x, y, { light: { r: 50, color: '#ffb050', a: 0.6, flicker: true, oy: -40 } });
  b.prop('lc_pot_lavender', 36, 67, {}); b.prop('firewood', 26, 72, {}); b.prop('lc_water_barrel', 70, 72, {});
  b.prop('lc_pot_barrel', 60, 67, {}); b.prop('lc_bench', 51, 80, { scale: 0.75 });
  b.npc({ id: 'child', name: 'Pip', role: 'Villager', tx: 50, ty: 68, look: 'child', wander: 3 });
  b.npc({ id: 'villager', name: 'Hanna', role: 'Villager', tx: 44, ty: 82, look: 'villager', wander: 2 });

  // ---------------- Farmstead (south-west) + orchard (north-west)
  b.prop('lc_garden', 15, 79, {}); b.prop('lc_garden', 21, 75, {});
  b.prop('lc_hay', 13, 84, {}); b.prop('lc_cart', 24, 83, { solid: true });
  for (const [x, y] of [[11, 72], [15, 72], [11, 87], [15, 87]]) b.prop('lc_fence_rail', x, y, { layer: 'y' });
  b.prop('lc_fence_gate', 19, 72, { layer: 'y' });
  for (const [x, y, n] of [[18, 19, 'apple'], [24, 18, 'pear'], [20, 25, 'pear'], [27, 23, 'apple'], [15, 23, 'apple']]) b.prop('lc_tree_' + n, x, y, { solid: true });

  b.regions.playerSpawn = { x: 48.5 * TILE, y: 57 * TILE };
  b.regions.villageRespawn = { x: 48.5 * TILE, y: 56 * TILE };
}
