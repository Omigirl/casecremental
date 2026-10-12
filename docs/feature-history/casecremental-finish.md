# Casecremental — Finish (M4 + M5)

Spec: docs/superpowers/specs/2026-10-12-casecremental-finish-design.md · Plans: docs/superpowers/plans/2026-10-12-casecremental-f1-fixes.md (F1),
docs/superpowers/plans/2026-10-12-casecremental-f3-tutorial.md (F3)

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
  order satisfies both. Delay and key beat share one `clock`; it is reset to 0 whenever a case lands on the bench (the
  machine's buy, `Run.buyCase`, a Ricochet free case), so every locked case waits the full beat for its key.
- **It turns the key of any locked case on the bench**, hand-bought and Ricochet ones included, after the same beat
  (the final review fixed hand buys and free cases getting their key on the next tick when the clock stood past it).
- **It stays ON when broke** (status `broke`: BROKE on the shelf, the lamp blinks amber, the day job appears). It buys
  the moment it can: the delay stays due, so a tray claim restarts it at once (seen in the browser).
- **It buys nothing while the vault is out and affordable** (status `vault`: "Waits: vault", the lamp steady amber).
  Otherwise it would spend the vault's cash and keep the bench busy, and the vault's BUY needs an empty bench. While
  the vault is open the switch is disabled.
- **The pick** is the case it buys: the last case you bought by hand, or the one you ticked on the shelf. Machine buys
  never change it. When the pick is too dear it buys the dearest case it can afford and keeps the pick. With no pick
  yet (`null`), it buys the dearest affordable case. The tick exists because the BUY buttons are disabled while the
  machine keeps the bench busy; without it you could not change the pick once it ran. It is a tick on the case's icon
  (`PickIcon`), not a separate bar row. `CaseView.buys` marks the case auto-spin would buy now (only while it is ON) and
  `framedCase` gives that one the gold frame, else your pick while nothing is affordable.
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
  - **Found, then fixed in 0c6fcce and the final-review wave** (0c6fcce re-measured in F3's browser pass, see F3):
    - The pick box was a full-width bar (`.cc-row` is a CSS grid, so `flex: none` did nothing). It is now the tick on the
      case icon.
    - The Run 1 shelf at 1920×1080 overflowed (1065/882 px), so Vault Case I's BUY sat below the fold while "Waits:
      vault" showed at the top; the phone drawer was the same. `shelfUrgent` now puts the vault row and the day job at the
      top while the vault is affordable (`canBuy` or `blockedBy: "bench"`) or the day job is on offer. It keys on
      affordability, not on the bench: the first version used `canBuy`, which flickers with the bench, so the rows jumped
      under the player's finger and a mis-tap could buy the vault. F3's browser pass measured the fold fix: it holds.
    - The bench hint was hidden whenever auto-spin was on. It is now hidden only while `autoSpinStatus === "on"`, so it
      shows while the machine waits (`broke`, `vault`) or is off.
    - The `broke` lamp blinks, but the HD glow stays steady amber (`glowColor`): a 60 px additive glow flipping
      amber/dark red at 2 Hz broke the "pulsing light changes < 0.1 per beat" rule.

## F3 — tutorial (2026-10-12)

Nine coach bubbles with a pixel arrow, and a one-tap "what's new" card when Runs 2, 3 and 4 first start. EN and RU,
skippable, replayable from Settings. Spec §4. The step machine is `ui/tutorialRules.ts`, targets are in
`ui/tutorialTargets.ts`, placement is in `ui/tutorialPlace.ts`, and the overlay is `ui/Tutorial.tsx` and `ui/NewRunCard.tsx`.

- **Progress lives in prefs (`Prefs.tutorial`), per browser.** A new browser or cleared site data teaches again; the run
  save is never touched. `null` means "never stored", and that is what triggers seeding.
- **The bench loop (buy → key → sell) runs in order. Steps 4–9 are independent:** each waits until it can be done, and
  the first one ready (in spec order) shows. A strict 1→9 chain stalls: a player who skips the auto-seller before the
  vault appears would never see step 9, and one who can wake the bot before the next case unlocks would see nothing.
- **A step ends on an event or on the state, never a timer.** The state check (`settle`, e.g. `bot.awake`) also passes a
  step the player did before its bubble came up. Step 3 ends however the card leaves the bench (a hand sale, a tap, the
  auto-seller, the tray, the locker), so a machine taking the card cannot strand it. Step 9 is the only bubble with OK:
  "this is the run's goal" has no action of its own, and buying the vault can be many minutes away (buying it ends it too).
- **"Wake the bot" points at WAKE, not the sprite.** Waking happens only on the Bot tab; tapping the bot on the table does
  nothing, so an arrow at the sprite would lead to a dead end.
- **Target chains, deepest first.** A step lists targets like `upgrade:<id>` → `tab:you` → `drawer:upgrades`. The overlay
  points at the first one on screen: a closed tab's rows are not rendered, so the arrow lands on the tab, and moves to the
  row once the tab opens. One rule covers desktop (YOU / BOT / MACHINES) and the phone drawer (CASES / UPGRADES). DOM
  targets are `data-tut` attributes, set through `PxButton`'s `tut` prop. `ui/tutorialMarks.test.ts` keeps the marks in
  step with the ids the rules use. A target row scrolled out of its `.cc-scroll` list is scrolled into view once
  (`scrollTop`, never `scrollIntoView`, which would also scroll the overflow-hidden panels).
- **World targets** (the case on the mat, the bench card, the bin) are `tableLayout` rects × the pixel scale
  (`toScreen`) → `cameraPoint` (the point form of `cameraCss`). The overlay sits outside the camera's lens on purpose: DOM
  rects already include the camera transform, so wrapping the overlay in it would apply the camera twice.
- **Seeding on F3's first load.** A save that has played past the bench loop (Run 2+, any upgrade, a second case, the bot
  awake or the seller on) marks steps 1–3 done. Every step the state shows done is marked too, and the cards for runs up
  to the current one count as seen. A brand-new save gets nothing marked.
- **Skip vs Replay.** Skip hides the bubbles but keeps the new-run cards (they announce content and close with one tap).
  Replay sets `done: []` and `off: false` and keeps the cards already seen. Steps the state already shows done (an awake
  bot) pass at once.
- **Nothing shows** while the vault is out or after the run, while Settings or the dev sound board is open, or for
  `UI_BACK_S + 0.6` s while the panels fade back in after a vault. The progress keeps settling and hearing events
  meanwhile. The bubble takes the pointer only on its buttons, so a click or a drag under it goes through.
- **Run 4's card** (`card.run4`) is written but cannot show until F6 sets `LAST_RUN = 4`; the i18n tests cover its strings.
  Its Russian case names (Глитч, Горячка) are F3's guess: **F6 must keep `card.run4` in step with the names it gives
  cases 8 and 9 in `i18n/content.ts`.**
- **Browser pass (Task 5)** tested an exported copy of d5585e4, in headless Chrome. Screenshots are in
  `.superpowers/harness/shots/f3/` (scratch, not committed).
  - Every step in EN and RU at 1920×1080, 1024×768 and 390×844, including the second hop behind a tab (BOT → WAKE,
    MACHINES → seller / auto-spin; on the phone, the drawer's UPGRADES → the sub-tab → the row). The bubble never
    covered its current target (DOM rect check on every shot). The arrow pointed at the right element. On the phone
    every bubble was above or below its target. RU text wraps into at most 3 lines.
  - During a ★ reveal (camera zoom 1.3 plus the focus glide), the step 3 arrow stayed 6 px above the card's projected
    rect on every 100 ms sample. Steps advance only on actions: after a sale at $5 nothing appeared for 10 s; the
    upgrades bubble came once cash covered an upgrade and left when one was bought.
  - Skip hid everything. Replay closed Settings and brought back "Tap a case". Switching to RU re-placed the bubble
    (wider, so it moved below the case). Resizing 1920 → 390 → 1280 kept the upgrades bubble on its row or the drawer
    tab. A drag to the bin through the bubble sold the card, and a tap on a BUY under a phone bubble bought the case.
  - The Run 2 and 3 cards show once each, and one tap closes them. Returning players (prefs cleared, save kept) were
    seeded right: Run 2 with the bot awake gave `done: buy, key, sell, bot`, cards `[2]`, and no intro, card or wake
    bubble; a Run 1 save with only the seller gave `buy, key, sell, seller`. A reload mid-loop shows the coach at once.
    The console showed only the known PixiJS "destroyed while still bound" warning on resize.
  - Bubbles regularly cover rows next to their target (the Appraiser row under the upgrades bubble, the Bot/Machines
    row's label above WAKE / the seller's BUY, the drawer tabs on the phone, Boot Camp's BUY under "Unlock the next
    case"). That is allowed (only the target must stay clear), and clicks pass through. At 1024×768 the step 1 and 9
    bubbles sit over the HUD's run label in the top right.
  - F2's 0c6fcce, re-measured: the pick is a tick in the case icon's corner (no bar). With all Run 1 cases unlocked,
    auto-spin on and the vault affordable, Vault Case I's BUY is in view without scrolling at 1920×1080 and 1024×768, and
    the vault row and DAY JOB are in view in the 390×844 drawer. "Buy a case" shows while auto-spin waits (vault) or is
    BROKE. The case auto-spin buys is framed and follows the pick. **Open (minor):** while it waits for the vault, the
    case it would buy otherwise (Bedrock) is still framed, in the same gold as the vault row's frame. So two gold frames
    show at once, and one marks a case that is not being bought.

## F5 — music for the late stages

Stages 3-5 each play a three-loop playlist instead of one loop, Run 4's stage 5 adds a finale loop, and a credits track
waits for F6-C. Spec §6; plan `docs/superpowers/plans/2026-10-12-casecremental-f5-music.md`.

- **The eight tracks.** Made with ElevenLabs `eleven_music_v2_5`, instrumental, one take each (generated outside the
  plan; the credits spent are not recorded). The prompts and the ffmpeg recipes (gain, limiter, trim, fade) are in
  `art/manifest.json`; the raw takes are in `art/source/audio/*-take-1.mp3`. No loop was built with the ffmpeg
  fallback. Measured: every loop is exactly 32.000 s; means 3b/3c -13.6 dB (3's first loop -13.3), 4b/4c -13.1
  (-12.8), 5b/5c/finale -15.1 (-14.8); the credits are 73.2 s at -16.2 (the prestige loop -16.1). Peaks -0.7 to
  -3.4 dB. Never re-encode them in the repo (mp3 padding breaks the loop point).
- **Naming.** `music-<stage>-<n>` (the first loop stays `music-<stage>`), `music-finale`, `credits`: `indexAudio`'s
  variant convention builds the playlists from the file names, so adding a loop is dropping a file.
- **Playlist rules.** A loop plays twice (64 s), then the next hands over on the bar line nearest its end with the
  existing one-bar crossfade. Each stage keeps a cursor, so coming back to a stage brings its next loop, not the same
  one. A stage change cancels a pending hand-over (the loop scheduled on the audio clock up to `SWAP_LEAD` early never
  plays, and its stage hears it first next time). A hidden tab keeps the current loop looping (no frames, no `tick`);
  the swap lands on the next bar line from the moment frames return. A loop that fails to decode is skipped, never
  silence. Nothing is saved: a reload starts at the first loop. The finale is stage 5's last playlist entry from Run 4
  on, never before.
- **The seam.** `World.update` calls `audio.tick(run)` once a frame. That one call is both the clock and the run
  number, so `fx/audio/` never imports the sim. The playlist code lives in `fx/audio/stageMusic.ts` (pure rules in
  `schedule.ts`).
- **`credits`** has `TRACK_GAIN` 1 and is played by F6-C with `setTrack("credits", { loop: false })` (a one-shot).
- **Sound board** (dev): Music row Sober..Unhinged, Next loop (skip to hear a hand-over), Credits; Loops row 3·1 ..
  5·3, 5·F audition one loop held. Closing it hands the music back to the game's stage.
- **Checked by a machine:** the board's rows and buttons render and every button runs without console errors; all
  eight files are served (200). The playlist timing is unit-tested. Nothing was heard (the tab is muted).
- **Known by ear-less inspection, listen for them:** loop seams unchecked by ear; `music-3-2`'s last second is about
  3 dB quieter; the credits are dynamically flat (no clear build and peak).
- **Listening checklist (headphones, dev build, music and effects at default):**
  1. Each loop on its own (Loops buttons): seamless at the 32 s seam (no click, gap or jump); A minor, 120 BPM, the
     stage's instruments (Rhodes and round bass throughout; High funk-house, Tripping psychedelic synth-funk, Unhinged
     big-room funk); 5·F a climax, not a different game.
  2. Level: switch 3·1/3·2/3·3, 4·1/4·2/4·3, 5·1/5·2/5·3/5·F. None jumps out or drops away (matched within ~1 dB).
  3. Hand-overs: play High, press Next loop a few times. Each new loop enters on a downbeat with a one-bar blend: no
     flam, no tempo wobble, no key clash. Repeat for Tripping and Unhinged. Let one stage run ~2½ min untouched: loop 1
     twice, loop 2 twice, then loop 3.
  4. Stage changes in play: a change still lands on a bar line, and going back to a stage brings a loop you did not
     just hear.
  5. Credits: warm and triumphant in A major; builds, peaks mid-way, ends cleanly (no cut-off, no loop); level close
     to the prestige loop's.
  6. Vault hand-back: open a vault and play into the next run. The intro, fanfare and prestige play over silence, with
     no stage loop bleeding through for a bar.
- **Verdict:** not yet listened to by a human.
