// ITEM TOOLTIP (UI only) — builds the HTML that explains one item. Reads item data, never changes the game.
//   itemTooltipHTML(def, { classId, level, swap })  -> name, rarity, type, level need, description, modifiers, unique effects, tags, source
//   swapPreview(equipment, itemId)            -> what equipping it would change (pure: a copy of the modifier set)
import { ITEMS, RARITY_COLOR } from '../items/items.js';
import { TYPE_LABEL, MODIFIER_TYPES, GEAR_SLOTS, ANY_CLASS, UNIQUE_RARITIES, LINE_PREFIX } from '../data/items/rules.js';
import { ModifierSet } from '../items/modifierSystem.js';
import { canClassUse, isGear, meetsLevel } from '../items/itemDefs.js';
import { CLASSES } from '../skills/classes.js';
import { itemSources } from '../loot/lootSystem.js';
import { SETS } from '../data/items/sets.js';
import { setPieces, activeSetBonuses } from '../items/setSystem.js';

// 'umbral_sword' -> Umbral Sword · 'line:umbral_sword' -> Umbral Sword line (+ its Class 2)
export const classLabel = (c) => (c.startsWith(LINE_PREFIX) ? `${(CLASSES[c.slice(LINE_PREFIX.length)] || {}).name || c} line` : (CLASSES[c] ? CLASSES[c].name : c));
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
// a modifier value as text: shares as +15%, flat ones (rules unit 'flat') as +20
export const modValue = (type, v) => ((MODIFIER_TYPES[type] || {}).unit === 'flat' ? `${v > 0 ? '+' : ''}${Math.round(v)}` : pct(v));
// "+15% Defense"; resourceCost below zero is GOOD (cheaper skills)
export const modifierText = (m) => `${modValue(m.type, m.value)} ${(MODIFIER_TYPES[m.type] || {}).label || m.type}`;
const goodSign = (type, v) => (type === 'resourceCost' ? v < 0 : v > 0);
const TRIGGER_TEXT = {
  onAttack: 'On basic attack', onHit: 'On hit', onDamageTaken: 'When hit', onBlock: 'On block', onPerfectGuard: 'On Perfect Guard',
  onSkillCast: 'On skill cast', onSkillHit: 'On skill hit', onKill: 'On kill', onDodge: 'On dodge', onDash: 'On dash skill',
  onTaunt: 'On taunt', onBarrierCreated: 'On barrier', onResourceGain: 'On resource gain', onResourceSpend: 'On resource spend', onLowHP: 'At low HP',
  onCrit: 'On critical hit', onFullResource: 'At full resource', onStatusApplied: 'On applying a status', onBossPhase: 'On boss phase',
  onMarksFull: 'Marks full', onMarkTriggered: 'Mark detonates',
};
const TABLE_TEXT = { elite: 'Elites', mini_relic: 'Mini-bosses (A2+)', rune_knight: 'Rune Knight', amethyst_colossus: 'Amethyst Colossus', crystal_warden: 'Crystal Warden', varkharon: 'Varkharon', hollow_fang: 'Hollow Fang', grukk: 'Thornbound Elder', hoarfang: 'Hoarfang', guardian: 'Guardian', magma_beast: 'Magma Beast' };
const sourceText = (id) => (id ? id.replace(/^boss_/, 'Boss ').replace(/^mini_/, 'Mini-boss ').replace(/_/g, ' ').toUpperCase() : '');

// what changes if this item goes on: { slot, replaces, changes: [{ type, before, after }] } (null = not gear)
export function swapPreview(eq, itemId) {
  const def = ITEMS[itemId];
  if (!isGear(def)) return null;
  const slot = eq.slotFor(def);
  if (!slot) return null;
  const ids = (slots) => GEAR_SLOTS.map((s) => slots[s.id]).filter(Boolean);
  const set = (slots) => {
    const m = new ModifierSet();
    for (const s of GEAR_SLOTS) { const d = ITEMS[slots[s.id]]; if (d) for (const x of d.modifiers) m.addModifier(s.id, x); }
    for (const a of activeSetBonuses(ids(slots))) for (const x of a.bonus.modifiers || []) m.addModifier(a.key, x);
    return m.totals();
  };
  const newSlots = { ...eq.slots, [slot]: itemId };
  const before = set(eq.slots), after = set(newSlots);
  const types = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [...types].map((type) => ({ type, before: before[type] || 0, after: after[type] || 0 })).filter((c) => Math.abs(c.after - c.before) > 1e-9);
  // PASSIVE CHANGES: effect texts gained / lost by the swap (the replaced item's effects go away)
  const fx = (id) => (ITEMS[id] ? ITEMS[id].effects.map((e) => e.text) : []);
  const bonusKeys = (slots) => new Map(activeSetBonuses(ids(slots)).map((a) => [a.key, `[${a.set.name} ${a.bonus.pieces}] ${a.bonus.text}`]));
  const bb = bonusKeys(eq.slots), ba = bonusKeys(newSlots);
  const gained = [...fx(itemId), ...[...ba].filter(([k]) => !bb.has(k)).map(([, t]) => t)];
  const lost = [...fx(eq.slots[slot]), ...[...bb].filter(([k]) => !ba.has(k)).map(([, t]) => t)];
  return { slot, replaces: eq.slots[slot], changes, gained, lost };
}

export function itemTooltipHTML(def, { classId = null, level = null, swap = null, equipped = false, worn = [] } = {}) {
  if (!def) return '';
  const color = RARITY_COLOR[def.rarity] || '#ccc';
  const rows = [];
  rows.push(`<div class="tt-name" style="color:${color}">${esc(def.name.toUpperCase())}</div>`);
  rows.push(`<div class="tt-sub"><span style="color:${color}">${esc((def.rarity || '').toUpperCase())}</span> · ${esc((TYPE_LABEL[def.type] || def.cat || '').toUpperCase())}${equipped ? ' · <b>EQUIPPED</b>' : ''}</div>`);
  // KEY ITEM (item data `key: true`): only opens something — no stats, cannot be sold or stored
  if (def.bound) rows.push(`<div class="tt-src">BOUND — cannot be sold, stored or traded</div>`);
  if (def.key) rows.push(`<div class="tt-head" style="color:${color}">KEY ITEM — entry only</div>`);
  if (def.levelRequirement > 0) rows.push(`<div class="tt-class ${level == null || meetsLevel(def, level) ? '' : 'bad'}">Requires LV ${def.levelRequirement}</div>`);
  if (def.description) rows.push(`<div class="tt-desc">${esc(def.description)}</div>`);
  // older gear: flat stats + its unique behaviour text
  const flat = Object.entries(def.stats || {}).filter(([, v]) => v);
  if (flat.length) rows.push(`<div class="tt-block">${flat.map(([k, v]) => `<div class="tt-mod good">${esc(k)} ${v > 0 ? '+' : ''}${v}</div>`).join('')}</div>`);
  if (def.modifiers.length) rows.push(`<div class="tt-block">${def.modifiers.map((m) => `<div class="tt-mod ${goodSign(m.type, m.value) ? 'good' : 'bad'}">${esc(modifierText(m))}</div>`).join('')}</div>`);
  const unique = [...(def.modText ? [def.modText] : []), ...def.effects.map((e) => e.text)];
  if (unique.length) {
    rows.push(`<div class="tt-head">${UNIQUE_RARITIES.includes(def.rarity) ? 'UNIQUE EFFECT' : 'EFFECT'}</div>`);
    for (const e of def.effects) rows.push(`<div class="tt-effect"><span class="tt-trig">${esc(TRIGGER_TEXT[e.trigger] || e.trigger)}</span> ${esc(e.text)}</div>`);
    if (def.modText) rows.push(`<div class="tt-effect">${esc(def.modText)}</div>`);
  }
  if (def.setId && SETS[def.setId]) { // SET: pieces (worn ones lit) + bonuses (lit when on)
    const st = SETS[def.setId], pieces = setPieces(def.setId), n = pieces.filter((id) => worn.includes(id)).length;
    rows.push(`<div class="tt-head" style="color:${st.color || '#ddd'}">SET: ${esc(st.name.toUpperCase())} ${n}/${pieces.length}</div>`);
    rows.push(`<div class="tt-src">${pieces.map((id) => `<span class="${worn.includes(id) ? 'set-on' : ''}">${esc(ITEMS[id].name)}</span>`).join(' · ')}</div>`);
    for (const b of st.bonuses) rows.push(`<div class="tt-mod ${n >= b.pieces ? 'good' : 'muted'}">(${b.pieces}) ${esc(b.text)}</div>`);
  }
  if (def.tags && def.tags.length) rows.push(`<div class="tt-tags">${def.tags.map((t) => `<span>${esc(t.toUpperCase())}</span>`).join('')}</div>`);
  if (isGear(def) && !def.allowedClasses.includes(ANY_CLASS)) {
    const ok = classId && canClassUse(def, classId);
    rows.push(`<div class="tt-class ${ok ? '' : 'bad'}">Only: ${esc(def.allowedClasses.map(classLabel).join(', '))}</div>`);
  }
  if (def.dropSource) rows.push(`<div class="tt-src">Source: ${esc(sourceText(def.dropSource))}</div>`);
  else if (isGear(def)) { // other gear: every loot table that can give it, with its chance per roll
    const src = itemSources(def.id);
    if (src.length) rows.push(`<div class="tt-src">Drops: ${src.map((x) => `${esc(TABLE_TEXT[x.table] || x.table.replace(/_/g, ' '))} ${Math.round(x.chance * 1000) / 10}%`).join(' · ')}</div>`);
  }
  if (swap && !equipped) {
    const slotLabel = (GEAR_SLOTS.find((s) => s.id === swap.slot) || {}).label || swap.slot;
    rows.push(`<div class="tt-head">IF EQUIPPED (${esc(slotLabel.toUpperCase())})</div>`);
    if (swap.replaces) rows.push(`<div class="tt-src">Replaces ${esc(ITEMS[swap.replaces].name)}</div>`);
    rows.push(swap.changes.length ? swap.changes.map((c) => {
      const d = c.after - c.before;
      return `<div class="tt-mod ${goodSign(c.type, d) ? 'good' : 'bad'}">${esc((MODIFIER_TYPES[c.type] || {}).label || c.type)} ${modValue(c.type, c.before)} → ${modValue(c.type, c.after)}</div>`;
    }).join('') : '<div class="tt-src">No modifier changes</div>');
    for (const t of swap.lost || []) rows.push(`<div class="tt-mod bad">− ${esc(t)}</div>`);
    for (const t of swap.gained || []) rows.push(`<div class="tt-mod good">+ ${esc(t)}</div>`);
  }
  return rows.join('');
}
