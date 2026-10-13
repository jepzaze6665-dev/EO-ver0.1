// City art prompt book -> docs/map/city_art_prompts.html + docs/map/ECLIPSE_ONLINE_City_Art_Prompts.pdf
//   node tools/cityArt/build.mjs        (headless Edge / Chrome print-to-PDF, like tools/itemCatalog)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const STYLE = 'pixel art, top-down 3/4 view RPG (like Stardew Valley / Eastward), light from the top-left, crisp 1-px dark outline, '
  + 'muted dark-fantasy palette, every object separate with clear empty space between them, solid pure black background (#000000), no text, no labels, no grid';

// [id, priority, Thai name, Thai note (size / use), English prompt]
const SECTIONS = [
  ['ทั้งสองเมือง — สำคัญที่สุด', 'desgin/Map/City/SHARED/', [
    ['gate', 1, 'Dungeon Gate (ประตูดันเจี้ยน)', 'ทางออกเดียวของเมือง ใหญ่ ~3×4 ช่อง (96×128 px ในเกม). แถว 1 = ปิด (หินมืด), แถว 2 = 6 เฟรมวังวนม่วงหมุนวนลูป',
      'An ancient standing stone portal arch, two carved rune pillars and a cracked lintel with an eclipse emblem, inside the arch a swirling violet energy vortex. Row 1: the gate dormant (dark stone, faint runes). Row 2: 6 animation frames of the vortex spinning and glowing, runes lit violet.'],
    ['return', 1, 'Return Stone (หินกลับเมือง)', 'จุดเริ่มทุกแมพ ~1×2 ช่อง. 4 เฟรมเรืองแสงทอง',
      'A small waist-high rune stone on a round stone base, a golden rune ring floating around it, 4 animation frames of the ring pulsing gold light.'],
    ['board', 1, 'กระดานเควส', '~2×2 ช่อง ตั้งกลางลาน',
      'A wooden quest notice board with a little roof, pinned parchment notes and a wanted poster, a lantern hanging on one side.'],
  ]],
  ['Lumina Village — หมู่บ้านขอบป่า อบอุ่น', 'desgin/Map/City/LUMINA/', [
    ['houses', 1, 'บ้าน 6 หลัง', 'กว้าง 4-5 ช่อง มีประตูหน้าตรงกลาง หลังคาสีแดง / ฟ้า / เขียว / เทา / ฟาง / ไม้',
      'Six small village cottages for a forest village, timber frame and stone base, front door facing the viewer, roofs: red tiles, blue slate, green moss, grey stone, straw thatch, wooden shingles; window light warm yellow, chimneys on some.'],
    ['guild', 1, 'Adventurer Guild', '~7×5 ช่อง อาคารใหญ่สุดของหมู่บ้าน',
      "A two-storey adventurers' guild hall, stone ground floor, timber upper floor, big double door, blue banners with a sword-and-shield crest, a sign board over the door."],
    ['smith', 1, 'โรงตีเหล็ก', '~5×4 ช่อง หลังคาเปิดด้านหน้า เห็นเตาไฟ',
      'An open-front blacksmith workshop, stone forge with glowing orange fire, chimney with smoke, anvil, tool rack and weapon rack under a wooden roof.'],
    ['market', 2, 'แผงตลาด 3 แบบ', '~3×2 ช่อง ผ้าใบสีต่างกัน',
      'Three market stalls with striped canvas awnings (red, teal, purple): a potion stall with bottles, a food stall with bread and fruit, a cloth stall with folded fabric.'],
    ['props', 2, 'ของตกแต่งหมู่บ้าน', 'ชิ้นละ 1-2 ช่อง',
      'Village props set: wooden fence pieces (horizontal, vertical, corner, gate), vegetable garden patch, hay bales, wooden cart, water barrel, well, hanging lantern post, two fruit trees, flower pots, flower arch, wooden bench, crates, sacks.'],
    ['forestgate', 3, 'ประตูป่าที่ปิดตาย', '~5×3 ช่อง ฉากหลังทิศเหนือ',
      'A big closed wooden palisade gate between two log watchtowers, the doors chained and barred, ivy growing over it.'],
  ]],
  ['Asteria City — เมืองหลวงหินขาว + บรอนซ์', 'desgin/Map/City/ASTERIA CITY/', [
    ['fountain', 1, 'น้ำพุคริสตัล (กลางลาน)', '~5×5 ช่อง เรืองแสงฟ้า 4 เฟรม',
      'A grand round fountain of white marble with bronze trim, a large floating blue crystal in the centre, water falling in tiers, 4 animation frames of the water and the crystal glow.'],
    ['citygate', 1, 'Dungeon Gate แบบเมืองหลวง', 'เหมือนข้อ Dungeon Gate แต่หินขาวขอบทอง',
      'An ornate portal arch of white marble with gold and bronze trim and winged statues on both pillars, inside a swirling violet vortex. Row 1 dormant, row 2: 6 frames of the vortex spinning.'],
    ['shops', 1, 'อาคารร้านค้า 3 หลัง (มีป้าย)', '~5×4 ช่อง ป้ายเป็นรูป ไม่มีตัวอักษร',
      'Three city shop buildings of white stone with bronze roofs, hanging signs with pictures only: a potion shop (bottle sign), a blacksmith (hammer and anvil sign), an adventurers guild (shield sign), awnings over the doors.'],
    ['cityprops', 2, 'ของตกแต่งเมือง', 'ชิ้นละ 1-2 ช่อง',
      'City props set: bronze street lamps, marble benches, flower planters, banners on poles (blue and gold), market crates, a statue of a knight, a bronze bell post, hedges, a small marble fountain.'],
  ]],
  ['ไม่ต้องรีบ', 'desgin/NPC/', [
    ['npcs', 3, 'NPC ใน Lumina', 'แบบเดียวกับ docs/npc/NPC_PROMPTS.md (front / back / left / right / walk1 / walk2)',
      'Character sprite sheet, 6 poses in one row: front, back, left, right, walk 1, walk 2 — make one sheet each for: an old village elder woman with a staff, a gate guard in leather and a spear, a small village boy, a village woman with a basket.'],
    ['animals', 3, 'สัตว์ในเมือง', '2 เฟรมเดิน',
      'Small town animals, 2 walking frames each, 4 directions: a grey cat, a pigeon, a brown dog.'],
  ]],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fontUrl = (f) => pathToFileURL(path.resolve('assets/fonts', f)).href;
const PRI = { 1: ['สำคัญมาก', '#d24a4a'], 2: ['ควรมี', '#d29a3a'], 3: ['ไม่รีบ', '#6a8a6a'] };
let n = 0;
const body = SECTIONS.map(([title, folder, items]) => `
  <h2>${esc(title)}</h2><div class="folder">ใส่ไฟล์ที่: <code>${esc(folder)}</code></div>
  ${items.map(([id, pri, name, note, prompt]) => `
    <div class="card"><div class="head"><span class="num">${++n}</span><b>${esc(name)}</b>
      <span class="pri" style="background:${PRI[pri][1]}">${PRI[pri][0]}</span><span class="id">${id}.png</span></div>
      <div class="note">${esc(note)}</div>
      <div class="label">PROMPT (คัดลอกทั้งกล่อง)</div>
      <div class="prompt">${esc(prompt)} ${esc(STYLE)}.</div></div>`).join('')}`).join('');

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>City Art Prompts</title><style>
@font-face{font-family:Kanit;src:url(${fontUrl('Kanit-SemiBold.ttf')})}
@font-face{font-family:Thai;src:url(${fontUrl('NotoSansThai.ttf')})}
@page{size:A4;margin:14mm}
body{font-family:Thai,'Segoe UI',sans-serif;color:#222;font-size:11.5px;line-height:1.55}
h1{font-family:Kanit;font-size:26px;margin:0;color:#2a1f44}
.sub{color:#666;margin:2px 0 14px}
h2{font-family:Kanit;font-size:17px;border-bottom:2px solid #7a5cc8;padding-bottom:3px;margin:18px 0 4px;color:#3a2a66;break-after:avoid}
.folder{color:#555;margin-bottom:8px}
code{background:#eee;padding:1px 5px;border-radius:3px}
.card{border:1px solid #ccc;border-radius:6px;padding:8px 10px;margin:8px 0;break-inside:avoid}
.head{display:flex;align-items:center;gap:8px;font-size:13.5px}
.num{background:#3a2a66;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
.pri{color:#fff;font-size:10px;padding:1px 7px;border-radius:9px}
.id{margin-left:auto;color:#888;font-family:monospace}
.note{color:#444;margin:3px 0}
.label{font-size:9.5px;color:#7a5cc8;font-weight:bold;margin-top:4px}
.prompt{background:#f4f1fb;border-left:3px solid #7a5cc8;padding:6px 8px;font-family:Consolas,monospace;font-size:10.5px}
.rules li{margin:2px 0}
</style></head><body>
<h1>ECLIPSE ONLINE — City Art Prompts</h1>
<div class="sub">ภาพ sprite สำหรับเมือง Lumina + Asteria (City rework, 2026-10-13)</div>
<ul class="rules">
<li><b>กติกาทุกภาพ:</b> pixel art มุมบน 3/4 แสงจากซ้ายบน <b>พื้นหลังดำล้วน</b> ห้ามมีตัวอักษร / ตาราง / ลายหมากรุก</li>
<li>1 ช่องในเกม = 32 px — ขนาดในการ์ดเป็นขนาด "ในเกม" ภาพต้นฉบับใหญ่กว่าได้ (ชีต 2048×2048)</li>
<li>วางแต่ละชิ้นห่างกัน ไม่ให้แตะกัน — เครื่องมือตัดภาพแยกชิ้นจากช่องว่าง</li>
<li>ภาพเคลื่อนไหว: เรียงเฟรมเป็นแถวเดียว ซ้ายไปขวา ขนาดเท่ากัน</li>
<li>ส่งมาแล้วบอก Claude ว่าไฟล์อยู่โฟลเดอร์ไหน</li></ul>
${body}</body></html>`;

const htmlPath = path.resolve('docs/map/city_art_prompts.html');
const pdfPath = path.resolve('docs/map/ECLIPSE_ONLINE_City_Art_Prompts.pdf');
fs.writeFileSync(htmlPath, html);
const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const exe = browsers.find((b) => fs.existsSync(b));
if (!exe) { console.log('no Edge / Chrome: HTML only ->', htmlPath); process.exit(0); }
const profile = path.join(os.tmpdir(), 'eo-cityart-pdf');
spawnSync(exe, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'inherit', timeout: 90000 });
console.log(fs.existsSync(pdfPath) ? 'PDF -> ' + pdfPath : 'PDF failed (close Edge and retry)');
