// NPC SERVICE PANEL (UI v2, U-C) — the shared left side panel for shop / forge / storage / waystone (built by ui/panels.js).
// Layout (reference: the owner's Drakantos screenshot): service icon + title + gold on top, a small menu on the left
// (Buy / Sell, Forge, Store / Take, Travel), the list on the right, key hints at the bottom. Presentation only: each
// service keeps its own click handling in panels.js (data-buy, data-sell, data-craft, data-dep, data-wd, data-tp, data-npc-tab).
import { esc } from './itemTooltip.js';
import { UI_ICON } from './charWindow.js';

export function npcPanelHTML({ icon, title, sub = '', gold = null, menu = [], tab = null, body = '', keys = [] }) {
  return `<div class="panel npc-panel">
    <div class="np-head"><img class="np-ico" src="${UI_ICON(icon)}" alt=""><div class="np-title"><b>${esc(title)}</b>${sub ? `<div class="np-sub">${esc(sub)}</div>` : ''}</div>
      ${gold !== null ? `<span class="cw-gold"><img src="${UI_ICON('cur_gold')}" alt="">${gold.toLocaleString()}</span>` : ''}</div>
    <div class="np-main">
      ${menu.length > 1 ? `<div class="np-menu">${menu.map((m) => `<button data-npc-tab="${m.id}" class="${m.id === tab ? 'on' : ''}">${esc(m.label)}</button>`).join('')}</div>` : ''}
      <div class="np-body">${body}</div>
    </div>
    <div class="keys">${keys.map(([k, l]) => `<span><kbd>${k}</kbd>${esc(l)}</span>`).join('')}<span><kbd>Esc</kbd>Back</span></div>
    <button class="close np-close" title="Close">✕</button>
  </div>`;
}

// one list row: icon slot (rarity border) · name + small text · right side (price / button)
export const npcRow = ({ img, color = null, name, nameColor = null, text = '', right = '', tip = null, cls = '' }) => `
  <div class="np-row ${cls}"${tip ? ` data-tip="${tip}"` : ''}>
    ${img ? `<div class="slot np-slot"${color ? ` style="border-color:${color}"` : ''}><img src="${img}"></div>` : ''}
    <div class="grow"><div class="np-name"${nameColor ? ` style="color:${nameColor}"` : ''}>${esc(name)}</div>${text ? `<div class="np-text">${text}</div>` : ''}</div>
    <div class="np-right">${right}</div>
  </div>`;

export const goldTag = (n, ok = true) => `<span class="np-price${ok ? '' : ' bad'}"><img src="${UI_ICON('cur_gold')}" alt="">${n}</span>`;
