// ITEM TRIGGERS — which game event each item trigger listens to (data). items/effectSystem.js subscribes once per
// event name and asks the entry:
//   event   : game event name (game.events), or a list of names
//   who(e, p): the player the event is about (the one whose gear may react); null = not a player event
//             (p = the wearer, for world events that concern everyone present, e.g. a boss phase)
//   ctx(e)  : what the effect / condition may use { target, source, amount, blocked, skillId, perfect, resource }
//   skip?(e, p): true = not this trigger (filters such as "only basic hits", "only mobility skills")
// A new trigger = a new entry here (+ its name in rules.js TRIGGERS). Nothing in combat names an item.
const notDot = (e) => !(e.opts && e.opts.dot);
const fromItem = (e) => !!(e.opts && e.opts.itemEffect); // damage made by an item effect never re-triggers items

export const TRIGGER_EVENTS = {
  onAttack: { event: 'basicAttack', who: (e) => e.player, ctx: (e) => ({ step: e.step }) },
  onHit: {
    event: 'damageDealt', who: (e) => e.source,
    skip: (e) => !notDot(e) || fromItem(e) || e.target === e.source,
    ctx: (e) => ({ target: e.target, amount: e.amount, crit: e.crit, skillId: e.skillId, killed: e.killed }),
  },
  onDamageTaken: {
    event: 'damageTaken', who: (e) => e.target,
    skip: (e) => !notDot(e) || !(e.amount > 0) || e.source === e.target,
    ctx: (e) => ({ source: e.source, amount: e.amount }),
  },
  onBlock: { event: 'guardBlocked', who: (e) => e.player, ctx: (e) => ({ source: e.source, blocked: e.blocked || 0 }) },
  onPerfectGuard: { event: 'perfectGuard', who: (e) => e.player, ctx: (e) => ({ source: e.source, blocked: e.blocked || 0, perfect: true }) },
  onSkillCast: { event: 'skillUsed', who: (e) => e.caster, ctx: (e) => ({ skillId: e.skillId, skill: e.skill }) },
  onSkillHit: {
    event: 'skillHit', who: (e) => e.source, skip: (e) => fromItem(e),
    ctx: (e) => ({ target: e.target, amount: e.amount, skillId: e.skillId }),
  },
  onKill: { event: 'enemyKilled', who: (e) => e.source, skip: (e) => fromItem(e), ctx: (e) => ({ target: e.target }) },
  onDodge: { event: 'playerDodged', who: (e) => e.player, ctx: () => ({}) },
  // a dash = casting a skill tagged 'dash' or 'mobility' (skill data tags)
  onDash: {
    event: 'skillUsed', who: (e) => e.caster,
    skip: (e) => !(e.skill && (e.skill.tags || []).some((t) => t === 'dash' || t === 'mobility')),
    ctx: (e) => ({ skillId: e.skillId, skill: e.skill }),
  },
  // a taunt = the status 'taunted' put on (or renewed on) a foe by this player (any class, any skill)
  onTaunt: {
    event: ['statusApplied', 'statusRefreshed'], who: (e) => e.source, skip: (e) => e.id !== 'taunted' || e.target === e.source,
    ctx: (e) => ({ target: e.target }),
  },
  onBarrierCreated: { event: 'barrierCreated', who: (e) => e.owner, ctx: (e) => ({ target: e.target || e.owner, amount: e.amount }) },
  // resources: stamina is ignored (every dodge would fire it); item gains never re-trigger (reason 'item')
  onResourceGain: {
    event: 'resourceChanged', who: (e) => e.entity,
    skip: (e) => e.resource === 'stamina' || e.reason === 'item' || !(e.value > e.before),
    ctx: (e) => ({ resource: e.resource, amount: e.value - e.before }),
  },
  onResourceSpend: {
    event: 'resourceChanged', who: (e) => e.entity,
    skip: (e) => e.resource === 'stamina' || e.reason === 'item' || !(e.value < e.before),
    ctx: (e) => ({ resource: e.resource, amount: e.before - e.value }),
  },
  // low HP = a hit that takes HP from above the line to below it (line = the effect's hpBelow condition, else 30%)
  onLowHP: {
    event: 'damageTaken', who: (e) => e.target, skip: (e) => !(e.amount > 0),
    ctx: (e) => ({ source: e.source, amount: e.amount, crossing: true }),
  },
  // I1 ---------------------------------------------------------------------------------------------------------
  // a critical hit by the wearer (same filters as onHit)
  onCrit: {
    event: 'damageDealt', who: (e) => e.source,
    skip: (e) => !e.crit || !notDot(e) || fromItem(e) || e.target === e.source,
    ctx: (e) => ({ target: e.target, amount: e.amount, crit: true, skillId: e.skillId }),
  },
  // the class resource reaching its maximum (once per fill: only the gain that crosses the top counts)
  onFullResource: {
    event: 'resourceChanged', who: (e) => e.entity,
    skip: (e, p) => e.resource === 'stamina' || e.reason === 'item' || !(e.value > e.before) || !p.resources || e.value < p.resources.max(e.resource) || e.before >= p.resources.max(e.resource),
    ctx: (e) => ({ resource: e.resource, amount: e.value - e.before }),
  },
  // a status the wearer put on someone else (bleed, shock, a mark-like debuff ...); statusIs / targetHasStatus filter it
  onStatusApplied: {
    event: 'statusApplied', who: (e) => e.source, skip: (e) => e.target === e.source,
    ctx: (e) => ({ target: e.target, statusId: e.id }),
  },
  // a boss the wearer is fighting enters a new phase (local game: the boss of the map you are on)
  onBossPhase: { event: 'bossPhaseChanged', who: (e, p) => p, ctx: (e) => ({ bossId: e.bossId, phase: e.phase }) },
};
export const LOW_HP_DEFAULT = 0.3;

// safety limits for every item effect (effectSystem.js)
export const EFFECT_LIMITS = {
  maxPerSecond: 8, // one effect may fire at most this often, whatever its cooldown says
  reflectMaxHpShare: 0.5, // reflected damage <= 50% of the wearer's max HP per hit
  healMaxShare: 0.3, // one heal <= 30% max HP
  barrierMaxShare: 0.5, // one barrier <= 50% max HP
  resourceMax: 50, // one gain <= 50 resource
  cooldownCutMax: 10, // one cooldown cut <= 10 s
  nextHitMax: 1, // next-hit bonus <= +100%
  durationMax: 30, // temporary effects last <= 30 s
};
