// WARDEN OF DAWN — Class 2 of the Aegis Guardian. Support Tank · Barrier Tank · Party Protector.
// "Until the light fades, this shield will not break."
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('dawnlight' + tier RADIANT = barrierPower) · Guard System (hold Q: block / PERFECT GUARD)
//   StatusSystem (shield = barrier, radiant_chain, dawn_bastion, sanctuary, guardian_march, last_light, shared_resolve)
//   MarkSystem (guardian_mark taunt, same as the Aegis) · party (game.players(): solo = only you)
// Gameplay loop: GUARD / block / perfect guard → DAWNLIGHT → DAWN SHIELD (barrier) on whoever needs it →
//   RADIANT CHAIN an ally (they take less, their pain feeds Dawnlight) → DAWN BASTION ground to hold →
//   GRACE OF DAWN mends (small, never a full healer) → DAWN'S SANCTUARY when the party must survive a big blow.
// Zones (Bastion / Sanctuary) and the chain live in the class `tick` (one place, deterministic in tests).
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const GOLD = '#ffd88a', BLUE = '#8ad0ff', PALE = '#fff4d0', HOLY = '255,226,150', SKY = '150,210,255';
const R = 'dawnlight';

// animation table for the 'wd' preset (tools/build-player.js wd → assets/player/wd)
export const WD_ANIMS = {
  idle: { sheet: 'walk', cols: [0] },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 8, loop: true, bob: 1 },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 12, loop: true, bob: 2 },
  atk1: { sheet: 'atk1', cols: [1, 2] },           // overhead cut
  atk2: { sheet: 'atk1', cols: [2, 3, 3] },        // lunging thrust
  atk3: { sheet: 'atk2', cols: [1, 2, 3, 3, 4] },  // blue dawn arc
  dodge: { sheet: 'dash', cols: [1, 2, 3, 4] },
  // shield square to the front; the side views of SK1 col 1 lose the shield -> the walk stance (shield forward)
  guard: { sheet: 'sk1', cols: [1], side: { sheet: 'walk', cols: [0] } },
  dawnShield: { sheet: 'sk1', cols: [1, 2, 2, 4] },
  radiantChain: { sheet: 'sk2', cols: [1, 2, 3, 3, 4] },
  dawnBastion: { sheet: 'sk3', cols: [1, 2, 3, 3, 3] }, // col 4 thrusts backwards in both side rows
  march: { sheet: 'sk4', cols: [1, 2, 2, 3, 3, 4] },
  grace: { sheet: 'sk5', cols: [1, 2, 3, 3, 4] },
  counter: { sheet: 'sk6', cols: [2, 3, 3, 4] },   // pillar of light -> riposte
  sanctuary: { sheet: 'ult', cols: [1, 2, 3, 3, 3, 4] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [2, 3, 3] },
};

// ---- helpers (class-local)
const party = (g, p) => (g.players ? g.players() : [p]); // standing members, you included
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ratio = (m) => (m.maxHp ? m.hp / m.maxHp : 1);
const power = (p) => 1 + (p.stats.barrierPower || 0); // Dawnlight tier RADIANT
// the party member in range who needs it most (lowest HP share); ties go to an ally, not yourself
function neediest(g, p, range) {
  let best = null;
  for (const m of party(g, p)) {
    if (m.dead || m.downed || dist(m, p) > range) continue;
    if (!best || ratio(m) < ratio(best) - 1e-6 || (Math.abs(ratio(m) - ratio(best)) < 1e-6 && best === p)) best = m;
  }
  return best || p;
}
// one feeder per event source: the same hit / chain can never pay more than `cap` (no runaway gains)
function feeder(p, per, cap) {
  let got = 0;
  return () => { const n = Math.min(per, cap - got); if (n > 0) { got += n; p.gainResource(n); } };
}

export const WardenOfDawn = {
  id: 'warden_of_dawn',
  stableId: 'class_warden_of_dawn',
  name: 'Warden of Dawn',
  parentClass: 'aegis_guardian',
  role: 'Support Tank · Barrier Tank · Party Protector',
  difficulty: 4,
  ratings: { damage: 2, range: 2, defense: 4, mobility: 2, support: 5 },
  description: 'The Aegis who swore to shield others first: barriers, a chain of light, holy ground and a sanctuary where the party cannot fall.',
  identity: 'Until the light fades, this shield will not break.',
  loop: ['Guard', 'Protect', 'Dawnlight', 'Barrier', 'Support', 'Sanctuary'],
  strengths: ['Keeps the party alive: barriers, damage reduction, a safe zone', 'Radiant Chain takes pressure off an ally', 'Holy ground stops knockback and staggers'],
  weaknesses: ['Lower personal damage than the Oathbreaker', 'Must manage Dawnlight (it fades outside the fight)', 'Needs good positioning: zones stay where you cast them', 'Strongest when there is someone to protect'],
  signatureWeapon: 'dawn_aegis',
  preset: 'wd',
  anims: WD_ANIMS,
  theme: { color: BLUE, ghost: '#bfe6ff', trail: 'shadow' },
  resource: R, // builder: guard, perfect guard, barriers absorbing, chained ally hit, support skills
  resources: [R],
  mark: null,
  enemyMark: 'guardian_mark',
  base: { hp: 320, atk: 17, def: 12, crit: 0.04, critDmg: 0, holyDmg: 0, cdr: 0, speed: 138, dawnGain: 1, armorBreak: 1.1, barrierPower: 0 },
  perLevel: { hp: 15, atk: 1.1, def: 0.8 },
  startingGear: { weapon: 'dawn_aegis', armor: 'dawn_plate' },
  // solo-friendly default; Radiant Chain (an ally skill) is swapped in from the Skills tab in a party
  defaultLoadout: ['dawn_shield', 'guardian_march', 'dawn_bastion', 'grace_of_dawn'],
  guard: { arc: 1.25, reduction: 0.75, perfectWindow: 0.2, moveMul: 0.4, recover: 0.3, fx: 'dw_shield' },

  // ---- DAWNLIGHT rules (data, not code). Every gain from one source is capped (feeder) — no infinite scaling.
  charge: {
    basicHit: 2, block: 6, perfectGuard: 20, support: 5,
    chainHit: 4, chainCap: 24,          // a chained ally is hit: +4, at most 24 per chain
    absorbPer: 0.1, absorbCap: 6,       // your barriers soak damage: +10% of it, at most 6 per hit
    marchHit: 3, marchCap: 12,
  },
  barrier: { cap: 0.5, duration: 6 },   // a barrier never holds more than 50% of the target's max HP
  dawnShield: { range: 220, share: 0.2, selfBonus: 0.08 },
  chain: { range: 260, breakRange: 340, duration: 10, allyMult: 0.7, selfMult: 0.85 },
  bastion: { radius: 90, duration: 6, burn: { power: 0.5, every: 0.5 } },
  march: { dist: 100, power: 1.3, knock: 230 },
  grace: { range: 220, heal: 0.12, selfHeal: 0.6 }, // heal share of max HP; on yourself only 60% (not a healer)
  sanctuary: { radius: 150, duration: 8, barrier: 0.2, burn: { power: 0.45, every: 0.5 } },
  lastLight: { below: 0.35, dur: 5, cooldown: 12 },
  sharedResolve: { ally: 1.3, self: 1.12 },
  zonePulse: 0.25,
  passives: [
    { id: 'last_light', name: 'Last Light', trigger: 'damageTaken (a party member under 35% HP)', desc: 'When a party member (you included) drops under 35% HP, you take 20% less damage for 5 s. Cooldown 12 s.' },
    { id: 'shared_resolve', name: 'Shared Resolve', trigger: 'while protecting', desc: 'While an ally carries your protection (barrier, chain, holy ground) your defence rises 30% (12% when you only protect yourself).' },
    { id: 'radiant', name: 'Radiant (Dawnlight 60+)', trigger: 'resource threshold', desc: 'At 60+ Dawnlight your barriers are 20% stronger.' },
  ],
  guideIntro: [
    'You protect. HOLD [Q / Right Click] to guard: blocks and PERFECT GUARDS fill DAWNLIGHT. Dawn Shield [1] puts a barrier on whoever is weakest.',
    'Radiant Chain [2] binds an ally: they take less, their pain feeds your light. Dawn Bastion and the ultimate Dawn\'s Sanctuary [5] are holy ground — stand in them.',
  ],
  tutorial: { marks: 'Perform a Perfect Guard', perfect: 'Perform a Perfect Guard', break: 'Raise a Dawn Shield', breakSkill: 'dawn_shield' },

  // HUD counter: how many party members your light protects right now
  hudCounter(p) {
    const g = p.game, members = party(g, p), n = members.filter((m) => p.cls.protects(p, m)).length;
    return { label: 'PROTECTED', value: n, max: Math.max(1, members.length), color: BLUE, full: PALE,
      ready: p.resources.get(R) >= 60, readyText: 'DAWN\'S SANCTUARY READY — [5]' };
  },

  // is `m` under this Warden's protection?
  protects(p, m) {
    if (!m || !m.status) return false;
    for (const id of ['shield', 'radiant_chain', 'dawn_bastion', 'sanctuary']) { const s = m.status.get(id); if (s && s.source === p) return true; }
    return false;
  },

  // mark + taunt one enemy (same rule as the Aegis Guardian)
  markTarget(p, g, t) {
    if (!t || t.dead || t.isBreakable) return;
    g.marks.apply(t, 'guardian_mark', { source: p, sourceClass: 'warden_of_dawn' });
    if (t.status) t.status.add('taunted', 6, { source: p, refresh: true });
  },

  // BARRIER: adds to what the target already holds, capped at barrier.cap × max HP (no stacking to infinity)
  giveBarrier(p, g, t, share) {
    const cls = p.cls, want = Math.round(t.maxHp * share * power(p)), cap = Math.round(t.maxHp * cls.barrier.cap);
    const cur = t.status.get('shield'), have = cur ? Math.max(0, cur.amount || 0) : 0;
    const amount = Math.min(cap, have + want);
    t.status.add('shield', cls.barrier.duration, { amount, source: p, refresh: true });
    g.vfx.text(t.x, t.y - 78, `+${amount - have} BARRIER`, { color: PALE, size: 10 });
    g.events.emit('barrierCreated', { owner: p, target: t, amount: amount - have });
    if (t !== p) g.events.emit('allyProtected', { source: p, target: t, kind: 'barrier' });
    return amount - have;
  },

  // HOLY GROUND (Dawn Bastion / Sanctuary): a zone the class tick pulses — party members inside get `status`
  //   burn: { power, every } = the light also sears foes standing in it (small holy damage)
  addZone(p, g, kind, x, y, radius, duration, status, burn = null) {
    const z = { kind, x, y, r: radius, t: duration, total: duration, status, pulse: 0, burn, burnT: burn ? burn.every : 0 };
    p.zones = (p.zones || []).filter((o) => o.kind !== kind); // re-cast = move it
    p.zones.push(z);
    const sc = radius / 44;
    g.vfx.sprite('dw_circle', x, y, 0, { scale: sc, ground: true, squash: 0.55, life: 0.5, glow: 0.5 });
    g.after(0.4, () => g.vfx.sprite('dw_circle', x, y, 0, { scale: sc, ground: true, squash: 0.55, life: duration - 0.3, frame: 3, glow: 0.35, alpha: 0.7 }));
    g.events.emit('zoneCreated', { owner: p, kind, x, y, radius, duration });
    return z;
  },

  // RADIANT CHAIN: bind `t` (an ally, or yourself when alone)
  bindChain(p, g, t) {
    const c = p.cls.chain, self = t === p;
    if (p.chain && p.chain.target && p.chain.target !== t && p.chain.target.status) p.chain.target.status.remove('radiant_chain');
    t.status.add('radiant_chain', c.duration, { mult: self ? c.selfMult : c.allyMult, source: p, refresh: true });
    p.chain = { target: t, t: c.duration, feed: feeder(p, p.cls.charge.chainHit, p.cls.charge.chainCap) };
    g.vfx.sprite('dw_burst', t.x, t.y - 22, 0, { scale: 0.9, life: 0.45, glow: 0.6 });
    g.vfx.text(t.x, t.y - 80, self ? 'RADIANT CHAIN (SELF)' : 'RADIANT CHAIN', { color: GOLD, size: 10 });
    if (!self) g.events.emit('allyProtected', { source: p, target: t, kind: 'chain' });
  },
  breakChain(p, g, why) {
    const c = p.chain;
    if (!c) return;
    if (c.target && c.target.status) c.target.status.remove('radiant_chain');
    p.chain = null;
    if (why === 'range') g.vfx.text(p.x, p.y - 80, 'CHAIN BROKEN', { color: '#ffb080', size: 10 });
  },

  // ---------------- every frame: chain range + drawing, zones, Shared Resolve
  tick(p, g, dt) {
    const cls = p.cls;
    // chain
    const c = p.chain;
    if (c) {
      c.t -= dt;
      const t = c.target;
      if (c.t <= 0 || !t || t.dead || t.downed || t.disposed) cls.breakChain(p, g, 'end');
      else if (dist(p, t) > cls.chain.breakRange) cls.breakChain(p, g, 'range');
      else if (t !== p) g.vfx.beam(p.x, p.y - 22, Math.atan2(t.y - p.y, t.x - p.x), dist(p, t), 2.5, { life: 0.05, color: HOLY });
    }
    // zones
    if (p.zones && p.zones.length) {
      for (const z of p.zones) {
        z.t -= dt; z.pulse -= dt;
        if (z.pulse > 0 || z.t <= 0) continue;
        z.pulse += cls.zonePulse;
        for (const m of party(g, p)) if (dist(m, z) <= z.r) m.status.add(z.status, cls.zonePulse + 0.15, { source: p, refresh: true });
      }
      for (const z of p.zones) {
        if (!z.burn || z.t <= 0 || (z.burnT -= dt) > 0) continue;
        z.burnT += z.burn.every;
        g.combat.spawnHitbox({ owner: p, x: z.x, y: z.y, shape: 'circle', r: z.r, power: z.burn.power, type: 'holy', knock: 0, stagger: 3, hitStop: 0, shake: 0 });
      }
      for (const z of p.zones) if (z.t <= 0) g.events.emit('zoneEnded', { owner: p, kind: z.kind });
      p.zones = p.zones.filter((z) => z.t > 0);
    }
    // SHARED RESOLVE (passive): stronger while protecting someone
    const others = party(g, p).filter((m) => m !== p);
    const mult = others.some((m) => cls.protects(p, m)) ? cls.sharedResolve.ally : cls.protects(p, p) ? cls.sharedResolve.self : 0;
    if (mult) p.status.add('shared_resolve', 0.3, { mult, source: p, refresh: true });
  },

  // ---------------- basic: two holy-sword cuts, then a blue dawn arc
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.36, at: 0.12, anim: 'atk1', r: 56, half: 1.0, power: 1.25, lunge: 10 },
      { dur: 0.38, at: 0.14, anim: 'atk2', r: 64, half: 0.7, power: 1.3, lunge: 16 },
      { dur: 0.5, at: 0.2, anim: 'atk3', r: 70, half: 2.4, power: 2.0, lunge: 6, knock: 200 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.4, ang: a, cancelAt: 0.06, comboAt: d.at + 0.08,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'slash_heavy' : 'swing');
        if (step === 2) g.vfx.slash(p.x, p.y - 12, a, 58, 1.2, { color: SKY, core: '255,250,235', life: 0.2 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r, half: d.half, power: d.power, type: step === 2 ? 'holy' : 'physical',
          knock: d.knock ?? 110, stagger: 12 + step * 8, hitStop: step === 2 ? 0.08 : 0.05, shake: step === 2 ? 0.2 : 0.1,
          onHit: feeder(p, cls.charge.basicHit, cls.charge.basicHit),
        });
      }]],
    };
  },

  skills: [
    {
      id: 'dawn_shield', tier: 'medium', name: 'Dawn Shield', type: 'active', cooldown: 8, cost: 15, targeting: 'self',
      tags: ['barrier', 'support', 'defense', 'ally'], icon: 'dawn_shield',
      desc: 'A barrier of dawnlight (20% of max HP, 6 s) on the party member in range who needs it most — yourself when alone. Shielding an ally also gives you a small barrier. Barriers stack up to 50% max HP.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'dawn_shield', dur: 0.5, anim: 'dawnShield', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.2, () => {
            const s = cls.dawnShield, t = neediest(g, p, s.range);
            g.audio.sfx('shrine');
            g.vfx.sprite('dw_shield', t.x, t.y - 26, 0, { scale: 0.75, life: 0.55, glow: 0.6 });
            cls.giveBarrier(p, g, t, s.share);
            if (t !== p) cls.giveBarrier(p, g, p, s.selfBonus);
            p.gainResource(cls.charge.support);
          }]],
        };
      },
    },
    {
      id: 'radiant_chain', tier: 'medium', name: 'Radiant Chain', type: 'active', cooldown: 14, cost: 0, targeting: 'self',
      tags: ['support', 'ally', 'link', 'damage-reduction', 'resource'], icon: 'radiant_chain',
      desc: 'Bind the nearest ally with a chain of light for 10 s: they take 30% less damage and every hit on them feeds your Dawnlight (+4, max 24). Breaks beyond 340 px. Alone, it binds you (15% less damage).',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'radiant_chain', dur: 0.5, anim: 'radiantChain', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.22, () => {
            const c = cls.chain;
            const ally = party(g, p).filter((m) => m !== p && dist(m, p) <= c.range).sort((x, y) => dist(x, p) - dist(y, p))[0];
            g.audio.sfx('thread');
            cls.bindChain(p, g, ally || p);
            p.gainResource(cls.charge.support);
          }]],
        };
      },
    },
    {
      id: 'dawn_bastion', tier: 'medium', name: 'Dawn Bastion', type: 'active', cooldown: 18, cost: 25, targeting: 'self',
      tags: ['zone', 'support', 'damage-reduction', 'knockback-immune', 'resist'], icon: 'dawn_bastion',
      desc: 'Consecrate the ground at your feet (radius 90, 6 s): party members inside take 25% less damage, cannot be knocked back or staggered, and control effects on them are 30% shorter. The light sears foes inside (small holy damage).',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'dawn_bastion', dur: 0.55, anim: 'dawnBastion', moveMul: 0, ang: a, cancelAt: 0.35,
          events: [[0.25, () => {
            const b = cls.bastion;
            g.audio.sfx('shrine');
            g.camera.shake(0.12);
            g.vfx.ring(p.x, p.y, 10, b.radius, { life: 0.45, color: HOLY, width: 3 });
            cls.addZone(p, g, 'bastion', p.x, p.y, b.radius, b.duration, 'dawn_bastion', b.burn);
            p.gainResource(cls.charge.support);
          }]],
        };
      },
    },
    {
      id: 'guardian_march', tier: 'high', name: 'Guardian March', type: 'active', cooldown: 7, cost: 0, targeting: 'direction',
      tags: ['movement', 'defense', 'taunt', 'pushback', 'aggro'], icon: 'guardian_march',
      desc: 'Advance behind the raised shield: 50% less damage, no knockback, enemies in front are pushed back and TAUNTED (Guardian Mark). Builds Dawnlight on every foe it meets.',
      cast(p, g, a) {
        const cls = p.cls, m = cls.march, feed = feeder(p, cls.charge.marchHit, cls.charge.marchCap);
        const shove = () => {
          g.audio.sfx('crash');
          g.vfx.sprite('dw_crest', p.x + Math.cos(a) * 28, p.y - 16 + Math.sin(a) * 28, a, { scale: 0.55, life: 0.28, glow: 0.5 });
          g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 52, half: 0.9, power: m.power, type: 'holy', knock: m.knock, knockAng: a, stagger: 25, hitStop: 0.04, shake: 0.12,
            onHit: (t) => { cls.markTarget(p, g, t); feed(); } });
        };
        return {
          name: 'guardian_march', dur: 0.9, anim: 'march', moveMul: 0, ang: a, cancelAt: 99, superArmor: true,
          lunge: { dist: m.dist, t0: 0.05, t1: 0.8 },
          start: () => { p.status.add('guardian_march', 0.95, { source: p, refresh: true }); g.audio.sfx('taunt'); },
          events: [[0.2, shove], [0.45, shove], [0.72, () => { shove(); g.camera.shake(0.2); }]],
        };
      },
    },
    {
      id: 'grace_of_dawn', tier: 'medium', name: 'Grace of Dawn', type: 'active', cooldown: 12, cost: 30, targeting: 'self',
      tags: ['heal', 'support', 'barrier', 'ally', 'consumes-resource'], icon: 'grace_of_dawn',
      desc: 'Spend 30 Dawnlight: mend the party member in range with the lowest HP for 12% of their max HP (60% of that on yourself). Healing past full HP becomes a barrier.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'grace_of_dawn', dur: 0.55, anim: 'grace', moveMul: 0, ang: a, cancelAt: 0.35,
          events: [[0.25, () => {
            const gr = cls.grace, t = neediest(g, p, gr.range);
            const amt = Math.round(t.maxHp * gr.heal * (t === p ? gr.selfHeal : 1));
            g.audio.sfx('potion');
            g.vfx.sprite('dw_pillar', t.x, t.y - 30, 0, { scale: 0.8, life: 0.6, glow: 0.6 });
            const healed = t.heal ? t.heal(amt, 'grace_of_dawn') : 0;
            const over = amt - healed;
            if (over > 0) cls.giveBarrier(p, g, t, over / t.maxHp / power(p));
            if (t !== p) g.events.emit('allyProtected', { source: p, target: t, kind: 'heal' });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'dawns_sanctuary', tier: 'high', name: 'Dawn\'s Sanctuary', type: 'ultimate', cooldown: 45, cost: 60, targeting: 'self',
      tags: ['ultimate', 'zone', 'barrier', 'cleanse', 'debuff-immune', 'taunt', 'support'], icon: 'sanctuary', ultimate: true,
      desc: 'ULTIMATE (60 Dawnlight). A cathedral of light (radius 150, 8 s): everyone inside gets a barrier (20% max HP), is cleansed, takes 40% less damage, cannot be knocked back and resists new debuffs. Foes inside are taunted.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'dawns_sanctuary', dur: 1.0, anim: 'sanctuary', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.0], superArmor: true,
          start: () => { g.slowMo(0.5, 0.4); g.audio.sfx('ult_charge'); g.vfx.flash('60,50,20', 0.3, 2); },
          events: [
            [0.2, () => g.vfx.sprite('dw_knight', p.x, p.y - 34, 0, { scale: 1.3, life: 0.8, glow: 0.6 })],
            [0.6, () => {
              const s = cls.sanctuary;
              g.audio.sfx('slam_big');
              g.camera.punch(0.2); g.camera.shake(0.5);
              g.vfx.flash('255,244,210', 0.4, 2.5);
              g.vfx.sprite('dw_dome', p.x, p.y - 44, 0, { scale: s.radius / 62, life: 0.9, glow: 0.3, alpha: 0.85 });
              g.vfx.ring(p.x, p.y, 20, s.radius, { life: 0.5, width: 5, color: HOLY, fill: true });
              g.vfx.light(p.x, p.y, s.radius * 1.4, GOLD, 0.6, 1);
              g.vfx.text(p.x, p.y - 92, 'DAWN\'S SANCTUARY', { color: PALE, size: 14, life: 1.2 });
              cls.addZone(p, g, 'sanctuary', p.x, p.y, s.radius, s.duration, 'sanctuary', s.burn);
              for (const m of party(g, p)) {
                if (dist(m, p) > s.radius) continue;
                for (const cat of ['debuff', 'control', 'dot']) m.status.cleanse(cat);
                m.status.add('sanctuary', 0.4, { source: p, refresh: true });
                cls.giveBarrier(p, g, m, s.barrier);
              }
              for (const f of g.world.hostiles()) if (!f.dead && !f.isBreakable && dist(f, p) < s.radius) cls.markTarget(p, g, f);
            }],
          ],
        };
      },
    },
  ],

  // ---------------- DAWN GUARD (hold Q / right click) — the Aegis Guard System, same timing rules
  special: {
    id: 'dawn_guard', tier: 'fast', stamina: 0, name: 'Dawn Guard', type: 'special', slot: 'Q', key: 'Q', icon: 'guard',
    cost: 0, cooldown: 0.1, targeting: 'self', tags: ['guard', 'block', 'defense', 'hold'], hold: true,
    desc: 'HOLD to guard: frontal hits deal 75% less and give Dawnlight (+6). Raise it just before a blow for a PERFECT GUARD: no damage, +20 Dawnlight and a riposte of light.',
    cast(p) { p.setGuard(true); return null; },
  },
  perfectGuardText: 'PERFECT GUARD',

  // Perfect Guard: riposte of light (sk6) + a thin barrier on yourself
  onPerfectGuard(p, g, src) {
    const cls = p.cls, a = src ? Math.atan2(src.y - p.y, src.x - p.x) : p.aim;
    p.gainResource(cls.charge.perfectGuard, true);
    p.startAction({
      name: 'dawn_counter', dur: 0.42, anim: 'counter', moveMul: 0, ang: a, cancelAt: 0.3, superArmor: true, invuln: [0, 0.2],
      events: [[0.12, () => {
        g.audio.sfx('counter');
        g.vfx.sprite('dw_pillar', p.x, p.y - 30, 0, { scale: 0.6, life: 0.35, glow: 0.6 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 72, half: 1.0, power: 2.4, type: 'holy', forceCrit: true, knock: 240, stagger: 50, hitStop: 0.1, shake: 0.25,
          onHit: (t) => { if (t.status && !t.isBreakable) t.status.add('stun', 0.8, { source: p }); cls.markTarget(p, g, t); },
        });
        cls.giveBarrier(p, g, p, 0.06);
      }]],
    });
  },
  onGuardBlock(p) { p.gainResource(p.cls.charge.block); },
  counterBonus: { resource: 6 },
  perfectDodge: { resource: 8, stamina: 10, cooldownCut: 0.5 },

  on: {
    damageTaken(p, g, e) {
      const cls = p.cls, t = e.target;
      if (!t || e.amount <= 0 || !party(g, p).includes(t)) return;
      // RADIANT CHAIN: the bound one's pain feeds the light (capped per chain)
      if (p.chain && p.chain.target === t) p.chain.feed();
      // LAST LIGHT (passive): a party member falls low -> you steel yourself
      const ll = cls.lastLight;
      if (!t.dead && ratio(t) < ll.below && g.time >= (p.lastLightReady || 0)) {
        p.lastLightReady = g.time + ll.cooldown;
        p.status.add('last_light', ll.dur, { source: p, refresh: true });
        g.vfx.text(p.x, p.y - 84, 'LAST LIGHT', { color: PALE, size: 11 });
        g.events.emit('passiveTriggered', { player: p, id: 'last_light', ally: t });
      }
    },
    // your barriers soaking a blow feed Dawnlight (capped per hit)
    shieldAbsorbed(p, g, e) {
      if (e.statusSource !== p || !(e.amount > 0)) return;
      const c = p.cls.charge;
      p.gainResource(Math.min(c.absorbCap, e.amount * c.absorbPer));
    },
    playerDowned(p, g, e) { if (p.chain && p.chain.target === e.player) p.cls.breakChain(p, g, 'end'); },
  },
};
