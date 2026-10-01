// ITEM TOOLTIP (UI only) — builds the HTML that explains one item. Reads item data, never changes the game.
//   itemTooltipHTML(def, { classId, swap })  -> name, rarity, type, description, modifiers, unique effects, tags, source
//   swapPreview(equipment, itemId)            -> what equipping it would change (pure: a copy of the modifier set)
import { ITEMS, RARITY_COLOR } from '../items/items.js';
import { TYPE_LABEL, MODIFIER_TYPES, GEAR_SLOTS, ANY_CLASS } from '../data/items/rules.js';
import { ModifierSet } from '../items/modifierSystem.js';
import { canClassUse, isGear } from '../items/itemDefs.js';
import { CLASSES } from '../skills/classes.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
// "+15% Defense"; resourceCost below zero is GOOD (cheaper skills)
export const modifierText = (m) => `${pct(m.value)} ${(MODIFIER_TYPES[m.type] || {}).label || m.type}`;
const goodSign = (type, v) => (type === 'resourceCost' ? v < 0 : v > 0);
const TRIGGER_TEXT = {
  onAttack: 'On basic attack', onHit: 'On hit', onDamageTaken: 'When hit', onBlock: 'On block', onPerfectGuard: 'On Perfect Guard',
  onSkillCast: 'On skill cast', onSkillHit: 'On skill hit', onKill: 'On kill', onDodge: 'On dodge', onDash: 'On dash skill',
  onTaunt: 'On taunt', onBarrierCreated: 'On barrier', onResourceGain: 'On resource gain', onResourceSpend: 'On resource spend', onLowHP: 'At low HP',
};
const sourceText = (id) => (id ? id.replace(/^boss_/, 'Boss ').replace(/^mini_/, 'Mini-boss ').replace(/_/g, ' ').toUpperCase() : '');

// what changes if this item goes on: { slot, replaces, changes: [{ type, before, after }] } (null = not gear)
export function swapPreview(eq, itemId) {
  const def = ITEMS[itemId];
  if (!isGear(def)) return null;
  const slot = eq.slotFor(def);
  if (!slot) return null;
  const set = (slots) => { const m = new ModifierSet(); for (const s of GEAR_SLOTS) { const d = ITEMS[slots[s.id]]; if (d) for (const x of d.modifiers) m.addModifier(s.id, x); } return m.totals(); };
  const before = set(eq.slots), after = set({ ...eq.slots, [slot]: itemId });
  const types = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [...types].map((type) => ({ type, before: before[type] || 0, after: after[type] || 0 })).filter((c) => Math.abs(c.after - c.before) > 1e-9);
  return { slot, replaces: eq.slots[slot], changes };
}

export function itemTooltipHTML(def, { classId = null, swap = null, equipped = false } = {}) {
  if (!def) return '';
  const color = RARITY_COLOR[def.rarity] || '#ccc';
  const rows = [];
  rows.push(`<div class="tt-name" style="color:${color}">${esc(def.name.toUpperCase())}</div>`);
  rows.push(`<div class="tt-sub"><span style="color:${color}">${esc((def.rarity || '').toUpperCase())}</span> · ${esc((TYPE_LABEL[def.type] || def.cat || '').toUpperCase())}${equipped ? ' · <b>EQUIPPED</b>' : ''}</div>`);
  if (def.description) rows.push(`<div class="tt-desc">${esc(def.description)}</div>`);
  // older gear: flat stats + its unique behaviour text
  const flat = Object.entries(def.stats || {}).filter(([, v]) => v);
  if (flat.length) rows.push(`<div class="tt-block">${flat.map(([k, v]) => `<div class="tt-mod good">${esc(k)} ${v > 0 ? '+' : ''}${v}</div>`).join('')}</div>`);
  if (def.modifiers.length) rows.push(`<div class="tt-block">${def.modifiers.map((m) => `<div class="tt-mod ${goodSign(m.type, m.value) ? 'good' : 'bad'}">${esc(modifierText(m))}</div>`).join('')}</div>`);
  const unique = [...(def.modText ? [def.modText] : []), ...def.effects.map((e) => e.text)];
  if (unique.length) {
    rows.push(`<div class="tt-head">${def.rarity === 'legendary' ? 'UNIQUE EFFECT' : 'EFFECT'}</div>`);
    for (const e of def.effects) rows.push(`<div class="tt-effect"><span class="tt-trig">${esc(TRIGGER_TEXT[e.trigger] || e.trigger)}</span> ${esc(e.text)}</div>`);
    if (def.modText) rows.push(`<div class="tt-effect">${esc(def.modText)}</div>`);
  }
  if (def.tags && def.tags.length) rows.push(`<div class="tt-tags">${def.tags.map((t) => `<span>${esc(t.toUpperCase())}</span>`).join('')}</div>`);
  if (isGear(def) && !def.allowedClasses.includes(ANY_CLASS)) {
    const ok = classId && canClassUse(def, classId);
    rows.push(`<div class="tt-class ${ok ? '' : 'bad'}">Only: ${esc(def.allowedClasses.map((c) => (CLASSES[c] ? CLASSES[c].name : c)).join(', '))}</div>`);
  }
  if (def.dropSource) rows.push(`<div class="tt-src">Source: ${esc(sourceText(def.dropSource))}</div>`);
  if (swap && !equipped) {
    const slotLabel = (GEAR_SLOTS.find((s) => s.id === swap.slot) || {}).label || swap.slot;
    rows.push(`<div class="tt-head">IF EQUIPPED (${esc(slotLabel.toUpperCase())})</div>`);
    if (swap.replaces) rows.push(`<div class="tt-src">Replaces ${esc(ITEMS[swap.replaces].name)}</div>`);
    rows.push(swap.changes.length ? swap.changes.map((c) => {
      const d = c.after - c.before;
      return `<div class="tt-mod ${goodSign(c.type, d) ? 'good' : 'bad'}">${esc((MODIFIER_TYPES[c.type] || {}).label || c.type)} ${pct(c.before)} → ${pct(c.after)}</div>`;
    }).join('') : '<div class="tt-src">No modifier changes</div>');
  }
  return rows.join('');
}
