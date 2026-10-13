// CLASS MASTERS (Quest rework Q2) — one master per class line lives in Valehaven (the secret city). Talking to the
// master of your line starts a class-change quest (a trial with chapters, data/classTree.js). The dialogue is built
// generically by world/narrative.js masterDialogue from this data; NPCs in the normal cities only hint at Valehaven.
//   line   : the tier-1 class of the line (CLASS_TREE root)
//   greet  : first lines (any class)   other: what the master says to someone of another line
//   ready  : lines when you may begin a path   early: lines before you are ready (below the Class 2 level)
//   after  : once you have walked one of the line's paths
export const CLASS_MASTERS = {
  master_umbral: {
    line: 'umbral_sword', name: 'Master Ilsa', role: 'Umbral Blademaster',
    greet: ['Ilsa. I taught blades in the shadow of the eclipse before Lumina had walls.'],
    other: ['Your weapon does not belong to the dark. Find the master of your own line — they are here too, if you look.'],
    early: ['You cut well, but your shadow is still thin. Come back when you have seen thirty winters of battle (LV 30).'],
    ready: ['Every Umbral blade becomes something else in the end. Choose what yours becomes — and then face it.'],
    after: ['Your shadow fell to you. Now it walks behind you instead of against you.'],
  },
  // SECRET master (secret classes): `nodes` = the secret classes he offers (any line whose node is listed); the dialogue
  // speaks to a Class 2 of that line (the normal masters only speak to the tier-1 class)
  master_dragon: {
    nodes: ['wyrmblood_reaver'], name: 'The Ashen Pilgrim', role: 'Keeper of the Cinder Blood',
    greet: ['So. The King is ash, and his heart beats in your pack. I told you fire finds the ones who stand still.'],
    other: ['The blood in that heart does not answer your kind of weapon. Not yet. Perhaps not ever.'],
    early: ['The heart is too hot for you. Come back stronger (LV 50), a master of your own path (Class 2), with the Heart of Varkharon in your pack.'],
    ready: ["Drink the King's blood and it will ask a price: your own. Learn to fight bleeding — and then face what you become."],
    after: ["The Cinder King's blood runs in you now. Try not to let it run out."],
  },
  master_astral: {
    line: 'astral_weaver', name: 'Master Corvin', role: 'Astral Loremaster',
    greet: ['Corvin. I read the threads between the stars when the eclipse was still a rumour.'],
    other: ['The stars have nothing to say to your kind of weapon. Your own master is somewhere in this valley.'],
    early: ['Your threads are still thin as spider silk. Come back at thirty winters of battle (LV 30) and we will weave something heavier.'],
    ready: ['Every weaver chooses what the sky becomes in their hands: storm, ink or light. Choose — and then meet the one you chose.'],
    after: ['The sky in your hands is your own now. Your shadow taught you the rest.'],
  },
  master_aegis: {
    line: 'aegis_guardian', name: 'Master Halvard', role: 'Aegis Shieldmaster',
    greet: ['Halvard. I held the bridge at Lumina before anyone built a gate there.'],
    other: ['A shield is not your answer. Find the master who speaks your weapon’s language — they are here.'],
    early: ['You can take a blow. Can you take a thousand? Come back at thirty winters of battle (LV 30).'],
    ready: ['A shield can shelter, stand, or strike back. Pick what yours will be — then stand against the one who already is.'],
    after: ['You stood against yourself and did not fall. That is the only oath a shield needs.'],
  },
};
