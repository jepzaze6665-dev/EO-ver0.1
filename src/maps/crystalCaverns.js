import { T, Z, TILE, SOLID_TILES } from '../core/constants.js';

// B2 — CRYSTAL CAVERNS terrain (grid `caverns`, 168 × 208 = the A1 scale). After the owner's reference
// (desgin/Map/Ref/b/b2 "CRYSTAL CAVERNS", 1280 px -> x × 0.131, y × 0.1625) with the owner's B2 art: ground = tile skin
// 'caverns' (cave stone, moss, underground water, crystal growth, rune floor), props = 'k_*'.
// Solid rock everywhere; chambers carved out and joined by stone paths.
//   main route : Frozen Tunnel (NW, from the Frost Arena) -> Glittering Hall -> Crystal Field -> the Underground Lake
//                (bridges) -> Sunken Ruins (E) -> Eastern Plaza -> Abyssal Arch (SE, the road to B3 — later)
//   sides      : Northern Gallery · Heart of the Caverns (NE, sealed — the B2 boss, next phase) · Old Mine (W) ·
//                Glowroot Grotto (SW) · Sealed Crystal Vault (S) · twin pools
const C = T.COBBLE, D = T.DIRT, R = T.RUIN, M = T.GRASS, X = T.CORRUPT;

export const CAVERN_PLACES = {
  tunnel: [14, 12], hall: [39, 33], gallery: [74, 28], heart: [142, 30], field: [58, 56], mine: [32, 92], lake: [92, 98],
  ruins: [143, 76], plaza: [148, 116], grotto: [26, 156], vault: [88, 172], pool_w: [58, 134], pool_e: [114, 144], arch: [148, 174],
};

export function buildCrystalCavernsTerrain(b) {
  const m = b.m, P = CAVERN_PLACES, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, T.CLIFF);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.CAVERNS);
  const S = (name) => m.addSubArea({ name, zone: Z.CAVERNS });
  const AR = {
    tunnel: S('Frozen Tunnel'), hall: S('Glittering Hall'), gallery: S('Northern Gallery'), heart: S('Heart of the Caverns'),
    field: S('Crystal Field'), mine: S('Old Mine'), lake: S('Underground Lake'), ruins: S('Sunken Ruins'), plaza: S('Eastern Plaza'),
    grotto: S('Glowroot Grotto'), vault: S('Sealed Crystal Vault'), arch: S('Abyssal Arch'),
  };

  // ---------------- chambers (noisy discs of cave floor)
  const room = (k, rr, t, noise = 2) => b.disc(P[k][0], P[k][1], rr, t, { noise });
  room('tunnel', 6, R, 1.2); room('hall', 13, C); room('gallery', 11, C); room('heart', 16, T.ARENA, 1);
  room('field', 13, D); room('mine', 14, D); room('ruins', 12, R); room('plaza', 12, C);
  room('grotto', 13, D); room('vault', 12, T.ARENA, 1); room('pool_w', 9, D); room('pool_e', 10, D); room('arch', 10, R);
  // moss + crystal-growth patches on the floors
  for (let i = 0; i < 45; i++) b.disc(r.int(12, 156), r.int(12, 196), r.range(1.5, 3), M, { only: [D, C], noise: 1 });
  for (const [x, y, rr] of [[58, 52, 4], [40, 30, 3], [26, 152, 4], [150, 72, 3], [88, 176, 3], [62, 64, 2.5]]) b.disc(x, y, rr, X, { only: [D, C, M, R], noise: 1 });

  // ---------------- the Underground Lake: deep water, a rim of shallows, rock islets
  b.ellipse(P.lake[0], P.lake[1], 21, 17, R, { noise: 2 });
  b.ellipse(P.lake[0], P.lake[1], 18, 14, T.SHALLOW, { noise: 2 });
  b.ellipse(P.lake[0], P.lake[1], 15, 11, T.DEEP_WATER, { noise: 1.8 });
  b.disc(P.lake[0] + 2, P.lake[1] - 2, 2.5, T.CLIFF, { noise: 0.8 });
  // pools
  b.disc(P.pool_w[0], P.pool_w[1] + 1, 4, T.WATER, { noise: 1 });
  b.disc(P.pool_e[0] + 1, P.pool_e[1], 5, T.WATER, { noise: 1 });

  // ---------------- paths (width 3, stone); bridges where they cross water
  const path = (pts, w = 3) => b.line(pts, w, C, { noise: 0.6 });
  b.rect(2, 11, 8, 13, C); // the tunnel mouth (exit north_tunnel)
  path([[4, 12], P.tunnel, [24, 20], P.hall]);                          // in from the Frost Arena (exit north_tunnel)
  path([P.hall, [48, 44], P.field]);
  path([P.hall, [56, 30], P.gallery]);
  path([P.gallery, [100, 26], [124, 28], P.heart]);                     // to the Heart (sealed: gate cavern_heart_gate)
  path([P.field, [44, 72], P.mine]);
  path([P.field, [72, 72], [72, 98], [110, 98], [124, 90], P.ruins], 3); // across the lake (bridge)
  path([P.ruins, [148, 96], P.plaza]);
  path([P.plaza, [150, 140], P.arch]);
  path([P.mine, [30, 124], P.grotto]);
  path([P.mine, [46, 116], P.pool_w]);
  path([P.pool_w, [70, 150], P.vault]);
  path([P.vault, [104, 158], P.pool_e]);
  path([P.pool_e, [130, 160], P.arch]);
  path([P.gallery, [92, 50], [108, 66], [124, 78]], 2.4);               // high gallery loop
  // the lake crossing: path tiles over the lake are a bridge
  for (let y = P.lake[1] - 18; y <= P.lake[1] + 18; y++) for (let x = P.lake[0] - 22; x <= P.lake[0] + 22; x++)
    if (m.get(x, y) === C && ((x - P.lake[0]) / 18) ** 2 + ((y - P.lake[1]) / 14) ** 2 < 1.05) m.set(x, y, T.BRIDGE);

  // ---------------- sub-areas
  const subs = { tunnel: 7, hall: 14, gallery: 12, heart: 17, field: 14, mine: 15, ruins: 13, plaza: 13, grotto: 14, vault: 13, arch: 11 };
  for (const [k, rr] of Object.entries(subs)) b.subDisc(P[k][0], P[k][1], rr, AR[k]);
  b.subDisc(P.lake[0], P.lake[1], 22, AR.lake);

  // ---------------- landmarks
  const lit = (x, y, color = '#7ab8ff', rr = 80, a = 0.5) => b.light(x, y - 1, rr, color, { a, flicker: true });
  b.prop('k_cave_glow', P.tunnel[0] - 5, P.tunnel[1] - 3, { solid: true }); lit(P.tunnel[0], P.tunnel[1], '#bfe6ff', 90);
  for (const [n, x, y] of [['k_crystal_big', 39, 29], ['k_crystal_twin', 30, 38], ['k_crystal_a', 48, 36], ['k_crystal_violet', 52, 60], ['k_crystal_big', 62, 52], ['k_crystal_field', 70, 22],
    ['k_crystal_violet_b', 22, 160], ['k_crystal_a', 34, 150], ['k_crystal_twin', 20, 148], ['k_crystal_violet_c', 156, 110], ['k_crystal_big', 80, 178], ['k_crystal_violet', 98, 176]])
    { b.prop(n, x, y, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] }); lit(x, y, n.includes('violet') ? '#b070ff' : '#7ab8ff', 110, 0.55); }
  b.prop('k_rune_circle', P.gallery[0], P.gallery[1] + 2, { layer: 'ground' }); lit(P.gallery[0], P.gallery[1], '#7ab8ff', 90);
  b.prop('k_rune_pool', P.field[0] - 6, P.field[1] + 4, { layer: 'ground' });
  // the Heart of the Caverns: the giant crystal (the B2 boss waits here — next phase)
  b.prop('k_crystal_big', P.heart[0], P.heart[1] - 4, { solid: true, scale: 1.8, footprint: [[-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]] });
  lit(P.heart[0], P.heart[1] - 4, '#b070ff', 200, 0.6);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.prop(i % 2 ? 'k_crystal_violet_s' : 'k_crystal_s1', P.heart[0] + Math.cos(a) * 14, P.heart[1] + Math.sin(a) * 13, { solid: true }); }
  // the Old Mine: scaffolds, rails, carts, lanterns
  for (const [n, x, y] of [['k_scaffold_a', 24, 86], ['k_scaffold_b', 40, 84], ['k_mine_lift', 30, 98], ['k_crane', 20, 96], ['k_mine_frame', 42, 100], ['k_mine_box', 36, 88]])
    b.prop(n, x, y, { solid: true });
  for (const [n, x, y] of [['k_rails_a', 30, 92], ['k_rails_b', 38, 94], ['k_cart', 34, 94]]) b.prop(n, x, y, { layer: 'ground' });
  for (const [x, y] of [[26, 90], [38, 92], [32, 102], [44, 88]]) { b.prop('k_lamp', x, y, { solid: true }); lit(x, y, '#ffb050', 70, 0.7); }
  for (const [n, x, y] of [['k_crate_a', 22, 100], ['k_barrel_a', 44, 96], ['k_crate_b', 26, 84], ['k_barrel_b', 40, 104]]) b.prop(n, x, y, { solid: true });
  // the Sunken Ruins + the Eastern Plaza
  for (const [n, x, y] of [['k_column_a', 136, 70], ['k_column_b', 150, 70], ['k_column_c', 136, 82], ['k_column_d', 150, 82], ['k_shrine', 143, 72], ['k_obelisk', 143, 84]])
    b.prop(n, x, y, { solid: true });
  lit(143, 72, '#7ab8ff', 110);
  b.prop('k_rune_plate', P.plaza[0], P.plaza[1], { layer: 'ground' }); lit(P.plaza[0], P.plaza[1], '#7ab8ff', 100);
  for (const [n, x, y] of [['k_column_e', 140, 110], ['k_column_f', 156, 110], ['k_column_glow', 140, 122], ['k_column_glow', 156, 122]]) b.prop(n, x, y, { solid: true });
  // the Abyssal Arch (to B3 — sealed until Route B goes on)
  b.prop('k_arch_gate', P.arch[0], P.arch[1] - 3, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]], light: { r: 100, color: '#b070ff', a: 0.6, oy: -40 } });
  // the Sealed Crystal Vault (Elite)
  b.prop('k_crystal_altar', P.vault[0], P.vault[1], { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] }); lit(P.vault[0], P.vault[1], '#7ab8ff', 140, 0.6);
  for (const [x, y] of [[80, 164], [96, 164], [80, 180], [96, 180]]) b.prop('k_pillar_glow', x, y, { solid: true });
  // waterfalls into the lake + the pools
  for (const [n, x, y] of [['k_waterfall_a', 78, 84], ['k_waterfall_b', 104, 84], ['k_waterfall_a', 116, 138]]) { b.prop(n, x, y, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] }); lit(x, y, '#5ab8ff', 90); }
  b.light(P.lake[0], P.lake[1], 200, '#3a8aff', { a: 0.3 });
  // bones and gems in the corners, crystals everywhere on the floors (never on the paths)
  const clear = [...Object.values(P).map(([x, y]) => [x, y, 5])];
  b.scatter(8, 8, 160, 200, ['k_gem_a', 'k_gem_b', 'k_gem_c', 'k_gem_d', 'k_gem_e', 'k_gem_f', 'k_gems_violet', 'k_crystal_c1', 'k_crystal_c2', 'k_crystal_m1', 'k_crystal_m2', 'k_crystal_m3'], 170, { on: [D, R, M, X], solid: true, minGap: 4, keepClear: clear });
  b.scatter(8, 8, 160, 200, ['k_rubble', 'k_rubble_b', 'k_skull', 'k_skull_pile', 'k_skeleton', 'k_candle_a'], 50, { on: [D, R, M], minGap: 7, keepClear: clear });
  // the cave walls: rock and crystal props just outside the floors (the solid rock around every chamber)
  for (let ty = 2; ty < m.h - 2; ty++) for (let tx = 2; tx < m.w - 2; tx++) {
    if (m.get(tx, ty) !== T.CLIFF || !r.chance(0.08)) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (!SOLID_TILES.has(m.get(tx + dx, ty + dy))) { near = true; break; }
    if (near) b.prop(r.pick(['k_cliff_a', 'k_cliff_b', 'k_cliff_c', 'k_cliff_d', 'k_cliff_e', 'k_cliff_f', 'k_cliff_g', 'k_cliff_violet', 'k_pillar_blue', 'k_pillar_violet']), tx, ty, { flip: r.chance(0.5) });
  }
  // glowing crystals light the dark: a faint light on every crystal-growth patch
  for (let i = 0; i < 30; i++) { const x = r.int(10, 158), y = r.int(10, 198); if (!SOLID_TILES.has(m.get(x, y))) b.light(x, y, 60, r.chance(0.3) ? '#b070ff' : '#6aa8ff', { a: 0.3 }); }
  b.regions.playerSpawn = { x: 8.5 * TILE, y: 12.5 * TILE };
}
