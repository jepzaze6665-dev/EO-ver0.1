import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { MONSTERS, CORRUPT_MOD } from './monsterTypes.js';
import { flashOf } from './monsterSprites.js';
import { angleTo, wrapAngle, rand, TAU, dist, clamp, pick } from '../core/math.js';

// Generic monster with a data-driven attack list and the state machine:
// IDLE -> PATROL -> DETECT -> CHASE -> ATTACK -> (HURT) -> DEATH, plus RETURN when leashed.
export class Monster extends Entity {
  constructor(game, typeId, x, y, opts = {}) {
    super(x, y);
    const d = MONSTERS[typeId];
    this.game = game;
    this.type = typeId;
    this.def = d;
    this.corrupted = !!opts.corrupted && (typeId === 'wolf' || typeId === 'goblin');
    const cm = this.corrupted ? CORRUPT_MOD : { hp: 1, detect: 1, power: 1, speed: 1 };
    this.mod = cm;
    this.team = TEAM.ENEMY;
    this.maxHp = this.hp = Math.round(d.hp * cm.hp);
    this.defense = d.def;
    this.radius = d.radius;
    this.height = d.height;
    this.mass = d.mass || 1;
    this.armor = this.maxArmor = d.armor || 0;
    this.weakness = d.weakness;
    this.superArmor = !!d.superArmor;
    this.scale = d.scale || 1;
    const sk = d.sprite + (this.corrupted ? 'C' : '');
    this.sprites = game.monsterSprites[sk] || game.monsterSprites[d.sprite];
    this.home = { x, y };
    this.spawnRef = opts.spawn || null;
    this.state = 'idle';
    this.stateT = rand(0.5, 2);
    this.facing = rand(0, TAU);
    this.cds = {};
    this.stagger = 0;
    this.animT = rand(0, 1);
    this.patrolTarget = null;
    this.alertT = 0;
    this.deathT = 0;
    this.lastSeen = 0;
    this.aggro = false;
    this.summoned = !!opts.summoned;
    this.showBar = 0;
  }
  weakPointHit(ax, ay) {
    if (!this.def.weakPoint) return false;
    const toAttacker = angleTo(this.x, this.y, ax, ay);
    return Math.abs(wrapAngle(toAttacker - this.facing)) > 1.9;
  }
  onArmorBreak() {
    const g = this.game;
    this.status.add('stun', 2.6);
    this.status.add('vulnerable', 2.6);
    this.armorRegen = 11;
    this.interrupt(2.6);
    g.vfx.shards(this.x, this.y - 20, this.type === 'crystal_alpha' ? '#c080ff' : '#5af0ff', 30, 220);
    g.vfx.text(this.x, this.y - 60, 'ARMOR BROKEN!', { color: '#9af4ff', size: 12 });
    g.vfx.ring(this.x, this.y, 10, 60, { color: '120,240,255', life: 0.4 });
    g.camera.shake(0.3);
    g.audio.sfx('shatter');
  }

  // ---------------- events from combat
  onHurt(amount, src, opts) {
    const g = this.game;
    this.showBar = 4;
    this.aggro = true;
    g.knowledge.encounter(this.type);
    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'return') this.setState('chase');
    this.stagger += opts.stagger || 5;
    const canStagger = !this.superArmor && !(this.cur && this.cur.heavy && this.phase === 'windup' && this.stagger < this.def.staggerMax * 2);
    if (this.stagger >= this.def.staggerMax && canStagger) {
      this.stagger = 0;
      this.interrupt(0.35);
      g.vfx.text(this.x, this.y - this.height - 8, 'STAGGER', { color: '#ffe6a0', size: 9 });
    }
    if (this.type === 'wraith') {
      this.hitCount = (this.hitCount || 0) + 1;
      if (this.hitCount >= 4 && this.state !== 'attack') { this.hitCount = 0; this.blink(); }
    }
  }
  interrupt(t) {
    this.game.combat.telegraphs.cancelOwner(this);
    this.cur = null;
    this.setState('hurt');
    this.hurtLen = t;
  }
  onDeath(src) {
    this.dead = true;
    this.deathT = 0;
    this.game.combat.telegraphs.cancelOwner(this);
    this.game.world.onMonsterKilled(this, src);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  // ---------------- update
  update(dt) {
    const g = this.game, map = g.world.map, p = g.player;
    this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.showBar = Math.max(0, this.showBar - dt);
    if (this.dead) { this.deathT += dt; return; }
    this.status.update(dt);
    this.applyKnockback(dt, map);
    for (const k in this.cds) this.cds[k] -= dt;
    if (this.armorRegen !== undefined && this.armor <= 0) {
      this.armorRegen -= dt;
      if (this.armorRegen <= 0) { this.armor = this.maxArmor; this.armorRegen = undefined; this.armorWarned = false; g.vfx.burst(this.x, this.y - 20, '#5af0ff', 14, 60); }
    }
    if (this.corrupted && Math.random() < 0.06) g.vfx.particle(this.x + rand(-8, 8), this.y - rand(4, this.height), { color: '#9a40ff', vy: -20, life: 0.6, size: 2, add: true });

    if (!this.status.canAct()) { this.moving = false; return; }
    const dP = dist(this.x, this.y, p.x, p.y);
    const speed = this.def.speed * this.mod.speed * this.status.moveMult();
    const detect = this.def.detect * this.mod.detect * (g.player.sprinting ? 1.15 : 1);
    // taunt (status flag): drop everything and fight the taunter
    if (this.status.flag('taunted') && !p.dead && (this.state === 'idle' || this.state === 'patrol' || this.state === 'return' || this.state === 'alert')) { this.aggro = true; this.setState('chase'); }
    this.moving = false;
    this.stateT += dt;

    switch (this.state) {
      case 'idle':
        if (this.stateT > 2.5) { this.patrolTarget = this.pickPatrol(); this.setState('patrol'); }
        this.lookForPlayer(dP, detect);
        break;
      case 'patrol': {
        const t = this.patrolTarget;
        if (!t || this.moveTo(t.x, t.y, speed * 0.45, dt) < 6 || this.stateT > 5) this.setState('idle');
        this.lookForPlayer(dP, detect);
        break;
      }
      case 'alert':
        this.turnTo(angleTo(this.x, this.y, p.x, p.y), dt, 10);
        if (this.stateT > 0.4) this.setState('chase');
        break;
      case 'chase': {
        if (p.dead || g.world.inSafeZone(p)) { this.setState('return'); break; }
        // stealth (status flag): lose track unless the player is right next to us, never commit an attack
        const hidden = p.status.flag('stealth') && !this.status.flag('taunted');
        if (hidden && dP > 70) {
          this.aggro = false; this.setState('return');
          g.vfx.text(this.x, this.y - this.height - 10, '?', { color: '#c8b8e8', size: 13, life: 0.8 }); // lost track
          break;
        }
        const fromHome = dist(this.x, this.y, this.home.x, this.home.y);
        if (fromHome > this.def.leash && !this.summoned) { this.setState('return'); break; }
        const ang = angleTo(this.x, this.y, p.x, p.y);
        const atk = hidden ? null : this.chooseAttack(dP);
        if (atk) { this.startAttack(atk); break; }
        // approach / keep-away
        const want = this.def.keepAway;
        if (want && dP < want) {
          this.moveDir(ang + Math.PI, speed * 0.8, dt);
        } else if (dP > (this.def.attacks[0].range * 0.8)) {
          // wolves circle a little while approaching
          // wolves circle the player while their charge recharges, then commit
          const circling = this.type === 'wolf' && dP < 150 && (this.cds.lunge || 0) > 0;
          const side = this.id % 2 ? 1 : -1;
          this.moveDir(circling ? ang + side * 1.25 : ang, circling ? speed * 0.8 : speed, dt);
        }
        this.turnTo(ang, dt, this.def.turn);
        break;
      }
      case 'attack':
        this.updateAttack(dt);
        break;
      case 'hurt':
        if (this.stateT > (this.hurtLen || 0.35)) this.setState('chase');
        break;
      case 'return': {
        const d2 = this.moveTo(this.home.x, this.home.y, speed * 0.9, dt);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
        if (d2 < 10 || this.stateT > 8) { this.aggro = false; this.setState('idle'); }
        break;
      }
    }
    // separation from other monsters
    for (const o of g.world.monsters) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x, dy = this.y - o.y, rr = this.radius + o.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        map.moveCircle(this, (dx / d) * push, (dy / d) * push);
      }
    }
  }

  lookForPlayer(dP, detect) {
    const g = this.game, p = g.player;
    if (p.dead || g.world.inSafeZone(p)) return;
    if (p.status.flag('stealth')) detect *= 0.3; // a stealthed player is only noticed up close
    if (dP < detect && g.world.map.lineOfSight(this.x, this.y - 8, p.x, p.y - 8)) {
      this.setState('alert');
      this.aggro = true;
      g.knowledge.encounter(this.type);
      g.vfx.text(this.x, this.y - this.height - 10, '!', { color: '#ff5050', size: 14, life: 0.6 });
      // alert pack mates
      for (const o of g.world.monsters) if (o !== this && !o.dead && !o.aggro && dist(o.x, o.y, this.x, this.y) < 150) { o.aggro = true; o.setState('alert'); }
    }
  }

  pickPatrol() {
    const map = this.game.world.map;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU), r = rand(20, 90);
      const x = this.home.x + Math.cos(a) * r, y = this.home.y + Math.sin(a) * r;
      if (!map.circleBlocked(x, y, this.radius)) return { x, y };
    }
    return { x: this.home.x, y: this.home.y };
  }

  moveTo(x, y, speed, dt) {
    const d = dist(this.x, this.y, x, y);
    if (d > 2) { this.moveDir(angleTo(this.x, this.y, x, y), speed, dt); this.turnTo(angleTo(this.x, this.y, x, y), dt, this.def.turn); }
    return d;
  }
  moveDir(ang, speed, dt) {
    const blocked = this.game.world.map.moveCircle(this, Math.cos(ang) * speed * dt, Math.sin(ang) * speed * dt);
    if (blocked) this.game.world.map.moveCircle(this, Math.cos(ang + 1.2) * speed * dt * 0.6, Math.sin(ang + 1.2) * speed * dt * 0.6);
    this.moving = true;
  }
  turnTo(target, dt, rate) {
    const d = wrapAngle(target - this.facing);
    const step = rate * dt;
    this.facing = wrapAngle(this.facing + clamp(d, -step, step));
  }

  // ---------------- attacks
  chooseAttack(dP) {
    const opts = this.def.attacks.filter((a) => (this.cds[a.id] || 0) <= 0 && dP <= a.range && dP >= a.min);
    if (!opts.length) return null;
    // the slow-turning beasts only attack what is roughly in front of them (their back stays exposed)
    if (this.def.turn < 3) {
      const p = this.game.player;
      if (Math.abs(wrapAngle(angleTo(this.x, this.y, p.x, p.y) - this.facing)) > 0.6 && this.stateT < 2.5) return null;
    }
    return pick(opts);
  }

  startAttack(atk) {
    const g = this.game, p = g.player;
    this.cur = atk;
    this.phase = 'windup';
    this.setState('attack');
    if (this.def.turn >= 3) this.facing = angleTo(this.x, this.y, p.x, p.y);
    const ang = this.facing;
    const s = atk.shape;
    const off = s.offset || 0;
    const tel = { ...s, x: this.x + Math.cos(ang) * off, y: this.y + Math.sin(ang) * off, ang, total: atk.windup, owner: this };
    if (s.shape === 'line') { tel.len = s.len; tel.width = s.width; }
    this.curShape = tel;
    this.telegraph = g.combat.telegraphs.add({ ...tel, onResolve: () => this.resolveAttack() });
    if (atk.heavy) g.vfx.text(this.x, this.y - this.height - 12, '⚠', { color: '#ffb040', size: 14, life: atk.windup });
    g.audio.sfx(atk.kind === 'volley' ? 'cast' : 'windup');
  }

  resolveAttack() {
    const g = this.game, atk = this.cur;
    if (!atk || this.dead) return;
    const power = atk.power * this.mod.power;
    if (atk.kind === 'strike') {
      g.combat.enemyStrike(this, this.curShape, power, { knock: atk.knock });
      this.phase = 'recover';
      this.stateT = 0;
      if (atk.shape.shape === 'circle' || atk.shape.shape === 'ring') {
        g.vfx.ring(this.curShape.x, this.curShape.y, 4, atk.shape.r, { color: this.type.startsWith('crystal') ? '120,240,255' : '255,200,160', life: 0.3 });
        g.camera.shake(0.15);
      }
      g.audio.sfx(atk.heavy ? 'slam' : 'enemy_swing');
      if (atk.shape.shape === 'ring') g.vfx.shards(this.x, this.y - 6, '#5af0ff', 14, 150);
      if (atk.exposes) { this.status.add('vulnerable', atk.exposes); g.vfx.text(this.x, this.y - this.height - 8, 'CORE EXPOSED!', { color: '#ff9ad8', size: 10 }); }
      if (atk.opening) { this.status.add('vulnerable', atk.recover); g.vfx.text(this.x, this.y - this.height - 8, 'OPENING!', { color: '#ffe070', size: 10 }); }
      if (atk.blinkAfter) g.after(0.3, () => !this.dead && this.blink());
    } else if (atk.kind === 'dash') {
      this.phase = 'active';
      this.stateT = 0;
      this.dashHit = false;
      g.audio.sfx('dash_enemy');
    } else if (atk.kind === 'volley') {
      const n = atk.count;
      for (let i = 0; i < n; i++) {
        const a = this.facing + (n > 1 ? (i / (n - 1) - 0.5) * atk.spread : 0);
        g.combat.projectiles.fire({ x: this.x + Math.cos(a) * 16, y: this.y - this.height * 0.5, vx: Math.cos(a) * atk.speed, vy: Math.sin(a) * atk.speed, r: 5, life: 2.2, owner: this, power, kind: atk.projKind || 'shard', homing: atk.homing || 0, color: atk.projKind === 'orb' ? '#c080ff' : '#5af0ff' });
      }
      this.phase = 'recover';
      this.stateT = 0;
    }
  }

  updateAttack(dt) {
    const g = this.game, atk = this.cur;
    if (!atk) { this.setState('chase'); return; }
    if (this.phase === 'windup') {
      // light tracking during early windup for fast monsters
      if (this.def.turn >= 8 && this.stateT < atk.windup * 0.35 && atk.kind !== 'dash') {
        const p = g.player;
        this.turnTo(angleTo(this.x, this.y, p.x, p.y), dt, 3);
      }
      if (atk.kind === 'dash' && this.stateT < atk.windup * 0.5) {
        // jitter to sell the crouch
        this.shakeX = Math.sin(this.stateT * 80) * 1;
      }
      return;
    }
    if (this.phase === 'active') {
      const ang = this.curShape.ang;
      const sp = atk.shape.len / atk.dashTime;
      this.game.world.map.moveCircle(this, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
      this.moving = true;
      if (!this.dashHit) {
        const hitShape = { shape: 'circle', x: this.x, y: this.y, r: this.radius + 6 };
        if (g.combat.enemyStrike(this, hitShape, atk.power * this.mod.power, { knock: 220, knockAng: ang })) this.dashHit = true;
        else if (g.player.invulnerable() && Math.hypot(g.player.x - this.x, g.player.y - this.y) < this.radius + 20) this.dashHit = true;
      }
      if (Math.random() < 0.6) g.vfx.particle(this.x, this.y, { color: 'rgba(140,130,120,0.6)', life: 0.3, size: 3, vy: -10 });
      if (this.stateT >= atk.dashTime) {
        this.phase = 'recover'; this.stateT = 0;
        if (atk.exposes) { this.status.add('vulnerable', atk.exposes); this.facing += Math.PI * 0.6; g.vfx.text(this.x, this.y - this.height - 8, 'CORE EXPOSED!', { color: '#ff9ad8', size: 10 }); }
      }
      return;
    }
    // recover
    if (this.stateT >= atk.recover) {
      this.cds[atk.id] = atk.cd;
      for (const a of this.def.attacks) this.cds[a.id] = Math.max(this.cds[a.id] || 0, 0.4);
      this.cur = null;
      this.setState('chase');
    }
  }

  blink() {
    const g = this.game, p = g.player, map = g.world.map;
    g.vfx.burst(this.x, this.y - 20, '#c080ff', 20, 120);
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU), r = rand(110, 170);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!map.circleBlocked(x, y, this.radius) && dist(x, y, this.home.x, this.home.y) < this.def.leash) {
        this.x = x; this.y = y;
        break;
      }
    }
    g.vfx.burst(this.x, this.y - 20, '#c080ff', 20, 120);
    g.audio.sfx('blink');
  }

  // ---------------- render
  frameSet() {
    const s = this.sprites;
    return this.armor <= 0 && s.broken ? s.broken : s;
  }
  draw(ctx) {
    const g = this.game;
    const set = this.frameSet();
    let fr;
    if (this.dead) fr = set.hurt[0];
    else if (this.state === 'hurt' || this.status.has('stun')) fr = set.hurt[0];
    else if (this.state === 'attack') {
      if (this.phase === 'windup') fr = set.windup[0];
      else if (this.phase === 'active') fr = set.attack[0];
      else fr = set.attack[Math.min(set.attack.length - 1, this.stateT > 0.15 ? 1 : 0)];
    } else if (this.moving) fr = set.move[Math.floor(this.animT * (this.type === 'wolf' ? 12 : 8)) % set.move.length];
    else fr = set.idle[Math.floor(this.animT * 2) % set.idle.length];

    const flip = Math.cos(this.facing) < 0;
    const s = this.scale;
    const w = this.sprites.w * s, h = this.sprites.h * s;
    const ax = this.sprites.ax * s, ay = this.sprites.ay * s;
    const x = Math.round(this.x + (this.shakeX || 0)), y = Math.round(this.y);
    this.shakeX = 0;
    let alpha = 1;
    if (this.dead) alpha = Math.max(0, 1 - this.deathT / 0.6);
    // shadow
    ctx.fillStyle = `rgba(0,0,0,${0.35 * alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, this.radius * 1.2, this.radius * 0.45, 0, 0, TAU); ctx.fill();
    const floatY = this.def.float ? Math.sin(this.animT * 3) * 3 - 6 : 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + floatY);
    if (flip) ctx.scale(-1, 1);
    if (this.dead) ctx.rotate(Math.min(1, this.deathT * 3) * 0.4);
    ctx.drawImage(fr, -ax, -ay, w, h);
    if (this.flash > 0 || this.dead) {
      ctx.globalAlpha = this.dead ? Math.max(0, 0.8 - this.deathT * 2) : Math.min(1, this.flash * 10);
      ctx.drawImage(flashOf(fr), -ax, -ay, w, h);
    }
    if (this.status.has('vulnerable') && !this.dead) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(g.time * 14);
      ctx.drawImage(flashOf(fr), -ax, -ay, w, h);
    }
    ctx.restore();
    // weak point glint on crystal beasts
    if (this.def.weakPoint && !this.dead && this.armor > 0) {
      const bx = x - Math.cos(this.facing) * this.radius * 1.1, by = y - this.height * 0.45;
      ctx.fillStyle = `rgba(255,150,220,${0.4 + 0.3 * Math.sin(g.time * 5)})`;
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
    }
  }
}
