import { T, Z, TILE, SOLID_TILES } from '../core/constants.js';

// A3 — RUNE CITADEL terrain (grid `citadel`, 168 × 208 = the A1 scale). After the owner's reference
// (desgin/Map/Ref/a3 "RUINS OF ASTERIA") with the owner's A3 art: ground = tile skin 'citadel', props = 'c_*'.
// A walled city on a street grid: a main avenue north, cross streets, two side avenues and a canal (bridged where
// the streets cross). Districts on the plazas; building props fill the blocks in between (solid), leaving alleys.
//   main route : Gate Ward (south) -> Winged Plaza (the statue) -> Golden Gate -> Sanctum (A3 Major Boss: the Rune Knight)
//   side routes: Market Square · Lamplight Row · Crystal Shrine (purple, corrupted) · Well Court · Archive Ruins ·
//                Bronze Barracks (hoplite formations)
const C = T.COBBLE, D = T.DIRT, G = T.GRASS, R = T.RUIN, A = T.ARENA;

export const CITADEL_PLACES = {
  gate: [84, 196], market: [46, 184], lamplight: [122, 184], winged: [84, 114], well: [122, 114], shrine: [46, 114],
  archive: [46, 78], barracks: [122, 78], golden: [84, 56], sanctum: [84, 24],
};
const BUILDINGS = ['c_tower_a', 'c_tower_b', 'c_tower_c', 'c_tower_d', 'c_tower_e', 'c_tower_f', 'c_house_a', 'c_house_b', 'c_house_c',
  'c_house_d', 'c_house_e', 'c_house_f', 'c_house_g', 'c_house_h', 'c_house_i', 'c_house_j', 'c_wall_a', 'c_wall_b', 'c_wall_c', 'c_wall_d'];

export function buildRuneCitadelTerrain(b) {
  const m = b.m, P = CITADEL_PLACES, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, T.CLIFF);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.CITADEL);
  const S = (name, extra = {}) => m.addSubArea({ name, zone: Z.CITADEL, ...extra });
  const AR = {
    gate: S('Gate Ward'), market: S('Market Square'), lamplight: S('Lamplight Row'), winged: S('Winged Plaza'), well: S('Well Court'),
    shrine: S('Crystal Shrine'), archive: S('Archive Ruins'), barracks: S('Bronze Barracks'), golden: S('Golden Gate'),
  };

  // ---------------- the walled city: ground, grass patches, streets
  b.rect(16, 50, 152, 204, D);
  for (let i = 0; i < 70; i++) b.disc(r.int(20, 148), r.int(54, 200), r.range(1.5, 3.5), G, { only: [D], noise: 1 });
  const streets = [
    [81, 46, 87, 205], [44, 58, 48, 200], [120, 58, 124, 200],            // main avenue + side avenues (north-south)
    [20, 168, 148, 172], [18, 130, 150, 134], [20, 94, 148, 98], [36, 62, 132, 66], // cross streets
  ];
  // canal across the lower city; the streets bridge it
  for (let x = 16; x <= 152; x++) { m.set(x, 148, T.SHALLOW); m.set(x, 149, T.WATER); m.set(x, 150, T.WATER); m.set(x, 151, T.SHALLOW); }
  for (const [x0, y0, x1, y1] of streets) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = m.get(x, y);
    m.set(x, y, t === T.WATER || t === T.SHALLOW ? T.BRIDGE : C);
  }
  // plazas / districts
  b.disc(...P.gate, 8, C); b.disc(...P.market, 9, C); b.disc(...P.lamplight, 8, C);
  b.disc(...P.winged, 12, A, { noise: 0.5 }); b.disc(...P.well, 8, R); b.disc(...P.shrine, 8, T.CORRUPT, { noise: 1.2 });
  b.disc(...P.archive, 10, R, { noise: 1.5 }); b.disc(...P.barracks, 10, R, { noise: 1 }); b.disc(...P.golden, 8, A, { noise: 0.5 });
  const subs = { gate: 10, market: 11, lamplight: 10, winged: 14, well: 10, shrine: 10, archive: 12, barracks: 12, golden: 9 };
  for (const [k, rr] of Object.entries(subs)) b.subDisc(P[k][0], P[k][1], rr, AR[k]);

  // ---------------- the Sanctum (A3 boss arena, zone SANCTUM = map 'sanctum', maps/sanctum.js): behind the Golden Gate
  b.disc(P.sanctum[0], P.sanctum[1], 16, A, { noise: 0.4 });
  b.rect(81, 40, 87, 45, C);
  for (let y = 0; y <= 45; y++) for (let x = 56; x <= 112; x++) m.zone[m.idx(x, y)] = Z.SANCTUM;
  b.rect(80, 46, 88, 47, T.RUIN_WALL); // the Golden Gate's wall: the way in is the gate itself (exit golden_gate, maps/fieldA3.js)
  // the Sanctum floor: a rune circle under the arena, blue lamps on the rim
  b.prop('c_plaza_ring', P.sanctum[0], P.sanctum[1] + 3, { layer: 'ground', scale: 1.4 });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3; if (Math.abs(a - Math.PI / 2) < 0.4) continue; const x = P.sanctum[0] + Math.cos(a) * 15.5, y = P.sanctum[1] + Math.sin(a) * 15.5; b.prop('c_lamp_d', x, y, { solid: true }); b.light(x, y - 1, 70, '#8ab8ff', { a: 0.5, flicker: true }); }

  // ---------------- landmarks
  b.prop('c_statue_plaza', P.winged[0], P.winged[1] + 2, { layer: 'ground', scale: 0.9 });
  b.prop('c_obelisk_s', P.winged[0], P.winged[1] - 1, { solid: true });
  b.prop('c_gold_gate', P.golden[0], 48, { solid: true, footprint: [[-3, 0], [-2, 0], [2, 0], [3, 0]], light: { r: 90, color: '#ffcf6a', a: 0.6, oy: -50 } });
  b.prop('c_crystal_shrine', P.shrine[0], P.shrine[1], { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], light: { r: 90, color: '#b070ff', a: 0.6, oy: -30 } });
  b.prop('c_crystal_spire', P.shrine[0] - 6, P.shrine[1] - 4, { solid: true, light: { r: 60, color: '#b070ff', a: 0.5, oy: -30 } });
  b.prop('c_pit', P.well[0], P.well[1] + 3, { layer: 'ground', scale: 0.8 });
  b.prop('c_chapel', P.archive[0], P.archive[1] - 8, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] });
  b.prop('c_dome', P.barracks[0], P.barracks[1] - 8, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] });
  b.prop('c_banner_arch', P.gate[0], P.gate[1] - 8, {});
  for (const [n, x, y] of [['c_tent_a', 40, 180], ['c_tent_b', 52, 180], ['c_tent_c', 40, 188], ['c_stall', 52, 188], ['c_crates', 46, 192]]) b.prop(n, x, y, { solid: true });
  for (const [n, x, y] of [['c_stair_ruin', 40, 72], ['c_ruin_c', 52, 84], ['c_fall_b', 36, 84], ['c_wall_long', 54, 72], ['c_pool_ruin', 116, 88], ['c_gate_a', 128, 70], ['c_gate_b', 116, 70]]) b.prop(n, x, y, { solid: true });
  for (const [x, y] of [[116, 122], [128, 122], [116, 106], [128, 106]]) b.prop('c_wall_banner', x, y, { solid: true });

  // ---------------- blue rune lamps along the avenue, purple at the shrine, gold at the gate
  for (let y = 60; y <= 200; y += 10) for (const x of [79, 89]) { if (y > 146 && y < 153) continue; b.prop(y % 20 ? 'c_lamp_c' : 'c_lamp_d', x, y, { solid: true }); b.light(x, y - 1, 70, '#8ab8ff', { a: 0.5, flicker: true }); }
  b.light(P.winged[0], P.winged[1], 160, '#9ab8ff', { a: 0.3 });
  b.light(P.shrine[0], P.shrine[1], 120, '#b070ff', { a: 0.45, flicker: true });

  // ---------------- the city blocks: buildings on the open ground (never on streets, plazas or the canal)
  const open = new Set([D, G]);
  const clear = [...Object.values(P).map(([x, y]) => [x, y, 12]), [84, 150, 4]];
  for (let ty = 52; ty <= 200; ty += 4) for (let tx = 18; tx <= 150; tx += 4) {
    const x = tx + r.int(-1, 1), y = ty + r.int(-1, 1);
    if (!open.has(m.get(x, y)) || !open.has(m.get(x - 1, y)) || !open.has(m.get(x + 1, y))) continue;
    if (clear.some(([cx, cy, rr]) => Math.hypot(x - cx, y - cy) < rr)) continue;
    let nearStreet = false;
    for (let dy = -2; dy <= 1 && !nearStreet; dy++) for (let dx = -2; dx <= 2; dx++) if (m.get(x + dx, y + dy) === C || m.get(x + dx, y + dy) === T.BRIDGE) { nearStreet = true; break; }
    if (nearStreet || !r.chance(0.7)) continue;
    b.prop(r.pick(BUILDINGS), x, y, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], flip: r.chance(0.5) });
  }
  // ruin details + plants in the alleys
  b.scatter(18, 52, 150, 202, ['c_bush_a', 'c_bush_b', 'c_bush_c', 'c_bush_d', 'c_debris', 'c_rubble_a', 'c_ruin_s', 'c_lamp_a', 'c_lamp_b'], 150, { on: [D, G, R], minGap: 3, keepClear: clear.map(([x, y]) => [x, y, 5]) });
  b.scatter(18, 52, 150, 202, ['c_grass_patch', 'c_bush_wide', 'c_bush_e', 'c_dead_tree_b', 'c_rock_a'], 50, { on: [D, G], minGap: 6, keepClear: clear });
  b.scatter(18, 52, 150, 202, ['c_dead_tree', 'c_tree_s'], 20, { on: [G], solid: true, minGap: 8, keepClear: clear });
  // the city wall: rock and towers just outside the walkable city
  for (let ty = 2; ty < m.h - 2; ty++) for (let tx = 2; tx < m.w - 2; tx++) {
    if (m.get(tx, ty) !== T.CLIFF || m.zone[m.idx(tx, ty)] !== Z.CITADEL || !r.chance(0.05)) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (!SOLID_TILES.has(m.get(tx + dx, ty + dy))) { near = true; break; }
    if (near) b.prop(r.pick(['c_tower_a', 'c_tower_c', 'c_wall_a', 'c_wall_c', 'c_rock_spire']), tx, ty, { flip: r.chance(0.5) });
  }
  b.regions.playerSpawn = { x: 84.5 * TILE, y: 198 * TILE };
}
