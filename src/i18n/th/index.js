// All Thai tables. UI strings = th/ui.js + th/windows.js + th/messages.js; message patterns = TH_PATTERNS;
// data overlays (kind -> id -> field) = TH_DATA (added per phase).
import { TH_UI as BASE, TH_DATA } from './ui.js';
import { TH_WINDOWS } from './windows.js';
import { TH_MESSAGES, TH_PATTERNS } from './messages.js';

export const TH_UI = { ...BASE, ...TH_WINDOWS, ...TH_MESSAGES };
export { TH_DATA, TH_PATTERNS };
