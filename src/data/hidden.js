// HIDDEN CONTENT — secret areas, hidden triggers, hidden quests and rare events (spec §31). Foundation only:
// V2.1 registers the secret areas that already exist; later content just adds entries here.
//
//  id, name, type : 'area' | 'trigger' | 'quest' | 'rare_event'
//  map            : where it lives (info for UI / tools)
//  trigger        : { event, match } — the game event that may reveal it (match = fields the event must have)
//  chance         : 0..1 roll each time the trigger fires (rare events); default 1
//  condition      : progression/requirements.js conditions checked when it triggers (level, flag, quest, ...)
//  reward         : { exp, gold, items } — given through 'hiddenFound' (ExperienceSystem + LootSystem)
//  once           : true = only ever found once per character (saved in world.state.hidden)
//  flag           : world flag set when found (default `hidden_<type>_found` is also set, e.g. hidden_area_found)
export const HIDDEN = {
  hidden_cave: {
    id: 'hidden_cave', name: 'Hidden Cave', type: 'area', map: 'a2',
    trigger: { event: 'secretFound', match: { id: 1 } }, reward: { exp: 60 }, once: true,
  },
  behind_waterfall: {
    id: 'behind_waterfall', name: 'Behind the Waterfall', type: 'area', map: 'a2',
    trigger: { event: 'secretFound', match: { id: 2 } }, reward: { exp: 60 }, once: true,
  },
  moonlit_shrine: {
    id: 'moonlit_shrine', name: 'Moonlit Shrine', type: 'area', map: 'a2',
    trigger: { event: 'secretFound', match: { id: 3 } }, reward: { exp: 60 }, once: true,
  },
  sealed_archive: {
    id: 'sealed_archive', name: 'Sealed Archive', type: 'area', map: 'a3',
    trigger: { event: 'secretFound', match: { id: 4 } }, reward: { exp: 60 }, once: true,
  },
};
