// MAP MECHANICS (M0) — a map's own signature mechanic (weather, darkness, water level, rune switches ...), the map
// counterpart of boss/mechanics.js. Map data names them: maps/*.js `mechanics: [{ type: '<type>', ...options }]`.
// Only the CURRENT map's mechanics exist: they are built when the map is entered and dropped (exit()) when it is left
// or its grid is unloaded. A new mechanic = a class extending MapMechanic + registerMapMechanic(type, cls); the core
// never names a map or a mechanic type.
//
// Hooks (all optional):
//   enter()               map entered (fresh object every entry)       exit()     map left / grid unloaded: undo world changes
//   update(dt)            every frame while on the map                  reset()    the player respawned (checkpoint)
//   drawGround(ctx, t)    world space, under the y-sorted objects        drawAbove(ctx, t)  world space, over them
//   drawScreen(ctx, game) view space after the lighting (weather / darkness overlays)
//   hudTags()             [{ label, color }] shown under the minimap
// Persistent per-map data (saved with the world): `this.saved` = world.state.mapMech[mapId][key] (plain JSON only).
// ONLINE (host-authoritative, net/mapSync.js): only the room HOST runs the rules (`this.authority`); netState() is sent
// to the room when it changes (markNet()) and every few seconds; guests get netApply(state). What only a guest knows
// (it pulled a lever) goes to the host with this.send(kind, data) -> host netEvent(kind, data, from).
export const MAP_MECHANICS = {};
export function registerMapMechanic(type, cls) { MAP_MECHANICS[type] = cls; return cls; }

export class MapMechanic {
  constructor(sys, def, index, mapId) {
    this.sys = sys; this.def = def; this.type = def.type; this.index = index; this.mapId = mapId;
    this.key = index + ':' + def.type;
    this.netDirty = true;
  }
  get world() { return this.sys.world; }
  get game() { return this.sys.world.game; }
  get authority() { return this.sys.authority(); }
  get saved() {
    const all = this.world.state.mapMech || (this.world.state.mapMech = {});
    const m = all[this.mapId] || (all[this.mapId] = {});
    return m[this.key] || (m[this.key] = {});
  }
  markNet() { this.netDirty = true; }
  send(kind, data = null) { if (this.authority) this.netEvent(kind, data, null); else this.sys.sendEvent(this, kind, data); }
  enter() {} exit() {} update() {} reset() {}
  drawGround() {} drawAbove() {} drawScreen() {}
  hudTags() { return []; }
  netState() { return null; }
  netApply() {}
  netEvent() {}
}

export class MapMechanicSystem {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.mapId = null;
    this.net = null; // net/mapSync.js sets { sendEvent(mapId, index, kind, data) } while online
  }
  // false only on a guest of a shared run map (the room host runs the rules)
  authority() {
    const mobs = this.world.game.online && this.world.game.online.mobs;
    return !mobs || mobs.host !== false;
  }
  // build the mechanics of a map (the previous map's are exited first)
  enterMap(id) {
    this.exitAll();
    const def = id && this.world.mapManager.get(id);
    this.mapId = id || null;
    (def && def.mechanics || []).forEach((d, i) => {
      const Cls = MAP_MECHANICS[d.type];
      if (!Cls) { console.warn('unknown map mechanic', d.type); return; }
      const m = new Cls(this, d, i, id);
      this.list.push(m);
      m.enter();
    });
  }
  exitAll() {
    for (const m of this.list) m.exit();
    this.list = [];
    this.mapId = null;
  }
  get(type) { return this.list.find((m) => m.type === type) || null; }
  update(dt) { for (const m of this.list) m.update(dt); }
  reset() { for (const m of this.list) m.reset(); }
  drawGround(ctx, t) { for (const m of this.list) m.drawGround(ctx, t); }
  drawAbove(ctx, t) { for (const m of this.list) m.drawAbove(ctx, t); }
  drawScreen(ctx, game) { for (const m of this.list) m.drawScreen(ctx, game); }
  hudTags() { return this.list.flatMap((m) => m.hudTags() || []); }
  // ---- online (net/mapSync.js)
  netStates(force) {
    const out = {};
    let any = false;
    for (const m of this.list) {
      if (!force && !m.netDirty) continue;
      m.netDirty = false;
      const s = m.netState();
      if (s !== null && s !== undefined) { out[m.index] = s; any = true; }
    }
    return any ? out : null;
  }
  netApply(mapId, states) {
    if (mapId !== this.mapId || !states) return;
    for (const m of this.list) if (states[m.index] !== undefined) m.netApply(states[m.index]);
  }
  netEvent(mapId, index, kind, data, from) {
    if (mapId !== this.mapId || !this.authority()) return;
    const m = this.list.find((x) => x.index === index);
    if (m) m.netEvent(kind, data, from);
  }
  sendEvent(m, kind, data) { if (this.net) this.net.sendEvent(m.mapId, m.index, kind, data); }
}
