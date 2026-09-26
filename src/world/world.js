import { TILE, T, Z, ZONE_INFO } from '../core/constants.js';
import { generateWorld } from '../maps/worldGen.js';
import { Monster } from '../monsters/monster.js';
import { MONSTERS } from '../monsters/monsterTypes.js';
import { Guardian } from '../boss/guardian.js';
import { NPC } from './npc.js';
import { Breakable } from '../exploration/breakable.js';
import { TrainingDummy } from '../entities/trainingDummy.js';
import { isAvailable, interact, promptFor } from '../exploration/interactables.js';
import { dist, rand, randInt, TAU, pick } from '../core/math.js';
import { Assets } from '../core/assets.js';

const REVEAL_R = 10;

// WORLD: owns the map, all live entities, the World State flags and every rule that
// reacts to them (fog, corruption, spawns, barriers, shortcuts, secrets, the boss arena).
export class World {
  constructor(game) {
    this.game = game;
    const { map, builder } = generateWorld();
    this.map = map;
    this.b = builder;
    this.regions = builder.regions;
    this.staticLights = builder.lights;
    this.monsters = [];
    this.breakables = [];
    this.npcs = [];
    this.interactables = [];
    this.spawnPoints = builder.spawns.map((s) => ({ def: s, alive: [], respawnT: 0, active: false }));
    this.guardian = null;
    this.state = this.freshState();
    this.currentZone = Z.NONE;
    this.currentSub = null;
    this.revealT = 0;
    this.hazards = [];
    this.rootSpikes = [];
    this.arenaPhase = 0;
    this.bossActive = false;
    this.totemActive = false;
    this.ambientT = 0;
    this.nearest = null;
    this.propById = {};
    for (const p of map.props) if (p.id) this.propById[p.id] = p;

    for (const n of builder.npcs) {
      const npc = new NPC(game, n);
      this.npcs.push(npc);
      this.interactables.push({ id: 'npc_' + n.id, kind: 'npc', x: npc.x, y: npc.y, radius: 38, npc, secret: n.secret || 0 });
    }
    for (const it of builder.interactables) this.interactables.push(it);
    // examine prompts for the breakable secrets
    this.interactables.push({ id: 'crack_info', kind: 'crackInfo', x: 70.5 * TILE, y: 55.6 * TILE, radius: 40, prompt: 'Examine Cracked Stone' });
    this.interactables.push({ id: 'glyph_info', kind: 'glyphInfo', x: 150.4 * TILE, y: 109.5 * TILE, radius: 40, prompt: 'Examine Glyph' });
    this.makeBreakables();
    // training yard beside the Adventurer Guild (class / combat testing)
    this.dummies = [[29, 186], [32, 187.5], [35, 186]].map(([tx, ty]) => {
      const pos = this.map.findOpen(tx * TILE, ty * TILE, 3);
      return new TrainingDummy(game, pos.x, pos.y);
    });
  }

  freshState() {
    return { flags: {}, chests: {}, lore: {}, waystones: {}, nodes: {}, subs: {}, secrets: [], lastWaystone: null, killed: {} };
  }

  makeBreakables() {
    const g = this.game;
    this.breakables = [];
    const crack = this.propById.cave_crack;
    this.breakables.push(new Breakable(g, 70.5 * TILE, 55 * TILE - 8, {
      kind: 'crack', hp: 70, radius: 22, height: 50, prop: crack,
      canHit: () => !this.state.flags.caveOpened,
      onBreak: () => { this.setFlag('caveOpened'); this.applyState(); this.discoverSecret(1, 'HIDDEN CAVE'); },
    }));
    const glyph = this.propById.archive_glyph;
    this.breakables.push(new Breakable(g, 150.6 * TILE, 109 * TILE, {
      kind: 'glyph', hp: 60, radius: 22, height: 50, prop: glyph,
      canHit: () => !this.state.flags.archiveOpened,
      onBreak: () => { this.setFlag('archiveOpened'); this.applyState(); this.discoverSecret(4, 'SEALED ARCHIVE'); },
    }));
    const br = this.propById.bramble_prop;
    this.breakables.push(new Breakable(g, 68.5 * TILE, 147 * TILE, {
      kind: 'bramble', hp: 40, radius: 40, height: 30, prop: br,
      canHit: () => !this.state.flags.bramble && g.player.y < 147.6 * TILE,
      onBreak: () => { this.setFlag('bramble'); this.applyState(); g.ui.banner('SHORTCUT OPENED', 'Bramble Lane → Lumina Village', '#ffd98a'); },
    }));
  }

  // ---------------- queries
  hostiles() {
    const out = this._hostiles || (this._hostiles = []);
    out.length = 0;
    for (const m of this.monsters) if (!m.dead) out.push(m);
    if (this.guardian && !this.guardian.dead && this.guardian.hurtable) out.push(this.guardian);
    for (const b of this.breakables) if (!b.dead && b.hurtable) out.push(b);
    for (const d of this.dummies) if (!d.dead) out.push(d);
    return out;
  }
  inSafeZone(p) { return this.map.zoneAt(p.x, p.y) === Z.VILLAGE; }
  setFlag(name, v = true) {
    if (this.state.flags[name] === v) return;
    this.state.flags[name] = v;
    this.game.events.emit('flag', name);
    this.game.save.dirty = true;
  }

  // ---------------- world state application (idempotent)
  applyState() {
    const f = this.state.flags, m = this.map, R = this.regions;
    const restored = !!f.guardianDefeated;
    if (m.style.restored !== restored) { m.style.restored = restored; m.invalidate(); }
    for (const p of m.props) {
      if (p.corruptOnly) p.visible = !restored;
      if (p.restoredOnly) p.visible = restored;
      if (p.corruptVariant) { const n = restored ? p.restoredVariant : p.corruptVariant; if (p.name !== n) { p.name = n; p.def = Assets.props[n]; } }
      if (p.secret) p.visible = m.secretsFound.has(p.secret);
    }
    // valley barrier
    const vb = R.valleyBarrier;
    m.setBlockRect(vb.tx0, vb.ty0, vb.tx1, vb.ty1, !restored);
    // shortcuts
    const lb = R.logBridge;
    if (f.logBridge) {
      for (let y = lb.ty0; y <= lb.ty1; y++) for (let x = lb.tx0; x <= lb.tx1; x++) {
        const t = m.get(x, y);
        if (t === T.WATER || t === T.DEEP_WATER || t === T.SAND) m.set(x, y, T.BRIDGE);
      }
      const up = this.propById.log_upright;
      if (up && up.visible) { up.visible = false; m.setPropSolid(up, false); up.solid = false; }
      if (!this.propById.log_fallen) {
        this.propById.log_fallen = m.addProp({ name: 'log_a', x: 22.9 * TILE, y: (lb.ty1 + 1) * TILE - 6, layer: 'ground', rot: Math.PI / 2, scale: 1 });
      }
      m.invalidate();
    }
    m.setBlockRect(100, 111, 101, 113, !f.ruinsGate);
    if (this.propById.side_gate) this.propById.side_gate.visible = !f.ruinsGate;
    const bm = R.bramble;
    m.setBlockRect(bm.tx0, bm.ty0, bm.tx1, bm.ty1, !f.bramble);
    if (this.propById.bramble_prop) this.propById.bramble_prop.cut = !!f.bramble;
    // secret walls
    const cw = R.caveWall;
    if (f.caveOpened) {
      for (let y = cw.ty0 - 1; y <= cw.ty1; y++) for (let x = cw.tx0 + 1; x <= cw.tx1 - 1; x++) m.set(x, y, T.CAVE);
      m.set(70, 55, T.FOREST_FLOOR); m.set(71, 55, T.FOREST_FLOOR);
      if (this.propById.cave_crack) this.propById.cave_crack.broken = true;
      m.invalidate();
    }
    const aw = R.archiveWall;
    if (f.archiveOpened) {
      for (let y = aw.ty0; y <= aw.ty1; y++) m.set(aw.tx0, y, T.RUIN);
      if (this.propById.archive_glyph) this.propById.archive_glyph.broken = true;
      m.invalidate();
    }
    // guardian gate seal
    const gs = R.gateSeal;
    m.setBlockRect(gs.tx0, gs.ty0, gs.tx1, gs.ty1, !f.gateOpened);
    const gp = this.propById.guardian_gate;
    if (gp) { const n = f.gateOpened ? 'gate_open' : 'big_gate'; gp.name = n; gp.def = Assets.props[n]; gp.scale = f.gateOpened ? 0.95 : 0.62; }
    // arena seal (only during the fight)
    const as = R.arenaSeal;
    m.setBlockRect(as.tx0, as.ty0, as.tx1, as.ty1, this.bossActive);
    for (const b of this.breakables) if ((b.kind === 'crack' && f.caveOpened) || (b.kind === 'glyph' && f.archiveOpened) || (b.kind === 'bramble' && f.bramble)) b.dead = true;
    this.refreshSpawns();
  }

  // ---------------- spawning
  refreshSpawns() {
    const restored = !!this.state.flags.guardianDefeated;
    for (const sp of this.spawnPoints) {
      const c = sp.def.cond || 'always';
      const want = c === 'always' || (c === 'before' && !restored) || (c === 'after' && restored);
      if (sp.def.unique && this.state.killed[sp.def.id]) { sp.active = false; continue; }
      if (want && !sp.active) { sp.active = true; this.populate(sp); }
      if (!want && sp.active) {
        sp.active = false;
        for (const m of sp.alive) if (!m.dead) { m.dead = true; m.deathT = 1; m.removed = true; }
        sp.alive = [];
      }
    }
    this.monsters = this.monsters.filter((m) => !m.removed);
  }
  populate(sp) {
    const d = sp.def, g = this.game;
    sp.alive = [];
    if (d.type === 'guardian') {
      if (!this.guardian) this.guardian = new Guardian(g, d.x, d.y);
      return;
    }
    const corrupted = !d.tutorial && !this.state.flags.guardianDefeated && this.map.zoneAt(d.x, d.y) === Z.FOREST;
    for (let i = 0; i < d.count; i++) {
      const a = rand(0, TAU), r = rand(0, d.radius * TILE);
      const pos = this.map.findOpen(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 4);
      const m = new Monster(g, d.type, pos.x, pos.y, { spawn: sp, corrupted });
      sp.alive.push(m);
      this.monsters.push(m);
    }
  }

  onMonsterKilled(m, src) {
    const g = this.game, d = m.def;
    g.knowledge.kill(m.type);
    g.events.emit('kill', m.type);
    if (!m.summoned) {
      g.player.gainExp(d.exp);
      const gold = randInt(d.gold[0], d.gold[1]);
      if (gold) { g.player.gold += gold; g.vfx.text(m.x, m.y - 10, `+${gold}G`, { color: '#ffd24a', size: 8, life: 0.8 }); }
      for (const dr of d.drops || []) if (Math.random() < dr.chance) g.inventory.add(dr.item, dr.count || 1);
    }
    g.vfx.burst(m.x, m.y - m.height * 0.5, m.corrupted ? '#b060ff' : '#c8c0b0', 18, 120);
    g.vfx.shadowSmoke(m.x, m.y, 8);
    g.audio.sfx('kill');
    if (m.spawnRef && m.spawnRef.def.unique) {
      this.state.killed[m.spawnRef.def.id] = true;
      if (d.miniBoss) g.ui.banner('MINI BOSS DEFEATED', d.name, '#e0a0ff');
    }
    g.save.dirty = true;
  }

  // ---------------- mini event: corrupted totem
  startTotemEvent(it) {
    const g = this.game;
    this.totemActive = true;
    g.ui.callout('AMBUSH!', 'Defend yourself as the totem calls the corrupted', '#ff8080');
    g.audio.sfx('roar_small');
    const waves = [['wolf', 'wolf', 'wolf'], ['goblin', 'wolf', 'goblin']];
    let wave = 0;
    const spawnWave = () => {
      const list = waves[wave++];
      const mons = list.map((type) => {
        const a = rand(0, TAU);
        const pos = this.map.findOpen(it.x + Math.cos(a) * 110, it.y + Math.sin(a) * 110, 4);
        const m = new Monster(g, type, pos.x, pos.y, { corrupted: true, summoned: false });
        m.aggro = true; m.setState('alert');
        g.vfx.burst(pos.x, pos.y - 10, '#b060ff', 20, 120);
        this.monsters.push(m);
        return m;
      });
      this.totemWave = mons;
    };
    spawnWave();
    this.totemTick = () => {
      if (this.totemWave.every((m) => m.dead)) {
        if (wave < waves.length) { spawnWave(); g.ui.toast(`Wave ${wave}/${waves.length}`, 1.5); }
        else {
          this.totemTick = null;
          this.totemActive = false;
          this.setFlag('totemDone');
          g.ui.banner('TOTEM DESTROYED', 'The corruption here recedes', '#ffd98a');
          g.vfx.shards(it.x, it.y - 20, '#b060ff', 30, 200);
          g.audio.sfx('shatter');
          this.interactables.push({ id: 'chest_totem', kind: 'chest', x: it.x, y: it.y + 4, radius: 34, loot: [{ item: 'umbral_band', count: 1 }, { item: 'hp_potion', count: 2 }], gold: 80 });
        }
      }
    };
  }

  // ---------------- secrets & discovery
  discoverSecret(id, name) {
    if (this.map.secretsFound.has(id)) return;
    this.map.secretsFound.add(id);
    this.state.secrets = [...this.map.secretsFound];
    const g = this.game;
    g.ui.banner('SECRET DISCOVERED', name, '#e0b0ff');
    g.audio.sfx('secret');
    g.player.gainExp(60);
    this.applyState();
    g.events.emit('secret', id);
    g.save.dirty = true;
  }

  trackZone() {
    const g = this.game, p = g.player;
    const z = this.map.zoneAt(p.x, p.y);
    if (z && z !== this.currentZone) {
      this.currentZone = z;
      const info = ZONE_INFO[z];
      const first = !this.state.subs['zone' + z];
      this.state.subs['zone' + z] = true;
      if (info) {
        if (z === Z.CAVE) this.discoverSecret(1, 'HIDDEN CAVE');
        else g.ui.zoneBanner(info.name, info.sub, first);
        g.audio.music(info.music);
      }
      g.events.emit('zoneEnter', z);
      if (z === Z.VALLEY) this.setFlag('valleyEntered');
    }
    const sa = this.map.subAt(p.x, p.y);
    if (sa && sa !== this.currentSub) {
      this.currentSub = sa;
      if (!this.state.subs[sa.name]) {
        this.state.subs[sa.name] = true;
        if (sa.secret) this.discoverSecret(sa.secret, sa.name.toUpperCase());
        else if (sa.zone !== Z.VILLAGE) { g.ui.subBanner(sa.name); g.player.gainExp(10); }
        g.save.dirty = true;
      }
    }
  }

  revealAround(p) {
    const m = this.map;
    const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
    for (let y = cy - REVEAL_R; y <= cy + REVEAL_R; y++) for (let x = cx - REVEAL_R; x <= cx + REVEAL_R; x++) {
      if (!m.inBounds(x, y)) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > REVEAL_R * REVEAL_R) continue;
      const i = m.idx(x, y);
      const s = m.secret[i];
      // undiscovered secrets are revealed only as 'forest' (2) so the map never gives them away
      if (s && !m.secretsFound.has(s)) { if (!m.revealed[i]) m.revealed[i] = 2; continue; }
      m.revealed[i] = 1;
    }
  }

  // ---------------- interaction
  findNearest(p) {
    let best = null, bd = 1e9;
    for (const it of this.interactables) {
      if (it.kind === 'npc') { it.x = it.npc.x; it.y = it.npc.y; }
      const d = dist(p.x, p.y, it.x, it.y);
      if (it.kind === 'trigger') {
        if (d < it.radius) this.fireTrigger(it);
        continue;
      }
      if (d > it.radius || d >= bd) continue;
      if (!isAvailable(this, it)) continue;
      best = it; bd = d;
    }
    this.nearest = best;
    if (best) best.promptText = promptFor(this, best);
  }
  fireTrigger(it) {
    if (it.fired) return;
    const g = this.game;
    if (it.discover === 'guardian') {
      if (!this.state.flags.gateOpened) return;
      it.fired = true;
      if (!this.state.flags.guardianDiscovered && this.guardian && !this.state.flags.guardianDefeated) {
        this.setFlag('guardianDiscovered');
        g.knowledge.encounter('guardian');
        g.camera.lookAt(this.guardian.x, this.guardian.y - 40, 2.6);
        g.ui.bossTitle('GUARDIAN OF THE FOREST', 'It sleeps… for now');
        g.audio.sfx('discover_boss');
      }
      return;
    }
    if (it.secret) { it.fired = true; this.discoverSecret(it.secret, it.discover.toUpperCase()); }
  }
  interactNearest() {
    if (this.nearest) interact(this, this.nearest);
  }

  // ---------------- boss arena
  startBoss() {
    const g = this.game;
    this.bossActive = true;
    this.applyState();
    const a = this.regions.arena;
    g.camera.lock = { x0: a.x0 - 40, y0: a.y0 - 60, x1: a.x1 + 40, y1: a.y1 + 40 };
    this.setArenaPhase(1);
    this.guardian.wake();
    g.ui.showBossBar(true);
    if (!this.state.flags.guardianDiscovered) this.setFlag('guardianDiscovered');
  }
  endBoss() {
    const g = this.game;
    this.bossActive = false;
    this.applyState();
    g.camera.lock = null;
    g.camera.targetZoom = 1;
    g.ui.showBossBar(false);
  }
  resetBoss() {
    if (!this.guardian) return;
    this.guardian.reset();
    this.endBoss();
    this.setArenaPhase(0);
    this.monsters = this.monsters.filter((m) => !m.summoned);
    this.game.audio.music('arena');
  }
  setArenaPhase(ph) {
    this.arenaPhase = ph;
    this.hazards = [];
    const c = this.regions.arenaCenter;
    if (ph >= 2) {
      // root hazard patches on the rim (centre stays clear)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.6;
        this.hazards.push({ kind: 'roots', x: c.x + Math.cos(a) * 330, y: c.y + Math.sin(a) * 330, r: 40, t: rand(0, 3), period: 5.5 });
      }
    }
    if (ph >= 3) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.2;
        this.hazards.push({ kind: 'pool', x: c.x + Math.cos(a) * 240, y: c.y + Math.sin(a) * 240, r: 46, tick: 0 });
      }
    }
    for (const p of this.map.props) {
      if (p.phaseCrystal) { const n = ph >= 3 ? 'cry_purple_rock' : 'cry_cyan_rock'; p.name = n; p.def = Assets.props[n]; }
      if (p.arenaCrystal) { const n = ph >= 3 ? 'cry_big_purple' : 'cry_big_mix'; p.name = n; p.def = Assets.props[n]; if (p.light) p.light.color = ph >= 3 ? '#b050ff' : '#5af0ff'; }
      if (p.arenaSigil) p.glow = ph >= 3 ? '#c060ff' : ph === 2 ? '#7af0c0' : '#5af0ff';
    }
  }
  rootSpike(x, y) { this.rootSpikes.push({ x, y, t: 0 }); }

  updateHazards(dt) {
    const g = this.game, p = g.player;
    for (const h of this.hazards) {
      if (h.kind === 'roots') {
        h.t += dt;
        if (h.t >= h.period) {
          h.t = 0;
          const tel = g.combat.telegraphs.add({ shape: 'circle', x: h.x, y: h.y, r: h.r, total: 0.8, color: '120,255,120', owner: this.guardian });
          tel.onResolve = () => { g.combat.enemyStrike(this.guardian, tel, 20, { knock: 160 }); this.rootSpike(h.x, h.y); g.vfx.burst(h.x, h.y, '#6adf6a', 12, 100); };
        }
      } else if (h.kind === 'pool') {
        h.tick -= dt;
        if (h.tick <= 0 && dist(p.x, p.y, h.x, h.y) < h.r && !p.invulnerable()) {
          h.tick = 0.6;
          g.combat.dealDamage({ x: h.x, y: h.y, team: 2 }, p, { power: 9, knock: 0 });
          g.vfx.burst(p.x, p.y - 10, '#b050ff', 8, 60);
        }
        if (Math.random() < 0.15) g.vfx.particle(h.x + rand(-h.r, h.r) * 0.7, h.y + rand(-h.r, h.r) * 0.4, { color: '#b050ff', vy: -25, life: 0.8, size: 2, add: true });
      }
    }
    for (const s of this.rootSpikes) s.t += dt;
    this.rootSpikes = this.rootSpikes.filter((s) => s.t < 1.4);
  }

  onGuardianDefeated() {
    const g = this.game;
    this.state.killed.guardian = true;
    this.setFlag('guardianDefeated');
    this.endBoss();
    this.setArenaPhase(0);
    this.monsters = this.monsters.filter((m) => !m.summoned);
    this.applyState();
    // arena restored: flowers + light
    const c = this.regions.arenaCenter;
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), r = rand(60, 460);
      this.map.addProp({ name: pick(['flower_a', 'flower_b', 'flower_c', 'grass_a', 'mush_cyan']), x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
    this.game.after(3, () => { this.setFlag('forestRestored'); this.game.save.dirty = true; });
  }

  // ---------------- per-frame
  update(dt) {
    const g = this.game, p = g.player;
    for (const n of this.npcs) n.update(dt);
    for (const d of this.dummies) d.update(dt);
    // monsters: simulate near the player (or anything in a fight)
    for (const m of this.monsters) {
      if (m.dead) { m.deathT += dt; continue; }
      if (m.aggro || dist(m.x, m.y, p.x, p.y) < 900) m.update(dt);
    }
    this.monsters = this.monsters.filter((m) => !(m.dead && m.deathT > 0.8));
    if (this.guardian) {
      this.guardian.update(dt);
      const gd = this.guardian;
      if (gd.state === 'dormant' && !gd.dead && this.state.flags.gateOpened && !p.dead) {
        if (dist(p.x, p.y, this.regions.arenaCenter.x, this.regions.arenaCenter.y) < this.regions.arenaRadius - 60) this.startBoss();
      }
    }
    if (this.totemTick) this.totemTick();
    this.updateHazards(dt);
    // respawns
    for (const sp of this.spawnPoints) {
      if (!sp.active || sp.def.unique || sp.def.type === 'guardian') continue;
      if (sp.alive.length && sp.alive.every((m) => m.dead)) {
        sp.respawnT += dt;
        if (sp.respawnT > 50 && dist(p.x, p.y, sp.def.x, sp.def.y) > 700) { sp.respawnT = 0; this.populate(sp); }
      }
    }
    this.revealT -= dt;
    if (this.revealT <= 0) { this.revealT = 0.2; this.revealAround(p); }
    this.trackZone();
    this.findNearest(p);
    this.ambient(dt);
  }

  // ambient particles by zone & world state
  ambient(dt) {
    const g = this.game, cam = g.camera, z = this.currentZone, restored = this.state.flags.guardianDefeated;
    this.ambientT += dt;
    if (this.ambientT < 0.05) return;
    this.ambientT = 0;
    const x = cam.left + rand(0, cam.width), y = cam.top + rand(0, cam.height);
    if (z === Z.FOREST || z === Z.GATE) {
      if (!restored) g.vfx.particle(x, y, { color: pick(['#8a50c0', '#5a3a80']), vx: rand(-6, 6), vy: rand(-12, -4), life: 2.5, size: 2, add: true, drag: 0, shrink: true });
      else {
        g.vfx.particle(x, y, { color: pick(['#d8ff80', '#fff0a0']), vx: rand(-10, 10), vy: rand(-10, 10), life: 2.5, size: 2, add: true, drag: 0 });
        if (Math.random() < 0.3) g.vfx.particle(x, cam.top, { color: pick(['#6a9a3a', '#a08a3a']), vx: rand(5, 20), vy: 25, life: 5, size: 2, drag: 0, shrink: false });
      }
    } else if (z === Z.CAVE) g.vfx.particle(x, y, { color: pick(['#b060ff', '#5af0ff']), vy: -8, life: 2, size: 1.5, add: true, drag: 0 });
    else if (z === Z.RUINS || z === Z.ARENA) g.vfx.particle(x, y, { color: restored && z === Z.ARENA ? '#d8ff80' : '#5af0ff', vy: -10, life: 2, size: 1.5, add: true, drag: 0 });
    else if (z === Z.VALLEY) g.vfx.particle(x, y, { color: pick(['#ffe08a', '#fff4c0']), vx: rand(4, 14), vy: rand(-4, 4), life: 3, size: 1.5, add: true, drag: 0 });
    else if (z === Z.VILLAGE && Math.random() < 0.3) g.vfx.particle(x, y, { color: '#ffd08a', vy: -6, life: 2, size: 1, add: true, drag: 0 });
  }

  // ---------------- save/load
  serialize() {
    return { ...this.state, nodes: {}, secrets: [...this.map.secretsFound], revealed: rle(this.map.revealed) };
  }
  load(d) {
    this.state = { ...this.freshState(), ...d, flags: { ...(d.flags || {}) }, nodes: {} };
    this.map.secretsFound = new Set(d.secrets || []);
    if (d.revealed) unrle(d.revealed, this.map.revealed);
  }
}

function rle(arr) {
  const out = [];
  let cur = arr[0], n = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === cur) n++;
    else { out.push(cur, n); cur = arr[i]; n = 1; }
  }
  out.push(cur, n);
  return out;
}
function unrle(r, arr) {
  let i = 0;
  for (let k = 0; k < r.length; k += 2) { arr.fill(r[k], i, i + r[k + 1]); i += r[k + 1]; }
}
