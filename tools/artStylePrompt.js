// OWNER'S CHIBI STYLE-CONVERSION PROMPT — turns a high-quality generated character into the game's
// chibi pixel-art sprite style. This is step 1 of 2 (step 2 = animate from the walk sheet).
//
// Use it in the image generator together with the character art from step 1. It is a STYLE prompt, not an
// animation prompt: it fixes the sprite language (proportions, palette, outline, pixel density) so every
// later animation sheet stays identical.
//
// WHY A DEDICATED BLOCK: without it the generator keeps returning detailed painted art, which the game's
// builder downscales into noise. The builder normalises to canvas 160x160 with a ~58 px body and a hard
// pixel edge, so the source must already be that language.
export const CHIBI_STYLE_PROMPT = `
Convert this character into a 2D chibi pixel-art game sprite for a top-down action RPG.

STYLE:
- chibi proportions: large head (about 1/3 of the body height), short limbs, compact readable silhouette
- crisp pixel art, hard pixel edges, no anti-aliasing, no blur, no smooth gradients
- clean black outline around the whole figure, consistent line weight
- limited palette: deep shadow tone, mid tone, highlight tone, one accent colour
- simple shading: two or three tones per material, nothing more
- strong, readable silhouette at small size, no tiny detail that will vanish
- game sprite, production ready for HTML5 Canvas 2D

OUTPUT:
- 4 rows x 6 columns sprite sheet
- ROW 1 FRONT/SOUTH, ROW 2 BACK/NORTH, ROW 3 LEFT/WEST, ROW 4 RIGHT/EAST
- 6 frames per row, all frames the same canvas size
- character centred, feet near the bottom of each frame, feet on the same ground line in every frame
- transparent background only
- NO text, NO labels, NO grid lines, NO floor, NO shadow, NO environment, NO UI, NO watermark
`;
