// ONLINE H5b — what the game data says each reward source pays (read by server/economy.js to check claims):
//   chest    : { gold, items: { id: n } }   — map content chests (static, always) + the ones grid builders place
//                                              (forest / ruins ...: read from a SimGame, `scan()`, when the server can run one)
//   resource : { item }                     — gathering nodes (1 item, again after the node regrows)
//   forge    : { gives: { id: n } }
// `full` = the grid scan ran: a chest / node id missing from the catalog is then refused instead of trusted.
import { MAPS } from '../src/maps/mapRegistry.js';

const chestOf = (it) => ({ gold: it.gold || 0, items: Object.fromEntries((it.loot || []).map((l) => [l.item, l.count || 1])) });

export class EconCatalog {
  constructor() {
    this.chest = {}; this.resource = {}; this.forge = {}; this.quarry = {};
    this.full = false;
    for (const m of MAPS) {
      for (const it of (m.content && m.content.interactables) || []) this.add(it);
      // H5c: chests that map mechanics place (A2 drowned chest, B2 dark-chamber hoards) and the A1 golden hare's reward
      for (const mech of m.mechanics || []) {
        if (mech.chest && mech.chest.id) this.chest[mech.chest.id] = chestOf(mech.chest);
        for (const z of mech.zones || []) if (z.chest) this.chest[`chest_hoard_${z.id}`] = chestOf(z.chest);
        if (mech.type === 'quarry') this.quarry[m.id] = { gold: mech.gold ?? 400, items: Object.fromEntries((mech.reward || []).map((r) => [r.item, r.count || 1])) };
      }
    }
    // a corrupted totem's chest appears in the world once its event is done (world/world.js)
    this.chest.chest_totem = { gold: 80, items: { umbral_band: 1, hp_potion: 2 } };
  }
  add(it) {
    if (!it || !it.id) return;
    if (it.kind === 'chest') this.chest[it.id] = chestOf(it);
    else if (it.kind === 'resource' && it.item) this.resource[it.id] = { item: it.item };
    else if (it.kind === 'forge' && it.gives) this.forge[it.id] = { gives: { ...it.gives } };
  }
  // every grid's own objects (grid builders), read from a headless game; ~1-3 s once at server start
  async scan() {
    const { createSimGame } = await import('../src/sim/simGame.js');
    const { LEVELS } = await import('../src/world/levels/index.js');
    const sim = await createSimGame({ classId: 'umbral_sword' });
    const w = sim.game.world;
    for (const id of Object.keys(LEVELS)) { w.enterGrid(id); for (const it of w.interactables) this.add(it); }
    this.full = true;
    return this;
  }
}
