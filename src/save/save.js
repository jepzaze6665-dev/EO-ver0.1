import { CLASSES } from '../skills/classes.js';

// LocalStorage save: level, EXP, gold, inventory, storage, equipment, quests,
// world state, discovered areas (+ minimap reveal), monster knowledge, position.
const KEY = 'eclipse_online_save_v1';

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.dirty = false;
    this.autoT = 0;
  }
  exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  info() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return 'No save data.';
      const d = JSON.parse(raw);
      return `Last save: ${new Date(d.savedAt).toLocaleString()} · ${(CLASSES[d.player.classId] || CLASSES.umbral_sword).name} LV.${d.player.level}`;
    } catch (e) { return 'Save unavailable.'; }
  }
  snapshot() {
    const g = this.game, p = g.player;
    return {
      v: 1,
      savedAt: Date.now(),
      playTime: g.playTime,
      player: { classId: p.cls.id, level: p.level, exp: p.exp, gold: p.gold, hp: p.hp, shadow: p.shadow, resources: p.resources.serialize(), loadout: p.loadout.serialize(), map: g.world.mapId, x: p.x, y: p.y },
      inventory: g.inventory.serialize(),
      equipment: g.equipment.serialize(),
      quests: g.quests.serialize(),
      progression: g.progression.serialize(),
      world: g.world.serialize(),
      knowledge: g.knowledge.serialize(),
      stats: g.stats,
    };
  }
  save() {
    const g = this.game;
    if (g.player.dead || g.world.bossActive) return false; // never save mid-boss or while dead
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
      this.dirty = false;
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  // autosave a few seconds after meaningful progress
  update(dt) {
    if (!this.dirty) return;
    this.autoT += dt;
    if (this.autoT > 4) {
      this.autoT = 0;
      if (this.save()) this.game.ui.hud.toast('✦ Autosaved', 1);
    }
  }
}
