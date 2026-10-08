// All Thai tables. UI strings = th/ui.js + windows.js + messages.js + story.js (keyed by the English text);
// message patterns = TH_PATTERNS (+ story patterns, the generic "text n/m" one last);
// item / set / status / shop texts are keyed by id in th/items.js and registered by i18n/dataText.js.
import { TH_UI as BASE, TH_DATA } from './ui.js';
import { TH_WINDOWS } from './windows.js';
import { TH_MESSAGES, TH_PATTERNS as MSG_PATTERNS } from './messages.js';
import { TH_STORY, TH_STORY_PATTERNS } from './story.js';
import { TH_MAPS, TH_MAP_PATTERNS } from './maps.js';
import { TH_BESTIARY } from './bestiary.js';
import { TH_CLASS_UMBRAL } from './classUmbral.js';
import { TH_CLASS_ASTRAL } from './classAstral.js';
import { TH_CLASS_AEGIS } from './classAegis.js';
import { TH_TAGS, TH_TAG_PATTERNS } from './tags.js';

export const TH_UI = { ...TH_TAGS, ...BASE, ...TH_WINDOWS, ...TH_MESSAGES, ...TH_STORY, ...TH_MAPS, ...TH_BESTIARY, ...TH_CLASS_UMBRAL, ...TH_CLASS_ASTRAL, ...TH_CLASS_AEGIS };
export const TH_PATTERNS = [...MSG_PATTERNS, ...TH_MAP_PATTERNS, ...TH_TAG_PATTERNS, ...TH_STORY_PATTERNS];
export { TH_DATA };
