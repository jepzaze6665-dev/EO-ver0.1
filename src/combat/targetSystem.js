// TARGET SYSTEM: which enemy the player has selected. Gameplay only — no DOM, no canvas; the HUD reads `current`.
//   nearest(from, cycle)  : closest valid enemy in range (cycle = step to the next-closest on repeat presses)
//   pickAt(x, y)          : the enemy under a world point (mouse click)
//   update(from)          : drops the target when it dies, is removed or gets too far → current = null
// `candidates()` is supplied by the owner (the game passes the world's hostiles), so this file knows no entity types.
const valid = (e) => !!e && !e.dead && !e.removed && e.hp > 0;

export class TargetSystem {
  constructor({ candidates, onChange, range = 480, dropRange = 900, clickRadius = 28 } = {}) {
    this.candidates = candidates || (() => []);
    this.onChange = onChange || (() => {});
    this.range = range; this.dropRange = dropRange; this.clickRadius = clickRadius;
    this.current = null;
  }
  set(e) {
    if (e && !valid(e)) e = null;
    if (e === this.current) return;
    const prev = this.current;
    this.current = e;
    this.onChange({ target: e, prev });
  }
  clear() { this.set(null); }
  // valid enemies within `range`, closest first
  inRange(from) {
    return this.candidates()
      .filter(valid)
      .map((e) => ({ e, d: Math.hypot(e.x - from.x, e.y - from.y) }))
      .filter((o) => o.d <= this.range)
      .sort((a, b) => a.d - b.d)
      .map((o) => o.e);
  }
  nearest(from, cycle = false) {
    const list = this.inRange(from);
    if (!list.length) { this.clear(); return null; }
    let next = list[0];
    if (cycle && this.current) {
      const i = list.indexOf(this.current);
      if (i >= 0) next = list[(i + 1) % list.length];
    }
    this.set(next);
    return next;
  }
  // body centre of an entity (feet position minus half its height)
  pickAt(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.candidates()) {
      if (!valid(e)) continue;
      const h = (e.height || 30) * (e.scale || 1);
      const d = Math.min(Math.hypot(e.x - x, e.y - y), Math.hypot(e.x - x, e.y - h * 0.5 - y));
      if (d <= this.clickRadius + (e.radius || 10) && d < bd) { best = e; bd = d; }
    }
    return best;
  }
  update(from) {
    const t = this.current;
    if (!t) return;
    if (!valid(t) || Math.hypot(t.x - from.x, t.y - from.y) > this.dropRange) this.clear();
  }
}
