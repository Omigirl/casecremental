# Casecremental art prompts

Every prompt: attach `art/style/bot-reference.png` as the **style reference**, ask for a **transparent-background PNG**,
and save the result as `art/source/<file>` (file names below). Then run `npm run art` and check `art/preview/`.

Tools: ChatGPT (image generation) or the ElevenLabs MCP (`creative_generate_image`, model `gpt-image-2`, reference image
wired in; background removal with `birefnet-v2-bg-removal` if the background is not transparent).

**Shared style line** (append to every prompt):
> Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.

**Shape matters, the canvas doesn't.** The art build crops every image to the drawn object and scales it to the
game's size, so the **object's own proportions** must match the "Shape" column; empty transparent space around it is
fine. Pick ChatGPT's **landscape** canvas for wide objects and every sprite sheet, **portrait** for tall ones, square
otherwise.

**Sprite sheets** (append to every sheet prompt):
> The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must
> not touch or overlap). Every frame is the same object at the same size, standing on the same baseline.

| File | Shape (object) | Prompt (then add the shared style line) |
|---|---|---|
| `room-back.png` | 16:9 | Wide background of a dim underground workshop wall, dark wood panels and bricks, a few framed posters too dark to read, 16:9, no foreground objects. |
| `room-shelves.png` | very wide strip, ~6:1 | A very wide, short strip (about 6 times wider than tall) of dark wooden wall shelves with boxes, jars, tools and small crates, seen straight on, nothing on the floor. |
| `room-lamp.png` | tall, ~2:5 | A single hanging industrial lamp with a brass shade, a long chain going straight up (the whole thing about 2.5 times taller than wide), seen from slightly below, centered. |
| `table.png` | thin wide strip, ~10:1, **seamless left↔right** | The front edge of a dark walnut workbench as a thin horizontal strip about 10 times wider than tall: wood grain with a brass trim along the bottom edge, seen from the front at a slight top-down angle. It is tiled sideways in the game, so the left and right ends must join seamlessly (no end caps, no corners). |
| `mat.png` | ~3:1 | A green felt work mat with stitched edges, about 3 times wider than deep, seen from the same slight top-down angle, nothing on it. |
| `case-bootcamp.png` | sheet, 4 frames, each ~6:5 | Sprite sheet, 1 row × 4 frames, same weapon case each frame (each case slightly wider than tall): 1) closed army-green case with a brass lock, 2) lid lifting a little, 3) lid half open with a warm glow inside, 4) fully open, glow inside. Military olive with stencil stripes. |
| `case-wildwood.png` | sheet, 4 frames, each ~6:5 | Same 4-frame sheet as the army case, but a forest-green case with wood and leaf details. |
| `case-bedrock.png` | sheet, 4 frames, each ~6:5 | Same 4-frame sheet as the army case, but a grey stone-like case with crystal accents. |
| `key.png` | sheet, 4 frames, each square | Sprite sheet, 1 row × 4 frames: a small brass case key — 1) idle, 2) idle with a glint on the bow, 3) turned 45°, 4) turned 90°. |
| `sell-bin.png` | sheet, 4 frames, each ~2:3 (taller than wide) | Sprite sheet, 1 row × 4 frames: a round brass-rimmed coin chute on a short stand, taller than wide, labelled only with a coin icon — 1) idle, 2) mouth opening, 3) swallowing with a green glow, 4) coins popping out of the top. |
| `tray.png` | ~5.5:1 | A long low wooden tray with brass corners for collecting items, about 5 to 6 times wider than tall, empty, seen from the same angle as the table. |
| `auto-seller.png` | ~4:5 (a bit taller than wide) | A small grinder machine that turns items into coins, a bit taller than wide: funnel on top, brass gears on the side, coin slot at the bottom, powered off (lights dark). |
| `coin.png` | sheet, 4 frames, each square | Sprite sheet, 1 row × 4 frames: a gold coin spinning (face, three-quarter, edge, three-quarter). |
| `bot-sleep-sheet.png` | sheet, 4 frames, each ~5:6 | Using the reference robot as the exact character: sprite sheet, 1 row × 4 frames, the robot **asleep sitting slumped**, visor dark, antenna light off — a slow breathing cycle (body rises 1–2 px and falls). Same 3/4 view facing right, same size every frame. |
| `bot-open-sheet-2x4.png` | — | (already made) |
| `weapon-<id>.png` (8 files: rifle, sniper, pistol, heavyPistol, smg, shotgun, mg, knife) | long and thin: rifle / sniper / shotgun / mg ~2.6:1, smg ~2.2:1, pistol / heavyPistol ~2:1, knife ~2.5:1 | A single side-view **<weapon>** in **neutral greyscale shading only** (no colour — a pattern will be painted onto it), clean silhouette, facing right, centered, about <ratio> times longer than tall. For knife: a curved karambit-style knife. |
| `ui-frame.png` | square | A square 9-slice panel frame: dark walnut wood with brass corners and a thin brass inner border, flat dark interior, 48×48 look. |
| `ui-button.png` | sheet, 3 frames, each ~3:1 | Sprite sheet, 1 row × 3 frames of the same rectangular brass button (about 3 times wider than tall) with a dark inset: 1) normal, 2) hover (brighter), 3) pressed (pushed in). |
| `reel-frame.png` | square | A square 9-slice frame for a slot window: dark metal with brass rivets at the corners, flat black interior. |
