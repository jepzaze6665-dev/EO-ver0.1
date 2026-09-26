// Fixed-capacity object pool: avoids GC churn for particles, damage numbers, projectiles.
export class Pool {
  constructor(create, capacity) {
    this.items = [];
    for (let i = 0; i < capacity; i++) {
      const o = create();
      o.active = false;
      this.items.push(o);
    }
    this.cursor = 0;
  }
  // Returns a free object; when full, recycles the oldest slot (round robin).
  spawn() {
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const o = this.items[idx];
      if (!o.active) {
        this.cursor = (idx + 1) % n;
        o.active = true;
        return o;
      }
    }
    const o = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % n;
    o.active = true;
    return o;
  }
  forEach(fn) {
    for (const o of this.items) if (o.active) fn(o);
  }
  clear() {
    for (const o of this.items) o.active = false;
  }
  count() {
    let c = 0;
    for (const o of this.items) if (o.active) c++;
    return c;
  }
}
