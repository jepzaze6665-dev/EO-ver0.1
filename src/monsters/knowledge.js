import { ENEMY_COMBAT } from '../data/enemyCombat.js';
import { MONSTERS } from './monsterTypes.js';
import { ITEMS } from '../items/items.js';
import { LOOT_TABLES } from '../data/lootTables.js';

// MONSTER KNOWLEDGE — the player learns the world by fighting it.
//  unseen  : not listed ("UNKNOWN MONSTER" nameplate)
//  fought  : name revealed, everything else ???
//  1 kill  : Level + Pattern
//  3 kills : Weakness + Drop
//  5 kills : HP        (lore fragments can reveal fields early)
const ORDER = ['wolf', 'goblin', 'crystal_beast', 'crystal_alpha', 'thornling', 'guardian', 'wraith'];

export class Knowledge {
  constructor(game) {
    this.game = game;
    this.data = {}; // type -> {seen, kills, reveal:{}}
  }
  entry(type) {
    if (!this.data[type]) this.data[type] = { seen: false, kills: 0, reveal: {} };
    return this.data[type];
  }
  encounter(type) {
    const e = this.entry(type);
    if (!e.seen) {
      e.seen = true;
      this.game.ui.notify('Monster Knowledge', `New entry: ${MONSTERS[type].name}`, '#9ad8ff');
      this.game.save.dirty = true;
    }
  }
  kill(type) {
    const e = this.entry(type);
    e.seen = true;
    e.kills++;
    if ([1, 3, 5].includes(e.kills)) this.game.ui.notify('Monster Knowledge', `${MONSTERS[type].name} — new information learned`, '#9ad8ff');
  }
  reveal(type, field) {
    const e = this.entry(type);
    if (!e.reveal[field]) {
      e.reveal[field] = true;
      this.game.ui.notify('Monster Knowledge', `${MONSTERS[type].name}: ${field} revealed`, '#9ad8ff');
    }
  }
  known(type) { return this.entry(type).seen; }
  nameFor(type) { return this.known(type) ? MONSTERS[type].name : 'UNKNOWN MONSTER'; }
  levelFor(type) { const e = this.entry(type); return e.kills >= 1 || e.reveal.level ? String(MONSTERS[type].level) : '??'; }

  view() {
    return ORDER.filter((t) => this.entry(t).seen).map((t) => {
      const e = this.entry(t), d = MONSTERS[t], k = e.kills;
      const q = (cond, v) => (cond ? v : '???');
      return {
        type: t, name: d.name, kills: k,
        level: q(k >= 1 || e.reveal.level, d.level),
        hp: q(k >= 5 || e.reveal.hp, d.hp),
        weakness: q(k >= 3 || e.reveal.weakness, (d.weakness || []).map((w) => w[0].toUpperCase() + w.slice(1)).join(', ')),
        pattern: q(k >= 1 || e.reveal.pattern, d.pattern),
        // role (data/enemyCombat.js): 'Bruiser' + a short how-to-fight hint
        role: q(k >= 1 || e.reveal.pattern, d.role ? (ENEMY_COMBAT.roles[d.role] || d.role).split(' — ')[0] : '—'),
        roleHint: (k >= 1 || e.reveal.pattern) && d.role ? (ENEMY_COMBAT.roles[d.role] || '').split(' — ')[1] || '' : '',
        drop: q(k >= 3 || e.reveal.drop, ((LOOT_TABLES[d.loot] || {}).drops || []).map((x) => ITEMS[x.item].name).join(', ') || '—'),
        desc: k >= 1 || e.reveal.pattern ? d.desc : 'Little is known. Fight it to learn more.',
      };
    });
  }
  serialize() { return this.data; }
  load(d) { this.data = JSON.parse(JSON.stringify(d || {})); }
}
