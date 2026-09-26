// Tiny pub/sub bus. Systems talk through events so combat, quests, knowledge,
// world state and UI stay decoupled.
export class EventBus {
  constructor() {
    this.map = new Map();
  }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const list = this.map.get(name);
    if (list) this.map.set(name, list.filter((f) => f !== fn));
  }
  emit(name, data) {
    const list = this.map.get(name);
    if (list) for (const fn of list.slice()) fn(data);
  }
}
