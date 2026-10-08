import { PARTY } from '../data/party.js';
import { AUDIO_BUSES } from '../data/sounds.js';
import { SKILL_TIERS, staminaCost } from '../data/skillTiers.js';
import { ITEMS, RARITY_COLOR, CATEGORIES, RECIPES, SHOPS, shopId, shopPrice } from '../items/items.js';
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
import { WORLD_MAP } from '../data/worldMap.js';
import { TELEGRAPH_VIEW, telegraphView, setTelegraphView } from '../combat/telegraph.js';
import { BOSSES } from '../data/bosses.js';
import { LOOT_TABLES } from '../data/lootTables.js';
import { Assets } from '../core/assets.js';
import { t as tl, tx, getLang, nextLang, setLang } from '../i18n/i18n.js';
import { LANG } from '../data/lang.js';


// class passives (class data: passives [{ name, desc }]) — codex + Skills tab
const passiveRows = (cls) => (cls.passives && cls.passives.length ? `<h4>${tl('Passives')}</h4>${cls.passives.map((x) => `<div class="cx-skill"><div><b>${esc(x.name)}</b> <span class="muted small">${tl('passive')}</span><div class="small">${esc(x.desc)}</div></div></div>`).join('')}` : '');

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
  <div><b>WASD</b> ${tl('Move (360°)')}</div><div><b>${tl('Mouse')}</b> ${tl('Aim')}</div>
  <div><b>${tl('Left Click')}</b> ${tl('Basic Attack (3-hit combo)')}</div><div><b>Space</b> ${tl('Dodge — time it for PERFECT DODGE')}</div>
  ${(player ? player.loadout.bindings() : cls.skills.filter((s) => s.slot).map((s) => ({ key: s.slot, skill: s }))).map((b) => `<div><b>${b.key}</b> ${esc(b.skill.name)}${b.skill.ultimate ? ' ' + tl('(Ultimate)') : ''}</div>`).join('')}
  <div><b>${cls.guard ? tl('Hold Shift / Right Click / Q') : tl('Q / Right Click')}</b> ${esc(cls.special.name)}${cls.guard ? ' ' + tl('(Guard · time it to PARRY)') : ''}</div>
  <div><b>R</b> ${tl('Healing Draught')}</div><div><b>F</b> ${tl('Resource Tonic')}</div>
  <div><b>E</b> ${tl('Interact / Talk')}</div><div><b>${tl('STAMINA')}</b> ${tl('Dodge · Guard · some skills')}</div>
  <div><b>I</b> ${tl('Inventory · Equipment · Knowledge')}</div><div><b>M</b> ${tl('World Map')}</div>
  <div><b>ESC</b> ${tl('Menu (Save / Load / Reset)')}</div><div><b>F3</b> ${tl('Debug overlay')}</div><div><b>F4</b> ${tl('Dev panel (dev only)')}</div>
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
    else if (this.game.state === 'play' && state === 'offline' && on.net.lastError) {
      // N10: kicked for good (logged in elsewhere, new version, ...): an online-only game goes back to the title
      const why = on.net.lastError.text;
      this.game.toTitle();
      this.game.ui.toast(tl('Disconnected: {why}', { why: tx(why) }), 6);
    }
  }

  // ---------------- title
  title(hasSave) {
    // TITLE SCREEN: the owner's art (tools/build-title.js -> assets/ui/title: bg.png = eclipse over the valley, logo.png =
    // ECLIPSE ONLINE metal logo) + a dark shade for the menu + embers (a small canvas loop that stops when the screen closes).
    // ONLINE (N2): the game is online-only -> Continue / New Game wait for a connection. The name box is the DEV identity
    // (server/accounts.js: name + a token kept in this browser). DEV ONLY: ?offline in the URL skips the connection.
    const on = this.game.online, devOffline = /[?&]offline\b/.test(location.search);
    // a reload: this browser already owns the last name (token kept) -> log straight back in, once per page — unless
    // another open tab of this browser is playing that name right now (it would be kicked: 'replaced')
    this.titleHasSave = hasSave;
    if (on && !devOffline && !on.autoTried && on.state === 'offline') {
      on.autoTried = true;
      const n = on.lastName();
      if (n && on.net.tokens()[n.toLowerCase()] && !on.nameInUseElsewhere(n)) return on.connect(n); // onNetState redraws the title
    }
    const ready = devOffline || (on && on.online && on.saveReady); // N3: saves come from the server after login
    const st = on ? on.state : 'offline', err = on && on.net.lastError;
    const netBox = devOffline ? '<div class="ts-net dev">DEV OFFLINE MODE (?offline)</div>'
      : on && on.online ? `<div class="ts-net ok">● ${tl('Online as')} <b>${esc(on.playerName)}</b> <button data-a="logout">${tl('Log out')}</button></div>`
        + (on.hasPw === false ? `<form class="ts-net ts-setpw"><span>${tl('Protect this name with a password:')}</span><input name="pw" type="password" maxlength="64" placeholder="${tl('New password (6+)')}" autocomplete="new-password"><button type="submit">${tl('Set password')}</button></form>` : '')
      : `<form class="ts-net" data-a="login"><input name="nm" maxlength="16" placeholder="${tl('Character name')}" value="${esc((on && on.lastName()) || '')}" autocomplete="username" spellcheck="false">
          <input name="pw" type="password" maxlength="64" placeholder="${tl('Password')}" autocomplete="current-password">
          <button type="submit" ${st === 'connecting' || st === 'reconnecting' ? 'disabled' : ''}>${st === 'connecting' ? tl('Connecting…') : st === 'reconnecting' ? tl('Reconnecting…') : tl('Log in')}</button>
          <button type="button" data-create ${st === 'connecting' || st === 'reconnecting' ? 'disabled' : ''}>${tl('Create account')}</button>
          ${err ? `<div class="ts-net-err">${esc(tx(err.text))}</div>` : ''}</form>`;
    const el = this.show('title', `
      <div class="ts-bg ts-art"><div class="ts-shade"></div><canvas class="ts-embers"></canvas></div>
      <div class="ts-wrap">
        <img class="ts-logo-img" src="assets/ui/title/logo.png" alt="Eclipse Online">
        ${netBox}
        <nav class="ts-menu">
          ${hasSave ? `<button data-a="continue" ${ready ? '' : 'disabled'}>${tl('Continue')}</button>` : ''}
          <button data-a="new" ${ready ? '' : 'disabled'}>${tl('New Game')}</button>
          <button data-a="controls">${tl('Controls')}</button>
          <button data-a="lang">${tl('Language: {name}', { name: LANG.names[getLang()] })}</button>
        </nav>
        <div class="ts-foot">${tl('Dark Fantasy Action RPG · Prototype')}</div>
      </div>`, 'title ts');
    this.titleHasSave = hasSave;
    startEmbers(el.querySelector('.ts-embers'));
    const form = el.querySelector('form.ts-net[data-a="login"]');
    if (form) {
      const inp = form.querySelector('input[name=nm]'), pw = form.querySelector('input[name=pw]');
      if (st === 'offline') setTimeout(() => (inp.value ? pw : inp).focus(), 50);
      // H6: Log in = name + password (empty password = this device's remembered login); Create account = new name + password
      const go = (create) => {
        const n = inp.value.trim().replace(/\s+/g, ' '), bad = validName(n);
        if (bad) { this.game.ui.toast(tl('Name: {why}', { why: bad }), 2); return; }
        if (create && pw.value.length < 6) { this.game.ui.toast(tl('Password: at least 6 characters'), 2.5); return; }
        on.connect(n, pw.value ? { pw: pw.value, ...(create ? { create: true } : {}) } : null);
        this.title(hasSave);
      };
      form.addEventListener('submit', (e) => { e.preventDefault(); go(false); });
      form.querySelector('[data-create]').addEventListener('click', () => go(true));
    }
    const setpw = el.querySelector('form.ts-setpw');
    if (setpw) setpw.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = setpw.querySelector('input').value;
      if (v.length < 6) { this.game.ui.toast(tl('Password: at least 6 characters'), 2.5); return; }
      on.setPassword(v);
    });
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-a]');
      const a = t && t.dataset.a;
      if (t && t.disabled) return;
      if (a === 'logout') { on.logout(); this.title(hasSave); }
      if (a === 'lang') { setLang(nextLang()); this.title(hasSave); }
      if (a === 'new') this.classSelect(hasSave);
      if (a === 'continue') this.game.continueGame();
      if (a === 'controls') this.textPanel(tl('Controls'), controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), () => this.title(hasSave), true);
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
        <span class="cs-txt"><small>${kind === 'base' ? tl('BASE CLASS') : tl('CLASS 2')}</small><b>${esc(CLASSES[id] ? CLASSES[id].name : CLASS_TREE[id].name)}</b></span></button>`;
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
          <div class="cs-rates">${bar(tl('Difficulty'), c.difficulty || 3)}${bar(tl('Damage'), r.damage)}${bar(tl('Defense'), r.defense)}${bar(tl('Range'), r.range)}${bar(tl('Mobility'), r.mobility)}</div>
          <div class="cs-res">${tl('Resource')} <b style="color:${res.colors[0]}">${esc(res.name)}</b>${c.signatureWeapon ? ` · ${tl('Weapon')} <b>${esc(c.signatureWeapon)}</b>` : ''}</div>
          <div class="cs-skills">${[...c.skills, c.special].filter(Boolean).slice(0, 7).map((s) => `<img src="${skillIconURL(s)}" title="${esc(s.name)}" alt="">`).join('')}</div>
          ${isBase ? `<button class="cs-start" data-cs-start="${base}">${tl('Begin as {name}', { name: esc(c.name) })}</button>`
            : `<div class="cs-unlock">🔒 ${tl('CLASS 2 — unlocked later: {req} · then pass its Trial', { req: esc(reqText(node)) })}</div><button class="cs-start" data-cs-sel="${base}">${tl('◂ Back to {name}', { name: esc(CLASSES[base].name) })}</button>`}
        </div>
        <button class="cs-back" data-a="back">${tl('◂ Back')}</button>
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
        <div class="hint">${tl('[E] / Click to continue')}</div>
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
    if (a === 'controls') return this.textPanel(tl('Controls'), controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), null, true);
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
        <button class="close">${tl('Close [E]')}</button>
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
      const tierTag = (s) => { const t = SKILL_TIERS[s.tier]; return t ? `<span style="color:${t.color}">${tl(t.label)}</span> · ` : ''; };
      const p = g.player, lo = p.loadout, cd = (s) => `${tierTag(s)}${tl('CD')} ${+p.skillSys.cooldownFor(s).toFixed(1)}s${s.cost ? ` · ${p.skillSys.costFor(s)} ${RESOURCES[s.costResource || p.primaryResource].label}` : ''}${staminaCost(s) ? ` · ${staminaCost(s)} STA` : ''}`;
      // SKILL LEVEL (progression/skillLevels.js): Lv n / max, this level's effect, next level's effect + [+] button
      const UPG_WHY = { max: tl('MAX'), level: (r) => tl('needs LV {n}', { n: r.need }), points: (r) => tl('needs {n} pt', { n: r.cost }) };
      const lvRow = (s) => {
        const max = maxLevel(s);
        if (max <= 1) return '';
        const lv = p.skillLevel(s.id), cur = levelMods(s, lv), next = lv < max ? levelMods(s, lv + 1) : null, r = p.upgradeCheck(s.id);
        const why = !r.ok && UPG_WHY[r.reason] ? (typeof UPG_WHY[r.reason] === 'function' ? UPG_WHY[r.reason](r) : UPG_WHY[r.reason]) : '';
        return `<div class="small sk-level"><b style="color:#e0c070">Lv ${lv}/${max}</b> ${esc(cur.text)}
          ${next ? `<br><span class="muted">${tl('Next:')} ${esc(next.text)}</span> ${r.ok ? `<button data-upgrade="${s.id}">${tl('+ Level ({n} pt)', { n: r.cost })}</button>` : `<span class="muted">(${why})</span>`}` : ''}</div>`;
      };
      // SKILL MASTERY (data/skillMastery.js): level name, XP bar, current reward
      const masteryRow = (s) => {
        const mi = masteryInfo(g.classProgress.peekSkill(p.cls.id, s.id));
        const pct = mi.need ? Math.round((mi.into / mi.need) * 100) : 100;
        return `<div class="small sk-mastery"><b style="color:#b8a0ff">${tl('Mastery')} ${MASTERY.names[mi.level]}</b>
          <span style="display:inline-block;width:70px;height:5px;background:#2a2238;vertical-align:middle;border-radius:2px"><span style="display:block;width:${pct}%;height:100%;background:#b8a0ff;border-radius:2px"></span></span>
          <span class="muted">${mi.need ? `${mi.into}/${mi.need}` : tl('MAX')}${mi.level ? ' · ' + esc(masteryReward(mi.level).text) : ''}</span></div>`;
      };
      // SKILL EVOLUTION: chosen branch shown on the card, [Evolution] opens the panel below
      const evoRow = (s) => {
        if (!evolutionsOf(s).length) return '';
        const cur = evolutionById(s, p.skillEvolution(s.id));
        return `<div class="small sk-evo">${cur ? `<b style="color:#ff9ad0">◆ ${esc(cur.name)}</b>` : `<span class="muted">◇ ${tl('Not evolved')}</span>`}
          <button data-evo-open="${s.id}">${tl('Evolution ▸')}</button></div>`;
      };
      // SKILL TREE (data/skillTree.js): category chip + what a locked skill still needs
      const catTag = (s) => { const c = SKILL_TREE.categories[s.category]; return c ? `<span class="small" style="color:${c.color}">[${tl(c.label)}]</span> ` : ''; };
      // S6: charges + equipment / rune modifiers acting on this skill
      const gearRow = (s) => {
        const m = p.skillMods(s), ch = p.skillSys.maxCharges(s);
        const lines = (m.gear || []).map((x) => describeMod(x, (id) => (p.skillSys.get(id) || { name: id }).name));
        return (ch > 1 ? `<div class="small" style="color:#9af8ff">${tl('Charges: {n}', { n: ch })}</div>` : '') + lines.map((l) => `<div class="small" style="color:#9af8ff">⚙ ${esc(l)}</div>`).join('');
      };
      const lockRow = (s) => { const r = p.skillUnlockCheck(s); return r.ok ? '' : `<div class="small" style="color:#ffb070">🔒 ${tl('Unlocks with:')} ${r.missing.map(esc).join(', ')}</div>`; };
      const card = (s, extra = '') => `<div class="skill-card${lo.slots.includes(s.id) ? ' on' : ''}"${p.skillUnlocked(s) ? '' : ' style="opacity:.6"'}>
          <img src="${skillIconURL(s)}"><div class="sk-body">${catTag(s)}<b>${esc(s.name)}</b> <span class="muted small">${cd(s)} · ${(s.tags || []).join(', ')}</span>
          <div class="small">${esc(s.desc || '')}</div>${lockRow(s)}${gearRow(s)}${lvRow(s)}${masteryRow(s)}${evoRow(s)}${extra}</div></div>`;
      const evoSkill = this.evoSel && p.skillSys.get(this.evoSel);
      if (evoSkill && evolutionsOf(evoSkill).length) {
        const s = evoSkill, cur = p.skillEvolution(s.id), mi = masteryInfo(g.classProgress.peekSkill(p.cls.id, s.id));
        const CH = [['behavior', tl('Gameplay')], ['damage', tl('Damage')], ['utility', tl('Utility')], ['resource', tl('Resource')], ['cooldown', tl('Cooldown')]];
        const option = (e) => {
          const r = p.evolutionCheck(s.id, e.id), chosen = cur === e.id;
          const req = e.requirements || {};
          return `<div class="evo-card${chosen ? ' on' : ''}" style="border:1px solid ${chosen ? '#ff9ad0' : '#3a2f50'};border-radius:6px;padding:8px;margin:6px 0;${cur && !chosen ? 'opacity:.55' : ''}">
            <b style="color:#ff9ad0">${esc(e.name)}</b>${chosen ? ` <span class="small" style="color:#ff9ad0">${tl('CHOSEN')}</span>` : ''}
            <div class="small" style="margin:4px 0">${esc(e.desc)}</div>
            <div class="small">${CH.filter(([k]) => e.changes && e.changes[k]).map(([k, l]) => `<div><span class="muted">${l}:</span> ${esc(e.changes[k])}</div>`).join('')}</div>
            <div class="small muted">${tl('Needs: Skill Lv {lv} · Mastery {m}', { lv: req.skillLevel || 1, m: MASTERY.names[req.masteryLevel || 0] })}</div>
            ${chosen || cur ? '' : r.ok ? `<button data-evolve="${s.id}:${e.id}">${tl('Choose {name}', { name: esc(e.name) })}</button>` : `<div class="small" style="color:#ff7070">${tl('Missing:')} ${r.missing.map(esc).join(', ')}</div>`}
          </div>`;
        };
        body = `<div class="evo-panel">
          <button data-evo-open="">${tl('◂ Back to loadout')}</button>
          <h3>${tl('{name} — Evolution', { name: esc(s.name) })}</h3>
          <p class="small">${tl('Your skill: <b>Lv {lv}</b> · <b>Mastery {m}</b>. Choose <b>ONE</b> branch — it changes how the skill plays.', { lv: p.skillLevel(s.id), m: MASTERY.names[mi.level] })} ${cur ? tl('This skill has evolved.') : ''}</p>
          <div class="evo-card" style="border:1px dashed #3a2f50;border-radius:6px;padding:8px;margin:6px 0">
            <b>${tl('Original — {name}', { name: esc(s.name) })}</b><div class="small">${esc(s.desc || '')}</div></div>
          ${evolutionsOf(s).map(option).join('')}
        </div>`;
      } else
      {
        // SKILL TREE VIEW (ui/skillTreeUI.js): left = level + points, centre = the tree, right = the selected skill's card
        const all = [...p.cls.skills, p.cls.special].filter(Boolean);
        if (!this.treeSel || !all.some((s) => s.id === this.treeSel)) this.treeSel = (lo.slots.find((id) => id) || all[0].id);
        const sel = all.find((s) => s.id === this.treeSel);
        const fixedKey = sel.ultimate ? '5' : sel === p.cls.special ? 'Q' : null;
        const slotRow = fixedKey ? `<div class="muted small">${tl('Key {key} (fixed)', { key: fixedKey })}</div>`
          : !p.skillUnlocked(sel) ? '' : `<div class="small muted" style="margin-top:6px">${tl('Put on key:')}</div><div class="slot-btns">${[0, 1, 2, 3].map((i) => `<button data-slot="${i}" data-skill="${sel.id}" class="${lo.slots[i] === sel.id ? 'on' : ''}">${i + 1}</button>`).join('')}</div>`;
        const bar = lo.bindings().map((b) => `<span class="st-key${b.skill.id === sel.id ? ' on' : ''}" data-tree-sel="${b.skill.id}"><img src="${skillIconURL(b.skill)}" alt=""><kbd>${b.key}</kbd></span>`).join('')
          + (p.cls.special ? `<span class="st-key${p.cls.special.id === sel.id ? ' on' : ''}" data-tree-sel="${p.cls.special.id}"><img src="${skillIconURL(p.cls.special)}" alt=""><kbd>Q</kbd></span>` : '');
        body = `<div class="st-layout">
          <div class="st-left">
            <div class="cw-lvl st-lvl" style="background-image:url(${UI_ICON('level_diamond')})"><span>${p.progressLevel ? p.progressLevel() : p.level}</span></div>
            <div class="st-cls">${esc(p.cls.name)}</div>
            <div class="st-pts"><b>+${Math.max(0, p.skillPointsLeft())}</b> ${tl('points available')}</div>
            <div class="muted small">${tl('1 point per {what} level · each class has its own points', { what: SKILL_TREE.pointsFrom === 'class' ? tl('class') : tl('character') })}</div>
            <div class="muted small" style="margin-top:4px">${tl('Class LV {n}', { n: p.classLevel() })}${p.classFollowsCharacter() ? ' ' + tl('(= character level)') : ` · ${Math.floor((g.classProgress.classes[p.cls.id] || {}).exp || 0)}/${expToNext(p.classLevel())} ${tl('class EXP')}`}</div>
            <h4>${tl('SKILL BAR')}</h4><div class="st-bar">${bar}</div>
            ${passiveRows(p.cls)}
          </div>
          <div class="st-mid">${treeHTML(p.cls, sel.id, nodeState(p))}</div>
          <div class="st-right">${card(sel, slotRow)}<p class="muted small">${tl('Keys <b>1-4</b> are yours to choose · <b>5</b> = ultimate · <b>Q</b> = class special. Changes are locked while in combat.')}</p></div>
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
        if (x.unlocked || t.state === 'passed') return `<div class="trial passed">✦ ${esc(t.def.title)} — ${tl('PASSED')}</div>`;
        if (t.state === 'active') return `<div class="trial active"><b>${esc(t.def.title)}</b>${t.objectives.map((o) => reqRow({ met: o.have >= o.count, label: CLASS_COUNTERS[o.counter].label, have: Math.max(0, o.have), need: o.count })).join('')}<button data-abandon="${t.id}">${tl('Abandon trial')}</button></div>`;
        return `<div class="trial"><b>${esc(t.def.title)}</b>${t.def.objectives.map((o) => `<div class="muted small">• ${CLASS_COUNTERS[o.counter].label} ×${o.count}</div>`).join('')}<button data-trial="${x.node.id}" ${x.ready ? '' : 'disabled'}>${x.ready ? tl('Begin trial') : tl('Requirements not met')}</button></div>`;
      };

      // ---- LAYOUT A (owner's choice, docs/ui/ECLIPSE_ONLINE_Class_Tab_Layouts.pdf): vertical lineage tree with emblems +
      // path card on the left, class info in the middle, the class splash on the right, class records as chips at the bottom
      const BADGE = { current: ['CURRENT', 'cur'], owned: ['UNLOCKED', 'open'], unlocked: ['UNLOCKED', 'open'], ready: ['TRIAL READY', 'ready'], locked: ['🔒 LOCKED', 'lock'], future: ['🔒 LOCKED', 'lock'] };
      const badge = (st) => `<span class="ct-badge b-${BADGE[st][1]}">${tl(BADGE[st][0])}</span>`;
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
          <span class="ct-txt"><small>${kind === 'base' ? tl('BASE CLASS') : tl('CLASS {n}', { n: t.node.tier })}</small><b>${esc(t.node.name)}</b> ${badge(t.state)}
          ${kind !== 'base' && pr !== null && pr < 1 ? `<span class="ct-prog"><i style="width:${Math.round(pr * 100)}%"></i></span>` : ''}</span></button>`;
      };
      const path = paths.find((x) => x.node.id === selId);
      const selState = (tree.find((t) => t.node.id === selId) || {}).state;
      const chk = (selState === 'owned' || selState === 'unlocked') && selId !== p.cls.id ? classChangeCheck(g, selId) : null;
      const why = chk && !chk.ok ? tl({ not_playable: 'arrives with Class 2 content', combat: 'leave combat first', boss: 'not during a boss fight' }[chk.reason] || '') : '';
      const action = selId === p.cls.id ? `<div class="ct-note">${tl('You are playing this class.')}</div>`
        : chk ? (chk.ok ? `<button class="ct-go" data-change="${selId}" style="--cc:${colorOf(selId)}">${tl('Change to {name}', { name: esc(selNode.name) })}</button>` : `<div class="ct-note">${esc(why)}</div>`)
        : path ? `<div class="k" style="color:${colorOf(selId)}">${tl('PATH TO {name}', { name: esc(path.node.name.toUpperCase()) })}</div>
            ${path.unlocked ? `<div class="req ok">${tl('✦ UNLOCKED')}</div>` : path.reqs.map(reqRow).join('')}${trialBox(path)}`
        : `<div class="ct-note">${tl('🔒 Reach this class through its parent class first.')}</div>`;
      const rate = (label, v) => `<div><span>${label}</span><i>${[1, 2, 3, 4, 5].map((k) => `<b class="${k <= (v || 0) ? 'on' : ''}"></b>`).join('')}</i></div>`;
      const sr = (selCls && selCls.ratings) || {};
      const info = selCls ? `<div class="ct-role">${esc(selCls.role || '')}</div>
          ${selCls.identity ? `<div class="ct-quote">“${esc(selCls.identity)}”</div>` : ''}
          <div class="ct-desc">${esc(selCls.description || selNode.description || '')}</div>
          <div class="ct-rates">${rate(tl('Difficulty'), selCls.difficulty)}${rate(tl('Damage'), sr.damage)}${rate(tl('Defense'), sr.defense)}${rate(tl('Range'), sr.range)}${rate(tl('Mobility'), sr.mobility)}${sr.support ? rate(tl('Support'), sr.support) : ''}</div>
          <div class="ct-res">${tl('Resource')} <b>${esc(RESOURCES[selCls.resource].name)}</b>${selCls.signatureWeapon ? ` · ${tl('Weapon')} <b>${esc(selCls.signatureWeapon)}</b>` : ''}</div>
          <div class="ct-skills">${[...selCls.skills, selCls.special].filter(Boolean).map((s) => `<img src="${skillIconURL(s)}" title="${esc(s.name)}" alt="">`).join('')}</div>
          ${selCls.strengths ? `<div class="ct-sw"><div><b class="good">${tl('STRENGTHS')}</b>${selCls.strengths.map((x) => `<div>+ ${esc(x)}</div>`).join('')}</div><div><b class="bad">${tl('WEAKNESSES')}</b>${(selCls.weaknesses || []).map((x) => `<div>− ${esc(x)}</div>`).join('')}</div></div>` : ''}`
        : `<div class="ct-desc">${esc(selNode.description || '')}</div><p class="muted small">${tl('Skills are revealed when this class arrives.')}</p>`;
      const chips = Object.entries(rec).filter(([, v]) => v > 0).map(([k, v]) => `<span>${esc(CLASS_COUNTERS[k] ? CLASS_COUNTERS[k].label : k)} <b>${Math.floor(v)}</b></span>`).join('') || `<span class="muted">${tl('Nothing yet — fight!')}</span>`;
      body = `<div class="ct-layout" style="--cc:${colorOf(selId)}">
          <img class="ct-splash" src="assets/ui/class/${selId}_splash.png" alt="">
          <div class="ct-left">
            ${node(root, 'base')}
            <div class="ct-kids">${kids.map((t) => node(t, 'mastery')).join('')}</div>
            <div class="ct-path">${action}</div>
          </div>
          <div class="ct-info">${info}</div>
          <div class="ct-records"><div class="k">${tl('CLASS RECORDS · {name}', { name: esc(p.cls.name.toUpperCase()) })}</div><div class="ct-chips">${chips}</div></div>
        </div>`;
    } else if (this.invTab === 'knowledge') {
      const list = g.knowledge.view();
      body = `<div class="know">${list.map((e) => `
        <div class="know-card">
          <h3>${esc(e.name.toUpperCase())}</h3>
          <div class="kv"><span>${tl('Level')}</span><b>${e.level}</b></div>
          <div class="kv"><span>HP</span><b>${e.hp}</b></div>
          <div class="kv"><span>${tl('Weakness')}</span><b>${esc(e.weakness)}</b></div>
          <div class="kv"><span>${tl('Pattern')}</span><b>${esc(e.pattern)}</b></div>
          <div class="kv"><span>${tl('Role')}</span><b>${esc(e.role)}</b></div>
          <div class="kv"><span>${tl('Drop')}</span><b>${esc(e.drop)}</b></div>
          <div class="kv"><span>${tl('Defeated')}</span><b>${e.kills}</b></div>
          <p>${esc(e.desc)}</p>${e.roleHint ? `<div class="muted small">⚔ ${esc(e.roleHint)}</div>` : ''}
        </div>`).join('') || `<div class="empty">${tl('No monsters encountered yet. The world is waiting to be learned.')}</div>`}
        <div class="muted small">${tl('Knowledge grows as you fight: 1 kill reveals level & pattern, 3 kills weakness & drops, 5 kills HP. Lore fragments reveal secrets early.')}</div></div>`;
    } else {
      const found = Object.keys(g.world.state.lore);
      const quests = [...Object.keys(g.quests.active).map((q) => [q, false]), ...Object.keys(g.quests.completed).map((q) => [q, true])];
      body = `<div class="lore-layout">
        <div><h3>${tl('Quests')}</h3>${quests.map(([q, done]) => `<div class="quest ${done ? 'done' : ''}"><b>${esc(QUESTS[q].name)}</b>${done ? ' ✓' : ''}<div class="muted small">${esc(QUESTS[q].description)}</div></div>`).join('') || `<div class="muted">${tl('None')}</div>`}
        <h3>${tl('Discoveries')}</h3><div class="muted">${tl('Secrets found:')} <b>${g.world.map.secretsFound.size} / 4</b> · ${tl('Lore:')} <b>${found.length} / ${Object.keys(LORE).length}</b> · ${tl('Areas:')} <b>${Object.keys(g.world.state.subs).filter((k) => !k.startsWith('zone')).length}</b></div></div>
        <div><h3>${tl('Lore Fragments')}</h3>${found.map((k) => `<details><summary>${esc(LORE[k].title)}</summary><p>${esc(LORE[k].text).replace(/\n/g, '<br>')}</p></details>`).join('') || `<div class="muted">${tl('Unread. Look for glowing pages, statues and strange objects.')}</div>`}</div>
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
      else if (t.dataset.equip) { if (!g.equipment.equip(t.dataset.equip)) g.ui.toast(tl(g.equipment.lastErrorText()), 1.2); if (!g.inventory.has(this.selected)) this.selected = null; this.inventory(); }
      else if (t.dataset.unequip) { if (!g.equipment.unequip(t.dataset.unequip)) g.ui.toast(tl(g.equipment.lastErrorText()), 1.2); else this.pickSlot = null; this.inventory(); }
      else if (t.dataset.equipTo) { const [id, slot] = t.dataset.equipTo.split(':'); if (!g.equipment.equip(id, slot)) g.ui.toast(tl(g.equipment.lastErrorText()), 1.2); else this.pickSlot = null; this.inventory(); }
      else if (t.dataset.pick) { this.pickSlot = this.pickSlot === t.dataset.pick ? null : t.dataset.pick; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.evoOpen !== undefined) { this.evoSel = t.dataset.evoOpen || null; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.evolve) {
        const [sid, eid] = t.dataset.evolve.split(':'), r = g.player.evolveSkill(sid, eid);
        if (!r.ok) g.ui.toast(r.reason === 'combat' ? tl('Cannot evolve skills in combat') : tl('Requirements not met'), 1.2);
        g.audio.sfx(r.ok ? 'levelup' : 'deny'); this.inventory();
      }
      else if (t.dataset.upgrade) { const r = g.player.upgradeSkill(t.dataset.upgrade); g.audio.sfx(r.ok ? 'levelup' : 'deny'); this.inventory(); }
      else if (t.dataset.slot) { g.player.setSkillSlot(+t.dataset.slot, t.dataset.skill); this.inventory(); }
      else if (t.dataset.trial) { const r = g.progression.startTrial(t.dataset.trial); if (!r.ok) g.ui.toast(r.reason === 'busy' ? tl('Finish your current trial first') : tl('Requirements not met'), 1.2); this.inventory(); }
      else if (t.dataset.abandon) { g.progression.abandonTrial(t.dataset.abandon); this.inventory(); }
      else if (t.dataset.node) { this.classSel = t.dataset.node; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.change) { const r = g.changeClass(t.dataset.change); if (r.ok) this.close(); else g.ui.toast(tl('Cannot change class: {why}', { why: r.reason }), 1.4); }
    });
  }
  itemDetail(id) {
    const g = this.game;
    if (!id || !ITEMS[id] || !g.inventory.has(id)) return `<div class="muted">${tl('Select an item.')}</div>`;
    const d = ITEMS[id];
    return `<img src="${itemIconURL(d)}" class="big-icon">
      <div class="tt">${itemTooltipHTML(d, { classId: g.player.cls.id, level: g.player.level, worn: g.equipment.wornIds(), swap: swapPreview(g.equipment, id) })}</div>
      ${d.use ? `<button data-use="${id}">${tl('Use')}</button>` : ''}${isGear(d) ? `<button data-equip="${id}">${tl('Equip')}</button>` : ''}`;
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
  // (Lead, Remove), Leave. Parties are created / joined at a Dungeon Gate (owner), not here. The server decides every
  // action; this panel only sends them and redraws.
  party() {
    const g = this.game, on = g.online, pt = on && on.party, me = on && on.playerId;
    const mapName = (id) => { const m = id && g.world.mapManager.get(id); return m ? m.short || m.name : ''; };
    let body = '';
    if (!on || !on.online) body = `<div class="muted">${tl('Not connected — the party needs the server.')}</div>`;
    else {
      if (on.invites.length) body += `<div class="pt-h">${tl('INVITES')}</div>` + on.invites.map((i) => npcRow({ img: UI_ICON('npc_guild'), name: i.from,
        text: tl('invites you to a party ({n}/{max})', { n: i.size, max: ONLINE.party.maxSize }), right: `<button data-pa="yes" data-party="${esc(i.party)}">${tl('Accept')}</button> <button data-pa="no" data-party="${esc(i.party)}">${tl('Decline')}</button>` })).join('');
      if (pt) {
        body += `<div class="pt-h">${tl('PARTY  {n}/{max}', { n: pt.members.length, max: pt.max })}</div>`;
        body += pt.members.map((m) => {
          const c = m.c && CLASSES[m.c], lead = m.id === pt.leader, mine = m.id === me;
          const where = m.online ? mapName(m.m) : tl('offline — keeps the place for a while');
          const acts = on.isLeader && !mine ? `<button data-pa="lead" data-id="${esc(m.id)}" title="${tl('Make leader')}">♛</button> <button data-pa="kick" data-id="${esc(m.id)}" title="${tl('Remove from party')}">✕</button>` : '';
          return npcRow({ img: null, cls: 'pt-row' + (m.online ? '' : ' off'), name: `${lead ? '♛ ' : ''}${m.name}${mine ? '  ' + tl('(you)') : ''}`, nameColor: lead ? '#ffd98a' : null,
            text: `<i class="pt-dot${m.online ? ' on' : ''}"></i>${m.l ? 'Lv.' + m.l + ' ' : ''}${c ? esc(c.name) : ''}${where ? ' · ' + esc(where) : ''}`, right: acts });
        }).join('');
      } else body += `<div class="muted pt-solo">${tl('You are not in a party. Create one or join one at a <b>Dungeon Gate</b> in a city.')}</div>`;
      if (pt) body += `<button data-pa="leave" class="danger pt-leave">${tl('Leave party')}</button>`;
    }
    const el = this.show('party', npcPanelHTML({ icon: 'npc_guild', title: tl('Party'), sub: pt ? (on.isLeader ? tl('You lead') : tl('Member')) : tl('Solo'), body, keys: [['P', tl('Close')]] }), 'side');
    this.wireNpc(el, 'party', () => this.party(), (t) => {
      const a = t.dataset.pa;
      if (a === 'yes' || a === 'no') on.partyAction('partyAnswer', { party: t.dataset.party, yes: a === 'yes' });
      if (a === 'lead') on.partyAction('partyLead', { id: t.dataset.id });
      if (a === 'kick') on.partyAction('partyKick', { id: t.dataset.id });
      if (a === 'leave') {
        if (t.dataset.confirm) on.partyAction('partyLeave');
        else { t.dataset.confirm = '1'; t.textContent = tl('Click again to leave'); }
      }
    });
  }

  // ---------------- DUNGEON GATE (ONLINE N5 + owner: parties are made and joined HERE). Functional UI only — the owner
  // redesigns it later. Tabs: SOLO (pick an unlocked area -> Enter alone) · PARTY (not in a party: Create Party + the
  // open parties of this city with Join; in a party: members, Leave, and for the leader the area list + "Ask the party to
  // enter" -> each member answers the ready check, panels.dungeonReady). Locked areas show their requirement; only the
  // route field maps are listed (arenas / secrets: on foot). The open-party list refreshes every 2 s while shown.
  // Owner: there is no gate object any more — walking into a road out of a city opens this panel
  // (world/transitionSystem.js passes that exit; its target area is preselected).
  dungeonGate(exit) {
    // MAP SELECT (owner reference: a painted world map with diamond pins, area panel on the left, party pedestals, PLAY).
    // Same server flow as before: Solo -> dungeonEnter · Party -> create / join here, leader proposes, ready check.
    const g = this.game, on = g.online, wp = g.worldProgress, mm = g.world.mapManager;
    if (exit) { this.gateExit = exit; if (ONLINE.dungeon.areas.some((a) => a.id === exit.to)) this.gateSel = exit.to; }
    const ex = this.gateExit, exDef = ex && mm.get(ex.to), exIsArea = ex && ONLINE.dungeon.areas.some((a) => a.id === ex.to);
    const pt = on && on.party, tab = this.npcTab('gate', pt ? 'party' : 'solo');
    const areas = ONLINE.dungeon.areas.filter((a) => mm.get(a.id));
    const open = (a) => a.free || !!(wp && wp.unlockedMaps[a.id]);
    if (!this.gateSel || !areas.some((a) => a.id === this.gateSel)) this.gateSel = (areas.find(open) || areas[0]).id;
    const selArea = areas.find((a) => a.id === this.gateSel), sel = mm.get(this.gateSel), selOpen = open(selArea);
    const W = WORLD_MAP, routeCol = (r) => W.routeColor[r] || '#e8d7a5';
    // boss portrait = the idle frame of its atlas, scaled into a box
    const portrait = (atlasId, box) => {
      const m = Assets.data && Assets.data.monsters && Assets.data.monsters[atlasId];
      if (!m || !m.anims || !m.anims.idle) return '';
      const [fx, fy] = m.anims.idle[0], k = Math.min(box / m.fw, box / m.fh) * 1.25;
      return `<span class="ms-face" style="width:${m.fw}px;height:${m.fh}px;background:url(${m.file}) -${fx}px -${fy}px;transform:translate(-50%,-50%) scale(${k.toFixed(3)})"></span>`;
    };
    const boss = sel && BOSSES[sel.bossId];
    const bossDown = boss && wp && wp.isBossDefeated(boss.id);
    const lv = sel ? (sel.sub || '').split('·').pop().trim() : '';
    // possible rewards = the boss's loot table (+ its oneOf groups) + elite drops on the map
    const rewardIds = [];
    const addTable = (id) => { const t = LOOT_TABLES[id]; if (!t) return; for (const d of t.drops || []) rewardIds.push(d.item); for (const grp of t.oneOf || []) for (const it of grp.items || []) rewardIds.push(it.item); };
    if (boss && boss.rewards) addTable(boss.rewards.loot);
    addTable('elite');
    const rewards = [...new Set(rewardIds)].filter((id) => ITEMS[id]).slice(0, 12);
    const disc = g.discoveries && g.discoveries.of(this.gateSel);
    // party pedestals: you (solo) or every member, 4 places
    const people = pt ? pt.members.map((m) => ({ name: m.name, c: m.c, l: m.l, lead: m.id === pt.leader, off: !m.online }))
      : [{ name: (on && on.name) || tl('You'), c: g.player.cls.id, l: g.player.level, lead: false }];
    const slots = [0, 1, 2, 3].map((i) => {
      const m = people[i];
      return m ? `<div class="ms-ped${m.off ? ' off' : ''}"><img class="ms-emb" src="assets/ui/class/${m.c}_emblem.png" alt=""><img class="ms-base" src="assets/ui/icons/pedestal.png" alt="">
          <b>${m.lead ? '♛ ' : ''}${esc(m.name)}</b><span>Lv.${m.l || '?'}${m.c && CLASSES[m.c] ? ' · ' + esc(CLASSES[m.c].name) : ''}</span></div>`
        : `<div class="ms-ped empty"><img class="ms-base" src="assets/ui/icons/pedestal.png" alt=""><span>${pt ? tl('Open') : ''}</span></div>`;
    }).join('');
    // actions (bottom of the side panel)
    let act;
    if ((!on || !on.online) && tab !== 'solo') act = `<div class="muted">${tl('Not connected to the server — parties need the online server. Solo works.')}</div>`;
    else if (tab === 'solo') act = `<button class="ms-play" data-go="solo" ${selOpen ? '' : 'disabled'}>${selOpen ? tl('PLAY — {name} alone', { name: esc(sel.short) }) : tl('🔒 LOCKED')}</button>`
      + (ex && exDef && !exIsArea ? `<button class="dg-go" data-go="road">${tl('Take the road to {name} alone', { name: esc(exDef.name) })}</button>` : '');
    else if (!pt) {
      const list = on.openParties || [];
      act = `<button class="ms-play" data-go="create">${tl('CREATE PARTY')}</button><div class="pt-h">${tl('OPEN PARTIES HERE')}</div>`
        + (list.length ? list.map((p) => `<div class="ms-open"><span>♛ ${esc(p.leader)} · ${p.size}/${p.max}${p.level ? ' · Lv.' + p.level : ''}</span><button data-join="${esc(p.id)}">${tl('Join')}</button></div>`).join('')
          : `<div class="muted small">${tl('No open party here yet — create one, others can join it here.')}</div>`);
    } else {
      const lead = pt.members.find((m) => m.id === pt.leader) || {};
      act = !on.isLeader ? `<div class="muted small">${tl('{name} chooses the map. You will be asked to accept.', { name: esc(lead.name || tl('The leader')) })}</div>`
        : pt.members.length < 2 ? `<div class="muted small">${tl('Waiting for players to join… (or switch to Solo)')}</div>`
        : `<button class="ms-play" data-go="party" ${selOpen ? '' : 'disabled'}>${selOpen ? tl('PLAY — {name} with the party', { name: esc(sel.short) }) : tl('🔒 LOCKED')}</button>`;
      act += `<button data-go="leave" class="danger ms-leave">${tl('Leave party')}</button>`;
    }
    // the map: picture (if the owner's art exists) or the drawn map, roads, cities, pins
    const pts = (r) => W.roads[r].map(([x, y]) => `${x},${y}`).join(' ');
    const pins = areas.map((a) => {
      const p = W.pins[a.id], d = mm.get(a.id);
      if (!p) return '';
      return `<button class="ms-pin${open(a) ? '' : ' locked'}${a.id === this.gateSel ? ' sel' : ''}" data-area="${a.id}" style="left:${p.x}%;top:${p.y}%;--rc:${routeCol(d.route)}">
          <span class="ms-dia">${portrait(p.boss, 44)}</span>${open(a) ? '' : '<i class="ms-lock">🔒</i>'}<b>${esc(d.short)}</b></button>`;
    }).join('');
    const cities = W.cities.map((c) => `<div class="ms-city" style="left:${c.x}%;top:${c.y}%"><span>◆</span>${esc(c.name)}</div>`).join('');
    const strip = areas.map((a) => `<button class="ms-chip${a.id === this.gateSel ? ' sel' : ''}${open(a) ? '' : ' locked'}" data-area="${a.id}">${esc(mm.get(a.id).short)}</button>`).join('');
    const el = this.show('gate', `<div class="ms">
      <div class="ms-map${this.worldMapArt ? ' art' : ''}">
        <div class="ms-world" style="--ar:${W.aspect || 1.5};${this.worldMapArt ? `background-image:url(${W.image})` : ''}">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">${['A', 'B'].map((r) => `<polyline points="${pts(r)}" stroke="${routeCol(r)}"/>`).join('')}</svg>
          ${cities}${pins}
        </div>
      </div>
      <div class="ms-top"><kbd>Q</kbd>${strip}<kbd>E</kbd></div>
      <div class="ms-side">
        <div class="ms-tabs"><button data-npc-tab="solo" class="${tab === 'solo' ? 'on' : ''}">${tl('Solo')}</button><button data-npc-tab="party" class="${tab === 'party' ? 'on' : ''}">${tl('Party')}</button>
          <button class="close ms-x" title="${tl('Close')}">✕</button></div>
        <div class="ms-head"><span class="ms-dia big" style="--rc:${routeCol(sel.route)}">${portrait((W.pins[this.gateSel] || {}).boss, 70)}</span>
          <div class="ms-route" style="color:${routeCol(sel.route)}">${tl('ROUTE {r} · {name}', { r: esc(sel.route || ''), name: esc(sel.short) })}</div>
          <h2>${esc(sel.name)}</h2><div class="ms-lv">${esc(lv)}</div></div>
        <p class="ms-desc">${esc((W.pins[this.gateSel] || {}).desc || '')}</p>
        ${boss ? `<div class="ms-boss"><span>${tl('BOSS')}</span><b>${esc(boss.name)}</b>${bossDown ? `<i class="ok">${tl('✓ Defeated')}</i>` : `<i>${tl('Not yet defeated')}</i>`}</div>` : ''}
        ${!selOpen && sel.requires && sel.requires[0] ? `<div class="ms-req">🔒 ${esc(sel.requires[0].label)}</div>` : ''}
        ${disc ? `<div class="ms-boss"><span>${tl('EXPLORED')}</span><b>✦ ${disc.found} / ${disc.total}</b></div>` : ''}
        <div class="pt-h">${tl('POSSIBLE REWARDS')}</div>
        <div class="ms-rewards">${rewards.map((id) => `<span class="slot" data-tip="${id}" style="border-color:${RARITY_COLOR[ITEMS[id].rarity]}"><img src="${itemIconURL(ITEMS[id])}" alt=""></span>`).join('')}</div>
        <div class="ms-peds">${slots}</div>
        <div class="ms-act">${act}</div>
        <div class="keys"><span><kbd>Q</kbd><kbd>E</kbd>${tl('Map')}</span><span><kbd>F</kbd>${tl('Play')}</span><span><kbd>Esc</kbd>${tl('Back')}</span></div>
      </div></div>`, 'ms-ov');
    // the owner's painted map, when it exists (checked once)
    if (this.worldMapArt === undefined && !W.image) this.worldMapArt = false;
    if (this.worldMapArt === undefined) { const im = new Image(); im.onload = () => { this.worldMapArt = true; if (this.current && this.current.name === 'gate') this.dungeonGate(); }; im.onerror = () => { this.worldMapArt = false; }; im.src = W.image; }
    if (on && on.online && tab === 'party' && !pt) { // ask for the open parties now and every 2 s while this view is up
      on.net.send('partyList', {});
      clearInterval(this.gatePoll);
      this.gatePoll = setInterval(() => {
        const c = this.current;
        if (!c || c.name !== 'gate' || on.party || this.npcTab('gate') !== 'party' || !on.online) return clearInterval(this.gatePoll);
        on.net.send('partyList', {});
      }, 2000);
    }
    // keys: Q / E cycle the maps, F = the main button
    const step = (k) => { const i = areas.findIndex((a) => a.id === this.gateSel); this.gateSel = areas[(i + k + areas.length) % areas.length].id; g.audio.sfx('ui'); this.dungeonGate(); };
    const onKey = (e) => {
      if (!el.isConnected) return window.removeEventListener('keydown', onKey);
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === 'KeyQ') step(-1); else if (e.code === 'KeyE') step(1);
      else if (e.code === 'KeyF') { const b = el.querySelector('.ms-play:not([disabled])'); if (b) b.click(); }
    };
    window.addEventListener('keydown', onKey);
    this.wireNpc(el, 'gate', () => this.dungeonGate(), (t) => {
      if (t.dataset.area) { this.gateSel = t.dataset.area; g.audio.sfx('ui'); return this.dungeonGate(); }
      if (t.dataset.join) return on.partyAction('partyJoin', { party: t.dataset.join });
      const go = t.dataset.go;
      if (go === 'solo') { if (on && on.online) on.net.send('dungeonEnter', { area: this.gateSel }); else g.enterDungeon(this.gateSel, { mode: 'solo' }); }
      if (go === 'road' && ex) { this.close(true); g.world.transitions.go(ex); }
      if (go === 'party') on.net.send('dungeonPropose', { area: this.gateSel });
      if (go === 'create') on.partyAction('partyCreate');
      if (go === 'leave') { if (t.dataset.confirm) on.partyAction('partyLeave'); else { t.dataset.confirm = '1'; t.textContent = tl('Click again to leave'); } }
    });
  }

  // RUN SUMMARY (owner reference: VICTORY / Level UP banner, members table DMG · H · D, EXP bar + gained, counts, rewards).
  // Shown when a run is banked (back in a city): sum = game.run.summary(), others = the run members' stats (online).
  runSummary(sum, others = []) {
    const g = this.game, p = g.player, mm = g.world.mapManager;
    const fmt = (n) => Math.round(n || 0).toLocaleString();
    const win = sum.bosses.length > 0;
    const me = { name: (g.online && g.online.name) || tl('You'), c: p.cls.id, l: p.level, dmg: sum.dmg, heal: sum.heal, deaths: sum.deaths, kills: sum.kills, you: true };
    const rows = [me, ...others].sort((a, b) => (b.dmg || 0) - (a.dmg || 0));
    const top = rows[0];
    const row = (r) => `<div class="rs-row${r.you ? ' you' : ''}">
        <span class="rs-who">${r.c ? `<img src="assets/ui/class/${r.c}_emblem.png" alt="">` : '<i class="rs-noemb"></i>'}<span><b>${esc(r.name)}${r === top && rows.length > 1 ? ' <i class="rs-mvp">MVP</i>' : ''}</b>
          <small>${r.l ? 'Lv.' + r.l : ''}${r.c && CLASSES[r.c] ? ' · ' + esc(CLASSES[r.c].name) : ''}</small></span></span>
        <span>${fmt(r.dmg)}</span><span>${fmt(r.heal)}</span><span>${r.deaths || 0}</span></div>`;
    const need = p.isMaxLevel ? 1 : p.expToNext(), pct = p.isMaxLevel ? 100 : Math.min(100, (p.exp / need) * 100);
    const rewards = [
      ...(sum.gold ? [`<span class="slot rs-gold" title="${tl('Gold')}"><img src="assets/ui/icons/cur_gold.png" alt=""><span class="n">${fmt(sum.gold)}</span></span>`] : []),
      ...Object.entries(sum.items).filter(([id]) => ITEMS[id]).map(([id, n]) => `<span class="slot" data-tip="${id}" style="border-color:${RARITY_COLOR[ITEMS[id].rarity]}"><img src="${itemIconURL(ITEMS[id])}" alt=""><span class="n">${n > 1 ? n : ''}</span></span>`),
      ...sum.gear.filter((id) => ITEMS[id]).map((id) => `<span class="slot" data-tip="${id}" style="border-color:${RARITY_COLOR[ITEMS[id].rarity]}"><img src="${itemIconURL(ITEMS[id])}" alt=""></span>`),
    ];
    const area = sum.area && mm.get(sum.area);
    const mins = Math.floor(sum.secs / 60), secs = sum.secs % 60;
    const el = this.show('runSummary', `<div class="rs">
      <div class="rs-banner">
        ${sum.levelUp > 0 ? `<div class="rs-lvup"><span class="rs-chev">⌃</span><b>${tl('Level UP!')}</b><small>${tl("You've reached level {n}.", { n: p.level })}</small></div>` : ''}
        <div class="rs-title ${win ? 'win' : ''}">${win ? tl('VICTORY') : tl('RUN COMPLETE')}</div>
        <div class="rs-sub">${area ? esc(area.short + ' · ' + area.name) : ''} · ${mins}:${String(secs).padStart(2, '0')}</div>
      </div>
      <div class="rs-left">
        <div class="rs-row rs-headrow"><span></span><span>${tl('DMG')}</span><span>${tl('H')}</span><span>${tl('D')}</span></div>
        ${rows.map(row).join('')}
      </div>
      <div class="rs-right">
        <div class="rs-lv"><div class="cw-lvl" style="background-image:url(assets/ui/icons/level_diamond.png)"><span>${p.level}</span></div></div>
        <div class="rs-exp"><span>${tl('EXP {a} / {b}', { a: fmt(p.exp), b: p.isMaxLevel ? tl('MAX') : fmt(need) })}</span><b>+${fmt(sum.exp)}</b></div>
        <div class="rs-bar"><i style="width:${pct}%"></i></div>
        <div class="rs-stat"><span>${tl('Enemies Killed')}</span><b>${fmt(sum.kills)}</b></div>
        <div class="rs-stat"><span>${tl('Bosses Defeated')}</span><b>${sum.bosses.length ? sum.bosses.map((id) => esc((BOSSES[id] || { name: id }).name)).join(', ') : '—'}</b></div>
        <div class="rs-stat"><span>${tl('Maps Visited')}</span><b>${sum.maps.filter((m) => mm.get(m)).map((m) => esc(mm.get(m).short || m)).join(' · ') || '—'}</b></div>
        <h4>${tl('REWARDS')}</h4>
        <div class="rs-rewards">${rewards.join('') || `<span class="muted small">${tl('Nothing carried home this time.')}</span>`}</div>
        <p class="muted small">${tl('Everything above is now safely yours.')}</p>
        <button class="primary rs-ok" data-ok="1">${tl('Continue')}</button>
      </div>
      <div class="keys rs-keys"><span><kbd>E</kbd><kbd>Esc</kbd>${tl('Continue')}</span></div>
    </div>`, 'rs-ov');
    this.wireTooltip(el);
    this.current.advance = () => this.close();
    el.addEventListener('click', (e) => { if (e.target.closest('[data-ok]')) this.close(); });
    g.audio.sfx(win ? 'levelup' : 'quest');
  }

  // party READY CHECK (server 'dungeonCheck'): area, who accepted, Accept / Decline for yourself; Esc = decline
  dungeonReady() {
    const g = this.game, on = g.online, c = on && on.check;
    if (!c) return;
    const d = g.world.mapManager.get(c.area) || { name: c.area, short: c.area, sub: '' };
    const mine = c.members.find((m) => m.id === on.playerId), waiting = mine && mine.answer !== 'yes';
    const secs = Math.max(0, Math.round((c.ends - Date.now()) / 1000));
    const el = this.show('dungeonReady', `<div class="panel confirm dg-ready">
      <h2>${tl('Party Entry')}</h2>
      <p>${tl('{name} wants to enter {area}', { name: `<b>${esc(c.leader)}</b>`, area: `<b>${esc(d.short)} · ${esc(d.name)}</b>` })}</p>
      <div class="dg-members">${c.members.map((m) => `<div class="${m.answer}"><i>${m.answer === 'yes' ? '✓' : '…'}</i>${esc(m.name)}${m.id === on.playerId ? ' ' + tl('(you)') : ''}</div>`).join('')}</div>
      <div class="muted small">${tl('Answer within {n} s · nobody enters until everyone accepts', { n: secs })}</div>
      <div class="row">${waiting ? `<button class="primary" data-r="yes">${tl('Accept')}</button><button data-r="no">${tl('Decline')}</button>` : `<button data-r="no">${tl('Cancel entry')}</button>`}</div>
      <div class="keys"><span><kbd>Esc</kbd>${waiting ? tl('Decline') : tl('Cancel')}</span></div>
    </div>`, '');
    const answer = (yes) => (yes ? on.net.send('dungeonAnswer', { check: c.check, yes: true }) : on.net.send('dungeonAnswer', { check: c.check, yes: false }));
    this.current.onClose = () => { if (on.check && on.check.check === c.check) answer(false); };
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-r]');
      if (!t) return;
      if (t.dataset.r === 'yes') answer(true);
      else { on.check = null; this.close(true); answer(false); }
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
      ? shop.stock.map((s) => { const id = shopId(s), d = ITEMS[id], price = shopPrice(s), ok = p.canAfford(price); return npcRow({ img: itemIconURL(d), color: RARITY_COLOR[d.rarity], name: d.name, nameColor: RARITY_COLOR[d.rarity], text: esc(d.modText || d.desc || ''), tip: id,
        right: `<button data-buy="${id}" ${ok ? '' : 'disabled'}>${goldTag(price, ok)}</button>` }); }).join('')
      : sellable.map(({ id, n, def }) => npcRow({ img: itemIconURL(def), color: RARITY_COLOR[def.rarity], name: `${def.name} ×${n}`, tip: id, right: `<button data-sell="${id}">+ ${goldTag(def.sell)}</button>` })).join('')
        || `<div class="muted small">${tl('No materials to sell.')}</div>`;
    const el = this.show('shop', npcPanelHTML({ icon: 'npc_shop', title: shop.title, sub: tab === 'buy' ? tl('Buy') : tl('Sell materials'), gold: p.gold,
      menu: [{ id: 'buy', label: tl('Buy') }, { id: 'sell', label: tl('Sell') }], tab, body, keys: [[tl('Click'), tab === 'buy' ? tl('Buy') : tl('Sell')]] }), 'side');
    this.wireNpc(el, 'shop', () => this.shop(), (t) => {
      const E = g.online && g.online.econ, why = (kind, id, fn) => (E ? E.why(kind, id, fn) : fn()); // ONLINE H5a reasons
      if (t.dataset.buy) { const s = shop.stock.find((x) => shopId(x) === t.dataset.buy); if (!s) return; if (!g.inventory.canAdd(t.dataset.buy)) g.ui.toast(tl('Inventory full'), 1); else why('buy', t.dataset.buy, () => { if (p.removeGold(shopPrice(s))) { g.inventory.add(t.dataset.buy, 1); g.audio.sfx('chest'); } }); this.shop(); }
      if (t.dataset.sell) { const d = ITEMS[t.dataset.sell]; why('sell', t.dataset.sell, () => { if (g.inventory.remove(t.dataset.sell, 1)) { p.addGold(d.sell); g.audio.sfx('gather'); } }); this.shop(); }
    });
  }
  smith() {
    const g = this.game, p = g.player, inv = g.inventory;
    const can = (r) => p.canAfford(r.gold) && inv.canAdd(r.out) && Object.entries(r.mats).every(([m, n]) => inv.has(m, n));
    const owned = (id) => inv.has(id) || Object.values(g.equipment.slots).includes(id);
    const body = RECIPES.map((r, i) => { const d = ITEMS[r.out]; return npcRow({ img: itemIconURL(d), color: RARITY_COLOR[d.rarity], name: d.name, nameColor: RARITY_COLOR[d.rarity], tip: r.out, cls: 'recipe',
      text: `${Object.entries(d.stats || {}).map(([k, v]) => `${statLabel(k)} ${statVal(k, v)}`).join(' · ')}${d.modText ? `<div class="mod">◆ ${esc(d.modText)}</div>` : ''}
        <div>${Object.entries(r.mats).map(([m, n]) => `<span class="${inv.has(m, n) ? 'ok' : 'bad'}">${esc(ITEMS[m].name)} ${inv.count(m)}/${n}</span>`).join(' · ')} · ${goldTag(r.gold, p.gold >= r.gold)}</div>`,
      right: `<button data-craft="${i}" ${can(r) && !owned(r.out) ? '' : 'disabled'}>${owned(r.out) ? tl('Owned') : tl('Forge')}</button>` }); }).join('')
      + `<p class="muted small">${tl('Materials drop from monsters and resource nodes.')}</p>`;
    const el = this.show('smith', npcPanelHTML({ icon: 'npc_smith', title: tl("Borin's Forge"), sub: tl('Forge'), gold: p.gold, body, keys: [[tl('Click'), tl('Forge')]] }), 'side');
    this.wireNpc(el, 'smith', () => this.smith(), (t) => {
      if (t.dataset.craft === undefined) return;
      const r = RECIPES[+t.dataset.craft];
      if (!can(r) || !p.removeGold(r.gold)) return;
      for (const [m, n] of Object.entries(r.mats)) inv.remove(m, n);
      inv.add(r.out, 1);
      g.audio.sfx('levelup');
      g.ui.banner(tl('FORGED'), ITEMS[r.out].name, '#ffd98a');
      this.smith();
    });
  }
  storage() {
    const g = this.game, inv = g.inventory, tab = this.npcTab('storage', 'store');
    const list = tab === 'store' ? Object.entries(inv.items).filter(([id]) => ITEMS[id].cat !== 'Quest Item' && !ITEMS[id].bound) : Object.entries(inv.storage);
    const body = list.map(([id, n]) => { const d = ITEMS[id]; return npcRow({ img: itemIconURL(d), color: RARITY_COLOR[d.rarity], name: `${d.name} ×${n}`, tip: id,
      right: tab === 'store' ? `<button data-dep="${id}">${tl('Store →')}</button>` : `<button data-wd="${id}">${tl('← Take')}</button>` }); }).join('') || `<div class="muted small">${tl('Empty')}</div>`;
    const el = this.show('storage', npcPanelHTML({ icon: 'npc_storage', title: tl('Storage Chest'), sub: tab === 'store' ? tl('Your bag → chest') : tl('Chest → your bag'),
      menu: [{ id: 'store', label: tl('Store') }, { id: 'take', label: tl('Take') }], tab, body, keys: [[tl('Click'), tab === 'store' ? tl('Store one') : tl('Take one')]] }), 'side');
    this.wireNpc(el, 'storage', () => this.storage(), (t) => {
      if (t.dataset.dep) { inv.deposit(t.dataset.dep, 1); this.storage(); }
      if (t.dataset.wd) { inv.withdraw(t.dataset.wd, 1); this.storage(); }
    });
  }
  teleport(fromId) {
    const g = this.game, w = g.world;
    const stones = w.interactables.filter((it) => it.kind === 'waystone');
    const body = `<p class="muted small">${tl("Your wounds close in the waystone's light. Travel to any attuned waystone.")}</p>` + stones.map((s) => npcRow({ img: UI_ICON('npc_waystone'), name: s.name,
      text: s.id === fromId ? tl('You are here') : w.state.waystones[s.id] ? '' : tl('Not attuned'), cls: s.id === fromId ? 'np-here' : '',
      right: w.state.waystones[s.id] && s.id !== fromId ? `<button data-tp="${s.id}">${tl('Travel')}</button>` : '' })).join('');
    const el = this.show('teleport', npcPanelHTML({ icon: 'npc_waystone', title: tl('Waystone Network'), sub: tl('Travel'), body, keys: [[tl('Click'), tl('Travel')]] }), 'side');
    this.wireNpc(el, 'teleport', () => this.teleport(fromId), (t) => { if (t.dataset.tp) { this.close(); g.teleportTo(t.dataset.tp); } });
  }

  // ---------------- world map
  worldMap() {
    const g = this.game, w = g.world, map = w.map, hud = g.ui.hud;
    hud.refreshMini();
    const el = this.show('map', `<div class="panel map"><h2><img class="h2-ico" src="${UI_ICON('menu_map')}" alt="">${tl('World Map')} <span class="keys" style="float:right;padding:0"><span><kbd>M</kbd>${tl('Close')}</span></span></h2><canvas></canvas><div class="legend">
      <span style="color:#fff">${tl('▲ You')}</span><span style="color:#ffe070">${tl('◆ Objective')}</span><span style="color:#5af0ff">${tl('◆ Waystone')}</span><span style="color:#ffc050">${tl('● Chest')}</span><span style="color:#ff4060">${tl('● Boss')}</span><span style="color:#8adfff">${tl('● NPC')}</span></div>
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
        const boss = s.boss ? `<div class="small" style="color:${s.bossDefeated ? '#8af0a0' : '#ff9a8a'}">${s.boss.type === 'major' ? tl('MAJOR') : tl('BOSS')}: ${s.boss.name}${s.bossDefeated ? ' ✓' : ''}</div>` : '';
        const hid = s.hiddenTotal ? `<div class="small muted">${tl('secrets')} ${s.hiddenFound}/${s.hiddenTotal}</div>` : '';
        const ex = s.unlocked && !s.planned ? this.exploredHtml(s.id) : '';
        const why = !s.unlocked && s.lockReason ? `<div class="small muted">${s.lockReason}</div>` : '';
        return `<div style="display:inline-block;vertical-align:top;margin:4px 8px;min-width:120px;color:${col}"><b>${mark} ${s.short}</b> <span class="small">${s.planned ? tl('(planned)') : s.name}</span>${boss}${hid}${ex}${why}</div>`;
      };
      const city = st.city ? `<div style="display:inline-block;vertical-align:top;margin:4px 8px;color:${st.city.unlocked ? '#ffe8b0' : '#77708a'}"><b>${st.city.unlocked ? '●' : '✕'} ${st.city.short}</b> <span class="small">${st.city.name}</span></div>`
        : `<div style="display:inline-block;vertical-align:top;margin:4px 8px;color:#77708a"><b>✕ ${tl('City 2')}</b> <span class="small">${tl('(planned)')}</span></div>`;
      return `<div style="margin-top:8px;text-align:left"><b style="color:#ffd98a">${r.name}</b> <span class="muted small">${r.sub}${r.playable ? (st.complete ? ' · ' + tl('COMPLETE') : '') : ' · ' + tl('not surveyed yet')}</span><br>${st.steps.map(cell).join('<span class="muted">→</span>')}<span class="muted">→</span>${city}</div>`;
    }).join('') + this.secretMapsHtml();
  }
  // exploration counter of a map (world/discoveries.js): ✦ found / total, "?" until visited, gold when complete
  exploredHtml(mapId) {
    const ex = this.game.discoveries && this.game.discoveries.of(mapId);
    if (!ex) return `<div class="small muted">${tl('✦ explored')} ?</div>`;
    if (!ex[1]) return '';
    return `<div class="small" style="color:${ex[0] === ex[1] ? '#ffe08a' : '#b8acd8'}">${tl('✦ explored')} ${ex[0]}/${ex[1]}${ex[0] === ex[1] ? ' ✓' : ''}</div>`;
  }
  // secret maps (maps/*.js `secret: true`): listed only once visited
  secretMapsHtml() {
    const w = this.game.world, found = w.mapManager.list.filter((d) => d.secret && w.state.maps[d.id]);
    if (!found.length) return '';
    return `<div style="margin-top:8px;text-align:left"><b style="color:#e0b0ff">${tl('SECRETS')}</b> ${found.map((d) => `<span style="margin:0 8px;color:#e0b0ff">✦ ${d.name}</span>`).join('')}</div>`;
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
        <div class="np-head"><img class="np-ico" src="${UI_ICON('menu_settings')}" alt=""><div class="np-title"><b>ECLIPSE ONLINE</b><div class="np-sub">${tl('Paused')}</div></div></div>
        <div class="esc-list">
          ${[['resume', tl('Resume'), 'menu_class', ''], ['save', tl('Save'), 'menu_save', ''], ['load', tl('Load'), 'menu_save', g.save.exists() ? '' : 'disabled'],
            ['map', tl('World Map'), 'menu_map', ''], ['party', tl('Party') + (g.online && g.online.party ? ` (${g.online.party.members.length})` : ''), 'menu_class', g.online && g.online.online ? '' : 'disabled'], ['controls', tl('Controls'), 'menu_codex', ''], ['sound', tl('Sound') + (g.audio.muted ? ' ' + tl('(muted)') : ''), 'menu_settings', ''],
            ['layout', g.ui.hud.layout() === 'focus' ? tl('HUD: Focus (skill bar)') : tl('HUD: Classic (top-left)'), 'menu_skills', ''],
            ['tele', tl('Warnings: {mode}', { mode: ({ all: tl('All attacks'), heavy: tl('Heavy + danger'), danger: tl('Danger only') })[telegraphView()] }), 'menu_codex', ''],
            ['reset', tl('Reset Progress'), 'menu_quests', ''], ['lang', tl('Language: {name}', { name: LANG.names[getLang()] }), 'menu_settings', ''], ['title', tl('Title Screen'), 'menu_equipment', '']]
            .map(([a, l, ic, dis]) => `<button data-a="${a}" ${dis}><img src="${UI_ICON(ic)}" alt="">${l}</button>`).join('')}
        </div>
        <div class="muted small esc-save">${g.save.info()}</div>
        <div class="keys"><span><kbd>Esc</kbd>${tl('Resume')}</span></div>
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
        else { e.target.dataset.confirm = '1'; e.target.textContent = tl('Click again to confirm reset'); e.target.classList.add('danger'); }
      }
      if (a === 'controls') this.textPanel(tl('Controls'), controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), () => this.menu(), true);
      if (a === 'sound') this.sound();
      if (a === 'lang') { setLang(nextLang()); this.menu(); }
      if (a === 'tele') { const o = TELEGRAPH_VIEW.options; setTelegraphView(o[(o.indexOf(telegraphView()) + 1) % o.length]); this.menu(); }
      if (a === 'layout') { g.ui.hud.setLayout(g.ui.hud.layout() === 'focus' ? 'classic' : 'focus'); this.menu(); }
      if (a === 'title') { this.close(); g.toTitle(); }
    });
  }
  // Sound settings: one slider per mixer bus (data/sounds.js AUDIO_BUSES), saved per browser by Audio.
  sound() {
    const g = this.game, A = g.audio;
    const rows = Object.entries(AUDIO_BUSES).map(([k, b]) => `<label class="snd-row"><span>${esc(tl(b.label))}</span>
      <input type="range" min="0" max="100" step="1" value="${Math.round(A.levels[k] * 100)}" data-bus="${k}"><b>${Math.round(A.levels[k] * 100)}</b></label>`).join('');
    const el = this.show('menu', `
      <div class="panel menu esc-menu">
        <div class="np-head"><img class="np-ico" src="${UI_ICON('menu_settings')}" alt=""><div class="np-title"><b>${tl('SOUND')}</b><div class="np-sub">${tl('Volume')}</div></div></div>
        <div class="snd-list">${rows}</div>
        <div class="esc-list"><button data-a="mute">${A.muted ? tl('Unmute all') : tl('Mute all')}</button><button data-a="back">${tl('Back')}</button></div>
        <div class="keys"><span><kbd>Esc</kbd>${tl('Resume')}</span></div>
      </div>`, 'side');
    el.addEventListener('input', (e) => {
      const r = e.target.closest('[data-bus]'); if (!r) return;
      A.setLevel(r.dataset.bus, r.value / 100); r.nextElementSibling.textContent = r.value;
      if (r.dataset.bus !== 'music') A.sfx(r.dataset.bus === 'ui' ? 'ui' : 'hit');
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'mute') { A.setMuted(!A.muted); this.sound(); }
      if (b.dataset.a === 'back') this.menu();
    });
  }
  death() {
    const g = this.game;
    const el = this.show('death', `<div class="death"><h1>${esc(tl(PARTY.failed.title))}</h1><p>${esc(tl(PARTY.failed.text))}</p><button class="primary">${tl('Return to Checkpoint')}</button></div>`, 'dark');
    el.querySelector('button').onclick = () => { this.close(); g.respawn(); };
  }
  ending(stats) {
    const g = this.game;
    const el = this.show('ending', `
      <div class="ending">
        <div class="eclipse big"></div>
        <h1>${tl('YOUR JOURNEY HAS ONLY BEGUN.')}</h1>
        <p>${tl('The Guardian rests. The forest breathes again. Beneath the Ancient Valley, the Sealed Depths wait for the one who severed the eclipse.')}</p>
        <div class="summary">
          <div>${tl('Play Time')} <b>${stats.time}</b></div><div>${tl('Level')} <b>${stats.level}</b></div>
          <div>${tl('Secrets')} <b>${stats.secrets} / 4</b></div><div>${tl('Lore')} <b>${stats.lore} / ${stats.loreTotal}</b></div>
          <div>${tl('Monsters Defeated')} <b>${stats.kills}</b></div><div>${tl('Treasure Found')} <b>${stats.chests}</b></div>
        </div>
        <p class="muted">${tl('ECLIPSE ONLINE — Prototype Vertical Slice · To be continued in Ancient Valley — A2')}</p>
        <button class="primary">${tl('Continue Exploring')}</button>
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
