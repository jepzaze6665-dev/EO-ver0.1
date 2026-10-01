import { loadAll } from './core/assets.js';
import { Game } from './core/game.js';

// Entry point: load sprite sheets / atlases, build the game, show the title screen.
async function main() {
  const bar = document.querySelector('#loading .bar i');
  const label = document.querySelector('#loading .label');
  try {
    await loadAll((p) => { bar.style.width = Math.round(p * 80) + '%'; });
    // canvas text (HUD, damage numbers) only uses a web font once it is loaded (theme.css @font-face)
    await Promise.all(['400 16px Kanit', '600 16px Kanit', '700 16px Kanit', '400 16px "Noto Sans Thai"']
      .map((f) => document.fonts.load(f, 'Aก1').catch(() => null)));
    label.textContent = 'Forging the world…';
    await new Promise((r) => setTimeout(r, 30));
    const game = new Game(document.getElementById('game'));
    bar.style.width = '100%';
    window.__game = game; // handy for debugging from the console
    game.boot();
    document.getElementById('loading').remove();
  } catch (e) {
    console.error(e);
    label.textContent = 'Failed to load: ' + e.message + ' — run "node server.js" and open http://localhost:5173';
  }
}
main();
