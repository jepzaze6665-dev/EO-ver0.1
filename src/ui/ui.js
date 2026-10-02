import { HUD } from './hud.js';
import { Panels } from './panels.js';

// Facade used by gameplay code: HUD messages + DOM panels behind one small API.
export class UI {
  constructor(game) {
    this.game = game;
    this.hud = new HUD(game);
    this.panels = new Panels(game);
  }
  get panelOpen() { return this.panels.open; }

  banner(t, s, c) { this.hud.banner(t, s, c); }
  zoneBanner(name, sub, big) { this.hud.zone(name, sub, big); }
  subBanner(name) { this.hud.sub(name); }
  callout(t, s, c) { this.hud.callout(t, s, c); }
  bossTitle(t, s) { this.hud.bossTitle(t, s); }
  toast(text, dur) { this.hud.toast(text, dur); }
  notify(title, text, color) { this.hud.notify(title, text, color); }
  pickup(def, n) { this.hud.pickup(def, n); }
  questBanner(title, name) { this.hud.banner(title, name, title.includes('COMPLETE') ? '#a8f0b0' : '#ffd98a', 3.2); }
  showBossBar(on) { this.hud.bossBar = on; }

  openDialogue(npc) { this.panels.dialogue(npc); }
  showLore(title, text, onClose) { this.panels.textPanel(title, text, onClose); }
  openTeleport(id) { this.panels.teleport(id); }
  openStorage() { this.panels.storage(); }
  showEnding() { this.panels.ending(this.game.endingStats()); this.game.audio.sfx('victory'); }

  update(dt) { this.hud.update(dt); }
  draw(ctx, W, H) { this.hud.draw(ctx, W, H); }

  // keyboard routing while panels are open
  handleKeys(input) {
    const p = this.panels;
    if (!p.open) return false;
    const name = p.current.name;
    if (input.pressed('Escape')) { if (name !== 'title' && name !== 'death') p.close(); return true; }
    if (input.pressed('KeyE') || input.pressed('Space') || input.pressed('Enter')) {
      if (p.current.advance) p.current.advance();
      return true;
    }
    if (input.pressed('KeyI') && name === 'inventory') { p.close(); return true; }
    if (input.pressed('KeyM') && name === 'map') { p.close(); return true; }
    if (input.pressed('KeyP') && name === 'party') { p.close(); return true; }
    return true;
  }
}
