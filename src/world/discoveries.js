// EXPLORATION COUNTER — how much of a map you have found: every chest, lore tablet and secret area placed on it, plus the
// hidden rewards its map mechanic knows about (MapMechanic.discoveries(): a hoard chest that only appears later, the
// drowned chest / stair under the lake ...). Counted for the CURRENT map (only its grid is loaded) and remembered per map
// in world.state.discover[mapId] = [found, total] (saved), so the world map can show maps you are not on ("?" = never
// visited). Pure counting: `countDiscoveries(world, mapId)`.
export function countDiscoveries(w, mapId) {
  const st = w.state, seenSecret = new Set();
  let found = 0, total = 0;
  const add = (ok) => { total++; if (ok) found++; };
  for (const it of w.interactables) {
    if (it.kind === 'mech' || !w.onMap(it.npc || it)) continue;
    if (it.kind === 'chest') add(!!st.chests[it.id]);
    else if (it.kind === 'lore') add(!!st.lore[it.lore]);
    if (it.secret && !seenSecret.has(it.secret)) { seenSecret.add(it.secret); add(w.secretsFound.has(it.secret)); }
  }
  if (w.mapMech && w.mapMech.mapId === mapId) for (const m of w.mapMech.list) for (const d of m.discoveries()) add(!!d.found);
  return { found, total };
}

export class DiscoverySystem {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }
  // every second while playing (cheap: one pass over the loaded interactables)
  update(dt) {
    const w = this.game.world;
    if (!w || !w.mapId || (this.t -= dt) > 0) return;
    this.t = 1;
    const { found, total } = countDiscoveries(w, w.mapId);
    const all = w.state.discover || (w.state.discover = {});
    const prev = all[w.mapId];
    if (!prev || prev[0] !== found || prev[1] !== total) {
      all[w.mapId] = [found, total];
      if (prev && found > prev[0] && found === total && total > 0) this.game.ui.banner('FULLY EXPLORED', `${w.mapDef.name}: every secret found`, '#ffe08a');
    }
  }
  // [found, total] for a map, or null when never counted (not visited yet)
  of(mapId) { const d = this.game.world.state.discover; return (d && d[mapId]) || null; }
}
