import { TILE } from '../core/constants.js';

// SPAWN DENSITY (owner 2026-09-29: more monsters per map, so EXP comes from exploring forward, not from farming the same
// spot). Rules in data/difficulty.js (spawnDensity). Runs once when a grid is built (World.buildGrid), deterministic
// (seeded), so the same map always gets the same extra packs:
//   1) some ordinary packs of 2+ (chance `packChance`) get `packBonus` more monsters (packs stay readable: +1, not doubled);
//   2) NEW packs fill the rest up to `density` × the map's ordinary monsters: a copy of a nearby pack (same monster
//      types, one smaller) placed on open ground 7-14 tiles away, in the SAME map and zone, never near another pack.
// Tutorial, unique, elite and boss spawns are never touched.

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const ordinary = (d) => !d.tutorial && !d.unique && !d.elite && d.type !== 'guardian' && !d.extra;

// spawnPoints: [{ def }] of one grid · map: WorldMap · mapAt(x, y) -> map id · rules: DIFFICULTY.spawnDensity
// -> the new spawn points (the pack bonus is applied in place)
export function densify(spawnPoints, map, mapAt, rules, seed = 1) {
  if (!rules || !(rules.density > 1)) return [];
  const rand = rng(seed * 7919 + 17);
  const base = spawnPoints.filter((sp) => ordinary(sp.def));
  const perMap = {};
  for (const sp of base) { const id = mapAt(sp.def.x, sp.def.y) || '?'; (perMap[id] = perMap[id] || []).push(sp); }
  const out = [];
  const taken = spawnPoints.map((sp) => ({ x: sp.def.x, y: sp.def.y }));
  for (const [mapId, list] of Object.entries(perMap)) {
    const total = list.reduce((s, sp) => s + sp.def.count, 0);
    // only SOME packs grow (packChance), so most of the extra monsters arrive as new packs spread over the map
    for (const sp of list) if (sp.def.count >= 2 && rand() < (rules.packChance ?? 1)) sp.def = { ...sp.def, count: sp.def.count + (rules.packBonus || 0) };
    let want = Math.round(total * rules.density) - list.reduce((s, sp) => s + sp.def.count, 0);
    for (let tries = 0; want > 0 && tries < list.length * 12; tries++) {
      const src = list[Math.floor(rand() * list.length)].def;
      const a = rand() * Math.PI * 2, r = (rules.minDist + rand() * (rules.maxDist - rules.minDist)) * TILE;
      const x = Math.round((src.x + Math.cos(a) * r) / TILE - 0.5) * TILE + TILE / 2, y = Math.round((src.y + Math.sin(a) * r) / TILE - 0.5) * TILE + TILE / 2;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (tx < 1 || ty < 1 || tx >= map.w - 1 || ty >= map.h - 1) continue;
      let open = true; // 3×3 open ground, not a one-tile nook
      for (let oy = -1; oy <= 1 && open; oy++) for (let ox = -1; ox <= 1; ox++) if (map.isTerrainSolid(tx + ox, ty + oy)) { open = false; break; }
      if (!open || mapAt(x, y) !== mapId || map.zoneAt(x, y) !== map.zoneAt(src.x, src.y)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < rules.gap * TILE)) continue;
      const count = Math.max(1, Math.min(want, src.count - 1));
      const def = { ...src, x, y, count, extra: true };
      delete def.id; delete def.tx; delete def.ty;
      out.push({ def, alive: [], respawnT: 0, active: false });
      taken.push({ x, y });
      want -= count;
    }
  }
  return out;
}
