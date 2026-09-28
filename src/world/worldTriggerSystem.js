import { WORLD_TRIGGERS } from '../data/worldTriggers.js';
import { allMet, matches } from '../progression/requirements.js';
import { LORE } from './narrative.js';

// WORLD TRIGGER SYSTEM — runs data/worldTriggers.js: listens to the events the triggers name, checks the match +
// requirements, then runs the trigger's actions. `once` triggers are recorded in the World Progression
// (triggeredEvents), so they survive save / load and never repeat. Emits 'worldTriggerFired' { id, trigger }.
// Actions are a small registry (TRIGGER_ACTIONS) — a new kind of action = one new function, no trigger code changes.
export const TRIGGER_ACTIONS = {
  unlock_map: (g, a) => g.worldProgress.unlockMap(a.map || a.value, 'trigger'),
  set_flag: (g, a) => g.world.setFlag(a.flag || a.value),
  accept_quest: (g, a) => g.quests.accept(a.quest || a.value),
  banner: (g, a) => g.ui.banner(a.title, a.text || '', a.color || '#ffd98a', a.dur || 3.5),
  notify: (g, a) => g.ui.notify(a.title, a.text || '', a.color),
  callout: (g, a) => g.ui.callout(a.title, a.text || '', a.color || '#ffd98a'),
  lore: (g, a) => {
    const id = a.lore || a.value, w = g.world;
    if (!LORE[id] || w.state.lore[id]) return;
    w.state.lore[id] = true;
    g.ui.notify('LORE', LORE[id].title, '#e8d8a8');
    g.events.emit('loreFound', { id });
  },
  // placeholder "cutscene": camera focus + a title card (a real cutscene system can replace this action later)
  cutscene: (g, a) => {
    const b = a.focus === 'boss' && g.bosses ? g.bosses.engagedEntity() : null, t = b || g.player;
    g.camera.lookAt(t.x, t.y - 30, a.time || 2);
    if (a.zoom) { g.camera.targetZoom = a.zoom; g.after(a.time || 2, () => { g.camera.targetZoom = 1; }); }
    if (a.title) g.ui.bossTitle(a.title, a.sub || '');
  },
  emit: (g, a) => g.events.emit(a.event, a.data || {}),
};

// 'unlock_map:a2' -> { type: 'unlock_map', value: 'a2' }
export function parseAction(a) {
  if (typeof a !== 'string') return a;
  const i = a.indexOf(':');
  return i < 0 ? { type: a } : { type: a.slice(0, i), value: a.slice(i + 1) };
}

export class WorldTriggerSystem {
  constructor(game, triggers = WORLD_TRIGGERS, actions = TRIGGER_ACTIONS) {
    this.game = game;
    this.triggers = triggers;
    this.actions = actions;
    for (const name of new Set(triggers.map((t) => t.on))) game.events.on(name, (e) => this.onEvent(name, e));
  }
  onEvent(name, e) {
    const g = this.game, prog = g.worldProgress;
    for (const t of this.triggers) {
      if (t.on !== name) continue;
      const once = t.once !== false;
      if (once && prog.hasEvent(t.id)) continue;
      if (t.match && !matches(t.match, e || {}, g.player)) continue;
      if (t.requires && !allMet(t.requires, prog.context())) continue;
      if (once) prog.markEvent(t.id);
      this.run(t);
    }
  }
  run(t) {
    for (const raw of t.actions || []) {
      const a = parseAction(raw), fn = this.actions[a.type];
      if (fn) fn(this.game, a);
      else console.warn(`World trigger ${t.id}: unknown action "${a.type}"`);
    }
    this.game.events.emit('worldTriggerFired', { id: t.id, trigger: t });
  }
}
