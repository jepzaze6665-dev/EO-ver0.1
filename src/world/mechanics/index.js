// Every map mechanic type registers itself here (import the file).
import './fireflies.js';  // A1 Whispering Forest
import './blizzard.js';   // B1 Frostwind Plains
import './altitude.js';   // B3 Frostpeak
import './runeVaults.js'; // A3 Rune Citadel
export { MAP_MECHANICS, registerMapMechanic, MapMechanic } from '../mapMechanics.js';
