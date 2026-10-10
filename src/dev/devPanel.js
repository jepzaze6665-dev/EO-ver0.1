// DEV PANEL (F4) — buttons instead of console commands, for testing only.
// Opens only in DEV MODE (isDevMode: localhost / 127.0.0.1 or ?dev in the URL; ?nodev turns it off) so players on a
// real server never get it. A floating DOM box on the right: the world keeps running (it is not a ui panel).
// Tabs: Player · World · Spawn · Items · Snapshots (save states kept in this browser) · Tests (testkit suites).
// Everything goes through the normal game APIs (setLevel, changeMap, changeClass force, items.give, applySave ...).
import { CLASSES } from '../skills/classes.js';
import { MAPS } from '../maps/mapRegistry.js';
import { BOSSES } from '../data/bosses.js';
import { MONSTERS } from '../monsters/monsterTypes.js';
import { Monster } from '../monsters/monster.js';
import { ITEMS } from '../items/items.js';
import { SKILL_TREE } from '../data/skillTree.js';
import { parseSave } from '../save/saveData.js';
import { PREMIUM } from '../data/premium.js';

export function isDevMode(loc = typeof location !== 'undefined' ? location : null) {
  if (!loc) return false;
  const q = new URLSearchParams(loc.search || '');
  if (q.has('nodev')) return false;
  return q.has('dev') || ['localhost', '127.0.0.1', '[::1]'].includes(loc.hostname);
}

// SNAPSHOTS: { name: save text } in localStorage (this browser only), separate from the real save
export const SNAP_KEY = 'eclipse_dev_snapshots';
export function readSnaps(store = localStorage) { try { return JSON.parse(store.getItem(SNAP_KEY) || '{}') || {}; } catch { return {}; } }
export function writeSnaps(s, store = localStorage) { try { store.setItem(SNAP_KEY, JSON.stringify(s)); return true; } catch { return false; } }

// test suites the Tests tab can run (name, call); long boss fights are marked slow
const TESTS = [
  ['uiCheck', (T, g) => T.uiCheck(g)], ['dodgeCheck', (T, g) => T.dodgeCheck(g, g.player.cls.id)],
  ['enemyCheck', (T, g) => T.enemyCheck(g)], ['tankCheck', (T, g) => T.tankCheck(g)],
  ['itemSystemCheck', (T, g) => T.itemSystemCheck(g)], ['discoveryCheck', (T, g) => T.discoveryCheck(g)],
  ['mapTour (slow)', (T, g) => T.mapTour(g)], ['routeA (slow)', (T, g) => T.routeA(g, g.player.cls.id)],
  ['playthrough (slow)', (T, g) => T.playthrough(g, g.player.cls.id)],
];

const opts = (list) => list.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
const CSS = `#devp{position:fixed;top:190px;right:10px;width:330px;max-height:calc(100vh - 220px);overflow:auto;z-index:9999;background:rgba(10,8,18,.92);
border:1px solid #6a5a9a;border-radius:6px;color:#e8e0ff;font:12px Segoe UI,sans-serif;padding:8px}
#devp h3{margin:0 0 6px;font-size:13px;color:#ffd96a}#devp .tabs button{padding:2px 6px;margin:0 2px 4px 0}
#devp .tabs button.on{background:#6a4ab0;color:#fff}#devp .row{display:flex;gap:4px;margin:4px 0;align-items:center;flex-wrap:wrap}
#devp button{background:#2a2440;color:#e8e0ff;border:1px solid #5a4a8a;border-radius:3px;cursor:pointer;padding:3px 7px;font-size:12px}
#devp button:hover{background:#3d3360}#devp select,#devp input{background:#1a1628;color:#fff;border:1px solid #5a4a8a;font-size:12px;max-width:180px}
#devp .ok{color:#8f8}#devp .bad{color:#f88}#devp .res{white-space:pre-wrap;font-family:monospace;font-size:11px;max-height:260px;overflow:auto}`;

export class DevPanel {
  constructor(game) {
    this.game = game;
    this.tab = 'player';
    this.god = false;
    this.el = null;
    this.result = '';
  }
  get open() { return !!this.el; }
  toggle() { if (this.el) this.close(); else this.show(); }
  close() { if (this.el) this.el.remove(); this.el = null; }
  // every frame (Game.update): god mode keeps HP / stamina full
  update() {
    const p = this.game.player;
    if (!this.god || !p || p.dead) return;
    p.hp = p.maxHp;
    if (p.resources.has('stamina') && p.resources.get('stamina') < p.resources.max('stamina')) p.resources.fill('stamina');
  }
  show() {
    if (!document.getElementById('devp-css')) { const s = document.createElement('style'); s.id = 'devp-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'devp';
      this.el.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (b) this.act(b.dataset.a, b.dataset.v); });
      document.body.appendChild(this.el);
    }
    this.render();
  }
  val(id) { const e = this.el.querySelector('#' + id); return e ? e.value : ''; }
  render() {
    const g = this.game, p = g.player, t = this.tab;
    const tabs = ['player', 'world', 'spawn', 'items', 'snaps', 'tests'].map((k) => `<button data-a="tab" data-v="${k}" class="${k === t ? 'on' : ''}">${k}</button>`).join('');
    let body = '';
    if (t === 'player') {
      body = `<div>${p.cls.name} · LV ${p.level} · ${Math.round(p.hp)}/${p.maxHp} HP · ${p.gold} G</div>
      <div class="row">Level <input id="dv-lv" type="number" min="1" max="50" value="${p.level}" style="width:50px"><button data-a="level">Set</button></div>
      <div class="row"><button data-a="gold">+1000 G</button><button data-a="diamonds">+100 💎</button><button data-a="heal">Full heal</button><button data-a="god">God: ${this.god ? 'ON' : 'off'}</button></div>
      <div class="row"><button data-a="unlock">All skills unlocked: ${SKILL_TREE.unlockAll ? 'ON' : 'off'}</button></div>
      <div class="row"><select id="dv-cls">${opts(Object.values(CLASSES).map((c) => [c.id, c.name]))}</select><button data-a="cls">Change class</button></div>`;
    } else if (t === 'world') {
      const bosses = Object.values(BOSSES).filter((b) => !b.planned && b.map);
      body = `<div>Map: ${g.world.mapId}</div>
      <div class="row"><select id="dv-map">${opts(MAPS.map((m) => [m.id, `${m.id} — ${m.name}`]))}</select><button data-a="map">Go</button></div>
      <div class="row"><select id="dv-boss">${opts(bosses.map((b) => [b.id, b.name]))}</select><button data-a="boss">Go to arena</button><button data-a="down">Mark defeated</button></div>
      <div class="row"><button data-a="downall">Defeat every boss (open all roads)</button></div>
      <div class="row"><button data-a="save">Save game now</button><button data-a="viewer">Sprite viewer ↗</button><button data-a="vfxlab">VFX Lab ↗</button></div>`;
    } else if (t === 'spawn') {
      body = `<div class="row"><select id="dv-mon">${opts(Object.keys(MONSTERS).sort().map((k) => [k, `${k} — ${MONSTERS[k].name || ''}`]))}</select></div>
      <div class="row">Count <input id="dv-n" type="number" min="1" max="10" value="1" style="width:40px"><label><input id="dv-el" type="checkbox"> elite</label><button data-a="spawn">Spawn</button></div>
      <div class="row"><button data-a="killall">Kill monsters on this map</button></div>`;
    } else if (t === 'items') {
      body = `<div class="row"><input id="dv-if" placeholder="filter" value="${this.itemFilter || ''}"><button data-a="ifilter">Find</button></div>
      <div class="row"><select id="dv-item">${opts(Object.keys(ITEMS).filter((k) => !this.itemFilter || (k + ITEMS[k].name).toLowerCase().includes(this.itemFilter.toLowerCase())).sort().map((k) => [k, `${ITEMS[k].name} (${k})`]))}</select></div>
      <div class="row">Count <input id="dv-ic" type="number" min="1" value="1" style="width:50px"><button data-a="give">Give</button></div>`;
    } else if (t === 'snaps') {
      const s = readSnaps();
      body = `<div class="row"><input id="dv-sn" placeholder="name e.g. before B3 boss"><button data-a="snap">Save snapshot</button></div>
      ${Object.keys(s).map((n) => `<div class="row"><b style="flex:1">${n}</b><button data-a="sload" data-v="${n}">Load</button><button data-a="sdel" data-v="${n}">✕</button></div>`).join('') || '<div>No snapshots yet.</div>'}`;
    } else if (t === 'tests') {
      body = `<div>Runs on THIS game (it changes your state: use a snapshot first). Slow ones freeze the page for a while.</div>
      ${TESTS.map(([n], i) => `<div class="row"><button data-a="test" data-v="${i}">${n}</button></div>`).join('')}`;
    }
    this.el.innerHTML = `<h3>DEV PANEL <span style="color:#aaa;font-weight:normal">[F4]</span></h3><div class="tabs">${tabs}</div>${body}
      ${this.result ? `<div class="res">${this.result}</div>` : ''}`;
  }
  msg(text) { this.result = text; this.game.ui.toast(text.split('\n')[0], 1.5); }
  async act(a, v) {
    const g = this.game, p = g.player;
    try {
      if (a === 'tab') { this.tab = v; this.result = ''; }
      else if (a === 'level') { p.setLevel(Math.max(1, Math.min(50, +this.val('dv-lv') || 1))); p.hp = p.maxHp; this.msg(`Level ${p.level}`); }
      else if (a === 'gold') { p.addGold(1000); this.msg('+1000 gold'); }
      else if (a === 'diamonds') { const E = g.online && g.online.econ; if (E) E.why('dev', 'diamonds', () => p.addDiamonds(PREMIUM.devGrant)); else p.addDiamonds(PREMIUM.devGrant); this.msg(`+${PREMIUM.devGrant} diamonds (online: only a dev-login server keeps them)`); }
      else if (a === 'heal') { p.hp = p.maxHp; this.msg('Healed'); }
      else if (a === 'god') this.god = !this.god;
      else if (a === 'unlock') SKILL_TREE.unlockAll = !SKILL_TREE.unlockAll;
      else if (a === 'cls') { const r = g.changeClass(this.val('dv-cls'), { force: true }); this.msg(r.ok ? 'Class changed' : `Failed: ${r.reason || r.error || 'refused'}`); }
      else if (a === 'map') this.goMap(this.val('dv-map'));
      else if (a === 'boss') { const b = BOSSES[this.val('dv-boss')]; this.goMap(b.map, b.arena && b.arena.entry); }
      else if (a === 'down') { this.downBoss(this.val('dv-boss')); this.msg('Boss marked defeated'); }
      else if (a === 'downall') { for (const b of Object.values(BOSSES)) if (!b.planned) this.downBoss(b.id); this.msg('Every boss defeated — all roads open'); }
      else if (a === 'save') g.saveGame();
      else if (a === 'viewer') window.open('/tools/viewer.html', '_blank');
      else if (a === 'vfxlab') window.open('/tools/vfxlab.html', '_blank');
      else if (a === 'spawn') this.spawn(this.val('dv-mon'), +this.val('dv-n') || 1, this.el.querySelector('#dv-el').checked);
      else if (a === 'killall') { let n = 0; for (const m of g.world.monsters) if (!m.dead && g.world.onMap(m)) { m.hp = 0; m.onDeath(p); n++; } this.msg(`Killed ${n}`); }
      else if (a === 'ifilter') this.itemFilter = this.val('dv-if');
      else if (a === 'give') { const id = this.val('dv-item'), n = Math.max(1, +this.val('dv-ic') || 1); g.items.give(id, n); this.msg(`Gave ${n} × ${id}`); }
      else if (a === 'snap') this.snap(this.val('dv-sn').trim() || new Date().toLocaleString());
      else if (a === 'sload') this.loadSnap(v);
      else if (a === 'sdel') { const s = readSnaps(); delete s[v]; writeSnaps(s); }
      else if (a === 'test') await this.runTest(+v);
    } catch (e) { console.error(e); this.msg('Error: ' + e.message); }
    if (this.el) this.render();
  }
  goMap(id, entry) {
    const g = this.game, def = g.world.mapManager.get(id);
    if (!def) return this.msg('Unknown map ' + id);
    g.world.changeMap(id, { entry: entry || def.spawn, via: 'dev' });
    this.msg('Now on ' + def.name);
  }
  downBoss(id) { const g = this.game; g.worldProgress.defeatBoss(id); g.bosses.runKills.add(id); }
  spawn(type, n, elite) {
    const g = this.game, p = g.player;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, pos = g.world.map.findOpen(p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, 3);
      const m = new Monster(g, type, pos.x, pos.y, { elite });
      m.mapId = g.world.mapId;
      g.world.monsters.push(m);
    }
    this.msg(`Spawned ${n} × ${type}`);
  }
  snap(name) {
    const g = this.game, s = readSnaps();
    s[name] = JSON.stringify(g.save.snapshot());
    this.msg(writeSnaps(s) ? `Snapshot "${name}" saved` : 'Storage full / unavailable');
  }
  loadSnap(name) {
    const g = this.game, r = parseSave(readSnaps()[name]);
    if (!r.ok) return this.msg('Snapshot damaged: ' + r.error);
    g.ui.panels.close(true);
    g.applySave(r.data);
    g.state = 'play';
    this.msg(`Loaded "${name}" — ${g.player.cls.name} LV ${g.player.level} on ${g.world.mapId}`);
  }
  async runTest(i) {
    const [name, fn] = TESTS[i], g = this.game;
    this.msg(`Running ${name}…`); this.render();
    await new Promise((r) => setTimeout(r, 30));
    const T = await import('../../tools/testkit.js');
    const t0 = performance.now(), rows = await fn(T, g), sec = ((performance.now() - t0) / 1000).toFixed(1);
    if (Array.isArray(rows) && Array.isArray(rows[0])) {
      const pass = rows.filter((r) => r[1]).length;
      this.result = `<span class="${pass === rows.length ? 'ok' : 'bad'}">${name}: ${pass}/${rows.length} (${sec} s)</span>\n` +
        rows.map((r) => `${r[1] ? '✓' : '✗'} ${r[0]}${r[2] !== undefined && !r[1] ? ' — ' + r[2] : ''}`).join('\n');
    } else this.result = `${name} (${sec} s)\n${JSON.stringify(rows, null, 1).slice(0, 3000)}`;
  }
}

