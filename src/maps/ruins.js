import { T, Z, TILE } from '../core/constants.js';

// ANCIENT RUINS — 64x64 (tiles x 100..163, y 64..127)
// Forest Entrance (west) -> Outer Ruins -> Ruin Courtyard -> Ancient Shrine -> Guardian Gate (north).
export function buildRuins(b) {
  const m = b.m;
  const X0 = 100, Y0 = 64, X1 = 163, Y1 = 127;
  b.zoneRect(X0, Y0, X1, Y1, Z.RUINS);
  const S = (name, extra = {}) => m.addSubArea({ name, zone: Z.RUINS, ...extra });
  const A = { outer: S('Outer Ruins'), court: S('Ruin Courtyard'), shrine: S('Ancient Shrine'), hidden: S('Sealed Archive', { secret: 4 }) };
  b.rect(X0, Y0, X1, Y1, T.CLIFF);

  // Outer ruins: overgrown stone
  b.line([[96, 71], [104, 71], [110, 76], [114, 86], [120, 94]], 6, T.MOSS_STONE);
  b.ellipse(110, 82, 9, 10, T.MOSS_STONE, { noise: 2 });
  b.ellipse(108, 104, 7, 8, T.MOSS_STONE, { noise: 2 });
  b.line([[110, 82], [108, 104], [104, 112], [100, 112]], 5, T.MOSS_STONE);
  b.disc(110, 82, 4, T.FOREST_FLOOR, { only: [T.MOSS_STONE], noise: 2 });
  b.subRect(96, 64, 121, 127, A.outer);

  // Courtyard: big open ruin floor
  b.rect(122, 86, 150, 112, T.RUIN);
  b.ellipse(136, 99, 15, 14, T.RUIN, { noise: 1.5 });
  b.line([[120, 94], [124, 98]], 6, T.RUIN);
  b.subRect(122, 84, 151, 114, A.court);

  // Shrine hall (north), walls with a south doorway
  b.rect(126, 66, 146, 81, T.RUIN);
  b.rect(125, 65, 147, 65, T.RUIN_WALL);
  b.rect(125, 65, 125, 82, T.RUIN_WALL); b.rect(147, 65, 147, 82, T.RUIN_WALL);
  b.rect(125, 82, 133, 82, T.RUIN_WALL); b.rect(139, 82, 147, 82, T.RUIN_WALL);
  b.rect(134, 82, 138, 86, T.RUIN);
  b.rect(134, 64, 138, 65, T.RUIN); // north doorway to the gate
  b.subRect(126, 64, 146, 81, A.shrine);

  // broken walls around the courtyard (gaps keep it readable)
  b.rect(121, 86, 121, 92, T.RUIN_WALL); b.rect(121, 100, 121, 112, T.RUIN_WALL);
  b.rect(151, 86, 151, 106, T.RUIN_WALL); b.rect(151, 111, 151, 113, T.RUIN_WALL);
  b.rect(122, 113, 132, 113, T.RUIN_WALL); b.rect(140, 113, 151, 113, T.RUIN_WALL);
  b.rect(133, 113, 139, 118, T.MOSS_STONE); b.ellipse(136, 120, 5, 3, T.MOSS_STONE, { noise: 1 });

  // Hidden archive (secret) east, behind a breakable glyph wall at x 151, y 107..110
  b.rect(152, 102, 160, 115, T.RUIN);
  b.rect(151, 107, 151, 110, T.RUIN_WALL);
  b.regions.archiveWall = { tx0: 151, ty0: 107, tx1: 151, ty1: 110 };
  b.secretRect(152, 101, 161, 116, 4);
  b.subRect(152, 101, 161, 116, A.hidden);

  // side gate (shortcut to forest): corridor x 96..103, y 111..113; gate blocks at x 100..101 until the lever is pulled
  b.rect(96, 111, 104, 113, T.MOSS_STONE);

  // ----- props
  const edge = ['column_broken', 'pillar_broken', 'rubble_a', 'rubble_b', 'ruin_wall_c', 'rock_moss'];
  b.scatter(101, 66, 120, 118, edge, 14, { on: [T.MOSS_STONE, T.FOREST_FLOOR], solid: true, minGap: 4, keepClear: [[110, 82, 4], [108, 104, 4]] });
  b.scatter(101, 66, 150, 120, ['grass_a', 'fern_a', 'pebble_a', 'twig_a', 'flower_c'], 70, { on: [T.MOSS_STONE, T.RUIN, T.FOREST_FLOOR] });
  b.prop('arch_broken', 104, 70, {}); b.prop('ruin_statue_a', 114, 78, { solid: true }); b.prop('column_a', 106, 88, { solid: true });
  b.prop('ruin_wall_a', 112, 96, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]] });
  b.prop('tree_ancient_a', 116, 74, { solid: true }); b.prop('root_moss', 105, 100, {});
  b.prop('stairs_a', 136, 84, { layer: 'ground' });

  // courtyard: pillars on the rim only, centre open
  for (const [x, y] of [[124, 88], [148, 88], [124, 110], [148, 110], [130, 87], [142, 87]]) b.prop('column_a', x, y, { solid: true });
  b.prop('rune_circle', 136, 99, { layer: 'ground', scale: 1.6, glow: '#5ac8ff', alpha: 0.55 });
  b.prop('brazier_blue', 131, 94, { solid: true, light: { r: 60, color: '#5ab8ff', a: 0.7, flicker: true, oy: -20 } });
  b.prop('brazier_blue', 141, 94, { solid: true, light: { r: 60, color: '#5ab8ff', a: 0.7, flicker: true, oy: -20 } });
  b.prop('ruin_statue_c', 127, 104, { solid: true }); b.prop('ruin_statue_b', 145, 104, { solid: true });
  b.interact({ id: 'ws_ruins', kind: 'waystone', tx: 136, ty: 110, name: 'Ruin Courtyard', prompt: 'Waystone' });
  b.interact({ id: 'lore_court', kind: 'lore', tx: 127, ty: 105, lore: 'court_tablet', prompt: 'Read Tablet' });
  b.interact({ id: 'chest_court', kind: 'chest', tx: 148, ty: 90, loot: [{ item: 'hp_potion', count: 2 }, { item: 'shadow_tonic', count: 1 }], gold: 90 });

  // shrine hall
  b.prop('shrine_altar', 136, 69, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], light: { r: 90, color: '#5af0ff', a: 0.7, oy: -24 } });
  b.prop('magic_circle', 136, 73, { layer: 'ground', glow: '#5af0ff', alpha: 0.8 });
  for (const [x, y] of [[129, 70], [143, 70], [129, 77], [143, 77]]) b.prop('statue_hooded', x, y, { solid: true });
  b.prop('crystal_pillar', 131, 67, { solid: true, light: { r: 40, color: '#5af0ff', a: 0.6 } });
  b.prop('crystal_pillar', 141, 67, { solid: true, light: { r: 40, color: '#5af0ff', a: 0.6 } });
  b.interact({ id: 'ancient_shrine', kind: 'shrine', tx: 136, ty: 70, prompt: 'Investigate Ancient Shrine', radius: 44 });
  b.interact({ id: 'lore_shrine', kind: 'lore', tx: 129, ty: 71, lore: 'guardian_oath', prompt: 'Read Statue Plaque' });

  // side gate + lever
  b.propPx('gate_closed', 100.5 * TILE, 114 * TILE, { id: 'side_gate', scale: 0.55, sideGate: true });
  b.interact({ id: 'lever_side', kind: 'lever', tx: 104, ty: 110, shortcut: 'ruinsGate', prompt: 'Pull Lever', needSide: 'east' });
  b.prop('pillar_a', 104, 110, { scale: 0.6 });

  // hidden archive
  b.propPx('glyph', 151.5 * TILE, 111 * TILE, { id: 'archive_glyph', glyph: true, light: { r: 40, color: '#5af0ff', a: 0.7, flicker: true, oy: -40 } });
  b.prop('crystal_pedestal', 157, 106, { solid: true, secret: 4, light: { r: 50, color: '#5af0ff', a: 0.7 } });
  b.interact({ id: 'chest_archive', kind: 'chest', tx: 159, ty: 110, loot: [{ item: 'shadeweave', count: 1 }, { item: 'crystal_shard', count: 2 }], gold: 120, secret: 4, rare: true });
  b.interact({ id: 'lore_archive', kind: 'lore', tx: 156, ty: 106, lore: 'archive_record', prompt: 'Read Crystal Record', secret: 4 });
  b.prop('stairs_b', 154, 113, { layer: 'ground', secret: 4 });


  // spawns
  b.spawn('goblin', 110, 82, { count: 2, radius: 4, cond: 'always' });
  b.spawn('wolf', 108, 104, { count: 2, radius: 3, cond: 'before' });
  b.spawn('crystal_beast', 136, 100, { count: 2, radius: 6, cond: 'always' });
  b.spawn('goblin', 140, 104, { count: 1, radius: 3, cond: 'always' });
}

// GUARDIAN GATE — narrowing corridor north of the shrine (x 126..146, y 48..64) and GUARDIAN ARENA (x 112..151, y 8..47)
export function buildGateAndArena(b) {
  const m = b.m;
  b.zoneRect(122, 47, 150, 63, Z.GATE);
  const gate = m.addSubArea({ name: 'Guardian Gate', zone: Z.GATE, ancient: true });
  b.rect(118, 44, 154, 63, T.CANOPY);
  // funnel: wide -> narrow -> opens dramatically
  for (let y = 48; y <= 63; y++) {
    const half = y > 58 ? 4 : y > 53 ? 3 - (y < 56 ? 1 : 0) + 1 : 2;
    b.rect(136 - half, y, 136 + half, y, y > 58 ? T.RUIN : T.MOSS_STONE);
  }
  b.subRect(122, 47, 150, 63, gate);
  b.regions.gateSeal = { tx0: 131, ty0: 56, tx1: 141, ty1: 56 };
  b.propPx('big_gate', 136.5 * TILE, 57 * TILE, { id: 'guardian_gate', scale: 0.62, gateProp: true, light: { r: 70, color: '#5af0ff', a: 0.6, oy: -50 } });
  b.prop('ruin_statue_a', 131, 61, { solid: true }); b.prop('ruin_statue_c', 141, 61, { solid: true, flip: true });
  b.prop('root_moss', 133, 52, {}); b.prop('cry_cyan_m', 139, 50, { light: { r: 30, color: '#5af0ff', a: 0.6 } });
  b.prop('cry_cyan_s', 133, 49, { light: { r: 24, color: '#5af0ff', a: 0.5 } });
  b.edgeTrees(118, 44, 154, 63, ['tree_ancient_a', 'tree_ancient_c', 'deep_tree_a', 'deep_tree_d'], 0.8);
  b.interact({ id: 'gate_seal', kind: 'gateSeal', tx: 136, ty: 57, prompt: 'Examine the Sealed Gate', radius: 46 });
  b.interact({ id: 'trig_guardian', kind: 'trigger', tx: 136, ty: 51, radius: 70, discover: 'guardian' });

  // ---------- ARENA
  const X0 = 112, Y0 = 8, X1 = 151, Y1 = 47;
  b.zoneRect(X0, Y0, X1, Y1 - 1, Z.ARENA);
  const ar = m.addSubArea({ name: 'Guardian Arena', zone: Z.ARENA });
  b.rect(X0 - 4, Y0 - 6, X1 + 4, Y1, T.CANOPY);
  b.ellipse(132, 28, 18.5, 18.5, T.FOREST_FLOOR, { noise: 1.5 });
  b.disc(132, 28, 15.5, T.ARENA, { noise: 0.4 });
  b.disc(132, 28, 16.5, T.MOSS_STONE, { noise: 0.5, only: [T.FOREST_FLOOR] });
  b.line([[136, 48], [136, 44], [133, 40]], 5, T.MOSS_STONE); // player entrance (south)
  b.rect(134, 44, 138, 47, T.MOSS_STONE);
  b.subRect(X0, Y0, X1, Y1 - 1, ar);
  b.regions.arena = { x0: (X0 + 1) * TILE, y0: (Y0 + 1) * TILE, x1: (X1) * TILE, y1: (Y1 - 1) * TILE };
  b.regions.arenaCenter = { x: 132.5 * TILE, y: 28 * TILE };
  b.regions.arenaSeal = { tx0: 133, ty0: 45, tx1: 139, ty1: 46 };
  b.regions.arenaRadius = 15.5 * TILE;

  // landmarks N/E/W (S = entrance)
  b.prop('shrine_altar', 132, 10, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], scale: 1.2, light: { r: 90, color: '#5af0ff', a: 0.6, oy: -30 } });
  b.prop('cry_big_mix', 150, 29, { solid: true, scale: 1.8, arenaCrystal: true, light: { r: 100, color: '#5af0ff', a: 0.6, oy: -40 } });
  b.prop('cry_cyan_l', 149, 25, { solid: true, light: { r: 40, color: '#5af0ff', a: 0.5 } });
  b.prop('cry_cyan_m', 149, 33, { solid: true });
  b.prop('ruin_statue_b', 113, 29, { solid: true, scale: 1.4 });
  b.prop('pillar_broken', 115, 24, { solid: true }); b.prop('rubble_c', 115, 33, {});
  // rim decoration: trees, rocks, crystals kept outside the fighting ring
  const ring = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const x = 132 + Math.cos(a) * 17.8, y = 28 + Math.sin(a) * 17.8;
    if (y > 40 && Math.abs(x - 135) < 5) continue; // keep entrance clear
    if (Math.abs(a) < 0.25 || Math.abs(a - Math.PI) < 0.25 || Math.abs(a + Math.PI / 2) < 0.2) continue; // landmarks
    ring.push([x, y]);
  }
  ring.forEach(([x, y], i) => {
    const n = i % 3 === 0 ? 'rock_moss' : i % 3 === 1 ? 'cry_cyan_rock' : 'rock_l2';
    b.prop(n, x, y, { solid: true, scale: 0.9, phaseCrystal: n === 'cry_cyan_rock' });
  });
  b.edgeTrees(X0 - 4, Y0 - 6, X1 + 4, Y1, ['tree_ancient_a', 'tree_ancient_c', 'deep_tree_a', 'deep_tree_d', 'tree_teal_a', 'tree_large_pine'], 0.9);
  b.propPx('arenaRings', 132.5 * TILE, 28.5 * TILE, { layer: 'ground', arenaRings: true, r: 15 * TILE });
  b.prop('magic_circle', 132, 28, { layer: 'ground', scale: 2.2, glow: '#5af0ff', alpha: 0.35, arenaSigil: true });
  b.spawn('guardian', 132, 22, { id: 'guardian', unique: true, count: 1, radius: 0, cond: 'before' });
}

// ANCIENT VALLEY — A2 teaser (x 8..63, y 2..29), opened after the Guardian falls.
export function buildValley(b) {
  const m = b.m;
  b.zoneRect(8, 1, 63, 29, Z.VALLEY);
  const va = m.addSubArea({ name: 'Ancient Valley', zone: Z.VALLEY });
  const dg = m.addSubArea({ name: 'Sealed Depths', zone: Z.VALLEY });
  b.ellipse(34, 16, 22, 11, T.VALLEY, { noise: 2.5 });
  b.line([[32, 29], [33, 22], [34, 16]], 5, T.VALLEY);
  b.line([[32, 29], [33, 22], [34, 14], [36, 7]], 2, T.DIRT);
  b.ellipse(48, 18, 6, 4, T.FLOWERS, { noise: 1.5, only: [T.VALLEY] });
  b.disc(20, 14, 3.2, T.SHALLOW, { noise: 1 });
  b.rect(31, 2, 41, 6, T.RUIN);
  b.rect(30, 1, 42, 1, T.RUIN_WALL);
  b.subRect(8, 1, 63, 29, va);
  b.subRect(30, 1, 42, 7, dg);
  b.edgeTrees(6, 0, 65, 30, ['tree_large_a', 'tree_large_b', 'tree_round_b', 'tree_ancient_c', 'tree_pine_a'], 0.8);
  b.scatter(12, 4, 58, 28, ['flower_a', 'flower_b', 'grass_a', 'grass_b', 'pebble_a'], 90, { on: [T.VALLEY] });
  // standing stones + distant landmark
  for (const [x, y] of [[24, 10], [44, 9], [50, 22], [18, 20], [28, 24]]) b.prop('runestone', x, y, { solid: true, light: { r: 30, color: '#ffd080', a: 0.4, oy: -30 } });
  b.prop('tree_ancient_b', 54, 13, { solid: true, scale: 1.5 });
  b.prop('gate_sealed', 36, 5, { solid: true, footprint: [[-1, 0], [0, 0], [1, 0]], light: { r: 80, color: '#b050ff', a: 0.7, oy: -40 } });
  b.prop('brazier_crystal', 32, 6, { solid: true, light: { r: 40, color: '#b050ff', a: 0.6, oy: -30 } });
  b.prop('brazier_crystal', 40, 6, { solid: true, light: { r: 40, color: '#b050ff', a: 0.6, oy: -30 } });
  b.interact({ id: 'dungeon', kind: 'dungeon', tx: 36, ty: 6, prompt: 'Examine the Sealed Depths', radius: 50 });
  b.interact({ id: 'lore_valley', kind: 'lore', tx: 24, ty: 10, lore: 'valley_stone', prompt: 'Read Standing Stone' });
  b.npc({ id: 'scout', name: 'Scout Wren', role: 'Guild Scout', tx: 31, ty: 22, look: 'scout' });
  b.spawn('wraith', 42, 15, { count: 2, radius: 5, cond: 'after' });
  b.spawn('wraith', 22, 16, { count: 1, radius: 3, cond: 'after' });
  b.regions.valleyEntry = { x: 32.5 * TILE, y: 27 * TILE };
}
