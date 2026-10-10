// Pairs every English text of the item / set / status / shop data with its Thai (th/items.js, keyed by id) and hands them
// to i18n (addTexts), so any UI can show a data text with tx(text). Imported by the UI (ui/itemTooltip.js), never by data.
import { ITEMS, SHOPS } from '../items/items.js';
import { SETS } from '../data/items/sets.js';
import { STATUSES } from '../data/statuses.js';
import { TH_ITEMS, TH_SETS, TH_STATUSES, TH_SHOPS } from './th/items.js';
import { addTexts } from './i18n.js';
import { ARCHETYPES } from '../data/archetypes.js';
import { TH_ARCHETYPES } from './th/archetypes.js';

export function dataPairs() {
  const out = [], add = (en, th) => { if (en && th) out.push([en, th]); };
  for (const [id, th] of Object.entries(TH_ITEMS)) {
    const d = ITEMS[id]; if (!d) continue;
    add(d.description, th.description); add(d.desc, th.description); add(d.modText, th.modText); add(d.ruleText, th.ruleText);
    (d.effects || []).forEach((e, i) => add(e.text, (th.effects || [])[i]));
  }
  for (const [id, th] of Object.entries(TH_ARCHETYPES)) {
    const a = ARCHETYPES[id]; if (!a) continue;
    add(a.name, th.name); add(a.description, th.description);
    a.tiers.forEach((t, i) => add(t.text, (th.tiers || [])[i]));
    let k = 0; for (const t of a.tiers) for (const e of t.effects || []) add(e.text, (th.effects || [])[k++]);
  }
  for (const [id, th] of Object.entries(TH_SETS)) {
    const s = SETS[id]; if (!s) continue;
    add(s.description, th.description);
    s.bonuses.forEach((b, i) => { add(b.text, (th.bonuses || [])[i]); for (const e of b.effects || []) add(e.text, (th.bonuses || [])[i]); });
  }
  for (const [id, th] of Object.entries(TH_STATUSES)) add(STATUSES[id] && STATUSES[id].display && STATUSES[id].display.label, th.label);
  for (const [id, th] of Object.entries(TH_SHOPS)) add(SHOPS[id] && SHOPS[id].title, th.title);
  return out;
}
addTexts('th', dataPairs());
