// SAVE DATA (pure) — the save format, its versions and its checks. No DOM, no storage, no game loop:
// the SaveSystem builds a snapshot from the game (snapshot()), this file parses / migrates / validates it.
//
// Format v2: { v, savedAt, playTime,
//   player: { classId, level, exp, gold, hp, resources, loadout, map, x, y },
//   inventory, equipment, quests, progression, world (flags, maps, hidden, ...), knowledge, stats }
export const SAVE_VERSION = 2;

// older formats -> current. v1 (V1 / V2 saves): no map (the loader finds it from the position) + no hidden state.
const MIGRATIONS = {
  1: (d) => ({ ...d, v: 2, player: { ...d.player, map: d.player.map || null }, world: { maps: {}, hidden: {}, ...(d.world || {}) } }),
};

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const num = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

// text -> { ok, data?, error? }  (never throws)
export function parseSave(text) {
  if (!text) return { ok: false, error: 'empty' };
  let d;
  try { d = JSON.parse(text); } catch (e) { return { ok: false, error: 'corrupt JSON' }; }
  if (!isObj(d) || !isObj(d.player)) return { ok: false, error: 'missing player' };
  let v = d.v || 1;
  if (v > SAVE_VERSION) return { ok: false, error: `save v${v} is newer than this game (v${SAVE_VERSION})` };
  while (v < SAVE_VERSION) { d = MIGRATIONS[v](d); v = d.v; }
  return validate(d);
}

// repairs what can be repaired (numbers out of range, missing sections), rejects what cannot
export function validate(d) {
  const p = d.player;
  if (typeof p.classId !== 'string' || !p.classId) return { ok: false, error: 'missing class' };
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { ok: false, error: 'missing position' };
  const player = {
    ...p,
    level: Math.floor(num(p.level, 1, 999, 1)), // the level rules clamp further on load (player.setLevel)
    exp: num(p.exp, 0, 1e9, 0),
    gold: Math.floor(num(p.gold, 0, 1e9, 0)),
    hp: num(p.hp, 1, 1e7, 0) || null,
  };
  const section = (o) => (isObj(o) ? o : {});
  return {
    ok: true,
    data: {
      ...d, player,
      inventory: section(d.inventory), equipment: section(d.equipment), quests: section(d.quests),
      progression: section(d.progression), world: section(d.world), knowledge: section(d.knowledge), stats: section(d.stats),
      playTime: num(d.playTime, 0, 1e9, 0),
    },
  };
}
