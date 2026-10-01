// OATHBREAKER — Class 2 of the Aegis Guardian. Counter Tank · Aggro DPS · Bruiser Tank.
// "The more you hurt me, the more it will hurt you."
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('broken_oath' + tier UNBOUND) · Guard System (hold Q = DEFIANT GUARD: weaker guard, blocked damage
//   converts to Broken Oath) · MarkSystem ('oath_brand' on enemies = taunt + counter bonus + Ruin Chain requirement)
//   · StatusSystem (oath_of_ruin, forbidden_oath, ruin, taunted, root) · CounterSystem (counterBonus)
// Gameplay loop: GET HIT / GUARD → BROKEN OATH → a block or perfect guard opens RETALIATION (1.5 s) → SINFUL COUNTER
//   spends the oath for a capped burst (bigger inside Retaliation, under 40% HP, on a branded foe) → take more risk
//   (Oath of Ruin: less DEF, more damage) → OATHBREAKER VERDICT stores the pain and returns it as one blast.
// Risk by design: lowest DEF of the Aegis line, a weaker guard, Oath of Ruin lowers DEF further.
// Every multiplier is capped: counter power never goes above counter.hardCap, the verdict blast above verdict.maxPower.

const VIOLET = '#b060ff', PALE = '#ecd0ff', CRIMSON = '#ff5070', VIO = '170,80,255', CRI = '220,60,90';
const R = 'broken_oath';

// animation table for the 'ok' preset (tools/build-player.js ok → assets/player/ok)
export const OK_ANIMS = {
  idle: { sheet: 'idle', cols: [0] },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 9, loop: true, bob: 1 },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 13, loop: true, bob: 2 },
  atk1: { sheet: 'atk1', cols: [2, 3] },                                     // overhead cut
  atk2: { sheet: 'atk1', cols: [4, 4] },                                     // lunging thrust
  atk3: { sheet: 'atk1', cols: [2, 3, 3, 4] },                                // heavy cut + the violet crescent VFX
  dodge: { sheet: 'dash', cols: [2, 3, 4] },
  guard: { sheet: 'guard', cols: [3] },                                      // blade raised across the body
  counter: { sheet: 'parry', cols: [2, 3, 3] },                              // perfect-guard riposte
  brand: { sheet: 'sk1', cols: [1, 2, 3, 3] },
  oathOfRuin: { sheet: 'sk3', cols: [1, 2, 3, 3] },
  ruinChain: { sheet: 'sk4', cols: [1, 2, 3, 3] },
  sinful: { sheet: 'sk6', cols: [1, 2, 3, 3] },
  verdict: { sheet: 'ult', cols: [1, 2, 3, 3, 3] },
  verdictEnd: { sheet: 'sk5', cols: [2, 3, 3] },
  hurt: { sheet: 'hit', cols: [2, 3] },
  death: { sheet: 'hit', cols: [2, 3, 3] },
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function feeder(p, per, cap) {
  let got = 0;
  return () => { const n = Math.min(per, cap - got); if (n > 0) { got += n; p.gainResource(n); } };
}

export const Oathbreaker = {
  id: 'oathbreaker',
  stableId: 'class_oathbreaker',
  name: 'Oathbreaker',
  parentClass: 'aegis_guardian',
  role: 'Counter Tank · Aggro DPS · Bruiser Tank',
  difficulty: 5,
  ratings: { damage: 4, range: 2, defense: 3, mobility: 2, support: 1 },
  description: 'The Aegis who broke the oath of pure defence: takes the blows, guards at the last moment, and returns the pain as ruin.',
  identity: 'The more you hurt me, the more it will hurt you.',
  loop: ['Get Hit', 'Guard', 'Broken Oath', 'Counter', 'Take Risk', 'Burst'],
  strengths: ['Huge capped counter bursts (Sinful Counter, Verdict)', 'Holds aggro: brands, taunts, chains foes to itself', 'Turns defence into offence: blocked damage becomes power'],
  weaknesses: ['High risk: lowest DEF of the Aegis line, weaker guard', 'Timing matters: counters are strongest right after a block', 'A missed counter wastes the stored oath', 'Oath of Ruin trades defence for attack'],
  signatureWeapon: 'Ruin Blade & Broken Aegis',
  preset: 'ok',
  anims: OK_ANIMS,
  theme: { color: VIOLET, ghost: '#9a40ff', trail: 'shadow' },
  resource: R,
  resources: [R],
  mark: null,
  enemyMark: 'oath_brand',
  base: { hp: 335, atk: 23, def: 10, crit: 0.06, critDmg: 0, physicalDmg: 0, cdr: 0, speed: 140, oathGain: 1, armorBreak: 1.1 },
  perLevel: { hp: 15, atk: 1.4, def: 0.6 },
  defaultLoadout: ['oath_brand', 'sinful_counter', 'ruin_chain', 'oath_of_ruin'],
  // DEFIANT GUARD: weaker than the Aegis guard (65%), slower while held
  guard: { arc: 1.2, reduction: 0.65, perfectWindow: 0.2, moveMul: 0.3, recover: 0.3, fx: 'ok_brand', hold: { scale: 0.95 } },

  // ---- BROKEN OATH rules (data). Per-source caps: no event pays twice, no runaway gains.
  charge: {
    basicHit: 2, hurtPerHpShare: 120, hurtMax: 8, bossMult: 1.5, bossMax: 12,
    blockConvert: 0.5, blockMax: 8, perfectGuard: 15, painRepaid: 10, ruinCast: 10, chainHit: 5, brandHit: 4,
  },
  retaliation: { window: 1.5, mult: 1.4 },
  // SINFUL COUNTER: spends up to `maxSpend` oath; power = base + perPoint × spent, then multipliers, never above hardCap
  counter: { minSpend: 20, maxSpend: 60, base: 1.2, perPoint: 0.035, maxPower: 3.3, brandMult: 1.2, forsakenMult: 1.3, ruinMult: 1.2, forbiddenMult: 1.5, hardCap: 5.0 },
  forsaken: { below: 0.4 },
  chain: { range: 280, maxPull: 260, root: 1.0, power: 1.0 },
  ruinOath: { duration: 8, tauntRadius: 150 },
  verdict: { duration: 10, pulse: 1.5, radius: 150, store: 0.4, storeCap: 0.6, base: 2, perShare: 4, maxPower: 4.5, blastRadius: 130 },
  passives: [
    { id: 'pain_repaid', name: 'Pain Repaid', trigger: 'On Perfect Guard', desc: 'A Perfect Guard gives +10 more Broken Oath (25 in all).' },
    { id: 'forsaken', name: 'Forsaken', trigger: 'HP under 40%', desc: 'Below 40% HP your counters deal 30% more (still under the counter cap).' },
    { id: 'unbound', name: 'Unbound (Oath 70+)', trigger: 'resource threshold', desc: 'At 70+ Broken Oath: +10% physical damage, +5% crit.' },
  ],
  guideIntro: [
    'You feed on pain. Getting hit and HOLDING [Q] (Defiant Guard) builds BROKEN OATH. A block or Perfect Guard opens RETALIATION for 1.5 s.',
    'SINFUL COUNTER [2] spends the oath — strongest inside Retaliation, below 40% HP or on a branded foe. OATHBREAKER VERDICT [5] stores the pain and returns it.',
  ],
  tutorial: { marks: 'Brand a foe with Oath Brand', perfect: 'Perform a Perfect Guard', break: 'Land a Sinful Counter', breakSkill: 'sinful_counter' },
  perfectGuardText: 'DEFIANCE',

  // HUD: stored oath in fifths + the Retaliation window
  hudCounter(p) {
    const open = p.game.time < (p.retaliateUntil || 0);
    return { label: open ? 'RETALIATE!' : 'BROKEN OATH', value: Math.min(5, Math.floor(p.resources.get(R) / 20)), max: 5, color: VIOLET, full: PALE,
      ready: open || p.resources.get(R) >= 60, readyText: open ? 'RETALIATION — SINFUL COUNTER NOW' : 'OATHBREAKER VERDICT READY — [5]' };
  },

  brand(p, g, t) {
    if (!t || t.dead || t.isBreakable) return false;
    g.marks.apply(t, 'oath_brand', { source: p, sourceClass: 'oathbreaker' });
    if (t.status) t.status.add('taunted', 6, { source: p, refresh: true });
    return true;
  },
  markTarget(p, g, t) { return p.cls.brand(p, g, t); }, // the shared class-mark hook (tests, codex)
  openRetaliation(p, g) {
    p.retaliateUntil = g.time + p.cls.retaliation.window;
    g.vfx.text(p.x, p.y - 86, 'RETALIATE', { color: PALE, size: 10 });
  },

  // SINFUL COUNTER power (pure given the state): spent oath + every multiplier, capped
  //   inWindow: was RETALIATION open when the counter started (defaults to "is it open now")
  counterPower(p, spent, target = null, inWindow = null) {
    const c = p.cls.counter, g = p.game;
    let pw = Math.min(c.maxPower, c.base + c.perPoint * Math.max(0, spent));
    if (inWindow ?? (g && g.time < (p.retaliateUntil || 0))) pw *= p.cls.retaliation.mult;
    if (p.maxHp && p.hp / p.maxHp < p.cls.forsaken.below) pw *= c.forsakenMult;
    if (p.status.has('oath_of_ruin')) pw *= c.ruinMult;
    if (p.status.has('forbidden_oath')) pw *= c.forbiddenMult;
    if (target && g && g.marks && g.marks.get(target, 'oath_brand')) pw *= c.brandMult;
    return Math.min(c.hardCap, pw);
  },

  // ---------------- every frame: Forbidden Oath pulses + the Verdict blast when it ends
  tick(p, g, dt) {
    const cls = p.cls, v = cls.verdict;
    if (p.status.has('forbidden_oath')) {
      p.verdictOn = true;
      if ((p.verdictPulse = (p.verdictPulse || 0) - dt) <= 0) {
        p.verdictPulse += v.pulse;
        for (const m of g.world.hostiles()) {
          if (m.dead || m.isBreakable || dist(m, p) > v.radius) continue;
          if (m.status) { m.status.add('taunted', v.pulse + 0.3, { source: p, refresh: true }); m.status.add('ruin', v.pulse + 0.3, { source: p, refresh: true }); }
        }
        g.vfx.ring(p.x, p.y, 16, v.radius, { life: 0.4, color: VIO, width: 2 });
      }
    } else if (p.verdictOn) { // the oath is fulfilled: the stored pain comes back as one blast
      p.verdictOn = false;
      const share = Math.min(v.storeCap, (p.verdictStore || 0) / Math.max(1, p.maxHp));
      const pw = Math.min(v.maxPower, v.base + v.perShare * share);
      p.verdictStore = 0;
      if (!p.dead) {
        p.startAction({
          name: 'verdict_end', dur: 0.45, anim: 'verdictEnd', moveMul: 0, ang: p.aim, cancelAt: 99, superArmor: true,
          events: [[0.15, () => {
            g.audio.sfx('boom_small'); g.camera.shake(0.4); g.vfx.flash('120,40,160', 0.25, 3);
            g.vfx.sprite('ok_verdict', p.x, p.y - 30, 0, { scale: 1.6, life: 0.5, glow: 0.6 });
            g.vfx.text(p.x, p.y - 90, `VERDICT ×${pw.toFixed(1)}`, { color: PALE, size: 13, life: 1.1 });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: v.blastRadius, power: pw, type: 'shadow', knock: 260, stagger: 70, hitStop: 0.12, shake: 0.4, big: true, skillId: 'verdict_blast' });
            g.events.emit('verdictBlast', { player: p, power: pw });
          }]],
        });
      }
    }
  },

  // ---------------- basic: cut, thrust, violet crescent
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.34, at: 0.12, anim: 'atk1', r: 58, half: 1.0, power: 1.3, lunge: 12 },
      { dur: 0.36, at: 0.13, anim: 'atk2', r: 70, half: 0.6, power: 1.4, lunge: 18 },
      { dur: 0.48, at: 0.2, anim: 'atk3', r: 74, half: 1.6, power: 2.0, lunge: 10, knock: 200 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.4, ang: a, cancelAt: 0.06, comboAt: d.at + 0.08,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'slash_heavy' : 'swing');
        // basic-attack art (owner's VFX ATK sheet): thrust -> crescent -> fade, bigger on the finisher
        g.vfx.sprite('ok_atk', p.x + Math.cos(a) * 26, p.y - 12 + Math.sin(a) * 26, a, { scale: step === 2 ? 0.85 : 0.6, life: step === 2 ? 0.28 : 0.22, glow: 0.45 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r, half: d.half, power: d.power, type: 'physical',
          knock: d.knock ?? 110, stagger: 12 + step * 9, hitStop: step === 2 ? 0.08 : 0.05, shake: step === 2 ? 0.2 : 0.1,
          onHit: feeder(p, cls.charge.basicHit, cls.charge.basicHit),
        });
      }]],
    };
  },

  skills: [
    {
      id: 'oath_brand', tier: 'fast', name: 'Oath Brand', type: 'active', cooldown: 7, cost: 0, targeting: 'direction',
      tags: ['mark', 'taunt', 'aggro', 'requirement'], icon: 'oath_brand',
      desc: 'Brand the first foe in front (range 200) for 10 s: it is TAUNTED, takes ×1.2 from your counters, and can be pulled by Ruin Chain. +4 Broken Oath.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'oath_brand', dur: 0.4, anim: 'brand', moveMul: 0.3, ang: a, cancelAt: 0.25,
          events: [[0.18, () => {
            g.audio.sfx('mark');
            g.vfx.beam(p.x, p.y - 20, a, 200, 3, { life: 0.2, color: VIO });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 200, half: 0.3, power: 0.6, type: 'shadow', knock: 0, stagger: 8, hitStop: 0.03, maxTargets: 1,
              onHit: (t) => { if (cls.brand(p, g, t)) { p.gainResource(cls.charge.brandHit); g.vfx.sprite('ok_brand', t.x, t.y - 26, 0, { scale: 0.7, life: 0.45, glow: 0.6 }); } } });
          }]],
        };
      },
    },
    {
      id: 'sinful_counter', tier: 'medium', name: 'Sinful Counter', type: 'active', cooldown: 5, cost: 0, targeting: 'direction',
      tags: ['counter', 'melee', 'consumes-resource', 'damage-conversion', 'burst'], icon: 'sinful_counter',
      requirements: [{ type: 'resource', resource: R, min: 20, label: '20 Broken Oath' }],
      desc: 'Spend your Broken Oath (at least 20, up to 60) on one sinful swing: 1.2× + 0.035× per point spent (max 3.3×). ×1.4 inside RETALIATION (1.5 s after a block / Perfect Guard), ×1.3 under 40% HP (Forsaken), ×1.2 on a branded foe. Never above 5×.',
      cast(p, g, a) {
        const cls = p.cls, c = cls.counter;
        const spent = Math.min(c.maxSpend, p.resources.get(R));
        p.resources.spend(R, spent, 'sinful_counter');
        const inWindow = g.time < (p.retaliateUntil || 0);
        return {
          name: 'sinful_counter', dur: 0.5, anim: 'sinful', moveMul: 0.1, ang: a, cancelAt: 0.4, superArmor: true,
          lunge: { dist: 22, t0: 0.05, t1: 0.2 },
          events: [[0.22, () => {
            const pw0 = cls.counterPower(p, spent, null, inWindow);
            g.audio.sfx(pw0 > 3 ? 'slam_big' : 'counter');
            g.camera.shake(0.15 + pw0 * 0.05);
            g.vfx.sprite('ok_crescent', p.x + Math.cos(a) * 30, p.y - 14 + Math.sin(a) * 30, a, { scale: 0.7 + pw0 * 0.1, life: 0.3, glow: 0.6 });
            if (inWindow) g.vfx.sprite('ok_flare', p.x + Math.cos(a) * 44, p.y - 14 + Math.sin(a) * 44, a, { scale: 0.8, life: 0.3, glow: 0.6 });
            g.vfx.text(p.x, p.y - 84, `${inWindow ? 'RETALIATION ' : ''}×${pw0.toFixed(1)}`, { color: inWindow ? PALE : '#c8a0e8', size: 11 });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 78, half: 1.1, power: pw0, type: 'physical', knock: 240, stagger: 30 + pw0 * 12, hitStop: 0.1, shake: 0.25, big: pw0 > 3,
              powerFor: (t) => cls.counterPower(p, spent, t, inWindow), skillId: 'sinful_counter' });
            p.retaliateUntil = 0; // the window is used up
          }]],
        };
      },
    },
    {
      id: 'ruin_chain', tier: 'medium', name: 'Ruin Chain', type: 'active', cooldown: 9, cost: 0, targeting: 'self',
      tags: ['pull', 'control', 'mark', 'position'], icon: 'ruin_chain',
      requirements: [{ type: 'markedFoe', mark: 'oath_brand', range: 280, label: 'a branded foe within 280' }],
      desc: 'Throw a chain at the nearest BRANDED foe (range 280): it is dragged to you, rooted for 1 s and marked (taunt). Bosses cannot be moved — they are ruined instead (-20% DEF and damage for 4 s). +5 Broken Oath.',
      cast(p, g, a) {
        const cls = p.cls, ch = cls.chain;
        const t = p.markedFoes('oath_brand', ch.range).sort((x, y) => dist(x, p) - dist(y, p))[0];
        const ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : a;
        return {
          name: 'ruin_chain', dur: 0.55, anim: 'ruinChain', moveMul: 0, ang, cancelAt: 0.4,
          events: [[0.2, () => {
            if (!t || t.dead) return;
            g.audio.sfx('thread');
            g.vfx.beam(p.x, p.y - 20, ang, dist(p, t), 4, { life: 0.35, color: VIO });
            g.vfx.sprite('ok_spikes', t.x, t.y - 20, 0, { scale: 0.6, life: 0.4, glow: 0.5 });
            g.combat.dealDamage(p, t, { power: ch.power, type: 'shadow', knock: 0, stagger: 25, hitStop: 0.05, skillId: 'ruin_chain' });
            if (t.isBoss) { if (t.status) t.status.add('ruin', 4, { source: p }); }
            else {
              // PULL: slide the foe to you over 0.15 s (walls stop it), then root it
              const d = Math.min(ch.maxPull, Math.max(0, dist(p, t) - 36)), ang2 = Math.atan2(p.y - t.y, p.x - t.x), n = 5;
              for (let i = 1; i <= n; i++) g.after(i * 0.03, () => { if (!t.dead && g.world.map.moveCircle) g.world.map.moveCircle(t, Math.cos(ang2) * d / n, Math.sin(ang2) * d / n); });
              if (t.status) t.status.add('root', ch.root, { source: p });
            }
            cls.brand(p, g, t);
            p.gainResource(cls.charge.chainHit);
            g.events.emit('ruinChained', { player: p, target: t });
          }]],
        };
      },
    },
    {
      id: 'oath_of_ruin', tier: 'medium', name: 'Oath of Ruin', type: 'active', cooldown: 20, cost: 0, targeting: 'self',
      tags: ['buff', 'risk', 'aggro', 'taunt'], icon: 'oath_of_ruin',
      desc: 'Break your last vow for 8 s: +25% damage and counters ×1.2 — but -40% DEF and +15% damage taken. Foes within 150 are taunted. +10 Broken Oath.',
      cast(p, g, a) {
        const cls = p.cls, o = cls.ruinOath;
        return {
          name: 'oath_of_ruin', dur: 0.5, anim: 'oathOfRuin', moveMul: 0, ang: a, cancelAt: 0.3,
          events: [[0.22, () => {
            g.audio.sfx('taunt'); g.camera.shake(0.25);
            g.vfx.sprite('ok_sigil', p.x, p.y - 26, 0, { scale: 1.0, life: 0.5, glow: 0.6 });
            g.vfx.ring(p.x, p.y, 16, o.tauntRadius, { life: 0.4, color: CRI, width: 3 });
            p.status.add('oath_of_ruin', o.duration, { source: p, refresh: true });
            for (const m of g.world.hostiles()) if (!m.dead && !m.isBreakable && dist(m, p) <= o.tauntRadius && m.status) m.status.add('taunted', 4, { source: p, refresh: true });
            p.gainResource(cls.charge.ruinCast);
          }]],
        };
      },
    },
    {
      slot: 5, id: 'oathbreaker_verdict', tier: 'high', name: 'Oathbreaker Verdict', type: 'ultimate', cooldown: 45, cost: 60, targeting: 'self',
      tags: ['ultimate', 'damage-conversion', 'counter', 'taunt', 'debuff', 'unshakable'], icon: 'verdict', ultimate: true,
      desc: 'ULTIMATE (60 Broken Oath). Swear the FORBIDDEN OATH for 10 s: counters ×1.5 (cap 5×), +15% damage, no knockback, every second foes within 150 are taunted and RUINED (-20% DEF / damage). 40% of the damage you take is stored; when the oath ends it returns as a VERDICT blast (2× + up to 2.4×, max 4.5×).',
      cast(p, g, a) {
        const cls = p.cls, v = cls.verdict;
        return {
          name: 'oathbreaker_verdict', dur: 1.0, anim: 'verdict', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.0], superArmor: true,
          start: () => { g.slowMo(0.5, 0.4); g.audio.sfx('ult_charge'); g.vfx.flash('40,10,60', 0.35, 2); },
          events: [
            [0.2, () => g.vfx.sprite('ok_spikes', p.x, p.y - 30, 0, { scale: 1.3, life: 0.7, glow: 0.6 })],
            [0.6, () => {
              g.audio.sfx('slam_big'); g.camera.punch(0.2); g.camera.shake(0.6);
              g.vfx.flash('150,70,220', 0.35, 2.5);
              g.vfx.sprite('ok_verdict', p.x, p.y - 30, 0, { scale: 1.5, life: 0.8, glow: 0.5 });
              g.vfx.text(p.x, p.y - 92, 'FORBIDDEN OATH', { color: PALE, size: 14, life: 1.2 });
              p.status.add('forbidden_oath', v.duration, { source: p, refresh: true });
              p.verdictStore = 0; p.verdictPulse = 0; p.verdictOn = true;
              g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 110, power: 2.0, type: 'shadow', knock: 220, stagger: 50, hitStop: 0.1, shake: 0.35, big: true });
            }],
          ],
        };
      },
    },
  ],

  // ---------------- DEFIANT GUARD (hold Q / right click): the Aegis guard, weaker, converts the blocked blow
  special: {
    id: 'defiant_guard', tier: 'fast', stamina: 0, name: 'Defiant Guard', type: 'special', slot: 'Q', key: 'Q', icon: 'guard',
    cost: 0, cooldown: 0.1, targeting: 'self', tags: ['guard', 'block', 'damage-conversion', 'hold'], hold: true,
    desc: 'HOLD to guard (65% less from the front, slow): half of the blocked damage becomes Broken Oath and a block opens RETALIATION (1.5 s). A PERFECT GUARD: no damage, +25 Broken Oath (Pain Repaid) and a riposte.',
    cast(p) { p.setGuard(true); return null; },
  },

  onPerfectGuard(p, g, src) {
    const cls = p.cls, a = src ? Math.atan2(src.y - p.y, src.x - p.x) : p.aim;
    p.gainResource(cls.charge.perfectGuard + cls.charge.painRepaid, true); // PAIN REPAID (passive)
    cls.openRetaliation(p, g);
    p.startAction({
      name: 'oath_riposte', dur: 0.4, anim: 'counter', moveMul: 0, ang: a, cancelAt: 0.25, superArmor: true, invuln: [0, 0.2],
      events: [[0.12, () => {
        g.audio.sfx('counter');
        g.vfx.sprite('ok_flare', p.x + Math.cos(a) * 30, p.y - 14 + Math.sin(a) * 30, a, { scale: 0.7, life: 0.3, glow: 0.6 });
        g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 70, half: 1.0, power: Math.min(cls.counter.hardCap, 2.0 * (p.maxHp && p.hp / p.maxHp < cls.forsaken.below ? cls.counter.forsakenMult : 1)), type: 'physical', forceCrit: true, counter: true, knock: 220, stagger: 50, hitStop: 0.1, shake: 0.28,
          onHit: (t) => cls.brand(p, g, t) });
      }]],
    });
  },
  onGuardBlock(p, g) { p.cls.openRetaliation(p, g); },
  counterBonus: { resource: 5 },
  perfectDodge: { resource: 6, stamina: 10, cooldownCut: 0.5 },

  on: {
    // pain -> Broken Oath (more from bosses, capped per hit); during Forbidden Oath part of it is stored for the Verdict
    damageTaken(p, g, e) {
      if (e.target !== p || !(e.amount > 0) || !e.source || e.opts && e.opts.dot) return;
      const c = p.cls.charge, boss = !!e.source.isBoss;
      p.gainResource(Math.min(boss ? c.bossMax : c.hurtMax, (e.amount / Math.max(1, p.maxHp)) * c.hurtPerHpShare * (boss ? c.bossMult : 1)));
      if (p.status.has('forbidden_oath')) {
        const v = p.cls.verdict;
        p.verdictStore = Math.min(p.maxHp * v.storeCap, (p.verdictStore || 0) + e.amount * v.store);
      }
    },
    // DAMAGE CONVERSION: part of what Defiant Guard blocked becomes Broken Oath
    damageBlocked(p, g, e) {
      if (e.target !== p || e.perfect) return;
      const c = p.cls.charge, red = p.cls.guard.reduction, blocked = (e.amount * red) / Math.max(0.05, 1 - red);
      p.gainResource(Math.max(1, Math.min(c.blockMax, (blocked / Math.max(1, p.maxHp)) * 100 * c.blockConvert)));
    },
    targetMarked(p, g, e) { if (e.source === p && e.markId === 'oath_brand') g.world.setFlag('tut_marks'); },
  },
};
