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
    if (p.marks >= 3) inp.pushBuffer('break');
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

// Full regression of the V1.5 test sequence. Returns [step, pass, detail] rows.
export function playthrough(g, classId) {
  const R = [], ok = (step, pass, detail = '') => R.push([step, !!pass, detail]);
  g.newGame(classId);
  let w = g.world;
  const c = counters(g);
  ok('Lumina Village', w.map.zoneAt(g.player.x, g.player.y) === 1);
  use(g, 'npc_elder'); g.ui.panels.dialogueAction('quest:whispers');
  ok('Quest accepted', g.quests.isActive('whispers'));
  goto(g, 47, 150); g.simulate(1);
  ok('Whispering Forest', g.quests.active.whispers.done.enter);
  for (const [x, y] of [[38, 121], [20, 112], [54, 80], [66, 62]]) { goto(g, x, y); fight(g, 20, { god: true, until: () => g.quests.active.whispers.done.wolves }); if (g.quests.active.whispers.done.wolves) break; }
  // keep fighting until the combat loop has produced a Perfect Dodge and a Shadow Break
  const camps = [[29, 60], [66, 62], [54, 80], [86, 70], [18, 80], [58, 104], [110, 82]];
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
  g.player.level = 13; g.player.recomputeStats(); g.player.hp = g.player.maxHp;
  goto(g, 135, 37); g.simulate(3);
  const gd = w.guardian, phases = new Set();
  for (let s = 0; s < 80 && !gd.dead; s++) { g.simulate(5, (gg, i) => bot(gg, i, { god: true })); phases.add(gd.phase); }
  ok('Boss phases 1-2-3', phases.has(1) && phases.has(2) && phases.has(3), [...phases].join(','));
  ok('Weak windows used', c.weak > 0, `weak=${c.weak}`);
  ok('Guardian defeated', gd.dead);
  g.simulate(9);
  ok('World State changed', w.state.flags.guardianDefeated && w.map.style.restored && !w.map.isSolid(32, 37));
  goto(g, 32, 40); for (let y = 40; y >= 26; y--) { g.player.y = y * 32; g.simulate(0.08); }
  ok('Ancient Valley revealed', w.currentZone === 6 && g.quests.isDone('valley'));
  ok('Save', g.save.save());
  const lvl = g.player.level;
  g.loadGame(); w = g.world;
  ok('Load', g.world.state.flags.guardianDefeated && g.player.level === lvl && g.world.currentZone !== undefined);
  return R;
}
