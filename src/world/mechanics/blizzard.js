// BLIZZARD (B1 Frostwind Plains) — the plains breathe in cycles: CALM -> a warning wind -> BLIZZARD -> calm again.
// During the storm: a white-out closes in (you see only a small circle around you, wider around campfires), COLD builds
// on everyone away from a fire (60% = FROSTBITE: slower; 100% = FROZEN THROUGH: frost damage over time) and the hunter
// packs (`hunters` monster types) catch your scent from far away and come running, hasted. Campfires (code-drawn, data
// `fires: [[tx, ty], ...]`) warm you and clear the white-out around them; cold drains away when the sky is calm.
// ONLINE: the room host owns the cycle (phase + time left -> netState); every client keeps its own cold meter.
//   options: { calm, warn, storm (s), fires, warmR (px), hunters: [type], scent (px), coldRate, warmRate, calmRate }
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE } from '../../core/constants.js';
import { TAU, rand } from '../../core/math.js';
import { makeCanvas } from '../../core/assets.js';
import { MONSTER_STATE as S } from '../../monsters/monsterTypes.js';

const D = { calm: 75, warn: 8, storm: 32, fires: [], warmR: 96, hunters: [], scent: 700, coldRate: 4.5, warmRate: 18, calmRate: 6 };
const PHASES = ['calm', 'warn', 'storm'];

export class Blizzard extends MapMechanic {
  enter() {
    this.o = { ...D, ...this.def };
    this.phase = 'calm';
    this.t = this.o.calm * rand(0.35, 0.6); // arriving: the next storm is not far, never at once
    this.k = 0;      // storm strength 0..1 (eases in / out: drawing + hearing)
    this.cold = 0;   // OUR cold meter 0..100
    this.fires = this.o.fires.map(([tx, ty]) => this.world.map.findOpen((tx + 0.5) * TILE, (ty + 0.5) * TILE, 3));
    this.flakes = [];
  }
  exit() { this.clearStatus(); }
  reset() { this.cold = 0; this.clearStatus(); }
  clearStatus() { const p = this.game.player; if (p && p.status) { p.status.remove('frostbite'); p.status.remove('frozen_through'); } }

  get storming() { return this.phase === 'storm'; }
  nearFire(e) { return this.fires.some((f) => Math.hypot(f.x - e.x, f.y - e.y) <= this.o.warmR); }

  update(dt) {
    // the cycle (host / solo); guests only count down until the next snapshot corrects them
    this.t -= dt;
    if (this.t <= 0 && this.authority) this.next();
    this.k = Math.max(0, Math.min(1, this.k + dt * (this.storming ? 0.5 : this.phase === 'warn' ? 0.08 : -0.35)));
    this.updateCold(dt);
    if (this.storming && this.authority) this.hunt();
  }
  next() {
    const i = (PHASES.indexOf(this.phase) + 1) % PHASES.length;
    this.phase = PHASES[i];
    this.t = this.o[this.phase];
    this.markNet();
    this.announce();
  }
  announce() {
    const ui = this.game.ui;
    if (this.phase === 'warn') ui.toast('The wind rises… a blizzard is coming. Find a fire!', 3);
    else if (this.phase === 'storm') ui.banner('BLIZZARD', 'Stay near a campfire — the wolves hunt in the white', '#cfe8ff');
    else ui.toast('The storm passes', 2);
  }
  updateCold(dt) {
    const p = this.game.player, o = this.o;
    if (!p || p.dead) return;
    const warm = this.nearFire(p);
    if (warm) this.cold -= o.warmRate * dt;
    else if (this.storming) this.cold += o.coldRate * dt;
    else this.cold -= o.calmRate * dt;
    this.cold = Math.max(0, Math.min(100, this.cold));
    // statuses follow the meter (renewed while it lasts; they fade 1 s after it drops)
    const keep = (id, data) => { const s = p.status.map.get(id); if (!s || s.t < 0.4) p.status.add(id, 1.2, data); };
    if (this.cold >= 60) keep('frostbite');
    if (this.cold >= 100) keep('frozen_through', { damage: Math.max(4, Math.round(p.maxHp * 0.03)) });
    if (warm && Math.random() < dt * 4) this.game.vfx.particle(p.x + rand(-10, 10), p.y - 18, { color: '#ffb060', vy: -24, life: 0.8, size: 2, add: true, drag: 0 });
  }
  // the packs catch your scent: any hunter close enough to a player wakes up and runs at them, hasted
  hunt() {
    const w = this.world, g = this.game, who = g.combatants();
    for (const m of w.monsters) {
      if (m.dead || m.puppet || !this.o.hunters.includes(m.type) || !w.onMap(m)) continue;
      if (m.state !== S.IDLE && m.state !== S.PATROL && m.state !== S.RETURN) continue;
      const q = who.find((x) => !x.dead && !this.nearFire(x) && Math.hypot(x.x - m.x, x.y - m.y) <= this.o.scent);
      if (!q) continue;
      m.aggro = true; m.setState(S.CHASE);
      m.status.add('haste', this.t + 2);
    }
  }

  // ---- online: host -> guests
  netState() { return { ph: PHASES.indexOf(this.phase), t: Math.round(this.t * 10) / 10 }; }
  netApply(s) {
    const ph = PHASES[s.ph] || 'calm';
    if (ph !== this.phase) { this.phase = ph; this.announce(); }
    this.t = typeof s.t === 'number' ? s.t : this.t;
  }

  // ---- drawing
  drawGround(ctx, t) { for (const f of this.fires) drawCampfire(ctx, f, t, this.o.warmR, this.game); }
  drawScreen(ctx, game) {
    const k = this.k, cam = game.camera, z = cam.zoom, W = ctx.canvas.width, H = ctx.canvas.height;
    if (k <= 0.01) return;
    // white-out: a sheet of snow with holes of clear air around you and every campfire
    const c = this.fog && this.fog.width === W && this.fog.height === H ? this.fog : (this.fog = makeCanvas(W, H));
    const f = c.getContext('2d');
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H);
    f.fillStyle = `rgba(215,228,245,${0.82 * k})`;
    f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r) => {
      const x = (wx - cam.left) * z, y = (wy - cam.top) * z, rr = r * z;
      const gr = f.createRadialGradient(x, y, rr * 0.35, x, y, rr);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = gr; f.beginPath(); f.arc(x, y, rr, 0, TAU); f.fill();
    };
    const p = game.player;
    hole(p.x, p.y - 16, 150 + (1 - k) * 300);
    for (const fire of this.fires) hole(fire.x, fire.y, this.o.warmR * 2.2);
    ctx.drawImage(c, 0, 0);
    // driving snow
    const want = Math.round(160 * k);
    while (this.flakes.length < want) this.flakes.push({ x: rand(0, W), y: rand(0, H), v: rand(260, 520), l: rand(4, 11) });
    if (this.flakes.length > want) this.flakes.length = want;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineWidth = 1;
    ctx.beginPath();
    const dt = 1 / 60;
    for (const s of this.flakes) {
      s.x += s.v * 0.9 * dt; s.y += s.v * 0.35 * dt;
      if (s.x > W + 10) { s.x = -10; s.y = rand(-20, H); }
      if (s.y > H + 10) { s.y = -10; s.x = rand(-20, W); }
      ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.l * 0.9, s.y - s.l * 0.35);
    }
    ctx.stroke();
  }
  hudTags() {
    const out = [];
    if (this.phase === 'storm') out.push({ label: `❄ BLIZZARD ${Math.ceil(this.t)}s`, color: '#cfe8ff' });
    else if (this.phase === 'warn') out.push({ label: `❄ Blizzard in ${Math.ceil(this.t)}s`, color: '#9ac8ff' });
    if (this.cold > 1) out.push({ label: `COLD ${Math.round(this.cold)}%${this.nearFire(this.game.player) ? ' · warming' : ''}`, color: this.cold >= 60 ? '#7ab8ff' : '#c8dcf0' });
    return out;
  }
}
registerMapMechanic('blizzard', Blizzard);

// a code-drawn campfire (ring of stones, logs, living flame) with its warm circle — shared by the cold mechanics
export function drawCampfire(ctx, f, t, warmR, game) {
  ctx.fillStyle = 'rgba(255,150,60,0.13)';
  ctx.beginPath(); ctx.ellipse(f.x, f.y, warmR, warmR * 0.65, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a4a52';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.fillRect(Math.round(f.x + Math.cos(a) * 13) - 2, Math.round(f.y + Math.sin(a) * 8) - 2, 5, 4); }
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(f.x - 9, f.y - 2, 18, 4); ctx.fillRect(f.x - 2, f.y - 6, 4, 10);
  for (let i = 0; i < 3; i++) {
    const h = 10 + 5 * Math.sin(t * 9 + i * 2), x = f.x + (i - 1) * 4;
    ctx.fillStyle = i === 1 ? '#ffe08a' : '#ff8a30';
    ctx.beginPath(); ctx.moveTo(x - 4, f.y); ctx.quadraticCurveTo(x, f.y - h * 1.4, x + 4, f.y); ctx.fill();
  }
  if (Math.random() < 0.2) game.vfx.particle(f.x + rand(-4, 4), f.y - 12, { color: '#ffb060', vy: -30, life: 1, size: 1.5, add: true, drag: 0 });
}
