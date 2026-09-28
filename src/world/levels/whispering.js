import { TILE, T } from '../../core/constants.js';
import { Assets } from '../../core/assets.js';
import { Breakable } from '../../exploration/breakable.js';
import { TrainingDummy } from '../../entities/trainingDummy.js';
import { buildWhisperingTerrain } from '../../maps/worldGen.js';

// WHISPERING grid — the original connected world (Lumina, the forest, ruins, Guardian Arena, Valehaven).
// Everything here is specific to this grid's terrain; the World calls it through the level hooks
// (world/levels/index.js): generate (terrain), setup (objects placed once), apply (world flags -> terrain / props).
export const WHISPERING = {
  id: 'whispering', name: 'Whispering Forest', size: [168, 208], seed: 1337,
  generate: buildWhisperingTerrain,

  // breakable secrets, the training yard, examine prompts
  setup(w, L) {
    const g = w.game, pb = L.propById;
    L.interactables.push({ id: 'crack_info', kind: 'crackInfo', x: 70.5 * TILE, y: 55.6 * TILE, radius: 40, prompt: 'Examine Cracked Stone' });
    L.interactables.push({ id: 'glyph_info', kind: 'glyphInfo', x: 150.4 * TILE, y: 109.5 * TILE, radius: 40, prompt: 'Examine Glyph' });
    L.breakables.push(new Breakable(g, 70.5 * TILE, 55 * TILE - 8, {
      kind: 'crack', hp: 70, radius: 22, height: 50, prop: pb.cave_crack,
      canHit: () => !w.state.flags.caveOpened,
      onBreak: () => { w.setFlag('caveOpened'); w.applyState(); w.discoverSecret(1, 'HIDDEN CAVE'); },
    }));
    L.breakables.push(new Breakable(g, 150.6 * TILE, 109 * TILE, {
      kind: 'glyph', hp: 60, radius: 22, height: 50, prop: pb.archive_glyph,
      canHit: () => !w.state.flags.archiveOpened,
      onBreak: () => { w.setFlag('archiveOpened'); w.applyState(); w.discoverSecret(4, 'SEALED ARCHIVE'); },
    }));
    L.breakables.push(new Breakable(g, 68.5 * TILE, 147 * TILE, {
      kind: 'bramble', hp: 40, radius: 40, height: 30, prop: pb.bramble_prop,
      canHit: () => !w.state.flags.bramble && g.player.y < 147.6 * TILE,
      onBreak: () => { w.setFlag('bramble'); w.applyState(); g.ui.banner('SHORTCUT OPENED', 'Bramble Lane → Lumina Village', '#ffd98a'); },
    }));
    // training yard beside the Adventurer Guild (class / combat testing)
    L.dummies = [[29, 186], [32, 187.5], [35, 186]].map(([tx, ty]) => {
      const pos = L.map.findOpen(tx * TILE, ty * TILE, 3);
      return new TrainingDummy(g, pos.x, pos.y);
    });
  },

  // world flags -> this grid's terrain / props (idempotent; World.applyState runs it while the grid is loaded)
  apply(w) {
    const f = w.state.flags, m = w.map, R = w.regions, pb = w.propById;
    const restored = !!f.guardianDefeated;
    if (m.style.restored !== restored) { m.style.restored = restored; m.invalidate(); }
    for (const p of m.props) {
      if (p.corruptOnly) p.visible = !restored;
      if (p.restoredOnly) p.visible = restored;
      if (p.corruptVariant) { const n = restored ? p.restoredVariant : p.corruptVariant; if (p.name !== n) { p.name = n; p.def = Assets.props[n]; } }
      if (p.secret) p.visible = m.secretsFound.has(p.secret);
    }
    // valley barrier
    const vb = R.valleyBarrier;
    m.setBlockRect(vb.tx0, vb.ty0, vb.tx1, vb.ty1, !restored);
    // shortcuts
    const lb = R.logBridge;
    if (f.logBridge) {
      for (let y = lb.ty0; y <= lb.ty1; y++) for (let x = lb.tx0; x <= lb.tx1; x++) {
        const t = m.get(x, y);
        if (t === T.WATER || t === T.DEEP_WATER || t === T.SAND) m.set(x, y, T.BRIDGE);
      }
      // the fallen log reaches both banks (the rows just outside the water were left as rock)
      for (const y of [lb.ty0 - 3, lb.ty0 - 2, lb.ty0 - 1, lb.ty0, lb.ty1, lb.ty1 + 1]) for (let x = lb.tx0; x <= lb.tx1; x++) {
        if (m.isTerrainSolid(x, y) && !m.blocker[m.idx(x, y)]) m.set(x, y, T.FOREST_FLOOR);
      }
      const up = pb.log_upright;
      if (up && up.visible) { up.visible = false; m.setPropSolid(up, false); up.solid = false; }
      if (!pb.log_fallen) {
        pb.log_fallen = m.addProp({ name: 'log_a', x: 22.9 * TILE, y: (lb.ty1 + 1) * TILE - 6, layer: 'ground', rot: Math.PI / 2, scale: 1 });
      }
      m.invalidate();
    }
    m.setBlockRect(100, 111, 101, 113, !f.ruinsGate);
    if (pb.side_gate) pb.side_gate.visible = !f.ruinsGate;
    const bm = R.bramble;
    m.setBlockRect(bm.tx0, bm.ty0, bm.tx1, bm.ty1, !f.bramble);
    if (pb.bramble_prop) pb.bramble_prop.cut = !!f.bramble;
    // secret walls
    const cw = R.caveWall;
    if (f.caveOpened) {
      for (let y = cw.ty0 - 1; y <= cw.ty1; y++) for (let x = cw.tx0 + 1; x <= cw.tx1 - 1; x++) m.set(x, y, T.CAVE);
      m.set(70, 55, T.FOREST_FLOOR); m.set(71, 55, T.FOREST_FLOOR);
      if (pb.cave_crack) pb.cave_crack.broken = true;
      m.invalidate();
    }
    const aw = R.archiveWall;
    if (f.archiveOpened) {
      for (let y = aw.ty0; y <= aw.ty1; y++) m.set(aw.tx0, y, T.RUIN);
      if (pb.archive_glyph) pb.archive_glyph.broken = true;
      m.invalidate();
    }
    // guardian gate seal
    const gs = R.gateSeal;
    m.setBlockRect(gs.tx0, gs.ty0, gs.tx1, gs.ty1, !f.gateOpened);
    const gp = pb.guardian_gate;
    if (gp) { const n = f.gateOpened ? 'gate_open' : 'big_gate'; gp.name = n; gp.def = Assets.props[n]; gp.scale = f.gateOpened ? 0.95 : 0.62; }
    // arena seal (only during the fight)
    const as = R.arenaSeal;
    m.setBlockRect(as.tx0, as.ty0, as.tx1, as.ty1, w.bossActive);
    for (const b of w.breakables) if ((b.kind === 'crack' && f.caveOpened) || (b.kind === 'glyph' && f.archiveOpened) || (b.kind === 'bramble' && f.bramble)) b.dead = true;
  },
};
