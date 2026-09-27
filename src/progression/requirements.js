// REQUIREMENTS — generic, data-driven unlock conditions (class progression today; secret events,
// hidden quests, rare unlocks tomorrow). Pure: every check reads a plain context object, so the same
// rules run in unit tests and, later, on a server.
//
// ctx: { level, classId, questsDone: Set, flags: {}, items: (id) => count, secrets: number,
//        records: { counterId: value } (for the class being checked), trialsPassed: Set }
// Each evaluator returns { met, have, need, label } — have/need drive progress bars in the UI.
// Types (spec §25): level · quest (incl. hidden quests) · flag (world / exploration / secret conditions)
//   counter (achievement / class record) · item · secrets (exploration) · trial · class · any · all
import { CLASS_COUNTERS } from '../data/classTree.js';

const num = (v) => (Number.isFinite(v) ? v : 0);

export const REQUIREMENT_TYPES = {
  level: (r, ctx) => ({ met: num(ctx.level) >= r.min, have: num(ctx.level), need: r.min, label: r.label || `Reach level ${r.min}` }),
  quest: (r, ctx) => ({ met: !!(ctx.questsDone && ctx.questsDone.has(r.id)), label: r.label || `Complete quest: ${r.id}` }),
  flag: (r, ctx) => ({ met: !!(ctx.flags && ctx.flags[r.flag]), label: r.label || r.flag }),
  counter: (r, ctx) => {
    const have = num(ctx.records && ctx.records[r.counter]);
    const def = CLASS_COUNTERS[r.counter];
    return { met: have >= r.min, have, need: r.min, label: r.label || `${def ? def.label : r.counter}: ${r.min}` };
  },
  item: (r, ctx) => {
    const have = num(ctx.items ? ctx.items(r.item) : 0), need = r.count || 1;
    return { met: have >= need, have, need, label: r.label || `Own ${need}× ${r.item}` };
  },
  secrets: (r, ctx) => ({ met: num(ctx.secrets) >= r.min, have: num(ctx.secrets), need: r.min, label: r.label || `Discover ${r.min} secret areas` }),
  trial: (r, ctx) => ({ met: !!(ctx.trialsPassed && ctx.trialsPassed.has(r.trial)), label: r.label || 'Pass the class trial' }),
  class: (r, ctx) => ({ met: ctx.classId === r.id, label: r.label || `Be a ${r.id}` }),
  any: (r, ctx) => { const sub = (r.of || []).map((x) => evaluate(x, ctx)); return { met: sub.some((s) => s.met), label: r.label || sub.map((s) => s.label).join(' OR '), sub }; },
  all: (r, ctx) => { const sub = (r.of || []).map((x) => evaluate(x, ctx)); return { met: sub.length > 0 && sub.every((s) => s.met), label: r.label || sub.map((s) => s.label).join(' AND '), sub }; },
};

// unknown types never pass (a typo must not unlock a secret class)
export function evaluate(req, ctx) {
  const fn = req && REQUIREMENT_TYPES[req.type];
  if (!fn) return { met: false, label: `Unknown requirement "${req && req.type}"`, unknown: true };
  const r = fn(req, ctx || {});
  // secret conditions: the text stays hidden until met
  if (req.hidden && !r.met) return { ...r, label: '??? (a hidden condition)', hidden: true };
  return r;
}
export const evaluateAll = (reqs, ctx) => (reqs || []).map((r) => evaluate(r, ctx));
export const allMet = (reqs, ctx) => evaluateAll(reqs, ctx).every((r) => r.met);

// does an event payload match a counter's filter? ('$player' = the player; dotted paths allowed)
export function matches(match, data, player) {
  for (const [path, want] of Object.entries(match || {})) {
    let v = data;
    for (const k of path.split('.')) v = v == null ? undefined : v[k];
    const expected = want === '$player' ? player : want;
    if (v !== expected) return false;
  }
  return true;
}
