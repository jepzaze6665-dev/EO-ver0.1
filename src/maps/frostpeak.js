import { T, Z, TILE, SOLID_TILES } from '../core/constants.js';

// B3 — FROSTPEAK terrain (grid `frostpeak`, 168 × 208 = the A1 scale). After the owner's reference
// (desgin/Map/Ref/b/b3 "FROSTPEAK", 1280 px -> x × 0.131, y × 0.1625) with the owner's B3 art: ground = tile skin
// 'frostpeak' (deep snow, packed paths, fortress stone, glacier water, frozen ground, runes), props = 'p_*'.
// A mountain: rock everywhere, snow terraces joined by paths, bridges and stairs, the citadel on the summit.
//   main route : South Gate (from the Crystal Caverns' Abyssal Arch) -> Pinewood Slopes -> the Frozen Lakes (bridge) ->
//                Glacier Stairs -> Windcut Terrace -> the Summit Citadel (N — the B3 major boss, sealed until next phase)
//   sides      : Icebound Cave (W) · Crystal Plateau (W) · Hermit's Shrine (NW) · Nomad Camp (E) · Frost Fortress
//                gate (SE) · Eastern Switchback + Lookout Tower (NE)
const G = T.GRASS, D = T.DIRT, C = T.COBBLE, F = T.FLOWERS, I = T.ICE;

export const PEAK_PLACES = {
  gate: [81, 198], slopes: [80, 176], lakes: [66, 146], lake_e: [128, 162], fortress: [150, 154], cave: [18, 136],
  terrace: [52, 104], plateau: [30, 76], shrine: [26, 32], camp: [131, 108], stairs: [82, 108], windcut: [84, 74],
  switchback: [140, 60], lookout: [150, 26], summit: [90, 28],
};

export function buildFrostpeakTerrain(b) {
  const m = b.m, P = PEAK_PLACES, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, T.CLIFF);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.FROSTPEAK);
  const S = (name) => m.addSubArea({ name, zone: Z.FROSTPEAK });
  const AR = {
    gate: S('South Gate'), slopes: S('Pinewood Slopes'), lakes: S('Frozen Lakes'), fortress: S('Frost Fortress'), cave: S('Icebound Cave'),
    terrace: S('Western Terrace'), windcut: S('Windcut Terrace'), plateau: S('Crystal Plateau'), shrine: S("Hermit's Shrine"), camp: S('Nomad Camp'),
    stairs: S('Glacier Stairs'), switchback: S('Eastern Switchback'), lookout: S('Lookout Tower'), summit: S('Summit Citadel'),
  };

  // ---------------- snow terraces (noisy discs / ellipses of snow)
  const snow = (x, y, rx, ry = rx, noise = 2) => b.ellipse(x, y, rx, ry, G, { noise });
  snow(80, 184, 44, 18, 3);           // the lower slopes (a wide pine forest)
  snow(72, 150, 34, 14, 2.5);         // the Frozen Lakes shelf
  snow(128, 160, 26, 14, 2);          // east lake + fortress
  snow(20, 136, 12, 10);              // Icebound Cave mouth
  snow(52, 104, 14, 9);               // Windcut Terrace (W, mid)
  snow(30, 76, 22, 16, 2.5);          // Crystal Plateau
  snow(26, 32, 13, 11);               // Hermit's Shrine
  snow(132, 108, 22, 14, 2);          // Nomad Camp
  snow(84, 76, 16, 12);               // Windcut / the approach to the summit
  snow(142, 60, 16, 12);              // Eastern Switchback
  snow(150, 26, 10, 10);              // Lookout Tower
  for (let i = 0; i < 40; i++) b.disc(r.int(10, 158), r.int(10, 200), r.range(1.5, 3), F, { only: [G], noise: 1 });

  // ---------------- the Frozen Lakes: ice with open water, the east lake
  b.ellipse(P.lakes[0], P.lakes[1], 20, 9, I, { noise: 2 });
  for (const [x, y, rr] of [[60, 144, 3], [74, 150, 2.5], [66, 140, 2]]) b.disc(x, y, rr, T.DEEP_WATER, { noise: 0.6 });
  b.ellipse(P.lake_e[0], P.lake_e[1] + 2, 12, 6, T.WATER, { noise: 1.5 });
  b.ellipse(P.lake_e[0], P.lake_e[1] + 2, 14, 8, T.SHALLOW, { only: [G, F], noise: 1.5 });

  // ---------------- paths (packed snow); bridges over water
  const path = (pts, w = 3, t = D) => b.line(pts, w, t, { noise: 0.6 });
  b.rect(78, 199, 84, 206, C);                                                   // the South Gate road (exit south_gate)
  path([[81, 199], P.slopes, [72, 160], P.lakes]);
  path([P.slopes, [104, 172], [118, 168], P.lake_e]);
  path([P.lake_e, [140, 162], P.fortress], 3);
  path([P.lakes, [40, 140], P.cave]);
  path([P.lakes, [76, 128], P.stairs]);                                          // up the Glacier Stairs
  path([P.stairs, [60, 106], P.terrace]);
  path([P.terrace, [40, 92], P.plateau]);
  path([P.plateau, [26, 54], P.shrine]);
  path([P.stairs, [106, 106], P.camp]);
  path([P.camp, [140, 84], P.switchback]);
  path([P.switchback, [148, 42], P.lookout]);
  path([P.stairs, [84, 92], P.windcut]);
  path([P.windcut, [88, 56], [90, 50]], 3, C);                                   // to the summit gate (sealed: next phase)
  path([P.shrine, [48, 30], [62, 34]], 2.4);
  // stairs up the terraces (walkable, drawn as steps)
  for (const [x0, y0, x1, y1] of [[79, 118, 85, 124], [81, 84, 87, 90], [86, 50, 94, 55]]) b.rect(x0, y0, x1, y1, T.STAIRS);
  // bridges where paths cross water
  for (let y = 150; y <= 172; y++) for (let x = 100; x <= 160; x++) { const t = m.get(x, y); if ((t === T.WATER || t === T.SHALLOW) && [[118, 168], [140, 162]].some(([px, py]) => Math.abs(py - y) < 3 && Math.abs(px - x) < 12)) m.set(x, y, T.BRIDGE); }

  // ---------------- the Summit Citadel (B3 major boss arena, zone PEAK_SUMMIT: sealed until the next phase)
  b.disc(P.summit[0], P.summit[1], 20, T.ARENA, { noise: 0.4 });
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Math.hypot(x - P.summit[0], y - P.summit[1]) <= 22 && y <= 50) m.zone[m.idx(x, y)] = Z.PEAK_SUMMIT;
  b.prop('p_gate_grand', 90, 51, { solid: true, footprint: [[-4, 0], [-3, 0], [-2, 0], [2, 0], [3, 0], [4, 0]] });

  // ---------------- sub-areas
  const subs = { gate: 8, slopes: 16, lakes: 20, fortress: 10, cave: 11, terrace: 12, plateau: 18, shrine: 12, camp: 16, stairs: 8, windcut: 12, switchback: 12, lookout: 10 };
  for (const [k, rr] of Object.entries(subs)) b.subDisc(P[k][0], P[k][1], rr, AR[k]);
  b.subDisc(P.lake_e[0], P.lake_e[1], 12, AR.lakes);
  b.subDisc(P.summit[0], P.summit[1], 22, AR.summit);

  // ---------------- landmarks
  const lit = (x, y, color = '#9ad0ff', rr = 90, a = 0.45) => b.light(x, y - 1, rr, color, { a, flicker: true });
  b.prop('p_gate_arch', P.gate[0], 197, { solid: true, footprint: [[-4, 0], [-3, 0], [3, 0], [4, 0]] });
  for (const x of [74, 88]) { b.prop('p_crystal_post_a', x, 194, { solid: true }); lit(x, 194, '#6aa8ff', 70); }
  b.prop('p_cliff_cave', P.cave[0], P.cave[1] - 5, { solid: true, footprint: [[-3, 0], [-2, 0], [2, 0], [3, 0]] }); lit(P.cave[0], P.cave[1] - 4, '#6aa8ff', 110, 0.6);
  for (const [n, x, y] of [['p_crystal_big', 30, 72], ['p_crystal_a', 20, 80], ['p_crystal_c', 40, 80], ['p_crystal_e', 26, 66], ['p_crystal_d', 36, 70], ['p_spikes_c', 16, 70]])
    { b.prop(n, x, y, { solid: true }); lit(x, y, '#7ab8ff', 80, 0.4); }
  b.prop('p_fort_crystal', P.shrine[0], P.shrine[1] + 2, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-2, -1], [2, -1]] }); lit(P.shrine[0], P.shrine[1] - 4, '#7ab8ff', 130, 0.6);
  b.prop('p_fort_round', 50, 106, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] });
  for (const [n, x, y] of [['p_tent_a', 124, 104], ['p_tent_b', 138, 104], ['p_tent_c', 126, 114], ['p_tent_d', 140, 114], ['p_tent_frame', 132, 100], ['p_hall_gold', 144, 108], ['p_keep', 120, 110]])
    b.prop(n, x, y, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('p_campfire', 131, 109, { solid: true, light: { r: 110, color: '#ff9a40', a: 0.85, flicker: true, oy: -10 } });
  b.prop('p_gate_wall', P.fortress[0], P.fortress[1] - 4, { solid: true, footprint: [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0]] });
  b.prop('p_tower_blue', P.fortress[0] + 7, P.fortress[1] - 2, { solid: true });
  b.prop('p_watchtower', P.lookout[0], P.lookout[1] - 2, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] }); lit(P.lookout[0], P.lookout[1] - 4, '#ffd890', 80);
  b.prop('p_cliff_cave', 145, 66, { solid: true, footprint: [[-3, 0], [-2, 0], [2, 0], [3, 0]] });
  b.prop('p_crystal_fount_a', 84, 72, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] }); lit(84, 70, '#7ab8ff', 120, 0.55);
  b.prop('p_ice_altar', 66, 150, { solid: true }); lit(66, 150, '#9ad0ff', 90);
  // the summit: the citadel's walls on the rim (the floor itself stays clear for the fight)
  b.prop('p_citadel', P.summit[0], P.summit[1] - 12, { scale: 0.9 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.15) continue; b.prop(i % 2 ? 'p_turret_a' : 'p_turret_b', P.summit[0] + Math.cos(a) * 19, P.summit[1] + Math.sin(a) * 17, { solid: true }); }
  lit(P.summit[0], P.summit[1], '#9ad0ff', 220, 0.35);
  // bridges over the gaps, waterfalls down the terraces
  for (const [n, x, y] of [['p_bridge_rope', 106, 106], ['p_bridge_stone', 62, 106], ['p_bridge_wood', 120, 168]]) b.prop(n, x, y, { layer: 'ground' });
  for (const [n, x, y] of [['p_fall_a', 58, 126], ['p_fall_b', 100, 124], ['p_fall_c', 44, 96], ['p_fall_d', 112, 90], ['p_cliff_fall_a', 66, 92], ['p_cliff_fall_b', 104, 144]])
    { b.prop(n, x, y, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] }); lit(x, y, '#5ab8ff', 70, 0.35); }

  // ---------------- forest + rocks on the snow (never on paths / ice / water)
  const clear = [...Object.values(P).map(([x, y]) => [x, y, 6])];
  b.scatter(8, 8, 160, 200, ['p_pine_a', 'p_pine_b', 'p_pine_c', 'p_pine_d', 'p_pine_e'], 320, { on: [G, F], solid: true, minGap: 3, keepClear: clear });
  b.scatter(8, 8, 160, 200, ['p_dead_a', 'p_dead_b', 'p_dead_c', 'p_snowrock_a', 'p_snowrock_b', 'p_snowrock_c', 'p_snowrock_d', 'p_log_a', 'p_log_b', 'p_crystal_s', 'p_crystal_b'], 90, { on: [G, F], solid: true, minGap: 5, keepClear: clear });
  // the mountain: peaks and rock just outside the walkable snow
  for (let ty = 2; ty < m.h - 2; ty++) for (let tx = 2; tx < m.w - 2; tx++) {
    if (m.get(tx, ty) !== T.CLIFF || !r.chance(0.07)) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (!SOLID_TILES.has(m.get(tx + dx, ty + dy))) { near = true; break; }
    if (near) b.prop(r.pick(['p_peak_a', 'p_peak_b', 'p_peak_c', 'p_peak_d', 'p_peak_e', 'p_peak_s', 'p_rock_a', 'p_rock_c', 'p_rock_spires', 'p_spikes_a', 'p_spikes_b']), tx, ty, { flip: r.chance(0.5), scale: 0.8 });
  }
  b.regions.playerSpawn = { x: 81.5 * TILE, y: 196 * TILE };
}
