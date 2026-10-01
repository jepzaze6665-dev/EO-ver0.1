// SAVE DATA (pure) — the save format, its versions and its checks. No DOM, no storage, no game loop:
// the SaveSystem builds a snapshot from the game (snapshot()), this file parses / migrates / validates it.
//
// Format v3: { v, savedAt, playTime,
//   player: { classId, level, exp, gold, hp, resources, loadout, map, x, y },
//   inventory, equipment, quests, progression, world (flags, maps, hidden, ...), knowledge, stats }
// v4 (Skill System S1): + classProgress { active, classes: { id: { level, exp, mastery, loadout, skills } } }
// v5 (Item System G1): gear is kept as instances — inventory { items, storage, gear, storageGear, nextInstance },
//   equipment { weapon, armor, accessory, inst }. Older gear counts become instances in Inventory.load.
export const SAVE_VERSION = 5;

// older formats -> current. v1 (V1 / V2 saves): no map (the loader finds it from the position) + no hidden state.
const MIGRATIONS = {
  1: (d) => ({ ...d, v: 2, player: { ...d.player, map: d.player.map || null }, world: { maps: {}, hidden: {}, ...(d.world || {}) } }),
  2: migrateV2,
  // v3 -> v4: the current class's loadout becomes its classProgress entry (other classes start empty)
  3: (d) => ({ ...d, v: 4, classProgress: d.classProgress || { active: d.player.classId || null,
    classes: d.player.classId ? { [d.player.classId]: { level: 1, exp: 0, mastery: 0, loadout: d.player.loadout || null, skills: {} } } : {} } }),
  // v4 -> v5: same sections; Inventory.load turns the old gear counts into instances (one per copy)
  4: (d) => ({ ...d, v: 5 }),
};

// v2 -> v3 (W2 world restructure): the old A1 / A2 / A3 maps are ONE map A1; the Guardian became the A1 boss and the old
// A1 / A2 bosses optional mini-bosses; City 2 Valehaven became the secret city; 'ashen' (W1) is now A2.
export const V3_BOSS_IDS = { boss_a1: 'mini_hollow_fang', boss_a2: 'mini_grukk', boss_a3: 'boss_a1', boss_ashen: 'boss_a2' };
export const V3_MAP_IDS = { a2: 'a1', a3: 'a1', city2: 'valehaven', ashen: 'a2' };
function migrateV2(d) {
  const renameKeys = (o, table) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [table[k] || k, v]));
  const wp = d.worldProgress || null;
  const world = d.world || {};
  // route_a objectives changed: its progress starts over (flags / boss kills tick the new objectives again)
  const quests = d.quests ? { ...d.quests, active: { ...(d.quests.active || {}) } } : d.quests;
  if (quests && quests.active.route_a) quests.active.route_a = { progress: {}, done: {} };
  return {
    ...d, v: 3,
    player: { ...d.player, map: V3_MAP_IDS[d.player.map] || d.player.map },
    world: { ...world, maps: renameKeys(world.maps, V3_MAP_IDS) },
    quests,
    worldProgress: wp && {
      ...wp,
      defeatedBosses: renameKeys(wp.defeatedBosses, V3_BOSS_IDS),
      unlockedMaps: {}, // recomputed from the map requirements on load
    },
  };
}

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
      classProgress: section(d.classProgress),
      playTime: num(d.playTime, 0, 1e9, 0),
    },
  };
}
