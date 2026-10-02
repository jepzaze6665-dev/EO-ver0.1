// ONLINE N5 — dungeon instances (registry only for now). One instance = one run: an area, solo or party, its members.
// N5 creates them at the gate; N6 adds what happens inside (members see each other, nobody else does, return to the
// city, continuing through the map exits) and the empty-instance cleanup. Progression / recovery data never lives here
// (it belongs to the player records), so dropping an instance can never delete it.
export class InstanceManager {
  constructor() { this.list = new Map(); this.byPlayer = new Map(); this.counter = 0; }

  create({ area, mode, members }) {
    const inst = { id: 'in' + (++this.counter).toString(36) + Date.now().toString(36).slice(-5), area, mode, members: new Set(members), createdAt: Date.now() };
    this.list.set(inst.id, inst);
    for (const id of members) { this.leave(id); this.byPlayer.set(id, inst.id); }
    return inst;
  }

  get(id) { return this.list.get(id); }
  of(playerId) { return this.list.get(this.byPlayer.get(playerId)); }

  leave(playerId) {
    const inst = this.of(playerId);
    this.byPlayer.delete(playerId);
    if (!inst) return;
    inst.members.delete(playerId);
    if (!inst.members.size) this.list.delete(inst.id);
  }
}
