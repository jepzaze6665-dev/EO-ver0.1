// PARTY RULES (Combat 2.0 §58, §63) — 1 to 4 players, no fixed trinity. Foundation only: the game is solo today, but
// every rule here works on a list of members (party/partySystem.js), so a networked party plugs into the same code.
//
//  maxSize    : players per party
//  downed     : a member at 0 HP with living teammates is DOWNED (not dead): it cannot act, enemies ignore it,
//               and a teammate can revive it. If nobody does before `bleedOut` seconds, it is defeated.
//      bleedOut   : seconds until a downed member is defeated
//      reviveTime : seconds a teammate must hold [E] next to it (enemies interrupt by hitting the reviver)
//      reviveRange: px between reviver and downed member
//      reviveHp   : share of max HP the revived member gets back
//  failed     : when every member is down / defeated -> ENCOUNTER FAILED -> back to the checkpoint (last waystone,
//               else the village); an engaged boss resets (heals, waits in its arena) — unless a checkpoint
//               mechanic exists for that encounter (none yet).
export const PARTY = {
  maxSize: 4,
  downed: { bleedOut: 20, reviveTime: 3, reviveRange: 48, reviveHp: 0.3 },
  failed: { title: 'ENCOUNTER FAILED', text: 'Your party has fallen. Return to the checkpoint, learn the pattern, try again.' },
};
