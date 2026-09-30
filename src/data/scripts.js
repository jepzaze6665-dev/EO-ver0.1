// VOID SCRIPT DATA (Void Scribe) — what a script written on the ground does. The class code only reads this table:
// a new script effect = a new entry here (+ its status in data/statuses.js), no code change.
//  label   : shown over the glyph when it is written / rewritten
//  color   : 'r,g,b' of its pulse ring
//  next    : what REWRITE turns it into (the cycle Ruin -> Bind -> Hush -> Ruin)
//  pulse   : every SCRIPT_RULES.every s, to each foe inside: void damage `power` (× caster ATK) + `status` for `statusTime`
//            (`stacks` for stacking statuses); `bossStatus: false` = bosses ignore the status (control on bosses)
export const SCRIPTS = {
  ruin: { id: 'ruin', label: 'RUIN', color: '200,80,255', next: 'bind', pulse: { power: 0.3, status: 'void_rot', statusTime: 4, stacks: 1 } },
  bind: { id: 'bind', label: 'BIND', color: '120,140,255', next: 'hush', pulse: { power: 0.12, status: 'slow', statusTime: 0.8 } },
  hush: { id: 'hush', label: 'HUSH', color: '255,90,200', next: 'ruin', pulse: { power: 0.12, status: 'silence', statusTime: 0.8, bossStatus: false } },
};
export const SCRIPT_RULES = {
  first: 'ruin',   // a freshly written script
  max: 3,          // per caster: the oldest fades when a 4th is written
  radius: 55, duration: 8, every: 0.5,
};
