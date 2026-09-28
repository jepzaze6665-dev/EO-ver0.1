import { T, TILE } from '../core/constants.js';
import { makeCanvas, Assets } from '../core/assets.js';

// TILE SKINS — a grid can dress its ground in textures cut from the owner's tileset sheets (tools/build-tiles.js ->
// assets/tiles/<skin>.png + tiles.json). A skinned tileset = the painted base tileset (maps/tiles.js) with the skin's
// tile types (and wall faces) swapped in; every type the skin does not name keeps its painted texture, so edge
// blending, alt palettes and masks keep working. No skin file = the base tileset (the game still runs).
const cache = {};
export function skinnedTileset(base, skinId) {
  if (!skinId) return base;
  if (cache[skinId] && cache[skinId].base === base) return cache[skinId].ts;
  const sk = Assets.tiles[skinId];
  if (!sk || !sk.img) return base;
  const cut = (row) => Array.from({ length: sk.variants }, (_, v) => {
    const c = makeCanvas(TILE, TILE);
    c.getContext('2d').drawImage(sk.img, v * sk.tile, row * sk.tile, sk.tile, sk.tile, 0, 0, TILE, TILE);
    return c;
  });
  const tex = { ...base.tex }, faces = { ...base.faces };
  for (const [name, row] of Object.entries(sk.rows)) {
    if (name.startsWith('face:')) faces[name.slice(5)] = cut(row);
    else if (T[name] !== undefined) tex[T[name]] = cut(row);
  }
  const ts = { ...base, tex, faces, skin: skinId };
  cache[skinId] = { base, ts };
  return ts;
}
