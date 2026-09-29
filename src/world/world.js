import { TILE, Z, ZONE_INFO } from '../core/constants.js';
import { WorldMap } from '../maps/worldMap.js';
import { Builder } from '../maps/builder.js';
import { buildTileset } from '../maps/tiles.js';
import { skinnedTileset } from '../maps/tileSkins.js';
import { LEVELS, START_GRID } from './levels/index.js';
import { Monster } from '../monsters/monster.js';
import { MONSTERS } from '../monsters/monsterTypes.js';
import { Guardian } from '../boss/guardian.js';
import { NPC } from './npc.js';
import { isAvailable, interact, promptFor } from '../exploration/interactables.js';
import { dist, rand, TAU, pick } from '../core/math.js';
import { Assets } from '../core/assets.js';
import { MapManager } from './mapManager.js';
import { TransitionSystem } from './transitionSystem.js';
import { HazardSystem } from './hazardSystem.js';
import { GateSystem } from './gateSystem.js';
import { MAPS } from '../maps/mapRegistry.js';
import { densify, ordinary } from './spawnDensity.js';
import { liveBosses } from '../data/bosses.js';
const ARENA_CLEAR = 4; // tiles around a boss arena kept free of ordinary field packs
import { DIFFICULTY } from '../data/difficulty.js';

const REVEAL_R = 10;
// the World's fields that belong to the loaded grid (swapped by enterGrid)
const LEVEL_FIELDS = ['map', 'b', 'regions', 'staticLights', 'spawnPoints', 'npcs', 'interactables', 'breakables', 'dummies', 'monsters', 'guardian', 'propById'];

// WORLD: owns the loaded grid (world/levels), all live entities, the World State flags and every rule that
// reacts to them (fog, corruption, spawns, barriers, shortcuts, secrets, the boss arena).
// GRIDS: each map names its grid (maps/*.js `grid`). One grid is loaded at a time; its tile map is built the first
// time it is entered and kept (terrain changes survive), while its live objects (monsters, projectiles, effects,
// render cache) are dropped on unload and re-created from the spawn data on the next load.
export class World {
  constructor(game) {
    this.game = game;
    this.tileset = buildTileset(); // shared by every grid
    this.levels = {};
    this.gridId = null;
    this.level = null;
    this.secretsFound = new Set(); // secrets are world-wide (every grid's map shares this set)
    this.pendingReveal = {};       // saved fog of grids not built yet
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
    // every map (Lumina / A1 + its boss arena / Valehaven / A2 on its own grid / ...) + exits between them
    this.mapManager = new MapManager(MAPS);
    this.transitions = new TransitionSystem(this);
    this.hazardSys = new HazardSystem(this, MAPS); // map hazards (maps/*.js content.hazards)
    this.gates = new GateSystem(this, MAPS);       // boss gates with collision (maps/*.js gates)
    this.mapId = null;
    this.suppressZoneBanner = false;
    this.enterGrid(START_GRID, { apply: false });
  }

  freshState() {
    return { flags: {}, chests: {}, lore: {}, waystones: {}, nodes: {}, subs: {}, secrets: [], lastWaystone: null, killed: {}, maps: {}, hidden: {} };
  }

  // ---------------- grids (MAP LOADER)
  // build a grid once: terrain + zones (level.generate), then everything placed on it
  buildLevel(id) {
    const def = LEVELS[id], g = this.game;
    const [w, h] = def.size;
    const map = new WorldMap(skinnedTileset(this.tileset, def.skin), w, h); // skin: the grid's own ground art
    const b = new Builder(map, def.seed || 1);
    def.generate(b);
    map.secretsFound = this.secretsFound;
    if (this.pendingReveal[id]) { unrle(this.pendingReveal[id], map.revealed); delete this.pendingReveal[id]; }
    const L = {
      id, map, b, regions: b.regions, staticLights: b.lights, monsters: [], guardian: null,
      spawnPoints: b.spawns.map((s) => ({ def: s, alive: [], respawnT: 0, active: false })),
      npcs: [], interactables: [...b.interactables], breakables: [], dummies: [], propById: {},
    };
    for (const p of map.props) if (p.id) L.propById[p.id] = p;
    for (const n of b.npcs) {
      const npc = new NPC(g, n);
      L.npcs.push(npc);
      L.interactables.push({ id: 'npc_' + n.id, kind: 'npc', x: npc.x, y: npc.y, radius: 38, npc, secret: n.secret || 0 });
    }
    // content owned by the map files of this grid (maps/*.js `content`): NPCs, signs, extra spawns
    for (const d of MAPS) {
      if (d.grid !== id) continue;
      const c = d.content || {};
      for (const n of c.npcs || []) {
        const npc = new NPC(g, { ...n, x: (n.tx + 0.5) * TILE, y: (n.ty + 0.7) * TILE });
        L.npcs.push(npc);
        L.interactables.push({ id: 'npc_' + n.id, kind: 'npc', x: npc.x, y: npc.y, radius: 38, npc });
      }
      for (const it of c.interactables || []) L.interactables.push({ radius: 34, ...it, x: (it.tx + 0.5) * TILE, y: (it.ty + 0.6) * TILE, mapId: d.id });
      for (const sp of c.spawns || []) L.spawnPoints.push({ def: { radius: 2, count: 1, ...sp, x: (sp.tx + 0.5) * TILE, y: (sp.ty + 0.5) * TILE }, alive: [], respawnT: 0, active: false });
    }
    this.mapManager.attach(id, map);
    // boss arenas stay clear of ordinary field packs (a mini-boss fight must not turn into a swarm), then
    // more monsters per map (data/difficulty.js spawnDensity): bigger packs + new packs, seeded per grid
    const gridOf = (mapId) => (this.mapManager.get(mapId) || {}).grid || START_GRID; // maps without a grid = start grid
    const arenas = liveBosses().filter((b) => b.arena && gridOf(b.map) === id)
      .map((b) => ({ x: b.arena.center[0] * TILE, y: b.arena.center[1] * TILE, r: (b.arena.radius + ARENA_CLEAR) * TILE }));
    const nearArena = (d) => arenas.some((a) => Math.hypot(d.x - a.x, d.y - a.y) < a.r);
    L.spawnPoints = L.spawnPoints.filter((sp) => !ordinary(sp.def) || !nearArena(sp.def));
    // new packs never land on a resting spot (NPCs, waystones)
    const rest = [...L.npcs, ...L.interactables.filter((it) => it.kind === 'waystone')];
    const nearRest = (d) => rest.some((r) => Math.hypot(d.x - r.x, d.y - r.y) < 8 * TILE);
    L.spawnPoints.push(...densify(L.spawnPoints, map, (x, y) => this.mapManager.idAt(x, y, id), DIFFICULTY.spawnDensity, def.seed || 1).filter((sp) => !nearArena(sp.def) && !nearRest(sp.def)));
    if (def.setup) def.setup(this, L);
    return L;
  }
  // LOAD a grid (unloading the current one). opts.apply false = do not run the world flags yet (constructor)
  enterGrid(id, opts = {}) {
    if (this.gridId === id) return false;
    if (!LEVELS[id]) throw new Error('unknown grid ' + id);
    const prev = this.gridId;
    if (prev) this.unloadGrid();
    const L = this.levels[id] || (this.levels[id] = this.buildLevel(id));
    this.level = L;
    this.gridId = id;
    for (const k of LEVEL_FIELDS) this[k] = L[k];
    this.mapManager.use(id);
    this.currentZone = Z.NONE; this.currentSub = null;
    if (opts.apply !== false) this.applyState();
    this.game.events.emit('gridLoaded', { id, from: prev });
    return true;
  }
  // UNLOAD: keep the grid's terrain / placed objects, destroy what lives on it (re-created on the next load)
  unloadGrid() {
    const L = this.level, g = this.game;
    if (!L) return;
    for (const k of LEVEL_FIELDS) L[k] = this[k]; // runtime additions (e.g. a totem chest) stay with the grid
    for (const m of L.monsters) m.removed = true;
    L.monsters = [];
    for (const sp of L.spawnPoints) { sp.active = false; sp.alive = []; sp.respawnT = 0; }
    L.map.chunkCache.clear(); // render cache: rebuilt when drawn again
    if (g.combat) g.combat.clear(); // projectiles + telegraphs
    if (g.vfx && g.vfx.clear) g.vfx.clear();
    if (g.targets) g.targets.clear();
    this.hazards = []; this.rootSpikes = []; this.totemTick = null; this.totemActive = false;
    for (const s of this.spikes || []) L.map.blocker[s.i] = Math.max(0, L.map.blocker[s.i] - 1);
    this.spikes = [];
    this.nearest = null;
    g.events.emit('gridUnloaded', { id: L.id });
    this.level = null;
    this.gridId = null;
    this.mapManager.use(null);
  }
  // where a fallen player gets up: the last waystone (any built grid), else Lumina — loads that grid
  checkpoint() {
    const id = this.state.lastWaystone;
    const owner = id && Object.values(this.levels).find((L) => (L === this.level ? this.interactables : L.interactables).some((i) => i.id === id));
    this.enterGrid(owner ? owner.id : START_GRID);
    const ws = id && this.interactables.find((i) => i.id === id);
    return ws ? this.map.findOpen(ws.x, ws.y + 40, 3) : this.regions.villageRespawn;
  }

  // ---------------- queries
  // the boss the Boss UI follows (the current map's boss: maps/*.js `boss`)
  get boss() { return this.guardian && this.mapDef && this.mapDef.boss === this.guardian.type ? this.guardian : null; }

  // ---------------- maps
  get mapDef() { return this.mapId ? this.mapManager.get(this.mapId) : null; }
  // is an entity / object on the current map? (its map is fixed where it was placed: home / spawn position)
  onMap(e) {
    if (!this.mapId) return true;
    if (e.mapId === undefined) { const h = e.home || e; e.mapId = this.mapManager.idAt(h.x, h.y); }
    return e.mapId === this.mapId || e.mapId === null;
  }
  // switch the active map. opts.entry: [tx, ty] arrival point (walking through an exit); without it the player
  // is already on the new map (teleport, respawn, load, new game)
  changeMap(id, opts = {}) {
    const g = this.game, p = g.player, def = this.mapManager.get(id);
    if (!def) return false;
    const prev = this.mapId;
    if (prev === id && !opts.entry) return false;
    if (prev) g.events.emit('mapExited', { id: prev, to: id, via: opts.via || null });
    if (def.grid !== this.gridId) this.enterGrid(def.grid); // another grid: unload this one, load that one
    this.mapId = id;
    this.mapManager.activate(id);
    g.camera.bounds = this.mapManager.boundsPx(id);
    if (opts.entry) {
      const pos = this.map.findOpen(opts.entry[0] * TILE, opts.entry[1] * TILE, 4);
      p.x = pos.x; p.y = pos.y; p.kx = p.ky = 0;
      g.vfx.flash('0,0,0', 1, 2.4); // quick fade in from black
    }
    g.camera.snap(p.x, p.y);
    if (g.targets) g.targets.clear();
    const first = !this.state.maps[id];
    this.state.maps[id] = true;
    this.suppressZoneBanner = true; // the map banner replaces the zone banner
    if (!opts.silent) g.ui.zoneBanner(def.name, def.sub, first);
    g.events.emit('mapEntered', { id, from: prev, first });
    g.save.dirty = true;
    return true;
  }
  // teleports put the player straight onto another map: follow them there
  syncMapToPlayer(opts) {
    const p = this.game.player, id = this.mapManager.idAt(p.x, p.y);
    if (id && id !== this.mapId) this.changeMap(id, opts);
  }

  hostiles() {
    const out = this._hostiles || (this._hostiles = []);
    out.length = 0;
    for (const m of this.monsters) if (!m.dead && this.onMap(m)) out.push(m);
    if (this.guardian && !this.guardian.dead && this.guardian.hurtable && this.onMap(this.guardian)) out.push(this.guardian);
    if (this.game.bosses) for (const b of this.game.bosses.entities()) if (!b.dead && b.hurtable) out.push(b); // area bosses
    for (const b of this.breakables) if (!b.dead && b.hurtable && this.onMap(b)) out.push(b);
    for (const d of this.dummies) if (!d.dead && this.onMap(d)) out.push(d);
    return out;
  }
  // safe maps (cities) come from map data (`safe: true`); before a map is active, the village zone
  inSafeZone(p) { const d = this.mapDef; return d ? !!d.safe : this.map.zoneAt(p.x, p.y) === Z.VILLAGE; }
  // any boss fight (the Guardian's own flag, or an area boss engaged in the BossSystem): exits lock, no saving
  inBossFight() { return this.bossActive || !!(this.game.bosses && this.game.bosses.engaged); }
  setFlag(name, v = true) {
    if (this.state.flags[name] === v) return;
    this.state.flags[name] = v;
    this.game.events.emit('flag', name);
    this.game.save.dirty = true;
  }

  // ---------------- world state application (idempotent)
  applyState() {
    const def = LEVELS[this.gridId];
    if (def && def.apply) def.apply(this); // this grid's own flag rules (world/levels/*.js)
    this.gates.apply(); // boss gates follow the World Progression (collision open / closed)
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
  // how a spawn point's monsters are made (also read by tools/pacing.js): the map it sits in decides
  // corrupted beasts (corruptedMonsters: true | { minTy, maxTy }) until the Guardian falls — tutorial spawns never;
  // hardened zones (monsterMods: [{ zones, mod }]) or the map's monsterMod (Route B); the map's levelBand
  spawnOpts(d) {
    const home = this.mapManager && this.mapManager.get(this.mapManager.idAt(d.x, d.y));
    const cm = home && home.corruptedMonsters, ty = Math.floor(d.y / TILE);
    const inCorrupt = cm === true || (!!cm && (cm.minTy === undefined || ty >= cm.minTy) && (cm.maxTy === undefined || ty <= cm.maxTy));
    const corrupted = !d.tutorial && !this.state.flags.guardianDefeated && inCorrupt;
    const zone = this.map.zoneAt(d.x, d.y);
    const zm = home && (home.monsterMods || []).find((x) => x.zones.includes(zone));
    const areaMod = (zm && zm.mod) || (home && home.monsterMod);
    return { corrupted, elite: !!d.elite, areaMod, levelBand: home && home.levelBand, mapId: home && home.id };
  }
  populate(sp) {
    const d = sp.def, g = this.game;
    sp.alive = [];
    if (d.type === 'guardian') {
      if (!this.guardian) this.guardian = new Guardian(g, d.x, d.y);
      return;
    }
    const opts = this.spawnOpts(d);
    for (let i = 0; i < d.count; i++) {
      const a = rand(0, TAU), r = rand(0, d.radius * TILE);
      const pos = this.map.findOpen(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 4);
      const m = new Monster(g, d.type, pos.x, pos.y, { spawn: sp, ...opts });
      sp.alive.push(m);
      this.monsters.push(m);
    }
  }

  // The world only records what the death means for the world; EXP / loot / quests / knowledge / UI
  // react to the 'enemyDefeated' event (progression/experienceSystem.js, loot/lootSystem.js, quests, ...).
  onMonsterKilled(m, src) {
    const g = this.game, d = m.def;
    g.events.emit('enemyDefeated', {
      entity: m, type: m.type, name: m.name, source: src, x: m.x, y: m.y,
      summoned: !!m.summoned, boss: false, elite: m.elite, miniBoss: !!d.miniBoss, exp: m.expReward, loot: m.lootTable,
    });
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
    const waves = [['wolf', 'wolf', 'wolf'], ['leafling', 'wolf', 'leafling']];
    let wave = 0;
    const spawnWave = () => {
      const list = waves[wave++];
      const mons = list.map((type) => {
        const a = rand(0, TAU);
        const pos = this.map.findOpen(it.x + Math.cos(a) * 110, it.y + Math.sin(a) * 110, 4);
        const m = new Monster(g, type, pos.x, pos.y, { corrupted: true, summoned: false });
        m.aggro = true; m.setState('aggro');
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
    if (this.secretsFound.has(id)) return;
    this.secretsFound.add(id);
    this.state.secrets = [...this.secretsFound];
    const g = this.game;
    g.ui.banner('SECRET DISCOVERED', name, '#e0b0ff');
    g.audio.sfx('secret');
    this.applyState();
    g.events.emit('secretFound', { id, name });
    g.save.dirty = true;
  }

  trackZone() {
    const g = this.game, p = g.player;
    const quiet = this.suppressZoneBanner;
    this.suppressZoneBanner = false;
    const z = this.map.zoneAt(p.x, p.y);
    if (z && z !== this.currentZone) {
      this.currentZone = z;
      const info = ZONE_INFO[z];
      const first = !this.state.subs['zone' + z];
      this.state.subs['zone' + z] = true;
      if (info) {
        if (z === Z.CAVE) this.discoverSecret(1, 'HIDDEN CAVE');
        else if (!quiet) g.ui.zoneBanner(info.name, info.sub, first);
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
        else if (sa.zone !== Z.VILLAGE) {
          const optional = this.mapDef && this.mapDef.content && this.mapDef.content.optional === sa.name;
          g.ui.subBanner(optional ? `${sa.name} · Optional Area` : sa.name); g.events.emit('areaDiscovered', { name: sa.name, zone: sa.zone }); }
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
      if (!this.onMap(it.npc || it)) continue;
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
        if (this.onMap(this.guardian)) g.camera.lookAt(this.guardian.x, this.guardian.y - 40, 2.6); // it sleeps on the next map
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
  // attack data `leaves: { count, radius, life, sprite }`: crystal spikes burst up around an impact and BLOCK the ground
  // for `life` s (tiles marked solid). Never on a player / an occupied or solid tile. Monster attacks: golem slam.
  spawnSpikes(x, y, o = {}) {
    const g = this.game, m = this.map, n = o.count || 5, r = o.radius || 60;
    this.spikes = this.spikes || [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rand(-0.3, 0.3), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (!m.inBounds(tx, ty) || m.isSolid(tx, ty)) continue;
      if (g.players().some((p) => Math.hypot(p.x - (tx + 0.5) * TILE, p.y - (ty + 0.5) * TILE) < 30)) continue;
      const i = m.idx(tx, ty);
      m.blocker[i]++;
      this.spikes.push({ i, t: o.life || 6 });
      if (o.sprite) g.vfx.sprite(o.sprite, (tx + 0.5) * TILE, (ty + 0.9) * TILE - 16, 0, { life: o.life || 6, frame: 4, scale: 0.7, glow: 0.3 });
      g.vfx.shards((tx + 0.5) * TILE, (ty + 0.5) * TILE, '#9ad8ff', 6, 90);
    }
  }

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
    if (this.spikes && this.spikes.length) {
      for (const s of this.spikes) { s.t -= dt; if (s.t <= 0) this.map.blocker[s.i] = Math.max(0, this.map.blocker[s.i] - 1); }
      this.spikes = this.spikes.filter((s) => s.t > 0);
    }
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
    // monsters: only the current map is simulated (other maps are frozen), and only near the player / in a fight
    for (const m of this.monsters) {
      if (m.dead) { m.deathT += dt; continue; }
      if (this.onMap(m) && (m.aggro || dist(m.x, m.y, p.x, p.y) < 900)) m.update(dt);
    }
    this.monsters = this.monsters.filter((m) => !(m.dead && m.deathT > 0.8));
    if (this.guardian) this.guardian.update(dt);
    // every boss encounter (engage / arena lock / phases / defeat): boss/bossSystem.js + data/bosses.js
    if (g.bosses) { g.bosses.update(dt); g.bosses.ambient(); }
    this.gates.update(dt);
    if (this.totemTick) this.totemTick();
    this.updateHazards(dt);
    this.hazardSys.update(dt);
    // respawns
    for (const sp of this.spawnPoints) {
      if (!sp.active || sp.def.unique || sp.def.type === 'guardian') continue;
      if (sp.alive.length && sp.alive.every((m) => m.dead)) {
        sp.respawnT += dt;
        if (sp.respawnT > DIFFICULTY.respawnTime && dist(p.x, p.y, sp.def.x, sp.def.y) > 700) { sp.respawnT = 0; this.populate(sp); }
      }
    }
    this.revealT -= dt;
    if (this.revealT <= 0) { this.revealT = 0.2; this.revealAround(p); }
    this.transitions.update(dt, p);
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
  // fog of war: `revealed` = the start grid (as before grids existed), `revealedGrids` = every other grid seen so far
  serialize() {
    const other = { ...this.pendingReveal };
    for (const [id, L] of Object.entries(this.levels)) if (id !== START_GRID) other[id] = rle(L.map.revealed);
    return { ...this.state, nodes: {}, secrets: [...this.secretsFound], revealed: rle(this.levels[START_GRID].map.revealed), revealedGrids: other };
  }
  load(d) {
    const { revealed, revealedGrids, ...rest } = d;
    this.state = { ...this.freshState(), ...rest, flags: { ...(d.flags || {}) }, nodes: {} };
    this.secretsFound.clear();
    for (const id of d.secrets || []) this.secretsFound.add(id);
    const fog = { ...(revealedGrids || {}), ...(revealed ? { [START_GRID]: revealed } : {}) };
    if (fog.ashen) { fog.ancient_valley = fog.ancient_valley || fog.ashen; delete fog.ashen; } // W1/W2 name of the A2 grid
    this.pendingReveal = {};
    for (const [id, r] of Object.entries(fog)) {
      if (this.levels[id]) unrle(r, this.levels[id].map.revealed);
      else this.pendingReveal[id] = r;
    }
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
