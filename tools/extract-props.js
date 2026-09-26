// Extracts individual props from the asset-set sheets in /ของแมพ (dark navy background)
// and packs them into assets/props/props.png + props.json.
// Each manifest entry picks the connected blob under a point, or everything inside a box.
// Usage: node tools/extract-props.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'ของแมพ');
const OUT = path.join(ROOT, 'assets', 'props');
fs.mkdirSync(OUT, { recursive: true });

// name: [sheet, x, y] (blob under point) or [sheet, x0, y0, x1, y1] (box). Optional scale as last numeric arg via object form.
const F = 'FOREST SET.png', A = 'FANTASY SET.png', V = 'VILLAGE SET.png';
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
  const img = png.read(path.join(SRC, name));
  const { width: w, height: h, data } = img;
  const fg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) fg[p] = bgLike(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) ? 0 : 1;
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
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
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
  return out;
}

// simple shelf packing
const items = [];
for (const [name, entry] of Object.entries(MANIFEST)) {
  const im = extract(entry);
  if (!im) { console.warn('MISSING', name); continue; }
  items.push({ name, im });
}
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
