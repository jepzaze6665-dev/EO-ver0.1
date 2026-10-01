// BULWARK SENTINEL — Class 2 of the Aegis Guardian. Main Tank · Damage Mitigation · Frontline.
// "This wall never retreats."
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('bastion') · Guard System (hold Q, stronger guard) · StatusSystem (iron_bastion, fortified, shieldwall,
//   citadel, citadel_ward, iron_will, taunted) · MarkSystem (guardian_mark) · poise / knockback stats (UNBROKEN)
// Gameplay loop: TAUNT (Absolute Provocation) → BLOCK / take the hits → BASTION fills → FORTIFIED at 70 (harder guard,
//   no knockback, +DEF) → HOLD POSITION (Iron Bastion, Shieldwall for the ones behind you) → COUNTERWEIGHT returns the
//   weight of every blow you took (capped) → CITADEL OF ONE when the fight must be held at any cost.
// Mobility is the price: slow feet, Iron Bastion and the Citadel slow you further, the Citadel doubles dodge cost.
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const GOLD = '#f0c850', PALE = '#fff0c0', STEEL = '#9ac8ff', HOLY = '255,214,120', BLUE = '140,190,255';
const R = 'bastion';

// animation table for the 'bs' preset (tools/build-player.js bs → assets/player/bs)
export const BS_ANIMS = {
  idle: { sheet: 'idle', cols: [0] },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 7, loop: true, bob: 1 },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 10, loop: true, bob: 2 },
  atk1: { sheet: 'atk1', cols: [2, 3] },           // overhead chop
  atk2: { sheet: 'atk1', cols: [4, 4] },           // thrust
  atk3: { sheet: 'atk2', cols: [1, 2, 3, 3] },     // heavy golden sweep
  dodge: { sheet: 'dash', cols: [1, 4] },          // (cols 2-3 of the dash sheet are cut too thin)
  guard: { sheet: 'sk4', cols: [2] },              // tower shield square to the front
  ironBastion: { sheet: 'sk1', cols: [2, 3, 3] },
  fortressStep: { sheet: 'sk2', cols: [2, 3, 3, 4] },
  provocation: { sheet: 'sk3', cols: [2, 3, 3, 4] },
  shieldwall: { sheet: 'sk4', cols: [1, 2, 3, 3] },
  counterweight: { sheet: 'sk5', cols: [2, 3, 4, 4] },
  counter: { sheet: 'sk6', cols: [3, 4, 4] },      // perfect-guard riposte
  citadel: { sheet: 'ult', cols: [1, 2, 3, 3, 4] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [2, 3, 4] },
};

// ---- helpers (class-local)
const party = (g, p) => (g.players ? g.players() : [p]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function feeder(p, per, cap) {
  let got = 0;
  return () => { const n = Math.min(per, cap - got); if (n > 0) { got += n; p.gainResource(n); } };
}

export const BulwarkSentinel = {
  id: 'bulwark_sentinel',
  stableId: 'class_bulwark_sentinel',
  name: 'Bulwark Sentinel',
  parentClass: 'aegis_guardian',
  role: 'Main Tank · Damage Mitigation · Frontline Tank',
  difficulty: 3,
  ratings: { damage: 2, range: 1, defense: 5, mobility: 1, support: 3 },
  description: 'The Aegis who became the wall: taunts everything, blocks everything, and pays back the weight of every blow.',
  identity: 'This wall never retreats.',
  loop: ['Taunt', 'Block', 'Bastion', 'Hold Position', 'Fortified', 'Counter'],
  strengths: ['Highest defence: strong guard, damage reduction, FORTIFIED', 'Taunts whole packs and holds their aggro', 'Hard to move: little knockback, stagger or displacement', 'Shieldwall protects the ones behind'],
  weaknesses: ['Lowest mobility: slow, and the stance / ultimate slow it more', 'Positioning matters: the wall only covers one side', 'Must keep Bastion up by blocking', 'Poor at chasing a fleeing target'],
  signatureWeapon: 'bastion_aegis',
  preset: 'bs',
  anims: BS_ANIMS,
  theme: { color: GOLD, ghost: '#ffe7a0', trail: 'shadow' },
  resource: R,
  resources: [R],
  mark: null,
  enemyMark: 'guardian_mark',
  // UNBROKEN (passive) = tenacity / knockResist / poiseResist in the base stats
  base: { hp: 360, atk: 18, def: 16, crit: 0.03, critDmg: 0, holyDmg: 0, cdr: 0, speed: 126, bastionGain: 1, armorBreak: 1.1, tenacity: 0.3, knockResist: 0.5, poiseResist: 0.4 },
  perLevel: { hp: 18, atk: 1.1, def: 1.0 },
  kit: { weapon: 'bastion_aegis', armor: 'fortress_plate' }, // signature weapon + armour = part of the class (data/classKits.js), not items
  defaultLoadout: ['fortress_step', 'absolute_provocation', 'counterweight', 'shieldwall'],
  guard: { arc: 1.35, reduction: 0.8, perfectWindow: 0.2, moveMul: 0.35, recover: 0.3, fx: 'bs_aegis' },

  // ---- BASTION rules (data). Per-source caps: no single event pays twice, no runaway gains.
  charge: {
    basicHit: 2, block: 8, perfectGuard: 15,
    hurtPerHpShare: 100, hurtMin: 1, hurtMax: 6, stanceHurtMult: 2, // taking damage (x2 inside Iron Bastion)
    tauntPer: 4, tauntCap: 16, stepPer: 4, stepCap: 12,
  },
  fortified: { at: 70, duration: 8, drain: 5, endBelow: 10, lockout: 6 },
  // COUNTERWEIGHT: the damage you took (after mitigation) is stored and paid back by the next counter
  weight: { capShare: 0.6, forget: 6, basePower: 1.6, perShare: 3, maxPower: 3.4, citadelMult: 1.5, hardCap: 4.5 },
  ironBastion: { duration: 8 },
  wall: { duration: 6, dist: 30, half: 70, depth: 120 },
  step: { dist: 70, power: 1.4, poise: 60, stun: 0.5 },
  provocation: { radius: 170, taunt: 8 },
  citadel: { duration: 10, pulse: 1, tauntRadius: 220, wardRadius: 130 },
  ironWill: { below: 0.4 },
  passives: [
    { id: 'iron_will', name: 'Iron Will', trigger: 'HP under 40%', desc: 'Below 40% HP your defence rises by 50%.' },
    { id: 'unbroken', name: 'Unbroken', trigger: 'always', desc: 'Knockback halved, poise wears down 40% slower, control effects 30% shorter.' },
    { id: 'fortified', name: 'Fortified (Bastion 70+)', trigger: 'resource threshold', desc: 'At 70 Bastion you become FORTIFIED for 8 s: +40% DEF, blocks let half as much through, no knockback. It drains Bastion; ends early under 10.' },
  ],
  guideIntro: [
    'You are the wall. Taunt with Absolute Provocation [2], HOLD [Q] to guard: every block and every hit you take builds BASTION. At 70 you become FORTIFIED.',
    'COUNTERWEIGHT [3] pays back the weight of the blows you took. Shieldwall [4] protects whoever stands behind it. CITADEL OF ONE [5]: nothing moves you.',
  ],
  tutorial: { marks: 'Taunt foes with Absolute Provocation', perfect: 'Perform a Perfect Guard', break: 'Raise a Shieldwall', breakSkill: 'shieldwall' },

  // HUD counter: the stored COUNTERWEIGHT (5 pips = full)
  hudCounter(p) {
    const w = p.cls.weight, cap = p.maxHp * w.capShare, n = Math.min(5, Math.round((5 * (p.weight || 0)) / Math.max(1, cap)));
    return { label: 'COUNTERWEIGHT', value: n, max: 5, color: GOLD, full: PALE, ready: p.resources.get(R) >= 50, readyText: 'CITADEL OF ONE READY — [5]' };
  },

  markTarget(p, g, t, dur = 6) {
    if (!t || t.dead || t.isBreakable) return false;
    g.marks.apply(t, 'guardian_mark', { source: p, sourceClass: 'bulwark_sentinel' });
    if (t.status) t.status.add('taunted', dur, { source: p, refresh: true });
    return true;
  },

  // the counter's power from the stored weight (capped); `spend` = share of the weight used up
  counterPower(p, spend = 1) {
    const w = p.cls.weight, share = Math.min(w.capShare, (p.weight || 0) / Math.max(1, p.maxHp));
    let pw = Math.min(w.maxPower, w.basePower + w.perShare * share);
    if (p.status.has('citadel')) pw = Math.min(w.hardCap, pw * w.citadelMult);
    p.weight = (p.weight || 0) * (1 - spend);
    return pw;
  },

  // SHIELDWALL: is `m` behind the wall (the side away from the enemy), inside its width and depth?
  behindWall(w, m) {
    const dx = m.x - w.x, dy = m.y - w.y, fx = Math.cos(w.ang), fy = Math.sin(w.ang);
    const along = dx * fx + dy * fy, lateral = Math.abs(-dx * fy + dy * fx);
    return along <= 0 && along >= -w.depth && lateral <= w.half;
  },

  // ---------------- every frame: fortified state, walls, citadel pulses, Iron Will, weight forgetting
  tick(p, g, dt) {
    const cls = p.cls, f = cls.fortified, res = p.resources.get(R);
    // FORTIFIED (threshold state)
    if (p.status.has('fortified')) {
      p.resources.drain(R, f.drain * dt, 'fortified');
      if (p.resources.get(R) <= f.endBelow) p.status.remove('fortified');
    } else if (res >= f.at && g.time >= (p.fortifiedReady || 0)) {
      p.status.add('fortified', f.duration, { source: p, refresh: true });
      p.fortifiedReady = g.time + f.duration + f.lockout;
      g.vfx.sprite('bs_aegis', p.x, p.y - 30, 0, { scale: 0.7, life: 0.5, glow: 0.6 });
      g.vfx.text(p.x, p.y - 84, 'FORTIFIED', { color: PALE, size: 12 });
      g.audio.sfx('block');
      g.events.emit('fortified', { player: p });
    }
    // walls
    if (p.walls && p.walls.length) {
      for (const w of p.walls) {
        w.t -= dt;
        if (w.t <= 0) continue;
        for (const m of party(g, p)) if (cls.behindWall(w, m)) m.status.add('shieldwall', 0.3, { source: p, refresh: true });
      }
      p.walls = p.walls.filter((w) => w.t > 0);
    }
    // CITADEL OF ONE: taunt pulse + ward for allies nearby
    if (p.status.has('citadel')) {
      const c = cls.citadel;
      if ((p.citadelPulse = (p.citadelPulse || 0) - dt) <= 0) {
        p.citadelPulse += c.pulse;
        for (const m of g.world.hostiles()) if (!m.dead && dist(m, p) <= c.tauntRadius) cls.markTarget(p, g, m, 2);
        g.vfx.ring(p.x, p.y, 20, c.tauntRadius, { life: 0.4, color: HOLY, width: 2 });
      }
      for (const m of party(g, p)) if (m !== p && dist(m, p) <= c.wardRadius) m.status.add('citadel_ward', 0.3, { source: p, refresh: true });
    }
    // IRON WILL (passive)
    if (p.maxHp && p.hp / p.maxHp < cls.ironWill.below && !p.dead) p.status.add('iron_will', 0.3, { source: p, refresh: true });
    // COUNTERWEIGHT is forgotten after a while without being hit
    if (p.weight > 0 && g.time - (p.lastWeightT || 0) > cls.weight.forget) p.weight = 0;
  },

  // ---------------- basic: chop, thrust, heavy golden sweep
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.4, at: 0.14, anim: 'atk1', r: 58, half: 1.0, power: 1.45, lunge: 8 },
      { dur: 0.4, at: 0.15, anim: 'atk2', r: 66, half: 0.6, power: 1.5, lunge: 14 },
      { dur: 0.55, at: 0.22, anim: 'atk3', r: 72, half: 2.4, power: 2.2, lunge: 6, knock: 220 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.35, ang: a, cancelAt: 0.06, comboAt: d.at + 0.08,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'slash_heavy' : 'swing');
        // basic-attack art (owner's VFX ATK sheet): thrust -> crescent -> fade, bigger on the finisher
        g.vfx.sprite('bs_atk', p.x + Math.cos(a) * 26, p.y - 12 + Math.sin(a) * 26, a, { scale: step === 2 ? 0.85 : 0.6, life: step === 2 ? 0.28 : 0.22, glow: 0.45 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r, half: d.half, power: d.power, type: 'physical',
          knock: d.knock ?? 120, stagger: 14 + step * 10, hitStop: step === 2 ? 0.09 : 0.05, shake: step === 2 ? 0.22 : 0.1,
          onHit: feeder(p, cls.charge.basicHit, cls.charge.basicHit),
        });
      }]],
    };
  },

  skills: [
    {
      id: 'iron_bastion', tier: 'fast', name: 'Iron Bastion', type: 'active', cooldown: 14, cost: 0, targeting: 'self',
      tags: ['stance', 'defense', 'resource'], icon: 'iron_bastion',
      desc: 'Plant your feet for 8 s: 40% less damage taken, 45% slower, and every hit you take builds twice the Bastion. Press again to leave the stance early.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'iron_bastion', dur: 0.35, anim: 'ironBastion', moveMul: 0, ang: a, cancelAt: 0.2,
          events: [[0.12, () => {
            g.audio.sfx('block');
            g.vfx.sprite('bs_aegis', p.x, p.y - 28, 0, { scale: 0.8, life: 0.45, glow: 0.5 });
            p.status.add('iron_bastion', cls.ironBastion.duration, { source: p, refresh: true });
          }]],
        };
      },
      recast: { window: 8, cast(p) { p.status.remove('iron_bastion'); p.game.vfx.text(p.x, p.y - 80, 'STANCE OFF', { color: PALE, size: 9 }); return null; } },
    },
    {
      id: 'fortress_step', tier: 'medium', name: 'Fortress Step', type: 'active', cooldown: 7, cost: 0, targeting: 'direction',
      tags: ['movement', 'melee', 'stagger', 'knockback', 'mark'], icon: 'fortress_step',
      desc: 'Step forward behind the shield: foes hit are staggered (big poise damage), knocked back, briefly stunned and marked (taunt). +4 Bastion each, up to 12.',
      cast(p, g, a) {
        const cls = p.cls, s = cls.step, feed = feeder(p, cls.charge.stepPer, cls.charge.stepCap);
        return {
          name: 'fortress_step', dur: 0.5, anim: 'fortressStep', moveMul: 0, ang: a, cancelAt: 0.35, superArmor: true,
          lunge: { dist: s.dist, t0: 0.05, t1: 0.25 },
          events: [[0.2, () => {
            g.audio.sfx('crash');
            g.camera.shake(0.2);
            g.vfx.sprite('bs_charge', p.x + Math.cos(a) * 26, p.y - 16 + Math.sin(a) * 26, a, { scale: 0.7, life: 0.3, glow: 0.5 });
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 54, half: 0.9, power: s.power, type: 'physical', knock: 260, knockAng: a, stagger: s.poise, hitStop: 0.08, shake: 0.2,
              onHit: (t) => { if (t.status && !t.isBreakable && !t.isBoss) t.status.add('stun', s.stun, { source: p }); cls.markTarget(p, g, t); feed(); },
            });
          }]],
        };
      },
    },
    {
      id: 'absolute_provocation', tier: 'medium', name: 'Absolute Provocation', type: 'active', cooldown: 12, cost: 0, targeting: 'self',
      tags: ['taunt', 'aoe', 'mark', 'aggro', 'resource'], icon: 'provocation',
      desc: 'A thunderous challenge: every foe within 170 is TAUNTED for 8 s and marked. +4 Bastion per foe, up to 16.',
      cast(p, g, a) {
        const cls = p.cls, pr = cls.provocation;
        return {
          name: 'absolute_provocation', dur: 0.55, anim: 'provocation', moveMul: 0, ang: a, cancelAt: 0.35, superArmor: true,
          events: [[0.25, () => {
            const feed = feeder(p, cls.charge.tauntPer, cls.charge.tauntCap);
            g.audio.sfx('taunt');
            g.camera.shake(0.3);
            g.vfx.sprite('bs_pillar', p.x, p.y - 20, 0, { scale: 1.3, life: 0.5, glow: 0.5 });
            g.vfx.ring(p.x, p.y, 20, pr.radius, { life: 0.45, color: HOLY, width: 3 });
            let n = 0;
            for (const m of g.world.hostiles()) {
              if (m.dead || m.isBreakable || dist(m, p) > pr.radius) continue;
              if (cls.markTarget(p, g, m, pr.taunt)) { n++; feed(); g.vfx.text(m.x, m.y - (m.height || 30) - 12, '!', { color: GOLD, size: 13 }); }
            }
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 80, power: 0.5, type: 'physical', knock: 0, stagger: 20, hitStop: 0.03 });
            g.events.emit('tauntCast', { source: p, count: n });
          }]],
        };
      },
    },
    {
      id: 'counterweight', tier: 'medium', name: 'Counterweight', type: 'active', cooldown: 6, cost: 0, targeting: 'direction',
      tags: ['counter', 'melee', 'damage-conversion'], icon: 'counterweight',
      desc: 'Pay back the weight you carried: a shield-and-sword blow whose power grows with the damage you took recently (1.6× to 3.4×, capped; ×1.5 in the Citadel, never above 4.5×). Uses up the stored weight; it is also forgotten after 6 s without being hit.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'counterweight', dur: 0.55, anim: 'counterweight', moveMul: 0.1, ang: a, cancelAt: 0.4, superArmor: true,
          events: [[0.26, () => {
            const pw = cls.counterPower(p, 1);
            g.audio.sfx(pw > 2.5 ? 'slam_big' : 'slam');
            g.camera.shake(0.15 + pw * 0.06);
            g.vfx.sprite('bs_crest', p.x + Math.cos(a) * 30, p.y - 18 + Math.sin(a) * 30, 0, { scale: 0.6 + pw * 0.12, life: 0.35, glow: 0.6 });
            g.vfx.text(p.x, p.y - 80, `COUNTERWEIGHT ×${pw.toFixed(1)}`, { color: PALE, size: 10 });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 74, half: 1.1, power: pw, type: 'physical', knock: 240, stagger: 30 + pw * 12, hitStop: 0.1, shake: 0.25, big: pw > 2.5, counterMult: 1.3, skillId: 'counterweight' });
          }]],
        };
      },
    },
    {
      id: 'shieldwall', tier: 'medium', name: 'Shieldwall', type: 'active', cooldown: 16, cost: 20, targeting: 'direction',
      tags: ['wall', 'defense', 'support', 'position'], icon: 'shieldwall',
      desc: 'Raise a wall of shields in front of you for 6 s: everyone BEHIND it (up to 120 back, 140 wide — you too) takes 40% less damage. It only covers one side: keep the enemy in front.',
      cast(p, g, a) {
        const cls = p.cls, w = cls.wall;
        return {
          name: 'shieldwall', dur: 0.5, anim: 'shieldwall', moveMul: 0, ang: a, cancelAt: 0.3,
          events: [[0.22, () => {
            const wall = { x: p.x + Math.cos(a) * w.dist, y: p.y + Math.sin(a) * w.dist, ang: a, half: w.half, depth: w.depth, t: w.duration, total: w.duration };
            p.walls = [wall]; // one wall at a time
            g.audio.sfx('gate');
            g.camera.shake(0.15);
            g.vfx.sprite('bs_wall', wall.x, wall.y - 20, 0, { scale: 1.3, life: 0.45, glow: 0.5 });
            g.after(0.4, () => g.vfx.sprite('bs_wall', wall.x, wall.y - 20, 0, { scale: 1.3, life: w.duration - 0.3, frame: 3, glow: 0.3, alpha: 0.85 }));
            g.events.emit('wallCreated', { owner: p, ...wall });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'citadel_of_one', tier: 'high', name: 'Citadel of One', type: 'ultimate', cooldown: 50, cost: 50, targeting: 'self',
      tags: ['ultimate', 'fortress', 'taunt', 'defense', 'protection', 'counter'], icon: 'citadel', ultimate: true,
      desc: 'ULTIMATE (50 Bastion). Become a fortress for 10 s: cannot be knocked back, 50% less damage, blocks let half through, every foe within 220 is taunted each second, allies within 130 take 20% less, Counterweight ×1.5. The price: 65% slower and dodges cost double.',
      cast(p, g, a) {
        const cls = p.cls, c = cls.citadel;
        return {
          name: 'citadel_of_one', dur: 1.0, anim: 'citadel', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.0], superArmor: true,
          start: () => { g.slowMo(0.5, 0.4); g.audio.sfx('ult_charge'); g.vfx.flash('50,40,10', 0.3, 2); },
          events: [
            [0.2, () => g.vfx.sprite('bs_aegis', p.x, p.y - 30, 0, { scale: 1.1, life: 0.6, glow: 0.6 })],
            [0.6, () => {
              g.audio.sfx('slam_big');
              g.camera.punch(0.2); g.camera.shake(0.6);
              g.vfx.flash('255,236,190', 0.35, 2.5);
              g.vfx.sprite('bs_citadel', p.x, p.y - 34, 0, { scale: 1.6, life: 0.9, glow: 0.4, alpha: 0.9 });
              g.vfx.ring(p.x, p.y, 20, c.tauntRadius, { life: 0.5, width: 5, color: HOLY, fill: true });
              g.vfx.text(p.x, p.y - 92, 'CITADEL OF ONE', { color: PALE, size: 14, life: 1.2 });
              p.status.add('citadel', c.duration, { source: p, refresh: true }); // + its aura (data/statuses.js)
              // the fortress stays around the Bulwark for the whole mode (faint held frame, follows it)
              g.vfx.sprite('bs_citadel', 0, 0, 0, { follow: p, off: 22, scale: 1.1, life: c.duration, frame: 3, glow: 0.2, alpha: 0.3 } /* off: that frame's fortress sits left of its centre */);
              p.citadelPulse = 0;
              g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 110, power: 2.2, type: 'holy', knock: 280, stagger: 60, hitStop: 0.12, shake: 0.4, big: true });
            }],
          ],
        };
      },
    },
  ],

  // ---------------- BULWARK GUARD (hold Q / right click) — the Aegis guard system, wider and stronger
  special: {
    id: 'bulwark_guard', tier: 'fast', stamina: 0, name: 'Bulwark Guard', type: 'special', slot: 'Q', key: 'Q', icon: 'guard',
    cost: 0, cooldown: 0.1, targeting: 'self', tags: ['guard', 'block', 'defense', 'hold'], hold: true,
    desc: 'HOLD to guard: frontal hits deal 80% less (90% while FORTIFIED) and give Bastion (+8). Raise it just before a blow for a PERFECT GUARD: no damage, +15 Bastion and a riposte that spends half the stored Counterweight.',
    cast(p) { p.setGuard(true); return null; },
  },
  perfectGuardText: 'PERFECT GUARD',

  onPerfectGuard(p, g, src) {
    const cls = p.cls, a = src ? Math.atan2(src.y - p.y, src.x - p.x) : p.aim;
    p.gainResource(cls.charge.perfectGuard, true);
    p.startAction({
      name: 'bulwark_counter', dur: 0.42, anim: 'counter', moveMul: 0, ang: a, cancelAt: 0.3, superArmor: true, invuln: [0, 0.2],
      events: [[0.12, () => {
        const pw = cls.counterPower(p, 0.5) + 0.6;
        g.audio.sfx('counter');
        g.vfx.sprite('bs_crest', p.x + Math.cos(a) * 26, p.y - 18 + Math.sin(a) * 26, 0, { scale: 0.7, life: 0.3, glow: 0.6 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 72, half: 1.0, power: pw, type: 'physical', forceCrit: true, counter: true, knock: 260, stagger: 60, hitStop: 0.1, shake: 0.3,
          onHit: (t) => { if (t.status && !t.isBreakable) t.status.add('stun', 0.8, { source: p }); cls.markTarget(p, g, t); },
        });
      }]],
    });
  },
  onGuardBlock(p) { p.gainResource(p.cls.charge.block); },
  counterBonus: { resource: 6 },
  perfectDodge: { resource: 6, stamina: 10, cooldownCut: 0.5 },

  on: {
    // taking damage: Bastion (x2 in Iron Bastion) + the Counterweight store (both capped)
    damageTaken(p, g, e) {
      if (e.target !== p || !(e.amount > 0) || !e.source) return;
      const c = p.cls.charge, w = p.cls.weight;
      const n = Math.min(c.hurtMax, Math.max(c.hurtMin, (e.amount / Math.max(1, p.maxHp)) * c.hurtPerHpShare)); // 5% HP -> +5
      p.gainResource(n * (p.status.has('iron_bastion') ? c.stanceHurtMult : 1));
      p.weight = Math.min(p.maxHp * w.capShare, (p.weight || 0) + e.amount);
      p.lastWeightT = g.time;
    },
    // blocked hits add to the weight too (what the shield caught)
    damageBlocked(p, g, e) {
      if (e.target !== p || e.perfect) return;
      const w = p.cls.weight;
      p.weight = Math.min(p.maxHp * w.capShare, (p.weight || 0) + Math.max(4, e.amount));
      p.lastWeightT = g.time;
    },
    targetMarked(p, g, e) { if (e.source === p && e.markId === 'guardian_mark') g.world.setFlag('tut_marks'); },
  },
};
