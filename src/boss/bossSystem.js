import { TILE, ZONE_INFO } from '../core/constants.js';
import { BOSSES, liveBosses } from '../data/bosses.js';
import { BOSS_STATE as S, nextBossState, isFighting } from './bossState.js';
import { AreaBoss } from './areaBoss.js';
import { dist, angleTo, TAU } from '../core/math.js';
import { bossScale } from '../progression/levelScaling.js';
import { DROP_RATES } from '../data/dropRates.js';

// BOSS SYSTEM — runs every boss encounter from data/bosses.js through the state machine in boss/bossState.js:
//   HIDDEN -> IDLE -> ENGAGED <-> PHASE_CHANGE -> DEFEATED   (+ RESET -> IDLE when the player dies / leaves)
// and owns everything around the fight that is the same for every boss:
//   Boss Arena  : trigger radius (engage) + collision boundary (player and boss stay inside while engaged)
//   Arena Lock  : exits and gates are closed while any boss fight is active (World.inBossFight)
//   Boss bar    : barInfo() for the HUD (name, HP, phase, weak window) — area and major bosses alike
//   Rewards     : EVERY kill -> 'enemyDefeated' (EXP + loot table) + 'bossRewarded' (gold / items / lore); later kills pay
//                 the repeat rates of data/dropRates.js (less EXP / gold, signature ~1 in 9, no one-time trophies)
//   Rematch     : a defeated boss comes back when the player enters its map again (respawn, DROP_RATES.bossRematch).
//                 It only WAITS: many arenas are roads (Sanctum -> City 2, Rift -> A3 ...), so a rematch starts only when the
//                 player asks for it — [E] Challenge next to the boss (interactable 'bossChallenge').
//   Progression : WorldProgression.defeatBoss(id) -> 'bossDefeated' { bossId, first, major } -> world triggers
// Which code fights is chosen by the boss's `impl` (IMPLS below): the generic data-driven AreaBoss, or the V2
// Guardian of the Forest (its own class + World.startBoss / resetBoss). A new impl = one more entry, no core changes.
// Events: bossRevealed · bossEngaged · bossPhaseChanged · bossReset · bossDefeated · bossRewarded
export const IMPLS = {
  area: {
    create: (g, def) => new AreaBoss(g, def),
    engage: (g, enc) => enc.entity.wake(),
    reset: (g, enc) => enc.entity.reset(),
    ownsArena: false,      // the BossSystem keeps player + boss inside the arena circle
  },
  guardian: {
    create: (g) => g.world.guardian || g.world.ensureGuardian(), // spawned by the world (maps/ruins.js spawn 'guardian'); rebuilt for a rematch
    engage: (g) => g.world.startBoss(),       // seals the arena gate, phase hazards, camera lock
    reset: (g) => g.world.resetBoss(),
    ownsArena: true,       // its arena seal + inArena clamp already exist (world.js / guardian.js)
    transitioning: (e) => e.state === 'transition',
  },
};

export class BossSystem {
  constructor(game, data = BOSSES) {
    this.game = game;
    this.data = data;
    this.list = liveBosses(data).map((def) => ({ id: def.id, def, state: S.HIDDEN, entity: null, phase: 1, leaveT: 0 }));
    this.byId = Object.fromEntries(this.list.map((e) => [e.id, e]));
    this.engaged = null;       // the encounter being fought (one at a time)
    // REMATCH: entering a map brings its defeated bosses back (progression stays saved)
    game.events.on('mapEntered', (e) => this.respawnOn(e.id));
  }
  // every defeated boss of this map comes back for a rematch (its entity healed and sent home). Returns how many.
  respawnOn(mapId) {
    if (!DROP_RATES.bossRematch) return 0;
    let n = 0;
    for (const enc of this.list) {
      if (enc.def.map !== mapId || isFighting(enc.state) || !this.game.worldProgress.isBossDefeated(enc.id)) continue;
      enc.rematch = true; enc.phase = 1; enc.leaveT = 0;
      // not built yet (a save loaded on this map): the next update creates it and, with `rematch`, goes HIDDEN -> IDLE
      enc.challenged = false;
      this.addChallenge(enc);
      if (!enc.entity) { enc.state = S.HIDDEN; n++; continue; }
      this.impl(enc).reset(this.game, enc);
      enc.state = S.IDLE;
      n++;
    }
    return n;
  }
  get(id) { return this.byId[id] || null; }
  impl(enc) { return IMPLS[enc.def.impl] || IMPLS.area; }
  // the entity, created on first use (the Guardian exists once the world populated its spawn)
  entityOf(enc) {
    if (!enc.entity) enc.entity = this.impl(enc).create(this.game, enc.def) || null;
    return enc.entity;
  }
  engagedEntity() { return this.engaged ? this.engaged.entity : null; }
  onMap(enc) { const w = this.game.world; return !w.mapId || enc.def.map === w.mapId; }
  arenaPx(enc) {
    const a = enc.def.arena;
    return { x: a.center[0] * TILE, y: a.center[1] * TILE, r: a.radius * TILE, trigger: (a.trigger || a.radius - 1) * TILE };
  }
  // the [E] Challenge point of a waiting rematch boss (a world interactable at the boss's home; one per boss)
  addChallenge(enc) {
    const w = this.game.world, id = 'boss_challenge_' + enc.id, a = this.arenaPx(enc), home = enc.entity && enc.entity.home;
    w.interactables = w.interactables.filter((it) => it.id !== id);
    w.interactables.push({ id, kind: 'bossChallenge', bossId: enc.id, x: home ? home.x : a.x, y: home ? home.y : a.y, radius: 110, prompt: `Challenge ${enc.def.name} (rematch)` });
  }
  removeChallenge(enc) {
    const w = this.game.world, id = 'boss_challenge_' + enc.id;
    w.interactables = w.interactables.filter((it) => it.id !== id);
  }
  // the player asked for the rematch: the fight starts
  challenge(id) {
    const enc = this.get(id);
    if (!enc || !enc.rematch || isFighting(enc.state)) return false;
    enc.challenged = true;
    this.removeChallenge(enc);
    return true;
  }
  // area-boss entities the world should simulate / draw / let the player hit (the Guardian is the world's own)
  entities() {
    const out = this._ents || (this._ents = []); // reused every call (hostiles() asks many times per frame)
    out.length = 0;
    for (const enc of this.list) if (enc.entity && enc.def.impl === 'area' && enc.state !== S.HIDDEN && this.onMap(enc) && !(enc.state === S.DEFEATED && enc.entity.dead && enc.entity.deathT > 3)) out.push(enc.entity);
    return out;
  }

  // ---------------- per frame (World.update)
  update(dt) {
    const g = this.game, p = g.player, prog = g.worldProgress;
    for (const enc of this.list) {
      if (!this.onMap(enc) && !isFighting(enc.state)) continue;
      const e = this.entityOf(enc);
      if (!e) continue;
      if (enc.def.impl === 'area') e.update(dt);
      const a = this.arenaPx(enc);
      const inside = dist(p.x, p.y, a.x, a.y);
      // leaving the arena some other way (teleport, respawn elsewhere) resets the fight after a moment.
      // Bosses that own their arena (sealed map, e.g. the Guardian) only reset when the player leaves the map.
      const gone = !this.onMap(enc) || (!this.impl(enc).ownsArena && inside > a.r + 3 * TILE);
      if (isFighting(enc.state)) enc.leaveT = gone ? enc.leaveT + dt : 0;
      const next = nextBossState(enc.state, {
        alreadyDefeated: prog.isBossDefeated(enc.id) && !enc.rematch,
        canAppear: prog.meets(enc.def.appear),
        // a rematch boss waits until challenged ([E]); then the fight starts wherever the player stands in the arena
        playerInTrigger: this.onMap(enc) && (enc.rematch ? !!enc.challenged && inside < a.r : inside < a.trigger),
        playerAlive: !p.dead,
        entityDead: !!e.dead,
        transitioning: this.impl(enc).transitioning ? this.impl(enc).transitioning(e) : e.state === 'transition',
        reset: enc.leaveT > 1.5,
      });
      if (next !== enc.state) this.setState(enc, next);
      if (isFighting(enc.state)) {
        if (e.phase !== enc.phase) { enc.phase = e.phase; g.events.emit('bossPhaseChanged', { bossId: enc.id, phase: e.phase, name: this.phaseName(enc), boss: enc.def }); }
        if (!this.impl(enc).ownsArena) this.lockInArena(enc, a);
      }
    }
  }
  // collision boundary: while engaged, the player (and the boss) cannot leave the arena circle
  lockInArena(enc, a) {
    const p = this.game.player, e = enc.entity, lim = (o, pad) => {
      const d = dist(o.x, o.y, a.x, a.y);
      if (d <= a.r - pad || d > a.r + 2 * TILE) return; // far outside = teleported away: the leave timer resets the fight
      const ang = angleTo(a.x, a.y, o.x, o.y);
      o.x = a.x + Math.cos(ang) * (a.r - pad); o.y = a.y + Math.sin(ang) * (a.r - pad);
      if (o.kx !== undefined) { o.kx *= 0.2; o.ky *= 0.2; }
    };
    if (!p.dead) lim(p, p.radius || 8);
    if (e && !e.dead) lim(e, e.radius * 0.6);
  }

  setState(enc, next) {
    const g = this.game, prev = enc.state;
    enc.state = next;
    if (next === S.IDLE && prev === S.HIDDEN) g.events.emit('bossRevealed', { bossId: enc.id, boss: enc.def });
    if (next === S.ENGAGED && prev === S.IDLE) this.engage(enc);
    if (next === S.RESET) this.reset(enc);
    if (next === S.DEFEATED && prev === S.HIDDEN || next === S.DEFEATED && prev === S.IDLE) this.hideDefeated(enc);
  }
  engage(enc) {
    const g = this.game;
    this.engaged = enc;
    enc.phase = 1;
    enc.leaveT = 0;
    this.impl(enc).engage(g, enc);
    if (enc.def.impl === 'area') g.ui.showBossBar(true);
    if (enc.def.arena && enc.def.arena.cameraLock) this.lockCamera(enc, true);
    g.events.emit('bossEngaged', { bossId: enc.id, boss: enc.def, major: enc.def.type === 'major' });
  }
  // player died or left: the boss heals, goes back to its spawn and waits (IDLE) — nothing is lost
  reset(enc) {
    const g = this.game;
    if (enc.rematch) { enc.challenged = false; this.addChallenge(enc); } // lost / left a rematch: it waits for a new challenge
    this.impl(enc).reset(g, enc);
    this.lockCamera(enc, false);
    if (this.engaged === enc) this.engaged = null;
    g.ui.showBossBar(false);
    g.combat.telegraphs.clear();
    g.events.emit('bossReset', { bossId: enc.id, boss: enc.def });
    enc.state = S.IDLE;
    enc.phase = 1;
    enc.leaveT = 0;
    this.restoreMusic();
  }
  resetEngaged() { if (this.engaged) this.reset(this.engaged); }
  // arena.cameraLock: the camera stays on the arena during the fight (the Guardian's arena does the same)
  lockCamera(enc, on) {
    const g = this.game;
    if (on) {
      const a = this.arenaPx(enc), pad = 2 * TILE;
      g.camera.lock = { x0: a.x - a.r - pad, y0: a.y - a.r - pad * 1.5, x1: a.x + a.r + pad, y1: a.y + a.r + pad };
      enc.cameraLocked = true;
    } else if (enc.cameraLocked) { g.camera.lock = null; enc.cameraLocked = false; }
  }
  // a boss killed in an earlier session never shows up again
  hideDefeated(enc) {
    const e = enc.entity;
    if (e && enc.def.impl === 'area') { e.dead = true; e.deathT = 99; e.hurtable = false; }
  }
  restoreMusic() {
    const z = this.game.world.currentZone, info = ZONE_INFO[z];
    if (info) this.game.audio.music(info.music);
  }

  // ---------------- defeat (area bosses: called by AreaBoss.onDeath; the Guardian: Game.onBossDefeated -> complete)
  onEntityDeath(e) {
    const g = this.game, enc = this.list.find((x) => x.entity === e);
    if (!enc) return;
    g.hitStop = 0.35;
    g.camera.lookAt(e.x, e.y - 30, 2.2);
    g.camera.shake(0.6);
    g.vfx.flash('255,255,255', 0.6, 2);
    g.vfx.burst(e.x, e.y - 30, `rgb(${(e.look && e.look.aura) || '255,200,160'})`, 60, 240);
    g.vfx.ring(e.x, e.y, 10, 160, { color: (e.look && e.look.aura) || '255,220,180', life: 0.9, width: 6 });
    g.audio.sfx('crash');
    g.combat.telegraphs.cancelOwner(e);
    g.ui.showBossBar(false);
    this.engaged = null;
    this.restoreMusic();
    this.lockCamera(enc, false);
    g.after(1.1, () => {
      g.ui.callout(enc.def.type === 'major' ? 'MAJOR BOSS DEFEATED' : enc.def.type === 'mini' ? 'MINI BOSS DEFEATED' : enc.def.type === 'secret' ? 'SECRET BOSS DEFEATED' : 'AREA BOSS DEFEATED', enc.def.name, '#ffe8b0');
      g.audio.sfx('victory');
      this.complete(enc.id, e);
    }, true);
  }
  // progression + rewards + events. First kill = full rewards; later kills (rematch) = repeat rates.
  complete(id, entity) {
    const g = this.game, enc = this.get(id);
    if (!enc) return false;
    const def = enc.def, e = entity || enc.entity || g.player;
    if (this.engaged === enc) this.engaged = null;
    enc.state = S.DEFEATED;
    const first = g.worldProgress.defeatBoss(id);
    enc.rematch = false; enc.challenged = false;
    this.removeChallenge(enc);
    const r = def.rewards || {}, rep = DROP_RATES.repeat;
    // EXP + loot table go through the normal 'enemyDefeated' listeners (ExperienceSystem, LootSystem); a REPEAT kill
    // (rematch) pays the repeat rates (data/dropRates.js): the loot system reads `repeat`
    const expMult = first ? 1 : rep.exp;
    g.events.emit('enemyDefeated', { entity: e, type: def.monster || id, bossId: id, name: def.name, source: g.player, x: e.x, y: e.y, summoned: false, boss: true, repeat: !first, exp: Math.round((r.exp || 0) * bossScale(def).exp * expMult), loot: r.loot || null });
    if (first) g.events.emit('bossRewarded', { bossId: id, reward: { gold: r.gold || 0, items: r.items || {}, lore: r.lore || null } });
    else g.events.emit('bossRewarded', { bossId: id, repeat: true, reward: { gold: Math.round((r.gold || 0) * rep.gold), items: rep.trophies ? (r.items || {}) : {}, lore: null } });
    g.events.emit('bossDefeated', { bossId: id, type: def.monster || id, boss: def, first, major: def.type === 'major', entity: e });
    g.save.dirty = true;
    return first;
  }

  // ---------------- UI views
  phaseName(enc) { const ph = enc.def.phases && enc.def.phases[(enc.entity ? enc.entity.phase : 1) - 1]; return ph ? ph.name : ''; }
  // boss bar data for the engaged boss (null = no bar)
  barInfo() {
    const enc = this.engaged;
    if (!enc || !enc.entity) return null;
    const e = enc.entity, def = enc.def, phases = def.phases || [];
    const weak = e.status.has('vulnerable');
    return {
      id: enc.id, name: def.name, title: def.title, type: def.type, level: def.level, entity: e,
      hp: e.hp, maxHp: e.maxHp, phase: e.phase || 1, phaseCount: phases.length || 1, phaseName: this.phaseName(enc),
      thresholds: phases.slice(1).map((p) => p.hpBelow), weak, weakPct: weak ? (e.weakT || 0) / 4 : 0, stagger: e.poise ? 1 - e.poise.ratio() : 0, // poise used up (data/poise.js)
      color: def.look && def.look.aura,
    };
  }
  // idle bosses on this map (HUD labels over the arena before the fight)
  idleOnMap() { return this.list.filter((enc) => enc.state === S.IDLE && this.onMap(enc) && enc.entity); }

  // ---------------- arena ground drawing (Renderer, below entities)
  drawGround(ctx, time) {
    for (const enc of this.list) {
      if (!this.onMap(enc) || enc.def.impl !== 'area' || enc.state === S.HIDDEN || enc.state === S.DEFEATED) continue;
      const a = this.arenaPx(enc), col = (enc.def.look && enc.def.look.aura) || '255,120,120';
      const fight = isFighting(enc.state);
      ctx.save();
      ctx.lineWidth = fight ? 4 : 2;
      ctx.setLineDash(fight ? [] : [10, 8]);
      ctx.lineDashOffset = -time * 20;
      ctx.strokeStyle = `rgba(${col},${fight ? 0.55 + 0.25 * Math.sin(time * 5) : 0.28})`;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r, a.r, 0, 0, TAU); ctx.stroke();
      if (fight) {
        // barrier wall: a glowing band just inside the boundary
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 14;
        ctx.strokeStyle = `rgba(${col},0.12)`;
        ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r - 6, a.r - 6, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // barrier sparks while locked (called from World.update, cheap: a few particles)
  ambient() {
    const enc = this.engaged;
    if (!enc || enc.def.impl !== 'area' || Math.random() > 0.5) return;
    const a = this.arenaPx(enc), ang = Math.random() * TAU, col = (enc.def.look && enc.def.look.aura) || '255,120,120';
    this.game.vfx.particle(a.x + Math.cos(ang) * a.r, a.y + Math.sin(ang) * a.r, { color: `rgb(${col})`, vy: -40, life: 0.8, size: 2, add: true, drag: 0 });
  }
}
