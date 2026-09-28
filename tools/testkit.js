// Browser-side test harness (import from the console: await import('/tools/testkit.js')).
// Drives the real game through window.__game using the deterministic simulate() hook.
const TILE = 32;

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
      // guard classes raise the guard toward the attacker at the last moment (-> Perfect Guard)
      if (p.cls.guard && t.owner && !t.owner.dead) {
        const r = g.renderer, cam = g.camera;
        inp.mouse.x = ((t.owner.x - cam.left) * cam.zoom * r.scale) / r.dpr;
        inp.mouse.y = ((t.owner.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
        inp.down.add('KeyQ');
        // big attackers land their damage a few frames after the telegraph resolves: keep the shield up
        p._botGuard = { until: g.time + rem + 0.35, x: t.owner.x, y: t.owner.y };
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
    if (d > 220) press(Math.atan2(tgt.y - p.y, tgt.x - p.x));
    else if (d < 100) press(Math.atan2(p.y - tgt.y, p.x - tgt.x));
    if (d < 280 && i % (opts.apm || 5) === 0) {
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
export function mapTour(g, classId = 'umbral_sword') {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  const w = g.world, mm = w.mapManager, p = g.player;
  w.transitions.autoConfirm = true; // boss gate asks first — the tour just walks through
  ok('New Game starts on Lumina', w.mapId === 'lumina');
  for (const f of ['ruinsGate', 'logBridge', 'bramble', 'gateOpened', 'guardianDefeated']) w.setFlag(f);
  for (const b of g.bosses.list) g.worldProgress.defeatBoss(b.id); // V2.2 boss gates: every road open for the tour
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
  p.setLevel(10); p.hp = p.maxHp; goto(g, 135, 37); g.simulate(5.5, () => { p.hp = p.maxHp; });
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
  g.player.setLevel(10); g.player.hp = g.player.maxHp;
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
  const r1 = bossFight(g, 'mini_hollow_fang', { level: 4 });
  ok('Hollow Fang defeated: trophy + EXP + gold, no map unlocked', r1.state === 'defeated' && g.inventory.count('hollow_fang_pelt') === 1 && p.gold > before.gold && !wp.isMapUnlocked('a2'), JSON.stringify(r1));
  const grukk = g.bosses.get('mini_grukk');
  goto(g, 36.5, 64.5); walk(g, 'KeyA', 1.4);
  const r2 = bossFight(g, 'mini_grukk', { level: 7 });
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
  const r3 = bossFight(g, 'boss_a1', { level: 10, seconds: 420 });
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
  const gob = spawn('goblin', 40, 0);
  const tHit = timeAttack(gob, 'slam', false);
  g.simulate(0.5); gob.status.remove('counter_window');
  const tMiss = timeAttack(gob, 'slam', true);
  const slam = gob.def.attacks.find((a) => a.id === 'slam');
  ok('Goblin slam that misses: MISS event + much longer recovery (bruiser)', missed.some((e) => e.attacker === gob) && tMiss > tHit + slam.recover * 0.8, `hit ${tHit.toFixed(2)}s / miss ${tMiss.toFixed(2)}s`);
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
    const a = (i / 5) * Math.PI * 2, m = new any.constructor(g, i < 3 ? 'wolf' : 'goblin', p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 70, {});
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
  toBoss(g, 'umbral_sword'); g.player.setLevel(10);
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
  p.setLevel(10); p.hp = p.maxHp;
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
    for (let t = 0; t < seconds; t += 0.1) {
      g.simulate(0.1, opts.bot ? (gg, i) => bot(gg, i, { god: opts.god }) : () => { if (opts.god !== false) p.hp = p.maxHp; if (opts.move) { p.x += Math.sin(g.time * 1.3) * 3; } });
      if (m.status.has('vulnerable')) rep.vuln++;
      if (p.status.has('slow')) rep.slowed++;
      if (m.dead || used.size >= (opts.until || 99)) break;
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
  const st = lab('rock_rhino', 30, { until: 3 });
  ok('Crag Rhino: Tremor Stomp slows', st.slowed > 0 || !st.used.has('stomp'), `slowed frames=${st.slowed} used=${[...st.used]}`);
  st.m.dead = true; st.m.removed = true;
  // loot + EXP on a kill
  const gold0 = p.gold, exp0 = p.exp + p.level * 1e6;
  const k = lab('armadillo', 0.1, {}); k.m.hp = 1; g.combat.dealDamage(p, k.m, { power: 99 }); g.simulate(1);
  ok('Kill: EXP + gold', p.gold > gold0 && p.exp + p.level * 1e6 > exp0, `gold +${p.gold - gold0}`);
  // real fight: the River Fords pack (2 armadillos + a rhino), LV 10, the bot dodges, no god mode
  releaseInput(g); for (const m of w.monsters) { m.aggro = false; }
  p.setLevel(10); p.hp = p.maxHp; g.inventory.add('hp_potion', 3, true);
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
export function a2BossCheck(g, classId = 'umbral_sword', { god = true, level = 13, seconds = 300 } = {}) {
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
