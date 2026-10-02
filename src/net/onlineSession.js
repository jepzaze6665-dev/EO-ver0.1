// ONLINE N2 — glue between the Game and the network (game.online). Lives for the whole page (not per game session).
//   - sends the local player's presence: 'pos' (map, x, y, facing, animation) at most ONLINE.sendRate a second and only
//     when it changed (+ a resend every ONLINE.idleResend s), 'look' (class, level) when it changes, 'leave' on the title
//   - keeps the other players of the shared city room (RemotePlayers) and draws them (renderer y-sort list + HUD names)
// Nothing here changes the local simulation: remote players are pictures with names.
import { NetClient, NET_STATE } from './client.js';
import { RemotePlayers } from './remotePlayers.js';
import { ONLINE } from '../data/online.js';
import { CLASSES, DEFAULT_CLASS } from '../skills/classes.js';
import { dir4, TAU } from '../core/math.js';

const NAME_KEY = 'eclipse_online_last_name';
const now = () => performance.now() / 1000;

export class OnlineSession {
  constructor(game, { client = new NetClient() } = {}) {
    this.game = game;
    this.net = client;
    this.remotes = new RemotePlayers();
    this.sent = null;          // last 'pos' sent { m, x, y, d, a, k, at }
    this.sentLook = '';
    this.inWorld = false;
    const n = this.net;
    n.on('roomState', (m) => this.remotes.setRoom(m.room, m.players, now()));
    n.on('pJoin', (m) => this.remotes.join(m.p, now()));
    n.on('pLeave', (m) => this.remotes.leave(m.id, m.why, now()));
    n.on('moves', (m) => this.remotes.moves(m.ps, now()));
    n.on('pLook', (m) => this.remotes.look(m.id, m.c, m.l));
    n.on('error', (m) => { if (m.code === 'roomFull') game.ui.toast(m.text, 3); });
    n.onState((s) => {
      // anything we knew about other players is stale once the line drops; after a reconnect send everything again
      if (s !== NET_STATE.online) this.remotes.clear();
      this.sent = null; this.sentLook = '';
      game.ui.panels.onNetState?.(s);
    });
  }

  get online() { return this.net.online; }
  get state() { return this.net.state; }
  get playerName() { return this.net.player ? this.net.player.name : null; }

  connect(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch { /* storage blocked */ }
    this.net.connect(name);
  }
  logout() { this.net.stop(); }
  lastName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }

  // every frame (play or not)
  update() {
    const g = this.game, p = g.player;
    const playing = g.state === 'play' && p && g.world;
    if (!this.online) return;
    if (!playing) {
      if (this.inWorld) { this.net.send('leave', {}); this.inWorld = false; this.sent = null; this.remotes.clear(); }
      return;
    }
    this.inWorld = true;
    const look = `${p.cls.id}:${p.level}`;
    if (look !== this.sentLook && this.net.send('look', { c: p.cls.id, l: p.level })) this.sentLook = look;
    const t = now(), m = g.world.mapId;
    if (!m) return;
    const ad = p.sprites && p.sprites.anims[p.anim];
    const pos = { m, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, d: dir4(p.facing), a: (p.anim || 'idle').slice(0, 24), k: ad && !ad.loop ? Math.round(Math.min(1, Math.max(0, p.animProgress || 0)) * 100) / 100 : 0 };
    const s = this.sent;
    const changed = !s || s.m !== pos.m || s.x !== pos.x || s.y !== pos.y || s.d !== pos.d || s.a !== pos.a || s.k !== pos.k;
    if (s && t - s.at < 1 / ONLINE.sendRate) return;
    if (!changed && s && t - s.at < ONLINE.idleResend) return;
    if (s && s.m !== pos.m) this.remotes.clear(); // left the room: the server sends the new room's roomState
    if (this.net.send('pos', pos)) this.sent = { ...pos, at: t };
  }

  // the other players to draw on the map the local player is on
  drawables() {
    const g = this.game;
    if (!this.remotes.room || this.remotes.room !== g.world.mapId) return [];
    const list = this.remotes.visible(now());
    for (const r of list) if (!r.draw) r.draw = (ctx) => this.drawRemote(ctx, r);
    return list;
  }

  drawRemote(ctx, r) {
    const g = this.game, t = now();
    const cls = CLASSES[r.cls] || CLASSES[DEFAULT_CLASS];
    const sp = g.spritesFor(cls);
    const ad = sp.anims[r.a];
    const f = sp.frame(sp.anims[r.a] ? r.a : 'idle', ad && ad.loop ? t - r.animSince : r.k, r.d);
    const a = r.alpha(t);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * a})`;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, 12, 4.5, 0, 0, TAU); ctx.fill();
    sp.draw(ctx, f, r.x, r.y, a * (r.leaving ? 1 : 0.97));
  }
}
