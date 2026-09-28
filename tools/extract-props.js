// Extracts individual props from the asset-set sheets in /ของแมพ (dark navy background)
// and packs them into assets/props/props.png + props.json.
// Each manifest entry picks the connected blob under a point, or everything inside a box.
// Usage: node tools/extract-props.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'Map', 'ของแมพ');
const OUT = path.join(ROOT, 'assets', 'props');
fs.mkdirSync(OUT, { recursive: true });

// name: [sheet, x, y] (blob under point) or [sheet, x0, y0, x1, y1] (box). Optional scale as last numeric arg via object form.
const F = 'FOREST SET.png', A = 'FANTASY SET.png', V = 'VILLAGE SET.png';
// W3: the owner's per-map prop sheets (2048 px, drawn at twice the pixel size of the 1024 sets -> SCALE 0.5).
// Coordinates in the manifest are in the sheet's own pixels. A2 = Ancient Valley props, names 'v_*'.
const A2P = '../A/a2/image-bf40810d-ac8c-4bed-a831-af8840274bbe-0';
const A3P = '../A/a3/image-cffd3904-429f-435a-85d6-3b6b93bed0a8-0';
const CP = '../City/ASTERIA CITY/image-6fbe1327-6060-4dcf-be43-116029029bdb-0';
const SCALE = { [A2P]: 0.5, [A3P]: 0.5 }; // the city sheet (CP) stays full size: its buildings are drawn large
// sheets whose background is not the navy of the old sets: their own background test. `fillHoles` = box mode keeps
// background-coloured pixels enclosed by the prop (dark grey stone inside the city buildings)
const GREY_BG = (r, g, b) => { const l = (r + g + b) / 3; return l >= 24 && l <= 58 && Math.max(r, g, b) - Math.min(r, g, b) <= 8; };
const SHEET_BG = { [CP]: GREY_BG };
const FILL_HOLES = new Set([CP]);
const MANIFEST = {
  // ---- forest
  tree_small_a: [F, 35, 90], tree_small_b: [F, 78, 88],
  tree_pine_a: [F, 140, 90], tree_round_a: [F, 190, 85], tree_round_b: [F, 240, 90], tree_teal_a: [F, 240, 145],
  tree_pine_b: [F, 140, 150], tree_round_c: [F, 190, 150],
  tree_large_a: [F, 278, 52, 362, 149], tree_large_pine: [F, 395, 105], tree_large_b: [F, 278, 151, 362, 262], tree_large_pine_b: [F, 395, 195],
  tree_ancient_a: [F, 488, 90], tree_ancient_b: [F, 482, 205], tree_ancient_c: [F, 550, 135],
  tree_dead_a: [F, 620, 80], tree_dead_b: [F, 678, 85], stump_a: [F, 615, 235], stump_b: [F, 675, 235],
  log_a: [F, 780, 90], log_b: [F, 780, 195],
  tree_corrupt_a: [F, 918, 95], tree_corrupt_b: [F, 980, 95], tree_corrupt_c: [F, 918, 205], tree_corrupt_d: [F, 980, 205],
  bush_a: [F, 40, 340], bush_b: [F, 108, 340], bush_flower: [F, 175, 340], bush_blue: [F, 245, 340],
  bush_c: [F, 40, 405], bush_d: [F, 108, 405], bush_berry: [F, 175, 405], bush_e: [F, 245, 405],
  rock_s: [F, 315, 345], rock_m: [F, 372, 340], rock_l: [F, 445, 335], rock_moss: [F, 523, 340], rock_block: [F, 598, 340],
  rock_l2: [F, 445, 410], rock_pillar: [F, 598, 405], rock_m2: [F, 385, 410], rock_moss2: [F, 523, 410],
  grass_a: [F, 675, 330], grass_b: [F, 725, 330], fern_a: [F, 675, 375], flower_a: [F, 815, 375], flower_b: [F, 862, 378],
  flower_c: [F, 960, 378], twig_a: [F, 870, 330], shroom_tiny: [F, 970, 330], pebble_a: [F, 940, 418],
  root_a: [F, 110, 520], root_b: [F, 185, 520], root_c: [F, 285, 525], root_moss: [F, 365, 520], root_corrupt: [F, 440, 520],
  mush_red: [F, 655, 530], mush_blue: [F, 735, 530], mush_purple: [F, 812, 530], mush_cyan: [F, 893, 530], mush_cluster: [F, 970, 535],
  giant_tree: [F, 70, 660], fallen_log: [F, 200, 680], stone_gate: [F, 345, 665], gravestone: [F, 460, 680],
  signpost: [F, 530, 680], tent: [F, 640, 665], campfire: [F, 765, 690], grave_cross: [F, 855, 675], corrupt_portal: [F, 955, 665],
  deep_tree_a: [F, 385, 830], deep_tree_b: [F, 440, 825], deep_tree_d: [F, 550, 820],
  corrupt_tree_e: [F, 730, 830], corrupt_tree_f: [F, 785, 830], corrupt_tree_g: [F, 840, 830],
  // ---- fantasy / ruins
  cry_cyan_s: [A, 88, 85], cry_cyan_m: [A, 62, 112, 114, 158], cry_cyan_l: [A, 60, 160, 116, 218], cry_cyan_cluster: [A, 88, 290],
  cry_cyan_ground: [A, 88, 445], cry_cyan_rock: [A, 88, 390], cry_violet_l: [A, 133, 160, 188, 218], cry_purple_l: [A, 203, 160, 258, 218],
  cry_purple_cluster: [A, 230, 290], cry_purple_rock: [A, 230, 390], cry_purple_ground: [A, 230, 445], cry_white_l: [A, 275, 160, 328, 218],
  cry_violet_m: [A, 135, 112, 185, 158], cry_purple_m: [A, 205, 112, 255, 158],
  cry_big_purple: [A, 380, 65], cry_big_mix: [A, 440, 65],
  shrine_altar: [A, 595, 65], magic_circle: [A, 695, 70], stone_plaque: [A, 595, 150], star_circle: [A, 695, 150],
  pillar_a: [A, 553, 200, 598, 288], statue_hooded: [A, 632, 245], pillar_broken: [A, 710, 245],
  crystal_pillar: [A, 585, 340], statue_b: [A, 655, 345], statue_c: [A, 710, 345],
  brazier_crystal: [A, 580, 425], brazier_blue: [A, 640, 425], brazier_c: [A, 700, 425],
  ruin_wall_a: [A, 805, 65], ruin_wall_b: [A, 880, 65], ruin_wall_c: [A, 975, 65], rubble_a: [A, 970, 130],
  arch_a: [A, 805, 205], arch_b: [A, 880, 210], arch_broken: [A, 975, 210],
  column_a: [A, 780, 285], column_b: [A, 825, 285], column_broken: [A, 870, 280], rubble_b: [A, 975, 290],
  ruin_statue_a: [A, 785, 360], ruin_statue_b: [A, 845, 360], ruin_statue_c: [A, 910, 360], rubble_c: [A, 975, 360],
  stairs_a: [A, 785, 430], stairs_b: [A, 880, 430], rubble_d: [A, 975, 425],
  ruin_gate_a: [A, 795, 530], ruin_gate_b: [A, 885, 530], ruin_gate_c: [A, 935, 478, 1012, 588],
  rune_star: [A, 40, 575], rune_circle: [A, 125, 575], rune_diamond: [A, 275, 575], rune_purple: [A, 360, 575], rune_crest: [A, 440, 575],
  magic_orb: [A, 535, 660], crystal_stand: [A, 605, 660], crystal_pedestal: [A, 680, 660], rune_disc: [A, 765, 668],
  portal_ring: [A, 840, 660], magic_lamp: [A, 915, 660], runestone: [A, 985, 665],
  big_gate: [A, 18, 700, 235, 840], gate_closed: [A, 20, 855, 150, 975], gate_broken: [A, 170, 855, 300, 975],
  gate_sealed: [A, 320, 855, 450, 975], gate_open: [A, 465, 855, 600, 975],
  corrupt_crack: [A, 690, 780], corrupt_roots: [A, 770, 780], corrupt_circle: [A, 865, 780], corrupt_crystal: [A, 965, 780],
  corrupt_root2: [A, 690, 860], corrupt_growth: [A, 770, 860], corrupt_pillar: [A, 870, 860], corrupt_crystal2: [A, 965, 860],
  corrupt_rock: [A, 690, 945], corrupt_glow: [A, 828, 912, 902, 978], corrupt_crystal3: [A, 965, 945], corrupt_node: [A, 770, 945],
  // ---- village
  guild_hall: [V, 15, 765, 125, 870], guild_front: [V, 128, 765, 228, 870], guild_sign: [V, 262, 800],
  guild_board: [V, 268, 840], big_fountain: [V, 395, 815], vine_arch: [V, 590, 810], banner_arch: [V, 495, 810],
  notice_board: [V, 380, 940], bell_shrine: [V, 510, 920], stone_shrine: [V, 580, 915], lantern_post: [V, 625, 935],
  village_gate: [V, 665, 760, 1015, 925],
  lantern_hang: [V, 825, 345], lamppost: [V, 878, 385], lantern_double: [V, 955, 345], lantern_crystal: [V, 985, 430], lantern_b: [V, 828, 420], lantern_c: [V, 930, 430],
  forge: [V, 460, 555], forge_b: [V, 532, 555], anvil: [V, 585, 568], tools_rack: [V, 635, 555], chimney: [V, 680, 545],
  weapon_rack: [V, 460, 632], weapon_rack_b: [V, 545, 632], bucket_a: [V, 610, 622], bucket_b: [V, 648, 622],
  shop_stall: [V, 790, 550], potion_shelf: [V, 890, 530], crate_potions: [V, 960, 520], shop_table: [V, 845, 635],
  banner_blue: [V, 910, 635], banner_b: [V, 990, 690], goods_table: [V, 845, 695],
  barrel_a: [V, 370, 330], barrel_b: [V, 405, 330], crate_a: [V, 437, 335], crate_b: [V, 462, 335], cart: [V, 520, 330],
  wheel: [V, 582, 330], firewood: [V, 632, 330], hay: [V, 690, 330],
  bench_a: [V, 380, 380], bench_b: [V, 428, 380], table_a: [V, 495, 382], chair_a: [V, 560, 382], bench_c: [V, 620, 380],
  sign_a: [V, 685, 380], board_a: [V, 745, 380],
  flowerbox_a: [V, 377, 440], flowerpot_a: [V, 478, 440], flowerbox_b: [V, 560, 440], sack: [V, 640, 440], flowerpot_b: [V, 690, 440], cloth_crate: [V, 745, 440],
  fountain_s: [V, 160, 535], angel_statue: [V, 228, 535], fountain_basin: [V, 300, 535],
  fence_wood: [V, 15, 305, 125, 345], fence_wood_b: [V, 132, 305, 228, 345], fence_stone: [V, 235, 305, 330, 345],
  well_tower: [V, 545, 225], shrine_small: [V, 595, 230],
  // ---- A2 ANCIENT VALLEY (owner's sheet desgin/Map/A/a2): terraced cliffs, falls, bridges, ruins, pines
  v_cliff_a: [A2P, 93, 120], v_cliff_b: [A2P, 176, 21, 352, 225], v_cliff_arch: [A2P, 1072, 124], v_waterfall: [A2P, 1326, 167], v_cliff_cave_big: [A2P, 1754, 198],
  v_plateau: [A2P, 150, 340], v_cliff_cave: [A2P, 396, 338], v_cliff_fall: [A2P, 632, 340], v_pond_a: [A2P, 851, 356], v_plateau_stream: [A2P, 1101, 342],
  v_rock_pillar: [A2P, 1331, 414], v_bridge_arch: [A2P, 1551, 383], v_cascade: [A2P, 1735, 475], v_rocks: [A2P, 1942, 317], v_rock_heap: [A2P, 1927, 497],
  v_torch_pillar: [A2P, 76, 507], v_bridge_a: [A2P, 182, 523], v_bridge_b: [A2P, 389, 512], v_bridge_c: [A2P, 633, 518],
  v_pond_b: [A2P, 959, 531], v_pond_c: [A2P, 1192, 515], v_pond_d: [A2P, 1445, 522], v_statue: [A2P, 1334, 705],
  v_gold_gate: [A2P, 209, 715], v_temple: [A2P, 1044, 728], v_gold_shrine: [A2P, 1796, 730], v_pillar_a: [A2P, 451, 682], v_pillar_b: [A2P, 538, 677],
  v_ruin_platform: [A2P, 737, 730], v_pillar_c: [A2P, 1438, 666], v_obelisk: [A2P, 1537, 804], v_brazier: [A2P, 1629, 818], v_rubble_a: [A2P, 1974, 798],
  v_block_a: [A2P, 447, 799], v_block_b: [A2P, 535, 798],
  v_pine_a: [A2P, 75, 936], v_pine_b: [A2P, 172, 949], v_pine_c: [A2P, 283, 951], v_pine_d: [A2P, 406, 964], v_pine_pair: [A2P, 579, 964], v_pine_e: [A2P, 769, 964],
  v_dead_a: [A2P, 893, 959], v_dead_b: [A2P, 981, 1018], v_bush_a: [A2P, 1108, 962], v_pine_f: [A2P, 1246, 991], v_dead_c: [A2P, 1378, 970], v_pine_g: [A2P, 1484, 987],
  v_pine_h: [A2P, 1586, 967], v_pine_i: [A2P, 1688, 951], v_pine_j: [A2P, 1792, 991], v_bare_a: [A2P, 1889, 975], v_bare_b: [A2P, 1944, 1018],
  v_rock_a: [A2P, 77, 1094], v_rock_b: [A2P, 186, 1121], v_bush_b: [A2P, 289, 1123], v_bush_c: [A2P, 395, 1129], v_bush_d: [A2P, 535, 1130], v_bush_e: [A2P, 648, 1122],
  v_bush_f: [A2P, 734, 1122], v_bush_g: [A2P, 838, 1113], v_rock_c: [A2P, 1122, 1092], v_log_a: [A2P, 1346, 1109], v_log_b: [A2P, 1801, 1116],
  v_wall_a: [A2P, 58, 1265], v_ruin_b: [A2P, 144, 1233], v_ruin_c: [A2P, 264, 1246], v_ruin_d: [A2P, 383, 1238],
  v_gold_pillar: [A2P, 1196, 1310], v_lamp_post: [A2P, 1282, 1309], v_ruin_arch: [A2P, 1484, 1308], v_lamp_b: [A2P, 1582, 1313],
  v_banner_a: [A2P, 1649, 1494], v_banner_b: [A2P, 1740, 1494], v_banner_c: [A2P, 1821, 1496], v_grass_tall: [A2P, 1135, 1482], v_grass_b: [A2P, 1214, 1474],
  v_flower_a: [A2P, 65, 1600], v_flower_b: [A2P, 295, 1597], v_flower_c: [A2P, 496, 1595], v_grass_c: [A2P, 857, 1593],
  v_mushroom: [A2P, 1754, 1626], v_mushroom_red: [A2P, 1876, 1619], v_skulls: [A2P, 1215, 1672], v_pebbles: [A2P, 1203, 1757],
  // ---- A3 RUNE CITADEL (owner's sheet desgin/Map/A/a3): buildings, gates, banners, lamps, golden trees (boxes)
  c_statue_plaza: [A3P, 12, 23, 415, 365], c_plaza_ring: [A3P, 425, 92, 718, 335], c_crystal_shrine: [A3P, 737, 32, 892, 241], c_chapel: [A3P, 907, 27, 1101, 241],
  c_pit: [A3P, 1119, 20, 1457, 350], c_gold_gate: [A3P, 1466, 65, 1792, 334], c_dome: [A3P, 1801, 65, 2033, 337], c_obelisk_s: [A3P, 761, 263, 871, 365],
  c_shrine_s: [A3P, 890, 260, 983, 359], c_ruin_s: [A3P, 997, 270, 1105, 351], c_tower_a: [A3P, 11, 393, 109, 497], c_tower_b: [A3P, 121, 376, 231, 502],
  c_tower_c: [A3P, 244, 365, 348, 505], c_tower_d: [A3P, 371, 382, 516, 510], c_tower_e: [A3P, 524, 358, 657, 508], c_tower_f: [A3P, 667, 367, 780, 505],
  c_house_a: [A3P, 797, 403, 882, 506], c_house_b: [A3P, 896, 379, 996, 503], c_house_c: [A3P, 1010, 375, 1113, 503], c_crystal_spire: [A3P, 1119, 359, 1237, 509],
  c_fall_ruin: [A3P, 1253, 364, 1423, 510], c_fall_b: [A3P, 1431, 363, 1545, 529], c_pool_ruin: [A3P, 1550, 355, 1825, 555], c_stair_ruin: [A3P, 1876, 372, 2035, 591],
  c_wall_a: [A3P, 10, 526, 139, 652], c_wall_b: [A3P, 152, 512, 261, 655], c_wall_c: [A3P, 269, 517, 358, 655], c_stairs_a: [A3P, 353, 528, 468, 657],
  c_house_d: [A3P, 482, 515, 593, 659], c_house_e: [A3P, 606, 533, 719, 660], c_house_f: [A3P, 732, 534, 825, 661], c_house_g: [A3P, 837, 529, 954, 662],
  c_house_h: [A3P, 969, 512, 1068, 654], c_well: [A3P, 1079, 549, 1161, 665], c_house_i: [A3P, 1169, 518, 1273, 662], c_house_j: [A3P, 1285, 531, 1380, 661],
  c_wall_long: [A3P, 10, 664, 206, 825], c_gate_a: [A3P, 223, 673, 309, 819], c_pillar_a: [A3P, 318, 692, 385, 823], c_gate_b: [A3P, 394, 673, 480, 823],
  c_stairs_b: [A3P, 484, 688, 607, 830], c_ruin_c: [A3P, 614, 674, 735, 830], c_stairs_c: [A3P, 744, 695, 872, 817], c_wall_d: [A3P, 879, 673, 961, 821],
  c_statue_s: [A3P, 967, 673, 1061, 823], c_banner_house: [A3P, 1078, 681, 1211, 823], c_crystal_obelisk: [A3P, 1217, 673, 1313, 822], c_stairs_d: [A3P, 1314, 668, 1449, 818],
  c_pillar_b: [A3P, 1570, 696, 1615, 825], c_wall_banner: [A3P, 1717, 698, 1856, 835], c_pillar_banner: [A3P, 1866, 718, 1940, 825], c_banner_a: [A3P, 17, 1180, 72, 1297],
  c_banner_b: [A3P, 83, 1182, 142, 1303], c_banner_arch: [A3P, 161, 1163, 294, 1315], c_banner_purple: [A3P, 330, 1185, 406, 1319], c_tent_a: [A3P, 444, 1165, 570, 1308],
  c_tent_b: [A3P, 578, 1167, 745, 1304], c_tent_c: [A3P, 749, 1164, 916, 1302], c_crates: [A3P, 927, 1164, 1048, 1290], c_stall: [A3P, 1061, 1168, 1184, 1302],
  c_rubble_a: [A3P, 1311, 1183, 1443, 1278], c_gold_tree: [A3P, 1474, 1250, 1598, 1383], c_rock_spire: [A3P, 1907, 1192, 2041, 1381], c_tree_s: [A3P, 1561, 1345, 1662, 1437],
  c_bush_a: [A3P, 15, 1429, 122, 1498], c_bush_b: [A3P, 134, 1426, 220, 1507], c_bush_c: [A3P, 231, 1419, 337, 1511], c_bush_d: [A3P, 343, 1439, 464, 1512],
  c_bush_wide: [A3P, 712, 1415, 927, 1528], c_bush_e: [A3P, 941, 1419, 1113, 1543], c_dead_tree: [A3P, 1206, 1403, 1495, 1616], c_dead_tree_b: [A3P, 1662, 1447, 1936, 1607],
  c_rock_a: [A3P, 1901, 1403, 2033, 1536], c_grass_patch: [A3P, 218, 1533, 384, 1614], c_lamp_a: [A3P, 1093, 1633, 1135, 1713], c_lamp_b: [A3P, 1155, 1633, 1193, 1714],
  c_lamp_c: [A3P, 1375, 1632, 1414, 1719], c_lamp_d: [A3P, 1503, 1630, 1548, 1721], c_rock_crystal: [A3P, 1834, 1594, 2031, 1820], c_debris: [A3P, 663, 1625, 797, 1698],
  // ---- CITY 2 ASTERIA (owner's sheet desgin/Map/City/ASTERIA CITY, grey background, boxes): castle, walls + towers,
  // blue noble houses, red / green homes, market tents, forges, cathedral, guild hall, crystals, trees, lamps, ponds
  a_castle_gate: [CP, 23, 10, 429, 253], a_wall_a: [CP, 460, 63, 575, 189], a_wall_tower: [CP, 585, 42, 640, 186], a_wall_b: [CP, 652, 50, 750, 186],
  a_wall_gate: [CP, 780, 53, 881, 187], a_tower_round: [CP, 887, 30, 987, 192], a_tower_b: [CP, 1011, 16, 1113, 203], a_tower_thin: [CP, 1137, 60, 1203, 193],
  a_spire_blue: [CP, 1214, 33, 1315, 188], a_chapel_blue: [CP, 1333, 11, 1454, 195], a_wall_stairs: [CP, 1477, 48, 1715, 198], a_tower_round_b: [CP, 1735, 45, 1839, 205],
  a_wall_corner: [CP, 1859, 24, 2013, 216], a_keep_blue: [CP, 394, 197, 543, 429], a_castle_blue: [CP, 561, 192, 739, 406], a_hall_blue: [CP, 761, 210, 885, 412],
  a_house_blue_a: [CP, 902, 208, 1064, 398], a_manor_blue_b: [CP, 1086, 207, 1242, 387], a_house_red_a: [CP, 1283, 207, 1447, 363], a_house_red_tower: [CP, 1488, 196, 1595, 352],
  a_dome_blue: [CP, 1430, 364, 1643, 567], a_house_red_b: [CP, 1638, 224, 1815, 360], a_house_red_c: [CP, 1835, 207, 2005, 373], a_manor_blue_a: [CP, 28, 263, 213, 419],
  a_house_blue_b: [CP, 250, 273, 373, 413], a_crystal_fountain: [CP, 739, 424, 871, 647], a_crystal_purple: [CP, 1089, 394, 1197, 530], a_crystal_green: [CP, 1098, 537, 1199, 664],
  a_cathedral: [CP, 1213, 362, 1423, 575], a_guild_hall: [CP, 1663, 376, 2001, 578],
  a_tent_purple: [CP, 30, 440, 105, 551], a_tent_gold: [CP, 106, 440, 192, 551], a_tent_white: [CP, 208, 436, 287, 551], a_tent_gold_b: [CP, 291, 440, 377, 555],
  a_tent_red: [CP, 389, 444, 462, 550], a_tent_blue: [CP, 467, 443, 540, 549], a_tent_purple_b: [CP, 552, 438, 624, 549], a_stall_house: [CP, 646, 427, 733, 555],
  a_tent_purple_c: [CP, 28, 561, 94, 668], a_tent_red_b: [CP, 199, 563, 289, 669], a_tent_yellow: [CP, 294, 564, 373, 668], a_tent_red_c: [CP, 563, 561, 645, 672],
  a_booth_blue: [CP, 650, 569, 731, 670],
  a_manor_blue_c: [CP, 24, 683, 188, 826], a_house_blue_c: [CP, 194, 677, 306, 824], a_houses_green: [CP, 328, 686, 495, 834], a_house_green_a: [CP, 509, 673, 603, 827],
  a_house_green_b: [CP, 623, 687, 781, 831], a_house_green_c: [CP, 805, 675, 914, 833], a_house_green_d: [CP, 937, 683, 1056, 828], a_house_green_e: [CP, 1071, 679, 1176, 824],
  a_forge_a: [CP, 1199, 590, 1369, 815], a_forge_b: [CP, 1379, 572, 1569, 820], a_forge_c: [CP, 1584, 585, 1840, 830], a_arena_hall: [CP, 1848, 569, 2030, 849],
  a_ruin_tower_a: [CP, 85, 1067, 259, 1284], a_ruin_court: [CP, 267, 1073, 452, 1293], a_ruin_tower_b: [CP, 455, 1080, 609, 1294], a_ruin_gatehouse: [CP, 607, 1069, 977, 1298],
  a_ruin_keep_a: [CP, 1472, 844, 1617, 1068], a_ruin_keep_b: [CP, 1619, 829, 1795, 1059], a_ruin_keep_c: [CP, 1802, 847, 2031, 1054],
  a_pine_a: [CP, 28, 1297, 110, 1453], a_pine_b: [CP, 111, 1297, 185, 1453], a_pine_c: [CP, 186, 1297, 255, 1453], a_pine_d: [CP, 256, 1297, 348, 1453],
  a_tree_tall_a: [CP, 1413, 1089, 1492, 1288], a_tree_tall_b: [CP, 1496, 1089, 1561, 1297], a_tree_round: [CP, 1639, 1079, 1718, 1199], a_tree_pine_s: [CP, 1816, 1070, 1897, 1196],
  a_dead_tree: [CP, 1568, 1088, 1632, 1187], a_tree_s: [CP, 1561, 1191, 1629, 1292], a_tree_c: [CP, 1462, 1318, 1525, 1403], a_tree_d: [CP, 1537, 1316, 1606, 1403],
  a_tree_e: [CP, 1703, 1311, 1780, 1410], a_tree_f: [CP, 1167, 1252, 1230, 1330], a_tree_g: [CP, 1243, 1254, 1312, 1332], a_bush_a: [CP, 1615, 1335, 1692, 1402],
  a_bush_b: [CP, 1361, 1338, 1441, 1401], a_log: [CP, 1790, 1204, 1903, 1301],
  a_cry_purple: [CP, 373, 1306, 483, 1447], a_cry_violet: [CP, 495, 1314, 576, 1438], a_cry_blue: [CP, 589, 1308, 695, 1439], a_cry_green: [CP, 701, 1311, 796, 1440],
  a_cry_red: [CP, 800, 1306, 888, 1437], a_lamp_banner: [CP, 911, 1315, 950, 1414], a_lamp_a: [CP, 971, 1337, 1005, 1413], a_lamp_b: [CP, 1033, 1359, 1066, 1423],
  a_banner_blue: [CP, 1089, 1343, 1121, 1422], a_banner_stand_a: [CP, 738, 1461, 777, 1556], a_banner_stand_b: [CP, 791, 1456, 830, 1555], a_banner_stand_c: [CP, 845, 1458, 885, 1553],
  a_lantern_tower: [CP, 898, 1427, 960, 1563], a_bench: [CP, 992, 1454, 1057, 1495], a_fence: [CP, 1679, 1423, 1773, 1478], a_wall_low: [CP, 1898, 1425, 1992, 1480],
  a_wall_low_b: [CP, 1877, 1507, 2000, 1570], a_arch_gate: [CP, 1617, 1502, 1717, 1574], a_statue_s: [CP, 1408, 1406, 1489, 1488], a_barrel: [CP, 1150, 1438, 1184, 1490],
  a_crate: [CP, 993, 1525, 1045, 1561], a_pond_a: [CP, 26, 1599, 166, 1721], a_pond_b: [CP, 188, 1614, 345, 1722], a_waterfall: [CP, 813, 1588, 890, 1735],
  a_pond_rock: [CP, 1886, 1592, 2012, 1722],
};

function bgLike(r, g, b) {
  const lum = (r + g + b) / 3;
  if (lum > 62) return false;
  // navy background: blue >= green >= red, modest saturation
  return b >= g - 2 && g >= r - 2 && b - r <= 34 && b - r >= 4;
}

const cache = {};
function loadSheet(name) {
  if (cache[name]) return cache[name];
  const file = [name, name + '.png'].map((n) => path.join(SRC, n)).find((f) => fs.existsSync(f)) || path.join(SRC, name);
  const img = png.read(file);
  const { width: w, height: h, data } = img;
  const fg = new Uint8Array(w * h);
  const isBg = SHEET_BG[name] || bgLike;
  for (let p = 0; p < w * h; p++) fg[p] = isBg(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) ? 0 : 1;
  // remove isolated specks (noise) : need at least 2 fg neighbours
  const clean = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (!fg[p]) continue;
    const n = fg[p - 1] + fg[p + 1] + fg[p - w] + fg[p + w] + fg[p - w - 1] + fg[p - w + 1] + fg[p + w - 1] + fg[p + w + 1];
    if (n >= 2) clean[p] = 1;
  }
  // label with dilation 1 (8-connectivity, gap of 1px bridged)
  const lab = new Int32Array(w * h).fill(-1);
  let id = 0;
  for (let p = 0; p < w * h; p++) {
    if (!clean[p] || lab[p] >= 0) continue;
    const st = [p]; lab[p] = id;
    while (st.length) {
      const q = st.pop(), qx = q % w, qy = (q / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const r = ny * w + nx;
        if (clean[r] && lab[r] < 0) { lab[r] = id; st.push(r); }
      }
    }
    id++;
  }
  return (cache[name] = { img, fg: clean, lab });
}

function extract(entry) {
  const [sheet, ...nums] = entry;
  const S = loadSheet(sheet);
  const { img, fg, lab } = S, w = img.width;
  let keep;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  if (nums.length === 2) {
    const [px, py] = nums;
    let best = -1, bd = 1e9;
    const R = SCALE[sheet] ? 30 : 14;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const p = (py + dy) * w + px + dx;
      if (lab[p] >= 0 && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = lab[p]; }
    }
    if (best < 0) return null;
    keep = (p) => lab[p] === best;
    for (let p = 0; p < lab.length; p++) if (lab[p] === best) {
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  } else {
    const [bx0, by0, bx1, by1] = nums;
    keep = (p) => fg[p] === 1;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (fg[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const inBox = keep; keep = (p) => { const x = p % w, y = (p / w) | 0; return x >= bx0 && x <= bx1 && y >= by0 && y <= by1 && inBox(p); };
    if (FILL_HOLES.has(sheet)) {
      // background reachable from the box edge = outside; any other background pixel is a hole inside the prop
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, out = new Uint8Array(bw * bh), st = [];
      const seed = (x, y) => { const k = (y - by0) * bw + (x - bx0); if (!out[k] && !fg[y * w + x]) { out[k] = 1; st.push(k); } };
      for (let x = bx0; x <= bx1; x++) { seed(x, by0); seed(x, by1); }
      for (let y = by0; y <= by1; y++) { seed(bx0, y); seed(bx1, y); }
      while (st.length) {
        const k = st.pop(), x = bx0 + (k % bw), y = by0 + ((k / bw) | 0);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= bx0 && X <= bx1 && Y >= by0 && Y <= by1) seed(X, Y); }
      }
      keep = (p) => { const x = p % w, y = (p / w) | 0; return x >= bx0 && x <= bx1 && y >= by0 && y <= by1 && !out[(y - by0) * bw + (x - bx0)]; };
    }
  }
  if (x1 < 0) return null;
  const out = png.create(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = y * w + x;
    if (!keep(p)) continue;
    const o = ((y - y0) * out.width + (x - x0)) * 4;
    img.data.copy(out.data, o, p * 4, p * 4 + 3);
    // partial alpha for dark edge pixels that are near the background colour
    const r = img.data[p * 4], g = img.data[p * 4 + 1], b = img.data[p * 4 + 2];
    out.data[o + 3] = (r + g + b) / 3 < 40 ? 200 : 255;
  }
  return SCALE[sheet] ? shrink(out, SCALE[sheet]) : out;
}

// area-average downscale (alpha weighted) for the 2048 px sheets
function shrink(im, s) {
  const w = Math.max(1, Math.round(im.width * s)), h = Math.max(1, Math.round(im.height * s)), o = png.create(w, h), inv = 1 / s;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(y * inv); yy < Math.min(im.height, Math.floor((y + 1) * inv)); yy++) for (let xx = Math.floor(x * inv); xx < Math.min(im.width, Math.floor((x + 1) * inv)); xx++) {
      const i = (yy * im.width + xx) * 4, al = im.data[i + 3];
      r += im.data[i] * al; g += im.data[i + 1] * al; b += im.data[i + 2] * al; a += al; n++;
    }
    const i = (y * w + x) * 4;
    if (a) { o.data[i] = r / a; o.data[i + 1] = g / a; o.data[i + 2] = b / a; }
    o.data[i + 3] = n && a / n > 60 ? 255 : 0; // crisp edges
  }
  return o;
}

// Consistency pass: one colour grade + one outline style for every prop.
function grade(im) {
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const sat = 0.84;                                  // tame overly bright colours
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    const shadow = Math.max(0, 1 - l / 110);           // cool, slightly violet shadows
    r = r * 0.93 - 4 * shadow; g = g * 0.93 - 2 * shadow; b = b * 0.95 + 10 * shadow;
    d[i] = Math.max(0, Math.min(255, r)); d[i + 1] = Math.max(0, Math.min(255, g)); d[i + 2] = Math.max(0, Math.min(255, b));
  }
}
function outline(im) {
  const pad = 1, w = im.width + 2, h = im.height + 2;
  const out = png.create(w, h);
  for (let y = 0; y < im.height; y++) im.data.copy(out.data, ((y + pad) * w + pad) * 4, y * im.width * 4, (y + 1) * im.width * 4);
  const src = Buffer.from(out.data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (src[o + 3] > 100) continue;
    let n = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && src[(Y * w + X) * 4 + 3] > 160) { n = true; break; }
    }
    if (n) { out.data[o] = 10; out.data[o + 1] = 9; out.data[o + 2] = 18; out.data[o + 3] = 235; }
  }
  return out;
}

// simple shelf packing
const items = [];
for (const [name, entry] of Object.entries(MANIFEST)) {
  const im = extract(entry);
  if (!im) { console.warn('MISSING', name); continue; }
  items.push({ name, im });
}
for (const it of items) { grade(it.im); it.im = outline(it.im); }
items.sort((a, b) => b.im.height - a.im.height);
const ATLAS_W = 1024;
let x = 0, y = 0, rowH = 0;
for (const it of items) {
  if (x + it.im.width + 1 > ATLAS_W) { x = 0; y += rowH + 1; rowH = 0; }
  it.x = x; it.y = y; x += it.im.width + 1; rowH = Math.max(rowH, it.im.height);
}
const atlas = png.create(ATLAS_W, y + rowH + 1);
const meta = {};
for (const it of items) {
  for (let yy = 0; yy < it.im.height; yy++)
    it.im.data.copy(atlas.data, ((it.y + yy) * ATLAS_W + it.x) * 4, yy * it.im.width * 4, (yy + 1) * it.im.width * 4);
  meta[it.name] = [it.x, it.y, it.im.width, it.im.height];
}
png.write(path.join(OUT, 'props.png'), atlas);
fs.writeFileSync(path.join(OUT, 'props.json'), JSON.stringify(meta));
console.log('props', items.length, 'atlas', ATLAS_W + 'x' + atlas.height);
if (process.argv[2]) {
  // debug preview: every prop on a grey card with its index
  const list = Object.keys(meta);
  fs.writeFileSync(process.argv[2] + '.txt', list.map((n, i) => i + ' ' + n + ' ' + meta[n].slice(2).join('x')).join('\n'));
}
