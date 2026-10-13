// Missing object art prompt book -> docs/map/object_art_prompts.html + docs/map/ECLIPSE_ONLINE_Object_Art_Prompts.pdf
//   node tools/objectArt/build.mjs        (copy of tools/cityArt/build.mjs)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const STYLE = 'pixel art game object sprite sheet, top-down 3/4 view RPG, dark fantasy, light from the top-left, crisp 1-px dark outline, '
  + 'limited palette that fits a dark navy / violet night world, every frame the same size on the same ground line, evenly spaced, solid pure black background (#000000), no text, no labels, no grid, no checkerboard, no drop shadow';

// [id, priority, Thai name, Thai note (size / frames / use), English prompt]
const SECTIONS = [
  ['กล่องสมบัติ — สำคัญที่สุด (ตอนนี้ของในกล่องสุ่มแล้ว)', 'desgin/Map/SHARED/objects/', [
    ['chest_normal', 1, 'กล่องธรรมดา', '~1.3 ช่อง แถวเดียว 6 เฟรม: ปิด -> แง้ม -> ครึ่ง -> เปิดสุดเรืองทอง -> แสงจาง -> เปิดว่าง',
      'A sturdy wooden treasure chest with dark iron bands and a round iron lock. ONE ROW of 6 frames: 1 closed, 2 lid lifts slightly with a thin warm gold glow from the gap, 3 lid half open with gold light spilling up, 4 lid fully open with a bright gold glow and sparkles rising, 5 fully open with the glow fading, 6 open and empty (dark inside, no glow).'],
    ['chest_rare', 1, 'กล่องหายาก (Ornate)', 'ใหญ่กว่ากล่องธรรมดาเล็กน้อย แถว 1 = เปิด 6 เฟรม, แถว 2 = ปิดอยู่ คริสตัลเรืองหายใจ 4 เฟรม',
      'An ornate treasure chest of dark violet-black wood with polished gold trim, a glowing purple crystal set in the lid and small runes on the front. Row 1, 6 frames: closed with a faint violet glow, lid lifts with violet-white light leaking out, half open with a violet light beam, fully open with a burst of violet and gold sparkles, glow fading, open and empty. Row 2, 4 frames: the closed chest, the lid crystal slowly pulsing brighter and dimmer.'],
  ]],
  ['วัตถุในแผนที่ field / ดันเจี้ยน', 'desgin/Map/SHARED/objects/', [
    ['waystone', 1, 'Waystone (จุดเช็คพอยต์)', '~1×2 ช่อง แถวเดียว 5 เฟรม: 1 = ยังไม่เปิด, 2-5 = เปิดแล้วเรืองฟ้าลูป',
      'A waist-high ancient standing stone with a carved rune circle on its face. ONE ROW of 5 frames: 1 dormant (dark grey stone, runes unlit), 2-5 activated loop with the runes glowing soft cyan, small light motes floating around it, the glow pulsing brighter and dimmer.'],
    ['death_pile', 1, 'กองของตอนตาย', '~1 ช่อง แถว 1 = ของเรา (แดง) 4 เฟรม, แถว 2 = ของเพื่อน (ฟ้า) 4 เฟรม',
      "A small pile of a fallen adventurer's belongings on the ground: a dropped backpack, a torn cloak, a few coins and a broken sword. Row 1, 4 frames: a ghostly red glow with tiny embers slowly rising (loop). Row 2: the same 4 frames with a pale blue glow instead."],
    ['lore_scroll', 2, 'ป้ายเรื่องราว (Lore)', '~0.7 ช่อง 4 เฟรม ลอยขึ้นลง',
      'A small parchment scroll tied with a ribbon, glowing warm gold, floating above a tiny stone pedestal. ONE ROW of 4 frames: the scroll bobs up and down and its glow pulses (loop).'],
    ['trial_relic', 2, 'ชิ้นส่วนเควสเปลี่ยนอาชีพ', '~1 ช่อง 6 เฟรม สีม่วง (เกมย้อมสีตามอาชีพเอง)',
      'A floating crystal shard relic, sharp and elegant, pale violet with a white core, circled by a thin ring of light, hovering above a soft glow on the ground. ONE ROW of 6 frames: the shard slowly rotates and the light ring pulses (loop).'],
    ['campfire', 2, 'กองไฟ (B1 พายุหิมะ / B3 ภูเขา)', '~1 ช่อง 6 เฟรม ไฟลุกลูป',
      'A small campfire of logs ringed with stones, sitting on snow. ONE ROW of 6 frames: lively orange-yellow flames flickering with a few sparks rising (loop).'],
    ['switches', 3, 'คันโยก / สวิตช์รูน / แท่นบูชา', '3 แถว: คันโยก 2 เฟรม · สวิตช์รูน A3 4 เฟรม · แท่นบูชา 4 เฟรม',
      'Three rows of dungeon interaction objects. Row 1, 2 frames: an old iron wall lever on a stone base, lever up and lever down. Row 2, 4 frames: a waist-high white stone rune pillar with bronze trim, unlit, then 3 frames of its rune glowing bright blue (loop). Row 3, 4 frames: a small old stone altar with an empty brazier, cold, then 3 frames of a violet flame burning in it (loop).'],
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

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Object Art Prompts</title><style>
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
<h1>ECLIPSE ONLINE — Object Art Prompts</h1>
<div class="sub">วัตถุที่ตอนนี้เกมยังวาดด้วยโค้ด (2026-10-13) — ไม่มีรูปก็ยังเล่นได้ ส่งมาเมื่อพร้อม</div>
<ul class="rules">
<li><b>กติกาทุกภาพ:</b> pixel art มุมบน 3/4 แสงจากซ้ายบน <b>พื้นหลังดำล้วน</b> ห้ามมีตัวอักษร / ตาราง / ลายหมากรุก</li>
<li>1 ช่องในเกม = 32 px — ขนาดในการ์ดเป็นขนาด "ในเกม" ภาพต้นฉบับใหญ่กว่าได้ (ชีต 2048×2048)</li>
<li>1 ไฟล์ = 1 วัตถุ ตั้งชื่อไฟล์ตามมุมขวาของการ์ด; เฟรมห่างกัน ไม่แตะกัน พื้น (เท้า) อยู่ระดับเดียวกันทุกเฟรม</li>
<li>ภาพเคลื่อนไหว: เรียงเฟรมเป็นแถวเดียว ซ้ายไปขวา ขนาดเท่ากัน</li>
<li>ส่งมาแล้วบอก Claude ว่าไฟล์อยู่โฟลเดอร์ไหน</li></ul>
${body}</body></html>`;

const htmlPath = path.resolve('docs/map/object_art_prompts.html');
const pdfPath = path.resolve('docs/map/ECLIPSE_ONLINE_Object_Art_Prompts.pdf');
fs.writeFileSync(htmlPath, html);
const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const exe = browsers.find((b) => fs.existsSync(b));
if (!exe) { console.log('no Edge / Chrome: HTML only ->', htmlPath); process.exit(0); }
const profile = path.join(os.tmpdir(), 'eo-objectart-pdf');
spawnSync(exe, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'inherit', timeout: 90000 });
console.log(fs.existsSync(pdfPath) ? 'PDF -> ' + pdfPath : 'PDF failed (close Edge and retry)');
