import { Z } from '../core/constants.js';

// THE PROVING GROUND — Valehaven's duel ring (Quest rework Q2). The last chapter of every class-change quest is fought
// here: the SHADOW OF THE NEW CLASS (data/shadowDuels.js, type 'trial' bosses that share this map; each one only appears
// while its trial is at the duel chapter = flag `duel_<class id>`). The ring stays sealed (flag provingOpen) until a
// trial first reaches its duel. Losing = respawn at the Valehaven waystone next door and walk back in.
// Terrain: maps/ruins.js buildValley (zone PROVING = the valley's east end, a round ruin floor).
export const PROVING_GROUND = {
  id: 'proving', name: 'THE PROVING GROUND', short: 'Proving Ground', sub: 'Valehaven · Class Trial', grid: 'whispering',
  type: 'boss_arena', parent: 'valehaven', secret: true,
  requires: [], // the way in (Valehaven exit proving_ring) asks for flag provingOpen
  region: { zones: [Z.PROVING] },
  spawn: [49, 16],
  exits: [
    { id: 'proving_out', rect: [47, 14, 47, 18], to: 'valehaven', entry: [44.5, 16], label: 'Valehaven' },
  ],
};
