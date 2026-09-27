import { MONSTERS } from '../monsters/monsterTypes.js';
import { icon } from './icons.js';
import { TILE, T, Z } from '../core/constants.js';
import { clamp, TAU, easeOutCubic } from '../core/math.js';
import { makeCanvas } from '../core/assets.js';
import { RARITY_COLOR } from '../items/items.js';
import { RESOURCES } from '../data/resources.js';
import { MARKS } from '../data/marks.js';
import { STATUSES } from '../data/statuses.js';
import { REQUIREMENTS } from '../combat/skillSystem.js';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const TITLE = 'Georgia, "Times New Roman", serif';

const MINI_COLORS = {
  [T.GRASS]: '#3b6b33', [T.FLOWERS]: '#4a7a3a', [T.FOREST_FLOOR]: '#2a4a30', [T.DIRT]: '#6e5138', [T.COBBLE]: '#7c808a',
  [T.RUIN]: '#4f5664', [T.MOSS_STONE]: '#44574a', [T.ARENA]: '#5a6476', [T.WATER]: '#215a80', [T.DEEP_WATER]: '#133452',
  [T.SHALLOW]: '#357a8c', [T.BRIDGE]: '#9a7550', [T.SAND]: '#7b7050', [T.CORRUPT]: '#3a2450', [T.CAVE]: '#3a3149',
  [T.VALLEY]: '#6a8a48', [T.CANOPY]: '#10201a', [T.CLIFF]: '#2a2a30', [T.RUIN_WALL]: '#22252e', [T.CAVE_WALL]: '#16121e',
  [T.BUILDING]: '#8a5a3a', [T.STAIRS]: '#5e6676', [T.VOID]: '#05040a',
};

const LANDMARKS = [
  ['Elder Tree', 18, 73], ['Stone Circle', 66, 62], ['Crystal Glade', 77, 121], ['Silverfall', 6, 98], ['River Crossing', 50, 98],
  ['Abandoned Camp', 20, 132], ['Ancient Shrine', 136, 69], ['Guardian Gate', 136, 57], ['Ruin Courtyard', 136, 99], ['Ancient Valley', 36, 6],
];

export class HUD {
  constructor(game) {
    this.game = game;
    this.banners = [];
    this.toasts = [];
    this.notes = [];
    this.pickups = [];
    this.callouts = [];
    this.bossBar = false;
    this.bossBarShow = 0;
    this.bossHpLag = 1;
    this.hpLag = 1;
    this.title = null;
    this.mini = null;
    this.miniT = 0;
  }

  // clear every transient message (new game / load must not show the previous session's banners)
  reset() {
    this.banners = []; this.toasts = []; this.notes = []; this.pickups = []; this.callouts = [];
    this.title = null; this.bossBar = false; this.bossBarShow = 0; this.bossHpLag = 1; this.hpLag = 1;
  }

  // ---------------- messages
  banner(title, sub, color = '#e8d0ff', dur = 3) { this.banners.push({ title, sub, color, t: 0, dur, kind: 'banner' }); }
  zone(name, sub, big) { this.banners.push({ title: name, sub, color: '#f0e6ff', t: 0, dur: big ? 4 : 2.6, kind: big ? 'zone' : 'zoneSmall' }); }
  sub(name) { this.notes.push({ title: 'DISCOVERED', text: name, color: '#ffe0a0', t: 0, dur: 3.5 }); }
  callout(title, sub, color) { this.callouts = [{ title, sub, color, t: 0, dur: 2 }]; }
  bossTitle(title, sub) { this.title = { title, sub, t: 0, dur: 3.2 }; }
  toast(text, dur = 1.2) { if (this.toasts.some((x) => x.text === text)) return; this.toasts.push({ text, t: 0, dur }); }
  notify(title, text, color = '#c8b8ff') { this.notes.push({ title, text, color, t: 0, dur: 4 }); if (this.notes.length > 5) this.notes.shift(); }
  pickup(def, n) {
    const ex = this.pickups.find((p) => p.name === def.name && p.t < 2);
    if (ex) { ex.n += n; ex.t = 0; return; }
    this.pickups.push({ name: def.name, color: def.color || '#fff', icon: def.icon, rarity: def.rarity, n, t: 0 });
    if (this.pickups.length > 6) this.pickups.shift();
  }

  update(dt) {
    const tick = (arr) => { for (const b of arr) b.t += dt; return arr.filter((b) => b.t < b.dur); };
    // banners play one at a time
    if (this.banners.length) { this.banners[0].t += dt; if (this.banners[0].t > this.banners[0].dur) this.banners.shift(); }
    this.toasts = tick(this.toasts);
    this.notes = tick(this.notes);
    this.callouts = tick(this.callouts);
    for (const p of this.pickups) p.t += dt;
    this.pickups = this.pickups.filter((p) => p.t < 3.5);
    if (this.title) { this.title.t += dt; if (this.title.t > this.title.dur) this.title = null; }
    this.bossBarShow = clamp(this.bossBarShow + (this.bossBar ? dt : -dt) * 3, 0, 1);
    const p = this.game.player;
    this.hpLag += (p.hp / p.maxHp - this.hpLag) * Math.min(1, dt * 3);
    const gd = this.game.world.boss;
    if (gd) this.bossHpLag += (gd.hp / gd.maxHp - this.bossHpLag) * Math.min(1, dt * 2);
  }

  // ---------------- draw
  draw(ctx, W, H) {
    const g = this.game;
    const u = clamp(H / 880, 0.8, 2.4);
    this.u = u;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawStealth(ctx, W, H);
    this.drawNameplates(ctx, u);
    this.drawExits(ctx, u);
    g.vfx.drawScreen(ctx, (x, y) => this.toScreen(x, y), g.renderer.scale);
    this.drawPrompt(ctx, u);
    this.drawPlayerFrame(ctx, u);
    this.drawSkillBar(ctx, W, H, u);
    this.drawMinimap(ctx, W, u);
    this.drawQuests(ctx, W, u);
    this.drawBoss(ctx, W, u);
    this.drawTarget(ctx, W, u);
    this.drawPickups(ctx, H, u);
    this.drawBanners(ctx, W, H, u);
    ctx.restore();
  }

  toScreen(x, y) {
    const cam = this.game.camera, s = this.game.renderer.scale;
    return { x: Math.round((x - cam.left) * cam.zoom * s), y: Math.round((y - cam.top) * cam.zoom * s) };
  }

  text(ctx, str, x, y, size, color, { align = 'left', font = FONT, weight = 700, stroke = true, base = 'alphabetic' } = {}) {
    ctx.font = `${weight} ${Math.round(size)}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    if (stroke) { ctx.lineWidth = Math.max(2, size / 6); ctx.strokeStyle = 'rgba(6,2,14,0.9)'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  panel(ctx, x, y, w, h, alpha = 0.72) {
    ctx.fillStyle = `rgba(10,6,20,${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(150,110,220,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  bar(ctx, x, y, w, h, pct, col1, col2, lag, back = 'rgba(0,0,0,0.6)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    if (lag !== undefined && lag > pct) { ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(x, y, w * clamp(lag, 0, 1), h); }
    const gr = ctx.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, col1); gr.addColorStop(1, col2);
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w * clamp(pct, 0, 1), h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w * clamp(pct, 0, 1), Math.max(1, h * 0.3));
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  drawPlayerFrame(ctx, u) {
    const g = this.game, p = g.player;
    const x = 18 * u, y = 18 * u, ps = 78 * u;
    // portrait
    this.panel(ctx, x, y, ps, ps, 0.85);
    const f = p.sprites.frame('idle', 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 2, y + 2, ps - 4, ps - 4); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const sc = ps / 34;
    ctx.drawImage(f.img, f.sx + f.ax - 16, f.sy + f.ay - 64, 32, 34, x + 2, y + 2, 32 * sc - 4, 34 * sc - 4);
    ctx.restore();
    ctx.strokeStyle = (p.cls.theme && p.cls.theme.color) || '#8a5ad8'; ctx.lineWidth = 2 * u; ctx.strokeRect(x, y, ps, ps);
    // name + level
    const bx = x + ps + 10 * u, bw = 250 * u;
    this.text(ctx, p.cls.name, bx, y + 16 * u, 16 * u, '#efe4ff', { font: TITLE });
    this.text(ctx, `LV.${p.level}`, bx + bw, y + 16 * u, 15 * u, '#ffd96a', { align: 'right' });
    // HP
    this.text(ctx, 'HP', bx, y + 36 * u, 11 * u, '#ff9aa8');
    this.bar(ctx, bx + 26 * u, y + 25 * u, bw - 26 * u, 14 * u, p.hp / p.maxHp, '#ff5a6e', '#a01830', this.hpLag);
    this.text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, bx + bw - 4 * u, y + 36 * u, 10 * u, '#fff', { align: 'right' });
    // SHADOW
    // primary resource bar — label/colours come from resource data (works for any class)
    const rid = p.primaryResource, rdef = RESOURCES[rid];
    this.text(ctx, rdef.label, bx, y + 56 * u, 10 * u, rdef.colors[0]);
    this.bar(ctx, bx + 52 * u, y + 46 * u, bw - 52 * u, 11 * u, p.resources.ratio(rid), rdef.colors[0], rdef.colors[1]);
    this.text(ctx, `${Math.floor(p.resources.get(rid))}`, bx + bw - 4 * u, y + 56 * u, 9 * u, '#fff', { align: 'right' });
    // resource tiers (data tiers): a tick at each threshold + the active tier's name
    if (rdef.tiers) {
      const x0 = bx + 52 * u, w0 = bw - 52 * u, max = p.resources.max(rid);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const tr of rdef.tiers) ctx.fillRect(Math.round(x0 + w0 * (tr.at / max)), y + 44 * u, Math.max(1, 1.5 * u), 15 * u);
      const td = p.resources.tierDef(rid);
      if (td) this.text(ctx, td.label, x0 + 4 * u, y + 56 * u, 8 * u, `rgba(255,240,255,${0.75 + 0.25 * Math.sin(g.time * 6)})`);
    }
    // EXP (thin)
    this.bar(ctx, bx, y + 63 * u, bw, 4 * u, p.isMaxLevel ? 1 : p.exp / p.expToNext(), '#ffe08a', '#b08a20');
    // class counter (Shadow Marks / Astral Threads / ...) — the class says what to show
    const my = y + ps + 22 * u;
    const hc = p.cls.hudCounter ? p.cls.hudCounter(p) : null;
    if (hc) {
      const full = hc.value >= hc.max;
      this.panel(ctx, x, my - 16 * u, 180 * u, 40 * u, 0.75);
      this.text(ctx, hc.label, x + 8 * u, my - 2 * u, 10 * u, hc.full);
      for (let i = 0; i < hc.max; i++) {
        const on = i < hc.value;
        const cx = x + 20 * u + i * 26 * u, cy = my + 12 * u, r = 8 * u * (on && p.markPulse > 0 && i === hc.value - 1 ? 1 + p.markPulse * 0.5 : 1);
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy); ctx.closePath();
        if (on) {
          ctx.fillStyle = full ? hc.full : hc.color; ctx.fill();
          ctx.shadowColor = hc.color; ctx.shadowBlur = 10 * u; ctx.fill(); ctx.shadowBlur = 0;
        } else { ctx.fillStyle = 'rgba(20,10,34,0.6)'; ctx.fill(); }
        ctx.strokeStyle = on ? 'rgba(20,10,40,0.9)' : 'rgba(170,160,210,0.8)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
      }
      this.text(ctx, `${hc.value} / ${hc.max}`, x + 172 * u, my + 17 * u, 13 * u, full ? hc.full : '#b8b0d8', { align: 'right' });
      if (hc.ready && hc.readyText) this.text(ctx, hc.readyText, x, my + 42 * u, 11 * u, `rgba(240,220,255,${0.6 + 0.4 * Math.sin(g.time * 6)})`);
    }
    // status chips
    let sx = x;
    const chips = [];
    // any status with display data (data/statuses.js) — stacks shown as ×N
    for (const st of p.status.list()) {
      const disp = STATUSES[st.id].display;
      if (disp) chips.push([st.stacks > 1 ? `${disp.label} ×${st.stacks}` : disp.label, disp.color]);
    }
    if (p.guardState && p.guardState.active) chips.push(['GUARDING', '#ffe8a0']);
    if (g.world.state.flags.moonBlessing) chips.push(['MOON BLESSING', '#dfe8ff']);
    for (const [label, col] of chips) {
      ctx.font = `700 ${Math.round(9 * u)}px ${FONT}`;
      const w = ctx.measureText(label).width + 10 * u;
      this.panel(ctx, sx, my + 50 * u, w, 16 * u, 0.7);
      this.text(ctx, label, sx + 5 * u, my + 62 * u, 9 * u, col, { stroke: false });
      sx += w + 4 * u;
    }
  }

  // stealth: dark violet vignette around the screen edges while the player is hidden
  drawStealth(ctx, W, H) {
    const k = this.game.player.stealthK || 0;
    if (k < 0.02) return;
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
    gr.addColorStop(0, 'rgba(40,10,70,0)');
    gr.addColorStop(1, `rgba(40,10,70,${0.55 * k})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  drawSkillBar(ctx, W, H, u) {
    const g = this.game, p = g.player, cls = p.cls;
    const size = 50 * u, gap = 8 * u;
    // keys 1-5 come from the player's loadout (Skills tab), not from fixed slots in the class data
    const binds = p.loadout.bindings();
    const slots = [...binds.map((b) => ({ s: b.skill, key: b.key })), { s: cls.special, key: 'Q', special: true }, { potion: 'hp_potion', key: 'R' }, { potion: 'shadow_tonic', key: 'F' }];
    const total = slots.length * size + (slots.length - 1) * gap + 14 * u;
    let x = W / 2 - total / 2;
    const y = H - size - 22 * u;
    this.panel(ctx, x - 10 * u, y - 10 * u, total + 20 * u, size + 20 * u, 0.6);
    // dodge charges
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = i < p.dodgeCharges ? '#9af8ff' : 'rgba(80,90,110,0.7)';
      ctx.fillRect(W / 2 - 22 * u + i * 24 * u, y - 18 * u, 20 * u, 4 * u);
    }
    this.text(ctx, 'DODGE [SPACE]', W / 2, y - 22 * u, 9 * u, '#9ab8c8', { align: 'center' });
    const hc = cls.hudCounter ? cls.hudCounter(p) : null;
    if (hc && hc.ready && hc.readyText) {
      const k = 0.65 + 0.35 * Math.sin(g.time * 8);
      this.text(ctx, `◆ ◆ ◆  ${hc.readyText.replace(' — ', '  —  ')}`, W / 2, y - 42 * u, 15 * u * (0.95 + k * 0.08), `rgba(240,220,255,${k})`, { align: 'center', font: TITLE });
    }
    slots.forEach((sl, i) => {
      if (i === binds.length) x += 14 * u;
      const sx = x, sy = y;
      ctx.fillStyle = 'rgba(20,12,34,0.95)';
      ctx.fillRect(sx, sy, size, size);
      let ready = true, cdPct = 0, cdLeft = 0, label = '';
      if (sl.potion) {
        const n = g.inventory.count(sl.potion);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(icon('potion', sl.potion === 'hp_potion' ? '#e05060' : '#a060ff'), sx + 7 * u, sy + 7 * u, size - 14 * u, size - 14 * u);
        this.text(ctx, String(n), sx + size - 4 * u, sy + size - 5 * u, 12 * u, n ? '#fff' : '#888', { align: 'right' });
        ready = n > 0 && g.inventory.potionCd <= 0;
      } else {
        const s = sl.s;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(icon(s.icon), sx + 5 * u, sy + 5 * u, size - 10 * u, size - 10 * u);
        // same readiness rules as the SkillSystem: cooldown, cost and data requirements
        const reqOk = (s.requirements || []).every((r) => REQUIREMENTS[r.type] && REQUIREMENTS[r.type](p, r));
        cdLeft = p.skillSys.cooldowns.remaining(s.id);
        cdPct = cdLeft > 0.5 ? p.skillSys.cooldowns.ratio(s.id) : 0;
        ready = cdLeft <= 0 && reqOk && (!s.cost || p.resources.canAfford(p.skillSys.costResource(s), s.cost));
        if (s.cost) label = String(s.cost);
        if (sl.special && ready && (s.requirements || []).length) { ctx.strokeStyle = `rgba(230,200,255,${0.6 + 0.4 * Math.sin(g.time * 8)})`; ctx.lineWidth = 3 * u; ctx.strokeRect(sx - 1, sy - 1, size + 2, size + 2); }
      }
      if (!ready) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx, sy, size, size); }
      if (cdPct > 0) {
        ctx.fillStyle = 'rgba(10,0,30,0.6)';
        ctx.beginPath(); ctx.moveTo(sx + size / 2, sy + size / 2);
        ctx.arc(sx + size / 2, sy + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + TAU * cdPct); ctx.closePath();
        ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, size, size); ctx.clip();
        ctx.beginPath(); ctx.moveTo(sx + size / 2, sy + size / 2); ctx.arc(sx + size / 2, sy + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + TAU * cdPct); ctx.closePath(); ctx.fill();
        ctx.restore();
        this.text(ctx, cdLeft.toFixed(cdLeft < 3 ? 1 : 0), sx + size / 2, sy + size / 2 + 6 * u, 16 * u, '#fff', { align: 'center' });
      }
      ctx.strokeStyle = sl.s && sl.s.ultimate ? '#ffb040' : sl.special ? '#c080ff' : 'rgba(160,120,230,0.8)';
      ctx.lineWidth = 1.5 * u;
      ctx.strokeRect(sx + 0.5, sy + 0.5, size - 1, size - 1);
      // key binding
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(sx, sy, 15 * u, 15 * u);
      this.text(ctx, sl.key, sx + 7.5 * u, sy + 12 * u, 11 * u, '#ffe8a0', { align: 'center', stroke: false });
      if (label && !sl.special) this.text(ctx, label, sx + size - 3 * u, sy + size - 4 * u, 9 * u, p.resources.canAfford(sl.s.costResource || p.primaryResource, +label) ? '#c9a0ff' : '#ff6a6a', { align: 'right' });
      // hover tooltip
      const m = g.input.mouse, mx = m.x * g.renderer.dpr, my = m.y * g.renderer.dpr;
      if (mx > sx && mx < sx + size && my > sy && my < sy + size && sl.s) this.tooltip(ctx, sx, sy - 8 * u, sl.s, u);
      x += size + gap;
    });
  }

  tooltip(ctx, x, y, s, u) {
    const w = 280 * u;
    const lines = wrap(ctx, s.desc, w - 16 * u, `500 ${Math.round(11 * u)}px ${FONT}`);
    const h = (40 + lines.length * 15) * u;
    this.panel(ctx, x, y - h, w, h, 0.95);
    this.text(ctx, s.name, x + 8 * u, y - h + 18 * u, 13 * u, '#f0e0ff');
    if (s.cooldown > 1) this.text(ctx, `CD ${s.cooldown}s · ${s.cost} ${RESOURCES[s.costResource || this.game.player.primaryResource].label}`, x + w - 8 * u, y - h + 18 * u, 10 * u, '#b8a0d8', { align: 'right' });
    lines.forEach((l, i) => this.text(ctx, l, x + 8 * u, y - h + (36 + i * 15) * u, 11 * u, '#d8d0e8', { weight: 500, stroke: false }));
  }

  // ---------------- minimap
  refreshMini() {
    const map = this.game.world.map;
    if (!this.mini) { this.mini = makeCanvas(map.w, map.h); this.miniData = this.mini.getContext('2d').createImageData(map.w, map.h); }
    const d = this.miniData.data;
    const cache = this.colCache || (this.colCache = {});
    for (let i = 0; i < map.w * map.h; i++) {
      const o = i * 4;
      if (!map.revealed[i] || (map.activeArea && map.area[i] && map.area[i] !== map.activeArea)) { d[o + 3] = 0; continue; } // other maps hidden
      let t = map.revealed[i] === 2 ? T.CANOPY : map.tiles[i];
      if (t === T.CORRUPT && map.style.restored) t = T.FOREST_FLOOR;
      const hx = MINI_COLORS[t] || '#222';
      let c = cache[hx];
      if (!c) c = cache[hx] = [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
      const blocked = map.blocker[i] > 0 && t !== T.CANOPY;
      d[o] = blocked ? c[0] * 0.6 : c[0]; d[o + 1] = blocked ? c[1] * 0.6 : c[1]; d[o + 2] = blocked ? c[2] * 0.6 : c[2]; d[o + 3] = 255;
    }
    this.mini.getContext('2d').putImageData(this.miniData, 0, 0);
  }

  markers() {
    const g = this.game, w = g.world, f = w.state.flags, out = [];
    for (const n of w.npcs) if (w.onMap(n) && (!n.secret || w.map.secretsFound.has(n.secret))) out.push({ x: n.x, y: n.y, c: n.hasNews() ? '#ffd24a' : '#8adfff', r: 1.3 });
    for (const it of w.interactables) {
      if (!w.onMap(it)) continue;
      if (it.kind === 'waystone' && w.state.waystones[it.id]) out.push({ x: it.x, y: it.y, c: '#5af0ff', r: 1.8, diamond: true });
      if (it.kind === 'chest' && !w.state.chests[it.id] && w.map.revealed[w.map.idx(Math.floor(it.x / TILE), Math.floor(it.y / TILE))] && (!it.secret || w.map.secretsFound.has(it.secret))) out.push({ x: it.x, y: it.y, c: '#ffc050', r: 1.2 });
    }
    // landmarks appear once their area has been discovered
    for (const [name, lx, ly] of LANDMARKS) if (w.state.subs[name]) out.push({ x: lx * TILE, y: ly * TILE, c: '#f0e6c8', r: 1.1, diamond: true });
    if (w.guardian && f.guardianDiscovered && !f.guardianDefeated && w.onMap(w.guardian)) out.push({ x: w.guardian.home.x, y: w.guardian.home.y, c: '#ff4060', r: 3, boss: true });
    const q = this.questTarget();
    if (q) out.push({ x: q.x, y: q.y, c: '#ffe070', r: 2.4, quest: true });
    return out;
  }

  questTarget() {
    // read from the Quest System (objective markers are quest data); a goal on another map points at the exit
    // that leads toward it (world/mapManager.js nextExit)
    const g = this.game, w = g.world, t = g.quests.target();
    if (!t) return null;
    let pos = null;
    if (t.npc) { const n = w.npcs.find((x) => x.id === t.npc); pos = n ? { x: n.x, y: n.y } : null; } else pos = { x: t.tx * TILE, y: t.ty * TILE };
    if (!pos) return null;
    const goal = w.mapManager.idAt(pos.x, pos.y);
    if (goal && w.mapId && goal !== w.mapId) { const e = w.mapManager.nextExit(w.mapId, goal); if (e) return w.mapManager.exitCenter(e); }
    return pos;
  }

  drawMinimap(ctx, W, u) {
    const g = this.game, p = g.player, map = g.world.map;
    this.miniT -= 1 / 60;
    if (!this.mini || this.miniT <= 0) { this.miniT = 0.4; this.refreshMini(); }
    const size = 190 * u, x = W - size - 18 * u, y = 18 * u;
    const zoomTiles = 56, scale = size / zoomTiles;
    const ptx = p.x / TILE, pty = p.y / TILE;
    ctx.save();
    this.panel(ctx, x - 4 * u, y - 4 * u, size + 8 * u, size + 8 * u, 0.9);
    ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.fillStyle = '#07060c'; ctx.fillRect(x, y, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mini, ptx - zoomTiles / 2, pty - zoomTiles / 2, zoomTiles, zoomTiles, x, y, size, size);
    const toM = (wx, wy) => ({ x: x + (wx / TILE - ptx + zoomTiles / 2) * scale, y: y + (wy / TILE - pty + zoomTiles / 2) * scale });
    for (const m of this.markers()) {
      let s = toM(m.x, m.y);
      const inside = s.x > x && s.x < x + size && s.y > y && s.y < y + size;
      if (!inside && !m.quest && !m.boss) continue;
      if (!inside) { s = { x: clamp(s.x, x + 6 * u, x + size - 6 * u), y: clamp(s.y, y + 6 * u, y + size - 6 * u) }; }
      ctx.fillStyle = m.c;
      const r = m.r * 2.4 * u;
      if (m.diamond || m.quest) { ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.fill(); }
      else if (m.boss) { ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#200'; ctx.fillRect(s.x - r * 0.4, s.y - r * 0.3, r * 0.3, r * 0.3); ctx.fillRect(s.x + r * 0.1, s.y - r * 0.3, r * 0.3, r * 0.3); }
      else { ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill(); }
    }
    // player arrow
    const cx = x + size / 2, cy = y + size / 2, a = p.facing;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 7 * u, cy + Math.sin(a) * 7 * u);
    ctx.lineTo(cx + Math.cos(a + 2.5) * 5 * u, cy + Math.sin(a + 2.5) * 5 * u);
    ctx.lineTo(cx + Math.cos(a - 2.5) * 5 * u, cy + Math.sin(a - 2.5) * 5 * u);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#8a5ad8'; ctx.lineWidth = 2 * u; ctx.strokeRect(x, y, size, size);
    // zone label
    const sa = g.world.currentSub;
    this.text(ctx, sa ? sa.name : '', x + size / 2, y + size + 18 * u, 12 * u, '#e8dcff', { align: 'center' });
    this.text(ctx, '[M] Map   [I] Inventory', x + size / 2, y + size + 33 * u, 9 * u, '#8a80a8', { align: 'center' });
  }

  drawQuests(ctx, W, u) {
    const g = this.game;
    const list = g.quests.tracker();
    let y = 18 * u + 190 * u + 56 * u;
    const w = 250 * u, x = W - w - 18 * u;
    for (const q of list) {
      const h = (28 + q.lines.length * 17) * u;
      this.panel(ctx, x, y, w, h, 0.6);
      this.text(ctx, q.title, x + 10 * u, y + 18 * u, 12 * u, q.side ? '#9ad8ff' : '#ffd98a', { font: TITLE });
      q.lines.forEach((l, i) => {
        const ly = y + (36 + i * 17) * u;
        this.text(ctx, l.done ? '✓' : '○', x + 12 * u, ly, 11 * u, l.done ? '#8af0a0' : '#a8a0c0');
        this.text(ctx, l.text, x + 28 * u, ly, 11 * u, l.done ? '#7a9a80' : '#e8e0f8', { weight: 500 });
      });
      y += h + 8 * u;
    }
    // notifications under the tracker
    for (const n of this.notes) {
      const a = n.t < 0.3 ? n.t / 0.3 : n.t > n.dur - 0.5 ? (n.dur - n.t) / 0.5 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      this.panel(ctx, x, y, w, 36 * u, 0.75);
      this.text(ctx, n.title, x + 10 * u, y + 14 * u, 9 * u, n.color);
      this.text(ctx, n.text, x + 10 * u, y + 29 * u, 11 * u, '#f0eaff', { weight: 500 });
      ctx.globalAlpha = 1;
      y += 42 * u;
    }
  }

  // current target (combat/targetSystem.js): marker over it + a small frame at the top (hidden when the boss bar shows it)
  drawTarget(ctx, W, u) {
    const g = this.game, t = g.targets && g.targets.current;
    if (!t) return;
    const kn = g.knowledge;
    const isMon = t.type && MONSTERS[t.type] && t !== g.world.guardian;
    const name = isMon ? (kn.known(t.type) ? `${t.corrupted ? 'Corrupted ' : ''}${t.name}` : kn.nameFor(t.type)) : t.name || (t.def && t.def.name) || 'Target';
    const lvl = t.type && MONSTERS[t.type] ? (kn.levelFor(t.type) === '??' ? '??' : t.level || MONSTERS[t.type].level) : null;
    // marker above the head
    const s = this.toScreen(t.x, t.y - (t.height || 30) * (t.scale || 1) - 26);
    const bob = Math.sin(g.time * 6) * 2 * u;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.moveTo(s.x - 6 * u, s.y - 10 * u + bob); ctx.lineTo(s.x + 6 * u, s.y - 10 * u + bob); ctx.lineTo(s.x, s.y - 2 * u + bob); ctx.closePath(); ctx.fill();
    if (t === g.world.boss && this.bossBarShow > 0) return;
    const w = Math.min(W * 0.3, 320 * u), x = W / 2 - w / 2, y = 22 * u;
    ctx.fillStyle = 'rgba(10,6,20,0.7)'; ctx.fillRect(x - 8 * u, y - 16 * u, w + 16 * u, 40 * u);
    this.text(ctx, lvl ? `${name}  Lv.${lvl}` : name, W / 2, y, 13 * u, '#f0e8e0', { align: 'center' });
    this.bar(ctx, x, y + 6 * u, w, 10 * u, t.hp / t.maxHp, '#ff6070', '#901828');
    this.text(ctx, `${Math.ceil(t.hp)} / ${Math.ceil(t.maxHp)}`, W / 2, y + 15 * u, 9 * u, '#fff', { align: 'center' });
  }

  // BOSS UI — presentation only: draws the boss's hudState() snapshot (boss logic never draws its own bar)
  drawBoss(ctx, W, u) {
    const gd = this.game.world.boss;
    if (!gd || !gd.hudState || this.bossBarShow <= 0) return;
    const b = gd.hudState();
    ctx.globalAlpha = this.bossBarShow;
    const w = Math.min(W * 0.46, 720 * u), x = W / 2 - w / 2, y = 26 * u;
    this.text(ctx, b.name, W / 2, y, 20 * u, b.titleColor, { align: 'center', font: TITLE });
    const pct = b.hp / b.maxHp;
    this.bar(ctx, x, y + 10 * u, w, 18 * u, pct, b.color[0], b.color[1], this.bossHpLag);
    ctx.fillStyle = '#fff';
    for (const t of b.phaseMarks || []) ctx.fillRect(x + w * t - 1, y + 8 * u, 2, 22 * u);
    this.text(ctx, `${Math.round(pct * 100)}%`, x + w - 6 * u, y + 24 * u, 12 * u, '#fff', { align: 'right' });
    this.text(ctx, b.phaseLabel || '', x + 6 * u, y + 24 * u, 11 * u, '#fff');
    if (b.meter) this.bar(ctx, x + w * 0.25, y + 32 * u, w * 0.5, 5 * u, b.meter.pct, b.meter.color[0], b.meter.color[1]);
    (b.tags || []).forEach((tg, i) => this.text(ctx, tg.label, W / 2 + (i - ((b.tags.length - 1) / 2)) * 150 * u, y + 52 * u, 12 * u, tg.color, { align: 'center' }));
    const weak = (b.tags || []).some((tg) => tg.label === 'CORE EXPOSED');
    // off-screen indicator
    const s = this.toScreen(gd.x, gd.y - 40), cw = this.game.canvas.width, ch = this.game.canvas.height;
    if (s.x < 0 || s.y < 0 || s.x > cw || s.y > ch) {
      const cx = cw / 2, cy = ch / 2, a = Math.atan2(s.y - cy, s.x - cx);
      const ex = clamp(cx + Math.cos(a) * cw, 40 * u, cw - 40 * u), ey = clamp(cy + Math.sin(a) * ch, 90 * u, ch - 90 * u);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = gd.phase === 3 ? '#e070ff' : '#ff5060';
      ctx.beginPath(); ctx.moveTo(16 * u, 0); ctx.lineTo(-8 * u, -11 * u); ctx.lineTo(-8 * u, 11 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (weak) this.text(ctx, 'WEAK WINDOW', W / 2, y + 70 * u, 13 * u, `rgba(150,250,255,${0.7 + 0.3 * Math.sin(this.game.time * 12)})`, { align: 'center' });
    ctx.globalAlpha = 1;
  }

  drawPickups(ctx, H, u) {
    let y = H - 120 * u;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const a = p.t > 2.8 ? (3.5 - p.t) / 0.7 : Math.min(1, p.t * 5);
      ctx.globalAlpha = clamp(a, 0, 1);
      const x = 18 * u + (1 - Math.min(1, p.t * 6)) * -40 * u;
      this.panel(ctx, x, y - 22 * u, 220 * u, 26 * u, 0.7);
      if (p.icon) { ctx.imageSmoothingEnabled = true; ctx.drawImage(icon(p.icon, p.color), x + 4 * u, y - 20 * u, 22 * u, 22 * u); }
      this.text(ctx, `${p.name}  ×${p.n}`, x + 32 * u, y - 4 * u, 12 * u, RARITY_COLOR[p.rarity] || p.color);
      y -= 30 * u;
    }
    ctx.globalAlpha = 1;
  }

  drawPrompt(ctx, u) {
    const g = this.game, it = g.world.nearest;
    if (!it || g.ui.panelOpen) return;
    const s = this.toScreen(it.x, it.y - 50);
    ctx.font = `700 ${Math.round(12 * u)}px ${FONT}`;
    const label = `[E]  ${it.promptText}`;
    const w = ctx.measureText(label).width + 20 * u;
    this.panel(ctx, s.x - w / 2, s.y - 22 * u, w, 26 * u, 0.85);
    this.text(ctx, label, s.x, s.y - 5 * u, 12 * u, '#ffe8a0', { align: 'center', stroke: false });
  }

  // generic marks (any class, any entity) read from the MarkSystem; colours come from data/marks.js
  drawMarks(ctx, u, entity, x, y) {
    const list = this.game.marks ? this.game.marks.list(entity) : [];
    list.forEach((mk, i) => {
      const disp = (MARKS[mk.id] && MARKS[mk.id].display) || {};
      const col = mk.stacks >= mk.maxStacks ? disp.full || disp.color : disp.color;
      this.text(ctx, '◆'.repeat(mk.stacks) + '◇'.repeat(Math.max(0, mk.maxStacks - mk.stacks)), x, y + i * 12 * u, 10 * u, col || '#c080ff', { align: 'center' });
    });
  }

  // short labels for debuffs on enemies (vulnerable has its own big label)
  drawStatuses(ctx, u, entity, x, y) {
    const parts = [];
    for (const st of entity.status.list()) {
      const disp = STATUSES[st.id].display;
      if (disp && !STATUSES[st.id].vulnerable) parts.push([st.stacks > 1 ? `${disp.label}×${st.stacks}` : disp.label, disp.color]);
    }
    parts.forEach(([label, col], i) => this.text(ctx, label, x + (i - (parts.length - 1) / 2) * 52 * u, y, 8 * u, col, { align: 'center' }));
  }

  // exit signs: where each open exit of the current map leads (sealed ones stay unmarked)
  drawExits(ctx, u) {
    const g = this.game, w = g.world, def = w.mapDef;
    if (!def) return;
    const cw = g.canvas.width, ch = g.canvas.height;
    for (const e of def.exits) {
      const c = w.mapManager.exitCenter(e), s = this.toScreen(c.x, c.y);
      if (s.x < -80 || s.y < -40 || s.x > cw + 80 || s.y > ch + 40) continue;
      if (!w.transitions.isOpen(e)) continue;
      const to = w.mapManager.get(e.to);
      const bob = Math.sin(g.time * 3) * 2 * u;
      const dx = e.entry[0] * TILE - c.x, dy = e.entry[1] * TILE - c.y; // the way the exit leads
      const arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '▶' : '◀') : dy > 0 ? '▼' : '▲';
      this.text(ctx, arrow, s.x, s.y - 14 * u + bob, 11 * u, '#ffd98a', { align: 'center' });
      this.text(ctx, to ? to.name : e.label, s.x, s.y, 9 * u, '#f0e0b0', { align: 'center' });
    }
  }

  drawNameplates(ctx, u) {
    const g = this.game, kn = g.knowledge, p = g.player;
    for (const m of g.world.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > 260 && m.showBar <= 0) continue;
      const s = this.toScreen(m.x, m.y - m.height * (m.scale || 1) - 8);
      const w = 64 * u * (m.def.miniBoss ? 1.6 : m.elite ? 1.3 : 1);
      const name = kn.known(m.type) ? m.name : kn.nameFor(m.type), lvl = kn.levelFor(m.type) === '??' ? '??' : m.level;
      const col = !kn.known(m.type) ? '#b0a8c0' : m.elite ? '#ffc860' : m.corrupted ? '#e0a0ff' : m.def.miniBoss ? '#ffb080' : '#f0e8e0';
      this.text(ctx, `${m.corrupted && kn.known(m.type) ? 'Corrupted ' : ''}${name}  Lv.${lvl}`, s.x, s.y - 8 * u, 10 * u, col, { align: 'center' });
      if (m.hp < m.maxHp || m.showBar > 0) {
        this.bar(ctx, s.x - w / 2, s.y - 4 * u, w, 5 * u, m.hp / m.maxHp, '#ff6070', '#901828');
        if (m.maxArmor) this.bar(ctx, s.x - w / 2, s.y + 2 * u, w, 3 * u, m.armor / m.maxArmor, '#9af8ff', '#3a90b0');
      }
      if (m.status.has('vulnerable')) this.text(ctx, 'VULNERABLE', s.x, s.y - 22 * u, 9 * u, '#9af8ff', { align: 'center' });
      this.drawMarks(ctx, u, m, s.x, s.y + 14 * u);
      this.drawStatuses(ctx, u, m, s.x, s.y - 34 * u);
    }
    for (const n of g.world.npcs) {
      if (n.secret && !g.world.map.secretsFound.has(n.secret)) continue;
      if (Math.hypot(n.x - p.x, n.y - p.y) > 180) continue;
      const s = this.toScreen(n.x, n.y - 50);
      this.text(ctx, n.name, s.x, s.y - 12 * u, 11 * u, '#bfe8ff', { align: 'center' });
      this.text(ctx, n.role, s.x, s.y, 9 * u, '#8aa8c0', { align: 'center' });
    }
    for (const d of g.world.dummies) {
      if (Math.hypot(d.x - p.x, d.y - p.y) > 260) continue;
      const s = this.toScreen(d.x, d.y - d.height - 10);
      this.text(ctx, d.name, s.x, s.y - 20 * u, 10 * u, '#e8dcc0', { align: 'center' });
      if (!d.dead) this.bar(ctx, s.x - 34 * u, s.y - 14 * u, 68 * u, 5 * u, d.hp / d.maxHp, '#ffb070', '#905020');
      if (d.dps) this.text(ctx, `DPS ${d.dps}`, s.x, s.y + 2 * u, 10 * u, '#ffd96a', { align: 'center' });
      this.drawMarks(ctx, u, d, s.x, s.y + 16 * u);
      this.drawStatuses(ctx, u, d, s.x, s.y - 32 * u);
    }
    for (const b of g.world.breakables) {
      if (b.dead || b.hp >= b.maxHp) continue;
      const s = this.toScreen(b.x, b.y - b.height - 6);
      this.bar(ctx, s.x - 30 * u, s.y, 60 * u, 5 * u, b.hp / b.maxHp, '#e0c0a0', '#806040');
    }
  }

  drawBanners(ctx, W, H, u) {
    const g = this.game;
    const b = this.banners[0];
    if (b) {
      const a = b.t < 0.4 ? b.t / 0.4 : b.t > b.dur - 0.6 ? (b.dur - b.t) / 0.6 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      const y = H * 0.24;
      if (b.kind === 'zone') {
        const gr = ctx.createLinearGradient(W / 2 - 400 * u, 0, W / 2 + 400 * u, 0);
        gr.addColorStop(0, 'rgba(10,4,24,0)'); gr.addColorStop(0.5, 'rgba(10,4,24,0.75)'); gr.addColorStop(1, 'rgba(10,4,24,0)');
        ctx.fillStyle = gr; ctx.fillRect(W / 2 - 400 * u, y - 50 * u, 800 * u, 90 * u);
        const sp = easeOutCubic(Math.min(1, b.t / 0.8));
        ctx.fillStyle = '#b080ff'; ctx.fillRect(W / 2 - 260 * u * sp, y + 12 * u, 520 * u * sp, 1.5 * u);
        this.text(ctx, b.title, W / 2, y, 38 * u, b.color, { align: 'center', font: TITLE });
        this.text(ctx, b.sub, W / 2, y + 34 * u, 14 * u, '#bfb0e0', { align: 'center', weight: 500 });
      } else {
        this.text(ctx, b.title, W / 2, y, (b.kind === 'zoneSmall' ? 24 : 30) * u, b.color, { align: 'center', font: TITLE });
        if (b.sub) this.text(ctx, b.sub, W / 2, y + 26 * u, 13 * u, '#d8d0f0', { align: 'center', weight: 500 });
      }
      ctx.globalAlpha = 1;
    }
    for (const c of this.callouts) {
      const a = c.t < 0.15 ? c.t / 0.15 : c.t > c.dur - 0.4 ? (c.dur - c.t) / 0.4 : 1;
      const s = 1 + Math.max(0, 0.3 - c.t) * 1.5;
      ctx.globalAlpha = clamp(a, 0, 1);
      this.text(ctx, c.title, W / 2, H * 0.36, 34 * u * s, c.color, { align: 'center', font: TITLE });
      if (c.sub) this.text(ctx, c.sub, W / 2, H * 0.36 + 28 * u, 13 * u, '#e8e0ff', { align: 'center', weight: 500 });
      ctx.globalAlpha = 1;
    }
    if (this.title) {
      const t = this.title, a = t.t < 0.6 ? t.t / 0.6 : t.t > t.dur - 0.8 ? (t.dur - t.t) / 0.8 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H * 0.62, W, 90 * u);
      this.text(ctx, t.title, W / 2, H * 0.62 + 46 * u, 36 * u, '#dffcff', { align: 'center', font: TITLE });
      this.text(ctx, t.sub, W / 2, H * 0.62 + 72 * u, 13 * u, '#9ad8e8', { align: 'center', weight: 500 });
      ctx.globalAlpha = 1;
    }
    let ty = H * 0.72;
    for (const t of this.toasts) {
      ctx.globalAlpha = clamp(t.dur - t.t, 0, 1);
      this.text(ctx, t.text, W / 2, ty, 13 * u, '#ffd0d0', { align: 'center' });
      ty -= 20 * u;
    }
    ctx.globalAlpha = 1;
  }
}

export function wrap(ctx, text, maxW, font) {
  ctx.font = font;
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
