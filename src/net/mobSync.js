// ONLINE N7a — shared monsters in a run map (host-authoritative). One client per run-map room is the HOST
// (server 'roomHost'): it simulates that map's monsters exactly as in solo play and sends snapshots ('mobs': changed
// monsters ONLINE.mobs.rate times a second, every nearby monster each ONLINE.mobs.fullEvery s). Every other member is a
// GUEST: its own monsters of that map are put aside (stash) and its spawn points pause; it shows PUPPETS instead — real
// Monster objects with `puppet` set, drawn / targeted / hit like any monster but moved by snapshots, not by AI.
// A guest's hit on a puppet: the damage number shows at once, the HP is the host's (the hit goes to the host as 'mobHit';
// the host applies it to its monster, the next snapshot carries the new HP). Only the host decides a death; a puppet dies
// when a snapshot says so and then pays EXP / quest credit / loot locally like a kill (N8 / N9 move that to the server).
// Host leaves -> the server names a new host: guests drop their puppets; the new host takes its own monsters back.
// NOT yet (N7b): monsters attacking guests, telegraphs on guests, bosses.
import { ONLINE } from '../data/online.js';
import { MOB_STATES, MOB_PHASES } from './protocol.js';
import { TEAM } from '../core/constants.js';
import { Monster } from '../monsters/monster.js';

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
    const n = session.net;
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
    if (this.host || !this.paused.has(id)) {
      const mine = w.monsters.filter((m) => !m.puppet && w.onMap(m) && !m.summoned);
      w.monsters = w.monsters.filter((m) => !mine.includes(m));
      this.stash.set(id, (this.stash.get(id) || []).concat(mine));
      this.paused.add(id);
      for (const m of mine) this.game.attackSlots.release(m, true);
      this.game.combat.telegraphs.clear();
    }
    this.host = false;
  }

  becomeHost() {
    this.clearPuppets();
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

  reset() { this.clearPuppets(); this.restore(null); this.room = null; this.host = true; this.sent.clear(); }

  clearPuppets() {
    if (!this.puppets.size) return;
    const w = this.world;
    w.monsters = w.monsters.filter((m) => !m.puppet);
    if (this.game.targets && this.game.targets.current && this.game.targets.current.puppet) this.game.targets.set(null);
    this.puppets.clear();
  }

  // ---------------- host side
  update() {
    const s = this.session, g = this.game;
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
      if (state !== m.state || cur !== m.cur || phase !== m.phase) { m.state = state; m.cur = cur; m.phase = phase; m.stateT = 0; }
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
