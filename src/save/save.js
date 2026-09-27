import { CLASSES } from '../skills/classes.js';

// SAVE SYSTEM — collects every system's serialize() into one snapshot and hands it to a storage backend.
// It does not know how the world works (World / WorldProgression / Quests... serialize themselves), and it does not
// know where data goes: `backend` is LocalStorage today; a server save = another backend with the same 3 methods.
//   snapshot: level, EXP, gold, inventory, equipment, quests, class progression, world state (flags, discovered
//   areas, minimap reveal), world progression (defeated bosses, unlocked maps, world events, current route),
//   monster knowledge, position + map.
const KEY = 'eclipse_online_save_v1';
export const SAVE_VERSION = 2; // 2 = V2.2 world progression (older saves are migrated on load)

export const localStorageBackend = {
  read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  write(key, text) { localStorage.setItem(key, text); },
  remove(key) { try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ } },
};

export class SaveSystem {
  constructor(game, backend = localStorageBackend) {
    this.game = game;
    this.backend = backend;
    this.dirty = false;
    this.autoT = 0;
  }
  exists() {
    return !!this.backend.read(KEY);
  }
  info() {
    try {
      const raw = this.backend.read(KEY);
      if (!raw) return 'No save data.';
      const d = JSON.parse(raw);
      return `Last save: ${new Date(d.savedAt).toLocaleString()} · ${(CLASSES[d.player.classId] || CLASSES.umbral_sword).name} LV.${d.player.level}`;
    } catch (e) { return 'Save unavailable.'; }
  }
  snapshot() {
    const g = this.game, p = g.player;
    return {
      v: SAVE_VERSION,
      savedAt: Date.now(),
      playTime: g.playTime,
      player: { classId: p.cls.id, level: p.level, exp: p.exp, gold: p.gold, hp: p.hp, shadow: p.shadow, resources: p.resources.serialize(), loadout: p.loadout.serialize(), map: g.world.mapId, x: p.x, y: p.y },
      inventory: g.inventory.serialize(),
      equipment: g.equipment.serialize(),
      quests: g.quests.serialize(),
      progression: g.progression.serialize(),
      world: g.world.serialize(),
      worldProgress: g.worldProgress.serialize(),
      knowledge: g.knowledge.serialize(),
      stats: g.stats,
    };
  }
  save() {
    const g = this.game;
    if (g.player.dead || g.world.inBossFight()) return false; // never save mid-boss or while dead
    try {
      this.backend.write(KEY, JSON.stringify(this.snapshot()));
      this.dirty = false;
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  }
  load() {
    try {
      const raw = this.backend.read(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  reset() {
    this.backend.remove(KEY);
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
