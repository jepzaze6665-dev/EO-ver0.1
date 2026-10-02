// ONLINE N7c — bosses in a party run (host-authoritative, like the monsters of net/mobSync.js). Works for every boss of
// the BossSystem: the generic AreaBoss (mini / area / major / secret) and the Guardian (its own class).
// HOST: fights the boss exactly as in solo play and sends
//   - 'boss' snapshots (10 / s while fighting, once on every state change): position, facing, pose, state, phase, HP,
//     air height, hurtable, vulnerable, current move (its animation), HUD tags
//   - every boss TELEGRAPH (visual only: 'btel'), every boss STRIKE when it lands ('bhit': shape + power + knock / guard
//     break / status) and every boss SHOT ('bproj', batched per frame)
//   Boss strikes are sent from combat.enemyStrike (not from the move code), so every move and every mechanic that hits
//   through enemyStrike works without knowing about the network.
// GUEST: its own copy of the boss never thinks — it is a PUPPET (netPuppet + puppet): drawn from the snapshots, the
//   BossSystem state follows the host (boss bar, camera lock, arena locks), strikes are resolved against OUR player
//   (dodge / guard / parry stay local), shots are real enemy shots on our side. Our hits go to the host ('mobHit' with id
//   'b_<boss id>'); the host applies them (its boss's damage-taken statuses, e.g. the Heartwood Ward, count there).
//   The host's boss dies -> the guest plays the same defeat (rewards / unlock for this member: N8 moves it to the server).
// NOT yet: bosses only choose moves around the host player; mechanic damage that does not go through enemyStrike /
//   projectiles (e.g. standing in lava, Ember Debt ignite) and mechanic world objects (pylons, clusters, chain posts,
//   rising lava tiles) are not mirrored on guests.
import { BOSS_STATE, isFighting } from '../boss/bossState.js';
import { TEAM } from '../core/constants.js';

const SHAPES = new Set(['circle', 'ring', 'cone', 'line']);
const STATES = new Set(Object.values(BOSS_STATE));
const clampN = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const r1 = (v) => Math.round(v * 10) / 10;
const now = () => performance.now() / 1000;
const shapeOf = (s) => ({ shape: s.shape, x: r1(s.x || 0), y: r1(s.y || 0), r: r1(s.r || 0), r0: r1(s.r0 || 0), ang: Math.round((s.ang || 0) * 100) / 100, half: Math.round((s.half || 0) * 100) / 100, len: r1(s.len || 0), width: r1(s.width || 0) });
const cleanShape = (sh) => (sh && SHAPES.has(sh.shape) ? { shape: sh.shape, x: clampN(sh.x, 0, 1e5), y: clampN(sh.y, 0, 1e5), r: clampN(sh.r, 0, 900), r0: clampN(sh.r0, 0, 900), ang: clampN(sh.ang, -10, 10), half: clampN(sh.half, 0, Math.PI), len: clampN(sh.len, 0, 1400), width: clampN(sh.width, 0, 600) } : null);

export class BossSync {
  constructor(mobs) {
    this.mobs = mobs;
    this.sent = new Map();     // host: boss id -> last snapshot key
    this.lastSend = 0;
    this.shots = new Map();    // host: boss id -> shots this frame
    this.installed = false;
    mobs.session.net.on('boss', (m) => this.onBoss(m.b));
  }
  get game() { return this.mobs.game; }
  get session() { return this.mobs.session; }

  // encounters of the map we are on
  encountersHere() { const g = this.game, id = g.world.mapId; return g.bosses ? g.bosses.list.filter((e) => e.def.map === id) : []; }
  encOf(entity) { const g = this.game; return entity && g.bosses ? g.bosses.list.find((e) => e.entity === entity) || null : null; }
  isBossActor(x) { return !!x && (x.isBoss === true || x === this.game.world.guardian); }
  bossOwner(x) { if (!x) return null; if (this.isBossActor(x)) return x; if (this.isBossActor(x.boss)) return x.boss; if (this.isBossActor(x.owner)) return x.owner; return null; }
  hosting() { const m = this.mobs, s = this.session; return m.host && m.room && m.room.includes(':') && s.online && s.remotes.list.some((r) => !r.leaving); }
  netId(enc) { return 'b_' + enc.id; }

  // wrap combat once: boss telegraphs / strikes / shots of the host are sent to the guests
  install() {
    const g = this.game;
    if (this.installed || !g.combat) return;
    this.installed = true;
    const c = g.combat, strike = c.enemyStrike.bind(c);
    c.enemyStrike = (attacker, shape, power, extra = {}) => {
      if (!attacker || !attacker.netPuppet) {
        const b = this.bossOwner(attacker), enc = b && this.encOf(b);
        if (enc && this.hosting()) this.send(enc, 'bhit', { shape: shapeOf(shape), power: r1(power), extra: { knock: extra.knock, knockAng: extra.knockAng, type: extra.type, guardBreak: !!extra.guardBreak, unblockable: !!extra.unblockable, status: Array.isArray(extra.status) ? extra.status.slice(0, 4).map((s) => ({ id: s.id, dur: s.dur })) : null } });
      }
      return strike(attacker, shape, power, extra);
    };
    const T = c.telegraphs, add = T.add.bind(T);
    T.add = (def) => {
      const t = add(def);
      if (!def.netCopy) {
        const b = this.bossOwner(def.owner), enc = b && !b.netPuppet && this.encOf(b);
        if (enc && SHAPES.has(def.shape) && this.hosting()) this.send(enc, 'btel', { shape: shapeOf(def), total: r1(t.total), color: typeof t.color === 'string' ? t.color.slice(0, 24) : null });
      }
      return t;
    };
    const P = c.projectiles, fire = P.fire.bind(P);
    P.fire = (def) => {
      const p = fire(def);
      const b = !def.visual && this.bossOwner(def.owner), enc = b && !b.netPuppet && this.encOf(b);
      if (enc && p.team === TEAM.ENEMY && this.hosting()) {
        const list = this.shots.get(enc.id) || [];
        if (list.length < 24) list.push({ x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), r: r1(p.r), life: r1(p.life), kind: String(p.kind).slice(0, 24), homing: p.homing || 0, color: typeof p.color === 'string' ? p.color.slice(0, 24) : '#ff8060', delay: r1(p.delay || 0), power: r1(p.power), knock: p.knock || 0, dmgType: p.dmgType || 'physical', pierce: !!p.pierce });
        this.shots.set(enc.id, list);
      }
      return p;
    };
  }

  send(enc, k, d) { this.session.net.send('mobAct', { id: this.netId(enc), k, d }); }

  // ---------------- host: snapshots + batched shots (every frame, from MobSync.update)
  update() {
    if (!this.hosting()) { this.shots.clear(); return; }
    for (const [id, list] of this.shots) { const enc = this.game.bosses.get(id); if (enc && list.length) this.send(enc, 'bproj', { list }); }
    this.shots.clear();
    const t = now(), tick = t - this.lastSend >= 0.1;
    if (tick) this.lastSend = t;
    for (const enc of this.encountersHere()) {
      const e = enc.entity;
      if (!e) continue;
      const b = this.snapshot(enc, e), key = [b.st, b.state, b.pose, b.phase, b.hp, b.dead, b.hurt, b.vul, b.move].join('|');
      const changed = this.sent.get(enc.id) !== key;
      if (!changed && !(tick && isFighting(enc.state))) continue;
      this.sent.set(enc.id, key);
      this.session.net.send('boss', { b });
    }
  }
  snapshot(enc, e) {
    const mv = e.curMove ? Object.entries(e.def.moves || {}).find(([, m]) => m === e.curMove) : null;
    const tags = e.hudState ? (e.hudState().tags || []).slice(0, 4).map((x) => ({ label: String(x.label || x).slice(0, 24), color: typeof x.color === 'string' ? x.color.slice(0, 24) : null })) : [];
    return { id: enc.id, st: enc.state, x: r1(e.x), y: r1(e.y), f: Math.round((e.facing || 0) * 100) / 100, pose: String(e.pose || 'idle').slice(0, 24), state: String(e.state || '').slice(0, 24),
      phase: e.phase || 1, hp: Math.max(0, Math.round(e.hp)), max: e.maxHp, dead: e.dead ? 1 : 0, air: r1(e.air || 0), hurt: e.hurtable ? 1 : 0,
      vul: e.status && e.status.has('vulnerable') ? 1 : 0, move: mv ? mv[0].slice(0, 24) : null, tags };
  }

  // a guest hit our boss (MobSync.onRemoteHit)
  applyHit(msg) {
    const g = this.game, enc = g.bosses && g.bosses.get(msg.id.slice(2)), e = enc && enc.entity;
    if (!e || e.dead || !e.hurtable || e.netPuppet) return;
    const r = this.session.remotes.get(msg.from);
    const src = { team: TEAM.PLAYER, x: r ? r.x : e.x, y: r ? r.y : e.y, remote: true, name: r ? r.name : 'ally', status: null };
    const dmg = Math.round(msg.dmg * (e.status ? e.status.damageTakenMult() : 1));
    e.hp -= dmg;
    e.flash = 0.12;
    if (e.onHurt) e.onHurt(dmg, src, { stagger: Math.min(msg.st || 0, 300) });
    g.vfx.damage(e.x, e.y - (e.height || 40) * 0.6, dmg, { crit: !!msg.crit, color: '#c8f0ff' });
    if (e.hp <= 0 && !e.dead) { e.hp = 0; e.onDeath(src); }
  }

  // ---------------- guest: puppets
  // our copy of every boss of this map becomes a puppet (or comes back as our own when we host)
  setPuppets(on) {
    const g = this.game;
    if (!g.bosses) return;
    for (const enc of on ? this.encountersHere() : g.bosses.list) { // off = every boss we ever puppeted (left the map / the run)
      const e = on ? g.bosses.entityOf(enc) : enc.entity;
      if (!e || !!e.netPuppet === on) continue;
      if (on) {
        e.netPuppet = true; e.puppet = true; e.snaps = [];
        e.netDamage = (amount, opts, src, ang, crit) => this.reportHit(enc, amount, opts, src, crit);
        e._hudState = e.hudState; e.hudState = () => ({ tags: e.netTags || [] });
        if (g.bosses.engaged === enc) this.disengage(enc);
      } else {
        e.netPuppet = false; e.puppet = false; e.netDamage = null;
        if (e._hudState) { e.hudState = e._hudState; e._hudState = null; }
        if (isFighting(enc.state)) g.bosses.reset(enc); // its fight was the host's: ours starts fresh
      }
    }
  }

  reportHit(enc, amount, opts = {}, src, crit) {
    if (!src || src.team !== TEAM.PLAYER || src.remote) return;
    this.session.net.send('mobHit', { id: this.netId(enc), dmg: Math.max(0, Math.round(amount)), st: Math.round(opts.stagger || 0), kb: 0, crit: !!crit });
  }

  onBoss(b) {
    const g = this.game;
    if (this.mobs.host || !b || typeof b.id !== 'string' || !g.bosses) return;
    const enc = g.bosses.get(b.id);
    if (!enc || enc.def.map !== g.world.mapId) return;
    const e = g.bosses.entityOf(enc);
    if (!e) return;
    if (!e.netPuppet) this.setPuppets(true);
    e.snaps.push({ t: now(), x: clampN(b.x, 0, 1e5), y: clampN(b.y, 0, 1e5) });
    if (e.snaps.length > 12) e.snaps.shift();
    e.facing = clampN(b.f, -10, 10); e.pose = typeof b.pose === 'string' ? b.pose : 'idle'; e.state = typeof b.state === 'string' ? b.state : e.state;
    e.maxHp = clampN(b.max, 1, 1e8, e.maxHp); e.hp = clampN(b.hp, 0, e.maxHp); e.air = clampN(b.air, 0, 500); e.hurtable = !!b.hurt;
    e.curMove = b.move && e.def.moves ? e.def.moves[b.move] || null : null;
    e.netTags = Array.isArray(b.tags) ? b.tags : [];
    if (b.vul && e.status && !e.status.has('vulnerable')) e.status.add('vulnerable', 3);
    if (!b.vul && e.status && e.status.has('vulnerable')) e.status.remove('vulnerable');
    if (b.phase !== e.phase && Number.isInteger(b.phase)) {
      e.phase = b.phase;
      const ph = enc.def.phases && enc.def.phases[b.phase - 1];
      if (ph && isFighting(enc.state)) g.ui.callout(ph.name || `PHASE ${b.phase}`, ph.sub || '', '#e0b0ff');
      enc.phase = b.phase;
    }
    // the encounter follows the host's: boss bar, camera lock, arena locks
    const st = STATES.has(b.st) ? b.st : enc.state, was = isFighting(enc.state);
    enc.state = st;
    if (isFighting(st) && !was) this.engage(enc);
    if (!isFighting(st) && was && !b.dead) this.disengage(enc);
    if (b.dead && !e.dead) this.defeated(enc, e);
  }

  engage(enc) {
    const g = this.game, B = g.bosses;
    B.engaged = enc;
    if (enc.def.impl === 'guardian') g.world.bossActive = true;
    else g.ui.showBossBar(true);
    if (enc.def.arena && enc.def.arena.cameraLock) B.lockCamera(enc, true);
    g.ui.bossTitle && g.ui.bossTitle(enc.def.name, enc.def.title || '');
    g.audio.music('boss');
  }
  disengage(enc) {
    const g = this.game, B = g.bosses;
    if (B.engaged === enc) B.engaged = null;
    if (enc.def.impl === 'guardian') g.world.bossActive = false;
    g.ui.showBossBar(false);
    B.lockCamera(enc, false);
    B.restoreMusic();
  }
  // the host's boss fell: the same defeat on our side (feedback, rewards, unlocks for this member)
  defeated(enc, e) {
    const g = this.game;
    e.dead = true; e.deathT = 0; e.hp = 0; e.hurtable = false;
    if (enc.def.impl === 'guardian') { g.world.bossActive = false; g.onBossDefeated(e); }
    else g.bosses.onEntityDeath(e, null);
  }

  // the puppet between snapshots (AreaBoss / Guardian update call this while netPuppet)
  puppetUpdate(e, dt) {
    e.animT = (e.animT || 0) + dt;
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.dead) { e.deathT = (e.deathT || 0) + dt; return; }
    if (e.status) e.status.update(dt);
    const s = e.snaps;
    if (!s || !s.length) return;
    const t = now() - 0.12;
    let x = s[s.length - 1].x, y = s[s.length - 1].y;
    for (let i = s.length - 1; i > 0; i--) if (t >= s[i - 1].t) { const a = s[i - 1], b = s[i], f = Math.min(1, (t - a.t) / Math.max(1e-3, b.t - a.t)); x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f; break; }
    if (t < s[0].t) { x = s[0].x; y = s[0].y; }
    e.moving = Math.hypot(x - e.x, y - e.y) > 0.3;
    e.x = x; e.y = y;
  }

  // a boss act from the host, played on our puppet
  onAct(id, k, d) {
    const g = this.game, enc = g.bosses && g.bosses.get(id.slice(2)), e = enc && enc.entity;
    if (!e || !e.netPuppet || e.dead || !d) return;
    if (k === 'btel') {
      const sh = cleanShape(d.shape);
      if (sh) g.combat.telegraphs.add({ ...sh, total: clampN(d.total, 0.05, 8, 0.8), color: typeof d.color === 'string' ? d.color : '255,60,60', owner: e, netCopy: true });
    } else if (k === 'bhit') {
      const sh = cleanShape(d.shape), x = d.extra || {};
      if (!sh) return;
      g.combat.enemyStrike(e, sh, clampN(d.power, 0, 100000), { knock: clampN(x.knock, 0, 900, 180), knockAng: typeof x.knockAng === 'number' ? x.knockAng : undefined, type: typeof x.type === 'string' ? x.type : 'physical',
        guardBreak: !!x.guardBreak, unblockable: !!x.unblockable, status: Array.isArray(x.status) ? x.status.filter((s) => s && typeof s.id === 'string').map((s) => ({ id: s.id, dur: clampN(s.dur, 0, 20) })) : undefined });
    } else if (k === 'bproj' && Array.isArray(d.list)) {
      for (const p of d.list.slice(0, 24)) g.combat.projectiles.fire({ x: clampN(p.x, 0, 1e5), y: clampN(p.y, 0, 1e5), vx: clampN(p.vx, -3000, 3000), vy: clampN(p.vy, -3000, 3000), r: clampN(p.r, 1, 60, 6), life: clampN(p.life, 0.1, 8, 2),
        kind: typeof p.kind === 'string' ? p.kind : 'shard', homing: clampN(p.homing, 0, 10), color: typeof p.color === 'string' ? p.color : '#ff8060', delay: clampN(p.delay, 0, 5), power: clampN(p.power, 0, 100000),
        knock: clampN(p.knock, 0, 900, 120), dmgType: typeof p.dmgType === 'string' ? p.dmgType : 'physical', pierce: !!p.pierce, owner: e, team: TEAM.ENEMY });
    }
  }
}
