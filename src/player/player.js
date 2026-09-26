import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { angleTo, dir4, damp, clamp, rand, TAU, easeOutCubic } from '../core/math.js';
import { PERFECT_WINDOW } from '../combat/combat.js';
import { CHARACTER } from './characterConfig.js';
import { ResourcePool } from '../combat/resourceSystem.js';
import { RESOURCES } from '../data/resources.js';

const DODGE_TIME = 0.24, DODGE_DIST = 100, DODGE_IFRAMES = 0.28, DODGE_CHARGES = 2, DODGE_RECHARGE = 0.85;
const HURT_IFRAMES = 0.55;

export class Player extends Entity {
  constructor(game, classDef, sprites) {
    super(0, 0);
    this.game = game;
    this.cls = classDef;
    this.sprites = sprites;
    this.team = TEAM.PLAYER;
    this.radius = CHARACTER.collisionRadius; // fixed feet collision, independent of animation
    this.hurtRadius = CHARACTER.hurtRadius;
    this.height = CHARACTER.bodyHeight;
    this.level = 10; this.exp = 0; this.gold = 120;
    // generic resource pool — the class only names its resources, the rules live in data/resources.js
    this.resources = new ResourcePool(classDef.resources || [classDef.resource], RESOURCES, {
      stats: () => this.stats,
      onChange: (e) => game.events && game.events.emit('resourceChanged', { entity: this, ...e }),
    });
    this.marks = 0; this.maxMarks = 3;
    this.markPulse = 0; this.markIdle = 0;
    this.cooldowns = {};
    this.mods = {};
    this.stats = { ...classDef.base };
    this.action = null;
    this.combo = 0; this.comboTimer = 0;
    this.dodgeCharges = DODGE_CHARGES; this.dodgeRecharge = 0;
    this.dodging = false; this.dodgeStart = -9; this.dodgeOrigin = null; this.dodgeAng = 0; this.dodgeT = 0;
    this.invulnT = 0; this.hurtT = 0; this.counterT = 0;
    this.perfectCooldown = 0;
    this.anim = 'idle'; this.animT = 0;
    this.aim = 0; this.facing = Math.PI / 2;
    this.moving = false; this.sprinting = false;
    this.deathT = 0;
    this.stepT = 0;
    this.lastHitTime = -99;
    this.recomputeStats();
    this.hp = this.maxHp;
  }

  // ---------------- stats / progression
  recomputeStats() {
    const c = this.cls, lv = this.level - 10;
    const s = { ...c.base };
    s.hp += c.perLevel.hp * lv; s.atk += c.perLevel.atk * lv; s.def += c.perLevel.def * lv;
    const mods = {};
    const eq = this.game.equipment;
    if (eq) eq.applyTo(s, mods);
    if (this.game.world && this.game.world.state.flags.moonBlessing) { s.crit += 0.05; s.shadowGain += 0.1; }
    this.stats = s;
    this.mods = mods;
    const ratio = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round(s.hp);
    this.hp = Math.min(this.maxHp, Math.round(this.maxHp * ratio));
  }
  expToNext() { return Math.round(120 * Math.pow(1.28, this.level - 10)); }
  gainExp(n) {
    this.exp += n;
    let leveled = false;
    while (this.exp >= this.expToNext()) {
      this.exp -= this.expToNext();
      this.level++;
      leveled = true;
    }
    if (leveled) {
      this.recomputeStats();
      this.hp = this.maxHp;
      this.game.vfx.ring(this.x, this.y, 10, 60, { color: '255,220,120', life: 0.6 });
      this.game.vfx.burst(this.x, this.y - 20, '#ffe08a', 30, 140);
      this.game.ui.banner('LEVEL UP', `Umbral Sword  LV.${this.level}`, '#ffd96a');
      this.game.audio.sfx('levelup');
    }
  }

  // ---------------- resources
  // primary-resource aliases (kept so older code, the HUD and v1 saves keep working)
  get primaryResource() { return this.cls.resource; }
  get shadow() { return this.resources.get(this.primaryResource); }
  set shadow(v) { this.resources.set(this.primaryResource, v); }
  get maxShadow() { return this.resources.max(this.primaryResource); }
  gainShadow(n, raw = false) { this.resources.gain(this.primaryResource, n, { raw }); }
  addMark(n = 1) {
    const before = this.marks;
    this.marks = Math.min(this.maxMarks, this.marks + n);
    this.markIdle = 0;
    if (this.marks > before) {
      this.markPulse = 1;
      this.game.audio.sfx(this.marks === 3 ? 'mark_full' : 'mark');
      this.game.vfx.burst(this.x, this.y - 64, '#c080ff', 8, 50);
      if (this.marks === 3) {
        this.game.vfx.text(this.x, this.y - 78, 'SHADOW BREAK READY  [Q]', { color: '#e8c0ff', size: 10, life: 1.4 });
        this.game.vfx.ring(this.x, this.y, 30, 6, { life: 0.3, color: '200,120,255', width: 2 });
      }
      this.game.events.emit('markGained', this.marks);
    }
  }
  consumeMarks(n) { this.marks = Math.max(0, this.marks - n); }
  reduceCooldowns(sec) { for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - sec); }

  // ---------------- defense
  invulnerable() {
    return this.invulnT > 0 || this.dodging || (this.action && this.action.invuln && this.action.t >= this.action.invuln[0] && this.action.t <= this.action.invuln[1]);
  }
  canPerfect() {
    const win = PERFECT_WINDOW + (this.mods.perfectWindow || 0);
    return this.perfectCooldown <= 0 && this.game.time - this.dodgeStart <= win;
  }
  onPerfectDodge(attacker) {
    const g = this.game;
    this.perfectCooldown = 0.5;
    g.slowMo(0.3, 0.45);
    g.vfx.flash('150,60,255', 0.35, 3);
    g.vfx.text(this.x, this.y - 70, 'PERFECT DODGE', { color: '#f2d8ff', size: 13, life: 1.3 });
    g.vfx.ring(this.x, this.y, 8, 70, { life: 0.4, color: '200,120,255', width: 3 });
    g.vfx.burst(this.x, this.y - 20, '#c080ff', 22, 150);
    g.camera.punch(0.08);
    g.audio.sfx('perfect');
    this.cls.onPerfectDodge(this, g);
    if (this.mods.perfectHeal) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.05);
    g.events.emit('perfectDodge', attacker);
  }
  onHurt(amount, src, opts, ang) {
    const g = this.game;
    this.invulnT = HURT_IFRAMES;
    this.lastHitTime = g.time;
    g.camera.shake(0.28);
    g.vfx.flash('255,40,40', 0.18, 5);
    g.hitStop = Math.max(g.hitStop, 0.06);
    if (!(this.action && this.action.superArmor)) {
      this.endAction(true);
      this.hurtT = 0.2;
    }
  }
  onDeath() {
    this.dead = true;
    this.deathT = 0;
    this.endAction(true);
    this.game.onPlayerDeath();
  }

  // ---------------- actions
  startAction(act) {
    if (this.action) this.endAction(true);
    act.t = 0;
    act.events = (act.events || []).map(([t, fn]) => ({ t, fn, done: false }));
    act.ghostT = 0;
    this.action = act;
    this.facing = act.ang ?? this.facing;
    if (act.start) act.start();
  }
  endAction(interrupted = false) {
    const a = this.action;
    if (!a) return;
    this.action = null;
    if (a.end) a.end(interrupted);
  }

  beginDodge(ang, fromSkill = false) {
    this.dodging = true;
    this.dodgeStart = this.game.time;
    this.dodgeOrigin = { x: this.x, y: this.y };
    this.dodgeAng = ang;
    this.dodgeT = 0;
    this.dodgeFromSkill = fromSkill;
  }

  tryDodge() {
    if (this.dodgeCharges <= 0 || this.hurtT > 0) return false;
    if (this.action && this.action.t < (this.action.cancelAt ?? 0)) return false;
    const g = this.game, mv = g.input.moveVector();
    const ang = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : this.aim;
    this.endAction(true);
    this.dodgeCharges--;
    this.beginDodge(ang);
    this.facing = ang;
    g.audio.sfx('dodge');
    g.vfx.shadowSmoke(this.x, this.y, 5);
    return true;
  }

  trySkill(skill) {
    const g = this.game;
    if (this.hurtT > 0 || this.status.has('stun')) return false;
    if ((this.cooldowns[skill.id] || 0) > 0) { g.ui.toast('Cooldown', 0.6); return false; }
    const res = skill.costResource || this.primaryResource;
    if (!this.resources.canAfford(res, skill.cost)) { g.ui.toast(`Not enough ${RESOURCES[res].label}`, 0.8); g.audio.sfx('deny'); return false; }
    if (this.action && !this.action.basic && this.action.t < (this.action.cancelAt ?? 0)) return false;
    if (this.dodging && !this.dodgeFromSkill && this.dodgeT < DODGE_TIME * 0.6) return false;
    this.dodging = false;
    this.resources.spend(res, skill.cost, 'skill:' + skill.id);
    this.cooldowns[skill.id] = skill.cd * (1 - (this.stats.cdr || 0));
    this.startAction(skill.cast(this, g, this.aim));
    g.events.emit('skillUsed', skill.id);
    return true;
  }

  tryBreak() {
    const g = this.game;
    if (this.marks < 3) { g.ui.toast('Need 3 Shadow Marks', 0.8); g.audio.sfx('deny'); return false; }
    if (this.hurtT > 0) return false;
    if (this.action && !this.action.basic && this.action.t < (this.action.cancelAt ?? 0)) return false;
    this.dodging = false;
    this.startAction(this.cls.special.cast(this, g, this.aim));
    g.events.emit('shadowBreak');
    return true;
  }

  tryAttack() {
    if (this.hurtT > 0 || this.dodging) return false;
    const a = this.action;
    if (a) {
      if (!a.basic || a.t < a.comboAt) return false;
    }
    const step = a && a.basic ? (a.step + 1) % 3 : this.comboTimer > 0 ? this.combo : 0;
    this.combo = (step + 1) % 3;
    this.comboTimer = 0.55;
    this.startAction(this.cls.basic(this, this.game, this.aim, step));
    return true;
  }

  // ---------------- update
  update(dt) {
    const g = this.game, input = g.input, map = g.world.map;
    this.status.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.markPulse = Math.max(0, this.markPulse - dt * 2);
    if (this.dead) { this.deathT += dt; return; }

    this.invulnT = Math.max(0, this.invulnT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.counterT = Math.max(0, this.counterT - dt);
    this.perfectCooldown = Math.max(0, this.perfectCooldown - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.resources.update(dt, { inCombat: g.combat.inCombat });
    if (this.dodgeCharges < DODGE_CHARGES) {
      this.dodgeRecharge += dt;
      if (this.dodgeRecharge >= DODGE_RECHARGE) { this.dodgeRecharge = 0; this.dodgeCharges++; }
    }
    // resource regen out of combat, mark decay when idle
    if (!g.combat.inCombat) {
      this.markIdle += dt;
      if (this.marks > 0 && this.markIdle > 12) { this.marks--; this.markIdle = 9.5; }
      if (g.time - this.lastHitTime > 6 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    }

    // aim from mouse
    const mw = g.mouseWorld();
    this.aim = angleTo(this.x, this.y - 12, mw.x, mw.y);

    // ---- input (buffered)
    if (g.controlsEnabled()) {
      if (input.pressed('Space')) input.pushBuffer('dodge');
      if (input.mouse.leftPressed || (input.mouse.left && !this.action)) input.pushBuffer('attack');
      if (input.pressed('KeyQ') || input.mouse.rightPressed) input.pushBuffer('break');
      for (let i = 1; i <= 5; i++) if (input.pressed('Digit' + i)) input.pushBuffer('skill' + i);
      if (input.pressed('KeyR')) g.inventory.quickUse('hp_potion');
      if (input.pressed('KeyF')) g.inventory.quickUse('shadow_tonic');

      if (input.peek('dodge') && this.tryDodge()) input.consume('dodge');
      if (input.peek('break') && this.tryBreak()) input.consume('break');
      for (const sk of this.cls.skills) if (input.peek('skill' + sk.slot) && this.trySkill(sk)) input.consume('skill' + sk.slot);
      if (input.peek('attack') && this.tryAttack()) input.consume('attack');
    }

    // ---- movement
    const mv = g.controlsEnabled() ? input.moveVector() : { x: 0, y: 0 };
    this.sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    let speed = this.stats.speed * this.status.moveMult() * (this.sprinting && !g.combat.inCombat ? 1.4 : this.sprinting ? 1.15 : 1);
    let tvx = mv.x * speed, tvy = mv.y * speed;

    if (this.dodging) {
      this.dodgeT += dt;
      const dur = this.action && this.action.dash ? this.action.dur : DODGE_TIME;
      const dist = this.action && this.action.dash ? this.action.dash.dist : DODGE_DIST;
      const f0 = easeOutCubic(Math.min(1, (this.dodgeT - dt) / dur)), f1 = easeOutCubic(Math.min(1, this.dodgeT / dur));
      const step = (f1 - f0) * dist;
      map.moveCircle(this, Math.cos(this.dodgeAng) * step, Math.sin(this.dodgeAng) * step);
      this.vx = this.vy = 0;
      if (Math.random() < 0.7) g.vfx.shadowSmoke(this.x, this.y, 1);
      this.stepGhost(dt, 0.035);
      if (this.dodgeT >= dur) { this.dodging = false; if (!this.dodgeFromSkill) this.invulnT = Math.max(this.invulnT, DODGE_IFRAMES - dur); }
    } else if (this.hurtT > 0) {
      this.vx = damp(this.vx, 0, 10, dt); this.vy = damp(this.vy, 0, 10, dt);
    } else {
      if (this.action) { tvx *= this.action.moveMul ?? 0.4; tvy *= this.action.moveMul ?? 0.4; }
      const accel = mv.x || mv.y ? 30 : 22; // quick start / quick stop, minimal inertia
      this.vx = damp(this.vx, tvx, accel, dt);
      this.vy = damp(this.vy, tvy, accel, dt);
      map.moveCircle(this, this.vx * dt, this.vy * dt);
    }
    this.applyKnockback(dt, map);
    this.moving = Math.hypot(this.vx, this.vy) > 20;

    // ---- action timeline
    const a = this.action;
    if (a) {
      const prevT = a.t;
      a.t += dt;
      if (a.lunge && a.t > a.lunge.t0 && prevT < a.lunge.t1) {
        const span = a.lunge.t1 - a.lunge.t0;
        const f = (Math.min(a.t, a.lunge.t1) - Math.max(prevT, a.lunge.t0)) / span;
        const ang = a.ang;
        // stop lunging into an enemy we're already touching
        const blocked = g.world.hostiles().some((m) => !m.dead && Math.hypot(m.x - this.x, m.y - this.y) < m.radius + this.radius + 4);
        if (!blocked) map.moveCircle(this, Math.cos(ang) * a.lunge.dist * f, Math.sin(ang) * a.lunge.dist * f);
      }
      if (a.ghostEvery) this.stepGhost(dt, a.ghostEvery);
      if (a.update) a.update(a.t, dt);
      for (const ev of a.events) if (!ev.done && a.t >= ev.t) { ev.done = true; ev.fn(); }
      if (a.t >= a.dur) this.endAction();
      this.facing = a.ang ?? this.facing;
    } else if (this.dodging) {
      this.facing = this.dodgeAng;
    } else if (this.moving) {
      this.facing = Math.atan2(this.vy, this.vx);
    }

    // ---- animation selection
    let anim, at;
    if (this.hurtT > 0) { anim = 'hurt'; at = 1 - this.hurtT / 0.2; }
    else if (this.action) { anim = this.action.anim; at = this.action.t / this.action.dur; }
    else if (this.dodging) { anim = 'dodge'; at = this.dodgeT / DODGE_TIME; }
    else if (this.moving) { anim = this.sprinting ? 'run' : 'walk'; at = this.animT; }
    else { anim = 'idle'; at = 0; }
    if (anim !== this.anim) { this.anim = anim; this.animT = 0; }
    this.animT += dt;
    this.animProgress = at;

    // footsteps
    if (this.moving && !this.dodging) {
      this.stepT += dt * (this.sprinting ? 1.4 : 1);
      if (this.stepT > 0.3) {
        this.stepT = 0;
        g.vfx.particle(this.x + rand(-4, 4), this.y, { color: 'rgba(120,110,100,0.6)', life: 0.35, size: 3, vy: -8, drag: 4 });
        g.audio.sfx('step');
      }
    }
    // idle aura when Shadow Break is ready
    if (this.marks >= 3 && Math.random() < 0.35) {
      const a2 = rand(0, TAU);
      g.vfx.particle(this.x + Math.cos(a2) * 12, this.y - rand(0, 40), { color: '#b060ff', vy: -30, life: 0.6, size: 2, add: true });
    }
  }

  stepGhost(dt, every) {
    this.ghostAcc = (this.ghostAcc || 0) + dt;
    if (this.ghostAcc >= every) {
      this.ghostAcc = 0;
      const f = this.currentFrame('ghost');
      this.game.vfx.ghost(f, this.x, this.y, { life: 0.28, alpha: 0.5 });
    }
  }

  currentFrame(variant = 'img') {
    const dir = dir4(this.facing);
    const t = this.sprites && (this.anim === 'walk' || this.anim === 'run') ? this.animT : this.animProgress || 0;
    return this.sprites.frame(this.anim, t, dir, variant);
  }

  draw(ctx) {
    const g = this.game;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 12, 4.5, 0, 0, TAU); ctx.fill();
    if (this.marks >= 3) {
      ctx.fillStyle = `rgba(160,70,255,${0.25 + 0.15 * Math.sin(g.time * 8)})`;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, 18, 7, 0, 0, TAU); ctx.fill();
    }
    let y = this.y;
    if (this.dead) {
      const f = this.sprites.frame('death', Math.min(1, this.deathT / 0.6), dir4(this.facing));
      this.sprites.draw(ctx, f, this.x, y, Math.max(0.25, 1 - this.deathT * 0.4));
      return;
    }
    const f = this.currentFrame();
    const flicker = this.invulnT > 0 && !this.dodging && Math.floor(g.time * 20) % 2 === 0;
    this.sprites.draw(ctx, f, this.x, y, flicker ? 0.45 : 1);
    if (this.flash > 0) {
      const ff = this.currentFrame('flash');
      this.sprites.draw(ctx, ff, this.x, y, Math.min(1, this.flash * 8) * 0.8);
    }
    if (this.status.has('surge')) {
      ctx.globalCompositeOperation = 'lighter';
      this.sprites.draw(ctx, this.currentFrame('ghost'), this.x, y, 0.18 + 0.08 * Math.sin(g.time * 10));
      ctx.globalCompositeOperation = 'source-over';
    }
    // Shadow Marks above head
    if (this.marks > 0) {
      const top = this.y - 70 - this.markPulse * 4;
      for (let i = 0; i < this.maxMarks; i++) {
        const mx = this.x + (i - 1) * 9;
        const on = i < this.marks;
        ctx.fillStyle = on ? (this.marks === 3 ? '#e8b8ff' : '#b060ff') : 'rgba(60,40,80,0.7)';
        ctx.beginPath();
        ctx.moveTo(mx, top - 4); ctx.lineTo(mx + 3.5, top); ctx.lineTo(mx, top + 4); ctx.lineTo(mx - 3.5, top); ctx.closePath();
        ctx.fill();
        if (on) { ctx.strokeStyle = '#1a0828'; ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
  }
}
