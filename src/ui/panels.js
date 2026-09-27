import { ITEMS, RARITY_COLOR, CATEGORIES, RECIPES, SHOP } from '../items/items.js';
import { iconURL } from './icons.js';
import { dialogueFor, LORE } from '../world/narrative.js';
import { QUESTS } from '../quests/quests.js';
import { TILE, T } from '../core/constants.js';
import { CLASSES, STARTING_CLASSES } from '../skills/classes.js';
import { RESOURCES } from '../data/resources.js';

// DOM overlays. They only exist while open (no DOM churn during combat) and pause the game.
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// controls sheet — skill lines come from the class data (any class)
export const controlsHTML = (cls = CLASSES.umbral_sword) => `
<div class="controls">
  <div><b>WASD</b> Move (360°)</div><div><b>Mouse</b> Aim</div>
  <div><b>Left Click</b> Basic Attack (3-hit combo)</div><div><b>Space</b> Dodge — time it for PERFECT DODGE</div>
  ${cls.skills.map((s) => `<div><b>${s.slot}</b> ${esc(s.name)}${s.ultimate ? ' (Ultimate)' : ''}</div>`).join('')}
  <div><b>Q / Right Click</b> ${esc(cls.special.name)}</div>
  <div><b>R</b> Healing Draught</div><div><b>F</b> Resource Tonic</div>
  <div><b>E</b> Interact / Talk</div><div><b>Shift</b> Sprint</div>
  <div><b>I</b> Inventory · Equipment · Knowledge</div><div><b>M</b> World Map</div>
  <div><b>ESC</b> Menu (Save / Load / Reset)</div><div><b>F3</b> Debug overlay</div>
</div>`;

export class Panels {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.current = null;
    this.invTab = 'inventory';
    this.invCat = 'All';
    this.selected = null;
  }
  get open() { return !!this.current; }

  show(name, html, cls = '') {
    this.close(true);
    const el = document.createElement('div');
    el.className = 'overlay ' + cls;
    el.innerHTML = html;
    this.root.appendChild(el);
    this.current = { name, el };
    this.game.input.clearAll();
    return el;
  }
  close(silent = false) {
    if (!this.current) return;
    const c = this.current;
    this.current = null;
    c.el.remove();
    if (c.onClose && !silent) c.onClose();
    this.game.input.clearAll();
  }

  // ---------------- title
  title(hasSave) {
    const el = this.show('title', `
      <div class="title-wrap">
        <div class="logo"><span class="eclipse"></span>ECLIPSE<small>ONLINE</small></div>
        <div class="tag">Dark Fantasy Action RPG — Prototype Vertical Slice</div>
        <div class="menu-buttons">
          ${hasSave ? '<button data-a="continue" class="primary">Continue</button>' : ''}
          <button data-a="new" class="${hasSave ? '' : 'primary'}">New Game</button>
          <button data-a="controls">Controls</button>
        </div>
        <div class="foot">Choose a class · Explore → Discover → Fight → Build → Boss → World State Change</div>
      </div>`, 'title');
    el.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'new') this.classSelect(hasSave);
      if (a === 'continue') this.game.continueGame();
      if (a === 'controls') this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined), () => this.title(hasSave), true);
    });
  }

  // ---------------- class select (generic: every card is built from class data)
  classSelect(hasSave) {
    const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const card = (id) => {
      const c = CLASSES[id], r = c.ratings || {}, res = RESOURCES[c.resource];
      return `<button class="class-card" data-cls="${id}" style="--cc:${(c.theme && c.theme.color) || '#b070ff'}">
        <div class="cc-name">${esc(c.name)}</div>
        <div class="cc-role">${esc(c.role || '')}</div>
        <div class="cc-desc">${esc(c.description || '')}</div>
        <div class="cc-stats">
          <span>Difficulty</span><b>${stars(c.difficulty || 3)}</b>
          <span>Damage</span><b>${stars(r.damage || 3)}</b><span>Range</span><b>${stars(r.range || 3)}</b>
          <span>Defense</span><b>${stars(r.defense || 3)}</b><span>Mobility</span><b>${stars(r.mobility || 3)}</b>
        </div>
        <div class="cc-res">Resource: <b style="color:${res.colors[0]}">${esc(res.name)}</b></div>
        <div class="cc-skills">${[...c.skills, c.special].map((s) => esc(s.name)).join(' · ')}</div>
      </button>`;
    };
    const el = this.show('title', `
      <div class="title-wrap compact">
        <div class="logo"><span class="eclipse"></span>ECLIPSE<small>ONLINE</small></div>
        <div class="tag">Choose your class</div>
        <div class="class-cards">${STARTING_CLASSES.map(card).join('')}</div>
        <div class="menu-buttons"><button data-a="back">Back</button></div>
      </div>`, 'title');
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cls]');
      if (c) return this.game.newGame(c.dataset.cls);
      if (e.target.dataset.a === 'back') this.title(hasSave);
    });
  }

  // ---------------- dialogue
  dialogue(npc) {
    const d = dialogueFor(npc.id, this.game);
    let i = 0;
    const el = this.show('dialogue', `
      <div class="dialogue">
        <div class="speaker"><span class="name">${esc(npc.name)}</span><span class="role">${esc(npc.role)}</span></div>
        <div class="line"></div>
        <div class="opts"></div>
        <div class="hint">[E] / Click to continue</div>
      </div>`, 'bottom');
    const line = el.querySelector('.line'), opts = el.querySelector('.opts'), hint = el.querySelector('.hint');
    const render = () => {
      line.textContent = d.lines[i];
      const last = i === d.lines.length - 1;
      opts.innerHTML = last ? d.options.map((o, k) => `<button data-k="${k}">${esc(o.label)}</button>`).join('') : '';
      hint.style.display = last ? 'none' : '';
    };
    this.current.advance = () => { if (i < d.lines.length - 1) { i++; render(); this.game.audio.sfx('ui'); } };
    el.addEventListener('click', (e) => {
      const k = e.target.dataset.k;
      if (k !== undefined) this.dialogueAction(d.options[+k].action);
      else this.current && this.current.advance && this.current.advance();
    });
    render();
  }
  dialogueAction(a) {
    const g = this.game;
    if (a === 'close') return this.close();
    if (a.startsWith('quest:')) { this.close(); g.quests.accept(a.slice(6)); return; }
    if (a === 'shop') return this.shop();
    if (a === 'smith') return this.smith();
    if (a === 'controls') return this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined), null, true);
  }

  // ---------------- lore / text
  textPanel(title, body, onClose, html = false) {
    const el = this.show('text', `
      <div class="panel lore">
        <h2>${esc(title)}</h2>
        <div class="body">${html ? body : esc(body).replace(/\n/g, '<br>')}</div>
        <button class="close">Close [E]</button>
      </div>`);
    this.current.onClose = onClose;
    this.current.advance = () => this.close();
    el.querySelector('.close').onclick = () => this.close();
  }

  // ---------------- inventory / equipment / knowledge / lore
  inventory(tab) {
    if (tab) this.invTab = tab;
    const g = this.game, p = g.player, inv = g.inventory, eq = g.equipment;
    const tabs = [['inventory', 'Inventory'], ['equipment', 'Equipment'], ['knowledge', 'Monster Knowledge'], ['lore', 'Lore & Quests']];
    let body = '';
    if (this.invTab === 'inventory') {
      const items = inv.list(this.invCat);
      body = `
        <div class="cats">${CATEGORIES.map((c) => `<button data-cat="${c}" class="${c === this.invCat ? 'on' : ''}">${c}</button>`).join('')}</div>
        <div class="inv-layout">
          <div class="grid">${items.map(({ id, n, def }) => `
            <div class="slot ${this.selected === id ? 'sel' : ''}" data-item="${id}" style="border-color:${RARITY_COLOR[def.rarity]}">
              <img src="${iconURL(def.icon, def.color)}"><span class="n">${n > 1 ? n : ''}</span>
            </div>`).join('') || '<div class="empty">Nothing here yet.</div>'}
          </div>
          <div class="detail">${this.itemDetail(this.selected)}</div>
        </div>
        <div class="gold">Gold: <b>${p.gold}</b></div>`;
    } else if (this.invTab === 'equipment') {
      const slot = (s, label) => {
        const id = eq.slots[s], def = id && ITEMS[id];
        return `<div class="eq-slot"><div class="lbl">${label}</div>${def ? `<img src="${iconURL(def.icon, def.color)}"><div><div style="color:${RARITY_COLOR[def.rarity]}">${esc(def.name)}</div><div class="mod">${esc(def.modText || '')}</div></div>${s !== 'weapon' ? `<button data-unequip="${s}">Unequip</button>` : ''}` : '<div class="muted">— empty —</div>'}</div>`;
      };
      const st = p.stats;
      const pct = (v) => Math.round(v * 100) + '%';
      body = `
        <div class="eq-layout">
          <div>${slot('weapon', 'WEAPON')}${slot('armor', 'ARMOR')}${slot('accessory', 'ACCESSORY')}
            <p class="muted small">Equip items from the Inventory tab. Equipment changes stats <i>and</i> how skills behave.</p></div>
          <div class="stats">
            <h3>${esc(p.cls.name)} — LV.${p.level}</h3>
            <div>Max HP <b>${p.maxHp}</b></div><div>Attack <b>${Math.round(st.atk)}</b></div><div>Defense <b>${Math.round(st.def)}</b></div>
            <div>Critical <b>${pct(st.crit)}</b></div><div>Shadow Damage <b>+${pct(st.shadowDmg)}</b></div><div>Cooldown Reduction <b>${pct(st.cdr || 0)}</b></div>
            <div>Shadow Gain <b>${pct(st.shadowGain)}</b></div><div>Armor Break <b>×${(st.armorBreak || 1).toFixed(1)}</b></div>
            <div>EXP <b>${p.exp} / ${p.expToNext()}</b></div>
            <h3>Skill Modifiers</h3>
            ${Object.keys(p.mods).length ? Object.values(eq.slots).filter(Boolean).map((id) => ITEMS[id].modText ? `<div class="mod">◆ ${esc(ITEMS[id].modText)}</div>` : '').join('') : '<div class="muted">None — find or forge equipment to change your build.</div>'}
          </div>
        </div>`;
    } else if (this.invTab === 'knowledge') {
      const list = g.knowledge.view();
      body = `<div class="know">${list.map((e) => `
        <div class="know-card">
          <h3>${esc(e.name.toUpperCase())}</h3>
          <div class="kv"><span>Level</span><b>${e.level}</b></div>
          <div class="kv"><span>HP</span><b>${e.hp}</b></div>
          <div class="kv"><span>Weakness</span><b>${esc(e.weakness)}</b></div>
          <div class="kv"><span>Pattern</span><b>${esc(e.pattern)}</b></div>
          <div class="kv"><span>Drop</span><b>${esc(e.drop)}</b></div>
          <div class="kv"><span>Defeated</span><b>${e.kills}</b></div>
          <p>${esc(e.desc)}</p>
        </div>`).join('') || '<div class="empty">No monsters encountered yet. The world is waiting to be learned.</div>'}
        <div class="muted small">Knowledge grows as you fight: 1 kill reveals level & pattern, 3 kills weakness & drops, 5 kills HP. Lore fragments reveal secrets early.</div></div>`;
    } else {
      const found = Object.keys(g.world.state.lore);
      const quests = [...Object.keys(g.quests.active).map((q) => [q, false]), ...Object.keys(g.quests.completed).map((q) => [q, true])];
      body = `<div class="lore-layout">
        <div><h3>Quests</h3>${quests.map(([q, done]) => `<div class="quest ${done ? 'done' : ''}"><b>${esc(QUESTS[q].title)}</b>${done ? ' ✓' : ''}<div class="muted small">${esc(QUESTS[q].desc)}</div></div>`).join('') || '<div class="muted">None</div>'}
        <h3>Discoveries</h3><div class="muted">Secrets found: <b>${g.world.map.secretsFound.size} / 4</b> · Lore: <b>${found.length} / ${Object.keys(LORE).length}</b> · Areas: <b>${Object.keys(g.world.state.subs).filter((k) => !k.startsWith('zone')).length}</b></div></div>
        <div><h3>Lore Fragments</h3>${found.map((k) => `<details><summary>${esc(LORE[k].title)}</summary><p>${esc(LORE[k].text).replace(/\n/g, '<br>')}</p></details>`).join('') || '<div class="muted">Unread. Look for glowing pages, statues and strange objects.</div>'}</div>
      </div>`;
    }
    const el = this.show('inventory', `
      <div class="panel big">
        <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === this.invTab ? 'on' : ''}">${l}</button>`).join('')}<button class="x">✕</button></div>
        <div class="content">${body}</div>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-cat],[data-item],[data-use],[data-equip],[data-unequip],.x');
      if (!t) return;
      if (t.classList.contains('x')) return this.close();
      if (t.dataset.tab) { this.invTab = t.dataset.tab; this.inventory(); }
      else if (t.dataset.cat) { this.invCat = t.dataset.cat; this.inventory(); }
      else if (t.dataset.item) { this.selected = t.dataset.item; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.use) { g.inventory.use(t.dataset.use); this.inventory(); }
      else if (t.dataset.equip) { g.equipment.equip(t.dataset.equip); if (!g.inventory.has(this.selected)) this.selected = null; this.inventory(); }
      else if (t.dataset.unequip) { g.equipment.unequip(t.dataset.unequip); this.inventory(); }
    });
  }
  itemDetail(id) {
    if (!id || !ITEMS[id] || !this.game.inventory.has(id)) return '<div class="muted">Select an item.</div>';
    const d = ITEMS[id];
    const stats = Object.entries(d.stats || {}).filter(([, v]) => v).map(([k, v]) => `<div>${statLabel(k)} <b>${statVal(k, v)}</b></div>`).join('');
    return `<img src="${iconURL(d.icon, d.color)}" class="big-icon">
      <h3 style="color:${RARITY_COLOR[d.rarity]}">${esc(d.name)}</h3>
      <div class="muted small">${d.cat}${d.slot ? ' · ' + d.slot : ''} · ${d.rarity}</div>
      <p>${esc(d.desc)}</p>${stats}${d.modText ? `<div class="mod">◆ ${esc(d.modText)}</div>` : ''}
      ${d.use ? `<button data-use="${id}">Use</button>` : ''}${d.slot ? `<button data-equip="${id}">Equip</button>` : ''}`;
  }

  // ---------------- shop / smith / storage / teleport
  shop() {
    const g = this.game, p = g.player;
    const sellable = g.inventory.list('Material');
    const el = this.show('shop', `
      <div class="panel">
        <h2>Lysa's Goods <span class="gold-inline">${p.gold} G</span></h2>
        <h3>Buy</h3>
        ${SHOP.map((id) => { const d = ITEMS[id]; return `<div class="row"><img src="${iconURL(d.icon, d.color)}"><div class="grow"><b style="color:${RARITY_COLOR[d.rarity]}">${esc(d.name)}</b><div class="muted small">${esc(d.modText || d.desc)}</div></div><button data-buy="${id}" ${p.gold < d.price ? 'disabled' : ''}>${d.price} G</button></div>`; }).join('')}
        <h3>Sell materials</h3>
        ${sellable.map(({ id, n, def }) => `<div class="row"><img src="${iconURL(def.icon, def.color)}"><div class="grow">${esc(def.name)} ×${n}</div><button data-sell="${id}">+${def.sell} G</button></div>`).join('') || '<div class="muted">No materials to sell.</div>'}
        <button class="close">Close</button>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('close')) return this.close();
      if (t.dataset.buy) { const d = ITEMS[t.dataset.buy]; if (p.gold >= d.price) { p.gold -= d.price; g.inventory.add(t.dataset.buy, 1); g.audio.sfx('chest'); } this.shop(); }
      if (t.dataset.sell) { const d = ITEMS[t.dataset.sell]; if (g.inventory.remove(t.dataset.sell, 1)) { p.gold += d.sell; g.audio.sfx('gather'); } this.shop(); }
    });
  }
  smith() {
    const g = this.game, p = g.player, inv = g.inventory;
    const can = (r) => p.gold >= r.gold && Object.entries(r.mats).every(([m, n]) => inv.has(m, n));
    const owned = (id) => inv.has(id) || Object.values(g.equipment.slots).includes(id);
    const el = this.show('smith', `
      <div class="panel">
        <h2>Borin's Forge <span class="gold-inline">${p.gold} G</span></h2>
        ${RECIPES.map((r, i) => { const d = ITEMS[r.out]; return `<div class="row recipe"><img src="${iconURL(d.icon, d.color)}"><div class="grow"><b style="color:${RARITY_COLOR[d.rarity]}">${esc(d.name)}</b>
          <div class="small">${Object.entries(d.stats).map(([k, v]) => `${statLabel(k)} ${statVal(k, v)}`).join(' · ')}</div>
          <div class="mod small">◆ ${esc(d.modText)}</div>
          <div class="small">${Object.entries(r.mats).map(([m, n]) => `<span class="${inv.has(m, n) ? 'ok' : 'bad'}">${ITEMS[m].name} ${inv.count(m)}/${n}</span>`).join(' · ')} · <span class="${p.gold >= r.gold ? 'ok' : 'bad'}">${r.gold} G</span></div></div>
          <button data-craft="${i}" ${can(r) && !owned(r.out) ? '' : 'disabled'}>${owned(r.out) ? 'Owned' : 'Forge'}</button></div>`; }).join('')}
        <p class="muted small">Materials drop from monsters and resource nodes. Hint: Crystal Beasts guard the Crystal Glade.</p>
        <button class="close">Close</button>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('close')) return this.close();
      if (t.dataset.craft !== undefined) {
        const r = RECIPES[+t.dataset.craft];
        if (!can(r)) return;
        p.gold -= r.gold;
        for (const [m, n] of Object.entries(r.mats)) inv.remove(m, n);
        inv.add(r.out, 1);
        g.audio.sfx('levelup');
        g.ui.banner('FORGED', ITEMS[r.out].name, '#ffd98a');
        this.smith();
      }
    });
  }
  storage() {
    const g = this.game, inv = g.inventory;
    const col = (list, attr, label) => list.map(([id, n]) => { const d = ITEMS[id]; return `<div class="row"><img src="${iconURL(d.icon, d.color)}"><div class="grow">${esc(d.name)} ×${n}</div><button data-${attr}="${id}">${label}</button></div>`; }).join('') || '<div class="muted">Empty</div>';
    const el = this.show('storage', `
      <div class="panel wide">
        <h2>Storage</h2>
        <div class="two">
          <div><h3>Inventory</h3>${col(Object.entries(inv.items).filter(([id]) => ITEMS[id].cat !== 'Quest Item'), 'dep', 'Store →')}</div>
          <div><h3>Storage Chest</h3>${col(Object.entries(inv.storage), 'wd', '← Take')}</div>
        </div>
        <button class="close">Close</button>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('close')) return this.close();
      if (t.dataset.dep) { inv.deposit(t.dataset.dep, 1); this.storage(); }
      if (t.dataset.wd) { inv.withdraw(t.dataset.wd, 1); this.storage(); }
    });
  }
  teleport(fromId) {
    const g = this.game, w = g.world;
    const stones = w.interactables.filter((it) => it.kind === 'waystone');
    const el = this.show('teleport', `
      <div class="panel">
        <h2>Waystone Network</h2>
        <p class="muted small">Your wounds close in the waystone's light. Travel to any attuned waystone.</p>
        ${stones.map((s) => `<div class="row"><div class="grow"><b>${esc(s.name)}</b>${s.id === fromId ? ' <span class="muted">(here)</span>' : ''}</div>
          ${w.state.waystones[s.id] ? (s.id === fromId ? '' : `<button data-tp="${s.id}">Travel</button>`) : '<span class="muted">Not attuned</span>'}</div>`).join('')}
        <button class="close">Close</button>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('close')) return this.close();
      if (t.dataset.tp) { this.close(); g.teleportTo(t.dataset.tp); }
    });
  }

  // ---------------- world map
  worldMap() {
    const g = this.game, w = g.world, map = w.map, hud = g.ui.hud;
    hud.refreshMini();
    const el = this.show('map', `<div class="panel map"><h2>World Map <span class="muted small">[M] close</span></h2><canvas></canvas><div class="legend">
      <span style="color:#fff">▲ You</span><span style="color:#ffe070">◆ Objective</span><span style="color:#5af0ff">◆ Waystone</span><span style="color:#ffc050">● Chest</span><span style="color:#ff4060">● Guardian</span><span style="color:#8adfff">● NPC</span></div></div>`);
    const cv = el.querySelector('canvas');
    const scale = Math.max(2, Math.floor(Math.min((window.innerHeight * 0.72) / map.h, (window.innerWidth * 0.8) / map.w)));
    cv.width = map.w * scale; cv.height = map.h * scale;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#07060c'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(hud.mini, 0, 0, cv.width, cv.height);
    // labels for discovered areas
    const seen = new Set();
    c.font = `600 ${Math.max(10, scale * 4)}px Georgia`;
    c.textAlign = 'center';
    for (let ty = 0; ty < map.h; ty += 2) for (let tx = 0; tx < map.w; tx += 2) {
      const i = map.idx(tx, ty), sa = map.subAreas[map.sub[i]];
      if (!sa || seen.has(sa.name) || !w.state.subs[sa.name] || !map.revealed[i]) continue;
      if (sa.secret && !map.secretsFound.has(sa.secret)) continue;
      seen.add(sa.name);
      const pos = this.centroid(map, map.sub[i]);
      c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(sa.name, pos.x * scale, pos.y * scale);
      c.fillStyle = sa.secret ? '#e0b0ff' : '#f0e6c8'; c.fillText(sa.name, pos.x * scale, pos.y * scale);
    }
    for (const m of hud.markers()) {
      c.fillStyle = m.c;
      c.beginPath(); c.arc((m.x / TILE) * scale, (m.y / TILE) * scale, m.r * scale * 0.9, 0, 7); c.fill();
    }
    const p = g.player;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc((p.x / TILE) * scale, (p.y / TILE) * scale, scale * 2, 0, 7); c.fill();
  }
  centroid(map, subIdx) {
    if (!this._cent) this._cent = {};
    if (this._cent[subIdx]) return this._cent[subIdx];
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.sub[map.idx(x, y)] === subIdx && !map.isSolid(x, y)) { sx += x; sy += y; n++; }
    return (this._cent[subIdx] = n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 });
  }

  // ---------------- menu / death / ending
  menu() {
    const g = this.game;
    const el = this.show('menu', `
      <div class="panel menu">
        <h2>ECLIPSE ONLINE</h2>
        <div class="menu-buttons">
          <button data-a="resume" class="primary">Resume</button>
          <button data-a="save">Save</button>
          <button data-a="load" ${g.save.exists() ? '' : 'disabled'}>Load</button>
          <button data-a="reset">Reset Progress</button>
          <button data-a="controls">Controls</button>
          <button data-a="mute">${g.audio.muted ? 'Unmute' : 'Mute'} Audio</button>
          <button data-a="title">Title Screen</button>
        </div>
        <div class="muted small">${g.save.info()}</div>
      </div>`);
    el.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'resume') this.close();
      if (a === 'save') { g.save.save(); this.menu(); g.ui.toast('Game saved', 1.5); }
      if (a === 'load') { this.close(); g.loadGame(); }
      if (a === 'reset') {
        if (e.target.dataset.confirm) { this.close(); g.resetGame(); }
        else { e.target.dataset.confirm = '1'; e.target.textContent = 'Click again to confirm reset'; e.target.classList.add('danger'); }
      }
      if (a === 'controls') this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined), () => this.menu(), true);
      if (a === 'mute') { g.audio.setMuted(!g.audio.muted); this.menu(); }
      if (a === 'title') { this.close(); g.toTitle(); }
    });
  }
  death() {
    const g = this.game;
    const el = this.show('death', `<div class="death"><h1>YOU HAVE FALLEN</h1><p>The shadows recede… but the lesson remains.</p><button class="primary">Rise Again</button></div>`, 'dark');
    el.querySelector('button').onclick = () => { this.close(); g.respawn(); };
  }
  ending(stats) {
    const g = this.game;
    const el = this.show('ending', `
      <div class="ending">
        <div class="eclipse big"></div>
        <h1>YOUR JOURNEY HAS ONLY BEGUN.</h1>
        <p>The Guardian rests. The forest breathes again. Beneath the Ancient Valley, the Sealed Depths wait for the one who severed the eclipse.</p>
        <div class="summary">
          <div>Play Time <b>${stats.time}</b></div><div>Level <b>${stats.level}</b></div>
          <div>Secrets <b>${stats.secrets} / 4</b></div><div>Lore <b>${stats.lore} / ${stats.loreTotal}</b></div>
          <div>Monsters Defeated <b>${stats.kills}</b></div><div>Treasure Found <b>${stats.chests}</b></div>
        </div>
        <p class="muted">ECLIPSE ONLINE — Prototype Vertical Slice · To be continued in Ancient Valley — A2</p>
        <button class="primary">Continue Exploring</button>
      </div>`, 'dark');
    el.querySelector('button').onclick = () => this.close();
  }
}

function statLabel(k) {
  return { atk: 'Attack', def: 'Defense', hp: 'Max HP', crit: 'Critical', shadowDmg: 'Shadow Dmg', cdr: 'Cooldown', shadowGain: 'Shadow Gain', armorBreak: 'Armor Break' }[k] || k;
}
function statVal(k, v) {
  if (k === 'armorBreak') return '×' + v;
  if (['crit', 'shadowDmg', 'cdr', 'shadowGain'].includes(k)) return (k === 'cdr' ? '-' : '+') + Math.round(v * 100) + '%';
  return '+' + v;
}
