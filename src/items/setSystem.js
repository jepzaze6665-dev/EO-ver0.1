// ITEM SET SYSTEM (pure) — which set bonuses a list of worn items turns on. No game, no DOM.
//   setPieces(setId)            -> item ids of that set (items naming it with `setId`)
//   setCounts(itemIds)          -> { setId: worn pieces }  (each item id counts once)
//   activeSetBonuses(itemIds)   -> [{ setId, set, count, total, bonus, key }]  every bonus that is on
//   setProblems()               -> data check of data/items/sets.js against the items
// Equipment adds the active bonuses' modifiers to its ModifierSet; ItemEffectSystem indexes their effects.
import { ITEMS } from './items.js';
import { SETS } from '../data/items/sets.js';
import { MODIFIER_TYPES } from '../data/items/rules.js';
import { effectProblems } from './itemDefs.js';

export function setPieces(setId, items = ITEMS) {
  return Object.values(items).filter((d) => d && d.setId === setId).map((d) => d.id);
}

export function setCounts(itemIds, items = ITEMS) {
  const n = {};
  for (const id of new Set(itemIds.filter(Boolean))) {
    const d = items[id];
    if (d && d.setId) n[d.setId] = (n[d.setId] || 0) + 1;
  }
  return n;
}

export function activeSetBonuses(itemIds, items = ITEMS, sets = SETS) {
  const out = [];
  for (const [setId, count] of Object.entries(setCounts(itemIds, items))) {
    const set = sets[setId];
    if (!set) continue;
    const total = setPieces(setId, items).length;
    for (const bonus of set.bonuses) if (count >= bonus.pieces) out.push({ setId, set, count, total, bonus, key: `set:${setId}:${bonus.pieces}` });
  }
  return out;
}

// one line per set an item list touches (UI): { setId, name, color, count, total, bonuses: [{ pieces, text, on }] }
export function setSummary(itemIds, items = ITEMS, sets = SETS) {
  return Object.entries(setCounts(itemIds, items)).filter(([id]) => sets[id]).map(([setId, count]) => {
    const set = sets[setId];
    return { setId, name: set.name, color: set.color, count, total: setPieces(setId, items).length,
      bonuses: set.bonuses.map((b) => ({ pieces: b.pieces, text: b.text, on: count >= b.pieces })) };
  });
}

export function setProblems(items = ITEMS, sets = SETS) {
  const out = [];
  for (const [id, set] of Object.entries(sets)) {
    const bad = (m) => out.push(`set ${id}: ${m}`);
    if (!set.name) bad('no name');
    if (!Array.isArray(set.bonuses) || !set.bonuses.length) { bad('no bonuses'); continue; }
    const total = setPieces(id, items).length;
    if (total < 2) bad(`only ${total} item(s) name it`);
    for (const b of set.bonuses) {
      if (!Number.isInteger(b.pieces) || b.pieces < 2) bad(`bonus pieces ${b.pieces}`);
      else if (b.pieces > total) bad(`bonus needs ${b.pieces} pieces, the set has ${total}`);
      if (!b.text) bad('bonus without text');
      if (!(b.modifiers || []).length && !(b.effects || []).length) bad(`bonus ${b.pieces} does nothing`);
      for (const m of b.modifiers || []) if (!MODIFIER_TYPES[m.type] || !Number.isFinite(m.value)) bad(`modifier ${m.type}`);
      for (const e of b.effects || []) out.push(...effectProblems(e).map((m) => `set ${id}: ${m}`));
    }
  }
  for (const d of Object.values(items)) if (d && d.setId && !sets[d.setId]) out.push(`${d.id}: unknown set "${d.setId}"`);
  return out;
}
