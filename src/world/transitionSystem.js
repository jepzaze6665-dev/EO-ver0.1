import { TILE } from '../core/constants.js';

// TRANSITION SYSTEM — the only way to walk from one map to another. Each map lists its exits (data); when the
// player stands in an open exit, the World switches maps and places the player at the exit's entry point.
//   Locks (Boss Gate): the target map must be unlocked (its `requires` in maps/*.js, recorded by the World
//   Progression) · exit.requires: a requirement list (or the V2.1 form { flag }) · every exit is closed during a boss fight.
//   Standing in a locked exit tells the player why ("THE WAY IS BLOCKED" + the first unmet requirement).
//   exit.confirm { title, text, yes, no }: ask first (boss entrance). "No" puts the player back where they
//   stood before stepping in. Tests set `autoConfirm`.
//   No loops: entry points are outside the target map's exits (checked by tests) + a short cooldown.
export class TransitionSystem {
  constructor(world, { cooldown = 0.6 } = {}) {
    this.world = world;
    this.cooldownTime = cooldown;
    this.cooldown = 0;
    this.pending = null;     // exit waiting for a yes / no
    this.lastSafe = null;    // last position outside every exit
    this.autoConfirm = false;
  }
  isOpen(exit) { return !this.lockReason(exit); }
  // null = open; otherwise a short text for the player
  lockReason(exit) {
    const w = this.world, wp = w.game.worldProgress, r = exit.requires;
    if (w.inBossFight()) return 'The arena is sealed until the fight is over';
    if (r && !Array.isArray(r) && r.flag && !w.state.flags[r.flag]) return r.label || 'Sealed';
    if (Array.isArray(r) && wp && !wp.meets(r)) { const miss = r.find((x) => !wp.meets([x])); return (miss && miss.label) || 'Locked'; }
    if (wp && !wp.isMapUnlocked(exit.to)) return wp.lockReason(exit.to) || 'Locked';
    return null;
  }
  exitAt(def, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return def.exits.find((e) => tx >= e.rect[0] && tx <= e.rect[2] && ty >= e.rect[1] && ty <= e.rect[3]) || null;
  }
  go(exit) {
    this.pending = null;
    this.cooldown = this.cooldownTime;
    this.world.changeMap(exit.to, { entry: exit.entry, via: exit.id });
  }
  update(dt, player) {
    const w = this.world, g = w.game;
    if (this.pending) { if (!g.ui.panelOpen) this.pending = null; return; } // answered (or closed by something else)
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    if (player.dead || !w.mapId) return;
    const def = w.mapManager.get(w.mapId);
    const exit = this.exitAt(def, player.x, player.y);
    if (!exit) { this.lastSafe = { x: player.x, y: player.y }; return; }
    if (!this.isOpen(exit)) {
      this.warnT = (this.warnT || 0) - dt;
      if (this.warnT <= 0) { this.warnT = 3; g.ui.notify('THE WAY IS BLOCKED', this.lockReason(exit), '#ff9a80'); g.events.emit('exitBlocked', { exit, reason: this.lockReason(exit) }); }
      return;
    }
    if (!exit.confirm || this.autoConfirm) { this.go(exit); return; }
    this.pending = exit;
    const c = exit.confirm, back = this.lastSafe;
    g.ui.panels.confirm(c.title, c.text, c.yes || 'Enter', c.no || 'Not yet', () => this.go(exit), () => {
      this.pending = null;
      this.cooldown = this.cooldownTime;
      if (back) { player.x = back.x; player.y = back.y; player.kx = player.ky = 0; }
    });
  }
}
