// ONLINE N2 — glue between the Game and the network (game.online). Lives for the whole page (not per game session).
//   - sends the local player's presence: 'pos' (map, x, y, facing, animation) at most ONLINE.sendRate a second and only
//     when it changed (+ a resend every ONLINE.idleResend s), 'look' (class, level) when it changes, 'leave' on the title
//   - keeps the other players of the shared city room (RemotePlayers) and draws them (renderer y-sort list + HUD names)
//   - N3: keeps the player's saves on the server (ServerSaveAdapter becomes game.save.storage once 'saveData' arrives;
//     saveReady = the title may offer Continue / New Game). A save left in this browser from before online play is
//     uploaded once, to the first player who logs in with no server save.
//   - N4: the online party (server/parties.js): `party` ({ id, leader, members }) / `invites`; actions go straight to the
//     server (partyAction), which decides everything; the party panel (panels.party) and the HUD list read this state.
//   - N5: dungeon entry — `check` (a party ready check in progress) and `instance` (the run the server put us in);
//     'dungeonGo' = game.enterDungeon(area). Entering is always the server's decision.
// Nothing here changes the local simulation: remote players are pictures with names.
import { NetClient, NET_STATE } from './client.js';
import { RemotePlayers } from './remotePlayers.js';
import { ONLINE } from '../data/online.js';
import { CLASSES, DEFAULT_CLASS } from '../skills/classes.js';
import { dir4, TAU } from '../core/math.js';
import { ServerSaveAdapter } from './serverSave.js';
import { MobSync } from './mobSync.js';
import { NetRevive } from './netRevive.js';
import { NetFx } from './netFx.js';
import { SAVE_KEY, BACKUP_KEY } from '../save/save.js';

const NAME_KEY = 'eclipse_online_last_name';
const TAB_KEY = 'eclipse_online_tab_'; // + name: '<tab id>:<time>' = which open tab of this browser played it, and when
// this tab's id (sessionStorage survives a reload of the same tab, not a new tab)
const TAB_ID = (() => { try { let id = sessionStorage.getItem('eclipse_online_tab_id'); if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('eclipse_online_tab_id', id); } return id; } catch { return 'x'; } })();
const CLAIM_KEY = 'eclipse_online_local_save_moved'; // the pre-online browser save was moved to this player
const now = () => performance.now() / 1000;

export class OnlineSession {
  constructor(game, { client = new NetClient() } = {}) {
    this.game = game;
    this.net = client;
    this.remotes = new RemotePlayers();
    this.sent = null;          // last 'pos' sent { m, x, y, d, a, k, at }
    this.sentLook = '';
    this.inWorld = false;
    this.saves = new ServerSaveAdapter(this.net, { mainKey: SAVE_KEY, backupKey: BACKUP_KEY });
    this.mobs = new MobSync(this); // N7a shared monsters in a run map
    this.revive = new NetRevive(this); // revive teammates on other clients
    this.fx = new NetFx(this);         // friends' skill effects
    this.fx.install();
    this.saveReady = false;
    this.playerId = null;
    const n = this.net;
    this.party = null;         // server's view of my party (null = none)
    this.invites = [];         // open invites: { party, from, size }
    n.on('welcome', (m) => { if (m.id !== this.playerId) { this.saves.reset(); this.playerId = m.id; this.party = null; this.invites = []; } });
    n.on('party', (m) => { this.party = m.party; this.refreshParty(); });
    this.openParties = [];     // open parties at this city's gate (server 'partyListData', asked by panels.dungeonGate)
    n.on('partyListData', (m) => { this.openParties = m.parties; this.refreshParty(); });
    n.on('partyInvite', (m) => {
      this.invites = this.invites.filter((i) => i.party !== m.party).concat([{ party: m.party, from: m.from, size: m.size }]);
      game.ui.notify('Party invite', `${m.from} invites you  ·  [P] Party`, '#9ad8ff');
      game.audio.sfx('quest');
      this.refreshParty();
    });
    n.on('partyInviteGone', (m) => { this.invites = this.invites.filter((i) => i.party !== m.party); this.refreshParty(); });
    n.on('partyInfo', (m) => { game.ui.toast(m.text, 2.5); });
    this.check = null;         // party ready check in progress (server 'dungeonCheck')
    this.instance = null;      // { id, area, mode, members } once the server sent us into a run
    n.on('dungeonCheck', (m) => {
      if (!this.check || this.check.check !== m.check) game.audio.sfx('quest');
      this.check = m;
      game.ui.panels.dungeonReady();
    });
    n.on('dungeonCancel', (m) => {
      this.check = null;
      game.ui.toast('Dungeon entry cancelled — ' + m.reason, 3.5);
      const pn = game.ui.panels;
      if (pn.current && pn.current.name === 'dungeonReady') pn.close(true);
    });
    // N6: the run the server has us in (gate entry, walking out on foot, leaving) — null in a city
    n.on('instanceState', (m) => { this.instance = m.instance; if (!m.instance) this.mobs.reset(); });
    n.on('dungeonLeft', (m) => { this.instance = null; game.returnToCity(m.city); });
    n.on('dungeonGo', (m) => {
      this.check = null;
      this.instance = { id: m.instance, area: m.area, mode: m.mode, members: m.members };
      game.enterDungeon(m.area, m);
    });
    n.on('saveData', (m) => this.onSaveData(m));
    n.on('roomState', (m) => { this.remotes.setRoom(m.room, m.players, now(), m.map || m.room); this.mobs.onRoom(m.room, m.map || m.room); });
    n.on('pJoin', (m) => this.remotes.join(m.p, now()));
    n.on('pLeave', (m) => this.remotes.leave(m.id, m.why, now()));
    n.on('moves', (m) => this.remotes.moves(m.ps, now()));
    n.on('pLook', (m) => this.remotes.look(m.id, m.c, m.l));
    n.on('error', (m) => { if (m.code === 'roomFull' || m.code === 'party' || m.code === 'dungeon') { game.ui.toast(m.text, m.code === 'dungeon' ? 4.5 : 3); if (m.code !== 'roomFull') game.audio.sfx('deny'); } });
    n.onState((s) => {
      // anything we knew about other players is stale once the line drops; after a reconnect send everything again
      if (s !== NET_STATE.online) { this.remotes.clear(); this.saveReady = false; if (this.mobs) this.mobs.reset(); }
      this.sent = null; this.sentLook = '';
      game.ui.panels.onNetState?.(s);
    });
  }

  onSaveData(m) {
    const won = this.saves.load(m);
    if (!m.main && !m.backup && won === 'server') this.moveLocalSave();
    this.game.save.storage = this.saves;
    this.saveReady = true;
    this.game.ui.panels.onNetState?.('saveReady');
  }

  moveLocalSave() {
    let text = null;
    try { if (!localStorage.getItem(CLAIM_KEY)) text = localStorage.getItem(SAVE_KEY); } catch { return; }
    if (!text) return;
    this.saves.write(SAVE_KEY, text);
    try { localStorage.setItem(CLAIM_KEY, this.playerName || '?'); } catch { /* ignore */ }
    this.game.ui.toast('Your save from this browser now lives on the server', 3);
  }

  get online() { return this.net.online; }
  get state() { return this.net.state; }
  get playerName() { return this.net.player ? this.net.player.name : null; }

  connect(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch { /* storage blocked */ }
    this.net.connect(name);
  }
  logout() { this.net.stop(); this.party = null; this.invites = []; this.check = null; this.instance = null; }

  // party actions: the server checks and answers with 'party' / 'partyInfo' / an error
  partyAction(type, fields = {}) { return this.net.send(type, fields); }
  get isLeader() { return !!this.party && this.party.leader === this.playerId; }
  refreshParty() {
    const pn = this.game.ui.panels, c = pn.current && pn.current.name;
    if (c === 'party') pn.party();
    else if (c === 'gate') pn.dungeonGate();
  }
  lastName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
  // tabs of one browser share storage: each online tab stamps its name every 2 s (update), so a new tab does not
  // auto-login with a name another open tab is using
  nameInUseElsewhere(name) {
    try { const [tab, at] = (localStorage.getItem(TAB_KEY + name.toLowerCase()) || ':0').split(':'); return tab !== TAB_ID && Date.now() - Number(at) < 5000; } catch { return false; }
  }
  stampName() {
    const t = Date.now();
    if (!this.online || !this.playerName || t - (this.stampAt || 0) < 2000) return;
    this.stampAt = t;
    try { localStorage.setItem(TAB_KEY + this.playerName.toLowerCase(), TAB_ID + ':' + t); } catch { /* storage blocked */ }
  }

  // every frame (play or not)
  update() {
    const g = this.game, p = g.player;
    const playing = g.state === 'play' && p && g.world;
    if (!this.online) return;
    this.stampName();
    if (!playing) {
      if (this.inWorld) { this.net.send('leave', {}); this.inWorld = false; this.sent = null; this.remotes.clear(); }
      return;
    }
    this.inWorld = true;
    this.mobs.update(); // N7a: host snapshots (own throttle)
    this.fx.flush();
    const look = `${p.cls.id}:${p.level}`;
    if (look !== this.sentLook && this.net.send('look', { c: p.cls.id, l: p.level })) this.sentLook = look;
    const t = now(), m = g.world.mapId;
    if (!m) return;
    const ad = p.sprites && p.sprites.anims[p.anim];
    const down = !!p.downed;
    const pos = { m, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, d: dir4(p.facing), a: down ? 'death' : (p.anim || 'idle').slice(0, 24), dn: down, k: down ? 1 : ad && !ad.loop ? Math.round(Math.min(1, Math.max(0, p.animProgress || 0)) * 100) / 100 : 0, h: p.dead || p.downed ? 0 : Math.round(Math.max(0, Math.min(1, p.hp / p.maxHp)) * 100) / 100 };
    const s = this.sent;
    const changed = !s || s.m !== pos.m || s.x !== pos.x || s.y !== pos.y || s.d !== pos.d || s.a !== pos.a || s.k !== pos.k || s.h !== pos.h || s.dn !== pos.dn;
    if (s && t - s.at < 1 / ONLINE.sendRate) return;
    if (!changed && s && t - s.at < ONLINE.idleResend) return;
    if (s && s.m !== pos.m) this.remotes.clear(); // left the room: the server sends the new room's roomState
    if (this.net.send('pos', pos)) this.sent = { ...pos, at: t };
  }

  // the return stone at an area's start (exploration/interactables.js 'cityReturn'): the server ends our part of the run
  // and answers 'dungeonLeft' { city }. DEV offline (?offline): straight back to Lumina.
  leaveDungeon() {
    if (!this.online) return this.game.returnToCity('lumina');
    if (!this.net.send('dungeonLeave', {})) this.game.ui.toast('Not connected', 2);
  }

  // the other players to draw on the map the local player is on
  drawables() {
    const g = this.game;
    if (!this.remotes.here(g.world.mapId)) return [];
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
