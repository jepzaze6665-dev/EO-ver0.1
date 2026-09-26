import { TAU } from '../core/math.js';

// Ground warnings shown before every enemy / boss attack. Shapes:
//  circle {x,y,r} | ring {x,y,r0,r} | cone {x,y,r,ang,half} | line {x,y,ang,len,width}
// The inner fill grows with progress so the player can read exactly when it lands.
export class Telegraphs {
  constructor() {
    this.list = [];
  }
  add(def) {
    const t = { time: 0, total: 0.6, color: '255,60,60', resolved: false, fade: 0, ...def };
    this.list.push(t);
    return t;
  }
  cancelOwner(owner) {
    for (const t of this.list) if (t.owner === owner && !t.resolved) { t.cancelled = true; t.resolved = true; t.fade = 0.12; }
  }
  update(dt) {
    for (const t of this.list) {
      if (t.resolved) { t.fade -= dt; continue; }
      if (t.owner && t.owner.dead) { t.resolved = true; t.cancelled = true; t.fade = 0.1; continue; }
      if (t.follow) t.follow(t, dt);
      t.time += dt;
      if (t.time >= t.total) {
        t.resolved = true;
        t.fade = 0.18;
        if (t.onResolve) t.onResolve(t);
      }
    }
    this.list = this.list.filter((t) => !t.resolved || t.fade > 0);
  }
  clear() { this.list.length = 0; }

  draw(ctx, time) {
    for (const t of this.list) {
      const p = Math.min(1, t.time / t.total);
      ctx.save();
      if (t.resolved) {
        if (t.cancelled) { ctx.restore(); continue; }
        // impact flash
        ctx.globalAlpha = Math.max(0, t.fade / 0.18) * 0.7;
        ctx.fillStyle = `rgba(255,230,210,1)`;
        this.path(ctx, t, 1);
        ctx.fill();
        ctx.restore();
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(time * 18);
      // base zone
      ctx.fillStyle = `rgba(${t.color},${0.13 + p * 0.1})`;
      this.path(ctx, t, 1);
      ctx.fill();
      // growing inner fill
      ctx.fillStyle = `rgba(${t.color},${0.25 + p * 0.25})`;
      this.path(ctx, t, p);
      ctx.fill();
      // outline
      ctx.strokeStyle = `rgba(${t.color},${0.55 + pulse * 0.35 * p})`;
      ctx.lineWidth = 1.5;
      this.path(ctx, t, 1);
      ctx.stroke();
      ctx.restore();
    }
  }

  path(ctx, t, s) {
    ctx.beginPath();
    switch (t.shape) {
      case 'circle':
        ctx.arc(t.x, t.y, Math.max(0.1, t.r * s), 0, TAU);
        break;
      case 'ring': {
        const r0 = t.r0, r1 = t.r0 + (t.r - t.r0) * s;
        ctx.arc(t.x, t.y, r1, 0, TAU);
        ctx.arc(t.x, t.y, r0, 0, TAU, true);
        break;
      }
      case 'cone':
        ctx.moveTo(t.x, t.y);
        ctx.arc(t.x, t.y, Math.max(0.1, t.r * s), t.ang - t.half, t.ang + t.half);
        ctx.closePath();
        break;
      case 'line': {
        const c = Math.cos(t.ang), sn = Math.sin(t.ang), hw = t.width;
        const L = t.len * s;
        ctx.moveTo(t.x - sn * hw, t.y + c * hw);
        ctx.lineTo(t.x + c * L - sn * hw, t.y + sn * L + c * hw);
        ctx.lineTo(t.x + c * L + sn * hw, t.y + sn * L - c * hw);
        ctx.lineTo(t.x + sn * hw, t.y - c * hw);
        ctx.closePath();
        break;
      }
    }
  }
}
