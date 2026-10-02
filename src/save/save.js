import { CLASSES } from '../skills/classes.js';
import { LocalStorageAdapter } from './storage.js';
import { SAVE_VERSION, parseSave } from './saveData.js';

// SAVE SYSTEM — separate from gameplay:
//   snapshot()  : game state -> plain data (the only place that reads the game for saving)
//   storage     : where the text goes (save/storage.js adapter: localStorage now, a server later)
//   saveData.js : format version, migration of old saves, validation / repair
// Saves: level, EXP, gold, class, inventory, equipment, quests, class progression, world state (flags, maps,
// hidden content, minimap reveal), world progression (V2.2: defeated bosses, unlocked maps, world events, route),
// monster knowledge, current map + position.
// Safety: the previous save is kept as a backup; a corrupt / unreadable main save falls back to it.
export const SAVE_KEY = 'eclipse_online_save_v1';
const KEY = SAVE_KEY; // storage key (kept from V1 so old saves still load)
export const BACKUP_KEY = KEY + '_backup';
const BACKUP = BACKUP_KEY;

export class SaveSystem {
  constructor(game, storage = new LocalStorageAdapter()) {
    this.game = game;
    this.storage = storage;
    this.dirty = false;
    this.autoT = 0;
    this.lastError = null;
    this.usedBackup = false;
  }
  exists() { return !!(this.storage.read(KEY) || this.storage.read(BACKUP)); }
  info() {
    const r = parseSave(this.storage.read(KEY));
    if (!r.ok) return this.storage.read(KEY) ? 'Save damaged — the backup will be used.' : 'No save data.';
    const d = r.data;
    return `Last save: ${new Date(d.savedAt).toLocaleString()} · ${(CLASSES[d.player.classId] || CLASSES.umbral_sword).name} LV.${d.player.level}`;
  }
  // why saving is not allowed right now (null = allowed)
  blockedReason() {
    const g = this.game;
    if (g.player.dead) return 'Cannot save while defeated';
    if (g.world.inBossFight()) return 'Cannot save during a boss fight'; // Guardian or any area boss
    return null;
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
      classProgress: g.classProgress ? (g.classProgress.rememberLoadout(p.loadout.serialize()), g.classProgress.serialize()) : undefined,
      world: g.world.serialize(),
      worldProgress: g.worldProgress.serialize(),
      knowledge: g.knowledge.serialize(),
      stats: g.stats,
    };
  }
  save() {
    this.lastError = this.blockedReason();
    if (this.lastError) return false;
    let text;
    try { text = JSON.stringify(this.snapshot()); } catch (e) { this.lastError = 'Could not build save'; console.warn(e); return false; }
    const prev = this.storage.read(KEY);
    if (prev && parseSave(prev).ok) this.storage.write(BACKUP, prev); // keep the last good save
    if (this.storage.write(KEY, text) === false) { this.lastError = 'Storage unavailable'; return false; }
    this.dirty = false;
    return true;
  }
  // -> validated save data or null (lastError says why); falls back to the backup when the main save is damaged
  load() {
    this.usedBackup = false;
    const main = parseSave(this.storage.read(KEY));
    if (main.ok) { this.lastError = null; return main.data; }
    const backup = parseSave(this.storage.read(BACKUP));
    if (backup.ok) { this.lastError = `Main save ${main.error} — loaded the backup`; this.usedBackup = true; return backup.data; }
    this.lastError = main.error === 'empty' ? 'No save found' : `Save ${main.error}`;
    return null;
  }
  reset() { this.storage.remove(KEY); this.storage.remove(BACKUP); }
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
