# Casecremental — animated skins (design)

Date: 2026-10-08 · Status: approved in chat (approach A) · Builds on: `2026-10-08-casecremental-m2a-look-design.md`

## 1. Goal

Later cases get skins that **move**: the finish (a pattern flowing, a shimmer sweeping across, the palette
breathing, sparkles) and the weapon itself (a bob, a recoil kick, the bolt cycling, a knife flip). Adding one
to a new case must be a data entry, not new code. M2a builds the system and one demo; cases 4–7 (M3) bring
the full set.

## 2. Decisions

- **Baked frame loops** (approach A). A skin may declare `motion`; the skin renderer bakes a short loop of
  whole-pixel frames the first time the skin is needed, caches it, and the pixel world plays it like any
  frame animation. Chosen over live shaders (soft next to the pixel art, per-card GPU cost, hard to test) and
  over hand-drawn sheets (the user dropped weapon art; one sheet per skin does not scale).
- **Weapons stay code-drawn.** Weapon motion transforms the weapon's silhouette polygon (shift, turn, move a
  part) before it is rasterised, so every frame stays crisp — pixel sprites are never scaled or rotated as
  images.
- **A skin without `motion` renders exactly as today** (same pixels, one frame).

## 3. Data

In `sim/types.ts`, on `SkinDef`:

```ts
motion?: SkinMotion;

interface SkinMotion {
  pattern?: "flow" | "shimmer" | "pulse" | "sparkle";
  weapon?: "bob" | "recoil" | "bolt" | "flip";
  /** Frames in the loop (default 8). */
  frames?: number;
  /** Playback speed (default 8). */
  fps?: number;
}
```

The sim never reads `motion`; it is presentation data that travels with the skin.

## 4. Motions

Every motion is a function of the loop phase `t ∈ [0, 1)`, so frame `n` is drawn at `t = n / frames` and the
loop closes (the frame after the last equals the first).

Pattern (the pattern lookup gains `t`; a static pattern ignores it):
- **flow** — the pattern drifts along a small closed path (a circle of ~8 % of the weapon) once per loop; the
  procedural patterns don't tile, so a straight drift could not return to its start.
- **shimmer** — a narrow bright diagonal band crosses the weapon once per loop (mixed toward white,
  outline untouched).
- **pulse** — the palette brightens and darkens once per loop (a few % either way).
- **sparkle** — a handful of pixels light up and fade, from a fixed seeded set, staggered over the loop.

Weapon (the silhouette is transformed before rasterising):
- **bob** — the whole weapon moves 1 px up and back down.
- **recoil** — a quick 1–2 px kick backwards, a one-frame muzzle flash pixel, ease back.
- **bolt** — a small part of the receiver slides back and returns (rifles, snipers, shotguns).
- **flip** — the knife turns through a full spin in steps (knives).

Weapon motion may grow the frame by a margin (2 px each side) so nothing is clipped; all frames of a skin
share one size and one baseline.

## 5. Rendering

- `SkinTextures.frames(skin)` returns the baked loop (one frame for a static skin); `texture(skin)` stays as
  "frame 0" so existing callers keep working. Baked once per skin, cached, destroyed with the library.
- A small `SkinPlayer` swaps a sprite's texture by elapsed time at the skin's `fps`.
- **Where it plays:** only the **reveal card**, the one the player drags (user: the knife must not turn on
  the reel). Reel cards always show frame 0. Later: locker and claim tray (M2b/M3) use the same player.
- **The ★ knife's showcase** (user: "like b-roll tape, slower, closer to eyes"): the moment the card comes
  up, the knife is lifted into the HD layer and shot like product b-roll — it stays over the card and slowly
  comes toward the viewer (to 3.5×, well past the card's edges), turning once on a turntable (edge-on, its
  back, face-on) with a gentle ±0.22 rad tilt, then eases back into the card (2.4 s, real time, so it plays
  through the ★ slow-mo) and settles with a clink, sparks and a small shake. Meanwhile the card is empty and can't be picked up; afterwards the knife spins in the card's
  loop at 5 fps. Selling or a resize mid-flight ends it at once.

## 6. Demo in M2a

**Only the knives move in cases 1–3** (user: "they are rare anyway"): every case's ★ knife gets
`{ pattern: "shimmer", weapon: "flip" }` — the finish shimmers while the knife spins. Every other skin in cases
1–3 stays still; richer animated finishes are what the later cases (M3) earn. Visible with the dev board's ★
button. A flipping knife needs a square frame (§4), so it is drawn a little smaller (20 × 8 → a 24 px square)
to fit inside the reveal card; on the landed reel card its tips may pass behind the window's edge mid-turn.

## 7. Testing

- Every frame of a skin has the same size; outline pixels stay outline in every frame.
- Each motion changes pixels between frames (a motion that does nothing fails).
- Loops close: rendering at `t = 1` equals `t = 0`.
- A skin without `motion` yields one frame identical to today's texture data.
- Frames are baked once per skin (a second request returns the cached loop).
- The player picks frame `floor(elapsed · fps) mod frames`.

## 8. Out of scope

New cases and their finishes (M3), animated skins in the locker/tray (M2b/M3), combining two pattern
motions on one skin, shader effects.
