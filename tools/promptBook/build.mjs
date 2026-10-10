// PROMPT BOOK BUILDER — renders the class skill + VFX prompts (docs/design/art-prompts-*.md) to a
// printable HTML + PDF for the artists, in the same way tools/itemCatalog/build.mjs prints the item
// catalogue: headless Edge/Chrome "print to PDF", no dependencies.
//
//   node tools/promptBook/build.mjs                       -> every class file under docs/design/
//   node tools/promptBook/build.mjs --class wr            -> only files matching "wr"
//   node tools/promptBook/build.mjs --name DRG            -> output suffix ECLIPSE_ONLINE_Prompts_DRG.pdf
//
// The .md files are the source of truth: edit the markdown, re-run this, the PDF follows. Fenced code
// blocks become monospace cards with a copy-friendly border; prose becomes normal text.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = join(root, 'docs', 'design');
const outDir = join(root, 'docs', 'design');
mkdirSync(outDir, { recursive: true });

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const filter = arg('--class');
const suffix = arg('--name');
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A minimal markdown renderer: headings, fenced code, tables, bullets, bold, hr. Enough for these files,
// and it never executes anything from the source.
function md(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let out = '', inCode = false, code = [];
  const flushCode = () => { out += `<pre>${esc(code.join('\n'))}</pre>`; code = []; };
  let table = null;
  const flushTable = () => {
    if (!table) return;
    const head = table[0], body = table.slice(table.length > 1 && /^\|[\s:|-]+\|$/.test(table[1]) ? 2 : 1);
    out += '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
      + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    table = null;
  };
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/ -&gt; /g, ' → ');
  for (const raw of lines) {
    if (/^```/.test(raw)) { flushTable(); if (inCode) flushCode(); else { inCode = true; code = []; } continue; }
    if (inCode) { code.push(raw); continue; }
    const line = raw.trimEnd();
    if (/^\|\s*[^|]+\|\s*$/.test(line) && line.includes('|')) {
      const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
      (table = table || []).push(cells); continue;
    }
    flushTable();
    if (!line.trim()) { continue; }
    if (/^#{1,6}\s/.test(line)) {
      const lvl = line.match(/^#+/)[0].length;
      out += `<h${lvl}>${inline(line.replace(/^#+\s*/, ''))}</h${lvl}>`;
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) out += '<hr>';
    else if (/^\s*[-*]\s+/.test(line)) out += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
    else if (line.startsWith('> ')) out += `<blockquote>${inline(line.slice(2))}</blockquote>`;
    else out += `<p>${inline(line)}</p>`;
  }
  flushTable();
  if (inCode) flushCode();
  return out.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>').replace(/(<ul>[\s\S]*?<\/ul>)(?!\s*<ul>)/g, '<ul>$1</ul>');
}

const files = readdirSync(srcDir).filter((f) => /^art-prompts-.*\.md$/.test(f)).filter((f) => !filter || f.includes(filter));
if (!files.length) { console.error('No art-prompts-*.md in docs/design (use --class <name> to narrow).'); process.exit(1); }

const cover = `<div class="cover">
  <h1>ECLIPSE ONLINE</h1>
  <div class="sub">SKILL + VFX PROMPT BOOK${suffix ? ` — ${esc(suffix)}` : ''}</div>
  <p>สร้างจากไฟล์ <code>docs/design/art-prompts-*.md</code> วันที่ ${today} · ${files.length} คลาส<br>
  สร้างใหม่ได้ด้วย <code>node tools/promptBook/build.mjs</code></p>
  <div class="guide"><b>วิธีใช้</b><ul>
    <li><b>ชิลด์ท่า (สกิล)</b> — แนบรูปตัวละคร + MASTER PROMPT ตัวละคร + SKILL BLOCK หนึ่งบล็อก</li>
    <li><b>VFX</b> — ไม่แนบรูป + MASTER VFX PROMPT + VFX BLOCK หนึ่งบล็อก</li>
    <li><b>ทำทีละสกิล</b> — หนึ่ง skill = หนึ่ง sheet หนึ่งคำขอ อย่ารวมหลายสกิล</li>
    <li><b>4 แถว × 6 เฟรม</b> — Row 1 front/south, Row 2 back/north, Row 3 left/west, Row 4 right/east</li>
    <li>พื้นหลังโปร่งใสจริง · ไม่มีตัวหนังสือ · ไม่มีเงา · ไม่มีพื้น · ห้ามแตะชื่อคนอื่นใน prompt</li>
    <li><b>สองขั้นตอน</b>: สร้างตัวละครคุณภาพสูง -> CHIBI STYLE PROMPT -> ได้สไตล์เกม -> เอา sheet เดินเป็นต้นแบบ</li>
    <li>เอกสารนี้สร้างจากไฟล์อัตโนมัติ — <b>แก้ไฟล์ markdown</b> แล้วรัน build ครั้งเดียวจบ</li>
    <li>ความจำที่ผู้ช่วยใช้อยู่: สกิล eo-art-prompting / eo-feature-workflow</li>
  </ul></div>
</div>`;

const body = files.map((f, i) => {
  const html = md(readFileSync(join(srcDir, f), 'utf8'));
  const title = readFileSync(join(srcDir, f), 'utf8').match(/^#\s+(.+)$/m);
  return `<div class="pb"></div><h1 class="cls">${i + 1}. ${esc(title ? title[1] : f)}</h1>${html}`;
}).join('\n');

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>ECLIPSE ONLINE — Skill + VFX Prompt Book</title>
<style>
@page { size: A4; margin: 14mm 12mm; }
body { font-family: 'Leelawadee UI', 'Noto Sans Thai', 'Segoe UI', sans-serif; color: #efe8ff; background: #0d0a14; font-size: 12px; line-height: 1.45; }
@media screen { body { padding: 18px; max-width: 940px; margin: 0 auto; } }
@media print { body { background: #fff; color: #16121d; } }
.cover { border: 1px solid #4a3a6e; border-radius: 8px; padding: 16px; margin-bottom: 14px; background: #171126; }
@media print { .cover { background: #f6f3fb; } }
h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: 3px; color: #c8a0ff; }
h1.cls { font-size: 20px; margin: 0 0 10px; padding-bottom: 5px; border-bottom: 1px solid #4a3a6e; }
.sub { font-size: 14px; color: #e8c890; letter-spacing: 2px; margin-bottom: 8px; }
.guide { margin-top: 10px; font-size: 11px; }
.guide ul { margin: 4px 0 0; padding-left: 16px; }
.guide li { margin: 2px 0; }
h2 { font-size: 15px; margin: 14px 0 5px; color: #e8c890; border-left: 4px solid #7a5ab0; padding-left: 7px; }
h3 { font-size: 13px; margin: 10px 0 4px; color: #c8a0ff; }
h4 { font-size: 12px; margin: 8px 0 3px; color: #b8a0d8; }
p { margin: 4px 0; }
ul { margin: 3px 0 6px; padding-left: 18px; }
li { margin: 1px 0; }
blockquote { margin: 4px 0; padding: 4px 8px; border-left: 3px solid #6a5090; background: #1e1730; }
@media print { blockquote { background: #f2eef8; } }
pre { background: #120e1c; border: 1px solid #4a3a6e; border-left: 4px solid #9a6ce0; border-radius: 5px; padding: 8px 10px;
  font-family: Consolas, 'Cascadia Mono', monospace; font-size: 10.5px; line-height: 1.4; white-space: pre-wrap;
  word-break: break-word; break-inside: avoid; margin: 6px 0; }
@media print { pre { background: #f4f1f9; border-color: #b9a5d8; } }
code { font-family: Consolas, monospace; font-size: 10.5px; background: #241d36; padding: 0 3px; border-radius: 3px; }
@media print { code { background: #eae4f4; } }
table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10.5px; break-inside: avoid; }
th, td { border: 1px solid #4a3a6e; padding: 3px 5px; text-align: left; vertical-align: top; }
th { background: #241d36; color: #e8c890; }
@media print { th { background: #eae4f4; } }
.pb { break-before: page; }
hr { border: 0; border-top: 1px solid #4a3a6e; margin: 10px 0; }
</style></head><body>
${cover}
${body}
</body></html>`;

const name = suffix || 'all';
const htmlPath = join(outDir, `prompt_book_${name}.html`);
writeFileSync(htmlPath, html);
console.log('HTML:', htmlPath, `(${files.length} files)`);

const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const exe = browsers.find((b) => existsSync(b));
if (!exe) { console.log('No Edge / Chrome found: open the HTML and print it to PDF.'); process.exit(0); }
const pdfPath = join(outDir, `ECLIPSE_ONLINE_Prompts_${name}.pdf`);
if (existsSync(pdfPath)) unlinkSync(pdfPath); // Edge appends to an existing file, which would merge two runs
const r = spawnSync(exe, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'inherit', timeout: 90000 });
// Edge returns before the file is flushed: poll for it instead of trusting the exit status
let waited = 0;
while (waited < 30000 && (!existsSync(pdfPath) || !statSync(pdfPath).size)) { spawnSync('sleep', ['1']); waited += 1000; }
console.log(existsSync(pdfPath) ? 'PDF: ' + pdfPath + ` (${Math.round(statSync(pdfPath).size / 1024)} KB)` : 'PDF failed (status ' + r.status + ')');
