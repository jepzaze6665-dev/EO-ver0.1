import { TEAM } from '../core/constants.js';
import { angleTo, inCone, inLine, rand, TAU } from '../core/math.js';
import { Telegraphs } from './telegraph.js';
import { Projectiles } from './projectiles.js';
import { echoHitbox } from '../progression/skillTraits.js';
import { computeDamage } from './damageSystem.js';
import { STATUSES } from '../data/statuses.js';
import { THREADS } from '../data/threads.js';

// Class-agnostic combat resolver. Skills from any class spawn hitboxes described
// as data; enemies resolve telegraphed strikes through enemyStrike(). All feedback
// (hit flash, hit stop, numbers, sparks, shake, sound) is centralised here.
import { DODGE } from '../data/dodge.js'; // dodge / perfect dodge rules (PERFECT_WINDOW moved there)
import { DIFFICULTY } from '../data/difficulty.js';
export { DODGE };

// skill level modifiers of the action being run (Player.castMods, progression/skillLevels.js): power × and size ×.
// def.noSkillMods opts out (e.g. a hitbox whose power the class already scaled itself).
export function applySkillMods(o, sizeKeys) {
  const m = o.owner && o.owner.castMods;
  if (m && m.skillId && !o.skillId) o.skillId = m.skillId; // which skill it belongs to -> 'skillHit' (mastery)
  if (!m || o.noSkillMods) return o;
  // a per-target power function (powerFor) computes its own number, so its RESULT is scaled; it sees the base power
  if (m.power !== 1 && o.powerFor) { const f = o.powerFor, base = o.power, k = m.power; o.powerFor = (t, h) => f(t, { ...h, power: base }) * k; }
  if (m.power !== 1 && Number.isFinite(o.power)) o.power *= m.power;
  if (m.area !== 1) for (const k of sizeKeys) if (Number.isFinite(o[k])) o[k] *= m.area;
  if (m.values && m.values.poiseMult && Number.isFinite(o.stagger)) o.stagger *= m.values.poiseMult; // trait: poise break
  return o;
}

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
    applySkillMods(hb, ['r', 'r0', 'len', 'width']);
    echoHitbox(this, def, hb); // trait 'echo' (progression/skillTraits.js)
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

  // ---------------- threads (rules in data/threads.js; the ThreadSystem only detects touches)
  threadTouch(th, target, first) {
    const def = THREADS[th.type], d = def.touch;
    if (!d || target.dead) return;
    if (d.power) this.dealDamage(th.owner, target, { power: d.power, type: d.type, dot: true, knock: 0, color: def.visual.color, threadId: th.id });
    if (d.status && target.status && !target.dead) target.status.add(d.status, d.statusTime, { source: th.owner });
    if (first && d.mark && !target.dead && this.game.marks) this.game.marks.apply(target, d.mark, { source: th.owner });
  }
  // a triggered thread explodes along its whole length (the caller decides extra effects via onHit)
  threadBurst(seg, owner, { onHit } = {}) {
    const d = seg.def.burst;
    const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    return this.spawnHitbox({
      owner, x: seg.ax, y: seg.ay, ang: Math.atan2(seg.by - seg.ay, seg.bx - seg.ax), shape: 'line', len: len + 8, width: d.width,
      power: d.power, type: d.type, knock: 130, stagger: 22, hitStop: 0.06, shake: 0.2,
      onHit: (t) => {
        if (d.mark && !t.dead && !t.isBreakable && this.game.marks) this.game.marks.apply(t, d.mark, { source: owner });
        if (onHit) onHit(t);
      },
    });
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
        // powerFor(target, hb): optional per-target power (e.g. bonus against marked targets)
        const info = this.dealDamage(hb.owner, t, hb.powerFor ? { ...hb, power: hb.powerFor(t, hb) } : hb);
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
    if (target.downed) return { amount: 0, crit: false, killed: false, tags: ['downed'] }; // party: a downed player waits for a revive
    const fromPlayer = src && src.team === TEAM.PLAYER;
    const ang = src ? angleTo(src.x, src.y, target.x, target.y) : rand(0, TAU);
    // 1) CALCULATE — pure, data in / result out (combat/damageSystem.js)
    const behind = src && target.armor > 0 && target.weakPointHit ? target.weakPointHit(src.x, src.y) : false;
    const attacker = src && src.stats ? { stats: src.stats, damageMult: src.status ? src.status.damageMult() : 1 } : null;
    // flat attackers (monsters) still feel damage modifiers from statuses (taunted, surge...)
    if (!attacker && src && src.status && opts.power !== undefined) opts = { ...opts, power: opts.power * src.status.damageMult() };
    // LEVEL SCALING (progression/levelScaling.js): a boss moved to a new level hits accordingly (every move / mechanic)
    if (!attacker && src && src.levelPowerMult && opts.power !== undefined) opts = { ...opts, power: opts.power * src.levelPowerMult };
    // DIFFICULTY (data/difficulty.js): enemy hits on players — guarding and dodging must matter
    if (!attacker && target.team === TEAM.PLAYER && opts.power !== undefined && (!src || src.team !== TEAM.PLAYER)) {
      const k = DIFFICULTY.enemyDamage, boss = src && (src.isBoss || src.type === 'guardian');
      opts = { ...opts, power: opts.power * (opts.dot ? k.dot : boss ? k.boss : k.monster) };
    }
    // Counter Window (combat/counterSystem.js): hitboxes may carry counterMult = extra power against an open target
    if (opts.counterMult && target.status && target.status.has('counter_window') && opts.power !== undefined) opts = { ...opts, power: opts.power * opts.counterMult };
    const res = computeDamage(attacker, {
      defense: target.defense, stats: target.stats, weakness: target.weakness,
      defenseMult: target.status ? target.status.modifier('defenseMult') : 1,
      vulnerable: target.status && target.status.isVulnerable(), armor: target.armor,
      damageTakenMult: target.status ? target.status.damageTakenMult() : 1,
      hpRatio: target.maxHp ? target.hp / target.maxHp : 1,
    }, { ...opts, weakPoint: behind });
    const { crit, tags } = res;
    // GEAR (items/effectSystem.js, Player): a next-hit bonus of the attacker, the target's damage reduction. Hooks only:
    // combat never knows which item asked for it.
    if (!opts.dot && src && src.gearHitMult) res.amount = Math.round(res.amount * src.gearHitMult(target, opts));
    if (target.gearDamageTakenMult) res.amount = Math.max(0, Math.round(res.amount * target.gearDamageTakenMult(opts)));
    // GUARD (combat/guardSystem.js): a blocking target reduces or negates the hit
    const block = !opts.dot && src && target.tryBlock ? target.tryBlock(src, opts) : null;
    if (block) {
      const raw = res.amount; // what the hit would have dealt (guard stamina cost scales with it)
      res.amount = Math.round(raw * block.mult);
      if (target.onBlock) target.onBlock(block, src, opts, ang, raw);
      g.events.emit('damageBlocked', { source: src, target, perfect: block.perfect, amount: res.amount });
      if (block.perfect || res.amount <= 0) return { amount: 0, crit: false, killed: false, tags: ['blocked'], blocked: true };
      opts = { ...opts, knock: (opts.knock || 0) * 0.25, blocked: true };
    }
    // shields (status 'shield') soak damage before HP
    const shieldSrc = target.status && target.status.get('shield') ? target.status.get('shield').source : null;
    const absorbed = target.status ? res.amount - target.status.absorb(res.amount) : 0;
    if (absorbed > 0) g.events.emit('shieldAbsorbed', { target, source: src, amount: absorbed, statusSource: shieldSrc });
    const amount = res.amount - absorbed;
    // 2) APPLY — state changes
    if (res.armorDamage) {
      target.armor = Math.max(0, target.armor - res.armorDamage);
      if (target.armor <= 0 && target.onArmorBreak) target.onArmorBreak();
    }
    target.hp -= target.endure ? target.endure(amount) : amount; // ENDURE (players): no one-shot from healthy
    target.flash = 0.12;
    this.lastCombatTime = g.time;

    // knockback & stagger
    // stat knockResist (0..1) shortens knockback; the status flag 'unshakable' removes it
    const kr = 1 - Math.min(1, Math.max(0, (target.stats && target.stats.knockResist) || 0));
    const kb = (opts.knock || 0) * (target.superArmor ? 0.15 : 1) * (target.status && target.status.flag('unshakable') ? 0 : 1) * kr;
    if (kb > 0) target.knockback(opts.knockAng ?? ang, kb);
    // DoT ticks skip hurt reactions (no stagger / i-frames); entities may still count them via onDot
    // blocked hits: no stagger, only the floors (onBlockedHit)
    if (opts.dot) { if (target.onDot) target.onDot(amount, src, opts); } else if (opts.blocked) { if (target.onBlockedHit) target.onBlockedHit(amount, src, opts); } else if (target.onHurt) target.onHurt(amount, src, opts, ang);

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
      if (tags.includes('execute') && !target.executeShown) { target.executeShown = true; g.vfx.text(hx, hy - 30, 'LOW HP — EXECUTE', { color: '#e0a0ff', size: 9 }); }
      if (tags.includes('armored') && !target.armorWarned) { target.armorWarned = true; g.vfx.text(hx, hy - 30, (target.def && target.def.weakPointText) || 'ARMORED — strike its back', { color: '#9ad8ff', size: 9 }); }
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
  // extra: knock, knockAng, type ('physical' | 'magic' | ...), status [{ id, dur }] applied when the hit lands, onHit,
  //        guardBreak (smashes a normal block; parry beats it), unblockable (ignores guard + parry: dodge it)
  enemyStrike(attacker, shape, power, extra = {}) {
    let any = false; // every player in the shape (party-ready)
    for (const p of this.game.players()) if (this.strikePlayer(p, attacker, shape, power, extra)) any = true;
    return any;
  }
  strikePlayer(p, attacker, shape, power, extra) {
    if (p.dead) return false;
    const hurt = { x: p.x, y: p.y, radius: p.hurtRadius || p.radius };
    const hit = this.testShape(shape, hurt) || (p.dodging && p.dodgeOrigin && this.testShape(shape, { x: p.dodgeOrigin.x, y: p.dodgeOrigin.y, radius: hurt.radius }));
    if (!hit) return false;
    if (p.invulnerable()) {
      const perfect = p.canPerfect();
      if (perfect) p.onPerfectDodge(attacker);
      // the attack whiffed — enemies / Counter Window (Combat 2.0 C3) react to this
      if (p.dodging || perfect || this.game.time - p.dodgeStart <= DODGE.iframes) this.game.events.emit('attackDodged', { attacker, player: p, perfect });
      return false;
    }
    if (!this.testShape(shape, hurt)) return false;
    const info = this.dealDamage(attacker, p, { power, knock: extra.knock ?? 160, knockAng: extra.knockAng, type: extra.type || 'physical', guardBreak: extra.guardBreak, unblockable: extra.unblockable });
    if (extra.status && !info.blocked && !p.dead) for (const s of extra.status) p.status.add(s.id, s.dur, { source: attacker });
    if (extra.onHit) extra.onHit(p);
    return true;
  }

  clear() {
    this.hitboxes.length = 0;
    this.telegraphs.clear();
    this.projectiles.clear();
  }
}

