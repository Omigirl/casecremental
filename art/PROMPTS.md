# Casecremental art prompts

Every prompt: attach `art/style/bot-reference.png` as the **style reference**, ask for a **transparent-background PNG**,
and save the result as `art/source/<file>` (file names below). Then run `npm run art` and check `art/preview/`.

Tools: ChatGPT (image generation) or the ElevenLabs MCP (`creative_generate_image`, model `gpt-image-2`, reference image
wired in; background removal with `birefnet-v2-bg-removal` if the background is not transparent).

**Shared style line** (append to every prompt):
> Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and
> worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background,
> no text, no labels, no drop shadow on the background.

| File | Prompt (then add the shared style line) |
|---|---|
| `room-back.png` | Wide background of a dim underground workshop wall, dark wood panels and bricks, a few framed posters too dark to read, 16:9, no foreground objects. |
| `room-shelves.png` | Wide strip of dark wooden wall shelves with boxes, jars, tools and small crates, seen straight on, 16:9 strip, nothing on the floor. |
| `room-lamp.png` | A single hanging industrial lamp with a brass shade, chain going up, seen from slightly below, centered. |
| `table.png` | A long dark walnut workbench top seen from the front at a slight top-down angle, brass trim along the front edge, wide format, nothing on it. |
| `mat.png` | A green felt work mat with stitched edges, seen from the same slight top-down angle, nothing on it. |
| `case-bootcamp.png` | Sprite sheet, 1 row × 4 frames, same weapon case each frame: 1) closed army-green case with a brass lock, 2) lid lifting a little, 3) lid half open with a warm glow inside, 4) fully open, glow inside. Military olive with stencil stripes. |
| `case-wildwood.png` | Same 4-frame sheet as the army case, but a forest-green case with wood and leaf details. |
| `case-bedrock.png` | Same 4-frame sheet as the army case, but a grey stone-like case with crystal accents. |
| `key.png` | Sprite sheet, 1 row × 4 frames: a small brass case key — 1) idle, 2) idle with a glint on the bow, 3) turned 45°, 4) turned 90°. |
| `sell-bin.png` | Sprite sheet, 1 row × 4 frames: a round brass-rimmed coin chute labelled only with a coin icon — 1) idle, 2) mouth opening, 3) swallowing with a green glow, 4) coins popping out of the top. |
| `tray.png` | A long low wooden tray with brass corners for collecting items, empty, seen from the same angle as the table. |
| `auto-seller.png` | A small grinder machine that turns items into coins: funnel on top, brass gears on the side, coin slot at the bottom, powered off (lights dark). |
| `coin.png` | Sprite sheet, 1 row × 4 frames: a gold coin spinning (face, three-quarter, edge, three-quarter). |
| `bot-sleep-sheet.png` | Using the reference robot as the exact character: sprite sheet, 1 row × 4 frames, the robot **asleep sitting slumped**, visor dark, antenna light off — a slow breathing cycle (body rises 1–2 px and falls). Same 3/4 view facing right, same size every frame. |
| `bot-open-sheet-2x4.png` | (already made) |
| `weapon-<id>.png` (8 files: rifle, sniper, pistol, heavyPistol, smg, shotgun, mg, knife) | A single side-view **<weapon>** in **neutral greyscale shading only** (no colour — a pattern will be painted onto it), clean silhouette, facing right, centered. For knife: a curved karambit-style knife. |
| `ui-frame.png` | A square 9-slice panel frame: dark walnut wood with brass corners and a thin brass inner border, flat dark interior, 48×48 look. |
| `ui-button.png` | Sprite sheet, 1 row × 3 frames of the same rectangular brass button with a dark inset: 1) normal, 2) hover (brighter), 3) pressed (pushed in). |
| `reel-frame.png` | A square 9-slice frame for a slot window: dark metal with brass rivets at the corners, flat black interior. |
