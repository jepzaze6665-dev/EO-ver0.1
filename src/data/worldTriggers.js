// WORLD TRIGGERS — "when THIS happens in the world, do THAT". world/worldTriggerSystem.js reads these;
// no system hardcodes "if boss A1 is dead then ...".
//
//  id        : unique; `once` triggers are remembered in the World Progression (triggeredEvents) and saved
//  on        : game event name — bossEngaged · bossPhaseChanged · bossDefeated · mapUnlocked · mapEntered ·
//              npcTalked · hiddenFound · questCompleted · flag · ... (any event on the bus)
//  match     : fields the event must have (dotted paths allowed), e.g. { bossId: 'boss_a1' }
//  requires  : optional progression/requirements.js conditions checked when it fires
//  once      : fire only the first time (default true)
//  actions[] : run in order. Short form 'type:value' or an object { type, ... }:
//      unlock_map:<id>          record a map as unlocked (its gates / exits open)
//      set_flag:<flag>          world flag (old V2 systems react to flags)
//      accept_quest:<id>        start a quest (data/quests.js)
//      banner {title, text, color}   big centre banner       notify {title, text, color}   small side note
//      callout {title, text, color}  combat callout          lore:<id>   add a lore entry (world/narrative.js)
//      cutscene {title, sub, focus: 'boss'|'player', zoom, time}   placeholder: camera focus + title card
//      emit {event, data}       fire another event (future systems: secret events, class unlocks, ...)
export const WORLD_TRIGGERS = [
  // ---- Lumina: the route choice
  {
    id: 'lumina_route_choice', on: 'npcTalked', match: { id: 'guard' },
    actions: [{ type: 'notify', title: 'ROUTE CHOICE', text: 'Route A (Forest Road) is open · Route B (Eastern Road) is not surveyed yet', color: '#ffd98a' }],
  },
  {
    id: 'route_a_begins', on: 'questCompleted', match: { id: 'beyond_lumina' },
    actions: ['accept_quest:route_a'],
  },

  // ---- A1: the first boss gate
  {
    id: 'a1_boss_start', on: 'bossEngaged', match: { bossId: 'boss_a1' },
    actions: [{ type: 'notify', title: 'BOSS TIP', text: 'Red ground = an attack is coming. Step out, or [Space] dodge through it.', color: '#ffb070' }],
  },
  {
    id: 'a1_boss_defeated', on: 'bossDefeated', match: { bossId: 'boss_a1' },
    actions: ['unlock_map:a2', { type: 'banner', title: 'A2 UNLOCKED', text: 'The River Crossing is open — the Deep Forest lies beyond', color: '#ffd98a' }],
  },

  // ---- A2
  {
    id: 'a2_boss_phase2', on: 'bossPhaseChanged', match: { bossId: 'boss_a2', phase: 2 },
    actions: [{ type: 'notify', title: 'PHASE CHANGE', text: 'Thorn rings leave gaps — find the opening and stand in it.', color: '#b890ff' }],
  },
  {
    id: 'a2_boss_defeated', on: 'bossDefeated', match: { bossId: 'boss_a2' },
    actions: ['unlock_map:a3', { type: 'banner', title: 'A3 UNLOCKED', text: 'The Ancient Forest Path to the ruins is open', color: '#ffd98a' }],
  },
  {
    id: 'a2_hidden_cave', on: 'hiddenFound', match: { id: 'hidden_cave' },
    actions: [{ type: 'notify', title: 'HIDDEN AREA', text: 'Something in this cave remembers the eclipse…', color: '#e0b0ff' }],
  },

  // ---- A3 / Major Boss -> City 2 (any route's major boss unlocks the city)
  {
    id: 'major_boss_defeated', on: 'bossDefeated', match: { major: true },
    actions: [
      'unlock_map:city2',
      { type: 'banner', title: 'CITY 2 UNLOCKED', text: 'The road to Valehaven is open', color: '#ffe08a' },
      'accept_quest:valley',
    ],
  },
  {
    id: 'city2_first_visit', on: 'mapEntered', match: { id: 'city2', first: true },
    actions: [
      { type: 'cutscene', title: 'VALEHAVEN', sub: 'City 2 · where the routes meet', focus: 'player', zoom: 1.4, time: 2.4 },
      { type: 'banner', title: 'ROUTE COMPLETE', text: 'You crossed the Forest Road from Lumina to Valehaven', color: '#ffe08a' },
    ],
  },
];
