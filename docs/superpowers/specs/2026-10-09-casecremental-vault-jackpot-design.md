# Casecremental — the vault as a jackpot (design)

Replaces the opening part of rework spec §4. The key phase is unchanged: the vault slams in and the player drags
the devil key into the lock by hand. The end is unchanged too: blackout, prestige over black, the lights
flickering back on. What changes is everything between the key turning and the blackout.

Source: the user's Vampire Survivors "legendary chest" guide, applied to its animation and music sections only.

User decisions (2026-10-09):
- No skip action.
- The results auto-continue to the blackout; there is no CONTINUE button.
- The fanfare is 8-bit chiptune.
- Fireworks sound like an 8-bit bassy kick explosion.
- The vault's sounds should feel like hitting a jackpot.
- Re-generate the sounds that came back truncated.
- ElevenLabs budget for this round: ~4.5k credits, approved.

## 1. Timeline

Seconds after the key turns. All times are named constants in one place. The fanfare is 120 BPM: one beat is
0.5 s, one bar is 2 s.

| t | Phase | What happens |
|---|---|---|
| 0–0.9 | Anticipation | The suspense loop fades out. The chest at lower centre scales up and settles, then trembles in short bursts that grow harder. A gold seam light along the lid widens with each tremor, and small sparks escape upward. Sound: `vault-riser` (rising tone, rattle, accelerating shimmer). |
| 0.9–1.0 | Held beat | Everything holds still for one beat. |
| 1.0 | Impact | The lid snaps open with an overshoot; the body recoils and settles. A brief white-gold flash centred on the chest (short enough that the chest stays readable), a short restrained shake, a dense burst of gold sparks and pixel stars, and a vertical light shaft. Sound: `vault-open-hit` (jackpot hit: bassy 8-bit kick, bright chord stab, coin spill), plus a firework kick. The fanfare starts here, so its first downbeat is the impact. |
| 1.5–2.5 | Rainbow expansion | The light opens into a broad fan of rainbow rays (red, orange, yellow, green, cyan, blue, magenta) anchored at the chest, spreading up behind the reward area. A slow rotating starburst sits behind them. Layers from back to front: broad dark rays, narrow bright rays, sparse white sparkles. Five vertical reel columns cascade in left to right, 100 ms apart. |
| 2.5–6.0 | Spin | Each column cycles skin icons vertically, like a compact slot reel, inside a clipped window, each with its own offset and pattern. The rays sweep slowly. Star glints, rising light motes, and gold coins arcing out and falling. Fireworks with the 8-bit kick on bar downbeats (t = 3.0, 5.0). Strong and quiet moments alternate, so it is not constant noise. |
| 6.0, 6.5, 7.0, 7.5, 8.5 | Lock-ins | Left to right. Each column decelerates through several icons, overshoots slightly and settles on its drop, which is decided before the animation. On each stop: the icon snaps to centre with a scale pulse; its frame flashes gold; a compact star burst; `reward-chime` plays at a rising pitch (+2 semitones per stop); the skin's name and its `+$` sit under the column. Earlier columns stay still while the rest spin. The fifth (the animated ★ "Event Horizon", its texture animating in its frame) gets the strongest accent: a larger burst, a halo, `legendary-choir`, a firework kick, and the fanfare's resolving note. |
| 9.0–11.5 | Celebration | One golden pulse across all five frames, then a shower of coins and sparkles. The vault's total (the five payouts) counts up with `count-tick` and resolves on `count-ding`. Particle density falls; the rays fade into a soft glow. The chest stays open with a gentle gold light inside. |
| 11.5–14.5 | Results hold | The five rewards and the total stay on screen. Then the run ends and the blackout runs as now. |

`VAULT_LAND_TIMES = [6, 6.5, 7, 7.5, 8.5]` and `VAULT_OPENING_SECONDS = 14.5`. Each landing still pays at its own
time, once. A reload mid-opening resumes at the same frame, and the fanfare resumes at offset `t − 1.0`
(silent before the impact).

## 2. Look

- The camera is fixed and front-facing. The game stays faintly visible under a dark translucent overlay (it
  fades in over ~200 ms when the key turns; the key phase's dim stays).
- The chest is at lower centre, with room above it for a row of five columns. Everything fits on landscape and
  portrait screens.
- Visual hierarchy: the chest and its burst; the five columns; the rays and gold particles behind them; the
  icons and their labels.
- Particles and rays stay behind the icons and never cover a label.
- The style is crisp pixel edges, saturated rainbow, warm gold, white accents and deep shadows. The existing
  chest art (vault-case 4 frames) and skin icons are reused.

## 3. Audio

- **New effects**, each with variants where useful:
  - `vault-riser` (~1.2 s);
  - `vault-open-hit` (~2 s, ×2, jackpot);
  - `reward-chime` (~1 s, ×2, bright 8-bit);
  - `count-tick` (~0.3 s);
  - `count-ding` (~1.5 s).
- **Re-generated:**
  - `firework` ×3 as an 8-bit bassy kick explosion (~1.5 s);
  - `coin-fountain` (3 s), `legendary-choir` (3 s), `blackout` (3 s);
  - `devil-key-whisper` ×2 (3 s), `devil-key-laugh` (1.5 s).
- **Music:** `vault-fanfare` is replaced by an ~12 s 8-bit chiptune jackpot fanfare at 120 BPM, not a loop:
  - bar 1 is an explosive hit and rising run;
  - bars 2–4 are an energetic fanfare with accents on the beats;
  - bar 5 resolves to the major chord;
  - then a short sparkling tail.

  Three takes are generated. The take closest to the brief (length, ending) is used and the others are kept
  under `art/source/` for the user to swap in.
- **Lengths:** every downloaded file is measured. A file shorter than its brief by more than 20 % is
  re-generated, or its replacement is kept as the old one. The earlier batch came back rounded down to whole
  seconds.

## 4. Out of scope

A skip action, a CONTINUE button, reduced-motion mode, and the bench's own reels (multi-open keeps its stacked
reels).
