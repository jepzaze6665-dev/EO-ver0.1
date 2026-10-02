// CHARACTER WINDOW (UI v2, Layout C) — the left side panel opened with [I]. Built by ui/panels.js inventory():
//   header : level diamond · name / class · EXP bar · POWER (progression/power.js)
//   tabs   : Equipment · Skills · Class · Codex · Quests (owner's menu icons)
//   Equipment tab: the real class sprite turning on its pedestal (×2, pixel-sharp) + the 7 gear slots + key stats,
//   then the bag (filter tabs with the owner's icons, rarity-coloured slots) and the selected item.
// Reads the game, changes nothing: clicks go through panels.js data-attributes (data-pick, data-equip-to, data-unequip,
// data-item, data-filter, data-tab, data-use, data-equip).
import { ITEMS, RARITY_COLOR } from '../items/items.js';
import { GEAR_SLOTS } from '../data/items/rules.js';
import { itemIconURL } from './icons.js';
import { esc } from './itemTooltip.js';
import { finalStatRows, setsHTML } from './loadoutUI.js';
import { expToNext } from '../progression/experience.js';
import { playerPower } from '../progression/power.js';
import { meetsLevel } from '../items/itemDefs.js';

export const UI_ICON = (name) => `assets/ui/icons/${name}.png`;

export const CHAR_TABS = [
  { id: 'equipment', label: 'Equipment', icon: 'menu_equipment' },
  { id: 'skills', label: 'Skills', icon: 'menu_skills' },
  { id: 'class', label: 'Class', icon: 'menu_class' },
  { id: 'knowledge', label: 'Codex', icon: 'menu_codex' },
  { id: 'lore', label: 'Quests', icon: 'menu_quests' },
];

// bag filters: item type (gear) or old category (stacks)
export const BAG_FILTERS = [
  { id: 'all', label: 'All', icon: 'tab_all', test: () => true },
  { id: 'weapon', label: 'Weapon Cores', icon: 'tab_weapon', test: (d) => d.type === 'weapon_core' || d.cat === 'Weapon' },
  { id: 'armor', label: 'Armor Cores', icon: 'tab_armor', test: (d) => d.type === 'armor_core' || d.cat === 'Armor' },
  { id: 'relic', label: 'Relics', icon: 'tab_relic', test: (d) => d.type === 'relic' },
  { id: 'charm', label: 'Charms', icon: 'tab_charm', test: (d) => d.type === 'charm' },
  { id: 'rune', label: 'Runes', icon: 'tab_rune', test: (d) => d.type === 'rune' },
  { id: 'material', label: 'Materials', icon: 'tab_material', test: (d) => d.cat === 'Material' || d.cat === 'Quest Item' },
  { id: 'consumable', label: 'Consumables', icon: 'tab_consumable', test: (d) => d.cat === 'Consumable' },
];

const SLOT_ICON = { weapon_core: 'empty_weapon', armor_core: 'empty_armor', relic: 'empty_relic', charm: 'empty_charm', rune: 'empty_rune' };
const STAT_ICON = { HP: 'hp', Attack: 'attack', Defense: 'defense', 'Movement Speed': 'speed', 'Critical Chance': 'crit', 'Critical Damage': 'critDmg',
  'Attack Speed': 'attackSpeed', 'Cooldown Reduction': 'cdr', 'Resource Max': 'resource', 'Resource Generation': 'resource', 'Resource Cost': 'resource',
  'Guard Generation': 'guard', 'Barrier Strength': 'barrier', 'Counter Damage': 'counter', 'Magic Damage': 'magic', 'Damage Reduction': 'damageReduction',
  'Physical Damage': 'attack', 'Shadow Damage': 'magic', 'Healing Power': 'barrier', 'Status Resistance': 'defense', Aggro: 'guard', 'Taunt Power': 'guard' };
const statIcon = (label) => (STAT_ICON[label] ? `<img class="cw-si" src="${UI_ICON('stat_' + STAT_ICON[label])}" alt="">` : '<span class="cw-si"></span>');

export function charHeaderHTML(g) {
  const p = g.player, need = expToNext(p.level), pct = need ? Math.min(100, (p.exp / need) * 100) : 100;
  return `<div class="cw-head">
    <div class="cw-lvl" style="background-image:url(${UI_ICON('level_diamond')})"><span>${p.level}</span></div>
    <div class="cw-who"><b>${esc(p.cls.name)}</b><div class="cw-exp-t">EXP ${Math.floor(p.exp).toLocaleString()} / ${need ? need.toLocaleString() : 'MAX'}</div>
      <div class="cw-exp"><i style="width:${pct}%"></i></div></div>
    <div class="cw-pow"><div class="cap">POWER</div><b>${playerPower(p).toLocaleString()}</b></div>
  </div>`;
}

export function charTabsHTML(cur) {
  return `<div class="tabs cw-tabs">${CHAR_TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === cur ? 'on' : ''}" title="${t.label}"><img src="${UI_ICON(t.icon)}" alt="">${t.label}</button>`).join('')}<button class="x" title="Close [I]">✕</button></div>`;
}

// Equipment tab. state = { filter, selected, pickSlot }
export function equipmentTabHTML(g, state, itemDetail) {
  const p = g.player, eq = g.equipment, inv = g.inventory;
  const pick = state.pickSlot ? GEAR_SLOTS.find((s) => s.id === state.pickSlot) : null;
  const slot = (s) => {
    const id = eq.slots[s.id], d = ITEMS[id];
    return `<div class="slot cw-gear${state.pickSlot === s.id ? ' sel' : ''}" data-pick="${s.id}" title="${esc(s.label)}"${d ? ` data-tip="${id}" data-tip-eq="1" style="border-color:${RARITY_COLOR[d.rarity]}"` : ''}>
      ${d ? `<img src="${itemIconURL(d)}">` : `<img class="cw-empty" src="${UI_ICON(SLOT_ICON[s.type])}">`}</div>`;
  };
  const rows = finalStatRows(p);
  const key = ['HP', 'Attack', 'Defense', 'Critical Chance', 'Attack Speed', 'Cooldown Reduction'];
  const keyStats = rows.filter(([l]) => key.includes(l)).map(([l, v]) => `<div class="cw-kv">${statIcon(l)}<span>${l.replace('Critical Chance', 'Crit').replace('Cooldown Reduction', 'CDR')}</span><b>${v}</b></div>`).join('');
  const allStats = rows.filter(([, now, base]) => String(now) !== '0%' && String(now) !== '+0%' || String(base) !== String(now))
    .map(([l, now, base]) => `<div class="cw-kv">${statIcon(l)}<span>${l}</span><b>${now}${String(now) !== String(base) ? ` <i class="lo-base">(${base})</i>` : ''}</b></div>`).join('');

  // bag: filtered by the tab, or (while choosing a slot) only items that fit it
  const f = BAG_FILTERS.find((x) => x.id === state.filter) || BAG_FILTERS[0];
  const items = inv.list('All').filter(({ def }) => (pick ? def.type === pick.type : f.test(def)));
  const cells = items.map(({ id, n, def }) => {
    const act = pick ? `data-equip-to="${id}:${pick.id}"` : `data-item="${id}"`, low = pick && !meetsLevel(def, p.level) ? ' cw-low' : '';
    return `<div class="slot${state.selected === id ? ' sel' : ''}${low}" ${act} data-tip="${id}" style="border-color:${RARITY_COLOR[def.rarity]}"><img src="${itemIconURL(def)}"><span class="n">${n > 1 ? n : ''}</span></div>`;
  });
  const slotsLeft = Math.max(0, 32 - cells.length);
  const unequip = pick && eq.slots[pick.id] ? `<button data-unequip="${pick.id}">Unequip</button>` : '';
  return `<div class="cw-equip">
    <div class="cw-top">
      <div class="cw-stage"><img class="cw-pedestal" src="${UI_ICON('pedestal')}" alt=""><canvas class="cw-hero" width="160" height="160"></canvas></div>
      <div class="cw-side">
        <div class="cw-gearrow">${GEAR_SLOTS.slice(0, 4).map(slot).join('')}</div>
        <div class="cw-gearrow">${GEAR_SLOTS.slice(4).map(slot).join('')}</div>
        <div class="cw-keys">${keyStats}</div>
      </div>
    </div>
    <details class="cw-more"><summary>All stats · sets · item effects</summary><div class="cw-all">${allStats}</div><h4>SETS</h4>${setsHTML(eq)}${effectsHTML(g)}</details>
    <div class="cw-bagbar">
      ${pick ? `<span class="cw-picking">Choose: <b>${esc(pick.label)}</b></span>${unequip}<button data-pick="${pick.id}">Cancel</button>`
        : `<div class="cw-filters">${BAG_FILTERS.map((x) => `<button data-filter="${x.id}" class="${x.id === f.id ? 'on' : ''}" title="${x.label}"><img src="${UI_ICON(x.icon)}" alt="${x.label}"></button>`).join('')}</div>`}
      <span class="cw-gold"><img src="${UI_ICON('cur_gold')}" alt="">${p.gold.toLocaleString()}</span>
    </div>
    <div class="grid cw-bag">${cells.join('')}${'<div class="slot cw-free"></div>'.repeat(slotsLeft)}</div>
    ${pick && !items.length ? '<div class="muted small">Nothing for this slot yet.</div>' : ''}
    ${!pick && state.selected ? `<div class="detail cw-detail">${itemDetail(state.selected)}</div>` : ''}
    <div class="keys"><span><kbd>Click</kbd>slot = choose item</span><span><kbd>I</kbd>Close</span><span><kbd>Esc</kbd>Back</span></div>
  </div>`;
}

function effectsHTML(g) {
  const fx = g.itemEffects ? g.itemEffects.active() : [];
  if (!fx.length) return '';
  return `<h4>ITEM EFFECTS</h4>${fx.map((x) => `<div class="lo-fx"><span style="color:${x.color || '#ddd'}">${esc(x.name)}</span> ${esc(x.effect.text)}
    <b class="${x.running ? 'run' : x.cooldownLeft > 0 ? 'cd' : 'ready'}">${x.running ? 'ACTIVE' : x.cooldownLeft > 0 ? x.cooldownLeft.toFixed(1) + 's' : 'READY'}</b></div>`).join('')}`;
}

// the hero on the pedestal: standing still, facing the viewer (owner: no walking). Feet (sprite pivot 80,140) land on the
// centre of the pedestal's top face (theme.css .cw-hero / .cw-pedestal)
export function startHeroPreview(el, g) {
  const cv = el.querySelector('.cw-hero');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 160, 160);
  g.player.sprites.draw(ctx, g.player.sprites.frame('idle', 0, 0), 80, 140);
}
