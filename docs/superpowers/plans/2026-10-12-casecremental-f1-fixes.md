# Casecremental F1 — bug fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three play-test todos (drawer scrollbar flash, selectable text, broken stacked multi-open reels) and give the claim tray its animations.

**Architecture:** Every rule is a pure, tested function or class. The new ones are `fx/reel/cellLook.ts`, `fx/skins/thumb.ts`, `fx/pixel/trayRules.ts`, `fx/noSelect.ts` and `PRESS` in `fx/hd/tween.ts`. The Pixi views (`Reel.ts`, `Tray.ts`, `coins.ts`) and the World only apply those rules. Skin art is shrunk with an area average, not nearest-neighbour, so a short reel or a tray slot shows a small, clean picture. Coins move into the pixel world, in a layer under the reels.

**Tech Stack:** TypeScript (strict), PixiJS 8, React 19, gsap, Vitest 5 (`npx vitest run <path>`), `npm run typecheck`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §2 (F1 — binding), §1 and §11. Background: `docs/todo.md`, the screenshots `{17D16505-C5AA-488B-BEC9-48373A837CE3}.png` (×5) and `{20786167-7B84-4803-B638-2BD896CADB8F}.png` (×3) in the repo root, and `docs/feature-history/casecremental-look.md`, `casecremental-run1.md`, `casecremental-runs-2-3.md`.

## What the diagnosis found

Read this before starting. It explains every task.

1. **The scrollbar flash.** `PxButton` (`ui/parts.tsx`) calls `springElement` (`fx/hd/tween.ts`) on every click. That tween scales the button to 1.12, then settles it with `elastic.out` over 0.5 s, overshooting past 1 again on the way. The upgrade's buy button fills its `.cc-row` from side to side, so at 1.12 it sticks out about 6 % past the row on each side. `.cc-scroll` has `overflow-y: auto`, which makes `overflow-x` compute to `auto` as well. The transformed button therefore makes the scroll area scrollable, and a scrollbar shows for as long as the elastic tail runs. The `.cc-btn:active` 1-px `translateY` can also push the last row's button past the content edge.
2. **The noise on stacked reels.** `fx/pixel/Reel.ts` `makeCard` places the skin texture at its native size, about 26×10 (30×14 for an animated skin). The card is `reel.h − 6` tall, and the art is never scaled. Here is what each window gives (world px, `benchReelArea` + `stackRects(…, maxH 26, gap 3)`):

   | window | reel h | card h | what was drawn |
   |---|---|---|---|
   | ×5 tall, desktop (69 px area) | 11 | 5 | rows 4–6 of the art plus a 2-px bar that fills 40 % of the card |
   | ×3 compact, after landing (33 px area) — the ×3 screenshot, "Buy a case" under it | 9 | 3 | a 2-px rarity bar and 1 px of art: "flat bars with smeared noise" |
   | ×5 compact (33 px) | 6 | 0 | nothing but the frame |

   The 6-px nine-slice frame (`REEL_FRAME.border = 6`) is also squashed below 12 px of height into non-integer scaling, which adds its own noise. The gaps between cards show the frame's metal through the clip, which sits 3 px inside a 6-px border, so the cells do not read as separate.
3. **The golden sprites at ×5** are the **sale coins** (`fx/juice/coins.ts`). Their frames are 12×22, four spinning frames that read as a gold bullet when edge-on, drawn at the pixel scale in the HD layer, so above the whole pixel world. Every sale (`World.onEvent "sold"`) bursts up to 24 coins along a bezier from the source to the HUD at the top centre. The auto-seller's sales start at `l.seller`, bottom left. At ×5 there are many sales, and the path from bottom left to top centre crosses every bench reel. In the screenshot that is the diagonal column.
4. **The tray** (`fx/pixel/Tray.ts`) redraws only when the list key changes. A slot is a 1-px rarity border around a dark box, with no art and no motion. "TRAY FULL" already exists in EN and RU (`float.trayfull` → "TRAY FULL" / "ЛОТОК ПОЛОН"). `World` blinks it fully on and off at about 2 Hz. `World` plays `tray-store` on every non-grid `stored` event.

## Decisions taken where the spec is open

- **The compact window keeps n reels.** It does not fold to one. Once the reels land it still holds every reel, each drawn with the cell look its height allows. That is how the spec's "clean rarity tiles when too short" case shows up: ×5 after landing gives 6-px reels, which draw tiles.
- **Coins fly behind the reels, not around them.** The flights move into a pixel-world layer drawn under the reels and the bench's cards. A coin passes behind a reel window and comes out above it on its way to the HUD. The amount text stays in the HD layer.
- **The tray-store sound moves to the landing.** The bench, bot and locker stores no longer play `tray-store` when the event fires. The sound now plays as the sliding card reaches its slot, throttled to one every 0.1 s. Grid stores stay silent here: the grid plays its own sound, and F2 removes the grid.
- **"TRAY FULL" stops blinking** and stays steady, in red `0xff5a4a`, while the frame pulses. No new strings are needed.
- **A claim pops out where the card was.** A tap pops the mini card at its slot. A drag pops the lifted full-size face at the drop point. The sale's coins start from that point instead of from the bin.
- **Photosensitivity:** the two looping pulses (the Covert/★ glow and the full-tray frame) each swing by 0.09 in alpha from peak to peak, with periods of 1.2 s and 1.0 s. That is the same convention as `BEAT_LIGHT_AMPLITUDES`. F1 adds no full-screen flash.

## Global Constraints

- Every player-facing string exists in EN and RU (`i18n/en.ts`, `i18n/ru.ts`; `i18n/budgets.ts` for length budgets). F1 adds no new string: it reuses `float.trayfull`.
- Photosensitivity is a hard rule. Every full-screen flash goes through `FlashGate` (at most 3 a second). Any throbbing or pulsing light changes by less than 0.1 in alpha from peak to peak (`BEAT_LIGHT_AMPLITUDES` in `fx/vault/beat.ts`). F1 adds no flashes, and its two pulses are tested to be under 0.1.
- Sim balance numbers live only in `sim/tuning.ts`. F1 touches no sim number. Timings and sizes for visuals live as named constants in their rules modules (`TRAY_LOOK`, `cellLook` constants, `PRESS`).
- The pixel world is whole pixels and is never scaled or rotated (`fx/pixel/PixelLayer.ts`). Anything that scales (the pop-out, glows) lives in the HD layer (screen px = world px × `vp.scale`).
- Module boundaries (IDOS.md): `sim/` stays pure TS with no Pixi. `ui/` may import `fx/`, but `fx/` never imports `ui/`. Nothing imports another module.
- File size (IDOS.md): when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. `fx/World.ts` is already 538 lines, so F1 adds at most ~12 net lines there, and all tray and coin logic goes in `Tray.ts`, `trayRules.ts` and `coins.ts`.
- Match the surrounding style. Each file opens with a short `//` paragraph saying why it exists, and exported symbols get one-line `/** */` docs in the same plain voice. Prettier `printWidth: 140`. Comments are about as dense as the neighbouring code's.
- The checks stay green at every commit: `npx vitest run src/modules/casecremental`, `npm run typecheck`, `npm run build`.
- Commits look like the repo's (`fix(scope): …`, `feat(scope): …`, `docs(scope): …`) and stage only the task's files. Never stage `docs/todo.md` or the two `{…}.png` screenshots in the repo root, which are the user's untracked files. Every commit message ends with these two lines:

  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```

- Stay on branch `casecremental-finish`. Do not switch branches.

## Review Focus

The five uncovered inputs most likely to bite a player, most likely first. Each one has a test in the task named.

1. **Pressing the buy button of the last row in a full drawer.** The `:active` 1-px dip plus the press tween must not make the list scrollable. The CSS test asserts `padding-block` on `.cc-scroll` and that the press never scales past 1 (Task 1).
2. **The smallest viewports at ×5** (360×640 portrait, 1024×768 desktop) in both the tall and the compact window. Each strip must be at least clean tiles, never art cut by the clip and never a squashed nine-slice (Task 3, the viewport sweep).
3. **A resize or rotation while a card slides into the tray or pops out.** Everything settles at once and no stray store sound fires (Task 5, `TrayMotion.settle`).
4. **Tapping or claiming a tray card that is still sliding in.** A flying card cannot be grabbed. A claim while it is in flight replaces the slide with a pop (Task 5, and the `pointerDown` guard in Task 6).
5. **A reload, or the first frame of a World, with a full tray.** Nothing slides, nothing pops and no store sound plays (Task 5, the first-sync test).

---

### Task 1: The UI — no scrollbar flash, no text selection

**Files:**
- Create: `src/modules/casecremental/fx/noSelect.ts`
- Create: `src/modules/casecremental/fx/noSelect.test.ts`
- Create: `src/modules/casecremental/ui/styles.test.ts`
- Modify: `src/modules/casecremental/ui/styles.ts` (the `.cc-root` and `.cc-scroll` rules, plus one new rule)
- Modify: `src/modules/casecremental/fx/hd/tween.ts` (add `PRESS`, `pressElement`)
- Modify: `src/modules/casecremental/fx/hd/tween.test.ts` (one test)
- Modify: `src/modules/casecremental/ui/parts.tsx` (`PxButton` uses `pressElement`)
- Modify: `src/modules/casecremental/fx/GameScene.ts` (`blockSelection(a.canvas)` before `host.appendChild(a.canvas)`)

**Interfaces:**
- Produces: `NO_SELECT: ReadonlyArray<readonly [string, string]>`, `blockSelection(el: { style?: unknown }): void` (fx/noSelect.ts); `PRESS`, `pressElement(el: Element): gsap.core.Tween` (fx/hd/tween.ts).

- [ ] **Step 1: Write the failing tests**

`src/modules/casecremental/ui/styles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { UI_CSS } from "./styles";

// The overlay's stylesheet holds two F1 fixes: the panels never flash a scrollbar, and the game's text is not selectable.

const rule = (selector: string): string => {
  const at = UI_CSS.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return UI_CSS.slice(at, UI_CSS.indexOf("}", at));
};

describe("the overlay's stylesheet", () => {
  it("never lets a panel's scroll area flash a scrollbar (F1 #1, Review Focus 1)", () => {
    const s = rule(".cc-scroll");
    expect(s).toContain("overflow-y: auto");
    expect(s).toContain("overflow-x: hidden");
    expect(s).toContain("scrollbar-gutter: stable");
    expect(s).toContain("padding-block: calc(var(--px) * 2px)"); // room for a pressed button's 1-px dip in the last row
  });

  it("turns text selection and the iOS callout off on the game root, and back on for real inputs (F1 #2)", () => {
    const root = rule(".cc-root");
    for (const p of ["user-select: none", "-webkit-user-select: none", "-webkit-touch-callout: none"]) expect(root).toContain(p);
    const inputs = rule('.cc-root input, .cc-root textarea, .cc-root select, .cc-root [contenteditable="true"]');
    expect(inputs).toContain("user-select: text");
    expect(inputs).toContain("-webkit-user-select: text");
    expect(inputs).toContain("-webkit-touch-callout: default");
  });
});
```

`src/modules/casecremental/fx/noSelect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blockSelection } from "./noSelect";

describe("blockSelection", () => {
  it("turns off text selection and the iOS long-press callout on an element", () => {
    const set: Record<string, string> = {};
    blockSelection({ style: { setProperty: (k: string, v: string) => (set[k] = v) } });
    expect(set).toEqual({ "user-select": "none", "-webkit-user-select": "none", "-webkit-touch-callout": "none" });
  });

  it("does nothing to an element without a style (the tests' fake canvas)", () => {
    expect(() => blockSelection({})).not.toThrow();
  });
});
```

Add to `src/modules/casecremental/fx/hd/tween.test.ts`. Extend the import to `import { anticipate, floatAway, pop, PRESS, pressElement, spring } from "./tween";` and add, inside `describe("tween presets", …)`:

```ts
  it("pressElement dips and eases back to full size, never past it (a button that grew flashed a scrollbar, F1)", () => {
    const o = { scale: 1 };
    const t = pressElement(o as unknown as Element).pause();
    for (let i = 0; i <= 20; i++) {
      t.progress(i / 20);
      expect(o.scale).toBeLessThanOrEqual(1);
      expect(o.scale).toBeGreaterThanOrEqual(PRESS.from);
    }
    expect(o.scale).toBe(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/casecremental/ui/styles.test.ts src/modules/casecremental/fx/noSelect.test.ts src/modules/casecremental/fx/hd/tween.test.ts`
Expected: FAIL. `./noSelect` does not resolve, `pressElement` is not exported, and `.cc-scroll` does not contain `overflow-x: hidden`.

- [ ] **Step 3: Implement**

`src/modules/casecremental/fx/noSelect.ts`:

```ts
// No text selection and no iOS long-press callout anywhere in the game (F1): the canvas and the UI overlay both opt
// out. Real text inputs opt back in (ui/styles.ts).

/** The CSS that turns selection off, as [property, value] pairs (the stylesheet and the canvas share it). */
export const NO_SELECT: ReadonlyArray<readonly [string, string]> = [
  ["user-select", "none"],
  ["-webkit-user-select", "none"],
  ["-webkit-touch-callout", "none"],
];

/** Turn selection off on an element (the Pixi canvas); a no-op for one without a style. */
export function blockSelection(el: { style?: unknown }): void {
  const style = el.style as { setProperty?: (name: string, value: string) => void } | undefined;
  for (const [k, v] of NO_SELECT) style?.setProperty?.(k, v);
}
```

`src/modules/casecremental/ui/styles.ts`: add `import { NO_SELECT } from "../fx/noSelect";` and, above `UI_CSS`, `const noSelect = NO_SELECT.map(([k, v]) => `${k}: ${v};`).join(" ");`. Change these rules (everything else stays as it is):

```css
.cc-root { font-family: ${PIXEL_FONT}; color: #f2e9dc; font-size: var(--fs); line-height: 1.5; -webkit-font-smoothing: none; ${noSelect} }
.cc-root input, .cc-root textarea, .cc-root select, .cc-root [contenteditable="true"] { user-select: text; -webkit-user-select: text; -webkit-touch-callout: default; }
.cc-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; padding-block: calc(var(--px) * 2px); display: flex; flex-direction: column; gap: calc(var(--px) * 3px); min-height: 0; }
```

Place the inputs rule right after `.cc-root * { … }`. Update the file's header comment with one sentence: "The scroll areas never flash a scrollbar (F1: a gutter always reserved, no sideways overflow, room for a pressed button), and the game's text is not selectable."

`src/modules/casecremental/fx/hd/tween.ts`, after `springElement`:

```ts
/** A panel button's press (F1): it dips to 0.92 and eases back to its size, never past it. A button that grew stuck out
 *  of its scroll area and flashed a scrollbar for as long as the spring rang. */
export const PRESS = { from: 0.92, duration: 0.25, ease: "power3.out" } as const;

export function pressElement(el: Element): gsap.core.Tween {
  return gsap.fromTo(el, { scale: PRESS.from }, { scale: 1, duration: PRESS.duration, ease: PRESS.ease, overwrite: true });
}
```

`src/modules/casecremental/ui/parts.tsx`: import `pressElement` instead of `springElement` and call `pressElement(ref.current)` in `PxButton`'s `onClick`. Update the header comment's "a pixel button that presses in and springs back" to "a pixel button that presses in and eases back". The Hud's cash counter keeps `springElement`: it is not in a scroll area.

`src/modules/casecremental/fx/GameScene.ts`: add `import { blockSelection } from "./noSelect";`, and in `mount`, in the `.then((w) => { … })` branch, call `blockSelection(a.canvas);` on the line before `host.appendChild(a.canvas);`.

- [ ] **Step 4: Run the tests to verify they pass, then the full checks**

Run: `npx vitest run src/modules/casecremental/ui/styles.test.ts src/modules/casecremental/fx/noSelect.test.ts src/modules/casecremental/fx/hd/tween.test.ts`
Expected: PASS.
Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green. `fx/GameScene.test.ts` passes because its fake canvas `{}` has no style and `blockSelection` skips it.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/noSelect.ts src/modules/casecremental/fx/noSelect.test.ts src/modules/casecremental/ui/styles.ts src/modules/casecremental/ui/styles.test.ts src/modules/casecremental/fx/hd/tween.ts src/modules/casecremental/fx/hd/tween.test.ts src/modules/casecremental/ui/parts.tsx src/modules/casecremental/fx/GameScene.ts
git commit -m "fix(ui): buying an upgrade never flashes a scrollbar; the game's text is not selectable

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 2: Shrunk skin art (thumbnails)

**Files:**
- Create: `src/modules/casecremental/fx/skins/thumb.ts`
- Create: `src/modules/casecremental/fx/skins/thumb.test.ts`
- Modify: `src/modules/casecremental/fx/skins/pixelSkin.ts` (`SkinTextures`: `size`, `thumb`, the stills cache, `destroy`)
- Modify: `src/modules/casecremental/fx/skins/pixelSkin.test.ts` (one test)

**Interfaces:**
- Produces: `fitArt(w: number, h: number, box: { w: number; h: number }): { w: number; h: number }` and `shrinkImage(img: PixelImage, w: number, h: number): PixelImage` (fx/skins/thumb.ts); `SkinTextures.size(skin: SkinDef): { w: number; h: number }`, `SkinTextures.thumb(skin: SkinDef, w: number, h: number): Texture`. Tasks 3 and 6 use these.

- [ ] **Step 1: Write the failing tests**

`src/modules/casecremental/fx/skins/thumb.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fallbackBase, type PixelImage } from "./pixelSkin";
import { fitArt, shrinkImage } from "./thumb";

// Skin art shrunk for short reels and tray slots: an area average with crisp edges, never nearest-neighbour noise.

const img = (w: number, h: number, px: number[][]): PixelImage => ({ w, h, data: new Uint8ClampedArray(px.flat()) });
const T = [0, 0, 0, 0];
const OUT = [18, 14, 16, 255];

describe("fitArt", () => {
  it("keeps art that fits, and shrinks the rest to the box keeping its shape", () => {
    expect(fitArt(26, 10, { w: 28, h: 18 })).toEqual({ w: 26, h: 10 }); // the 26-px reel: full art, as before
    expect(fitArt(26, 10, { w: 22, h: 8 })).toEqual({ w: 20, h: 8 }); // ×5 tall, desktop
    expect(fitArt(26, 10, { w: 22, h: 6 })).toEqual({ w: 15, h: 6 }); // ×5 tall, portrait
    expect(fitArt(26, 10, { w: 8, h: 5 })).toEqual({ w: 8, h: 3 }); // a tray slot (10×7)
    expect(fitArt(30, 14, { w: 28, h: 11 })).toEqual({ w: 23, h: 11 }); // an animated skin's frame in a 15-px reel
  });

  it("never shrinks to nothing", () => {
    expect(fitArt(26, 10, { w: 1, h: 1 })).toEqual({ w: 1, h: 1 });
  });
});

describe("shrinkImage", () => {
  it("makes a w×h image", () => {
    const out = shrinkImage(fallbackBase("rifle"), 13, 5);
    expect([out.w, out.h, out.data.length]).toEqual([13, 5, 13 * 5 * 4]);
  });

  it("averages the area a new pixel covers, solid when at least a third of it is drawn", () => {
    expect(Array.from(shrinkImage(img(2, 2, [[200, 100, 0, 255], [100, 50, 0, 255], [200, 100, 0, 255], [100, 50, 0, 255]]), 1, 1).data)).toEqual([150, 75, 0, 255]);
    expect(shrinkImage(img(2, 2, [[200, 100, 0, 255], T, T, T]), 1, 1).data[3]).toBe(0); // a quarter: empty
    expect(shrinkImage(img(2, 2, [[200, 100, 0, 255], [200, 100, 0, 255], T, T]), 1, 1).data[3]).toBe(255); // a half: solid
  });

  it("takes its colour from the coloured pixels, the dark outline only where nothing else is", () => {
    expect(Array.from(shrinkImage(img(2, 2, [OUT, [200, 100, 0, 255], [100, 50, 0, 255], T]), 1, 1).data)).toEqual([150, 75, 0, 255]);
    expect(Array.from(shrinkImage(img(2, 2, [OUT, OUT, T, T]), 1, 1).data)).toEqual(OUT);
  });

  it("keeps edges crisp (every pixel solid or empty) and a weapon still reads at half size", () => {
    const out = shrinkImage(fallbackBase("rifle"), 13, 5);
    let solid = 0;
    for (let i = 3; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
      if (out.data[i]) solid++;
    }
    expect(solid).toBeGreaterThanOrEqual(20);
  });
});
```

Add to `src/modules/casecremental/fx/skins/pixelSkin.test.ts`, inside `describe("SkinTextures", …)`. Add `import { shrinkImage } from "./thumb";` at the top:

```ts
  it("knows a skin's size, and bakes a shrunk still frame once per size (the full one when it fits)", () => {
    const made: PixelImage[] = [];
    let destroyed = 0;
    const fake = (img: PixelImage) => {
      made.push(img);
      return { destroy: () => destroyed++ } as unknown as Texture;
    };
    const st = new SkinTextures(new Map(), fake);
    const still = { ...CASES[0]!.skins.find((s) => s.weapon === "rifle")!, motion: undefined };
    expect(st.size(still)).toEqual({ w: 26, h: 10 });
    expect(st.thumb(still, 26, 10)).toBe(st.texture(still));
    expect(st.thumb(still, 40, 20)).toBe(st.texture(still));
    const small = st.thumb(still, 13, 5);
    expect(made).toHaveLength(2);
    expect(made[1]!).toEqual(shrinkImage(made[0]!, 13, 5));
    expect(st.thumb(still, 13, 5)).toBe(small); // cached
    expect(made).toHaveLength(2);
    st.destroy();
    expect(destroyed).toBe(2);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/skins`
Expected: FAIL. `./thumb` does not resolve, and `st.size` is not a function.

- [ ] **Step 3: Implement**

`src/modules/casecremental/fx/skins/thumb.ts`:

```ts
import type { PixelImage } from "./pixelSkin";

// Skin art smaller than it was drawn (F1): a short reel strip and the claim tray's slots show the skin's still frame
// shrunk to fit. Nearest-neighbour drops whole rows and smears into noise, so each new pixel is the average of the area
// it covers: the colour of its coloured pixels (the dark outline only where nothing else is), solid where at least a
// third of the area is drawn, else empty. Edges stay crisp, with no half-transparent pixels.

/** Darker pixels are the drawn outline (as tintWeapon). */
const OUTLINE_LUM = 40;

/** w×h fitted into `box`, keeping its shape: unchanged when it fits, else shrunk (whole px, at least 1). */
export function fitArt(w: number, h: number, box: { w: number; h: number }): { w: number; h: number } {
  if (w <= box.w && h <= box.h) return { w, h };
  const s = Math.min(box.w / w, box.h / h);
  return { w: Math.max(1, Math.floor(w * s + 1e-9)), h: Math.max(1, Math.floor(h * s + 1e-9)) };
}

/** `img` shrunk to w×h by area average (see above). */
export function shrinkImage(img: PixelImage, w: number, h: number): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.h) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.h) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.w) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.w) / w));
      let area = 0;
      let solid = 0;
      let lr = 0, lg = 0, lb = 0, ln = 0; // coloured pixels
      let dr = 0, dg = 0, db = 0, dn = 0; // outline pixels
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          area++;
          const i = (sy * img.w + sx) * 4;
          if (img.data[i + 3]! < 128) continue;
          solid++;
          const r = img.data[i]!, g = img.data[i + 1]!, b = img.data[i + 2]!;
          if ((r + g + b) / 3 < OUTLINE_LUM) (dr += r), (dg += g), (db += b), dn++;
          else (lr += r), (lg += g), (lb += b), ln++;
        }
      if (solid * 3 < area) continue;
      const o = (y * w + x) * 4;
      const [r, g, b, n] = ln ? [lr, lg, lb, ln] : [dr, dg, db, dn];
      data.set([Math.round(r / n), Math.round(g / n), Math.round(b / n), 255], o);
    }
  }
  return { w, h, data };
}
```

If Prettier or the linter rejects the comma-expression statements, write them as `{ dr += r; dg += g; db += b; dn++; }` blocks instead. The behaviour is the same.

`src/modules/casecremental/fx/skins/pixelSkin.ts`: in `SkinTextures`, add `import { shrinkImage } from "./thumb";` and:

```ts
  /** Each skin's still frame (its loop's first), kept for its size and for shrinking. */
  private readonly stills = new Map<string, PixelImage>();
  /** Shrunk still frames, by `${id}@${w}x${h}`. */
  private readonly thumbs = new Map<string, Texture>();
```

In `frames()`, right after `images` is computed: `this.stills.set(skin.id, images[0]!);`. Then add:

```ts
  /** The still frame's size in px (26×10 for a still skin; a moving one's loop can be bigger). */
  size(skin: SkinDef): { w: number; h: number } {
    this.frames(skin);
    const s = this.stills.get(skin.id)!;
    return { w: s.w, h: s.h };
  }

  /** The still frame shrunk to w×h (thumb.ts), baked once per size; the full texture when it already fits. */
  thumb(skin: SkinDef, w: number, h: number): Texture {
    const s = this.size(skin);
    if (w >= s.w && h >= s.h) return this.texture(skin);
    const key = `${skin.id}@${w}x${h}`;
    let tex = this.thumbs.get(key);
    if (!tex) {
      tex = this.toTexture(shrinkImage(this.stills.get(skin.id)!, w, h));
      this.thumbs.set(key, tex);
    }
    return tex;
  }
```

In `destroy()`, also run `for (const t of this.thumbs.values()) t.destroy(true); this.thumbs.clear(); this.stills.clear();`.

- [ ] **Step 4: Run the tests to verify they pass, then the full checks**

Run: `npx vitest run src/modules/casecremental/fx/skins`
Expected: PASS.
Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/skins/thumb.ts src/modules/casecremental/fx/skins/thumb.test.ts src/modules/casecremental/fx/skins/pixelSkin.ts src/modules/casecremental/fx/skins/pixelSkin.test.ts
git commit -m "feat(skins): skin art shrunk by area average for short reels and tray slots

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 3: Stacked reels that read as reels

**Files:**
- Create: `src/modules/casecremental/fx/reel/cellLook.ts`
- Create: `src/modules/casecremental/fx/reel/cellLook.test.ts`
- Modify: `src/modules/casecremental/fx/pixel/Reel.ts` (cells from `cellLook`, thin frame, dark backing, marker, landed look)
- Modify: `src/modules/casecremental/fx/pixel/BenchReels.ts` (export `REEL_MAX_H`; nothing else changes)

**Interfaces:**
- Consumes: `fitArt` (fx/skins/thumb.ts), `SkinTextures.size` and `SkinTextures.thumb` (Task 2).
- Produces: `cellLook(reelH: number): CellLook`, `CellLook`, `SLICE_MIN_H = 16`, `ART_CELL_W = 30`, `SMALL_CELL_W = 24`, `CELL_GAP = 2` (fx/reel/cellLook.ts); `REEL_MAX_H` exported from BenchReels.ts. `CARD_W` stays exported from Reel.ts (= `ART_CELL_W`) for `Reel.test.ts`.

The heights the sweep must produce (world px, `stackRects(area, n, 26)`), so the numbers can be checked by hand:

| | desktop tall (69) | portrait tall (61) | desktop compact (33) | portrait compact (27) |
|---|---|---|---|---|
| ×2 | 26 → slice, full art | 26 → slice, full art | 15 → thin, full art | 12 → thin, art box 22×9 |
| ×3 | 21 → slice, full art | 18 → slice, full art | 9 → thin, art box 22×6 | 8 → thin, art box 22×5 |
| ×5 | 11 → thin, art 20×8 | 9 → thin, art 15×6 | 6 → thin, tiles | 5 → thin, tiles |

The bot's ×2 window (31 px) gives 14 → thin, with full art in a 28×10 box.

- [ ] **Step 1: Write the failing test**

`src/modules/casecremental/fx/reel/cellLook.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REEL_MAX_H } from "../pixel/BenchReels";
import { benchReelArea, tableLayout } from "../pixel/layout";
import { REEL_FRAME } from "../pixel/drawn";
import { pixelViewport } from "../pixel/viewport";
import { SKIN_H, SKIN_W } from "../skins/motion";
import { fitArt } from "../skins/thumb";
import { stackRects } from "../vault/stackedReels";
import { STRIP_LENGTH, WIN_INDEX } from "./strip";
import { ART_CELL_W, cellLook, SLICE_MIN_H } from "./cellLook";
import { reelPosition } from "../pixel/Reel";

// F1 #3: every stacked strip shows distinct cells — the full art, the art shrunk, or clean rarity tiles — never art
// cut by the clip, never a squashed nine-slice frame.

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [1000, 1000],
  [390, 844],
  [360, 640],
];

describe("cellLook", () => {
  it("keeps the single 26-px reel exactly as it was: the nine-slice frame, 30-px cards, the full art over a 2-px bar", () => {
    expect(cellLook(26)).toEqual({ frame: "slice", inset: 3, cellW: ART_CELL_W, gap: 2, bar: 2, artBox: { w: 28, h: 18 } });
  });

  it("draws a thin frame below 16 px, where the 6-px nine-slice would squash into noise", () => {
    for (let h = 1; h <= 40; h++) expect(cellLook(h).frame, `h=${h}`).toBe(h >= SLICE_MIN_H ? "slice" : "thin");
    expect(SLICE_MIN_H).toBeGreaterThan(2 * REEL_FRAME.border);
  });

  it("shrinks the art on a short strip and draws plain tiles where even that would not read", () => {
    expect(cellLook(15).artBox).toEqual({ w: 28, h: 11 });
    expect(cellLook(11)).toMatchObject({ frame: "thin", cellW: 24, bar: 1, artBox: { w: 22, h: 8 } });
    expect(cellLook(9).artBox).toEqual({ w: 22, h: 6 });
    expect(cellLook(7).artBox).toBeNull();
    expect(cellLook(6).artBox).toBeNull();
  });

  it("keeps the art and its bar inside the window and a cell", () => {
    for (let h = 5; h <= 40; h++) {
      const c = cellLook(h);
      if (!c.artBox) continue;
      expect(c.artBox.h + c.bar).toBeLessThanOrEqual(h - 2 * c.inset);
      expect(c.artBox.w).toBeLessThanOrEqual(c.cellW - c.gap);
    }
  });

  it("lands a fake tease's sliver on the card, never on the gap, at every cell width (strip.ts: up to 0.43 of a card)", () => {
    for (const h of [5, 9, 11, 15, 26]) {
      const c = cellLook(h);
      expect(0.43 * c.cellW + 0.5).toBeLessThanOrEqual((c.cellW - c.gap) / 2);
    }
  });

  it("covers the whole window with strip, at the start and on landing, for windows up to 300 px wide", () => {
    for (const h of [6, 11, 26]) {
      const { cellW } = cellLook(h);
      for (const w of [120, 200, 300])
        for (const f of [0, 1]) {
          const { x } = reelPosition(f, w, f ? 0.43 : 0, cellW);
          expect(x).toBeLessThanOrEqual(0);
          expect(x + STRIP_LENGTH * cellW).toBeGreaterThanOrEqual(w);
          if (f) expect(reelPosition(f, w, 0, cellW).index).toBe(WIN_INDEX);
        }
    }
  });
});

describe("the bench's stacked reels at every viewport (F1 #3, Review Focus 2)", () => {
  it.each(SIZES)("show full art at ×2–×3 and readable shrunk art at ×5 while spinning, at least clean tiles once landed, at %ix%i", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    for (const n of [2, 3, 5]) {
      for (const r of stackRects(benchReelArea(l, n, true), n, REEL_MAX_H)) {
        const c = cellLook(r.h);
        expect(c.artBox, `×${n} tall h=${r.h}`).not.toBeNull();
        const fit = fitArt(SKIN_W, SKIN_H, c.artBox!);
        if (n <= 3) expect(fit).toEqual({ w: SKIN_W, h: SKIN_H });
        else expect(fit.h).toBeGreaterThanOrEqual(5);
      }
      for (const r of stackRects(benchReelArea(l, n, false), n, REEL_MAX_H)) {
        expect(r.h, `×${n} compact`).toBeGreaterThanOrEqual(5);
        expect(r.h - 2 * cellLook(r.h).inset).toBeGreaterThanOrEqual(3); // a tile at least 3 px tall
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/reel/cellLook.test.ts`
Expected: FAIL. `./cellLook` does not resolve, and `REEL_MAX_H` is not exported.

- [ ] **Step 3: Implement**

`src/modules/casecremental/fx/reel/cellLook.ts`:

```ts
import { SKIN_H } from "../skins/motion";

// How a reel draws its cells at a given height (F1). The full art when it fits; the art shrunk (skins/thumb.ts) on a
// short stacked strip; clean rarity tiles where even that would not read. A short reel swaps the 6-px nine-slice frame
// (squashed into noise below 16 px) for a 1-px drawn one. Cells always have a dark 2-px gap between them.

export type ReelFrameKind = "slice" | "thin";

export interface CellLook {
  frame: ReelFrameKind;
  /** px from the reel's edge to its window (the clip). */
  inset: number;
  /** One cell's pitch: the card plus the gap after it. */
  cellW: number;
  gap: number;
  /** The rarity bar under the art (0 on a tile). */
  bar: number;
  /** The box the art is fitted into, or null for a plain rarity tile. */
  artBox: { w: number; h: number } | null;
}

/** Below this height a reel draws the thin frame. */
export const SLICE_MIN_H = 16;
/** The full-size card's pitch (the single reel's, unchanged since M1). */
export const ART_CELL_W = 30;
/** The pitch on a short strip: still wide enough that a fake tease's sliver (0.43 of a card) lands on the card. */
export const SMALL_CELL_W = 24;
export const CELL_GAP = 2;
/** The shortest art that still reads as a weapon: half the skin's height. */
const MIN_ART_H = Math.ceil(SKIN_H / 2);

export function cellLook(reelH: number): CellLook {
  const frame: ReelFrameKind = reelH >= SLICE_MIN_H ? "slice" : "thin";
  const inset = frame === "slice" ? 3 : 1;
  const inner = Math.max(0, reelH - 2 * inset);
  if (inner >= SKIN_H + 2) return { frame, inset, cellW: ART_CELL_W, gap: CELL_GAP, bar: 2, artBox: { w: ART_CELL_W - CELL_GAP, h: inner - 2 } };
  if (inner >= MIN_ART_H + 1)
    return { frame, inset, cellW: SMALL_CELL_W, gap: CELL_GAP, bar: 1, artBox: { w: SMALL_CELL_W - CELL_GAP, h: inner - 1 } };
  return { frame, inset, cellW: SMALL_CELL_W, gap: CELL_GAP, bar: 0, artBox: null };
}
```

`src/modules/casecremental/fx/pixel/BenchReels.ts`: change `const REEL_MAX_H = 26;` to `export const REEL_MAX_H = 26;`.

`src/modules/casecremental/fx/pixel/Reel.ts`. The header comment gains one sentence: "Its cells follow its height (reel/cellLook.ts): the full art, the art shrunk, or plain rarity tiles, with a dark gap between cells; once landed, the winner is outlined and the rest dim." Then make these changes:

1. Imports: add `import { ART_CELL_W, cellLook, type CellLook } from "../reel/cellLook";` and `import { fitArt } from "../skins/thumb";`.
2. Replace `export const CARD_W = 30;` and `const GAP = 2;` with:

```ts
export const CARD_W = ART_CELL_W;
const METAL = 0x3a4250;
const WINDOW = 0x07080c;
const GOLD = 0xffd34d;
/** The landed winner's 1-px outline. */
const WIN_EDGE = 0xfff6d5;
/** A landed reel dims every cell but the winner to this. */
const LANDED_DIM = 0.55;
```

3. Replace `makeCard` with `makeCell`:

```ts
/** One strip cell, `look.cellW - look.gap` wide and `h` tall: the skin's art fitted to the look's box on a rarity-tinted
 *  card with its bar, or — on a strip too short for art — a plain rarity tile. */
export function makeCell(skins: SkinTextures, skin: SkinDef, look: CellLook, h: number): Container {
  const color = RARITY_INFO[skin.rarity].color;
  const w = look.cellW - look.gap;
  const cell = new Container();
  const bg = new Graphics().rect(0, 0, w, h).fill({ color: 0x15161d });
  if (!look.artBox) {
    cell.addChild(bg.rect(0, 0, w, h).fill({ color, alpha: 0.85 }));
    return cell;
  }
  cell.addChild(bg.rect(0, 0, w, h).fill({ color, alpha: look.bar > 1 ? 0.16 : 0.3 }));
  const size = skins.size(skin);
  const fit = fitArt(size.w, size.h, look.artBox);
  const art = new Sprite(skins.thumb(skin, fit.w, fit.h));
  art.position.set(Math.floor((w - fit.w) / 2), Math.floor((h - look.bar - fit.h) / 2));
  cell.addChild(art, new Graphics().rect(0, h - look.bar, w, look.bar).fill({ color }));
  return cell;
}
```

4. In `Reel`: add the fields `private look: CellLook = cellLook(26);`, `private readonly thin = new Graphics();`, `private readonly back = new Graphics();`, `private readonly winEdge = new Graphics();`, `private cells: Container[] = [];` and `private landedShown = false;`. In the constructor the child order becomes `this.addChild(this.frame, this.thin, this.back, this.strip, this.clip, this.marker);`.
5. `layout(rect)` becomes:

```ts
  layout(rect: Rect): void {
    this.rect = rect;
    this.look = cellLook(rect.h);
    const { inset } = this.look;
    this.position.set(rect.x, rect.y);
    const slice = this.look.frame === "slice";
    this.frame.visible = slice;
    this.frame.width = rect.w;
    this.frame.height = rect.h;
    this.thin.clear();
    if (!slice) this.thin.rect(0, 0, rect.w, rect.h).fill({ color: METAL }).rect(1, 1, rect.w - 2, rect.h - 2).fill({ color: WINDOW });
    // the window behind the cells: the gaps between them read dark, never the frame's metal
    this.back.clear().rect(inset, inset, rect.w - 2 * inset, rect.h - 2 * inset).fill({ color: WINDOW });
    this.clip.clear().rect(inset, inset, rect.w - 2 * inset, rect.h - 2 * inset).fill({ color: 0xffffff });
    this.drawMarker();
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** The gold centre line over a dark 3-px backing (it reads on any tile, a gold one too), capped top and bottom: inside
   *  the nine-slice's metal, or on the thin frame's own edge rows. */
  private drawMarker(): void {
    const { w, h } = this.rect;
    const { inset } = this.look;
    const mx = Math.floor(w / 2);
    const g = this.marker.clear().rect(mx - 1, inset, 3, h - 2 * inset).fill({ color: 0x000000, alpha: 0.5 });
    if (this.look.frame === "slice")
      g.rect(mx, 2, 1, h - 4).fill({ color: GOLD }).rect(mx - 1, 2, 3, 1).fill({ color: GOLD }).rect(mx - 1, h - 3, 3, 1).fill({ color: GOLD });
    else g.rect(mx, 0, 1, h).fill({ color: GOLD }).rect(mx - 1, 0, 3, 1).fill({ color: GOLD }).rect(mx - 1, h - 1, 3, 1).fill({ color: GOLD });
  }
```

6. `place(f, sound)` uses the look's pitch and applies the landed look:

```ts
  private place(f: number, sound: boolean): void {
    const { x, index } = reelPosition(f, this.rect.w, this.jitter, this.look.cellW);
    this.strip.x = x;
    if (index !== this.lastIndex) {
      if (sound && this.lastIndex >= 0) this.onTick();
      this.lastIndex = index;
    }
    if (f >= 1 !== this.landedShown) this.showLanded(f >= 1);
  }

  /** Landed: the winner outlined 1 px inside its card, every other cell dimmed (a one-time step, not a flash). */
  private showLanded(on: boolean): void {
    this.landedShown = on;
    this.cells.forEach((c, i) => (c.alpha = on && i !== WIN_INDEX ? LANDED_DIM : 1));
    this.winEdge.clear();
    const win = this.cells[WIN_INDEX];
    if (!on || !win) return;
    const w = this.look.cellW - this.look.gap;
    const h = this.rect.h - 2 * this.look.inset;
    const { x, y } = win.position;
    this.winEdge
      .rect(x, y, w, 1).fill({ color: WIN_EDGE })
      .rect(x, y + h - 1, w, 1).fill({ color: WIN_EDGE })
      .rect(x, y, 1, h).fill({ color: WIN_EDGE })
      .rect(x + w - 1, y, 1, h).fill({ color: WIN_EDGE });
  }
```

7. `rebuild()` builds the cells from the look and keeps `winEdge` above them. It must not destroy `winEdge`, so detach it first:

```ts
  private rebuild(): void {
    this.strip.removeChild(this.winEdge);
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    const { cellW, gap, inset } = this.look;
    const h = this.rect.h - 2 * inset;
    this.cells = this.items.map((skin, i) => {
      const cell = makeCell(this.skins, skin, this.look, h);
      cell.position.set(i * cellW + gap / 2, inset);
      return this.strip.addChild(cell);
    });
    this.strip.addChild(this.winEdge);
    this.landedShown = false; // place() re-applies it
  }
```

`start()` is unchanged. It sets `fraction` and calls `rebuild()` and `place()`, so a new spin clears the landed look, and a reload with `landed = true` shows it. `StackedReels`, `BotReels` and `BenchReels` need no other change, because the heights flow in through `rect.h`.

- [ ] **Step 4: Run the tests to verify they pass, then the full checks**

Run: `npx vitest run src/modules/casecremental/fx/reel src/modules/casecremental/fx/pixel`
Expected: PASS. That includes the unchanged `Reel.test.ts` (`CARD_W` = 30) and `benchReels.test.ts`.
Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/reel/cellLook.ts src/modules/casecremental/fx/reel/cellLook.test.ts src/modules/casecremental/fx/pixel/Reel.ts src/modules/casecremental/fx/pixel/BenchReels.ts
git commit -m "fix(reel): stacked multi-open reels show distinct cells - full art, shrunk art or clean tiles - a clear marker and a clean landing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 4: Coins fly behind the reels

**Files:**
- Create: `src/modules/casecremental/fx/juice/coins.test.ts`
- Modify: `src/modules/casecremental/fx/juice/coins.ts` (flights in world px in a `flyers` container; `setTextSize`)
- Modify: `src/modules/casecremental/fx/hd/HdLayer.ts` (`this.coins.setScale(k, …)` → `this.coins.setTextSize(hdFontSize(k, 16))`)
- Modify: `src/modules/casecremental/fx/World.ts` (add `this.hd.coins.flyers` to the pixel world under the reels; world-px HUD target; the sale burst in world px)
- Modify: `src/modules/casecremental/fx/stations/deps.ts` (the `hud` doc says world px)
- Modify: `src/modules/casecremental/fx/stations/GridStation.ts` (the coin spark from the cell's world centre)

**Interfaces:**
- Produces: `Coins.flyers: Container` (pixel world), `Coins.container: Container` (HD, the texts only), `Coins.burst(from: Pt, to: Pt, amount: number)` and `Coins.spark(from: Pt, to: Pt)` in **world px**, `Coins.setTextSize(textSize: number)`. `StationDeps.hud()` returns **world px**. Task 6 passes a world-px point from `TrayView.claimed` as a burst source.

- [ ] **Step 1: Write the failing test**

`src/modules/casecremental/fx/juice/coins.test.ts`:

```ts
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { Coins } from "./coins";

// F1 #3: the sale coins (12×22 spinning frames, the "golden bullets" at ×5) fly in the pixel world, in a layer the World
// puts under the reels, so a stream of sales never covers a reel's window.

const frame = () => new Texture({ source: new TextureSource({ width: 12, height: 22 }) });

describe("Coins", () => {
  it("fly in the pixel-world layer at 1:1 world px, never in the HD layer", () => {
    const c = new Coins([frame(), frame()]);
    c.burst({ x: 40, y: 150 }, { x: 160, y: 9 }, 500);
    c.spark({ x: 80, y: 120 }, { x: 160, y: 9 });
    expect(c.flyers.children.length).toBeGreaterThan(1);
    expect(c.container.children).toHaveLength(0);
    for (const s of c.flyers.children) expect(s.scale.x).toBe(1);
  });

  it("leave from within 5 world px of the sale, move in whole px, and are gone once landed", () => {
    const c = new Coins([frame()]);
    c.burst({ x: 40, y: 150 }, { x: 160, y: 9 }, 1); // one coin
    c.update(0.001);
    const s = c.flyers.children[0]!;
    expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
    expect(Math.abs(s.x - 40)).toBeLessThanOrEqual(6);
    expect(Math.abs(s.y - 150)).toBeLessThanOrEqual(6);
    c.update(2);
    expect(c.flyers.children).toHaveLength(0);
  });

  it("keep their path in world px when the text size changes (a resize mid-flight)", () => {
    const c = new Coins([frame()]);
    c.spark({ x: 80, y: 120 }, { x: 160, y: 9 });
    c.update(0.25);
    const s = c.flyers.children[0]!;
    const at = { x: s.x, y: s.y };
    c.setTextSize(48);
    c.update(0);
    expect({ x: s.x, y: s.y }).toEqual(at);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/juice/coins.test.ts`
Expected: FAIL. `c.flyers` is undefined.

- [ ] **Step 3: Implement**

`src/modules/casecremental/fx/juice/coins.ts`. Replace the header comment with:

```ts
// Money you can see: spinning pixel coins arc from the sold skin to the cash counter, and the amount pops and floats up
// in gold. The coins fly in the pixel world (world px, whole pixels), in a layer the World puts under the reels and the
// bench's cards, so a stream of sales passes behind a reel's window instead of covering it (F1: at ×5 a column of them
// hid all five markers). The amounts are HD text (screen px).
```

Then:
- Add `/** The flying coins: pixel world, world px. */ readonly flyers = new Container();` above `container`. Change `container`'s doc to `/** The amounts that pop and float up (HD, screen px). */`.
- Delete the `pixelScale` field. Replace `setScale(pixelScale, textSize)` with `setTextSize(textSize: number): void { this.textSize = textSize; }`.
- In `burst`, drop `const k = this.pixelScale;` and every `* k`. The spreads become world px: `from` ±5 (`(Math.random() - 0.5) * 10`), `ctrl.x` ±20 (`(Math.random() - 0.5) * 40`), and `ctrl.y = Math.min(from.y, to.y) - (8 + Math.random() * 30)`. Delays and durations stay as they are.
- In `spark`, `ctrl.y = Math.min(from.y, to.y) - 12`.
- In `take()`, use `s.scale.set(1);` and `this.flyers.addChild(s);`.
- Update the doc on `burst` and `spark`: "`from`/`to` in world px."

`src/modules/casecremental/fx/hd/HdLayer.ts`: in `layout`, change `this.coins.setScale(k, hdFontSize(k, 16));` to `this.coins.setTextSize(hdFontSize(k, 16));`. Change the header comment's mention of coins to say "coin amounts (the coins themselves fly in the pixel world, coins.ts)".

`src/modules/casecremental/fx/World.ts`:
- In the constructor's `this.pixel.world.addChild(...)`, insert `this.hd.coins.flyers,` between `this.tray.root,` and `this.benchReels.root,`. The coins then pass under the reels and the bench's cards, and over the room and the tray.
- `hud: () => ({ x: this.l.worldW / 2, y: this.l.hudH / 2 }),` (world px).
- In `onEvent` `"sold"`, replace the burst line with `this.hd.coins.burst(src, { x: this.l.worldW / 2, y: this.l.hudH / 2 }, e.amount);`. Keep `const at = this.hd.toScreen(src);` for the float text.

`src/modules/casecremental/fx/stations/deps.ts`: `/** Where coins fly: the HUD's cash, world px. */`.

`src/modules/casecremental/fx/stations/GridStation.ts`: split `cellCentre`:

```ts
  /** World centre of cell i, world px. */
  private cellWorld(i: number): Pt {
    const r = this.rects[i] ?? this.l?.grid ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** World centre of cell i, screen px (breakouts start there). */
  cellCentre(i: number): Pt {
    return this.d.juice.hd.toScreen(this.cellWorld(i));
  }
```

In `sold()`, use `this.d.juice.hd.coins.spark(this.cellWorld(e.slot), this.d.hud());`. Breakouts keep using `cellCentre`. F2 deletes the grid, so make no other change there.

- [ ] **Step 4: Run the tests to verify they pass, then the full checks**

Run: `npx vitest run src/modules/casecremental/fx/juice src/modules/casecremental/fx/stations`
Expected: PASS.
Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green. If typecheck flags another `coins.setScale` or `coins.burst` caller, convert it to world px the same way. The grep in the diagnosis found only `World.ts`, `GridStation.ts` and `HdLayer.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/juice/coins.ts src/modules/casecremental/fx/juice/coins.test.ts src/modules/casecremental/fx/hd/HdLayer.ts src/modules/casecremental/fx/World.ts src/modules/casecremental/fx/stations/deps.ts src/modules/casecremental/fx/stations/GridStation.ts
git commit -m "fix(coins): sale coins fly in the pixel world under the reels - no more golden column over the x5 markers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 5: The tray's animation rules (pure)

**Files:**
- Create: `src/modules/casecremental/fx/pixel/trayRules.ts`
- Create: `src/modules/casecremental/fx/pixel/trayRules.test.ts`

**Interfaces:**
- Consumes: `Pt`, `Rect` (fx/pixel/layout.ts), `RarityId` (sim/types.ts).
- Produces (Task 6 uses all of these):
  - `TRAY_LOOK = { slide: 0.3, arc: 6, bounce: 0.15, hop: 2, pop: 0.25, popGrow: 0.6, glow: { base: 0.35, swing: 0.09, period: 1.2 }, full: { base: 0.75, swing: 0.09, period: 1.0 } }`
  - `interface Throb { base: number; swing: number; period: number }`; `throb(t: number, p: Throb): number`
  - `slideAt(from: Pt, to: Pt, t: number): Pt | null` (top-left points, whole px)
  - `popLook(t: number): { scale: number; alpha: number } | null`
  - `glows(r: RarityId): boolean`
  - `slotArtBox(r: Rect): { w: number; h: number }`
  - `interface Slide { readonly id: number; readonly from: Pt; t: number }`; `interface Pop { readonly id: number; readonly at: Pt; readonly dragged: boolean; t: number }`
  - `class TrayMotion { readonly slides: Map<number, Slide>; pops: Pop[]; arriving(id: number, from: Pt): void; claimed(id: number, at: Pt | null): void; flying(id: number): boolean; update(ids: readonly number[], dt: number, slotCentre: (i: number) => Pt): number[]; settle(): void }`

- [ ] **Step 1: Write the failing test**

`src/modules/casecremental/fx/pixel/trayRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fitArt } from "../skins/thumb";
import { glows, popLook, slideAt, slotArtBox, throb, TRAY_LOOK, TrayMotion } from "./trayRules";

// F1 #4: the claim tray comes alive — cards slide in from where they were and hop onto their slot, a claimed card pops
// out, Covert and ★ glow softly, a full tray pulses its frame red. All pure, so a reload and a resize come out right.

const { slide, bounce, pop } = TRAY_LOOK;

describe("slideAt", () => {
  const from = { x: 40, y: 60 };
  const to = { x: 120, y: 160 };

  it("starts where the card was and reaches its slot after the slide, in whole px", () => {
    expect(slideAt(from, to, 0)).toEqual(from);
    expect(slideAt(from, to, slide)).toEqual(to);
    for (let t = 0; t < slide + bounce; t += 0.01) {
      const p = slideAt(from, to, t)!;
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    }
  });

  it("arcs up on the way, then hops at most 2 px on the slot and settles", () => {
    const mid = slideAt(from, to, slide / 2)!;
    const e = 1 - 0.5 ** 3;
    expect(mid.y).toBeLessThan(from.y + (to.y - from.y) * e);
    for (let t = slide; t < slide + bounce; t += 0.01) {
      const p = slideAt(from, to, t)!;
      expect(p.x).toBe(to.x);
      expect(p.y).toBeLessThanOrEqual(to.y);
      expect(p.y).toBeGreaterThanOrEqual(to.y - TRAY_LOOK.hop);
    }
    expect(slideAt(from, to, slide + bounce)).toBeNull();
  });
});

describe("popLook", () => {
  it("grows to 1.6× and fades out over 0.25 s, then is gone", () => {
    expect(popLook(0)).toEqual({ scale: 1, alpha: 1 });
    let last = popLook(0)!;
    for (let t = 0.02; t < pop; t += 0.02) {
      const l = popLook(t)!;
      expect(l.scale).toBeGreaterThan(last.scale);
      expect(l.alpha).toBeLessThan(last.alpha);
      expect(l.scale).toBeLessThanOrEqual(1 + TRAY_LOOK.popGrow);
      last = l;
    }
    expect(popLook(pop)).toBeNull();
  });
});

describe("the tray's pulses and photosensitivity", () => {
  it("swing by less than 0.1 from peak to peak (the BEAT_LIGHT_AMPLITUDES rule), whatever the time", () => {
    for (const p of [TRAY_LOOK.glow, TRAY_LOOK.full]) {
      expect(p.swing).toBeLessThan(0.1);
      let lo = Infinity;
      let hi = -Infinity;
      for (let t = 0; t < 5; t += 0.01) {
        lo = Math.min(lo, throb(t, p));
        hi = Math.max(hi, throb(t, p));
      }
      expect(hi - lo).toBeLessThan(0.1);
      expect((hi + lo) / 2).toBeCloseTo(p.base, 2);
    }
  });

  it("glow only for Covert and ★", () => {
    expect(glows("covert")).toBe(true);
    expect(glows("gold")).toBe(true);
    for (const r of ["milspec", "restricted", "classified"] as const) expect(glows(r)).toBe(false);
  });
});

describe("slotArtBox", () => {
  it("is the slot inside its 1-px edge, and a skin fits it keeping its shape", () => {
    expect(slotArtBox({ x: 5, y: 5, w: 10, h: 7 })).toEqual({ w: 8, h: 5 });
    expect(slotArtBox({ x: 0, y: 0, w: 3, h: 3 })).toEqual({ w: 1, h: 1 });
    expect(fitArt(26, 10, slotArtBox({ x: 0, y: 0, w: 10, h: 7 }))).toEqual({ w: 8, h: 3 });
  });
});

describe("TrayMotion", () => {
  const centre = (i: number) => ({ x: 100 + i * 11, y: 160 });

  it("animates nothing on its first frame — a reload or a new World with a full tray (Review Focus 5)", () => {
    const m = new TrayMotion();
    m.arriving(3, { x: 0, y: 0 });
    expect(m.update([1, 2, 3], 0.016, centre)).toEqual([]);
    expect(m.slides.size).toBe(0);
    expect(m.pops).toEqual([]);
  });

  it("slides a stored card in from its spot, reports its landing once, and lets it settle", () => {
    const m = new TrayMotion();
    m.update([1], 0.016, centre);
    m.arriving(2, { x: 40, y: 60 });
    m.update([1, 2], 0.016, centre);
    expect(m.flying(2)).toBe(true);
    expect(m.slides.get(2)!.from).toEqual({ x: 40, y: 60 });
    expect(m.update([1, 2], slide - 0.05, centre)).toEqual([]);
    expect(m.update([1, 2], 0.1, centre)).toEqual([2]);
    expect(m.update([1, 2], 0.01, centre)).toEqual([]);
    m.update([1, 2], bounce, centre);
    expect(m.flying(2)).toBe(false);
  });

  it("shows a card with no spot to come from (the grid's) in place, without a slide", () => {
    const m = new TrayMotion();
    m.update([], 0.016, centre);
    m.update([7], 0.016, centre);
    expect(m.flying(7)).toBe(false);
  });

  it("pops a claimed card at its slot when tapped, at the drop point when dragged; a card stored away does not pop", () => {
    const m = new TrayMotion();
    m.update([1, 2, 3], 0.016, centre);
    m.claimed(2, null);
    m.claimed(3, { x: 300, y: 170 });
    m.update([1], 0.016, centre);
    expect(m.pops.map((p) => [p.id, p.at, p.dragged])).toEqual([
      [2, centre(1), false],
      [3, { x: 300, y: 170 }, true],
    ]);
    m.update([], 0.016, centre); // card 1 went to the locker: no claim, no pop
    expect(m.pops.map((p) => p.id)).toEqual([2, 3]);
    m.update([], pop, centre);
    expect(m.pops).toEqual([]);
  });

  it("pops a card claimed while it is still sliding in, instead of finishing the slide (Review Focus 4)", () => {
    const m = new TrayMotion();
    m.update([], 0.016, centre);
    m.arriving(5, { x: 40, y: 60 });
    m.update([5], 0.016, centre);
    m.claimed(5, null);
    expect(m.update([], 0.05, centre)).toEqual([]);
    expect(m.flying(5)).toBe(false);
    expect(m.pops.map((p) => p.id)).toEqual([5]);
  });

  it("settles everything at once on a resize: no slide finishes later, no landing sound, no pop (Review Focus 3)", () => {
    const m = new TrayMotion();
    m.update([1], 0.016, centre);
    m.arriving(2, { x: 40, y: 60 });
    m.claimed(1, null);
    m.update([2], 0.016, centre);
    m.settle();
    expect(m.slides.size).toBe(0);
    expect(m.pops).toEqual([]);
    expect(m.update([2], 1, centre)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/pixel/trayRules.test.ts`
Expected: FAIL. `./trayRules` does not resolve.

- [ ] **Step 3: Implement**

`src/modules/casecremental/fx/pixel/trayRules.ts`:

```ts
import type { RarityId } from "../../sim/types";
import type { Pt, Rect } from "./layout";

// The claim tray's motion (F1), as pure functions and a small state machine fed the tray's ids each frame, so a
// reload, a resize and a claim mid-flight all come out right. A stored card slides in from where it waited (the bench,
// the bot, the locker), arcing up, and hops onto its slot; a claimed card pops out (grows and fades, in the HD layer);
// Covert and ★ glow, and a full tray's frame pulses red — both swinging under 0.1 (photosensitivity, as
// BEAT_LIGHT_AMPLITUDES).

export const TRAY_LOOK = {
  /** Seconds a stored card slides from its spot to its slot (ease-out), arcing this many px up on the way. */
  slide: 0.3,
  arc: 6,
  /** Then it hops this many px on the slot, over this long. */
  bounce: 0.15,
  hop: 2,
  /** A claimed card pops out over this long, growing by this much (×1.6 at the end) as it fades. */
  pop: 0.25,
  popGrow: 0.6,
  /** The Covert/★ glow's alpha: base, peak-to-peak swing, period (s). */
  glow: { base: 0.35, swing: 0.09, period: 1.2 },
  /** The full tray's red frame. */
  full: { base: 0.75, swing: 0.09, period: 1.0 },
} as const;

export interface Throb {
  base: number;
  swing: number;
  period: number;
}

/** A light that throbs around `base`, `swing` from peak to peak. */
export const throb = (t: number, p: Throb): number => p.base + (p.swing / 2) * Math.sin((2 * Math.PI * t) / p.period);

/** Covert and ★ glow in the tray. */
export const glows = (r: RarityId): boolean => r === "covert" || r === "gold";

/** Where a slot's art goes: inside its 1-px dark edge. */
export const slotArtBox = (r: Rect): { w: number; h: number } => ({ w: Math.max(0, r.w - 2), h: Math.max(0, r.h - 2) });

/** A stored card's top-left `t` s into its slide from `from` to its slot's top-left `to` (world px, whole): an ease-out
 *  arc, then a 2-px hop on the slot; null once it has settled. */
export function slideAt(from: Pt, to: Pt, t: number): Pt | null {
  const { slide, bounce, arc, hop } = TRAY_LOOK;
  if (t >= slide + bounce) return null;
  if (t < slide) {
    const p = Math.max(0, t / slide);
    const e = 1 - (1 - p) ** 3;
    return { x: Math.round(from.x + (to.x - from.x) * e), y: Math.round(from.y + (to.y - from.y) * e - arc * Math.sin(Math.PI * p)) };
  }
  return { x: to.x, y: Math.round(to.y - hop * Math.sin((Math.PI * (t - slide)) / bounce)) };
}

/** A claimed card's look `t` s into its pop (scale × its start size, alpha); null once it is gone. */
export function popLook(t: number): { scale: number; alpha: number } | null {
  if (t >= TRAY_LOOK.pop) return null;
  const u = Math.max(0, t / TRAY_LOOK.pop);
  return { scale: 1 + TRAY_LOOK.popGrow * (1 - (1 - u) ** 2), alpha: 1 - u };
}

export interface Slide {
  readonly id: number;
  /** The card's centre where it waited (world px). */
  readonly from: Pt;
  t: number;
}

export interface Pop {
  readonly id: number;
  /** Its centre (world px): its slot, or where it was dropped over the bin. */
  readonly at: Pt;
  /** Dragged to the bin (it pops at its lifted full size), else tapped (the slot's mini card). */
  readonly dragged: boolean;
  t: number;
}

/** The tray's slides and pops, fed the sim's tray each frame. The World tells it where a stored card came from
 *  (`arriving`) and which card was claimed (`claimed`) during the sim step; `update` turns those into motion. */
export class TrayMotion {
  readonly slides = new Map<number, Slide>();
  pops: Pop[] = [];
  private prev: number[] | null = null;
  private readonly origins = new Map<number, Pt>();
  private readonly claims = new Map<number, Pt | null>();

  /** A card the sim just stored, from its spot `from` (its centre, world px). */
  arriving(id: number, from: Pt): void {
    this.origins.set(id, from);
  }

  /** A card claimed: it pops at `at` (dropped over the bin), else at its slot. */
  claimed(id: number, at: Pt | null): void {
    this.claims.set(id, at);
  }

  /** Still sliding in (it cannot be grabbed yet). */
  flying(id: number): boolean {
    return this.slides.has(id);
  }

  /** The tray's ids this frame, in slot order, after `dt` s; `slotCentre(i)`: slot i's centre (world px). Returns the
   *  ids whose slide reached its slot this frame, each once (the store sound). The first frame animates nothing. */
  update(ids: readonly number[], dt: number, slotCentre: (i: number) => Pt): number[] {
    const landed: number[] = [];
    for (const s of this.slides.values()) {
      const was = s.t;
      s.t += dt;
      if (was < TRAY_LOOK.slide && s.t >= TRAY_LOOK.slide) landed.push(s.id);
      if (s.t >= TRAY_LOOK.slide + TRAY_LOOK.bounce) this.slides.delete(s.id);
    }
    this.pops = this.pops.filter((p) => (p.t += dt) < TRAY_LOOK.pop);
    if (this.prev) {
      const now = new Set(ids);
      this.prev.forEach((id, i) => {
        if (now.has(id)) return;
        this.slides.delete(id);
        if (!this.claims.has(id)) return; // stored away (the locker) or cashed in: it just goes
        const at = this.claims.get(id) ?? null;
        this.pops.push({ id, at: at ?? slotCentre(i), dragged: at !== null, t: 0 });
      });
      const before = new Set(this.prev);
      for (const id of ids) {
        const from = this.origins.get(id);
        if (!before.has(id) && from) this.slides.set(id, { id, from, t: 0 });
      }
    }
    this.prev = [...ids];
    this.origins.clear();
    this.claims.clear();
    return landed;
  }

  /** The screen changed: every slide lands and every pop ends at once (silently). */
  settle(): void {
    this.slides.clear();
    this.pops = [];
    this.origins.clear();
    this.claims.clear();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes, then the full checks**

Run: `npx vitest run src/modules/casecremental/fx/pixel/trayRules.test.ts`
Expected: PASS.
Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/pixel/trayRules.ts src/modules/casecremental/fx/pixel/trayRules.test.ts
git commit -m "feat(tray): the tray's motion rules - slide in with a hop, pop out, Covert/star glow and the full-tray pulse under 0.1

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 6: The tray comes alive on screen

**Files:**
- Modify: `src/modules/casecremental/fx/pixel/Tray.ts` (art per slot, slides, pops, glow, full frame, `arriving` and `claimed`)
- Modify: `src/modules/casecremental/fx/World.ts` (construct `TrayView` with deps, the z-order, `stored`/`sold` wiring, a steady red label)

**Interfaces:**
- Consumes: everything Task 5 produces; `fitArt` and `SkinTextures.size`/`thumb` (Task 2); `Throttle` (fx/throttle.ts); `trayFull` (fx/labels.ts).
- Produces: `interface TrayDeps { scale: () => number; onLand: () => void }`; `miniCard(skins: SkinTextures, drop: Drop, w: number, h: number): Container`; `new TrayView(skins, controller, bake, deps: TrayDeps)`; `TrayView.over: Container` (pixel world, over the bench); `TrayView.hd: Container` (HD); `TrayView.update(items: readonly Drop[], capacity: number, dt: number, full: boolean): void`; `TrayView.arriving(id: number, from: Pt): void`; `TrayView.claimed(id: number): Pt`.

There are no new unit tests here. The rules are pinned in Task 5, and this task is Pixi drawing plus wiring. Its check is typecheck plus the full suite, and Task 7's browser check.

- [ ] **Step 1: Rewrite `Tray.ts`**

Keep `pointerMove`, `cancelDrag` and `lifted()` as they are. Change the rest as follows (complete code for everything new):

```ts
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { fitArt } from "../skins/thumb";
import { Throttle } from "../throttle";
import { cardFace } from "./cardFace";
import { DragTracker } from "./drag";
import { dropTarget } from "./dropTargets";
import type { Pt, Rect, TableLayout } from "./layout";
import { glows, popLook, slideAt, slotArtBox, throb, TRAY_LOOK, TrayMotion } from "./trayRules";
import { slotAt, traySlots } from "./traySlots";

// The claim tray (M2b spec §4): the good drops the bot set aside, one small card per slot — the skin's art on its rarity
// colour. Drag one to the SELL bin (or tap it) to claim it — a sale by hand, so it feeds the combo — or onto the locker
// to keep it. Dragged, it lifts at full card size. Since F1 it moves (trayRules.ts): a stored card slides in from its
// spot and hops onto its slot (the store sound as it lands), a claimed one pops out, Covert and ★ glow, and a full
// tray pulses its frame red.

export interface TrayDeps {
  /** The pixel scale now (glows and pops are HD). */
  scale: () => number;
  /** A sliding card reached its slot (the World plays tray-store). */
  onLand: () => void;
}

/** Lifted's LIFT: a dragged card's pop starts at its lifted size. */
const LIFT = 1.15;
const FULL_RED = 0xff3b3b;

/** A tray card w×h: a dark edge, its rarity colour, the skin's still frame fitted inside. */
export function miniCard(skins: SkinTextures, drop: Drop, w: number, h: number): Container {
  const skin = skinById(drop.skinId);
  const card = new Container();
  card.addChild(
    new Graphics()
      .rect(0, 0, w, h)
      .fill({ color: 0x120e10 })
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: 0x15161d })
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: RARITY_INFO[drop.rarity].color, alpha: 0.6 }),
  );
  const box = slotArtBox({ x: 0, y: 0, w, h });
  if (box.w > 0 && box.h > 0) {
    const size = skins.size(skin);
    const fit = fitArt(size.w, size.h, box);
    const art = new Sprite(skins.thumb(skin, fit.w, fit.h));
    art.position.set(Math.floor((w - fit.w) / 2), Math.floor((h - fit.h) / 2));
    card.addChild(art);
  }
  return card;
}

export class TrayView {
  /** Slots, settled cards and the full frame (pixel world, in the room's front). */
  readonly root = new Container();
  /** Cards sliding in (pixel world, over the bench). */
  readonly over = new Container();
  /** Covert/★ glows and claimed cards popping out (HD). */
  readonly hd = new Container();
  private readonly bg = new Graphics();
  private readonly cards = new Container();
  private readonly fullFrame = new Graphics();
  private readonly glow = new Graphics();
  private readonly drag = new DragTracker();
  private readonly motion = new TrayMotion();
  private readonly flying = new Map<number, Container>();
  private readonly popping = new Map<number, { sprite: Sprite; tex: Texture }>();
  /** Cards let go over the bin: where (centre, world px) and their lifted face, for their pop. */
  private readonly dropped = new Map<number, { at: Pt; tex: Texture }>();
  /** Last frame's drops by id (a claimed card is gone from the sim when it pops). */
  private known = new Map<number, Drop>();
  private readonly landSound = new Throttle(0.1);
  private slots: Rect[] = [];
  private items: readonly Drop[] = [];
  private l: TableLayout | null = null;
  private drawn = "";
  private liftTex: Texture | null = null;
  private t = 0;

  constructor(
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    private readonly bake: (c: Container) => Texture,
    private readonly deps: TrayDeps,
  ) {
    this.glow.blendMode = "add";
    this.root.addChild(this.bg, this.cards, this.fullFrame);
    this.hd.addChild(this.glow);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.drawn = "";
    this.motion.settle(); // Review Focus 3: a resize mid-slide or mid-pop settles at once
    this.clearMotion();
    const r = l.tray;
    const [x, y, w, h] = [r.x - 2, r.y - 2, r.w + 4, r.h + 4]; // just outside the tray art (which overhangs 1 px)
    this.fullFrame
      .clear()
      .rect(x, y, w, 1)
      .fill({ color: FULL_RED })
      .rect(x, y + h - 1, w, 1)
      .fill({ color: FULL_RED })
      .rect(x, y, 1, h)
      .fill({ color: FULL_RED })
      .rect(x + w - 1, y, 1, h)
      .fill({ color: FULL_RED });
    this.fullFrame.alpha = 0;
  }

  /** A card the sim just stored, from its spot (centre, world px): it slides in. */
  arriving(id: number, from: Pt): void {
    this.motion.arriving(id, from);
  }

  /** A card claimed (sold by hand): it pops out where it was dropped over the bin, else at its slot. Returns that point
   *  (world px) — the sale's coins start there. */
  claimed(id: number): Pt {
    const at = this.dropped.get(id)?.at ?? null;
    this.motion.claimed(id, at);
    const i = this.items.findIndex((d) => d.id === id);
    if (at) return at;
    if (i >= 0 && this.slots[i]) return this.slotCentre(i);
    const r = this.l?.tray ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  update(items: readonly Drop[], capacity: number, dt: number, full: boolean): void {
    const l = this.l;
    if (!l) return;
    this.t += dt;
    this.items = items;
    this.slots = traySlots(l.tray, capacity);
    const landed = this.motion.update(
      items.map((d) => d.id),
      dt,
      (i) => this.slotCentre(i),
    );
    if (landed.length && this.landSound.ready(this.t)) this.deps.onLand(); // one store sound for cards landing together
    this.drawSlides(items);
    this.drawPops();
    for (const [id, d] of this.dropped) if (!this.popping.has(id)) (d.tex.destroy(true), this.dropped.delete(id)); // a refused claim
    this.known = new Map(items.map((d) => [d.id, d]));
    const k = this.deps.scale();
    const dragging = this.drag.dragging;
    const key = `${capacity}|${items.map((d) => d.id).join(",")}|${dragging ?? ""}|${[...this.motion.slides.keys()].join(",")}|${k}`;
    if (key !== this.drawn) {
      this.drawn = key;
      this.redraw(items, dragging, k);
    }
    this.glow.alpha = throb(this.t, TRAY_LOOK.glow);
    this.fullFrame.alpha = full ? throb(this.t, TRAY_LOOK.full) : 0;
  }

  pointerDown(p: Pt): boolean {
    const i = slotAt(this.slots, p);
    const d = i >= 0 ? this.items[i] : undefined;
    if (!d || this.motion.flying(d.id)) return false; // Review Focus 4: a card still sliding in cannot be grabbed
    this.drag.down(p, [{ id: `tray:${i}`, rect: this.slots[i]! }]);
    this.liftTex?.destroy(true);
    const face = cardFace(this.skins.frames(skinById(d.skinId))[0] ?? null, d);
    this.liftTex = this.bake(face);
    face.destroy({ children: true });
    return true;
  }

  pointerUp(p: Pt): void {
    const id = this.drag.dragging;
    const lift = this.lifted();
    const end = this.drag.up(p);
    const l = this.l;
    if (!id || !l) return;
    const index = Number(id.slice("tray:".length));
    const target = end.kind === "drop" ? dropTarget(l, end.at, this.controller.run.state.locker.on) : null;
    const d = this.items[index];
    if (target === "bin" && d && lift && this.liftTex) {
      this.dropped.set(d.id, { at: lift.center, tex: this.liftTex }); // its pop takes the lifted face
      this.liftTex = null;
    }
    if (end.kind === "tap" || target === "bin") this.controller.act({ type: "claim", index });
    if (target === "locker") this.controller.act({ type: "storeCard", from: "tray", slot: index });
  }

  destroy(): void {
    this.liftTex?.destroy(true);
    this.liftTex = null;
    this.clearMotion();
  }

  private slotCentre(i: number): Pt {
    const r = this.slots[i]!;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** Empty slots, the settled cards (a card being dragged or still sliding leaves its slot empty), and the glows. */
  private redraw(items: readonly Drop[], dragging: string | null, k: number): void {
    this.bg.clear();
    for (const c of this.cards.removeChildren()) c.destroy({ children: true });
    this.glow.clear();
    this.slots.forEach((r, i) => {
      const d = items[i];
      if (!d || dragging === `tray:${i}` || this.motion.flying(d.id)) {
        this.bg.rect(r.x, r.y, r.w, r.h).fill({ color: 0x120e10, alpha: 0.35 });
        return;
      }
      const card = miniCard(this.skins, d, r.w, r.h);
      card.position.set(r.x, r.y);
      this.cards.addChild(card);
      if (glows(d.rarity)) this.glow.rect((r.x - 1) * k, (r.y - 1) * k, (r.w + 2) * k, (r.h + 2) * k).fill({ color: RARITY_INFO[d.rarity].color });
    });
  }

  /** Cards sliding in, drawn over the bench at their place on the slide. */
  private drawSlides(items: readonly Drop[]): void {
    for (const [id, c] of this.flying)
      if (!this.motion.flying(id)) {
        c.destroy({ children: true });
        this.flying.delete(id);
      }
    items.forEach((d, i) => {
      const s = this.motion.slides.get(d.id);
      const r = this.slots[i];
      if (!s || !r) return;
      let c = this.flying.get(d.id);
      if (!c) {
        c = miniCard(this.skins, d, r.w, r.h);
        this.over.addChild(c);
        this.flying.set(d.id, c);
      }
      const at = slideAt({ x: Math.round(s.from.x - r.w / 2), y: Math.round(s.from.y - r.h / 2) }, { x: r.x, y: r.y }, s.t);
      if (at) c.position.set(at.x, at.y);
    });
  }

  /** Claimed cards popping out (HD): a dragged one at its lifted size where it was dropped, a tapped one at its slot. */
  private drawPops(): void {
    const k = this.deps.scale();
    const live = new Set(this.motion.pops.map((p) => p.id));
    for (const [id, p] of this.popping)
      if (!live.has(id)) {
        p.sprite.destroy();
        p.tex.destroy(true);
        this.popping.delete(id);
      }
    for (const pop of this.motion.pops) {
      let p = this.popping.get(pop.id);
      if (!p) {
        const dropped = this.dropped.get(pop.id);
        const drop = this.known.get(pop.id);
        const r = this.slots[0];
        let tex: Texture | null = null;
        if (pop.dragged && dropped) {
          tex = dropped.tex;
          this.dropped.delete(pop.id);
        } else if (drop && r) {
          const face = miniCard(this.skins, drop, r.w, r.h);
          tex = this.bake(face);
          face.destroy({ children: true });
        }
        if (!tex) continue;
        p = { sprite: new Sprite({ texture: tex, anchor: 0.5 }), tex };
        this.hd.addChild(p.sprite);
        this.popping.set(pop.id, p);
      }
      const look = popLook(pop.t);
      if (!look) continue;
      p.sprite.position.set(pop.at.x * k, pop.at.y * k);
      p.sprite.scale.set(k * (pop.dragged ? LIFT : 1) * look.scale);
      p.sprite.alpha = look.alpha;
    }
  }

  /** Drop every sliding card, pop and dropped face (a resize, or the scene going away). */
  private clearMotion(): void {
    for (const c of this.flying.values()) c.destroy({ children: true });
    this.flying.clear();
    for (const p of this.popping.values()) {
      p.sprite.destroy();
      p.tex.destroy(true);
    }
    this.popping.clear();
    for (const d of this.dropped.values()) d.tex.destroy(true);
    this.dropped.clear();
  }
}
```

Notes for the implementer:
- `this.drag.up(p)` is called after `this.lifted()`, because the lifted centre must be read before the drag ends.
- The refused-claim cleanup line uses a comma expression inside a parenthesised statement. If Prettier or lint objects, write it as a block. The behaviour must stay the same: a dropped face whose claim never popped is destroyed after the frame.
- A tray slot is at most 10×7 (`traySlots`), so the art is about 8×3 px. That is what the spec asks for ("scaled to the slot"). Do not change `traySlots`.

- [ ] **Step 2: Wire the World**

`src/modules/casecremental/fx/World.ts`. Keep the net growth to about 12 lines or fewer (Global Constraints).
- Construction: `this.tray = new TrayView(skins, controller, bake, { scale: () => this.vp.scale, onLand: () => audio.play("tray-store") });`.
- Pixel world order: after Task 4 it is `this.room.back, this.room.front, this.stations.under, this.tray.root, this.hd.coins.flyers, this.benchReels.root, this.stations.reels, this.bench.root, this.tray.over, this.stations.over`. Insert `this.tray.over` after `this.bench.root`, so a card sliding in from the bench passes over the bench's cards.
- HD root: `this.hd.root.addChild(this.hint, ...this.label, this.offline, this.trayFullLabel, this.stations.hd, this.tray.hd, this.lifted.root);`.
- The label: `new Text({ text: "", style: pixelStyle(8, 0xff5a4a) })` instead of `0xffb020`. Delete the `trayBlink` field and its increment.
- In `update`:

```ts
    const trayIsFull = trayFull(run.state, run.setup.trayCapacity);
    this.tray.update(run.state.tray, run.setup.trayCapacity, realSeconds, trayIsFull);
    this.trayFullLabel.visible = trayIsFull; // steady while full; the frame pulses (Tray.ts)
```

  This replaces the old `this.tray.update(…)`, `this.trayBlink += …` and blinking `visible` lines.
- `onEvent` `"stored"`:

```ts
      case "stored":
        if (e.from === "grid") break; // the grid's station plays its own (throttled) sound
        this.tray.arriving(e.drop.id, this.spotOf(e.from, e.slot)); // it slides in from its spot; tray-store plays as it lands
        if (e.from === "bench") this.benchFx.left(e.slot, false, this.controller.run.state.bench);
        break;
```

  The old `this.audio.play("tray-store");` line goes. `arriving` must come before `benchFx.left`, so the bench card's spot is read while the card is still there.
- `onEvent` `"sold"`: in the `src` chain, add the tray before the bin fallback:

```ts
              : e.source === "seller"
                ? this.l.seller
                : e.source === "tray"
                  ? this.tray.claimed(e.drop.id) // it pops out where it was; the coins start there
                  : this.l.bin;
```

- [ ] **Step 3: Run the full checks**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green. If a test constructs `TrayView` with three arguments, pass `{ scale: () => 1, onLand: () => {} }`. None did at the time of writing.

- [ ] **Step 4: Commit**

```bash
git add src/modules/casecremental/fx/pixel/Tray.ts src/modules/casecremental/fx/World.ts
git commit -m "feat(tray): skin art per slot, cards slide in and hop, claims pop out, Covert/star glow, a full tray pulses red

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 7: Browser check and feature history

This is the browser check at the end of the phase (spec §11): the M3 setup, a scratch harness without sign-in plus headless Chrome over CDP. Everything under `.superpowers/` is gitignored scratch. Only the feature-history docs are committed.

**Files:**
- Modify (scratch, not committed): `.superpowers/harness/harness.tsx`
- Use (scratch, not committed): `.superpowers/harness/cdp.mjs`, `.superpowers/harness/h.sh`, `.superpowers/harness/fps.js`. These were copied from M3's scratchpad when this plan was written. `cdp.mjs` needs Node ≥ 22 for its global `WebSocket`; this machine has 24.
- Create: `docs/feature-history/casecremental-finish.md`
- Modify: `docs/feature-history/README.md` (one line)

**How the harness works.** `index.html` mounts the real scene and panel without sign-in. Query parameters set the state, and `window.cc = { controller, camera }` is exposed for `eval`. Vite serves it at `http://localhost:5180/.superpowers/harness/index.html?…`. `cdp.mjs` drives a Chrome started with `--remote-debugging-port=9333`. Its commands are `nav <url> [waitMs]`, `eval <js>`, `shot <png>`, `zshot <png> x y w h scale`, `pshot <png> w h waitMs` (a phone viewport), `size <w> <h>`, `click x y`, `drag …`, `cast <dir> <seconds> [js]` (a screencast to JPEGs) and `console`. `h.sh` defines the shell helpers `E` (eval), `S` (shot), `Z` (zoomed shot) and `P` (phone shot), writing to `.superpowers/harness/shots/`.

- [ ] **Step 1: Extend the harness (scratch)**

In `.superpowers/harness/harness.tsx`, add `import { caseById } from "../../src/modules/casecremental/sim/content/cases";`, `import { benchReelArea, tableLayout } from "../../src/modules/casecremental/fx/pixel/layout";` and `import { pixelViewport } from "../../src/modules/casecremental/fx/pixel/viewport";`. Replace the body of the `scene.ready?.().then(async () => { … })` callback after `if (persist) { … return; }` with:

```ts
  const s = controller.run.state;
  s.cash = Number(q.get("cash") ?? 500);
  const n = Number(q.get("n") ?? 1); // multi-open ×n
  if (n > 1) {
    s.upgrades.multiOpen = n - 1;
    s.cash = Math.max(s.cash, 1e6);
  }
  if (q.get("seller")) {
    s.seller.on = true;
    s.seller.threshold = q.get("seller") as typeof s.seller.threshold; // e.g. milspec: everything rarer goes to the tray
  }
  const tray = q.get("tray"); // full | some
  if (tray) {
    const skins = caseById("bootcamp").skins;
    const order = ["gold", "covert", "classified", "restricted", "milspec"] as const;
    const count = tray === "full" ? controller.run.setup.trayCapacity : 5;
    for (let i = 0; i < count; i++) {
      const sk = skins.find((x) => x.rarity === order[i % order.length]) ?? skins[0]!;
      (s.tray as unknown as object[]).push({ id: 9000 + i, caseId: "bootcamp", skinId: sk.id, rarity: sk.rarity, float: 0.1, wear: "FN", statTrak: false, value: 10 });
    }
  }
  const st = q.get("state") ?? "empty";
  if (st !== "empty") controller.act({ type: "buyCase", caseId: "bootcamp" });
  if (st === "spinning" || st === "midspin" || st === "revealed" || st === "gold") controller.act({ type: "insertKey" });
  if (st === "midspin") for (let i = 0; i < Number(q.get("steps") ?? 20); i++) controller.step(0.05);
  if (st === "revealed" || st === "gold") {
    const b = controller.run.state.bench;
    if (b.phase === "spinning" && st === "gold") b.drop = { ...b.drop, rarity: "gold", skinId: "bc_knife" };
    for (let i = 0; i < 600 && controller.run.state.bench.phase === "spinning"; i++) controller.step(0.05);
  }
  // the screen rect of a layout part, padded, as "x y w h" for cdp.mjs zshot: ccRect('tray' | 'reel', pad)
  (window as unknown as { ccRect: unknown }).ccRect = (name: string, pad = 8) => {
    const vp = pixelViewport(innerWidth, innerHeight);
    const l = tableLayout(vp);
    const r = name === "tray" ? l.tray : benchReelArea(l, n, true);
    return [r.x - pad, r.y - pad * 2, r.w + pad * 2, r.h + pad * 3].map((v) => Math.round(v * vp.scale)).join(" ");
  };
  const freeze = Number(q.get("freeze") ?? 0); // ms: then stop the ticker, so a screenshot catches this frame
  if (freeze) setTimeout(() => scene.suspend?.(), freeze);
  (window as unknown as { done: boolean }).done = true;
```

If `wear: "FN"` or the `b.drop` line does not typecheck, check `sim/types.ts`/`sim/wear.ts` and adjust. Vite's dev server does not typecheck the harness, but it must run.

- [ ] **Step 2: Start the dev server and Chrome (Bash)**

```bash
cd /c/Users/rainbow/dev/hackatons/solanaidos
npm run dev   # run_in_background: true; serves on port 5180
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 \
  --user-data-dir="$(cygpath -w "$TEMP")\\cc-f1-chrome" --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1920,1080 "http://localhost:5180/.superpowers/harness/index.html?state=empty"   # run_in_background: true
source .superpowers/harness/h.sh
H="http://localhost:5180/.superpowers/harness/index.html"
```

Wait until `$D eval "window.done"` prints `true`. If DNS or the platform gets in the way, remember the harness needs no sign-in or network beyond localhost. That is the point of it.

- [ ] **Step 3: The reels at ×2/×3/×5, desktop and portrait**

```bash
for n in 2 3 5; do
  $D nav "$H?state=midspin&n=$n&steps=16&freeze=700" 3000; S "f1-x$n-1920-midspin"; Z "f1-x$n-1920-midspin-zoom" $(E "ccRect('reel')") 2
  $D nav "$H?state=revealed&n=$n&freeze=400" 3000;           S "f1-x$n-1920-landed"
done
$D size 390 844            # resize the real window: it persists across commands (a pshot override does not, and a frozen ticker never re-lays out)
for n in 2 3 5; do
  $D nav "$H?state=midspin&n=$n&steps=16&freeze=700" 3000; S "f1-x$n-390x844-midspin"; Z "f1-x$n-390x844-zoom" $(E "ccRect('reel')") 2
  $D nav "$H?state=revealed&n=$n&freeze=400" 3000;           S "f1-x$n-390x844-landed"
done
$D size 1920 1080
```

If `size` does not take in headless mode, do the portrait shots without `freeze`: `$D nav "$H?state=midspin&n=$n&steps=40" 2500` followed by `P "f1-x$n-390x844-midspin" 390 844 600`. `pshot` resizes the viewport, and the live ticker re-lays out.

Pass criteria. Look at every PNG with the Read tool:
- Every strip has distinct cells with a dark gap between them. The cells show full art at ×2 and ×3, recognisable shrunk art at ×5 mid-spin, and clean rarity tiles in the ×5 compact (landed) window.
- There are no smeared noise pixels and no squashed frame metal.
- Every strip has a gold centre marker readable over every tile, a gold tile included.
- A landed strip has the winner outlined and the other cells dimmed.

- [ ] **Step 4: Coins behind the reels, and tray arrivals (screencast)**

```bash
$D nav "$H?state=empty&n=5&seller=milspec&cash=1000000" 3000
CAST_W=1920 CAST_H=1080 $D cast .superpowers/harness/shots/f1-cast-x5 9 \
  "cc.controller.act({type:'buyCase',caseId:'bootcamp'}); cc.controller.act({type:'insertKey'})"
```

Read about eight frames spread over the landing and the auto-seller's takes (`ls` the folder and pick by timestamp).

Pass criteria:
- No coin covers a reel window. Coins pass behind the reels.
- Cards slide from the bench cards to the tray, arcing up, and hop onto their slots.
- Nothing jumps.

Also run `$D console` and confirm there are no new errors. The known PixiJS "textureSource destroyed while still bound" warning on a resize predates M3 (`casecremental-runs-2-3.md`).

- [ ] **Step 5: The tray — art, glow, full pulse, claim pop**

```bash
$D nav "$H?state=empty&tray=full&seller=classified&freeze=0" 3000; S f1-tray-full-1920
Z f1-tray-full-zoom $(E "ccRect('tray', 12)") 2
$D size 390 844; $D nav "$H?state=empty&tray=full&seller=classified" 3000; S f1-tray-full-390x844; Z f1-tray-full-390-zoom $(E "ccRect('tray', 12)") 3; $D size 1920 1080
$D nav "$H?state=empty&tray=some" 3000
CAST_W=1920 CAST_H=1080 $D cast .superpowers/harness/shots/f1-cast-claim 1.5 "cc.controller.act({type:'claim',index:0})"
```

Pass criteria:
- Every slot shows the skin's art on its rarity colour.
- The Covert and ★ slots glow, and the glow moves softly across frames, with no blink.
- The full tray shows a red frame and a steady red "TRAY FULL" label (also check `lang=ru`: «ЛОТОК ПОЛОН»).
- In the claim cast, the card pops (grows and fades over about 0.25 s) and the coins start at the card.

- [ ] **Step 6: The drawer — measure, don't eyeball**

`shot.sh` hides scrollbars, so measure the overflow instead. On desktop the left panel's You tab fits its four upgrades. Measure for 1.2 s after a buy:

```bash
$D nav "$H?state=empty&cash=1000000" 3000
E "await (async () => { const sc = [...document.querySelectorAll('.cc-scroll')]; const before = sc.map(e => e.scrollHeight > e.clientHeight); document.querySelector('.cc-scroll .cc-btn:not(:disabled)').click(); const hits = []; const t0 = performance.now(); await new Promise(r => { const f = () => { for (const e of sc) if (e.scrollHeight > e.clientHeight || getComputedStyle(e).overflowX !== 'hidden') hits.push(Math.round(performance.now() - t0)); performance.now() - t0 < 1200 ? requestAnimationFrame(f) : r(); }; f(); }); return JSON.stringify({ before, hits: hits.slice(0, 5) }); })()"
```

Expected: `before` holds `false` for every scroll area that fits, and `hits` is `[]`. Repeat at 390×844: run `$D size 390 844` and `nav`, then open the drawer's Upgrades tab (the drawer's second tab) with `E "document.querySelectorAll('.cc-panel > .cc-tabs .cc-btn')[1].click()"`, then run the same measurement. Take `S f1-drawer-390x844` for the record, then `$D size 1920 1080`.

Text selection: `E "[getComputedStyle(document.querySelector('.cc-root')).userSelect, document.querySelector('canvas').style.getPropertyValue('user-select')]"` should print `["none","none"]`.

- [ ] **Step 7: Fix what the pass finds**

Commit any fix found here as its own `fix(scope): …` commit, with a test first where the rule is pure. Re-run `npx vitest run src/modules/casecremental && npm run typecheck && npm run build` before each commit. If the thin frame reads too faint against the table, give it a dark outer row: add `const OUTLINE = 0x120e10;` to `Reel.ts` and draw the thin frame as an `OUTLINE` rect with `METAL` 1 px inside it. Its inset becomes 2 for reels of 8 px and taller. Update `cellLook` and its test to match. Record the choice either way.

- [ ] **Step 8: Feature history**

Create `docs/feature-history/casecremental-finish.md`. Later phases (F2–F9) add their sections to the same file; the spec's §10 names it. Write it in the voice of the existing entries:

```markdown
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
  <what it found — fill in from Step 3–7>.
```

Fill in the last bullet with the real findings, and drop anything Steps 3–7 changed (for example, the thin frame's colour). Add one line to `docs/feature-history/README.md` under the existing entries:

```markdown
- [Casecremental finish (M4 + M5)](casecremental-finish.md) — F1: scrollbar flash, no selection, reels that read at ×5, coins behind the reels, a living claim tray
```

- [ ] **Step 9: Commit the docs**

```bash
git add docs/feature-history/casecremental-finish.md docs/feature-history/README.md
git commit -m "docs(feature-history): F1 - the scrollbar flash, reel cells by height, coins behind the reels, the tray's motion

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

Stop the dev server and Chrome when done. Then update the auto-memory progress note (`casecremental-progress.md`) with one line: F1 is done on `casecremental-finish`, and F2 is next.
