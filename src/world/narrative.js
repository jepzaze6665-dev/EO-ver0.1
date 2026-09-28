// Lore fragments and NPC dialogue. Dialogue is a function of world state, so NPCs
// react to what the player has discovered and to the World State change.

export const LORE = {
  camp_journal: {
    title: 'Torn Journal — Abandoned Camp',
    text: 'Day 6. The fog rolled down from the ruins again. The wolves no longer flee from fire — their eyes glow violet now.\nDay 7. Heard singing from the crystals east of the river. Joren went to look. He has not returned.\n(The last page is signed: "Bram, woodcutter of Lumina")',
  },
  elder_tree: {
    title: 'The Elder Tree',
    text: 'Your palm meets warm bark. A heartbeat answers — slow, pained.\n"…the Warden sleeps… the Warden dreams… something black drinks from its heart…"\nFar to the north-east, beyond the ruins, a light flickers in response.',
  },
  crystal_song: {
    title: 'Song of the Crystal',
    text: 'The crystal hums in a rhythm you almost recognise. Where the song fades, it is replaced by a low violet whine — coming from the north, past the stone circle.\n(Something is hidden near the Stone Circle.)',
  },
  path_statue: {
    title: 'Statue Inscription — Ancient Forest Path',
    text: '"Here begins the Warden’s Road. Let none who carry darkness pass the Gate, for the Guardian remembers every blade."',
  },
  cave_mural: {
    title: 'Cave Mural — The Warden’s Weakness',
    text: 'A mural of a great antlered beast. Its chest holds a crystal heart. In the next panel, the beast crashes into a stone wall and kneels — the heart blazing, open.\n\n[Monster Knowledge] Guardian of the Forest: Weakness & Pattern revealed.',
    reveal: [['guardian', 'weakness'], ['guardian', 'pattern']],
  },
  guardian_oath: {
    title: 'Plaque — Oath of the Guardian',
    text: '"I am root and crystal. I rise with the forest and fall with it. Should corruption take me, let a shadow sever the eclipse from my heart."',
    reveal: [['guardian', 'level']],
  },
  court_tablet: {
    title: 'Tablet — Crystal Wardens',
    text: 'The crystal beasts were bred to guard the courtyard. Their armour is near-unbreakable from the front, but the core on their backs was left bare so that their keepers could calm them.\n\n[Monster Knowledge] Crystal Beast: Weakness revealed.',
    reveal: [['crystal_beast', 'weakness'], ['crystal_beast', 'pattern']],
  },
  archive_record: {
    title: 'Crystal Record — Sealed Archive',
    text: 'The Guardian was bound to the forest by the first people of Lumina. The Valley beyond the northern thorns held their greater work: the Depths, sealed with the same crystal as the Guardian’s heart.\nWhen the Guardian sleeps, the thorns wither.',
  },
  // boss lore (data/bosses.js rewards.lore) — added to the codex on the first kill
  hollow_fang: {
    title: 'Hollow Fang — the Alpha of the Crossing',
    text: 'The pack followed the fog to the river and made the crossing their den. Their alpha grew larger with every traveller turned away.\nWith it gone, the wolves scatter — and the bridge north belongs to the road again.',
  },
  rune_knight: {
    title: 'The Last Warden of Asteria',
    text: 'When Asteria fell, one knight stayed at the Sanctum and wrote his oath into the floor. The runes kept him standing long after the city emptied.\nNow the runes go quiet. Past the Sanctum, the old road runs on toward a living city.',
  },
  magma_beast: {
    title: 'The Magma Beast of the Rift',
    text: 'When the mountain woke, it did not stop at the valley\'s edge. The beast crawled up out of the rift and the kings fled their summer court.\nNow the rift cools. Past it, carved into the far cliffs, a road leads toward a citadel of rune and bronze.',
  },
  grukk: {
    title: 'Grukk the Thornbound',
    text: 'A goblin warchief who drank from the corrupted mire to master the thorns. The thorns mastered him instead.\nHis totem points east, toward the ruins, as if something there still calls it.',
  },
  guardian_rest: {
    title: 'The Guardian Rests',
    text: 'The Warden of the Whispering Heart kneels, and the black veins leave its crystal heart. North of the arena the road into the Ancient Valley opens — and somewhere in the healed forest, an old path to a hidden valley.',
  },
  valley_stone: {
    title: 'Standing Stone — Ancient Valley',
    text: '"A2 — The Valley of Wardens. Beneath us lie the Depths, where the eclipse was first born."\nThe stone is warm. The dungeon gate to the north pulses in answer.',
  },
};

// returns { lines:[...], options:[{label, action}] }
export function dialogueFor(id, g) {
  const f = g.world.state.flags, q = g.quests;
  const restored = f.guardianDefeated;
  switch (id) {
    case 'elder':
      if (!restored && !q.isActive('whispers') && !q.isDone('whispers')) return {
        lines: [
          'Ah… you must be the adventurer the Guild sent. I am Maren, elder of Lumina.',
          'A strange fog crept out of the Whispering Forest a month ago. The wolves turned savage, travelers vanished, and the old road north is choked with thorns.',
          'The fog comes from the ruins beyond the river, where the Guardian of the Forest sleeps. Please — find out what is happening.',
        ],
        options: [{ label: 'Accept: Whispers in the Forest', action: 'quest:whispers' }, { label: 'Not yet', action: 'close' }],
      };
      if (restored && q.isDone('whispers') && !f.elderThanked) {
        g.world.setFlag('elderThanked');
        return {
          lines: [
            'You have returned! The fog is gone — I can hear birds in the forest for the first time in a month.',
            'You did not simply win a fight, child. You changed the forest itself. Lumina owes you more than this purse.',
            'The thorns on the northern road have withered. Our ancestors sealed something in that valley… be careful.',
          ],
          options: [{ label: 'Farewell', action: 'close' }],
        };
      }
      if (!restored) return {
        lines: f.shrineInvestigated
          ? ['The shrine fragment… it resonates with the Guardian Gate. Beyond it the Guardian sleeps.', 'If it has been corrupted, you must free it. Learn its movements — it will leave its heart open after its heaviest blows.']
          : ['Follow the road north through the forest and cross the river. The Ancient Ruins lie east, past the stone circle.', 'Something at the ruins’ shrine should tell us more.'],
        options: [{ label: 'Farewell', action: 'close' }],
      };
      return {
        lines: [
          'The fog… it is gone. I can hear birds in the forest for the first time in a month!',
          'You did not simply win a fight, child. You changed the forest itself. The thorns on the northern road have withered — the Ancient Valley is open again.',
          'Our ancestors sealed something in that valley. Be careful… and thank you.',
        ],
        options: [{ label: 'Farewell', action: 'close' }],
      };
    case 'guide':
      // main quest "First Steps Beyond Lumina" (talking to Aldric is its first and last objective)
      if (q.isActive('beyond_lumina')) {
        const st = q.active.beyond_lumina;
        return {
          lines: st.done.exit
            ? ['Still breathing? Good. Finish the hunt — five beasts — then come back and report.']
            : [
              `Welcome to Lumina, ${g.player.cls.name}. Captain Aldric, Adventurer Guild — I guide the new blood.`,
              'Before the Guild trusts you with real work, prove you can survive out there.',
              'Walk out the north gate into the Whispering Forest, put down five of the beasts roaming it, then come back to me.',
            ],
          options: [{ label: 'Controls?', action: 'controls' }, { label: 'On my way', action: 'close' }],
        };
      }
      if (q.canAccept('first_steps')) return {
        lines: [
          ...(q.isDone('beyond_lumina') ? ['You came back in one piece — the Guild will hear of it. Elder Maren by the quest board has need of someone like you.'] : []),
          `Now, ${g.player.cls.name}: if you want to last, learn your craft.`,
          ...(g.player.cls.guideIntro || []),
          'And learn to dodge at the last instant [Space]. A Perfect Dodge slows the world and fuels your shadow.',
        ],
        options: [{ label: 'Accept: First Steps of Shadow', action: 'quest:first_steps' }, { label: 'Controls?', action: 'controls' }, { label: 'Later', action: 'close' }],
      };
      return {
        lines: restored
          ? ['Word travels fast — the Guardian is at peace! The Guild will want you for the Valley expedition.', 'Scout Wren is already up there. Look for her past the northern road.']
          : ['Remember: enemies always show their intent — red on the ground means move, or dodge through it at the last moment.', 'Heavy attacks leave openings. That is when you break them.'],
        options: [{ label: 'Controls?', action: 'controls' }, { label: 'Thanks', action: 'close' }],
      };
    case 'smith':
      return {
        lines: restored
          ? ['Ha! The forge burns cleaner since the fog lifted. Bring me materials and I’ll make you something worthy of that valley.']
          : ['Borin, smith of Lumina. Wolf fangs, goblin iron, crystal shards — bring them and I’ll forge blades that change how you fight.'],
        options: [{ label: 'Forge equipment', action: 'smith' }, { label: 'Leave', action: 'close' }],
      };
    case 'merchant':
      return {
        lines: restored
          ? ['Customers are coming back now that the road is safe! Take a look.']
          : ['Potions, tonics, charms. Nobody goes into that forest without a few draughts.'],
        options: [{ label: 'Trade', action: 'shop' }, { label: 'Leave', action: 'close' }],
      };
    case 'guard':
      return {
        lines: restored
          ? ['Sunlight on the forest road! I never thought I’d see it again.', 'The wolves are calmer too. Still — the new paths up north are no place for the careless.']
          : ['Halt— oh, you’re the Guild’s swordsman. The forest beyond this gate isn’t safe.', 'The fog makes the beasts savage. Stay on the path unless you’re looking for trouble.'],
        options: [{ label: 'Farewell', action: 'close' }],
      };
    case 'child':
      return {
        lines: restored ? ['The trees are singing now! Mama says I can pick berries by the gate tomorrow!'] : ['Mama says not to go past the gate. The fog eats people.', 'Are you gonna fight the fog? With that big sword?'],
        options: [{ label: 'Bye', action: 'close' }],
      };
    case 'villager':
      return {
        lines: restored
          ? ['Bram came home this morning! He said the fog just… lifted, and he found his way out of the old camp.', 'Whatever you did out there — thank you.']
          : ['My husband Bram went to cut wood by the old camp west of the entrance… he never came back.', 'If you find anything of his, please tell me.'],
        options: [{ label: 'Farewell', action: 'close' }],
      };
    case 'wanderer':
      g.knowledge.reveal('guardian', 'weakness');
      g.world.setFlag('metWanderer');
      return {
        lines: [
          '…You found this place. Few can hear the crystals anymore.',
          'The Guardian was never your enemy. Something from the Depths poisons its heart. Strike when it kneels — shadow severs corruption.',
          restored ? 'You have done it. The valley remembers you now. The Depths will not open for strength alone…' : 'When the Warden sleeps, the northern thorns will wither. Follow them.',
        ],
        options: [{ label: '…', action: 'close' }],
      };
    case 'scout':
      return {
        lines: [
          'Scout Wren, Adventurer Guild. You’re the one who calmed the Guardian? Then you’re the reason I could get up here at all.',
          'Welcome to Valehaven. Few in Lumina know this valley exists — the Guild keeps it that way. The Sealed Path only opens for those the forest trusts.',
          'That gate to the north is a dungeon — the Sealed Depths. The runes don’t respond to anything I have.',
          'The Guild will want to know. This valley is only the beginning.',
        ],
        options: [{ label: 'Farewell', action: 'close' }],
      };
    // ---- CITY 2 ASTERIA (maps/city2.js)
    case 'a_guildmaster':
      if (q.isDone('asteria')) return {
        lines: [
          'The Guild board fills faster than we can post it. The roads east are still unsurveyed — when the Guild opens them, you will hear it first.',
          'Rest while you can. Asteria has had three hundred years of silence; it can spare you a quiet night.',
        ],
        options: [{ label: 'Farewell', action: 'close' }],
      };
      return {
        lines: [
          `Seraphine, Guildmaster of Asteria. So you are the ${g.player.cls.name} who walked out of the Sanctum.`,
          'For three hundred years the Warden held that gate. Nothing from the dead city came through — and nothing from our side went back.',
          'You broke the silence, and the city noticed. The Bazaar, the forges, the waystone by the fountain — they are yours to use.',
          'The Guild has work beyond these walls. For now: welcome to Asteria.',
        ],
        options: [{ label: 'Thank you', action: 'close' }],
      };
    case 'a_merchant':
      return {
        lines: ['Odo, of the Asterian Bazaar! Draughts from the plaza crystal, charms from the old city — all fairly priced, mostly.'],
        options: [{ label: 'Trade', action: 'shop' }, { label: 'Leave', action: 'close' }],
      };
    case 'a_smith':
      return {
        lines: ['Hilde. My forge has burned since before the Warden took his post. Bring bronze plate, rune crystals, magma cores — I know what to do with them.'],
        options: [{ label: 'Forge equipment', action: 'smith' }, { label: 'Leave', action: 'close' }],
      };
    case 'a_gate_guard':
      return {
        lines: [
          'Sir Callum, South Gate. That road leads back to the Sanctum and the dead city beyond it.',
          'We watched the Warden from the walls every night. Never thought we’d see him fall — or see someone walk up that road.',
        ],
        options: [{ label: 'Farewell', action: 'close' }],
      };
    case 'a_scholar':
      return {
        lines: [
          'Imre, keeper of the Hall of Records. The old city south of here was Asteria too, once — the half the runes consumed.',
          'The knights you met there were not guarding the ruins from us. They were guarding us from what the runes became.',
        ],
        options: [{ label: 'Farewell', action: 'close' }],
      };
    case 'a_citizen':
      return { lines: ['A traveler from the south road? My grandmother said no one had come that way in her lifetime, or hers.'], options: [{ label: 'Bye', action: 'close' }] };
    case 'a_child':
      return { lines: ['Did you really beat the Rune Knight? Was he THIS big? Mama says the crystal in the plaza sings when heroes come.'], options: [{ label: 'Bye', action: 'close' }] };
    // A3 — wounded Guild scout in the ruins courtyard (the last warning before the boss)
    case 'kael':
      if (restored) return {
        lines: ['You came back out of that arena on your own feet. I’ll be telling this story for years.', 'Go on — Lumina will want to hear it from you.'],
        options: [{ label: 'Farewell', action: 'close' }],
      };
      return {
        lines: [
          'Easy… I’m Kael, Guild scout. The ruins woke up when the fog came — those pylons fire across the rooms. Count the rhythm, then cross.',
          f.shrineInvestigated
            ? 'You have the seal fragment? Then the gate north of the shrine will open for you. The Guardian sleeps behind it.'
            : 'The shrine up ahead holds a fragment of the old seal. A crystal beast bigger than any I have seen guards it.',
          'If you face the Guardian: watch the ground, it always shows what is coming. After its heaviest blows its heart lies open — that is your moment.',
        ],
        options: [{ label: 'I will be careful', action: 'close' }],
      };
  }
  return { lines: ['…'], options: [{ label: 'Close', action: 'close' }] };
}

export const BOARD_TEXT = [
  'LUMINA QUEST BOARD',
  '• URGENT — Fog over the Whispering Forest. See Elder Maren.',
  '• Wolf pelts wanted. Fangs bought by Borin the smith.',
  '• Missing: Bram the woodcutter. Last seen near the old camp.',
  '• Guild notice: travelers report a humming from the crystal glade.',
];
export const BOARD_TEXT_AFTER = [
  'LUMINA QUEST BOARD',
  '• The fog has lifted! Festival at the fountain tonight.',
  '• GUILD: Volunteers wanted for the Ancient Valley expedition.',
  '• Bram is home safe. Thank you, adventurer.',
];
