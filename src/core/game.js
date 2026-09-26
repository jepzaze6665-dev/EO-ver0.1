import { EventBus } from './events.js';
import { Input } from '../input/input.js';
import { Camera } from '../camera/camera.js';
import { Renderer } from '../render/renderer.js';
import { Audio } from '../audio/audio.js';
import { VFX } from '../vfx/vfx.js';
import { Combat } from '../combat/combat.js';
import { UI } from '../ui/ui.js';
import { SaveSystem } from '../save/save.js';
import { Inventory } from '../inventory/inventory.js';
import { Equipment } from '../equipment/equipment.js';
import { Knowledge } from '../monsters/knowledge.js';
import { Quests } from '../quests/quests.js';
import { World } from '../world/world.js';
import { Player } from '../player/player.js';
import { PlayerSprites } from '../player/playerSprites.js';
import { buildMonsterSprites } from '../monsters/monsterSprites.js';
import { CLASSES } from '../skills/umbralSword.js';
import { TILE, WORLD_W, WORLD_H, Z } from './constants.js';
import { LORE } from '../world/narrative.js';
import { validateSprites } from '../player/characterConfig.js';

const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.events = new EventBus();
    this.input = new Input(canvas);
    this.camera = new Camera();
    this.renderer = new Renderer(canvas);
    this.renderer.onResize = (w, h) => this.camera.setView(w, h);
    this.camera.setView(this.renderer.vw, this.renderer.vh);
    this.camera.bounds = { x0: 0, y0: 0, x1: WORLD_W * TILE, y1: WORLD_H * TILE };
    this.audio = new Audio();
    this.vfx = new VFX(this);
    this.combat = new Combat(this);
    this.ui = new UI(this);
    this.save = new SaveSystem(this);
    this.monsterSprites = buildMonsterSprites();
    this.playerSprites = new PlayerSprites();
    this.spriteReport = validateSprites();
    this.state = 'boot';
    this.time = 0; this.playTime = 0;
    this.hitStop = 0; this.timeScale = 1; this.slowT = 0;
    this.acc = 0; this.last = 0;
    this.timers = [];
    this.debug = false;
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
    const unlock = () => { this.audio.init(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  wireEvents() {
    const ev = this.events;
    ev.on('kill', () => { this.stats.kills++; });
    ev.on('chestOpened', () => { this.stats.chests++; });
    ev.on('markGained', (n) => { if (n >= 3) this.world.setFlag('tut_marks'); });
    ev.on('perfectDodge', () => this.world.setFlag('tut_perfect'));
    ev.on('shadowBreak', () => this.world.setFlag('tut_break'));
  }

  // ---------------- lifecycle
  setupSession() {
    this.inventory = new Inventory(this);
    this.equipment = new Equipment(this);
    this.knowledge = new Knowledge(this);
    // fresh event bus per session so listeners never accumulate
    this.events = new EventBus();
    this.wireEvents();
    this.stats = { kills: 0, chests: 0, deaths: 0 };
    this.quests = new Quests(this);
    this.combat.clear();
    this.ui.hud.reset();
    this.world = new World(this);
    this.player = new Player(this, CLASSES.umbral_sword, this.playerSprites);
    this.playTime = 0;
    this.hitStop = 0; this.timeScale = 1;
    this.timers = [];
    this.camera.lock = null; this.camera.focus = null; this.camera.targetZoom = 1;
  }

  boot() {
    this.setupSession();
    this.world.applyState();
    const s = this.world.regions.playerSpawn;
    this.player.x = s.x; this.player.y = s.y;
    this.camera.snap(s.x, s.y - 40);
    this.state = 'title';
    this.ui.panels.title(this.save.exists());
    this.audio.music('village');
    if (!this.looping) { this.looping = true; requestAnimationFrame((t) => this.frame(t)); }
  }

  newGame() {
    this.save.reset();
    this.setupSession();
    this.world.applyState();
    const s = this.world.regions.playerSpawn;
    this.player.x = s.x; this.player.y = s.y;
    this.player.facing = -Math.PI / 2;
    this.inventory.add('hp_potion', 3, true);
    this.inventory.add('shadow_tonic', 1, true);
    this.camera.snap(s.x, s.y);
    this.ui.panels.close(true);
    this.state = 'play';
    this.audio.init();
    this.world.currentZone = Z.NONE;
    this.after(3.2, () => this.ui.banner('ECLIPSE ONLINE', 'Talk to Elder Maren by the quest board  ·  [E] Interact', '#e8d0ff'));
    this.ui.notify('Tip', 'WASD move · Mouse aim · LMB attack · SPACE dodge', '#9ad8ff');
    this.save.dirty = true;
  }

  applySave(d) {
    this.setupSession();
    this.world.load(d.world);
    this.inventory.load(d.inventory);
    this.equipment.load(d.equipment);
    this.quests.load(d.quests);
    this.knowledge.load(d.knowledge);
    this.stats = { kills: 0, chests: 0, deaths: 0, ...(d.stats || {}) };
    this.playTime = d.playTime || 0;
    const p = this.player;
    p.level = d.player.level; p.exp = d.player.exp; p.gold = d.player.gold;
    p.recomputeStats();
    p.hp = Math.min(p.maxHp, d.player.hp || p.maxHp); p.shadow = d.player.shadow ?? 40;
    this.world.applyState();
    const pos = this.world.map.findOpen(d.player.x, d.player.y, 6);
    p.x = pos.x; p.y = pos.y;
    this.camera.snap(p.x, p.y);
    this.world.currentZone = Z.NONE;
  }
  continueGame() { this.loadGame(); }
  loadGame() {
    const d = this.save.load();
    if (!d) { this.ui.toast('No save found', 1.5); return; }
    this.applySave(d);
    this.ui.panels.close(true);
    this.state = 'play';
    this.audio.init();
    this.ui.banner('WELCOME BACK', `Umbral Sword · LV.${this.player.level}`, '#e8d0ff');
  }
  resetGame() {
    this.save.reset();
    this.newGame();
    this.ui.toast('Progress reset', 2);
  }
  toTitle() {
    if (this.save.dirty) this.save.save();
    this.boot();
  }

  // ---------------- helpers used by systems
  controlsEnabled() { return this.state === 'play' && !this.ui.panelOpen && !this.player.dead; }
  mouseWorld() {
    const r = this.renderer, m = this.input.mouse;
    return this.camera.toWorld((m.x * r.dpr) / r.scale, (m.y * r.dpr) / r.scale);
  }
  // Game-time scheduler (pauses with the game, respects hit stop unless realTime).
  after(sec, fn, realTime = false) { this.timers.push({ t: sec, fn, realTime }); }
  tickTimers(dt, sdt) {
    if (!this.timers.length) return;
    const due = [];
    for (const tm of this.timers) { tm.t -= tm.realTime ? dt : sdt; if (tm.t <= 0) due.push(tm); }
    if (!due.length) return;
    this.timers = this.timers.filter((tm) => tm.t > 0);
    for (const tm of due) tm.fn();
  }
  slowMo(scale, dur) { this.timeScale = Math.min(this.timeScale, scale); this.slowT = Math.max(this.slowT, dur); }

  onPlayerDeath() {
    this.stats.deaths++;
    this.audio.sfx('death');
    this.slowMo(0.3, 1.2);
    this.after(1.6, () => this.ui.panels.death(), true);
  }
  respawn() {
    const w = this.world, p = this.player;
    if (w.bossActive) w.resetBoss();
    this.combat.clear();
    let pos = w.regions.villageRespawn;
    const ws = w.state.lastWaystone && w.interactables.find((i) => i.id === w.state.lastWaystone);
    if (ws) pos = w.map.findOpen(ws.x, ws.y + 40, 3);
    p.dead = false; p.hp = p.maxHp; p.shadow = 50; p.marks = 0;
    p.x = pos.x; p.y = pos.y; p.invulnT = 2; p.kx = p.ky = 0;
    for (const m of w.monsters) { if (m.aggro) { m.aggro = false; m.x = m.home.x; m.y = m.home.y; m.hp = m.maxHp; m.setState('idle'); } }
    this.camera.targetZoom = 1;
    this.camera.snap(p.x, p.y);
    this.ui.banner('RISE AGAIN', 'Learn its pattern. Strike when it opens.', '#e8d0ff');
  }

  onBossDefeated(boss) {
    const w = this.world;
    this.hitStop = 0.6;
    this.camera.lookAt(boss.x, boss.y - 40, 3.5);
    this.camera.punch(0.12);
    this.vfx.flash('255,255,255', 0.9, 1.2);
    this.vfx.shards(boss.x, boss.y - 50, '#5af0ff', 60, 300);
    this.vfx.ring(boss.x, boss.y, 10, 260, { color: '150,250,255', life: 1.2, width: 8 });
    this.audio.sfx('crash');
    this.audio.music('victory');
    this.ui.showBossBar(false);
    this.combat.telegraphs.clear();
    this.combat.projectiles.clear();
    this.after(1.2, () => {
      this.ui.callout('GUARDIAN DEFEATED', 'The corruption is severed from its heart', '#dffcff');
      this.audio.sfx('victory');
      this.vfx.burst(boss.x, boss.y - 60, '#9af8ff', 80, 260);
    }, true);
    this.after(4.2, () => {
      this.camera.targetZoom = 1;
      w.onGuardianDefeated();
      this.player.gainExp(boss.def.exp);
      this.player.gold += 300;
      this.inventory.add('guardian_heart', 1);
      this.inventory.add('guardian_heartwood', 1);
      this.vfx.flash('200,255,220', 0.6, 0.8);
      this.ui.banner('WORLD STATE UPDATED', 'Whispering Forest has changed.', '#a8f0c8', 5);
      this.quests.accept('valley');
      this.save.dirty = true;
    }, true);
  }

  teleportTo(id) {
    const it = this.world.interactables.find((i) => i.id === id);
    if (!it) return;
    const pos = this.world.map.findOpen(it.x, it.y + 36, 3);
    this.vfx.burst(this.player.x, this.player.y - 20, '#9af8ff', 30, 140);
    this.player.x = pos.x; this.player.y = pos.y;
    this.world.state.lastWaystone = id;
    this.camera.snap(pos.x, pos.y);
    this.vfx.flash('150,240,255', 0.6, 2);
    this.vfx.ring(pos.x, pos.y, 4, 70, { color: '120,240,255', life: 0.6 });
    this.audio.sfx('waystone');
  }

  endingStats() {
    const s = Math.floor(this.playTime);
    return {
      time: `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`,
      level: this.player.level, secrets: this.world.map.secretsFound.size, lore: Object.keys(this.world.state.lore).length,
      loreTotal: Object.keys(LORE).length, kills: this.stats.kills, chests: this.stats.chests,
    };
  }

  // ---------------- main loop
  frame(now) {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }

    this.handleGlobalKeys();
    if (this.state === 'play' && !this.ui.panelOpen) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.update(STEP);
        this.acc -= STEP;
        if (steps === 0) this.input.endFrame();
        steps++;
      }
      if (steps >= 5) this.acc = 0;
    } else {
      this.acc = 0;
      // idle world animation behind menus / title
      this.time += dt * 0.5;
      if (this.state === 'title') {
        const s = this.world.regions.playerSpawn;
        this.camera.update(dt, { x: s.x + Math.sin(this.time * 0.1) * 120, y: s.y - 120 + Math.cos(this.time * 0.08) * 60 });
      }
      this.vfx.update(dt * 0.5);
      this.ui.update(dt);
      this.input.endFrame();
    }
    this.renderer.render(this);
    const c = this.renderer.ctx;
    if (this.state === 'play') this.ui.draw(c, this.canvas.width, this.canvas.height);
    if (this.debug) this.drawDebug(c);
    requestAnimationFrame((t) => this.frame(t));
  }

  // During the boss fight the camera leans toward the Guardian so both stay readable.
  cameraTarget() {
    const p = this.player, gd = this.world.guardian;
    if (this.world.bossActive && gd && !gd.dead) {
      return { x: p.x + (gd.x - p.x) * 0.35, y: p.y + (gd.y - 40 - p.y) * 0.35 };
    }
    return p;
  }

  // Test hook: advance the simulation deterministically (works even when the tab is hidden).
  simulate(seconds, perStep) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
      if (perStep) perStep(this, i);
      if (this.state === 'play' && !this.ui.panelOpen) this.update(STEP);
      this.input.endFrame();
    }
    this.renderer.render(this);
    if (this.state === 'play') this.ui.draw(this.renderer.ctx, this.canvas.width, this.canvas.height);
  }

  handleGlobalKeys() {
    const inp = this.input;
    if (inp.pressed('F3')) this.debug = !this.debug;
    if (this.state !== 'play') { this.ui.handleKeys(inp); return; }
    if (this.ui.panelOpen) { this.ui.handleKeys(inp); return; }
    if (this.player.dead) return;
    if (inp.pressed('Escape')) this.ui.panels.menu();
    else if (inp.pressed('KeyI')) this.ui.panels.inventory();
    else if (inp.pressed('KeyM')) this.ui.panels.worldMap();
    else if (inp.pressed('KeyE')) this.world.interactNearest();
  }

  update(dt) {
    // slow motion recovers in real time
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.timeScale = 1; }
    else this.timeScale = Math.min(1, this.timeScale + dt * 3);
    this.input.tickBuffer(dt);
    this.playTime += dt;
    // hit stop freezes the simulation briefly (camera + ui keep going)
    if (this.hitStop > 0) {
      this.tickTimers(dt, 0);
      this.hitStop -= dt;
      this.camera.update(dt, this.player, null);
      this.ui.update(dt);
      return;
    }
    const sdt = dt * this.timeScale;
    this.time += sdt;
    this.tickTimers(dt, sdt);
    this.player.update(sdt);
    this.world.update(sdt);
    this.combat.update(sdt);
    this.vfx.update(sdt);
    this.camera.update(dt, this.cameraTarget(), this.player.dead ? null : this.mouseWorld());
    this.ui.update(dt);
    this.inventory.update(dt);
    this.save.update(dt);
  }

  drawDebug(c) {
    const p = this.player, w = this.world;
    const lines = [
      `FPS ${this.fps}  scale ${this.renderer.scale}  view ${this.renderer.vw}x${this.renderer.vh}`,
      `pos ${(p.x / TILE).toFixed(1)}, ${(p.y / TILE).toFixed(1)}  zone ${w.currentZone} ${w.currentSub ? w.currentSub.name : ''}`,
      `monsters ${w.monsters.length}  particles ${this.vfx.particles.count()}  proj ${this.combat.projectiles.pool.count()}  tele ${this.combat.telegraphs.list.length}`,
      `timeScale ${this.timeScale.toFixed(2)} hitStop ${this.hitStop.toFixed(2)}  flags ${Object.keys(w.state.flags).join(',')}`,
    ];
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(0, this.canvas.height - 90, 900, 90);
    // SPRITE VALIDATION (dev mode)
    c.fillRect(this.canvas.width - 300, this.canvas.height - 40 - this.spriteReport.length * 18, 300, 40 + this.spriteReport.length * 18);
    c.font = '14px monospace';
    c.fillStyle = '#fff';
    c.fillText('SPRITE VALIDATION', this.canvas.width - 290, this.canvas.height - 22 - this.spriteReport.length * 18);
    this.spriteReport.forEach((r, i) => { c.fillStyle = r.ok ? '#9f9' : '#fc6'; c.fillText(`${r.name.padEnd(6)} ${r.ok ? '✓' : '⚠ ' + r.issues.join(', ')}  h${r.bodyHeight} feet±${r.feet}`, this.canvas.width - 290, this.canvas.height - 4 - (this.spriteReport.length - 1 - i) * 18); });
    c.fillStyle = '#9f9';
    c.font = '14px monospace';
    lines.forEach((l, i) => c.fillText(l, 10, this.canvas.height - 70 + i * 18));
    c.restore();
  }
}
