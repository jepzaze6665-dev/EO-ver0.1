import { Pool } from '../core/pool.js';
import { rand, TAU, easeOutCubic, clamp } from '../core/math.js';
import { Assets } from '../core/assets.js';

// All transient visual effects, pooled. World-space effects draw into the pixel
// scene; damage numbers and floating texts draw at screen resolution for clarity.
export class VFX {
  constructor(game) {
    this.game = game;
    this.particles = new Pool(() => ({}), 900);
    this.slashes = new Pool(() => ({}), 48);
    this.rings = new Pool(() => ({}), 40);
    this.numbers = new Pool(() => ({}), 90);
    this.texts = new Pool(() => ({}), 24);
    this.ghosts = new Pool(() => ({}), 40);
    this.lights = new Pool(() => ({}), 48);
    this.beams = new Pool(() => ({}), 12);
    this.sprites = new Pool(() => ({}), 40);
    this.screenFlash = { a: 0, color: '255,255,255', decay: 4 };
    this.eclipse = null; // ultimate black-sun effect
  }

  // ---------------- spawners
  particle(x, y, o = {}) {
    const p = this.particles.spawn();
    p.x = x; p.y = y;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0;
    p.life = p.max = o.life ?? 0.5;
    p.size = o.size ?? 2;
    p.color = o.color ?? '#fff';
    p.drag = o.drag ?? 3;
    p.grav = o.grav ?? 0;
    p.add = o.add ?? false;
    p.shrink = o.shrink ?? true;
    p.z = o.z ?? 0;
    return p;
  }
  burst(x, y, color, n = 10, speed = 90, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      this.particle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: rand(0.25, 0.6), size: rand(1, 3), add: true, ...o });
    }
  }
  spark(x, y, ang, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-0.9, 0.9), s = rand(80, 220);
      this.particle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: i % 3 ? color : '#ffffff', life: rand(0.12, 0.32), size: rand(1, 2.5), drag: 6, add: true });
    }
  }
  shadowSmoke(x, y, n = 3, o = {}) {
    for (let i = 0; i < n; i++) {
      this.particle(x + rand(-6, 6), y + rand(-10, 4), {
        vx: rand(-15, 15), vy: rand(-30, -8), color: i % 2 ? '#2a1040' : '#5a2a90', life: rand(0.3, 0.7), size: rand(2, 4), drag: 2, ...o,
      });
    }
  }
  shards(x, y, color, n = 12, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.4, speed);
      this.particle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, color: i % 2 ? color : '#ffffff', life: rand(0.4, 0.9), size: rand(2, 4), grav: 260, drag: 1.5, shrink: false, add: false });
    }
  }
  slash(x, y, ang, r, half, o = {}) {
    const s = this.slashes.spawn();
    Object.assign(s, {
      x, y, ang, r, half, life: o.life ?? 0.22, max: o.life ?? 0.22, width: o.width ?? 8,
      color: o.color ?? '170,80,255', core: o.core ?? '255,235,255', follow: o.follow ?? null, flip: o.flip ?? false, thin: o.thin ?? false,
    });
    return s;
  }
  ring(x, y, r0, r1, o = {}) {
    const g = this.rings.spawn();
    Object.assign(g, { x, y, r0, r1, life: o.life ?? 0.4, max: o.life ?? 0.4, color: o.color ?? '190,110,255', width: o.width ?? 4, fill: o.fill ?? false });
    return g;
  }
  beam(x, y, ang, len, width, o = {}) {
    const b = this.beams.spawn();
    Object.assign(b, { x, y, ang, len, width, life: o.life ?? 0.35, max: o.life ?? 0.35, color: o.color ?? '180,90,255' });
    return b;
  }
  // Hand-drawn skill effect strip, rotated to the aim angle. follow: entity to stick to.
  sprite(name, x, y, ang, o = {}) {
    const def = Assets.vfx[name];
    if (!def) return null;
    const s = this.sprites.spawn();
    Object.assign(s, { def, x, y, ang, scale: o.scale ?? 1, life: o.life ?? 0.32, max: o.life ?? 0.32, follow: o.follow ?? null, off: o.off ?? 0, glow: o.glow ?? 0.35, flipY: !!o.flipY });
    return s;
  }
  damage(x, y, amount, o = {}) {
    const n = this.numbers.spawn();
    Object.assign(n, { x: x + rand(-8, 8), y, text: String(amount), life: 0.9, max: 0.9, vy: -40, crit: !!o.crit, color: o.color || '#fff', big: !!o.big });
  }
  text(x, y, text, o = {}) {
    const t = this.texts.spawn();
    Object.assign(t, { x, y, text, life: o.life ?? 1.1, max: o.life ?? 1.1, color: o.color ?? '#fff', size: o.size ?? 10, vy: o.vy ?? -22 });
  }
  flash(color = '255,255,255', a = 0.5, decay = 4) {
    this.screenFlash = { a, color, decay };
  }
  light(x, y, r, color, life = 0.25, a = 0.8) {
    const l = this.lights.spawn();
    Object.assign(l, { x, y, r, color, life, max: life, a });
  }
  ghost(frame, x, y, o = {}) {
    // frame: {img, sx, sy, sw, sh, ax, ay, flip}
    const g = this.ghosts.spawn();
    Object.assign(g, { ...frame, x, y, life: o.life ?? 0.3, max: o.life ?? 0.3, alpha: o.alpha ?? 0.55 });
  }
  startEclipse(x, y, dur) { this.eclipse = { x, y, t: 0, dur }; }

  // ---------------- update
  update(dt) {
    this.particles.forEach((p) => {
      p.life -= dt;
      if (p.life <= 0) { p.active = false; return; }
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vy = p.vy * f + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    });
    const tick = (pool) => pool.forEach((o) => { o.life -= dt; if (o.life <= 0) o.active = false; });
    tick(this.slashes); tick(this.rings); tick(this.sprites); tick(this.ghosts); tick(this.lights); tick(this.beams);
    this.numbers.forEach((n) => { n.life -= dt; n.y += n.vy * dt; n.vy *= Math.exp(-3 * dt); if (n.life <= 0) n.active = false; });
    this.texts.forEach((t) => { t.life -= dt; t.y += t.vy * dt; t.vy *= Math.exp(-2 * dt); if (t.life <= 0) t.active = false; });
    this.screenFlash.a = Math.max(0, this.screenFlash.a - dt * this.screenFlash.decay);
    if (this.eclipse) { this.eclipse.t += dt; if (this.eclipse.t > this.eclipse.dur) this.eclipse = null; }
  }

  // ---------------- draw (world space, pixel scene)
  drawBelow(ctx, time) {
    // ground-hugging effects: shockwave rings, eclipse shadow
    this.rings.forEach((g) => {
      const t = 1 - g.life / g.max;
      const r = g.r0 + (g.r1 - g.r0) * easeOutCubic(t);
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = `rgb(${g.color})`;
      ctx.lineWidth = g.width * (1 - t * 0.6);
      ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, TAU); ctx.stroke();
      if (g.fill) { ctx.fillStyle = `rgba(${g.color},${0.15 * (1 - t)})`; ctx.fill(); }
    });
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    if (this.eclipse) {
      const e = this.eclipse, p = clamp(e.t / 0.45, 0, 1);
      ctx.fillStyle = `rgba(10,0,20,${0.45 * p})`;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 90 * p, 50 * p, 0, 0, TAU); ctx.fill();
    }
  }

  drawAbove(ctx, time) {
    // afterimages
    this.ghosts.forEach((g) => {
      const t = g.life / g.max;
      ctx.globalAlpha = g.alpha * t;
      if (g.flip) {
        ctx.save(); ctx.translate(g.x, 0); ctx.scale(-1, 1);
        ctx.drawImage(g.img, g.sx, g.sy, g.sw, g.sh, -g.ax, g.y - g.ay, g.sw, g.sh);
        ctx.restore();
      } else ctx.drawImage(g.img, g.sx, g.sy, g.sw, g.sh, g.x - g.ax, g.y - g.ay, g.sw, g.sh);
    });
    ctx.globalAlpha = 1;

    // hand-drawn skill sprites (normal pass keeps their dark outline, additive pass adds glow)
    for (const pass of [0, 1]) {
      if (pass) ctx.globalCompositeOperation = 'lighter';
      this.sprites.forEach((s) => {
        const d = s.def, t = 1 - s.life / s.max;
        const f = Math.min(d.frames - 1, Math.floor(t * d.frames));
        const x = s.follow ? s.follow.x + Math.cos(s.ang) * s.off : s.x;
        const y = s.follow ? s.follow.y - 14 + Math.sin(s.ang) * s.off : s.y;
        ctx.save();
        ctx.globalAlpha = pass ? s.glow * (1 - t * 0.6) : 1;
        ctx.translate(x, y);
        ctx.rotate(s.ang);
        if (s.flipY) ctx.scale(1, -1);
        ctx.scale(s.scale, s.scale);
        ctx.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, -d.fw / 2, -d.fh / 2, d.fw, d.fh);
        ctx.restore();
      });
    }
    ctx.globalCompositeOperation = 'lighter';
    // particles
    this.particles.forEach((p) => {
      if (!p.add) return;
      const t = p.life / p.max;
      const s = p.shrink ? p.size * t + 0.5 : p.size;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s / 2, p.y - s / 2 - p.z, s, s);
    });
    // slashes: crescent arcs with a hot core, sweeping in
    this.slashes.forEach((s) => {
      const t = 1 - s.life / s.max;
      const sweep = Math.min(1, t / 0.35);
      const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      const x = s.follow ? s.follow.x : s.x, y = s.follow ? s.follow.y - 14 : s.y;
      const a0 = s.ang - s.half, a1 = s.ang - s.half + s.half * 2 * sweep;
      const [start, end] = s.flip ? [s.ang + s.half - s.half * 2 * sweep, s.ang + s.half] : [a0, a1];
      const layers = s.thin ? [[s.width * 0.6, s.color, 0.55], [2, s.core, 0.9]] : [[s.width * 1.6, s.color, 0.3], [s.width, s.color, 0.7], [s.width * 0.35, s.core, 0.95]];
      for (const [w, c, a] of layers) {
        ctx.globalAlpha = a * fade;
        ctx.strokeStyle = `rgb(${c})`;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(x, y, s.r, start, end); ctx.stroke();
      }
    });
    // beams (ultimate cut line)
    this.beams.forEach((b) => {
      const t = 1 - b.life / b.max;
      const w = b.width * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
      const c = Math.cos(b.ang), s = Math.sin(b.ang);
      for (const [mul, col, a] of [[2.2, b.color, 0.35], [1, b.color, 0.8], [0.35, '255,240,255', 1]]) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = `rgb(${col})`;
        ctx.lineWidth = Math.max(0.5, w * mul);
        ctx.beginPath(); ctx.moveTo(b.x - c * 10, b.y - s * 10); ctx.lineTo(b.x + c * b.len, b.y + s * b.len); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    ctx.globalCompositeOperation = 'source-over';
    // opaque particles (debris, shards, smoke)
    this.particles.forEach((p) => {
      if (p.add) return;
      const t = p.life / p.max;
      const s = p.shrink ? p.size * t + 0.5 : p.size;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    });
    ctx.globalAlpha = 1;
    this.drawEclipse(ctx, time);
  }

  drawEclipse(ctx, time) {
    const e = this.eclipse;
    if (!e) return;
    const grow = clamp(e.t / 0.4, 0, 1), fade = e.t > e.dur - 0.3 ? (e.dur - e.t) / 0.3 : 1;
    const x = e.x, y = e.y - 46, r = 26 * easeOutCubic(grow);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + time * 1.5;
      const len = r + 8 + Math.sin(time * 9 + i * 1.7) * 5;
      ctx.strokeStyle = `rgba(190,110,255,0.7)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(170,80,255,0.45)';
    ctx.beginPath(); ctx.arc(x, y, r + 5, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05000a';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }



  // ---------------- screen-space overlay (crisp text)
  drawScreen(ctx, toScreen, scale) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.numbers.forEach((n) => {
      const p = toScreen(n.x, n.y);
      const t = n.life / n.max;
      const pop = t > 0.8 ? 1 + (t - 0.8) * 3 : 1;
      const size = (n.crit ? 17 : 12) * (n.big ? 1.5 : 1) * pop * scale / 3 * 2;
      ctx.globalAlpha = Math.min(1, t * 2.5);
      ctx.font = `900 ${Math.round(size)}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = Math.max(2, size / 5);
      ctx.strokeStyle = 'rgba(10,0,20,0.9)';
      ctx.strokeText(n.text, p.x, p.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, p.x, p.y);
      if (n.crit) { ctx.font = `800 ${Math.round(size * 0.5)}px "Trebuchet MS", sans-serif`; ctx.fillStyle = '#ffd24a'; ctx.fillText('CRIT', p.x, p.y - size * 0.8); }
    });
    this.texts.forEach((t) => {
      const p = toScreen(t.x, t.y);
      const k = t.life / t.max;
      const size = t.size * scale / 3 * 2;
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.font = `800 ${Math.round(size)}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,0,15,0.9)';
      ctx.strokeText(t.text, p.x, p.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }
}
