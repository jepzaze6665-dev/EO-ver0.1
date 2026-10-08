// All Thai tables. UI strings = th/ui.js + windows.js + messages.js + story.js (keyed by the English text);
// message patterns = TH_PATTERNS (+ story patterns, the generic "text n/m" one last);
// item / set / status / shop texts are keyed by id in th/items.js and registered by i18n/dataText.js.
import { TH_UI as BASE, TH_DATA } from './ui.js';
import { TH_WINDOWS } from './windows.js';
import { TH_MESSAGES, TH_PATTERNS as MSG_PATTERNS } from './messages.js';
import { TH_STORY, TH_STORY_PATTERNS } from './story.js';

export const TH_UI = { ...BASE, ...TH_WINDOWS, ...TH_MESSAGES, ...TH_STORY };
export const TH_PATTERNS = [...MSG_PATTERNS, ...TH_STORY_PATTERNS];
export { TH_DATA };
