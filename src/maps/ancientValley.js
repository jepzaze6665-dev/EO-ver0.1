import { T, Z, TILE, SOLID_TILES } from '../core/constants.js';

// A2 — ANCIENT VALLEY terrain (grid `ancient_valley`, 168 × 208 = the A1 scale). Built after the owner's reference
// (desgin/Map/Ref/a2 "ANCIENT VALLEY") with the owner's A2 art: ground = tile skin 'valley' (tools/build-tiles.js),
// props = 'v_*' (tools/extract-props.js). High ground is cliff (mossy tops + rock faces) and the valley floor is carved
// out of it as terraces joined by dirt roads; a river falls from the north and runs down to a lake, bridged wherever a
// road crosses it. At the far north the valley breaks open into the MAGMA RIFT (scorched rock, lava) — the Magma
// Beast's lair (A2 boss).
//   main route : Valley Gate (south) -> Pine Terraces -> River Fords -> Statue Commons -> High Meadow -> Magma Rift
//   side routes: Sunken Temple (west) · Golden Arch -> Gilded Shrine (east, loops back north) · Mirror Lake (south-west)
//   hidden slot: Quiet Hollow (south-east, a narrow cleft off the Valley Gate) — content later (data/hidden.js)
const G = T.GRASS, V = T.VALLEY, D = T.DIRT;

export const VALLEY_PLACES = {
  gate: [84, 192], pines: [60, 158], fords: [98, 132], commons: [84, 104], temple: [34, 98], arch: [140, 118],
  shrine: [138, 62], lake: [32, 166], upper: [80, 62], rift: [84, 22], hollow: [148, 176],
};

export function buildAncientValleyTerrain(b) {
  const m = b.m, P = VALLEY_PLACES, r = b.r;
  b.rect(0, 0, m.w - 1, m.h - 1, T.CLIFF);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.ANCIENT);
  const S = (name, extra = {}) => m.addSubArea({ name, zone: Z.ANCIENT, ...extra });
  const A = {
    gate: S('Valley Gate'), pines: S('Pine Terraces'), fords: S('River Fords'), commons: S('Statue Commons'),
    temple: S('Sunken Temple'), arch: S('Golden Arch'), shrine: S('Gilded Shrine'), lake: S('Mirror Lake'),
    upper: S('High Meadow'), rift: S('Magma Rift'), hollow: S('Quiet Hollow'),
  };

  // ---------------- terraces (valley floor carved out of the high ground)
  const meadow = (p, rx, ry, t = G) => b.ellipse(p[0], p[1], rx, ry, t, { noise: 2.2 });
  meadow(P.gate, 13, 11); meadow(P.pines, 20, 13); meadow(P.fords, 18, 12); meadow(P.commons, 22, 15, V);
  meadow(P.temple, 18, 16); meadow(P.arch, 15, 13); meadow(P.shrine, 15, 12, V); meadow(P.lake, 17, 13);
  meadow(P.upper, 18, 12); meadow(P.hollow, 6, 5);
  // flower patches
  for (const [x, y, rr] of [[54, 154, 4], [92, 100, 3], [132, 64, 3], [26, 162, 3], [88, 196, 2]]) b.disc(x, y, rr, T.FLOWERS, { only: [G, V] });

  // ---------------- river: waterfall in the north cliffs -> down the valley -> Mirror Lake
  // east side of the valley, then west across the south: every road meets it once, at a right angle (3 bridges)
  const river = [[118, 14], [118, 30], [114, 46], [116, 66], [122, 86], [122, 106], [116, 124], [112, 142], [100, 156], [80, 168], [60, 176], [42, 172], [32, 168]];
  b.line(river, 6, T.SHALLOW, { noise: 0.6, seed: 21 });
  b.line(river, 4, T.WATER, { noise: 0.5, seed: 22 });
  b.line(river.slice(0, 8), 1.6, T.DEEP_WATER, { noise: 0.3, seed: 23 });
  b.ellipse(30, 168, 10, 6, T.WATER, { noise: 1.2 });
  b.ellipse(28, 168, 6, 3.5, T.DEEP_WATER, { noise: 0.8 });

  // ---------------- roads (bridges wherever a road crosses the river)
  const wet = (t) => t === T.WATER || t === T.DEEP_WATER || t === T.SHALLOW;
  const roads = [
    [[84, 204], [84, 192], [80, 176], [80, 164], [60, 158]],      // Valley Gate -> (bridge) -> Pine Terraces
    [[60, 158], [76, 142], [98, 132]],                            // -> River Fords
    [[98, 132], [92, 116], [84, 104]],                            // -> Statue Commons
    [[84, 104], [84, 84], [80, 62]],                              // -> High Meadow
    [[80, 62], [84, 46], [84, 36]],                               // -> Magma Rift
    [[84, 104], [60, 100], [34, 98]],                             // side: Sunken Temple
    [[84, 104], [112, 112], [140, 118]],                          // side: Golden Arch
    [[140, 118], [148, 92], [138, 62]],                           // Golden Arch -> Gilded Shrine
    [[138, 62], [110, 58], [80, 62]],                             // shrine loops back to the High Meadow
    [[60, 158], [46, 160], [40, 160]],                            // side: Mirror Lake
  ];
  for (const pts of roads) {
    const before = new Set();
    // remember river tiles under the road corridor, paint the road, then bridge them
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= n; s++) {
        const x = x0 + ((x1 - x0) * s) / n, y = y0 + ((y1 - y0) * s) / n;
        for (let yy = Math.floor(y - 3); yy <= y + 3; yy++) for (let xx = Math.floor(x - 3); xx <= x + 3; xx++)
          if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= 2.6 && wet(m.get(xx, yy))) before.add(m.idx(xx, yy));
      }
    }
    b.line(pts, 5, D, { noise: 0.9, seed: 31 });
    for (const i of before) m.tiles[i] = T.BRIDGE;
  }
  // the quiet cleft to the hidden hollow (narrow on purpose)
  b.line([[94, 194], [120, 186], [142, 178]], 2, D, { noise: 0.3, seed: 41 });

  // ---------------- MAGMA RIFT = the A2 boss arena (its own map: maps/magmaRift.js, zone RIFT above row 41). A round
  // fighting ground as large as the Guardian's, ringed by a lava moat, one road in from the south (like A1's arena)
  const [rx, ry] = P.rift;
  b.disc(rx, ry, 19.5, T.LAVA, { noise: 0.9, seed: 52 });
  b.disc(rx, ry, 16.5, T.SCORCHED, { noise: 0.5, seed: 53 });
  b.line([[rx, 44], [rx, ry + 12]], 6, T.SCORCHED, { noise: 0.5 });  // the causeway over the moat
  b.line([[rx, 44], [rx, 38]], 5, D, { noise: 0.6 });
  for (let ty = 0; ty <= 41; ty++) for (let tx = 58; tx <= 110; tx++) b.m.zone[b.m.idx(tx, ty)] = Z.RIFT;

  // ---------------- sub-areas (banners, map labels)
  const sub = { gate: [P.gate, 13], pines: [P.pines, 18], fords: [P.fords, 14], commons: [P.commons, 18], temple: [P.temple, 16], arch: [P.arch, 14], shrine: [P.shrine, 13], lake: [P.lake, 15], upper: [P.upper, 14], rift: [[rx, ry], 21], hollow: [P.hollow, 7] };
  for (const [k, [[x, y], rr]] of Object.entries(sub)) b.subDisc(x, y, rr, A[k]);

  // ---------------- landmarks + ruins (owner's A2 props)
  b.prop('v_waterfall', 118, 16, { solid: true });
  b.prop('v_statue', P.commons[0], P.commons[1] - 3, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('v_temple', P.temple[0], P.temple[1] - 5, { solid: true, footprint: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] });
  b.prop('v_ruin_platform', P.temple[0] + 8, P.temple[1] + 4, { solid: true });
  b.prop('v_gold_gate', P.arch[0], P.arch[1] - 6, { light: { r: 70, color: '#ffcf6a', a: 0.5, oy: -60 } });
  b.prop('v_gold_shrine', P.shrine[0], P.shrine[1] - 4, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], light: { r: 90, color: '#ffcf6a', a: 0.6, oy: -30 } });
  for (const [n, x, y] of [['v_pillar_a', 26, 104], ['v_pillar_b', 42, 106], ['v_pillar_c', 30, 88], ['v_obelisk', 76, 98], ['v_obelisk', 92, 98],
    ['v_ruin_b', 126, 112], ['v_ruin_c', 152, 122], ['v_ruin_d', 70, 58], ['v_wall_a', 94, 66], ['v_ruin_arch', 84, 88], ['v_gold_pillar', 132, 60], ['v_gold_pillar', 144, 60],
    ['v_block_a', 104, 128], ['v_block_b', 58, 150], ['v_rubble_a', 36, 110]]) b.prop(n, x, y, { solid: true });
  for (const [n, x, y] of [['v_banner_a', 134, 124], ['v_banner_b', 146, 124], ['v_banner_c', 80, 108], ['v_banner_a', 88, 108]]) b.prop(n, x, y, {});
  for (const [x, y] of [[80, 188], [89, 188], [30, 92], [38, 92], [134, 56], [142, 56]]) { b.prop('v_torch_pillar', x, y, { solid: true }); b.light(x, y - 1, 60, '#ffb050', { a: 0.5, flicker: true }); }
  for (const [x, y] of [[78, 110], [90, 110], [84, 66]]) { b.prop('v_brazier', x, y, { solid: true }); b.light(x, y, 55, '#ffb050', { a: 0.5, flicker: true }); }
  b.prop('v_lamp_post', 92, 196, {}); b.light(92, 195, 50, '#ffd890', { a: 0.4 });
  b.prop('v_cascade', 116, 70, {});

  // ---------------- vegetation: pines on the terraces and the high ground at their rims, bushes, flowers
  const PINES = ['v_pine_a', 'v_pine_b', 'v_pine_c', 'v_pine_d', 'v_pine_e', 'v_pine_f', 'v_pine_g', 'v_pine_h', 'v_pine_i'];
  const keep = [...Object.values(P).map(([x, y]) => [x, y, 6]), ...roads.flat().map(([x, y]) => [x, y, 3])];
  b.scatter(4, 40, m.w - 5, m.h - 5, PINES, 170, { on: [G, V], solid: true, minGap: 3, keepClear: keep });
  b.scatter(4, 40, m.w - 5, m.h - 5, ['v_bush_a', 'v_bush_b', 'v_bush_c', 'v_bush_d', 'v_bush_e', 'v_bush_f', 'v_bush_g'], 160, { on: [G, V, T.FLOWERS], minGap: 2 });
  b.scatter(4, 40, m.w - 5, m.h - 5, ['v_flower_a', 'v_flower_b', 'v_flower_c', 'v_grass_c', 'v_grass_tall', 'v_grass_b', 'v_mushroom', 'v_mushroom_red'], 260, { on: [G, V, T.FLOWERS] });
  b.scatter(4, 40, m.w - 5, m.h - 5, ['v_rock_a', 'v_rock_b', 'v_rock_c', 'v_log_a', 'v_log_b', 'v_pebbles'], 70, { on: [G, V, D], solid: false, minGap: 4, keepClear: keep });
  // the high ground: pines and rocks just behind the cliff rims (never on open ground)
  const open = (x, y) => m.inBounds(x, y) && !SOLID_TILES.has(m.get(x, y));
  for (let ty = 2; ty < m.h - 2; ty++) for (let tx = 2; tx < m.w - 2; tx++) {
    if (m.get(tx, ty) !== T.CLIFF) continue;
    let near = false;
    for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) if (open(tx + dx, ty + dy)) { near = true; break; }
    if (!near || !r.chance(0.16)) continue;
    const rock = r.chance(0.2);
    b.prop(rock ? r.pick(['v_rocks', 'v_rock_heap', 'v_rock_pillar', 'v_cliff_a']) : r.pick(PINES), tx, ty, { dx: r.range(-8, 8), dy: r.range(-6, 2), flip: r.chance(0.5), tree: !rock });
  }
  // the rift: bones and rubble on the rim (the fighting ground stays clear), ember light from the moat
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    if (Math.abs(a - Math.PI / 2) < 0.35) continue; // keep the causeway clear
    b.prop(r.pick(['v_skulls', 'v_rubble_a', 'v_pebbles', 'v_dead_a', 'v_bare_a']), rx + Math.cos(a) * 15.5, ry + Math.sin(a) * 15.5, { flip: r.chance(0.5) });
  }
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; b.light(rx + Math.cos(a) * 18, ry + Math.sin(a) * 18, 80, '#ff6a20', { a: 0.5, flicker: true }); }
  b.light(rx, ry, 170, '#ff7a30', { a: 0.3, flicker: true });

  b.regions.playerSpawn = { x: 84.5 * TILE, y: 192 * TILE };
  b.regions.bossRift = { x: rx * TILE, y: ry * TILE };
}
