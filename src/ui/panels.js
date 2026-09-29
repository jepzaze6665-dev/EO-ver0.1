import { PARTY } from '../data/party.js';
import { SKILL_TIERS, staminaCost } from '../data/skillTiers.js';
import { ITEMS, RARITY_COLOR, CATEGORIES, RECIPES, SHOPS } from '../items/items.js';
import { iconURL } from './icons.js';
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
import { expToNext } from '../progression/experience.js';

// class passives (class data: passives [{ name, desc }]) — codex + Skills tab
const passiveRows = (cls) => (cls.passives && cls.passives.length ? `<h4>Passives</h4>${cls.passives.map((x) => `<div class="cx-skill"><div><b>${esc(x.name)}</b> <span class="muted small">passive</span><div class="small">${esc(x.desc)}</div></div></div>`).join('')}` : '');

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
      if (a === 'controls') this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), () => this.title(hasSave), true);
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
      <div class="panel lore">
        <h2>${esc(title)}</h2>
        <div class="body">${esc(body).replace(/\n/g, '<br>')}</div>
        <button class="yes">${esc(yesLabel)} [E]</button> <button class="no">${esc(noLabel)} [Esc]</button>
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
    const g = this.game, p = g.player, inv = g.inventory, eq = g.equipment;
    const tabs = [['inventory', 'Inventory'], ['equipment', 'Equipment'], ['skills', 'Skills'], ['class', 'Class'], ['knowledge', 'Monster Knowledge'], ['lore', 'Lore & Quests']];
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
            <div>EXP <b>${p.isMaxLevel ? 'MAX' : `${p.exp} / ${p.expToNext()}`}</b></div>
            <h3>Skill Modifiers</h3>
            ${Object.keys(p.mods).length ? Object.values(eq.slots).filter(Boolean).map((id) => ITEMS[id].modText ? `<div class="mod">◆ ${esc(ITEMS[id].modText)}</div>` : '').join('') : '<div class="muted">None — find or forge equipment to change your build.</div>'}
          </div>
        </div>`;
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
      const lockRow = (s) => { const r = p.skillUnlockCheck(s); return r.ok ? '' : `<div class="small" style="color:#ffb070">🔒 Unlocks with: ${r.missing.map(esc).join(', ')}</div>`; };
      const card = (s, extra = '') => `<div class="skill-card${lo.slots.includes(s.id) ? ' on' : ''}"${p.skillUnlocked(s) ? '' : ' style="opacity:.6"'}>
          <img src="${iconURL(s.icon)}"><div class="sk-body">${catTag(s)}<b>${esc(s.name)}</b> <span class="muted small">${cd(s)} · ${(s.tags || []).join(', ')}</span>
          <div class="small">${esc(s.desc || '')}</div>${lockRow(s)}${lvRow(s)}${masteryRow(s)}${evoRow(s)}${extra}</div></div>`;
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
      body = `<div class="skills-layout">
        <div><h3>${esc(p.cls.name)} — Skill Loadout</h3>
          <p class="small">Class LV <b style="color:#e0c070">${p.classLevel()}</b>${p.classFollowsCharacter() ? ' <span class="muted">(= character level)</span>' : ` <span class="muted">(${Math.floor((g.classProgress.classes[p.cls.id] || {}).exp || 0)}/${expToNext(p.classLevel())} class EXP)</span>`}
            · Skill points: <b style="color:#e0c070">${Math.max(0, p.skillPointsLeft())}</b> <span class="muted">(1 per class level)</span></p>
          <div class="small sk-tree" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px">${[...p.cls.skills, p.cls.special].filter(Boolean)
            .sort((a, b) => ((a.unlock && a.unlock.classLevel) || 1) - ((b.unlock && b.unlock.classLevel) || 1))
            .map((s) => { const ok = p.skillUnlocked(s); return `<span title="${esc(s.name)}" style="padding:2px 6px;border-radius:4px;border:1px solid ${ok ? '#6a58a0' : '#3a3040'};color:${ok ? '#e8dcff' : '#8a7a70'}">${ok ? '' : '🔒'}LV ${(s.unlock && s.unlock.classLevel) || 1} ${esc(s.name)}</span>`; }).join('<span class="muted">›</span>')}</div>
          <p class="muted small">Keys <b>1-4</b> are yours to choose. <b>5</b> is always the ultimate and <b>Q</b> the class special. Changes are locked while in combat.</p>
          ${[...lo.pool()].sort((a, b) => ((a.unlock && a.unlock.classLevel) || 1) - ((b.unlock && b.unlock.classLevel) || 1)).map((s) => card(s, !p.skillUnlocked(s) ? '' : `<div class="slot-btns">${[0, 1, 2, 3].map((i) => `<button data-slot="${i}" data-skill="${s.id}" class="${lo.slots[i] === s.id ? 'on' : ''}">${i + 1}</button>`).join('')}</div>`)).join('')}
        </div>
        <div><h3>Fixed</h3>${[lo.ultimate(), p.cls.special].filter(Boolean).map((s) => card(s, `<div class="muted small">Key ${s.ultimate ? '5' : 'Q'}</div>`)).join('')}${passiveRows(p.cls)}</div>
      </div>`;
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

      // ---- tree (SVG): one column per tier, children fanned out beside their parent
      const STATE_LABEL = { current: 'CURRENT', owned: 'OWNED', unlocked: 'UNLOCKED', ready: 'TRIAL READY', locked: 'LOCKED', future: '—' };
      const cols = {}; for (const t of tree) (cols[t.depth] ||= []).push(t);
      const NW = 168, NH = 44, GX = 70, H = Math.max(...Object.values(cols).map((c) => c.length)) * (NH + 12) + 12;
      const pos = {};
      for (const [d, list] of Object.entries(cols)) list.forEach((t, i) => { pos[t.node.id] = { x: 10 + d * (NW + GX), y: 6 + (i + 0.5) * (H / list.length) - NH / 2 }; });
      const W = 20 + (Object.keys(cols).length) * (NW + GX) - GX;
      const lines = tree.filter((t) => t.node.parent && pos[t.node.parent]).map((t) => {
        const a = pos[t.node.parent], b = pos[t.node.id], x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
        return `<path class="edge ${t.state}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
      }).join('');
      const nodes = tree.map((t) => { const q = pos[t.node.id]; return `<g class="tnode ${t.state} ${t.node.id === selId ? 'sel' : ''}" data-node="${t.node.id}" transform="translate(${q.x},${q.y})">
          <rect width="${NW}" height="${NH}" rx="6"/><text x="10" y="18" class="tn">${esc(t.node.name)}</text>
          <text x="10" y="34" class="ts">Tier ${t.node.tier} · ${STATE_LABEL[t.state]}</text></g>`; }).join('');
      const treeSvg = `<svg class="class-tree" viewBox="0 0 ${W} ${H + 12}" width="${W}" height="${H + 12}">${lines}${nodes}</svg>`;

      // ---- codex of the selected class
      const src = selCls || selNode;
      const ratings = selCls ? `<div class="ratings">${Object.entries({ Difficulty: selCls.difficulty, ...Object.fromEntries(Object.entries(selCls.ratings || {}).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v])) }).filter(([, v]) => v).map(([k, v]) => `<div><span>${k}</span><i class="pips">${'<b></b>'.repeat(v)}${'<u></u>'.repeat(5 - v)}</i></div>`).join('')}</div>` : '';
      const sw = selCls && selCls.strengths ? `<div class="sw"><div><h4>Strengths</h4>${selCls.strengths.map((x) => `<div class="small">+ ${esc(x)}</div>`).join('')}</div><div><h4>Weaknesses</h4>${(selCls.weaknesses || []).map((x) => `<div class="small">− ${esc(x)}</div>`).join('')}</div></div>` : '';
      const skillRow = (s, key) => `<div class="cx-skill"><img src="${iconURL(s.icon)}"><div><b>${esc(s.name)}</b> <span class="muted small">${key ? '[' + key + '] · ' : ''}${s.type}${s.cooldown ? ' · CD ' + s.cooldown + 's' : ''}${s.cost ? ' · ' + s.cost + ' ' + RESOURCES[s.costResource || selCls.resource].label : ''}</span><div class="small">${esc(s.desc || '')}</div></div></div>`;
      const skills = selCls ? `<h4>Skills</h4>${selCls.skills.map((s) => skillRow(s, s.ultimate ? '5' : '')).join('')}${selCls.special ? skillRow(selCls.special, 'Q') : ''}${passiveRows(selCls)}` : `<p class="muted small">Skills are revealed when this class arrives (Class 2 content).</p>`;
      const res = selCls ? RESOURCES[selCls.resource].name : selNode.resource || '—';
      const codex = `<div class="codex"><h3>${esc(src.name)} <span class="muted small">Tier ${selNode.tier} · ${esc(src.role || '')}</span></h3>
          ${selCls && selCls.identity ? `<p class="identity">“${esc(selCls.identity)}”</p>` : ''}
          <div class="small">${esc(src.description || '')}</div>
          <div class="muted small">Resource: <b>${esc(res)}</b>${selCls && ITEMS[selCls.signatureWeapon] ? ` · Signature weapon: <b>${esc(ITEMS[selCls.signatureWeapon].name)}</b>` : ''}</div>
          ${selCls && selCls.loop ? `<div class="muted small">Gameplay loop: <b>${selCls.loop.map(esc).join(' → ')}</b></div>` : ''}
          ${ratings}${sw}${skills}</div>`;

      // ---- right side: path card for a reachable class, otherwise your classes + records
      const path = prog.paths().find((x) => x.node.id === selId);
      const card = path ? `<div class="path-card ${path.unlocked ? 'unlocked' : ''}"><div class="path-head"><b>Path to ${esc(path.node.name)}</b></div>
          ${path.unlocked ? `<div class="req ok">✦ UNLOCKED — ${path.node.playable ? 'change to it under Your Classes' : 'playable when its Class 2 content arrives'}</div>` : path.reqs.map(reqRow).join('')}
          ${trialBox(path)}</div>` : '';
      const owned = [prog.startingClass, ...prog.unlocked].filter(Boolean).map((id) => {
        const node = CLASS_TREE[id], chk = classChangeCheck(g, id), cur = id === p.cls.id;
        const why = { not_playable: 'arrives with Class 2 content', combat: 'leave combat first', boss: 'not during a boss fight', dead: '' }[chk.reason] || '';
        return `<div class="owned ${cur ? 'cur' : ''}"><b>${esc(node.name)}</b> <span class="muted small">Tier ${node.tier}</span>
          ${cur ? '<span class="tag-cur">CURRENT</span>' : chk.ok ? `<button data-change="${id}">Change class</button>` : `<span class="muted small">${why}</span>`}</div>`;
      }).join('');
      const recs = Object.entries(rec).filter(([, v]) => v > 0).map(([k, v]) => `<div>${esc(CLASS_COUNTERS[k] ? CLASS_COUNTERS[k].label : k)} <b>${Math.floor(v)}</b></div>`).join('') || '<div class="muted">Nothing yet — fight!</div>';
      body = `<div class="tree-wrap">${treeSvg}<div class="muted small">Click a class to read about it. Meet a path's requirements, then pass its trial to unlock it.</div></div>
        <div class="class-layout">${codex}
          <div>${card}<h3>Your Classes</h3>${owned}<h3>Class Records <span class="muted small">(${esc(p.cls.name)})</span></h3><div class="records">${recs}</div></div>
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
      <div class="panel big">
        <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === this.invTab ? 'on' : ''}">${l}</button>`).join('')}<button class="x">✕</button></div>
        <div class="content">${body}</div>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-cat],[data-item],[data-use],[data-equip],[data-unequip],[data-slot],[data-upgrade],[data-evo-open],[data-evolve],[data-trial],[data-abandon],[data-change],[data-node],.x');
      if (!t) return;
      if (t.classList.contains('x')) return this.close();
      if (t.dataset.tab) { this.invTab = t.dataset.tab; this.inventory(); }
      else if (t.dataset.cat) { this.invCat = t.dataset.cat; this.inventory(); }
      else if (t.dataset.item) { this.selected = t.dataset.item; this.inventory(); g.audio.sfx('ui'); }
      else if (t.dataset.use) { g.inventory.use(t.dataset.use); this.inventory(); }
      else if (t.dataset.equip) { g.equipment.equip(t.dataset.equip); if (!g.inventory.has(this.selected)) this.selected = null; this.inventory(); }
      else if (t.dataset.unequip) { g.equipment.unequip(t.dataset.unequip); this.inventory(); }
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
    const sellable = g.inventory.list('Material'), shop = SHOPS[this.dialogueNpc] || SHOPS.merchant;
    const el = this.show('shop', `
      <div class="panel">
        <h2>${esc(shop.title)} <span class="gold-inline">${p.gold} G</span></h2>
        <h3>Buy</h3>
        ${shop.stock.map((id) => { const d = ITEMS[id]; return `<div class="row"><img src="${iconURL(d.icon, d.color)}"><div class="grow"><b style="color:${RARITY_COLOR[d.rarity]}">${esc(d.name)}</b><div class="muted small">${esc(d.modText || d.desc)}</div></div><button data-buy="${id}" ${!p.canAfford(d.price) ? 'disabled' : ''}>${d.price} G</button></div>`; }).join('')}
        <h3>Sell materials</h3>
        ${sellable.map(({ id, n, def }) => `<div class="row"><img src="${iconURL(def.icon, def.color)}"><div class="grow">${esc(def.name)} ×${n}</div><button data-sell="${id}">+${def.sell} G</button></div>`).join('') || '<div class="muted">No materials to sell.</div>'}
        <button class="close">Close</button>
      </div>`);
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('close')) return this.close();
      if (t.dataset.buy) { const d = ITEMS[t.dataset.buy]; if (!g.inventory.canAdd(t.dataset.buy)) g.ui.toast('Inventory full', 1); else if (p.removeGold(d.price)) { g.inventory.add(t.dataset.buy, 1); g.audio.sfx('chest'); } this.shop(); }
      if (t.dataset.sell) { const d = ITEMS[t.dataset.sell]; if (g.inventory.remove(t.dataset.sell, 1)) { p.addGold(d.sell); g.audio.sfx('gather'); } this.shop(); }
    });
  }
  smith() {
    const g = this.game, p = g.player, inv = g.inventory;
    const can = (r) => p.canAfford(r.gold) && inv.canAdd(r.out) && Object.entries(r.mats).every(([m, n]) => inv.has(m, n));
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
        if (!can(r) || !p.removeGold(r.gold)) return;
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
      if (a === 'save') { g.saveGame(); this.menu(); }
      if (a === 'load') { this.close(); g.loadGame(); }
      if (a === 'reset') {
        if (e.target.dataset.confirm) { this.close(); g.resetGame(); }
        else { e.target.dataset.confirm = '1'; e.target.textContent = 'Click again to confirm reset'; e.target.classList.add('danger'); }
      }
      if (a === 'controls') this.textPanel('Controls', controlsHTML(this.game.player ? this.game.player.cls : undefined, this.game.player), () => this.menu(), true);
      if (a === 'mute') { g.audio.setMuted(!g.audio.muted); this.menu(); }
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
