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

---

## Ready to paste

One block per file: paste it as is, attach `art/style/bot-reference.png`, save the result as the file named above
the block in `art/source/`.

### `room-back.png` (landscape canvas)

```text
Wide background of a dim underground workshop wall: dark wood panels and old bricks, a few framed posters too dark to read. 16:9, flat straight-on view, no foreground objects, nothing on the floor. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. No text, no labels.
```

### `room-shelves.png` (landscape canvas)

```text
A very wide, short strip of dark wooden wall shelves, about 6 times wider than tall, filled with boxes, jars, tools and small crates, seen straight on. Only the shelves, nothing below them. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `room-lamp.png` (portrait canvas)

```text
A single hanging industrial lamp with a brass shade on a long chain going straight up; the whole lamp with its chain is about 2.5 times taller than wide. Seen from slightly below, centered, the shade glowing softly. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `table.png` (landscape canvas)

```text
The front edge of a dark walnut workbench as a thin horizontal strip about 10 times wider than tall: rich wood grain on top, a brass trim along the bottom edge, seen from the front at a slight top-down angle. This strip is repeated side by side in the game, so its left and right ends must join seamlessly: no end caps, no corners, no legs, the grain and trim simply run off both edges. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `mat.png` (landscape canvas)

```text
A green felt work mat with stitched edges, about 3 times wider than deep, lying flat, seen from the front at a slight top-down angle, nothing on it. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `case-bootcamp.png` (landscape canvas)

```text
Sprite sheet, 1 row × 4 frames, the same small weapon case in every frame, each case slightly wider than tall, seen from the front at a slight top-down angle. Military olive-green case with stencil stripes and a brass lock. Frame 1: closed. Frame 2: lid lifting a little. Frame 3: lid half open with a warm glow inside. Frame 4: fully open, glowing inside. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `case-wildwood.png` (landscape canvas)

```text
Sprite sheet, 1 row × 4 frames, the same small weapon case in every frame, each case slightly wider than tall, seen from the front at a slight top-down angle. Forest-green case with carved wood panels, leaf details and a brass lock. Frame 1: closed. Frame 2: lid lifting a little. Frame 3: lid half open with a warm glow inside. Frame 4: fully open, glowing inside. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `case-bedrock.png` (landscape canvas)

```text
Sprite sheet, 1 row × 4 frames, the same small weapon case in every frame, each case slightly wider than tall, seen from the front at a slight top-down angle. Heavy grey stone-like case with glowing crystal accents and a brass lock. Frame 1: closed. Frame 2: lid lifting a little. Frame 3: lid half open with a warm glow inside. Frame 4: fully open, glowing inside. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `key.png` (landscape canvas)

```text
Sprite sheet, 1 row × 4 frames of the same small brass case key, each frame about as wide as tall. Frame 1: idle, lying at a slight angle. Frame 2: idle with a bright glint on the bow. Frame 3: turned 45 degrees. Frame 4: turned 90 degrees. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `sell-bin.png` (landscape canvas)

```text
Sprite sheet, 1 row × 4 frames of the same round brass-rimmed coin chute on a short stand, each frame taller than wide (about 2:3), marked only with a coin icon. Frame 1: idle. Frame 2: mouth opening. Frame 3: swallowing with a green glow. Frame 4: coins popping out of the top. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `tray.png` (landscape canvas)

```text
A long low wooden tray with brass corners for collecting items, about 5 to 6 times wider than tall, empty, seen from the front at a slight top-down angle. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `auto-seller.png` (portrait canvas)

```text
A small grinder machine that turns items into coins, a bit taller than wide (about 4:5): a funnel on top, brass gears on the side, a coin slot at the bottom, powered off with all its lights dark. Seen from the front at a slight top-down angle, 3/4 view. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `coin.png` (landscape canvas)

```text
Sprite sheet, 1 row × 4 frames of the same gold coin spinning, each frame about as wide as tall: frame 1 face-on, frame 2 three-quarter turn, frame 3 edge-on, frame 4 three-quarter turn the other way. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `bot-sleep-sheet.png` (landscape canvas)

```text
Using the attached robot as the exact same character (same body, colours and proportions): sprite sheet, 1 row × 4 frames of the robot asleep, sitting slumped, visor dark, antenna light off, in a slow breathing cycle — its body rises 1 to 2 pixels and falls back across the frames. Same 3/4 view facing right, each frame a little taller than wide. The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass and worn blue-grey metal, dark outlines, rich limited palette, soft warm light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-rifle.png` (landscape canvas)

```text
A single side-view assault rifle, facing right, centered, about 2.6 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-sniper.png` (landscape canvas)

```text
A single side-view bolt-action sniper rifle with a scope, facing right, centered, about 2.6 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-pistol.png` (landscape canvas)

```text
A single side-view compact pistol, facing right, centered, about 2 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-heavyPistol.png` (landscape canvas)

```text
A single side-view heavy large-calibre pistol with a long slide, facing right, centered, about 2 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-smg.png` (landscape canvas)

```text
A single side-view compact submachine gun, facing right, centered, about 2.2 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-shotgun.png` (landscape canvas)

```text
A single side-view pump-action shotgun, facing right, centered, about 2.6 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-mg.png` (landscape canvas)

```text
A single side-view light machine gun with a box magazine and a bipod folded under the barrel, facing right, centered, about 2.6 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `weapon-knife.png` (landscape canvas)

```text
A single side-view curved karambit-style knife with a finger ring, blade pointing right, centered, about 2.5 times longer than tall, in neutral greyscale shading only — no colour at all, a pattern will be painted onto it later. Clean, readable silhouette. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, dark outlines, soft light from above. Transparent background, no text, no labels, no drop shadow on the background.
```

### `ui-frame.png` (square canvas)

```text
A square panel frame for a game UI, designed to be 9-sliced: dark walnut wood with brass corner pieces and a thin brass inner border, all four sides identical in thickness, flat plain dark interior with no detail. Straight-on, perfectly square. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass, dark outlines, rich limited palette. Transparent background outside the frame, no text, no labels, no drop shadow.
```

### `ui-button.png` (landscape canvas)

```text
Sprite sheet, 1 row × 3 frames of the same rectangular brass game button with a dark inset in the middle, each button about 3 times wider than tall, straight-on. Frame 1: normal. Frame 2: hover, slightly brighter brass. Frame 3: pressed, pushed in with the highlight on the bottom edge. The middle stays plain (text is added in the game). The frames sit side by side in one row, evenly spaced, with clear empty transparent space between them (they must not touch or overlap). Every frame is the same object at the same size, standing on the same baseline. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, warm brass, dark outlines, rich limited palette. Transparent background, no text, no labels, no drop shadow on the background.
```

### `reel-frame.png` (square canvas)

```text
A square frame for a slot-machine window, designed to be 9-sliced: dark gunmetal with brass rivets at the four corners, all four sides identical in thickness, flat plain black interior. Straight-on, perfectly square. Same art style as the attached reference robot: high-detail hi-bit pixel art, crisp pixels, worn blue-grey metal, warm brass, dark outlines, rich limited palette. Transparent background outside the frame, no text, no labels, no drop shadow.
```
