import { TAU, rand } from '../core/math.js';
import { TEAM } from '../core/constants.js';
import { distToSegment } from '../combat/threadSystem.js';

// STORMCALLER — Class 2 of the Astral Weaver. Ranged DPS · AoE · Mobility.
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('storm_charge' + tiers CHARGED / SUPERCHARGED) · SkillSystem · StatusSystem (shock, still_air, tailwind)
//   ThreadSystem (the Weaver's thread, re-typed as 'lightning_thread' in data/threads.js) · Combat (projectiles, hitboxes,
//   dealDamage for chain hops) · Player hooks: tick (passive STORM VELOCITY, Tempest Field zones), perfectDodge data.
// Gameplay loop: MOVE → SHOCK (Thunder Lash / threads / fields) → CHAIN (every hop prefers a shocked foe) → keep MOVING
//   (charge from motion, capped per second) → STORM CHARGE → STORM BURST [Q] (spends it all, detonates the wires) /
//   Tempest Field / Heaven's Tempest. Standing still in a fight = STILL AIR (-15% damage) and the charge leaks away.
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#7ac8ff', CR = '120,190,255', PALE = '#e0f4ff';
const S = 'storm_charge';
const WIRE = 'lightning_thread';

// animation table for the 'sm' preset (tools/build-player.js sm → assets/player/sm)
// (sk1 col 3-4 and ult col 3 are effect-only frames in the art: not used)
// hit: the RELEASE column (staff thrust / spark leaves) — every event of an action fires while it shows
// (tools/tests/castTiming.test.mjs). Thunder Lash's release pose is an effect-only frame, so it has no hit list.
export const SM_ANIMS = {
  idle: { sheet: 'idle', cols: [0, 1, 2, 3, 4, 5], fps: 4, loop: true },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 10, loop: true },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 14, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4], hit: [3] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4], hit: [3] },
  atk3: { sheet: 'sk4', cols: [1, 2, 3, 4], hit: [3] },
  dodge: { sheet: 'dash', cols: [1, 2, 3, 4] },
  thunderLash: { sheet: 'sk1', cols: [1, 2, 5] },
  stormStep: { sheet: 'sk2', cols: [1, 2, 3, 4], hit: [3, 4] }, // the discharge is at the landing
  chainTempest: { sheet: 'sk3', cols: [1, 2, 3, 4], hit: [3] },
  staticThread: { sheet: 'sk4', cols: [1, 2, 3, 4], hit: [3] },
  tempestField: { sheet: 'sk5', cols: [1, 2, 3, 4], hit: [3] },
  stormBurst: { sheet: 'sk6', cols: [1, 2, 3, 4], hit: [3] },
  heavensTempest: { sheet: 'ult', cols: [1, 2, 4, 4, 5], hit: [4] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function aimPoint(p, g, range) {
  const m = g.mouseWorld(), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, range / d);
  return { x: p.x + dx * k, y: p.y + dy * k };
}
function foes(g) { return g.world.hostiles().filter((m) => !m.dead && !m.isBreakable); }
function nearestFoe(g, x, y, within) {
  let best = null, bd = within;
  for (const m of foes(g)) { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } }
  return best;
}
// charge per hit, capped per cast (one skill hitting a pack must not fill the bar by itself)
function feeder(p, per, cap) {
  let got = 0;
  return (n = per) => { if (got < cap) { const k = Math.min(n, cap - got); got += k; p.gainResource(k); } };
}
function dashAngle(p, g, a) {
  const mv = g.input && g.input.moveVector ? g.input.moveVector() : { x: 0, y: 0 };
  return mv.x || mv.y ? Math.atan2(mv.y, mv.x) : a;
}
// do segments AB and CD cross? (Storm Step through a thread)
function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (!d) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

export const Stormcaller = {
  id: 'stormcaller',
  stableId: 'class_stormcaller',
  name: 'Stormcaller',
  role: 'Ranged DPS · AoE · Mobility',
  difficulty: 4,
  ratings: { damage: 5, range: 4, defense: 1, mobility: 4, support: 1 },
  description: 'The Astral Weaver who listened to the storm: lightning that jumps from foe to foe, threads that become live wires, and a charge that only grows while she keeps moving.',
  identity: 'Move. Shock. Chain. Never stand still.',
  tagline: 'Lightning is the voice of the storm — and I command it.',
  loop: ['Move', 'Shock', 'Chain', 'Move', 'Build Storm Charge', 'Storm Burst'],
  strengths: ['Chain lightning: one cast hits a whole pack, hopping to shocked foes first', 'Mobile caster: Storm Step blinks and discharges, moving builds Storm Charge', 'Big AoE payoffs: Storm Burst, Tempest Field, Heaven\'s Tempest'],
  weaknesses: ['Lowest defence of the Astral line', 'Standing still in a fight: STILL AIR (-15% damage) and the charge leaks away', 'Must spend Storm Charge well — Storm Burst takes all of it'],
  signatureWeapon: 'storm_staff',
  preset: 'sm',
  anims: SM_ANIMS,
  theme: { color: C, ghost: '#2a6aff', trail: 'stardust' },
  kit: { weapon: 'storm_staff', armor: 'stormweave_robe' }, // signature weapon + armour = part of the class (data/classKits.js), not items
  resource: S,
  resources: [S],
  mark: null,
  base: { hp: 205, atk: 21, def: 3, crit: 0.08, critDmg: 0, magicDmg: 0, lightningDmg: 0, cdr: 0, speed: 156, stormGain: 1, armorBreak: 1, stormRange: 0, stormChain: 0 },
  perLevel: { hp: 10, atk: 1.65, def: 0.35 },
  defaultLoadout: ['thunder_lash', 'storm_step', 'chain_tempest', 'static_thread'],
  // STORM CHARGE rules (data, not code)
  charge: { basicHit: 3, lashHit: 4, chainHop: 2, castCap: 12, dash: 5, dodge: 4, wireTouch: 2, wireBurst: 4, bind: 4 },
  // passive STORM VELOCITY: moving in a fight -> charge per px moved, at most `perSec` a second (no farming by
  // running in circles); after `stillAfter` s without moving: STILL AIR + the charge leaks `stillDrain` / s
  velocity: { perPx: 0.04, perSec: 5, stillAfter: 1.5, stillDrain: 4 },
  // CHAIN LIGHTNING: range (× 1 + stormRange), hop delay, each hop keeps `falloff` of the power; passive THUNDER
  // RESONANCE: from the 3rd target on every hop is ×`resonance` and the cast gives `resonanceCharge` once
  chain: { range: 200, delay: 0.07, falloff: 0.8, preferShocked: 60, resonance: 1.2, resonanceCharge: 4 },
  stepGuard: 1.5, // Storm Step: STATIC GUARD seconds (her only defence is to keep moving)
  shockRule: { dur: 4, tickAtk: 0.08 }, // a SHOCK tick = 8% of your ATK per stack
  field: { r: 95, dur: 6, every: 0.5, power: 0.3, slow: 0.8, shockEvery: 1, chargePerSec: 3 },
  burst: { min: 30, r0: 80, r1: 150, p0: 1.2, p1: 3.0, wireMult: 1.25 },
  tempest: { r: 160, dur: 4, strikes: 9, every: 0.36, power: 1.1, wireAt: 2.0, finalAt: 3.6, finalPower: 4.0 },
  passives: [
    { id: 'storm_velocity', name: 'Storm Velocity', trigger: 'moving in a fight', desc: 'Moving in a fight builds Storm Charge (up to 5 a second — running in circles gives no more). Standing still for 1.5 s: STILL AIR (-15% damage) and the charge leaks away.' },
    { id: 'thunder_resonance', name: 'Thunder Resonance', trigger: 'chain hits 3+ foes', desc: 'Chain lightning that reaches a 3rd target grows: every further hop deals 20% more, and the cast gives +4 Storm Charge.' },
    { id: 'storm_tiers', name: 'Charged (40) / Supercharged (80)', trigger: 'resource threshold', desc: 'CHARGED: +10% lightning damage, +15% chain range, faster feet. SUPERCHARGED: +20% lightning damage, +30% chain range, +1 chain jump.' },
  ],
  guideIntro: [
    'You are a storm that must keep moving. Walking in a fight builds STORM CHARGE; standing still weakens you (STILL AIR).',
    'THUNDER LASH [1] shocks and CHAINS to nearby foes — shocked ones first. STATIC THREAD weaves live wires; [Q] STORM BURST spends all your charge in a blast and detonates every wire.',
  ],
  tutorial: { marks: 'Reach 80 Storm Charge (SUPERCHARGED)', break: 'Unleash a Storm Burst', breakSkill: 'storm_burst' },

  // HUD counter: live wires (lightning threads) you have out
  hudCounter(p) {
    const n = p.game && p.game.threads ? p.game.threads.count(p, WIRE) : 0;
    return { label: 'LIVE WIRES', value: n, max: 3, color: C, full: PALE, ready: p.resources.get(S) >= 80, readyText: 'SUPERCHARGED — STORM BURST' };
  },

  // SHOCK a foe (stacks, tick sized by your ATK)
  shock(p, g, t, stacks = 1) {
    if (!t || t.dead || !t.status) return;
    const cls = p.cls;
    t.status.add('shock', cls.shockRule.dur, { source: p, stacks, damage: Math.max(2, Math.round((p.stats.atk || 20) * cls.shockRule.tickAtk)) });
  },
  // one lightning damage instance straight onto a target (chain hops: exactly that foe, no area)
  zap(p, g, t, power, extra = {}) {
    if (!t || t.dead) return null;
    return g.combat.dealDamage(p, t, { power, type: 'lightning', knock: 25, stagger: 8, hitStop: 0.02, shake: 0.05, color: C, ...extra });
  },

  // CHAIN LIGHTNING from `from`: `jumps` more hops, each to the best foe in reach not hit yet (shocked foes preferred).
  // Pure picking rule = chainTarget(); hops are delayed a little so the eye can follow them.
  chainTarget(p, g, from, hit) {
    const cls = p.cls, reach = cls.chain.range * (1 + (p.stats.stormRange || 0));
    let best = null, bs = Infinity;
    for (const m of foes(g)) {
      if (hit.has(m.id)) continue;
      const d = dist(m, from);
      if (d > reach) continue;
      const s = d - (m.status && m.status.has('shock') ? cls.chain.preferShocked : 0);
      if (s < bs) { bs = s; best = m; }
    }
    return best;
  },
  chainFrom(p, g, from, power, jumps, opts = {}) {
    const cls = p.cls, ch = cls.chain, hit = opts.hit || new Set([from.id]);
    const skillId = opts.skillId ?? (p.castMods && p.castMods.skillId), feed = opts.feed || feeder(p, cls.charge.chainHop, cls.charge.castCap);
    let count = hit.size, resonated = false, prev = from;
    const hop = (left, pw) => {
      if (left <= 0 || p.dead || p.disposed) return;
      const t = cls.chainTarget(p, g, prev, hit);
      if (!t) return;
      hit.add(t.id); count++;
      let k = pw;
      if (count >= 3) { // THUNDER RESONANCE
        k *= ch.resonance;
        if (!resonated) {
          resonated = true;
          p.gainResource(ch.resonanceCharge);
          g.vfx.text(t.x, t.y - 70, 'RESONANCE', { color: PALE, size: 9 });
          g.events.emit('passiveTriggered', { player: p, id: 'thunder_resonance' });
        }
      }
      g.vfx.bolt(prev.x, prev.y - 18, t.x, t.y - 18, { color: CR, width: 1.6, life: 0.2 });
      g.vfx.sprite('sm_spark', t.x, t.y - 18, rand(0, TAU), { scale: 0.45, life: 0.18, glow: 0.5 });
      cls.zap(p, g, t, k, { skillId });
      cls.shock(p, g, t);
      feed();
      g.events.emit('chainHop', { owner: p, target: t, index: count });
      prev = t;
      g.after(ch.delay, () => hop(left - 1, pw * ch.falloff));
    };
    g.after(ch.delay, () => hop(jumps, power));
  },
  jumps(p, base) { return base + (p.stats.stormChain || 0); },

  // own live wires (lightning threads) close to a point
  wiresNear(p, g, x, y, within) {
    return g.threads.ofOwner(p).filter((th) => th.type === WIRE && (() => { const [a, b] = g.threads.ends(th); return distToSegment(x, y, a.x, a.y, b.x, b.y) <= within; })());
  },
  // detonate wires (a lightning line along each; power × mult)
  burstWires(p, g, list, mult = 1) {
    const cls = p.cls;
    let n = 0;
    for (const th of list) {
      const seg = g.threads.trigger(th, 'storm');
      if (!seg) continue;
      n++;
      g.vfx.bolt(seg.ax, seg.ay - 10, seg.bx, seg.by - 10, { color: CR, width: 3, life: 0.3, jag: 12 });
      g.vfx.light((seg.ax + seg.bx) / 2, (seg.ay + seg.by) / 2, 110, C, 0.35, 0.8);
      const hb = g.combat.threadBurst(seg, p, { onHit: (t) => { cls.shock(p, g, t); } });
      if (hb && mult !== 1) hb.power *= mult;
      p.gainResource(cls.charge.wireBurst);
    }
    return n;
  },

  // TEMPEST FIELD zone (class tick pulses it)
  addField(p, g, x, y) {
    const f = p.cls.field;
    p.zones = (p.zones || []).filter((z) => z.kind !== 'tempest'); // one field at a time: re-cast moves it
    p.zones.push({ kind: 'tempest', x, y, r: f.r, t: f.dur, total: f.dur, pulse: 0, shockT: 0 });
    const sc = f.r / 60;
    g.vfx.sprite('sm_vortex', x, y - 10, 0, { scale: sc, life: 0.5, glow: 0.5 });
    g.after(0.35, () => g.vfx.sprite('sm_vortex', x, y, 0, { scale: sc, life: f.dur - 0.3, frame: 3, glow: 0.3, alpha: 0.4, ground: true, squash: 0.6 }));
    g.events.emit('zoneCreated', { owner: p, kind: 'tempest', x, y, radius: f.r, duration: f.dur });
  },

  // ---------------- basic: two storm bolts, then a spark that shocks and jumps once
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.3, at: 0.16, anim: 'atk1', power: 0.85, speed: 520, sprite: 'sm_bolt', scale: 0.5 },
      { dur: 0.3, at: 0.16, anim: 'atk2', power: 0.9, speed: 520, sprite: 'sm_bolt', scale: 0.5 },
      { dur: 0.42, at: 0.22, anim: 'atk3', power: 1.25, speed: 600, sprite: 'sm_spark', scale: 0.6, chain: true },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.6, ang: a, cancelAt: 0.05, comboAt: d.at + 0.06,
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'cast' : 'swing_fast');
        const ox = p.x + Math.cos(a) * 16, oy = p.y - 18 + Math.sin(a) * 16;
        g.combat.projectiles.fire({
          x: ox, y: oy, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, r: step === 2 ? 9 : 6, life: 0.55,
          team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: d.sprite, frames: [1, 2, 3, 2], fps: 18, scale: d.scale,
          power: d.power, type: 'lightning', knock: step === 2 ? 120 : 50, stagger: 8 + step * 6, hitStop: 0.03, shake: 0.06, color: C, trail: true,
          onHit: (t) => {
            p.gainResource(cls.charge.basicHit);
            if (!d.chain) return;
            cls.shock(p, g, t);
            cls.chainFrom(p, g, t, 0.45, cls.jumps(p, 1), { skillId: null });
          },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'thunder_lash', tier: 'fast', name: 'Thunder Lash', type: 'active', cooldown: 2.5, cost: 0, targeting: 'direction',
      tags: ['ranged', 'lightning', 'chain', 'shock'], icon: 'thunder_lash',
      desc: 'Hurl a lash of lightning. It SHOCKS the first foe it hits, then CHAINS to 2 more nearby (shocked foes first; +1 at SUPERCHARGED).',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'thunder_lash', dur: 0.34, anim: 'thunderLash', moveMul: 0.35, ang: a, cancelAt: 0.16,
          events: [[0.12, () => {
            g.audio.sfx('star');
            const ox = p.x + Math.cos(a) * 18, oy = p.y - 18 + Math.sin(a) * 18, feed = feeder(p, cls.charge.lashHit, cls.charge.castCap);
            const k = (p.castMods && p.castMods.power) || 1; // skill level power, kept for the chain (it lands after the cast)
            g.combat.projectiles.fire({
              x: ox, y: oy, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: 9, life: 0.42,
              team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'sm_bolt', frames: [2, 3], fps: 16, scale: 0.95,
              power: 1.5, type: 'lightning', knock: 70, stagger: 14, hitStop: 0.04, shake: 0.1, color: C, trail: true,
              onHit: (t) => {
                feed(cls.charge.lashHit);
                cls.shock(p, g, t);
                g.vfx.sprite('sm_spark', t.x, t.y - 18, a, { scale: 0.7, life: 0.2, glow: 0.5 });
                // evolutions change the jump count through data (values.extraJumps)
                cls.chainFrom(p, g, t, 1.5 * 0.65 * k, cls.jumps(p, Math.max(1, 2 + p.skillValue('thunder_lash', 'extraJumps', 0))), { feed, skillId: 'thunder_lash' });
              },
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'storm_step', tier: 'fast', name: 'Storm Step', type: 'active', cooldown: 6, cost: 0, targeting: 'direction',
      tags: ['dash', 'mobility', 'invulnerable', 'aoe', 'shock'], icon: 'storm_step',
      desc: 'Blink as lightning (invulnerable, can Perfect Dodge) and discharge around where you land (SHOCK); the static clings to you for 1.5 s (STATIC GUARD: -30% damage taken). Blinking ACROSS one of your live wires leaves a LIGHTNING TRAIL along your path.',
      cast(p, g, a) {
        const cls = p.cls, ang = dashAngle(p, g, a), from = { x: p.x, y: p.y };
        p.beginDodge(ang, true);
        g.audio.sfx('blink');
        p.gainResource(cls.charge.dash);
        return {
          name: 'storm_step', dur: 0.24, anim: 'stormStep', moveMul: 0, ang, cancelAt: 0.24, invuln: [0, 0.28], dash: { ang, dist: 150 },
          ghostEvery: 0.03,
          events: [[0.22, () => {
            const len = dist(p, from);
            g.vfx.bolt(from.x, from.y - 16, p.x, p.y - 16, { color: CR, width: 2, life: 0.25 });
            g.vfx.sprite('sm_burst', p.x, p.y - 20, 0, { scale: 0.8, life: 0.3, glow: 0.5 });
            p.status.add('static_guard', cls.stepGuard, { source: p, refresh: true });
            g.audio.sfx('thread_burst');
            const feed = feeder(p, 2, cls.charge.castCap);
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 6, shape: 'circle', r: 70, power: 1.1, type: 'lightning', knock: 110, stagger: 16, hitStop: 0.04, shake: 0.14,
              onHit: (t) => { cls.shock(p, g, t); feed(); } });
            // LIGHTNING TRAIL: the path crossed a live wire
            const crossed = len >= 40 && g.threads.ofOwner(p).some((th) => { const [q, r] = g.threads.ends(th); return segmentsCross(from.x, from.y, p.x, p.y, q.x, q.y, r.x, r.y); });
            if (crossed) {
              g.threads.create(p, WIRE, { x: from.x, y: from.y }, { x: p.x, y: p.y }, { duration: 3 });
              g.vfx.text(p.x, p.y - 72, 'LIGHTNING TRAIL', { color: PALE, size: 9 });
              g.events.emit('lightningTrail', { owner: p });
            }
          }]],
        };
      },
    },
    {
      slot: 3, id: 'chain_tempest', tier: 'medium', name: 'Chain Tempest', type: 'active', cooldown: 8, cost: 0, targeting: 'point',
      tags: ['aoe', 'lightning', 'chain', 'shock', 'thread'], icon: 'chain_tempest',
      desc: 'Call a bolt from the sky onto the target area: it SHOCKS everything there and chains out from the first two it hits. A live wire under the bolt is detonated too.',
      cast(p, g, a) {
        const cls = p.cls, pt = aimPoint(p, g, 260);
        return {
          name: 'chain_tempest', dur: 0.5, anim: 'chainTempest', moveMul: 0.2, ang: a, cancelAt: 0.3,
          start: () => g.vfx.ring(pt.x, pt.y, 60, 20, { life: 0.3, color: CR, width: 2 }),
          events: [[0.26, () => {
            g.audio.sfx('constellation');
            g.vfx.sprite('sm_strike', pt.x, pt.y - 40, 0, { scale: 1.3, life: 0.36, glow: 0.6 });
            g.vfx.bolt(pt.x + rand(-10, 10), pt.y - 220, pt.x, pt.y - 6, { color: CR, width: 3, life: 0.22, jag: 14 });
            g.vfx.light(pt.x, pt.y, 120, C, 0.3, 0.9);
            g.camera.shake(0.25);
            const hitList = [], feed = feeder(p, 2, cls.charge.castCap);
            g.combat.spawnHitbox({ owner: p, x: pt.x, y: pt.y, shape: 'circle', r: 70, power: 2.1, type: 'lightning', knock: 90, stagger: 24, hitStop: 0.06, shake: 0.2,
              onHit: (t) => { cls.shock(p, g, t); feed(); if (!t.isBreakable) hitList.push(t); } });
            const wires = cls.wiresNear(p, g, pt.x, pt.y, 60);
            if (wires.length) g.after(0.08, () => cls.burstWires(p, g, wires));
            const sid = p.castMods && p.castMods.skillId, k = (p.castMods && p.castMods.power) || 1;
            g.after(0.06, () => {
              const hit = new Set(hitList.map((t) => t.id));
              for (const t of hitList.slice(0, 2)) cls.chainFrom(p, g, t, 1.1 * k, cls.jumps(p, 2), { hit, skillId: sid, feed });
            });
          }]],
        };
      },
    },
    {
      slot: 4, id: 'static_thread', tier: 'fast', name: 'Static Thread', type: 'active', cooldown: 4, cost: 0, targeting: 'point',
      tags: ['thread', 'shock', 'control', 'lightning'], icon: 'static_thread',
      desc: 'The Weaver\'s thread, turned into a LIVE WIRE from your feet to the cursor (up to 3, 6 s): foes touching it take lightning damage and are SHOCKED. Aim at a foe to wire it (STATIC BIND: short root + 2 Shock). Any Astral Thread of yours becomes a live wire too.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'static_thread', dur: 0.38, anim: 'staticThread', moveMul: 0.25, ang: a, cancelAt: 0.22,
          events: [[0.2, () => {
            // the Weaver's own threads become live wires (same anchors)
            for (const th of g.threads.ofOwner(p).filter((t) => t.type === 'astral_thread')) {
              const [q, r] = g.threads.ends(th);
              g.threads.expire(th, 'converted');
              g.threads.create(p, WIRE, q.entity ? { entity: q.entity } : { x: q.x, y: q.y }, r.entity ? { entity: r.entity } : { x: r.x, y: r.y });
            }
            const pt = aimPoint(p, g, 240), foe = nearestFoe(g, pt.x, pt.y, 46);
            const th = g.threads.create(p, WIRE, { x: p.x, y: p.y }, foe ? { entity: foe } : pt);
            if (!th) return;
            g.audio.sfx('thread');
            g.vfx.sprite('sm_chain', (th.a.x + th.b.x) / 2, (th.a.y + th.b.y) / 2 - 10, Math.atan2(th.b.y - th.a.y, th.b.x - th.a.x), { scale: Math.min(1.8, Math.max(0.6, dist(th.a, th.b) / 90)), life: 0.3, glow: 0.5 });
            if (foe) { // STATIC BIND
              foe.status.add('root', 0.6, { source: p });
              cls.shock(p, g, foe, 2);
              p.gainResource(cls.charge.bind);
              g.vfx.text(foe.x, foe.y - (foe.height || 30) - 10, 'STATIC BIND', { color: C, size: 9 });
            }
          }]],
        };
      },
    },
    {
      id: 'tempest_field', tier: 'medium', name: 'Tempest Field', type: 'active', cooldown: 16, cost: 30, targeting: 'point',
      tags: ['zone', 'aoe', 'lightning', 'slow', 'shock', 'speed'], icon: 'tempest_field',
      desc: 'A storm on the ground for 6 s (30 Storm Charge): foes inside take lightning damage every 0.5 s, are SLOWED and SHOCKED each second. Inside it you get TAILWIND (+20% speed) and moving there builds extra charge.',
      cast(p, g, a) {
        const cls = p.cls, pt = aimPoint(p, g, 220);
        return {
          name: 'tempest_field', dur: 0.5, anim: 'tempestField', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.26, () => { g.audio.sfx('shrine'); cls.addField(p, g, pt.x, pt.y); g.vfx.text(pt.x, pt.y - 60, 'TEMPEST FIELD', { color: PALE, size: 10 }); }]],
        };
      },
    },
    {
      slot: 5, id: 'heavens_tempest', tier: 'high', name: 'Heaven\'s Tempest', type: 'ultimate', cooldown: 40, cost: 60, targeting: 'point',
      tags: ['ultimate', 'aoe', 'lightning', 'chain', 'shock', 'thread'], icon: 'heavens_tempest', ultimate: true,
      desc: 'ULTIMATE (60 Storm Charge). A great storm over the target area for 4 s: 9 lightning strikes on the foes inside (shocked ones first), each chaining once; at 2 s every live wire in the storm detonates; then the FINAL THUNDER BURST.',
      cast(p, g, a) {
        const cls = p.cls, T = cls.tempest, pt = aimPoint(p, g, 260);
        const sid = 'heavens_tempest';
        const alive = () => !p.dead && !p.disposed;
        const strike = () => {
          if (!alive()) return;
          const inside = foes(g).filter((m) => dist(m, pt) <= T.r);
          inside.sort((m, n) => (n.status && n.status.has('shock') ? 1 : 0) - (m.status && m.status.has('shock') ? 1 : 0) || Math.random() - 0.5);
          const t = inside[0], x = t ? t.x : pt.x + rand(-T.r, T.r) * 0.6, y = t ? t.y : pt.y + rand(-T.r, T.r) * 0.4;
          g.vfx.bolt(x + rand(-12, 12), y - 240, x, y - 4, { color: CR, width: 3, life: 0.2, jag: 14 });
          g.vfx.sprite('sm_strike', x, y - 40, 0, { scale: 1.1, life: 0.3, glow: 0.6 });
          g.audio.sfx('star');
          g.combat.spawnHitbox({ owner: p, x, y, shape: 'circle', r: 42, power: T.power, type: 'lightning', knock: 60, stagger: 18, hitStop: 0.03, shake: 0.12, skillId: sid, noSkillMods: true,
            onHit: (m) => { cls.shock(p, g, m); } });
          if (t) cls.chainFrom(p, g, t, T.power * 0.6, 1, { skillId: sid });
        };
        return {
          name: 'heavens_tempest', dur: 0.9, anim: 'heavensTempest', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 0.9], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.35);
            g.audio.sfx('ult_charge');
            g.vfx.flash('20,40,110', 0.35, 2);
            g.vfx.ring(pt.x, pt.y, 30, T.r, { life: 0.8, color: CR, width: 2 });
          },
          events: [[0.45, () => {
            g.vfx.sprite('sm_tempest', pt.x, pt.y - 60, 0, { scale: 2.6, life: 0.6, glow: 0.5 });
            g.after(0.5, () => alive() && g.vfx.sprite('sm_tempest', pt.x, pt.y - 60, 0, { scale: 2.6, life: T.dur - 0.4, frame: 3, glow: 0.35, alpha: 0.6 }));
            g.vfx.text(pt.x, pt.y - 120, 'HEAVEN\'S TEMPEST', { color: PALE, size: 14, life: 1.2 });
            g.events.emit('zoneCreated', { owner: p, kind: 'heavens_tempest', x: pt.x, y: pt.y, radius: T.r, duration: T.dur });
            for (let i = 0; i < T.strikes; i++) g.after(0.2 + i * T.every, strike);
            g.after(T.wireAt, () => { if (!alive()) return; const n = cls.burstWires(p, g, cls.wiresNear(p, g, pt.x, pt.y, T.r), 1.3); if (n) g.vfx.text(pt.x, pt.y - 90, `WIRES ×${n}`, { color: PALE, size: 11 }); });
            g.after(T.finalAt, () => {
              if (!alive()) return;
              g.camera.punch(0.25); g.camera.shake(0.6);
              g.vfx.flash('200,230,255', 0.45, 2.5);
              for (let i = 0; i < 6; i++) { const q = (i * TAU) / 6; g.vfx.bolt(pt.x, pt.y - 20, pt.x + Math.cos(q) * T.r, pt.y + Math.sin(q) * T.r * 0.6, { color: CR, width: 2.5, life: 0.3, jag: 16 }); }
              g.vfx.sprite('sm_burst', pt.x, pt.y - 30, 0, { scale: 2.4, life: 0.45, glow: 0.7 });
              g.vfx.ring(pt.x, pt.y, 20, T.r, { life: 0.45, width: 5, color: CR, fill: true });
              g.vfx.text(pt.x, pt.y - 110, 'FINAL THUNDER BURST', { color: '#ffffff', size: 14, life: 1.2 });
              g.audio.sfx('ult_slash');
              g.combat.spawnHitbox({ owner: p, x: pt.x, y: pt.y, shape: 'circle', r: T.r, power: T.finalPower, type: 'lightning', knock: 240, stagger: 70, hitStop: 0.12, shake: 0.5, big: true, skillId: sid, noSkillMods: true,
                onHit: (m) => cls.shock(p, g, m, 3) });
            });
          }]],
        };
      },
    },
  ],

  // ---------------- STORM BURST (Q / right click): spend ALL Storm Charge (30+) in a nova, detonating every live wire
  special: {
    id: 'storm_burst', tier: 'medium', name: 'Storm Burst', type: 'special', slot: 'Q', key: 'Q', icon: 'storm_burst',
    cost: 0, cooldown: 8, targeting: 'self', tags: ['burst', 'aoe', 'lightning', 'consumes-resource', 'thread'],
    requirements: [{ type: 'resource', resource: S, min: 30, label: '30 Storm Charge' }],
    desc: 'Release ALL your Storm Charge (needs 30) in a lightning nova around you — bigger and harder the more you spend (100 = 150 px, 4.2× damage, 2 Shock) — and detonate every live wire you have out.',
    cast(p, g, a) {
      const cls = p.cls;
      return {
        name: 'storm_burst', dur: 0.5, anim: 'stormBurst', moveMul: 0.1, ang: a, cancelAt: 0.3, superArmor: true,
        events: [[0.26, () => {
          const B = cls.burst, spent = p.resources.get(S), k = Math.max(0, Math.min(1, spent / 100));
          p.resources.set(S, 0, 'skill:storm_burst');
          const r = B.r0 + (B.r1 - B.r0) * k, power = B.p0 + B.p1 * k;
          g.audio.sfx('thread_burst');
          g.camera.shake(0.3 + k * 0.4);
          g.vfx.flash(CR, 0.2 + k * 0.2, 4);
          g.vfx.sprite('sm_burst', p.x, p.y - 26, 0, { scale: 0.9 + k * 1.3, life: 0.4, glow: 0.7 });
          g.vfx.ring(p.x, p.y, 10, r, { life: 0.35, width: 4, color: CR, fill: true });
          for (let i = 0; i < 8; i++) { const q = (i * TAU) / 8 + rand(-0.2, 0.2); g.vfx.bolt(p.x, p.y - 20, p.x + Math.cos(q) * r, p.y + Math.sin(q) * r * 0.6, { color: CR, width: 1.8, life: 0.22 }); }
          g.vfx.text(p.x, p.y - 84, `STORM BURST ${Math.round(spent)}`, { color: k >= 0.8 ? '#ffffff' : PALE, size: k >= 0.8 ? 13 : 11 });
          g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 6, shape: 'circle', r, power, type: 'lightning', knock: 150 + 100 * k, stagger: 20 + 40 * k, hitStop: 0.08, shake: 0.3, big: k >= 0.8,
            onHit: (t) => cls.shock(p, g, t, k >= 0.8 ? 2 : 1) });
          const n = cls.burstWires(p, g, g.threads.ofOwner(p).filter((th) => th.type === WIRE), B.wireMult);
          p.resources.set(S, 0, 'skill:storm_burst'); // the wires' own charge does not refill the burst
          g.events.emit('stormBurst', { owner: p, spent, wires: n });
        }]],
      };
    },
  },

  // ---------------- every frame: STORM VELOCITY, Tempest Field
  tick(p, g, dt) {
    const cls = p.cls, v = cls.velocity;
    const last = p.stormLast || { x: p.x, y: p.y };
    const moved = Math.hypot(p.x - last.x, p.y - last.y);
    p.stormLast = { x: p.x, y: p.y };
    if (p.dead || p.downed) return;
    // TEMPEST FIELD
    if (p.zones && p.zones.length) {
      const f = cls.field;
      for (const z of p.zones) {
        if (z.kind !== 'tempest') continue;
        z.t -= dt; z.pulse -= dt; z.shockT -= dt;
        if (z.t > 0 && z.pulse <= 0) {
          z.pulse += f.every;
          const shockNow = z.shockT <= 0;
          if (shockNow) z.shockT += f.shockEvery;
          g.combat.spawnHitbox({ owner: p, x: z.x, y: z.y, shape: 'circle', r: z.r, power: f.power, type: 'lightning', knock: 0, stagger: 3, hitStop: 0, shake: 0, skillId: 'tempest_field', noSkillMods: true,
            onHit: (t) => { if (t.status) t.status.add('slow', f.slow, { source: p }); if (shockNow) cls.shock(p, g, t); } });
          if (Math.random() < 0.8) { const q = rand(0, TAU), rr = rand(0, z.r); g.vfx.bolt(z.x + Math.cos(q) * rr, z.y + Math.sin(q) * rr * 0.6 - 70, z.x + Math.cos(q) * rr, z.y + Math.sin(q) * rr * 0.6, { color: CR, width: 1.2, life: 0.12 }); }
        }
        if (z.t > 0 && dist(p, z) <= z.r) {
          p.status.add('tailwind', 0.3, { source: p, refresh: true });
          if (p.moving && g.combat.inCombat) p.resources.gain(S, f.chargePerSec * dt, { reason: 'tempestField' });
        }
      }
      for (const z of p.zones) if (z.t <= 0) g.events.emit('zoneEnded', { owner: p, kind: z.kind });
      p.zones = p.zones.filter((z) => z.t > 0);
    }
    // STORM VELOCITY (only in a fight; teleports / blinks over 60 px a frame do not count as walking)
    if (!g.combat.inCombat) { p.stormBudget = v.perSec; return; }
    p.stormBudget = Math.min(v.perSec, (p.stormBudget ?? v.perSec) + v.perSec * dt);
    if (p.moving && moved < 60) {
      const want = Math.min(p.stormBudget, moved * v.perPx);
      if (want > 0) { p.stormBudget -= want; p.resources.gain(S, want, { reason: 'moving' }); }
    }
    if (p.idleT > v.stillAfter) {
      p.status.add('still_air', 0.3, { source: p, refresh: true });
      p.resources.drain(S, v.stillDrain * dt, 'stillAir');
    }
  },

  // ---------------- passives: react to core events
  on: {
    playerDodged(p, g, e) { if (e.player === p) p.gainResource(p.cls.charge.dodge); },
    threadTouched(p, g, e) { if (e.owner === p && e.first && e.thread.type === WIRE) p.gainResource(p.cls.charge.wireTouch); },
    resourceTier(p, g, e) {
      if (e.entity !== p || e.resource !== S || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: e.tier >= 2 ? '#ffffff' : PALE, size: e.tier >= 2 ? 13 : 11, life: 1.1 });
      g.vfx.ring(p.x, p.y, 8, 60, { life: 0.4, color: CR, width: 3 });
      for (let i = 0; i < 4; i++) { const q = rand(0, TAU); g.vfx.bolt(p.x, p.y - 20, p.x + Math.cos(q) * 40, p.y - 20 + Math.sin(q) * 30, { color: CR, width: 1.2, life: 0.15 }); }
      g.audio.sfx('mark_full');
      if (e.tier >= 2) g.world.setFlag('tut_marks'); // tutorial step "Reach 80 Storm Charge"
    },
  },
  counterBonus: { resource: 6 }, // data/counter.js
  perfectDodge: { resource: 15, stamina: 10, cooldownCut: 0.8, statuses: [{ id: 'haste', dur: 1.5, mult: 1.3 }] }, // data/dodge.js
};
