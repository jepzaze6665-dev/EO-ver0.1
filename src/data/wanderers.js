// WANDERERS — NPCs that do not stand in one place: every time the player enters one of their maps they appear at ONE
// spot picked at random from that map's list (world/wanderers.js). A map entry only counts while its `requires` are met
// (progression/requirements.js), and the wanderer leaves for good once `doneFlag` is set.
//   id, name, role, look (monsters/monsterSprites.js npcSprite)
//   maps: { mapId: { requires: [...], spots: [[tx, ty], ...] } }
//   doneFlag: world flag that sends the wanderer away everywhere
// Spots = open ground reachable from the map spawn, away from packs, boss arenas and other objects, far apart (BFS pick).
// Dialogue = world/narrative.js dialogueFor(id) (it reads which map the player is on + the wanderer's quests).
export const WANDERERS = {
  // A2 secret boss chain (Varkharon): one trial per Route A field map, each pays a Cinder Shard (data/quests.js ember_*)
  ashen_pilgrim: {
    id: 'ashen_pilgrim', name: 'Ashen Pilgrim', role: 'Keeper of the Cinders', look: 'pilgrim',
    doneFlag: 'sealForged',
    maps: {
      a1: {
        requires: [{ type: 'boss_defeated', boss: 'boss_a1', label: 'Defeat the Guardian of the Forest' }],
        spots: [[51, 123], [128, 97], [14, 72], [136, 64]],
      },
      a2: {
        requires: [{ type: 'boss_defeated', boss: 'mini_sunken_horn', label: 'Defeat the Sunken Horn' }],
        spots: [[77, 158], [73, 103], [100, 99], [48, 166], [114, 59]],
      },
      a3: {
        requires: [{ type: 'boss_defeated', boss: 'mini_archive_warden', label: 'Defeat the Archive Warden' }],
        spots: [[125, 196], [58, 130], [95, 127], [59, 67], [38, 153]],
      },
    },
  },
};

// the trial each map's pilgrim gives (quest ids in data/quests.js)
export const PILGRIM_TRIALS = { a1: 'ember_trial_a1', a2: 'ember_trial_a2', a3: 'ember_trial_a3' };
