// ONLINE N7a — shared monsters in a run map (host-authoritative). One client per run-map room is the HOST
// (server 'roomHost'): it simulates that map's monsters exactly as in solo play and sends snapshots ('mobs': changed
// monsters ONLINE.mobs.rate times a second, every nearby monster each ONLINE.mobs.fullEvery s). Every other member is a
// GUEST: its own monsters of that map are put aside (stash) and its spawn points pause; it shows PUPPETS instead — real
// Monster objects with `puppet` set, drawn / targeted / hit like any monster but moved by snapshots, not by AI.
// A guest's hit on a puppet: the damage number shows at once, the HP is the host's (the hit goes to the host as 'mobHit';
// the host applies it to its monster, the next snapshot carries the new HP). Only the host decides a death; a puppet dies
// when a snapshot says so and then pays EXP / quest credit / loot locally like a kill (N8 / N9 move that to the server).
// Host leaves -> the server names a new host: guests drop their puppets; the new host takes its own monsters back.
// N7b MONSTERS FIGHT EVERYONE: on the host, every guest of the room is an ALLY PROXY (position from the presence stream,
// HP share h, down at 0) that monsters target like a player (game.combatants()). The host never resolves a hit on a proxy:
// when a monster STARTS an attack it sends 'mobAct' — 'tel' (the telegraph shape, timing, final power, knock / guard break /
// status) or 'proj' (the shots it fired) — and each guest plays it on its own puppet and resolves it against ITSELF
// (telegraph end -> combat.enemyStrike; dash = touching the puppet while its charge is active; shots = local projectiles),
// so dodge / guard / parry timing is always the guest's own. N7c BOSSES: net/bossSync.js (this.bosses).
import { ONLINE } from '../data/online.js';
import { MOB_STATES, MOB_PHASES } from './protocol.js';
import { TEAM } from '../core/constants.js';
import { Monster } from '../monsters/monster.js';
import { StatusSet } from '../status/status.js';
import { CLASSES } from '../skills/classes.js';
import { BossSync } from './bossSync.js';

const SHAPES = new Set(['circle', 'ring', 'cone', 'line']);
const clampN = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const DIR_ANG = [Math.PI / 2, -Math.PI / 2, 0, Math.PI]; // dir4: down, up, right, left

const now = () => performance.now() / 1000;
const r1 = (v) => Math.round(v * 10) / 10;

export class MobSync {
  constructor(session) {
    this.session = session;
    this.room = null; this.mapId = null;
    this.host = true;            // until the server names another host, our monsters are real
    this.stash = new Map();      // map id -> our own monsters put aside while we are a guest there
    this.paused = new Set();     // map ids whose spawn points wait (guest)
    this.puppets = new Map();    // net id -> puppet Monster
    this.sent = new Map();       // host: net id -> last row sent (deltas)
    this.counter = 0;
    this.lastSend = 0; this.lastFull = 0;
    this.allies = new Map();     // host: player id -> ally proxy (a guest in this room)
    this.bosses = new BossSync(this); // N7c
    const n = session.net;
    n.on('mobAct', (m) => (m.k && m.k[0] === 'b' ? !this.host && this.bosses.onAct(m.id, m.k, m.d) : this.onMobAct(m)));
    n.on('roomHost', (m) => this.setHost(m));
    n.on('mobs', (m) => this.onMobs(m));
    n.on('mobHit', (m) => this.onRemoteHit(m));
  }

  get game() { return this.session.game; }
  get world() { return this.game.world; }
  isPaused(mapId) { return this.paused.has(mapId); }

  // roomState arrived: a new room (city = no host logic)
  onRoom(room, mapId) {
    if (room === this.room) return;
    this.clearPuppets();
    this.dropAllies();
    this.room = room; this.mapId = mapId;
    this.sent.clear(); this.lastFull = 0;
    if (!room || !room.includes(':')) this.becomeHost(); // a city or no room: our monsters are real
  }

  setHost({ room, host }) {
    if (room !== this.room) return;
    if (host === this.session.playerId) this.becomeHost();
    else this.becomeGuest();
  }

  becomeGuest() {
    const w = this.world, id = this.mapId;
    this.clearPuppets();
    this.dropAllies();
    if (this.host || !this.paused.has(id)) {
      const mine = w.monsters.filter((m) => !m.puppet && w.onMap(m) && !m.summoned);
      w.monsters = w.monsters.filter((m) => !mine.includes(m));
      this.stash.set(id, (this.stash.get(id) || []).concat(mine));
      this.paused.add(id);
      for (const m of mine) this.game.attackSlots.release(m, true);
      this.game.combat.telegraphs.clear();
    }
    this.host = false;
    this.bosses.setPuppets(true);
  }

  becomeHost() {
    this.clearPuppets();
    this.bosses.setPuppets(false);
    if (!this.host || this.paused.size) this.restore(this.mapId);
    this.host = true;
    this.lastFull = 0; this.sent.clear();
  }

  // give our own monsters of a map back (or every map: run over / offline)
  restore(mapId) {
    const w = this.world;
    for (const id of mapId ? [mapId] : [...this.stash.keys()]) {
      const list = this.stash.get(id);
      if (list) w.monsters.push(...list.filter((m) => !m.dead));
      this.stash.delete(id);
      this.paused.delete(id);
    }
  }

  reset() { this.clearPuppets(); this.bosses.setPuppets(false); this.restore(null); this.room = null; this.host = true; this.sent.clear(); this.dropAllies(); }

  clearPuppets() {
    if (!this.puppets.size) return;
    const w = this.world;
    w.monsters = w.monsters.filter((m) => !m.puppet);
    if (this.game.targets && this.game.targets.current && this.game.targets.current.puppet) this.game.targets.set(null);
    this.puppets.clear();
  }

  // ---------------- host side: ally proxies (guests as monster targets)
  // the guests standing on this run map, as targets for our monsters (empty unless we host a run room)
  allyList() {
    const s = this.session;
    if (!this.host || !this.room || !this.room.includes(':') || !s.online) return [];
    const here = s.remotes.here(this.world.mapId), seen = new Set(), out = [];
    if (here) for (const r of s.remotes.list) {
      if (r.leaving) continue;
      seen.add(r.id);
      let a = this.allies.get(r.id);
      if (!a) { a = this.makeAlly(r); this.allies.set(r.id, a); }
      a.x = r.x; a.y = r.y; a.facing = DIR_ANG[r.d] ?? 0;
      a.hp = Math.round((r.h ?? 1) * a.maxHp); a.dead = (r.h ?? 1) <= 0;
      a.cls = CLASSES[r.cls] || null;
      out.push(a);
    }
    for (const [id, a] of this.allies) if (!seen.has(id)) { a.dead = true; this.allies.delete(id); }
    return out;
  }
  makeAlly(r) {
    const a = { id: 'ally_' + r.id, netPlayer: r.id, name: r.name, isAlly: true, team: TEAM.PLAYER, x: r.x, y: r.y, radius: 10, hurtRadius: 12,
      hp: 100, maxHp: 100, dead: false, downed: false, facing: 0, idleT: 0, aggro: 0, hurtable: false,
      invulnerable: () => true, canPerfect: () => false };
    a.status = new StatusSet(a);
    return a;
  }
  dropAllies() { for (const a of this.allies.values()) a.dead = true; this.allies.clear(); }

  // a monster of ours started an attack / fired shots: the guests play it and resolve it against themselves
  hostAct(m, k, d) {
    const s = this.session;
    if (!this.host || !this.room || !this.room.includes(':') || !s.online || !s.remotes.list.some((r) => !r.leaving)) return;
    if (!m.netId) m.netId = 'm' + (++this.counter).toString(36);
    s.net.send('mobAct', { id: m.netId, k, d });
  }

  update() {
    const s = this.session, g = this.game;
    if (this.host && g.state === 'play') this.bosses.update(); // N7c: every frame (shots are batched per frame)
    if (!this.host || !this.room || !this.room.includes(':') || !s.online || g.state !== 'play') return;
    if (!s.remotes.list.some((r) => !r.leaving)) return; // alone in the room: nothing to send
    const t = now();
    if (t - this.lastSend < 1 / ONLINE.mobs.rate) return;
    this.lastSend = t;
    const full = t - this.lastFull >= ONLINE.mobs.fullEvery;
    if (full) this.lastFull = t;
    const near = [g.player, ...s.remotes.list.filter((r) => !r.leaving)], R = ONLINE.mobs.range;
    const rows = [];
    for (const m of this.world.monsters) {
      if (m.puppet || !this.world.onMap(m)) continue;
      if (!m.dead && !m.aggro && !near.some((p) => Math.abs(p.x - m.x) < R && Math.abs(p.y - m.y) < R)) continue;
      if (!m.netId) m.netId = 'm' + (++this.counter).toString(36);
      const row = this.rowOf(m), key = row.join(',');
      if (!full && this.sent.get(m.netId) === key) continue;
      this.sent.set(m.netId, key);
      rows.push(row);
      if (rows.length >= ONLINE.mobs.maxRows) break;
    }
    if (rows.length || full) s.net.send('mobs', { ps: rows, full });
  }

  rowOf(m) {
    const atk = m.cur ? m.def.attacks.indexOf(m.cur) : -1;
    const flags = (m.elite ? 1 : 0) | (m.corrupted ? 2 : 0) | (m.moving ? 4 : 0);
    return [m.netId, m.type, r1(m.x), r1(m.y), Math.max(0, Math.round(m.hp)), m.maxHp, Math.round(m.facing * 100), Math.max(0, MOB_STATES.indexOf(m.state)),
      atk, Math.max(0, MOB_PHASES.indexOf(m.phase)), m.dead ? 1 : 0, flags, m.level || 1, Math.round(m.armor || 0)];
  }

  // a guest's hit on one of our monsters (relayed by the server)
  onRemoteHit(msg) {
    if (!this.host) return;
    if (msg.id.startsWith('b_')) return this.bosses.applyHit(msg); // N7c: a hit on our boss
    const m = this.world.monsters.find((x) => x.netId === msg.id && !x.puppet);
    if (!m || m.dead) return;
    const r = this.session.remotes.get(msg.from);
    const src = { team: TEAM.PLAYER, x: r ? r.x : m.x, y: r ? r.y : m.y, remote: true, name: r ? r.name : 'ally', status: null };
    const ang = msg.ang ?? Math.atan2(m.y - src.y, m.x - src.x);
    m.hp -= msg.dmg;
    m.flash = 0.12;
    if (msg.kb > 0 && !m.superArmor) m.knockback(ang, Math.min(msg.kb, 400));
    m.onHurt(msg.dmg, src, { stagger: Math.min(msg.st || 0, 200) }, ang);
    this.game.vfx.damage(m.x, m.y - (m.height || 30) * 0.5 - 6, msg.dmg, { crit: !!msg.crit, color: '#c8f0ff' });
    if (m.hp <= 0 && !m.dead) { m.hp = 0; m.onDeath(src, {}); }
  }

  // ---------------- guest side
  onMobAct({ id, k, d }) {
    if (this.host || !d) return;
    const m = this.puppets.get(id), g = this.game;
    if (!m || m.dead) return;
    const power = clampN(d.power, 0, 100000);
    const extra = { knock: clampN(d.knock, 0, 900), guardBreak: !!d.guardBreak, unblockable: !!d.unblockable,
      status: Array.isArray(d.status) ? d.status.filter((x) => x && typeof x.id === 'string').slice(0, 4).map((x) => ({ id: x.id, dur: clampN(x.dur, 0, 20) })) : undefined };
    if (k === 'tel') {
      const sh = d.shape || {};
      if (!SHAPES.has(sh.shape)) return;
      const shape = { shape: sh.shape, x: clampN(sh.x, 0, 1e5), y: clampN(sh.y, 0, 1e5), r: clampN(sh.r, 0, 600), r0: clampN(sh.r0, 0, 600), ang: clampN(sh.ang, -10, 10),
        half: clampN(sh.half, 0, Math.PI), len: clampN(sh.len, 0, 900), width: clampN(sh.width, 0, 400) };
      m.netAtk = { kind: d.kind, power, extra };
      const strike = d.kind === 'strike';
      g.combat.telegraphs.add({ ...shape, total: clampN(d.total, 0.05, 6, 0.6), owner: m, onResolve: strike ? () => { if (!m.dead) g.combat.enemyStrike(m, shape, power, extra); } : undefined });
    } else if (k === 'proj' && Array.isArray(d.list)) {
      for (const p of d.list.slice(0, 24)) {
        g.combat.projectiles.fire({ x: clampN(p.x, 0, 1e5), y: clampN(p.y, 0, 1e5), vx: clampN(p.vx, -2000, 2000), vy: clampN(p.vy, -2000, 2000), r: clampN(p.r, 1, 40, 5),
          life: clampN(p.life, 0.1, 6, 2), owner: m, power, kind: typeof p.kind === 'string' ? p.kind : 'shard', homing: clampN(p.homing, 0, 10), color: typeof p.color === 'string' ? p.color : '#5af0ff',
          status: extra.status });
      }
    }
  }

  // guest: the puppet's charge is active — touching it hurts (once per charge), resolved here on our own player
  puppetDash(m) {
    const a = m.netAtk, g = this.game;
    if (this.host || !a || a.kind !== 'dash' || m.dashHit) return;
    if (g.combat.enemyStrike(m, { shape: 'circle', x: m.x, y: m.y, r: m.radius + 6 }, a.power, { ...a.extra, knock: a.extra.knock || 220, knockAng: m.facing })) m.dashHit = true;
  }

  onMobs({ ps, full }) {
    if (this.host || !this.room) return;
    const w = this.world, t = now(), seen = new Set();
    for (const row of ps) {
      const [id, type, x, y, hp, maxHp, f, st, atk, ph, dead, flags, level, armor] = row;
      seen.add(id);
      let m = this.puppets.get(id);
      if (!m) {
        if (dead) continue; // never bring back a corpse we did not see fall
        m = this.makePuppet(id, type, x, y, flags, level);
        if (!m) continue;
      }
      m.snaps.push({ t, x, y });
      if (m.snaps.length > 12) m.snaps.shift();
      m.hp = hp; m.maxHp = maxHp; m.facing = f / 100; m.level = level; m.armor = armor;
      m.moving = !!(flags & 4);
      const state = MOB_STATES[st], cur = atk >= 0 ? m.def.attacks[atk] || null : null, phase = MOB_PHASES[ph];
      if (state !== m.state || cur !== m.cur || phase !== m.phase) { if (phase === 'active' && m.phase !== 'active') m.dashHit = false; m.state = state; m.cur = cur; m.phase = phase; m.stateT = 0; }
      if (state !== 'idle' && state !== 'patrol' && state !== 'return') m.aggro = true;
      if (dead && !m.dead) this.puppetDied(m);
    }
    if (full) for (const [id, m] of this.puppets) if (!seen.has(id) && !m.dead) { m.dead = true; m.removed = true; m.deathT = 1; this.puppets.delete(id); w.monsters = w.monsters.filter((x) => x !== m); }
    for (const [id, m] of this.puppets) if (m.dead && m.deathT > 0.8) this.puppets.delete(id);
  }

  makePuppet(id, type, x, y, flags, level) {
    const w = this.world;
    let m;
    try { m = new Monster(this.game, type, x, y, { elite: !!(flags & 1), corrupted: !!(flags & 2) }); } catch { return null; }
    m.puppet = true; m.netId = id; m.level = level; m.snaps = [];
    m.netDamage = (amount, opts, src, ang, crit) => this.reportHit(m, amount, { ...opts, crit }, src, ang);
    this.puppets.set(id, m);
    w.monsters.push(m);
    return m;
  }

  // our hit on a puppet: the host applies it (the local number already showed)
  reportHit(m, amount, opts = {}, src, ang) {
    if (!src || src.team !== TEAM.PLAYER || src.remote) return;
    this.session.net.send('mobHit', { id: m.netId, dmg: Math.max(0, Math.round(amount)), st: Math.round(opts.stagger || 0), kb: Math.round(opts.knock || 0), ang: Math.round((ang || 0) * 100) / 100, crit: !!opts.crit });
  }

  puppetDied(m) {
    m.dead = true; m.deathT = 0; m.hp = 0; m.state = 'dead';
    this.game.combat.telegraphs.cancelOwner(m);
    this.world.onMonsterKilled(m, null); // shared kill: EXP / quest credit / loot for this member (N8 / N9: server)
  }
}
