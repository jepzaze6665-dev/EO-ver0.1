import { TAU, rand } from '../core/math.js';

// BLADE OF ECHOES — Class 2 of the Umbral Sword. Duelist · Counter DPS · Boss Specialist.
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('echo' + tiers = passive PAIN REMEMBERS) · Player counter stance (action.counter -> perfectGuard)
//   ActionRecorder (combat/actionRecorder.js: p.memory, rules in `memory` below) · SkillSystem recast (Rewind Edge)
//   + requirements 'recorded' / 'hpBelow' · SummonSystem ('rewind_mark', 'echo_self') · StatusSystem (last_stand)
// Gameplay loop: READ the enemy → CRIMSON COUNTER [Q] at the right moment → a huge counter strike + Echo →
//   everything you do is RECORDED → CRIMSON MEMORY replays your last skill, BLADE OF RECOLLECTION replays the last
//   6 seconds as a crimson copy → high Echo = stronger counters and echoes. Taking hits also feeds Echo (pain remembers).
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#ff4a5a', CR = '255,74,90', PALE = '#ffd8dc';
const E = 'echo';

// animation table for the 'be' preset (tools/build-player.js be → assets/player/be)
// hit: the IMPACT columns (blade actually swinging). Every damage event of an action must land while one of them is
// on screen (tools/tests/echoes.test.mjs checks it), so the hit never comes before the swing.
export const BE_ANIMS = {
  idle: { sheet: 'idle', cols: [0, 1, 2, 3, 4, 5], fps: 4, loop: true },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 9, loop: true },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 13, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 3, 4], hit: [3] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 3, 4], hit: [3] }, // thrust
  atk3: { sheet: 'sk1', cols: [1, 2, 3, 4], hit: [2, 3] }, // crimson crescent finisher
  dodge: { sheet: 'dash', cols: [1, 2, 3, 4] },
  echoSlash: { sheet: 'sk1', cols: [1, 2, 3, 4], hit: [2, 3] },
  stance: { sheet: 'sk6', cols: [1, 1, 1, 1, 2] },       // blade raised, waiting
  counterStrike: { sheet: 'sk2', cols: [2, 3, 3, 4], hit: [3] }, // the crimson X
  rewind: { sheet: 'sk3', cols: [1, 2, 3, 3, 4], hit: [3] },
  memory: { sheet: 'sk4', cols: [1, 2, 3, 4] },
  lastStand: { sheet: 'sk5', cols: [1, 2, 3, 3, 4], hit: [3] },
  recollection: { sheet: 'ult', cols: [1, 2, 3, 3, 4], hit: [3] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const power = (p) => 1 + (p.stats.echoPower || 0); // PAIN REMEMBERS: Echo tiers add echoPower
function feeder(p, per, cap) {
  let got = 0;
  return () => { if (got < cap) { got += per; p.gainResource(per); } };
}
function nearestFoe(g, x, y, within) {
  let best = null, bd = within;
  for (const m of g.world.hostiles()) {
    if (m.dead || m.isBreakable) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
function slide(g, obj, dx, dy) {
  const tmp = { x: obj.x, y: obj.y, radius: 7 };
  g.world.map.moveCircle(tmp, dx, dy);
  obj.x = tmp.x; obj.y = tmp.y;
}

export const BladeOfEchoes = {
  id: 'blade_of_echoes',
  stableId: 'class_blade_of_echoes',
  name: 'Blade of Echoes',
  role: 'Duelist · Counter DPS · Boss Specialist',
  difficulty: 4,
  ratings: { damage: 4, range: 2, defense: 3, mobility: 2, support: 1 },
  description: 'The Umbral Sword who chose memory: reads every attack, counters it, and replays its own remembered blows.',
  identity: 'Read. Counter. Remember. Strike again.',
  strengths: ['Huge counter damage against enemies with clear attack patterns (bosses)', 'Replays its own actions: Crimson Memory, Blade of Recollection', 'Sturdiest of the Umbral line: Last Stand, Rewind Edge heals'],
  weaknesses: ['Needs to read timing: a missed counter wastes the opening', 'Slow against packs that never commit to an attack', 'Echo must be earned — often by getting hurt'],
  signatureWeapon: 'Memory Blade',
  preset: 'be',
  anims: BE_ANIMS,
  theme: { color: C, ghost: '#ff2040', trail: 'shadow' },
  resource: E, // builder: taking hits, perfect counters, echo skills (tiers in data/resources.js = PAIN REMEMBERS)
  resources: [E],
  mark: null,
  base: { hp: 275, atk: 22, def: 9, crit: 0.08, critDmg: 0, physicalDmg: 0, cdr: 0, speed: 148, echoGain: 1, armorBreak: 1, echoPower: 0 },
  perLevel: { hp: 13, atk: 1.5, def: 0.6 },
  defaultLoadout: ['echo_slash', 'rewind_edge', 'crimson_memory', 'last_stand'],
  // ECHO rules (data, not code)
  charge: { basicHit: 1, combo: 3, echoHit: 4, echoCap: 10, counter: 20, hurtPerHpShare: 60, hurtMin: 2, hurtMax: 15, rewindCost: 15 },
  // PERFECT COUNTER (Crimson Counter): the strike after a parry
  counter: { window: [0.05, 0.5], power: 3.0, lastStandBonus: 0.3, stun: 1.0, stagger: 80, rewindCut: 3 },
  // MEMORY RECORD & REPLAY — generic ActionRecorder rules (Player creates p.memory from this)
  memory: {
    keep: 6, max: 8, kinds: ['basic', 'skill', 'dodge', 'counter'],
    noRecord: ['crimson_memory', 'blade_of_recollection'], // replaying these could loop
    replayable: ['echo_slash', 'crimson_counter', 'basic2'],   // what Crimson Memory may recall (basic2 = the combo finisher)
    recallWithin: 6,
  },
  // BLADE OF RECOLLECTION: the crimson copy replays the last `steps` actions, one every `interval` s
  recollection: { steps: 6, interval: 0.3, range: 260, power: { basic: 1.4, skill: 2.0, dodge: 1.2, counter: 3.0 }, finale: 2.5 },
  lastStand: { dur: 6, echoGain: 1.5 },
  rewind: { heal: 0.4, range: 520 },
  passives: [
    { id: 'persistent_memory', name: 'Persistent Memory', desc: 'A Perfect Counter takes 3 s off Rewind Edge\'s cooldown.' },
    { id: 'pain_remembers', name: 'Pain Remembers', desc: 'Echo tiers: RESONANCE (50) counter and echo damage +25% · FULL MEMORY (90) +50% and +10% crit. Taking damage builds Echo.' },
  ],
  guideIntro: [
    'Watch the enemy. When a blow is about to land, press [Q] CRIMSON COUNTER: a hit inside the stance is parried and answered with a crimson strike.',
    'Everything you do is remembered for 6 s. CRIMSON MEMORY [3] replays your last skill, the ultimate [5] replays your last 6 actions as a crimson copy.',
  ],
  tutorial: { marks: 'Land a Perfect Counter', break: 'Use Crimson Counter', breakSkill: 'crimson_counter' },
  perfectGuardText: 'PERFECT COUNTER',

  // HUD counter: actions in memory (what the ultimate would replay)
  hudCounter(p) {
    const n = p.memory ? p.memory.recent(p.game.time, { n: 6 }).filter((e) => !p.cls.memory.noRecord.includes(e.id)).length : 0;
    const ready = p.resources.get(E) >= 50;
    return { label: 'MEMORY', value: n, max: 6, color: C, full: PALE, ready, readyText: 'BLADE OF RECOLLECTION READY — [5]' };
  },

  record(p, action) { if (p.memory) p.memory.record({ x: p.x, y: p.y, ang: p.aim, ...action }, p.game.time); },

  // ECHO SLASH — the delayed copy of a cut (same place, same angle)
  echoCut(p, g, x, y, a, pw, { r = 70, half = 1.1, delay = 0.45 } = {}) {
    g.after(delay, () => {
      if (p.disposed || p.dead) return;
      g.vfx.sprite('be_crescent', x + Math.cos(a) * 30, y - 14 + Math.sin(a) * 30, a, { scale: 0.8, life: 0.24, glow: 0.5, alpha: 0.85 });
      g.audio.sfx('swing');
      const feed = feeder(p, p.cls.charge.echoHit, p.cls.charge.echoCap);
      g.combat.spawnHitbox({ owner: p, x, y: y - 10, ang: a, shape: 'cone', r, half, power: pw * power(p), type: 'physical', knock: 60, stagger: 14, hitStop: 0.04, shake: 0.08, onHit: feed });
    });
  },

  // ---------------- basic: two long-blade cuts, then a crimson crescent (COMBO) that echoes once
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.32, at: 0.13, anim: 'atk1', r: 62, half: 1.0, power: 1.05, lunge: 12 },
      { dur: 0.34, at: 0.14, anim: 'atk2', r: 72, half: 0.6, power: 1.15, lunge: 16 },
      { dur: 0.44, at: 0.14, anim: 'atk3', r: 70, half: 1.3, power: 1.7, lunge: 20, combo: true, knock: 200 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.5, ang: a, cancelAt: 0.05, comboAt: d.at + 0.08,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        let fed = false;
        cls.record(p, { kind: 'basic', id: 'basic' + step, ang: a });
        g.audio.sfx(d.combo ? 'slash_heavy' : 'swing');
        g.vfx.sprite(d.combo ? 'be_slash' : 'be_crescent', p.x + Math.cos(a) * 30, p.y - 14 + Math.sin(a) * 30, a, { scale: d.combo ? 0.8 : 0.55, life: 0.2, flipY: step === 1 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r, half: d.half, power: d.power, type: 'physical',
          knock: d.knock ?? 90, stagger: 10 + step * 6, hitStop: d.combo ? 0.08 : 0.045, shake: d.combo ? 0.18 : 0.1,
          onHit: () => { p.gainResource(cls.charge.basicHit); if (d.combo && !fed) { fed = true; p.gainResource(cls.charge.combo); } },
        });
        if (d.combo) cls.echoCut(p, g, p.x, p.y, a, 0.6);
      }]],
    };
  },

  // the strike that answers a Perfect Counter (started by onPerfectGuard)
  counterStrike(p, g, src) {
    const cls = p.cls, k = cls.counter, a = src && Number.isFinite(src.x) ? Math.atan2(src.y - p.y, src.x - p.x) : p.aim;
    const pw = k.power * power(p) * (p.status.has('last_stand') ? 1 + k.lastStandBonus : 1);
    return {
      name: 'counter_strike', dur: 0.4, anim: 'counterStrike', moveMul: 0, ang: a, cancelAt: 0.3, invuln: [0, 0.4], superArmor: true,
      events: [[0.11, () => {
        g.audio.sfx('ult_slash');
        g.vfx.sprite('be_bloom', p.x + Math.cos(a) * 34, p.y - 16 + Math.sin(a) * 34, a, { scale: 1.1, life: 0.3, glow: 0.6 });
        g.vfx.sprite('be_slash', p.x + Math.cos(a) * 30, p.y - 14 + Math.sin(a) * 30, a, { scale: 1.0, life: 0.25, glow: 0.5 });
        g.vfx.flash(CR, 0.22, 5);
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 84, half: 1.1, power: pw, forceCrit: true, counter: true, type: 'physical',
          knock: 180, stagger: k.stagger, hitStop: 0.12, shake: 0.35, big: true,
          onHit: (t) => { if (t.status && !t.isBoss && !t.isBreakable) t.status.add('stun', k.stun, { source: p }); },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'echo_slash', tier: 'fast', name: 'Echo Slash', type: 'active', cooldown: 4, cost: 0, targeting: 'direction',
      tags: ['melee', 'echo', 'recordable'], icon: 'echo_slash',
      desc: 'A heavy memory-blade cut. 0.45 s later its ECHO cuts the same place again (stronger with Echo). Builds Echo.',
      cast(p, g, a) {
        const cls = p.cls, feed = feeder(p, cls.charge.echoHit, cls.charge.echoCap);
        return {
          name: 'echo_slash', dur: 0.4, anim: 'echoSlash', moveMul: 0.3, ang: a, cancelAt: 0.3, lunge: { dist: 18, t0: 0, t1: 0.1 },
          events: [[0.12, () => {
            g.audio.sfx('slash_heavy');
            g.vfx.sprite('be_slash', p.x + Math.cos(a) * 32, p.y - 14 + Math.sin(a) * 32, a, { scale: 0.95, life: 0.24, glow: 0.4 });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 74, half: 1.1, power: 1.6, type: 'physical', knock: 110, stagger: 22, hitStop: 0.06, shake: 0.15, onHit: feed });
            cls.echoCut(p, g, p.x, p.y, a, 1.1, { r: 74 });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'rewind_edge', tier: 'fast', name: 'Rewind Edge', type: 'active', cooldown: 10, cost: 0, targeting: 'self',
      tags: ['rewind', 'recast', 'mobility', 'heal'], icon: 'rewind_edge',
      desc: 'Remember this place (4 s). Press again to rewind to it: you cut around you on arrival and, for 15 Echo, get back 40% of the HP you lost since.',
      recast: {
        window: 4,
        cast(p, g, a) {
          const cls = p.cls, s = g.summons.forOwner(p, 'rewind_mark')[0];
          const valid = s && !g.world.map.circleBlocked(s.x, s.y, p.radius) && Math.hypot(s.x - p.x, s.y - p.y) < cls.rewind.range;
          if (!valid) {
            if (s) g.summons.expire(s, 'invalid');
            g.vfx.text(p.x, p.y - 70, 'MEMORY LOST', { color: '#a08890', size: 9 });
            g.audio.sfx('deny');
            return { name: 'rewind_edge', dur: 0.12, anim: 'rewind', moveMul: 1, ang: a, cancelAt: 0 };
          }
          return {
            name: 'rewind_edge', dur: 0.4, anim: 'rewind', moveMul: 0, ang: a, cancelAt: 0.3, invuln: [0, 0.35],
            start: () => {
              g.vfx.sprite('be_vortex', p.x, p.y - 20, 0, { scale: 0.7, life: 0.3, glow: 0.5 });
              g.audio.sfx('blink');
              p.x = s.x; p.y = s.y; p.vx = p.vy = 0; p.kx = p.ky = 0;
              const lost = Math.max(0, (s.hpAt || p.hp) - p.hp);
              g.summons.expire(s, 'rewound');
              g.vfx.sprite('be_vortex', p.x, p.y - 20, 0, { scale: 0.9, life: 0.4, glow: 0.6 });
              g.vfx.text(p.x, p.y - 70, 'REWIND', { color: PALE, size: 11 });
              if (lost > 0 && p.resources.spend(E, cls.charge.rewindCost, 'skill:rewind_edge')) p.heal(Math.round(lost * cls.rewind.heal), 'rewind');
            },
            events: [[0.17, () => {
              g.audio.sfx('slash_heavy');
              g.vfx.ring(p.x, p.y, 10, 64, { life: 0.3, color: CR, width: 3 });
              g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 64, power: 1.3 * power(p), type: 'physical', knock: 120, stagger: 20, hitStop: 0.05, shake: 0.12 });
            }]],
          };
        },
      },
      cast(p, g, a) {
        const s = g.summons.create(p, 'rewind_mark', p.x, p.y);
        if (s) { s.facing = p.facing; s.hpAt = p.hp; }
        return {
          name: 'rewind_edge', dur: 0.25, anim: 'rewind', moveMul: 0.6, ang: a, cancelAt: 0.1,
          start: () => { g.audio.sfx('mark'); g.vfx.ring(p.x, p.y, 30, 6, { life: 0.35, color: CR, width: 2 }); },
        };
      },
    },
    {
      slot: 3, id: 'crimson_memory', tier: 'medium', name: 'Crimson Memory', type: 'active', cooldown: 8, cost: 25, targeting: 'direction',
      tags: ['replay', 'memory'], icon: 'crimson_memory',
      requirements: [{ type: 'recorded', ids: ['echo_slash', 'crimson_counter', 'basic2'], within: 6, label: 'a remembered Echo Slash, Crimson Counter or combo finisher' }],
      desc: 'REPLAY the last Echo Slash, Crimson Counter or combo finisher you used in the last 6 s — again, right now, with no cooldown.',
      cast(p, g, a) {
        const cls = p.cls, mem = cls.memory;
        const rec = p.memory.last(g.time, (e) => mem.replayable.includes(e.id) && g.time - e.t <= mem.recallWithin);
        if (!rec) return { name: 'crimson_memory', dur: 0.2, anim: 'memory', moveMul: 1, ang: a, cancelAt: 0 }; // nothing to recall (the requirement normally prevents this)
        // the recalled action is built by the same code as the original
        const act = p.memory.replay(() => (rec.id.startsWith('basic') ? cls.basic(p, g, a, +rec.id.slice(5)) : p.skillSys.get(rec.id).cast(p, g, a)));
        const start = act.start;
        act.start = () => {
          g.vfx.sprite('be_vortex', p.x, p.y - 20, 0, { scale: 0.6, life: 0.3, glow: 0.4, alpha: 0.8 });
          g.vfx.text(p.x, p.y - 72, 'CRIMSON MEMORY', { color: PALE, size: 10 });
          g.audio.sfx('mark_full');
          if (start) start();
        };
        act.basic = false; // a recalled finisher is a skill action (no combo chaining)
        // NO INFINITE REPLAY: what the recalled action does is never recorded again
        act.events = (act.events || []).map(([t, fn]) => [t, () => p.memory.replay(fn)]);
        return act;
      },
    },
    {
      slot: 4, id: 'last_stand', tier: 'fast', name: 'Last Stand', type: 'active', cooldown: 30, cost: 0, targeting: 'self',
      tags: ['buff', 'defense', 'conditional'], icon: 'last_stand',
      requirements: [{ type: 'hpBelow', max: 0.4, label: 'below 40% HP' }],
      desc: 'Only below 40% HP. For 6 s: take 40% less damage, counters hit 30% harder and Echo builds 50% faster.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'last_stand', dur: 0.4, anim: 'lastStand', moveMul: 0, ang: a, cancelAt: 0.3,
          events: [[0.17, () => {
            p.status.add('last_stand', cls.lastStand.dur, { source: p, refresh: true });
            p.resources.addModifier({ id: 'last_stand', resource: E, kind: 'gainMult', value: cls.lastStand.echoGain });
            g.audio.sfx('ult_charge');
            g.vfx.sprite('be_bloom', p.x, p.y - 24, -Math.PI / 2, { scale: 1.2, life: 0.4, glow: 0.6 });
            g.vfx.ring(p.x, p.y, 8, 70, { life: 0.45, color: CR, width: 3, fill: true });
            g.vfx.text(p.x, p.y - 76, 'LAST STAND', { color: '#ffffff', size: 12 });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'blade_of_recollection', tier: 'high', name: 'Blade of Recollection', type: 'ultimate', cooldown: 30, cost: 50, targeting: 'self',
      tags: ['ultimate', 'replay', 'summon', 'aoe'], icon: 'recollection', ultimate: true,
      desc: 'ULTIMATE (50 Echo). A crimson copy of you steps out of your memory and REPLAYS your last 6 actions in order (attacks, dashes, skills, counters) against the nearest foe, then ends with a crimson cross.',
      cast(p, g, a) {
        const cls = p.cls, rc = cls.recollection;
        const steps = p.memory ? p.memory.recent(g.time, { n: rc.steps }).filter((e) => !cls.memory.noRecord.includes(e.id)) : [];
        return {
          name: 'blade_of_recollection', dur: 0.9, anim: 'recollection', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 0.9], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.35);
            g.audio.sfx('ult_charge');
            g.vfx.flash(CR, 0.3, 2);
            g.vfx.sprite('be_vortex', p.x, p.y - 20, 0, { scale: 1.3, life: 0.6, glow: 0.6 });
          },
          events: [[0.45, () => {
            g.camera.punch(0.2); g.camera.shake(0.4);
            g.audio.sfx('ult_slash');
            g.vfx.text(p.x, p.y - 96, 'BLADE OF RECOLLECTION', { color: PALE, size: 13, life: 1.2 });
            g.vfx.ring(p.x, p.y, 12, 110, { life: 0.4, width: 5, color: CR, fill: true });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 100, power: 1.5 * power(p), type: 'physical', knock: 160, stagger: 40, hitStop: 0.1, shake: 0.3 });
            cls.replayMemory(p, g, steps.length ? steps : [{ kind: 'basic', id: 'basic0' }, { kind: 'basic', id: 'basic1' }, { kind: 'basic', id: 'basic2' }]);
          }]],
        };
      },
    },
  ],

  // the crimson copy replays recorded actions one by one. Each step re-validates its target: a foe that died or left
  // is replaced by the nearest one in range; with none, the step plays in its recorded direction (no crash, no stall).
  replayMemory(p, g, steps) {
    const cls = p.cls, rc = cls.recollection, back = p.facing + Math.PI;
    const s = g.summons.create(p, 'echo_self', p.x + Math.cos(back) * 30, p.y + Math.sin(back) * 30, { duration: steps.length * rc.interval + 1.2 });
    if (!s) return null;
    g.vfx.sprite('be_vortex', s.x, s.y - 20, 0, { scale: 0.9, life: 0.4, glow: 0.6 });
    steps.forEach((st, i) => g.after(0.25 + i * rc.interval, () => {
      if (!g.summons.list.includes(s) || p.disposed) return;
      const t = nearestFoe(g, s.x, s.y, rc.range);
      const a = t ? Math.atan2(t.y - s.y, t.x - s.x) : st.ang ?? s.facing;
      s.facing = a;
      if (t) { const d = Math.hypot(t.x - s.x, t.y - s.y); if (d > 40) slide(g, s, Math.cos(a) * (d - 34), Math.sin(a) * (d - 34)); }
      const pw = (rc.power[st.kind] || rc.power.basic) * power(p);
      g.audio.sfx(st.kind === 'counter' ? 'slash_heavy' : 'swing');
      if (st.kind === 'dodge') { // replayed dash: through the target
        const sx = s.x, sy = s.y;
        slide(g, s, Math.cos(a) * 90, Math.sin(a) * 90);
        g.summons.act(s, 'dodge', 0.25);
        g.vfx.sprite('be_wave', (sx + s.x) / 2, (sy + s.y) / 2 - 14, a, { scale: 0.8, life: 0.25 });
        g.combat.spawnHitbox({ owner: p, x: sx, y: sy - 8, ang: a, shape: 'line', len: Math.hypot(s.x - sx, s.y - sy) + 16, width: 30, power: pw, type: 'physical', knock: 60, stagger: 12, hitStop: 0.04 });
        return;
      }
      const anim = st.kind === 'counter' ? 'counterStrike' : st.kind === 'skill' ? 'echoSlash' : st.id === 'basic1' ? 'atk2' : st.id === 'basic2' ? 'atk3' : 'atk1';
      const dur = 0.28, ad = BE_ANIMS[anim];
      g.summons.act(s, anim, dur);
      // the hit lands when the copy's animation reaches its impact frame (same rule as the player's own actions)
      const k = ad.hit ? ad.cols.indexOf(ad.hit[0]) : 1;
      g.after((k / ad.cols.length) * dur + 0.01, () => {
        if (!g.summons.list.includes(s) || p.disposed) return;
        g.vfx.sprite(st.kind === 'counter' ? 'be_bloom' : 'be_slash', s.x + Math.cos(a) * 30, s.y - 14 + Math.sin(a) * 30, a, { scale: st.kind === 'counter' ? 1.0 : 0.8, life: 0.24, glow: 0.5 });
        g.combat.spawnHitbox({ owner: p, x: s.x, y: s.y - 10, ang: a, shape: 'cone', r: 72, half: 1.1, power: pw, type: 'physical', knock: st.kind === 'counter' ? 160 : 80, stagger: st.kind === 'counter' ? 50 : 14, hitStop: 0.05, shake: 0.1, big: st.kind === 'counter' });
      });
    }));
    g.after(0.25 + steps.length * rc.interval, () => { // FINALE: the memory closes with a crimson cross
      if (!g.summons.list.includes(s) || p.disposed) return;
      g.summons.act(s, 'counterStrike', 0.4);
      g.after(0.11, () => { // on the X frame of its swing
        if (!g.summons.list.includes(s) || p.disposed) return;
        g.vfx.sprite('be_recall', s.x, s.y - 16, s.facing, { scale: 1.3, life: 0.35, glow: 0.7 });
        g.vfx.sprite('be_bloom', s.x, s.y - 16, s.facing + Math.PI / 2, { scale: 1.3, life: 0.35, glow: 0.7 });
        g.camera.shake(0.35);
        g.audio.sfx('boom_small');
        g.combat.spawnHitbox({ owner: p, x: s.x, y: s.y - 8, shape: 'circle', r: 90, power: rc.finale * power(p), type: 'physical', knock: 200, stagger: 60, hitStop: 0.1, shake: 0.3, big: true });
      });
    });
    return s;
  },

  // ---------------- CRIMSON COUNTER (Q / right click): counter stance — a hit inside the window is parried and answered
  special: {
    id: 'crimson_counter', tier: 'medium', name: 'Crimson Counter', type: 'special', slot: 'Q', key: 'Q', icon: 'crimson_counter',
    cost: 0, cooldown: 3, stamina: 8, targeting: 'self', tags: ['counter', 'guard', 'recordable'],
    desc: 'Raise the Memory Blade for 0.5 s. A blow that lands inside the stance (any direction, not unblockable ones) is PARRIED: a guaranteed-crit counter strike that stuns (bosses stagger), +20 Echo. Mistimed = you take the hit normally.',
    cast(p, g, a) {
      const k = p.cls.counter;
      return {
        name: 'crimson_counter', dur: 0.62, anim: 'stance', moveMul: 0.15, ang: a, cancelAt: 0.45,
        counter: { from: k.window[0], to: k.window[1] }, // Player.tryBlock reads this
        start: () => { g.audio.sfx('mark'); g.vfx.ring(p.x, p.y, 34, 18, { life: 0.5, color: CR, width: 2 }); },
      };
    },
  },

  // ---------------- every frame (Player hook)
  tick(p) {
    // Last Stand's Echo gain bonus lives exactly as long as the status
    if (!p.status.has('last_stand') && p.resources.modifiers.some((m) => m.id === 'last_stand')) p.resources.removeModifier('last_stand');
  },

  // PERFECT COUNTER (Player.onBlock -> perfect): answer the blow
  onPerfectGuard(p, g, src) {
    const cls = p.cls, k = cls.counter;
    p.gainResource(cls.charge.counter, true);
    p.skillSys.cooldowns.reduce('rewind_edge', k.rewindCut); // PERSISTENT MEMORY
    cls.record(p, { kind: 'counter', id: 'crimson_counter' });
    g.world.setFlag('tut_marks'); // tutorial step "Land a Perfect Counter"
    p.startAction(cls.counterStrike(p, g, src));
  },

  // ---------------- passives: react to core events
  on: {
    // every skill you use is remembered (not the replays themselves)
    skillUsed(p, g, e) {
      if (e.caster !== p || e.recast || p.cls.memory.noRecord.includes(e.skillId)) return;
      p.cls.record(p, { kind: 'skill', id: e.skillId });
    },
    playerDodged(p, g, e) { if (e.player === p) p.cls.record(p, { kind: 'dodge', id: 'dodge', ang: p.dodgeAng }); },
    // PAIN REMEMBERS: taking damage builds Echo
    damageTaken(p, g, e) {
      if (e.target !== p || !(e.amount > 0) || (e.opts && e.opts.dot)) return;
      const c = p.cls.charge;
      p.gainResource(Math.max(c.hurtMin, Math.min(c.hurtMax, (e.amount / p.maxHp) * c.hurtPerHpShare)));
    },
    resourceTier(p, g, e) {
      if (e.entity !== p || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: e.tier >= 1 ? '#ffffff' : PALE, size: e.tier >= 1 ? 13 : 11, life: 1.1 });
      g.vfx.ring(p.x, p.y, 8, 60, { life: 0.4, color: CR, width: 3 });
      g.audio.sfx('mark_full');
    },
  },
  counterBonus: { resource: 8 }, // data/counter.js (the Counter Window after a parry / dodge)
  perfectDodge: { resource: 10, stamina: 10, cooldownCut: 0.5 }, // data/dodge.js
};
