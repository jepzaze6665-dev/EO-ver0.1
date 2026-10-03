// M0 ONLINE map mechanics (world/mapMechanics.js). Host-authoritative like the monsters: the run-map room HOST runs the
// mechanics' rules and sends their netState() ('mapm') when one changes (markNet) and every RESEND seconds; guests
// apply them (netApply). A guest's own action (a lever it pulled) goes to the host as 'mapEvt' -> mechanic netEvent().
const RATE = 0.2, RESEND = 2;
const now = () => performance.now() / 1000;

export class MapSync {
  constructor(session) {
    this.session = session;
    this.lastSend = 0; this.lastFull = 0;
    const n = session.net;
    n.on('mapm', (m) => { if (!this.hosting()) this.sys()?.netApply(m.m, m.s); });
    n.on('mapEvt', (m) => { if (this.hosting()) this.sys()?.netEvent(m.m, m.i, m.k, m.d, m.from); });
  }
  sys() { const w = this.session.game.world; return w && w.mapMech; }
  hosting() { const mobs = this.session.mobs; return !mobs || mobs.host !== false; }
  // hooked into the system while online (MapMechanicSystem.sendEvent)
  sendEvent(mapId, index, kind, data) { this.session.net.send('mapEvt', { m: mapId, i: index, k: kind, d: data }); }
  update() {
    const sys = this.sys();
    if (!sys) return;
    sys.net = this;
    if (!sys.list.length || !this.hosting() || !this.session.sharedPlay()) return;
    const t = now();
    if (t - this.lastSend < RATE) return;
    const full = t - this.lastFull >= RESEND;
    const s = sys.netStates(full);
    if (!s) return;
    this.lastSend = t;
    if (full) this.lastFull = t;
    this.session.net.send('mapm', { m: sys.mapId, s });
  }
}
