// i18n: the game's English text stays in the code / data; Thai lives in src/i18n/th/*.js and is looked up on demand.
//   t('English text', { n: 3 })        UI strings, keyed by the English text itself ({n} = parameter). No Thai entry -> English.
//   tr('quests', id, 'name', def.name)  data overlays keyed by id (kind -> id -> field), fallback = the data's own text.
// Names of classes / bosses / skills / items are transliterated by the owner's choice (they stay in English letters).
import { LANG } from '../data/lang.js';
import { TH_UI, TH_DATA, TH_PATTERNS } from './th/index.js';

const TABLES = { th: { ui: TH_UI, data: TH_DATA, patterns: TH_PATTERNS.map(([re, out]) => [new RegExp(re), out]) } };
let lang = LANG.default;
const listeners = [];

try {
  if (typeof localStorage !== 'undefined') {
    const s = localStorage.getItem(LANG.storageKey);
    if (LANG.options.includes(s)) lang = s;
  }
} catch (e) { /* private mode: keep the default */ }
applyDocument();

function applyDocument() {
  try { if (typeof document !== 'undefined') document.documentElement.lang = lang; } catch (e) { /* no DOM */ }
}

export const getLang = () => lang;
export const isThai = () => lang === 'th';
export function setLang(l) {
  if (!LANG.options.includes(l) || l === lang) return;
  lang = l;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LANG.storageKey, l); } catch (e) { /* ignore */ }
  applyDocument();
  for (const fn of listeners) fn(l);
}
export const nextLang = () => LANG.options[(LANG.options.indexOf(lang) + 1) % LANG.options.length];
export const onLang = (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };

const fill = (s, params) => (params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : s);

export function t(en, params) {
  const tab = TABLES[lang];
  const s = tab && tab.ui[en] !== undefined ? tab.ui[en] : en;
  return fill(s, params);
}

// tx(text): translate a FINISHED message (toast / banner / server text): exact entry, else a pattern (captured pieces are
// looked up again), else "a · b" piece by piece, else unchanged. Used where the HUD shows messages, so call sites stay English.
export function tx(text, depth = 0) {
  const tab = TABLES[lang];
  if (!tab || typeof text !== 'string' || !text || depth > 3) return text;
  if (tab.ui[text] !== undefined) return tab.ui[text];
  for (const [re, out] of tab.patterns) {
    const m = text.match(re);
    if (m) return out.replace(/\$(\d)/g, (_, i) => tx(m[+i] || '', depth + 1));
  }
  if (text.includes(' · ')) return text.split(' · ').map((s) => tx(s, depth + 1)).join(' · ');
  return text;
}

export function tr(kind, id, field, fallback) {
  const tab = TABLES[lang];
  const v = tab && tab.data[kind] && tab.data[kind][id] && tab.data[kind][id][field];
  return v !== undefined ? v : fallback;
}

// ---- text layout helpers (Thai has no spaces between words)
export const hasThai = (s) => /[฀-๿]/.test(s);
let segmenter = null;
// Split text into pieces a line may break between. Thai: dictionary word breaks (Intl.Segmenter); anything else: words + the space after.
export function breakPieces(text) {
  if (hasThai(text) && typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = segmenter || new Intl.Segmenter('th', { granularity: 'word' });
    return [...segmenter.segment(text)].map((x) => x.segment);
  }
  return text.split(/(?<= )/);
}
export function wrapLines(text, maxW, measure) {
  const lines = [];
  let cur = '';
  for (const piece of breakPieces(text)) {
    const test = cur + piece;
    if (cur && measure(test.trimEnd()) > maxW) { lines.push(cur.trimEnd()); cur = piece.trimStart(); } else cur = test;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}

// data texts (item descriptions, effects, set bonuses, ...): English -> Thai pairs built from id-keyed tables (i18n/dataText.js)
export function addTexts(l, pairs) {
  const tab = TABLES[l];
  if (!tab) return;
  for (const [en, th] of pairs) if (tab.ui[en] === undefined) tab.ui[en] = th;
}

// txBlock(text): a multi-line text (signs, confirm boxes): the whole text if it has an entry, else line by line
// (each line trimmed for the lookup, its indent kept).
export function txBlock(text) {
  if (typeof text !== 'string') return text;
  const whole = tx(text);
  if (whole !== text || !text.includes('\n')) return whole;
  return text.split('\n').map((l) => { const s = l.trim(); return s ? l.replace(s, tx(s)) : l; }).join('\n');
}
