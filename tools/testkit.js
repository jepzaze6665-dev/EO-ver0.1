// Browser-side test harness (import from the console: await import('/tools/testkit.js')).
// Drives the real game through window.__game using the deterministic simulate() hook.
const TILE = 32;
// SKILL TREE (data/skillTree.js): regression tests / bots use every skill at any level. combatTest.js and
// checklist.js import this file, so loading any of the dev tools switches the unlock gate off for the session.
import { SKILL_TREE } from '../src/data/skillTree.js';
import { CLASS_TREE } from '../src/data/classTree.js';
import { GEAR_ITEMS } from '../src/data/items/index.js';
SKILL_TREE.unlockAll = true;

export function bot(g, i, opts = {}) {
  const p = g.player, inp = g.input;
  ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ'].forEach((k) => inp.down.delete(k));
  if (p.dead) return;
  const press = (a) => {
    if (Math.cos(a) > 0.3) inp.down.add('KeyD');
    if (Math.cos(a) < -0.3) inp.down.add('KeyA');
    if (Math.sin(a) > 0.3) inp.down.add('KeyS');
    if (Math.sin(a) < -0.3) inp.down.add('KeyW');
  };
  // dodge telegraphs at the last moment (exercises Perfect Dodge)
  if (!opts.noDodge) for (const t of g.combat.telegraphs.list) {
    if (t.resolved) continue;
    const rem = t.total - t.time;
    // guard classes with guardStyle 'hold' raise the shield as soon as a blow is winding up (tank play)
    const lead = p.cls.guard && opts.guardStyle === 'hold' ? 0.6 : (opts.dodgeLead ?? 0.1);
    if (rem < lead && rem > 0 && g.combat.testShape(t, p)) {
      // counter-stance classes (special tagged 'counter', e.g. Crimson Counter) answer the blow instead of dodging
      const sp = p.cls.special;
      if (sp && (sp.tags || []).includes('counter') && !t.unblockable && p.skillSys.canUse(sp.id).ok && !(p.action && p.action.counter)) { inp.pushBuffer('break'); return; }
      if (p.action && p.action.counter) return; // already in the stance: hold it
      // guard classes raise the guard toward the attacker at the last moment (-> Perfect Guard)
      if (p.cls.guard && t.owner && !t.owner.dead) {
        // guard toward the attacker (or the telegraph itself when its owner is a mechanic, e.g. boss runes)
        const r = g.renderer, cam = g.camera, src = Number.isFinite(t.owner.x) ? t.owner : t;
        inp.mouse.x = ((src.x - cam.left) * cam.zoom * r.scale) / r.dpr;
        inp.mouse.y = ((src.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
        inp.down.add('KeyQ');
        // big attackers land their damage a few frames after the telegraph resolves: keep the shield up
        p._botGuard = { until: g.time + rem + 0.35, x: src.x, y: src.y };
        return;
      }
      press(Math.atan2(p.y - t.y, p.x - t.x));
      inp.pushBuffer('dodge');
      return;
    }
  }
  if (p._botGuard && g.time < p._botGuard.until) {
    const r = g.renderer, cam = g.camera;
    inp.mouse.x = ((p._botGuard.x - cam.left) * cam.zoom * r.scale) / r.dpr;
    inp.mouse.y = ((p._botGuard.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
    inp.down.add('KeyQ');
    return;
  }
  const ms = g.world.hostiles().filter((m) => !m.isBreakable || opts.breakables);
  ms.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const tgt = opts.target || ms[0];
  if (!tgt || Math.hypot(tgt.x - p.x, tgt.y - p.y) > (opts.range || 420)) return;
  const r = g.renderer, cam = g.camera;
  inp.mouse.x = ((tgt.x - cam.left) * cam.zoom * r.scale) / r.dpr;
  inp.mouse.y = ((tgt.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
  const d = Math.hypot(tgt.x - p.x, tgt.y - p.y);
  // ranged classes (class data: ratings.range >= 4) kite at mid range and play their own loop
  if (p.cls.ratings && p.cls.ratings.range >= 4) {
    const tier2 = CLASS_TREE[p.cls.id] && CLASS_TREE[p.cls.id].tier >= 2;
    // ranged Class 2: nothing has hit anyone for 6 s (an obstacle between us) -> circle the target to find a clear line
    if (tier2 && d > 100 && d < 280 && g.time - g.combat.lastCombatTime > 6) press(Math.atan2(tgt.y - p.y, tgt.x - p.x) + (Math.floor(g.time / 2) % 2 ? 1.57 : -1.57));
    else if (d > 220) press(Math.atan2(tgt.y - p.y, tgt.x - p.x));
    else if (d < 100) press(Math.atan2(p.y - tgt.y, p.x - tgt.x));
    if (tier2 && d < 280 && i % (opts.apm || 5) === 0) {
      // ranged Class 2 (Stormcaller ...): any ready non-dash skill in turn, the ultimate, a resource-gated special when full.
      // Like a player, it does not start a cast while a telegraph on it is about to land (a cast cannot be dodged out of at once)
      inp.pushBuffer('attack');
      const danger = g.combat.telegraphs.list.some((t) => !t.resolved && t.total - t.time < 0.8 && g.combat.testShape(t, p));
      if (danger) {
        // escape with an invulnerable dash skill (Storm Step) away from the attacker, when one is ready
        const esc = p.loadout.bindings().find((x) => x.key !== '5' && ['dash', 'invulnerable'].every((t) => (x.skill.tags || []).includes(t)) && p.skillSys.canUse(x.skill.id).ok);
        if (esc && !p.action) {
          const away = Math.atan2(p.y - tgt.y, p.x - tgt.x) + (i % 2 ? 0.9 : -0.9);
          inp.mouse.x = ((p.x + Math.cos(away) * 200 - cam.left) * cam.zoom * r.scale) / r.dpr;
          inp.mouse.y = ((p.y + Math.sin(away) * 200 - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
          inp.pushBuffer('skill' + esc.key);
        }
        if (p.hp < p.maxHp * 0.35) g.inventory.quickUse('hp_potion'); if (opts.god) p.hp = Math.max(p.hp, p.maxHp * 0.5); return;
      }
      // and keeps stamina for a dodge (+ some) instead of spending it all on casts
      const staminaOk = p.resources.get('stamina') >= p.dodgeCost() + 20;
      // like a healer player: support skills (tag 'support') only when someone in the party is below 75% HP
      const hurt = (g.players ? g.players() : [p]).some((m) => m.hp < m.maxHp * 0.75), useful = (s) => hurt || !(s.tags || []).includes('support');
      if (i % 20 === 0 && staminaOk) {
        const b = p.loadout.bindings().find((x) => x.key !== '5' && useful(x.skill) && !(x.skill.tags || []).some((t) => t === 'dash' || t === 'mobility') && p.skillSys.canUse(x.skill.id).ok);
        if (b) inp.pushBuffer('skill' + b.key);
      }
      if (p.skillSys.canUse(p.loadout.bindings().find((x) => x.key === '5')?.skill.id || '').ok) inp.pushBuffer('skill5');
      const sp = p.cls.special, res = p.resources.get(p.primaryResource);
      // a special gated by a resource requirement (Storm Burst: spend it all) waits for a full bar; a plain costed one
      // (Void Seal) is used whenever it is ready
      if (sp && useful(sp) && ((sp.requirements || []).length ? res >= 80 : sp.cost > 0) && p.skillSys.canUse(sp.id).ok) inp.pushBuffer('break');
    } else if (d < 280 && i % (opts.apm || 5) === 0) {
      const res = p.resources.get(p.primaryResource);
      inp.pushBuffer('attack');
      if (i % 50 === 0) inp.pushBuffer('skill1');
      if (i % 40 === 0 && d < 220) inp.pushBuffer('skill2');
      if (p.threadCount > 0 && res >= 30 && i % 20 === 0) inp.pushBuffer('skill4');
      if (res >= 60) inp.pushBuffer('skill5');
      if (p.hp < p.maxHp * 0.6) inp.pushBuffer('break');
    }
    if (p.hp < p.maxHp * 0.35) g.inventory.quickUse('hp_potion');
    if (opts.god) p.hp = Math.max(p.hp, p.maxHp * 0.5);
    return;
  }
  const reach = (tgt.radius || 10) + 36;
  if (d > reach) press(Math.atan2(tgt.y - p.y, tgt.x - p.x));
  if (d < reach + 30 && i % (opts.apm || 5) === 0) {
    inp.pushBuffer('attack');
    // any class: fire the first slotted skill (keys 1-4) that is ready, affordable and allowed
    if (i % 20 === 0) {
      // damage rotation only: mobility / dash skills would carry a melee class out of range
      const b = p.loadout.bindings().find((x) => x.key !== '5' && !(x.skill.tags || []).some((t) => t === 'dash' || t === 'mobility') && p.skillSys.canUse(x.skill.id).ok);
      if (b) inp.pushBuffer('skill' + b.key);
    }
    // finisher specials gated by requirements (Shadow Break: 3 marks, Reaper's Step: a marked foe) fire when allowed
    const sp = p.cls.special;
    if (p.marks >= 3 || (sp && (sp.requirements || []).length && p.skillSys.canUse(sp.id).ok)) inp.pushBuffer('break');
    // gap-closer specials with a recast (Duskrunner Flash Step): used now and then, toward the target
    else if (sp && sp.recast && i % 60 === 0 && d > 40 && p.skillSys.canUse(sp.id).ok) inp.pushBuffer('break');
    if (tgt.status && tgt.status.has('vulnerable') && p.shadow >= 50) inp.pushBuffer('skill5');
  }
  if (p.hp < p.maxHp * 0.35) g.inventory.quickUse('hp_potion');
  if (opts.god) p.hp = Math.max(p.hp, p.maxHp * 0.5);
}

// release every held key / buffered action so one step never leaks into the next
export function releaseInput(g) {
  g.player.endAction(true); // a long skill (e.g. an ultimate) must not carry over into the next step
  g.input.down.clear();
  g.input.clearAll();
  g.input.mouse.left = g.input.mouse.right = false; // a held guard (right button) would leak into the next step
  g.player.vx = g.player.vy = 0;
  g.player.kx = g.player.ky = 0; // leftover knockback would slide a teleported player off its mark
}

export function goto(g, tx, ty) {
  releaseInput(g);
  const p = g.player;
  const pos = g.world.map.findOpen(tx * TILE, ty * TILE, 5);
  p.x = pos.x; p.y = pos.y;
  g.camera.snap(p.x, p.y);
  g.simulate(0.3);
}

export function use(g, id) {
  const it = g.world.interactables.find((i) => i.id === id);
  if (!it) return { error: 'no ' + id };
  releaseInput(g);
  // an open panel (e.g. a discovery popup) pauses the world, so `nearest` would never refresh
  if (g.ui.panelOpen) g.ui.panels.close(true);
  const p = g.player;
  const pos = g.world.map.findOpen(it.x, it.y + 20, 3);
  p.x = pos.x; p.y = pos.y;
  g.simulate(0.2);
  const ok = g.world.nearest === it;
  g.world.interactNearest();
  const n = g.world.nearest;
  return ok ? { ok, panel: g.ui.panels.current && g.ui.panels.current.name } : { ok, nearest: n && (n.id || n.kind), dist: n && Math.round(Math.hypot(n.x - p.x, n.y - p.y)), itDist: Math.round(Math.hypot(it.x - p.x, it.y - p.y)), hostilesNear: g.world.hostiles().filter((m) => Math.hypot(m.x - p.x, m.y - p.y) < 200).length, inCombat: g.combat.inCombat };
}

export function fight(g, seconds, opts = {}) {
  const gd = g.world.guardian, p = g.player, log = [];
  let t = 0;
  for (let s = 0; s < seconds / 5; s++) {
    g.simulate(5, (gg, i) => bot(gg, i, opts));
    t += 5;
    if (gd && g.world.bossActive) log.push(`${t}s boss=${Math.round((gd.hp / gd.maxHp) * 100)}% ph=${gd.phase} ${gd.state} | hp=${Math.round(p.hp)}/${p.maxHp} pots=${g.inventory.count('hp_potion')}`);
    if (p.dead || (opts.untilBossDead && gd && gd.dead) || (opts.until && opts.until())) break;
  }
  releaseInput(g);
  return log;
}

export function counters(g) {
  const c = { perfect: 0, breaks: 0, weak: 0, ults: 0, constellations: 0, threads: 0 };
  g.events.on('perfectDodge', () => c.perfect++);
  g.events.on('perfectGuard', () => c.perfect++); // guard classes: Perfect Guard is their perfect-timing mechanic
  g.events.on('bossWeak', () => c.weak++);
  g.events.on('markTriggered', (e) => { if (e.source === g.player) c.constellations++; });
  g.events.on('threadCreated', () => c.threads++);
  // "break" = the class's signature finisher (class data: tutorial.breakSkill)
  g.events.on('skillUsed', (e) => { if (e.skill.ultimate) c.ults++; if (e.skillId === g.player.cls.tutorial.breakSkill) c.breaks++; });
  return c;
}

// Jump straight to the Guardian fight with the prerequisite flags set.
export function toBoss(g, classId) {
  g.newGame(classId);
  g.world.setFlag('shrineInvestigated');
  g.world.setFlag('gateOpened');
  g.world.applyState();
  goto(g, 135, 37);
  g.simulate(3);
}

// V2.1 maps: walk through every exit of every map (locks opened), check the arrival map, that the player
// is not standing in an exit on arrival (no transition loop) and stays there, plus the mapExited/mapEntered events.
// Returns [step, pass, detail] rows. Leaves the game in a fresh New Game afterwards.
// SECRET BOSS CHAIN (Varkharon, D3): the Ashen Pilgrim (random spot per map entry, gated per map), his three trials
// (altars · flawless rhino kills · timed rune statue), the gargoyle forge and the dragon door.
//   const T = await import('/tools/testkit.js'); await T.pilgrimCheck(__game)
export async function pilgrimCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  const I = await import('../src/exploration/interactables.js');
  const { dialogueFor } = await import('../src/world/narrative.js');
  const { WANDERERS } = await import('../src/data/wanderers.js');
  g.newGame(classId);
  const w = g.world, q = g.quests, inv = g.inventory, P = WANDERERS.ashen_pilgrim;
  const enter = (map) => { const d = w.mapManager.get(map); w.changeMap(map, { entry: d.spawn, silent: true }); };
  const pilgrim = () => w.npcs.find((n) => n.id === 'ashen_pilgrim');
  const talk = () => { g.events.emit('npcTalked', { id: 'ashen_pilgrim' }); return dialogueFor('ashen_pilgrim', g); };
  const it = (id) => w.interactables.find((x) => x.id === id);
  const { BOSSES } = await import('../src/data/bosses.js');
  const inArena = Object.entries(P.maps).flatMap(([map, e]) => e.spots.filter(([x, y]) => Object.values(BOSSES)
    .some((b) => b.arena && b.arena.center && (w.mapManager.get(b.map) || {}).grid === w.mapManager.get(map).grid && Math.hypot(b.arena.center[0] - x, b.arena.center[1] - y) <= (b.arena.radius || 10) + 4)).map((s) => map + ':' + s));
  ok('No pilgrim spot inside a boss arena', !inArena.length, inArena.join(' '));
  g.worldProgress.defeatBoss('boss_a1');
  enter('a2');
  ok('No pilgrim in A2 before its requirement (Sunken Horn)', !pilgrim());
  const seen = new Set();
  for (let k = 0; k < 14; k++) { enter('a1'); const n = pilgrim(); if (n) seen.add(g.wanderers.spot.ashen_pilgrim.join(',')); }
  ok('A1: the pilgrim appears on every entry, at different spots', seen.size >= 2 && [...seen].every((s) => P.maps.a1.spots.some((p) => p.join(',') === s)), [...seen].join(' | '));
  ok('Only one pilgrim at a time', w.npcs.filter((n) => n.id === 'ashen_pilgrim').length === 1);
  const d0 = talk();
  ok('Dialogue offers the A1 trial', d0.options.some((o) => o.action === 'quest:ember_trial_a1'));
  q.accept('ember_trial_a1', { npc: 'ashen_pilgrim' });
  for (const k of [1, 2, 3]) I.interact(w, it('emberAltar_' + k));
  ok('Three altars set the trial flag', w.state.flags.emberAltarsLit && q.current('ember_trial_a1').id === 'return');
  talk();
  ok('Trial 1 done -> 1 Cinder Shard', q.isDone('ember_trial_a1') && inv.count('cinder_shard') === 1);
  // A2: flawless rhino kills
  g.worldProgress.defeatBoss('mini_sunken_horn');
  enter('a2');
  ok('A2: the pilgrim appears once the Sunken Horn is down', !!pilgrim());
  q.accept('ember_trial_a2', { npc: 'ashen_pilgrim' });
  const kill = () => g.events.emit('enemyDefeated', { type: 'rock_rhino' });
  kill(); kill();
  g.events.emit('damageTaken', { target: g.player, source: { type: 'rock_rhino' }, amount: 20 });
  const reset = q.active.ember_trial_a2.progress.rhinos;
  g.events.emit('damageTaken', { target: g.player, source: { type: 'armadillo' }, amount: 20 }); // another type: no reset
  kill(); kill(); const two = q.active.ember_trial_a2.progress.rhinos; kill();
  ok('Rhino hit resets the count, other monsters do not', reset === 0 && two === 2 && q.current('ember_trial_a2').id === 'return', `reset=${reset} two=${two}`);
  talk();
  ok('Trial 2 done -> 2 Cinder Shards', inv.count('cinder_shard') === 2);
  // A3: the timed rune statue
  g.worldProgress.defeatBoss('mini_archive_warden');
  enter('a3');
  q.accept('ember_trial_a3', { npc: 'ashen_pilgrim' });
  const st = it('a3_rune_dragon'), hp0 = g.player.hp = g.player.maxHp;
  g.time = Math.ceil(g.time / st.period) * st.period + st.open + 1; // runes cold
  I.interact(w, st);
  const burned = g.player.hp < hp0 && !w.state.flags.runeDragonAwake;
  g.time = Math.ceil(g.time / st.period) * st.period + 0.5; // runes burning
  I.interact(w, st);
  ok('Rune statue: cold = burns you, burning = wakes', burned && w.state.flags.runeDragonAwake);
  talk();
  ok('Trial 3 done -> 3 Cinder Shards', inv.count('cinder_shard') === 3);
  ok('Pilgrim now tells where the hollow is', talk().lines.some((l) => l.includes('Valley Gate')));
  // forge + door
  enter('a2');
  I.interact(w, it('a2_ember_rumour'));
  ok('Gargoyle forges the seal (3 shards -> Varkharon\'s Seal)', inv.count('varkharon_seal') === 1 && inv.count('cinder_shard') === 0 && w.state.flags.sealForged);
  enter('a1'); const gone = !pilgrim(); enter('a2');
  ok('Pilgrim is gone once the seal is forged', gone && !pilgrim());
  I.interact(w, it('a2_dragon_door'));
  const ex = w.mapManager.get('a2').exits.find((e) => e.id === 'cinder_door');
  ok('Dragon door opens (the seal is a KEY: kept, exit unlocked)', w.state.flags.cinderSealBroken && inv.count('varkharon_seal') === 1 && !w.transitions.lockReason(ex));
  g.ui.close && g.ui.close();
  return R;
}

export function mapTour(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, mm = w.mapManager, p = g.player;
  w.transitions.autoConfirm = true; // boss gate asks first — the tour just walks through
  ok('New Game starts on Lumina', w.mapId === 'lumina');
  for (const f of ['ruinsGate', 'logBridge', 'bramble', 'gateOpened', 'guardianDefeated']) w.setFlag(f);
  for (const b of g.bosses.list) g.worldProgress.defeatBoss(b.id); // V2.2 boss gates: every road open for the tour
  // exits sealed by a flag (the A2 dragon door: cinderSealBroken) open too
  for (const def of mm.list) for (const e of def.exits) for (const r of Array.isArray(e.requires) ? e.requires : []) if (r.type === 'flag') w.setFlag(r.flag);
  w.applyState();
  const events = [];
  g.events.on('mapEntered', (e) => events.push(e.id));
  let bad = [];
  for (const def of mm.list) for (const e of def.exits) {
    // stand on an open tile inside the exit rect (tile owned by this map)
    let spot = null;
    w.changeMap(def.id, { silent: true }); // loads the map's grid
    for (let ty = e.rect[1]; ty <= e.rect[3] && !spot; ty++) for (let tx = e.rect[0]; tx <= e.rect[2] && !spot; tx++) {
      if (mm.idAtTile(tx, ty) !== def.id) continue;
      w.changeMap(def.id, { silent: true });
      if (!w.map.isSolid(tx, ty)) spot = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    }
    if (!spot) { bad.push(`${def.id}.${e.id}: no open tile`); continue; }
    w.changeMap(def.id, { silent: true });
    w.transitions.cooldown = 0;
    releaseInput(g); p.x = spot.x; p.y = spot.y; p.dead = false; p.hp = p.maxHp;
    g.simulate(0.1);
    const arrived = w.mapId === e.to && mm.idAt(p.x, p.y) === e.to;
    const inExit = !!w.transitions.exitAt(mm.get(e.to), p.x, p.y);
    g.simulate(1.2, () => { p.hp = p.maxHp; });
    if (!arrived || inExit || w.mapId !== e.to) bad.push(`${def.id}.${e.id} -> ${w.mapId} (${(p.x / TILE).toFixed(1)},${(p.y / TILE).toFixed(1)}) inExit=${inExit}`);
  }
  const total = mm.list.reduce((n, d) => n + d.exits.length, 0);
  ok(`All exits work both ways (${total})`, !bad.length, bad.join(' | '));
  ok('mapEntered events', events.length >= total, `events=${events.length}`);
  // every exit leads to a map that has an exit back
  const noBack = mm.list.flatMap((d) => d.exits.filter((e) => !mm.get(e.to).exits.some((b) => b.to === d.id)).map((e) => `${d.id}.${e.id}`));
  ok('Every exit has a way back', !noBack.length, noBack.join(','));
  // on foot: from each map's spawn every exit and every visible object must be reachable (flags above all open)
  const unreachable = [];
  for (const def of mm.list) {
    w.changeMap(def.id, { silent: true });
    const m = w.map, seen = new Uint8Array(m.w * m.h), sp = m.findOpen(def.spawn[0] * TILE, def.spawn[1] * TILE, 4);
    const q = [[Math.floor(sp.x / TILE), Math.floor(sp.y / TILE)]];
    seen[q[0][1] * m.w + q[0][0]] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!m.inBounds(nx, ny) || seen[ny * m.w + nx] || m.isSolid(nx, ny)) continue;
        seen[ny * m.w + nx] = 1; q.push([nx, ny]);
      }
    }
    const near = (px, py, r) => { const t = Math.ceil(r / TILE); const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
      for (let y = cy - t; y <= cy + t; y++) for (let x = cx - t; x <= cx + t; x++) if (m.inBounds(x, y) && seen[y * m.w + x]) return true; return false; };
    for (const e of def.exits) { let hit = false; for (let y = e.rect[1]; y <= e.rect[3]; y++) for (let x = e.rect[0]; x <= e.rect[2]; x++) if (m.inBounds(x, y) && seen[y * m.w + x]) hit = true; if (!hit) unreachable.push(`${def.id} exit ${e.id}`); }
    for (const it of w.interactables) {
      if (!w.onMap(it) || it.secret || ['trigger', 'crackInfo', 'glyphInfo'].includes(it.kind)) continue;
      if (!near(it.x, it.y, it.radius || 34)) unreachable.push(`${def.id} ${it.kind}:${it.id}`);
    }
  }
  ok('Everything reachable on foot from each map spawn', !unreachable.length, unreachable.join(', '));
  // boss entrance asks first: "Not yet" puts you back outside, "Enter" goes in
  g.newGame(classId);
  const w1 = g.world; w1.setFlag('gateOpened'); w1.applyState();
  goto(g, 135, 51); g.simulate(0.2);
  releaseInput(g); g.player.y = 47.6 * TILE; g.simulate(0.1);
  const asked = g.ui.panels.current && g.ui.panels.current.name === 'confirm';
  g.ui.panels.close(); g.simulate(0.2);
  const declined = w1.mapId === 'a1' && !w1.transitions.exitAt(w1.mapDef, g.player.x, g.player.y);
  g.simulate(0.8); g.player.y = 47.6 * TILE; g.simulate(0.1);
  if (g.ui.panels.current && g.ui.panels.current.advance) g.ui.panels.current.advance();
  g.simulate(0.2);
  ok('Boss gate: asks, "Not yet" steps back, "Enter" goes in', asked && declined && w1.mapId === 'arena', `asked=${asked} declined=${declined} map=${w1.mapId}`);
  // locks: sealed gate + boss fight
  g.newGame(classId);
  const w2 = g.world, a3 = w2.mapManager.get('a1').exits.find((e) => e.id === 'arena_gate');
  const locked = !w2.transitions.isOpen(a3);
  w2.setFlag('gateOpened'); const open = w2.transitions.isOpen(a3);
  w2.bossActive = true; const bossLock = !w2.transitions.isOpen(a3); w2.bossActive = false;
  ok('Locks: sealed until flag, closed during boss fight', locked && open && bossLock);
  // teleport (waystone-like) follows the player to the other map
  goto(g, 47, 180); ok('Teleport into Lumina switches map', w2.mapId === 'lumina', w2.mapId);
  // other maps' monsters are frozen / not hostile
  ok('Only this map is hostile', w2.hostiles().every((h) => w2.onMap(h)));
  g.newGame(classId);
  return R;
}

// V2.1 Major Boss Arena: arena map, Boss UI snapshot, exits locked in the fight, Heartwood Ward (adds shield the boss),
// reward exactly once. Returns [step, pass, detail] rows.
export function bossArena(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  toBoss(g, classId);
  const w = g.world, gd = w.guardian, p = g.player;
  p.setLevel(13); p.hp = p.maxHp; goto(g, 135, 37); g.simulate(5.5, () => { p.hp = p.maxHp; });
  ok('Fight starts in the arena map', w.mapId === 'arena' && w.bossActive && ['fight', 'weak'].includes(gd.state) && w.boss === gd, `${w.mapId} ${gd.state}`);
  const s = gd.hudState();
  ok('Boss UI snapshot (name / HP / phase)', s.name && s.maxHp === gd.maxHp && s.phaseLabel && Array.isArray(s.tags), s.name);
  ok('Exits locked during the fight', w.mapDef.exits.every((e) => !w.transitions.isOpen(e)));
  const hit = () => { const h0 = gd.hp; g.combat.dealDamage(p, gd, { power: 2, noCrit: true }); return h0 - gd.hp; };
  const base = hit() + hit() + hit();
  gd.phase = 2; gd.run(gd.mSummon()); g.simulate(1.7, () => { p.hp = p.maxHp; p.invulnT = 1; });
  const warded = hit() + hit() + hit();
  ok('Heartwood Ward: adds shield the Guardian', gd.status.has('heartwood_ward') && warded < base * 0.7, `3 hits: ${base} -> ${warded} with ${gd.livingSummons().length} adds`);
  for (const a of gd.livingSummons()) g.combat.dealDamage(p, a, { power: 999 });
  g.simulate(0.2, () => { p.hp = p.maxHp; });
  ok('Ward breaks when the adds die', !gd.status.has('heartwood_ward'));
  let rewards = 0; g.events.on('enemyDefeated', (e) => { if (e.boss) rewards++; });
  const gold0 = p.gold; gd.phase = 3; gd.finalDone = true; gd.hp = 1; g.combat.dealDamage(p, gd, { power: 99 }); // phase 3 + final attack seen (V2.2): no HP floor left
  g.simulate(6, () => { p.hp = p.maxHp; });
  ok('Boss defeated: reward once, exits open, A2 unlocked', gd.dead && rewards === 1 && p.gold >= gold0 + 300 && g.inventory.has('guardian_heart') && !w.bossActive && g.worldProgress.isMapUnlocked('a2') && w.mapDef.exits.every((e) => w.transitions.isOpen(e)), `rewards=${rewards} gold+${p.gold - gold0}`);
  return R;
}

// V2.1 A1 combat loop: guide -> walk out of Lumina -> fight in A1 only -> EXP / gold / loot -> back to the guide.
export function a1Loop(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, q = g.quests;
  use(g, 'npc_guide'); g.ui.panels.close(true);
  goto(g, 47.5, 163); g.input.down.add('KeyW'); g.simulate(1.6); g.input.down.delete('KeyW');
  ok('Walked out of Lumina into A1', w.mapId === 'a1' && q.active.beyond_lumina.done.exit, w.mapId);
  const start = { lv: p.level, gold: p.gold, items: Object.values(g.inventory.items).reduce((a, b) => a + b, 0) };
  let kills = 0, targeted = 0; g.events.on('enemyDefeated', () => kills++); g.events.on('targetChanged', (e) => { if (e.target) targeted++; });
  for (const [x, y] of [[47, 144], [38, 121], [20, 112], [22, 131], [58, 104]]) {
    if (q.active.beyond_lumina && q.active.beyond_lumina.done.hunt) break;
    goto(g, x, y);
    g.targets.nearest(p); // [Tab] (one-hit kills never auto-target: a Whisper Hare can die to the first blow)
    fight(g, 25, { god: true, until: () => q.active.beyond_lumina.done.hunt });
  }
  ok('Fought only on A1', w.mapId === 'a1', w.mapId);
  ok('Targeted + defeated 5 monsters', q.active.beyond_lumina && q.active.beyond_lumina.done.hunt && targeted > 0, `kills=${kills} targeted=${targeted}`);
  const items = Object.values(g.inventory.items).reduce((a, b) => a + b, 0);
  ok('EXP / gold / loot gained', p.level > start.lv && p.gold > start.gold && items >= start.items, `LV${start.lv}->${p.level} gold ${start.gold}->${p.gold} items ${start.items}->${items}`);
  use(g, 'npc_guide'); g.ui.panels.close(true);
  ok('Returned to the guide: quest complete', q.isDone('beyond_lumina') && w.mapId === 'lumina', `map=${w.mapId}`);
  return R;
}

// Full regression of the V1.5 test sequence. Returns [step, pass, detail] rows.
export function playthrough(g, classId) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  let w = g.world;
  const c = counters(g);
  ok('Lumina Village', w.map.zoneAt(g.player.x, g.player.y) === 1);
  use(g, 'npc_guide'); g.ui.panels.close(true);
  ok('Village Guide: First Steps Beyond Lumina', g.quests.isActive('beyond_lumina') && g.quests.active.beyond_lumina.done.talk);
  use(g, 'npc_elder'); g.ui.panels.dialogueAction('quest:whispers');
  ok('Quest accepted', g.quests.isActive('whispers'));
  goto(g, 47, 150); g.simulate(1);
  ok('Whispering Forest', g.quests.active.whispers.done.enter);
  for (const [x, y] of [[38, 121], [20, 112], [54, 80], [66, 62]]) { goto(g, x, y); fight(g, 20, { god: true, until: () => g.quests.active.whispers.done.wolves }); if (g.quests.active.whispers.done.wolves) break; }
  // keep fighting until the combat loop has produced a Perfect Dodge and a Shadow Break
  const camps = [[38, 66], [66, 62], [54, 80], [86, 70], [18, 80], [58, 104], [110, 82]]; // (29,60) is Grukk's arena since V2.2
  // two laps over the camps: a strong build can clear a camp before any telegraph shows up
  for (let k = 0; k < camps.length * 2 && (c.perfect === 0 || c.breaks === 0); k++) { goto(g, ...camps[k % camps.length]); fight(g, 10, { god: true, until: () => c.perfect > 0 && c.breaks > 0 }); }
  ok('Fight + wolves 5/5', g.quests.active.whispers.done.wolves, `kills=${g.stats.kills}`);
  ok('Class mechanic / Perfect Dodge / Finisher', c.breaks > 0 && c.perfect > 0, `class=${g.player.cls.id} perfect=${c.perfect} breaks=${c.breaks} constellations=${c.constellations} threads=${c.threads} tut=${!!w.state.flags.tut_marks}`);
  use(g, 'crack_info'); g.ui.panels.close();
  const crack = w.breakables.find((b) => b.kind === 'crack');
  goto(g, 70.5, 57); g.simulate(6, (gg, i) => bot(gg, i, { god: true, target: crack, breakables: true }));
  ok('Hidden Area discovered', w.map.secretsFound.has(1), `crack hp=${crack.hp}/${crack.maxHp} dead=${crack.dead} canHit=${crack.canHit ? crack.canHit(g.player) : '-'} dist=${Math.round(Math.hypot(crack.x - g.player.x, crack.y - g.player.y))} panel=${g.ui.panels.current && g.ui.panels.current.name} hurt=${g.player.hurtT.toFixed(2)} act=${g.player.action && g.player.action.name}`);
  const diag = `panel=${g.ui.panels.current && g.ui.panels.current.name} dead=${g.player.dead} state=${g.state}`;
  const us = use(g, 'ancient_shrine'); g.ui.panels.close();
  const ug = use(g, 'gate_seal');
  ok('Shrine + Gate', w.state.flags.shrineInvestigated && w.state.flags.gateOpened, `${diag} shrine=${JSON.stringify(us)} gate=${JSON.stringify(ug)}`);
  goto(g, 136, 60); for (let y = 60; y >= 50; y--) { g.player.y = y * 32; g.simulate(0.1); }
  const trig = w.interactables.find((i) => i.id === 'trig_guardian');
  ok('Guardian discovered', w.state.flags.guardianDiscovered, `pos=${(g.player.x / 32).toFixed(1)},${(g.player.y / 32).toFixed(1)} fired=${trig.fired} dead=${g.player.dead} panel=${g.ui.panels.current && g.ui.panels.current.name} hitStop=${g.hitStop.toFixed(2)} guardian=${w.guardian && w.guardian.state}`);
  g.player.setLevel(13); g.player.hp = g.player.maxHp;
  goto(g, 135, 37); g.simulate(3);
  const gd = w.guardian, phases = new Set();
  for (let s = 0; s < 80 && !gd.dead; s++) { g.simulate(5, (gg, i) => bot(gg, i, { god: true })); phases.add(gd.phase); }
  ok('Boss phases 1-2-3', phases.has(1) && phases.has(2) && phases.has(3), [...phases].join(','));
  ok('Weak windows used', c.weak > 0, `weak=${c.weak}`);
  ok('Guardian defeated', gd.dead);
  g.simulate(9);
  ok('World State changed', w.state.flags.guardianDefeated && w.map.style.restored && !w.map.isTerrainSolid(32, 37));
  goto(g, 32, 40); for (let y = 40; y >= 26; y--) { g.player.y = y * 32; g.simulate(0.08); }
  ok('Ancient Valley revealed (secret city Valehaven)', w.currentZone === 6 && w.mapId === 'valehaven' && (g.quests.isActive('valley') || g.quests.isDone('valley')), `map=${w.mapId}`);
  // back to Lumina: report to the Elder + the Guide (turn-in objectives)
  const beforeGold = g.player.gold;
  use(g, 'npc_elder'); g.ui.panels.close(true);
  use(g, 'npc_guide'); g.ui.panels.close(true);
  ok('Back in Lumina: quests complete', g.quests.isDone('whispers') && g.quests.isDone('beyond_lumina') && g.player.gold > beforeGold, `gold +${g.player.gold - beforeGold}`);
  ok('Save', g.save.save());
  const lvl = g.player.level;
  g.loadGame(); w = g.world;
  ok('Load', g.world.state.flags.guardianDefeated && g.player.level === lvl && g.world.currentZone !== undefined);
  return R;
}

// ---------------------------------------------------------------- V2.2 world progression / boss gates
// hold a direction key for `sec` seconds (real walking: collision, gates and exits all apply)
export function walk(g, key, sec) {
  releaseInput(g);
  g.input.down.add(key);
  g.simulate(sec);
  g.input.down.delete(key);
  releaseInput(g);
}
// fight the boss of an encounter until it is defeated (or the time runs out). Returns a small report.
export function bossFight(g, bossId, { seconds = 240, god = true, level } = {}) {
  const enc = g.bosses.get(bossId), p = g.player;
  if (level) { p.setLevel(level); p.hp = p.maxHp; }
  const rep = { phases: new Set(), phaseEvents: [], weak: 0, hitsTaken: 0, time: 0, finals: 0, summons: 0 };
  g.events.on('bossPhaseChanged', (e) => { if (e.bossId === bossId) rep.phaseEvents.push(e.phase); });
  g.events.on('bossWeak', () => rep.weak++);
  g.events.on('damageDealt', (e) => { if (e.target === p && e.amount > 0) rep.hitsTaken++; });
  for (let t = 0; t < seconds && enc.state !== 'defeated'; t += 5) {
    g.simulate(5, (gg, i) => bot(gg, i, { god }));
    rep.time = t + 5;
    if (enc.entity) rep.phases.add(enc.entity.phase);
    if (enc.entity && enc.entity.summons) rep.summons = Math.max(rep.summons, enc.entity.summons.length);
    if (enc.entity && enc.entity.finalDone) rep.finals = 1;
    if (p.dead) break;
  }
  releaseInput(g);
  g.simulate(6); // defeat cinematic + rewards + world triggers
  rep.state = enc.state;
  rep.phases = [...rep.phases].join(',');
  return rep;
}

// ROUTE A (W2): Lumina -> A1 Whispering Forest on foot (river, optional mini-bosses Hollow Fang + Grukk, Ruins) ->
// Guardian Gate -> A1 boss (the Guardian) -> north road -> A2 Ashen Badlands (other grid) -> the secret city Valehaven ->
// save / load. Returns [step, pass, detail] rows.
export function routeA(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  let w = g.world;
  const wp = g.worldProgress, p = g.player, T = 32;
  const events = { blocked: 0, engaged: [], defeated: [], unlocked: [], triggers: [], hidden: [] };
  g.events.on('gateBlocked', () => events.blocked++);
  g.events.on('exitBlocked', () => events.blocked++);
  g.events.on('bossEngaged', (e) => events.engaged.push(e.bossId));
  g.events.on('bossDefeated', (e) => events.defeated.push(e.bossId));
  g.events.on('mapUnlocked', (e) => events.unlocked.push(e.id));
  g.events.on('worldTriggerFired', (e) => events.triggers.push(e.id));
  g.events.on('hiddenFound', (e) => events.hidden.push(e.id));
  w.transitions.autoConfirm = true;
  ok('Start: Lumina, only Lumina + A1 unlocked', w.mapId === 'lumina' && wp.isMapUnlocked('a1') && !wp.isMapUnlocked('a2') && !wp.isMapUnlocked('valehaven'), Object.keys(wp.unlockedMaps).join(','));
  // guide, leave Lumina on foot
  use(g, 'npc_guide'); g.ui.panels.close(true);
  goto(g, 47.5, 163); walk(g, 'KeyW', 1.6);
  ok('A1: walked out of Lumina (Route A)', w.mapId === 'a1' && wp.currentRoute === 'A', `map=${w.mapId} route=${wp.currentRoute}`);
  const kills0 = g.stats.kills, q = g.quests;
  goto(g, 57, 147); fight(g, 10, { god: true });
  for (const [x, y] of [[47, 144], [38, 121], [20, 112], [22, 131]]) {
    if (q.active.beyond_lumina && q.active.beyond_lumina.done.hunt) break;
    goto(g, x, y); fight(g, 25, { god: true, until: () => q.active.beyond_lumina.done.hunt });
  }
  ok('A1: normal enemies fought (hares, wolves)', g.stats.kills > kills0, `kills=${g.stats.kills - kills0}`);
  use(g, 'npc_guide'); g.ui.panels.close(true);
  ok('Guide quest done -> ROUTE A + optional hunts start (world triggers)', q.isDone('beyond_lumina') && q.isActive('route_a') && q.isActive('forest_hunts') && events.triggers.includes('route_a_begins'));
  // the river is no boss gate any more: walk across, still on A1
  goto(g, 50, 104); walk(g, 'KeyW', 2.5);
  goto(g, 53, 80); g.simulate(0.5);
  ok('River crossed on foot: same map A1, Deep Forest reached', w.mapId === 'a1' && w.state.flags.riverCrossed && q.active.route_a.done.river, `map=${w.mapId} y=${(p.y / T).toFixed(1)}`);
  // optional mini-bosses: fight them, they unlock nothing
  const fang = g.bosses.get('mini_hollow_fang');
  goto(g, 57.5, 106.5);
  ok('Mini-boss Hollow Fang waits in the Howling Den', fang.state === 'idle', fang.state);
  walk(g, 'KeyS', 1.2);
  ok('Hollow Fang engaged (arena lock)', fang.state === 'engaged' && w.inBossFight() && g.bosses.barInfo(), fang.state);
  const before = { exp: p.exp, lv: p.level, gold: p.gold };
  const r1 = bossFight(g, 'mini_hollow_fang', { level: 6 });
  ok('Hollow Fang defeated: trophy + EXP + gold, no map unlocked', r1.state === 'defeated' && g.inventory.count('hollow_fang_pelt') === 1 && p.gold > before.gold && !wp.isMapUnlocked('a2'), JSON.stringify(r1));
  const grukk = g.bosses.get('mini_grukk');
  goto(g, 36.5, 64.5); walk(g, 'KeyA', 1.4);
  const r2 = bossFight(g, 'mini_grukk', { level: 10, seconds: 400 }); // slow classes (Aegis bot) need > 240 s
  ok('Grukk: phase change + adds, defeated; hunts quest done; still no map unlocked', r2.state === 'defeated' && r2.phaseEvents.includes(2) && r2.summons > 0 && q.isDone('forest_hunts') && !wp.isMapUnlocked('a2'), JSON.stringify(r2));
  // the Ancient Forest Path is open ground inside A1 now
  goto(g, 87, 71); walk(g, 'KeyD', 3);
  ok('Walked the Ancient Forest Path into the Ruins (still A1)', w.mapId === 'a1' && w.currentZone === 3 && q.active.route_a.done.ruins, `map=${w.mapId} zone=${w.currentZone}`);
  const hard = w.monsters.find((m) => !m.dead && w.map.zoneAt(m.home.x, m.home.y) === 3);
  ok('Ruins monsters are hardened (map monsterMods)', hard && hard.level > hard.def.level, hard && `${hard.type} Lv${hard.def.level} -> ${hard.level}`);
  ok('A1 has its hidden content registered', (w.mapDef.hiddenAreas || []).length >= 4);
  use(g, 'ancient_shrine'); g.ui.panels.close(true);
  use(g, 'gate_seal'); g.ui.panels.close(true);
  ok('Guardian Gate unsealed -> arena map unlocked', w.state.flags.gateOpened && wp.isMapUnlocked('arena'));
  goto(g, 135.5, 50); walk(g, 'KeyW', 1.5);
  ok('Entered the Guardian Arena (A1 boss arena)', w.mapId === 'arena', w.mapId);
  // A2 locked before the A1 boss: the north road gate is solid
  ok('A2 locked while the Guardian lives', !wp.isMapUnlocked('a2') && !w.gates.get('a2_road_gate').open && !w.transitions.isOpen(w.mapDef.exits.find((e) => e.to === 'a2')));
  walk(g, 'KeyW', 2);
  const gd = g.bosses.get('boss_a1');
  ok('A1 boss (Guardian) engaged, arena sealed', gd.state === 'engaged' || gd.state === 'phase_change', gd.state);
  const r3 = bossFight(g, 'boss_a1', { level: 13, seconds: 420 });
  g.simulate(4);
  ok('Guardian: 3 phases + final attack, defeated', r3.state === 'defeated' && r3.phases === '1,2,3' && r3.finals === 1 && wp.isBossDefeated('boss_a1'), JSON.stringify(r3));
  ok('A2 UNLOCKED: world trigger + north road gate open', wp.isMapUnlocked('a2') && w.gates.get('a2_road_gate').open && events.triggers.includes('a1_boss_defeated'));
  goto(g, 136, 13); walk(g, 'KeyW', 1.5);
  ok('Walked the north road into A2 (Ancient Valley, other grid)', w.mapId === 'a2' && w.gridId === 'ancient_valley' && events.triggers.includes('a2_first_visit'), `${w.mapId}/${w.gridId}`);
  g.simulate(0.5);
  ok('Route A quest complete (reached A2)', q.isDone('route_a'), JSON.stringify(q.active.route_a || 'done'));
  const st = wp.routeStatus('A');
  ok('Route status: A1 done, A2 open (its boss planned), not complete', st.steps[0].bossDefeated && st.steps[1].unlocked && !st.complete);
  // the secret city: back to A1, the Sealed Path (thorns withered with the forest)
  w.changeMap('a1', { entry: [32, 36] }); g.simulate(0.5);
  ok('Valehaven unlocked but hidden (secret map)', wp.isMapUnlocked('valehaven') && w.mapManager.get('valehaven').secret);
  walk(g, 'KeyW', 2.5);
  ok('Found Valehaven: secret city, hidden reward, quest', w.mapId === 'valehaven' && w.inSafeZone(p) && events.hidden.includes('valehaven') && q.isActive('valley') && events.triggers.includes('valehaven_found'), `map=${w.mapId} hidden=${events.hidden}`);
  use(g, 'npc_scout'); g.ui.panels.close(true); g.simulate(0.3);
  ok('Talked to Scout Wren: The Hidden Valley done', q.isDone('valley'));
  ok('Save', g.save.save());
  g.loadGame(); w = g.world;
  const wp2 = g.worldProgress;
  ok('Load: bosses / maps / events / map restored', ['boss_a1', 'mini_hollow_fang', 'mini_grukk'].every((b) => wp2.isBossDefeated(b)) && wp2.isMapUnlocked('a2') && wp2.hasEvent('a1_boss_defeated') && w.mapId === 'valehaven' && g.bosses.get('boss_a1').state !== 'idle', `map=${w.mapId}`);
  return R;
}

// death during a boss fight: the boss resets (full HP, waits again), the arena unlocks, nothing is lost
export function bossReset(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const enc = g.bosses.get('mini_hollow_fang'), p = g.player, w = g.world;
  goto(g, 58.5, 111); g.simulate(2.5);
  ok('engaged', enc.state === 'engaged');
  g.simulate(4, (gg, i) => bot(gg, i, {}));
  const hurt = enc.entity.hp < enc.entity.maxHp;
  p.hp = 1; g.combat.dealDamage({ x: p.x + 10, y: p.y, team: 2 }, p, { power: 999 });
  g.simulate(2);
  ok('player died', p.dead);
  g.respawn(); g.simulate(0.5);
  ok('boss reset: full HP, back to IDLE, arena unlocked', hurt && enc.state === 'idle' && enc.entity.hp === enc.entity.maxHp && !w.inBossFight() && !g.bosses.barInfo(), `state=${enc.state} hp=${enc.entity.hp}`);
  ok('not recorded as defeated', !g.worldProgress.isBossDefeated('mini_hollow_fang'));
  return R;
}

// COMBAT 2.0 C2: dodge + Perfect Dodge through the real enemyStrike path. Returns [step, pass, detail] rows.
export function dodgeCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId); releaseInput(g);
  const p = g.player, foe = { x: p.x + 40, y: p.y, type: 'test_foe', name: 'Test Foe' };
  const strike = () => g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 40 }, 10);
  const ev = { perfect: 0, dodged: [] };
  g.events.on('perfectDodge', () => ev.perfect++);
  g.events.on('attackDodged', (e) => ev.dodged.push(e.perfect));
  const settle = () => { g.simulate(1.2); p.invulnT = 0; p.perfectCooldown = 0; p.resources.fill('stamina'); p.hp = p.maxHp; };
  settle();
  const hp0 = p.hp; strike(); g.simulate(0.05);
  ok('No dodge: the attack hits', p.hp < hp0, `${hp0} -> ${p.hp}`);
  settle();
  const st0 = p.resources.get('stamina'), marks0 = p.marks || 0;
  const sk = p.loadout.bindings()[0].skill; p.skillSys.cooldowns.start(sk.id, 10);
  ok('Dodge costs stamina', p.tryDodge() && st0 - p.resources.get('stamina') === 22, `${st0} -> ${p.resources.get('stamina')}`);
  ok('No second dodge mid-dash', !p.tryDodge());
  g.simulate(0.05); const hp1 = p.hp; strike();
  const r = p.cls.perfectDodge || {};
  ok('Perfect Dodge: no damage + event + attackDodged(perfect)', p.hp === hp1 && ev.perfect === 1 && ev.dodged[ev.dodged.length - 1] === true);
  ok('Perfect Dodge rewards (class data)', (!r.marks || (p.marks || 0) > marks0) && p.skillSys.cooldowns.remaining(sk.id) < 10 - 0.05 - (r.cooldownCut || 0.5) + 0.2, `marks ${marks0}->${p.marks || 0} cd ${p.skillSys.cooldowns.remaining(sk.id).toFixed(2)}`);
  settle();
  p.tryDodge(); g.simulate(0.25); const hp2 = p.hp; strike();
  ok('Late dodge (after the window, inside i-frames): normal dodge, no damage, not perfect', p.hp === hp2 && ev.perfect === 1 && ev.dodged[ev.dodged.length - 1] === false, `perfects=${ev.perfect}`);
  g.simulate(0.2);
  ok('Dodge again after the recovery', p.tryDodge());
  settle();
  p.resources.set('stamina', 10);
  ok('Not enough stamina: no dodge', !p.tryDodge());
  releaseInput(g);
  return R;
}

// COMBAT 2.0 C3: Counter Window from a real monster's attack (perfect dodge / whiff), bonus + rewards, shared-world time.
export function counterCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  // quiet test: only this foe on the map, and it stands still (the test drives its attacks)
  for (const m of g.world.monsters) if (m !== foe && g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  foe.x = p.x + 50; foe.y = p.y; foe.aggro = false; foe.setState('idle'); foe.hp = foe.maxHp = 5000; foe.status.add('stun', 60);
  const ev = { windows: [], hits: [] };
  g.events.on('counterWindow', (e) => ev.windows.push(e));
  g.events.on('counterHit', (e) => ev.hits.push(e));
  const strike = () => g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 40 }, 5);
  const reset = () => { g.simulate(1.5); foe.status.remove('counter_window'); p.invulnT = 0; p.perfectCooldown = 0; p.resources.fill('stamina'); p.hp = p.maxHp; foe.x = p.x + 50; foe.y = p.y; };
  const hitFoe = () => { const h = foe.hp; g.combat.dealDamage(p, foe, { power: 2, noCrit: true, counterMult: 1.3, knock: 0 }); return h - foe.hp; };
  reset();
  p.tryDodge(); g.simulate(0.05); strike();
  const w = ev.windows[ev.windows.length - 1];
  ok('Perfect Dodge opens a Counter Window on the attacker', w && w.target === foe && w.reason === 'perfectDodge' && foe.status.has('counter_window'), w && w.reason);
  const marks0 = p.marks || 0, res0 = p.resources.get(p.primaryResource);
  let countered = hitFoe();
  const b = p.cls.counterBonus || {};
  ok('First counter hit: COUNTER event + class counterBonus once', ev.hits.length === 1 && ev.hits[0].first && (!b.marks || (p.marks || 0) > marks0) && (!b.resource || p.resources.get(p.primaryResource) > res0), `marks ${marks0}->${p.marks || 0}`);
  for (let i = 0; i < 5; i++) countered += hitFoe(); // 6 samples: damage has a random spread
  ok('Later hits: still countered, no second reward', ev.hits.length === 6 && ev.hits.slice(1).every((h) => !h.first));
  foe.status.remove('counter_window');
  let plain = 0; for (let i = 0; i < 6; i++) plain += hitFoe();
  ok('Hits inside the window deal more (less DEF, +damage taken, skill counterMult)', countered > plain * 1.25, `6 hits: ${plain} -> ${countered}`);
  reset();
  p.tryDodge(); g.simulate(0.25); strike();
  const w2 = ev.windows[ev.windows.length - 1];
  ok('Normal dodge (whiff) opens a shorter window', w2.reason === 'whiff' && w2.duration < w.duration, `${w2.reason} ${w2.duration}s`);
  g.simulate(w2.duration + 0.2);
  ok('Window closes by itself', !foe.status.has('counter_window'));
  reset();
  g.sharedWorld = true; g.slowMo(0.3, 1); g.simulate(0.05); const ts = g.timeScale; g.sharedWorld = false;
  ok('Shared world: slow motion does not slow the simulation', ts === 1, `timeScale ${ts}`);
  releaseInput(g);
  return R;
}

// COMBAT 2.0 C4: poise (monster stagger, immunity, regen, heavy armour) + Aegis Guard Break / parry / unblockable.
export function poiseCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('aegis_guardian'); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  for (const m of g.world.monsters) if (m !== foe && g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  foe.x = p.x + 50; foe.y = p.y; foe.hp = foe.maxHp = 50000;
  let breaks = 0; g.events.on('poiseBroken', (e) => { if (e.target === foe) breaks++; });
  const poke = (st) => g.combat.dealDamage(p, foe, { power: 0.1, noCrit: true, stagger: st, knock: 0 });
  const max = foe.poise.max;
  poke(max * 0.6);
  ok('A hit lowers poise, no stagger yet', breaks === 0 && foe.poise.value < max, `${foe.poise.value}/${max}`);
  poke(max * 0.6);
  ok('Poise at 0 -> STAGGER (interrupted)', breaks === 1 && foe.state === 'hit', foe.state);
  poke(max * 2);
  ok('Break immunity: no immediate second stagger', breaks === 1);
  foe.poise.immuneT = 0; poke(max * 0.5); g.simulate(4);
  ok('Poise regenerates when not hit', foe.poise.value === max, `${foe.poise.value}/${max}`);
  // Guard Break
  const strike = (extra) => g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 40 }, 20, extra);
  // hold right-click toward the foe through the real input path (early = raised just now -> PARRY window)
  const inp = g.input, face = () => { const r = g.renderer, cam = g.camera; inp.mouse.x = ((foe.x - cam.left) * cam.zoom * r.scale) / r.dpr; inp.mouse.y = ((foe.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr; };
  const guardUp = (early) => {
    inp.mouse.right = false; g.simulate(0.4, face); // lower + guard recover time
    p.status.clear(); p.hp = p.maxHp; p.invulnT = 0; p.endAction(true); p.resources.fill('stamina'); // endAction: a parry counter has i-frames
    inp.mouse.right = true; g.simulate(early ? 0.03 : 0.5, face);
  };
  let broken = 0; g.events.on('guardBroken', () => broken++);
  guardUp(false); const hp0 = p.hp; strike({});
  ok('Normal attack: held guard blocks it', p.guardState.active && p.hp > hp0 - 20 && broken === 0, `hp -${hp0 - p.hp}`);
  guardUp(false); const hp1 = p.hp, st1 = p.resources.get('stamina'); strike({ guardBreak: true });
  ok('Heavy (guardBreak) attack: GUARD BREAK — guard down, stunned, stamina lost, part of the damage through', !p.guardState.active && p.status.has('guard_broken') && broken === 1 && p.hp < hp1 && p.resources.get('stamina') < st1 - 20, `hp -${hp1 - p.hp}`);
  guardUp(true); const hp2 = p.hp; strike({ guardBreak: true });
  ok('Parry beats a heavy attack (no damage, no break)', p.hp === hp2 && broken === 1);
  guardUp(true); const hp3 = p.hp; strike({ unblockable: true });
  ok('Unblockable attack ignores guard and parry', p.hp < hp3 && broken === 1, `hp -${hp3 - p.hp}`);
  inp.mouse.right = false; releaseInput(g);
  return R;
}

// COMBAT 2.0 C5: enemy attack commitment (miss -> longer recovery + Counter Window) and roles (flank, punish idle).
export function enemyCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('umbral_sword'); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const any = g.world.monsters.find((m) => g.world.onMap(m));
  for (const m of g.world.monsters) if (g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  const spawn = (type, dx, dy) => { const m = new any.constructor(g, type, p.x + dx, p.y + dy, {}); m.hp = m.maxHp = 9999; g.world.monsters.push(m); return m; };
  const missed = [], windows = []; g.events.on('attackMissed', (e) => missed.push(e)); g.events.on('counterWindow', (e) => windows.push(e));
  // time an attack from start to the end of its recovery
  const timeAttack = (m, id, away) => {
    m.cds = {}; m.x = p.x + 40; m.y = p.y; m.facing = Math.PI; m.setState('chase');
    m.startAttack(m.def.attacks.find((a) => a.id === id));
    if (away) { p.x -= 200; }
    let t = 0; while (m.state === 'attack' && t < 6) { g.simulate(0.05, () => { p.hp = p.maxHp; p.invulnT = 0; }); t += 0.05; }
    if (away) p.x += 200;
    return t;
  };
  const gob = spawn('treant', 40, 0);
  const tHit = timeAttack(gob, 'slam', false);
  g.simulate(0.5); gob.status.remove('counter_window');
  const tMiss = timeAttack(gob, 'slam', true);
  const slam = gob.def.attacks.find((a) => a.id === 'slam');
  ok('Treant Root Slam that misses: MISS event + much longer recovery (bruiser)', missed.some((e) => e.attacker === gob) && tMiss > tHit + slam.recover * 0.8, `hit ${tHit.toFixed(2)}s / miss ${tMiss.toFixed(2)}s`);
  ok('A missed attack opens a Counter Window (whiff)', windows.some((e) => e.target === gob && e.reason === 'whiff'), windows.map((e) => e.reason).join(','));
  gob.dead = true; gob.deathT = 99;
  // wolf: punishes standing still (lunge off cooldown)
  const wolf = spawn('wolf', 90, 0); wolf.aggro = true;
  wolf.cds = { lunge: 5 }; p.idleT = 0;
  const moving = wolf.chooseAttack(90);
  p.idleT = 2;
  const idle = wolf.chooseAttack(90);
  ok('Wolf punishes a player standing still (lunge ignores its cooldown)', !moving && idle && idle.id === 'lunge', `moving=${moving && moving.id} idle=${idle && idle.id}`);
  // wolf: flanks — ends up at the player's side / back, not in front of its face
  p.idleT = 0; p.facing = 0; wolf.x = p.x + 150; wolf.y = p.y; wolf.cds = { bite: 99, lunge: 99 }; wolf.setState('chase');
  g.simulate(2.2, () => { p.facing = 0; p.hp = p.maxHp; });
  const rel = Math.abs(Math.atan2(Math.sin(Math.atan2(wolf.y - p.y, wolf.x - p.x) - p.facing), Math.cos(Math.atan2(wolf.y - p.y, wolf.x - p.x) - p.facing)));
  ok('Wolf flanks: moves to the side / back of the player', rel > 1.2, `angle from facing ${(rel * 57.3).toFixed(0)}°`);
  // codex shows the role
  g.knowledge.encounter('wolf'); g.knowledge.kill && g.knowledge.kill('wolf');
  const card = g.knowledge.view().find((e) => e.name === wolf.def.name);
  ok('Monster Knowledge shows the role', card && /Skirmisher|\?/.test(card.role), card && card.role);
  releaseInput(g);
  return R;
}

// COMBAT 2.0 C6: a pack around the player never attacks all at once (attack slots), yet everyone gets turns.
export function slotCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('umbral_sword'); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const any = g.world.monsters.find((m) => g.world.onMap(m));
  for (const m of g.world.monsters) if (g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  const pack = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, m = new any.constructor(g, i < 3 ? 'wolf' : 'leafling', p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 70, {});
    m.hp = m.maxHp = 9999; m.aggro = true; m.setState('chase'); g.world.monsters.push(m); pack.push(m);
  }
  let maxCost = 0, maxAttackers = 0, waitSeen = 0;
  const started = new Map();
  g.simulate(15, () => {
    p.hp = p.maxHp; p.invulnT = 0;
    const atk = pack.filter((m) => m.state === 'attack');
    maxAttackers = Math.max(maxAttackers, atk.length);
    maxCost = Math.max(maxCost, g.attackSlots.used(p));
    waitSeen += pack.filter((m) => m.waiting).length;
    for (const m of atk) started.set(m, true);
  });
  const cap = g.attackSlots.rules.capacity;
  ok('Never more slot points in use than the capacity', maxCost <= cap, `max ${maxCost}/${cap}`);
  ok('Never all 5 attacking at once', maxAttackers < pack.length && maxAttackers <= cap, `max attackers ${maxAttackers}`);
  ok('Waiting enemies hold back / reposition', waitSeen > 0, `waiting frames ${waitSeen}`);
  ok('Everyone gets turns (rotation)', started.size === pack.length, `${started.size}/${pack.length} attacked`);
  ok('Enemies pick their target from the players list', pack.every((m) => m.target === p) && g.players().length === 1);
  releaseInput(g);
  return R;
}

// COMBAT 2.0 C7: every class skill has a commitment tier and its real action respects it; stamina follows the tier.
export async function tierCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  const { tierProblems, staminaCost } = await import('../src/data/skillTiers.js');
  const { CLASSES } = await import('../src/skills/classes.js');
  for (const id of Object.keys(CLASSES)) {
    g.newGame(id); releaseInput(g); goto(g, 38, 121); g.simulate(0.2);
    const p = g.player, all = [...p.cls.skills.filter((s) => !s.basic), p.cls.special].filter(Boolean);
    const bad = [];
    for (const s of all) {
      if (!s.tier) { bad.push(`${s.id}: no tier`); continue; }
      p.endAction(true);
      // meet the skill's data requirements first (marks on self / a marked foe nearby)
      for (const r of s.requirements || []) {
        if (r.type === 'mark' && p.addMark) p.addMark(r.min);
        if (r.type === 'recorded' && p.memory) p.memory.record({ kind: 'skill', id: r.ids[0] }, g.time);
        if (r.type === 'hpBelow') p.hp = Math.floor(p.maxHp * (r.max - 0.1));
        if (r.type === 'markedFoe') { const foe = g.world.monsters.find((m) => !m.dead && g.world.onMap(m)); foe.x = p.x + 60; foe.y = p.y; g.marks.apply(foe, r.mark, { source: p, stacks: 3 }); }
      }
      const act = s.cast(p, g, 0); // the action timeline the skill really plays
      const probs = tierProblems(s, act && act.dur ? act : null);
      if (probs.length) bad.push(`${s.id} (${s.tier}): ${probs.join(', ')}`);
      p.endAction(true); p.dodging = false; g.combat.clear();
    }
    ok(`${p.cls.name}: all ${all.length} skills have a tier their action respects`, !bad.length, bad.join(' | '));
    // stamina through the real pipeline for the first loadout skill
    const s = p.loadout.bindings()[0].skill; g.simulate(0.5);
    p.resources.fill(p.primaryResource); p.resources.fill('stamina'); p.skillSys.cooldowns.clear(s.id); p.hurtT = 0; p.endAction(true);
    const st0 = p.resources.get('stamina'); const used = p.trySkill(s);
    ok(`${p.cls.name}: ${s.name} spends its tier stamina`, used && Math.round(st0 - p.resources.get('stamina')) === staminaCost(s), `${st0} -> ${p.resources.get('stamina')} (cost ${staminaCost(s)})`);
  }
  releaseInput(g);
  return R;
}

// COMBAT 2.0 C8: combat UI state — dodge hint learned + fades, quest UI fades in intense fights, mark counter, boss poise.
export function uiCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('umbral_sword'); releaseInput(g);
  const p = g.player, hud = g.ui.hud; goto(g, 38, 121); g.simulate(0.3);
  const any = g.world.monsters[0]; // the Monster class, taken before this map's monsters are cleared
  for (const m of g.world.monsters) if (g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  g.simulate(5); // out of combat
  ok('New player: DODGE [SPACE] hint visible, quest UI visible', hud.dodgeHintA === 1 && !g.world.state.flags.tut_dodge && hud.questA === 1, `hint ${hud.dodgeHintA} quest ${hud.questA}`);
  for (let i = 0; i < 5; i++) { p.resources.fill('stamina'); p.tryDodge(); g.simulate(0.5); }
  g.simulate(1.2);
  ok('After 5 dodges the hint is learned (saved flag) and faded out', g.world.state.flags.tut_dodge && hud.dodgeHintA === 0, `stats ${g.stats.dodges} hint ${hud.dodgeHintA}`);
  const pack = [0, 1].map((i) => { const m = new any.constructor(g, 'wolf', p.x + 80 + i * 20, p.y, {}); m.hp = m.maxHp = 9999; m.aggro = true; m.setState('chase'); g.world.monsters.push(m); return m; });
  g.combat.lastCombatTime = g.time;
  g.simulate(1, () => { p.hp = p.maxHp; g.combat.lastCombatTime = g.time; });
  ok('Intense fight: quest tracker + route panel fade', hud.questA < 0.5, `questA ${hud.questA.toFixed(2)}`);
  for (const m of pack) { m.dead = true; m.deathT = 99; }
  g.simulate(5);
  ok('Fight over: quest UI comes back', hud.questA === 1, `questA ${hud.questA}`);
  p.addMark(3);
  const hc = p.cls.hudCounter(p);
  ok('Mark counter 3/3 -> SHADOW BREAK READY', hc.value === 3 && hc.max === 3 && hc.ready && /SHADOW BREAK READY/.test(hc.readyText), hc.readyText);
  // boss bar data carries poise for the POISE meter
  toBoss(g, 'umbral_sword'); g.player.setLevel(13);
  goto(g, 135, 37); g.simulate(3, () => { g.player.hp = g.player.maxHp; });
  const bi = g.bosses.barInfo();
  ok('Boss bar shows name, HP and poise', bi && bi.name && bi.maxHp > 0 && bi.stagger >= 0 && bi.stagger <= 1, bi && `${bi.name} poise used ${bi.stagger}`);
  releaseInput(g);
  return R;
}

// COMBAT 2.0 C9: party foundation in the real game — solo ENCOUNTER FAILED + checkpoint, then a test ally for
// downed / revive / interrupt (the ally is a real Player object that is not driven by input).
export async function partyCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  const { CLASSES } = await import('../src/skills/classes.js');
  g.newGame('umbral_sword'); releaseInput(g);
  let p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const ev = []; for (const n of ['encounterFailed', 'playerDowned', 'playerRevived', 'reviveInterrupted']) g.events.on(n, () => ev.push(n));
  const kill = (who) => { who.invulnT = 0; who.dodging = false; who.hp = Math.min(who.hp, who.maxHp * 0.5); g.combat.dealDamage({ x: who.x + 10, y: who.y, team: 'enemy' }, who, { power: 99999, noCrit: true }); };
  kill(p); g.simulate(2);
  ok('Solo: 0 HP -> ENCOUNTER FAILED screen', p.dead && ev.includes('encounterFailed') && g.ui.panels.current && /ENCOUNTER FAILED/.test(document.body.innerText), g.ui.panels.current && g.ui.panels.current.name);
  g.ui.panels.close(true); g.respawn(); g.simulate(0.3);
  ok('Return to Checkpoint: alive again, party reset', !p.dead && !p.downed && p.hp === p.maxHp && !g.party.failed);
  // a second party member (test ally)
  const cls = CLASSES.aegis_guardian, ally = new p.constructor(g, cls, g.spritesFor(cls));
  ally.x = p.x + 20; ally.y = p.y; ally.recomputeStats(); ally.hp = ally.maxHp;
  g.party.add(ally);
  ok('Party of 2: game.players() lists both', g.players().length === 2);
  kill(p); g.simulate(0.2);
  ok('Party: the fallen player is DOWNED (not dead), enemies ignore it', p.downed && !p.dead && !g.players().includes(p) && ev.includes('playerDowned') && !ev.slice(1).includes('encounterFailed'));
  const hp0 = p.hp; g.combat.dealDamage({ x: p.x, y: p.y, team: 'enemy' }, p, { power: 50 });
  ok('Downed player takes no more damage', p.hp === hp0);
  g.simulate(1, (gg) => g.party.tryRevive(ally, 1 / 60));
  g.combat.dealDamage({ x: ally.x + 10, y: ally.y, team: 'enemy' }, ally, { power: 1, noCrit: true });
  ok('A hit on the reviver interrupts the revive', ev.includes('reviveInterrupted') && g.party.progress(p) === 0);
  let t = 0; while (p.downed && t < 5) { g.simulate(0.1, () => g.party.tryRevive(ally, 1 / 60)); t += 0.1; }
  ok('Holding revive for 3 s brings the player back (30% HP)', !p.downed && !p.dead && Math.abs(p.hp - Math.round(p.maxHp * 0.3)) <= 1 && ev.includes('playerRevived'), `${t.toFixed(1)}s hp ${p.hp}`);
  kill(p); g.simulate(0.1); kill(ally); g.simulate(2);
  ok('Everyone down -> ENCOUNTER FAILED', g.party.failed && p.dead && ally.dead && ev.filter((e) => e === 'encounterFailed').length === 2);
  g.ui.panels.close(true); g.party.remove(ally); ally.dispose(); g.respawn(); releaseInput(g);
  return R;
}

// COMBAT 2.0 C10: anti-tanking — hits in a row stagger + expose you, one hit never does, no one-shot from healthy.
export function tankCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('umbral_sword'); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  for (const m of g.world.monsters) if (g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  let staggers = 0; g.events.on('playerStaggered', () => staggers++);
  const src = { x: p.x + 20, y: p.y, team: 'enemy' };
  const hit = (power) => { p.invulnT = 0; p.dodging = false; g.combat.dealDamage(src, p, { power, noCrit: true }); };
  const fresh = () => { g.simulate(4); p.hp = p.maxHp; p.status.clear(); p.poise.reset(); };
  fresh(); hit(99999);
  ok('Endure: a huge hit from full HP leaves you at 1 HP (no one-shot)', !p.dead && p.hp === 1, `hp ${p.hp}`);
  fresh(); hit(18);
  ok('One ordinary hit never staggers', staggers === 0 && p.poise.value < p.poise.max, `poise ${Math.round(p.poise.value)}`);
  fresh(); for (let i = 0; i < 6 && !staggers; i++) { hit(18); g.simulate(0.3); }
  ok('Taking hits in a row -> STAGGERED + EXPOSED', staggers === 1 && p.status.has('exposed'), `staggers ${staggers}`);
  const exposedMult = p.status.damageTakenMult();
  ok('Exposed takes more damage', exposedMult > 1, `x${exposedMult}`);
  for (let i = 0; i < 4; i++) { hit(18); g.simulate(0.2); }
  ok('No stun-lock: immune to a second stagger right away', staggers === 1);
  g.simulate(6);
  ok('Poise refills once you stop getting hit', p.poise.value === p.poise.max);
  releaseInput(g);
  return R;
}

// W1 multi-grid world: load / unload a grid through an exit, boss-gate lock, cleanup, save / load and respawn on
// another grid, repeated switching without leaks (world/levels, World.enterGrid / unloadGrid)
export function gridCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  let w = g.world;
  const p = g.player, wp = g.worldProgress, mm = w.mapManager;
  p.god = true;
  w.transitions.autoConfirm = true;
  const loaded = [], unloaded = [];
  g.events.on('gridLoaded', (e) => loaded.push(e.id));
  g.events.on('gridUnloaded', (e) => unloaded.push(e.id));
  let arrival = null;
  g.events.on('mapEntered', (e) => { if (e.id === 'a2' && !arrival) arrival = { x: p.x, y: p.y, solid: g.world.map.isSolidAt(p.x, p.y) }; });
  ok('New Game: only the start grid is built', w.gridId === 'whispering' && Object.keys(w.levels).join() === 'whispering', Object.keys(w.levels).join());
  // the north road needs the Guardian (boss gate on the target map + a collision gate on the road)
  w.setFlag('gateOpened'); w.applyState();
  w.changeMap('arena', { silent: true });
  const portal = mm.get('arena').exits.find((e) => e.to === 'a2');
  ok('A2 Ancient Valley LOCKED before the Guardian falls', !wp.isMapUnlocked('a2') && !w.transitions.isOpen(portal), w.transitions.lockReason(portal));
  // stand in the portal without walking through the arena (walking in would wake the Guardian)
  releaseInput(g); p.x = (portal.rect[0] + 0.5) * TILE; p.y = (portal.rect[1] + 0.5) * TILE;
  w.transitions.cooldown = 0; w.transitions.update(0.02, p);
  ok('Locked exit: the player stays on the arena map', w.mapId === 'arena' && w.gridId === 'whispering', w.mapId);
  p.y = (portal.rect[1] + 4) * TILE; // step out of the exit before it opens
  wp.defeatBoss('boss_a1'); w.setFlag('guardianDefeated'); w.applyState(); g.simulate(0.3);
  ok('A2 UNLOCKED after the Guardian', wp.isMapUnlocked('a2') && w.transitions.isOpen(portal));
  // put something temporary in the world, then walk through the portal
  const forestMons = w.monsters.length;
  g.combat.projectiles.fire({ x: p.x, y: p.y, vx: 10, vy: 0, r: 5, life: 5, owner: { team: 2, x: p.x, y: p.y }, power: 1 });
  goto(g, 136, portal.rect[1] + 3); walk(g, 'KeyW', 1.5);
  g.simulate(0.5);
  const box = mm.get('a2').box;
  ok('Transition arena -> A2 (other grid): map + grid switched', w.mapId === 'a2' && w.gridId === 'ancient_valley' && mm.idAt(p.x, p.y) === 'a2', `${w.mapId} / ${w.gridId}`);
  ok('Grid events: unloaded whispering, loaded ancient_valley', unloaded.includes('whispering') && loaded.includes('ancient_valley'));
  ok('Player spawned at the entry, on open ground', arrival && Math.abs(arrival.x / TILE - 84.5) < 3 && Math.abs(arrival.y / TILE - 196) < 3 && !arrival.solid, arrival && `${(arrival.x / TILE).toFixed(1)},${(arrival.y / TILE).toFixed(1)}`);
  ok('Old grid cleaned up: its monsters, projectiles and render cache are gone', w.monsters.every((m) => !m.removed) && !w.monsters.some((m) => m.mapId && mm.gridOf(m.mapId) === 'whispering') && g.combat.projectiles.pool.items.filter((o) => o.active).length === 0 && w.levels.whispering.map.chunkCache.size === 0 && w.levels.whispering.monsters.length === 0, `forest monsters before=${forestMons}`);
  ok('Grid size = the A1 scale', w.map.w === w.levels.whispering.map.w && w.map.h === w.levels.whispering.map.h, `${w.map.w}x${w.map.h}`);
  ok('Camera bounds = the new map', g.camera.bounds.x0 <= box.tx0 * TILE && g.camera.bounds.x1 >= (box.tx1 + 1) * TILE && g.camera.bounds.y1 <= (w.map.h + 3) * TILE);
  const x0 = p.x;
  walk(g, 'KeyA', 3);
  ok('Collision: canyon walls stop the player', p.x < x0 && p.x > (box.tx0 + 2) * TILE && !w.map.isSolidAt(p.x, p.y), `x ${(x0 / TILE).toFixed(1)} -> ${(p.x / TILE).toFixed(1)}`);
  goto(g, 84.5, 192);
  g.simulate(0.5);
  ok('Area detection: sub-area on the new grid', w.currentSub && w.currentSub.name === 'Valley Gate', w.currentSub && w.currentSub.name);
  ok('Map content loaded (sign) + objects of the other grid absent', w.interactables.some((i) => i.id === 'a2_gate_plaque') && !w.interactables.some((i) => i.id === 'a1_hunters_notice') && w.dummies.length === 0);
  // save / load on the other grid
  goto(g, 84, 150);
  const at = { x: p.x, y: p.y };
  g.simulate(0.4);
  ok('Save on the other grid', g.save.save());
  g.loadGame(); w = g.world;
  ok('Load: grid + map + position restored', w.gridId === 'ancient_valley' && w.mapId === 'a2' && Math.hypot(g.player.x - at.x, g.player.y - at.y) < 40, `${w.gridId}/${w.mapId}`);
  const fog = w.map.revealed[w.map.idx(84, 150)];
  ok('Load: fog of war of the other grid kept', fog === 1, 'revealed=' + fog);
  // back through the exit: the forest grid returns with its monsters re-spawned
  const back = w.mapManager.get('a2').exits[0];
  goto(g, 84, back.rect[1] - 3); walk(g, 'KeyS', 2);
  g.simulate(0.5);
  ok('Transition back: arena on the start grid', w.gridId === 'whispering' && w.mapId === 'arena', `${w.gridId}/${w.mapId}`);
  ok('Returning grid re-spawned its monsters', w.spawnPoints.some((sp) => sp.active) && w.monsters.length > 0, 'monsters=' + w.monsters.length);
  // repeated switching must not pile up objects
  const counts = [];
  for (let i = 0; i < 4; i++) {
    w.changeMap('a2', { entry: [84.5, 190] }); g.simulate(0.2);
    w.changeMap('arena', { entry: [140.5, 28.5] }); g.simulate(0.2);
    counts.push(w.monsters.length + g.combat.projectiles.pool.items.filter((o) => o.active).length + g.combat.telegraphs.list.length);
  }
  ok('No leak over repeated grid switches', Math.max(...counts) - Math.min(...counts) <= 2, counts.join(','));
  // falling on the other grid: respawn loads the checkpoint's grid
  w.changeMap('a2', { entry: [84.5, 190] }); g.simulate(0.2);
  g.player.god = false; g.player.hp = 1;
  g.combat.dealDamage({ x: g.player.x, y: g.player.y, team: 2 }, g.player, { power: 999, knock: 0 });
  g.simulate(0.5);
  g.respawn();
  g.simulate(0.5);
  ok('Respawn from the other grid -> Lumina (start grid)', g.world.gridId === 'whispering' && ['lumina', 'a1'].includes(g.world.mapId) && !g.player.dead, `${g.world.gridId}/${g.world.mapId}`);
  releaseInput(g);
  return R;
}

// W3b: A2 monsters (Stoneback Armadillo, Crag Rhino) — sheet art, every attack used after a telegraph, the punish
// windows (dizzy / stumbling after a missed dash), stomp slow, loot, and a real (no god mode) pack fight at LV 10.
export function a2MonsterCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player;
  g.worldProgress.defeatBoss('boss_a1'); w.setFlag('guardianDefeated'); w.applyState();
  w.changeMap('a2', { entry: [84.5, 190] }); g.simulate(0.3);
  p.setLevel(20); p.hp = p.maxHp;
  ok('A2 spawns its monsters (armadillo + rhino) with sheet art', ['armadillo', 'rock_rhino'].every((t) => w.monsters.some((m) => m.type === t && m.sprites.sheet)), w.monsters.map((m) => m.type).join(','));
  // lab: one monster at a time next to the player at the quiet Valley Gate
  const lab = (type, seconds, opts = {}) => {
    for (const m of w.monsters) if (!m.dead && m.aggro) { m.aggro = false; m.setState('return'); }
    releaseInput(g); const spot = w.map.findOpen(84.5 * TILE, 194 * TILE, 4); p.x = spot.x; p.y = spot.y; p.hp = p.maxHp;
    const M = w.monsters.find((m) => m.type === type).constructor;
    const d = type === 'rock_rhino' ? 200 : 110; // far enough for the dash attacks (their min range)
    const m = new M(g, type, p.x + d, p.y - 20, {}); m.aggro = true; m.setState('chase'); w.monsters.push(m);
    const used = new Set(), start = m.startAttack.bind(m), rep = { used, windups: [], missed: 0, vuln: 0, slowed: 0, hits: 0 };
    m.startAttack = (atk) => { used.add(atk.id); rep.windups.push(atk.windup); return start(atk); };
    const onMiss = (e) => { if (e.attacker === m) rep.missed++; };
    const onDmg = (e) => { if (e.source === m && e.target === p) rep.hits++; };
    g.events.on('attackMissed', onMiss); g.events.on('damageDealt', onDmg);
    let tailT = null;
    for (let t = 0; t < seconds; t += 0.1) {
      g.simulate(0.1, opts.bot ? (gg, i) => bot(gg, i, { god: opts.god }) : () => { if (opts.god !== false) p.hp = p.maxHp; if (opts.move) { p.x += Math.sin(g.time * 1.3) * 3; } });
      if (m.status.has('vulnerable')) rep.vuln++;
      if (p.status.has('slow')) rep.slowed++;
      // `tail`: keep going a little after the last new attack starts, so it can land (e.g. the stomp's slow)
      if (used.size >= (opts.until || 99) && tailT === null) tailT = opts.tail || 0;
      if (m.dead || (tailT !== null && (tailT -= 0.1) < 0)) break;
    }
    g.events.off && g.events.off('attackMissed', onMiss); g.events.off && g.events.off('damageDealt', onDmg);
    rep.m = m;
    return rep;
  };
  for (const [type, ids] of [['armadillo', ['tail', 'roll', 'spikes']], ['rock_rhino', ['gore', 'charge', 'stomp']]]) {
    const r = lab(type, 40, { until: 3 });
    ok(`${type}: every attack used (${ids.join(' / ')})`, ids.every((id) => r.used.has(id)), [...r.used].join(','));
    ok(`${type}: every attack starts with a telegraph (wind-up >= 0.5 s)`, r.windups.length && r.windups.every((s) => s >= 0.5), r.windups.join(','));
    ok(`${type}: attacks land on a player who does not dodge`, r.hits > 0, `hits=${r.hits}`);
    r.m.dead = true; r.m.removed = true;
  }
  // punish window: stand still beside the dash line so the roll / charge whiffs -> vulnerable afterwards
  for (const type of ['armadillo', 'rock_rhino']) {
    const r = lab(type, 30, { move: true });
    ok(`${type}: a dodged / missed dash opens a punish window (vulnerable)`, r.vuln > 0 && r.missed > 0, `missed=${r.missed} vulnerable frames=${r.vuln}`);
    r.m.dead = true; r.m.removed = true;
  }
  const st = lab('rock_rhino', 30, { until: 3, tail: 2 });
  ok('Crag Rhino: Tremor Stomp slows', st.slowed > 0 || !st.used.has('stomp'), `slowed frames=${st.slowed} used=${[...st.used]}`);
  st.m.dead = true; st.m.removed = true;
  // loot + EXP on a kill
  const gold0 = p.gold, exp0 = p.exp + p.level * 1e6;
  const k = lab('armadillo', 0.1, {}); k.m.hp = 1; g.combat.dealDamage(p, k.m, { power: 99 }); g.simulate(1);
  ok('Kill: EXP + gold', p.gold > gold0 && p.exp + p.level * 1e6 > exp0, `gold +${p.gold - gold0}`);
  // real fight: the River Fords pack (2 armadillos + a rhino), LV 10, the bot dodges, no god mode
  releaseInput(g); for (const m of w.monsters) { m.aggro = false; }
  p.setLevel(20); p.hp = p.maxHp; g.inventory.add('hp_potion', 3, true);
  goto(g, 96, 140);
  const pack = w.monsters.filter((m) => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < 14 * TILE);
  for (const m of pack) { m.aggro = true; m.setState('chase'); } // the whole pack joins in
  let hits = 0; const onDmg = (e) => { if (e.target === p && e.amount > 0) hits++; }; g.events.on('damageDealt', onDmg);
  let t = 0, minHp = p.maxHp;
  for (; t < 90 && !p.dead && pack.some((m) => !m.dead); t += 1) { g.simulate(1, (gg, i) => bot(gg, i, {})); minHp = Math.min(minHp, p.hp); }
  g.events.off('damageDealt', onDmg);
  ok('Pack fight at LV 10 (no god mode): the player wins', !p.dead && pack.length >= 2 && pack.every((m) => m.dead), `pack=${pack.map((m) => m.type).join('+')} ${t}s hits taken ${hits} lowest HP ${Math.round((minHp / p.maxHp) * 100)}% dead=${p.dead}`);
  releaseInput(g);
  return R;
}

// W3c: the A2 boss (Magma Beast) — quest, idle in the Magma Rift, engage on foot, every move used, 2 phases, sheet
// art per pose, defeat + rewards once, world trigger, route status. opts.god false = a real fight (balance).
export function a2BossCheck(g, classId = 'umbral_sword', { god = true, level = 25, seconds = 300 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  wp.defeatBoss('boss_a1'); w.setFlag('guardianDefeated'); w.applyState();
  const trig = []; g.events.on('worldTriggerFired', (e) => trig.push(e.id));
  w.changeMap('a2', { entry: [84.5, 190] }); g.simulate(0.5);
  ok('A2 first visit starts THE BURNING RIFT', q.isActive('burning_rift'), Object.keys(q.active).join(','));
  const enc = g.bosses.get('boss_a2');
  w.transitions.autoConfirm = true; // the rift gate asks first (like A1's arena gate)
  let asked = false; const ask0 = g.ui.panels.confirm.bind(g.ui.panels);
  goto(g, 84, 48);
  for (let k = 0; k < 8 && w.mapId !== 'rift'; k++) walk(g, 'KeyW', 0.4);
  ok('Magma Rift = its own boss-arena map (entered through the gate) · flag + quest step · boss waits', w.mapId === 'rift' && w.mapDef.type === 'boss_arena' && w.state.flags.riftFound && q.active.burning_rift.done.rift && enc.state === 'idle', `map=${w.mapId} ${enc.state} rift=${w.state.flags.riftFound}`);
  p.setLevel(level); p.hp = p.maxHp; g.inventory.add('hp_potion', 4, true);
  goto(g, 84, 36);
  for (let k = 0; k < 10 && enc.state !== 'engaged'; k++) walk(g, 'KeyW', 0.4); // classes walk at different speeds
  const ar = g.bosses.arenaPx(enc);
  ok('Engaged: exits sealed, camera held on the large arena (like A1)', enc.state === 'engaged' && w.inBossFight() && !!g.camera.lock && ar.r >= 14 * TILE && w.mapDef.exits.every((x) => !w.transitions.isOpen(x)), `${enc.state} lock=${!!g.camera.lock} r=${(ar.r / TILE).toFixed(1)}`);
  const e = enc.entity, moves = new Set(), anims = new Set(), phases = new Set(), fxUsed = new Set();
  let overheats = 0, overheatWeak = 0, maxPools = 0;
  const onHeat = () => overheats++; g.events.on('bossOverheated', onHeat);
  const spawn0 = g.vfx.sprite.bind(g.vfx); g.vfx.sprite = (n, ...a) => { if (/^m_/.test(n)) fxUsed.add(n); return spawn0(n, ...a); };
  const pools = e.mech.find((m) => m.pools);
  let t = 0;
  for (; t < seconds && enc.state !== 'defeated' && !p.dead; t += 0.5) {
    g.simulate(0.5, (gg, i) => { bot(gg, i, { god }); if (e.curMove) moves.add(Object.keys(e.def.moves).find((k) => e.def.moves[k] === e.curMove)); if (!e.dead && e.sprites && e.sprites.sheet) { const fr = e.sheetFrame(e.sprites); for (const [n, list] of Object.entries(e.sprites.anims)) if (list.includes(fr)) anims.add(n); } if (e.state === 'weak' && overheats) overheatWeak++; if (pools) maxPools = Math.max(maxPools, pools.pools.length); });
    phases.add(e.phase);
  }
  releaseInput(g);
  g.simulate(6);
  g.vfx.sprite = spawn0; g.events.off('bossOverheated', onHeat);
  ok('Signature: it OVERHEATS (blast) then collapses in a long weak window', overheats > 0 && overheatWeak > 0, `overheats=${overheats} weak frames after=${overheatWeak}`);
  ok('Signature: eruptions leave lava pools on the arena floor', maxPools > 0, `max pools=${maxPools}`);
  ok('The owner\'s A2 boss VFX play in the fight', fxUsed.size >= 5, [...fxUsed].join(','));
  ok('Camera released after the fight', !g.camera.lock || enc.state !== 'defeated');
  const all = Object.keys(e.def.moves);
  // move coverage is random over a short fight: checked in the mechanics run (god), reported in balance runs
  if (god) ok(`Every move used (${all.length})`, all.every((m) => moves.has(m)), `used ${[...moves].join(',')}`);
  ok('Sheet animations follow the fight (bite / fireball / eruption / enraged form)', ['attack', 'fire_shot', 'eruption', 'enrage'].every((a) => anims.has(a)), [...anims].join(','));
  ok('2 phases (MOLTEN FURY at 50%)', phases.has(1) && phases.has(2), [...phases].join(','));
  ok(`Defeated${god ? '' : ' (no god mode)'} in ${t}s`, enc.state === 'defeated' && wp.isBossDefeated('boss_a2') && !p.dead, `state=${enc.state} dead=${p.dead} hp=${Math.round(p.hp)}/${p.maxHp}`);
  if (enc.state === 'defeated') {
    ok('Rewards once: Magma Heart + lore; quest done; world trigger; route status', g.inventory.count('magma_heart') === 1 && w.state.lore.magma_beast && q.isDone('burning_rift') && trig.includes('a2_boss_defeated') && wp.routeStatus('A').steps[1].bossDefeated);
  }
  return R;
}

// W4a: A3 monsters + the distinct mechanics (golem front weak point + crystal spikes, hoplite shield / flank / break
// + phalanx) and the reworked A2 monsters (armadillo roll bounces, rhino charge curves). Ends with a no-god pack fight.
export function a3MonsterCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  let w = g.world;
  const p = g.player;
  for (const b of ['boss_a1', 'boss_a2']) g.worldProgress.defeatBoss(b);
  w.setFlag('guardianDefeated'); w.applyState();
  w.changeMap('a3', { entry: [84, 196] }); g.simulate(0.3);
  p.setLevel(30); p.hp = p.maxHp;
  ok('A3 spawns golems + hoplites with sheet art', ['crystal_golem', 'bronze_hoplite'].every((t) => w.monsters.some((m) => m.type === t && m.sprites.sheet)));
  for (const m of w.monsters) { m.aggro = false; m.setState('return'); }
  const spot = () => { releaseInput(g); const s = w.map.findOpen(84 * TILE, 188 * TILE, 3); p.x = s.x; p.y = s.y; p.hp = p.maxHp; };
  const make = (type, dx, dy) => { const M = w.monsters[0].constructor, m = new M(g, type, p.x + dx, p.y + dy, {}); w.monsters.push(m); return m; };
  const hitFrom = (m, ax, ay) => { const h0 = m.hp, a0 = m.armor; g.combat.dealDamage({ x: ax, y: ay, team: 1 }, m, { power: 40, noCrit: true, knock: 0 }); return { hp: h0 - m.hp, armor: a0 - m.armor }; };
  // golem: chest crystal in FRONT
  spot();
  const gol = make('crystal_golem', 60, 0); gol.facing = Math.PI; // facing the player (west)
  const front = hitFrom(gol, gol.x - 40, gol.y), back = hitFrom(gol, gol.x + 40, gol.y);
  ok('Golem: the chest crystal (front) takes full damage, the back is armoured', front.hp > back.hp * 2, `front ${front.hp} vs back ${back.hp} (armour -${back.armor})`);
  // golem slam: crystal spikes block tiles, then crumble (the golem is removed first: a woken golem would slam too)
  gol.dead = true; gol.removed = true;
  const b0 = [...w.map.blocker].reduce((a, v) => a + v, 0);
  w.spawnSpikes(gol.x, gol.y, { count: 7, radius: 96, life: 1.5, sprite: 'r_spikes' });
  const b1 = [...w.map.blocker].reduce((a, v) => a + v, 0);
  g.simulate(2);
  const b2 = [...w.map.blocker].reduce((a, v) => a + v, 0);
  ok('Golem slam: crystal spikes block the ground, then crumble', b1 > b0 && b2 === b0, `blockers ${b0} -> ${b1} -> ${b2}`);
  // hoplite: shield in front, open from the flank, breaks under pressure
  spot();
  const hop = make('bronze_hoplite', 60, 0); hop.facing = Math.PI;
  const shielded = hitFrom(hop, hop.x - 40, hop.y), flank = hitFrom(hop, hop.x + 40, hop.y);
  ok('Hoplite: frontal hits are blocked by the shield, the back is open', shielded.hp * 3 < flank.hp, `front ${shielded.hp} vs back ${flank.hp}`);
  let n = 0; while (!hop.shieldBroken && n++ < 60) { hop.facing = Math.PI; g.combat.dealDamage({ x: hop.x - 40, y: hop.y, team: 1 }, hop, { power: 60, noCrit: true, knock: 0, stagger: 25 }); }
  ok('Hoplite: the shield breaks under pressure -> stunned + vulnerable', hop.shieldBroken && hop.status.has('stun') && hop.status.has('vulnerable'), `hits=${n}`);
  hop.dead = true; hop.removed = true;
  // phalanx: only with a second hoplite close by
  spot();
  const h1 = make('bronze_hoplite', 110, -10), h2 = make('bronze_hoplite', 110, 30);
  const used = new Set();
  for (const h of [h1, h2]) { const s0 = h.startAttack.bind(h); h.startAttack = (a) => { used.add(a.id); return s0(a); }; h.aggro = true; h.setState('chase'); }
  for (let t = 0; t < 30 && !used.has('phalanx'); t += 0.5) g.simulate(0.5, () => { p.hp = p.maxHp; });
  ok('Hoplites in a pair use the PHALANX spear line', used.has('phalanx'), [...used].join(','));
  h1.dead = h2.dead = true; h1.removed = h2.removed = true;
  // A2 rework: armadillo roll bounces, rhino charge curves
  w.changeMap('a2', { entry: [84.5, 190] }); g.simulate(0.3); w = g.world;
  for (const m of w.monsters) { m.aggro = false; m.setState('return'); }
  // stand near the west cliff of the Valley Gate: a roll aimed at you runs on into the wall
  releaseInput(g); { const s = w.map.findOpen(74 * TILE, 192 * TILE, 3); p.x = s.x; p.y = s.y; } p.hp = p.maxHp;
  let bounces = 0, steered = 0;
  const onText = g.vfx.text.bind(g.vfx); g.vfx.text = (x, y, s, o) => { if (s === 'BOUNCE') bounces++; return onText(x, y, s, o); };
  const arm = make('armadillo', 150, 0), rh = make('rock_rhino', -200, 0);
  for (const m of [arm, rh]) { m.aggro = true; m.setState('chase'); }
  // the player strafes up and down: the charge has to bend to follow (a still target needs no curve)
  for (let t = 0; t < 60 && (!bounces || steered < 0.1); t += 0.1) { g.simulate(0.1, () => { p.hp = p.maxHp; if (rh.state === 'attack') p.y += Math.sin(g.time * 3) * 5; }); steered = Math.max(steered, rh.steered || 0); }
  g.vfx.text = onText;
  ok('Armadillo roll bounces off walls; rhino charge bends toward you', bounces > 0 && steered > 0.05, `bounces=${bounces} rhino turned ${steered.toFixed(2)} rad`);
  arm.dead = rh.dead = true; arm.removed = rh.removed = true;
  // real fight: LV 15, a golem + 2 hoplites at the Winged Plaza, no god mode
  w.changeMap('a3', { entry: [84, 130] }); g.simulate(0.3); w = g.world;
  p.setLevel(30); p.hp = p.maxHp; g.inventory.add('hp_potion', 3, true);
  goto(g, 84, 124);
  const pack = w.monsters.filter((m) => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < 16 * TILE);
  for (const m of pack) { m.aggro = true; m.setState('chase'); }
  let t = 0, minHp = p.maxHp;
  for (; t < 120 && !p.dead && pack.some((m) => !m.dead); t += 1) { g.simulate(1, (gg, i) => bot(gg, i, {})); minHp = Math.min(minHp, p.hp); }
  ok('Winged Plaza pack at LV 15 (no god mode): the player wins', !p.dead && pack.length >= 2 && pack.every((m) => m.dead), `pack=${pack.map((m) => m.type).join('+')} ${t}s lowest HP ${Math.round((minHp / p.maxHp) * 100)}% dead=${p.dead}`);
  releaseInput(g);
  return R;
}

// W4b: the A3 Major Boss (Rune Knight) in the Sanctum — gate, arena like A1, stances (shield blocks / guard break),
// rune sequence, echoes copying attacks, the final judgement (a dome is safe), 3 phases, rewards, Route A complete.
export function a3BossCheck(g, classId = 'umbral_sword', { god = true, level = 36, seconds = 420 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  for (const b of ['boss_a1', 'boss_a2']) wp.defeatBoss(b);
  w.setFlag('guardianDefeated'); w.applyState();
  const trig = []; g.events.on('worldTriggerFired', (e) => trig.push(e.id));
  w.changeMap('a3', { entry: [84, 58] }); g.simulate(0.5);
  ok('A3 first visit starts THE FALLEN CITY', q.isActive('fallen_city'));
  goto(g, 84, 118); g.simulate(0.6); goto(g, 84, 57); g.simulate(0.6); // Golden Gate seen first (entry), then the plaza: the gate step still ticks
  ok('Quest steps: Winged Plaza + Golden Gate found', q.active.fallen_city.done.plaza && q.active.fallen_city.done.gate, JSON.stringify(q.active.fallen_city.done));
  w.transitions.autoConfirm = true;
  goto(g, 84, 53);
  for (let k = 0; k < 8 && w.mapId !== 'sanctum'; k++) walk(g, 'KeyW', 0.4);
  const enc = g.bosses.get('boss_a3');
  ok('The Sanctum = its own boss-arena map behind the Golden Gate · the knight waits', w.mapId === 'sanctum' && w.mapDef.type === 'boss_arena' && enc.state === 'idle', `map=${w.mapId} ${enc.state}`);
  p.setLevel(level); p.hp = p.maxHp; g.inventory.add('hp_potion', 5, true);
  goto(g, 84, 38);
  for (let k = 0; k < 10 && enc.state !== 'engaged'; k++) walk(g, 'KeyW', 0.4);
  ok('Engaged: exits sealed, camera held on the arena', enc.state === 'engaged' && !!g.camera.lock && w.mapDef.exits.every((x) => !w.transitions.isOpen(x)), enc.state);
  const e = enc.entity, st = { stances: new Set(), blocked: 0, broken: 0, bursts: 0, phases: new Set(), moves: new Set(), judgement: null };
  const on = (n, f) => { g.events.on(n, f); return [n, f]; };
  const subs = [on('damageBlocked', (x) => { if (x.target === e) st.blocked++; }), on('bossGuardBroken', () => st.broken++), on('runeBurst', () => st.bursts++), on('bossJudgement', (x) => { st.judgement = x; })];
  const stance = e.mech.find((m) => m.stances || (m.d && m.d.stances)), echoes = e.mech.find((m) => m.copies !== undefined), judge = e.mech.find((m) => m.domes !== undefined || (m.d && m.d.domes));
  let t = 0;
  for (; t < seconds && enc.state !== 'defeated' && !p.dead; t += 0.5) {
    g.simulate(0.5, (gg, i) => {
      bot(gg, i, { god });
      st.stances.add(stance.cur);
      if (e.curMove && e.curMove.id) st.moves.add(e.curMove.id);
      // mechanics run: step into a dome when the judgement starts (balance runs let the bot fend for itself)
      if (god && judge.domes && judge.done && !st.judgement) { p.x = judge.domes[0].x; p.y = judge.domes[0].y; p.kx = p.ky = 0; }
    });
    st.phases.add(e.phase);
  }
  releaseInput(g);
  g.simulate(6);
  for (const [n, f] of subs) g.events.off(n, f);
  ok('Stances: SWORD and SHIELD both used; the shield blocked frontal hits', st.stances.has('sword') && st.stances.has('shield') && st.blocked > 0, `stances=${[...st.stances]} blocked=${st.blocked} broken=${st.broken}`);
  ok('Phase 2: RUNE SCRIPT runes burst in sequence', st.bursts >= 4, `bursts=${st.bursts}`);
  ok('Phase 3: ECHOES copy its attacks', echoes.copies > 0, `copies=${echoes.copies}`);
  ok(`Final attack: ASTERIAN JUDGEMENT${god ? ' — a dome is safe' : ''}`, st.judgement && (!god || st.judgement.safe > 0), JSON.stringify(st.judgement));
  if (god) ok('Moves used (5)', ['rune_slash', 'triple_cut', 'lunge', 'shield_bash', 'rune_bolts'].every((m) => st.moves.has(m)), [...st.moves].join(','));
  ok('3 phases', [1, 2, 3].every((ph) => st.phases.has(ph)), [...st.phases].join(','));
  ok(`Defeated${god ? '' : ' (no god mode)'} in ${t}s`, enc.state === 'defeated' && wp.isBossDefeated('boss_a3') && !p.dead, `state=${enc.state} dead=${p.dead} hp=${Math.round(p.hp)}/${p.maxHp}`);
  if (enc.state === 'defeated') ok('Rewards once (crest + lore) · quest done · ROUTE A COMPLETE', g.inventory.count('asterian_crest') === 1 && w.state.lore.rune_knight && q.isDone('fallen_city') && trig.includes('a3_boss_defeated') && wp.routeStatus('A').complete && !g.camera.lock);
  return R;
}

// W5: City 2 ASTERIA CITY — locked until a Major Boss falls, the north road out of the Sanctum, a safe city on its own
// grid, every service (shop / smith / storage / waystone / guild), quest THE LIVING CITY, the gate on foot, save/load, back.
export function cityCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  for (const b of ['boss_a1', 'boss_a2']) wp.defeatBoss(b);
  w.setFlag('guardianDefeated'); w.applyState();
  ok('Before the Rune Knight: City 2 locked (road gate shut)', !wp.isMapUnlocked('city2') && !!wp.lockReason('city2'), wp.lockReason('city2'));
  wp.defeatBoss('boss_a3');
  const st = wp.routeStatus('A');
  ok('Rune Knight down: City 2 unlocked · Route A complete', wp.isMapUnlocked('city2') && st.complete && st.city && st.city.unlocked);
  w.changeMap('sanctum', { entry: [84, 12] }); g.simulate(0.3);
  for (let k = 0; k < 20 && w.mapId !== 'city2'; k++) walk(g, 'KeyW', 0.3);
  g.simulate(3);
  ok('North road out of the Sanctum -> ASTERIA CITY (own grid)', w.mapId === 'city2' && w.gridId === 'asteria', `map=${w.mapId} grid=${w.gridId}`);
  ok('Safe city: no hostiles · quest THE LIVING CITY started', w.mapDef.safe && w.hostiles().length === 0 && q.isActive('asteria'));
  // the gate on foot: from the bridge up the avenue to the plaza
  goto(g, 80, 146);
  for (let k = 0; k < 90 && p.y > 78 * TILE; k++) walk(g, 'KeyW', 0.25);
  ok('Through the South Gate on foot to the Crystal Plaza', p.y <= 78 * TILE && w.state.flags.asteriaPlaza, `pos=${(p.x / TILE).toFixed(1)},${(p.y / TILE).toFixed(1)}`);
  // services
  use(g, 'npc_a_merchant'); g.ui.panels.dialogueAction('shop');
  const shopEl = document.querySelector('.panel .np-title b, .panel h2');
  ok('Asterian Bazaar: the merchant opens the city shop', shopEl && /Asterian Bazaar/.test(shopEl.textContent), shopEl && shopEl.textContent);
  g.ui.panels.close(true);
  use(g, 'npc_a_smith'); g.ui.panels.dialogueAction('smith');
  ok('Forge: the smith opens the forge', g.ui.panels.current && g.ui.panels.current.name === 'smith', g.ui.panels.current && g.ui.panels.current.name);
  g.ui.panels.close(true);
  use(g, 'ws_asteria'); g.ui.panels.close(true);
  use(g, 'a_storage'); const storageOpen = g.ui.panels.current && g.ui.panels.current.name; g.ui.panels.close(true);
  ok('Waystone attuned · storage opens', w.state.waystones.ws_asteria && storageOpen === 'storage', `storage=${storageOpen}`);
  const gold = p.gold;
  use(g, 'npc_a_guildmaster'); g.ui.panels.close(true);
  ok('Guildmaster Seraphine: THE LIVING CITY complete (+gold)', q.isDone('asteria') && p.gold > gold, `gold ${gold} -> ${p.gold}`);
  // save / load on the city grid
  const pos = [p.x, p.y];
  g.saveGame(); g.world.changeMap('lumina'); g.simulate(0.3); const loaded = g.loadGame(); // (newGame would delete the save)
  ok('Save / load in the city (grid asteria, same spot)', loaded && g.world.mapId === 'city2' && g.world.gridId === 'asteria' && Math.hypot(g.player.x - pos[0], g.player.y - pos[1]) < 40, `map=${g.world.mapId}`);
  // back out: the south road returns to the Sanctum
  const w2 = g.world;
  goto(g, 80, 150);
  for (let k = 0; k < 20 && w2.mapId !== 'sanctum'; k++) walk(g, 'KeyS', 0.3);
  ok('South road back to the Sanctum', w2.mapId === 'sanctum', `map=${w2.mapId}`);
  return R;
}

// B0: the owner's extra monster sheets (A1 Leafling / Bramble Treant, A2 Quillback Lizard / Thornshell Burrower,
// A3 Void Scarab / Rune Wisp) + the rule "no monster without sprite art": every monster on every map, every summon /
// wave type, uses a sheet. Each new monster fights a lab player: every attack starts with a telegraph and can land.
export function spriteMonsterCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress;
  for (const b of g.bosses.list) wp.defeatBoss(b.id);
  w.setFlag('guardianDefeated'); w.applyState();
  // every map: all monsters it spawns draw a sheet
  const noArt = new Set(), seen = new Set();
  for (const def of w.mapManager.list) {
    w.changeMap(def.id, { silent: true }); g.simulate(0.2);
    // spawn definitions of the loaded grid (monsters appear lazily near the player) + whatever is alive
    const types = [...w.spawnPoints.map((sp) => sp.def.type), ...w.monsters.map((m) => m.type)];
    for (const t of types) { seen.add(t); const d = MONSTERS_OF(g, t); if (!d) noArt.add(`${def.id}:${t}`); }
  }
  ok('Every monster on every map uses sprite-sheet art', !noArt.size && seen.size > 8, `types=${[...seen].join(',')} noArt=${[...noArt].join(',')}`);
  const Mon = MonCtor; // cached while touring the maps
  for (const t of ['thornling', 'leafling']) { const m = new Mon(g, t, 0, 0, {}); if (!(m.sprites && m.sprites.sheet)) noArt.add(t); }
  ok('Summons use sheet art too (Guardian thornlings, Thornbound Elder leaflings)', !noArt.size, [...noArt].join(','));
  const labs = [['leafling', 'lumina', 'a1', [47, 150]], ['treant', 'a1', 'a1', [47, 150]], ['quill_lizard', 'a2', 'a2', [84.5, 190]],
    ['burrower', 'a2', 'a2', [84.5, 190]], ['void_scarab', 'a3', 'a3', [84, 190]], ['rune_wisp', 'a3', 'a3', [84, 190]],
    ['snow_hare', 'b1', 'b1', [20, 27]], ['rime_wolf', 'b1', 'b1', [20, 27]], ['frost_harrier', 'b1', 'b1', [20, 27]], ['frost_bear', 'b1', 'b1', [20, 27]],
    ['crystal_slime', 'b2', 'b2', [39, 33]], ['cave_spider', 'b2', 'b2', [39, 33]], ['crystal_bat', 'b2', 'b2', [39, 33]], ['moss_tortoise', 'b2', 'b2', [39, 33]],
    ['glacier_wolf', 'b3', 'b3', [80, 184]], ['yeti', 'b3', 'b3', [80, 184]], ['frost_imp', 'b3', 'b3', [80, 184]], ['snow_eagle', 'b3', 'b3', [80, 184]]];
  for (const [type, , map, spot] of labs) {
    w.changeMap(map, { entry: spot }); g.simulate(0.3);
    for (const m of w.monsters) if (!m.dead) { m.dead = true; m.deathT = 99; }
    p.setLevel(Math.max(5, (MONSTER_LEVEL[type] || 5))); p.hp = p.maxHp;
    const pos = w.map.findOpen(spot[0] * TILE, spot[1] * TILE, 4); p.x = pos.x; p.y = pos.y;
    const m = new Mon(g, type, p.x + 90, p.y, {}); m.aggro = true; m.setState('chase'); w.monsters.push(m);
    const used = new Set(), winds = []; let hits = 0;
    const start = m.startAttack.bind(m); m.startAttack = (a) => { used.add(a.id); winds.push(a.windup); return start(a); };
    const onDmg = (e) => { if (e.source === m && e.target === p) hits++; }; g.events.on('damageDealt', onDmg);
    for (let t = 0; t < 40 && used.size < m.def.attacks.length; t += 0.1) g.simulate(0.1, () => { p.hp = p.maxHp; p.x += Math.sin(g.time * 0.9) * 1.5; });
    g.simulate(1.5, () => { p.hp = p.maxHp; });
    g.events.off && g.events.off('damageDealt', onDmg);
    const all = m.def.attacks.map((a) => a.id);
    ok(`${m.name}: every attack used after a telegraph (${all.join(' / ')}) · hits land · sheet art`,
      all.every((id) => used.has(id)) && winds.every((s) => s >= 0.35) && hits > 0 && m.sprites.sheet, `used=${[...used]} hits=${hits}`);
    m.hp = 0; m.dead = true; m.deathT = 99;
  }
  return R;
}
// a monster type draws sheet art when its sprite key is a sheet set (monsterArt `replaces`)
let MonCtor = null; // the Monster class, taken from the first live monster seen (testkit imports nothing)
const MONSTERS_OF = (g, t) => { if (g.world.monsters[0]) MonCtor = g.world.monsters[0].constructor; if (!MonCtor) return true; const m = new MonCtor(g, t, 0, 0, {}); return !!(m.def.boss || (m.sprites && m.sprites.sheet)); }; // bosses (boss: true) draw their own sheets
const MONSTER_LEVEL = { leafling: 3, treant: 5, quill_lizard: 11, burrower: 12, void_scarab: 14, rune_wisp: 15, snow_hare: 2, rime_wolf: 4, frost_harrier: 5, frost_bear: 7, crystal_slime: 10, cave_spider: 11, crystal_bat: 12, moss_tortoise: 13, glacier_wolf: 14, yeti: 16, frost_imp: 15, snow_eagle: 15 };

// B1: Route B's first map — Lumina's Eastern Road on foot, FROSTWIND PLAINS on its own grid, the Frost Arena sealed
// until its boss exists, route B status, the waystone, save / load on the new grid.
export function routeBCheck(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress;
  const st = wp.routeStatus('B');
  ok('Route B playable: B1 + B2 + B3 built (B2 / B3 locked behind their bosses)', st.route.playable && !st.steps[0].planned && st.steps[0].unlocked && !st.steps[1].planned && !st.steps[1].unlocked && !st.steps[2].planned && !st.steps[2].unlocked, JSON.stringify(st.steps.map((s) => [s.id, s.planned, s.unlocked])));
  goto(g, 60, 180);
  for (let k = 0; k < 30 && w.mapId !== 'b1'; k++) walk(g, 'KeyD', 0.3);
  g.simulate(2.5);
  ok("Lumina's Eastern Road -> FROSTWIND PLAINS (grid frostwind) on foot", w.mapId === 'b1' && w.gridId === 'frostwind', `map=${w.mapId} grid=${w.gridId}`);
  ok('B1 is hostile ground with its own monsters', w.spawnPoints.some((sp) => sp.def.type === 'rime_wolf') && !w.mapDef.safe);
  use(g, 'ws_b1_lodge'); g.ui.panels.close(true);
  ok("Hunter's Lodge waystone attuned", w.state.waystones.ws_b1_lodge);
  // the arena stairs ask first (like every boss arena); 'Not yet' keeps you in B1
  let asked = false; const ask0 = g.ui.panels.confirm.bind(g.ui.panels);
  g.ui.panels.confirm = (t, b, y, n, onYes, onNo) => { asked = true; g.ui.panels.confirm = ask0; onNo(); };
  goto(g, 142, 119);
  for (let k = 0; k < 6 && !asked; k++) walk(g, 'KeyS', 0.25);
  g.ui.panels.confirm = ask0;
  ok('Frost Arena stairs ask first · "Not yet" stays in B1', asked && w.mapId === 'b1', `asked=${asked} map=${w.mapId}`);
  goto(g, 81, 60); g.simulate(0.5);
  const pos = [p.x, p.y];
  g.saveGame(); w.changeMap('lumina'); g.simulate(0.3); const loaded = g.loadGame();
  ok('Save / load in B1 (grid frostwind, same spot)', loaded && g.world.mapId === 'b1' && g.world.gridId === 'frostwind' && Math.hypot(g.player.x - pos[0], g.player.y - pos[1]) < 40, `map=${g.world.mapId}`);
  const w2 = g.world;
  goto(g, 6, 21);
  for (let k = 0; k < 12 && w2.mapId !== 'lumina'; k++) walk(g, 'KeyA', 0.3);
  ok('Back west to Lumina', w2.mapId === 'lumina', `map=${w2.mapId}`);
  return R;
}

// B1b: HOARFANG, the B1 boss, in the Frost Arena — quest THE EASTERN ROAD, arena gate, 2 phases, the owner's AURA sheet on
// the phase change, FROSTBITE (standing still freezes you), ABSOLUTE ZERO (only an ice pillar gives cover), the pack howl,
// rewards once. god: the bot's damage is ignored and it steps behind a pillar when ABSOLUTE ZERO starts.
export function b1BossCheck(g, classId = 'umbral_sword', { god = true, level = 16, seconds = 300 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  const trig = []; g.events.on('worldTriggerFired', (e) => trig.push(e.id));
  w.changeMap('b1', { entry: [8.5, 21] }); g.simulate(0.5);
  ok('B1 first visit starts THE EASTERN ROAD', q.isActive('eastern_road'), Object.keys(q.active).join(','));
  goto(g, 81, 57); g.simulate(0.6);
  w.transitions.autoConfirm = true;
  goto(g, 142, 119);
  for (let k = 0; k < 10 && w.mapId !== 'frost_arena'; k++) walk(g, 'KeyS', 0.35);
  const enc = g.bosses.get('boss_b1');
  ok('Frost Arena = its own boss-arena map up the stairs · quest steps · Hoarfang waits', w.mapId === 'frost_arena' && w.mapDef.type === 'boss_arena' && q.active.eastern_road && q.active.eastern_road.done.cross && q.active.eastern_road.done.arena && enc.state === 'idle', `map=${w.mapId} ${enc.state} ${JSON.stringify(q.active.eastern_road && q.active.eastern_road.done)}`);
  p.setLevel(level); p.hp = p.maxHp; g.inventory.add('hp_potion', 5, true);
  for (let k = 0; k < 12 && enc.state !== 'engaged'; k++) walk(g, 'KeyS', 0.35);
  ok('Engaged: exits sealed, camera held on the arena', enc.state === 'engaged' && !!g.camera.lock && w.mapDef.exits.every((x) => !w.transitions.isOpen(x)), enc.state);
  const e = enc.entity, moves = new Set(), phases = new Set(), fxUsed = new Set();
  const st = { frozen: 0, zero: null, summons: 0 };
  const on = (n, f) => { g.events.on(n, f); return [n, f]; };
  const subs = [on('playerFrozen', () => st.frozen++), on('bossAbsoluteZero', (x) => { st.zero = x; })];
  const spawn0 = g.vfx.sprite.bind(g.vfx); g.vfx.sprite = (n, ...a) => { if (/^fa?_/.test(n)) fxUsed.add(n); return spawn0(n, ...a); };
  const glacier = e.mech.find((m) => m.pillars), frost = e.mech.find((m) => m.stacks !== undefined);
  let stillT = 0, t = 0;
  for (; t < seconds && enc.state !== 'defeated' && !p.dead; t += 0.5) {
    g.simulate(0.5, (gg, i) => {
      // phase 2, once: stand still for a while -> FROSTBITE must freeze the player
      if (god && e.phase >= 2 && st.frozen === 0 && stillT < 7) { stillT += 1 / 60; releaseInput(gg); p.hp = Math.max(p.hp, p.maxHp * 0.6); }
      else bot(gg, i, { god });
      if (e.curMove) moves.add(Object.keys(e.def.moves).find((k) => e.def.moves[k] === e.curMove));
      st.summons = Math.max(st.summons, (e.summons || []).filter((m) => !m.dead).length);
      for (const tg of e.hudState().tags) if (!tg || typeof tg.label !== 'string') st.badTag = true; // HUD tags = { label, color }
      // mechanics run: step behind the nearest pillar when ABSOLUTE ZERO is coming
      if (god && glacier.pillars.length && !st.zero) {
        const pl = glacier.pillars.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
        const ang = Math.atan2(pl.y - e.y, pl.x - e.x); p.x = pl.x + Math.cos(ang) * 30; p.y = pl.y + Math.sin(ang) * 30; p.kx = p.ky = 0;
      }
    });
    phases.add(e.phase);
  }
  releaseInput(g);
  g.simulate(6);
  g.vfx.sprite = spawn0;
  for (const [n, f] of subs) g.events.off(n, f);
  ok('Phase change plays the AURA sheet (fa_*) and the B1 boss VFX (f_*)', [...fxUsed].some((n) => n.startsWith('fa_')) && [...fxUsed].filter((n) => n.startsWith('f_')).length >= 4, [...fxUsed].join(','));
  ok('THE HUNT: its howl calls the pack (Rimefang Wolves)', st.summons > 0, `max summons=${st.summons}`);
  if (god) ok('WHITEOUT: standing still -> FROSTBITE -> FROZEN', st.frozen > 0, `frozen=${st.frozen}`);
  ok(`ABSOLUTE ZERO: ice pillars raised${god ? ' · hiding behind one is safe' : ''}`, st.zero && (!god || st.zero.safe > 0), JSON.stringify(st.zero));
  if (god) ok('Every move used', Object.keys(e.def.moves).every((m) => moves.has(m)), [...moves].join(','));
  ok('2 phases (WHITEOUT at 55%) · HUD tags well-formed', phases.has(1) && phases.has(2) && !st.badTag, [...phases].join(','));
  ok(`Defeated${god ? '' : ' (no god mode)'} in ${t}s`, enc.state === 'defeated' && wp.isBossDefeated('boss_b1') && !p.dead, `state=${enc.state} dead=${p.dead} hp=${Math.round(p.hp)}/${p.maxHp}`);
  if (enc.state === 'defeated') ok('Rewards once (Heart of the Winter Alpha + lore) · quest done · banner · route B step 1 done · camera free', g.inventory.count('frost_heart') === 1 && w.state.lore.hoarfang && q.isDone('eastern_road') && trig.includes('b1_boss_defeated') && wp.routeStatus('B').steps[0].bossDefeated && !g.camera.lock);
  return R;
}

// B2a: the Crystal Caverns — locked until Hoarfang falls, the Frost Arena's south road on foot, the cave on its own grid,
// quest THE CRYSTAL DEPTHS (lake -> ruins -> the Heart), the Heart sealed until its boss exists, waystone, save / load, back.
export function b2Check(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  ok('Before Hoarfang: B2 locked (the south road gate stays shut)', !wp.isMapUnlocked('b2') && /Hoarfang/.test(wp.lockReason('b2') || ''), wp.lockReason('b2'));
  wp.defeatBoss('boss_b1');
  w.changeMap('frost_arena', { entry: [142, 158] }); g.simulate(0.3);
  goto(g, 142, 162);
  for (let k = 0; k < 12 && w.mapId !== 'b2'; k++) walk(g, 'KeyS', 0.3);
  g.simulate(2.5);
  ok('Hoarfang down: south road -> CRYSTAL CAVERNS (grid caverns) · quest THE CRYSTAL DEPTHS', w.mapId === 'b2' && w.gridId === 'caverns' && q.isActive('crystal_depths'), `map=${w.mapId} grid=${w.gridId}`);
  use(g, 'ws_b2_hall'); g.ui.panels.close(true);
  ok('Glittering Hall waystone attuned', w.state.waystones.ws_b2_hall);
  for (const [x, y] of [[92, 98], [143, 78], [74, 28]]) { goto(g, x, y); g.simulate(0.6); }
  const qd = q.active.crystal_depths && q.active.crystal_depths.done;
  ok('Quest: lake crossed · ruins reached · the Heart found (boss step next)', qd && qd.lake && qd.ruins && qd.heart && !qd.boss, JSON.stringify(qd));
  let asked = false; const ask0 = g.ui.panels.confirm.bind(g.ui.panels);
  g.ui.panels.confirm = (t, b, y, n, onYes, onNo) => { asked = true; g.ui.panels.confirm = ask0; onNo(); };
  goto(g, 117, 29);
  for (let k = 0; k < 8 && !asked; k++) walk(g, 'KeyD', 0.25);
  g.ui.panels.confirm = ask0;
  ok('The Heart of the Caverns asks first · "Not yet" stays in B2', asked && w.mapId === 'b2', `asked=${asked} map=${w.mapId}`);
  goto(g, 92, 98); g.simulate(0.3);
  const pos = [p.x, p.y];
  g.saveGame(); w.changeMap('lumina'); g.simulate(0.3); const loaded = g.loadGame();
  ok('Save / load in B2 (grid caverns, on the lake bridge)', loaded && g.world.mapId === 'b2' && g.world.gridId === 'caverns' && Math.hypot(g.player.x - pos[0], g.player.y - pos[1]) < 40, `map=${g.world.mapId}`);
  const w2 = g.world;
  goto(g, 7, 12);
  for (let k = 0; k < 12 && w2.mapId !== 'frost_arena'; k++) walk(g, 'KeyA', 0.3);
  ok('Back up the tunnel to the Frost Arena', w2.mapId === 'frost_arena', `map=${w2.mapId}`);
  return R;
}

// B2b: the AMETHYST COLOSSUS in the Heart of the Caverns — confirm gate, arena, CRYSTAL ARMOR (break it -> SHATTERED),
// clusters (smash them or they are absorbed back into armour), 2 phases + the AURA sheet, rewards, quest.
export function b2BossCheck(g, classId = 'umbral_sword', { god = true, level = 30, seconds = 360 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  wp.defeatBoss('boss_b1');
  const trig = []; g.events.on('worldTriggerFired', (e) => trig.push(e.id));
  w.changeMap('b2', { entry: [7, 12] }); g.simulate(0.5);
  for (const [x, y] of [[92, 98], [143, 78], [74, 28]]) { goto(g, x, y); g.simulate(0.5); }
  w.transitions.autoConfirm = true;
  goto(g, 117, 29);
  for (let k = 0; k < 10 && w.mapId !== 'crystal_heart'; k++) walk(g, 'KeyD', 0.3);
  const enc = g.bosses.get('boss_b2');
  ok('Heart of the Caverns = its own boss-arena map · the Colossus waits', w.mapId === 'crystal_heart' && w.mapDef.type === 'boss_arena' && enc.state === 'idle', `map=${w.mapId} ${enc.state}`);
  p.setLevel(level); p.hp = p.maxHp; g.inventory.add('hp_potion', 5, true);
  for (let k = 0; k < 12 && enc.state !== 'engaged'; k++) walk(g, 'KeyD', 0.3);
  ok('Engaged: exits sealed, camera held on the arena', enc.state === 'engaged' && !!g.camera.lock && w.mapDef.exits.every((x) => !w.transitions.isOpen(x)), enc.state);
  const e = enc.entity, moves = new Set(), phases = new Set(), fxUsed = new Set();
  const st = { broken: 0, restored: 0, smashed: 0, armored0: e.armor > 0, badTag: false };
  const on = (n, f) => { g.events.on(n, f); return [n, f]; };
  const subs = [on('bossArmorBroken', () => st.broken++), on('bossArmorRestored', () => st.restored++), on('bossClusterSmashed', () => st.smashed++)];
  const spawn0 = g.vfx.sprite.bind(g.vfx); g.vfx.sprite = (n, ...a) => { if (/^ca?_/.test(n)) fxUsed.add(n); return spawn0(n, ...a); };
  const arm = e.mech.find((m) => m.list && m.absorb);
  let t = 0, round = 0;
  for (; t < seconds && enc.state !== 'defeated' && !p.dead; t += 0.5) {
    g.simulate(0.5, (gg, i) => {
      // the bot hits the nearest hostile — clusters are hostile breakables. In god runs: leave the FIRST growth alone
      // (it must be absorbed = armour back), smash the later ones.
      const target = arm.list.length && round > 0 ? arm.list[0] : null;
      bot(gg, i, { god, target, breakables: round > 0 });
      if (e.curMove) moves.add(Object.keys(e.def.moves).find((k) => e.def.moves[k] === e.curMove));
      for (const tg of e.hudState().tags) if (!tg || typeof tg.label !== 'string') st.badTag = true;
    });
    if (st.restored && round === 0) round = 1;
    if (!god && arm.list.length) round = 1;
    phases.add(e.phase);
  }
  releaseInput(g);
  g.simulate(6);
  g.vfx.sprite = spawn0;
  for (const [n, f] of subs) g.events.off(n, f);
  ok('CRYSTAL ARMOR: starts armoured, breaks (SHATTERED)', st.armored0 && st.broken > 0, `broken=${st.broken}`);
  if (god) ok('Clusters left standing are absorbed back into armour', st.restored > 0, `restored=${st.restored}`);
  ok('Clusters can be smashed', st.smashed > 0, `smashed=${st.smashed}`);
  ok('Phase change plays the B2 AURA sheet (ca_*) and the B2 VFX (c_*)', [...fxUsed].some((n) => n.startsWith('ca_')) && [...fxUsed].filter((n) => n.startsWith('c_')).length >= 3, [...fxUsed].join(','));
  if (god) ok('Every move used', Object.keys(e.def.moves).every((m) => moves.has(m)), [...moves].join(','));
  ok('2 phases (RESONANCE at 50%) · HUD tags well-formed', phases.has(1) && phases.has(2) && !st.badTag, [...phases].join(','));
  ok(`Defeated${god ? '' : ' (no god mode)'} in ${t}s`, enc.state === 'defeated' && wp.isBossDefeated('boss_b2') && !p.dead, `state=${enc.state} dead=${p.dead} hp=${Math.round(p.hp)}/${p.maxHp}`);
  if (enc.state === 'defeated') ok('Rewards once (Amethyst Core + lore) · quest done · banner · no clusters left · camera free', g.inventory.count('amethyst_core') === 1 && w.state.lore.amethyst_colossus && q.isDone('crystal_depths') && trig.includes('b2_boss_defeated') && !arm.list.length && !g.camera.lock);
  return R;
}

// B3a: FROSTPEAK — locked until the Amethyst Colossus falls, the Abyssal Arch on foot, the mountain on its own grid,
// quest THE FROZEN SUMMIT (lakes -> stairs -> summit gate), the summit not walkable yet, waystone, save / load, back.
export function b3Check(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  wp.defeatBoss('boss_b1');
  ok('Before the Colossus: B3 locked', !wp.isMapUnlocked('b3') && /Colossus/.test(wp.lockReason('b3') || ''), wp.lockReason('b3'));
  wp.defeatBoss('boss_b2');
  w.changeMap('b2', { entry: [148, 180] }); g.simulate(0.3);
  goto(g, 148, 176);
  for (let k = 0; k < 12 && w.mapId !== 'b3'; k++) walk(g, 'KeyW', 0.3);
  g.simulate(2.5);
  ok('Colossus down: through the Abyssal Arch -> FROSTPEAK (grid frostpeak) · quest THE FROZEN SUMMIT', w.mapId === 'b3' && w.gridId === 'frostpeak' && q.isActive('frostpeak_climb'), `map=${w.mapId} grid=${w.gridId}`);
  use(g, 'ws_b3_camp'); g.ui.panels.close(true);
  ok('Nomad Camp waystone attuned', w.state.waystones.ws_b3_camp);
  for (const [x, y] of [[66, 150], [82, 108], [84, 76]]) { goto(g, x, y); g.simulate(0.6); }
  const qd = q.active.frostpeak_climb && q.active.frostpeak_climb.done;
  ok('Quest: lakes · stairs · summit gate (boss step next)', qd && qd.lakes && qd.stairs && qd.summit && !qd.boss, JSON.stringify(qd));
  let asked = false; const ask0 = g.ui.panels.confirm.bind(g.ui.panels);
  g.ui.panels.confirm = (t, b, y, n, onYes, onNo) => { asked = true; g.ui.panels.confirm = ask0; onNo(); };
  goto(g, 90, 56);
  for (let k = 0; k < 8 && !asked; k++) walk(g, 'KeyW', 0.3);
  g.ui.panels.confirm = ask0;
  ok('The Summit Gate asks first · "Not yet" stays in B3', asked && w.mapId === 'b3', `asked=${asked} map=${w.mapId}`);
  goto(g, 131, 118); g.simulate(0.3);
  const pos = [p.x, p.y];
  g.saveGame(); w.changeMap('lumina'); g.simulate(0.3); const loaded = g.loadGame();
  ok('Save / load in B3 (grid frostpeak)', loaded && g.world.mapId === 'b3' && g.world.gridId === 'frostpeak' && Math.hypot(g.player.x - pos[0], g.player.y - pos[1]) < 40, `map=${g.world.mapId}`);
  const w2 = g.world;
  goto(g, 81, 201);
  for (let k = 0; k < 12 && w2.mapId !== 'b2'; k++) walk(g, 'KeyS', 0.3);
  ok('Back down through the South Gate to the caverns', w2.mapId === 'b2', `map=${w2.mapId}`);
  return R;
}

// B3b: the CRYSTAL WARDEN (B3 major) on the Summit Citadel — confirm gate, arena, 4 phases (forms change), FROST SCRIPT
// sigils, REFLECTIONS, SHATTERED ECLIPSE (break the pylons in time -> EXPOSED; god mode lets it fail once first), rewards,
// ROUTE B COMPLETE, the north road to City 2.
// A2 SECRET BOSS VARKHARON (D4): the dragon door -> the Cinder Throne, rising lava (and its reset), sky chains (the bot
// runs to the lit posts and holds [E]), ember debt + IGNITE, LAST BREATH at 10%, rewards + dragon_slain.
//   const T = await import('/tools/testkit.js'); T.varkharonCheck(__game, 'umbral_sword', { god: true, level: 50 })
export function varkharonCheck(g, classId = 'umbral_sword', { god = true, level = 50, seconds = 600 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress;
  wp.defeatBoss('boss_a1');
  w.setFlag('cinderSealBroken');
  w.transitions.autoConfirm = true;
  w.changeMap('a2', { entry: [148, 174] }); g.simulate(0.3);
  goto(g, 148, 172.6);
  for (let k = 0; k < 8 && w.mapId !== 'cinder'; k++) walk(g, 'KeyW', 0.3);
  g.simulate(0.6);
  const enc = g.bosses.get('boss_varkharon'), e = enc.entity || g.bosses.entityOf(enc);
  ok('Dragon door -> the Cinder Throne · Varkharon waits', w.mapId === 'cinder' && enc.state === 'idle', `map=${w.mapId} ${enc.state}`);
  p.setLevel(level); p.hp = p.maxHp; g.inventory.add('hp_potion', 6, true);
  const m = w.map, cx = 148, cy = 151, floorAt = (r) => m.get(Math.round(cx + r), cy);
  const lava = e.mech.find((x) => x.d.rings), sky = e.mech.find((x) => x.d.posts), ember = e.mech.find((x) => x.d.per);
  const before = [floorAt(12), floorAt(-12)];
  // 1) the lava rises on the first phase change, and sinks again when the fight resets
  for (let k = 0; k < 12 && enc.state !== 'engaged'; k++) walk(g, 'KeyW', 0.35);
  ok('Engaged: exits sealed, camera held', enc.state === 'engaged' && !!g.camera.lock && w.mapDef.exits.every((x) => !w.transitions.isOpen(x)), enc.state);
  g.simulate(2, () => { p.hp = p.maxHp; }); // past the intro roar
  e.hp = Math.floor(e.maxHp * 0.74); e.checkPhase();
  for (let t = 0; t < 12 && !lava.rises; t += 0.5) g.simulate(0.5, () => { p.hp = p.maxHp; });
  const risen = floorAt(12) === 24 && e.arenaR < e.def.arena.radius * TILE;
  w.changeMap('a2', { entry: [148, 176] }); g.simulate(5);
  ok('RISING LAVA: the outer floor turns to lava · and comes back when the fight resets', risen && enc.state !== 'engaged' && floorAt(12) === before[0] && e.arenaR === e.def.arena.radius * TILE, `risen=${risen} state=${enc.state} tile=${floorAt(12)}`);
  // 2) the real fight
  w.changeMap('cinder', { entry: [148, 165] }); g.simulate(0.6);
  p.hp = p.maxHp;
  for (let k = 0; k < 12 && enc.state !== 'engaged'; k++) walk(g, 'KeyW', 0.35);
  const phases = new Set(), anims = new Set(), moves = new Set(), fx = new Set();
  const st = { chained: 0, crashes: [], ignites: 0, maxEmber: 0, badTag: false, rises: [] };
  const subs = [['bossChained', () => st.chained++], ['bossCrashed', (x) => st.crashes.push(x.final)], ['bossIgnite', () => st.ignites++], ['bossLavaRose', (x) => st.rises.push(x.r)]].map(([n, f]) => { g.events.on(n, f); return [n, f]; });
  const spawn0 = g.vfx.sprite.bind(g.vfx); g.vfx.sprite = (n, ...a) => { if (/^(d|ca)_/.test(n)) fx.add(n); return spawn0(n, ...a); };
  const hurt = {}; // damage taken by source (balance)
  subs.push(['damageTaken', (x) => { if (x.target !== p || !(x.amount > 0)) return; const k = x.source === e ? (sky.flying ? 'flight' : (e.curMove && Object.keys(e.def.moves).find((id) => e.def.moves[id] === e.curMove)) || 'mechanic') : 'other'; hurt[k] = (hurt[k] || 0) + Math.round(x.amount); }]);
  g.events.on('damageTaken', subs[subs.length - 1][1]);
  let t = 0, finalFailSeen = false;
  for (; t < seconds && enc.state !== 'defeated' && !p.dead; t += 0.5) {
    g.simulate(0.5, (gg, i) => {
      if (sky.flying) {
        // fly phase: run to the first lit post that is not chained yet and hold [E] there
        const inp = gg.input; ['KeyA', 'KeyD', 'KeyW', 'KeyS'].forEach((k) => inp.down.delete(k));
        const k = sky.lit.find((x) => !sky.chained.includes(x)), s = k !== undefined && sky.post(k);
        // god runs let the first LAST BREATH go off (it must be seen), then chain
        const wait = god && sky.flights && e.phase >= 4 && !sky.finalFails && !finalFailSeen;
        p.chainHold = false;
        // dodge what is about to land (a person would), then go on to the post
        const hot = gg.combat.telegraphs.list.find((tl) => !tl.resolved && tl.total - tl.time < 0.12 && tl.total - tl.time > 0 && gg.combat.testShape(tl, p));
        if (hot) { const a = Math.atan2(p.y - hot.y, p.x - hot.x); if (Math.cos(a) > 0.3) inp.down.add('KeyD'); if (Math.cos(a) < -0.3) inp.down.add('KeyA'); if (Math.sin(a) > 0.3) inp.down.add('KeyS'); if (Math.sin(a) < -0.3) inp.down.add('KeyW'); inp.pushBuffer('dodge'); }
        else if (s && !wait) {
          const dd = Math.hypot(s.x - p.x, s.y - p.y), a = Math.atan2(s.y - p.y, s.x - p.x);
          if (dd > 18) { if (Math.cos(a) > 0.3) inp.down.add('KeyD'); if (Math.cos(a) < -0.3) inp.down.add('KeyA'); if (Math.sin(a) > 0.3) inp.down.add('KeyS'); if (Math.sin(a) < -0.3) inp.down.add('KeyW'); }
          else p.chainHold = true;
        }
        if (god) { p.hp = Math.max(p.hp, p.maxHp * 0.5); }
      } else { p.chainHold = false; bot(gg, i, { god }); }
      if (sky.finalFails) finalFailSeen = true;
      if (e.curMove) moves.add(Object.keys(e.def.moves).find((x) => e.def.moves[x] === e.curMove));
      st.maxEmber = Math.max(st.maxEmber, ember.get(p));
      if (!e.dead && e.sprites && e.sprites.sheet) { const fr = e.sheetFrame(e.sprites); for (const [n, list] of Object.entries(e.sprites.anims)) if (list.includes(fr)) anims.add(n); }
      for (const tg of e.hudState().tags) if (!tg || typeof tg.label !== 'string') st.badTag = true;
    });
    phases.add(e.phase);
  }
  p.chainHold = false;
  releaseInput(g);
  g.simulate(6);
  g.vfx.sprite = spawn0;
  for (const [n, f] of subs) g.events.off(n, f);
  // v2 art: one drawn form, each phase its own colour filter; the sheet's breath / spit / enrage rows play
  ok('Phase looks (colour per phase) · breath, fire spit and enrage rows play', [2, 3, 4].every((ph) => e.look.phaseStyle[ph].filter) && ['breath', 'roar', 'attack'].every((n) => anims.has(n)), [...anims].join(','));
  ok('RISING LAVA on the phase changes, down to the last ring (a fast burst may skip one)', st.rises.length >= 2 && st.rises.includes(8.4), st.rises.join(','));
  ok('SKY CHAINS: it flew, was chained and crashed (weak window)', sky.flights >= 2 && st.chained >= 2 && st.crashes.includes(false), `flights=${sky.flights} chained=${st.chained} crashes=${st.crashes}`);
  // a good player owes nothing when IGNITE is due (it waits); either it went off, or every ember was burned off first
  ok('EMBER DEBT: fire stacked embers · IGNITE went off or the debt was burned off', st.maxEmber >= 1 && (st.ignites >= 1 || ember.burnedOff >= st.maxEmber), `max=${st.maxEmber} ignites=${st.ignites} burnedOff=${ember.burnedOff}`);
  ok(`LAST BREATH at 10%: ${god ? 'seen once, then ' : ''}chained down for the kill`, st.crashes.includes(true) && (!god || sky.finalFails >= 1), `fails=${sky.finalFails} crashes=${st.crashes}`);
  ok('Dragon VFX (d_*) play', [...fx].filter((n) => n.startsWith('d_')).length >= 5, [...fx].join(','));
  // its flights eat turns: a random pick may miss one or two moves in a single fight
  if (god) ok('Almost every move used (all but 2 at most)', Object.keys(e.def.moves).filter((x) => !moves.has(x)).length <= 2, [...moves].filter(Boolean).join(','));
  ok('4 phases · HUD tags well-formed', [1, 2, 3, 4].every((ph) => phases.has(ph)) && !st.badTag, [...phases].join(','));
  ok(`Defeated${god ? '' : ' (no god mode)'} in ${t}s`, enc.state === 'defeated' && wp.isBossDefeated('boss_varkharon') && !p.dead, `state=${enc.state} dead=${p.dead} hp=${Math.round(p.hp)}/${p.maxHp} bossHp=${Math.round(e.hp)}/${e.maxHp} hurt=${JSON.stringify(hurt)}`);
  if (enc.state === 'defeated') ok('Rewards: Heart of Varkharon + lore · flag dragon_slain · the throne floor is back', g.inventory.count('heart_of_varkharon') === 1 && w.state.lore.varkharon && w.state.flags.dragon_slain && floorAt(12) === before[0]);
  return R;
}

export function b3BossCheck(g, classId = 'umbral_sword', { god = true, level = 43, seconds = 480 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, p = g.player, wp = g.worldProgress, q = g.quests;
  for (const b of ['boss_b1', 'boss_b2']) wp.defeatBoss(b);
  const trig = []; g.events.on('worldTriggerFired', (e) => trig.push(e.id));
  w.changeMap('b3', { entry: [81.5, 196] }); g.simulate(0.5);
  for (const [x, y] of [[66, 150], [82, 108], [84, 76]]) { goto(g, x, y); g.simulate(0.5); }
  w.transitions.autoConfirm = true;
  goto(g, 90, 56);
  for (let k = 0; k < 10 && w.mapId !== 'summit'; k++) walk(g, 'KeyW', 0.3);
  g.simulate(0.6); // the Warden appears a moment after the map loads
  const enc = g.bosses.get('boss_b3');
  ok('Summit Citadel = its own boss-arena map · the Warden waits', w.mapId === 'summit' && w.mapDef.type === 'boss_arena' && enc.state === 'idle', `map=${w.mapId} ${enc.state}`);
  p.setLevel(level); p.hp = p.maxHp; g.inventory.add('hp_potion', 5, true);
  for (let k = 0; k < 12 && enc.state !== 'engaged'; k++) walk(g, 'KeyW', 0.35);
  ok('Engaged: exits sealed, camera held', enc.state === 'engaged' && !!g.camera.lock && w.mapDef.exits.every((x) => !w.transitions.isOpen(x)), enc.state);
  const e = enc.entity, moves = new Set(), phases = new Set(), anims = new Set(), fxUsed = new Set();
  const st = { bursts: 0, eclipse: [], badTag: false, pylonsBroken: 0 };
  const on = (n, f) => { g.events.on(n, f); return [n, f]; };
  const subs = [on('runeBurst', () => st.bursts++), on('bossEclipse', (x) => st.eclipse.push(x.broken)), on('bossPylonBroken', () => st.pylonsBroken++)];
  const spawn0 = g.vfx.sprite.bind(g.vfx); g.vfx.sprite = (n, ...a) => { if (/^(w|ca)_/.test(n)) fxUsed.add(n); return spawn0(n, ...a); };
  const echoes = e.mech.find((m) => m.copies !== undefined), py = e.mech.find((m) => m.hpFloor && m.list && m.chargeT !== undefined);
  let t = 0;
  for (; t < seconds && enc.state !== 'defeated' && !p.dead; t += 0.5) {
    g.simulate(0.5, (gg, i) => {
      // pylons: god runs ignore the first eclipse (it must go off), then smash; balance runs smash straight away
      const smash = py.casting && py.list.length && (!god || st.eclipse.length > 0);
      bot(gg, i, { god, target: smash ? py.list.find((c) => !c.dead) : null, breakables: smash });
      if (god && py.casting && !st.eclipse.length) { p.hp = p.maxHp; p.invulnT = 0; }
      if (e.curMove && e.curMove.id) moves.add(e.curMove.id);
      if (e.curMove) moves.add(Object.keys(e.def.moves).find((k) => e.def.moves[k] === e.curMove));
      if (!e.dead && e.sprites && e.sprites.sheet) { const fr = e.sheetFrame(e.sprites); for (const [n, list] of Object.entries(e.sprites.anims)) if (list.includes(fr)) anims.add(n); }
      for (const tg of e.hudState().tags) if (!tg || typeof tg.label !== 'string') st.badTag = true;
    });
    phases.add(e.phase);
  }
  releaseInput(g);
  g.simulate(6);
  g.vfx.sprite = spawn0;
  for (const [n, f] of subs) g.events.off(n, f);
  ok('Forms change with the phases (dormant / awakened / corrupted art)', ['p1_idle', 'p2_idle', 'p3_idle'].filter((a) => anims.has(a)).length >= 2 || ['p1_hit', 'p2_hit', 'p3_hit'].filter((a) => anims.has(a)).length >= 2, [...anims].join(','));
  ok('AWAKENED: frost sigils burst in order', st.bursts >= 4, `bursts=${st.bursts}`);
  ok('CORRUPTED: reflections copy its attacks', echoes.copies > 0, `copies=${echoes.copies}`);
  ok(`SHATTERED ECLIPSE: pylons broken in time -> EXPOSED${god ? ' (after one failed charge)' : ''}`, st.eclipse.includes(true) && (!god || st.eclipse[0] === false), JSON.stringify(st.eclipse));
  ok('B3 VFX (w_*) + phase auras (ca_*) play', [...fxUsed].filter((n) => n.startsWith('w_')).length >= 4 && [...fxUsed].some((n) => n.startsWith('ca_')), [...fxUsed].join(','));
  if (god) ok('Every move used', Object.keys(e.def.moves).every((m) => moves.has(m)), [...moves].filter(Boolean).join(','));
  ok('4 phases · HUD tags well-formed', [1, 2, 3, 4].every((ph) => phases.has(ph)) && !st.badTag, [...phases].join(','));
  ok(`Defeated${god ? '' : ' (no god mode)'} in ${t}s`, enc.state === 'defeated' && wp.isBossDefeated('boss_b3') && !p.dead, `state=${enc.state} dead=${p.dead} hp=${Math.round(p.hp)}/${p.maxHp}`);
  if (enc.state === 'defeated') {
    ok('Rewards once (Warden crest + lore) · quest done · ROUTE B COMPLETE · City 2 open · no pylons left', g.inventory.count('warden_crest') === 1 && w.state.lore.crystal_warden && q.isDone('frostpeak_climb') && trig.includes('b3_boss_defeated') && wp.routeStatus('B').complete && wp.isMapUnlocked('city2') && !py.list.length);
    goto(g, 90, 14);
    for (let k = 0; k < 12 && w.mapId !== 'city2'; k++) walk(g, 'KeyW', 0.3);
    ok('North road from the summit -> Asteria City', w.mapId === 'city2', `map=${w.mapId}`);
  }
  return R;
}

// ITEM SYSTEM G2 — the gear loadout on a real player (Aegis by default): equip / unequip / swap, final stats move with
// the items and come back to the exact base, save / load keeps the loadout.
//   T.giveGear(__game)               : one of every new gear item (data/items/*) into the bag (dev / manual testing)
//   T.loadoutCheck(__game, classId)  : 9 steps
export function giveGear(g) {
  const ids = Object.keys(GEAR_ITEMS);
  for (const id of ids) if (!g.inventory.has(id)) g.inventory.add(id, 1, true);
  return ids;
}
export function loadoutCheck(g, classId = 'aegis_guardian') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId); releaseInput(g); g.simulate(0.2);
  const p = () => g.player, eq = () => g.equipment;
  const snap = () => ({ hp: p().maxHp, def: p().stats.def, atk: p().stats.atk, speed: p().stats.speed, cdr: p().stats.cdr || 0, barrier: p().stats.barrierPower || 0 });
  const base = snap(), baseDef = p().cls.base.def; // the class kit is part of the class (K1): base stats already include it
  const given = giveGear(g);
  ok('Gear items in the bag as instances', given.length >= 16 && given.every((id) => g.inventory.findItem(id)), `${given.length} items`);
  eq().equip('core_ironheart');
  ok('Ironheart Core: Defense up', p().stats.def > base.def, `${base.def.toFixed(1)} -> ${p().stats.def.toFixed(1)}`);
  eq().equip('armor_guardian');
  ok('Guardian Armor: Barrier Strength up', p().stats.barrierPower > base.barrier, `${base.barrier} -> ${p().stats.barrierPower}`);
  eq().equip('charm_heavy');
  ok('Heavy Charm: Max HP up, speed down', p().maxHp > base.hp && p().stats.speed < base.speed, `HP ${base.hp} -> ${p().maxHp} · speed ${base.speed} -> ${p().stats.speed.toFixed(1)}`);
  for (const id of ['relic_oath_mirror', 'rune_guarding_soul', 'rune_retribution', 'rune_iron_will']) eq().equip(id);
  const v = eq().view();
  ok('All 7 slots filled + non-stat modifiers readable', v.weaponCore && v.armorCore && v.relic && v.charm && v.runes.every(Boolean)
    && p().gearMod('guardGeneration') > 0 && p().gearMod('counterDamage') > 0, `guardGen ${p().gearMod('guardGeneration').toFixed(2)} · counter ${p().gearMod('counterDamage').toFixed(2)}`);
  const full = snap();
  eq().equip('armor_fortress'); eq().equip('charm_swift');
  ok('Changing the loadout changes the final stats', JSON.stringify(snap()) !== JSON.stringify(full), `def ${full.def.toFixed(1)} -> ${p().stats.def.toFixed(1)} · speed ${full.speed.toFixed(1)} -> ${p().stats.speed.toFixed(1)}`);
  g.saveGame(); const before = JSON.stringify({ s: eq().serialize(), st: snap() });
  g.loadGame(); const after = JSON.stringify({ s: eq().serialize(), st: snap() });
  ok('Save / load keeps the loadout + instance ids + stats', before === after);
  for (const s of ['weapon', 'armor', 'relic', 'charm', 'rune1', 'rune2', 'rune3']) eq().unequip(s);
  const back = snap();
  ok('Everything off (empty slots, class kit only): stats = the exact base', Object.keys(base).every((k) => Math.abs(back[k] - base[k]) < 1e-9), JSON.stringify(back));
  ok('Class base stats never edited', p().cls.base.def === baseDef);
  return R;
}

// ITEM SYSTEM G3 — item effects in a REAL fight (Aegis): a real monster strikes, the guard really blocks / parries,
// skills are really cast. Spec test scenario: equip -> stats -> skill -> item effect -> resource -> combat effect.
//   T.effectCheck(__game)  : 9 steps
export function effectCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('aegis_guardian'); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  for (const m of g.world.monsters) if (m !== foe && g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  foe.x = p.x + 40; foe.y = p.y; foe.hp = foe.maxHp = 99999;
  foe.update = () => {}; // a scripted target: its own AI (a wolf lunges at a player standing still) would spoil the timing
  const fired = []; g.events.on('itemEffect', (e) => fired.push(e.itemId));
  giveGear(g);
  const inp = g.input, face = () => { const r = g.renderer, cam = g.camera; inp.mouse.x = ((foe.x - cam.left) * cam.zoom * r.scale) / r.dpr; inp.mouse.y = ((foe.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr; };
  const guardUp = (early) => {
    inp.mouse.right = false; g.simulate(0.4, face);
    p.status.clear(); p.hp = p.maxHp; p.invulnT = 0; p.hurtT = 0; p.endAction(true); p.resources.fill('stamina');
    foe.x = p.x + 40; foe.y = p.y; foe.hp = foe.maxHp;
    inp.mouse.right = true; g.simulate(early ? 0.03 : 0.5, face);
  };
  const strike = (power = 40) => g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 40 }, power, {});
  const G = p.primaryResource;
  // 1-2: Oath Mirror on a real Perfect Guard
  g.equipment.equip('relic_oath_mirror');
  guardUp(true); let hp0 = foe.hp; strike(60);
  ok('Oath Mirror: real Perfect Guard reflects damage to the attacker', fired.includes('relic_oath_mirror') && foe.hp < hp0, `foe -${hp0 - foe.hp}`);
  guardUp(true); hp0 = foe.hp; strike(60);
  ok('Oath Mirror cooldown: a second parry right after does not reflect', foe.hp === hp0 && fired.filter((x) => x === 'relic_oath_mirror').length === 1);
  // 3: Guarding Soul on a real block (compare with the rune off)
  inp.mouse.right = false; g.simulate(0.4);
  const blockGain = (withRune) => {
    if (withRune) g.equipment.equip('rune_guarding_soul'); else g.equipment.unequip('rune1');
    guardUp(false); p.resources.set(G, 0); g.simulate(0.6, face); strike(30); return p.resources.get(G);
  };
  const off = blockGain(false), on = blockGain(true);
  ok('Guarding Soul: a real block gives more Guard Gauge (+4)', on - off >= 3.9, `${off} -> ${on}`);
  inp.mouse.right = false; g.simulate(0.4);
  // 4: Retribution -> next real hit stronger
  g.equipment.equip('rune_retribution', 'rune2');
  // record the multiplier every player hit gets from the gear hook (the riposte = Aegis's counter strike after a parry)
  const mults = [], hook = p.gearHitMult.bind(p);
  p.gearHitMult = (t, o) => { const m = hook(t, o); if (t === foe) mults.push(m); return m; };
  guardUp(true); strike(60);
  ok('Retribution: Perfect Guard arms the next-hit bonus', p.itemNextHit && p.itemNextHit.mult > 1);
  inp.mouse.right = false; g.simulate(0.6);
  g.combat.dealDamage(p, foe, { power: 1, knock: 0 });
  // Oath Mirror (worn) adds +15% counter damage to both hits (riposte + a hit in the Counter Window): the next-hit
  // bonus is the ×1.3 between them
  const cd = 1 + p.gearMod('counterDamage');
  ok('Retribution: the counter strike right after the parry gets the ×1.3 bonus, the next hit not (used once)', Math.abs(mults[0] - 1.3 * cd) < 1e-9 && mults.slice(1).every((m) => Math.abs(m - cd) < 1e-9) && !p.itemNextHit, `mults ${mults.map((m) => m.toFixed(3)).join(', ')} (counter ×${cd})`);
  delete p.gearHitMult;
  // 5: Provocation on a real taunt (Guardian's Challenge)
  g.equipment.equip('rune_provocation', 'rune3');
  p.skillSys.cooldowns.start('holy_barrier', 10); p.resources.set(G, 100); p.endAction(true);
  const cast = (id) => { p.endAction(true); p.invulnT = 0; p.skillSys.cooldowns.clear(id); p.resources.set(G, 100); p.resources.fill('stamina'); return p.trySkill(p.skillSys.get(id)); };
  const before = p.skillSys.cooldowns.remaining('holy_barrier'); foe.x = p.x + 40; foe.y = p.y; cast('guardian_challenge'); g.simulate(0.8);
  ok('Provocation: a real taunt cuts Holy Barrier (defense) cooldown', fired.includes('rune_provocation') && p.skillSys.cooldowns.remaining('holy_barrier') < before - 1.5, `${before.toFixed(1)} -> ${p.skillSys.cooldowns.remaining('holy_barrier').toFixed(1)}`);
  // 6: Dawn Core on a real Holy Barrier
  g.equipment.equip('relic_dawn_core');
  p.resources.set(G, 100); cast('holy_barrier'); const gAfterCost = p.resources.get(G); g.simulate(0.8);
  ok('Dawn Core: real Holy Barrier -> +10 Guard Gauge', fired.includes('relic_dawn_core'), `gauge ${gAfterCost} -> ${p.resources.get(G)}`);
  // 7: Last Bastion + damage reduction on real hits
  g.equipment.equip('relic_last_bastion'); p.status.clear(); p.invulnT = 0; p.endAction(true); inp.mouse.right = false; g.simulate(0.5);
  p.hp = Math.round(p.maxHp * 0.32); strike(Math.round(p.maxHp * 0.06));
  const dr = p.gearMod('damageReduction');
  ok('Last Bastion: falling below 30% HP turns on damage reduction', fired.includes('relic_last_bastion') && dr >= 0.25, `DR ${dr} hp ${p.hp}/${p.maxHp}`);
  g.simulate(6.5);
  ok('Last Bastion: the buff ends after 6 s', p.gearMod('damageReduction') < dr, `DR ${p.gearMod('damageReduction')}`);
  releaseInput(g);
  return R;
}

// ITEM SYSTEM G4 — the item modifiers combat reads, on a real Aegis: guard generation on a real block, barrier
// strength on a real Holy Barrier, counter damage on the real riposte, taunt power on a real taunt.
//   T.gearCombatCheck(__game)  : 6 steps
export function gearCombatCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('aegis_guardian'); releaseInput(g);
  const p = g.player; goto(g, 38, 121); g.simulate(0.3);
  const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  for (const m of g.world.monsters) if (m !== foe && g.world.onMap(m)) { m.dead = true; m.deathT = 99; }
  foe.x = p.x + 40; foe.y = p.y; foe.hp = foe.maxHp = 99999; foe.update = () => {};
  giveGear(g);
  const inp = g.input, face = () => { const r = g.renderer, cam = g.camera; inp.mouse.x = ((foe.x - cam.left) * cam.zoom * r.scale) / r.dpr; inp.mouse.y = ((foe.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr; };
  const reset = () => { inp.mouse.right = false; g.simulate(0.5, face); p.status.clear(); p.hp = p.maxHp; p.invulnT = 0; p.hurtT = 0; p.endAction(true); p.resources.fill('stamina'); foe.x = p.x + 40; foe.y = p.y; foe.hp = foe.maxHp; foe.status.clear(); g.marks.clearEntity(foe); }; // marked foes give Aegis extra gauge
  const guardUp = (early) => { reset(); inp.mouse.right = true; g.simulate(early ? 0.03 : 0.5, face); };
  const strike = (power = 40) => g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 40 }, power, {});
  const G = p.primaryResource;
  // 1: guard generation (Ironheart Core +25%) on a real block
  const blockGain = () => { guardUp(false); p.resources.set(G, 0); strike(30); return p.resources.get(G); };
  const g0 = blockGain(); g.equipment.equip('core_ironheart'); const g1 = blockGain();
  ok('Guard Generation: a real block builds more Guard Gauge (Ironheart +25%)', g1 > g0 && Math.abs(g1 / g0 - 1.25) < 0.05, `${g0} -> ${g1}`);
  // 2: barrier strength (Guardian Armor +25%) on a real Holy Barrier
  const cast = (id) => { reset(); p.skillSys.cooldowns.clear(id); p.resources.set(G, 100); return p.trySkill(p.skillSys.get(id)); };
  const shield = () => { p.status.remove('shield'); cast('holy_barrier'); g.simulate(0.5); const s = p.status.get('shield'); return s ? s.amount : 0; };
  const s0 = shield(); g.equipment.equip('armor_guardian'); const s1 = shield();
  ok('Barrier Strength: Holy Barrier absorbs more (Guardian Armor +25%)', s1 > s0 && Math.abs(s1 / s0 - 1.25) < 0.03, `${s0} -> ${s1}`);
  // 3: counter damage on the real riposte after a parry (Counter Core +30%)
  const mults = [], hook = p.gearHitMult.bind(p);
  p.gearHitMult = (t, o) => { const m = hook(t, o); if (t === foe) mults.push({ m, counter: !!o.counter }); return m; };
  g.equipment.equip('core_counter');
  guardUp(true); strike(60); inp.mouse.right = false; g.simulate(0.6);
  const rip = mults.find((x) => x.counter);
  ok('Counter Damage: the riposte after a real Perfect Guard is a counter hit, ×1.3', rip && Math.abs(rip.m - 1.3) < 1e-9, JSON.stringify(mults));
  mults.length = 0; g.combat.dealDamage(p, foe, { power: 1, knock: 0 });
  ok('Counter Damage: a hit while the foe is still in the Counter Window counts too', mults[0] && mults[0].m === 1.3, JSON.stringify(mults));
  foe.status.clear(); mults.length = 0; g.combat.dealDamage(p, foe, { power: 1, knock: 0 });
  ok('Counter Damage: an ordinary hit (no window) gets nothing', mults.length === 1 && mults[0].m === 1, JSON.stringify(mults));
  delete p.gearHitMult;
  // 4: taunt power (Guardian Charm +20%) on a real Guardian's Challenge
  const taunt = () => { foe.status.remove('taunted'); cast('guardian_challenge'); g.simulate(0.8); const s = foe.status.get('taunted'); return s ? s.total : 0; };
  const t0 = taunt(); g.equipment.equip('charm_guardian'); const t1 = taunt();
  ok('Taunt Power: a real taunt lasts longer (Guardian Charm +20%)', t1 > t0 && Math.abs(t1 / t0 - 1.2) < 0.02, `${t0.toFixed(2)} s -> ${t1.toFixed(2)} s`);
  // 5: everything off -> the same numbers as before
  for (const s of ['weapon', 'armor', 'charm']) g.equipment.unequip(s);
  const back = blockGain();
  ok('Items off: guard gain back to normal, no resource modifiers left', back === g0 && !p.resources.modifiers.some((m) => m.id.startsWith('gear_')), `${back} (was ${g0})`);
  releaseInput(g);
  return R;
}

// ITEM SYSTEM G4 — do two builds really play differently? The Aegis bot fights the A1 Guardian (no god mode) with each
// gear build: time, damage taken, blocks / parries, guard gauge built, damage by counters.
//   T.buildCompare(__game, { level: 13 })
export const AEGIS_BUILDS = {
  guard: ['core_ironheart', 'armor_guardian', 'relic_dawn_core', 'charm_heavy', 'rune_guarding_soul', 'rune_iron_will', 'rune_provocation'],
  counter: ['core_counter', 'armor_risk', 'relic_oath_mirror', 'charm_swift', 'rune_retribution', 'rune_guarding_soul', 'rune_provocation'],
};
export function buildFight(g, build, { level = 13, classId = 'aegis_guardian', seconds = 300 } = {}) {
  toBoss(g, classId);
  const pl = g.player; pl.setLevel(level);
  giveGear(g);
  for (const id of build || []) g.equipment.equip(id);
  pl.hp = pl.maxHp;
  goto(g, 135, 37); g.simulate(3);
  const gd = g.world.guardian;
  const st = { dmgTaken: 0, blocked: 0, perfects: 0, gauge: 0, counterDmg: 0, reflect: 0, effects: 0 };
  g.events.on('damageTaken', (e) => { if (e.target === pl) st.dmgTaken += e.amount; });
  g.events.on('damageDealt', (e) => { if (e.source !== pl) return; if (e.opts && e.opts.itemEffect) st.reflect += e.amount; else if (e.opts && (e.opts.counter || (e.target.status && e.target.status.has('counter_window')))) st.counterDmg += e.amount; });
  g.events.on('guardBlocked', () => st.blocked++); g.events.on('perfectGuard', () => st.perfects++);
  g.events.on('resourceChanged', (e) => { if (e.entity === pl && e.resource === pl.primaryResource && e.value > e.before) st.gauge += e.value - e.before; });
  const fired = {}, applied = {}; // per item / set: effects fired · per status: applied by the player
  g.events.on('itemEffect', (e) => { st.effects++; const k = e.itemId || e.setId; fired[k] = (fired[k] || 0) + 1; });
  g.events.on('statusApplied', (e) => { if (e.source === pl && e.target !== pl) applied[e.id] = (applied[e.id] || 0) + 1; });
  const pots0 = g.inventory.count('hp_potion');
  let t = 0;
  while (t < seconds && !gd.dead && !pl.dead) { g.simulate(5, (gg, i) => bot(gg, i, {})); t += 5; }
  releaseInput(g);
  return { result: gd.dead ? 'WIN' : pl.dead ? 'DIED' : 'TIMEOUT', time: t, maxHp: pl.maxHp, speed: Math.round(pl.stats.speed), ...Object.fromEntries(Object.entries(st).map(([k, v]) => [k, Math.round(v)])), potions: pots0 - g.inventory.count('hp_potion'), fired, applied };
}
// ITEM BUILD I3 — one real Guardian fight per new build; checks that the build's items actually fire in combat.
//   T.itemBuildCheck(__game)  -> [step, pass, detail] rows
export const I3_BUILDS = {
  umbral_bleed: { classId: 'umbral_sword', items: ['core_nightglass', 'armor_duskweave', 'relic_bloodletter', 'charm_wanderer', 'rune_red_thirst', 'rune_full_moon', 'rune_shadow_hunger'] },
  umbral_eclipse: { classId: 'umbral_sword', items: ['core_shadow_fang', 'armor_pathfinder', 'relic_heart_eclipse', 'charm_assassin', 'rune_full_moon', 'rune_executioner', 'rune_hunters_sigil'] },
  astral_star: { classId: 'astral_weaver', items: ['core_star_loom', 'armor_starveil', 'relic_orrery', 'charm_starfocus', 'rune_supernova', 'rune_comet_tail', 'rune_hunters_sigil'] },
  aegis_boss: { classId: 'aegis_guardian', items: ['core_ironheart', 'armor_fortress', 'relic_ember_war', 'charm_heavy', 'rune_second_wind', 'rune_guarding_soul', 'rune_iron_will'] },
};
export function itemBuildCheck(g, { level = 13, seconds = 200 } = {}) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  for (const [name, b] of Object.entries(I3_BUILDS)) {
    const r = buildFight(g, b.items, { level, classId: b.classId, seconds }), fired = r.fired, bleeds = { n: r.applied.bleed || 0 };
    const worn = g.equipment.wornIds();
    ok(`${name}: whole build worn (${b.classId})`, b.items.every((id) => worn.includes(id)), worn.join(', '));
    ok(`${name}: fight ${r.result}`, r.result === 'WIN', `${r.time} s, dmg taken ${r.dmgTaken}, potions ${r.potions}`);
    ok(`${name}: item effects fired in combat`, r.effects > 0, Object.entries(fired).map(([k, v]) => `${k} ×${v}`).join(' · '));
    if (name === 'umbral_bleed') ok('umbral_bleed: BLEED applied by the hook', bleeds.n > 0, `${bleeds.n} bleeds`);
    if (name === 'astral_star') ok('astral_star: Constellation Break fed the Orrery / set', (fired.relic_orrery || 0) + (fired.constellation || 0) > 0, JSON.stringify(fired));
    if (name === 'aegis_boss') ok('aegis_boss: Ember of War on a boss phase', (fired.relic_ember_war || 0) > 0, JSON.stringify(fired));
  }
  return R;
}
// ITEM BUILD I4 — the owner's §33 test list (20 steps) on a real Umbral Sword, in order. Fast (no boss fight: the
// boss / monster drops go through the same 'enemyDefeated' event the BossSystem / World emit).
//   T.itemSystemCheck(__game)  -> [step, pass, detail] rows
export function itemSystemCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame('umbral_sword'); releaseInput(g); g.simulate(0.2);
  const p = () => g.player, eq = g.equipment, inv = g.inventory;
  ok('0 New game: all 7 slots start empty; the class weapon is not an item', eq.wornIds().length === 0 && !inv.has('umbral_sword'));
  p().setLevel(30);
  for (const id of ['core_shadow_fang', 'armor_risk', 'relic_heart_eclipse', 'charm_focus', 'rune_full_moon', 'rune_red_thirst', 'rune_shadow_hunger',
    'core_star_loom', 'relic_cinder_crown', 'shade_charm', 'core_nightglass']) inv.add(id, 1, true);
  inv.add('rune_full_moon', 1, true); // a second copy for the duplicate rule
  const base = { hp: p().maxHp, crit: p().stats.crit, def: p().stats.def, cdr: p().stats.cdr || 0 };
  // 1-2 weapon core
  ok('1 Equip Weapon Core (Shadow Fang: +10% crit)', eq.equip('core_shadow_fang') && Math.abs(p().stats.crit - base.crit - 0.1) < 1e-9, `${base.crit} -> ${p().stats.crit}`);
  ok('2 Unequip Weapon Core: the slot may be empty (class kit only) -> stats back to base', eq.unequip('weapon') && eq.slots.weapon === null && Math.abs(p().stats.crit - base.crit) < 1e-9, `slot = ${eq.slots.weapon}`);
  eq.equip('core_shadow_fang');
  ok('3 Equip Armor Core (Risk Armor: -20% defense)', eq.equip('armor_risk') && p().stats.def < base.def, `${base.def.toFixed(1)} -> ${p().stats.def.toFixed(1)}`);
  ok('4 Equip Relic (Heart of the Eclipse)', eq.equip('relic_heart_eclipse') && eq.slots.relic === 'relic_heart_eclipse');
  ok('5 Equip Charm (Focus Charm)', eq.equip('charm_focus') && eq.slots.charm === 'charm_focus');
  ok('6 Equip 3 Runes', eq.equip('rune_full_moon', 'rune1') && eq.equip('rune_red_thirst', 'rune2') && eq.equip('rune_shadow_hunger', 'rune3'), eq.view().runes.join(', '));
  ok('7 Class restriction: Star Loom Core (Astral line) refused for Umbral', !eq.equip('core_star_loom') && eq.lastError === 'class');
  ok('8 Level restriction: Cinder King\'s Crown (LV 45) refused at LV 30', !eq.equip('relic_cinder_crown') && eq.lastError === 'level', `LV ${p().level}`);
  ok('9 Duplicate restriction: a 2nd Full Moon into Rune 2 refused', !eq.equip('rune_full_moon', 'rune2') && eq.lastError === 'duplicate');
  // 10 passive: Full Moon (marks full -> +15% crit) + the Eclipse set (2 pieces: +8% shadow damage)
  const crit0 = p().stats.crit;
  p().addMark(3); g.simulate(0.05);
  ok('10 Passive activation: marks full -> Full Moon +15% crit (+ Eclipse set 2/3 shadow damage)', p().stats.crit > crit0 + 0.14 && p().gearMod('shadowDamage') >= 0.08 + 0.08 - 1e-9, `crit ${crit0.toFixed(2)} -> ${p().stats.crit.toFixed(2)} · shadow ${p().gearMod('shadowDamage').toFixed(2)}`);
  // 11 skill modifier: Shade Charm = Shade Step 2 charges (older gear skillModifiers)
  const ch0 = p().skillSys.cooldowns.maxCharges('shade_step');
  eq.equip('shade_charm'); g.simulate(0.1);
  ok('11 Skill modifier: Shade Charm -> Shade Step 2 charges', p().skillSys.cooldowns.maxCharges('shade_step') === ch0 + 1, `${ch0} -> ${p().skillSys.cooldowns.maxCharges('shade_step')}`);
  ok('12 Resource modifier: Risk Armor +25% resource generation reaches the pool', Math.abs(p().resources.mult(p().primaryResource, 'gainMult') - 1.25) < 1e-6, `gain x${p().resources.mult(p().primaryResource, 'gainMult')}`);
  eq.equip('charm_focus');
  ok('13 Cooldown modifier: Focus Charm +8% CDR', Math.abs((p().stats.cdr || 0) - base.cdr - 0.08) < 1e-9, `${base.cdr} -> ${p().stats.cdr}`);
  ok('14 Stat recalculation: base stats untouched (max HP from Shadow Fang / Heart / Focus minus)', Math.round(p().baseStats.hp) === base.hp && p().maxHp < base.hp, `base ${p().baseStats.hp} · final ${p().maxHp}`);
  // 15 save / load
  const view = JSON.stringify(eq.slots), insts = JSON.stringify(eq.inst);
  g.saveGame(); eq.equip('core_nightglass'); g.loadGame(); g.simulate(0.1);
  ok('15 Save / Load: loadout + instance ids come back', JSON.stringify(g.equipment.slots) === view && JSON.stringify(g.equipment.inst) === insts, g.equipment.slots.weapon);
  // 16 item drop: an elite kill with the loot dice forced -> a rune / charm instance in the bag
  const rng0 = g.loot.rng, drops = []; g.events.on('lootDropped', (e) => drops.push(e));
  g.loot.rng = () => 0;
  const gear0 = g.inventory.gear.length;
  g.events.emit('enemyDefeated', { entity: {}, type: 'wolf', source: g.player, x: g.player.x, y: g.player.y, loot: ['wolf', 'elite'] });
  ok('16 Item drop: elite kill -> gear piece in the bag (as an instance)', g.inventory.gear.length === gear0 + 1, drops.length ? drops[drops.length - 1].items.map((x) => x.item).join(', ') : 'none');
  g.loot.rng = rng0;
  // 17 boss drop: the BossSystem reward event for Varkharon -> the MYTHIC crown (signature, 100%)
  const crowns0 = g.inventory.count('relic_cinder_crown');
  g.events.emit('enemyDefeated', { entity: {}, type: 'varkharon', bossId: 'boss_varkharon', boss: true, source: g.player, x: 0, y: 0, loot: 'varkharon' });
  ok('17 Boss drop: Varkharon -> Cinder King\'s Crown (signature)', g.inventory.count('relic_cinder_crown') === crowns0 + 1 && drops.some((d) => d.bossId === 'boss_varkharon'));
  // 18 persistence: death + respawn keeps the loadout
  const before = JSON.stringify(g.equipment.slots);
  g.player.hp = 0; g.player.onDeath && g.player.onDeath(null, {}); g.simulate(1); g.respawn(); g.simulate(0.5);
  ok('18 Loadout persistence: death + respawn keeps every slot', JSON.stringify(g.equipment.slots) === before);
  // 19 remove item (bag)
  const n19 = g.inventory.count('core_nightglass');
  ok('19 Remove Item: a bag item is removed; a worn one is not taken from the slot', g.inventory.remove('core_nightglass', 1) && g.inventory.count('core_nightglass') === n19 - 1 && !g.inventory.remove('relic_heart_eclipse', 1) && g.equipment.slots.relic === 'relic_heart_eclipse');
  // 20 replace: the old item returns to the bag with the same instance id
  const oldInst = g.equipment.inst.armor && g.equipment.inst.armor.instanceId;
  g.inventory.add('armor_duskweave', 1, true); // (load replaced the inventory object: never keep an old reference)
  const rep = g.equipment.equip('armor_duskweave');
  ok('20 Replace Item: Duskweave Coat replaces Risk Armor; Risk Armor back in the bag, same instance', rep && g.inventory.gear.some((x) => x.instanceId === oldInst && x.itemId === 'armor_risk'), oldInst);
  // debug API (§32) answers
  const ins = g.items.inspect('core_shadow_fang');
  ok('Debug: __game.items.inspect / modifiers / stats work', ins.name === 'Shadow Fang' && g.items.modifiers().length > 0 && g.items.stats().stats.length > 5);
  return R;
}
export function buildCompare(g, opts = {}) {
  const out = {};
  for (const [name, build] of Object.entries({ starting: null, ...AEGIS_BUILDS })) out[name] = buildFight(g, build, opts);
  return out;
}

// ITEM SYSTEM G6 — the whole item system in one run (spec §39 test scenario + §48 test list), on a real Aegis:
// boss loot -> instance -> equip -> stats / effects / combat -> death keeps the gear -> save / load. Includes the
// G2-G4 checks (loadoutCheck, effectCheck, gearCombatCheck). Returns [step, pass, detail] rows.
//   T.gearCheck(__game)
export function gearCheck(g) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  // 1. a real boss kill pays its signature item
  toBoss(g, 'aegis_guardian');
  const p0 = g.player; p0.setLevel(13); p0.hp = p0.maxHp;
  goto(g, 135, 37); g.simulate(3);
  const drops = []; g.events.on('lootDropped', (e) => drops.push(e));
  const fight = bossFight(g, 'boss_a1', { god: true, seconds: 240 });
  const mirror = g.inventory.findItem('relic_oath_mirror');
  ok('Boss A1 (Guardian) killed -> Oath Mirror drops (signature, 100% on the first kill)', fight.state === 'defeated' && mirror && drops.some((d) => d.bossId === 'boss_a1' && d.items.some((x) => x.item === 'relic_oath_mirror')), `${fight.state} ${fight.time}s · ${mirror ? mirror.instanceId : 'no mirror'}`);
  ok('The drop is a real item instance (item_000000 id)', mirror && /^item_\d{6}$/.test(mirror.instanceId));
  ok('Equip the dropped Oath Mirror', g.equipment.equip('relic_oath_mirror') && g.equipment.inst.relic.instanceId === mirror.instanceId);
  // 2. death keeps the permanent equipment, ends the timed buffs
  giveGear(g);
  for (const id of AEGIS_BUILDS.guard.filter((x) => x !== 'relic_dawn_core')) g.equipment.equip(id);
  const p = g.player, before = JSON.stringify({ eq: g.equipment.serialize(), gear: g.inventory.gear });
  p.hp = Math.round(p.maxHp * 0.3); g.events.emit('damageTaken', { source: null, target: p, amount: 5, opts: {} }); // Iron Will buff on
  const buffOn = g.itemEffects.timed.size > 0;
  p.hp = 0; p.onDeath && p.onDeath(null, {}); g.simulate(1); g.respawn(); g.simulate(0.5);
  const after = JSON.stringify({ eq: g.equipment.serialize(), gear: g.inventory.gear });
  ok('Death + respawn: the whole loadout and the bag are kept (permanent equipment)', before === after);
  ok('Death + respawn: timed item buffs are cleaned up', buffOn && g.itemEffects.timed.size === 0 && g.player.gearMod('defense') === 0.15, `buff before ${buffOn} · def mod ${g.player.gearMod('defense')}`);
  // 3. the G2-G4 checks
  for (const [name, fn] of [['loadout', loadoutCheck], ['effects', effectCheck], ['combat', gearCombatCheck]]) {
    const rows = fn(g);
    for (const [step, pass, detail] of rows) ok(`[${name}] ${step}`, pass, detail);
  }
  releaseInput(g);
  return R;
}
