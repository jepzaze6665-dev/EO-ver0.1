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

  // ---- A1 optional mini-bosses (W2): a side quest, rewards once, no gate
  {
    id: 'a1_hunts_begin', on: 'questCompleted', match: { id: 'beyond_lumina' },
    actions: ['accept_quest:forest_hunts'],
  },
  {
    id: 'mini_hollow_fang_start', on: 'bossEngaged', match: { bossId: 'mini_hollow_fang' },
    actions: [{ type: 'notify', title: 'BOSS TIP', text: 'Red ground = an attack is coming. Step out, or [Space] dodge through it.', color: '#ffb070' }],
  },
  {
    id: 'mini_grukk_phase2', on: 'bossPhaseChanged', match: { bossId: 'mini_grukk', phase: 2 },
    actions: [{ type: 'notify', title: 'PHASE CHANGE', text: 'Thorn rings leave gaps — find the opening and stand in it.', color: '#b890ff' }],
  },
  {
    id: 'a1_hidden_cave', on: 'hiddenFound', match: { id: 'hidden_cave' },
    actions: [{ type: 'notify', title: 'HIDDEN AREA', text: 'Something in this cave remembers the eclipse…', color: '#e0b0ff' }],
  },

  // ---- A1 route milestones (quest route_a reads the flag)
  {
    id: 'a1_river_crossed', on: 'areaDiscovered', match: { name: 'Deep Forest' },
    actions: ['set_flag:riverCrossed'],
  },

  // ---- A1 boss (the Guardian) -> A2 Ancient Valley
  {
    id: 'a1_boss_defeated', on: 'bossDefeated', match: { bossId: 'boss_a1' },
    actions: ['unlock_map:a2', { type: 'banner', title: 'A2 UNLOCKED', text: 'The north road beyond the arena leads into the Ancient Valley', color: '#ffd98a' }],
  },
  {
    id: 'a2_first_visit', on: 'mapEntered', match: { id: 'a2', first: true },
    actions: [{ type: 'cutscene', title: 'ANCIENT VALLEY', sub: 'Route A · A2', focus: 'player', zoom: 1.3, time: 2.2 }, 'accept_quest:burning_rift'],
  },

  {
    id: 'a2_rift_found', on: 'areaDiscovered', match: { name: 'Magma Rift' },
    actions: ['set_flag:riftFound', { type: 'notify', title: 'MAGMA RIFT', text: 'The ground burns here. Watch the orange rings — and never stand still.', color: '#ffb070' }],
  },
  {
    id: 'a2_boss_phase2', on: 'bossPhaseChanged', match: { bossId: 'boss_a2', phase: 2 },
    actions: [{ type: 'notify', title: 'MOLTEN FURY', text: 'Rings of magma spread outward — dodge through them, not away.', color: '#ff9a50' }],
  },
  {
    id: 'a2_boss_defeated', on: 'bossDefeated', match: { bossId: 'boss_a2' },
    actions: [{ type: 'banner', title: 'THE RIFT COOLS', text: 'Beyond it, a road climbs toward the Rune Citadel (A3 — coming in a later update)', color: '#ffd98a' }],
  },

  // ---- A3 Major Boss -> City 2: added with City 2 (W5); the unlock itself = City 2's map `requires`.

  // ---- Valehaven: the secret city of the Ancient Valley (hidden road behind the Sealed Path, open once the forest heals)
  {
    id: 'valehaven_found', on: 'mapEntered', match: { id: 'valehaven', first: true },
    actions: [
      { type: 'cutscene', title: 'VALEHAVEN', sub: 'A hidden city in the Ancient Valley', focus: 'player', zoom: 1.4, time: 2.4 },
      'accept_quest:valley',
    ],
  },
];
