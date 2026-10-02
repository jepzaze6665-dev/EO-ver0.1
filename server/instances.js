// ONLINE N5/N6 — dungeon instances. One instance = one run: the area it started in, solo or party, its members, the
// city they came from (return point), the maps visited so far (a run continues through the map exits: A1 -> arena ->
// A2 ...). A member who disconnects stays a member for ONLINE.dungeon.reconnectGrace seconds (offline map). An instance
// with no members left is deleted (onClose). Progression / recovery data never lives here (it belongs to the player
// records), so deleting an instance can never delete it.
export class InstanceManager {
  constructor({ onClose } = {}) { this.list = new Map(); this.byPlayer = new Map(); this.counter = 0; this.onClose = onClose; }

  create({ area, mode, members, city, names = {} }) {
    const inst = {
      id: 'in' + (++this.counter).toString(36) + Date.now().toString(36).slice(-5), area, mode, city: city || 'lumina',
      members: new Set(), names: new Map(), offline: new Map(), maps: new Set([area]), createdAt: Date.now(),
    };
    this.list.set(inst.id, inst);
    for (const id of members) { this.leave(id); inst.members.add(id); inst.names.set(id, names[id] || id); this.byPlayer.set(id, inst.id); }
    return inst;
  }

  get(id) { return this.list.get(id); }
  of(playerId) { return this.list.get(this.byPlayer.get(playerId)); }

  // -> the instance the player left (or null)
  leave(playerId) {
    const inst = this.of(playerId);
    this.byPlayer.delete(playerId);
    if (!inst) return null;
    inst.members.delete(playerId);
    inst.offline.delete(playerId);
    if (!inst.members.size) { this.list.delete(inst.id); this.onClose?.(inst); }
    return inst;
  }

  view(inst) {
    return { id: inst.id, area: inst.area, mode: inst.mode, city: inst.city, members: [...inst.members].map((id) => inst.names.get(id)), maps: [...inst.maps] };
  }
}
