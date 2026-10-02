import { loadAll } from './core/assets.js';
import { Game } from './core/game.js';

// loading-screen tips (index.html #loading): one every few seconds while assets load
const TIPS = [
  ['TIP', 'Dodge just before a blow lands for a PERFECT DODGE — time slows and the attacker is open to a counter.'],
  ['TIP', 'Aegis classes: raise the shield right before a hit to PARRY — no damage and an instant riposte.'],
  ['TIP', 'Watch the red telegraphs: every enemy attack is announced before it lands.'],
  ['TIP', 'Press [I] to open your character: gear, skills, class tree and codex.'],
  ['TIP', 'Your class resource and counter sit above the skill bar — fill them, then unleash your strongest skills.'],
  ['LORE', 'When the sun went dark over Lumina, the forest began to whisper.'],
  ['LORE', 'Asteria waits at the end of two roads: one through the ancient valley, one over the frozen peaks.'],
  ['LORE', 'Some say a king of cinders sleeps sealed beneath the valley. Only pilgrims know the way.'],
];

// Entry point: load sprite sheets / atlases, build the game, show the title screen.
async function main() {
  const box = document.getElementById('loading');
  const bar = box.querySelector('.bar i');
  const label = box.querySelector('.label');
  const pct = box.querySelector('.ld-pct');
  const tip = box.querySelector('.ld-tip');
  const setPct = (v) => { bar.style.width = v + '%'; if (pct) pct.textContent = Math.round(v) + '%'; };
  let ti = Math.floor(Math.random() * TIPS.length);
  const showTip = () => {
    if (!tip) return;
    const [k, t] = TIPS[ti++ % TIPS.length];
    tip.style.opacity = 0;
    setTimeout(() => { tip.innerHTML = `<b>${k}</b>${t}`; tip.style.opacity = 1; }, 250);
  };
  showTip();
  const tipTimer = setInterval(showTip, 4500);
  try {
    await loadAll((p) => setPct(p * 80));
    // canvas text (HUD, damage numbers) only uses a web font once it is loaded (theme.css @font-face)
    label.textContent = 'Loading fonts…';
    await Promise.all(['400 16px Kanit', '600 16px Kanit', '700 16px Kanit', '400 16px "Noto Sans Thai"']
      .map((f) => document.fonts.load(f, 'Aก1').catch(() => null)));
    setPct(88);
    label.textContent = 'Forging the world…';
    await new Promise((r) => setTimeout(r, 30));
    const game = new Game(document.getElementById('game'));
    setPct(100);
    window.__game = game; // handy for debugging from the console
    game.boot();
    clearInterval(tipTimer);
    box.classList.add('done'); // fade out (theme.css), then remove
    setTimeout(() => box.remove(), 650);
  } catch (e) {
    clearInterval(tipTimer);
    console.error(e);
    label.textContent = 'Failed to load: ' + e.message + ' — run "node server.js" and open http://localhost:5173';
  }
}
main();
