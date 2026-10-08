// SimGame (online plan H1, docs/online/HEADLESS_SERVER_PLAN.md): the real Game running in Node with no screen,
// sound or keyboard. Same systems and rules as the browser; only presentation is swallowed by src/sim/headless.js.
// H2 will give every run map room on the server one SimGame and drive it with tick().
//
//   import { createSimGame } from './src/sim/simGame.js';
//   const sim = await createSimGame({ classId: 'umbral_sword' });
//   sim.tick(1 / 60);            // or sim.simulate(seconds, perStep) like the tests
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installHeadless, installAssetFetch, NOTHING } from './headless.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SIM_STEP = 1 / 60;
let assetsReady = null;

export async function createSimGame({ classId, newGame = true, online = false } = {}) {
  const canvas = installHeadless();
  installAssetFetch(ROOT);
  const { loadAll } = await import('../core/assets.js');
  if (!assetsReady) assetsReady = loadAll();
  await assetsReady;
  const { Game } = await import('../core/game.js');
  const game = new Game(canvas);
  game.headless = true;
  game.audio = NOTHING; // no sound device: every audio call is ignored (the music loop would keep Node alive)
  if (!online) game.online.update = () => {}; // the server is the network; only an H2 room host (server/simHosts.js) connects
  game.renderer.render = () => {};
  game.ui.draw = () => {};
  // nobody clicks panels here: roads and gates go straight through (the server decides who enters a run)
  const setup = game.setupSession.bind(game);
  game.setupSession = (...a) => { const r = setup(...a); game.world.transitions.autoConfirm = true; return r; };
  if (newGame) {
    game.newGame(classId);
    game.ui.panels.close(true);
    game.state = 'play';
  }
  const sim = {
    game,
    // one fixed step of the world (the server loop calls this 20-60 times a second)
    tick(dt = SIM_STEP) {
      if (game.worldRuns()) game.update(dt);
      game.input.endFrame();
    },
    simulate(seconds, perStep) { game.simulate(seconds, perStep); },
    // time one tick (ms), for the load estimate in the plan
    measure(seconds = 5, perStep) {
      const t = performance.now();
      game.simulate(seconds, perStep);
      return (performance.now() - t) / Math.round(seconds / SIM_STEP);
    },
  };
  return sim;
}
