// In-game map overview (console / tests): draws the loaded grid — tiles, props, NPCs (yellow), exits (cyan) — into
// one canvas, S px per tile. Handy to judge a whole map's layout at once (the game camera only shows ~12 × 9 tiles).
//   const O = await import('/tools/mapOverview.js'); O.show(__game, 4)   // overlay on the page (click it to close)
export function render(g, S = 4) {
  const m = g.world.map, ts = m.tileset, f = S / 32;
  const c = document.createElement('canvas');
  c.width = m.w * S; c.height = m.h * S;
  const x2 = c.getContext('2d');
  const texOf = (t) => { const v = ts.tex[t]; return Array.isArray(v) ? v[0] : v; };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const im = texOf(m.tiles[y * m.w + x]);
    if (im) x2.drawImage(im, 0, 0, im.width, im.height, x * S, y * S, S, S);
    else { x2.fillStyle = '#f0f'; x2.fillRect(x * S, y * S, S, S); }
  }
  const props = m.props.filter((p) => p.def && p.visible)
    .sort((a, b) => (a.layer === 'ground' ? 0 : 1) - (b.layer === 'ground' ? 0 : 1) || a.y - b.y);
  for (const p of props) {
    const d = p.def, sc = (p.scale || 1) * f, w = d.w * sc, h = d.h * sc;
    x2.save(); x2.translate(p.x * f, p.y * f); if (p.flip) x2.scale(-1, 1);
    x2.drawImage(d.img, d.x, d.y, d.w, d.h, -w / 2, -h, w, h);
    x2.restore();
  }
  for (const n of g.world.npcs || []) { x2.fillStyle = '#ff0'; x2.fillRect(n.x * f - 2, n.y * f - 2, 4, 4); }
  const def = g.world.mapDef;
  for (const e of (def && def.exits) || []) { const [a, b, cc, d] = e.rect; x2.strokeStyle = '#0ff'; x2.strokeRect(a * S, b * S, (cc - a + 1) * S, (d - b + 1) * S); }
  return c;
}
export function show(g, S = 4, size = 600) {
  const c = render(g, S);
  let el = document.getElementById('map-overview');
  if (!el) {
    el = document.createElement('img'); el.id = 'map-overview';
    el.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${size}px;height:${size}px;image-rendering:pixelated;cursor:pointer`;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }
  el.src = c.toDataURL();
  return { w: c.width, h: c.height };
}
export function hide() { const el = document.getElementById('map-overview'); if (el) el.remove(); }
