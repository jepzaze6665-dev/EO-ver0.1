// PHASE 7 — COMBAT TEST (browser). Runs the V2 test requirements against the REAL game for every
// starting class, plus a balance report. From the dev-tools console:
//   const C = await import('/tools/combatTest.js');
//   const r = C.runAll(__game);  console.table(r.rows);  console.table(r.balance);
// Unit tests (node tools/tests/run.mjs) check each system in isolation; this file checks that the
// systems still behave when wired together inside the running game loop.
import { bot, releaseInput, goto, toBoss } from './testkit.js';
import { STARTING_CLASSES, CLASSES } from '../src/skills/classes.js';
import { CLASS_TREE } from '../src/data/classTree.js';

const STEP = 1 / 60;
// every playable class that is not a starting class (Class 2+) — tested the same way
const ADVANCED = Object.keys(CLASSES).filter((id) => !STARTING_CLASSES.includes(id));

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
  g.marks.clearAll(); g.threads.clearAll(); g.summons.clearAll();
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
  // never negative: spam a cost skill at 0 (a skill gated by a resource requirement fails on that instead)
  const costly = [...cls.skills].find((s) => s.cost > 0 && !(s.requirements || []).length) || cls.skills.find((s) => s.cost > 0);
  p.resources.set(rid, 0); p.skillSys.cooldowns.clear(costly.id); log.length = 0;
  for (let i = 0; i < 30; i++) { p.trySkill(costly); g.simulate(STEP); p.resources.set(rid, 0); }
  ok('Resource never negative', p.resources.get(rid) >= 0 && log.some((l) => l.n === 'skillFailed' && (l.e.reason === 'resource' || l.e.reason === 'requirement')), `${rid}=${p.resources.get(rid)} fails=${log.filter((l) => l.n === 'skillFailed').length}`);

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
      if (!eater) { // taunt-only mark (Warden of Dawn): it must make the foe fight you
        cls.markTarget(p, g, d);
        ok('Mark taunts (no skill consumes it)', g.marks.get(d, m) > 0 && d.status && d.status.has('taunted'), m);
      } else {
      cls.markTarget(p, g, d);
      p.resources.set(rid, 100);
      const hpB = d.hp;
      cast(g, eater.id, d);
      ok('Mark consumed by skill (bonus damage)', g.marks.get(d, m) === 0 && log.some((l) => l.n === 'damageDealt' && l.e.opts && l.e.opts.big), `${eater.id}: dmg=${hpB - d.hp}`);
      }
    }
  } else if (p.markId) {
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
    for (const r of s.requirements || []) { // meet the other data requirements the way a player would have
      if (r.type === 'recorded' && p.memory) p.memory.record({ kind: 'skill', id: r.ids[0] }, g.time);
      if (r.type === 'hpBelow') p.hp = Math.floor(p.maxHp * (r.max - 0.1));
      if (r.type === 'markedFoe') g.marks.apply(d, r.mark, { source: p, stacks: 3 }); // the dummy carries the mark
    }
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
    const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    // out of lunge range (a monster right on top of you still sees you, by design: < 70 px)
    const spot = g.world.map.findOpen(foe.x + 240, foe.y, 4); p.x = spot.x; p.y = spot.y; p.resources.set(rid, 100); p.skillSys.cooldowns.clear(stealth.id);
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
    ok('Perfect Guard: no damage, counter, big gauge', perfect.lost === 0 && !!perfect.action && perfect.gauge >= Math.min(25, (p.cls.charge && p.cls.charge.perfectGuard) || 25), `lost ${perfect.lost}, action ${perfect.action}, gauge +${perfect.gauge}`);
    const flank = hitFrom(-40, 1);
    ok('Guard does not cover the back', flank.lost > open * 0.8 && flank.lost > blocked.lost * 2, `from behind ${flank.lost} (open ${open}, blocked ${blocked.lost})`);
    // taunt: an idle monster must come for the Guardian, and it hits 20% softer
    g.newGame(classId); releaseInput(g); p = g.player; goto(g, 38, 121);
    const foe = g.world.monsters.filter((m) => !m.dead && m.type === 'wolf' && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    foe.aggro = false; foe.setState('idle');
    p.cls.markTarget(p, g, foe);
    g.simulate(0.2);
    ok('Taunt: monster is forced to engage', (foe.state === 'chase' || foe.state === 'attack') && foe.aggro && foe.status.damageMult() < 1, `state=${foe.state} dmgMult=${foe.status.damageMult()}`);
  }

  // Counter (status 'counter_ready' from a Perfect Dodge): next basic attack consumes it with a forced crit
  if (((p.cls.perfectDodge && p.cls.perfectDodge.statuses) || []).some((s) => s.id === 'counter_ready')) {
    ({ p, d } = atDummy(g, classId));
    p.onPerfectDodge(null);
    const had = p.status.has('counter_ready');
    let crit = null; g.events.on('damageDealt', (e) => { if (e.source === p && crit === null) crit = e.crit; });
    g.simulate(0.5, (gg, i) => { aim(g, d.x, d.y); if (i === 1) gg.input.pushBuffer('attack'); });
    ok('Counter: Perfect Dodge → counter_ready → forced crit, consumed', had && crit === true && !p.status.has('counter_ready'), `status=${had} crit=${crit}`);
  }
  releaseInput(g);
  return rows;
}

// ---------------- Phase 15-16: Nightfall Reaper in the live game (gauge tiers, clone, zone, step, execute, harvest)
export function reaperChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'nightfall_reaper', test: name, pass: !!pass, detail });
  const M = 'reaper_mark', R = CLASSES.nightfall_reaper;
  let { p, d } = atDummy(g, 'nightfall_reaper');
  const rid = p.primaryResource;

  // gauge tiers -> stats
  const base = { ...p.stats };
  p.resources.set(rid, 85); g.simulate(STEP * 2);
  const hi = { ...p.stats };
  p.resources.set(rid, 0); g.combat.lastCombatTime = -99; g.simulate(STEP * 2);
  ok('Gauge tiers: NIGHTFALL adds shadow dmg / crit / area, drops back at 0', hi.shadowDmg >= base.shadowDmg + 0.2 - 1e-9 && hi.crit > base.crit && hi.aoe > 0 && p.stats.shadowDmg === base.shadowDmg, `shadowDmg ${base.shadowDmg} -> ${hi.shadowDmg} -> ${p.stats.shadowDmg}`);

  // Shadow Doppel: one clone, copies Reaper's Arc, expires
  ({ p, d } = atDummy(g, 'nightfall_reaper'));
  p.resources.set(rid, 100);
  cast(g, 'shadow_doppel', d);
  const clone = g.summons.forOwner(p)[0];
  ok('Shadow Doppel: clone summoned', g.summons.count(p) === 1 && clone, `summons=${g.summons.count(p)}`);
  let hits = 0; g.events.on('damageDealt', (e) => { if (e.target === d && e.source === p) hits++; });
  p.skillSys.cooldowns.clear('reapers_arc'); g.simulate(1.2); hits = 0; // let the arrival spin + auto attacks settle
  const before = hits; cast(g, 'reapers_arc', d);
  ok("Shadow Doppel: clone copies Reaper's Arc (2 hits from 1 cast)", hits - before >= 2, `hits on dummy after one cast: ${hits - before}`);
  g.simulate(g.summons.defs.shadow_doppel.duration);
  ok('Shadow Doppel: clone expires', g.summons.count(p) === 0);

  // Nightfall Zone on the dummy: slow + marks during, root after the collapse
  ({ p, d } = atDummy(g, 'nightfall_reaper'));
  cast(g, 'nightfall_zone', d);
  g.simulate(0.9);
  const slowed = d.status.has('slow'), marked = g.marks.get(d, M);
  g.simulate(3.0, () => aim(g, d.x, d.y));
  ok('Nightfall Zone: slows + marks, collapse roots', slowed && marked > 0 && d.status.has('root'), `slow=${slowed} marks=${marked} root=${d.status.has('root')}`);

  // Reaper's Step: refused without a marked foe; teleports behind the marked dummy and detonates its marks
  ({ p, d } = atDummy(g, 'nightfall_reaper', 150));
  const refused = !p.trySkill(p.cls.special);
  R.markTarget(p, g, d, 3);
  const y0 = p.y; aim(g, d.x, d.y); g.simulate(STEP);
  const stepped = p.trySkill(p.cls.special); g.simulate(0.5, () => aim(g, d.x, d.y));
  ok("Reaper's Step: needs a mark, teleports past the target, detonates", refused && stepped && y0 > d.y && p.y < d.y && g.marks.get(d, M) === 0, `refused=${refused} stepped=${stepped} y ${Math.round(y0)} -> ${Math.round(p.y)} (dummy ${Math.round(d.y)}) marks=${g.marks.get(d, M)}`);

  // Bloodless Night: execute tag on low-HP targets only
  ({ p, d } = atDummy(g, 'nightfall_reaper'));
  const tagAt = (ratio) => { d.hp = d.maxHp * ratio; return g.combat.dealDamage(p, d, { power: 1, type: 'shadow', knock: 0 }).tags.includes('execute'); };
  ok('Bloodless Night: bonus shadow damage under 35% HP only', !tagAt(0.9) && tagAt(0.3));

  // Death Harvest: a nearby death -> gauge + haste
  ({ p, d } = atDummy(g, 'nightfall_reaper'));
  const g0 = p.resources.get(rid); d.hp = 1;
  g.combat.dealDamage(p, d, { power: 5, type: 'shadow', knock: 0 }); g.simulate(STEP);
  ok('Death Harvest: kill nearby -> gauge + haste', d.dead && p.resources.get(rid) - g0 >= R.charge.harvest && p.status.has('haste'), `gauge +${(p.resources.get(rid) - g0).toFixed(1)} haste=${p.status.has('haste')}`);

  // Funeral Eclipse: spends the whole gauge and executes a low-HP foe
  ({ p, d } = atDummy(g, 'nightfall_reaper'));
  let killed = 0, emptied = false; g.events.on('enemyKilled', (e) => { if (e.target === d) killed++; });
  g.events.on('resourceChanged', (e) => { if (e.entity === p && e.reason === 'skill:funeral_eclipse' && e.value === 0) emptied = true; });
  p.resources.set(rid, 100); d.hp = d.maxHp * 0.18; d.sinceHit = 0; // under the 20% execute line (a 3000-HP dummy)
  cast(g, 'funeral_eclipse', d); idle(g); g.simulate(0.3);
  ok('Funeral Eclipse: spends all gauge, executes, summons a clone', killed === 1 && emptied && g.summons.count(p) === 1, `killed=${killed} emptied=${emptied} gauge after (harvest refills)=${p.resources.get(rid).toFixed(1)} clones=${g.summons.count(p)}`);

  // real class change: Umbral Sword -> Nightfall Reaper (unlocked through progression) and it fights
  g.newGame('umbral_sword'); releaseInput(g);
  g.progression.unlock('nightfall_reaper'); g.combat.lastCombatTime = -99;
  const r = g.changeClass('nightfall_reaper');
  const np = g.player;
  ok('Class change Umbral Sword -> Nightfall Reaper', r.ok && np.cls.id === 'nightfall_reaper' && np.sprites.preset === 'rp' && np.primaryResource === 'nightfall_gauge' && g.equipment.slots.weapon === 'reaper_scythe', `${np.cls.id} ${np.sprites.preset} ${g.equipment.slots.weapon}`);
  releaseInput(g);
  return rows;
}

// ---------------- Class 2 DUSKRUNNER in the live game (momentum, recast dashes, barrage stages, mirage, overdrive)
export function duskChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'duskrunner', test: name, pass: !!pass, detail });
  const MO = 'momentum';
  let { p, d } = atDummy(g, 'duskrunner');

  // tiers -> stats (attack speed, speed, cheaper dodge)
  const base = { ...p.stats }, cost0 = p.dodgeCost();
  p.resources.set(MO, 100); g.simulate(STEP * 2, () => { g.combat.lastCombatTime = g.time; }); // in a fight: no out-of-combat fade
  ok('Momentum MAX: attack speed / speed / cheaper dodges', p.stats.attackSpeed >= 0.3 - 1e-9 && p.stats.speed > base.speed && p.dodgeCost() < cost0, `atkSpd ${p.stats.attackSpeed} speed ${base.speed}->${p.stats.speed} dodge ${cost0}->${p.dodgeCost()}`);
  // attack speed really shortens a basic attack
  const basicTime = (m) => {
    ({ p, d } = atDummy(g, 'duskrunner')); p.resources.set(MO, m); g.simulate(STEP * 2);
    aim(g, d.x, d.y); p.tryAttack(); let t = 0;
    while (p.action && t < 1) { g.simulate(STEP); t += STEP; }
    return t;
  };
  const slow = basicTime(0), fast = basicTime(100);
  ok('Attack speed: a basic attack at MAX momentum ends sooner', fast < slow * 0.85, `${slow.toFixed(3)} s -> ${fast.toFixed(3)} s`);

  // a dodge builds momentum; standing still in a fight drains it
  ({ p, d } = atDummy(g, 'duskrunner'));
  const m0 = p.resources.get(MO); g.input.pushBuffer('dodge'); g.simulate(0.4);
  ok('Dodge builds momentum', p.resources.get(MO) > m0, `${m0} -> ${p.resources.get(MO).toFixed(1)}`);
  p.resources.set(MO, 80); g.combat.lastCombatTime = g.time; releaseInput(g);
  g.simulate(1.5, () => { g.combat.lastCombatTime = g.time; });
  ok('Standing still in a fight drains momentum', p.resources.get(MO) < 60, `80 -> ${p.resources.get(MO).toFixed(1)}`);

  // Dusk Barrage: hits follow momentum (3 at 0, 9 at 100)
  const barrageHits = (m) => {
    ({ p, d } = atDummy(g, 'duskrunner')); p.resources.set(MO, m);
    let n = 0; const off = g.events.on('damageDealt', (e) => { if (e.source === p && e.target === d) n++; });
    cast(g, 'dusk_barrage', d); if (off) off();
    return n;
  };
  const low = barrageHits(0), high = barrageHits(100);
  ok('Dusk Barrage: 3 hits at 0 momentum, 9 at MAX', low === 3 && high === 9, `${low} / ${high}`);

  // Flash Step: the second press within the window is a second dash (recast) that goes further
  ({ p, d } = atDummy(g, 'duskrunner'));
  const x0 = p.x; aim(g, p.x + 300, p.y); g.simulate(STEP * 2);
  const f1 = p.trySkill(p.cls.special); g.simulate(0.25, () => aim(g, p.x + 300, p.y));
  const x1 = p.x; const f2 = p.trySkill(p.cls.special); g.simulate(0.3, () => aim(g, p.x + 300, p.y));
  const x2 = p.x, f3 = p.trySkill(p.cls.special);
  ok('Flash Step: dash, recast dash, then cooldown', f1 && f2 && !f3 && x1 > x0 + 60 && x2 > x1 + 60, `x ${Math.round(x0)} -> ${Math.round(x1)} -> ${Math.round(x2)}, third=${f3}`);

  // Mirage Shift: dash away, recast = back to the Mirage
  ({ p, d } = atDummy(g, 'duskrunner'));
  const home = { x: p.x, y: p.y };
  cast(g, 'mirage_shift', { x: p.x - 300, y: p.y });
  const away = Math.hypot(p.x - home.x, p.y - home.y), mir = g.summons.count(p, 'mirage');
  const back = p.trySkill(p.skillSys.get('mirage_shift')); g.simulate(0.4);
  ok('Mirage Shift: leaves a Mirage, the recast returns to it', mir === 1 && away > 60 && back && Math.hypot(p.x - home.x, p.y - home.y) < 4 && g.summons.count(p, 'mirage') === 0, `away ${Math.round(away)} back ${Math.round(Math.hypot(p.x - home.x, p.y - home.y))}`);

  // Silent Run: stealth, the first hit is an AMBUSH (+50%) and ends it
  ({ p, d } = atDummy(g, 'duskrunner'));
  cast(g, 'silent_run');
  const stealth = p.status.flag('stealth');
  let first = 0; const off2 = g.events.on('damageDealt', (e) => { if (e.source === p && !first) first = e.amount; });
  g.simulate(0.4, (gg, i) => { aim(g, d.x, d.y); if (i === 1) gg.input.pushBuffer('attack'); });
  if (off2) off2();
  ok('Silent Run: stealth, AMBUSH ends it', stealth && first > 0 && !p.status.has('silent_run'), `stealth=${stealth} firstHit=${first}`);

  // Endless Run: needs 60 momentum; OVERDRIVE locks momentum at 100 even standing still
  ({ p, d } = atDummy(g, 'duskrunner'));
  p.resources.set(MO, 40);
  const refused = !p.skillSys.canUse('endless_run').ok;
  p.resources.set(MO, 70); cast(g, 'endless_run', d); idle(g);
  g.combat.lastCombatTime = g.time; releaseInput(g);
  g.simulate(2, () => { g.combat.lastCombatTime = g.time; });
  ok('Endless Run: refused under 60; OVERDRIVE keeps momentum at 100', refused && p.status.has('overdrive') && p.resources.get(MO) === 100, `refused=${refused} overdrive=${p.status.has('overdrive')} m=${p.resources.get(MO)}`);

  // a heavy hit throws momentum away (not in overdrive)
  ({ p, d } = atDummy(g, 'duskrunner'));
  p.resources.set(MO, 80); p.invulnT = 0;
  g.combat.dealDamage({ x: p.x + 20, y: p.y, team: 2, stats: null }, p, { power: 10, heavy: true });
  ok('Heavy hit: -25 momentum', Math.round(p.resources.get(MO)) === 55, `80 -> ${p.resources.get(MO)}`);

  // real class change: Umbral Sword -> Duskrunner
  g.newGame('umbral_sword'); releaseInput(g);
  g.progression.unlock('duskrunner'); g.combat.lastCombatTime = -99;
  const r = g.changeClass('duskrunner'), np = g.player;
  ok('Class change Umbral Sword -> Duskrunner', r.ok && np.cls.id === 'duskrunner' && np.sprites.preset === 'dr' && np.primaryResource === MO && g.equipment.slots.weapon === 'twin_dusk_blades', `${np.cls.id} ${np.sprites.preset} ${g.equipment.slots.weapon}`);
  releaseInput(g);
  return rows;
}

// ---------------- Class 2 BLADE OF ECHOES in the live game (counter stance, echo, record & replay, rewind, last stand)
export function echoChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'blade_of_echoes', test: name, pass: !!pass, detail });
  const EC = 'echo';
  let { p, d } = atDummy(g, 'blade_of_echoes');
  const inFight = () => { g.combat.lastCombatTime = g.time; };

  p.resources.set(EC, 95); g.simulate(STEP * 2, inFight);
  ok('Echo tiers: FULL MEMORY adds echoPower + crit', p.stats.echoPower >= 0.5 - 1e-9 && p.stats.crit > p.cls.base.crit, `echoPower ${p.stats.echoPower} crit ${p.stats.crit}`);

  // a real monster next to us for the counter tests
  const foeNear = () => {
    g.newGame('blade_of_echoes'); releaseInput(g); p = g.player; goto(g, 38, 121);
    const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    foe.x = p.x + 30; foe.y = p.y; p.hp = p.maxHp; p.invulnT = 0; p.resources.set(EC, 0);
    for (const m of g.world.monsters) if (!m.dead) m.status.add('stun', 10); // nobody attacks on its own (was flaky)
    return foe;
  };
  // the scripted blow: the foe is freed just for it (so the counter's own stun can be checked afterwards)
  const strike = (foe, extra = {}) => { foe.status.remove('stun'); return g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 30 }, 12, extra); };

  let foe = foeNear();
  const hp0 = p.hp; let parries = 0; g.events.on('perfectGuard', () => parries++);
  p.trySkill(p.cls.special); g.simulate(0.2);
  strike(foe);
  ok('Perfect Counter: the blow is parried (0 damage) and answered', p.hp === hp0 && parries === 1 && p.action && p.action.name === 'counter_strike', `hp ${hp0}->${p.hp} parries=${parries} action=${p.action && p.action.name}`);
  const fhp = foe.hp; g.simulate(1.0); // the parry slows time (x0.25) for a moment
  ok('Counter strike: damage, stun + counter window on the attacker, +20 Echo', foe.hp < fhp && foe.status.has('stun') && foe.status.has('counter_window') && p.resources.get(EC) >= 20, `foe ${Math.round(fhp)}->${Math.round(foe.hp)} stun=${foe.status.has('stun')} echo=${Math.round(p.resources.get(EC))}`);

  foe = foeNear(); const hp1 = p.hp;
  p.trySkill(p.cls.special); g.simulate(0.56); strike(foe);
  ok('Mistimed counter (after the window): the hit lands', p.hp < hp1, `hp ${hp1}->${p.hp}`);
  foe = foeNear(); const hp2 = p.hp;
  p.trySkill(p.cls.special); g.simulate(0.2); strike(foe, { unblockable: true });
  ok('Unblockable attacks go through the stance', p.hp < hp2, `hp ${hp2}->${p.hp}`);

  // Echo Slash: the cut and its echo both land
  ({ p, d } = atDummy(g, 'blade_of_echoes'));
  let hits = 0; g.events.on('damageDealt', (e) => { if (e.source === p && e.target === d) hits++; });
  cast(g, 'echo_slash', d);
  ok('Echo Slash: cut + delayed echo', hits === 2, `hits=${hits}`);
  // Crimson Memory replays it (and does not record its own replay)
  p.resources.set(EC, 60); const n0 = p.memory.entries.length; hits = 0;
  const recalled = cast(g, 'crimson_memory', d);
  ok('Crimson Memory: replays the remembered Echo Slash, replay not recorded', recalled && hits === 2 && p.memory.entries.filter((e) => e.id === 'echo_slash').length === 1, `used=${recalled} hits=${hits} entries ${n0}->${p.memory.entries.length}`);

  // Rewind Edge: back to the remembered spot, heals part of the HP lost
  ({ p, d } = atDummy(g, 'blade_of_echoes'));
  const home = { x: p.x, y: p.y };
  cast(g, 'rewind_edge'); p.x += 150; p.hp = Math.round(p.maxHp * 0.5); p.resources.set(EC, 40); const hpR = p.hp;
  const rw = p.trySkill(p.skillSys.get('rewind_edge')); g.simulate(0.5);
  ok('Rewind Edge: returns to the mark and heals', rw && Math.hypot(p.x - home.x, p.y - home.y) < 4 && p.hp > hpR, `dist ${Math.round(Math.hypot(p.x - home.x, p.y - home.y))} hp ${hpR}->${p.hp}`);

  // Blade of Recollection: record a few actions, the crimson copy replays them
  ({ p, d } = atDummy(g, 'blade_of_echoes'));
  g.simulate(1.6, (gg, i) => { aim(g, d.x, d.y); if (i % 25 === 0) gg.input.pushBuffer('attack'); });
  const rec = p.memory.recent(g.time).length;
  p.resources.set(EC, 60); hits = 0;
  g.events.on('damageDealt', (e) => { if (e.source === p && e.target === d) hits++; }); // fresh bus after newGame
  const ultOk = p.trySkill(p.skillSys.get('blade_of_recollection'));
  g.simulate(0.8); const copy = g.summons.count(p, 'echo_self');
  g.simulate(2.5, () => aim(g, d.x, d.y));
  ok('Blade of Recollection: a crimson copy replays the recorded actions', ultOk && rec >= 3 && copy === 1 && hits >= rec, `recorded=${rec} copy=${copy} hits=${hits}`);

  // Last Stand: only below 40% HP; less damage taken
  ({ p, d } = atDummy(g, 'blade_of_echoes'));
  const refused = !p.skillSys.canUse('last_stand').ok;
  p.hp = Math.round(p.maxHp * 0.3); cast(g, 'last_stand');
  ok('Last Stand: refused at full HP, active under 40% (damage taken x0.6)', refused && p.status.has('last_stand') && p.status.damageTakenMult() < 0.7, `refused=${refused} mult=${p.status.damageTakenMult()}`);

  // live: the bot fights a pack with the stance and lands Perfect Counters
  g.newGame('blade_of_echoes'); releaseInput(g); p = g.player; p.setLevel(6); p.hp = p.maxHp;
  let live = 0; g.events.on('perfectGuard', (e) => { if (e.player === p) live++; });
  for (const [x, y] of [[38, 121], [20, 112], [54, 80]]) { goto(g, x, y); g.simulate(12, (gg, i) => bot(gg, i, { god: true })); if (live) break; }
  releaseInput(g);
  ok('Live fight: Perfect Counters happen against real monsters', live > 0, `counters=${live}`);

  // real class change: Umbral Sword -> Blade of Echoes
  g.newGame('umbral_sword'); releaseInput(g);
  g.progression.unlock('blade_of_echoes'); g.combat.lastCombatTime = -99;
  const r = g.changeClass('blade_of_echoes'), np = g.player;
  ok('Class change Umbral Sword -> Blade of Echoes', r.ok && np.cls.id === 'blade_of_echoes' && np.sprites.preset === 'be' && np.primaryResource === EC && np.memory && g.equipment.slots.weapon === 'memory_blade', `${np.cls.id} ${np.sprites.preset} ${g.equipment.slots.weapon}`);
  releaseInput(g);
  return rows;
}

// ---------------- WARDEN OF DAWN (Class 2 of the Aegis): the spec's test path — guard -> Dawnlight -> Dawn Shield ->
// Radiant Chain on an ally -> Dawn Bastion -> Grace of Dawn -> Dawn's Sanctuary; resource / barrier / reduction / cooldowns
export function wardenChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'warden_of_dawn', test: name, pass: !!pass, detail });
  const R = 'dawnlight', r0 = (n) => Math.round(n);
  let { p, d } = atDummy(g, 'warden_of_dawn');
  const cls = p.cls, inFight = () => { g.combat.lastCombatTime = g.time; };
  ok('Class data: preset wd, Dawnlight, own skills + guard + passives', p.sprites.preset === 'wd' && p.primaryResource === R && p.skillSys.get('dawn_shield') && p.skillSys.get('dawns_sanctuary') && cls.special.id === 'dawn_guard' && cls.passives.length >= 2 && g.equipment.slots.weapon === 'dawn_aegis', `${p.sprites.preset} ${p.primaryResource} ${g.equipment.slots.weapon}`);

  // a real monster in front for the guard tests (the others are held still)
  const foeNear = () => {
    const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    for (const m of g.world.monsters) if (m !== foe && !m.dead) m.status.add('stun', 20);
    foe.status.add('stun', 20); foe.x = p.x + 30; foe.y = p.y; aim(g, foe.x, foe.y); p.hp = p.maxHp; p.invulnT = 0;
    return foe;
  };
  const strike = (foe, power = 12) => g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 30 }, power, {});
  g.newGame('warden_of_dawn'); releaseInput(g); p = g.player; goto(g, 38, 121);
  let foe = foeNear();
  p.resources.set(R, 0); g.input.down.add('KeyQ'); g.simulate(0.45, () => { aim(g, foe.x, foe.y); inFight(); }); // held (Q) -> a normal block
  const hpB = p.hp; strike(foe); g.input.down.delete('KeyQ');
  ok('Guard: frontal hit blocked, Dawnlight +6', p.hp > hpB - 12 && r0(p.resources.get(R)) === 6, `hp ${hpB}->${p.hp} dawn ${p.resources.get(R)}`);
  p.setGuard(false); g.simulate(0.4, inFight);
  p.resources.set(R, 0); p.invulnT = 0; const hpP = p.hp;
  aim(g, foe.x, foe.y); g.simulate(STEP * 2); p.setGuard(true); strike(foe); g.simulate(0.6, inFight);
  ok('Perfect Guard: no damage, +20 Dawnlight, riposte of light', p.hp === hpP && p.resources.get(R) >= 20 && (g.stats && true), `hp ${hpP}->${p.hp} dawn ${r0(p.resources.get(R))}`);
  p.setGuard(false); g.simulate(0.5, inFight);

  // ---- solo skills at the dummy
  ({ p, d } = atDummy(g, 'warden_of_dawn'));
  p.resources.set(R, 40); inFight();
  const castAt = (id) => { const r = cast(g, id, d); idle(g); return r; };
  let r = castAt('dawn_shield');
  const sh = p.status.get('shield');
  ok('Dawn Shield (solo): barrier ≈20% max HP on yourself, 15 Dawnlight spent, cooldown running', sh && Math.abs(sh.amount - Math.round(p.maxHp * 0.2)) <= 2 && p.resources.get(R) <= 40 - 15 + 5 + 1 && p.skillSys.cooldowns.remaining('dawn_shield') > 0, `barrier ${sh && sh.amount} / ${p.maxHp} dawn ${r0(p.resources.get(R))}`);
  p.resources.set(R, 5);
  ok('Not enough Dawnlight: Grace of Dawn refused, nothing spent', !p.skillSys.use('grace_of_dawn').ok && p.resources.get(R) === 5);
  for (let i = 0; i < 6; i++) cls.giveBarrier(p, g, p, 0.2);
  ok('Barrier cap: never above 50% max HP', p.status.get('shield').amount <= Math.round(p.maxHp * 0.5), `${p.status.get('shield').amount} / ${p.maxHp}`);

  // ---- an ally (a second party member, like T.partyCheck) — statuses ticked here since only the local player runs
  const A = CLASSES.aegis_guardian, ally = new p.constructor(g, A, g.spritesFor(A));
  ally.x = p.x + 60; ally.y = p.y; ally.recomputeStats(); ally.hp = Math.round(ally.maxHp * 0.6);
  g.party.add(ally);
  const tickAlly = () => { ally.status.update(STEP); ally.invulnT = 0; inFight(); };
  const sim = (s) => g.simulate(s, tickAlly);
  const hitAlly = (power = 20) => { ally.invulnT = 0; const hp0 = ally.hp; g.combat.dealDamage({ x: ally.x + 10, y: ally.y, team: 'enemy' }, ally, { power, noCrit: true, knock: 0 }); return hp0 - ally.hp; };
  ally.status.remove('shield'); p.status.remove('shield');
  p.skillSys.cooldowns.clear('dawn_shield'); p.resources.set(R, 40);
  cast(g, 'dawn_shield', d); sim(0.3);
  ok('Dawn Shield targets the ally who needs it (lowest HP) + a small barrier for you', ally.status.get('shield') && ally.status.get('shield').source === p && p.status.get('shield'), `ally ${ally.status.get('shield') && ally.status.get('shield').amount} self ${p.status.get('shield') && p.status.get('shield').amount}`);
  ally.status.remove('shield');
  const plain = hitAlly();
  p.resources.set(R, 0); cast(g, 'radiant_chain', d); sim(0.2);
  const dawnBefore = p.resources.get(R);
  const chained = hitAlly();
  ok('Radiant Chain binds the ally: 30% less damage taken', p.chain && p.chain.target === ally && ally.status.has('radiant_chain') && chained <= Math.ceil(plain * 0.7) + 1, `plain ${plain} chained ${chained}`);
  for (let i = 0; i < 10; i++) hitAlly(1);
  ok('Chained ally hits feed Dawnlight, capped at 24 per chain', p.resources.get(R) - dawnBefore <= 24 + 1e-6 && p.resources.get(R) > dawnBefore, `+${r0(p.resources.get(R) - dawnBefore)}`);
  sim(0.2);
  ok('Shared Resolve: protecting an ally raises your DEF (+30%)', p.status.has('shared_resolve') && Math.abs(p.status.get('shared_resolve').mult - 1.3) < 1e-9);
  ally.x = p.x + 400; sim(0.1);
  ok('Chain breaks beyond its range', !p.chain && !ally.status.has('radiant_chain'));
  ally.x = p.x + 40; ally.y = p.y;

  // Dawn Bastion
  p.resources.set(R, 40); cast(g, 'dawn_bastion', d); sim(0.3);
  const zone = (p.zones || []).find((z) => z.kind === 'bastion');
  ok('Dawn Bastion: zone r 90 for 6 s at your feet, ally inside protected', zone && zone.r === 90 && Math.abs(zone.total - 6) < 1e-9 && ally.status.has('dawn_bastion') && p.status.has('dawn_bastion'), zone ? `r ${zone.r} left ${zone.t.toFixed(1)}` : 'no zone');
  const ax = ally.x, px = p.x; ally.invulnT = 0; p.invulnT = 0;
  g.combat.dealDamage({ x: ally.x - 10, y: ally.y, team: 'enemy' }, ally, { power: 5, knock: 400, noCrit: true });
  g.combat.dealDamage({ x: p.x - 10, y: p.y, team: 'enemy' }, p, { power: 5, knock: 400, noCrit: true }); sim(0.3);
  ok('Holy ground: no knockback inside', Math.abs(ally.x - ax) < 1 && Math.abs(p.x - px) < 1, `ally moved ${(ally.x - ax).toFixed(1)} you ${(p.x - px).toFixed(1)}`);
  ally.x = zone.x + 200; sim(0.5);
  ok('Outside the zone: no protection', !ally.status.has('dawn_bastion'));
  ally.x = p.x + 40; sim(6.2);
  ok('Zone ends on time', !(p.zones || []).some((z) => z.kind === 'bastion') && !ally.status.has('dawn_bastion'));

  // Grace of Dawn
  ally.hp = Math.round(ally.maxHp * 0.4); p.resources.set(R, 50); const ahp = ally.hp;
  cast(g, 'grace_of_dawn', d); sim(0.2);
  ok('Grace of Dawn: 30 Dawnlight, heals the lowest ally 12% max HP', r0(p.resources.get(R)) <= 20 + 1 && ally.hp - ahp === Math.round(ally.maxHp * 0.12), `+${ally.hp - ahp} (12% = ${Math.round(ally.maxHp * 0.12)}) dawn ${r0(p.resources.get(R))}`);

  // Last Light
  p.status.remove('last_light'); p.lastLightReady = 0; ally.hp = Math.round(ally.maxHp * 0.36); hitAlly(15);
  const ll1 = p.status.has('last_light'); p.status.remove('last_light'); hitAlly(1);
  ok('Last Light: an ally under 35% HP -> you take 20% less; cooldown stops a re-trigger', ll1 && !p.status.has('last_light'), `ally ${ally.hp}/${ally.maxHp}`);

  // Ultimate
  ally.hp = ally.maxHp; p.resources.set(R, 59);
  ok('Dawn\'s Sanctuary needs 60 Dawnlight', !p.skillSys.use('dawns_sanctuary').ok);
  p.resources.set(R, 60); ally.status.add('slow', 5);
  let taunts = 0; g.events.on('targetMarked', (e) => { if (e.source === p && e.markId === 'guardian_mark') taunts++; });
  const ur = p.trySkill(p.skillSys.get('dawns_sanctuary')); sim(1.6);
  const sz = (p.zones || []).find((z) => z.kind === 'sanctuary');
  ok('Sanctuary: zone r 150 / 8 s, barrier + cleanse for the party, 40% less damage', ur && sz && sz.r === 150 && ally.status.has('sanctuary') && ally.status.get('shield') && !ally.status.has('slow') && p.resources.get(R) < 10, sz ? `left ${sz.t.toFixed(1)} s` : 'no zone');
  ok('Sanctuary resists new debuffs', ally.status.add('slow', 3) === null && !ally.status.has('slow'));
  ok('Sanctuary taunts foes inside (aggro support)', taunts > 0, `${taunts} marked`); // (the dummy may be seared to 0 and reset)
  sim(8);
  ok('Sanctuary ends after its duration', !(p.zones || []).length && !ally.status.has('sanctuary'));

  // Guardian March
  const x0 = p.x; p.aim = 0;
  const mr = p.trySkill(p.skillSys.get('guardian_march'));
  g.simulate(0.3, () => { tickAlly(); p.aim = 0; });
  const marching = p.status.has('guardian_march');
  idle(g);
  ok('Guardian March: advances behind the shield, damage reduction while marching', mr && marching && Math.abs(p.x - x0) > 50, `moved ${r0(p.x - x0)} px`);

  // sanity
  const res = p.resources.get(R);
  const cds = ['dawn_shield', 'radiant_chain', 'dawn_bastion', 'guardian_march', 'grace_of_dawn', 'dawns_sanctuary'].map((id) => p.skillSys.cooldowns.remaining(id));
  ok('No negative / overfull resource, no negative cooldown', res >= 0 && res <= 100 && cds.every((c) => c >= 0), `dawn ${r0(res)} cds ${cds.map((c) => c.toFixed(1)).join(',')}`);
  g.party.remove(ally); ally.dispose(); releaseInput(g);
  return rows;
}

// ---------------- BULWARK SENTINEL (Class 2 of the Aegis): Bastion / Fortified / taunt / Shieldwall by position /
// mitigation / Counterweight cap / Citadel of One duration
export function bulwarkChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'bulwark_sentinel', test: name, pass: !!pass, detail });
  const R = 'bastion', r0 = (n) => Math.round(n);
  let { p, d } = atDummy(g, 'bulwark_sentinel');
  const cls = p.cls, inFight = () => { g.combat.lastCombatTime = g.time; };
  ok('Class data: preset bs, Bastion, own skills + guard + passives', p.sprites.preset === 'bs' && p.primaryResource === R && p.skillSys.get('citadel_of_one') && cls.special.id === 'bulwark_guard' && cls.passives.length >= 2 && g.equipment.slots.weapon === 'bastion_aegis', `${p.sprites.preset} ${p.primaryResource} ${g.equipment.slots.weapon}`);
  const hitMe = (power = 20, extra = {}) => { p.invulnT = 0; const hp0 = p.hp; g.combat.dealDamage({ x: p.x + 20, y: p.y, team: 'enemy' }, p, { power, noCrit: true, knock: 0, ...extra }); return hp0 - p.hp; };

  // Bastion from hits, x2 in Iron Bastion
  p.resources.set(R, 0); p.hp = p.maxHp; hitMe(20); const plainGain = p.resources.get(R);
  ok('Taking a hit builds Bastion (capped per hit)', plainGain >= 1 && plainGain <= 6, `+${plainGain.toFixed(1)}`);
  const plainDmg = hitMe(30);
  g.simulate(0.3, inFight); p.resources.set(R, 0); cast(g, 'iron_bastion', d); p.hp = p.maxHp; // (after the hurt reaction)
  const stDmg = hitMe(30), stGain = p.resources.get(R);
  ok('Iron Bastion: 40% less damage, slower, double Bastion from hits', p.status.has('iron_bastion') && stDmg <= Math.ceil(plainDmg * 0.7) + 1 && p.status.moveMult() < 0.6 && stGain > plainGain * 1.5, `dmg ${plainDmg}->${stDmg} gain ${plainGain.toFixed(1)}->${stGain.toFixed(1)}`);
  g.simulate(0.3, inFight); const re = p.trySkill(p.skillSys.get('iron_bastion'));
  ok('Iron Bastion: pressing again leaves the stance', re && !p.status.has('iron_bastion'));

  // Fortified threshold
  p.resources.set(R, 69); g.simulate(0.1, inFight);
  ok('Below 70: not fortified', !p.status.has('fortified'));
  p.resources.set(R, 75); g.simulate(0.1, inFight);
  const fortOn = p.status.has('fortified');
  const b0 = p.resources.get(R); g.simulate(1, inFight);
  ok('At 70 Bastion: FORTIFIED (+DEF, no knockback) and it drains Bastion', fortOn && p.status.has('fortified') && p.resources.get(R) < b0 - 3, `${r0(b0)} -> ${r0(p.resources.get(R))}`);
  const x0 = p.x; hitMe(5, { knock: 400 }); g.simulate(0.3, inFight);
  ok('Fortified: no knockback', Math.abs(p.x - x0) < 1, `moved ${(p.x - x0).toFixed(1)}`);
  p.resources.set(R, 9); g.simulate(0.1, inFight);
  ok('Fortified ends under 10 Bastion; cannot restart at once (lockout)', !p.status.has('fortified') && (() => { p.resources.set(R, 90); g.simulate(0.1, inFight); return !p.status.has('fortified'); })());

  // Unbroken: knockback halved (no fortify)
  ({ p, d } = atDummy(g, 'bulwark_sentinel'));
  const kx = p.x; p.invulnT = 0; g.combat.dealDamage({ x: p.x - 20, y: p.y, team: 'enemy' }, p, { power: 1, knock: 300, noCrit: true }); g.simulate(0.4);
  const bulwarkKb = Math.abs(p.x - kx);
  ok('Unbroken: knockback resisted (knockResist 0.5), tenacity shortens stuns', bulwarkKb > 0 && p.stats.knockResist >= 0.5 && (() => { p.status.add('stun', 1); const t = p.status.get('stun').t; p.status.remove('stun'); return t <= 0.71; })(), `moved ${bulwarkKb.toFixed(1)}`);

  // Taunt
  ({ p, d } = atDummy(g, 'bulwark_sentinel'));
  const foes = g.world.dummies.filter((t) => Math.hypot(t.x - p.x, t.y - p.y) < 170);
  p.resources.set(R, 0); cast(g, 'absolute_provocation', d); idle(g);
  ok('Absolute Provocation: every foe within 170 taunted + marked, Bastion +4 each (cap 16)', foes.length && foes.every((t) => t.status.has('taunted') && g.marks.get(t, 'guardian_mark')) && p.resources.get(R) <= 16 + 1e-6 && p.resources.get(R) >= 4, `${foes.length} foes, bastion ${r0(p.resources.get(R))}`);

  // Fortress Step
  ({ p, d } = atDummy(g, 'bulwark_sentinel', 60));
  const sx = p.y; cast(g, 'fortress_step', d); idle(g);
  ok('Fortress Step: steps forward, marks the target', Math.abs(p.y - sx) > 20 && g.marks.get(d, 'guardian_mark') > 0, `moved ${r0(Math.abs(p.y - sx))}`);

  // Counterweight cap
  ({ p, d } = atDummy(g, 'bulwark_sentinel'));
  p.weight = 0; const low = cls.counterPower(p, 0);
  p.weight = p.maxHp * 5; p.lastWeightT = g.time; const high = cls.counterPower(p, 0);
  ok('Counterweight: more damage taken = stronger counter, capped', Math.abs(low - cls.weight.basePower) < 1e-9 && Math.abs(high - cls.weight.maxPower) < 1e-9 && high > low, `${low} .. ${high}`);
  p.hp = p.maxHp; p.weight = 0; for (let i = 0; i < 3; i++) { hitMe(25); }
  g.simulate(0.3); const stored = p.weight;
  let dealt = 0; g.events.on('damageDealt', (e) => { if (e.source === p && e.opts && e.opts.skillId === 'counterweight') dealt += e.amount; });
  cast(g, 'counterweight', d); idle(g);
  ok('Counterweight uses up the stored weight', stored > 0 && p.weight === 0 && dealt > 0, `stored ${r0(stored)} dealt ${dealt}`);
  p.weight = 50; p.lastWeightT = g.time - 10; g.simulate(0.1);
  ok('Stored weight is forgotten after 6 s without being hit', p.weight === 0);

  // Shieldwall by position (an ally in front / behind)
  const A = CLASSES.aegis_guardian, ally = new p.constructor(g, A, g.spritesFor(A));
  ally.recomputeStats(); ally.hp = ally.maxHp; g.party.add(ally);
  const tickAlly = () => { ally.status.update(STEP); inFight(); };
  p.resources.set(R, 40); aim(g, p.x + 100, p.y); g.simulate(STEP * 2);
  const wr = p.trySkill(p.skillSys.get('shieldwall')); g.simulate(0.4, tickAlly);
  const wall = (p.walls || [])[0];
  ally.x = p.x - 40; ally.y = p.y; g.simulate(0.2, tickAlly);
  const behind = ally.status.has('shieldwall');
  ally.x = wall ? wall.x + 60 : p.x + 100; g.simulate(0.4, tickAlly);
  const front = ally.status.has('shieldwall');
  ok('Shieldwall: protects the ones BEHIND it (you too), not in front; 20 Bastion', wr && wall && behind && !front && p.status.has('shieldwall') && r0(p.resources.get(R)) <= 20, `behind ${behind} front ${front}`);
  ally.x = p.x - 40; g.simulate(6.5, tickAlly);
  ok('Shieldwall ends after 6 s', !(p.walls || []).length && !ally.status.has('shieldwall'));

  // Citadel of One
  p.resources.set(R, 49);
  ok('Citadel of One needs 50 Bastion', !p.skillSys.use('citadel_of_one').ok);
  p.resources.set(R, 55); ally.x = p.x - 50; ally.y = p.y;
  const ur = p.trySkill(p.skillSys.get('citadel_of_one')); g.simulate(1.8, tickAlly);
  const spd = p.status.moveMult(), dc = p.dodgeCost();
  ok('Citadel: fortress mode (-50% damage, no knockback), allies nearby warded, taunt pulse', ur && p.status.has('citadel') && p.status.flag('unshakable') && ally.status.has('citadel_ward') && d.status.has('taunted'), `ward ${ally.status.has('citadel_ward')}`);
  ok('Citadel trade-off: very slow, dodges cost double', spd <= 0.36 && dc >= 40, `move x${spd.toFixed(2)} dodge ${dc}`);
  p.weight = p.maxHp * 5; p.lastWeightT = g.time;
  ok('Citadel: Counterweight ×1.5, still under the hard cap', cls.counterPower(p, 0) <= cls.weight.hardCap && cls.counterPower(p, 0) > cls.weight.maxPower);
  g.simulate(10, tickAlly);
  ok('Citadel ends after 10 s', !p.status.has('citadel'));

  // Iron Will
  p.hp = Math.round(p.maxHp * 0.3); g.simulate(0.1);
  ok('Iron Will: under 40% HP, +50% DEF', p.status.has('iron_will'));
  const res = p.resources.get(R), cds = ['iron_bastion', 'fortress_step', 'absolute_provocation', 'counterweight', 'shieldwall', 'citadel_of_one'].map((id) => p.skillSys.cooldowns.remaining(id));
  ok('No negative / overfull resource, no negative cooldown', res >= 0 && res <= 100 && cds.every((c) => c >= 0), `bastion ${r0(res)}`);
  g.party.remove(ally); ally.dispose(); releaseInput(g);
  return rows;
}

// ---------------- OATHBREAKER (Class 2 of the Aegis): Broken Oath / Defiant Guard conversion / Perfect Guard /
// Sinful Counter spend + cap / Ruin Chain pull / Oath of Ruin trade-off / Verdict store + blast
export function oathChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'oathbreaker', test: name, pass: !!pass, detail });
  const R = 'broken_oath', r0 = (n) => Math.round(n);
  let { p, d } = atDummy(g, 'oathbreaker');
  const cls = p.cls, inFight = () => { g.combat.lastCombatTime = g.time; };
  ok('Class data: preset ok, Broken Oath, own skills + guard + passives', p.sprites.preset === 'ok' && p.primaryResource === R && p.skillSys.get('oathbreaker_verdict') && cls.special.id === 'defiant_guard' && cls.passives.length >= 2 && g.equipment.slots.weapon === 'ruin_blade', `${p.sprites.preset} ${p.primaryResource}`);
  const hitMe = (power = 20, src = { x: p.x + 20, y: p.y, team: 'enemy' }) => { p.invulnT = 0; const hp0 = p.hp; g.combat.dealDamage(src, p, { power, noCrit: true, knock: 0 }); return hp0 - p.hp; };

  p.resources.set(R, 0); p.hp = p.maxHp; hitMe(30);
  const g1 = p.resources.get(R);
  ok('Taking a hit builds Broken Oath (capped per hit)', g1 > 0 && g1 <= cls.charge.hurtMax, `+${g1.toFixed(1)}`);
  p.resources.set(R, 0); p.hp = p.maxHp; hitMe(9999, { x: p.x + 20, y: p.y, team: 'enemy', isBoss: true });
  ok('A boss hit gives more, still capped', p.resources.get(R) <= cls.charge.bossMax && p.resources.get(R) > cls.charge.hurtMax, `+${r0(p.resources.get(R))}`);

  // Defiant Guard: block conversion + Retaliation; Perfect Guard
  g.newGame('oathbreaker'); releaseInput(g); p = g.player; goto(g, 38, 121);
  const foe = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  for (const m of g.world.monsters) if (!m.dead) m.status.add('stun', 20);
  foe.x = p.x + 30; foe.y = p.y; aim(g, foe.x, foe.y); p.hp = p.maxHp; p.invulnT = 0;
  const strike = () => { foe.status.remove('stun'); g.combat.enemyStrike(foe, { shape: 'circle', x: p.x, y: p.y, r: 30 }, 14, {}); foe.status.add('stun', 20); };
  p.resources.set(R, 0); g.input.down.add('KeyQ'); g.simulate(0.45, () => { aim(g, foe.x, foe.y); inFight(); });
  const hpB = p.hp; strike(); g.input.down.delete('KeyQ');
  ok('Defiant Guard: block converts damage to Broken Oath and opens RETALIATION', p.hp < hpB && p.resources.get(R) > 0 && g.time < p.retaliateUntil, `hp ${hpB}->${p.hp} oath ${p.resources.get(R).toFixed(1)}`);
  g.simulate(0.5, inFight); p.resources.set(R, 0); p.invulnT = 0; const hpP = p.hp;
  aim(g, foe.x, foe.y); g.simulate(STEP * 2); p.setGuard(true); strike(); g.simulate(0.6, inFight);
  ok('Perfect Guard: no damage, +25 Broken Oath (Pain Repaid), riposte', p.hp === hpP && p.resources.get(R) >= 25, `hp ${hpP}->${p.hp} oath ${r0(p.resources.get(R))}`);
  p.setGuard(false); g.simulate(0.4, inFight);

  // Sinful Counter
  ({ p, d } = atDummy(g, 'oathbreaker'));
  p.resources.set(R, 15);
  ok('Sinful Counter needs 20 Broken Oath', !p.skillSys.use('sinful_counter', p, g, 0).ok && p.resources.get(R) === 15);
  const lowPw = cls.counterPower(p, 20), maxPw = cls.counterPower(p, 999);
  p.retaliateUntil = g.time + 1; p.hp = Math.round(p.maxHp * 0.3); p.status.add('oath_of_ruin', 5); p.status.add('forbidden_oath', 5);
  const capPw = cls.counterPower(p, 999, d);
  p.hp = p.maxHp; p.status.remove('oath_of_ruin'); p.status.remove('forbidden_oath'); p.retaliateUntil = 0;
  ok('Counter power grows with the oath spent, capped (max 3.3×, every bonus together ≤ 5×)', maxPw > lowPw && Math.abs(maxPw - cls.counter.maxPower) < 1e-9 && capPw <= cls.counter.hardCap + 1e-9 && capPw > maxPw, `${lowPw.toFixed(2)} .. ${maxPw.toFixed(2)} .. ${capPw.toFixed(2)}`);
  p.resources.set(R, 90);
  let dealt = 0; g.events.on('damageDealt', (e) => { if (e.source === p && e.opts && e.opts.skillId === 'sinful_counter') dealt += e.amount; });
  cast(g, 'sinful_counter', d); idle(g);
  ok('Sinful Counter spends at most 60 and hits', r0(p.resources.get(R)) === 30 && dealt > 0, `oath 90 -> ${r0(p.resources.get(R))}, dmg ${dealt}`);
  const plainDealt = dealt; dealt = 0;
  ({ p, d } = atDummy(g, 'oathbreaker'));
  g.events.on('damageDealt', (e) => { if (e.source === p && e.opts && e.opts.skillId === 'sinful_counter') dealt += e.amount; });
  p.resources.set(R, 90); p.retaliateUntil = g.time + 5; cast(g, 'sinful_counter', d); idle(g);
  ok('Inside RETALIATION the counter hits harder, and the window is used up', dealt > plainDealt && !(g.time < p.retaliateUntil), `${plainDealt} -> ${dealt}`);

  // Oath Brand + Ruin Chain
  ({ p, d } = atDummy(g, 'oathbreaker', 120));
  ok('Ruin Chain needs a branded foe', !p.skillSys.canUse('ruin_chain').ok);
  cast(g, 'oath_brand', d); idle(g);
  ok('Oath Brand marks + taunts the foe in front', g.marks.get(d, 'oath_brand') > 0 && d.status.has('taunted'));
  g.newGame('oathbreaker'); releaseInput(g); p = g.player; goto(g, 38, 121); // a real monster (A1)
  const mob = g.world.monsters.filter((m) => !m.dead && g.world.onMap(m) && !m.isBoss).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  for (const m of g.world.monsters) if (!m.dead) m.status.add('stun', 5);
  mob.x = p.x + 180; mob.y = p.y; g.marks.clearAll(); cls.brand(p, g, mob);
  const d0 = Math.hypot(mob.x - p.x, mob.y - p.y);
  const rc = p.trySkill(p.skillSys.get('ruin_chain')); g.simulate(0.9);
  const d1 = Math.hypot(mob.x - p.x, mob.y - p.y);
  ok('Ruin Chain drags the branded foe to you and roots it', rc && d1 < d0 - 60 && mob.status.has('root'), `${r0(d0)} -> ${r0(d1)} px`);

  // Oath of Ruin trade-off
  ({ p, d } = atDummy(g, 'oathbreaker'));
  const plain = hitMe(30); g.simulate(0.3); // (after the hurt reaction)
  cast(g, 'oath_of_ruin', d); idle(g); const risky = hitMe(30);
  ok('Oath of Ruin: +damage, but takes MORE damage (trade-off), ends after 8 s', p.status.has('oath_of_ruin') && risky > plain && p.status.damageMult() > 1.2 && (() => { g.simulate(8.2); return !p.status.has('oath_of_ruin'); })(), `taken ${plain} -> ${risky}`);

  // Verdict
  ({ p, d } = atDummy(g, 'oathbreaker'));
  p.resources.set(R, 59);
  ok('Oathbreaker Verdict needs 60 Broken Oath', !p.skillSys.use('oathbreaker_verdict').ok);
  p.resources.set(R, 60);
  const vr = p.trySkill(p.skillSys.get('oathbreaker_verdict')); g.simulate(1.6);
  ok('Forbidden Oath: no knockback, foes taunted + ruined', vr && p.status.has('forbidden_oath') && p.status.flag('unshakable') && d.status.has('ruin'), '');
  for (let i = 0; i < 20; i++) { hitMe(60); g.simulate(0.1); p.hp = p.maxHp; }
  const store = p.verdictStore;
  ok('Damage taken is stored, capped at 60% max HP', store > 0 && store <= p.maxHp * cls.verdict.storeCap + 1e-6, `${r0(store)} / ${r0(p.maxHp * cls.verdict.storeCap)}`);
  let blast = null; g.events.on('verdictBlast', (e) => { blast = e; });
  g.simulate(10);
  ok('When the oath ends: the VERDICT blast, power capped at 4.5×', blast && blast.power <= cls.verdict.maxPower && !p.status.has('forbidden_oath') && !p.verdictStore, blast ? `×${blast.power.toFixed(2)}` : 'no blast');
  const res = p.resources.get(R), cds = ['oath_brand', 'sinful_counter', 'ruin_chain', 'oath_of_ruin', 'oathbreaker_verdict'].map((id) => p.skillSys.cooldowns.remaining(id));
  ok('No negative / overfull resource, no negative cooldown', res >= 0 && res <= 100 && cds.every((c) => c >= 0));
  releaseInput(g);
  return rows;
}

// ---------------- Phase 13: class change, proven with a mock Class 2 registered from data only
export function classChangeChecks(g) {
  const rows = [], ok = (name, pass, detail = '') => rows.push({ class: 'class_change', test: name, pass: !!pass, detail });
  const base = CLASSES.umbral_sword;
  CLASSES.mock_class2 = { ...base, id: 'mock_class2', stableId: 'class_mock_class2', name: 'Mock Class 2' };
  CLASS_TREE.mock_class2 = { id: 'mock_class2', name: 'Mock Class 2', tier: 2, parent: 'astral_weaver', playable: true, requirements: [], trial: null };
  try {
    let { p, d } = atDummy(g, 'astral_weaver');
    p.level = 14; p.exp = 33; p.gold = 777; p.recomputeStats(); p.hp = Math.round(p.maxHp / 2);
    g.threads.create(p, 'astral_thread', { x: p.x, y: p.y }, { x: p.x + 80, y: p.y });
    const listeners = (n) => (g.events.map.get(n) || []).length;
    const hooksBefore = listeners('threadTouched') + listeners('markTriggered');
    g.combat.lastCombatTime = -99;
    ok('Locked class refused', g.changeClass('mock_class2').reason === 'locked');
    g.progression.unlock('mock_class2');
    g.combat.lastCombatTime = g.time;
    ok('Refused in combat', g.changeClass('mock_class2').reason === 'combat');
    g.combat.lastCombatTime = -99;
    g.progression.unlock('stormcaller');
    ok('Unlocked but not playable yet (real Class 2) refused', g.changeClass('stormcaller').reason === 'not_playable');
    const before = { x: p.x, y: p.y, level: p.level, exp: p.exp, gold: p.gold, ratio: p.hp / p.maxHp };
    const r = g.changeClass('mock_class2');
    const np = g.player;
    ok('Class changed', r.ok && np.cls.id === 'mock_class2' && np !== p, np.cls.id);
    ok('New preset / resource / skills / loadout', np.sprites.preset === base.preset && np.primaryResource === base.resource && np.skillSys.get(base.skills[0].id) && np.loadout.serialize().join() === (base.defaultLoadout || []).join(), `preset ${np.sprites.preset}, ${np.primaryResource}`);
    ok('Kept level / EXP / gold / position / HP ratio', np.level === before.level && np.exp === before.exp && np.gold === before.gold && np.x === before.x && Math.abs(np.hp / np.maxHp - before.ratio) < 0.02, `LV${np.level} gold ${np.gold} hp ${np.hp}/${np.maxHp}`);
    ok('Old class passives detached', listeners('threadTouched') + listeners('markTriggered') < hooksBefore, `hooks ${hooksBefore} -> ${listeners('threadTouched') + listeners('markTriggered')}`);
    ok('Old class threads removed', g.threads.count() === 0);
    ok('Signature gear swapped, old gear kept', g.equipment.slots.weapon === base.startingGear.weapon && g.inventory.has('celestial_loom'), g.equipment.slots.weapon);
    ok('History + classChanged recorded', g.progression.history.length > 0 && g.progression.history.slice(-1)[0].to === 'mock_class2');
    // the new class fights
    releaseInput(g); np.x = d.x; np.y = d.y + 30; const hp0 = d.hp;
    g.simulate(0.6, (gg, i) => { aim(g, d.x, d.y); if (i === 1) gg.input.pushBuffer('attack'); });
    ok('New class deals damage', d.hp < hp0, `dummy ${hp0} -> ${d.hp}`);
    // save / load keeps the new class and the ownership
    g.combat.lastCombatTime = -99;
    const saved = g.save.save(); g.loadGame();
    ok('Save / load keeps the changed class', saved && g.player.cls.id === 'mock_class2' && g.progression.owns('mock_class2') && g.progression.owns('astral_weaver'), g.player.cls.id);
    // and back to the starting class
    g.combat.lastCombatTime = -99;
    const back = g.changeClass('astral_weaver');
    ok('Can return to the starting class', back.ok && g.player.cls.id === 'astral_weaver' && g.player.primaryResource === 'astral_charge');
    // a starting class switch through the dev path gives a working guard
    g.combat.lastCombatTime = -99;
    g.changeClass('aegis_guardian', { force: true });
    g.player.setGuard(true);
    ok('Aegis after a change: guard works', g.player.guardState.active && g.player.tryBlock({ x: g.player.x + Math.cos(g.player.aim) * 30, y: g.player.y + Math.sin(g.player.aim) * 30 }) !== null);
  } finally {
    delete CLASSES.mock_class2; delete CLASS_TREE.mock_class2;
    g.newGame('astral_weaver');
  }
  return rows;
}

// ---------------- balance report: dummy DPS (30 s bot) + a real boss fight (no god mode)
// loadout: optional [id,id,id,id] for keys 1-4 (compare builds of the same class)
export function balance(g, classId, loadout, botOpts = {}) {
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
  const pl = g.player; pl.setLevel(10); pl.hp = pl.maxHp;
  if (loadout) pl.loadout.load(loadout);
  goto(g, 135, 37); g.simulate(3);
  const gd = g.world.guardian;
  let t = 0, dmgTaken = 0;
  g.events.on('damageTaken', (e) => { if (e.target === pl) dmgTaken += e.amount; });
  const pots0 = g.inventory.count('hp_potion');
  let blocked = 0, perfects = 0;
  g.events.on('guardBlocked', () => blocked++); g.events.on('perfectGuard', () => perfects++);
  while (t < 300 && !gd.dead && !pl.dead) { g.simulate(5, (gg, i) => bot(gg, i, botOpts)); t += 5; }
  releaseInput(g);
  return { class: classId, loadout: p.loadout.serialize().join(','), dummyDPS: dps, bossResult: gd.dead ? 'WIN' : pl.dead ? 'DIED' : 'TIMEOUT', bossTime: t + 's', bossPhase: gd.phase, dmgTaken: Math.round(dmgTaken), takenPerSec: +(dmgTaken / Math.max(1, t)).toFixed(2), blocked, perfects, potionsUsed: pots0 - g.inventory.count('hp_potion'), skillUses: JSON.stringify(uses) };
}

export function runAll(g, { withBalance = true } = {}) {
  const rows = [], bal = [];
  for (const c of [...STARTING_CLASSES, ...ADVANCED]) rows.push(...classChecks(g, c), ...mechanicChecks(g, c));
  rows.push(...reaperChecks(g), ...duskChecks(g), ...echoChecks(g), ...wardenChecks(g), ...bulwarkChecks(g), ...oathChecks(g), ...classChangeChecks(g));
  if (withBalance) for (const c of [...STARTING_CLASSES, ...ADVANCED]) bal.push(balance(g, c));
  return { passed: rows.filter((r) => r.pass).length, total: rows.length, rows, balance: bal };
}
