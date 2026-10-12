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
  - Found open at this check, fixed in 7f68f2d (the last reel to land got no landed look) and 2bfe0bd (a tapped tray
    claim's coins started at the tray centre). Constraint worth keeping: the sim leaves `spinning` (and the bot clears
    its `spin`) in the tick that ends the spin, so no frame ever reaches fraction 1. Reel views must snap on the first
    frame after the spin (the `spun` flag and `Reel.land()`); a new spin started in the same frame as the old one ends
    must call `land()` first or keep one frame of `revealed`.
  - Harness notes: headless SwiftShader renders about 5 fps, so the sim crawls (one frame is capped at
    `MAX_FRAME_SECONDS`). A frame-sized effect can be slowed by importing its module at the same URL Vite serves it and
    wrapping its prototype (`TrayView.prototype.update` with `dt × 0.08`). Headless windows will not go narrower than
    500 px, so portrait shots need `Emulation.setDeviceMetricsOverride` set inside the same CDP session that navigates
    and shoots. The override drops when the socket closes.

## F2 — auto-spin replaces the auto-buyer grid (2026-10-12)

Plan: docs/superpowers/plans/2026-10-12-casecremental-f2-autospin.md · spec §3.

- **Why the grid went.** The user found the auto-buyer grid unconfigurable: a 50-cell machine that bought for you, with
  only ticks and a reserve to steer it. It is gone from every run: station, rows, shelf ticks, sim, events, sounds, art
  and tests. Run 3 keeps its other content (multi-open ×5, bot speed ×50, the auto contract). Auto-spin is the
  replacement: one machine for your own bench, with a switch and a pick.
- **The order of its beats.** The bench empties, the Delay runs (1.5 s, down to 0.2 s over 5 levels), it buys, and a
  fixed 0.5 s key beat (`AUTOSPIN_KEY_SECONDS`) follows, so the case visibly lands before the arm turns the key. The
  spec says both "waits its delay, and turns the key" and "Delay between the bench emptying and the next buy". This
  order satisfies both. Delay and key beat share one `clock`.
- **It turns the key of any locked case on the bench**, hand-bought and Ricochet ones included. A hand buy while the
  clock already stands past the beat gets its key on the next tick, with no beat. That is cosmetic and was left alone.
- **It stays ON when broke** (status `broke`: BROKE on the shelf, the lamp blinks amber, the day job appears). It buys
  the moment it can: the delay stays due, so a tray claim restarts it at once (seen in the browser).
- **It buys nothing while the vault is out and affordable** (status `vault`: "Waits: vault", the lamp steady amber).
  Otherwise it would spend the vault's cash and keep the bench busy, and the vault's BUY needs an empty bench. While
  the vault is open the switch is disabled.
- **The pick** is the case it buys: the last case you bought by hand, or the one you ticked in the shelf's pick box.
  Machine buys never change it. When the pick is too dear it buys the dearest case it can afford and keeps the pick.
  With no pick yet (`null`), it buys the dearest affordable case and no shelf row has the gold frame. The pick box
  exists because the BUY buttons are disabled while the machine keeps the bench busy. Without it you could not change
  the pick once it ran.
- **The switch is on the case shelf** (top of the list, and on the Machines row) because BUY lives there. The bench
  has no BUY button for it to sit beside. A tap on the arm flips it too. It is off after purchase and keeps its state
  for the run. A new run starts with auto-spin not owned.
- **`powered`** makes the power-on (green flash through the flash gate, sparks, `seller-power-on`) happen once a run.
  It is event-driven (`autoSpinToggled` with `first`), so a reload never replays it. **`clock`** is saved, so a reload
  resumes mid-delay or mid key beat.
- **The arm is drawn in code** (`fx/pixel/armArt.ts`, no image generation): frame 0 rest, 1 lever pulled (0.25 s after a
  buy), 2 arm swung out over the case (0.3 s after the key). It is bolted to the mat's right end
  (`layout.ts` `armRect`). The mat is at least 48 px wide, so the arm always clears the case. Lamp: green on, dark red
  off, amber `vault`, amber blinking at 2 Hz `broke`. The lamp is 2 px, far under the full-screen flash rule.
- **Save v5.** A v4 save drops the grid with no refund and gets a fresh auto-spin.
- **The greedy pacing player** (`sim/bot.ts`) buys auto-spin after the seller and keeps it on. From then on the bench
  belongs to the machine, and the player shops whenever it is free. That made runs faster (0.2 s + 0.5 s beats the
  model's 0.3 s buy + 0.4 s key), so `VAULT_PRICES` went to 1.2M / 2.4B / 800B and Neon Nights' unlock to 2M (Run 3's
  catch-up stays above 1 min). Medians over 5 seeds: Run 1 bot 132 s, seller 193 s, auto-spin 278 s, vault 455 s;
  Run 2 vault 386 s; Run 3 catch-up 72 s, vault 388 s; Run 3 replay vault 384 s. F4 retunes for real players.
- **Browser check** (headless Chrome over CDP, the scratch harness served from an export of the committed HEAD, since
  another agent was editing the working tree):
  - **Passed, at 1920×1080, 1024×768, 1280×720, 820×1180 and 390×844, EN and RU:**
    - "Needs auto-seller" / «Нужен автопродавец» → "Opens your cases" → Switched off / OFF / Delay 1.5 s, up to 0.2 s and
      MAX.
    - The arm appears on the mat's end with a dark red lamp. Lever pull and arm swing were caught with the arm's
      `update` slowed (`05-frame1-pull.png`, `05-frame2-swing.png`).
    - The first ON gives sparks and `seller-power-on`. Later toggles give only `bot-servo`. A tap on the arm switches
      it. After a reload the switch is still ON, `powered` stays true, and nothing replays.
    - The pick moves the gold frame, and the next buys are the picked case. Multi-open buys at full width (×2 in Run
      1, ×5 Inferno in Run 3, five reels).
    - Holding the bench card for 8 s: nothing bought. BROKE / НА МЕЛИ and DAY JOB / ШАБАШКА show, and a claim resumes it.
      "Waits: vault" / «Ждёт: сейф» shows with the lamp steady amber, the switch is disabled while the vault is out,
      and Run 2 starts without auto-spin.
    - Run 3: no grid anywhere. The Machines tab shows seller, auto-spin, locker and auto contract. Bot ×50 and ×5 both
      work. Vault II's list reads Deep Space, Inferno, Auto contract, Multi-open up to x5, Bot speed up to x50.
    - Console clean.
  - **Found, open:**
    - The pick box is a full-width bar. `.cc-row` is a CSS grid, so its `flex: none` does nothing. The bar holds a
      lone tick, and its only label is a hover tooltip.
    - Each unlocked case gains one bar row. With the shelf's auto-spin row, the Run 1 shelf at 1920×1080 overflows
      (1065/882 px). Vault Case I's BUY sits below the fold while "Waits: vault" shows at the top, and scrolling to
      the vault hides that status. The phone drawer is the same: the vault row and the day job sit below the fold.
    - The bench hint is hidden whenever auto-spin is on, even in `broke`/`vault` (Task 6 review minor).
