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
// TARGETS: bosses fight their `foe` (best of every player of the run, boss/areaBoss.js + guardian.js), not the host.
// MECHANICS (boss/mechanics.js): their state rides in the snapshot (mech[i] = netState) and the guest's copy applies it
//   (netApply: pools, ice pillars = real blocked tiles, lava ring = real lava tiles + push, echoes, chain posts, own
//   stacks, clusters / pylons as puppet breakables). Mechanics act on every player (game.combatants()): damage and
//   statuses they give a guest's ALLY PROXY on the host are forwarded ('bdmg' / 'bstat') and applied on that guest
//   (its own invulnerability counts). Guests report what only they know ('bossEvt'): hits on clusters / pylons ('obj'),
//   holding [E] at a chain post ('hold'), ember stacks they earned / burned ('ember').
// EFFECTS: the boss's visuals / callouts / flashes / shakes are recorded on the host (net/netFx.js channel 'b_<id>':
//   its update, hurt and death code) and replayed on the guests.
// Guest hits respect the host boss's rules: its shield stance (tryBlock), its armour (the guest's armour damage is sent),
//   its damage-taken statuses; a hit while it is weak counts for Ember Debt (damageDealt with the guest's proxy).
import { BOSS_STATE, isFighting } from '../boss/bossState.js';
import { TEAM } from '../core/constants.js';
import { ONLINE } from '../data/online.js';
import { sampleSnaps } from './interp.js';

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
    mobs.session.net.on('bossEvt', (m) => this.onBossEvt(m));
    this.offs = [];            // guest: event listeners while we have puppets
    this.holdPost = null; this.holdHp = 0;
  }
  get game() { return this.mobs.game; }
  get session() { return this.mobs.session; }

  // encounters of the map we are on
  encountersHere() { const g = this.game, id = g.world.mapId; return g.bosses ? g.bosses.list.filter((e) => e.def.map === id) : []; }
  encOf(entity) { const g = this.game; return entity && g.bosses ? g.bosses.list.find((e) => e.entity === entity) || null : null; }
  isBossActor(x) { return !!x && (x.isBoss === true || x === this.game.world.guardian); }
  bossOwner(x) { if (!x) return null; if (this.isBossActor(x)) return x; if (this.isBossActor(x.boss)) return x.boss; if (this.isBossActor(x.owner)) return x.owner; if (this.isBossActor(x.b)) return x.b; return null; }
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
    const t = now(), tick = t - this.lastSend >= 1 / ONLINE.bossRate;
    if (tick) this.lastSend = t;
    for (const enc of this.encountersHere()) {
      const e = enc.entity;
      if (!e) continue;
      this.wrapEntity(enc, e);
      const b = this.snapshot(enc, e), key = [b.st, b.state, b.pose, b.phase, b.hp, b.dead, b.hurt, b.vul, b.move, b.arm, JSON.stringify(b.mech)].join('|');
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
      vul: e.status && e.status.has('vulnerable') ? 1 : 0, move: mv ? mv[0].slice(0, 24) : null, tags,
      arm: Math.round(e.armor || 0), marm: Math.round(e.maxArmor || 0), ar: r1(e.arenaR || 0),
      mech: (e.mech || []).map((m) => (m.netState ? m.netState() : null)) };
  }

  // host: the boss's hurt / death code runs in its effects channel (its callouts / visuals reach the guests)
  wrapEntity(enc, e) {
    if (e._netWrapped || !this.game.online) return;
    e._netWrapped = true;
    const fx = this.game.online.fx, ch = this.netId(enc);
    for (const k of ['onHurt', 'onDeath', 'enterWeak']) if (typeof e[k] === 'function') { const fn = e[k].bind(e); e[k] = (...a) => fx.run(() => fn(...a), ch); }
  }

  // host: a mechanic hit / gave a status to a guest's ally proxy -> that guest applies it
  forwardDamage(src, proxy, opts = {}) {
    const b = this.bossOwner(src) || this.bossOwner(opts.owner), enc = b && this.encOf(b);
    if (enc && this.hosting()) this.send(enc, 'bdmg', { to: proxy.netPlayer, power: r1(opts.power || 0), type: opts.type || 'physical', unblockable: !!opts.unblockable, knock: opts.knock || 0, knockAng: typeof opts.knockAng === 'number' ? Math.round(opts.knockAng * 100) / 100 : null });
    return { amount: 0, crit: false, killed: false, tags: ['remote'] };
  }
  forwardStatus(proxy, id, dur, opts = {}) {
    const g = this.game, enc = (this.bossOwner(opts.source) && this.encOf(this.bossOwner(opts.source))) || (g.bosses && g.bosses.engaged);
    if (enc && this.hosting() && typeof id === 'string') this.send(enc, 'bstat', { to: proxy.netPlayer, id, dur: r1(dur || 1) });
  }

  // host: what a guest tells us ('bossEvt' relayed with from)
  onBossEvt({ id, k, d, from }) {
    const g = this.game, enc = g.bosses && typeof id === 'string' && g.bosses.get(id.slice(2)), e = enc && enc.entity;
    if (!this.mobs.host || !e || e.netPuppet || !d) return;
    const proxy = this.mobs.allies.get(from);
    if (!proxy) return;
    const mech = Number.isInteger(d.m) && e.mech ? e.mech[d.m] : null;
    if (k === 'obj' && mech && mech.netHit) this.game.online.fx.run(() => mech.netHit(d.i, clampN(d.dmg, 0, 1e6), proxy), this.netId(enc));
    else if (k === 'hold') proxy.chainHold = !!d.on;
    else if (k === 'ember') { const em = (e.mech || []).find((x) => x.add && x.stacks); if (em) em.add(proxy, Math.max(-2, Math.min(2, Math.round(d.n || 0)))); }
  }

  // a guest hit our boss (MobSync.onRemoteHit)
  applyHit(msg) {
    const g = this.game, enc = g.bosses && g.bosses.get(msg.id.slice(2)), e = enc && enc.entity;
    if (!e || e.dead || !e.hurtable || e.netPuppet) return;
    const r = this.session.remotes.get(msg.from);
    const src = { team: TEAM.PLAYER, x: r ? r.x : e.x, y: r ? r.y : e.y, remote: true, name: r ? r.name : 'ally', status: null };
    const proxy = this.mobs.allies.get(msg.from) || src, opts = { stagger: Math.min(msg.st || 0, 300) };
    let dmg = Math.round(msg.dmg * (e.status ? e.status.damageTakenMult() : 1));
    const blk = e.tryBlock ? e.tryBlock(proxy, opts) : null; // shield stance: from the front most of it is blocked
    if (blk) { const raw = dmg; dmg = Math.round(dmg * blk.mult); if (e.onBlock) e.onBlock(blk, proxy, opts, Math.atan2(e.y - proxy.y, e.x - proxy.x), raw); }
    if (msg.ad > 0 && e.armor > 0) { e.armor = Math.max(0, e.armor - msg.ad); if (e.armor <= 0 && e.onArmorBreak) this.game.online.fx.run(() => e.onArmorBreak(), this.netId(enc)); }
    e.hp -= dmg;
    e.flash = 0.12;
    if (e.onHurt) e.onHurt(dmg, proxy, opts);
    g.vfx.damage(e.x, e.y - (e.height || 40) * 0.6, dmg, { crit: !!msg.crit, color: '#c8f0ff' });
    let killed = false;
    if (e.hp <= 0 && !e.dead) { e.hp = 0; killed = true; e.onDeath(proxy); }
    g.events.emit('damageDealt', { source: proxy, target: e, amount: dmg, crit: !!msg.crit, killed, tags: ['remote'], opts }); // e.g. Ember Debt burn-off
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
        e.netDamage = (amount, opts, src, ang, crit, armorDmg) => this.reportHit(enc, amount, opts, src, crit, armorDmg);
        if (!(e.mech && e.mech.length)) { e._hudState = e.hudState; e.hudState = () => ({ tags: e.netTags || [] }); }
        if (g.bosses.engaged === enc) this.disengage(enc);
        this.listen(enc, e);
      } else {
        e.netPuppet = false; e.puppet = false; e.netDamage = null;
        if (e._hudState) { e.hudState = e._hudState; e._hudState = null; }
        (e.mech || []).forEach((m, i) => m.netClear && m.netClear(this.ctx(enc, e, i)));
        this.unlisten();
        if (isFighting(enc.state)) g.bosses.reset(enc); // its fight was the host's: ours starts fresh
      }
    }
  }

  reportHit(enc, amount, opts = {}, src, crit, armorDmg = 0) {
    if (!src || src.team !== TEAM.PLAYER || src.remote) return;
    this.session.net.send('mobHit', { id: this.netId(enc), dmg: Math.max(0, Math.round(amount)), st: Math.round(opts.stagger || 0), kb: 0, crit: !!crit, ad: Math.max(0, Math.round(armorDmg || 0)) });
  }

  // guest: helpers a mechanic's netApply gets
  ctx(enc, e, index) {
    return { me: this.session.playerId, map: this.game.world.map, game: this.game, boss: e, index,
      hitObject: (i, id, dmg) => this.session.net.send('bossEvt', { id: this.netId(enc), k: 'obj', d: { m: i, i: id, dmg } }) };
  }
  // guest: ember stacks only we can see (damage from the puppet boss on us, our perfect dodges of it) go to the host.
  // Forwarded mechanic damage (netMech: the ignite itself, lava, novas) never earns one — on the host it lands before
  // the mechanic resets the stacks, here it arrives after.
  listen(enc, e) {
    this.unlisten();
    const g = this.game, em = (e.mech || []).find((x) => x.add && x.stacks);
    if (!em) return;
    const send = (n) => this.session.net.send('bossEvt', { id: this.netId(enc), k: 'ember', d: { n } });
    this.offs.push(g.events.on('damageTaken', (ev) => { if (ev.source === e && ev.target === g.player && ev.amount > 0 && ev.type === 'magic' && !(ev.opts && ev.opts.netMech)) send(e.phase >= em.d.heavyPhase ? em.d.gainHeavy : em.d.gain); }));
    this.offs.push(g.events.on('attackDodged', (ev) => { if (ev.attacker === e && ev.perfect && ev.player === g.player) send(-1); }));
  }
  unlisten() { for (const off of this.offs) if (typeof off === 'function') off(); this.offs = []; }

  // guest, every frame: holding [E] at a lit chain post goes to the host (a hit or letting go releases it)
  guestUpdate() {
    const g = this.game, p = g.player;
    if (this.mobs.host || !p || !g.bosses) return;
    for (const enc of this.encountersHere()) {
      const e = enc.entity, sc = e && e.netPuppet && (e.mech || []).find((m) => m.lit && m.post);
      if (!sc) continue;
      const near = sc.flying ? sc.lit.find((k) => !sc.chained.includes(k) && Math.hypot(sc.post(k).x - p.x, sc.post(k).y - p.y) <= sc.d.reach) : undefined;
      const want = near !== undefined && !p.dead && !p.downed && g.input.isDown('KeyE') && !(this.holdPost !== null && p.hp < this.holdHp);
      if (want && this.holdPost === null) { this.holdPost = near; this.session.net.send('bossEvt', { id: this.netId(enc), k: 'hold', d: { on: true } }); }
      else if (!want && this.holdPost !== null) { this.holdPost = null; this.session.net.send('bossEvt', { id: this.netId(enc), k: 'hold', d: { on: false } }); }
      this.holdHp = p.hp;
    }
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
    if (typeof b.arm === 'number') { e.armor = Math.max(0, b.arm); e.maxArmor = Math.max(e.armor, b.marm || 0); }
    if (b.ar > 0) e.arenaR = b.ar;
    if (Array.isArray(b.mech) && e.mech) e.mech.forEach((m, i) => { if (m.netApply && b.mech[i] && typeof b.mech[i] === 'object') { try { m.netApply(b.mech[i], this.ctx(enc, e, i)); } catch { /* a bad state never breaks the frame */ } } });
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
    const at = sampleSnaps(e.snaps, now() - ONLINE.puppetDelay);
    if (!at) return;
    e.moving = Math.hypot(at.x - e.x, at.y - e.y) > 0.3;
    e.x = at.x; e.y = at.y;
  }

  // a boss act from the host, played on our puppet
  onAct(id, k, d) {
    const g = this.game, enc = g.bosses && g.bosses.get(id.slice(2)), e = enc && enc.entity;
    if (!e || !e.netPuppet || e.dead || !d) return;
    if (k === 'bdmg' || k === 'bstat') {
      const p = g.player;
      if (d.to !== this.session.playerId || !p || p.dead || p.downed) return;
      if (k === 'bstat') { if (typeof d.id === 'string') p.status.add(d.id, clampN(d.dur, 0, 20, 1), { source: e }); return; }
      if (p.invulnerable()) return; // our dodge / i-frames: the mechanic misses us
      g.combat.dealDamage(e, p, { power: clampN(d.power, 0, 100000), type: typeof d.type === 'string' ? d.type : 'physical', unblockable: !!d.unblockable, knock: clampN(d.knock, 0, 900), knockAng: typeof d.knockAng === 'number' ? d.knockAng : undefined, netMech: true });
      return;
    }
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
