import { T, Z, TILE } from '../core/constants.js';

// CITY 2 — ASTERIA CITY terrain (grid `asteria`, 112 × 112). City rework (owner 2026-10-13): a compact online HUB with the
// owner's city art (ground = tile skin 'asteria', props = 'a_*'; the sheet is extracted at full size, scales here are final).
// A walled city inside a moat, NO road exits: the Dungeon Gate north of the fountain is the only way out (maps/city2.js);
// the boss roads from the Sanctum (Route A) / the Summit (Route B) arrive inside the closed South / East gates.
//   centre : CRYSTAL PLAZA — fountain, Dungeon Gate, waystone, storage: everyone meets here
//   ring   : services within ~16 tiles — Grand Bazaar (W) · Forge Row (SW) · Adventurer Guild (E) · Hall of Records (SE)
//   outside: Asteria Keep (N) · Noble Quarter (NW) · Rosewall Homes (NE) · Old Quarter ruins (SW) · Greenroof Lane (SE)
const C = T.COBBLE, G = T.GRASS, A = T.ARENA, W = T.RUIN_WALL, F = T.FLOWERS;

export const ASTERIA_PLACES = {
  plaza: [56, 56], keep: [56, 18], noble: [24, 24], homes: [88, 24], bazaar: [24, 64], guild: [85, 48],
  forge: [30, 74], records: [72, 74], ruins: [24, 91], lane: [88, 90], south: [56, 96], east: [96, 56],
};
// the city wall (inside the moat); the gates are closed backdrops (arrivals land inside them)
export const ASTERIA_WALL = { x0: 8, y0: 8, x1: 103, y1: 103 };

export function buildAsteriaTerrain(b) {
  const m = b.m, P = ASTERIA_PLACES, K = ASTERIA_WALL, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, G);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.ASTERIA);
  const S = (name) => m.addSubArea({ name, zone: Z.ASTERIA });
  const AR = {
    plaza: S('Crystal Plaza'), keep: S('Asteria Keep'), noble: S('Noble Quarter'), homes: S('Rosewall Homes'), bazaar: S('Grand Bazaar'),
    guild: S('Guild Quarter'), forge: S('Forge Row'), records: S('Hall of Records'), ruins: S('Old Quarter'), lane: S('Greenroof Lane'),
    south: S('South Gate'), east: S('East Gate'),
  };

  // ---------------- moat + wall (closed all round), cliffs on the grid edge
  b.rect(3, 3, m.w - 4, m.h - 4, T.WATER);
  b.rect(4, 4, m.w - 5, m.h - 5, T.SHALLOW);
  b.rect(6, 6, m.w - 7, m.h - 7, G);
  for (let x = K.x0; x <= K.x1; x++) for (const y of [K.y0, K.y0 + 1, K.y1 - 1, K.y1]) m.set(x, y, W);
  for (let y = K.y0; y <= K.y1; y++) for (const x of [K.x0, K.x0 + 1, K.x1 - 1, K.x1]) m.set(x, y, W);
  b.rect(0, 0, m.w - 1, 0, T.CLIFF); b.rect(0, m.h - 1, m.w - 1, m.h - 1, T.CLIFF);
  b.rect(0, 0, 0, m.h - 1, T.CLIFF); b.rect(m.w - 1, 0, m.w - 1, m.h - 1, T.CLIFF);

  // ---------------- streets: two avenues crossing at the plaza, a ring of side streets, the canal in the north
  const streets = [
    [54, 10, 58, 101], [10, 54, 101, 58],     // avenues
    [10, 34, 101, 35], [10, 79, 101, 80],     // cross streets
    [35, 10, 36, 101], [76, 10, 77, 101],     // side streets
  ];
  for (let x = 10; x <= 101; x++) for (const y of [30, 31]) m.set(x, y, T.WATER);
  for (const [x0, y0, x1, y1] of streets) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, m.get(x, y) === T.WATER ? T.BRIDGE : C);
  b.disc(...P.plaza, 12, A, { noise: 0.3 });
  b.rect(42, 10, 70, 24, A);                  // keep court
  b.rect(10, 60, 33, 69, C);                  // bazaar square
  b.disc(...P.ruins, 9, T.MOSS_STONE, { noise: 1.4 });
  b.disc(56, 89, 5, F, { noise: 1 });         // fountain garden on the south avenue
  const subs = { plaza: 13, noble: 14, homes: 14, bazaar: 12, guild: 11, forge: 10, records: 10, ruins: 12, lane: 13, south: 7, east: 7 };
  for (const [k, rr] of Object.entries(subs)) b.subDisc(P[k][0], P[k][1], rr, AR[k]);
  b.subRect(42, 10, 70, 26, AR.keep);

  // ---------------- props
  const bld = (name, x, y, w = 3, opts = {}) => {
    const fp = [];
    for (let dx = -Math.floor(w / 2); dx <= Math.floor(w / 2); dx++) for (let dy = -(opts.depth || 2) + 1; dy <= 0; dy++) fp.push([dx, dy]);
    return b.prop(name, x, y, { solid: true, footprint: fp, ...opts });
  };
  const lamp = (x, y, color = '#9ac8ff') => { b.prop('a_lamp_a', x, y, { solid: true, scale: 0.7 }); b.light(x, y - 1, 64, color, { a: 0.5, flicker: true }); };
  const row = (names, xs, y, opts = {}) => {
    for (let x = xs[0] - 3; x <= xs[xs.length - 1] + 3; x++) if (m.get(x, y + 1) === G) m.set(x, y + 1, C);
    xs.forEach((x, i) => bld(names[(i + (opts.shift || 0)) % names.length], x, y, opts.w || 5, { scale: opts.scale || 0.9, depth: opts.depth || 3, flip: opts.flip ? r.chance(0.5) : false }));
  };

  // the wall: corner towers, towers along the sides, wall pieces, the two closed gates
  for (const [x, y] of [[K.x0 + 1, K.y0 + 1], [K.x1 - 1, K.y0 + 1], [K.x0 + 1, K.y1], [K.x1 - 1, K.y1]]) b.prop('a_tower_round', x, y, { scale: 0.8 });
  for (let x = K.x0 + 5; x <= K.x1 - 4; x += 4) {
    if (Math.abs(x - 56) > 6) b.prop(x % 8 ? 'a_wall_a' : 'a_wall_b', x, K.y1, {});
    b.prop(x % 16 === 0 ? 'a_wall_gate' : 'a_wall_a', x, K.y0 + 1, {});
  }
  for (let y = K.y0 + 8; y <= K.y1 - 6; y += 8) for (const x of [K.x0 + 1, K.x1 - 1]) { if (x > 56 && Math.abs(y - 56) < 7) continue; b.prop(y % 16 ? 'a_tower_thin' : 'a_tower_b', x, y, { scale: 0.8 }); }
  b.prop('a_castle_gate', 56, K.y1, { light: { r: 100, color: '#ffc870', a: 0.6, oy: -60 } }); // South Gate (Route A arrives here)
  for (const x of [50, 62]) b.prop('a_banner_stand_c', x, 99, { solid: true, scale: 0.8 });
  for (const y of [51, 62]) b.prop('a_tower_round', K.x1, y, { scale: 0.8 });                 // East Gate (Route B arrives here)
  for (const y of [52, 61]) b.prop('a_banner_stand_a', K.x1 - 4, y, { solid: true, scale: 0.8 });

  // Asteria Keep (north)
  bld('a_castle_blue', 56, 20, 7, { scale: 1.15, depth: 3 });
  bld('a_keep_blue', 45, 19, 3, { scale: 0.8 });
  bld('a_keep_blue', 67, 19, 3, { scale: 0.8, flip: true });
  for (const x of [50, 62]) b.prop('a_banner_stand_a', x, 24, { solid: true, scale: 0.8 });
  bld('a_chapel_blue', 45, 42, 3, { scale: 0.8 });
  bld('a_spire_blue', 67, 42, 3, { scale: 0.8 });

  // CRYSTAL PLAZA: fountain, lamps, benches (Dungeon Gate / waystone / storage = maps/city2.js content)
  bld('a_crystal_fountain', ...P.plaza, 5, { depth: 2, scale: 0.8, light: { r: 150, color: '#7ab8ff', a: 0.6, oy: -60, flicker: true } });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    lamp(Math.round(P.plaza[0] + Math.cos(a) * 10), Math.round(P.plaza[1] + Math.sin(a) * 10));
  }
  for (const [x, y] of [[49, 51], [63, 51], [49, 61], [63, 61]]) b.prop('a_bench', x, y, { scale: 0.7 });
  b.prop('a_crate', 62, 64, { solid: true, scale: 0.7 });

  // Noble Quarter (NW) + Rosewall Homes (NE)
  const noble = ['a_manor_blue_a', 'a_house_blue_a', 'a_manor_blue_b', 'a_hall_blue', 'a_house_blue_b', 'a_manor_blue_c'];
  const red = ['a_house_red_a', 'a_house_red_b', 'a_house_red_c', 'a_house_red_tower'];
  [19, 27].forEach((y, i) => { row(noble, [15, 22, 29], y, { shift: i * 2 }); row(red, [83, 90, 97], y, { shift: i, flip: true }); });
  row(noble, [15, 22, 29], 46, { shift: 3 });
  row(red, [83, 90, 97], 40, { shift: 2 });

  // Grand Bazaar (W of the plaza): tents on the square, the merchant's booth
  const tents = ['a_tent_purple', 'a_tent_gold', 'a_tent_white', 'a_tent_gold_b', 'a_tent_red', 'a_tent_blue', 'a_tent_purple_b', 'a_tent_red_b', 'a_tent_yellow'];
  let k = 0;
  for (const y of [63, 68]) for (let x = 13; x <= 31; x += 4) bld(tents[k++ % tents.length], x, y, 1, { depth: 1, scale: 0.75 });
  bld('a_stall_house', 42, 61, 1, { depth: 1, scale: 0.8 });
  b.prop('a_barrel', 45, 62, { solid: true, scale: 0.7 });

  // Adventurer Guild (E of the plaza)
  bld('a_guild_hall', 85, 49, 9, { scale: 0.75, depth: 3, light: { r: 100, color: '#ffc870', a: 0.5, oy: -40 } });
  for (const x of [79, 91]) b.prop('a_banner_stand_b', x, 51, { solid: true, scale: 0.8 });
  bld('a_cathedral', 92, 70, 5, { scale: 0.7, depth: 3 });

  // Forge Row (SW) + Hall of Records (SE)
  for (const [n, x] of [['a_forge_a', 16], ['a_forge_b', 24], ['a_forge_c', 44]]) bld(n, x, 76, 5, { scale: 0.7, depth: 3, light: { r: 80, color: '#ff7a30', a: 0.8, flicker: true, oy: -30 } });
  bld('a_arena_hall', 68, 74, 5, { scale: 0.55, depth: 3 });
  bld('a_dome_blue', 86, 76, 5, { scale: 0.65, depth: 3 });
  b.prop('a_cry_blue', 48, 72, { solid: true, scale: 0.7, light: { r: 90, color: '#7ab8ff', a: 0.55, oy: -40, flicker: true } });
  b.prop('a_cry_purple', 64, 85, { solid: true, scale: 0.7, light: { r: 90, color: '#b070ff', a: 0.5, oy: -40, flicker: true } });

  // Old Quarter (SW) + Greenroof Lane (SE)
  bld('a_ruin_court', 24, 92, 5, { scale: 0.75, depth: 3 });
  bld('a_ruin_tower_a', 14, 86, 3, { scale: 0.65 });
  bld('a_ruin_keep_a', 30, 99, 3, { scale: 0.6 });
  const green = ['a_houses_green', 'a_house_green_a', 'a_house_green_b', 'a_house_green_c', 'a_house_green_d', 'a_house_green_e'];
  [88, 97].forEach((y, i) => row(green, [83, 90, 97], y, { shift: i * 2 }));
  // fountain garden: statues + trees on the south avenue
  b.prop('a_statue_s', 50, 89, { solid: true, scale: 0.8 }); b.prop('a_statue_s', 62, 89, { solid: true, flip: true, scale: 0.8 });
  for (const [x, y] of [[48, 84], [64, 93], [48, 93]]) b.prop(r.pick(['a_tree_c', 'a_tree_d', 'a_tree_e']), x, y, { solid: true, scale: 0.8 });

  // avenue lamps
  for (let y = 28; y <= 100; y += 8) { if (Math.abs(y - 56) < 14) continue; lamp(53, y); lamp(59, y); }
  for (let x = 14; x <= 100; x += 10) { if (Math.abs(x - 56) < 14) continue; lamp(x, 53, '#ffd890'); }

  // greenery on the grass inside the blocks, pines outside the moat
  const clear = [[...P.plaza, 14], [...P.keep, 10], [...P.south, 5], [...P.east, 5]];
  const greens = ['a_bush_a', 'a_bush_b', 'a_tree_f', 'a_tree_g', 'a_tree_c', 'a_tree_d'];
  for (let n = 0, guard = 0; n < 70 && guard < 4000; guard++) {
    const x = r.int(11, 100), y = r.int(11, 100);
    if (m.get(x, y) !== G || m.get(x, y + 1) === C || m.blocker[m.idx(x, y)] || clear.some(([cx, cy, rr]) => Math.hypot(x - cx, y - cy) < rr)) continue;
    n++;
    b.prop(r.pick(greens), x, y, { solid: true, scale: 0.7, flip: r.chance(0.5) });
  }
  const pines = ['a_pine_a', 'a_pine_b', 'a_pine_c', 'a_tree_pine_s'];
  for (let x = 2; x <= m.w - 3; x += 3) for (const y of [2, m.h - 2]) b.prop(r.pick(pines), x, y, { solid: true, scale: 0.7, flip: r.chance(0.5) });
  for (let y = 5; y <= m.h - 5; y += 3) for (const x of [1, m.w - 2]) b.prop(r.pick(pines), x, y, { solid: true, scale: 0.7, flip: r.chance(0.5) });
  b.light(...P.plaza, 180, '#bcd8ff', { a: 0.3 });
  b.regions.playerSpawn = { x: 56.5 * TILE, y: 66 * TILE };
}
