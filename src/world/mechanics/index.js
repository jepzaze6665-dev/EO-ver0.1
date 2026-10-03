// Every map mechanic type registers itself here (import the file).
import './fireflies.js';  // A1 Whispering Forest
import './blizzard.js';   // B1 Frostwind Plains
import './altitude.js';   // B3 Frostpeak
import './runeVaults.js'; // A3 Rune Citadel
import './darkness.js';   // B2 Crystal Caverns
import './waterLevel.js'; // A2 Ancient Valley
import './quarry.js';     // random event: a rare creature to chase (A1 Golden Hare)
export { MAP_MECHANICS, registerMapMechanic, MapMechanic } from '../mapMechanics.js';
