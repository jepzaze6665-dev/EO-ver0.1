import { TEAM } from '../core/constants.js';
import { angleTo, inCone, inLine, rand, TAU } from '../core/math.js';
import { Telegraphs } from './telegraph.js';
import { Projectiles } from './projectiles.js';
import { computeDamage } from './damageSystem.js';
import { STATUSES } from '../data/statuses.js';

// Class-agnostic combat resolver. Skills from any class spawn hitboxes described
// as data; enemies resolve telegraphed strikes through enemyStrike(). All feedback
// (hit flash, hit stop, numbers, sparks, shake, sound) is centralised here.
export const PERFECT_WINDOW = 0.2;

export class Combat {
  constructor(game) {
    this.game = game;
    this.hitboxes = [];
    this.telegraphs = new Telegraphs();
    this.projectiles = new Projectiles(game);
    this.lastCombatTime = -99;
  }

  get inCombat() { return this.game.time - this.lastCombatTime < 4; }

  // ---------------- player/ally hitboxes
  spawnHitbox(def) {
    const hb = {
      shape: 'cone', r: 40, half: 1, ang: 0, len: 0, width: 0, r0: 0,
      delay: 0, life: 0.05, power: 1, type: 'physical', knock: 120, stagger: 10,
      hitStop: 0.05, shake: 0.12, maxTargets: 99, hit: new Set(), hits: 0,
      team: TEAM.PLAYER, ...def,
    };
    if (hb.follow && hb.owner) { hb.x = hb.owner.x; hb.y = hb.owner.y; }
    this.hitboxes.push(hb);
    return hb;
  }

  hurtablesFor(team) {
    const w = this.game.world;
    if (team === TEAM.PLAYER) return w.hostiles();
    return this.game.player.dead ? [] : [this.game.player];
  }

  testShape(hb, t) {
    const tr = t.radius;
    switch (hb.shape) {
      case 'circle': return (t.x - hb.x) ** 2 + (t.y - hb.y) ** 2 < (hb.r + tr) ** 2;
      case 'ring': {
        const d = Math.hypot(t.x - hb.x, t.y - hb.y);
        return d < hb.r + tr && d > hb.r0 - tr;
      }
      case 'cone': return inCone(t.x, t.y, tr, hb.x, hb.y, hb.r, hb.ang, hb.half);
      case 'arcband': {
        // expanding crescent: between r0 and r, within half angle
        const d = Math.hypot(t.x - hb.x, t.y - hb.y);
        return d < hb.r + tr && d > hb.r0 - tr && inCone(t.x, t.y, tr, hb.x, hb.y, hb.r + 4, hb.ang, hb.half);
      }
      case 'line': return inLine(t.x, t.y, tr, hb.x, hb.y, hb.ang, hb.len, hb.width);
    }
    return false;
  }

  // statuses queue their damage ticks and events; combat turns them into real damage + bus events
  updateStatuses() {
    const g = this.game, list = [g.player, ...g.world.hostiles()];
    for (const e of list) {
      if (!e || !e.status) continue;
      for (const ev of e.status.drainEvents()) g.events.emit(ev.name, ev);
      for (const t of e.status.drainTicks()) {
        if (e.dead || !(t.amount > 0)) continue;
        const d = STATUSES[t.id];
        this.dealDamage(t.source && !t.source.dead ? t.source : null, e, { power: t.amount, flat: true, dot: true, type: t.type, statusId: t.id, color: d.display && d.display.color });
      }
    }
  }

  update(dt) {
    this.updateStatuses();
    this.telegraphs.update(dt);
    this.projectiles.update(dt);
    for (const hb of this.hitboxes) {
      if (hb.delay > 0) { hb.delay -= dt; continue; }
      if (hb.follow && hb.owner) { hb.x = hb.owner.x + (hb.ox || 0); hb.y = hb.owner.y + (hb.oy || 0); }
      if (hb.grow) hb.grow(hb, dt);
      for (const t of this.hurtablesFor(hb.team)) {
        if (t.dead || !t.hurtable || hb.hit.has(t)) continue;
        if (hb.hits >= hb.maxTargets) break;
        if (!this.testShape(hb, t)) continue;
        hb.hit.add(t);
        hb.hits++;
        const info = this.dealDamage(hb.owner, t, hb);
        if (hb.onHit) hb.onHit(t, info, hb);
      }
      hb.life -= dt;
    }
    this.hitboxes = this.hitboxes.filter((h) => h.life > 0 || h.delay > 0);
  }

  // ---------------- damage
  // src: attacker entity (player or monster). opts: power, type, knock, stagger, crit bonus, flags
  dealDamage(src, target, opts) {
    const g = this.game;
    const fromPlayer = src && src.team === TEAM.PLAYER;
    const ang = src ? angleTo(src.x, src.y, target.x, target.y) : rand(0, TAU);
    // 1) CALCULATE — pure, data in / result out (combat/damageSystem.js)
    const behind = src && target.armor > 0 && target.weakPointHit ? target.weakPointHit(src.x, src.y) : false;
    const attacker = src && src.stats ? { stats: src.stats, damageMult: src.status ? src.status.damageMult() : 1 } : null;
    const res = computeDamage(attacker, {
      defense: target.defense, stats: target.stats, weakness: target.weakness,
      vulnerable: target.status && target.status.isVulnerable(), armor: target.armor,
      damageTakenMult: target.status ? target.status.damageTakenMult() : 1,
    }, { ...opts, weakPoint: behind });
    const { crit, tags } = res;
    // shields (status 'shield') soak damage before HP
    const absorbed = target.status ? res.amount - target.status.absorb(res.amount) : 0;
    const amount = res.amount - absorbed;
    // 2) APPLY — state changes
    if (res.armorDamage) {
      target.armor = Math.max(0, target.armor - res.armorDamage);
      if (target.armor <= 0 && target.onArmorBreak) target.onArmorBreak();
    }
    target.hp -= amount;
    target.flash = 0.12;
    this.lastCombatTime = g.time;

    // knockback & stagger
    const kb = (opts.knock || 0) * (target.superArmor ? 0.15 : 1);
    if (kb > 0) target.knockback(opts.knockAng ?? ang, kb);
    // DoT ticks skip hurt reactions (no stagger / i-frames); entities may still count them via onDot
    if (opts.dot) { if (target.onDot) target.onDot(amount, src, opts); } else if (target.onHurt) target.onHurt(amount, src, opts, ang);

    // feedback
    const hx = target.x, hy = target.y - (target.height || 30) * 0.5;
    const col = fromPlayer ? (opts.type === 'shadow' ? '#c070ff' : '#e8ddff') : '#ff5050';
    if (absorbed > 0) g.vfx.text(hx, hy - 18, `-${Math.round(absorbed)} SHIELD`, { color: '#fff0a0', size: 9 });
    if (opts.dot) {
      // damage-over-time tick: small number in the status colour, no hit stop / shake / spark
      g.vfx.damage(hx, hy - 6, amount, { color: opts.color || '#ffb060', tags });
    } else if (fromPlayer) {
      g.vfx.damage(hx, hy - 6, amount, { crit, color: crit ? '#ffd24a' : '#ffffff', big: opts.big, tags });
      g.vfx.spark(hx, hy, ang, col, crit ? 12 : 7);
      g.hitStop = Math.max(g.hitStop, (opts.hitStop ?? 0.05) * (crit ? 1.4 : 1));
      g.camera.shake(opts.shake ?? 0.12);
      g.audio.sfx(crit ? 'crit' : 'hit');
      if (crit || opts.big) g.vfx.sprite('shards', hx, hy, ang, { scale: opts.big ? 0.9 : 0.55, life: 0.22 });
      if (tags.includes('weakpoint')) g.vfx.text(hx, hy - 30, 'WEAK POINT', { color: '#5af0ff', size: 10 });
      if (tags.includes('armored') && !target.armorWarned) { target.armorWarned = true; g.vfx.text(hx, hy - 30, 'ARMORED — strike its back', { color: '#9ad8ff', size: 9 }); }
    } else {
      g.vfx.damage(hx, hy - 6, amount, { crit, color: '#ff6060', big: opts.big, tags });
      g.vfx.spark(hx, hy, ang, col, crit ? 12 : 7);
      g.audio.sfx('hurt');
    }

    let killed = false;
    if (target.hp <= 0 && !target.dead) {
      target.hp = 0;
      killed = true;
      if (target.onDeath) target.onDeath(src, opts);
    }
    // 3) EVENTS — passives, quests, UI and (later) the network layer listen here
    const ev = { source: src, target, amount, crit, killed, tags, type: opts.type, skillId: opts.skillId, opts };
    g.events.emit('damageDealt', ev);
    g.events.emit('damageTaken', ev);
    if (opts.skillId) g.events.emit('skillHit', ev);
    if (killed) g.events.emit('enemyKilled', ev);
    return { amount, crit, killed, tags };
  }

  // ---------------- enemy strikes (resolved at the end of a telegraph)
  // shape: telegraph-like {shape, x,y,r,ang,half,len,width,r0}
  enemyStrike(attacker, shape, power, extra = {}) {
    const p = this.game.player;
    if (p.dead) return false;
    const hurt = { x: p.x, y: p.y, radius: p.hurtRadius || p.radius };
    const hit = this.testShape(shape, hurt) || (p.dodging && p.dodgeOrigin && this.testShape(shape, { x: p.dodgeOrigin.x, y: p.dodgeOrigin.y, radius: hurt.radius }));
    if (!hit) return false;
    if (p.invulnerable()) {
      if (p.canPerfect()) p.onPerfectDodge(attacker);
      return false;
    }
    if (!this.testShape(shape, hurt)) return false;
    this.dealDamage(attacker, p, { power, knock: extra.knock ?? 160, knockAng: extra.knockAng, type: 'physical' });
    if (extra.onHit) extra.onHit(p);
    return true;
  }

  clear() {
    this.hitboxes.length = 0;
    this.telegraphs.clear();
    this.projectiles.clear();
  }
}

