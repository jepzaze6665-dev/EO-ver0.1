import { TILE } from '../core/constants.js';
import { WANDERERS } from '../data/wanderers.js';
import { NPC } from './npc.js';

// WANDERER SYSTEM — places the NPCs of data/wanderers.js. On every map entry each wanderer that belongs to that map (and
// whose `requires` are met, and whose `doneFlag` is not set) appears at one random spot of the map's list; it is removed
// again on the next map change. The NPC is an ordinary world NPC + 'npc' interactable, so talking / quest markers work.
export class WandererSystem {
  constructor(game, data = WANDERERS) {
    this.game = game;
    this.data = data;
    this.placed = []; // { npc, it } currently in the world
    this.spot = {};   // wanderer id -> [tx, ty] of its current spot (tests / debug)
    // leave BEFORE the grid can change (mapExited fires first), so a wanderer never stays behind in a cached grid
    game.events.on('mapExited', () => this.clear());
    game.events.on('mapEntered', (e) => this.place(e.id));
  }
  clear() {
    const w = this.game.world;
    for (const { npc, it } of this.placed) {
      const a = w.npcs.indexOf(npc); if (a >= 0) w.npcs.splice(a, 1);
      const b = w.interactables.indexOf(it); if (b >= 0) w.interactables.splice(b, 1);
    }
    this.placed = [];
    this.spot = {};
  }
  // which spots of a wanderer's map entry are open ground (a bad spot in the data is skipped, never a stuck NPC)
  openSpots(entry) {
    const m = this.game.world.map;
    return entry.spots.filter(([tx, ty]) => m.inBounds(tx, ty) && !m.isSolid(tx, ty));
  }
  // rng: tests pass a fixed one
  place(mapId, rng = Math.random) {
    this.clear();
    const g = this.game, w = g.world, f = w.state.flags;
    for (const def of Object.values(this.data)) {
      const entry = def.maps[mapId];
      if (!entry || (def.doneFlag && f[def.doneFlag])) continue;
      if (g.worldProgress && !g.worldProgress.meets(entry.requires || [])) continue;
      const spots = this.openSpots(entry);
      if (!spots.length) continue;
      const [tx, ty] = spots[Math.floor(rng() * spots.length) % spots.length];
      const npc = new NPC(g, { id: def.id, name: def.name, role: def.role, look: def.look, x: (tx + 0.5) * TILE, y: (ty + 0.7) * TILE });
      npc.mapId = mapId;
      const it = { id: 'npc_' + def.id, kind: 'npc', x: npc.x, y: npc.y, radius: 38, npc, mapId };
      w.npcs.push(npc);
      w.interactables.push(it);
      this.placed.push({ npc, it });
      this.spot[def.id] = [tx, ty];
    }
  }
}
