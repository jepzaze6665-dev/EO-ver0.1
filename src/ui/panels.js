import { PARTY } from '../data/party.js';
import { SKILL_TIERS, staminaCost } from '../data/skillTiers.js';
import { ITEMS, RARITY_COLOR, CATEGORIES, RECIPES, SHOPS } from '../items/items.js';
import { iconURL, itemIconURL, skillIconURL } from './icons.js';
import { dialogueFor, LORE } from '../world/narrative.js';
import { QUESTS } from '../quests/quests.js';
import { TILE, T } from '../core/constants.js';
import { CLASSES, STARTING_CLASSES } from '../skills/classes.js';
import { RESOURCES } from '../data/resources.js';
import { CLASS_COUNTERS, CLASS_TREE } from '../data/classTree.js';
import { classChangeCheck } from '../progression/classChange.js';
import { ROUTES } from '../data/routes.js';
import { levelMods, maxLevel } from '../progression/skillLevels.js';
import { masteryInfo, masteryReward } from '../progression/masterySystem.js';
import { MASTERY } from '../data/skillMastery.js';
import { evolutionsOf, evolutionById } from '../progression/skillEvolution.js';
import { SKILL_TREE } from '../data/skillTree.js';
import { describe as describeMod } from '../progression/skillModifiers.js';
import { expToNext } from '../progression/experience.js';
import { isGear } from '../items/itemDefs.js';
import { itemTooltipHTML, swapPreview } from './itemTooltip.js';
import { charHeaderHTML, charTabsHTML, equipmentTabHTML, startHeroPreview, UI_ICON } from './charWindow.js';
import { treeHTML, nodeState } from './skillTreeUI.js';
import { npcPanelHTML, npcRow, goldTag } from './npcPanel.js';
import { validName } from '../net/protocol.js';
import { ONLINE } from '../data/online.js';


// class passives (class data: passives [{ name, desc }]) — codex + Skills tab
const passiveRows = (cls) => (cls.passives && cls.passives.length ? `<h4>Passives</h4>${cls.passives.map((x) => `<div class="cx-skill"><div><b>${esc(x.name)}</b> <span class="muted small">passive</span><div class="small">${esc(x.desc)}</div></div></div>`).join('')}` : '');

// title screen embers: sparks rising from the rune circles (canvas, stops itself once removed from the page)
function startEmbers(cv) {
  if (!cv) return;
  const ctx = cv.getContext('2d'), sparks = [];
  const fit = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
  fit();
  const step = () => {
    if (!cv.isConnected) return;
    if (cv.width !== cv.clientWidth) fit();
    const W = cv.width, H = cv.height;
    if (sparks.length < 70 && Math.random() < 0.5) {
      const side = Math.random() < 0.5 ? 0.12 : 0.88;
      sparks.push({ x: W * (side + (Math.random() - 0.5) * 0.12), y: H * (0.55 + Math.random() * 0.4), vy: -(0.3 + Math.random() * 0.8), vx: (Math.random() - 0.5) * 0.3, life: 1, r: 0.6 + Math.random() * 1.6 });
    }
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx + Math.sin(p.y * 0.02) * 0.2; p.y += p.vy; p.life -= 0.004;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255,${120 + Math.round(80 * p.life)},40,${p.life * 0.9})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// DOM overlays. They only exist while open (no DOM churn during combat) and pause the game.
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// controls sheet — skill lines come from the class data (any class)
export const controlsHTML = (cls = CLASSES.umbral_sword, player = null) => `
<div class="controls">
  <div><b>WASD</b> Move (360°)</div><div><b>Mouse</b> Aim</div>
  <div><b>Left Click</b> Basic Attack (3-hit combo)</div><div><b>Space</b> Dodge — time it for PERFECT DODGE</div>
  ${(player ? player.loadout.bindings() : cls.skills.filter((s) => s.slot).map((s) => ({ key: s.slot, skill: s }))).map((b) => `<div><b>${b.key}</b> ${esc(b.skill.name)}${b.skill.ultimate ? ' (Ultimate)' : ''}</div>`).join('')}
  <div><b>${cls.guard ? 'Hold Shift / Right Click / Q' : 'Q / Right Click'}</b> ${esc(cls.special.name)}${cls.guard ? ' (Guard · time it to PARRY)' : ''}</div>
  <div><b>R</b> Healing Draught</div><div><b>F</b> Resource Tonic</div>
  <div><b>E</b> Interact / Talk</div><div><b>STAMINA</b> Dodge · Guard · some skills</div>
  <div><b>I</b> Inventory · Equipment · Knowledge</div><div><b>M</b> World Map</div>
  <div><b>ESC</b> Menu (Save / Load / Reset)</div><div><b>F3</b> Debug overlay</div>
</div>`;

export class Panels {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.current = null;
    this.invTab = 'equipment';
    this.invFilter = 'all';
    this.invCat = 'All';
    this.selected = null;
  }
  get open() { return !!this.current; }

  show(name, html, cls = '') {
    const same = this.current && this.current.name === name; // a redraw of the open window: no fade-in again (no flicker)
    this.close(true);
    const el = document.createElement('div');
    el.className = 'overlay ' + cls;
    if (same) el.style.animation = 'none';
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

  // connection state changed (net/onlineSession.js): redraw the title's online box; in game, say why the line dropped
  onNetState(state) {
    const on = this.game.online;
    if (this.current && this.current.name === 'title' && this.current.el.classList.contains('ts')) this.title(on.saveReady ? this.game.save.exists() : this.titleHasSave);
    else if (this.game.state === 'play' && state === 'offline' && on.net.lastError) this.game.ui.toast('Offline: ' + on.net.lastError.text, 4);
  }

  // ---------------- title
  title(hasSave) {
    // TITLE SCREEN: the owner's art (tools/build-title.js -> assets/ui/title: bg.png = eclipse over the valley, logo.png =
    // ECLIPSE ONLINE metal logo) + a dark shade for the menu + embers (a small canvas loop that stops when the screen closes).
    // ONLINE (N2): the game is online-only -> Continue / New Game wait for a connection. The name box is the DEV identity
    // (server/accounts.js: name + a token kept in this browser). DEV ONLY: ?offline in the URL skips the connection.
    const on = this.game.online, devOffline = /[?&]offline\b/.test(location.search);
    // a reload: this browser already owns the last name (token kept) -> log straight back in, once per page
    this.titleHasSave = hasSave;
    if (on && !devOffline && !on.autoTried && on.state === 'offline') {
      on.autoTried = true;
      const n = on.lastName();
      if (n && on.net.tokens()[n.toLowerCase()]) return on.connect(n); // onNetState redraws the title
    }
    const ready = devOffline || (on && on.online && on.saveReady); // N3: saves come from the server after login
    const st = on ? on.state : 'offline', err = on && on.net.lastError;
    const netBox = devOffline ? '<div class="ts-net dev">DEV OFFLINE MODE (?offline)</div>'
      : on && on.online ? `<div class="ts-net ok">● Online as <b>${esc(on.playerName)}</b> <button data-a="logout">Change name</button></div>`
      : `<form class="ts-net" data-a="login"><input name="nm" maxlength="16" placeholder="Character name" value="${esc((on && on.lastName()) || '')}" autocomplete="off" spellcheck="false">
          <button type="submit" ${st === 'connecting' || st === 'reconnecting' ? 'disabled' : ''}>${st === 'connecting' ? 'Connecting…' : st === 'reconnecting' ? 'Reconnecting…' : 'Connect'}</button>
          ${err ? `<div class="ts-net-err">${esc(err.text)}</div>` : ''}</form>`;
    const el = this.show('title', `
      <div class="ts-bg ts-art"><div class="ts-shade"></div><canvas class="ts-embers"></canvas></div>
      <div class="ts-wrap">
        <img class="ts-logo-img" src="assets/ui/title/logo.png" alt="Eclipse Online">
        ${netBox}
        <nav class="ts-menu">
          ${hasSave ? `<button data-a="continue" ${ready ? '' : 'disabled'}>Continue</button>` : ''}
          <button data-a="new" ${ready ? '' : 'disabled'}>New Game</button>
          <button data-a="controls">Controls</button>
        </nav>
        <div class="ts-foot">Dark Fantasy Action RPG · Prototype</div>
      </div>`, 'title ts');
    this.titleHasSave = hasSave;
    startEmbers(el.querySelector('.ts-embers'));
    const form = el.querySelector('form.ts-net');
    if (form) {
      const inp = form.querySelector('input');
      if (st === 'offline') setTimeout(() => inp.focus(), 50);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const n = inp.value.trim().replace(/\s+/g, ' '), bad = validName(n);
        if (bad) { this.game.ui.toast('Name: ' + bad, 2); return; }
        on.connect(n);
        this.title(hasSave);
      });
    }
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-a]');
      const a = t && t.dataset.a;
      if (t && t.disabled) return;
      if (a === 'logout') { on.logout(); this.title(hasSave); }
      if (a === 'new') this.classSelect(hasSave);
      if (a === 'continue') this.game.continueGame();
      if (a === 'controls') this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), () => this.title(hasSave), true);
    });
  }

  // ---------------- class select (owner reference: base class + its Class 2 masteries as a vertical tree, big character art)
  // Built from class data + CLASS_TREE: tabs = the 3 starting lines, tree = base class banner + its tier-2 children (locked:
  // preview only), right = the class splash (tools/build-class-art.js -> assets/ui/class) + info. Only a base class can start.
  classSelect(hasSave) {
    const lines = STARTING_CLASSES;
    if (!lines.includes(this.csLine)) this.csLine = lines[0];
    const base = this.csLine, kids = Object.values(CLASS_TREE).filter((n) => n.parent === base && !n.hidden).map((n) => n.id);
    if (this.csSel !== base && !kids.includes(this.csSel)) this.csSel = base;
    const sel = this.csSel, c = CLASSES[sel], node = CLASS_TREE[sel] || {}, isBase = sel === base;
    const color = (id) => (CLASSES[id] && CLASSES[id].theme && CLASSES[id].theme.color) || '#b070ff';
    const emblem = (id) => `assets/ui/class/${id}_emblem.png`;
    const r = c.ratings || {}, res = RESOURCES[c.resource] || { name: '—', colors: ['#ccc'] };
    const bar = (label, v) => `<div class="cs-rate"><span>${label}</span><i>${[1, 2, 3, 4, 5].map((k) => `<b class="${k <= (v || 0) ? 'on' : ''}"></b>`).join('')}</i></div>`;
    const reqText = (n) => (n.requirements || []).map((q) => q.type === 'level' ? `LV ${q.min ?? q.level}` : q.type === 'counter' ? `${(CLASS_COUNTERS[q.counter] || { label: q.counter }).label} ×${q.min}` : '').filter(Boolean).join(' · ');
    const row = (id, kind) => `<button class="cs-node ${kind}${id === sel ? ' sel' : ''}" data-cs-sel="${id}" style="--cc:${color(id)}">
        <span class="cs-emb"><img src="${emblem(id)}" alt="">${kind === 'mastery' ? '<i class="cs-lock">🔒</i>' : ''}</span>
        <span class="cs-txt"><small>${kind === 'base' ? 'BASE CLASS' : 'CLASS 2'}</small><b>${esc(CLASSES[id] ? CLASSES[id].name : CLASS_TREE[id].name)}</b></span></button>`;
    const el = this.show('title', `
      <div class="cs-bg" style="--cc:${color(sel)}"></div>
      <img class="cs-splash" src="assets/ui/class/${sel}_splash.png" alt="" style="--cc:${color(sel)}">
      <div class="cs-wrap">
        <div class="cs-lines">${lines.map((id) => `<button data-cs-line="${id}" class="${id === base ? 'on' : ''}" title="${esc(CLASSES[id].name)}" style="--cc:${color(id)}"><img src="${emblem(id)}" alt=""><span>${esc(CLASSES[id].name)}</span></button>`).join('')}</div>
        <div class="cs-tree">${row(base, 'base')}<div class="cs-kids">${kids.map((id) => row(id, 'mastery')).join('')}</div></div>
        <div class="cs-info" style="--cc:${color(sel)}">
          <div class="cs-role">${esc(c.role || '')}</div>
          ${c.identity ? `<div class="cs-quote">“${esc(c.identity)}”</div>` : ''}
          <p>${esc(c.description || node.description || '')}</p>
          <div class="cs-rates">${bar('Difficulty', c.difficulty || 3)}${bar('Damage', r.damage)}${bar('Defense', r.defense)}${bar('Range', r.range)}${bar('Mobility', r.mobility)}</div>
          <div class="cs-res">Resource <b style="color:${res.colors[0]}">${esc(res.name)}</b>${c.signatureWeapon ? ` · Weapon <b>${esc(c.signatureWeapon)}</b>` : ''}</div>
          <div class="cs-skills">${[...c.skills, c.special].filter(Boolean).slice(0, 7).map((s) => `<img src="${skillIconURL(s)}" title="${esc(s.name)}" alt="">`).join('')}</div>
          ${isBase ? `<button class="cs-start" data-cs-start="${base}">Begin as ${esc(c.name)}</button>`
            : `<div class="cs-unlock">🔒 CLASS 2 — unlocked later: ${esc(reqText(node))} · then pass its Trial</div><button class="cs-start" data-cs-sel="${base}">◂ Back to ${esc(CLASSES[base].name)}</button>`}
        </div>
        <button class="cs-back" data-a="back">◂ Back</button>
      </div>`, 'title cs');
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-cs-line],[data-cs-sel],[data-cs-start],[data-a]');
      if (!t) return;
      if (t.dataset.csLine) { this.csLine = t.dataset.csLine; this.csSel = t.dataset.csLine; this.game.audio.sfx('ui'); return this.classSelect(hasSave); }
      if (t.dataset.csSel) { this.csSel = t.dataset.csSel; this.game.audio.sfx('ui'); return this.classSelect(hasSave); }
      if (t.dataset.csStart) return this.game.newGame(t.dataset.csStart);
      if (t.dataset.a === 'back') this.title(hasSave);
    });
  }

  // ---------------- dialogue
  dialogue(npc) {
    this.dialogueNpc = npc.id;
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
    if (a.startsWith('quest:')) { this.close(); g.quests.accept(a.slice(6), { npc: this.dialogueNpc }); return; }
    if (a === 'shop') return this.shop();
    if (a === 'smith') return this.smith();
    if (a === 'controls') return this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), null, true);
  }

  // ---------------- yes / no (e.g. entering a boss arena). [E] = yes, [Esc] = no
  confirm(title, body, yesLabel, noLabel, onYes, onNo) {
    const el = this.show('confirm', `
      <div class="panel lore confirm">
        <h2>${esc(title)}</h2>
        <div class="body">${esc(body).replace(/\n/g, '<br>')}</div>
        <div class="confirm-btns"><button class="yes primary"><kbd>E</kbd>${esc(yesLabel)}</button><button class="no"><kbd>Esc</kbd>${esc(noLabel)}</button></div>
      </div>`);
    let done = false;
    const answer = (yes) => { if (done) return; done = true; this.close(); (yes ? onYes : onNo)(); };
    this.current.advance = () => answer(true);
    this.current.onClose = () => answer(false); // Esc / close
    el.querySelector('.yes').onclick = () => answer(true);
    el.querySelector('.no').onclick = () => answer(false);
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
    if (this.invTab === 'inventory') this.invTab = 'equipment'; // UI v2: bag + loadout are one tab
    const g = this.game, p = g.player, inv = g.inventory, eq = g.equipment;
    let body = '';
    if (this.invTab === 'equipment') {
      body = equipmentTabHTML(g, { filter: this.invFilter, selected: this.selected, pickSlot: this.pickSlot || null }, (id) => this.itemDetail(id)); // ui/charWindow.js
    } else if (this.invTab === 'skills') {
      // generic loadout editor: every class skill, keys 1-4 are chosen here (5 = ultimate, Q = special)
      const tierTag = (s) => { const t = SKILL_TIERS[s.tier]; return t ? `<span style="color:${t.color}">${t.label}</span> · ` : ''; };
      const p = g.player, lo = p.loadout, cd = (s) => `${tierTag(s)}CD ${+p.skillSys.cooldownFor(s).toFixed(1)}s${s.cost ? ` · ${p.skillSys.costFor(s)} ${RESOURCES[s.costResource || p.primaryResource].label}` : ''}${staminaCost(s) ? ` · ${staminaCost(s)} STA` : ''}`;
      // SKILL LEVEL (progression/skillLevels.js): Lv n / max, this level's effect, next level's effect + [+] button
      const UPG_WHY = { max: 'MAX', level: (r) => `needs LV ${r.need}`, points: (r) => `needs ${r.cost} pt` };
      const lvRow = (s) => {
        const max = maxLevel(s);
        if (max <= 1) return '';
        const lv = p.skillLevel(s.id), cur = levelMods(s, lv), next = lv < max ? levelMods(s, lv + 1) : null, r = p.upgradeCheck(s.id);
        const why = !r.ok && UPG_WHY[r.reason] ? (typeof UPG_WHY[r.reason] === 'function' ? UPG_WHY[r.reason](r) : UPG_WHY[r.reason]) : '';
        return `<div class="small sk-level"><b style="color:#e0c070">Lv ${lv}/${max}</b> ${esc(cur.text)}
          ${next ? `<br><span class="muted">Next: ${esc(next.text)}</span> ${r.ok ? `<button data-upgrade="${s.id}">+ Level (${r.cost} pt)</button>` : `<span class="muted">(${why})</span>`}` : ''}</div>`;
      };
      // SKILL MASTERY (data/skillMastery.js): level name, XP bar, current reward
      const masteryRow = (s) => {
        const mi = masteryInfo(g.classProgress.peekSkill(p.cls.id, s.id));
        const pct = mi.need ? Math.round((mi.into / mi.need) * 100) : 100;
        return `<div class="small sk-mastery"><b style="color:#b8a0ff">Mastery ${MASTERY.names[mi.level]}</b>
          <span style="display:inline-block;width:70px;height:5px;background:#2a2238;vertical-align:middle;border-radius:2px"><span style="display:block;width:${pct}%;height:100%;background:#b8a0ff;border-radius:2px"></span></span>
          <span class="muted">${mi.need ? `${mi.into}/${mi.need}` : 'MAX'}${mi.level ? ' · ' + esc(masteryReward(mi.level).text) : ''}</span></div>`;
      };
      // SKILL EVOLUTION: chosen branch shown on the card, [Evolution] opens the panel below
      const evoRow = (s) => {
        if (!evolutionsOf(s).length) return '';
        const cur = evolutionById(s, p.skillEvolution(s.id));
        return `<div class="small sk-evo">${cur ? `<b style="color:#ff9ad0">◆ ${esc(cur.name)}</b>` : '<span class="muted">◇ Not evolved</span>'}
          <button data-evo-open="${s.id}">Evolution ▸</button></div>`;
      };
      // SKILL TREE (data/skillTree.js): category chip + what a locked skill still needs
      const catTag = (s) => { const c = SKILL_TREE.categories[s.category]; return c ? `<span class="small" style="color:${c.color}">[${c.label}]</span> ` : ''; };
      // S6: charges + equipment / rune modifiers acting on this skill
      const gearRow = (s) => {
        const m = p.skillMods(s), ch = p.skillSys.maxCharges(s);
        const lines = (m.gear || []).map((x) => describeMod(x, (id) => (p.skillSys.get(id) || { name: id }).name));
        return (ch > 1 ? `<div class="small" style="color:#9af8ff">Charges: ${ch}</div>` : '') + lines.map((l) => `<div class="small" style="color:#9af8ff">⚙ ${esc(l)}</div>`).join('');
      };
      const lockRow = (s) => { const r = p.skillUnlockCheck(s); return r.ok ? '' : `<div class="small" style="color:#ffb070">🔒 Unlocks with: ${r.missing.map(esc).join(', ')}</div>`; };
      const card = (s, extra = '') => `<div class="skill-card${lo.slots.includes(s.id) ? ' on' : ''}"${p.skillUnlocked(s) ? '' : ' style="opacity:.6"'}>
          <img src="${skillIconURL(s)}"><div class="sk-body">${catTag(s)}<b>${esc(s.name)}</b> <span class="muted small">${cd(s)} · ${(s.tags || []).join(', ')}</span>
          <div class="small">${esc(s.desc || '')}</div>${lockRow(s)}${gearRow(s)}${lvRow(s)}${masteryRow(s)}${evoRow(s)}${extra}</div></div>`;
      const evoSkill = this.evoSel && p.skillSys.get(this.evoSel);
      if (evoSkill && evolutionsOf(evoSkill).length) {
        const s = evoSkill, cur = p.skillEvolution(s.id), mi = masteryInfo(g.classProgress.peekSkill(p.cls.id, s.id));
        const CH = [['behavior', 'Gameplay'], ['damage', 'Damage'], ['utility', 'Utility'], ['resource', 'Resource'], ['cooldown', 'Cooldown']];
        const option = (e) => {
          const r = p.evolutionCheck(s.id, e.id), chosen = cur === e.id;
          const req = e.requirements || {};
          return `<div class="evo-card${chosen ? ' on' : ''}" style="border:1px solid ${chosen ? '#ff9ad0' : '#3a2f50'};border-radius:6px;padding:8px;margin:6px 0;${cur && !chosen ? 'opacity:.55' : ''}">
            <b style="color:#ff9ad0">${esc(e.name)}</b>${chosen ? ' <span class="small" style="color:#ff9ad0">CHOSEN</span>' : ''}
            <div class="small" style="margin:4px 0">${esc(e.desc)}</div>
            <div class="small">${CH.filter(([k]) => e.changes && e.changes[k]).map(([k, l]) => `<div><span class="muted">${l}:</span> ${esc(e.changes[k])}</div>`).join('')}</div>
            <div class="small muted">Needs: Skill Lv ${req.skillLevel || 1} · Mastery ${MASTERY.names[req.masteryLevel || 0]}</div>
            ${chosen || cur ? '' : r.ok ? `<button data-evolve="${s.id}:${e.id}">Choose ${esc(e.name)}</button>` : `<div class="small" style="color:#ff7070">Missing: ${r.missing.map(esc).join(', ')}</div>`}
          </div>`;
        };
        body = `<div class="evo-panel">
          <button data-evo-open="">◂ Back to loadout</button>
          <h3>${esc(s.name)} — Evolution</h3>
          <p class="small">Your skill: <b>Lv ${p.skillLevel(s.id)}</b> · <b>Mastery ${MASTERY.names[mi.level]}</b>.
            Choose <b>ONE</b> branch — it changes how the skill plays. ${cur ? 'This skill has evolved.' : ''}</p>
          <div class="evo-card" style="border:1px dashed #3a2f50;border-radius:6px;padding:8px;margin:6px 0">
            <b>Original — ${esc(s.name)}</b><div class="small">${esc(s.desc || '')}</div></div>
          ${evolutionsOf(s).map(option).join('')}
        </div>`;
      } else
      {
        // SKILL TREE VIEW (ui/skillTreeUI.js): left = level + points, centre = the tree, right = the selected skill's card
        const all = [...p.cls.skills, p.cls.special].filter(Boolean);
        if (!this.treeSel || !all.some((s) => s.id === this.treeSel)) this.treeSel = (lo.slots.find((id) => id) || all[0].id);
        const sel = all.find((s) => s.id === this.treeSel);
        const fixedKey = sel.ultimate ? '5' : sel === p.cls.special ? 'Q' : null;
        const slotRow = fixedKey ? `<div class="muted small">Key ${fixedKey} (fixed)</div>`
          : !p.skillUnlocked(sel) ? '' : `<div class="small muted" style="margin-top:6px">Put on key:</div><div class="slot-btns">${[0, 1, 2, 3].map((i) => `<button data-slot="${i}" data-skill="${sel.id}" class="${lo.slots[i] === sel.id ? 'on' : ''}">${i + 1}</button>`).join('')}</div>`;
        const bar = lo.bindings().map((b) => `<span class="st-key${b.skill.id === sel.id ? ' on' : ''}" data-tree-sel="${b.skill.id}"><img src="${skillIconURL(b.skill)}" alt=""><kbd>${b.key}</kbd></span>`).join('')
          + (p.cls.special ? `<span class="st-key${p.cls.special.id === sel.id ? ' on' : ''}" data-tree-sel="${p.cls.special.id}"><img src="${skillIconURL(p.cls.special)}" alt=""><kbd>Q</kbd></span>` : '');
        body = `<div class="st-layout">
          <div class="st-left">
            <div class="cw-lvl st-lvl" style="background-image:url(${UI_ICON('level_diamond')})"><span>${p.progressLevel ? p.progressLevel() : p.level}</span></div>
            <div class="st-cls">${esc(p.cls.name)}</div>
            <div class="st-pts"><b>+${Math.max(0, p.skillPointsLeft())}</b> points available</div>
            <div class="muted small">1 point per ${SKILL_TREE.pointsFrom === 'class' ? 'class' : 'character'} level · each class has its own points</div>
            <div class="muted small" style="margin-top:4px">Class LV ${p.classLevel()}${p.classFollowsCharacter() ? ' (= character level)' : ` · ${Math.floor((g.classProgress.classes[p.cls.id] || {}).exp || 0)}/${expToNext(p.classLevel())} class EXP`}</div>
            <h4>SKILL BAR</h4><div class="st-bar">${bar}</div>
            ${passiveRows(p.cls)}
          </div>
          <div class="st-mid">${treeHTML(p.cls, sel.id, nodeState(p))}</div>
          <div class="st-right">${card(sel, slotRow)}<p class="muted small">Keys <b>1-4</b> are yours to choose · <b>5</b> = ultimate · <b>Q</b> = class special. Changes are locked while in combat.</p></div>
        </div>`;
      }
    } else if (this.invTab === 'class') {
      // CLASS UI (generic): lineage tree + codex of the selected class + path card (requirements / trial)
      const p = g.player, prog = g.progression, rec = prog.records[p.cls.id] || {};
      const tree = prog.lineage();
      if (!this.classSel || !tree.some((t) => t.node.id === this.classSel)) this.classSel = p.cls.id;
      const selId = this.classSel, selNode = CLASS_TREE[selId], selCls = CLASSES[selId];
      const bar = (have, need) => need ? `<span class="req-bar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></span><span class="muted small">${Math.floor(have)}/${need}</span>` : '';
      const reqRow = (r) => `<div class="req ${r.met ? 'ok' : ''}">${r.met ? '✓' : '○'} ${esc(r.label)} ${r.need ? bar(r.have, r.need) : ''}</div>`;
      const trialBox = (x) => {
        const t = x.trial;
        if (!t) return '';
        if (x.unlocked || t.state === 'passed') return `<div class="trial passed">✦ ${esc(t.def.title)} — PASSED</div>`;
        if (t.state === 'active') return `<div class="trial active"><b>${esc(t.def.title)}</b>${t.objectives.map((o) => reqRow({ met: o.have >= o.count, label: CLASS_COUNTERS[o.counter].label, have: Math.max(0, o.have), need: o.count })).join('')}<button data-abandon="${t.id}">Abandon trial</button></div>`;
        return `<div class="trial"><b>${esc(t.def.title)}</b>${t.def.objectives.map((o) => `<div class="muted small">• ${CLASS_COUNTERS[o.counter].label} ×${o.count}</div>`).join('')}<button data-trial="${x.node.id}" ${x.ready ? '' : 'disabled'}>${x.ready ? 'Begin trial' : 'Requirements not met'}</button></div>`;
      };

      // ---- LAYOUT A (owner's choice, docs/ui/ECLIPSE_ONLINE_Class_Tab_Layouts.pdf): vertical lineage tree with emblems +
      // path card on the left, class info in the middle, the class splash on the right, class records as chips at the bottom
      const BADGE = { current: ['CURRENT', 'cur'], owned: ['UNLOCKED', 'open'], unlocked: ['UNLOCKED', 'open'], ready: ['TRIAL READY', 'ready'], locked: ['🔒 LOCKED', 'lock'], future: ['🔒 LOCKED', 'lock'] };
      const badge = (st) => `<span class="ct-badge b-${BADGE[st][1]}">${BADGE[st][0]}</span>`;
      const colorOf = (id) => (CLASSES[id] && CLASSES[id].theme && CLASSES[id].theme.color) || '#e8d7a5';
      const paths = prog.paths();
      const progressOf = (id, st) => {
        if (st === 'current' || st === 'owned' || st === 'unlocked') return 1;
        const x = paths.find((q) => q.node.id === id);
        if (!x) return null;
        const total = x.reqs.length + (x.trial ? 1 : 0), met = x.reqs.filter((r) => r.met).length + (x.trial && x.trial.state === 'passed' ? 1 : 0);
        return total ? met / total : 0;
      };
      const root = tree.find((t) => t.depth === 0) || tree[0], kids = tree.filter((t) => t.depth > 0);
      const node = (t, kind) => {
        const id = t.node.id, pr = progressOf(id, t.state), dim = t.state === 'locked' || t.state === 'future';
        return `<button class="ct-node ${kind}${id === selId ? ' sel' : ''}${dim ? ' dim' : ''}" data-node="${id}" style="--cc:${colorOf(id)};${t.depth > 1 ? `margin-left:${(t.depth - 1) * 26}px` : ''}">
          <img class="ct-emb" src="assets/ui/class/${id}_emblem.png" alt="">
          <span class="ct-txt"><small>${kind === 'base' ? 'BASE CLASS' : `CLASS ${t.node.tier}`}</small><b>${esc(t.node.name)}</b> ${badge(t.state)}
          ${kind !== 'base' && pr !== null && pr < 1 ? `<span class="ct-prog"><i style="width:${Math.round(pr * 100)}%"></i></span>` : ''}</span></button>`;
      };
      const path = paths.find((x) => x.node.id === selId);
      const selState = (tree.find((t) => t.node.id === selId) || {}).state;
      const chk = (selState === 'owned' || selState === 'unlocked') && selId !== p.cls.id ? classChangeCheck(g, selId) : null;
      const why = chk && !chk.ok ? ({ not_playable: 'arrives with Class 2 content', combat: 'leave combat first', boss: 'not during a boss fight' }[chk.reason] || '') : '';
      const action = selId === p.cls.id ? `<div class="ct-note">You are playing this class.</div>`
        : chk ? (chk.ok ? `<button class="ct-go" data-change="${selId}" style="--cc:${colorOf(selId)}">Change to ${esc(selNode.name)}</button>` : `<div class="ct-note">${esc(why)}</div>`)
        : path ? `<div class="k" style="color:${colorOf(selId)}">PATH TO ${esc(path.node.name.toUpperCase())}</div>
            ${path.unlocked ? `<div class="req ok">✦ UNLOCKED</div>` : path.reqs.map(reqRow).join('')}${trialBox(path)}`
        : `<div class="ct-note">🔒 Reach this class through its parent class first.</div>`;
      const rate = (label, v) => `<div><span>${label}</span><i>${[1, 2, 3, 4, 5].map((k) => `<b class="${k <= (v || 0) ? 'on' : ''}"></b>`).join('')}</i></div>`;
      const sr = (selCls && selCls.ratings) || {};
      const info = selCls ? `<div class="ct-role">${esc(selCls.role || '')}</div>
          ${selCls.identity ? `<div class="ct-quote">“${esc(selCls.identity)}”</div>` : ''}
          <div class="ct-desc">${esc(selCls.description || selNode.description || '')}</div>
          <div class="ct-rates">${rate('Difficulty', selCls.difficulty)}${rate('Damage', sr.damage)}${rate('Defense', sr.defense)}${rate('Range', sr.range)}${rate('Mobility', sr.mobility)}${sr.support ? rate('Support', sr.support) : ''}</div>
          <div class="ct-res">Resource <b>${esc(RESOURCES[selCls.resource].name)}</b>${selCls.signatureWeapon ? ` · Weapon <b>${esc(selCls.signatureWeapon)}</b>` : ''}</div>
          <div class="ct-skills">${[...selCls.skills, selCls.special].filter(Boolean).map((s) => `<img src="${skillIconURL(s)}" title="${esc(s.name)}" alt="">`).join('')}</div>
          ${selCls.strengths ? `<div class="ct-sw"><div><b class="good">STRENGTHS</b>${selCls.strengths.map((x) => `<div>+ ${esc(x)}</div>`).join('')}</div><div><b class="bad">WEAKNESSES</b>${(selCls.weaknesses || []).map((x) => `<div>− ${esc(x)}</div>`).join('')}</div></div>` : ''}`
        : `<div class="ct-desc">${esc(selNode.description || '')}</div><p class="muted small">Skills are revealed when this class arrives.</p>`;
      const chips = Object.entries(rec).filter(([, v]) => v > 0).map(([k, v]) => `<span>${esc(CLASS_COUNTERS[k] ? CLASS_COUNTERS[k].label : k)} <b>${Math.floor(v)}</b></span>`).join('') || '<span class="muted">Nothing yet — fight!</span>';
      body = `<div class="ct-layout" style="--cc:${colorOf(selId)}">
          <img class="ct-splash" src="assets/ui/class/${selId}_splash.png" alt="">
          <div class="ct-left">
            ${node(root, 'base')}
            <div class="ct-kids">${kids.map((t) => node(t, 'mastery')).join('')}</div>
            <div class="ct-path">${action}</div>
          </div>
          <div class="ct-info">${info}</div>
          <div class="ct-records"><div class="k">CLASS RECORDS · ${esc(p.cls.name.toUpperCase())}</div><div class="ct-chips">${chips}</div></div>
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
          <div class="kv"><span>Role</span><b>${esc(e.role)}</b></div>
          <div class="kv"><span>Drop</span><b>${esc(e.drop)}</b></div>
          <div class="kv"><span>Defeated</span><b>${e.kills}</b></div>
          <p>${esc(e.desc)}</p>${e.roleHint ? `<div class="muted small">⚔ ${esc(e.roleHint)}</div>` : ''}
        </div>`).join('') || '<div class="empty">No monsters encountered yet. The world is waiting to be learned.</div>'}
        <div class="muted small">Knowledge grows as you fight: 1 kill reveals level & pattern, 3 kills weakness & drops, 5 kills HP. Lore fragments reveal secrets early.</div></div>`;
    } else {
      const found = Object.keys(g.world.state.lore);
      const quests = [...Object.keys(g.quests.active).map((q) => [q, false]), ...Object.keys(g.quests.completed).map((q) => [q, true])];
      body = `<div class="lore-layout">
        <div><h3>Quests</h3>${quests.map(([q, done]) => `<div class="quest ${done ? 'done' : ''}"><b>${esc(QUESTS[q].name)}</b>${done ? ' ✓' : ''}<div class="muted small">${esc(QUESTS[q].description)}</div></div>`).join('') || '<div class="muted">None</div>'}
        <h3>Discoveries</h3><div class="muted">Secrets found: <b>${g.world.map.secretsFound.size} / 4</b> · Lore: <b>${found.length} / ${Object.keys(LORE).length}</b> · Areas: <b>${Object.keys(g.world.state.subs).filter((k) => !k.startsWith('zone')).length}</b></div></div>
        <div><h3>Lore Fragments</h3>${found.map((k) => `<details><summary>${esc(LORE[k].title)}</summary><p>${esc(LORE[k].text).replace(/\n/g, '<br>')}</p></details>`).join('') || '<div class="muted">Unread. Look for glowing pages, statues and strange objects.</div>'}</div>
      </div>`;
    }
    const el = this.show('inventory', `
      <div class="panel big cw${this.invTab === 'equipment' ? ' cw-narrow' : ''}">
        ${charHeaderHTML(g)}${charTabsHTML(this.invTab)}
        <div class="content">${body}</div>
      </div>`, 'side');
    startHeroPreview(el, g);
    this.wireTooltip(el);
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-cat],[data-filter],[data-tree-sel],[data-item],[data-use],[data-equip],[data-equip-to],[data-unequip],[data-pick],[data-slot],[data-upgrade],[data-evo-open],[data-evolve],[data-trial],[data-abandon],[data-change],[data-node],.x');
      if (!t) return;
      if (t.classList.contains('x')) return this.close();
      if (t.dataset.tab) { this.invTab = t.dataset.tab; this.inventory(); }
      else if (t.dataset.treeSel) { this.treeSel = t.dataset.treeSel; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.filter) { this.invFilter = t.dataset.filter; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.cat) { this.invCat = t.dataset.cat; this.inventory(); }
      else if (t.dataset.item) { this.selected = t.dataset.item; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.use) { g.inventory.use(t.dataset.use); this.inventory(); }
      else if (t.dataset.equip) { if (!g.equipment.equip(t.dataset.equip)) g.ui.toast(g.equipment.lastErrorText(), 1.2); if (!g.inventory.has(this.selected)) this.selected = null; this.inventory(); }
      else if (t.dataset.unequip) { if (!g.equipment.unequip(t.dataset.unequip)) g.ui.toast(g.equipment.lastErrorText(), 1.2); else this.pickSlot = null; this.inventory(); }
      else if (t.dataset.equipTo) { const [id, slot] = t.dataset.equipTo.split(':'); if (!g.equipment.equip(id, slot)) g.ui.toast(g.equipment.lastErrorText(), 1.2); else this.pickSlot = null; this.inventory(); }
      else if (t.dataset.pick) { this.pickSlot = this.pickSlot === t.dataset.pick ? null : t.dataset.pick; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.evoOpen !== undefined) { this.evoSel = t.dataset.evoOpen || null; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.evolve) {
        const [sid, eid] = t.dataset.evolve.split(':'), r = g.player.evolveSkill(sid, eid);
        if (!r.ok) g.ui.toast(r.reason === 'combat' ? 'Cannot evolve skills in combat' : 'Requirements not met', 1.2);
        g.audio.sfx(r.ok ? 'levelup' : 'deny'); this.inventory();
      }
      else if (t.dataset.upgrade) { const r = g.player.upgradeSkill(t.dataset.upgrade); g.audio.sfx(r.ok ? 'levelup' : 'deny'); this.inventory(); }
      else if (t.dataset.slot) { g.player.setSkillSlot(+t.dataset.slot, t.dataset.skill); this.inventory(); }
      else if (t.dataset.trial) { const r = g.progression.startTrial(t.dataset.trial); if (!r.ok) g.ui.toast(r.reason === 'busy' ? 'Finish your current trial first' : 'Requirements not met', 1.2); this.inventory(); }
      else if (t.dataset.abandon) { g.progression.abandonTrial(t.dataset.abandon); this.inventory(); }
      else if (t.dataset.node) { this.classSel = t.dataset.node; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.change) { const r = g.changeClass(t.dataset.change); if (r.ok) this.close(); else g.ui.toast('Cannot change class: ' + r.reason, 1.4); }
    });
  }
  itemDetail(id) {
    const g = this.game;
    if (!id || !ITEMS[id] || !g.inventory.has(id)) return '<div class="muted">Select an item.</div>';
    const d = ITEMS[id];
    return `<img src="${itemIconURL(d)}" class="big-icon">
      <div class="tt">${itemTooltipHTML(d, { classId: g.player.cls.id, level: g.player.level, worn: g.equipment.wornIds(), swap: swapPreview(g.equipment, id) })}</div>
      ${d.use ? `<button data-use="${id}">Use</button>` : ''}${isGear(d) ? `<button data-equip="${id}">Equip</button>` : ''}`;
  }
  // ITEM TOOLTIP: any element with data-tip="<item id>" shows ui/itemTooltip.js next to the mouse
  // (data-tip-eq = the worn one: no "if equipped" preview)
  wireTooltip(el) {
    const g = this.game, tip = document.createElement('div');
    tip.className = 'item-tip'; tip.style.display = 'none';
    el.appendChild(tip);
    el.addEventListener('mousemove', (e) => {
      const t = e.target.closest('[data-tip]');
      if (!t || !ITEMS[t.dataset.tip]) { tip.style.display = 'none'; return; }
      if (tip.dataset.id !== t.dataset.tip) {
        const id = t.dataset.tip, worn = !!t.dataset.tipEq;
        tip.innerHTML = itemTooltipHTML(ITEMS[id], { classId: g.player.cls.id, level: g.player.level, worn: g.equipment.wornIds(), equipped: worn, swap: worn ? null : swapPreview(g.equipment, id) });
        tip.dataset.id = id;
      }
      tip.style.display = 'block';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 16) + 'px';
      tip.style.top = Math.min(window.innerHeight - h - 8, e.clientY + 12) + 'px';
    });
    el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  }

  // ---------------- ONLINE PARTY (N4, net/onlineSession.js -> server/parties.js). [P] or ESC menu -> Party.
  // Shows open invites (Accept / Decline), the members (leader ♛, online ●, class / level / where), leader actions
  // (Lead, Remove), Invite by name, Leave. The server decides every action; this panel only sends them and redraws.
  party() {
    const g = this.game, on = g.online, pt = on && on.party, me = on && on.playerId;
    const mapName = (id) => { const m = id && g.world.mapManager.get(id); return m ? m.short || m.name : ''; };
    let body = '';
    if (!on || !on.online) body = '<div class="muted">Not connected — the party needs the server.</div>';
    else {
      if (on.invites.length) body += '<div class="pt-h">INVITES</div>' + on.invites.map((i) => npcRow({ img: UI_ICON('npc_guild'), name: i.from,
        text: `invites you to a party (${i.size}/${ONLINE.party.maxSize})`, right: `<button data-pa="yes" data-party="${esc(i.party)}">Accept</button> <button data-pa="no" data-party="${esc(i.party)}">Decline</button>` })).join('');
      if (pt) {
        body += `<div class="pt-h">PARTY  ${pt.members.length}/${pt.max}</div>`;
        body += pt.members.map((m) => {
          const c = m.c && CLASSES[m.c], lead = m.id === pt.leader, mine = m.id === me;
          const where = m.online ? mapName(m.m) : 'offline — keeps the place for a while';
          const acts = on.isLeader && !mine ? `<button data-pa="lead" data-id="${esc(m.id)}" title="Make leader">♛</button> <button data-pa="kick" data-id="${esc(m.id)}" title="Remove from party">✕</button>` : '';
          return npcRow({ img: null, cls: 'pt-row' + (m.online ? '' : ' off'), name: `${lead ? '♛ ' : ''}${m.name}${mine ? '  (you)' : ''}`, nameColor: lead ? '#ffd98a' : null,
            text: `<i class="pt-dot${m.online ? ' on' : ''}"></i>${m.l ? 'Lv.' + m.l + ' ' : ''}${c ? esc(c.name) : ''}${where ? ' · ' + esc(where) : ''}`, right: acts });
        }).join('');
      } else body += '<div class="muted pt-solo">You are not in a party. Invite someone who is online — a party is created for you.</div>';
      const canInvite = !pt || (on.isLeader && pt.members.length < pt.max);
      if (canInvite) body += '<form class="pt-invite"><input name="nm" maxlength="16" placeholder="Player name" autocomplete="off" spellcheck="false"><button type="submit">Invite</button></form>';
      if (pt) body += '<button data-pa="leave" class="danger pt-leave">Leave party</button>';
    }
    const el = this.show('party', npcPanelHTML({ icon: 'npc_guild', title: 'Party', sub: pt ? (on.isLeader ? 'You lead' : 'Member') : 'Solo', body, keys: [['P', 'Close']] }), 'side');
    const form = el.querySelector('form.pt-invite');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = form.querySelector('input').value.trim().replace(/\s+/g, ' '), bad = validName(n);
      if (bad) return g.ui.toast('Name: ' + bad, 2);
      on.partyAction('partyInvite', { name: n });
      form.querySelector('input').value = '';
    });
    this.wireNpc(el, 'party', () => this.party(), (t) => {
      const a = t.dataset.pa;
      if (a === 'yes' || a === 'no') on.partyAction('partyAnswer', { party: t.dataset.party, yes: a === 'yes' });
      if (a === 'lead') on.partyAction('partyLead', { id: t.dataset.id });
      if (a === 'kick') on.partyAction('partyKick', { id: t.dataset.id });
      if (a === 'leave') {
        if (t.dataset.confirm) on.partyAction('partyLeave');
        else { t.dataset.confirm = '1'; t.textContent = 'Click again to leave'; }
      }
    });
  }

  // ---------------- shop / smith / storage / teleport — UI v2 side panels (ui/npcPanel.js)
  npcTab(name, def) { this.npcTabs ||= {}; return this.npcTabs[name] || def; }
  wireNpc(el, name, redraw, onClick) {
    this.wireTooltip(el);
    el.addEventListener('click', (e) => {
      const t = e.target.closest('button,[data-npc-tab]');
      if (!t) return;
      if (t.classList.contains('close')) return this.close();
      if (t.dataset.npcTab) { (this.npcTabs ||= {})[name] = t.dataset.npcTab; this.game.audio.sfx('ui'); return redraw(); }
      onClick(t);
    });
  }
  shop() {
    const g = this.game, p = g.player;
    const sellable = g.inventory.list('Material').filter(({ def }) => !def.bound), shop = SHOPS[this.dialogueNpc] || SHOPS.merchant;
    const tab = this.npcTab('shop', 'buy');
    const body = tab === 'buy'
      ? shop.stock.map((id) => { const d = ITEMS[id], ok = p.canAfford(d.price); return npcRow({ img: itemIconURL(d), color: RARITY_COLOR[d.rarity], name: d.name, nameColor: RARITY_COLOR[d.rarity], text: esc(d.modText || d.desc || ''), tip: id,
        right: `<button data-buy="${id}" ${ok ? '' : 'disabled'}>${goldTag(d.price, ok)}</button>` }); }).join('')
      : sellable.map(({ id, n, def }) => npcRow({ img: itemIconURL(def), color: RARITY_COLOR[def.rarity], name: `${def.name} ×${n}`, tip: id, right: `<button data-sell="${id}">+ ${goldTag(def.sell)}</button>` })).join('')
        || '<div class="muted small">No materials to sell.</div>';
    const el = this.show('shop', npcPanelHTML({ icon: 'npc_shop', title: shop.title, sub: tab === 'buy' ? 'Buy' : 'Sell materials', gold: p.gold,
      menu: [{ id: 'buy', label: 'Buy' }, { id: 'sell', label: 'Sell' }], tab, body, keys: [['Click', tab === 'buy' ? 'Buy' : 'Sell']] }), 'side');
    this.wireNpc(el, 'shop', () => this.shop(), (t) => {
      if (t.dataset.buy) { const d = ITEMS[t.dataset.buy]; if (!g.inventory.canAdd(t.dataset.buy)) g.ui.toast('Inventory full', 1); else if (p.removeGold(d.price)) { g.inventory.add(t.dataset.buy, 1); g.audio.sfx('chest'); } this.shop(); }
      if (t.dataset.sell) { const d = ITEMS[t.dataset.sell]; if (g.inventory.remove(t.dataset.sell, 1)) { p.addGold(d.sell); g.audio.sfx('gather'); } this.shop(); }
    });
  }
  smith() {
    const g = this.game, p = g.player, inv = g.inventory;
    const can = (r) => p.canAfford(r.gold) && inv.canAdd(r.out) && Object.entries(r.mats).every(([m, n]) => inv.has(m, n));
    const owned = (id) => inv.has(id) || Object.values(g.equipment.slots).includes(id);
    const body = RECIPES.map((r, i) => { const d = ITEMS[r.out]; return npcRow({ img: itemIconURL(d), color: RARITY_COLOR[d.rarity], name: d.name, nameColor: RARITY_COLOR[d.rarity], tip: r.out, cls: 'recipe',
      text: `${Object.entries(d.stats || {}).map(([k, v]) => `${statLabel(k)} ${statVal(k, v)}`).join(' · ')}${d.modText ? `<div class="mod">◆ ${esc(d.modText)}</div>` : ''}
        <div>${Object.entries(r.mats).map(([m, n]) => `<span class="${inv.has(m, n) ? 'ok' : 'bad'}">${esc(ITEMS[m].name)} ${inv.count(m)}/${n}</span>`).join(' · ')} · ${goldTag(r.gold, p.gold >= r.gold)}</div>`,
      right: `<button data-craft="${i}" ${can(r) && !owned(r.out) ? '' : 'disabled'}>${owned(r.out) ? 'Owned' : 'Forge'}</button>` }); }).join('')
      + '<p class="muted small">Materials drop from monsters and resource nodes.</p>';
    const el = this.show('smith', npcPanelHTML({ icon: 'npc_smith', title: "Borin's Forge", sub: 'Forge', gold: p.gold, body, keys: [['Click', 'Forge']] }), 'side');
    this.wireNpc(el, 'smith', () => this.smith(), (t) => {
      if (t.dataset.craft === undefined) return;
      const r = RECIPES[+t.dataset.craft];
      if (!can(r) || !p.removeGold(r.gold)) return;
      for (const [m, n] of Object.entries(r.mats)) inv.remove(m, n);
      inv.add(r.out, 1);
      g.audio.sfx('levelup');
      g.ui.banner('FORGED', ITEMS[r.out].name, '#ffd98a');
      this.smith();
    });
  }
  storage() {
    const g = this.game, inv = g.inventory, tab = this.npcTab('storage', 'store');
    const list = tab === 'store' ? Object.entries(inv.items).filter(([id]) => ITEMS[id].cat !== 'Quest Item' && !ITEMS[id].bound) : Object.entries(inv.storage);
    const body = list.map(([id, n]) => { const d = ITEMS[id]; return npcRow({ img: itemIconURL(d), color: RARITY_COLOR[d.rarity], name: `${d.name} ×${n}`, tip: id,
      right: tab === 'store' ? `<button data-dep="${id}">Store →</button>` : `<button data-wd="${id}">← Take</button>` }); }).join('') || '<div class="muted small">Empty</div>';
    const el = this.show('storage', npcPanelHTML({ icon: 'npc_storage', title: 'Storage Chest', sub: tab === 'store' ? 'Your bag → chest' : 'Chest → your bag',
      menu: [{ id: 'store', label: 'Store' }, { id: 'take', label: 'Take' }], tab, body, keys: [['Click', tab === 'store' ? 'Store one' : 'Take one']] }), 'side');
    this.wireNpc(el, 'storage', () => this.storage(), (t) => {
      if (t.dataset.dep) { inv.deposit(t.dataset.dep, 1); this.storage(); }
      if (t.dataset.wd) { inv.withdraw(t.dataset.wd, 1); this.storage(); }
    });
  }
  teleport(fromId) {
    const g = this.game, w = g.world;
    const stones = w.interactables.filter((it) => it.kind === 'waystone');
    const body = '<p class="muted small">Your wounds close in the waystone\'s light. Travel to any attuned waystone.</p>' + stones.map((s) => npcRow({ img: UI_ICON('npc_waystone'), name: s.name,
      text: s.id === fromId ? 'You are here' : w.state.waystones[s.id] ? '' : 'Not attuned', cls: s.id === fromId ? 'np-here' : '',
      right: w.state.waystones[s.id] && s.id !== fromId ? `<button data-tp="${s.id}">Travel</button>` : '' })).join('');
    const el = this.show('teleport', npcPanelHTML({ icon: 'npc_waystone', title: 'Waystone Network', sub: 'Travel', body, keys: [['Click', 'Travel']] }), 'side');
    this.wireNpc(el, 'teleport', () => this.teleport(fromId), (t) => { if (t.dataset.tp) { this.close(); g.teleportTo(t.dataset.tp); } });
  }

  // ---------------- world map
  worldMap() {
    const g = this.game, w = g.world, map = w.map, hud = g.ui.hud;
    hud.refreshMini();
    const el = this.show('map', `<div class="panel map"><h2><img class="h2-ico" src="${UI_ICON('menu_map')}" alt="">World Map <span class="keys" style="float:right;padding:0"><span><kbd>M</kbd>Close</span></span></h2><canvas></canvas><div class="legend">
      <span style="color:#fff">▲ You</span><span style="color:#ffe070">◆ Objective</span><span style="color:#5af0ff">◆ Waystone</span><span style="color:#ffc050">● Chest</span><span style="color:#ff4060">● Boss</span><span style="color:#8adfff">● NPC</span></div>
      <div class="routes">${this.routeProgressHtml()}</div></div>`);
    const cv = el.querySelector('canvas');
    const scale = Math.max(2, Math.floor(Math.min((window.innerHeight * 0.72) / map.h, (window.innerWidth * 0.8) / map.w)));
    cv.width = map.w * scale; cv.height = map.h * scale;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#07060c'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(hud.mini, 0, 0, cv.width, cv.height);
    // labels for discovered areas
    const seen = new Set();
    c.font = `600 ${Math.max(10, scale * 4)}px Kanit`;
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
  // World Progression per route (world/worldProgression.js routeStatus): map ✓ / open / LOCKED, its boss, secrets
  routeProgressHtml() {
    const wp = this.game.worldProgress;
    if (!wp) return '';
    return Object.values(ROUTES).map((r) => {
      const st = wp.routeStatus(r.id);
      const cell = (s) => {
        const col = s.bossDefeated ? '#8af0a0' : s.unlocked ? '#f0e6c8' : '#77708a';
        const mark = s.bossDefeated ? '✓' : s.unlocked ? '●' : '✕';
        const boss = s.boss ? `<div class="small" style="color:${s.bossDefeated ? '#8af0a0' : '#ff9a8a'}">${s.boss.type === 'major' ? 'MAJOR' : 'BOSS'}: ${s.boss.name}${s.bossDefeated ? ' ✓' : ''}</div>` : '';
        const hid = s.hiddenTotal ? `<div class="small muted">secrets ${s.hiddenFound}/${s.hiddenTotal}</div>` : '';
        const why = !s.unlocked && s.lockReason ? `<div class="small muted">${s.lockReason}</div>` : '';
        return `<div style="display:inline-block;vertical-align:top;margin:4px 8px;min-width:120px;color:${col}"><b>${mark} ${s.short}</b> <span class="small">${s.planned ? '(planned)' : s.name}</span>${boss}${hid}${why}</div>`;
      };
      const city = st.city ? `<div style="display:inline-block;vertical-align:top;margin:4px 8px;color:${st.city.unlocked ? '#ffe8b0' : '#77708a'}"><b>${st.city.unlocked ? '●' : '✕'} ${st.city.short}</b> <span class="small">${st.city.name}</span></div>`
        : `<div style="display:inline-block;vertical-align:top;margin:4px 8px;color:#77708a"><b>✕ City 2</b> <span class="small">(planned)</span></div>`;
      return `<div style="margin-top:8px;text-align:left"><b style="color:#ffd98a">${r.name}</b> <span class="muted small">${r.sub}${r.playable ? (st.complete ? ' · COMPLETE' : '') : ' · not surveyed yet'}</span><br>${st.steps.map(cell).join('<span class="muted">→</span>')}<span class="muted">→</span>${city}</div>`;
    }).join('') + this.secretMapsHtml();
  }
  // secret maps (maps/*.js `secret: true`): listed only once visited
  secretMapsHtml() {
    const w = this.game.world, found = w.mapManager.list.filter((d) => d.secret && w.state.maps[d.id]);
    if (!found.length) return '';
    return `<div style="margin-top:8px;text-align:left"><b style="color:#e0b0ff">SECRETS</b> ${found.map((d) => `<span style="margin:0 8px;color:#e0b0ff">✦ ${d.name}</span>`).join('')}</div>`;
  }
  centroid(map, subIdx) {
    if (!this._cent || this._centMap !== map) { this._cent = {}; this._centMap = map; } // per grid
    if (this._cent[subIdx]) return this._cent[subIdx];
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.sub[map.idx(x, y)] === subIdx && !map.isSolid(x, y)) { sx += x; sy += y; n++; }
    return (this._cent[subIdx] = n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 });
  }

  // ---------------- menu / death / ending
  menu() {
    const g = this.game;
    const el = this.show('menu', `
      <div class="panel menu esc-menu">
        <div class="np-head"><img class="np-ico" src="${UI_ICON('menu_settings')}" alt=""><div class="np-title"><b>ECLIPSE ONLINE</b><div class="np-sub">Paused</div></div></div>
        <div class="esc-list">
          ${[['resume', 'Resume', 'menu_class', ''], ['save', 'Save', 'menu_save', ''], ['load', 'Load', 'menu_save', g.save.exists() ? '' : 'disabled'],
            ['map', 'World Map', 'menu_map', ''], ['party', 'Party' + (g.online && g.online.party ? ` (${g.online.party.members.length})` : ''), 'menu_class', g.online && g.online.online ? '' : 'disabled'], ['controls', 'Controls', 'menu_codex', ''], ['mute', (g.audio.muted ? 'Unmute' : 'Mute') + ' Audio', 'menu_settings', ''],
            ['layout', 'HUD: ' + (g.ui.hud.layout() === 'focus' ? 'Focus (skill bar)' : 'Classic (top-left)'), 'menu_skills', ''],
            ['reset', 'Reset Progress', 'menu_quests', ''], ['title', 'Title Screen', 'menu_equipment', '']]
            .map(([a, l, ic, dis]) => `<button data-a="${a}" ${dis}><img src="${UI_ICON(ic)}" alt="">${l}</button>`).join('')}
        </div>
        <div class="muted small esc-save">${g.save.info()}</div>
        <div class="keys"><span><kbd>Esc</kbd>Resume</span></div>
      </div>`, 'side');
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      const a = btn.dataset.a;
      e = { target: btn };
      if (a === 'resume') this.close();
      if (a === 'map') { this.close(); this.worldMap(); }
      if (a === 'party') { this.close(); this.party(); }
      if (a === 'save') { g.saveGame(); this.menu(); }
      if (a === 'load') { this.close(); g.loadGame(); }
      if (a === 'reset') {
        if (e.target.dataset.confirm) { this.close(); g.resetGame(); }
        else { e.target.dataset.confirm = '1'; e.target.textContent = 'Click again to confirm reset'; e.target.classList.add('danger'); }
      }
      if (a === 'controls') this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), () => this.menu(), true);
      if (a === 'mute') { g.audio.setMuted(!g.audio.muted); this.menu(); }
      if (a === 'layout') { g.ui.hud.setLayout(g.ui.hud.layout() === 'focus' ? 'classic' : 'focus'); this.menu(); }
      if (a === 'title') { this.close(); g.toTitle(); }
    });
  }
  death() {
    const g = this.game;
    const el = this.show('death', `<div class="death"><h1>${esc(PARTY.failed.title)}</h1><p>${esc(PARTY.failed.text)}</p><button class="primary">Return to Checkpoint</button></div>`, 'dark');
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
