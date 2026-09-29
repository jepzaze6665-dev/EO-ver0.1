// Asset loading. Sprite sheets are plain PNG + JSON atlas files so real art can
// replace any placeholder simply by dropping in a sheet with the same layout.
export const Assets = {
  images: {},
  data: {},
  props: {}, // name -> {img, x, y, w, h}
  vfx: {}, // name -> {img, fw, fh, frames} (skill effect strips, right-facing)
  ui: {}, // name -> {img, w, h, slice?, file} (UI kit built by tools/build-ui.js: frames, buttons, slots, boss bar)
  tiles: {}, // skin -> {img, tile, variants, rows} (ground skins built by tools/build-tiles.js, used per grid)
};

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

export async function loadJSON(src) {
  const r = await fetch(src);
  if (!r.ok) throw new Error('Failed to load ' + src);
  return r.json();
}

// class presets (character sheets). Each preset = one atlas built by tools/build-player.js
export const PLAYER_PRESETS = { ub: 'assets/player/atlas.json', aw: 'assets/player/aw/atlas.json', ag: 'assets/player/ag/atlas.json', rp: 'assets/player/rp/atlas.json', dr: 'assets/player/dr/atlas.json', be: 'assets/player/be/atlas.json', wd: 'assets/player/wd/atlas.json', bs: 'assets/player/bs/atlas.json' };

export async function loadAll(onProgress) {
  Assets.data.atlases = {};
  for (const [key, src] of Object.entries(PLAYER_PRESETS)) Assets.data.atlases[key] = await loadJSON(src);
  Assets.data.playerAtlas = Assets.data.atlases.ub; // v1 alias
  const propMeta = await loadJSON('assets/props/props.json');
  const vfxMeta = await loadJSON('assets/vfx/vfx.json');
  // boss effects (tools/build-boss-vfx.js), same strip format; optional
  Object.assign(vfxMeta, await loadJSON('assets/vfx/boss.json').catch(() => ({})));
  const uiMeta = await loadJSON('assets/ui/ui.json');
  // monster sheets (tools/build-monsters.js); optional: without it every monster keeps its canvas placeholder
  Assets.data.monsters = await loadJSON('assets/monsters/monsters.json').catch(() => ({}));
  const tileMeta = await loadJSON('assets/tiles/tiles.json').catch(() => ({})); // optional too: painted tiles stay
  const jobs = [];
  for (const [key, atlas] of Object.entries(Assets.data.atlases)) for (const [name, s] of Object.entries(atlas.sheets)) jobs.push([`player_${key}_${name}`, s.file]);
  jobs.push(['props', 'assets/props/props.png']);
  for (const [name, v] of Object.entries(vfxMeta)) jobs.push(['vfx_' + name, v.file]);
  for (const [name, v] of Object.entries(uiMeta)) jobs.push(['ui_' + name, v.file]);
  for (const [name, v] of Object.entries(Assets.data.monsters)) jobs.push(['monster_' + name, v.file]);
  for (const [name, v] of Object.entries(tileMeta)) jobs.push(['tiles_' + name, v.file]);
  let done = 0;
  await Promise.all(
    jobs.map(async ([key, src]) => {
      Assets.images[key] = await loadImage(src);
      done++;
      onProgress && onProgress(done / jobs.length);
    })
  );
  for (const [name, v] of Object.entries(vfxMeta)) Assets.vfx[name] = { ...v, img: Assets.images['vfx_' + name] };
  for (const [name, v] of Object.entries(uiMeta)) Assets.ui[name] = { ...v, img: Assets.images['ui_' + name] };
  for (const [name, v] of Object.entries(tileMeta)) Assets.tiles[name] = { ...v, img: Assets.images['tiles_' + name] };
  const pimg = Assets.images.props;
  for (const [name, [x, y, w, h]] of Object.entries(propMeta)) Assets.props[name] = { img: pimg, x, y, w, h };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}
