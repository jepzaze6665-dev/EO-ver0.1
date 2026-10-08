// All Thai tables. UI strings = th/ui.js + th/windows.js; data overlays (kind -> id -> field) = TH_DATA (added per phase).
import { TH_UI as BASE, TH_DATA } from './ui.js';
import { TH_WINDOWS } from './windows.js';

export const TH_UI = { ...BASE, ...TH_WINDOWS };
export { TH_DATA };
