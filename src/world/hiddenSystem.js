import { HIDDEN } from '../data/hidden.js';
import { allMet } from '../progression/requirements.js';

// HIDDEN SYSTEM — reveals hidden content (data/hidden.js) from game events. It never names an area or quest:
// each entry says which event reveals it, the condition, the chance and the reward. Found entries are saved in
// world.state.hidden, so `once` entries (and their rewards) can never repeat.
// Emits 'hiddenFound' { id, entry, reward } (rewards: ExperienceSystem + LootSystem; UI: game.js).
export class HiddenSystem {
  constructor(game, data = HIDDEN, rng = Math.random) {
    this.game = game;
    this.data = data;
    this.rng = rng;
    const events = new Set(Object.values(data).map((h) => h.trigger.event));
    for (const name of events) game.events.on(name, (e) => this.onEvent(name, e));
  }
  found(id) { return !!this.game.world.state.hidden[id]; }
  onEvent(name, e) {
    for (const h of Object.values(this.data)) {
      if (h.trigger.event !== name || (h.once && this.found(h.id))) continue;
      if (!Object.entries(h.trigger.match || {}).every(([k, v]) => e && e[k] === v)) continue;
      if (h.condition && !allMet(h.condition, this.game.progression.context(this.game.player.cls.id))) continue;
      if ((h.chance ?? 1) < 1 && this.rng() >= h.chance) continue;
      this.reveal(h);
    }
  }
  reveal(h) {
    const w = this.game.world;
    w.state.hidden[h.id] = (w.state.hidden[h.id] || 0) + 1;
    w.setFlag(`hidden_${h.type}_found`);
    if (h.flag) w.setFlag(h.flag);
    this.game.events.emit('hiddenFound', { id: h.id, entry: h, reward: h.reward || {} });
    this.game.save.dirty = true;
  }
}
