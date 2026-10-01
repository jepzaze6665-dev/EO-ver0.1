// COMBAT LOADOUT UI — the "Loadout" tab of the character window (built by ui/panels.js). Reads the game, changes nothing:
// clicks are handled by panels.js through data-attributes (data-pick, data-equip-to, data-unequip).
//   left  : the 7 gear slots; click one = list of owned items that fit it
//   right : FINAL STATS (base -> final), build tags, active item effects (cooldowns / running buffs)
import { ITEMS, RARITY_COLOR } from '../items/items.js';
import { GEAR_SLOTS, MODIFIER_TYPES } from '../data/items/rules.js';
import { iconURL, itemIconURL } from './icons.js';
import { esc, modifierText, modValue, swapPreview } from './itemTooltip.js';
import { meetsLevel } from '../items/itemDefs.js';
import { setSummary } from '../items/setSystem.js';
import { kitPieces } from '../data/classKits.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const signed = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

// the class resource's maximum, with or without the item bonus (resourceMax)
const resMax = (p, withItems) => {
  const r = p.resources, id = p.primaryResource;
  if (!r || !r.has(id)) return 0;
  return withItems ? r.max(id) : r.defs[id].max;
};

// stat rows: [label, value now, value without items] — the list the spec asks for (§27)
export function finalStatRows(p) {
  const st = p.stats, base = p.baseStats || st, gm = (t) => p.gearMod(t);
  const num = (k) => Math.round(st[k] || 0), b = (k) => Math.round(base[k] || 0);
  return [
    ['HP', p.maxHp, Math.round(base.hp || p.maxHp)],
    ['Defense', num('def'), b('def')],
    ['Attack', num('atk'), b('atk')],
    ['Movement Speed', num('speed'), b('speed')],
    ['Cooldown Reduction', pct(st.cdr || 0), pct(base.cdr || 0)],
    ['Critical Chance', pct(st.crit || 0), pct(base.crit || 0)],
    ['Critical Damage', signed(st.critDmg || 0), signed(base.critDmg || 0)],
    ['Attack Speed', signed(st.attackSpeed || 0), signed(base.attackSpeed || 0)],
    ['Physical Damage', signed(st.physicalDmg || 0), signed(base.physicalDmg || 0)],
    ['Shadow Damage', signed(st.shadowDmg || 0), signed(base.shadowDmg || 0)],
    ['Healing Power', signed(st.healPower || 0), signed(base.healPower || 0)],
    ['Status Resistance', pct(st.tenacity || 0), pct(base.tenacity || 0)],
    ['Resource Max', resMax(p, true), resMax(p, false)],
    ['Resource Generation', signed(gm('resourceGeneration')), signed(0)],
    ['Resource Cost', signed(gm('resourceCost')), signed(0)],
    ['Guard Generation', signed(gm('guardGeneration')), signed(0)],
    ['Barrier Strength', signed(st.barrierPower || 0), signed(base.barrierPower || 0)],
    ['Counter Damage', signed(gm('counterDamage')), signed(0)],
    ['Magic Damage', signed(gm('magicDamage')), signed(0)],
    ['Damage Reduction', pct(gm('damageReduction')), pct(0)],
    ['Aggro', signed(gm('aggro')), signed(0)],
    ['Taunt Power', signed(gm('tauntPower')), signed(0)],
  ];
}

// build tags = how many worn items carry each tag (build detection; future synergy / recommendation)
export function buildTags(eq) {
  const n = {};
  for (const s of GEAR_SLOTS) { const d = ITEMS[eq.slots[s.id]]; if (d) for (const t of d.tags) n[t] = (n[t] || 0) + 1; }
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}

// worn sets: name n/total + every bonus (lit when on)
export function setsHTML(eq) {
  const sets = setSummary(eq.wornIds());
  if (!sets.length) return '<div class="muted small">No set pieces worn.</div>';
  return sets.map((s) => `<div class="lo-set"><b style="color:${s.color || '#ddd'}">${esc(s.name)} ${s.count}/${s.total}</b>${s.bonuses.map((b) => `<div class="small ${b.on ? 'set-on' : 'muted'}">(${b.pieces}) ${esc(b.text)}</div>`).join('')}</div>`).join('');
}

export function loadoutHTML(g, { pickSlot = null } = {}) {
  const p = g.player, eq = g.equipment, inv = g.inventory;
  const slotRow = (s) => {
    const id = eq.slots[s.id], d = ITEMS[id];
    return `<div class="lo-slot${pickSlot === s.id ? ' on' : ''}" data-pick="${s.id}"${d ? ` data-tip="${id}" data-tip-eq="1"` : ''}>
      <div class="lbl">${esc(s.label.toUpperCase())}</div>
      ${d ? `<img src="${itemIconURL(d)}"><div class="lo-name" style="color:${RARITY_COLOR[d.rarity]}">${esc(d.name)}</div>` : '<div class="muted lo-name">— empty —</div>'}
      ${d && !s.fixed ? `<button data-unequip="${s.id}">✕</button>` : ''}
    </div>`;
  };
  // the picker: owned items of this slot's type
  let picker = '';
  if (pickSlot) {
    const slot = GEAR_SLOTS.find((s) => s.id === pickSlot);
    const owned = [...new Set(inv.gear.map((x) => x.itemId))].filter((id) => ITEMS[id].type === slot.type);
    picker = `<div class="lo-picker"><h4>${esc(slot.label)} — your items</h4>${owned.length ? owned.map((id) => {
      const d = ITEMS[id], sw = swapPreview(eq, id);
      const hint = sw && sw.changes.length ? sw.changes.slice(0, 3).map((c) => `${(MODIFIER_TYPES[c.type] || {}).label} ${modValue(c.type, c.after - c.before)}`).join(' · ') : '';
      const lvl = meetsLevel(d, p.level) ? '' : `<div class="small" style="color:#ff7a6a">Requires LV ${d.levelRequirement}</div>`;
      return `<div class="lo-pick" data-equip-to="${id}:${pickSlot}" data-tip="${id}">
        <img src="${itemIconURL(d)}"><div><div style="color:${RARITY_COLOR[d.rarity]}">${esc(d.name)}</div><div class="small muted">${esc(hint)}</div>${lvl}</div></div>`;
    }).join('') : '<div class="muted small">Nothing for this slot yet.</div>'}</div>`;
  }
  const rows = finalStatRows(p).map(([label, now, base]) => `<div><span>${label}</span><b>${now}${String(now) !== String(base) ? ` <span class="lo-base">(${base})</span>` : ''}</b></div>`).join('');
  const tags = buildTags(eq);
  const fx = g.itemEffects ? g.itemEffects.active() : [];
  const fxRows = fx.map((x) => `<div class="lo-fx"><span style="color:${x.color || '#ddd'}">${esc(x.name)}</span> ${esc(x.effect.text)}
    <b class="${x.running ? 'run' : x.cooldownLeft > 0 ? 'cd' : 'ready'}">${x.running ? 'ACTIVE' : x.cooldownLeft > 0 ? x.cooldownLeft.toFixed(1) + 's' : 'READY'}</b></div>`).join('');
  return `
    <div class="lo-layout">
      <div>
        <h3>CLASS KIT</h3>
        <div class="lo-kit">${kitPieces(p.cls).map((k) => `<div class="lo-slot kit" title="${esc(k.desc)}"><div class="lbl">${k.slot === 'weapon' ? 'WEAPON' : 'ARMOR'}</div><img src="${iconURL(k.icon, k.color)}"><div class="lo-name" style="color:${k.color}">${esc(k.name)}</div></div>`).join('')}</div>
        <p class="muted small">Part of the class — always with you, never an item.</p>
        <h3>COMBAT LOADOUT</h3>
        ${GEAR_SLOTS.map(slotRow).join('')}
        ${picker}
        <p class="muted small">Click a slot to choose an item. Items change how you fight — never how you look.</p>
      </div>
      <div class="stats">
        <h3>${esc(p.cls.name)} — LV.${p.level}</h3>
        <h4>FINAL STATS</h4>${rows}
        <h4>BUILD</h4><div class="lo-tags">${tags.length ? tags.map(([t, n]) => `<span>${esc(t.toUpperCase())} ×${n}</span>`).join('') : '<span class="muted">—</span>'}</div>
        <h4>SETS</h4>${setsHTML(eq)}
        <h4>ITEM EFFECTS</h4>${fxRows || '<div class="muted small">No effect items worn (relics / runes).</div>'}
        ${Object.values(eq.slots).some((id) => id && ITEMS[id].modText) ? `<h4>SKILL MODIFIERS</h4>${Object.values(eq.slots).filter((id) => id && ITEMS[id].modText).map((id) => `<div class="mod">◆ ${esc(ITEMS[id].modText)}</div>`).join('')}` : ''}
      </div>
    </div>`;
}

