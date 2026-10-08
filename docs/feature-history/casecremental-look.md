# Casecremental — look, layout, animation, EN/RU, audio (M2a)

Spec: docs/superpowers/specs/2026-10-08-casecremental-m2a-look-design.md · Plan: docs/superpowers/plans/2026-10-08-casecremental-m2a-look.md
Changes agreed during the M2a review: campaign spec `2026-10-08-casecremental-campaign-and-table-design.md` §6.0.

## Why it is built this way
- **Two layers.** The pixel world (room, table, props, reel, bot) renders at 180 px tall into a render
  texture and is shown at an integer scale with nearest sampling; light, dust, glow, sparks, coins and
  text are an HD layer on top. The user wanted hi-bit pixel *assets* with smooth modern *effects*.
- **Pixel sprites never scale or rotate inside the pixel world.** Two 2.5D exceptions the user asked
  for: the camera zooms the whole scene on big moments (Covert punch, ★ push-in, a tease's lean), and a
  dragged item is lifted into the HD layer where it glides, leans and casts a shadow. Motion = drawn
  frames + whole-pixel nudges with per-frame timing (`fx/pixel/anims.ts`). Characters bob in
  head/body/legs bands; the head band is cut one row taller to hide the seam (the user saw a "neck cut"
  in an early demo).
- **The camera moves the whole screen.** `fx/camera.ts` carries the scene's focus, shake and zoom to the
  React overlay, so the HUD and side panels zoom with the table; modals, the dev board, the combo tint
  and the vignette stay put.
- **Art pipeline, "v2 recipe".** ChatGPT sources → `npm run art`: area downscale, hard alpha, posterize
  step 48, 1 px #120e10 outline; characters 48 px. The user picked v2 over smoother/lower-res variants.
- **No art for the UI chrome or the weapons** (user, after the review): panels and buttons use the pixel-bevel
  CSS fallback, the reel window is drawn in code (`fx/pixel/drawn.ts`), and weapons stay code-drawn
  silhouettes that the skin patterns are painted onto. The optional art hooks for them remain in the code.
  `art/manifest.json` lists 15 assets.
- **Animated skins** (`fx/skins/motion.ts`, spec `2026-10-08-casecremental-animated-skins-design.md`): a skin's
  optional `motion` (pattern: flow / shimmer / pulse / sparkle; weapon: bob / recoil / bolt / flip) is baked
  into a short whole-pixel loop from the weapon's silhouette and played only on the reveal card (never on the
  reel). Still skins render exactly as before. In cases 1–3 only the ★ knives move (shimmer + flip at 5 fps,
  user: "they are rare anyway"); richer finishes are for the later cases. A ★ knife also makes an entrance
  (`fx/hd/knifeFlight.ts`): it flies out of the card in the HD layer — spin, 2.5D flip, ~2× — and lands back.
- **Code eyes.** The painted eyes are erased in the pipeline and redrawn in code (2×3 blocks on a 5×5
  visor patch, level, open/half/closed/happy, blinking) — the user preferred them to painted eyes.
- **Press Start 2P everywhere, bundled** (the embedded game may only reach platform hosts). Monospace,
  so every string has a character budget (`i18n/budgets.ts`), enforced by tests in both languages. The
  side panels are at least 64 world px wide (`PANEL_CHROME`, layout test "room for an 11-character
  line") — the plan's 56 px clipped its own strings in the browser.
- **EN + RU.** Same K/M/B suffixes, decimal comma in RU. Canvas text is rebuilt from state every frame,
  so a language switch mid-spin shows at once. The HUD animates cash in cents (`ui/cash.ts`): the SDK's
  `useAnimatedNumber` rounds to whole numbers.
- **No brake** (user: it made Quick Hands pointless). The reel always runs its full spin; base 3 s keeps
  the pacing targets.
- **Teasing spin** (`sim/tease.ts`). A red or a knife always teases — the last ~six cards wind down slowly
  (`fx/reel/motion.ts`) and the camera leans toward the reel — by rarity × how close the case is to the
  player's top unlocked one. 1 in 40 ordinary drops fake it with a decoy beside the winner, stopped a
  sliver short or crept a sliver past (`fx/reel/strip.ts`). Decided in the sim with the drop, so the reel
  and the reveal stay in step and pacing stays deterministic; a tease's crawl never costs the combo
  (without that, the crawl broke combos and pushed pacing past its Wildwood target).
- **Boot Camp jump-starts a run:** Mil-Spec 0.95× its price, knife 120× (`CASE_VALUE_MULT`); later cases
  keep the base table.
- **Audio** is ElevenLabs-generated (not 8/16-bit), prompts in `art/manifest.json`. The engine is
  silent-safe: no AudioContext, blocked autoplay or a broken file never breaks the game. The brake
  thud lives on as the reel's landing thud (`reel-stop`).
- **Dev board** (Settings → SOUND BOARD (DEV), dev builds only): every sound variant played exactly,
  both loops, and a forced next drop (Pink / Covert / ★ / Fake) to see the big moments on demand.
- **Prettier** formats this game's code and `tools/` before every commit (`.githooks/pre-commit`,
  enabled by `npm install`); the platform's own files are excluded because the module lock
  fingerprints them.

## Constraints and open items
- Sprites missing from `assets/sprites` render as magenta placeholders (never a crash). The art
  (plan Task 3) is still to come from the user's ChatGPT sessions.
- The bot's hop in `bot-open` is mistimed (crouch → takeoff → peak hold) — re-time it in M3 when the
  bot wakes up.
- Music loops are generated, not hand-looped: if a loop seam clicks, re-roll that loop. They came back
  at 192 kbps (spec: 96–128) — under 1 MB each, kept.
- M2b: the **day job** replaces the free-case anti-softlock (campaign spec §6.1).
- At 800×450 the platform's back button overlaps the Upgrades title.
