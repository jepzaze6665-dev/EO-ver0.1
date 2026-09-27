import { Z } from '../core/constants.js';

// ANCIENT VALLEY — opens after the Major Boss; the hook toward the next content (not part of Route A).
export const ANCIENT_VALLEY = {
  id: 'valley', name: 'ANCIENT VALLEY', sub: 'Beyond Route A · The world continues · Lv. 10 – 13',
  region: { zones: [Z.VALLEY] },
  spawn: [32, 24],
  exits: [
    { id: 'forest_road', rect: [29, 28, 35, 29], to: 'a2', entry: [32, 34], label: 'Deep Forest' },
  ],
};
