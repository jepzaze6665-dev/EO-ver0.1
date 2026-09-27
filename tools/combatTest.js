// PHASE 7 — COMBAT TEST (browser). Runs the V2 test requirements against the REAL game for every
// starting class, plus a balance report. From the dev-tools console:
//   const C = await import('/tools/combatTest.js');
//   const r = C.runAll(__game);  console.table(r.rows);  console.table(r.balance);
// Unit tests (node tools/tests/run.mjs) check each system in isolation; this file checks that the
// systems still behave when wired together inside the running game loop.
import { bot, releaseInput, goto, toBoss } from './testkit.js';
import { STARTING_CLASSES } from '../src/skills/classes.js';

const STEP = 1 / 60;

// aim the mouse at a world point
function aim(g, x, y) {
  const r = g.renderer, cam = g.camera;
  g.input.mouse.x = ((x - cam.left) * cam.zoom * r.scale) / r.dpr;
  g.input.mouse.y = ((y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
}
// stand in front of the middle training dummy, clean state
// wait until the current action is over (slow-motion ultimates last longer than their duration)
function idle(g, max = 4) { for (let t = 0; t < max && g.player.action; t += 0.1) g.simulate(0.1); }
function atDummy(g, classId, dist) {
  g.newGame(classId);
  if (dist === undefined) dist = g.player.cls.ratings && g.player.cls.ratings.range >= 4 ? 110 : 30; // ranged vs melee reach
  releaseInput(g);
  const p = g.player, d = g.world.dummies[1];
  p.x = d.x; p.y = d.y + dist;
  g.camera.snap(p.x, p.y);
  g.simulate(0.2);
  for (const t of g.world.dummies) t.reset();
  g.marks.clearAll(); g.threads.clearAll();
  return { p, d };
}
// cast a skill through the real pipeline (SkillSystem -> action timeline -> game loop)
function cast(g, id, target) {
  const p = g.player;
  if (target) aim(g, target.x, target.y);
  g.simulate(STEP * 2, () => { if (target) aim(g, target.x, target.y); });
  const s = p.skillSys.get(id);
  const r = p.trySkill(s);
  g.simulate(0.8, () => { if (target) aim(g, target.x, target.y); });
  return r;
}

// ---------------- requirement checks (section 39 of the V2 prompt), per class
export function classChecks(g, classId) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: classId, test: name, pass: !!pass, detail });
  const log = [];
  // every newGame() creates a fresh event bus, so listeners are re-attached after each reset
  const fresh = (dist) => {
    const r = atDummy(g, classId, dist);
    log.length = 0;
    ['damageDealt', 'skillUsed', 'skillFailed', 'markTriggered', 'targetMarked', 'threadCreated', 'threadExpired', 'threadTriggered'].forEach((n) => g.events.on(n, (e) => log.push({ n, e })));
    return r;
  };
  let { p, d } = fresh();
  const cls = p.cls, rid = p.primaryResource;
  const main = p.loadout.bindings()[0].skill; // the skill on key 1

  // Damage + HP: the dummy loses exactly what the damage events report
  let hp0 = d.hp;
  g.simulate(0.9, (gg, i) => { aim(g, d.x, d.y); if (i === 0) gg.input.pushBuffer('attack'); });
  let dealt = log.filter((l) => l.n === 'damageDealt' && l.e.target === d).reduce((s, l) => s + l.e.amount, 0);
  ok('Damage applied', dealt > 0, `dealt=${dealt}`);
  ok('HP decreases exactly by damage', Math.abs((hp0 - d.hp) - dealt) < 1e-6, `hp ${hp0} -> ${d.hp}`);

  // Resource increases on hit (builder) / is spent exactly (spender)
  const r0 = p.resources.get(rid);
  ({ p, d } = fresh());
  const res0 = p.resources.get(rid);
  g.simulate(2, (gg, i) => { aim(g, d.x, d.y); if (i % 20 === 0) gg.input.pushBuffer('attack'); });
  const gained = p.resources.get(rid) - res0;
  ok('Resource increases on hit', gained > 0, `${rid} +${gained.toFixed(1)} (start ${r0})`);
  const spender = [...cls.skills, cls.special].find((s) => s.cost > 0 && !(s.requirements || []).length);
  if (spender) {
    p.resources.set(rid, 100); p.skillSys.cooldowns.clear(spender.id);
    const before = p.resources.get(rid);
    const res = p.trySkill(spender); // Player.trySkill returns true/false
    ok('Resource decreases by cost', res && Math.abs(before - p.resources.get(rid) - spender.cost) < 1e-6, `${spender.id} cost ${spender.cost}: ${before} -> ${p.resources.get(rid)}`);
    idle(g);
  }
  // never negative: spam a cost skill at 0
  const costly = [...cls.skills].find((s) => s.cost > 0 && !(s.requirements || []).length);
  p.resources.set(rid, 0); p.skillSys.cooldowns.clear(costly.id); log.length = 0;
  for (let i = 0; i < 30; i++) { p.trySkill(costly); g.simulate(STEP); }
  ok('Resource never negative', p.resources.get(rid) >= 0 && log.some((l) => l.n === 'skillFailed' && l.e.reason === 'resource'), `${rid}=${p.resources.get(rid)} fails=${log.filter((l) => l.n === 'skillFailed').length}`);

  // Cooldown + no spam: hammer skill 1 every frame for 6 s
  ({ p, d } = fresh());
  p.resources.set(rid, 100);
  g.simulate(6, (gg) => { aim(g, d.x, d.y); gg.input.pushBuffer('skill1'); p.resources.set(rid, 100); });
  const uses = log.filter((l) => l.n === 'skillUsed' && l.e.skillId === main.id).length;
  const maxUses = Math.floor(6 / main.cooldown) + 1;
  ok('Cooldown works / skill cannot be spammed', uses >= 1 && uses <= maxUses, `${main.id} cd ${main.cooldown}s: ${uses} uses in 6s (max ${maxUses})`);
  const remaining = p.skillSys.cooldowns.remaining(main.id);
  ok('Cooldown ticks down to ready', (() => { g.simulate(main.cooldown + 0.1); return p.skillSys.cooldowns.ready(main.id); })(), `remaining was ${remaining.toFixed(2)}`);

  // Marks: stack / expire / trigger
  ({ p, d } = fresh());
  if (cls.enemyMark) {
    const m = cls.enemyMark, def = g.marks.defs[m];
    cls.markTarget(p, g, d); cls.markTarget(p, g, d);
    ok('Mark stacks (up to its max)', g.marks.get(d, m) === Math.min(2, def.maxStacks), `${m}=${g.marks.get(d, m)} / max ${def.maxStacks}`);
    g.simulate(def.duration + 0.2);
    ok('Mark expires', g.marks.get(d, m) === 0, `after ${def.duration}s: ${g.marks.get(d, m)}`);
    const hpA = d.hp; log.length = 0;
    if (def.onMax === 'trigger') {
      for (let i = 0; i < def.maxStacks; i++) cls.markTarget(p, g, d);
      g.simulate(0.3);
      const trig = log.filter((l) => l.n === 'markTriggered').length;
      ok('Mark triggers at max (Constellation Break)', trig === 1 && d.hp < hpA && g.marks.get(d, m) === 0, `triggers=${trig} bonus dmg=${hpA - d.hp}`);
    } else {
      // 'hold' marks are consumed by a skill tagged consumes-marks (e.g. Guardian Slash judgment)
      const eater = cls.skills.find((s) => (s.tags || []).includes('consumes-marks') && s.type !== 'ultimate');
      ({ p, d } = fresh());
      cls.markTarget(p, g, d);
      p.resources.set(rid, 100);
      const hpB = d.hp;
      cast(g, eater.id, d);
      ok('Mark consumed by skill (bonus damage)', g.marks.get(d, m) === 0 && log.some((l) => l.n === 'damageDealt' && l.e.opts && l.e.opts.big), `${eater.id}: dmg=${hpB - d.hp}`);
    }
  } else {
    const m = p.markId, max = p.maxMarks;
    p.addMark(1); p.addMark(1);
    ok('Mark stacks', p.marks === 2, `${m}=${p.marks}`);
    p.addMark(99);
    ok('Mark capped at max', p.marks === max, `${p.marks}/${max}`);
    const spent = p.trySkill(cls.special);
    g.simulate(0.8);
    ok('Mark consumed by finisher', spent === true && p.marks === 0, `${cls.special.id} -> marks ${p.marks}`);
    p.addMark(2); g.combat.lastCombatTime = -99;
    g.simulate(g.marks.defs[m].idleDecay.delay + 0.3);
    ok('Mark decays out of combat', p.marks < 2, `marks ${p.marks}`);
  }

  // Threads: create / expire / trigger (classes that weave threads)
  if (cls.skills.some((s) => (s.tags || []).includes('thread'))) {
    ({ p, d } = fresh());
    const threadSkill = cls.skills.find((s) => s.id === 'astral_thread');
    cast(g, threadSkill.id, { x: d.x + 90, y: d.y + 30 }); // ground point next to the dummy
    ok('Thread created', p.threadCount === 1 && log.some((l) => l.n === 'threadCreated'), `threads=${p.threadCount}`);
    g.simulate(g.threads.defs.astral_thread.duration + 0.2);
    ok('Thread expires', p.threadCount === 0 && log.some((l) => l.n === 'threadExpired' && l.e.reason === 'timeout'), `threads=${p.threadCount}`);
    p.skillSys.cooldowns.clear(threadSkill.id);
    cast(g, threadSkill.id, d); // bound to the dummy
    p.resources.set(rid, 100);
    const hpB = d.hp; log.length = 0;
    const burst = cast(g, 'thread_burst');
    ok('Thread triggers (Thread Burst)', burst === true && log.some((l) => l.n === 'threadTriggered') && d.hp < hpB && p.threadCount === 0, `dmg=${hpB - d.hp}`);
  }

  // Stress: 45 s of the class bot on the 3 dummies — no NaN / infinite values, bounded objects
  ({ p, d } = fresh(140));
  let maxHit = 0, badRes = 0, badHp = 0, maxThreads = 0, maxMarks = 0;
  const t0 = performance.now();
  g.simulate(45, (gg, i) => {
    bot(gg, i, { god: true, range: 600 });
    const v = p.resources.get(rid);
    if (!(v >= 0 && v <= p.resources.max(rid))) badRes++;
    for (const t of g.world.dummies) if (!Number.isFinite(t.hp)) badHp++;
    maxThreads = Math.max(maxThreads, g.threads.count());
    maxMarks = Math.max(maxMarks, g.marks.count());
  });
  const ms = performance.now() - t0;
  for (const l of log) if (l.n === 'damageDealt') maxHit = Math.max(maxHit, l.e.amount);
  ok('No infinite damage', maxHit > 0 && maxHit < 5000 && badHp === 0, `max hit ${maxHit}`);
  ok('No infinite resource', badRes === 0, `out-of-range frames: ${badRes}`);
  ok('No runaway objects (threads / marks / particles)', maxThreads <= 32 && maxMarks <= 12 && g.vfx.particles.count() < 2000, `threads≤${maxThreads} marks≤${maxMarks} particles=${g.vfx.particles.count()}`);
  ok('No infinite loop (45 s simulated)', ms < 20000, `${Math.round(ms)} ms for 2700 steps`);
  releaseInput(g);
  return rows;
}

// ---------------- Phase 9: loadout + skill-mechanic checks in the live game (any class, driven by skill tags)
export function mechanicChecks(g, classId) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: classId, test: name, pass: !!pass, detail });
  let { p, d } = atDummy(g, classId);
  const pool = p.loadout.pool(), rid = p.primaryResource;

  // Loadout: every pool skill, put on key 4, is what key 4 actually casts
  const casted = [];
  for (const s of pool) {
    ({ p, d } = atDummy(g, classId));
    p.loadout.assign(3, s.id);
    p.resources.set(rid, 100);
    let used = null;
    g.events.on('skillUsed', (e) => { if (e.caster === p && !used) used = e.skillId; });
    if ((s.requirements || []).some((r) => r.key === 'threadCount')) g.threads.create(p, 'astral_thread', { x: p.x - 40, y: p.y }, { x: p.x + 40, y: p.y });
    g.simulate(0.6, (gg, i) => { aim(g, d.x, d.y); if (i === 1) gg.input.pushBuffer('skill4'); });
    casted.push(used === s.id ? s.id : `${s.id}≠${used}`);
  }
  ok('Loadout: key 4 casts whatever is slotted', casted.every((c) => !c.includes('≠')), casted.join(' '));
  ({ p, d } = atDummy(g, classId));
  const inFight = (() => { g.combat.lastCombatTime = g.time; const r = p.setSkillSlot(0, pool[pool.length - 1].id); return !r; })();
  ok('Loadout: locked during combat', inFight, 'setSkillSlot refused while in combat');

  // Stealth skills (tag 'stealth'): monsters lose track, first hit is an ambush, stealth is consumed
  const stealth = pool.find((s) => (s.tags || []).includes('stealth'));
  if (stealth) {
    g.newGame(classId); releaseInput(g); p = g.player;
    goto(g, 38, 121);
    const foe = g.world.monsters.filter((m) => !m.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    // out of lunge range (a monster right on top of you still sees you, by design: < 70 px)
    p.x = foe.x + 240; p.y = foe.y; p.resources.set(rid, 100); p.skillSys.cooldowns.clear(stealth.id);
    const casted = p.trySkill(stealth); g.simulate(0.15); const veiled = p.status.flag('stealth');
    foe.aggro = true; foe.setState('chase'); g.simulate(1.5);
    ok('Stealth: chasing monster loses track', !foe.aggro && foe.state !== 'chase', `${foe.type} state=${foe.state} aggro=${foe.aggro} cast=${casted} veiled=${veiled} dist=${Math.round(Math.hypot(foe.x - p.x, foe.y - p.y))} hurt=${p.hurtT.toFixed(2)} act=${p.action && p.action.name}`);
    // ambush vs a normal hit on a dummy (same attack, deterministic enough over 6 samples)
    const hitOn = (veil) => {
      ({ p, d } = atDummy(g, classId));
      if (veil) { p.resources.set(rid, 100); p.trySkill(stealth); g.simulate(0.4); }
      let first = null;
      g.events.on('damageDealt', (e) => { if (e.source === p && first === null) first = e.amount; });
      g.simulate(0.5, (gg, i) => { aim(g, d.x, d.y); if (i === 1) gg.input.pushBuffer('attack'); });
      return { first, veiledAfter: p.status.flag('stealth') };
    };
    let normal = 0, amb = 0, consumed = true;
    for (let k = 0; k < 6; k++) { normal += hitOn(false).first || 0; const a = hitOn(true); amb += a.first || 0; if (a.veiledAfter) consumed = false; }
    ok('Stealth: ambush hit is stronger', amb > normal * 1.3, `avg normal ${(normal / 6).toFixed(1)} vs ambush ${(amb / 6).toFixed(1)}`);
    ok('Stealth: consumed by the first hit', consumed);
  }

  // Returning blades (tag 'pierce' + 'ranged' with a mark): hits twice, marks once
  const blade = pool.find((s) => s.id === 'phantom_edge');
  if (blade) {
    ({ p, d } = atDummy(g, classId, 120));
    p.resources.set(rid, 100);
    const hits = []; g.events.on('damageDealt', (e) => { if (e.target === d) hits.push(e.amount); });
    g.simulate(0.05, () => aim(g, d.x, d.y));
    p.trySkill(blade); g.simulate(1.2, () => aim(g, d.x, d.y));
    ok('Phantom Edge: out and back (2 hits), 1 mark', hits.length === 2 && p.marks === 1, `hits=${hits.length} marks=${p.marks}`);
  }

  // Guard System (classes with guard data): block, perfect guard + counter, flank hits, taunt
  if (p.cls.guard) {
    const gd = p.cls.guard;
    const hitFrom = (dx, raiseAgo) => {
      ({ p, d } = atDummy(g, classId));
      p.hp = p.maxHp; p.invulnT = 0;
      aim(g, p.x + 100, p.y); g.simulate(STEP * 2, () => aim(g, p.x + 100, p.y)); // face east
      p.guardState.active = true; p.guardState.since = g.time - raiseAgo;
      const foe = { x: p.x + dx, y: p.y, team: 2, dead: false };
      const g0 = p.resources.get(rid), hp0 = p.hp;
      g.combat.dealDamage(foe, p, { power: 40, type: 'physical', knock: 100 });
      return { lost: hp0 - p.hp, gauge: p.resources.get(rid) - g0, action: p.action && p.action.name };
    };
    const open = (() => { ({ p, d } = atDummy(g, classId)); p.invulnT = 0; const hp0 = p.hp; g.combat.dealDamage({ x: p.x + 40, y: p.y, team: 2 }, p, { power: 40, type: 'physical' }); return hp0 - p.hp; })();
    const blocked = hitFrom(40, 1);
    ok('Guard: frontal hit reduced + gauge', blocked.lost > 0 && blocked.lost < open * (1 - gd.reduction) + 2 && blocked.gauge > 0, `open ${open} -> blocked ${blocked.lost}, gauge +${blocked.gauge}`);
    const perfect = hitFrom(40, 0.05);
    ok('Perfect Guard: no damage, counter, big gauge', perfect.lost === 0 && perfect.action === 'guard_counter' && perfect.gauge >= 25, `lost ${perfect.lost}, action ${perfect.action}, gauge +${perfect.gauge}`);
    const flank = hitFrom(-40, 1);
    ok('Guard does not cover the back', flank.lost > open * 0.8 && flank.lost > blocked.lost * 2, `from behind ${flank.lost} (open ${open}, blocked ${blocked.lost})`);
    // taunt: an idle monster must come for the Guardian, and it hits 20% softer
    g.newGame(classId); releaseInput(g); p = g.player; goto(g, 38, 121);
    const foe = g.world.monsters.filter((m) => !m.dead && m.type === 'wolf').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    foe.aggro = false; foe.setState('idle');
    p.cls.markTarget(p, g, foe);
    g.simulate(0.2);
    ok('Taunt: monster is forced to engage', (foe.state === 'chase' || foe.state === 'attack') && foe.aggro && foe.status.damageMult() < 1, `state=${foe.state} dmgMult=${foe.status.damageMult()}`);
  }

  // Counter (status 'counter_ready' from a Perfect Dodge): next basic attack consumes it with a forced crit
  if (classId === 'umbral_sword') {
    ({ p, d } = atDummy(g, classId));
    p.cls.onPerfectDodge(p, g);
    const had = p.status.has('counter_ready');
    let crit = null; g.events.on('damageDealt', (e) => { if (e.source === p && crit === null) crit = e.crit; });
    g.simulate(0.5, (gg, i) => { aim(g, d.x, d.y); if (i === 1) gg.input.pushBuffer('attack'); });
    ok('Counter: Perfect Dodge → counter_ready → forced crit, consumed', had && crit === true && !p.status.has('counter_ready'), `status=${had} crit=${crit}`);
  }
  releaseInput(g);
  return rows;
}

// ---------------- balance report: dummy DPS (30 s bot) + a real boss fight (no god mode)
// loadout: optional [id,id,id,id] for keys 1-4 (compare builds of the same class)
export function balance(g, classId, loadout) {
  const { p } = atDummy(g, classId, 140);
  if (loadout) p.loadout.load(loadout);
  let dmg = 0;
  g.events.on('damageDealt', (e) => { if (e.source === p || (e.opts && e.opts.dot)) dmg += e.amount; });
  const uses = {};
  g.events.on('skillUsed', (e) => { uses[e.skillId] = (uses[e.skillId] || 0) + 1; });
  g.simulate(30, (gg, i) => bot(gg, i, { god: true, range: 600 }));
  const dps = Math.round(dmg / 30);
  // boss: same level/gear rules as the playthrough, real damage taken
  toBoss(g, classId);
  const pl = g.player; pl.level = 13; pl.recomputeStats(); pl.hp = pl.maxHp;
  if (loadout) pl.loadout.load(loadout);
  goto(g, 135, 37); g.simulate(3);
  const gd = g.world.guardian;
  let t = 0, dmgTaken = 0;
  g.events.on('damageTaken', (e) => { if (e.target === pl) dmgTaken += e.amount; });
  const pots0 = g.inventory.count('hp_potion');
  while (t < 300 && !gd.dead && !pl.dead) { g.simulate(5, (gg, i) => bot(gg, i, {})); t += 5; }
  releaseInput(g);
  return { class: classId, loadout: p.loadout.serialize().join(','), dummyDPS: dps, bossResult: gd.dead ? 'WIN' : pl.dead ? 'DIED' : 'TIMEOUT', bossTime: t + 's', bossPhase: gd.phase, dmgTaken: Math.round(dmgTaken), potionsUsed: pots0 - g.inventory.count('hp_potion'), skillUses: JSON.stringify(uses) };
}

export function runAll(g, { withBalance = true } = {}) {
  const rows = [], bal = [];
  for (const c of STARTING_CLASSES) rows.push(...classChecks(g, c), ...mechanicChecks(g, c));
  if (withBalance) for (const c of STARTING_CLASSES) bal.push(balance(g, c));
  return { passed: rows.filter((r) => r.pass).length, total: rows.length, rows, balance: bal };
}
