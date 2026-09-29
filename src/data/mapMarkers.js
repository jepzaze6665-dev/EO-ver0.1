// MAP MARKERS (owner 2026-09-29: "remove the marks on the map — players should explore on their own").
// Read by ui/hud.js markers() (minimap + world map). Presentation only; quests still track objectives in the tracker text.
export const MAP_MARKERS = {
  questTarget: false,   // the yellow quest diamond (and its arrow clamped to the minimap edge)
  bosses: 'seen',       // 'always' | 'seen' (only once you have seen its arena: fog revealed there) | 'never'
  edgeArrows: false,    // markers of things outside the minimap view pinned to its edge
  npcs: true,           // people you can talk to (the "!" colour for news)
  waystones: true,      // waystones you have activated
  chests: true,         // chests you have already seen (revealed ground)
  landmarks: true,      // named places you have already discovered
};
