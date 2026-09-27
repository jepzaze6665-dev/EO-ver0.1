import { TILE } from '../core/constants.js';

// TRANSITION SYSTEM — the only way to walk from one map to another. Each map lists its exits (data); when the
// player stands in an open exit, the World switches maps and places the player at the exit's entry point.
//   Locks: exit.requires.flag (world flag) · every exit is closed during an active boss fight.
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
  isOpen(exit) {
    const w = this.world;
    if (w.bossActive) return false;
    if (exit.requires && exit.requires.flag && !w.state.flags[exit.requires.flag]) return false;
    return true;
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
    if (!this.isOpen(exit)) return;
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
