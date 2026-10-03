// RUNE VAULTS (A3 Rune Citadel) — "the city still works". Sealed rune vaults (terrain: maps/runeCitadel.js CITADEL_VAULTS)
// hold a chest each. A vault's door opens only while ALL its rune switches burn: press [E] at a switch and it burns for
// `lit` seconds; when every switch of that vault burns, the door opens for `open` seconds — run! A door never closes on
// someone standing in the vault or the doorway (no one is ever trapped). Switches are far from their door, so the timing
// is the puzzle; a two-switch vault is a race (solo) or a team job (party).
// The closed door = map blocker on the doorway tiles (exit() / reset give them back). ONLINE: the room host owns the
// switch / door timers (netState); a guest's press goes to the host (send('press')) and the guest mirrors the doors.
//   options: { vaults: [{ id, room, door, switches: [[tx, ty]], lit, open, name }] }  (room / door from CITADEL_VAULTS)
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE } from '../../core/constants.js';
import { TAU } from '../../core/math.js';

export class RuneVaults extends MapMechanic {
  enter() {
    const w = this.world, m = w.map;
    this.vaults = (this.def.vaults || []).map((v, vi) => ({
      ...v, lit: v.lit || 12, open: v.open || 8, openT: 0, sealed: false,
      doorIdx: v.door.map(([x, y]) => m.idx(x, y)),
      sw: v.switches.map(([tx, ty], si) => ({ vi, si, t: 0, ...m.findOpen((tx + 0.5) * TILE, (ty + 0.5) * TILE, 2) })),
    }));
    this.items = [];
    for (const v of this.vaults) {
      this.seal(v, true);
      for (const s of v.sw) {
        const it = { id: `rune_switch_${v.id}_${s.si}`, kind: 'mech', x: s.x, y: s.y, radius: 40, mapId: this.mapId,
          prompt: v.sw.length > 1 ? `Light Rune Switch (${s.si + 1}/${v.sw.length})` : 'Light Rune Switch',
          available: () => s.t <= 0 && v.openT <= 0, use: () => this.send('press', { v: s.vi, s: s.si }), draw: (ctx, t) => this.drawSwitch(ctx, s, t) };
        this.items.push(it);
        w.interactables.push(it);
      }
    }
    if (!this.saved.told) this.tipT = 3;
  }
  exit() {
    const w = this.world;
    for (const v of this.vaults) this.seal(v, false);
    w.interactables = w.interactables.filter((it) => !this.items.includes(it));
  }
  reset() { if (!this.authority) return; for (const v of this.vaults) { v.openT = 0; for (const s of v.sw) s.t = 0; this.seal(v, true); } this.markNet(); }

  tourOpen() { for (const v of this.vaults) this.seal(v, false); }
  // the doorway's tiles blocked (closed) or free (open) — counted blockers, so other systems' blocks stay
  seal(v, on) {
    if (v.sealed === on) return;
    const b = this.world.map.blocker;
    for (const i of v.doorIdx) b[i] = Math.max(0, b[i] + (on ? 1 : -1));
    v.sealed = on;
    if (this.world.map.chunkCache) this.world.map.chunkCache.clear();
  }
  inside(v, e) {
    const [x0, y0, x1, y1] = v.room, tx = e.x / TILE, ty = e.y / TILE;
    if (tx >= x0 && tx < x1 + 1 && ty >= y0 && ty < y1 + 1) return true;
    return v.door.some(([x, y]) => Math.abs(tx - (x + 0.5)) < 1.2 && Math.abs(ty - (y + 0.5)) < 1.2);
  }

  netEvent(kind, d) {
    if (kind !== 'press' || !d) return;
    const v = this.vaults[d.v], s = v && v.sw[d.s];
    if (!s || s.t > 0 || v.openT > 0) return;
    s.t = v.lit;
    this.game.audio.sfx('shrine', s);
    this.game.vfx.ring(s.x, s.y, 6, 60, { life: 0.5, color: '140,200,255', width: 3 });
    if (v.sw.every((x) => x.t > 0)) this.openDoor(v);
    else if (v.sw.length > 1) this.game.ui.toast(`Rune switch lit — ${v.sw.filter((x) => x.t > 0).length}/${v.sw.length}. Light the other one!`, 2.5);
    else this.markNet();
    this.markNet();
  }
  openDoor(v) {
    v.openT = v.open;
    for (const s of v.sw) s.t = 0;
    this.seal(v, false);
    const [x, y] = v.door[1];
    this.game.ui.toast(`${v.name || 'A rune vault'} opens — ${v.open} s!`, 2.5);
    this.game.audio.sfx('gate', { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
    this.markNet();
  }

  update(dt) {
    if (this.tipT > 0 && (this.tipT -= dt) <= 0) { this.saved.told = true; this.game.ui.toast('Rune switches still answer in this city — their vaults open only for a moment', 4); }
    if (!this.authority) { for (const v of this.vaults) { if (v.openT > 0) v.openT -= dt; for (const s of v.sw) if (s.t > 0) s.t -= dt; } return; }
    const who = this.game.combatants();
    for (const v of this.vaults) {
      for (const s of v.sw) if (s.t > 0 && (s.t -= dt) <= 0) { s.t = 0; this.markNet(); }
      if (v.openT > 0) {
        v.openT -= dt;
        if (v.openT <= 0) {
          if (who.some((q) => !q.dead && this.inside(v, q))) v.openT = 0.25; // someone inside: hold the door
          else { v.openT = 0; this.seal(v, true); this.game.audio.sfx('rubble', { x: (v.door[1][0] + 0.5) * TILE, y: (v.door[1][1] + 0.5) * TILE }); this.markNet(); }
        }
      }
    }
  }

  // ---- online
  netState() { return { v: this.vaults.map((v) => [Math.round(v.openT * 10) / 10, ...v.sw.map((s) => Math.round(s.t * 10) / 10)]) }; }
  netApply(st) {
    (st.v || []).forEach((row, i) => {
      const v = this.vaults[i];
      if (!v || !Array.isArray(row)) return;
      v.openT = +row[0] || 0;
      v.sw.forEach((s, k) => { s.t = +row[k + 1] || 0; });
      this.seal(v, !(v.openT > 0));
    });
  }

  // ---- drawing
  drawSwitch(ctx, s, t) {
    const on = s.t > 0, glow = on ? 0.6 + 0.4 * Math.sin(t * 8) : 0.25 + 0.1 * Math.sin(t * 2 + s.x);
    ctx.fillStyle = '#3a3e4a'; ctx.fillRect(s.x - 7, s.y - 22, 14, 22);
    ctx.fillStyle = '#5a6070'; ctx.fillRect(s.x - 9, s.y - 2, 18, 4); ctx.fillRect(s.x - 8, s.y - 25, 16, 4);
    ctx.fillStyle = `rgba(140,200,255,${glow})`;
    ctx.fillRect(s.x - 2, s.y - 19, 4, 4); ctx.fillRect(s.x - 4, s.y - 13, 8, 2); ctx.fillRect(s.x - 1, s.y - 11, 2, 6);
    if (on) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,190,255,${0.25 * glow})`; ctx.beginPath(); ctx.ellipse(s.x, s.y - 12, 16, 20, 0, 0, TAU); ctx.fill();
      ctx.restore();
      const v = this.vaults[s.vi], k = s.t / v.lit; // the burn time left, as a ring
      ctx.strokeStyle = 'rgba(160,215,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y - 34, 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); ctx.lineWidth = 1;
    }
  }
  drawAbove(ctx, t) {
    for (const v of this.vaults) {
      const open = v.openT > 0;
      for (const [x, y] of v.door) {
        const px = x * TILE, py = y * TILE;
        if (!open) { // a portcullis of rune light
          ctx.fillStyle = 'rgba(20,24,36,0.85)'; ctx.fillRect(px, py - 10, TILE, TILE + 10);
          ctx.fillStyle = `rgba(120,190,255,${0.55 + 0.25 * Math.sin(t * 3 + x)})`;
          for (let k = 3; k < TILE; k += 7) ctx.fillRect(px + k, py - 8, 2, TILE + 6);
          ctx.fillRect(px, py - 10, TILE, 2);
        } else if (v.openT < 3 && Math.sin(t * 14) > 0) { // closing soon: the frame flickers
          ctx.strokeStyle = 'rgba(255,200,120,0.8)'; ctx.strokeRect(px + 1, py - 9, TILE - 2, TILE + 8);
        }
      }
    }
  }
  hudTags() {
    const out = [];
    for (const v of this.vaults) {
      if (v.openT > 0) out.push({ label: `◈ ${v.name || 'Vault'} OPEN ${Math.ceil(v.openT)}s`, color: v.openT < 3 ? '#ffc070' : '#9ad0ff' });
      else if (v.sw.length > 1 && v.sw.some((s) => s.t > 0)) out.push({ label: `◈ ${v.name || 'Vault'} ${v.sw.filter((s) => s.t > 0).length}/${v.sw.length} lit · ${Math.ceil(Math.max(...v.sw.map((s) => s.t)))}s`, color: '#9ad0ff' });
    }
    return out;
  }
}
registerMapMechanic('rune_vaults', RuneVaults);
