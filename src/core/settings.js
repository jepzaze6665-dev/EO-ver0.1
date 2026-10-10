// Player settings store (rules: data/settings.js). Bad / missing values fall back to the default (first choice).
import { SETTINGS } from '../data/settings.js';

let cache = null;
function load() {
  if (cache) return cache;
  cache = {};
  try { cache = JSON.parse(localStorage.getItem(SETTINGS.storageKey) || '{}') || {}; } catch (e) { cache = {}; }
  return cache;
}
export function getSetting(key) {
  const o = SETTINGS.options[key], v = load()[key];
  return o && o.values.includes(v) ? v : o ? o.values[0] : undefined;
}
export function setSetting(key, value) {
  const o = SETTINGS.options[key];
  if (!o || !o.values.includes(value)) return false;
  load()[key] = value;
  try { localStorage.setItem(SETTINGS.storageKey, JSON.stringify(cache)); } catch (e) { /* private mode: this session only */ }
  return true;
}
// the next choice after the current one (the panel's buttons cycle)
export function cycleSetting(key) {
  const o = SETTINGS.options[key], vs = o.values;
  setSetting(key, vs[(vs.indexOf(getSetting(key)) + 1) % vs.length]);
  return getSetting(key);
}
