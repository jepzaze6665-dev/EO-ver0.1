import { Z } from '../core/constants.js';

// VALEHAVEN — the SECRET CITY of the Hidden Valley (W2; was City 2 in V2.2). A safe Guild camp-city nobody in Lumina
// speaks of. Way in: the Sealed Path in A1's north-west (exit `valley_road`), whose thorn barrier withers once the
// Guardian falls (world/levels/whispering.js valley barrier). Finding it = hidden content (data/hidden.js valehaven:
// EXP + gold once, quest 'valley'). Not on the route panel; the world map shows it only after it was found.
// Placeholder city: Scout Wren, a waystone, a notice and the Sealed Depths door (a later content hook).
// Terrain: maps/ruins.js buildValley (tile rows 1..29).
export const VALEHAVEN = {
  id: 'valehaven', name: 'VALEHAVEN', short: 'Valehaven', sub: 'Secret City · Hidden Valley · Safe Zone', grid: 'whispering',
  type: 'city', safe: true, secret: true,
  region: { zones: [Z.VALLEY] },
  spawn: [32, 24],
  requires: [{ type: 'boss_defeated', boss: 'boss_a1', label: 'The Sealed Path is overgrown — heal the forest first' }],
  exits: [
    { id: 'forest_road', rect: [29, 28, 35, 29], to: 'a1', entry: [32, 34], label: 'Sealed Path' },
    {
      id: 'proving_ring', rect: [46, 14, 46, 18], to: 'proving', entry: [49.5, 16], label: 'The Proving Ground',
      requires: [{ type: 'flag', flag: 'provingOpen', label: 'The ring answers only to a trial’s last test' }],
      confirm: { title: 'The Proving Ground', text: 'Your shadow waits in the ring.\nIt knows every move you have not learned yet.\n\nStep into the ring?', yes: 'Enter', no: 'Not yet' },
    },
  ],
  content: {
    // class masters (Quest Q2, data/classMasters.js): each one offers its line's class-change quest
    npcs: [
      { id: 'master_umbral', name: 'Master Ilsa', role: 'Class Change · Umbral', tx: 41, ty: 15, look: 'scout', art: 'wren', tint: 'hue-rotate(235deg) saturate(1.4)' },
      { id: 'master_astral', name: 'Master Corvin', role: 'Class Change · Astral', tx: 26, ty: 13, look: 'scout', art: 'wren', tint: 'hue-rotate(170deg) saturate(1.3)' },
      { id: 'master_aegis', name: 'Master Halvard', role: 'Class Change · Aegis', tx: 38, ty: 25, look: 'scout', art: 'wren', tint: 'hue-rotate(15deg) saturate(1.6) brightness(1.1)' },
    ],
    interactables: [
      {
        id: 'city2_notice', kind: 'sign', tx: 29, ty: 24, prompt: 'Read Guild Notice', title: 'Valehaven — Guild Notice',
        text: 'VALEHAVEN (Guild camp — do not speak of it in Lumina)\n• The Sealed Path is the only road in. Keep it that way.\n• The Sealed Depths lie north of the standing stones. Its door answers to power not yet found.\n• The masters of the three lines (Ilsa, Corvin, Halvard) teach the change of class — look for the coloured robes.\n• Merchants and the Guild hall arrive with the next caravan.',
      },
    ],
  },
};
