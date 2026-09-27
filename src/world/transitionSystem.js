import { TILE } from '../core/constants.js';

// TRANSITION SYSTEM — the only way to walk from one map to another. Each map lists its exits (data); when the
// player stands in an open exit, the World switches maps and places the player at the exit's entry point.
//   Locks: exit.requires.flag (world flag) · every exit is closed during an active boss fight.
//   No loops: entry points are outside the target map's exits (checked by tests) + a short cooldown.
export class TransitionSystem {
  constructor(world, { cooldown = 0.6 } = {}) {
    this.world = world;
    this.cooldownTime = cooldown;
    this.cooldown = 0;
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
  update(dt, player) {
    const w = this.world;
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    if (player.dead || !w.mapId) return;
    const def = w.mapManager.get(w.mapId);
    const exit = this.exitAt(def, player.x, player.y);
    if (!exit || !this.isOpen(exit)) return;
    this.cooldown = this.cooldownTime;
    w.changeMap(exit.to, { entry: exit.entry, via: exit.id });
  }
}
