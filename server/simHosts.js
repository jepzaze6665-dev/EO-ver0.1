// ONLINE H2 (docs/online/HEADLESS_SERVER_PLAN.md) — the SERVER hosts every dungeon map room.
// When a run-map room `<run>:<map>` gets its first player, the server starts a SimGame (src/sim/simGame.js = the real game
// with no screen) on that map and connects it to itself like a client, with a secret key instead of a name + token. That
// client becomes the ROOM HOST: it simulates the map's monsters, bosses and map mechanics with the same code a player host
// used (net/mobSync.js, net/bossSync.js, net/mapSync.js) and sends the same snapshots — so every player is a GUEST and the
// browsers need no change. Its own character is a ghost: invulnerable, not a target (game.players() = []), never shown to
// anyone (server/cityRooms.js filters `sim` sessions out of every player list).
// Until the SimGame is ready (first start ~1 s, later ones faster) the first player hosts as before; if it fails to start the
// room just keeps its player host. The last player leaving the room stops it. Bosses already killed in this run
// (instance.kills, server/progress.js) stay dead in a new SimGame of that run.
import crypto from 'crypto';

export class SimHostService {
  constructor(server, { enabled = false } = {}) {
    this.server = server;
    this.enabled = enabled;
    this.key = crypto.randomBytes(16).toString('hex');
    this.rooms = new Map(); // room key -> { room, map, sim, timer, session, stopped }
    this.counter = 0;
  }
  log(...a) { this.server.log.info?.(...a); }

  // a new run-map room got its first player
  request(room) {
    if (!this.enabled || this.rooms.has(room) || !this.server.port) return;
    const i = room.indexOf(':');
    if (i < 0) return;
    const entry = { room, inst: room.slice(0, i), map: room.slice(i + 1), sim: null, timer: null, session: null, stopped: false };
    this.rooms.set(room, entry);
    this.start(entry).catch((e) => {
      this.server.log.error?.(`[server] room host for ${room} failed:`, e);
      this.stop(room);
    });
  }

  async start(entry) {
    const { createSimGame, SIM_STEP } = await import('../src/sim/simGame.js');
    const t0 = Date.now();
    const sim = await createSimGame({ classId: 'umbral_sword', online: true });
    if (entry.stopped) return;
    entry.sim = sim;
    const g = sim.game, w = g.world, def = w.mapManager.get(entry.map);
    if (!def) throw new Error('unknown map ' + entry.map);
    // the host's own character: a ghost that never fights and is never targeted
    g.players = () => [];
    // nobody reads windows here: a text / lore panel opened by the game (e.g. on the Guardian's wake) must never pause
    // the room host's world (it froze the Guardian in its roar for the whole party)
    g.worldRuns = () => g.state === 'play';
    // its world starts fresh: a player standing in this room already met what this map's bosses need to appear
    // (the A1 Guardian waits for flag gateOpened — without it the server's Guardian never woke and stood still)
    const { BOSSES } = await import('../src/data/bosses.js');
    for (const b of Object.values(BOSSES)) {
      if (b.map !== entry.map) continue;
      for (const r of b.appear || []) if (r && r.type === 'flag' && r.flag) w.state.flags[r.flag] = true;
    }
    w.changeMap(entry.map, { entry: def.spawn, silent: true });
    g.player.invulnT = 1e9;
    // bosses already down in this run stay down
    const inst = this.server.dungeons.instances.get(entry.inst);
    for (const id of (inst && inst.kills) || []) { g.worldProgress.defeatBoss(id); g.bosses.runKills.add(id); }
    // H5a: kills this room host sees are paid by the server to the players in the room (server/economy.js)
    g.events.on('enemyDefeated', (ev) => { if (!entry.stopped) this.server.economy.grantKill(entry.room, ev); });
    // connect back to this server as the room host
    const net = g.online.net;
    net.url = `ws://127.0.0.1:${this.server.port}/ws`;
    net.helloExtra = { sim: `${this.key}|${entry.room}` };
    g.online.connect('RoomHost');
    let last = Date.now(), acc = 0;
    entry.timer = setInterval(() => {
      const now = Date.now();
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      for (let n = 0; acc >= SIM_STEP && n < 6; n++) { g.player.invulnT = 1e9; sim.tick(SIM_STEP); acc -= SIM_STEP; }
      g.online.update(); // snapshots to the room (throttled by real time inside)
    }, 1000 / 60);
    entry.timer.unref?.();
    this.log(`[server] room host started for ${entry.room} (${Date.now() - t0} ms)`);
  }

  // GameServer.login: a hello carrying { sim: '<key>|<room>' }
  login(c, msg) {
    const [key, room] = String(msg.sim).split('|');
    const entry = this.rooms.get(room);
    if (key !== this.key || !entry || entry.stopped) { this.server.kick(c, 'token', 'not a room host'); return; }
    const S = this.server;
    const session = { id: 'sim' + (++this.counter).toString(36), name: msg.name, conn: c, since: Date.now(), sim: true, send: (t, f) => S.sendTo(c, t, f) };
    c.session = session;
    S.sessions.set(session.id, session);
    entry.session = session;
    session.send('welcome', { v: msg.v, id: session.id, name: session.name, token: crypto.randomBytes(16).toString('hex'), created: false });
    if (!S.city.joinSim(session, room, entry.map)) this.stop(room); // everyone left while it was starting
  }

  stop(room) {
    const entry = this.rooms.get(room);
    if (!entry) return;
    entry.stopped = true;
    this.rooms.delete(room);
    clearInterval(entry.timer);
    try { if (entry.sim) entry.sim.game.online.net.stop(); } catch { /* already closed */ }
    entry.sim = null;
  }
  hosting(room) { const e = this.rooms.get(room); return !!(e && e.session); }

  close() { for (const room of [...this.rooms.keys()]) this.stop(room); }
}
