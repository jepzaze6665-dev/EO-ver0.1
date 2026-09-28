import { T, Z, TILE, SOLID_TILES } from '../core/constants.js';

// B1 — FROSTWIND PLAINS terrain (grid `frostwind`, 168 × 208 = the A1 scale). After the owner's reference
// (desgin/Map/Ref/b/b1 "FROSTWIND PLAINS", 1280 px -> x × 0.131, y × 0.1625) with the owner's B1 art: ground = tile
// skin 'frost' (snow, packed-snow roads, lake ice), props = 'f_*'.
//   main route : Hunter's Lodge (NW, the Eastern Road from Lumina) -> Frostwind Crossroads -> Old Watchtower (N) ·
//                Nomad Camp (E) -> down the east bank -> FROST ARENA (SE, the B1 boss, sealed until its fight exists)
//   sides      : Trapper's Ruins (W) · Crystal Ridge (NE) · the FROZEN MERE (a walkable ice lake with open holes) ·
//                Rimewater river + bridge · Ice Shrine (SW) · Icebound Cave (S, secret slot)
const G = T.GRASS, D = T.DIRT, F = T.FLOWERS;

export const FROST_PLACES = {
  lodge: [20, 20], tower: [89, 26], crystals: [115, 16], cave_ne: [133, 30], trapper: [35, 62], cross: [81, 57],
  camp: [144, 63], mine: [142, 86], mere: [56, 122], bridge: [94, 150], shrine: [21, 156], cave_s: [71, 188],
  arena: [142, 146],
};
export const FROST_ARENA = { center: [142, 146], r: 17 };

export function buildFrostwindTerrain(b) {
  const m = b.m, P = FROST_PLACES, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, T.CLIFF);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.FROSTWIND);
  const S = (name) => m.addSubArea({ name, zone: Z.FROSTWIND });
  const AR = {
    lodge: S("Hunter's Lodge"), tower: S('Old Watchtower'), crystals: S('Crystal Ridge'), trapper: S("Trapper's Ruins"),
    cross: S('Frostwind Crossroads'), camp: S('Nomad Camp'), mine: S('Frozen Mine'), mere: S('Frozen Mere'),
    river: S('Rimewater'), shrine: S('Ice Shrine'),
  };

  // ---------------- the snowfield inside the mountain ring: nearly square like the reference, a ragged rock border
  b.rect(7, 7, m.w - 8, m.h - 8, G);
  for (let i = 0; i < 170; i++) {
    const side = r.int(0, 3), t = r.range(0, 1), rr = r.range(2, 6);
    const x = side === 0 ? 7 : side === 1 ? m.w - 8 : 7 + t * (m.w - 15), y = side === 2 ? 7 : side === 3 ? m.h - 8 : 7 + t * (m.h - 15);
    b.disc(Math.round(x), Math.round(y), rr, T.CLIFF, { noise: 1 }); // whole-tile centre (disc walks from it)
  }
  for (const [x, y, rr] of [[18, 22, 11], [81, 57, 8]]) b.disc(x, y, rr, G, { noise: 1.5 }); // the lodge's clearing, the crossroads
  // cliff islands inside the field (like the reference's rock ridges)
  for (const [x, y, rx, ry] of [[62, 70, 5, 3], [44, 92, 7, 3], [118, 104, 8, 3], [100, 118, 4, 7], [70, 176, 7, 5], [130, 22, 5, 4], [150, 40, 4, 6]])
    b.ellipse(x, y, rx, ry, T.CLIFF, { noise: 1 });
  for (let i = 0; i < 40; i++) b.disc(r.int(12, 156), r.int(12, 196), r.range(1.5, 3.5), F, { only: [G], noise: 1 });

  // ---------------- the Frozen Mere: walkable lake ice, open water holes, ice floes along the shore
  b.ellipse(P.mere[0], P.mere[1], 30, 33, T.ICE, { noise: 2.2 });
  b.ellipse(P.mere[0] + 16, P.mere[1] - 12, 12, 10, T.ICE, { noise: 1.5 });
  for (const [x, y, rr] of [[44, 110, 4], [62, 128, 5], [50, 140, 3.5], [70, 108, 3], [38, 128, 3]]) b.disc(x, y, rr, T.DEEP_WATER, { noise: 0.8 });
  // ---------------- Rimewater: from the north-east ridge down to the south edge, frozen where it meets the mere
  b.line([[108, 80], [102, 96], [98, 112], [96, 128], [94, 150], [100, 168], [106, 186], [108, 200]], 4, T.WATER, { noise: 0.8 });
  b.line([[108, 80], [102, 96], [98, 112]], 5.6, T.SHALLOW, { only: [G, F], noise: 0.6 });
  b.line([[98, 112], [84, 116]], 5, T.ICE, { noise: 0.5 }); // the river freezes into the mere: a crossing on the ice
  for (let y = 147; y <= 153; y++) for (let x = 88; x <= 100; x++) if (m.get(x, y) === T.WATER || m.get(x, y) === T.SHALLOW) m.set(x, y, T.BRIDGE);

  // ---------------- roads (packed snow)
  b.line([[4, 20], [20, 22], [34, 32], [56, 46], [72, 54], [81, 57]], 3, D);          // the Eastern Road -> crossroads
  b.line([[81, 57], [86, 44], [89, 30]], 2.6, D);                                      // up to the watchtower
  b.line([[81, 57], [100, 60], [120, 62], [138, 63]], 2.6, D);                         // east to the nomad camp
  b.line([[81, 57], [60, 60], [42, 62]], 2.2, D);                                      // west to the trapper's ruins
  b.line([[120, 62], [124, 78], [120, 92], [126, 108], [140, 124]], 2.8, D);           // down the east bank to the arena
  b.line([[94, 150], [110, 160], [126, 166]], 2.4, D);                                 // bridge -> arena's south side
  b.line([[81, 57], [72, 72], [66, 86]], 2.2, D);                                      // crossroads -> the mere shore
  b.line([[22, 150], [30, 140], [34, 128]], 2, D);                                     // shrine path

  // ---------------- the FROST ARENA (B1 boss, SE): a round ice floor inside a ring of rock, stairs north + south
  const [ax, ay] = FROST_ARENA.center, AR_R = FROST_ARENA.r;
  b.disc(ax, ay, AR_R + 3, T.CLIFF, { noise: 0.4 });
  b.disc(ax, ay, AR_R, T.ARENA, { noise: 0.2 });
  for (let y = ay - AR_R - 4; y <= ay - AR_R + 1; y++) for (let x = ax - 2; x <= ax + 2; x++) m.set(x, y, T.STAIRS);
  for (let y = ay + AR_R - 1; y <= ay + AR_R + 4; y++) for (let x = ax - 2; x <= ax + 2; x++) m.set(x, y, T.STAIRS);
  b.line([[ax, ay + AR_R + 4], [138, 186], [134, 200], [134, 206]], 3, D);             // the road south (to B2, later)
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Math.hypot(x - ax, y - ay) <= AR_R + 5) m.zone[m.idx(x, y)] = Z.FROST_ARENA;
  b.prop('f_frost_arena', ax, ay + AR_R - 3, { layer: 'ground', scale: 3.4 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.93) continue; // leave the stairs open
    b.prop(i % 2 ? 'f_crystal_s' : 'f_ice_pillar', ax + Math.cos(a) * (AR_R + 1.5), ay + Math.sin(a) * (AR_R + 1.5), { solid: true });
  }
  b.light(ax, ay, 220, '#9ad0ff', { a: 0.25 });

  // ---------------- sub-areas
  const subs = { lodge: 12, tower: 10, crystals: 10, trapper: 11, cross: 9, camp: 11, mine: 8, shrine: 10 };
  for (const [k, rr] of Object.entries(subs)) b.subDisc(P[k][0], P[k][1], rr, AR[k]);
  b.subDisc(P.mere[0], P.mere[1], 32, AR.mere);
  b.subRect(94, 80, 110, 200, AR.river);

  // ---------------- landmarks
  b.prop('f_lodge', P.lodge[0], P.lodge[1], { solid: true, footprint: [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1]], light: { r: 90, color: '#ffb060', a: 0.55, oy: -40 } });
  b.prop('f_palisade', 30, 27, { solid: true }); b.prop('f_fence_gate', 24, 29, {});
  b.prop('f_banner_a', 12, 25, { solid: true }); b.prop('f_sign', 8, 23, { solid: true });
  b.prop('f_tower_a', P.tower[0], P.tower[1], { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('f_ruin_block', P.tower[0] + 5, P.tower[1] + 2, { solid: true });
  for (const [n, x, y] of [['f_crystal_big', 115, 16], ['f_crystal_a', 120, 20], ['f_crystal_b', 108, 14], ['f_crystal_m', 111, 21], ['f_crystal_big', 55, 76], ['f_crystal_a', 13, 84], ['f_crystal_rock', 17, 88], ['f_crystal_big', 44, 102], ['f_crystal_a', 76, 142]])
    b.prop(n, x, y, { solid: true, light: { r: 60, color: '#9ad0ff', a: 0.35, oy: -30 } });
  b.prop('f_cliff_cave', P.cave_ne[0], P.cave_ne[1], { solid: true, footprint: [[-3, 0], [-2, 0], [2, 0], [3, 0]] });
  b.prop('f_ruin_hall', P.trapper[0], P.trapper[1] - 2, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] });
  b.prop('f_ruin_ring', P.trapper[0] - 8, P.trapper[1] + 4, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('f_stakes', P.trapper[0] + 6, P.trapper[1] + 3, {});
  b.prop('f_camp', P.camp[0], P.camp[1], { solid: true, footprint: [[-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0]], light: { r: 90, color: '#ff9a40', a: 0.8, flicker: true, oy: -10 } });
  b.prop('f_crate', P.camp[0] - 6, P.camp[1] + 2, { solid: true }); b.prop('f_barrel', P.camp[0] + 6, P.camp[1] + 3, { solid: true });
  b.prop('f_house_ruin_b', P.mine[0], P.mine[1], { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] });
  b.prop('f_ice_shrine', P.shrine[0], P.shrine[1], { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]], light: { r: 110, color: '#8ad0ff', a: 0.6, flicker: true, oy: -40 } });
  for (const [x, y] of [[14, 150], [28, 150], [14, 162], [28, 162]]) b.prop('f_ice_pillar', x, y, { solid: true });
  b.prop('f_cliff_cave', P.cave_s[0], P.cave_s[1] - 3, { solid: true, footprint: [[-3, 0], [-2, 0], [2, 0], [3, 0]] });
  b.prop('f_sign', 83, 60, { solid: true });
  b.prop('f_ice_altar', 58, 120, { solid: true, light: { r: 80, color: '#9ad0ff', a: 0.5, oy: -20 } });
  for (const [n, x, y] of [['f_bones_a', 40, 60], ['f_bones_b', 128, 90], ['f_bones_c', 66, 150], ['f_logs', 150, 68], ['f_well', 26, 34]]) b.prop(n, x, y, {});

  // ---------------- snowy pines, dead trees, rocks (never on roads / ice / the arena)
  const clear = [...Object.values(P).map(([x, y]) => [x, y, 7]), [ax, ay, AR_R + 6]];
  b.scatter(10, 10, 158, 198, ['f_pine_a', 'f_pine_b', 'f_pine_c', 'f_pine_d', 'f_pine_e', 'f_pine_f', 'f_pine_big'], 260, { on: [G, F], solid: true, minGap: 3, keepClear: clear });
  b.scatter(10, 10, 158, 198, ['f_dead_tree', 'f_pine_dead', 'f_rock_a', 'f_rock_b', 'f_rock_c', 'f_rocks_b', 'f_rocks_c'], 60, { on: [G, F], solid: true, minGap: 6, keepClear: clear });
  b.scatter(10, 10, 158, 198, ['f_snow_bush_a', 'f_snow_bush_b', 'f_snow_rock_a', 'f_snow_rock_b', 'f_twig', 'f_bush'], 120, { on: [G, F], minGap: 3, keepClear: clear });
  // the mountain ring: rock props just outside the walkable field
  for (let ty = 2; ty < m.h - 2; ty++) for (let tx = 2; tx < m.w - 2; tx++) {
    if (m.get(tx, ty) !== T.CLIFF || m.zone[m.idx(tx, ty)] !== Z.FROSTWIND || !r.chance(0.07)) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (!SOLID_TILES.has(m.get(tx + dx, ty + dy))) { near = true; break; }
    if (near) b.prop(r.pick(['f_rocks_a', 'f_rocks_d', 'f_rocks_e', 'f_cliff_b', 'f_pine_big', 'f_pine_a']), tx, ty, { flip: r.chance(0.5) });
  }
  b.light(P.cross[0], P.cross[1], 140, '#cfe4ff', { a: 0.2 });
  b.regions.playerSpawn = { x: 8.5 * TILE, y: 21 * TILE };
}
