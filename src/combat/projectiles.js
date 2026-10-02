import { Pool } from '../core/pool.js';
import { TEAM } from '../core/constants.js';
import { TAU, angleTo, wrapAngle } from '../core/math.js';
import { Assets } from '../core/assets.js';
import { applySkillMods } from './combat.js';

// Pooled projectiles for both teams (crystal shards, seed / sap orbs, crescent waves).
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.pool = new Pool(() => ({ hit: new Set() }), 160);
  }

  fire(def) {
    const p = this.pool.spawn();
    p.hit.clear();
    Object.assign(p, {
      x: 0, y: 0, vx: 0, vy: 0, r: 5, life: 2, age: 0, team: TEAM.ENEMY, power: 10, owner: null,
      kind: 'shard', pierce: false, homing: 0, delay: 0, visual: false, perfectDone: false, color: '#5af0ff', dmgType: 'physical', status: null,
      knock: 120, onHit: null, wallStop: true, skillId: null, noSkillMods: false, accel: 0, rot: 0,
    }, def);
    applySkillMods(p, ['r']); // skill level power / area of the action that fired it
    p.ang = Math.atan2(p.vy, p.vx);
    return p;
  }

  update(dt) {
    const g = this.game, map = g.world.map, pl = g.player;
    this.pool.forEach((p) => {
      if (p.delay > 0) { p.delay -= dt; return; }
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; return; }
      if (p.homing && p.team === TEAM.ENEMY && !pl.dead) {
        const want = angleTo(p.x, p.y, pl.x, pl.y);
        const cur = Math.atan2(p.vy, p.vx);
        const sp = Math.hypot(p.vx, p.vy);
        const na = cur + Math.max(-p.homing * dt, Math.min(p.homing * dt, wrapAngle(want - cur)));
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      }
      if (p.accel) {
        const sp = Math.hypot(p.vx, p.vy), ns = sp + p.accel * dt;
        p.vx *= ns / sp; p.vy *= ns / sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.ang = Math.atan2(p.vy, p.vx);
      p.rot += dt * 10;
      // targets are tested BEFORE walls: things embedded in walls (cracks, wall-bound foes) stay hittable
      if (p.visual) { /* ONLINE: a friend's shot replayed for the eyes only (net/netFx.js) — hits nothing */ }
      else if (p.team === TEAM.ENEMY && g.players) { for (const q of g.players()) if (p.active) this.hitTargets(p, g, q); } // every player
      else this.hitTargets(p, g, pl);
      if (p.active && p.wallStop && map.blocksShot(p.x, p.y)) {
        // a shot that strikes a wall also strikes what is built into that wall (cracked walls, seals)
        if (p.team !== TEAM.ENEMY && !p.visual) {
          const wallThing = g.world.breakables.find((b) => !b.dead && b.hurtable && !p.hit.has(b) && Math.hypot(b.x - p.x, b.y - p.y) < b.radius + 40);
          if (wallThing) { p.hit.add(wallThing); const info = g.combat.dealDamage(p.owner, wallThing, p); if (p.onHit) p.onHit(wallThing, info, p); }
        }
        g.vfx.burst(p.x, p.y, p.color, 6, 60);
        p.active = false;
        return;
      }
      if (p.active && p.trail && Math.random() < 0.6) g.vfx.particle(p.x, p.y, { color: p.color, life: 0.3, size: 2, vx: -p.vx * 0.05, vy: -p.vy * 0.05, add: true });
    });
  }

  // one projectile vs its opposing team (player for enemy shots, hostiles for player shots)
  hitTargets(p, g, pl) {
    if (p.team === TEAM.ENEMY) {
      if (pl.dead) return;
      const d2 = (pl.x - p.x) ** 2 + (pl.y - 8 - p.y) ** 2;
      if (d2 < (p.r + (pl.hurtRadius || pl.radius)) ** 2) {
        if (pl.invulnerable()) {
          if (!p.perfectDone && pl.canPerfect()) { p.perfectDone = true; pl.onPerfectDodge(p.owner); g.events.emit('attackDodged', { attacker: p.owner, player: pl, perfect: true, projectile: true }); }
          return;
        }
        const info = g.combat.dealDamage(p.owner || { x: p.x - p.vx, y: p.y - p.vy, team: TEAM.ENEMY }, pl, { power: p.power, knock: p.knock, type: p.dmgType || 'physical' });
        if (p.status && !info.blocked && !pl.dead) for (const s of p.status) pl.status.add(s.id, s.dur, { source: p.owner }); // e.g. boss spears: poison
        if (!p.pierce) p.active = false;
      }
    } else {
      for (const t of g.world.hostiles()) {
        if (t.dead || p.hit.has(t)) continue;
        if ((t.x - p.x) ** 2 + (t.y - 10 - p.y) ** 2 < (p.r + t.radius) ** 2) {
          p.hit.add(t);
          const info = g.combat.dealDamage(p.owner, t, p.powerFor ? { ...p, power: p.powerFor(t, p) } : p); // powerFor: per-target power, as for hitboxes
          if (p.onHit) p.onHit(t, info, p);
          if (!p.pierce) { p.active = false; break; }
        }
      }
    }
  }

  draw(ctx, time) {
    this.pool.forEach((p) => {
      if (p.delay > 0) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      if (p.kind === 'shard') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(90,240,255,0.35)';
        ctx.beginPath(); ctx.arc(0, 0, p.r + 4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#bff8ff';
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-3, -4); ctx.lineTo(-7, 0); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3ac0e0';
        ctx.fillRect(-4, -1, 8, 2);
      } else if (p.kind === 'orb') {
        ctx.globalCompositeOperation = 'lighter';
        const r = p.r + Math.sin(time * 20) * 1;
        ctx.fillStyle = 'rgba(180,80,255,0.35)';
        ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0b0ff';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, TAU); ctx.fill();
      } else if (p.kind === 'wave') {
        // Umbral crescent (hand-drawn slash strip)
        const d = Assets.vfx.slash;
        if (d) { ctx.globalAlpha = 0.95; ctx.scale(1.3, 1.3); ctx.drawImage(d.img, 3 * d.fw, 0, d.fw, d.fh, -d.fw / 2, -d.fh / 2, d.fw, d.fh); }
      } else if (p.kind === 'sprite') {
        // hand-drawn VFX strip (right-facing, rotated by ang): frames loop at fps
        const d = Assets.vfx[p.sprite];
        if (d) {
          const fr = p.frames || [2];
          const f = fr[Math.floor(p.age * (p.fps || 12)) % fr.length];
          const s = p.scale || 1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, -d.fw * s / 2, -d.fh * s / 2, d.fw * s, d.fh * s);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (p.kind === 'root') {
        ctx.fillStyle = '#3a5a2a';
        ctx.fillRect(-6, -3, 12, 6);
      }
      ctx.restore();
    });
  }

  clear() { this.pool.clear(); }
}
