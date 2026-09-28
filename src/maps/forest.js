import { T, Z, TILE } from '../core/constants.js';

// WHISPERING FOREST — 96x128 (tiles x 0..95, y 30..157).
// Main route: Entrance -> Wolf Hollow -> River Crossing -> Deep Forest -> Stone Circle -> Ancient Forest Path -> Ruins.
// Side routes / loops: Abandoned Camp, Waterfall, Elder Tree, Goblin Glade, Crystal Glade.
// Secrets: Hidden Cave (major), Behind the Waterfall, Moonlit Shrine. Shortcuts: log bridge, bramble lane, ruins side gate.
export function buildForest(b) {
  const m = b.m;
  b.zoneRect(0, 30, 95, 157, Z.FOREST);
  const S = (name, extra = {}) => m.addSubArea({ name, zone: Z.FOREST, ...extra });
  const A = {
    entrance: S('Forest Entrance'), hollow: S('Wolf Hollow'), river: S('River Crossing'), deep: S('Deep Forest'),
    circle: S('Stone Circle'), ancient: S('Ancient Forest Path', { ancient: true }), camp: S('Abandoned Camp'),
    falls: S('Silverfall'), elder: S('Elder Tree'), glade: S('Goblin Glade'), crystal: S('Crystal Glade'),
    shrine: S('Moonlit Shrine', { secret: 3 }), valleyPath: S('Sealed Path', { ancient: true }), cave: S('Hidden Cave', { secret: 1 }),
  };
  b.forestAreas = A;
  const F = T.FOREST_FLOOR, D = T.DIRT;

  // ---------------- MAIN ROUTE
  b.disc(47, 147, 8, F);                          // forest entrance glade
  b.line([[48, 158], [47, 150], [46, 142], [41, 132], [38, 123]], 6, F);
  b.disc(38, 121, 8.5, F);                        // Wolf Hollow (combat clearing 1)
  b.line([[38, 121], [42, 112], [48, 105], [50, 101]], 6, F);
  b.line([[50, 95], [51, 88], [52, 80]], 6, F);
  b.disc(53, 78, 9.5, F);                         // Deep Forest (combat clearing 2)
  b.line([[53, 78], [60, 70], [66, 63]], 6, F);
  b.disc(66, 62, 8, F);                           // Stone Circle (combat clearing 3)
  b.line([[66, 62], [76, 66], [86, 70], [95, 71]], 5, F);
  // dirt road along the main route
  b.line([[48, 158], [47, 150], [46, 142], [41, 132], [38, 124], [42, 112], [48, 105], [50, 100]], 2.2, D, { only: [F] });
  b.line([[50, 95], [51, 88], [52, 80], [60, 70], [66, 64], [76, 66], [86, 70], [95, 71]], 2, D, { only: [F] });

  // ---------------- RIVER (west waterfall -> east edge)
  const riverY = (x) => 98 + Math.round(Math.sin(x / 9) * 1.6);
  for (let x = 3; x <= 95; x++) {
    const cy = riverY(x);
    for (let y = cy - 4; y <= cy + 4; y++) {
      const d = Math.abs(y - cy);
      if (d <= 1) m.set(x, y, T.DEEP_WATER);
      else if (d <= 2) m.set(x, y, T.WATER);
      else if (d <= 3 && m.get(x, y) !== T.CANOPY) m.set(x, y, T.SAND);
    }
  }
  b.line([[40, 104], [60, 104]], 4, F); b.line([[40, 92], [62, 92]], 4, F); // banks around crossing
  for (let x = 3; x <= 95; x++) { const cy = riverY(x); for (const y of [cy - 3, cy + 3]) if (m.get(x, y) !== T.CANOPY) m.set(x, y, T.SAND); }
  // bridge (main crossing)
  for (let y = 93; y <= 103; y++) for (let x = 49; x <= 51; x++) {
    const t = m.get(x, y);
    if (t === T.WATER || t === T.DEEP_WATER || t === T.SAND) m.set(x, y, T.BRIDGE);
  }
  b.subRect(40, 90, 62, 106, A.river);
  // waterfall basin
  b.disc(7, 98, 4.5, T.DEEP_WATER, { noise: 0.8 });
  b.rect(0, 88, 3, 108, T.CLIFF);
  b.rect(4, 89, 5, 93, T.CLIFF); b.rect(4, 103, 6, 107, T.CLIFF);
  b.regions.waterfall = { x: 2.5 * TILE, y: 92 * TILE, w: 3 * TILE, h: 12 * TILE };
  b.subRect(4, 90, 16, 106, A.falls);

  // ---------------- WEST LOOP: Entrance -> Camp -> south bank ; north bank -> Elder Tree -> Goblin Glade -> Deep Forest
  b.line([[44, 146], [34, 142], [24, 136]], 4.5, F);
  b.disc(20, 132, 7.5, F);                        // Abandoned Camp
  b.line([[20, 132], [15, 122], [17, 112], [20, 104]], 4.5, F);
  b.line([[10, 104], [22, 104]], 4, F);           // south bank walk to falls
  b.line([[16, 93], [24, 92], [22, 84], [18, 78]], 4.5, F);
  b.line([[10, 92], [16, 92]], 3.5, F);
  b.disc(18, 75, 7.5, F);                         // Elder Tree glade
  b.line([[18, 75], [24, 68], [29, 62]], 5, F);
  b.disc(29, 60, 7.5, F);                         // Goblin Glade (combat clearing 4)
  b.line([[29, 60], [38, 66], [46, 73], [53, 78]], 5, F); // loop back to Deep Forest
  b.line([[29, 60], [31, 50], [32, 42]], 4.5, F); // towards the sealed valley path
  b.line([[32, 42], [32, 29]], 4, F);
  b.subRect(28, 29, 36, 44, A.valleyPath);
  b.regions.valleyBarrier = { tx0: 29, ty0: 37, tx1: 35, ty1: 38 };
  b.subDisc(20, 132, 9, A.camp); b.subDisc(18, 75, 9, A.elder); b.subDisc(29, 60, 9, A.glade);
  b.subDisc(47, 147, 10, A.entrance); b.subDisc(38, 121, 10, A.hollow); b.subDisc(53, 78, 11, A.deep);
  b.subDisc(66, 62, 9, A.circle); b.subRect(74, 62, 95, 76, A.ancient);

  // log-bridge shortcut spot (river at x 22..24): stays water until pushed from the north bank
  b.regions.logBridge = { tx0: 22, tx1: 23, ty0: riverY(22) - 3, ty1: riverY(22) + 3 };

  // ---------------- EAST: Crystal Glade (optional) + bramble lane shortcut to the village
  b.line([[38, 121], [50, 124], [62, 121], [70, 120]], 4.5, F);
  b.disc(77, 120, 9, F);                          // Crystal Glade (combat clearing 5)
  b.line([[77, 120], [86, 113], [95, 112]], 4, F); // to ruins side gate (shortcut, opened from ruins)
  b.line([[76, 128], [72, 138], [68, 148], [66, 157]], 3.5, F); // bramble lane to the village
  b.subDisc(77, 120, 11, A.crystal);
  b.regions.bramble = { tx0: 67, ty0: 146, tx1: 70, ty1: 147 };
  b.regions.ruinsSideGate = { tx0: 96, ty0: 111, tx1: 99, ty1: 113 };

  // corruption patches (fade after the Guardian falls)
  b.disc(53, 78, 5, T.CORRUPT, { only: [F], noise: 2.5 });
  b.disc(66, 62, 4, T.CORRUPT, { only: [F], noise: 2 });
  b.disc(29, 58, 3, T.CORRUPT, { only: [F], noise: 2 });
  b.line([[76, 66], [90, 71]], 3, T.CORRUPT, { only: [F] });
  b.disc(36, 116, 2.5, T.CORRUPT, { only: [F], noise: 2 });

  // ---------------- SECRET 1 (major): Hidden Cave north of Stone Circle
  // cracked wall at (70..71,54) opened by attacking it; cave passage + chamber.
  b.rect(62, 32, 95, 55, T.CANOPY);
  b.line([[68, 57], [70, 54]], 2.5, F);
  b.line([[71, 51], [75, 48], [80, 44]], 3, T.CAVE);
  b.disc(84, 41, 8, T.CAVE, { noise: 1.2 });
  b.disc(76, 36, 3.5, T.CAVE, { noise: 0.8 });
  // wrap cave in walls
  for (let y = 30; y <= 56; y++) for (let x = 64; x <= 95; x++) {
    if (m.get(x, y) !== T.CANOPY) continue;
    let near = false;
    for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) if (m.get(x + ox, y + oy) === T.CAVE) { near = true; break; }
    if (near) m.set(x, y, T.CAVE_WALL);
  }
  // the cracked wall itself (3 tiles thick) is placed last so nothing carves through it
  b.rect(68, 52, 73, 54, T.CAVE_WALL);
  b.zoneRect(66, 31, 95, 51, Z.CAVE);
  b.secretRect(66, 31, 95, 53, 1);
  b.subRect(66, 31, 95, 51, A.cave);
  b.regions.caveWall = { tx0: 69, ty0: 52, tx1: 72, ty1: 54 };
  b.regions.caveCenter = { x: 84 * TILE, y: 41 * TILE };

  // ---------------- SECRET 2: Behind the Waterfall (small nook reached via shallow ledge)
  b.rect(4, 94, 5, 97, T.SHALLOW);
  b.rect(1, 94, 3, 97, T.CAVE);
  b.secretRect(0, 93, 5, 98, 2);

  // ---------------- SECRET 3: Moonlit Shrine (hidden path through odd silver trees west of Goblin Glade)
  b.line([[23, 58], [16, 54], [11, 50]], 2, F);
  b.disc(9, 48, 4.5, F, { noise: 0.8 });
  b.secretRect(4, 43, 21, 58, 3);
  b.subRect(4, 43, 20, 56, A.shrine);

  // ---------------- decoration
  const forestSet = (tx, ty) => {
    const sa = m.subAreas[m.sub[ty * m.w + tx]];
    if (sa && sa.ancient) return ['tree_ancient_a', 'tree_ancient_c', 'deep_tree_a', 'deep_tree_b', 'deep_tree_d', 'tree_teal_a'];
    if (ty < 110) return ['tree_corrupt_a', 'tree_corrupt_b', 'deep_tree_a', 'deep_tree_d', 'tree_pine_b', 'tree_large_pine', 'tree_dead_b'];
    return ['tree_round_a', 'tree_round_b', 'tree_pine_a', 'tree_large_a', 'tree_large_pine', 'tree_round_c', 'tree_pine_b', 'tree_large_b'];
  };
  b.edgeTrees(0, 29, 95, 157, forestSet, 0.55);
  // corrupted trees are world-state props (swap to healthy on restoration)
  for (const p of m.props) if (p.tree && /corrupt/.test(p.name)) { p.corruptVariant = p.name; p.restoredVariant = b.r.pick(['tree_round_a', 'tree_large_pine', 'deep_tree_a', 'tree_round_c']); }

  const floorOnly = [F, D, T.CORRUPT];
  b.scatter(0, 30, 95, 157, ['grass_a', 'grass_b', 'fern_a', 'flower_a', 'twig_a', 'pebble_a', 'shroom_tiny'], 260, { on: floorOnly, jitter: 12 });
  b.scatter(0, 30, 95, 157, ['bush_a', 'bush_b', 'bush_c', 'bush_d', 'bush_berry', 'rock_s', 'rock_m'], 55, {
    on: [F], minGap: 3, keepClear: [[47, 147, 6], [38, 121, 6], [53, 78, 7], [66, 62, 6], [29, 60, 5], [77, 120, 6], [20, 132, 5]],
  });

  // ---- Forest Entrance
  b.prop('signpost', 45, 150, { solid: true });
  b.interact({ id: 'sign_forest', kind: 'sign', tx: 45, ty: 150, prompt: 'Read Signpost', text: 'WHISPERING FOREST\n↑ River Crossing   ← Old Camp   → Crystal Glade\n"The forest has been restless since the fog came."' });
  b.prop('rock_moss', 53, 144, { solid: true }); b.prop('stump_a', 41, 149, {});

  // ---- Wolf Hollow: fallen log landmark at the edge, open centre
  b.prop('fallen_log', 31, 118, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('rock_l', 45, 116, { solid: true }); b.prop('bones', 36, 126, {});
  b.prop('root_b', 32, 126, {});

  // ---- Abandoned Camp (environmental storytelling)
  b.prop('tent', 17, 129, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('campfire', 21, 133, { light: { r: 64, color: '#ff8a40', a: 0.8, flicker: true, oy: -12 } });
  b.prop('crate_a', 24, 130, { solid: true }); b.prop('crate_b', 25, 131, {}); b.prop('barrel_a', 14, 134, { solid: true });
  b.prop('weapon_rack_b', 25, 135, { solid: true });
  b.prop('log_b', 19, 136, {});
  b.interact({ id: 'chest_camp', kind: 'chest', tx: 15, ty: 131, loot: [{ item: 'hp_potion', count: 2 }, { item: 'goblin_iron', count: 1 }], gold: 40 });
  b.interact({ id: 'lore_camp', kind: 'lore', tx: 22, ty: 135, lore: 'camp_journal', prompt: 'Read Torn Journal' });

  // ---- Silverfall (waterfall) + hidden nook
  b.propPx('waterfall', 2.5 * TILE, 105 * TILE, { layer: 'y', waterfall: true, w: 3.5 * TILE, h: 16 * TILE });
  b.prop('rock_moss2', 9, 92, { solid: true }); b.prop('rock_l2', 11, 104, { solid: true });
  b.prop('cry_white_l', 4, 95, { dy: -4, light: { r: 36, color: '#bfe8ff', a: 0.6 }, sparkle: true });
  b.interact({ id: 'chest_falls', kind: 'chest', tx: 2, ty: 95, loot: [{ item: 'veil_stillness', count: 1 }, { item: 'moon_crystal', count: 1 }], gold: 60, secret: 2, rare: true });
  b.interact({ id: 'trig_falls', kind: 'trigger', tx: 4, ty: 95, radius: 40, secret: 2, discover: 'Behind the Waterfall' });

  // ---- log bridge shortcut (push from north bank)
  b.prop('log_a', 23, 92, { id: 'log_upright', solid: true, footprint: [[0, 0], [-1, 0]] });
  b.interact({ id: 'push_log', kind: 'push', tx: 23, ty: 92, shortcut: 'log', needSide: 'north', prompt: 'Push the dead tree' });

  // ---- Elder Tree (giant landmark)
  b.prop('giant_tree', 18, 73, { solid: true, scale: 1.4, footprint: [[-1, 0], [0, 0], [1, 0], [0, -1]], light: { r: 50, color: '#6aff9a', a: 0.35, oy: -60 } });
  b.prop('mush_cyan', 14, 76, { light: { r: 22, color: '#5af0ff', a: 0.5 } }); b.prop('mush_blue', 22, 77, { light: { r: 22, color: '#5ab0ff', a: 0.5 } });
  b.interact({ id: 'lore_elder', kind: 'lore', tx: 19, ty: 75, lore: 'elder_tree', prompt: 'Touch the Elder Tree' });
  b.interact({ id: 'ws_forest', kind: 'waystone', tx: 55, ty: 106, name: 'River Crossing', prompt: 'Waystone' });

  // ---- Goblin Glade
  b.prop('crate_a', 24, 57, { solid: true }); b.prop('barrel_b', 34, 55, { solid: true }); b.prop('firewood', 33, 64, {});
  b.prop('tent', 28, 54, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], scale: 0.8 });

  // ---- Moonlit Shrine (secret): odd silver trees mark the hidden path
  b.prop('tree_teal_a', 23, 57, { clue: true, light: { r: 26, color: '#b8d8ff', a: 0.45 } });
  b.prop('tree_teal_a', 19, 55, { clue: true, light: { r: 26, color: '#b8d8ff', a: 0.45 } });
  b.prop('mush_cyan', 15, 53, { light: { r: 18, color: '#9ae8ff', a: 0.4 } });
  b.prop('stone_shrine', 9, 46, { solid: true, secret: 3, light: { r: 60, color: '#c8d8ff', a: 0.6, oy: -40 } });
  b.prop('rune_circle', 9, 48, { layer: 'ground', secret: 3, glow: '#9ab8ff' });
  b.interact({ id: 'moon_shrine', kind: 'blessing', tx: 9, ty: 47, secret: 3, prompt: 'Pray at the Moonlit Shrine' });
  b.interact({ id: 'trig_shrine', kind: 'trigger', tx: 13, ty: 51, radius: 60, secret: 3, discover: 'Moonlit Shrine' });

  // ---- Bridge / River
  b.prop('lantern_post', 48, 104, { light: { r: 50, color: '#ffb050', a: 0.6, flicker: true, oy: -40 } });
  b.prop('lantern_post', 52, 92, { light: { r: 50, color: '#ffb050', a: 0.6, flicker: true, oy: -40 } });
  b.prop('rock_moss', 44, 104, { solid: true });

  // ---- Deep Forest: corrupted portal landmark (world state) + mini event totem
  b.prop('corrupt_portal', 58, 72, { id: 'portal', solid: true, corruptOnly: true, light: { r: 80, color: '#a040ff', a: 0.6, oy: -60 } });
  b.prop('root_corrupt', 47, 73, { corruptOnly: true }); b.prop('root_corrupt', 60, 84, { corruptOnly: true, flip: true });
  b.prop('tree_ancient_b', 60, 73, { restoredOnly: true, solid: true });
  b.interact({ id: 'totem', kind: 'totem', tx: 51, ty: 76, prompt: 'Destroy Corrupted Totem' });

  // ---- Stone Circle landmark (ring of stones) + trail of glowing crystals toward the cracked wall (clue)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    b.prop(i % 2 ? 'runestone' : 'rock_pillar', 66 + Math.cos(a) * 5.5, 62 + Math.sin(a) * 4.2, { solid: true, scale: 0.8 });
  }
  b.prop('rune_circle', 66, 63, { layer: 'ground', glow: '#5ac8ff', alpha: 0.6 });
  for (const [x, y] of [[67, 57], [68.5, 56.2], [69.4, 55.2]]) b.prop('cry_purple_rock', x, y, { scale: 0.5, light: { r: 22, color: '#b050ff', a: 0.55 } });
  b.prop('tree_dead_a', 73, 56, { clue: true });
  b.propPx('crack', 70.5 * TILE, 55 * TILE, { id: 'cave_crack', crack: true, light: { r: 44, color: '#b050ff', a: 0.7, flicker: true, oy: -20 } });

  // ---- Hidden Cave interior
  b.prop('cry_big_purple', 88, 36, { solid: true, light: { r: 70, color: '#b050ff', a: 0.7 } });
  b.prop('cry_cyan_cluster', 78, 35, { light: { r: 40, color: '#5af0ff', a: 0.6 } });
  b.prop('cry_purple_cluster', 90, 46, { light: { r: 40, color: '#b050ff', a: 0.6 } });
  b.prop('cry_cyan_ground', 80, 47, { light: { r: 30, color: '#5af0ff', a: 0.5 } });
  b.prop('bones', 86, 44, {});
  b.interact({ id: 'chest_cave', kind: 'chest', tx: 88, ty: 38, loot: [{ item: 'eclipse_sigil', count: 1 }, { item: 'moon_crystal', count: 2 }], gold: 150, secret: 1, rare: true });
  b.interact({ id: 'lore_cave', kind: 'lore', tx: 75, ty: 35, lore: 'cave_mural', prompt: 'Examine Mural', secret: 1 });
  b.interact({ id: 'node_moon1', kind: 'resource', tx: 77, ty: 37, item: 'moon_crystal', secret: 1 });
  b.npc({ id: 'wanderer', name: 'Hollow Wanderer', role: '???', tx: 80, ty: 38, look: 'wanderer', secret: 1 });
  b.spawn('crystal_alpha', 85, 42, { id: 'alpha', unique: true, count: 1, radius: 0 });
  b.light(84, 41, 150, '#7a40c0', { a: 0.3 });

  // ---- Crystal Glade
  const cryst = [['cry_cyan_l', 72, 115], ['cry_cyan_m', 83, 116], ['cry_violet_l', 82, 125], ['cry_cyan_cluster', 70, 124], ['cry_white_l', 77, 112], ['cry_cyan_rock', 86, 121]];
  for (const [n, x, y] of cryst) b.prop(n, x, y, { solid: true, light: { r: 46, color: '#5af0ff', a: 0.55 } });
  b.prop('cry_big_mix', 77, 121, { solid: true, scale: 1.3, light: { r: 90, color: '#5af0ff', a: 0.55 } });
  b.interact({ id: 'chest_crystal', kind: 'chest', tx: 84, ty: 125, loot: [{ item: 'crystal_shard', count: 3 }, { item: 'hp_potion', count: 1 }], gold: 70 });
  b.interact({ id: 'node_c1', kind: 'resource', tx: 73, ty: 118, item: 'crystal_shard' });
  b.interact({ id: 'node_c2', kind: 'resource', tx: 81, ty: 119, item: 'crystal_shard' });
  b.interact({ id: 'lore_crystal', kind: 'lore', tx: 70, ty: 121, lore: 'crystal_song', prompt: 'Listen to the Crystal' });
  // bramble wall (shortcut: cut from the forest side)
  b.propPx('bramble', 68.5 * TILE, 147.5 * TILE, { id: 'bramble_prop', bramble: true });

  // ---- Ancient Forest Path landmarks
  b.prop('stone_gate', 80, 67, { scale: 0.9, solid: false });
  b.prop('ruin_statue_b', 86, 67, { solid: true }); b.prop('pillar_broken', 90, 74, { solid: true });
  b.prop('brazier_crystal', 92, 68, { solid: true, light: { r: 50, color: '#5af0ff', a: 0.6, oy: -40 } });
  b.interact({ id: 'lore_path', kind: 'lore', tx: 86, ty: 68, lore: 'path_statue', prompt: 'Read Statue Inscription' });

  // ---- sealed valley path (world state barrier)
  b.propPx('barrier', 32.5 * TILE, 38.5 * TILE, { id: 'valley_barrier', barrier: true, corruptOnly: true, w: 7 * TILE });
  b.prop('signpost', 34, 44, {});
  b.interact({ id: 'sign_valley', kind: 'sign', tx: 34, ty: 44, prompt: 'Read Sign', text: 'The old road north is choked with corrupted thorns.\nThey pulse in rhythm with something deep in the ruins…' });

  // ---------------- SPAWNS (before / after the Guardian falls)
  const W = 'wolf', G = 'goblin', C = 'crystal_beast';
  b.spawn(W, 47, 144, { count: 2, radius: 3, cond: 'always', tutorial: true });
  b.spawn(W, 38, 120, { count: 3, radius: 4, cond: 'before' });
  b.spawn(W, 38, 120, { count: 2, radius: 4, cond: 'after' });
  b.spawn(W, 20, 112, { count: 2, radius: 2, cond: 'before' });
  b.spawn(G, 22, 131, { count: 1, radius: 2, cond: 'before' });
  b.spawn(W, 54, 78, { count: 2, radius: 4, cond: 'before' });
  b.spawn(G, 52, 80, { count: 2, radius: 4, cond: 'before' });
  b.spawn(W, 53, 80, { count: 2, radius: 4, cond: 'after' });
  // (V2.2) the Goblin Glade itself is Grukk's boss arena: his pack waits on the paths into it
  b.spawn(G, 38, 66, { count: 2, radius: 2, cond: 'before' });
  b.spawn(G, 24, 68, { count: 1, radius: 2, cond: 'before' });
  b.spawn(G, 38, 66, { count: 1, radius: 2, cond: 'after' });
  b.spawn(W, 18, 80, { count: 2, radius: 3, cond: 'before' });
  b.spawn(G, 66, 62, { count: 2, radius: 3, cond: 'before' });
  b.spawn(W, 66, 62, { count: 2, radius: 3, cond: 'before' });
  b.spawn(C, 77, 119, { count: 2, radius: 4, cond: 'always' });
  b.spawn(W, 86, 70, { count: 2, radius: 3, cond: 'before' });
  b.spawn(W, 58, 104, { count: 2, radius: 3, cond: 'before' });
}

// HOWLING DEN (V2.2) — Hollow Fang's arena, an optional A1 mini-boss since W2 (data/bosses.js mini_hollow_fang). A clearing carved out of the
// canopy east of the River Crossing waystone, reached by one short path from the south bank. Built after the
// rest of the world so no other layout (or its random decoration) changes; trees left inside the carve are removed.
export function buildHowlingDen(b) {
  const m = b.m, F = T.FOREST_FLOOR;
  const cx = 58, cy = 113, r = 6; // integer tile centre (Builder brushes step whole tiles)
  b.disc(cx, cy, r, F, { noise: 0.5 });
  b.line([[56.5, 104], [57, 108.5]], 3, F, { noise: 0.2 });           // path from the bank
  b.disc(cx, cy, 2.2, T.DIRT, { noise: 0.6, only: [F] });              // trampled centre
  b.disc(cx + 3, cy + 3, 1.4, T.CORRUPT, { noise: 0.8, only: [F] });
  const den = m.addSubArea({ name: 'Howling Den', zone: Z.FOREST });
  b.subDisc(cx, cy, r + 1, den);
  for (const p of m.props) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y - 2) / TILE);
    if (!p.visible) continue;
    if (Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) <= r + 0.8 || (tx >= 55 && tx <= 59 && ty >= 103 && ty <= 109)) {
      p.visible = false;
      if (p.solid) { m.setPropSolid(p, false); p.solid = false; }
    }
  }
  // bones + a few rocks for the den (ground decals only: nothing to snag on during the fight)
  for (const [x, y, n] of [[55.5, 110, 'pebble_a'], [61, 115.5, 'pebble_a'], [54.5, 116, 'grass_a'], [62, 109, 'grass_a']]) b.prop(n, x, y, { layer: 'ground' });
}
