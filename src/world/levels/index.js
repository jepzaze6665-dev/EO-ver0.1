import { WHISPERING } from './whispering.js';
import { ANCIENT_VALLEY } from './ancientValley.js';

// LEVELS (grids) — every playable map lives on one grid: its own tile map + everything placed on it.
// Only ONE grid is loaded at a time (world/world.js enterGrid): walking through an exit to a map on another grid
// unloads the current grid (monsters, projectiles, effects, render cache) and loads the other one.
// Maps name their grid in maps/*.js (`grid`). Several maps may share a grid (Lumina + the forest + ...).
//
//  id, name
//  size     : [width, height] in tiles — each grid chooses its own (A1 / A2 / A3 are kept close to each other)
//  seed     : decoration RNG seed
//  generate : (builder) -> paints the terrain, zones, sub-areas, props, spawns, NPCs, lights (maps/*.js builders)
//  setup    : (world, level) -> objects created once when the grid is first built (breakables, dummies, ...)
//  apply    : (world) -> world flags change this grid's terrain / props (idempotent, runs from World.applyState)
//  skin     : ground art for this grid (maps/tileSkins.js, built by tools/build-tiles.js); none = painted tiles
//  landmarks: [[name, tx, ty]] minimap / world map markers (name = a sub-area: shown once that area was discovered)
// A new grid = one module + one line here + maps naming it. The World never names a grid.
export const LEVELS = { whispering: WHISPERING, ancient_valley: ANCIENT_VALLEY };
export const START_GRID = 'whispering';
