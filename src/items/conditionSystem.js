// ITEM CONDITIONS (pure) — the "IF" of an item effect: { type, value, ... } -> true / false.
// Every condition is one small function here; a new condition = a new entry (+ its name in data/items/rules.js).
//   p   : the wearer (reads hp / maxHp / resources / primaryResource)
//   ctx : what the trigger saw (data/items/triggers.js ctx: target, source, amount, perfect, ...)
//   env : what only the game knows { marks?: (entity, markId) -> stacks, inCombat?: bool }
const hpRatio = (p) => (p.maxHp ? p.hp / p.maxHp : 1);
const resourceOf = (p, c) => {
  const id = !c.resource || c.resource === 'primary' ? p.primaryResource : c.resource;
  return p.resources && p.resources.has(id) ? p.resources.get(id) : 0;
};

export const CONDITION_CHECKS = {
  hpBelow: (c, p) => hpRatio(p) < c.value,
  hpAbove: (c, p) => hpRatio(p) > c.value,
  resourceAbove: (c, p) => resourceOf(p, c) > c.value, // absolute amount ("Resource > 80")
  resourceBelow: (c, p) => resourceOf(p, c) < c.value,
  // the trigger's target carries a mark (c.mark = mark id; none = any mark)
  targetHasMark: (c, p, ctx, env) => {
    if (!ctx.target || !env.marks) return false;
    return c.mark ? env.marks(ctx.target, c.mark) > 0 : env.marks(ctx.target, null) > 0;
  },
  perfectGuard: (c, p, ctx) => !!ctx.perfect,
  inCombat: (c, p, ctx, env) => !!env.inCombat === (c.value !== false),
};

// no condition = always true; an unknown condition type = false (bad data never fires)
export function checkCondition(cond, p, ctx = {}, env = {}) {
  if (!cond) return true;
  const fn = CONDITION_CHECKS[cond.type];
  return fn ? !!fn(cond, p, ctx, env) : false;
}
