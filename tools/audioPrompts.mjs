// docs/audio/AUDIO_PROMPTS.md -> docs/audio/ECLIPSE_ONLINE_Audio_Prompts.pdf (headless Edge / Chrome).  node tools/audioPrompts.mjs
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { pathToFileURL, fileURLToPath } from 'url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const md = readFileSync(ROOT + 'docs/audio/AUDIO_PROMPTS.md', 'utf8').replace(/\r\n/g, '\n');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
let html = '', inTable = false, inList = null;
const close = () => { if (inTable) { html += '</tbody></table>'; inTable = false; } if (inList) { html += `</${inList}>`; inList = null; } };
for (const line of md.split('\n')) {
  if (/^\|/.test(line)) {
    const cells = line.slice(1, -1).split('|').map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (!inTable) { close(); html += '<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'; inTable = true; }
    else html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
    continue;
  }
  const h = line.match(/^(#{1,3}) (.*)/), li = line.match(/^(\s*)(\d+\.|-) (.*)/);
  if (h) { close(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; }
  else if (li) { const t = /\d/.test(li[2]) ? 'ol' : 'ul'; if (inTable || (inList && inList !== t && !li[1])) close(); if (!inList) { html += `<${t}>`; inList = t; } html += `<li${li[1] ? ' class="sub"' : ''}>${inline(li[3])}</li>`; }
  else if (/^---/.test(line)) { close(); html += '<hr>'; }
  else if (line.trim()) { close(); html += `<p>${inline(line)}</p>`; }
  else close();
}
close();
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Kanit; src: url('../../assets/fonts/Kanit-Regular.ttf'); }
@page { size: A4; margin: 14mm 12mm; }
body { font-family: 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif; font-size: 10.5pt; color: #1d1b22; line-height: 1.5; }
h1 { font-size: 19pt; color: #2b1d4a; border-bottom: 3px solid #b48a3c; padding-bottom: 6px; }
h2 { font-size: 14pt; color: #3a2a63; margin-top: 18px; break-after: avoid; border-left: 5px solid #b48a3c; padding-left: 8px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 9.2pt; }
th { background: #2b1d4a; color: #f3e7c8; text-align: left; padding: 5px 6px; }
td { border-bottom: 1px solid #ddd6e8; padding: 5px 6px; vertical-align: top; }
tr { break-inside: avoid; } tr:nth-child(even) td { background: #f7f4fb; }
code { font-family: Consolas, monospace; font-size: 8.8pt; background: #efeaf6; padding: 1px 3px; border-radius: 3px; word-break: break-word; }
td:last-child code { background: #fff8e6; color: #3d2a00; }
li.sub { margin-left: 18px; list-style: circle; } hr { border: 0; border-top: 1px dashed #b48a3c; margin: 16px 0; }
</style></head><body>${html}</body></html>`;
const htmlPath = ROOT + 'docs/audio/audio_prompts.html', pdfPath = ROOT + 'docs/audio/ECLIPSE_ONLINE_Audio_Prompts.pdf';
writeFileSync(htmlPath, page);
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const r = spawnSync(exe, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'inherit', timeout: 90000 });
console.log(r.status, r.error && r.error.message); console.log(existsSync(pdfPath) ? 'PDF: ' + pdfPath : 'PDF failed');
