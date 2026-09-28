import { T, Z, TILE } from '../core/constants.js';

// CITY 2 — ASTERIA CITY terrain (grid `asteria`, 160 × 160). After the owner's reference (desgin/Map/Ref/ASTERIA CITY,
// 1280 px = 8 px per tile) with the owner's city art: ground = tile skin 'asteria', props = 'a_*'.
// A walled city inside a moat, the forest all around. One gate + bridge in the south (the road from the Sanctum).
//   centre : Crystal Plaza (the crystal fountain) — avenues north (Asteria Keep), south (gate), west, east
//   north  : Noble Quarter (blue manors, west) · Keep Court · Rosewall Homes (red roofs, east)
//   middle : Grand Bazaar (market tents, west) · Guild Quarter (guild hall + cathedral, east)
//   lower  : Forge Row (west) · Hall of Records (east) · Old Quarter ruins + colosseum (south-west) · Greenroof Lane
//            (green homes, south-east) · Fountain Garden between them on the avenue
const C = T.COBBLE, G = T.GRASS, A = T.ARENA, W = T.RUIN_WALL, F = T.FLOWERS;

export const ASTERIA_PLACES = {
  gate: [80, 136], plaza: [80, 67], keep: [80, 24], noble: [37, 32], homes: [123, 32], bazaar: [37, 67], guild: [123, 67],
  forge: [37, 88], records: [123, 88], ruins: [37, 116], lane: [123, 116], garden: [80, 110],
};
// the city wall (inside the moat): the gate opening in its south side (under the gate's arch) and the road's width
export const ASTERIA_WALL = { x0: 14, y0: 14, x1: 146, y1: 134, gate: [79, 81], road: [77, 83] };

export function buildAsteriaTerrain(b) {
  const m = b.m, P = ASTERIA_PLACES, K = ASTERIA_WALL, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, G);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.ASTERIA);
  const S = (name) => m.addSubArea({ name, zone: Z.ASTERIA });
  const AR = {
    gate: S('South Gate'), plaza: S('Crystal Plaza'), keep: S('Asteria Keep'), noble: S('Noble Quarter'), homes: S('Rosewall Homes'),
    bazaar: S('Grand Bazaar'), guild: S('Guild Quarter'), forge: S('Forge Row'), records: S('Hall of Records'), ruins: S('Old Quarter'),
    lane: S('Greenroof Lane'), garden: S('Fountain Garden'),
  };

  // ---------------- moat, wall, forest ring
  b.rect(8, 8, 152, 142, T.WATER);
  b.rect(9, 9, 151, 141, T.SHALLOW);
  b.rect(11, 11, 149, 139, G);
  for (let x = K.x0; x <= K.x1; x++) for (const y of [K.y0, K.y0 + 1, K.y1, K.y1 + 1]) m.set(x, y, W);
  for (let y = K.y0; y <= K.y1 + 1; y++) for (const x of [K.x0, K.x0 + 1, K.x1 - 1, K.x1]) m.set(x, y, W);
  // south gate, bridge over the moat, road out to the Sanctum road (exit south_road, maps/city2.js)
  b.rect(K.gate[0], K.y1, K.gate[1], K.y1 + 1, C);
  b.rect(K.road[0], 135, K.road[1], 157, C);
  for (let y = 8; y <= 142; y++) for (let x = K.road[0]; x <= K.road[1]; x++) { const t = m.get(x, y); if (t === T.WATER || t === T.SHALLOW) m.set(x, y, T.BRIDGE); }
  b.rect(0, 0, m.w - 1, 1, T.CLIFF); b.rect(0, m.h - 2, m.w - 1, m.h - 1, T.CLIFF);
  b.rect(0, 0, 1, m.h - 1, T.CLIFF); b.rect(m.w - 2, 0, m.w - 1, m.h - 1, T.CLIFF);

  // ---------------- streets: avenues, lanes, the canal across the upper city
  const streets = [
    [76, 16, 84, 133],            // grand avenue (north - south)
    [16, 64, 144, 70],            // cross avenue (west - east)
    [57, 16, 59, 133], [101, 16, 103, 133], // side streets
    [16, 47, 144, 49], [16, 96, 144, 98],   // cross streets
  ];
  for (let x = 16; x <= 144; x++) for (const y of [51, 52]) m.set(x, y, T.WATER);
  for (const [x0, y0, x1, y1] of streets) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, m.get(x, y) === T.WATER ? T.BRIDGE : C);
  b.rect(16, 53, 56, 62, C); // Grand Bazaar square
  // plazas / courts / districts
  b.disc(...P.plaza, 13, A, { noise: 0.3 });
  b.rect(64, 16, 96, 32, A);
  b.disc(...P.garden, 9, F, { noise: 1 });
  b.disc(...P.ruins, 12, T.MOSS_STONE, { noise: 1.4 });
  b.rect(76, 100, 84, 120, C);
  const subs = { plaza: 15, noble: 18, homes: 18, bazaar: 18, guild: 18, forge: 14, records: 14, ruins: 16, lane: 16, garden: 10 };
  for (const [k, rr] of Object.entries(subs)) b.subDisc(P[k][0], P[k][1], rr, AR[k]);
  b.subRect(64, 16, 96, 36, AR.keep);
  b.subRect(66, 124, 94, 157, AR.gate);

  // ---------------- props (the city sheet is extracted at full size: scales here are final, 1 = the sheet's pixels)
  const bld = (name, x, y, w = 3, opts = {}) => {
    const fp = [];
    for (let dx = -Math.floor(w / 2); dx <= Math.floor(w / 2); dx++) for (let dy = -(opts.depth || 2) + 1; dy <= 0; dy++) fp.push([dx, dy]);
    return b.prop(name, x, y, { solid: true, footprint: fp, ...opts });
  };
  const lamp = (x, y, color = '#9ac8ff') => { b.prop('a_lamp_a', x, y, { solid: true, scale: 0.7 }); b.light(x, y - 1, 64, color, { a: 0.5, flicker: true }); };
  // district rows: buildings side by side (like the reference), a paved lane in front of each row
  const row = (names, xs, y, opts = {}) => {
    for (let x = xs[0] - 3; x <= xs[xs.length - 1] + 3; x++) if (m.get(x, y + 1) === G) m.set(x, y + 1, C);
    xs.forEach((x, i) => bld(names[(i + (opts.shift || 0)) % names.length], x, y, opts.w || 5, { scale: opts.scale || 1, depth: opts.depth || 3, flip: opts.flip ? r.chance(0.5) : false }));
  };
  const COLS_W = [21, 28, 35, 42, 49], COLS_E = [110, 117, 124, 131, 138];

  // the wall: towers on the corners and along the sides, wall pieces on the north / south faces, the great gate
  for (const [x, y] of [[K.x0 + 1, K.y0 + 1], [K.x1 - 1, K.y0 + 1], [K.x0 + 1, K.y1 + 1], [K.x1 - 1, K.y1 + 1]]) b.prop('a_tower_round', x, y, { scale: 0.8 });
  for (let x = K.x0 + 5; x <= K.x1 - 4; x += 4) {
    if (Math.abs(x - 80) > 8) b.prop(x % 8 ? 'a_wall_a' : 'a_wall_b', x, K.y1 + 1, {});
    b.prop(x % 16 === 0 ? 'a_wall_gate' : 'a_wall_a', x, K.y0 + 1, {});
  }
  for (let y = K.y0 + 8; y <= K.y1 - 6; y += 8) for (const x of [K.x0 + 1, K.x1 - 1]) b.prop(y % 16 ? 'a_tower_thin' : 'a_tower_b', x, y, { scale: 0.8 });
  b.prop('a_castle_gate', 80, K.y1 + 1, { light: { r: 100, color: '#ffc870', a: 0.6, oy: -60 } });
  for (const x of [75, 85]) b.prop('a_banner_stand_c', x, 130, { solid: true, scale: 0.8 });

  // Asteria Keep (north): the castle over the keep court, towers either side, chapel + spire by the avenue
  bld('a_castle_blue', 80, 27, 7, { scale: 1.3, depth: 3 });
  bld('a_keep_blue', 68, 25, 3, { scale: 0.85 });
  bld('a_keep_blue', 92, 25, 3, { scale: 0.85, flip: true });
  bld('a_chapel_blue', 67, 44, 3, { scale: 0.85 });
  bld('a_spire_blue', 93, 44, 3, { scale: 0.85 });
  for (const x of [73, 87]) b.prop('a_banner_stand_a', x, 32, { solid: true, scale: 0.8 });
  for (const x of [66, 94]) lamp(x, 33, '#ffd890');

  // Crystal Plaza: the crystal fountain, lamps and benches around it
  bld('a_crystal_fountain', ...P.plaza, 5, { depth: 2, scale: 0.85, light: { r: 150, color: '#7ab8ff', a: 0.6, oy: -60, flicker: true } });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, x = Math.round(P.plaza[0] + Math.cos(a) * 10), y = Math.round(P.plaza[1] + Math.sin(a) * 10);
    lamp(x, y);
  }
  for (const [x, y] of [[73, 60], [87, 60], [73, 74], [87, 74]]) b.prop('a_bench', x, y, { scale: 0.7 });
  b.prop('a_crate', 74, 76, { solid: true, scale: 0.7 }); // storage (interactable a_storage, maps/city2.js)

  // Noble Quarter (NW) and Rosewall Homes (NE): three rows each
  const noble = ['a_manor_blue_a', 'a_house_blue_a', 'a_manor_blue_b', 'a_hall_blue', 'a_house_blue_b', 'a_manor_blue_c', 'a_house_blue_c'];
  const red = ['a_house_red_a', 'a_house_red_b', 'a_house_red_c', 'a_house_red_tower'];
  [26, 36, 45].forEach((y, i) => { row(noble, COLS_W, y, { shift: i * 2, scale: 0.95 }); row(red, COLS_E, y, { shift: i, flip: true, scale: 0.95 }); });

  // Grand Bazaar (W): tents in rows on the square, the merchant's booth by the avenue
  const tents = ['a_tent_purple', 'a_tent_gold', 'a_tent_white', 'a_tent_gold_b', 'a_tent_red', 'a_tent_blue', 'a_tent_purple_b', 'a_tent_red_b', 'a_tent_yellow', 'a_tent_red_c'];
  let k = 0;
  for (const y of [57, 62]) for (let x = 20; x <= 53; x += 4) bld(tents[k++ % tents.length], x, y, 1, { depth: 1, scale: 0.75 });
  for (let x = 20; x <= 44; x += 4) bld(tents[k++ % tents.length], x, 78, 1, { depth: 1, scale: 0.75 });
  bld('a_stall_house', 50, 72, 1, { depth: 1, scale: 0.8 });
  b.prop('a_crate', 47, 73, { solid: true, scale: 0.7 }); b.prop('a_barrel', 53, 73, { solid: true, scale: 0.7 });

  // Guild Quarter (E): the Adventurer Guild hall on the avenue, the cathedral and the dome behind
  bld('a_guild_hall', 123, 61, 9, { scale: 0.8, depth: 3, light: { r: 100, color: '#ffc870', a: 0.5, oy: -40 } });
  for (const x of [113, 133]) b.prop('a_banner_stand_b', x, 62, { solid: true, scale: 0.8 });
  bld('a_cathedral', 113, 84, 5, { scale: 0.75, depth: 3 });
  bld('a_dome_blue', 134, 84, 5, { scale: 0.75, depth: 3 });

  // Forge Row (W, lower): three forges, embers
  for (const [n, x] of [['a_forge_a', 23], ['a_forge_b', 37], ['a_forge_c', 50]]) bld(n, x, 93, 5, { scale: 0.75, depth: 3, light: { r: 80, color: '#ff7a30', a: 0.8, flicker: true, oy: -30 } });
  // crystal shrines either side of the avenue
  b.prop('a_cry_blue', 66, 90, { solid: true, scale: 0.75, light: { r: 90, color: '#7ab8ff', a: 0.55, oy: -40, flicker: true } });
  b.prop('a_cry_purple', 94, 90, { solid: true, scale: 0.75, light: { r: 90, color: '#b070ff', a: 0.5, oy: -40, flicker: true } });

  // Hall of Records (E, lower): the round hall + houses (south of the cathedral row)
  row(['a_house_blue_a', 'a_manor_blue_b'], [124, 138], 94, { scale: 0.75 });
  bld('a_arena_hall', 111, 94, 5, { scale: 0.6, depth: 3 });

  // Old Quarter (SW): ruins and the old colosseum
  bld('a_ruin_court', 44, 119, 5, { scale: 0.85, depth: 3 });
  bld('a_ruin_tower_a', 23, 111, 3, { scale: 0.7 });
  bld('a_ruin_tower_b', 25, 128, 3, { scale: 0.7 });
  bld('a_ruin_keep_a', 33, 107, 3, { scale: 0.7 });
  bld('a_ruin_keep_c', 52, 107, 5, { scale: 0.65 });
  bld('a_ruin_gatehouse', 44, 131, 5, { depth: 1, scale: 0.55 });
  // Greenroof Lane (SE): green homes, three rows
  const green = ['a_houses_green', 'a_house_green_a', 'a_house_green_b', 'a_house_green_c', 'a_house_green_d', 'a_house_green_e'];
  [107, 117, 127].forEach((y, i) => row(green, COLS_E, y, { shift: i * 2, scale: 0.95 }));
  // Fountain Garden: flowers, trees and a statue on both sides of the avenue
  b.prop('a_statue_s', 70, 110, { solid: true, scale: 0.8 }); b.prop('a_statue_s', 90, 110, { solid: true, flip: true, scale: 0.8 });
  for (const [x, y] of [[67, 104], [93, 104], [67, 116], [93, 116], [64, 110], [96, 110]]) b.prop(r.pick(['a_tree_c', 'a_tree_d', 'a_tree_e']), x, y, { solid: true, scale: 0.8 });

  // avenue lamps
  for (let y = 36; y <= 128; y += 8) { if (Math.abs(y - 67) < 14 || (y > 45 && y < 54)) continue; lamp(75, y); lamp(85, y); }
  for (let x = 20; x <= 140; x += 10) { if (Math.abs(x - 80) < 16) continue; lamp(x, 63, '#ffd890'); }

  // greenery on the grass left inside the blocks (never in front of a lane), the forest outside the moat
  const clear = [[...P.plaza, 15], [...P.keep, 12], [80, 145, 6]];
  const greens = ['a_bush_a', 'a_bush_b', 'a_tree_f', 'a_tree_g', 'a_tree_c', 'a_tree_d'];
  for (let n = 0, guard = 0; n < 140 && guard < 5000; guard++) {
    const x = r.int(17, 143), y = r.int(17, 132);
    if (m.get(x, y) !== G || m.get(x, y + 1) === C || m.blocker[m.idx(x, y)] || clear.some(([cx, cy, rr]) => Math.hypot(x - cx, y - cy) < rr)) continue;
    n++;
    b.prop(r.pick(greens), x, y, { solid: true, scale: 0.7, flip: r.chance(0.5) });
  }
  // the forest ring outside the moat (tries only there, so it fills up; the south road stays clear)
  for (let n = 0, guard = 0; n < 200 && guard < 6000; guard++) {
    const side = r.int(0, 3), x = side === 0 ? r.int(2, 7) : side === 1 ? r.int(153, m.w - 3) : r.int(2, m.w - 3), y = side < 2 ? r.int(2, m.h - 3) : side === 2 ? r.int(2, 7) : r.int(143, m.h - 3);
    if (m.get(x, y) !== G || Math.abs(x - 80) < 6 || m.blocker[m.idx(x, y)]) continue;
    n++;
    b.prop(r.pick(['a_pine_a', 'a_pine_b', 'a_pine_c', 'a_pine_d', 'a_tree_tall_a', 'a_tree_tall_b', 'a_tree_pine_s']), x, y, { solid: true, scale: 0.75, flip: r.chance(0.5) });
  }
  for (const [n, x, y] of [['a_cry_purple', 12, 150], ['a_cry_green', 148, 150], ['a_cry_red', 5, 20], ['a_cry_violet', 154, 20]]) b.prop(n, x, y, { solid: true, scale: 0.6, light: { r: 70, color: '#9ab8ff', a: 0.45, oy: -30 } });
  b.light(...P.plaza, 180, '#bcd8ff', { a: 0.3 });
  b.regions.playerSpawn = { x: 80.5 * TILE, y: 150 * TILE };
}
