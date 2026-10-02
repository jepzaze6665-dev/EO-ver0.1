// SKILL TREE VIEW (UI v2) — the Skills tab drawn as a tree that grows upward (owner's reference, made to fit our game):
//   bottom = the class special (Q) = the root · branches = chains of `unlock.requires` · rows = unlock class level ·
//   top = the ultimate in a big gold diamond. Diamond nodes (same shape as the level diamond) hold the skill icon + "Lv n/m".
// Generic: built from class data only (skills + special + unlock data), so every class gets its tree. layoutTree is pure.
// Clicks go through panels.js data-attributes (data-tree-sel); the detail card on the right is built by panels.js.
import { skillIconURL } from './icons.js';
import { maxLevel } from '../progression/skillLevels.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lvlOf = (s) => (s.unlock && s.unlock.classLevel) || 1;

// pure: { nodes: [{ id, skill, x, y, kind }], edges: [[fromId, toId]], w, h } in tree units (x 0..cols-1, y = row from bottom)
export function layoutTree(cls) {
  const skills = cls.skills.filter((s) => !s.ultimate), ult = cls.skills.find((s) => s.ultimate), special = cls.special;
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
  const parentOf = (s) => ((s.unlock && s.unlock.requires) || []).find((id) => byId[id]) || null;
  const children = {};
  for (const s of skills) { const p = parentOf(s); if (p) (children[p] ||= []).push(s); }
  // columns: walk each root's branch depth-first; leaves take the next free column, parents sit over their children's middle
  let next = 0;
  const col = {};
  const place = (s) => {
    const kids = (children[s.id] || []).sort((a, b) => lvlOf(a) - lvlOf(b));
    if (!kids.length) { col[s.id] = next++; return col[s.id]; }
    const xs = kids.map(place);
    col[s.id] = (Math.min(...xs) + Math.max(...xs)) / 2;
    return col[s.id];
  };
  skills.filter((s) => !parentOf(s)).sort((a, b) => lvlOf(a) - lvlOf(b)).forEach(place);
  const cols = Math.max(1, next);
  // rows: depth in its branch (root skills = row 1; row 0 = the special) — the unlock level shows on the node badge
  const depth = (s) => { const p = parentOf(s); return p ? 1 + depth(byId[p]) : 1; };
  const levels = [...new Set(skills.map(depth))].sort((a, b) => a - b);
  const row = (s) => depth(s);
  const mid = (cols - 1) / 2;
  const nodes = skills.map((s) => ({ id: s.id, skill: s, x: col[s.id], y: row(s), kind: 'skill' }));
  const top = levels.length + 1;
  if (special) nodes.push({ id: special.id, skill: special, x: mid, y: 0, kind: 'special' });
  if (ult) nodes.push({ id: ult.id, skill: ult, x: mid, y: top, kind: 'ultimate' });
  const edges = [];
  for (const s of skills) {
    const p = parentOf(s);
    if (p) edges.push([p, s.id]);
    else if (special) edges.push([special.id, s.id]);
  }
  // the ultimate crowns every branch top (skills nobody requires)
  if (ult) for (const s of skills) if (!(children[s.id] || []).length) edges.push([s.id, ult.id]);
  return { nodes, edges, w: cols, h: top + (ult ? 1 : 0) };
}

// HTML of the tree area (SVG lines + positioned diamond nodes). st(skill) -> { unlocked, slotted, level, max, need }
export function treeHTML(cls, sel, st) {
  const L = layoutTree(cls), GX = 112, GY = 96, PAD = 70;
  const W = Math.max(3, L.w) * GX + PAD, H = (L.h) * GY + PAD;
  const off = (W - L.w * GX) / 2 + GX / 2;
  const pos = (n) => ({ x: off + n.x * GX, y: H - PAD / 2 - n.y * GY - 20 });
  const byId = Object.fromEntries(L.nodes.map((n) => [n.id, n]));
  const lines = L.edges.map(([a, b]) => {
    const A = pos(byId[a]), B = pos(byId[b]), lit = st(byId[b].skill).unlocked && st(byId[a].skill).unlocked;
    const my = (A.y + B.y) / 2;
    return `<path class="stl${lit ? ' lit' : ''}" d="M${A.x},${A.y} C${A.x},${my} ${B.x},${my} ${B.x},${B.y}"/>`;
  }).join('');
  const nodes = L.nodes.map((n) => {
    const s = n.skill, x = st(s), p = pos(n);
    const cls2 = ['stn', n.kind, x.unlocked ? 'open' : 'locked', x.slotted ? 'slotted' : '', x.max > 1 && x.level >= x.max ? 'maxed' : '', sel === s.id ? 'sel' : ''].join(' ');
    const badge = x.unlocked ? (x.max > 1 ? `${x.level}/${x.max}` : n.kind === 'ultimate' ? 'ULT' : 'Q') : `LV ${x.need}`;
    return `<button class="${cls2}" data-tree-sel="${s.id}" style="left:${p.x}px;top:${p.y}px" title="${esc(s.name)}">
      <span class="stn-d"></span><img src="${skillIconURL(s)}" alt=""><span class="stn-b">${badge}</span></button>`;
  }).join('');
  return `<div class="st-tree" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${lines}</svg>${nodes}</div>`;
}

// node state for treeHTML, read from the player (skill level / unlock / loadout)
export const nodeState = (p) => (s) => ({
  unlocked: p.skillUnlocked ? p.skillUnlocked(s) : true,
  slotted: p.loadout.slots.includes(s.id) || !!s.ultimate || s === p.cls.special,
  level: p.skillLevel ? p.skillLevel(s.id) : 1,
  max: maxLevel(s),
  need: lvlOf(s),
});
