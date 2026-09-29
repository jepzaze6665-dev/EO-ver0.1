import { ATTACK_SLOTS } from '../data/attackSlots.js';
import { pickTarget } from '../combat/targeting.js';
import { ENEMY_COMBAT } from '../data/enemyCombat.js';
import { Poise } from '../combat/poiseSystem.js';
import { POISE } from '../data/poise.js';
import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { MONSTERS, CORRUPT_MOD, ELITE_MOD, MONSTER_STATE as S } from './monsterTypes.js';
import { flashOf } from './monsterSprites.js';
import { frameAt } from './sheetSprites.js';
import { angleTo, wrapAngle, rand, TAU, dist, clamp, pick } from '../core/math.js';
import { remapLevel, scaleFor } from '../progression/levelScaling.js';
import { DIFFICULTY } from '../data/difficulty.js';

// Generic monster with a data-driven attack list and the state machine (names in MONSTER_STATE):
// IDLE -> PATROL -> AGGRO -> CHASE -> ATTACK -> (HIT) -> DEAD, plus RETURN when leashed / lost / stuck.
// Stats come from data (monsterTypes.js) × modifiers (corrupted, elite); drops from data/lootTables.js.
export class Monster extends Entity {
  constructor(game, typeId, x, y, opts = {}) {
    super(x, y);
    const d = MONSTERS[typeId];
    this.game = game;
    this.type = typeId;
    this.def = d;
    this.corrupted = !!opts.corrupted && !!(MONSTERS[typeId] && MONSTERS[typeId].corruptible); // data: `corruptible`
    this.elite = !!opts.elite;
    // stat modifiers multiply together (corrupted × elite × the map's own monsterMod, e.g. A3 ruins)
    const mods = [this.corrupted && CORRUPT_MOD, this.elite && ELITE_MOD, opts.areaMod].filter(Boolean);
    const cm = { hp: 1, detect: 1, power: 1, speed: 1, exp: 1, scale: 1 };
    for (const m of mods) for (const k in cm) cm[k] *= m[k] ?? 1;
    this.mod = cm;
    // LEVEL BAND (map data levelBand, progression/levelScaling.js): the map moves its monsters to a new level;
    // stats scale so the fight feels the same against a player of that level, EXP keeps kills-per-level
    const band = opts.levelBand ? remapLevel(d.level, opts.levelBand) : null;
    const ls = band ? scaleFor(d.level, band.level, band.slope) : { hp: 1, def: 1, power: 1, exp: 1 };
    // DIFFICULTY.monsterHp (data/difficulty.js): tankier field monsters by role; boss adds (summoned) stay as tuned
    if (!opts.summoned) cm.hp *= DIFFICULTY.monsterHp[d.role] ?? DIFFICULTY.monsterHp.default;
    cm.hp *= ls.hp; cm.power *= ls.power; cm.exp *= ls.exp * ((opts.levelBand && opts.levelBand.exp) || 1); // band.exp = pacing tune (tools/pacing.js)
    this.levelScale = ls;
    this.level = (band ? band.level : d.level) + (this.elite ? ELITE_MOD.level || 0 : 0) + ((opts.areaMod && opts.areaMod.level) || 0);
    this.team = TEAM.ENEMY;
    this.maxHp = this.hp = Math.round(d.hp * cm.hp);
    this.defense = Math.round(d.def * ls.def);
    this.radius = d.radius;
    this.height = d.height;
    this.mass = d.mass || 1;
    this.armor = this.maxArmor = d.armor || 0;
    this.weakness = d.weakness;
    this.superArmor = !!d.superArmor;
    this.scale = (d.scale || 1) * cm.scale;
    const sk = d.sprite + (this.corrupted ? 'C' : '');
    this.sprites = game.monsterSprites[sk] || game.monsterSprites[d.sprite];
    this.home = { x, y };
    this.spawnRef = opts.spawn || null;
    this.state = S.IDLE;
    this.stateT = rand(0.5, 2);
    this.stuckT = 0; this.lastPos = { x, y };
    this.facing = rand(0, TAU);
    this.cds = {};
    // POISE (combat/poiseSystem.js, rules data/poise.js): hits wear it down, at 0 the monster STAGGERS
    this.poise = new Poise((d.poise ?? d.staggerMax) * (this.elite ? 2 : 1), POISE.monster);
    this.animT = rand(0, 1);
    this.patrolTarget = null;
    this.alertT = 0;
    this.deathT = 0;
    this.lastSeen = 0;
    this.aggro = false;
    this.summoned = !!opts.summoned;
    this.showBar = 0;
  }
  // spec field names (read-only views of the data; gameplay keeps using def / mod)
  get name() { return (this.elite ? 'Elite ' : '') + this.def.name; }
  get attack() { return Math.max(...this.def.attacks.map((a) => a.power)) * this.mod.power; }
  get movementSpeed() { return this.def.speed * this.mod.speed; }
  get aggroRange() { return this.def.detect * this.mod.detect; }
  get attackRange() { return Math.max(...this.def.attacks.map((a) => a.range)); }
  get expReward() { return Math.round(this.def.exp * this.mod.exp); }
  get lootTable() { return this.elite && ELITE_MOD.loot ? [this.def.loot, ELITE_MOD.loot] : this.def.loot; }

  // weakPoint: true / 'back' = the core on its back (crystal beasts) · 'front' = a chest crystal (golems): risky, it attacks that way
  weakPointHit(ax, ay) {
    if (!this.def.weakPoint) return false;
    const diff = Math.abs(wrapAngle(angleTo(this.x, this.y, ax, ay) - this.facing));
    return this.def.weakPoint === 'front' ? diff < 1.1 : diff > 1.9;
  }
  // SHIELD (data `shield: { arc, mult, hp, breakTime, regen }`): hits from the front are mostly blocked (combat asks
  // tryBlock like a guarding player). Blocked damage wears the shield down (heavy hits twice as fast); at 0 it
  // breaks: stunned + vulnerable. Flank or strike its back and the shield never helps.
  tryBlock(src) {
    const sh = this.def.shield;
    if (!sh || !src || this.dead || this.shieldBroken || !this.status.canAct() || this.status.has('vulnerable')) return null;
    if (this.state === S.ATTACK && this.phase !== 'windup') return null; // committed to a swing: open
    return Math.abs(wrapAngle(angleTo(this.x, this.y, src.x, src.y) - this.facing)) <= sh.arc ? { mult: sh.mult, perfect: false } : null;
  }
  onBlock(block, src, opts, ang, raw) {
    const g = this.game, sh = this.def.shield;
    this.aggro = true;
    this.shieldHp = (this.shieldHp ?? sh.hp) - raw * (opts.big || (opts.stagger || 0) >= 20 ? 2 : 1);
    g.vfx.spark(this.x, this.y - this.height * 0.5, ang + Math.PI, '#ffd070', 8);
    if ((this.blockTextT || 0) <= g.time) { this.blockTextT = g.time + 1.2; g.vfx.text(this.x, this.y - this.height - 8, 'BLOCKED — flank it', { color: '#ffd070', size: 9 }); }
    g.audio.sfx('block');
    if (this.shieldHp > 0) return;
    this.shieldBroken = true; this.shieldRegen = sh.regen || 8;
    this.status.add('stun', sh.breakTime || 2.2); this.status.add('vulnerable', sh.breakTime || 2.2);
    this.interrupt(sh.breakTime || 2.2);
    g.vfx.shards(this.x, this.y - 20, '#ffd070', 24, 200);
    g.vfx.text(this.x, this.y - this.height - 14, 'SHIELD BROKEN!', { color: '#ffe8a0', size: 12 });
    g.events.emit('poiseBroken', { target: this, source: src });
  }
  onArmorBreak() {
    const g = this.game;
    this.status.add('stun', 2.6);
    this.status.add('vulnerable', 2.6);
    this.armorRegen = 11;
    this.interrupt(2.6);
    g.vfx.shards(this.x, this.y - 20, this.def.shardColor || '#5af0ff', 30, 220);
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
    if (this.state === S.IDLE || this.state === S.PATROL || this.state === S.RETURN) this.setState(S.CHASE);
    const heavy = !!(this.cur && this.cur.heavy && this.phase === 'windup'); // heavy wind-up = armoured
    if (this.poise.hit(opts.stagger, { heavy, big: opts.big, counter: this.status.has('counter_window'), canBreak: !this.superArmor })) {
      this.interrupt(POISE.monster.breakTime);
      g.vfx.text(this.x, this.y - this.height - 8, 'STAGGER', { color: '#ffe6a0', size: 9 });
      g.events.emit('poiseBroken', { target: this, source: src });
    }
    const en = this.def.enrage;
    if (en && !this.enraged && !this.dead && this.hp > 0 && this.hp <= this.maxHp * en.below) {
      this.enraged = true; this.enrageT = en.time || 0.6;
      this.mod.speed *= en.speed || 1; this.mod.power *= en.power || 1;
      g.vfx.text(this.x, this.y - this.height - 8, 'ENRAGED', { color: '#ff6a5a', size: 9 });
      g.events.emit('monsterEnraged', { monster: this });
    }
    if (this.def.blinkWhenHit) { // data: blinks away after that many hits (casters that keep their distance)
      this.hitCount = (this.hitCount || 0) + 1;
      if (this.hitCount >= this.def.blinkWhenHit && this.state !== S.ATTACK) { this.hitCount = 0; this.blink(); }
    }
  }
  interrupt(t) {
    this.game.combat.telegraphs.cancelOwner(this);
    this.cur = null;
    this.setState(S.HIT);
    this.hurtLen = t;
  }
  onDeath(src) {
    this.game.attackSlots.release(this, true);
    this.dead = true;
    this.deathT = 0;
    this.state = S.DEAD;
    this.game.combat.telegraphs.cancelOwner(this);
    this.game.world.onMonsterKilled(this, src);
  }

  setState(s) {
    if (this.state === S.ATTACK && s !== S.ATTACK) this.game.attackSlots.release(this); // attack over: give the slot back
    this.state = s;
    this.stateT = 0;
  }

  // ---------------- update
  update(dt) {
    const g = this.game, map = g.world.map;
    // TARGET (combat/targeting.js): who to fight among the players (solo = the one player; party-ready)
    this.retargetT = (this.retargetT || 0) - dt;
    if (!this.target || this.target.dead || this.retargetT <= 0) { this.target = pickTarget(this, g.players()) || g.player; this.retargetT = ATTACK_SLOTS.retargetEvery; }
    const p = this.target;
    this.animT += dt;
    if (this.enrageT > 0) this.enrageT -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.showBar = Math.max(0, this.showBar - dt);
    this.poise.update(dt);
    if (this.dead) { this.deathT += dt; return; }
    this.status.update(dt);
    this.applyKnockback(dt, map);
    for (const k in this.cds) this.cds[k] -= dt;
    if (this.shieldBroken) { this.shieldRegen -= dt; if (this.shieldRegen <= 0) { this.shieldBroken = false; this.shieldHp = this.def.shield.hp; } }
    if (this.armorRegen !== undefined && this.armor <= 0) {
      this.armorRegen -= dt;
      if (this.armorRegen <= 0) { this.armor = this.maxArmor; this.armorRegen = undefined; this.armorWarned = false; g.vfx.burst(this.x, this.y - 20, '#5af0ff', 14, 60); }
    }
    if (this.corrupted && Math.random() < 0.06) g.vfx.particle(this.x + rand(-8, 8), this.y - rand(4, this.height), { color: '#9a40ff', vy: -20, life: 0.6, size: 2, add: true });

    if (!this.status.canAct()) { this.moving = false; return; }
    const dP = dist(this.x, this.y, p.x, p.y);
    const speed = this.def.speed * this.mod.speed * this.status.moveMult();
    const detect = this.def.detect * this.mod.detect;
    // taunt (status flag): drop everything and fight the taunter
    if (this.status.flag('taunted') && !p.dead && (this.state === S.IDLE || this.state === S.PATROL || this.state === S.RETURN || this.state === S.AGGRO)) { this.aggro = true; this.setState(S.CHASE); }
    this.moving = false;
    this.stateT += dt;

    switch (this.state) {
      case S.IDLE:
        if (this.stateT > 2.5) { this.patrolTarget = this.pickPatrol(); this.setState(S.PATROL); }
        this.lookForPlayer(dP, detect);
        break;
      case S.PATROL: {
        const t = this.patrolTarget;
        if (!t || this.moveTo(t.x, t.y, speed * 0.45, dt) < 6 || this.stateT > 5) this.setState(S.IDLE);
        this.lookForPlayer(dP, detect);
        break;
      }
      case S.AGGRO:
        this.turnTo(angleTo(this.x, this.y, p.x, p.y), dt, 10);
        if (this.stateT > 0.4) this.setState(S.CHASE);
        break;
      case S.CHASE: {
        if (p.dead || g.world.inSafeZone(p)) { this.setState(S.RETURN); break; }
        // stealth (status flag): lose track unless the player is right next to us, never commit an attack
        const hidden = p.status.flag('stealth') && !this.status.flag('taunted');
        if (hidden && dP > 70) {
          this.aggro = false; this.setState(S.RETURN);
          g.vfx.text(this.x, this.y - this.height - 10, '?', { color: '#c8b8e8', size: 13, life: 0.8 }); // lost track
          break;
        }
        const fromHome = dist(this.x, this.y, this.home.x, this.home.y);
        if (fromHome > this.def.leash && !this.summoned) { this.setState(S.RETURN); break; }
        // stuck on a wall (trying to move but not getting closer for a while) -> give up and go home
        if (this.stuckT > 2.5 && !this.summoned) { this.stuckT = 0; this.aggro = false; this.setState(S.RETURN); break; }
        const ang = angleTo(this.x, this.y, p.x, p.y);
        const atk = hidden ? null : this.chooseAttack(dP);
        // ATTACK SLOTS (combat/attackSlots.js): only a few enemies may attack one player at once — the rest wait
        if (atk && (this.def.boss || g.attackSlots.request(this, p, g.attackSlots.costOf(atk)))) { this.waiting = false; this.startAttack(atk); break; }
        this.waiting = !!atk;
        if (this.waiting && !this.def.keepAway) {
          // hold just outside reach and circle — repositioning instead of piling in
          const hold = (this.def.attacks[0].range || 40) * ATTACK_SLOTS.waitRange, side = this.id % 2 ? 1 : -1;
          this.moveDir(dP < hold ? ang + Math.PI + side * 0.9 : ang + side * Math.PI / 2, speed * 0.55, dt);
          this.turnTo(ang, dt, this.def.turn);
          break;
        }
        // approach / keep-away
        const want = this.def.keepAway;
        if (want && dP < want) {
          this.moveDir(ang + Math.PI, speed * 0.8, dt);
        } else if (dP > (this.def.attacks[0].range * 0.8)) {
          // flankers (data flank) go for the player's side / back instead of walking into its face
          const fl = ENEMY_COMBAT.flank;
          if (this.def.flank && dP < fl.range) {
            // orbit around the player toward its back (never straight through its face), then close in
            const side = this.id % 2 ? 1 : -1, back = p.facing + Math.PI + side * fl.angle;
            const cur = angleTo(p.x, p.y, this.x, this.y), diff = wrapAngle(back - cur), step = clamp(diff, -0.9, 0.9);
            const r = Math.abs(diff) > 0.5 ? clamp(dP, fl.dist + 30, 90) : fl.dist;
            const tx = p.x + Math.cos(cur + step) * r, ty = p.y + Math.sin(cur + step) * r;
            this.moveDir(angleTo(this.x, this.y, tx, ty), speed, dt);
          } else this.moveDir(ang, speed, dt);
        }
        this.turnTo(ang, dt, this.def.turn);
        break;
      }
      case S.ATTACK:
        this.updateAttack(dt);
        break;
      case S.HIT:
        if (this.stateT > (this.hurtLen || 0.35)) this.setState(S.CHASE);
        break;
      case S.RETURN: {
        const d2 = this.moveTo(this.home.x, this.home.y, speed * 0.9, dt);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
        if (d2 < 10 || this.stateT > 8) {
          // could not walk home (blocked): snap back so it never stays wedged in a wall
          if (d2 >= 10) { const pos = map.findOpen(this.home.x, this.home.y, 4); this.x = pos.x; this.y = pos.y; }
          this.aggro = false; this.setState(S.IDLE);
        }
        break;
      }
    }
    // stuck detection: moving in CHASE but barely changing position
    if (this.state === S.CHASE && this.moving) {
      const moved = dist(this.x, this.y, this.lastPos.x, this.lastPos.y);
      this.stuckT = moved < speed * dt * 0.15 ? this.stuckT + dt : Math.max(0, this.stuckT - dt * 2);
    } else this.stuckT = 0;
    this.lastPos.x = this.x; this.lastPos.y = this.y;
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
    const g = this.game, p = this.target || g.player;
    if (p.dead || g.world.inSafeZone(p)) return;
    if (p.status.flag('stealth')) detect *= 0.3; // a stealthed player is only noticed up close
    if (dP < detect && g.world.map.lineOfSight(this.x, this.y - 8, p.x, p.y - 8)) {
      this.setState(S.AGGRO);
      this.aggro = true;
      g.knowledge.encounter(this.type);
      g.vfx.text(this.x, this.y - this.height - 10, '!', { color: '#ff5050', size: 14, life: 0.6 });
      // alert pack mates
      for (const o of g.world.monsters) if (o !== this && !o.dead && !o.aggro && dist(o.x, o.y, this.x, this.y) < 150) { o.aggro = true; o.setState(S.AGGRO); }
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
    // skirmishers punish a player standing still: their `punish` attack ignores its cooldown
    const punish = this.def.punishIdle && ((this.target || this.game.player).idleT || 0) >= this.def.punishIdle;
    const opts = this.def.attacks.filter((a) => ((this.cds[a.id] || 0) <= 0 || (punish && a.punish)) && dP <= a.range && dP >= a.min && this.hasAlly(a.needsAlly));
    if (!opts.length) return null;
    const team = opts.filter((a) => a.needsAlly); // formation attacks win when the formation is there
    if (team.length && Math.random() < 0.6) return pick(team);
    // the slow-turning beasts only attack what is roughly in front of them (their back stays exposed)
    if (this.def.turn < 3) {
      const p = this.target || this.game.player;
      if (Math.abs(wrapAngle(angleTo(this.x, this.y, p.x, p.y) - this.facing)) > 0.6 && this.stateT < 2.5) return null;
    }
    return pick(opts);
  }

  // needsAlly { type, within }: another living monster of that type close by (phalanx)
  hasAlly(n) {
    if (!n) return true;
    return this.game.world.monsters.some((o) => o !== this && !o.dead && o.type === n.type && dist(o.x, o.y, this.x, this.y) <= n.within);
  }
  startAttack(atk) {
    const g = this.game, p = this.target || g.player;
    this.cur = atk;
    this.bounced = 0; this.steered = 0;
    this.missed = false;
    this.phase = 'windup';
    this.setState(S.ATTACK);
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
      if (!g.combat.enemyStrike(this, this.curShape, power, { knock: atk.knock, guardBreak: atk.guardBreak ?? atk.heavy, unblockable: atk.unblockable, status: atk.status })) this.onMiss(atk);
      this.phase = 'recover';
      this.stateT = 0;
      if (atk.shape.shape === 'circle' || atk.shape.shape === 'ring') {
        g.vfx.ring(this.curShape.x, this.curShape.y, 4, atk.shape.r, { color: this.type.startsWith('crystal') ? '120,240,255' : '255,200,160', life: 0.3 });
        g.camera.shake(0.15);
      }
      g.audio.sfx(atk.heavy ? 'slam' : 'enemy_swing');
      if (atk.shape.shape === 'ring') g.vfx.shards(this.x, this.y - 6, '#5af0ff', 14, 150);
      if (atk.exposes) { this.status.add('vulnerable', atk.exposes); g.vfx.text(this.x, this.y - this.height - 8, atk.exposeText || 'CORE EXPOSED!', { color: '#ff9ad8', size: 10 }); }
      if (atk.opening) { this.status.add('vulnerable', atk.recover); g.vfx.text(this.x, this.y - this.height - 8, 'OPENING!', { color: '#ffe070', size: 10 }); }
      if (atk.blinkAfter) g.after(0.3, () => !this.dead && this.blink());
      if (atk.leaves) g.world.spawnSpikes(this.curShape.x, this.curShape.y, atk.leaves);
    } else if (atk.kind === 'dash') {
      this.phase = 'active';
      this.stateT = 0;
      this.dashHit = false;
      g.audio.sfx('dash_enemy');
    } else if (atk.kind === 'volley') {
      const n = atk.count;
      for (let i = 0; i < n; i++) {
        const a = this.facing + (n > 1 ? (i / (n - 1) - 0.5) * atk.spread : 0);
        g.combat.projectiles.fire({ x: this.x + Math.cos(a) * 16, y: this.y - this.height * 0.5, vx: Math.cos(a) * atk.speed, vy: Math.sin(a) * atk.speed, r: 5, life: 2.2, owner: this, power, kind: atk.projKind || 'shard', homing: atk.homing || 0, color: atk.projColor || (atk.projKind === 'orb' ? '#c080ff' : '#5af0ff') });
      }
      this.phase = 'recover';
      this.stateT = 0;
    }
  }

  updateAttack(dt) {
    const g = this.game, atk = this.cur;
    if (!atk) { this.setState(S.CHASE); return; }
    if (this.phase === 'windup') {
      // light tracking during early windup for fast monsters
      if (this.def.turn >= 8 && this.stateT < atk.windup * 0.35 && atk.kind !== 'dash') {
        const p = this.target || g.player;
        this.turnTo(angleTo(this.x, this.y, p.x, p.y), dt, 3);
      }
      if (atk.kind === 'dash' && this.stateT < atk.windup * 0.5) {
        // jitter to sell the crouch
        this.shakeX = Math.sin(this.stateT * 80) * 1;
      }
      return;
    }
    if (this.phase === 'active') {
      // steer: the charge bends toward the target, up to steerMax radians in total (it can curve once)
      if (atk.steer && !this.dashHit) {
        const p = this.target || g.player, want = wrapAngle(angleTo(this.x, this.y, p.x, p.y) - this.curShape.ang);
        const step = clamp(want, -atk.steer * dt, atk.steer * dt);
        if (this.steered + Math.abs(step) <= (atk.steerMax ?? 0.9)) { this.curShape.ang += step; this.steered += Math.abs(step); this.facing = this.curShape.ang; }
      }
      const ang = this.curShape.ang;
      const sp = atk.shape.len / atk.dashTime;
      const wall = this.game.world.map.moveCircle(this, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
      this.moving = true;
      // bounces: a roll ricochets off walls (and can hit again) — read the wall, not only the line
      if (wall && atk.bounces && this.bounced < atk.bounces) {
        this.bounced++;
        this.curShape.ang = ang + Math.PI + rand(-0.6, 0.6); this.facing = this.curShape.ang;
        this.stateT = Math.max(0, this.stateT - atk.dashTime * 0.6);
        this.dashHit = false;
        g.vfx.ring(this.x, this.y, 6, 40, { color: '220,200,160', life: 0.3, width: 4 }); g.camera.shake(0.15); g.audio.sfx('slam');
        g.vfx.text(this.x, this.y - this.height - 6, 'BOUNCE', { color: '#e8d8b0', size: 8, life: 0.5 });
      }
      if (!this.dashHit) {
        const hitShape = { shape: 'circle', x: this.x, y: this.y, r: this.radius + 6 };
        if (g.combat.enemyStrike(this, hitShape, atk.power * this.mod.power, { knock: atk.knock ?? 220, knockAng: ang, guardBreak: atk.guardBreak, status: atk.status })) this.dashHit = true;
        else if (g.players().some((q) => q.invulnerable() && Math.hypot(q.x - this.x, q.y - this.y) < this.radius + 20)) this.dashHit = true;
      }
      if (Math.random() < 0.6) g.vfx.particle(this.x, this.y, { color: 'rgba(140,130,120,0.6)', life: 0.3, size: 3, vy: -10 });
      if (this.stateT >= atk.dashTime) {
        this.phase = 'recover'; this.stateT = 0;
        if (!this.dashHit) this.onMiss(atk);
        // exposes: a vulnerable window after the dash (weak-point monsters also turn their back core to you)
        if (atk.exposes) { this.status.add('vulnerable', atk.exposes); if (this.def.weakPoint) this.facing += Math.PI * 0.6; g.vfx.text(this.x, this.y - this.height - 8, atk.exposeText || 'CORE EXPOSED!', { color: '#ff9ad8', size: 10 }); }
      }
      return;
    }
    // recover (longer after a miss — data/enemyCombat.js)
    if (this.stateT >= atk.recover * (this.missed ? atk.missRecover ?? ENEMY_COMBAT.missRecoverMult : 1)) {
      this.cds[atk.id] = atk.cd;
      for (const a of this.def.attacks) this.cds[a.id] = Math.max(this.cds[a.id] || 0, 0.4);
      this.cur = null;
      this.setState(S.CHASE);
    }
  }

  // the attack hit nobody: longer recovery + a Counter Window for the player (combat/counterSystem.js)
  onMiss(atk) {
    const g = this.game;
    this.missed = true;
    g.vfx.text(this.x, this.y - this.height - 8, 'MISS', { color: '#c8c8d8', size: 9, life: 0.6 });
    g.events.emit('attackMissed', { attacker: this, player: this.target || g.player, attack: atk.id });
  }

  blink() {
    const g = this.game, p = this.target || g.player, map = g.world.map;
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
  // sheet art (data/monsterArt.js): whole animations — the wind-up frames are spread over the telegraph (STARTUP),
  // the attack frames play through ACTIVE / RECOVERY, death plays before the corpse fades
  sheetFrame(set) {
    const atk = this.cur, per = atk && set.attacks[atk.id];
    if (this.dead) return set.death ? frameAt(set.death, this.deathT, set.death.length / 0.55, false) : set.hurt[0];
    if (this.state === S.HIT || this.status.has('stun')) return frameAt(set.hurt, this.stateT, 10, false);
    if (this.enrageT > 0 && set.anims.enrage && this.state !== S.ATTACK) return frameAt(set.anims.enrage, (this.def.enrage.time || 0.6) - this.enrageT, 8, false);
    if (this.state === S.ATTACK && atk) {
      if (this.phase === 'windup') {
        const w = (per && per.windup) || set.windup;
        return w[Math.min(w.length - 1, Math.floor((this.stateT / Math.max(0.05, atk.windup)) * w.length))];
      }
      const a = (per && per.attack) || set.attack;
      return this.phase === 'active' ? frameAt(a, this.stateT, 14) : frameAt(a, this.stateT, 12, false);
    }
    // facing the camera / away from it: front / back rows when the sheet has them
    const sy = Math.sin(this.facing);
    const v = Math.abs(sy) > 0.8 ? (sy > 0 ? set.anims.front : set.anims.back) : null;
    if (this.moving) return frameAt(v || set.move, this.animT, set.fps.move);
    return frameAt(v || set.idle, this.animT, set.fps.idle);
  }
  draw(ctx) {
    const g = this.game;
    const set = this.frameSet();
    let fr;
    if (set.sheet) fr = this.sheetFrame(set);
    else if (this.dead) fr = set.hurt[0];
    else if (this.state === S.HIT || this.status.has('stun')) fr = set.hurt[0];
    else if (this.state === S.ATTACK) {
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
    if (this.dead) alpha = set.sheet ? Math.max(0, 1 - Math.max(0, this.deathT - 0.5) / 0.3) : Math.max(0, 1 - this.deathT / 0.6);
    // shadow
    ctx.fillStyle = `rgba(0,0,0,${0.35 * alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, this.radius * 1.2, this.radius * 0.45, 0, 0, TAU); ctx.fill();
    // fliers bob; walkers whose sheet has only 1-2 walk frames get a small step bounce (legs never look frozen)
    const floatY = this.def.float ? Math.sin(this.animT * 3) * 3 - 6
      : set.sheet && this.moving && !this.dead && this.state !== S.ATTACK && set.move.length <= 2 ? -Math.abs(Math.sin(this.animT * 9)) * 2.5 : 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + floatY);
    if (flip) ctx.scale(-1, 1);
    if (this.dead && !set.sheet) ctx.rotate(Math.min(1, this.deathT * 3) * 0.4);
    ctx.drawImage(fr, -ax, -ay, w, h);
    if (this.flash > 0 || (this.dead && this.deathT < (set.sheet ? 0.12 : 0.4))) {
      ctx.globalAlpha = this.dead ? Math.max(0, (set.sheet ? 0.5 : 0.8) - this.deathT * (set.sheet ? 4 : 2)) : Math.min(1, this.flash * 10);
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
      const side = this.def.weakPoint === 'front' ? 1 : -1;
      const bx = x + side * Math.cos(this.facing) * this.radius * 1.1, by = y - this.height * 0.45;
      ctx.fillStyle = `rgba(255,150,220,${0.4 + 0.3 * Math.sin(g.time * 5)})`;
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
    }
  }
}
