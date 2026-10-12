# Casecremental — Finish (M4 + M5)

Spec: docs/superpowers/specs/2026-10-12-casecremental-finish-design.md · Plans: docs/superpowers/plans/2026-10-12-casecremental-f1-fixes.md (F1)

## F1 — fixes (2026-10-12)

- **The scrollbar flash was the button spring.** `PxButton` scaled to 1.12 with an elastic settle, so a full-width buy button
  stuck out of `.cc-scroll` (overflow-y auto ⇒ overflow-x auto too). Panel buttons now press in and ease back, never past 1
  (`PRESS`), and `.cc-scroll` has `overflow-x: hidden`, `scrollbar-gutter: stable` and 2 world px of block padding. The
  HUD's cash counter keeps the spring: it is not in a scroll area.
- **No text selection:** `.cc-root` and the canvas (`fx/noSelect.ts`); inputs opt back in.
- **Reel cells follow the reel's height** (`fx/reel/cellLook.ts`): full art from 16 px of window, shrunk art
  (`fx/skins/thumb.ts`, an area average — nearest-neighbour was the noise) down to 6 px, plain rarity tiles below. Under
  16 px the reel draws a 1-px frame (the 6-px nine-slice squashed into noise). Cells always have a dark 2-px gap; the
  marker has a dark backing. Short strips use 24-px cells, still wide enough for a fake tease's 0.43 sliver. The compact
  window after landing keeps every reel (×5 → tiles); it does not fold to one.
- **The golden column at ×5 was the sale coins** (12×22 spinning frames) flying from the auto-seller to the HUD over the
  reels. Coins now fly in the pixel world, under the reels and the bench's cards (`Coins.flyers`); the amounts stay HD.
- **The tray moves** (`fx/pixel/trayRules.ts`, pure; `Tray.ts` draws it): art per slot (about 8×3 px in a 10×7 slot), a 0.3 s
  ease-out slide from the card's spot with a 6-px arc and a 2-px hop, tray-store as it lands (moved from the event, throttled
  0.1 s), a 0.25 s pop to 1.6× on a claim (at the drop point when dragged; the coins start there), Covert/★ glow and the
  full-tray red frame both swinging 0.09 peak to peak (photosensitivity), "TRAY FULL" steady in red. A resize settles
  everything; a card still sliding cannot be grabbed. Grid stores do not slide (F2 removes the grid).
- **Browser check** (scratch harness, `.superpowers/harness/`: `npm run dev`, Chrome with `--remote-debugging-port=9333`,
  `node .superpowers/harness/cdp.mjs …`; query `state=midspin|revealed&n=2|3|5&tray=full|some&seller=<rarity>&freeze=<ms>`):
  - Passed at 1920×1080 and 390×844: every stacked strip shows separate cells with dark gaps. ×2/×3 show full art, ×5
    mid-spin shows shrunk art that is still recognisable, and the ×5 compact window after landing shows clean tiles. The
    gold marker reads on every tile. The 1-px thin frame reads against the table, so it stays as it is (no dark outer row).
  - Coins pass behind the reel windows. The ×5 auto-seller cast shows no coin over a marker. Stored cards slide from the
    bench to their slots.
  - Tray: art on every slot; the red frame and the Covert/★ glow move softly, with no blink (sampled pixels change by a
    few levels over 1.2 s); "TRAY FULL" / «ЛОТОК ПОЛОН» stays steady.
  - A buy never grows a scroll area: `scrollHeight` stays the same and `overflow-x` stays hidden for 1.2 s after a click,
    last row included. The You tab at 1920×1080 (978/804 px) and the Upgrades list at 390×844 (290/270 px) really
    overflow, so their scrollbar is always there. That is real scrolling, not the flash, and it happens without F1's
    padding too. `user-select` is `none` on the root and the canvas. The console shows only the old PixiJS
    "destroyed while still bound" warning on a resize.
  - Found open at this check: (1) the reel that lands last only shows the winner outline and dimming when a frame
    happens to catch a sim step with `elapsed < fullDuration` and `reelFraction ≥ 1`. The sim's 1/30 s steps reach
    2.999… for a 3 s spin, and that is the only reason a plain spin ever shows it. A spin that is not a whole number of
    sim steps long (a tease's extra seconds) or a frame that runs two sim steps lands with no outline, and ×2 never
    showed it in headless Chrome. (2) A tapped tray
    claim's coins and "+$" start at the tray's centre, not at the slot: `TrayView.items` is the sim's own `state.tray`
    array, so `claimed()` looks the card up after `claim()` has already spliced it out. The pop itself grows and fades
    at the slot.
  - Harness notes: headless SwiftShader renders about 5 fps, so the sim crawls (one frame is capped at
    `MAX_FRAME_SECONDS`). A frame-sized effect can be slowed by importing its module at the same URL Vite serves it and
    wrapping its prototype (`TrayView.prototype.update` with `dt × 0.08`). Headless windows will not go narrower than
    500 px, so portrait shots need `Emulation.setDeviceMetricsOverride` set inside the same CDP session that navigates
    and shoots. The override drops when the socket closes.
