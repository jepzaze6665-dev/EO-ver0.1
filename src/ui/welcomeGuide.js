// WELCOME GUIDE — shown when a new character enters the world. The player CHOOSES how much help they want:
// full guide (5 short pages) · just the essentials (controls + dungeon rules) · skip. "Don't show again" is saved per
// browser. Also opened from the ESC menu (Guide). Tests / bots set globalThis.__eoNoGuide (tools/testkit.js) = never auto-shown.
import { t as tl } from '../i18n/i18n.js';

const KEY = 'eclipse_guide_v1';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode: ignore */ } };

export const guideWanted = () => typeof window !== 'undefined' && !globalThis.__eoNoGuide && read() !== 'off';

const li = (k, v) => `<div><b>${k}</b> ${v}</div>`;

function touchControls() {
  return `<div class="controls">
    ${li(tl('Left half of the screen'), tl('Drag = move'))}
    ${li('ATK', tl('Attack (hold for a combo)'))}
    ${li('1-4 · ULT', tl('Tap = cast at the nearest foe · drag then release = aim yourself'))}
    ${li('Q', tl('Class special (Aegis: hold to guard)'))}
    ${li('DODGE', tl('Dodge — time it for PERFECT DODGE'))}
    ${li('E', tl('Shows up near NPCs, chests, gates (hold = revive a friend)'))}
    ${li('≡ · 🎒 · ❤', tl('Menu · character window · potion'))}
  </div>`;
}

// each page: title + html. `controls` = the live, class-aware controls list from panels.js
function pages(game, controlsHTML) {
  const p = game.player;
  return {
    controls: { title: tl('Controls'), body: game.touch && game.touch.on ? touchControls() : controlsHTML(p && p.cls, p) },
    combat: { title: tl('How to fight'), body: `<div class="controls">
      ${li('⚠', tl('Red areas on the ground = an attack is coming there. Step out of them.'))}
      ${li(tl('Dodge'), tl('Dodging just before a hit = PERFECT DODGE: slow motion + the enemy is open to big damage.'))}
      ${li(tl('STAMINA'), tl('Dodge, guard and some skills use stamina. Empty = you cannot dodge.'))}
      ${li('R', tl('Drink a potion. Buy more in town.'))}
      ${li(tl('Boss'), tl('Bosses show their moves first. Learn the pattern, punish when it is WEAK.'))}
    </div>` },
    start: { title: tl('Where to start'), body: `<div class="controls">
      ${li('1', tl('Talk to Captain Aldric in Lumina (the village guide).'))}
      ${li('2', tl('Go to the Dungeon Gate and press E: choose a map, Solo or Party (up to 4).'))}
      ${li('3', tl('Fight, loot, then come back with the Return Stone at the map start.'))}
      ${li('4', tl('Towns are safe: shops, the smith, storage, other players.'))}
    </div>` },
    rules: { title: tl('Dungeon rules (important)'), body: `<div class="controls">
      ${li('☠', tl('Dying in a dungeon: you lose HALF the monster EXP of this run, and every item found this run drops where you fell.'))}
      ${li('E', tl('Walk back and press E on your pile to take it back. A party member can carry it for you.'))}
      ${li('🏠', tl('Returning to a town keeps everything safe. Gold is never lost.'))}
      ${li('↻', tl('Bosses come back every new run.'))}
    </div>` },
    grow: { title: tl('Growing stronger'), body: `<div class="controls">
      ${li('I', tl('Character window: gear (7 slots), skills, class, quests.'))}
      ${li(tl('Skills'), tl('Every level gives a skill point. Skills gain mastery and can evolve.'))}
      ${li(tl('Builds'), tl('Gear and evolutions of the same style unlock build bonuses.'))}
      ${li('LV 30', tl('Class 2: three new classes per line. Their masters hide in a secret city…'))}
    </div>` },
  };
}

const PLANS = { full: ['controls', 'combat', 'start', 'rules', 'grow'], basic: ['controls', 'rules'] };

// open the choice screen (or a plan directly). onDone runs when the guide is closed.
export function openGuide(panels, controlsHTML, { plan = null, onDone = null } = {}) {
  const game = panels.game;
  const choose = () => {
    const el = panels.show('text', `
      <div class="panel lore guide">
        <h2>${tl('Welcome to Eclipse Online')}</h2>
        <div class="body"><p>${tl('How much help would you like?')}</p>
          <div class="esc-list">
            <button data-g="full">${tl('I am new — show me everything (5 pages)')}</button>
            <button data-g="basic">${tl('Just the essentials (controls + dungeon rules)')}</button>
            <button data-g="skip">${tl('I know what I am doing — let me play')}</button>
          </div>
          <label class="small muted"><input type="checkbox" data-off ${read() === 'off' ? 'checked' : ''}> ${tl('Do not show this for new characters')}</label>
          <p class="small muted">${tl('You can open this guide any time: ESC → Guide')}</p>
        </div>
      </div>`);
    panels.current.onClose = onDone;
    el.querySelector('[data-off]').onchange = (e) => write(e.target.checked ? 'off' : 'on');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      if (b.dataset.g === 'skip') panels.close(); else page(PLANS[b.dataset.g], 0);
    });
  };
  const page = (list, i) => {
    const all = pages(game, controlsHTML), pg = all[list[i]], last = i === list.length - 1;
    const el = panels.show('text', `
      <div class="panel lore guide">
        <h2>${pg.title} <span class="small muted">${i + 1} / ${list.length}</span></h2>
        <div class="body">${pg.body}</div>
        <div class="esc-list guide-nav">
          ${i > 0 ? `<button data-n="back">${tl('Back')}</button>` : `<button data-n="menu">${tl('Back')}</button>`}
          <button data-n="next">${last ? tl('Start playing') : tl('Next [E]')}</button>
          ${last ? '' : `<button data-n="skip">${tl('Skip')}</button>`}
        </div>
      </div>`);
    panels.current.onClose = onDone;
    panels.current.advance = () => (last ? panels.close() : page(list, i + 1));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (!b) return;
      const n = b.dataset.n;
      if (n === 'next') panels.current.advance();
      if (n === 'back') page(list, i - 1);
      if (n === 'menu') choose();
      if (n === 'skip') panels.close();
    });
  };
  if (plan && PLANS[plan]) page(PLANS[plan], 0); else choose();
}
