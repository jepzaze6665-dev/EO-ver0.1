// ITEM CATALOGUE — builds a printable HTML + PDF of every gear item for the artists (icons / graphics).
// Reads the live game data (ITEMS, SETS, loot tables), so it never goes out of date. Art briefs: ./briefs.mjs.
//   node tools/itemCatalog/build.mjs        -> docs/items/item_catalog.html + docs/items/ECLIPSE_ONLINE_Items.pdf
// PDF = headless Microsoft Edge (or Chrome) "print to PDF"; if neither is found only the HTML is written.
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ITEMS, RARITY_COLOR } from '../../src/items/items.js';
import { isGear } from '../../src/items/itemDefs.js';
import { TYPE_LABEL, RARITIES, ANY_CLASS } from '../../src/data/items/rules.js';
import { SETS } from '../../src/data/items/sets.js';
import { setPieces } from '../../src/items/setSystem.js';
import { itemSources } from '../../src/loot/lootSystem.js';
import { CLASSES } from '../../src/skills/classes.js';
import { modifierText, classLabel, esc } from '../../src/ui/itemTooltip.js';
import { BRIEFS } from './briefs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs', 'items');
mkdirSync(outDir, { recursive: true });

const gear = Object.values(ITEMS).filter(isGear);
const keys = Object.values(ITEMS).filter((d) => d.key); // KEY ITEMS (not gear): only open something
// which class starts with an item (class signature gear)
const signatureOf = {};
for (const c of Object.values(CLASSES)) for (const id of Object.values(c.startingGear || {})) if (id) signatureOf[id] = c.name;
const G1 = ['core_ironheart', 'core_counter', 'core_vanguard', 'armor_fortress', 'armor_guardian', 'armor_risk', 'relic_oath_mirror',
  'relic_last_bastion', 'relic_dawn_core', 'charm_heavy', 'charm_swift', 'charm_focus', 'charm_guardian', 'rune_guarding_soul',
  'rune_iron_will', 'rune_retribution', 'rune_provocation'];
const line = (d, l) => d.allowedClasses.includes('line:' + l) || d.allowedClasses.includes(l);
const SECTIONS = [
  ['BOSS SIGNATURE — ของประจำบอส (ดรอป 100% ครั้งแรก)', (d) => !!d.signature],
  ['UMBRAL LINE — สายเงา / นักฆ่า', (d) => line(d, 'umbral_sword')],
  ['ASTRAL LINE — สายดวงดาว / เวท', (d) => line(d, 'astral_weaver')],
  ['UNIVERSAL — ทุกคลาสใช้ได้', (d) => ['armor_pathfinder', 'relic_ember_war', 'rune_second_wind', 'rune_executioner', 'rune_hunters_sigil', 'charm_wanderer'].includes(d.id)],
  ['GUARD / COUNTER / BARRIER — ชุดแรก (G1, เหมาะกับ Aegis)', (d) => G1.includes(d.id)],
  ['CLASS SIGNATURE GEAR — อาวุธ / ชุดประจำคลาส', (d) => !!signatureOf[d.id]],
  ['LEGACY ACCESSORIES — ของเก่าก่อนระบบ Item', () => true],
];
const used = new Set(), groups = SECTIONS.map(([title, pick]) => {
  const items = gear.filter((d) => !used.has(d.id) && pick(d));
  items.forEach((d) => used.add(d.id));
  return [title, items];
});

const TYPE_TH = { weapon_core: 'แกนอาวุธ', armor_core: 'แกนเกราะ', relic: 'เรลิก', charm: 'ชาร์ม', rune: 'รูน' };
const sourceText = (d) => {
  if (d.key) return 'ได้จากเควสต์ / การตีขึ้นรูป (ไม่ดรอป)';
  if (d.dropSource) return `ดรอปจากบอส ${d.dropSource} (100% ครั้งแรก)`;
  if (signatureOf[d.id]) return `อุปกรณ์เริ่มต้นของ ${signatureOf[d.id]}`;
  const s = itemSources(d.id);
  if (s.length) return 'ดรอป: ' + s.map((x) => `${x.table} ${Math.round(x.chance * 1000) / 10}%`).join(' · ');
  return d.price ? `ร้านค้า (${d.price} G)` : '—';
};
const autoBrief = (d) => {
  if (signatureOf[d.id]) return `${TYPE_TH[d.type] || d.type}ประจำคลาส ${signatureOf[d.id]} — ไอคอนต้องหน้าตาเหมือนอาวุธ / ชุดในสไปรต์ของคลาสนี้ (desgin/class cr/) ใช้โทนสีเดียวกับคลาส`;
  return `${d.name}: ${d.description}`;
};
const statLines = (d) => [
  ...d.modifiers.map((m) => `<li class="${(m.type === 'resourceCost' ? m.value < 0 : m.value > 0) ? 'up' : 'down'}">${esc(modifierText(m))}</li>`),
  ...Object.entries(d.stats || {}).filter(([, v]) => v).map(([k, v]) => `<li class="up">${esc(k)} ${v > 0 ? '+' : ''}${v}</li>`),
  ...d.effects.map((e) => `<li class="fx">✦ ${esc(e.text)}</li>`),
  ...(d.modText ? [`<li class="fx">✦ ${esc(d.modText)}</li>`] : []),
].join('');

const card = (d) => {
  const col = RARITY_COLOR[d.rarity] || '#ccc', set = d.setId && SETS[d.setId];
  return `<div class="card" style="--rc:${col};--ic:${d.color || col}">
    <div class="top"><div class="sw" title="item colour"><span>${esc((d.icon || '').toUpperCase())}</span></div>
      <div><div class="nm">${esc(d.name)}</div>
      <div class="sub"><b style="color:${col}">${esc(d.rarity.toUpperCase())}</b> · ${d.key ? 'Key Item (ไอเทมกุญแจ)' : `${esc(TYPE_LABEL[d.type] || d.type)} (${TYPE_TH[d.type] || ''})`}</div>
      <div class="id">${esc(d.id)} · สี ${esc(d.color || '-')}</div></div></div>
    <div class="desc">${esc(d.description)}</div>
    <ul class="st">${statLines(d)}</ul>
    <div class="meta">${d.key ? '<b style="color:var(--rc)">KEY ITEM — ใช้เปิดประตู ไม่มีค่าสถานะ ขาย / ฝากไม่ได้</b>' : d.allowedClasses.includes(ANY_CLASS) ? 'ทุกคลาส' : 'เฉพาะ: ' + esc(d.allowedClasses.map(classLabel).join(', '))}${set ? ` · <b style="color:${set.color}">SET ${esc(set.name)}</b>` : ''}${d.levelRequirement ? ` · LV ${d.levelRequirement}+` : ''}</div>
    <div class="meta">${esc(sourceText(d))}</div>
    ${d.tags.length ? `<div class="tags">${d.tags.map((t) => `<span>${esc(t.toUpperCase())}</span>`).join('')}</div>` : ''}
    <div class="brief"><b>ART BRIEF:</b> ${esc(BRIEFS[d.id] || autoBrief(d))}</div>
  </div>`;
};

const setsHTML = Object.entries(SETS).map(([id, s]) => `<div class="set" style="--ic:${s.color}">
  <div class="nm" style="color:${s.color}">SET: ${esc(s.name.toUpperCase())}</div><div class="desc">${esc(s.description)}</div>
  <div class="meta">ชิ้นในเซ็ต: ${setPieces(id).map((p) => esc(ITEMS[p].name)).join(' · ')}</div>
  <ul class="st">${s.bonuses.map((b) => `<li class="fx">(${b.pieces} ชิ้น) ${esc(b.text)}</li>`).join('')}</ul></div>`).join('');

const legend = RARITIES.map((r) => `<span class="rar" style="--rc:${RARITY_COLOR[r] || '#ccc'}">${r.toUpperCase()}</span>`).join('');
const today = new Date().toISOString().slice(0, 10);

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ECLIPSE ONLINE — Item Catalogue</title><style>
@page { size: A4; margin: 11mm; }
* { box-sizing: border-box; }
body { font-family: 'Leelawadee UI', 'Segoe UI', Tahoma, sans-serif; color: #e8e4f0; background: #14111c; margin: 0; font-size: 10.5px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 26px; letter-spacing: 3px; margin: 0 0 2px; color: #f0d8ff; }
h2 { font-size: 15px; letter-spacing: 1.5px; color: #d8c0ff; border-bottom: 1px solid #4a3a66; padding-bottom: 4px; margin: 16px 0 8px; break-after: avoid; }
.cover p, .guide li { font-size: 11.5px; line-height: 1.55; }
.guide { background: #1d1828; border: 1px solid #3a2f50; border-radius: 6px; padding: 8px 14px; }
.rar { display: inline-block; border: 1px solid var(--rc); color: var(--rc); border-radius: 3px; padding: 1px 6px; margin: 2px 4px 2px 0; font-weight: 700; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.card, .set, .brief, .st li { overflow-wrap: anywhere; }
@media screen { body { padding: 16px; max-width: 900px; margin: 0 auto; } }
.card, .set { background: #1d1828; border: 1px solid #3a2f50; border-left: 4px solid var(--rc, var(--ic)); border-radius: 6px; padding: 8px 10px; break-inside: avoid; }
.set { margin-bottom: 8px; border-left-color: var(--ic); }
.top { display: flex; gap: 9px; align-items: center; }
.sw { width: 42px; height: 42px; flex: none; border-radius: 6px; background: radial-gradient(circle at 35% 30%, #fff8, var(--ic) 45%, #000a 100%); border: 2px solid var(--rc);
  display: flex; align-items: flex-end; justify-content: center; }
.sw span { font-size: 6.5px; color: #000c; background: #fffb; border-radius: 2px; padding: 0 2px; margin-bottom: 2px; }
.nm { font-size: 13.5px; font-weight: 700; }
.sub { font-size: 10px; color: #b8b0c8; }
.id { font-size: 9px; color: #8a809c; font-family: Consolas, monospace; }
.desc { font-style: italic; color: #c8c0d8; margin: 5px 0 3px; }
.st { margin: 2px 0 4px; padding-left: 14px; }
.st li { margin: 1px 0; } .st .up { color: #8fe0a0; } .st .down { color: #ff8a80; } .st .fx { color: #ffd88a; list-style: none; margin-left: -12px; }
.meta { font-size: 9.5px; color: #a8a0b8; margin-top: 2px; }
.tags span { display: inline-block; font-size: 8.5px; background: #2c2440; border-radius: 3px; padding: 0 5px; margin: 3px 3px 0 0; color: #cfc4e8; }
.brief { margin-top: 5px; padding: 4px 6px; background: #261f36; border-radius: 4px; color: #efe8ff; font-size: 10.5px; }
.brief b { color: #c8a0ff; }
.pb { break-before: page; }
</style></head><body>
<div class="cover">
  <h1>ECLIPSE ONLINE</h1>
  <div style="font-size:15px;color:#c8b0ff;letter-spacing:2px">ITEM CATALOGUE — สำหรับทำกราฟิก / ไอคอน</div>
  <p>สร้างจากข้อมูลในเกมโดยตรง (src/data/items, src/items/items.js) วันที่ ${today} · ไอเทมสวมใส่ทั้งหมด ${gear.length} ชิ้น · ไอเทมกุญแจ ${keys.length} · เซ็ต ${Object.keys(SETS).length} ชุด<br>
  สร้างใหม่ได้ทุกเมื่อด้วย <code>node tools/itemCatalog/build.mjs</code></p>
  <div class="guide"><b>แนวทางทำไอคอน</b><ul>
    <li><b>ไอเทมไม่เปลี่ยนหน้าตาตัวละคร</b> — กราฟิกที่ต้องทำคือ <b>ไอคอนไอเทม</b> (ช่อง Loadout, กระเป๋า, tooltip) ไม่ใช่สไปรต์บนตัว</li>
    <li>สไตล์: pixel-art / dark fantasy ให้เข้ากับ UI kit และไอคอนสกิล · พื้นหลังโปร่งใส · ของอยู่กลางภาพ เว้นขอบเล็กน้อย</li>
    <li>ขนาดที่แนะนำ: วาดสี่เหลี่ยมจัตุรัส 1024×1024 (แบบเดียวกับ ICON SKILL) แล้วย่อเหลือ 64 px ในเกม — ต้องยังอ่านรูปทรงออกตอนเล็ก</li>
    <li>ตั้งชื่อไฟล์ตาม <b>id</b> ของไอเทม เช่น <code>desgin/ICON ITEM/core_shadow_fang.png</code> (ระบบตัดไอคอนไอเทมยังไม่ได้สร้าง — ทำได้เมื่อมีภาพ)</li>
    <li><b>กรอบสีตาม Rarity</b> (เกมวาดกรอบเอง ไม่ต้องใส่ในภาพ): ${legend}</li>
    <li>"สี" ในการ์ด = สีหลักของไอเทมในเกมตอนนี้ (ใช้เป็นโทนหลักของไอคอน) · ช่องสี่เหลี่ยมซ้ายบน = ตัวอย่างโทนสี + ชนิดไอคอนชั่วคราว</li>
    <li>LEGENDARY / ของบอส ควรมีแสง/ออร่าชัดกว่าชิ้นอื่น · ชิ้นในเซ็ตเดียวกันควรมีสัญลักษณ์ร่วมกัน</li>
  </ul></div>
</div>
<h2>SETS — เซ็ตไอเทม</h2>${setsHTML}
${keys.length ? `<h2>KEY ITEMS — ไอเทมกุญแจ (ใช้เปิดทางเข้าเท่านั้น)</h2><div class="grid">${keys.map(card).join('')}</div>` : ''}
${groups.filter(([, items]) => items.length).map(([title, items], i) => `<h2 class="${i === 0 ? 'pb' : ''}">${esc(title)} (${items.length})</h2><div class="grid">${items.map(card).join('')}</div>`).join('')}
</body></html>`;

const htmlPath = join(outDir, 'item_catalog.html');
writeFileSync(htmlPath, html);
console.log('HTML:', htmlPath, `(${gear.length} items)`);

const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const exe = browsers.find((b) => existsSync(b));
if (!exe) { console.log('No Edge / Chrome found: open the HTML and print it to PDF.'); process.exit(0); }
const pdfPath = join(outDir, 'ECLIPSE_ONLINE_Items.pdf');
const r = spawnSync(exe, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'inherit', timeout: 90000 });
console.log(existsSync(pdfPath) ? 'PDF: ' + pdfPath : 'PDF failed (status ' + r.status + ')');
