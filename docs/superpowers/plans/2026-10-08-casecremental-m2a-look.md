# Casecremental — Milestone 2a (Look, Layout, Animation, EN/RU, Audio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin and re-lay out Milestone 1's game as a pixel-art workbench with HD light and effects, a committed art + animation pipeline, Press Start 2P text in English and Russian, and ElevenLabs sound — gameplay unchanged.

**Architecture:** The pixel world (room, table, case, key, bins, reel, sleeping bot) is drawn into a low-resolution render texture and shown scaled by an integer factor; an HD layer (light, dust, glow, particles, coins, text pops) renders at full resolution on top; React panels (HUD, Upgrades board, Case shelf, Settings) sit over both, positioned in world-pixel units. Art comes from ChatGPT/ElevenLabs source images through Node scripts in `tools/art/` that apply the "v2 recipe". The simulation (`sim/`) and controller (`game/`) are untouched apart from a locale-aware cash formatter.

**Tech Stack:** TypeScript 5.9, React 19, PixiJS 8.22 (+ pixi-filters 6.1), GSAP 3.15, @fontsource/press-start-2p 5.3, Vitest 5, Node 24 (art tools, no extra deps), ElevenLabs MCP (audio, optional art).

**Spec:** `docs/superpowers/specs/2026-10-08-casecremental-m2a-look-design.md` (with `docs/superpowers/specs/2026-10-08-casecremental-campaign-and-table-design.md` and the base spec `docs/superpowers/specs/2026-10-07-casecremental-design.md`).

## Global Constraints

- New dependencies, exact versions: `@fontsource/press-start-2p@5.3.0`, `gsap@3.15.0`. No other new runtime or dev dependencies (art tools use only Node built-ins).
- Pixel world: height ≥ 180 world px on landscape; integer scale only; textures `scaleMode: "nearest"`; **pixel sprites are never scaled or rotated at runtime**.
- v2 recipe: smooth area downscale → hard alpha (≥ 128) → posterize each channel in steps of **48** → 1 px outline **`#120e10`**; characters **48 px** tall.
- Code eyes: 2×3 px blocks `#6fffe8` on a 5×5 visor patch `#0d1418`; states `open | half | closed | happy`; both eyes on one level per frame.
- All on-screen text uses **Press Start 2P**, bundled (no requests to Google Fonts or any non-platform host). Sizes are multiples of 8 px.
- Every player-visible string goes through `t()` / content-name helpers; both `en` and `ru` exist for every key and fit the key's character budget. Numbers: K/M/B/T suffixes in both languages; Russian uses a decimal comma.
- `sim/` and `game/` stay free of DOM/Pixi/React; module code imports only its own files and npm packages.
- Audio and art generated through MCP tools cost the user's credits: run `estimate_only` first and get the user's OK before spending; downloading generated files needs the user's OK (state file names and source).
- Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3
  ```

## Review Focus

1. **A sprite is missing or its source hasn't been generated yet** → the art build skips it with a warning and the game still starts, drawing a clearly marked placeholder instead of crashing (tests in Tasks 2 and 7).
2. **Language switched mid-run** (reel spinning, reveal card up, shop open) → every visible string, including skin names on the card and the cash suffix, updates at once (tests in Tasks 4, 5 and 11).
3. **Viewport resized or phone rotated mid-drag** → the drag is cancelled and the item returns home; no action fires (test in Task 9).
4. **Audio unavailable** (no AudioContext, autoplay blocked, a file fails to decode) → the game stays silent and keeps working (test in Task 13).
5. **Unusual viewports** (ultrawide 3440×1440, small 800×450, tablet portrait 820×1180, phone 390×844) → benches, tray and bins stay inside the table and never under a panel (tests in Task 6).

---

## File Structure

```
art/
  manifest.json            every asset: id, source, kind, frames, target size, eyes, outline
  PROMPTS.md               generation prompts per asset (ChatGPT or ElevenLabs gpt-image-2)
  style/bot-reference.png  the hi-bit bot — style reference attached to every prompt
  source/*.png             generated source images (masters, committed)
  preview/                 contact sheets written by the build (git-ignored)
tools/art/
  png.mjs                  PNG read/write (Node built-ins)
  ops.mjs                  pure image ops (reflow, downscale, posterize, frames, eyes, outline, cells)
  build.mjs                manifest → sprites (+ CLI: npm run art)
  *.test.mjs               Vitest tests on synthetic images
src/modules/casecremental/
  assets/sprites/*.png|json  built sprites (committed)
  assets/audio/*.mp3         ElevenLabs sounds <id>-<n>.mp3 and loops music-<stage>.mp3 (committed)
  i18n/index.ts, en.ts, ru.ts, budgets.ts, content.ts   language state, UI strings, budgets, content names
  fx/pixel/viewport.ts       integer scale + world size
  fx/pixel/layout.ts         table layout in world px (desktop + portrait)
  fx/pixel/timeline.ts       per-frame-timed keyframes with offsets/eyes/events (pure)
  fx/pixel/eyes.ts, blink.ts code eyes and blinking (pure)
  fx/pixel/sprites.ts        built sprites → Pixi textures (+ placeholders)
  fx/pixel/screen.ts         screen ↔ world px, canvas resolution, text sizes (pure)
  fx/pixel/drag.ts           world-space drag tracker (pure)
  fx/pixel/Actor.ts          a sheet frame with bands + code eyes
  fx/pixel/PixelLayer.ts     render texture + integer upscale
  fx/pixel/anims.ts          every prop's timelines (data)
  fx/pixel/Animated.ts       idle loop + one-shots on an actor
  fx/pixel/Room.ts           backdrop, lamp, table, mat, tray, seller, sleeping bot
  fx/pixel/Bench.ts          your case, key, bin, reveal card + input
  fx/pixel/Reel.ts           pixel reel
  fx/skins/pixelSkin.ts      weapon base × pattern (pure) + texture cache
  fx/hd/font.ts              Press Start 2P (bundled) + text styles
  fx/hd/tween.ts             GSAP presets
  fx/hd/ambience.ts          lamp flicker, dust (pure)
  fx/hd/HdLayer.ts           lamp, vignette, dust, glow, flash, z's, LED, sparks, coins
  fx/labels.ts               canvas text from state (pure)
  fx/audio/schedule.ts       variants, jitter, combo pitch, bar timing (pure)
  fx/audio/sounds.ts         sound catalogue + file index
  fx/audio/AudioEngine.ts    buses, limiter, ducking, music crossfade, silent fallback
  fx/World.ts                (rewritten) orchestrates layers, input, events
  ui/prefs.ts                language + volumes (local storage, safe)
  ui/pixelFrame.ts, styles.ts, hooks.ts, parts.tsx   9-slice frames, stylesheet, hooks, shared parts
  ui/Hud.tsx, UpgradesBoard.tsx, CaseShelf.tsx, Drawer.tsx, Settings.tsx, GamePanel.tsx
```

Deleted once replaced: `fx/BenchView.ts`, `fx/ReelView.ts`, `fx/drag.ts`, `fx/skins/skinTexture.ts` (Task 11), `fx/layout.ts` (+ its test), `ui/Shop.tsx` (Task 12), `fx/audio.ts` (Task 13).

Work happens on a branch (e.g. `casecremental-m2a`); merging into `master` only when the user says so.

---

### Task 1: Art tools — PNG I/O and pure image operations

**Files:**
- Create: `tools/art/png.mjs`, `tools/art/ops.mjs`
- Test: `tools/art/ops.test.mjs`

**Interfaces:**
- Produces (all images are `{ w, h, data: Uint8ClampedArray }` RGBA):
  - `readPng(path) → Img`, `writePng(path, img)` (8-bit RGB/RGBA, non-interlaced)
  - `createImage(w, h) → Img`, `fillRect(img, x, y, w, h, [r,g,b,a])`, `opaqueBounds(img, thr = 128) → {x0,y0,x1,y1} | null`
  - `reflowRows(img, { minGap = 4, minRowH = 16 } = {}) → Img`
  - `areaDownscale(img, factor) → Img`
  - `hardAlpha(img, thr = 128) → Img` (in place, returns img)
  - `posterize(img, step) → Img` (in place)
  - `ownFrames(img, n) → Array<{ img: Img, x0: number, y0: number } | null>`
  - `eraseEyes(frame: Img) → { eyes: [number, number][], level: number } | null` (in place)
  - `placeInCell(frame, { cellW, cellH, ground, sheetGround }) → { cell: Img, ox: number, oy: number }`
  - `outline(img, [r,g,b]) → Img` (in place)
  - `hstack(imgs) → Img`

- [ ] **Step 1: Write the failing tests**

`tools/art/ops.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import {
  areaDownscale, createImage, eraseEyes, fillRect, hardAlpha, hstack, opaqueBounds,
  outline, ownFrames, placeInCell, posterize, reflowRows,
} from "./ops.mjs";

const px = (img, x, y) => Array.from(img.data.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4));

describe("basic ops", () => {
  it("fillRect + opaqueBounds", () => {
    const img = createImage(10, 8);
    expect(opaqueBounds(img)).toBeNull();
    fillRect(img, 2, 3, 4, 2, [255, 0, 0, 255]);
    expect(opaqueBounds(img)).toEqual({ x0: 2, y0: 3, x1: 5, y1: 4 });
  });

  it("areaDownscale averages colour weighted by alpha", () => {
    const img = createImage(4, 4);
    fillRect(img, 0, 0, 2, 2, [200, 0, 0, 255]);
    fillRect(img, 2, 0, 2, 2, [0, 0, 200, 255]);
    const out = areaDownscale(img, 2);
    expect([out.w, out.h]).toEqual([2, 2]);
    expect(px(out, 0, 0)).toEqual([200, 0, 0, 255]);
    expect(px(out, 1, 0)).toEqual([0, 0, 200, 255]);
    expect(px(out, 0, 1)[3]).toBe(0); // empty half stays transparent
  });

  it("hardAlpha and posterize", () => {
    const img = createImage(2, 1);
    fillRect(img, 0, 0, 1, 1, [100, 30, 250, 200]);
    fillRect(img, 1, 0, 1, 1, [10, 10, 10, 90]);
    hardAlpha(img); posterize(img, 48);
    expect(px(img, 0, 0)).toEqual([96, 48, 240, 255]);
    expect(px(img, 1, 0)[3]).toBe(0);
  });

  it("outline adds a 1 px ring around opaque pixels only", () => {
    const img = createImage(5, 5);
    fillRect(img, 2, 2, 1, 1, [255, 255, 255, 255]);
    outline(img, [18, 14, 16]);
    expect(px(img, 1, 2)).toEqual([18, 14, 16, 255]);
    expect(px(img, 2, 1)).toEqual([18, 14, 16, 255]);
    expect(px(img, 1, 1)[3]).toBe(0); // 4-neighbour ring, corners stay empty
    expect(px(img, 2, 2)).toEqual([255, 255, 255, 255]);
  });

  it("hstack places images side by side", () => {
    const a = createImage(2, 3), b = createImage(3, 3);
    fillRect(b, 0, 0, 1, 1, [1, 2, 3, 255]);
    const s = hstack([a, b]);
    expect([s.w, s.h]).toEqual([5, 3]);
    expect(px(s, 2, 0)).toEqual([1, 2, 3, 255]);
  });
});

describe("sheets", () => {
  it("reflowRows puts rows side by side, each on its own ground line", () => {
    const img = createImage(20, 30);
    fillRect(img, 2, 2, 4, 6, [255, 0, 0, 255]);   // row 1, ground y=7
    fillRect(img, 2, 20, 4, 9, [0, 255, 0, 255]);  // row 2, taller, ground y=28
    const out = reflowRows(img, { minRowH: 4 });
    expect([out.w, out.h]).toEqual([40, 9]);
    expect(px(out, 3, 8)).toEqual([255, 0, 0, 255]);  // row 1 bottom sits on the last line
    expect(px(out, 23, 0)).toEqual([0, 255, 0, 255]); // row 2 starts at the top
  });

  it("ownFrames splits n columns, keeping a shape that leans over a boundary whole", () => {
    const img = createImage(40, 10);
    fillRect(img, 2, 2, 6, 6, [255, 0, 0, 255]);
    fillRect(img, 14, 2, 8, 6, [0, 255, 0, 255]); // crosses x=20 a bit, mostly in column 1
    fillRect(img, 32, 2, 4, 6, [0, 0, 255, 255]);
    const frames = ownFrames(img, 3);
    expect(frames.map((f) => f && f.x0)).toEqual([2, 14, 32]);
    expect(frames[1].img.w).toBe(8);
  });

  it("ownFrames returns null for an empty column", () => {
    const img = createImage(30, 10);
    fillRect(img, 2, 2, 5, 5, [255, 0, 0, 255]);
    expect(ownFrames(img, 3).slice(1)).toEqual([null, null]);
  });
});

describe("eyes", () => {
  function robotWithEyes(eyeY1, eyeY2) {
    const img = createImage(20, 20);
    fillRect(img, 2, 2, 16, 16, [96, 96, 144, 255]); // body
    fillRect(img, 5, 4, 10, 5, [0, 16, 32, 255]);    // dark visor
    fillRect(img, 6, eyeY1, 2, 2, [80, 240, 240, 255]);
    fillRect(img, 11, eyeY2, 2, 2, [80, 240, 240, 255]);
    return img;
  }

  it("finds two eyes, levels them, and paints them with the visor colour", () => {
    const img = robotWithEyes(5, 6);
    const r = eraseEyes(img);
    expect(r.eyes.length).toBe(2);
    expect(r.eyes[0][1]).toBe(r.eyes[1][1]);
    expect(r.level).toBeCloseTo(6, 0);
    expect(px(img, 6, 5)).toEqual([0, 16, 32, 255]);
  });

  it("returns null when there are no eyes", () => {
    const img = createImage(10, 10);
    fillRect(img, 1, 1, 8, 8, [96, 96, 144, 255]);
    expect(eraseEyes(img)).toBeNull();
  });

  it("placeInCell anchors the feet centre and keeps the sheet ground line", () => {
    const frame = createImage(6, 10);
    fillRect(frame, 0, 0, 6, 10, [255, 255, 255, 255]);
    const { cell, ox, oy } = placeInCell({ img: frame, x0: 100, y0: 20 }, { cellW: 20, cellH: 16, ground: 14, sheetGround: 29 });
    expect([cell.w, cell.h]).toEqual([20, 16]);
    expect(ox).toBe(8);           // round(cell centre 10 − feet centre 2.5) = 8
    expect(oy).toBe(5);           // y0 20 + (ground 14 − sheetGround 29) = 5
    expect(px(cell, 8, 14)[3]).toBe(255);
    expect(px(cell, 8, 15)[3]).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tools/art`
Expected: FAIL — cannot resolve `./ops.mjs`.

- [ ] **Step 3: Write `tools/art/png.mjs`**

```js
// Minimal PNG read/write for 8-bit RGB/RGBA, non-interlaced images. Node built-ins only.
import fs from "node:fs";
import zlib from "node:zlib";

export function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, ctype = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString("ascii", p + 4, p + 8), data = b.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9];
      if (data[8] !== 8 || data[12] !== 0) throw new Error(`${file}: only 8-bit non-interlaced PNG`);
    }
    if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : 0;
  if (!bpp) throw new Error(`${file}: only RGB/RGBA PNG`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const data = new Uint8ClampedArray(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) data[(y * w + x) * 4 + k] = k < bpp ? cur[x * bpp + k] : 255;
    prev = cur;
  }
  return { w, h, data };
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(buf) { let c = 0xffffffff; for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

export function writePng(file, img) {
  const { w, h, data } = img;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
```

- [ ] **Step 4: Write `tools/art/ops.mjs`**

```js
// Pure image operations for the art pipeline (the "v2 recipe"). An image is { w, h, data } (RGBA).

export const createImage = (w, h) => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });
const idx = (img, x, y) => (y * img.w + x) * 4;
const opaque = (img, x, y, thr = 128) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[idx(img, x, y) + 3] >= thr;

export function fillRect(img, x, y, w, h, rgba) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h) continue;
    img.data.set(rgba, idx(img, xx, yy));
  }
}

export function opaqueBounds(img, thr = 128) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (opaque(img, x, y, thr)) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Multi-row sheet → one row, each row aligned on its own ground line (lowest opaque pixel). */
export function reflowRows(img, { minGap = 4, minRowH = 16 } = {}) {
  const has = Array.from({ length: img.h }, (_, y) => { for (let x = 0; x < img.w; x++) if (opaque(img, x, y)) return true; return false; });
  const rows = [];
  for (let y = 0; y < img.h; y++) {
    if (!has[y]) continue;
    let e = y;
    for (;;) { let next = -1; for (let k = 1; k <= minGap && e + k < img.h; k++) if (has[e + k]) { next = e + k; break; } if (next < 0) break; e = next; }
    if (e - y + 1 >= minRowH) rows.push([y, e]);
    y = e;
  }
  if (rows.length <= 1) return img;
  const H = Math.max(...rows.map(([a, b]) => b - a + 1));
  const out = createImage(img.w * rows.length, H);
  rows.forEach(([top, ground], r) => {
    for (let y = top; y <= ground; y++) {
      const dy = H - 1 - (ground - y);
      out.data.set(img.data.subarray(idx(img, 0, y), idx(img, 0, y) + img.w * 4), idx(out, r * img.w, dy));
    }
  });
  return out;
}

/** Smooth area downscale by `factor` source pixels per output pixel, colour weighted by alpha. */
export function areaDownscale(img, factor) {
  const W = Math.ceil(img.w / factor), H = Math.ceil(img.h / factor), out = createImage(W, H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const x0 = Math.floor(gx * factor), x1 = Math.min(img.w, Math.ceil((gx + 1) * factor));
    const y0 = Math.floor(gy * factor), y1 = Math.min(img.h, Math.ceil((gy + 1) * factor));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = idx(img, x, y), al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
    }
    if (!n || a === 0) continue;
    out.data.set([r / a, g / a, b / a, (a / n) * 255], idx(out, gx, gy));
  }
  return out;
}

export function hardAlpha(img, thr = 128) {
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= thr ? 255 : 0;
  return img;
}

export function posterize(img, step) {
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    for (let k = 0; k < 3; k++) img.data[i + k] = Math.min(255, Math.round(img.data[i + k] / step) * step);
  }
  return img;
}

/** Split into n equal columns by connected shapes; a shape belongs to the column holding its centre,
 *  unless it is wider than 1.25 columns — then it is split at the column lines. */
export function ownFrames(img, n) {
  const owner = new Int16Array(img.w * img.h).fill(-1), seen = new Uint8Array(img.w * img.h), sliceW = img.w / n;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i0 = y * img.w + x;
    if (seen[i0] || !opaque(img, x, y)) continue;
    const comp = [], q = [i0]; seen[i0] = 1;
    while (q.length) {
      const i = q.pop(); comp.push(i);
      const cx = i % img.w, cy = (i / img.w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy, j = ny * img.w + nx;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen[j] || !opaque(img, nx, ny)) continue;
        seen[j] = 1; q.push(j);
      }
    }
    let minX = img.w, maxX = 0, sx = 0;
    for (const i of comp) { const cx = i % img.w; if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; sx += cx; }
    const wide = maxX - minX + 1 > sliceW * 1.25, home = Math.min(n - 1, Math.floor(sx / comp.length / sliceW));
    for (const i of comp) owner[i] = wide ? Math.min(n - 1, Math.floor((i % img.w) / sliceW)) : home;
  }
  return Array.from({ length: n }, (_, f) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 0; i < owner.length; i++) if (owner[i] === f) {
      const x = i % img.w, y = (i / img.w) | 0;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    const out = createImage(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (owner[y * img.w + x] === f) out.data.set(img.data.subarray(idx(img, x, y), idx(img, x, y) + 4), idx(out, x - x0, y - y0));
    return { img: out, x0, y0 };
  });
}

const isEye = (r, g, b) => g > 140 && b > 140 && r < 140 && g - r > 60;
const isTint = (r, g, b) => g - r > 30 && b - r > 30 && g > 60;

/** Find the painted eyes (bright cyan in the upper 55 % of the frame), paint them and their blended
 *  halo with the visor colour, and return the two eye centres on one shared level. */
export function eraseEyes(frame) {
  const bb = opaqueBounds(frame);
  if (!bb) return null;
  const pts = [];
  const yMax = bb.y0 + (bb.y1 - bb.y0 + 1) * 0.55;
  for (let y = bb.y0; y < yMax; y++) for (let x = bb.x0; x <= bb.x1; x++) {
    const i = idx(frame, x, y); const d = frame.data;
    if (d[i + 3] && isEye(d[i], d[i + 1], d[i + 2])) pts.push([x, y]);
  }
  if (!pts.length) return null;
  const counts = new Map();
  for (const [ex, ey] of pts) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (!opaque(frame, ex + dx, ey + dy)) continue;
    const i = idx(frame, ex + dx, ey + dy), d = frame.data;
    if (isEye(d[i], d[i + 1], d[i + 2]) || isTint(d[i], d[i + 1], d[i + 2]) || d[i] + d[i + 1] + d[i + 2] > 150) continue;
    const key = `${d[i]},${d[i + 1]},${d[i + 2]}`; counts.set(key, (counts.get(key) || 0) + 1);
  }
  const visor = counts.size ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number) : [13, 20, 24];
  for (const [ex, ey] of pts) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (!opaque(frame, ex + dx, ey + dy)) continue;
    const i = idx(frame, ex + dx, ey + dy), d = frame.data;
    if (isEye(d[i], d[i + 1], d[i + 2]) || isTint(d[i], d[i + 1], d[i + 2])) d.set([...visor, 255], i);
  }
  const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
  let split = Infinity;
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 1) { split = (xs[i] + xs[i - 1]) / 2; break; }
  const groups = [pts.filter((p) => p[0] < split), pts.filter((p) => p[0] >= split)].filter((g) => g.length);
  const level = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const eyes = groups.map((g) => [Math.round(g.reduce((s, p) => s + p[0], 0) / g.length), Math.round(level)]);
  return { eyes, level };
}

/** Place a frame in a fixed cell: feet centre on the cell's centre line, the sheet's ground line on `ground`. */
export function placeInCell(frame, { cellW, cellH, ground, sheetGround }) {
  const { img, y0 } = frame;
  const bb = opaqueBounds(img);
  let sx = 0, n = 0;
  if (bb) {
    const from = Math.floor(bb.y1 - (bb.y1 - bb.y0 + 1) * 0.2);
    for (let y = from; y <= bb.y1; y++) for (let x = 0; x < img.w; x++) if (opaque(img, x, y)) { sx += x; n++; }
  }
  const ox = Math.round(cellW / 2 - (n ? sx / n : img.w / 2));
  const oy = y0 + (ground - sheetGround);
  const cell = createImage(cellW, cellH);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!opaque(img, x, y)) continue;
    const cx = x + ox, cy = y + oy;
    if (cx < 0 || cy < 0 || cx >= cellW || cy >= cellH) continue;
    cell.data.set(img.data.subarray(idx(img, x, y), idx(img, x, y) + 4), idx(cell, cx, cy));
  }
  return { cell, ox, oy };
}

export function outline(img, rgb) {
  const src = new Uint8ClampedArray(img.data);
  const was = (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && src[(y * img.w + x) * 4 + 3] >= 128;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (was(x, y)) continue;
    if (was(x - 1, y) || was(x + 1, y) || was(x, y - 1) || was(x, y + 1)) img.data.set([...rgb, 255], idx(img, x, y));
  }
  return img;
}

export function hstack(imgs) {
  const W = imgs.reduce((s, i) => s + i.w, 0), H = Math.max(...imgs.map((i) => i.h)), out = createImage(W, H);
  let ox = 0;
  for (const im of imgs) {
    for (let y = 0; y < im.h; y++) out.data.set(im.data.subarray(y * im.w * 4, (y + 1) * im.w * 4), idx(out, ox, y));
    ox += im.w;
  }
  return out;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tools/art`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add tools/art
git commit -m "feat(art): PNG I/O and pure image ops for the v2 sprite recipe

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 2: Art build, manifest, prompts and style reference

**Files:**
- Create: `tools/art/build.mjs`, `art/manifest.json`, `art/PROMPTS.md`, `art/style/bot-reference.png` (copy of `art/style-tests/hibit.png`), `src/modules/casecremental/assets/sprites/.gitkeep`
- Modify: `package.json` (script `art`), `.gitignore` (`art/preview/`)
- Test: `tools/art/build.test.mjs`

**Interfaces:**
- Consumes: Task 1 ops.
- Produces:
  - Manifest shape: `{ posterize: 48, outline: [18,14,16], assets: AssetDef[] }`, `AssetDef = { id, source, kind: "sheet" | "static", frames?, rows?, targetH?, targetW?, eyes?, outline?, posterize? }`
  - `buildAsset(def, srcImg, globals) → { strip: Img, meta: SpriteMeta }`
  - `SpriteMeta = { id, frames, frameW, frameH, ground, eyes: ([number, number][] | null)[] | null }`
  - CLI `npm run art` → writes `src/modules/casecremental/assets/sprites/<id>.png|json` for every asset whose source exists, warns and skips the rest, writes `art/preview/<id>.png` (×6 contact sheet).

- [ ] **Step 1: Write the failing test**

`tools/art/build.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { buildAsset } from "./build.mjs";
import { createImage, fillRect } from "./ops.mjs";

const G = { posterize: 48, outline: [18, 14, 16] };

/** A synthetic 2×2 sheet of 4 "robots" 40×80 source px (cyan eyes on a dark visor). */
function sheet() {
  const img = createImage(200, 220);
  [[10, 10], [110, 10], [10, 120], [110, 120]].forEach(([x, y], i) => {
    const hop = i === 2 ? 10 : 0;
    fillRect(img, x, y + 10 - hop, 40, 80, [96, 96, 144, 255]);
    fillRect(img, x + 6, y + 18 - hop, 28, 16, [0, 16, 32, 255]);
    fillRect(img, x + 10, y + 22 - hop, 6, 6, [80, 240, 240, 255]);
    fillRect(img, x + 24, y + 22 - hop, 6, 6, [80, 240, 240, 255]);
  });
  return img;
}

describe("buildAsset", () => {
  it("turns a 2×2 character sheet into 4 aligned 48 px frames with level eyes", () => {
    const { strip, meta } = buildAsset({ id: "t", source: "x.png", kind: "sheet", frames: 4, rows: 2, targetH: 48, eyes: true }, sheet(), G);
    expect(meta.frames).toBe(4);
    expect(strip.w).toBe(meta.frameW * 4);
    expect(strip.h).toBe(meta.frameH);
    expect(meta.eyes).toHaveLength(4);
    for (const e of meta.eyes) { expect(e).toHaveLength(2); expect(e[0][1]).toBe(e[1][1]); }
    // the hop frame (index 2) sits higher than the others
    expect(meta.eyes[2][0][1]).toBeLessThan(meta.eyes[0][0][1]);
  });

  it("builds a static asset to its target width with no eyes", () => {
    const img = createImage(400, 100);
    fillRect(img, 0, 0, 400, 100, [120, 80, 40, 255]);
    const { strip, meta } = buildAsset({ id: "table", source: "t.png", kind: "static", targetW: 200, outline: false }, img, G);
    expect([strip.w, strip.h]).toEqual([200, 50]);
    expect(meta.eyes).toBeNull();
    expect(meta.frames).toBe(1);
  });

  it("gives wide props (a case box) a cell wide enough that no frame is clipped", () => {
    const img = createImage(400, 60);
    for (let i = 0; i < 4; i++) fillRect(img, 10 + i * 100, 10, 80, 40, [140, 90, 40, 255]);
    const { strip, meta } = buildAsset({ id: "case", source: "c.png", kind: "sheet", frames: 4, targetH: 10 }, img, G);
    const cols = [];
    for (let x = 0; x < meta.frameW; x++) {
      let any = false;
      for (let y = 0; y < strip.h; y++) if (strip.data[(y * strip.w + x) * 4 + 3]) any = true;
      cols.push(any);
    }
    // ~20 px box + outline, and the cell's edge columns stay empty (nothing cut off)
    expect(cols.filter(Boolean).length).toBeGreaterThanOrEqual(22);
    expect(cols[0]).toBe(false);
    expect(cols[meta.frameW - 1]).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tools/art/build.test.mjs`
Expected: FAIL — cannot resolve `./build.mjs`.

- [ ] **Step 3: Write `tools/art/build.mjs`**

```js
// Art build: art/manifest.json → src/modules/casecremental/assets/sprites/<id>.png + .json.
// Applies the "v2 recipe": smooth downscale, hard alpha, posterize, eyes → code eyes, 1 px outline.
// usage: npm run art            (all assets whose source exists)
//        npm run art -- <id>    (one asset)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "./png.mjs";
import { areaDownscale, createImage, eraseEyes, hardAlpha, hstack, opaqueBounds, outline, ownFrames, placeInCell, posterize, reflowRows } from "./ops.mjs";

export function buildAsset(def, src, globals) {
  const step = def.posterize === false ? 0 : globals.posterize;
  const wantOutline = def.outline !== false;
  if (def.kind === "static") {
    const bb = opaqueBounds(src) ?? { x0: 0, y0: 0, x1: src.w - 1, y1: src.h - 1 };
    const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
    const factor = def.targetW ? w / def.targetW : h / def.targetH;
    const crop = createImage(w, h);
    for (let y = 0; y < h; y++) crop.data.set(src.data.subarray(((bb.y0 + y) * src.w + bb.x0) * 4, ((bb.y0 + y) * src.w + bb.x0 + w) * 4), y * w * 4);
    let img = hardAlpha(areaDownscale(crop, factor));
    if (step) posterize(img, step);
    if (wantOutline) {
      const padded = createImage(img.w + 2, img.h + 2);
      for (let y = 0; y < img.h; y++) padded.data.set(img.data.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((y + 1) * padded.w + 1) * 4);
      img = outline(padded, globals.outline);
    }
    return { strip: img, meta: { id: def.id, frames: 1, frameW: img.w, frameH: img.h, ground: img.h - 1, eyes: null } };
  }
  const sheet = (def.rows ?? 1) > 1 ? reflowRows(src) : src;
  const bb = opaqueBounds(sheet);
  if (!bb) throw new Error(`${def.id}: empty sheet`);
  const img = hardAlpha(areaDownscale(sheet, (bb.y1 - bb.y0 + 1) / def.targetH));
  if (step) posterize(img, step);
  const sheetGround = opaqueBounds(img).y1;
  const frames = ownFrames(img, def.frames);
  // characters get a cell a little wider than tall; wide props (cases, key, coin) get their widest frame + room for the outline
  const widest = Math.max(0, ...frames.map((f) => (f ? f.img.w : 0)));
  const cellW = def.cellW ?? Math.max(Math.ceil(def.targetH * 1.05), widest + 6), cellH = def.targetH + 14, ground = cellH - 2;
  const cells = [], eyes = [];
  for (const f of frames) {
    if (!f) { cells.push(createImage(cellW, cellH)); eyes.push(null); continue; }
    const found = def.eyes ? eraseEyes(f.img) : null;
    const { cell, ox, oy } = placeInCell(f, { cellW, cellH, ground, sheetGround });
    if (wantOutline) outline(cell, globals.outline);
    cells.push(cell);
    eyes.push(found ? found.eyes.map(([x, y]) => [x + ox, y + oy]) : null);
  }
  return { strip: hstack(cells), meta: { id: def.id, frames: def.frames, frameW: cellW, frameH: cellH, ground, eyes: def.eyes ? eyes : null } };
}

function preview(img, scale) {
  const out = createImage(img.w * scale, img.h * scale);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const si = (((y / scale) | 0) * img.w + ((x / scale) | 0)) * 4, di = (y * out.w + x) * 4;
    if (img.data[si + 3]) out.data.set(img.data.subarray(si, si + 4), di); else out.data.set([30, 24, 20, 255], di);
  }
  return out;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "art/manifest.json"), "utf8"));
  const only = process.argv[2];
  const outDir = path.join(root, "src/modules/casecremental/assets/sprites");
  const prevDir = path.join(root, "art/preview");
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(prevDir, { recursive: true });
  let built = 0, skipped = 0;
  for (const def of manifest.assets) {
    if (only && def.id !== only) continue;
    const srcPath = path.join(root, "art/source", def.source);
    if (!fs.existsSync(srcPath)) { console.warn(`skip ${def.id}: art/source/${def.source} not found`); skipped++; continue; }
    const { strip, meta } = buildAsset(def, readPng(srcPath), manifest);
    writePng(path.join(outDir, `${def.id}.png`), strip);
    fs.writeFileSync(path.join(outDir, `${def.id}.json`), JSON.stringify(meta) + "\n");
    writePng(path.join(prevDir, `${def.id}.png`), preview(strip, 6));
    console.log(`built ${def.id}: ${meta.frames} frame(s) ${meta.frameW}×${meta.frameH}`);
    built++;
  }
  console.log(`art: ${built} built, ${skipped} skipped`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/art`
Expected: PASS (13 tests: 11 ops + 2 build).

- [ ] **Step 5: Manifest, script, ignore, style reference**

`art/manifest.json`:

```json
{
  "posterize": 48,
  "outline": [18, 14, 16],
  "assets": [
    { "id": "room-back", "source": "room-back.png", "kind": "static", "targetW": 480, "outline": false },
    { "id": "room-shelves", "source": "room-shelves.png", "kind": "static", "targetW": 480, "outline": false },
    { "id": "room-lamp", "source": "room-lamp.png", "kind": "static", "targetH": 40 },
    { "id": "table", "source": "table.png", "kind": "static", "targetW": 240, "outline": false },
    { "id": "mat", "source": "mat.png", "kind": "static", "targetW": 64 },
    { "id": "case-bootcamp", "source": "case-bootcamp.png", "kind": "sheet", "frames": 4, "targetH": 20 },
    { "id": "case-wildwood", "source": "case-wildwood.png", "kind": "sheet", "frames": 4, "targetH": 20 },
    { "id": "case-bedrock", "source": "case-bedrock.png", "kind": "sheet", "frames": 4, "targetH": 20 },
    { "id": "key", "source": "key.png", "kind": "sheet", "frames": 4, "targetH": 10 },
    { "id": "sell-bin", "source": "sell-bin.png", "kind": "sheet", "frames": 4, "targetH": 24 },
    { "id": "tray", "source": "tray.png", "kind": "static", "targetW": 100 },
    { "id": "auto-seller", "source": "auto-seller.png", "kind": "static", "targetH": 30 },
    { "id": "coin", "source": "coin.png", "kind": "sheet", "frames": 4, "targetH": 8 },
    { "id": "bot-sleep", "source": "bot-sleep-sheet.png", "kind": "sheet", "frames": 4, "rows": 1, "targetH": 48, "eyes": false },
    { "id": "bot-open", "source": "bot-open-sheet-2x4.png", "kind": "sheet", "frames": 8, "rows": 2, "targetH": 48, "eyes": true },
    { "id": "weapon-rifle", "source": "weapon-rifle.png", "kind": "static", "targetW": 26 },
    { "id": "weapon-sniper", "source": "weapon-sniper.png", "kind": "static", "targetW": 26 },
    { "id": "weapon-pistol", "source": "weapon-pistol.png", "kind": "static", "targetW": 18 },
    { "id": "weapon-heavyPistol", "source": "weapon-heavyPistol.png", "kind": "static", "targetW": 20 },
    { "id": "weapon-smg", "source": "weapon-smg.png", "kind": "static", "targetW": 22 },
    { "id": "weapon-shotgun", "source": "weapon-shotgun.png", "kind": "static", "targetW": 26 },
    { "id": "weapon-mg", "source": "weapon-mg.png", "kind": "static", "targetW": 26 },
    { "id": "weapon-knife", "source": "weapon-knife.png", "kind": "static", "targetW": 20 },
    { "id": "ui-frame", "source": "ui-frame.png", "kind": "static", "targetW": 48, "outline": false },
    { "id": "ui-button", "source": "ui-button.png", "kind": "sheet", "frames": 3, "targetH": 16, "outline": false },
    { "id": "reel-frame", "source": "reel-frame.png", "kind": "static", "targetW": 48, "outline": false }
  ]
}
```

In `package.json` `scripts` add `"art": "node tools/art/build.mjs"`. Append `art/preview/` to `.gitignore`. Then:

```bash
mkdir -p art/style art/source src/modules/casecremental/assets/sprites
cp art/style-tests/hibit.png art/style/bot-reference.png
cp art/style-tests/bot-open-sheet-2x4.png art/source/bot-open-sheet-2x4.png
touch src/modules/casecremental/assets/sprites/.gitkeep
```

- [ ] **Step 6: Write `art/PROMPTS.md`**

```markdown
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
```

- [ ] **Step 7: Build what exists and commit**

Run: `npm run art`
Expected: `built bot-open: 8 frame(s) 51×62`, every other asset `skip … not found`, `art: 1 built, 25 skipped`. Open `art/preview/bot-open.png`: 8 frames, eyes erased.

Run: `npx vitest run && npm run typecheck`
Expected: all green.

```bash
git add tools/art art/manifest.json art/PROMPTS.md art/style art/source package.json .gitignore src/modules/casecremental/assets
git commit -m "feat(art): manifest-driven sprite build, prompts and style reference

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 3: Generate and take in the 2a art

This task produces assets, not code. It needs the user's OK for every spend and download. It does not block the code: while the user is making the art, carry on with Tasks 4–13 (missing sprites render as magenta placeholders) and come back to Steps 4–5 when the sources arrive.

**Files:**
- Create: `art/source/*.png` (25 files listed in `art/manifest.json`), `src/modules/casecremental/assets/sprites/*.png|json`

- [ ] **Step 1: Choose the generator with the user.** Ask: "Generate the 2a art (25 images) yourself in ChatGPT from `art/PROMPTS.md`, or should I generate it with the ElevenLabs MCP (`gpt-image-2` with the bot reference)?" If ElevenLabs: call `creative_generate_image` / `creative_generate_in_flow` with `estimate_only: true` for one asset, multiply by 25 (plus ~30 % re-rolls), and get the user's OK on the total before generating.

- [ ] **Step 2: Generate.** ChatGPT path: hand the user `art/PROMPTS.md` and wait. ElevenLabs path: create one flow (`creative_create_flow`), upload `art/style/bot-reference.png` with `creative_create_asset_upload` → PUT → `creative_finalize_asset_upload`, then one `creative_generate_in_flow` per asset with `node_type: "image-generation"`, `model_id: "gpt-image-2"`, `connect_from: [<reference node>]`, `generations_count: 1`, prompt = table prompt + shared style line; poll `creative_get_flow_run_status`. If a result is not transparent, add a `birefnet-v2-bg-removal` node fed by it.

- [ ] **Step 3: Download (ElevenLabs path).** List the 25 file names and their source (ElevenLabs CDN), ask the user's OK, then `curl -sSL "<url>" -o art/source/<file>` for each.

- [ ] **Step 4: Build and review.** Run `npm run art`. Expected: `art: 26 built, 0 skipped`. Read each `art/preview/<id>.png` and check: transparent background, consistent style with the bot, frames aligned on one ground line, case lids and key turns read clearly. Re-generate any asset that fails (same prompt + a note on what to fix), then rebuild.

- [ ] **Step 5: Commit**

```bash
git add art/source src/modules/casecremental/assets/sprites
git commit -m "art: 2a sprites (room, table, cases, key, bins, coin, bot, weapons, UI)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 4: i18n core — language state, UI strings, budgets, locale cash

**Files:**
- Create: `src/modules/casecremental/i18n/index.ts`, `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`
- Modify: `src/modules/casecremental/sim/format.ts` (locale parameter)
- Test: `i18n/i18n.test.ts`, `sim/format.test.ts` (2 new cases)

(Paths below are relative to `src/modules/casecremental/` unless they start with `src/`, `tools/`, `art/` or the repo root.)

**Interfaces:**
- Produces:
  - `type Lang = "en" | "ru"`; `getLang(): Lang`; `setLang(l: Lang): void`; `onLangChange(fn: () => void): () => void`; `detectLang(languages: readonly string[]): Lang`
  - `t(key: StringKey, vars?: Record<string, string | number>): string`
  - `EN` (the key list), `type StringKey = keyof typeof EN`, `RU: Record<StringKey, string>`
  - `budgetFor(key: string): number`, `fitsBudget(text: string, budget: number): boolean`
  - `formatCash(n: number, lang: "en" | "ru" = "en"): string`

- [ ] **Step 1: Write the failing tests**

`i18n/i18n.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { budgetFor, fitsBudget } from "./budgets";
import { EN } from "./en";
import { detectLang, getLang, onLangChange, setLang, t } from "./index";
import { RU } from "./ru";

afterEach(() => setLang("en"));

describe("language state", () => {
  it("detects Russian from browser languages, else English", () => {
    expect(detectLang(["ru-RU", "en"])).toBe("ru");
    expect(detectLang(["en-US", "ru"])).toBe("en");
    expect(detectLang(["kk"])).toBe("en");
    expect(detectLang([])).toBe("en");
  });

  it("switches language and notifies listeners once per change", () => {
    let calls = 0;
    const off = onLangChange(() => calls++);
    setLang("ru"); setLang("ru"); setLang("en");
    off(); setLang("ru");
    expect(calls).toBe(2);
    expect(getLang()).toBe("ru");
  });

  it("translates and substitutes variables in the current language", () => {
    expect(t("hud.combo", { mult: "1.40" })).toBe("COMBO x1.40");
    setLang("ru");
    expect(t("hud.combo", { mult: "1,40" })).toBe("КОМБО x1,40");
  });
});

describe("string tables", () => {
  it("Russian has exactly the English keys", () => {
    expect(Object.keys(RU).sort()).toEqual(Object.keys(EN).sort());
  });

  it.each(Object.keys(EN))("%s fits its character budget in both languages", (key) => {
    const b = budgetFor(key);
    const strip = (s: string) => s.replace(/\{\w+\}/g, "");
    expect(fitsBudget(strip(EN[key as keyof typeof EN]), b)).toBe(true);
    expect(fitsBudget(strip(RU[key as keyof typeof EN]), b)).toBe(true);
  });
});
```

Add to `sim/format.test.ts`:

```ts
describe("formatCash in Russian", () => {
  it.each([
    [12_345, "$12,3K"],
    [1.5, "$1,50"],
    [999, "$999"],
    [2.5e9, "$2,50B"],
  ])("formats %s as %s", (n, text) => {
    expect(formatCash(n, "ru")).toBe(text);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/i18n src/modules/casecremental/sim/format.test.ts`
Expected: FAIL — cannot resolve `./budgets` etc.; the Russian format cases fail.

- [ ] **Step 3: Write `i18n/en.ts`**

```ts
// English UI strings. Keys are grouped by where they appear; budgets.ts limits their length,
// because Press Start 2P is wide and monospaced. {name} placeholders are filled by t().
export const EN = {
  "hud.combo": "COMBO x{mult}",
  "hud.next": "NEXT: {name}",
  "hud.settings": "SETTINGS",
  "panel.upgrades": "UPGRADES",
  "panel.cases": "CASES",
  "tab.you": "YOU",
  "tab.bot": "BOT",
  "tab.machines": "MACHINES",
  "tab.locked": "LOCKED",
  "btn.buy": "BUY",
  "btn.unlock": "UNLOCK",
  "btn.max": "MAX",
  "label.level": "LV {n}",
  "hint.buy": "Buy a case",
  "hint.key": "Drag the key",
  "hint.brake": "Click: brake!",
  "hint.sell": "Drag to sell",
  "settings.title": "SETTINGS",
  "settings.language": "LANGUAGE",
  "settings.music": "MUSIC",
  "settings.sfx": "SOUNDS",
  "settings.close": "CLOSE",
  "station.offline": "OFFLINE",
} as const;

export type StringKey = keyof typeof EN;
```

- [ ] **Step 4: Write `i18n/ru.ts`**

```ts
import type { StringKey } from "./en";

export const RU: Record<StringKey, string> = {
  "hud.combo": "КОМБО x{mult}",
  "hud.next": "ДАЛЕЕ: {name}",
  "hud.settings": "НАСТРОЙКИ",
  "panel.upgrades": "УЛУЧШЕНИЯ",
  "panel.cases": "КЕЙСЫ",
  "tab.you": "ТЫ",
  "tab.bot": "БОТ",
  "tab.machines": "МАШИНЫ",
  "tab.locked": "ЗАКРЫТО",
  "btn.buy": "КУПИТЬ",
  "btn.unlock": "ОТКРЫТЬ",
  "btn.max": "МАКС",
  "label.level": "УР {n}",
  "hint.buy": "Купи кейс",
  "hint.key": "Тащи ключ",
  "hint.brake": "Жми: тормоз!",
  "hint.sell": "Тащи на продажу",
  "settings.title": "НАСТРОЙКИ",
  "settings.language": "ЯЗЫК",
  "settings.music": "МУЗЫКА",
  "settings.sfx": "ЗВУКИ",
  "settings.close": "ЗАКРЫТЬ",
  "station.offline": "ВЫКЛЮЧЕН",
};
```

- [ ] **Step 5: Write `i18n/budgets.ts`**

```ts
// Character budgets per key group. Press Start 2P is monospaced: width = characters × font size,
// so a character budget is a width budget. Placeholders are excluded before measuring.
const BY_PREFIX: Array<[string, number]> = [
  ["hud.", 16],
  ["panel.", 12],
  ["tab.", 10],
  ["btn.", 8],
  ["label.", 8],
  ["hint.", 18],
  ["settings.", 12],
  ["station.", 10],
  // content names (content.ts)
  ["case.", 12],
  ["weapon.", 18],
  ["skin.", 22],
  ["rarity.", 18],
  ["wear.", 18],
  ["upgrade.name.", 14],
  ["upgrade.desc.", 20],
  ["stage.", 16],
];

export function budgetFor(key: string): number {
  const hit = BY_PREFIX.find(([p]) => key.startsWith(p));
  if (!hit) throw new Error(`no budget for ${key}`);
  return hit[1];
}

export const fitsBudget = (text: string, budget: number): boolean => [...text].length <= budget;
```

- [ ] **Step 6: Write `i18n/index.ts`**

```ts
import { EN, type StringKey } from "./en";
import { RU } from "./ru";

// Current language + translation. The UI subscribes with onLangChange (React: useSyncExternalStore);
// content names (content.ts) read getLang() at call time, so a switch takes effect on the next render.

export type Lang = "en" | "ru";
export type { StringKey } from "./en";

let current: Lang = "en";
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  for (const fn of listeners) fn();
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The first browser language decides: Russian → "ru", anything else → "en". */
export function detectLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const table = current === "ru" ? RU : EN;
  const raw: string = table[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : raw;
}
```

- [ ] **Step 7: Make `formatCash` locale-aware**

In `sim/format.ts`, change the signature and route every return through a decimal-mark fix:

```ts
export function formatCash(n: number, lang: "en" | "ru" = "en"): string {
  const text = formatCashEn(n);
  return lang === "ru" ? text.replace(/(\d)\.(\d)/, "$1,$2") : text;
}

function formatCashEn(n: number): string {
```

(the existing body of `formatCash` becomes the body of `formatCashEn`, unchanged).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/i18n src/modules/casecremental/sim`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/casecremental/i18n src/modules/casecremental/sim/format.ts src/modules/casecremental/sim/format.test.ts
git commit -m "feat(i18n): language state, EN/RU UI strings with width budgets, RU cash format

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 5: Content names in both languages + a language-neutral goal

**Files:**
- Create: `i18n/content.ts`
- Modify: `game/view.ts` (structured `nextGoal`), `game/view.test.ts`
- Test: `i18n/content.test.ts`

**Interfaces:**
- Consumes: `getLang`, `budgetFor`, `fitsBudget` (Task 4); `CASES`, `UPGRADE_IDS`, `RarityId`, `WearId`, `WeaponId`, `SkinDef`.
- Produces:
  - `caseName(caseId)`, `weaponName(w: WeaponId)`, `skinName(skinId)` (finish only), `rarityName(r)`, `wearName(w)`, `upgradeName(id)`, `upgradeDesc(id)`, `stageName(stage: number)` — all return the current language.
  - `CONTENT_KEYS(): Array<[key: string, en: string, ru: string]>` (for budget tests).
  - `GameView.nextGoal: { kind: "unlock"; caseId: string; progress: number } | { kind: "upgrade"; upgradeId: UpgradeId; level: number; progress: number } | null`

- [ ] **Step 1: Write the failing tests**

`i18n/content.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { CASES } from "../sim/content/cases";
import { UPGRADE_IDS } from "../sim/upgrades";
import { budgetFor, fitsBudget } from "./budgets";
import { CONTENT_KEYS, caseName, rarityName, skinName, stageName, upgradeName, weaponName } from "./content";
import { setLang } from "./index";

afterEach(() => setLang("en"));

describe("content names", () => {
  it("names every case, skin and upgrade in both languages", () => {
    for (const c of CASES) {
      expect(caseName(c.id)).not.toBe("");
      for (const s of c.skins) expect(skinName(s.id)).not.toBe("");
    }
    for (const id of UPGRADE_IDS) expect(upgradeName(id)).not.toBe("");
  });

  it("follows the current language", () => {
    expect(caseName("bootcamp")).toBe("Boot Camp");
    expect(weaponName("rifle")).toBe("AK-Pew");
    expect(rarityName("covert")).toBe("Covert");
    expect(stageName(2)).toBe("Buzzed");
    setLang("ru");
    expect(caseName("bootcamp")).toBe("Учебка");
    expect(weaponName("rifle")).toBe("АК-Пиу");
    expect(rarityName("covert")).toBe("Тайное");
    expect(skinName("bc_woodland")).toBe("Лесные учения");
    expect(stageName(2)).toBe("Навеселе");
  });

  it.each(CONTENT_KEYS())("%s fits its budget in both languages", (key, en, ru) => {
    expect(fitsBudget(en, budgetFor(key))).toBe(true);
    expect(fitsBudget(ru, budgetFor(key))).toBe(true);
  });
});
```

In `game/view.test.ts` replace the two `nextGoal` expectations:

```ts
    expect(v.nextGoal).toEqual({
      kind: "unlock",
      caseId: "wildwood",
      progress: START_CASH / unlockCostOf("wildwood"),
    });
```

```ts
    expect(buildView(run).nextGoal).toEqual({ kind: "upgrade", upgradeId: "quickHands", level: 1, progress: 0.5 });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/i18n src/modules/casecremental/game/view.test.ts`
Expected: FAIL — cannot resolve `./content`; the view goal expectations fail.

- [ ] **Step 3: Write `i18n/content.ts`**

```ts
import type { RarityId, WeaponId, WearId } from "../sim/types";
import type { UpgradeId } from "../sim/upgrades";
import { getLang } from "./index";

// Player-visible names of game content in both languages. Parody names — never real CS names.
type Pair = { en: string; ru: string };
const pick = (p: Pair | undefined): string => (p ? p[getLang()] : "");

const CASES: Record<string, Pair> = {
  bootcamp: { en: "Boot Camp", ru: "Учебка" },
  wildwood: { en: "Wildwood", ru: "Дебри" },
  bedrock: { en: "Bedrock", ru: "Монолит" },
};

const WEAPONS: Record<WeaponId, Pair> = {
  rifle: { en: "AK-Pew", ru: "АК-Пиу" },
  sniper: { en: "Longshot", ru: "Дальнобой" },
  pistol: { en: "Peashooter", ru: "Пукалка" },
  heavyPistol: { en: "Desert Hawk", ru: "Пустынный ястреб" },
  smg: { en: "Buzzsaw", ru: "Циркулярка" },
  shotgun: { en: "Boomstick", ru: "Громобой" },
  mg: { en: "Lawnmower", ru: "Газонокосилка" },
  knife: { en: "★ Hookblade", ru: "★ Крюк-нож" },
};

const SKINS: Record<string, Pair> = {
  bc_woodland: { en: "Woodland Drill", ru: "Лесные учения" },
  bc_desert: { en: "Sandstorm", ru: "Песчаная буря" },
  bc_urban: { en: "Concrete Jungle", ru: "Бетонные джунгли" },
  bc_olive: { en: "Olive Drab", ru: "Оливковый" },
  bc_snow: { en: "Whiteout", ru: "Белая мгла" },
  bc_digital: { en: "Pixel Patrol", ru: "Пиксельный патруль" },
  bc_tiger: { en: "Jungle Cat", ru: "Кошка джунглей" },
  bc_navy: { en: "Deep Ops", ru: "Глубокая разведка" },
  bc_redalert: { en: "Red Alert", ru: "Красная тревога" },
  bc_hunter: { en: "Blaze Hunter", ru: "Огненный охотник" },
  bc_commander: { en: "Commander's Pride", ru: "Гордость командира" },
  bc_warlord: { en: "Warlord", ru: "Военачальник" },
  bc_knife: { en: "Field Marshal", ru: "Фельдмаршал" },
  ww_fern: { en: "Fernlight", ru: "Папоротник" },
  ww_bark: { en: "Old Bark", ru: "Старая кора" },
  ww_moss: { en: "Mossback", ru: "Мшистый" },
  ww_pine: { en: "Pine Needle", ru: "Хвоя" },
  ww_birch: { en: "Birchwood", ru: "Берёза" },
  ww_autumn: { en: "Autumn Fall", ru: "Листопад" },
  ww_lichen: { en: "Lichen", ru: "Лишайник" },
  ww_redwood: { en: "Redwood", ru: "Секвойя" },
  ww_glade: { en: "Emerald Glade", ru: "Изумрудная поляна" },
  ww_canopy: { en: "Canopy", ru: "Кроны" },
  ww_spirit: { en: "Forest Spirit", ru: "Лесной дух" },
  ww_elder: { en: "Elder Oak", ru: "Древний дуб" },
  ww_knife: { en: "Heartwood", ru: "Сердцевина" },
  br_granite: { en: "Granite", ru: "Гранит" },
  br_slate: { en: "Slate", ru: "Сланец" },
  br_sandstone: { en: "Sandstone", ru: "Песчаник" },
  br_basalt: { en: "Basalt", ru: "Базальт" },
  br_quarry: { en: "Quarry", ru: "Карьер" },
  br_marble: { en: "Carrara", ru: "Каррара" },
  br_amethyst: { en: "Amethyst", ru: "Аметист" },
  br_jade: { en: "Jade", ru: "Нефрит" },
  br_obsidian: { en: "Obsidian Edge", ru: "Обсидиановая грань" },
  br_sapphire: { en: "Sapphire Vein", ru: "Сапфировая жила" },
  br_magma: { en: "Magma Core", ru: "Ядро магмы" },
  br_diamond: { en: "Diamond Hands", ru: "Алмазные руки" },
  br_knife: { en: "Molten Crown", ru: "Расплавленная корона" },
};

const RARITIES: Record<RarityId, Pair> = {
  milspec: { en: "Mil-Spec", ru: "Армейское" },
  restricted: { en: "Restricted", ru: "Запрещённое" },
  classified: { en: "Classified", ru: "Засекреченное" },
  covert: { en: "Covert", ru: "Тайное" },
  gold: { en: "★ Rare Special", ru: "★ Редкий предмет" },
};

const WEARS: Record<WearId, Pair> = {
  FN: { en: "Factory New", ru: "С завода" },
  MW: { en: "Minimal Wear", ru: "Немного поношенное" },
  FT: { en: "Field-Tested", ru: "После испытаний" },
  WW: { en: "Well-Worn", ru: "Поношенное" },
  BS: { en: "Battle-Scarred", ru: "Закалённое в боях" },
};

const UPGRADES: Record<UpgradeId, { name: Pair; desc: Pair }> = {
  luck: { name: { en: "Luck", ru: "Удача" }, desc: { en: "Better rarities", ru: "Чаще редкие" } },
  appraiser: { name: { en: "Appraiser", ru: "Оценщик" }, desc: { en: "+25% sell value", ru: "+25% к продаже" } },
  quickHands: { name: { en: "Quick Hands", ru: "Ловкие руки" }, desc: { en: "Faster reel", ru: "Быстрее рулетка" } },
};

const STAGES: Pair[] = [
  { en: "Sober", ru: "Трезвый" },
  { en: "Buzzed", ru: "Навеселе" },
  { en: "High", ru: "Эйфория" },
  { en: "Tripping", ru: "Трип" },
  { en: "Cyberpsychosis", ru: "Киберпсихоз" },
];

export const caseName = (id: string): string => pick(CASES[id]);
export const weaponName = (w: WeaponId): string => pick(WEAPONS[w]);
export const skinName = (id: string): string => pick(SKINS[id]);
export const rarityName = (r: RarityId): string => pick(RARITIES[r]);
export const wearName = (w: WearId): string => pick(WEARS[w]);
export const upgradeName = (id: UpgradeId): string => pick(UPGRADES[id]?.name);
export const upgradeDesc = (id: UpgradeId): string => pick(UPGRADES[id]?.desc);
export const stageName = (stage: number): string => pick(STAGES[stage - 1]);

/** Every content name with its budget key, for the budget test. */
export function CONTENT_KEYS(): Array<[string, string, string]> {
  const rows: Array<[string, string, string]> = [];
  const add = (prefix: string, table: Record<string, Pair>) => { for (const [k, p] of Object.entries(table)) rows.push([prefix + k, p.en, p.ru]); };
  add("case.", CASES); add("weapon.", WEAPONS); add("skin.", SKINS); add("rarity.", RARITIES); add("wear.", WEARS);
  for (const [k, u] of Object.entries(UPGRADES)) { rows.push(["upgrade.name." + k, u.name.en, u.name.ru]); rows.push(["upgrade.desc." + k, u.desc.en, u.desc.ru]); }
  STAGES.forEach((p, i) => rows.push(["stage." + (i + 1), p.en, p.ru]));
  return rows;
}
```

- [ ] **Step 4: Make the goal language-neutral in `game/view.ts`**

Replace the `nextGoal` type in `GameView` and the `nextGoal` function:

```ts
  nextGoal:
    | { kind: "unlock"; caseId: string; progress: number }
    | { kind: "upgrade"; upgradeId: UpgradeId; level: number; progress: number }
    | null;
```

```ts
/** A goal is always on screen (spec §9.2): the next case to unlock, else the cheapest upgrade left. */
function nextGoal(cash: number, cases: CaseView[], upgrades: UpgradeView[]): GameView["nextGoal"] {
  const progress = (cost: number) => Math.min(1, Math.max(0, cash / cost));
  const next = cases.find((c) => !c.unlocked);
  if (next) return { kind: "unlock", caseId: next.id, progress: progress(next.unlockCost) };
  let cheapest: UpgradeView | null = null;
  for (const u of upgrades)
    if (u.cost !== null && (cheapest === null || u.cost < (cheapest.cost ?? Infinity))) cheapest = u;
  if (!cheapest || cheapest.cost === null) return null;
  return { kind: "upgrade", upgradeId: cheapest.id, level: cheapest.level + 1, progress: progress(cheapest.cost) };
}
```

In `ui/Hud.tsx`, until Task 12 rewrites it, render the goal label as:

```tsx
{view.nextGoal.kind === "unlock" ? caseName(view.nextGoal.caseId) : `${upgradeName(view.nextGoal.upgradeId)} ${view.nextGoal.level}`}
```

with `import { caseName, upgradeName } from "../i18n/content";`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental
git commit -m "feat(i18n): EN/RU content names; goal carries ids instead of English text

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 6: Pixel viewport and table layout

**Files:**
- Create: `fx/pixel/viewport.ts`, `fx/pixel/layout.ts`
- Test: `fx/pixel/viewport.test.ts`, `fx/pixel/layout.test.ts`

**Interfaces:**
- Produces:
  - `WORLD_H = 180`, `PORTRAIT_W = 192`, `PORTRAIT_AREA = 0.6`
  - `interface PixelViewport { scale: number; worldW: number; worldH: number; portrait: boolean; areaW: number; areaH: number }`; `pixelViewport(viewW, viewH): PixelViewport`
  - `interface Rect { x; y; w; h }`, `interface Pt { x; y }`
  - `interface TableLayout { worldW; worldH; portrait; hudH; panelL: Rect | null; panelR: Rect | null; table: Rect; lamp: Pt; you: { reel: Rect; mat: Rect; caseSpot: Pt; keyHome: Pt; reveal: Pt }; bot: { reel: Rect | null; spot: Pt }; tray: Rect; seller: Pt; bin: Pt; binR: number }`
  - `tableLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): TableLayout`
  - `ITEM_SIZE = { case: {w:24,h:20}, key: {w:10,h:10}, bot: {w:40,h:48}, seller: {w:24,h:30}, reveal: {w:44,h:30} }`

- [ ] **Step 1: Write the failing tests**

`fx/pixel/viewport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pixelViewport } from "./viewport";

describe("pixelViewport", () => {
  it.each([
    [1920, 1080, 6, 320, 180],
    [1280, 720, 4, 320, 180],
    [3440, 1440, 8, 430, 180],
    [800, 450, 2, 400, 225],
    [1366, 768, 4, 342, 192],
  ])("landscape %i×%i → scale %i, world %i×%i", (w, h, scale, ww, wh) => {
    expect(pixelViewport(w, h)).toMatchObject({ scale, worldW: ww, worldH: wh, portrait: false });
  });

  it.each([
    [390, 844, 2, 195, 253],
    [820, 1180, 4, 205, 177],
  ])("portrait %i×%i → scale %i, world %i×%i (top 60 %%)", (w, h, scale, ww, wh) => {
    expect(pixelViewport(w, h)).toMatchObject({ scale, worldW: ww, worldH: wh, portrait: true });
  });

  it("never goes below scale 1", () => {
    expect(pixelViewport(300, 120).scale).toBe(1);
  });
});
```

`fx/pixel/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ITEM_SIZE, tableLayout, type Rect } from "./layout";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [[1920, 1080], [1280, 720], [3440, 1440], [800, 450], [1366, 768], [390, 844], [820, 1180]];
const box = (cx: number, bottom: number, w: number, h: number): Rect => ({ x: cx - w / 2, y: bottom - h, w, h });
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

describe.each(SIZES)("tableLayout at %i×%i", (w, h) => {
  const vp = pixelViewport(w, h);
  const l = tableLayout(vp);
  const items: Record<string, Rect> = {
    mat: l.you.mat,
    case: box(l.you.caseSpot.x, l.you.caseSpot.y, ITEM_SIZE.case.w, ITEM_SIZE.case.h),
    key: box(l.you.keyHome.x, l.you.keyHome.y + 5, ITEM_SIZE.key.w, ITEM_SIZE.key.h),
    bot: box(l.bot.spot.x, l.bot.spot.y, ITEM_SIZE.bot.w, ITEM_SIZE.bot.h),
    tray: l.tray,
    seller: box(l.seller.x, l.seller.y, ITEM_SIZE.seller.w, ITEM_SIZE.seller.h),
    bin: { x: l.bin.x - l.binR, y: l.bin.y - l.binR, w: l.binR * 2, h: l.binR * 2 },
  };

  it("keeps every item on the table and inside the world", () => {
    const world: Rect = { x: 0, y: 0, w: l.worldW, h: l.worldH };
    expect(inside(l.table, world)).toBe(true);
    for (const [name, r] of Object.entries(items)) expect(inside(r, { ...l.table, y: l.table.y - 60, h: l.table.h + 60 }), name).toBe(true);
  });

  it("never lets items overlap (except the case on its mat)", () => {
    const names = Object.keys(items).filter((n) => n !== "case");
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      expect(overlap(items[names[i]!]!, items[names[j]!]!), `${names[i]} × ${names[j]}`).toBe(false);
    }
    expect(inside(items.case!, { ...l.you.mat, y: l.you.mat.y - 20, h: l.you.mat.h + 20 })).toBe(true);
  });

  it("keeps panels clear of the table and the reels below the HUD", () => {
    for (const p of [l.panelL, l.panelR]) if (p) expect(overlap(p, l.table)).toBe(false);
    expect(l.you.reel.y).toBeGreaterThanOrEqual(l.hudH);
    if (vp.portrait) expect(l.panelL).toBeNull();
  });

  it("puts the reveal card above the mat and below the reel", () => {
    const card = { x: l.you.reveal.x - ITEM_SIZE.reveal.w / 2, y: l.you.reveal.y - ITEM_SIZE.reveal.h / 2, w: ITEM_SIZE.reveal.w, h: ITEM_SIZE.reveal.h };
    expect(card.y).toBeGreaterThanOrEqual(l.you.reel.y + l.you.reel.h);
    expect(card.y + card.h).toBeLessThanOrEqual(l.you.mat.y + 4);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/pixel`
Expected: FAIL — cannot resolve `./viewport`, `./layout`.

- [ ] **Step 3: Write `fx/pixel/viewport.ts`**

```ts
// Integer scale for the pixel world. Landscape: the world is 180 px tall (taller on screens that
// don't divide evenly) and as wide as the screen allows. Portrait: the pixel world takes the top
// 60 % of the screen and is ~192 px wide; the panels live in a drawer below it.

export const WORLD_H = 180;
export const PORTRAIT_W = 192;
export const PORTRAIT_AREA = 0.6;

export interface PixelViewport {
  scale: number;
  worldW: number;
  worldH: number;
  portrait: boolean;
  /** CSS pixels covered by the pixel world. */
  areaW: number;
  areaH: number;
}

export function pixelViewport(viewW: number, viewH: number): PixelViewport {
  const portrait = viewH > viewW;
  if (!portrait) {
    const scale = Math.max(1, Math.floor(viewH / WORLD_H));
    return { scale, worldW: Math.ceil(viewW / scale), worldH: Math.ceil(viewH / scale), portrait, areaW: viewW, areaH: viewH };
  }
  const areaH = Math.round(viewH * PORTRAIT_AREA);
  const scale = Math.max(1, Math.floor(viewW / PORTRAIT_W));
  return { scale, worldW: Math.ceil(viewW / scale), worldH: Math.ceil(areaH / scale), portrait, areaW: viewW, areaH };
}
```

- [ ] **Step 4: Write `fx/pixel/layout.ts`**

```ts
import type { PixelViewport } from "./viewport";

// Where everything sits on the workbench, in world pixels (spec §3). Landscape: Upgrades board on
// the left, Case shelf on the right (React panels drawn over these rects), the table between them.
// Portrait: no side panels (they become a drawer), the table fills the width.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export interface TableLayout {
  worldW: number;
  worldH: number;
  portrait: boolean;
  hudH: number;
  panelL: Rect | null;
  panelR: Rect | null;
  table: Rect;
  lamp: Pt;
  you: { reel: Rect; mat: Rect; caseSpot: Pt; keyHome: Pt; reveal: Pt };
  bot: { reel: Rect | null; spot: Pt };
  tray: Rect;
  seller: Pt;
  bin: Pt;
  binR: number;
}

/** Nominal on-table sizes in world px (sprites are built to roughly these). */
export const ITEM_SIZE = {
  case: { w: 24, h: 20 },
  key: { w: 10, h: 10 },
  bot: { w: 40, h: 48 },
  seller: { w: 24, h: 30 },
  reveal: { w: 44, h: 30 },
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = Math.round;

export function tableLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): TableLayout {
  const W = vp.worldW, H = vp.worldH, hudH = 18;
  if (!vp.portrait) {
    const P = clamp(r(W * 0.19), 56, 96);
    const table: Rect = { x: P + 4, y: 64, w: W - 2 * P - 8, h: H - 66 };
    const half = r(table.w * 0.5);
    const matW = clamp(r(table.w * 0.3), 48, 72), matCx = r(table.x + table.w * 0.28);
    const mat: Rect = { x: matCx - r(matW / 2), y: 92, w: matW, h: 22 };
    return {
      worldW: W, worldH: H, portrait: false, hudH,
      panelL: { x: 0, y: hudH, w: P, h: H - hudH },
      panelR: { x: W - P, y: hudH, w: P, h: H - hudH },
      table,
      lamp: { x: r(table.x + table.w / 2), y: 0 },
      you: { reel: { x: table.x + 4, y: 22, w: half - 8, h: 26 }, mat, caseSpot: { x: matCx, y: 112 }, keyHome: { x: mat.x - 12, y: 100 }, reveal: { x: matCx, y: 72 } },
      bot: { reel: { x: table.x + half + 4, y: 22, w: table.w - half - 8, h: 26 }, spot: { x: r(table.x + table.w * 0.74), y: 118 } },
      tray: { x: r(table.x + table.w * 0.27), y: H - 26, w: r(table.w * 0.46), h: 18 },
      seller: { x: table.x + 16, y: H - 6 },
      bin: { x: table.x + table.w - 14, y: H - 18 },
      binR: 12,
    };
  }
  const table: Rect = { x: 4, y: 56, w: W - 8, h: H - 58 };
  const matW = clamp(r(table.w * 0.3), 48, 72), matCx = r(W * 0.36);
  const mat: Rect = { x: matCx - r(matW / 2), y: 84, w: matW, h: 22 };
  return {
    worldW: W, worldH: H, portrait: true, hudH,
    panelL: null, panelR: null,
    table,
    lamp: { x: r(W / 2), y: 0 },
    you: { reel: { x: 8, y: 22, w: W - 16, h: 26 }, mat, caseSpot: { x: matCx, y: 104 }, keyHome: { x: mat.x - 12, y: 92 }, reveal: { x: matCx, y: 66 } },
    bot: { reel: null, spot: { x: r(W * 0.76), y: 112 } },
    tray: { x: r(W * 0.25), y: H - 40, w: r(W * 0.5), h: 18 },
    seller: { x: 20, y: H - 14 },
    bin: { x: W - 18, y: H - 30 },
    binR: 12,
  };
}
```

- [ ] **Step 5: Run the tests and adjust numbers until they pass**

Run: `npx vitest run src/modules/casecremental/fx/pixel`
Expected: PASS. If a size fails, change only the constants in `tableLayout` (offsets/fractions) — never the tests — and re-run; record the change in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/fx/pixel
git commit -m "feat(fx): integer pixel viewport and workbench layout for landscape and portrait

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 7: Sprite timelines, code eyes, sprite library with placeholders

**Files:**
- Create: `fx/pixel/timeline.ts`, `fx/pixel/eyes.ts`, `fx/pixel/sprites.ts`
- Test: `fx/pixel/timeline.test.ts`, `fx/pixel/eyes.test.ts`, `fx/pixel/sprites.test.ts`

**Interfaces:**
- Produces:
  - `type EyeState = "open" | "half" | "closed" | "happy"`
  - `interface Key { frame: number; ms: number; dx?: number; dy?: number; bodyDy?: number; headDy?: number; eyes?: EyeState; look?: number; event?: string }`
  - `interface Pose { frame: number; dx: number; dy: number; bodyDy: number; headDy: number; eyes: EyeState; look: number }`
  - `class Timeline { constructor(keys: readonly Key[], loop?: boolean); get pose(): Pose; get done(): boolean; advance(ms: number): string[]; restart(): void }`
  - `EYE_COLOR = 0x6fffe8`, `VISOR_COLOR = 0x0d1418`, `interface PxRect { x; y; w; h }`, `visorPatch(x, y): PxRect`, `eyeRects(state: EyeState, x, y): PxRect[]`
  - `interface SpriteMeta { id: string; frames: number; frameW: number; frameH: number; ground: number; eyes: ([number, number][] | null)[] | null }`
  - `spriteIndex(): Map<string, { meta: SpriteMeta; url: string }>`
  - `placeholderMeta(id: string, w: number, h: number, frames = 1): SpriteMeta`
  - `class SpriteLibrary { static load(): Promise<SpriteLibrary>; get(id: string, fallback: { w: number; h: number; frames?: number }): SpriteSet; has(id: string): boolean; destroy(): void }`, `interface SpriteSet { meta: SpriteMeta; frames: Texture[]; placeholder: boolean }`

- [ ] **Step 1: Write the failing tests**

`fx/pixel/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Timeline } from "./timeline";

const KEYS = [
  { frame: 0, ms: 100, event: "start" },
  { frame: 1, ms: 50, dy: -2, eyes: "happy" as const },
  { frame: 2, ms: 100, event: "pop" },
];

describe("Timeline", () => {
  it("fires the first key's event on the first advance and holds poses for their durations", () => {
    const tl = new Timeline(KEYS);
    expect(tl.advance(0)).toEqual(["start"]);
    expect(tl.pose).toMatchObject({ frame: 0, dy: 0, eyes: "open" });
    expect(tl.advance(99)).toEqual([]);
    expect(tl.advance(1)).toEqual([]);
    expect(tl.pose).toMatchObject({ frame: 1, dy: -2, eyes: "happy" });
    expect(tl.advance(50)).toEqual(["pop"]);
    expect(tl.pose.frame).toBe(2);
  });

  it("can cross several keys in one big step and report every event", () => {
    const tl = new Timeline(KEYS);
    expect(tl.advance(1000)).toEqual(["start", "pop"]);
    expect(tl.done).toBe(true);
    expect(tl.pose.frame).toBe(2);
  });

  it("loops when asked", () => {
    const tl = new Timeline(KEYS, true);
    tl.advance(250);
    expect(tl.done).toBe(false);
    expect(tl.pose.frame).toBe(0);
    expect(tl.advance(10)).toEqual([]);
  });

  it("restart replays from the first key", () => {
    const tl = new Timeline(KEYS);
    tl.advance(1000);
    tl.restart();
    expect(tl.advance(0)).toEqual(["start"]);
    expect(tl.done).toBe(false);
  });
});
```

`fx/pixel/eyes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eyeRects, visorPatch } from "./eyes";

describe("code eyes", () => {
  it("draws a 5×5 visor patch centred on the eye", () => {
    expect(visorPatch(10, 20)).toEqual({ x: 8, y: 18, w: 5, h: 5 });
  });

  it("has four states", () => {
    expect(eyeRects("open", 10, 20)).toEqual([{ x: 9, y: 19, w: 2, h: 3 }]);
    expect(eyeRects("half", 10, 20)).toEqual([{ x: 9, y: 20, w: 2, h: 2 }]);
    expect(eyeRects("closed", 10, 20)).toEqual([{ x: 9, y: 21, w: 3, h: 1 }]);
    expect(eyeRects("happy", 10, 20)).toHaveLength(3);
  });
});
```

`fx/pixel/sprites.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { placeholderMeta, spriteIndex } from "./sprites";

describe("sprite index", () => {
  it("lists the built sprites with their meta and URL", () => {
    const idx = spriteIndex();
    const bot = idx.get("bot-open");
    expect(bot?.meta.frames).toBe(8);
    expect(bot?.meta.eyes).toHaveLength(8);
    expect(typeof bot?.url).toBe("string");
  });

  it("makes a placeholder meta for a missing sprite", () => {
    expect(spriteIndex().has("does-not-exist")).toBe(false);
    expect(placeholderMeta("x", 24, 20, 4)).toEqual({ id: "x", frames: 4, frameW: 24, frameH: 20, ground: 19, eyes: null });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/pixel`
Expected: FAIL — cannot resolve `./timeline`, `./eyes`, `./sprites`.

- [ ] **Step 3: Write `fx/pixel/timeline.ts`**

```ts
// Per-frame-timed animation (spec §6): each key holds a drawn frame for its own duration, with
// whole-pixel nudges (dx/dy for the whole sprite, bodyDy/headDy for the bands), an eye state, a
// look offset and an optional event fired when the key starts.

export type EyeState = "open" | "half" | "closed" | "happy";

export interface Key {
  frame: number;
  ms: number;
  dx?: number;
  dy?: number;
  bodyDy?: number;
  headDy?: number;
  eyes?: EyeState;
  look?: number;
  event?: string;
}

export interface Pose {
  frame: number;
  dx: number;
  dy: number;
  bodyDy: number;
  headDy: number;
  eyes: EyeState;
  look: number;
}

export class Timeline {
  private i = 0;
  private t = 0;
  private started = false;
  private finished = false;

  constructor(private readonly keys: readonly Key[], readonly loop = false) {
    if (keys.length === 0) throw new Error("timeline needs at least one key");
  }

  get done(): boolean {
    return this.finished;
  }

  get pose(): Pose {
    const k = this.keys[this.i]!;
    return { frame: k.frame, dx: k.dx ?? 0, dy: k.dy ?? 0, bodyDy: k.bodyDy ?? 0, headDy: k.headDy ?? 0, eyes: k.eyes ?? "open", look: k.look ?? 0 };
  }

  restart(): void {
    this.i = 0; this.t = 0; this.started = false; this.finished = false;
  }

  /** Advance by ms; returns the events of every key entered (including the first, on the first call). */
  advance(ms: number): string[] {
    const events: string[] = [];
    if (!this.started) { this.started = true; const e = this.keys[0]!.event; if (e) events.push(e); }
    if (this.finished) return events;
    this.t += ms;
    while (this.t >= this.keys[this.i]!.ms) {
      this.t -= this.keys[this.i]!.ms;
      if (this.i + 1 < this.keys.length) this.i++;
      else if (this.loop) this.i = 0;
      else { this.finished = true; this.t = 0; break; }
      const e = this.keys[this.i]!.event;
      if (e) events.push(e);
    }
    return events;
  }
}
```

- [ ] **Step 4: Write `fx/pixel/eyes.ts`**

```ts
import type { EyeState } from "./timeline";

// The code-drawn eyes (spec §6): 2×3 blocks on a dark 5×5 visor patch, in world pixels.

export const EYE_COLOR = 0x6fffe8;
export const VISOR_COLOR = 0x0d1418;

export interface PxRect { x: number; y: number; w: number; h: number }

export const visorPatch = (x: number, y: number): PxRect => ({ x: x - 2, y: y - 2, w: 5, h: 5 });

export function eyeRects(state: EyeState, x: number, y: number): PxRect[] {
  switch (state) {
    case "open": return [{ x: x - 1, y: y - 1, w: 2, h: 3 }];
    case "half": return [{ x: x - 1, y, w: 2, h: 2 }];
    case "closed": return [{ x: x - 1, y: y + 1, w: 3, h: 1 }];
    case "happy": return [{ x: x - 1, y: y + 1, w: 1, h: 1 }, { x, y, w: 1, h: 1 }, { x: x + 1, y: y + 1, w: 1, h: 1 }];
  }
}
```

- [ ] **Step 5: Write `fx/pixel/sprites.ts`**

```ts
import { Assets, Rectangle, Texture } from "pixi.js";

// Built sprites (assets/sprites/<id>.png + .json, made by `npm run art`) as Pixi textures with
// nearest-neighbour sampling. A sprite whose art isn't built yet gets a magenta placeholder of the
// expected size, so the game always starts (Review Focus 1).

export interface SpriteMeta {
  id: string;
  frames: number;
  frameW: number;
  frameH: number;
  ground: number;
  eyes: ([number, number][] | null)[] | null;
}

export interface SpriteSet {
  meta: SpriteMeta;
  frames: Texture[];
  placeholder: boolean;
}

const METAS = import.meta.glob("../../assets/sprites/*.json", { eager: true, import: "default" }) as Record<string, SpriteMeta>;
const URLS = import.meta.glob("../../assets/sprites/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export function spriteIndex(): Map<string, { meta: SpriteMeta; url: string }> {
  const out = new Map<string, { meta: SpriteMeta; url: string }>();
  for (const [path, meta] of Object.entries(METAS)) {
    const url = URLS[path.replace(/\.json$/, ".png")];
    if (url) out.set(meta.id, { meta, url });
  }
  return out;
}

export const placeholderMeta = (id: string, w: number, h: number, frames = 1): SpriteMeta => ({ id, frames, frameW: w, frameH: h, ground: h - 1, eyes: null });

function placeholderTexture(w: number, h: number): Texture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { g.fillStyle = (x + y) % 2 ? "#ff00ff" : "#2a002a"; g.fillRect(x, y, 1, 1); }
  const t = Texture.from(c);
  t.source.scaleMode = "nearest";
  return t;
}

export class SpriteLibrary {
  private constructor(private readonly sets: Map<string, SpriteSet>, private readonly owned: Texture[]) {}

  static async load(): Promise<SpriteLibrary> {
    const sets = new Map<string, SpriteSet>();
    for (const [id, { meta, url }] of spriteIndex()) {
      const base: Texture = await Assets.load(url);
      base.source.scaleMode = "nearest";
      const frames = Array.from({ length: meta.frames }, (_, i) => new Texture({ source: base.source, frame: new Rectangle(i * meta.frameW, 0, meta.frameW, meta.frameH) }));
      sets.set(id, { meta, frames, placeholder: false });
    }
    return new SpriteLibrary(sets, []);
  }

  has(id: string): boolean {
    return this.sets.has(id) && !this.sets.get(id)!.placeholder;
  }

  get(id: string, fallback: { w: number; h: number; frames?: number }): SpriteSet {
    const found = this.sets.get(id);
    if (found) return found;
    const meta = placeholderMeta(id, fallback.w, fallback.h, fallback.frames ?? 1);
    const tex = placeholderTexture(fallback.w, fallback.h);
    this.owned.push(tex);
    const set: SpriteSet = { meta, frames: Array.from({ length: meta.frames }, () => tex), placeholder: true };
    this.sets.set(id, set);
    console.warn(`[casecremental] sprite "${id}" not built — using a placeholder`);
    return set;
  }

  destroy(): void {
    for (const t of this.owned) t.destroy(true);
    this.owned.length = 0;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx/pixel && npm run typecheck`
Expected: PASS; typecheck clean. (`sprites.test.ts` relies on `bot-open` built in Task 2.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/fx/pixel
git commit -m "feat(fx): per-frame timelines, code eyes, sprite library with placeholders

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 8: Pixel skins — weapon base × pattern

**Files:**
- Create: `fx/skins/pixelSkin.ts`
- Test: `fx/skins/pixelSkin.test.ts`

**Interfaces:**
- Consumes: `renderPattern(spec, w, h)` (existing, `fx/skins/patterns.ts`), `SILHOUETTES`, `SILHOUETTE_BOX` (existing), `SkinDef`, `WeaponId`.
- Produces:
  - `interface PixelImage { w: number; h: number; data: Uint8ClampedArray }`
  - `tintWeapon(base: PixelImage, pattern: Uint8ClampedArray): Uint8ClampedArray` (pure)
  - `fallbackBase(weapon: WeaponId, w = 26, h = 10): PixelImage` (pure: silhouette polygon, grey shading, dark outline)
  - `class SkinTextures { constructor(bases: Map<WeaponId, PixelImage>); texture(skin: SkinDef): Texture; destroy(): void }`
  - `loadWeaponBases(index: Map<string, { url: string }>): Promise<Map<WeaponId, PixelImage>>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { fallbackBase, tintWeapon } from "./pixelSkin";

describe("pixel skins", () => {
  it("keeps outline pixels dark, transparent pixels empty, and shades the pattern by the base", () => {
    const base = { w: 3, h: 1, data: new Uint8ClampedArray([18, 14, 16, 255, 60, 60, 60, 255, 220, 220, 220, 255]) };
    const pattern = new Uint8ClampedArray([200, 100, 0, 255, 200, 100, 0, 255, 200, 100, 0, 255]);
    const out = tintWeapon(base, pattern);
    expect(Array.from(out.slice(0, 4))).toEqual([18, 14, 16, 255]);
    expect(out[4]!).toBeLessThan(out[8]!);
    expect(out[7]).toBe(255);
    const empty = tintWeapon({ w: 1, h: 1, data: new Uint8ClampedArray(4) }, new Uint8ClampedArray([255, 0, 0, 255]));
    expect(empty[3]).toBe(0);
  });

  it("draws a fallback base for every weapon when no art is built", () => {
    for (const w of ["rifle", "sniper", "pistol", "heavyPistol", "smg", "shotgun", "mg", "knife"] as const) {
      const b = fallbackBase(w);
      let opaque = 0;
      for (let i = 3; i < b.data.length; i += 4) if (b.data[i]) opaque++;
      expect(opaque, w).toBeGreaterThan(30);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/skins/pixelSkin.test.ts`
Expected: FAIL — cannot resolve `./pixelSkin`.

- [ ] **Step 3: Write `fx/skins/pixelSkin.ts`**

```ts
import { Texture } from "pixi.js";
import type { SkinDef, WeaponId } from "../../sim/types";
import { renderPattern } from "./patterns";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

// A skin in the pixel world (spec §5): the weapon's greyscale base sprite shades the skin's
// procedural pattern; outline pixels stay as drawn. Falls back to the old polygon silhouettes
// when the weapon art isn't built yet.

export interface PixelImage { w: number; h: number; data: Uint8ClampedArray }

export function tintWeapon(base: PixelImage, pattern: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    if (base.data[i + 3]! < 128) continue;
    const lum = (base.data[i]! + base.data[i + 1]! + base.data[i + 2]!) / 3;
    if (lum < 40) { out.set(base.data.subarray(i, i + 4), i); continue; }
    const k = 0.35 + 0.9 * (lum / 255);
    out[i] = pattern[i]! * k; out[i + 1] = pattern[i + 1]! * k; out[i + 2] = pattern[i + 2]! * k; out[i + 3] = 255;
  }
  return out;
}

export function fallbackBase(weapon: WeaponId, w = 26, h = 10): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  const pts = SILHOUETTES[weapon];
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const sx = SILHOUETTE_BOX.w / w, sy = SILHOUETTE_BOX.h / h;
  const fill = (x: number, y: number) => inside((x + 0.5) * sx, (y + 0.5) * sy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (fill(x, y)) { const v = 200 - y * 10; data.set([v, v, v, 255], i); }
    else if (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1)) data.set([18, 14, 16, 255], i);
  }
  return { w, h, data };
}

export async function loadWeaponBases(index: Map<string, { url: string }>): Promise<Map<WeaponId, PixelImage>> {
  const out = new Map<WeaponId, PixelImage>();
  for (const w of ["rifle", "sniper", "pistol", "heavyPistol", "smg", "shotgun", "mg", "knife"] as const) {
    const entry = index.get(`weapon-${w}`);
    if (!entry) continue;
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = entry.url; });
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    out.set(w, { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data });
  }
  return out;
}

export class SkinTextures {
  private readonly cache = new Map<string, Texture>();
  constructor(private readonly bases: Map<WeaponId, PixelImage>) {}

  texture(skin: SkinDef): Texture {
    const hit = this.cache.get(skin.id);
    if (hit) return hit;
    const base = this.bases.get(skin.weapon) ?? fallbackBase(skin.weapon);
    const pixels = tintWeapon(base, renderPattern(skin.pattern, base.w, base.h));
    const c = document.createElement("canvas"); c.width = base.w; c.height = base.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), base.w, base.h), 0, 0);
    const tex = Texture.from(c);
    tex.source.scaleMode = "nearest";
    this.cache.set(skin.id, tex);
    return tex;
  }

  destroy(): void {
    for (const t of this.cache.values()) t.destroy(true);
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/casecremental/fx/skins && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/skins
git commit -m "feat(fx): pixel skins - greyscale weapon base shades the procedural pattern

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 9: Pixel layer, actors and world-space drag

**Files:**
- Create: `fx/pixel/drag.ts`, `fx/pixel/blink.ts`, `fx/pixel/screen.ts`, `fx/pixel/Actor.ts`, `fx/pixel/PixelLayer.ts`
- Modify: `fx/GameScene.ts` (no antialiasing, whole-number canvas resolution)
- Test: `fx/pixel/drag.test.ts`, `fx/pixel/blink.test.ts`, `fx/pixel/screen.test.ts`, `fx/pixel/Actor.test.ts`

**Interfaces:**
- Consumes: `Pt`, `Rect` (Task 6); `Pose`, `EyeState` (Task 7 `timeline.ts`); `eyeRects`, `visorPatch`, `EYE_COLOR`, `VISOR_COLOR` (Task 7); `SpriteSet`, `SpriteMeta`, `placeholderMeta` (Task 7); `PixelViewport` (Task 6).
- Produces:
  - `interface Grabbable { id: string; rect: Rect }`; `type DragEnd = { kind: "tap"; id } | { kind: "drop"; id; at: Pt } | { kind: "cancel"; id } | { kind: "none" }`; `TAP_SLOP = 2`; `class DragTracker { dragging: string | null; position: Pt | null; down(p, items): string | null; move(p): void; up(p): DragEnd; cancel(): DragEnd }`
  - `class Blinker { constructor(random?: () => number); update(ms): EyeState | null }`
  - `canvasResolution(dpr): number` (1 or 2), `toWorld(vp, sx, sy): Pt`, `toScreen(vp, wx, wy): Pt`, `hdFontSize(scale, base = 8): number`
  - `interface Bands { headEnd; bodyEnd }`, `interface Part { srcY; h; dy }`, `actorParts(frameH, pose, bands?): Part[]`, `eyePositions(meta, pose): Pt[]`, `class Actor extends Container { constructor(set: SpriteSet, bands?: Bands); meta: SpriteMeta; place(x, y): void; box(): Rect; show(pose: Pose, eyeOverride?: EyeState | null): void }`
  - `class PixelLayer { world: Container; view: Sprite; resize(vp): void; render(renderer): void; setOffset(x, y): void; viewport: PixelViewport | null; destroy(): void }`

- [ ] **Step 1: Write the failing tests**

`fx/pixel/drag.test.ts` (Review Focus 3 — a resize mid-drag cancels it):

```ts
import { describe, expect, it } from "vitest";
import { DragTracker } from "./drag";

const KEY = { id: "key", rect: { x: 10, y: 10, w: 10, h: 6 } };
const CARD = { id: "card", rect: { x: 40, y: 10, w: 44, h: 30 } };

describe("DragTracker", () => {
  it("grabs only what is under the pointer, first item first", () => {
    const d = new DragTracker();
    expect(d.down({ x: 5, y: 5 }, [KEY, CARD])).toBeNull();
    expect(d.down({ x: 12, y: 12 }, [KEY, CARD])).toBe("key");
    expect(d.dragging).toBe("key");
  });

  it("treats a press that barely moves as a tap", () => {
    const d = new DragTracker();
    d.down({ x: 12, y: 12 }, [KEY]);
    d.move({ x: 13, y: 13 });
    expect(d.up({ x: 13, y: 13 })).toEqual({ kind: "tap", id: "key" });
    expect(d.dragging).toBeNull();
  });

  it("drags in whole world pixels and drops where released", () => {
    const d = new DragTracker();
    d.down({ x: 12, y: 12 }, [KEY]);
    d.move({ x: 30.6, y: 40.2 });
    expect(d.position).toEqual({ x: 29, y: 38 });
    expect(d.up({ x: 31, y: 40 })).toEqual({ kind: "drop", id: "key", at: { x: 31, y: 40 } });
  });

  it("cancels mid-drag (viewport resized or rotated): nothing fires on release", () => {
    const d = new DragTracker();
    d.down({ x: 50, y: 20 }, [KEY, CARD]);
    d.move({ x: 90, y: 60 });
    expect(d.cancel()).toEqual({ kind: "cancel", id: "card" });
    expect(d.position).toBeNull();
    expect(d.up({ x: 90, y: 60 })).toEqual({ kind: "none" });
  });
});
```

`fx/pixel/blink.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Blinker } from "./blink";

describe("Blinker", () => {
  it("waits 2–5 s, then blinks half → closed → half and waits again", () => {
    const b = new Blinker(() => 0); // 2 s wait
    expect(b.update(1999)).toBeNull();
    expect(b.update(1)).toBe("half");
    expect(b.update(40)).toBe("closed");
    expect(b.update(70)).toBe("half");
    expect(b.update(40)).toBeNull();
    expect(b.update(1000)).toBeNull();
  });

  it("never waits longer than 5 s", () => {
    const b = new Blinker(() => 0.999);
    expect(b.update(5000)).toBe("half");
  });
});
```

`fx/pixel/screen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canvasResolution, hdFontSize, toScreen, toWorld } from "./screen";

describe("screen ↔ world", () => {
  it("keeps the canvas at a whole device-pixel ratio", () => {
    expect([1, 1.25, 1.5, 2, 2.75, 3, 0].map(canvasResolution)).toEqual([1, 1, 1, 2, 2, 2, 1]);
  });

  it("maps CSS px to whole world px and back", () => {
    expect(toWorld({ scale: 4 }, 123, 47)).toEqual({ x: 30, y: 11 });
    expect(toScreen({ scale: 4 }, 30, 11)).toEqual({ x: 120, y: 44 });
  });

  it("sizes text in multiples of 8 px", () => {
    expect([1, 2, 3, 4, 6, 8].map((s) => hdFontSize(s))).toEqual([8, 8, 8, 16, 24, 32]);
  });
});
```

`fx/pixel/Actor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { actorParts, eyePositions } from "./Actor";
import { placeholderMeta } from "./sprites";

const POSE = { frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open" as const, look: 0 };

describe("actor bands", () => {
  it("draws a plain sprite as one part", () => {
    expect(actorParts(20, { dy: -2, bodyDy: 0, headDy: 0 })).toEqual([{ srcY: 0, h: 20, dy: -2 }]);
  });

  it("splits a character into legs, body and a head one row taller, bobbing out of step", () => {
    const parts = actorParts(62, { dy: 0, bodyDy: 1, headDy: -1 }, { headEnd: 30, bodyEnd: 46 });
    expect(parts).toEqual([
      { srcY: 46, h: 16, dy: 0 },
      { srcY: 30, h: 16, dy: 1 },
      { srcY: 0, h: 31, dy: 0 },
    ]);
  });

  it("moves the eyes with the head band and the look", () => {
    const meta = { ...placeholderMeta("bot", 51, 62, 2), eyes: [[[30, 30], [36, 30]] as [number, number][], null] };
    expect(eyePositions(meta, { ...POSE, bodyDy: 1, headDy: -2, look: 1 })).toEqual([{ x: 31, y: 29 }, { x: 37, y: 29 }]);
    expect(eyePositions(meta, { ...POSE, frame: 1 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/pixel`
Expected: FAIL — cannot resolve `./drag`, `./blink`, `./screen`, `./Actor`.

- [ ] **Step 3: Write `fx/pixel/drag.ts`**

```ts
import type { Pt, Rect } from "./layout";

// Drag-and-drop in world pixels for the tactile chores (the key into the lock, the skin into the
// bin). A press that barely moves is a tap — the fallback for phones and quick players. The World
// cancels a drag when the viewport changes under it (resize, phone rotation): the item goes home
// and nothing fires (Review Focus 3).

export interface Grabbable {
  id: string;
  rect: Rect;
}

export type DragEnd =
  | { kind: "tap"; id: string }
  | { kind: "drop"; id: string; at: Pt }
  | { kind: "cancel"; id: string }
  | { kind: "none" };

/** World px a press may wander and still count as a tap (≈ 8–16 CSS px). */
export const TAP_SLOP = 2;

const hit = (r: Rect, p: Pt) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export class DragTracker {
  private active: { id: string; start: Pt; grab: Pt; moved: number; pos: Pt } | null = null;

  get dragging(): string | null {
    return this.active?.id ?? null;
  }

  /** Where the dragged item's top-left goes, in whole world px. */
  get position(): Pt | null {
    return this.active ? { ...this.active.pos } : null;
  }

  /** Grab the first item under the pointer (items are in priority order). */
  down(p: Pt, items: readonly Grabbable[]): string | null {
    const item = items.find((i) => hit(i.rect, p));
    if (!item) return null;
    this.active = { id: item.id, start: p, grab: { x: p.x - item.rect.x, y: p.y - item.rect.y }, moved: 0, pos: { x: item.rect.x, y: item.rect.y } };
    return item.id;
  }

  move(p: Pt): void {
    const a = this.active;
    if (!a) return;
    a.moved = Math.max(a.moved, Math.hypot(p.x - a.start.x, p.y - a.start.y));
    a.pos = { x: Math.round(p.x - a.grab.x), y: Math.round(p.y - a.grab.y) };
  }

  up(p: Pt): DragEnd {
    const a = this.active;
    if (!a) return { kind: "none" };
    this.active = null;
    return a.moved <= TAP_SLOP ? { kind: "tap", id: a.id } : { kind: "drop", id: a.id, at: p };
  }

  cancel(): DragEnd {
    const a = this.active;
    this.active = null;
    return a ? { kind: "cancel", id: a.id } : { kind: "none" };
  }
}
```

- [ ] **Step 4: Write `fx/pixel/blink.ts`**

```ts
import type { EyeState } from "./timeline";

// Eyes blink every 2–5 s (spec §6): half → closed → half, ~150 ms. While a blink runs it
// overrides the animation's own eye state.

const SEQUENCE: Array<[EyeState, number]> = [["half", 40], ["closed", 70], ["half", 40]];

export class Blinker {
  private wait: number;
  private t = 0;

  constructor(private readonly random: () => number = Math.random) {
    this.wait = this.nextWait();
  }

  /** Advance by ms; the eye state to show instead of the pose's, or null. */
  update(ms: number): EyeState | null {
    this.t += ms;
    if (this.t < this.wait) return null;
    let into = this.t - this.wait;
    for (const [state, dur] of SEQUENCE) {
      if (into < dur) return state;
      into -= dur;
    }
    this.t = 0;
    this.wait = this.nextWait();
    return null;
  }

  private nextWait(): number {
    return 2000 + this.random() * 3000;
  }
}
```

- [ ] **Step 5: Write `fx/pixel/screen.ts`**

```ts
import type { Pt } from "./layout";
import type { PixelViewport } from "./viewport";

// Screen (CSS px) ↔ world px, and sizes for full-resolution text. The pixel world's view sits at
// the top-left of the canvas.

/** Canvas backing resolution: a whole device-pixel ratio (so each world pixel stays square), at most 2. */
export const canvasResolution = (dpr: number): number => Math.min(2, Math.max(1, Math.floor(dpr || 1)));

export const toWorld = (vp: Pick<PixelViewport, "scale">, sx: number, sy: number): Pt => ({
  x: Math.floor(sx / vp.scale),
  y: Math.floor(sy / vp.scale),
});

export const toScreen = (vp: Pick<PixelViewport, "scale">, wx: number, wy: number): Pt => ({ x: wx * vp.scale, y: wy * vp.scale });

/** Press Start 2P in multiples of 8 px, growing with the pixel scale. */
export const hdFontSize = (scale: number, base = 8): number => base * Math.max(1, Math.floor(scale / 2));
```

- [ ] **Step 6: Write `fx/pixel/Actor.ts`**

```ts
import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { EYE_COLOR, eyeRects, VISOR_COLOR, visorPatch } from "./eyes";
import type { Pt } from "./layout";
import type { SpriteMeta, SpriteSet } from "./sprites";
import type { EyeState, Pose } from "./timeline";

// One animated pixel sprite on the table. It shows a drawn frame, nudged by whole pixels: the
// whole sprite (dx/dy) and, for characters, the body and head bands (bodyDy/headDy) — the head band
// is cut one row taller so a 1 px bob never opens a seam (spec §6). Code eyes go on top.

/** Last row of the head band and first row of the legs band, in frame px. */
export interface Bands {
  headEnd: number;
  bodyEnd: number;
}

export interface Part {
  srcY: number;
  h: number;
  dy: number;
}

/** The bands of a frame to draw, back to front, with their vertical offsets. */
export function actorParts(frameH: number, pose: Pick<Pose, "dy" | "bodyDy" | "headDy">, bands?: Bands): Part[] {
  if (!bands) return [{ srcY: 0, h: frameH, dy: pose.dy }];
  const body = pose.dy + pose.bodyDy;
  return [
    { srcY: bands.bodyEnd, h: frameH - bands.bodyEnd, dy: pose.dy },
    { srcY: bands.headEnd, h: bands.bodyEnd - bands.headEnd, dy: body },
    { srcY: 0, h: bands.headEnd + 1, dy: body + pose.headDy },
  ];
}

/** Eye centres in frame px for this pose (they ride the head band and follow the look). */
export function eyePositions(meta: SpriteMeta, pose: Pose): Pt[] {
  const eyes = meta.eyes?.[pose.frame];
  if (!eyes) return [];
  const dy = pose.dy + pose.bodyDy + pose.headDy;
  return eyes.map(([x, y]) => ({ x: x + pose.look, y: y + dy }));
}

export class Actor extends Container {
  private readonly sprites: Sprite[] = [];
  private readonly eyes = new Graphics();
  private readonly cut = new Map<string, Texture>();
  private anchorPt: Pt = { x: 0, y: 0 };

  constructor(
    readonly set: SpriteSet,
    private readonly bands?: Bands,
  ) {
    super();
    const n = bands ? 3 : 1;
    for (let i = 0; i < n; i++) this.sprites.push(this.addChild(new Sprite()));
    this.addChild(this.eyes);
    this.show({ frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open", look: 0 });
  }

  get meta(): SpriteMeta {
    return this.set.meta;
  }

  /** The ground point (feet centre) in world px. */
  place(x: number, y: number): void {
    this.anchorPt = { x: Math.round(x), y: Math.round(y) };
  }

  /** The frame's box in world px for the given pose (hit tests, drag). */
  box(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.meta.frameW, h: this.meta.frameH };
  }

  show(pose: Pose, eyeOverride: EyeState | null = null): void {
    const m = this.meta;
    const frame = Math.min(pose.frame, m.frames - 1);
    this.position.set(this.anchorPt.x - Math.floor(m.frameW / 2) + pose.dx, this.anchorPt.y - m.ground);
    actorParts(m.frameH, pose, this.bands).forEach((p, i) => {
      const s = this.sprites[i]!;
      s.texture = this.band(frame, p.srcY, p.h);
      s.y = p.srcY + p.dy;
    });
    this.eyes.clear();
    const state = eyeOverride ?? pose.eyes;
    for (const e of eyePositions(m, { ...pose, frame })) {
      const v = visorPatch(e.x, e.y);
      this.eyes.rect(v.x, v.y, v.w, v.h).fill({ color: VISOR_COLOR });
      for (const r of eyeRects(state, e.x, e.y)) this.eyes.rect(r.x, r.y, r.w, r.h).fill({ color: EYE_COLOR });
    }
  }

  override destroy(): void {
    for (const t of this.cut.values()) t.destroy(false);
    this.cut.clear();
    super.destroy({ children: true });
  }

  private band(frame: number, srcY: number, h: number): Texture {
    const whole = this.set.frames[frame]!;
    if (!this.bands) return whole;
    const key = `${frame}:${srcY}:${h}`;
    let t = this.cut.get(key);
    if (!t) {
      const f = whole.frame;
      t = new Texture({ source: whole.source, frame: new Rectangle(f.x, f.y + srcY, f.width, h) });
      this.cut.set(key, t);
    }
    return t;
  }
}
```

- [ ] **Step 7: Write `fx/pixel/PixelLayer.ts`**

```ts
import { Container, RenderTexture, Sprite, type Renderer } from "pixi.js";
import type { PixelViewport } from "./viewport";

// The pixel world: everything in `world` is drawn in world px into a low-resolution texture, which
// is shown scaled by the integer factor with nearest-neighbour sampling (spec §2). Shake moves the
// view by whole CSS px; nothing in the world is ever scaled or rotated.

export class PixelLayer {
  readonly world = new Container();
  readonly view = new Sprite();
  private rt: RenderTexture | null = null;
  private vp: PixelViewport | null = null;

  resize(vp: PixelViewport): void {
    this.vp = vp;
    this.rt?.destroy(true);
    this.rt = RenderTexture.create({ width: vp.worldW, height: vp.worldH, resolution: 1 });
    this.rt.source.scaleMode = "nearest";
    this.view.texture = this.rt;
    this.view.scale.set(vp.scale);
  }

  render(renderer: Renderer): void {
    if (this.rt) renderer.render({ container: this.world, target: this.rt, clear: true });
  }

  /** Screen shake, rounded to whole CSS px. */
  setOffset(x: number, y: number): void {
    this.view.position.set(Math.round(x), Math.round(y));
  }

  get viewport(): PixelViewport | null {
    return this.vp;
  }

  destroy(): void {
    this.world.destroy({ children: true });
    this.view.destroy();
    this.rt?.destroy(true);
    this.rt = null;
  }
}
```

- [ ] **Step 8: Crisp canvas in `fx/GameScene.ts`**

```diff
--- a/src/modules/casecremental/fx/GameScene.ts
+++ b/src/modules/casecremental/fx/GameScene.ts
@@ -1,6 +1,7 @@
 import { Application, type Ticker } from "pixi.js";
 import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
 import type { GameController } from "../game/controller";
+import { canvasResolution } from "./pixel/screen";
 import { World } from "./World";
 
 // The Pixi scene the host's Mode Router drives: created on mount, ticking only while active
@@ -34,9 +35,10 @@ export function createGameScene(controller: GameController): EngineScene {
         .init({
           resizeTo: host,
           background: "#07080c",
-          antialias: true,
+          // pixel art: no smoothing, and a whole device-pixel ratio so every world pixel stays square
+          antialias: false,
           autoDensity: true,
-          resolution: Math.min(window.devicePixelRatio || 1, 2),
+          resolution: canvasResolution(window.devicePixelRatio),
         })
         .then(() => {
           if (app !== a) {
```

- [ ] **Step 9: Run the tests, typecheck and build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds. (The new classes are used from Task 11.)

- [ ] **Step 10: Commit**

```bash
git add -A src/modules/casecremental package.json package-lock.json
git commit -m "feat(fx): pixel layer, banded actors with code eyes, blinking, world-space drag

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 10: HD layer, Press Start 2P, motion presets

**Files:**
- Install: `gsap@3.15.0`, `@fontsource/press-start-2p@5.3.0`
- Create: `fx/hd/font.ts`, `fx/hd/tween.ts`, `fx/hd/ambience.ts`, `fx/hd/HdLayer.ts`
- Modify: `fx/juice/coins.ts` (pixel coins, gold pixel text), `fx/juice/particles.ts` (import `Pt`), `fx/World.ts` (one line, until Task 11 rewrites it)
- Test: `fx/hd/tween.test.ts`, `fx/hd/ambience.test.ts`

**Interfaces:**
- Consumes: `TableLayout`, `Pt` (Task 6), `PixelViewport` (Task 6), `hdFontSize` (Task 9), `Particles` (existing).
- Produces:
  - `PIXEL_FONT`, `loadPixelFont(): Promise<void>`, `moneyStyle(size)`, `pixelStyle(size, color)` (Pixi text styles: gold gradient / flat colour, 2 px hard shadow)
  - `pop(target, from?, duration?)`, `floatAway(target, dy, duration?)`, `anticipate(target, act)`, `spring(target, amount?)`, `setTweenTimeScale(scale)`, `springElement(el, amount?)`, `popElement(el)`
  - `lampFlicker(t): number` (0.78–1), `makeMotes(n, box, random): Mote[]`, `stepMotes(motes, dt, box, t): void`
  - `class Coins { constructor(frames: readonly Texture[]); container; setScale(pixelScale, textSize); burst(from: Pt, to: Pt, amount); floatText(at: Pt, text); update(dt); destroy() }`
  - `class HdLayer { constructor(coinFrames: readonly Texture[]); root: Container; particles: Particles; coins: Coins; layout(l, vp, screenW, screenH); setGlow(color: number | null); flash(color, strength?); setBotAsleep(on); toScreen(p: Pt): Pt; update(dt); destroy() }`

- [ ] **Step 1: Install the two dependencies (project-local, exact versions)**

Run: `npm install --save-exact gsap@3.15.0 @fontsource/press-start-2p@5.3.0`
Expected: both appear in `package.json` `dependencies` with exact versions; `.npmrc` keeps the cache inside the project.

- [ ] **Step 2: Write the failing tests**

`fx/hd/tween.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anticipate, floatAway, pop, spring } from "./tween";

const obj = () => ({ scale: { x: 1, y: 1 }, y: 100, alpha: 1 });

describe("tween presets", () => {
  it("pop grows from small to full size", () => {
    const o = obj();
    const t = pop(o, 0.5).pause();
    t.progress(0);
    expect(o.scale.x).toBe(0.5);
    t.progress(1);
    expect([o.scale.x, o.scale.y]).toEqual([1, 1]);
  });

  it("floatAway rises and fades out", () => {
    const o = obj();
    const t = floatAway(o, 40, 1).pause();
    t.progress(0.5);
    expect(o.alpha).toBe(1);
    t.progress(1);
    expect(o.y).toBe(60);
    expect(o.alpha).toBe(0);
  });

  it("anticipate acts at the peak and settles back to 1", () => {
    const o = obj();
    let acted = 0;
    const t = anticipate(o, () => acted++).pause();
    t.progress(0.1);
    expect(acted).toBe(0);
    t.progress(1);
    expect(acted).toBe(1);
    expect(o.scale.x).toBe(1);
  });

  it("spring returns to rest", () => {
    const o = obj();
    spring(o).pause().progress(1);
    expect(o.scale.x).toBe(1);
  });
});
```

`fx/hd/ambience.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lampFlicker, makeMotes, stepMotes } from "./ambience";

describe("ambience", () => {
  it("keeps the lamp between 0.78 and 1 and actually flickers", () => {
    const samples = Array.from({ length: 4000 }, (_, i) => lampFlicker(i * 0.05));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.78);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.08);
  });

  it("keeps dust inside its box forever", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const box = { x: 100, y: 50, w: 200, h: 120 };
    const motes = makeMotes(40, box, random);
    for (let i = 0; i < 3000; i++) stepMotes(motes, 1 / 30, box, i / 30);
    for (const m of motes) {
      expect(m.x).toBeGreaterThanOrEqual(box.x);
      expect(m.x).toBeLessThanOrEqual(box.x + box.w);
      expect(m.y).toBeGreaterThanOrEqual(box.y);
      expect(m.y).toBeLessThanOrEqual(box.y + box.h);
    }
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/hd`
Expected: FAIL — cannot resolve `./tween`, `./ambience`.

- [ ] **Step 4: Write `fx/hd/font.ts`**

```ts
import { FillGradient, type TextStyleOptions } from "pixi.js";
import "@fontsource/press-start-2p/latin-400.css";
import "@fontsource/press-start-2p/cyrillic-400.css";

// Press Start 2P, bundled with the game (the embedded game may only reach platform hosts). Pixi
// draws text on a canvas, so the font must be loaded before the first Text is created.

export const PIXEL_FONT = '"Press Start 2P", monospace';

export async function loadPixelFont(): Promise<void> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts) return;
  try {
    await Promise.all([fonts.load('8px "Press Start 2P"', "A$1"), fonts.load('8px "Press Start 2P"', "Ж")]);
  } catch {
    // the monospace fallback still renders every string
  }
}

/** Money and big pops: gold gradient fill, 2 px dark drop shadow (spec §7). */
export function moneyStyle(size: number): Partial<TextStyleOptions> {
  return {
    fontFamily: PIXEL_FONT,
    fontSize: size,
    fill: new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: "local",
      colorStops: [
        { offset: 0, color: 0xfff3b0 },
        { offset: 0.55, color: 0xffd34d },
        { offset: 1, color: 0xc98a12 },
      ],
    }),
    dropShadow: { color: 0x120e10, alpha: 1, angle: Math.PI / 2, distance: Math.max(2, size / 8), blur: 0 },
  };
}

/** Plain pixel text with the same hard shadow. */
export function pixelStyle(size: number, color: number): Partial<TextStyleOptions> {
  return {
    fontFamily: PIXEL_FONT,
    fontSize: size,
    fill: color,
    dropShadow: { color: 0x120e10, alpha: 1, angle: Math.PI / 2, distance: Math.max(2, size / 8), blur: 0 },
  };
}
```

- [ ] **Step 5: Write `fx/hd/tween.ts`**

```ts
import { gsap } from "gsap";

// Shared motion presets for the HD layer and the UI (spec §6): pop, float-away, anticipate-then-act,
// overshoot and spring. Pixel sprites never use these — they move by drawn frames and whole pixels.

interface Scalable {
  scale: { x: number; y: number };
}
interface Movable {
  y: number;
  alpha: number;
}

/** Appear: from small to full size with a springy overshoot. */
export function pop(target: Scalable, from = 0.6, duration = 0.35): gsap.core.Tween {
  return gsap.fromTo(target.scale, { x: from, y: from }, { x: 1, y: 1, duration, ease: "back.out(2.5)" });
}

/** Rise by `dy` px and fade out over the last 40 %. */
export function floatAway(target: Movable, dy: number, duration = 0.9): gsap.core.Timeline {
  const y = target.y;
  return gsap
    .timeline()
    .to(target, { y: y - dy, duration, ease: "power2.out" }, 0)
    .to(target, { alpha: 0, duration: duration * 0.4, ease: "power1.in" }, duration * 0.6);
}

/** Wind up (shrink), act at the peak, then settle with an overshoot. */
export function anticipate(target: Scalable, act: () => void): gsap.core.Timeline {
  return gsap
    .timeline()
    .to(target.scale, { x: 0.9, y: 0.9, duration: 0.08, ease: "power2.in" })
    .to(target.scale, { x: 1.15, y: 1.15, duration: 0.1, ease: "power2.out" })
    .call(act)
    .to(target.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(3)" });
}

/** A quick shove that springs back (button presses, counters bumping). */
export function spring(target: Scalable, amount = 0.12): gsap.core.Timeline {
  return gsap
    .timeline()
    .to(target.scale, { x: 1 + amount, y: 1 + amount, duration: 0.07, ease: "power1.out" })
    .to(target.scale, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1, 0.35)" });
}

/** Hit-stop and slow-mo reach the HD tweens too. */
export function setTweenTimeScale(scale: number): void {
  gsap.globalTimeline.timeScale(Math.max(scale, 0.0001));
}

/** The same spring for a DOM element (buttons, the cash counter). */
export function springElement(el: Element, amount = 0.12): gsap.core.Tween {
  return gsap.fromTo(el, { scale: 1 + amount }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.35)", overwrite: true });
}

/** A DOM panel appears with a pop. */
export function popElement(el: Element): gsap.core.Tween {
  return gsap.fromTo(el, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2.5)" });
}
```

- [ ] **Step 6: Write `fx/hd/ambience.ts`**

```ts
// Pure motion for the room's ambience: the lamp's flicker and drifting dust motes (spec §6 idle
// layer). Deterministic, so it can be tested and never syncs with anything else.

/** Lamp brightness at time t (s): a slow breathe plus a rare short dip, always within [0.78, 1]. */
export function lampFlicker(t: number): number {
  const breathe = 0.04 * Math.sin(t * 1.7) + 0.03 * Math.sin(t * 4.3 + 1.1);
  const dipPhase = (t * 0.23) % 1;
  const dip = dipPhase > 0.97 ? 0.12 * Math.sin(((dipPhase - 0.97) / 0.03) * Math.PI) : 0;
  return Math.min(1, Math.max(0.78, 0.93 + breathe - dip));
}

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Make n motes spread over the box with slow drift, from a [0,1) random source. */
export function makeMotes(n: number, box: Box, random: () => number): Mote[] {
  return Array.from({ length: n }, () => ({
    x: box.x + random() * box.w,
    y: box.y + random() * box.h,
    vx: (random() - 0.5) * 6,
    vy: -2 - random() * 4,
    phase: random() * Math.PI * 2,
  }));
}

/** Drift each mote (with a gentle sway) and wrap it around inside the box. */
export function stepMotes(motes: Mote[], dt: number, box: Box, t: number): void {
  for (const m of motes) {
    m.x += (m.vx + 3 * Math.sin(t * 0.8 + m.phase)) * dt;
    m.y += m.vy * dt;
    if (m.y < box.y) m.y += box.h;
    if (m.y > box.y + box.h) m.y -= box.h;
    if (m.x < box.x) m.x += box.w;
    if (m.x > box.x + box.w) m.x -= box.w;
  }
}
```

- [ ] **Step 7: Rewrite `fx/juice/coins.ts`** (spinning pixel coins at the world scale; the amount pops in gold Press Start 2P)

```ts
import { gsap } from "gsap";
import { Container, Sprite, Text, type Texture } from "pixi.js";
import { moneyStyle } from "../hd/font";
import { floatAway, pop } from "../hd/tween";
import type { Pt } from "../pixel/layout";

// Money you can see: spinning pixel coins arc from the sold skin to the cash counter, and the
// amount pops and floats up in gold. Lives in the HD layer (screen px); coins are drawn at the
// pixel world's integer scale.

interface Flight {
  s: Sprite;
  from: Pt;
  ctrl: Pt;
  to: Pt;
  delay: number;
  dur: number;
  age: number;
}

export class Coins {
  readonly container = new Container();
  private flights: Flight[] = [];
  private readonly texts = new Set<Text>();
  private pixelScale = 1;
  private textSize = 16;

  constructor(private readonly frames: readonly Texture[]) {}

  setScale(pixelScale: number, textSize: number): void {
    this.pixelScale = pixelScale;
    this.textSize = textSize;
  }

  burst(from: Pt, to: Pt, amount: number): void {
    const k = this.pixelScale;
    const n = Math.min(24, Math.max(1, Math.round(Math.log10(amount + 1) * 4)));
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.frames[0]);
      s.anchor.set(0.5);
      s.scale.set(k);
      s.visible = false;
      this.container.addChild(s);
      this.flights.push({
        s,
        from: { x: from.x + (Math.random() - 0.5) * 10 * k, y: from.y + (Math.random() - 0.5) * 10 * k },
        ctrl: { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 40 * k, y: Math.min(from.y, to.y) - (8 + Math.random() * 30) * k },
        to,
        delay: i * 0.025,
        dur: 0.55 + Math.random() * 0.25,
        age: 0,
      });
    }
  }

  floatText(at: Pt, text: string): void {
    const t = new Text({ text, style: moneyStyle(this.textSize) });
    t.anchor.set(0.5);
    t.position.set(at.x, at.y);
    this.container.addChild(t);
    this.texts.add(t);
    pop(t);
    floatAway(t, this.textSize * 3).eventCallback("onComplete", () => {
      this.texts.delete(t);
      t.destroy();
    });
  }

  update(dt: number): void {
    this.flights = this.flights.filter((f) => {
      f.age += dt;
      const t = (f.age - f.delay) / f.dur;
      if (t < 0) return true;
      if (t >= 1) {
        f.s.destroy();
        return false;
      }
      const u = 1 - t;
      f.s.visible = true;
      f.s.texture = this.frames[Math.floor(f.age * 12) % this.frames.length]!;
      f.s.x = Math.round(u * u * f.from.x + 2 * u * t * f.ctrl.x + t * t * f.to.x);
      f.s.y = Math.round(u * u * f.from.y + 2 * u * t * f.ctrl.y + t * t * f.to.y);
      return true;
    });
  }

  /** Stop the text tweens before the display objects go away with the layer. */
  destroy(): void {
    for (const t of this.texts) {
      gsap.killTweensOf(t);
      gsap.killTweensOf(t.scale);
    }
    this.texts.clear();
    this.flights = [];
  }
}
```

and point `fx/juice/particles.ts` at the new layout types:

```diff
--- a/src/modules/casecremental/fx/juice/particles.ts
+++ b/src/modules/casecremental/fx/juice/particles.ts
@@ -1,5 +1,5 @@
 import { Container, Sprite, type Texture } from "pixi.js";
-import type { Point } from "../layout";
+import type { Pt } from "../pixel/layout";
 
 // Pooled sprite sparks: bursts on reveals, tinted by rarity, falling with gravity and fading out.
 
@@ -23,7 +23,7 @@ export class Particles {
     private readonly max = 1500,
   ) {}
 
-  burst(at: Point, color: number, count: number, speed: number): void {
+  burst(at: Pt, color: number, count: number, speed: number): void {
     for (let i = 0; i < count && this.live.length < this.max; i++) {
       const s = this.pool.pop() ?? new Sprite(this.texture);
       s.anchor.set(0.5);
```

- [ ] **Step 8: Write `fx/hd/HdLayer.ts`**

```ts
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Coins } from "../juice/coins";
import { Particles } from "../juice/particles";
import type { Pt, TableLayout } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import type { PixelViewport } from "../pixel/viewport";
import { lampFlicker, makeMotes, stepMotes, type Box, type Mote } from "./ambience";
import { pixelStyle } from "./font";

// The full-resolution layer over the pixel world (spec §2): the lamp's warm light, a vignette, dust
// drifting in the light, the glow under the case / reveal, the sleeping bot's Z's, the powered-off
// auto-seller's standby LED, sparks and coins. Everything here is in screen (CSS) px.

const MOTES = 36;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return Texture.from(c);
}

function radial(size: number, stops: Array<[number, string]>): Texture {
  return canvasTexture(size, size, (g) => {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });
}

export class HdLayer {
  readonly root = new Container();
  readonly particles: Particles;
  readonly coins: Coins;
  private readonly textures: Texture[];
  private readonly lamp: Sprite;
  private readonly vignette: Sprite;
  private readonly dust = new Container();
  private readonly glowSprite: Sprite;
  private readonly zs: Text[] = [];
  private readonly led = new Graphics();
  private readonly flashRect = new Graphics();
  private motes: Mote[] = [];
  private moteBox: Box = { x: 0, y: 0, w: 1, h: 1 };
  private vp: PixelViewport | null = null;
  private l: TableLayout | null = null;
  private t = 0;
  private glowColor = 0xffffff;
  private glowTarget = 0;
  private asleep = true;
  private flashAlpha = 0;

  constructor(coinFrames: readonly Texture[]) {
    const cone = canvasTexture(256, 256, (g) => {
      const grad = g.createRadialGradient(128, 0, 0, 128, 0, 256);
      grad.addColorStop(0, "rgba(255,214,150,0.55)");
      grad.addColorStop(0.45, "rgba(255,190,120,0.18)");
      grad.addColorStop(1, "rgba(255,170,100,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    });
    const vignette = radial(256, [[0, "rgba(0,0,0,0)"], [0.6, "rgba(0,0,0,0.15)"], [1, "rgba(0,0,0,0.8)"]]);
    const soft = radial(64, [[0, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]]);
    const dot = radial(16, [[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]);
    this.textures = [cone, vignette, soft, dot];

    this.lamp = new Sprite({ texture: cone, anchor: { x: 0.5, y: 0 }, blendMode: "add" });
    this.glowSprite = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.vignette = new Sprite(vignette);
    for (let i = 0; i < MOTES; i++) this.dust.addChild(new Sprite({ texture: dot, anchor: 0.5, tint: 0xffe2b0 }));
    for (let i = 0; i < 3; i++) {
      const z = new Text({ text: "z", style: pixelStyle(8, 0xbfe8ff) });
      z.anchor.set(0.5);
      this.zs.push(z);
    }
    this.particles = new Particles(dot);
    this.coins = new Coins(coinFrames);
    this.flashRect.alpha = 0;
    this.root.addChild(this.lamp, this.glowSprite, this.dust, ...this.zs, this.led, this.particles.container, this.coins.container, this.vignette, this.flashRect);
  }

  layout(l: TableLayout, vp: PixelViewport, screenW: number, screenH: number): void {
    this.l = l;
    this.vp = vp;
    const k = vp.scale;
    this.lamp.position.set(l.lamp.x * k, 0);
    this.lamp.width = l.table.w * k * 1.3;
    this.lamp.height = vp.worldH * k;
    this.vignette.width = screenW;
    this.vignette.height = screenH;
    this.flashRect.clear().rect(0, 0, screenW, screenH).fill({ color: 0xffffff });
    this.moteBox = { x: (l.lamp.x - l.table.w * 0.4) * k, y: 0, w: l.table.w * 0.8 * k, h: (l.table.y + 50) * k };
    this.motes = makeMotes(MOTES, this.moteBox, Math.random);
    this.dust.children.forEach((s) => (s as Sprite).scale.set(Math.max(0.25, k / 16)));
    this.glowSprite.position.set(l.you.reveal.x * k, l.you.reveal.y * k);
    this.glowSprite.width = this.glowSprite.height = 70 * k;
    for (const z of this.zs) z.style.fontSize = hdFontSize(k);
    this.led.clear().circle(0, 0, Math.max(1.5, k * 0.6)).fill({ color: 0xff3b30 });
    this.led.position.set(l.seller.x * k, (l.seller.y - 26) * k);
    this.coins.setScale(k, hdFontSize(k, 16));
  }

  /** Glow under the reveal in the rarity's colour (null fades it out). */
  setGlow(color: number | null): void {
    if (color !== null) this.glowColor = color;
    this.glowTarget = color === null ? 0 : 0.85;
  }

  /** A full-screen flash that fades out (★ drops, stage-ups). */
  flash(color: number, strength = 0.8): void {
    this.flashRect.tint = color;
    this.flashAlpha = Math.max(this.flashAlpha, strength);
  }

  setBotAsleep(on: boolean): void {
    this.asleep = on;
  }

  /** World px → screen px. */
  toScreen(p: Pt): Pt {
    const k = this.vp?.scale ?? 1;
    return { x: p.x * k, y: p.y * k };
  }

  update(dt: number): void {
    this.t += dt;
    const flicker = lampFlicker(this.t);
    this.lamp.alpha = 0.75 * flicker;
    stepMotes(this.motes, dt * (this.vp?.scale ?? 1), this.moteBox, this.t);
    this.motes.forEach((m, i) => {
      const s = this.dust.children[i] as Sprite;
      s.position.set(m.x, m.y);
      s.alpha = (0.18 + 0.14 * Math.sin(this.t * 1.3 + m.phase)) * flicker;
    });
    this.glowSprite.tint = this.glowColor;
    this.glowSprite.alpha += (this.glowTarget * (0.85 + 0.15 * Math.sin(this.t * 5)) - this.glowSprite.alpha) * Math.min(1, dt * 6);
    this.led.alpha = Math.sin(this.t * Math.PI) > 0 ? 1 : 0.15;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    this.flashRect.alpha = this.flashAlpha;
    this.updateZs();
    this.particles.update(dt);
    this.coins.update(dt);
  }

  destroy(): void {
    this.coins.destroy();
    this.root.destroy({ children: true });
    for (const t of this.textures) t.destroy(true);
  }

  private updateZs(): void {
    const l = this.l;
    const k = this.vp?.scale ?? 1;
    this.zs.forEach((z, i) => {
      z.visible = this.asleep && !!l;
      if (!l) return;
      const phase = (this.t / 2.4 + i / 3) % 1;
      z.position.set((l.bot.spot.x + 8 + phase * 10) * k, (l.bot.spot.y - 44 - phase * 16) * k);
      z.alpha = Math.sin(phase * Math.PI);
    });
  }
}
```

- [ ] **Step 9: Keep the old World compiling** (it is rewritten in Task 11)

```diff
--- a/src/modules/casecremental/fx/World.ts
+++ b/src/modules/casecremental/fx/World.ts
@@ -54,7 +54,7 @@ export class World {
     this.reel = new ReelView(() => this.sfx.tick(controller.run.state.combo));
     this.bench = new BenchView(controller);
     this.particles = new Particles(dot);
-    this.coins = new Coins(coin);
+    this.coins = new Coins([coin]);
     this.root.addChild(this.bg, this.reel, this.bench, this.particles.container, this.coins.container);
     this.look = new StageLook(this.root);
     app.stage.addChild(this.root);
```

- [ ] **Step 10: Run the tests, typecheck and build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; the build output lists `press-start-2p-latin-400` and `press-start-2p-cyrillic-400` font files (bundled, no Google Fonts request).

- [ ] **Step 11: Commit**

```bash
git add -A src/modules/casecremental package.json package-lock.json
git commit -m "feat(fx): HD layer (lamp, dust, glow, flash), Press Start 2P, GSAP motion presets

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 11: The workbench — room, your bench, pixel reel, World rewrite

**Files:**
- Create: `fx/pixel/anims.ts`, `fx/pixel/Animated.ts`, `fx/pixel/Reel.ts`, `fx/pixel/Room.ts`, `fx/pixel/Bench.ts`, `fx/labels.ts`
- Rewrite: `fx/World.ts`
- Modify: `fx/GameScene.ts` (await `World.create`), `fx/GameScene.test.ts` (fake `World.create`), `fx/juice/shake.ts` (import `Pt`)
- Delete: `fx/BenchView.ts`, `fx/ReelView.ts`, `fx/drag.ts`, `fx/skins/skinTexture.ts`
- Test: `fx/pixel/anims.test.ts`, `fx/pixel/Reel.test.ts`, `fx/labels.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–10; `buildStrip`, `WIN_INDEX` (`fx/reel/strip.ts`), `reelFraction`, `ReelMotion` (`fx/reel/motion.ts`), `restorePlan` (`fx/restore.ts`), `Shake`, `TimeScale`, `StageLook` (`fx/juice`), `Sfx` (`fx/audio.ts`, until Task 13).
- Produces:
  - `ANIMS` (per-prop timelines), `type AnimId`, `ANIM_SPRITE`, `loopLength(keys)`
  - `class Animated { constructor(actor: Actor, idle: readonly Key[], random?); setIdle(keys); play(keys, onEvent?); busy: boolean; update(ms) }`
  - `CARD_W = 30`, `reelPosition(f, rectW, jitter, cardW?): { x; index }`, `makeCard(skins, skin, w, h): Container`, `class Reel extends Container { constructor(frameSet, skins, onTick); layout(rect); start(c, winner, rng); update(motion | null) }`
  - `class Room { back; front; layout(l); parallax(pointer01); update(ms) }`
  - `class Bench { root; layout(l); revealCentre(): Pt; showCase(caseId, dropIn); openCase(); hideCase(); showReveal(skin, drop); clearReveal(sold); pointerDown(p): boolean; pointerMove(p); pointerUp(p); cancelDrag(); update(ms, bench) }`
  - `hintKey(bench, canBrake): StringKey | null`, `revealLines(drop): [string, string]`
  - `class World { static create(app, controller): Promise<World>; timeScale(realSeconds); update(realSeconds, scale); destroy() }`

- [ ] **Step 1: Write the failing tests**

`fx/pixel/anims.test.ts` (frames exist in each sheet, idle loops never share a length, whole-pixel moves):

```ts
import { describe, expect, it } from "vitest";
import manifest from "../../../../../art/manifest.json";
import { ANIM_SPRITE, ANIMS, loopLength, type AnimId } from "./anims";

const framesOf = (sprite: string): number => {
  const ids = sprite.endsWith("*") ? manifest.assets.filter((a) => a.id.startsWith(sprite.slice(0, -1))) : manifest.assets.filter((a) => a.id === sprite);
  expect(ids.length, sprite).toBeGreaterThan(0);
  return Math.min(...ids.map((a) => ("frames" in a && a.frames ? a.frames : 1)));
};

describe("prop animations", () => {
  it.each(Object.keys(ANIMS) as AnimId[])("%s only uses frames its sheet has", (id) => {
    const n = framesOf(ANIM_SPRITE[id]);
    for (const k of ANIMS[id]) expect(k.frame).toBeLessThan(n);
  });

  it("gives every idle loop its own length, so nothing moves in sync", () => {
    const idles: AnimId[] = ["caseIdle", "caseOpenIdle", "keyIdle", "binIdle", "botSleep", "lampSway"];
    const lengths = idles.map((id) => loopLength(ANIMS[id]));
    expect(new Set(lengths).size).toBe(lengths.length);
  });

  it("moves only by whole pixels, at most 9 px", () => {
    for (const keys of Object.values(ANIMS))
      for (const k of keys as readonly { dx?: number; dy?: number }[])
        for (const v of [k.dx ?? 0, k.dy ?? 0]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThanOrEqual(9);
        }
  });
});
```

`fx/pixel/Reel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WIN_INDEX } from "../reel/strip";
import { CARD_W, reelPosition } from "./Reel";

describe("reelPosition", () => {
  it("starts with the strip flush left and moves in whole pixels, never backwards", () => {
    expect(reelPosition(0, 120, 0.2).x).toBe(0);
    let last = Infinity;
    for (let i = 0; i <= 100; i++) {
      const { x } = reelPosition(i / 100, 120, 0.2);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeLessThanOrEqual(last);
      last = x;
    }
  });

  it("lands with the winning card under the marker, off by the jitter", () => {
    for (const jitter of [-0.35, 0, 0.3]) {
      const { x, index } = reelPosition(1, 120, jitter);
      expect(index).toBe(WIN_INDEX);
      const winnerCentre = x + WIN_INDEX * CARD_W + CARD_W / 2;
      expect(Math.abs(winnerCentre - (60 - jitter * CARD_W))).toBeLessThanOrEqual(0.5);
    }
  });
});
```

`fx/labels.test.ts` (Review Focus 2 — the language switches while the card is up):

```ts
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n/index";
import type { Drop } from "../sim/types";
import { hintKey, revealLines } from "./labels";

afterEach(() => setLang("en"));

const DROP: Drop = { id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec", float: 0.05, wear: "FN", statTrak: true, value: 7.5 };

describe("canvas labels", () => {
  it("follows a language switch while the card is up", () => {
    expect(revealLines(DROP)).toEqual(["ST™ AK-Pew | Woodland Drill", "Factory New · $7.50"]);
    setLang("ru");
    expect(revealLines(DROP)).toEqual(["ST™ АК-Пиу | Лесные учения", "С завода · $7,50"]);
  });

  it("hints at the next step, and hides the brake hint when braking isn't possible", () => {
    expect(hintKey({ phase: "empty" }, false)).toBe("hint.buy");
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", drop: DROP }, false)).toBe("hint.sell");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/pixel/anims.test.ts src/modules/casecremental/fx/pixel/Reel.test.ts src/modules/casecremental/fx/labels.test.ts`
Expected: FAIL — cannot resolve `./anims`, `./Reel`, `./labels`.

- [ ] **Step 3: Write `fx/pixel/anims.ts`**

```ts
import type { Key } from "./timeline";

// Every prop's animations (spec §6): an always-on idle loop, reactions and events. Frames index
// the prop's built sheet (art/manifest.json); offsets are whole pixels; idle loops have different
// lengths so nothing moves in sync.

export const ANIMS = {
  // case sheet: 0 closed, 1–2 lid lifting, 3 open
  caseIdle: [{ frame: 0, ms: 1700 }, { frame: 0, ms: 90, dy: -1 }, { frame: 0, ms: 1300 }],
  caseDrop: [
    { frame: 0, ms: 40, dy: -9 },
    { frame: 0, ms: 40, dy: -5 },
    { frame: 0, ms: 50, dy: -2 },
    { frame: 0, ms: 70, dy: 0, event: "land" },
    { frame: 0, ms: 60, dy: -2 },
    { frame: 0, ms: 80, dy: 0 },
  ],
  caseOpen: [
    { frame: 0, ms: 60, dy: 1 },
    { frame: 1, ms: 70, dy: -1 },
    { frame: 2, ms: 80, dy: -1 },
    { frame: 3, ms: 120, dy: 0, event: "open" },
  ],
  caseOpenIdle: [{ frame: 3, ms: 900 }, { frame: 3, ms: 900, dy: -1 }],
  // key sheet: 0 idle, 1 glint, 2–3 turning
  keyIdle: [{ frame: 0, ms: 2300 }, { frame: 1, ms: 80 }, { frame: 0, ms: 80 }, { frame: 1, ms: 80 }, { frame: 0, ms: 1500 }],
  keyReady: [{ frame: 0, ms: 260 }, { frame: 0, ms: 260, dy: -1 }, { frame: 1, ms: 80, dy: -1 }],
  keyTurn: [{ frame: 2, ms: 80 }, { frame: 3, ms: 110, event: "turned" }, { frame: 3, ms: 160 }],
  // sell bin sheet: 0 idle, 1–3 swallowing
  binIdle: [{ frame: 0, ms: 1100 }, { frame: 0, ms: 1100, dy: -1 }],
  binHungry: [{ frame: 0, ms: 220 }, { frame: 1, ms: 120 }, { frame: 0, ms: 220, dy: -1 }],
  binSwallow: [
    { frame: 1, ms: 50 },
    { frame: 2, ms: 60 },
    { frame: 3, ms: 90, event: "swallowed" },
    { frame: 0, ms: 60, dy: 1 },
    { frame: 0, ms: 80, dy: -1 },
    { frame: 0, ms: 60 },
  ],
  coinSpin: [{ frame: 0, ms: 80 }, { frame: 1, ms: 80 }, { frame: 2, ms: 80 }, { frame: 3, ms: 80 }],
  // the sleeping bot breathes (sheet 0–3), eyes shut
  botSleep: [
    { frame: 0, ms: 700, eyes: "closed" },
    { frame: 1, ms: 520, eyes: "closed" },
    { frame: 2, ms: 840, eyes: "closed" },
    { frame: 1, ms: 520, eyes: "closed" },
  ],
  lampSway: [{ frame: 0, ms: 1300 }, { frame: 0, ms: 1250, dx: 1 }, { frame: 0, ms: 1350 }, { frame: 0, ms: 1200, dx: -1 }],
} satisfies Record<string, readonly Key[]>;

export type AnimId = keyof typeof ANIMS;

/** Which sprite sheet each animation plays on. */
export const ANIM_SPRITE: Record<AnimId, string> = {
  caseIdle: "case-*",
  caseDrop: "case-*",
  caseOpen: "case-*",
  caseOpenIdle: "case-*",
  keyIdle: "key",
  keyReady: "key",
  keyTurn: "key",
  binIdle: "sell-bin",
  binHungry: "sell-bin",
  binSwallow: "sell-bin",
  coinSpin: "coin",
  botSleep: "bot-sleep",
  lampSway: "room-lamp",
};

export const loopLength = (keys: readonly Key[]): number => keys.reduce((s, k) => s + k.ms, 0);
```

- [ ] **Step 4: Write `fx/pixel/Animated.ts`**

```ts
import type { Actor } from "./Actor";
import { Blinker } from "./blink";
import { Timeline, type Key } from "./timeline";

// Plays timelines on an actor: an idle loop (started at a random phase, so props never sync) and
// one-shot reactions/events that return to the idle loop when they finish. Actors with code eyes
// blink on their own.

export class Animated {
  private idle: Timeline;
  private current: Timeline;
  private onEvent: ((e: string) => void) | null = null;
  private readonly blinker: Blinker | null;

  constructor(
    readonly actor: Actor,
    idle: readonly Key[],
    random: () => number = Math.random,
  ) {
    this.idle = new Timeline(idle, true);
    this.idle.advance(random() * idle.reduce((s, k) => s + k.ms, 0));
    this.current = this.idle;
    this.blinker = actor.meta.eyes ? new Blinker(random) : null;
    this.actor.show(this.current.pose);
  }

  /** Swap the idle loop (e.g. the bin gets hungry while a skin waits). */
  setIdle(keys: readonly Key[]): void {
    const playingIdle = this.current === this.idle;
    this.idle = new Timeline(keys, true);
    if (playingIdle) this.current = this.idle;
  }

  /** Play a one-shot; its events go to onEvent; then back to idle. */
  play(keys: readonly Key[], onEvent?: (e: string) => void): void {
    this.current = new Timeline(keys);
    this.onEvent = onEvent ?? null;
  }

  get busy(): boolean {
    return this.current !== this.idle;
  }

  update(ms: number): void {
    const events = this.current.advance(ms);
    for (const e of events) this.onEvent?.(e);
    if (this.current.done && this.current !== this.idle) {
      this.current = this.idle;
      this.onEvent = null;
    }
    this.actor.show(this.current.pose, this.blinker?.update(ms) ?? null);
  }
}
```

- [ ] **Step 5: Write `fx/pixel/Reel.ts`**

```ts
import { Container, Graphics, NineSliceSprite, Sprite } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import type { CaseDef, SkinDef } from "../../sim/types";
import { reelFraction, type ReelMotion } from "../reel/motion";
import { buildStrip, WIN_INDEX } from "../reel/strip";
import type { SkinTextures } from "../skins/pixelSkin";
import type { Rect } from "./layout";
import type { SpriteSet } from "./sprites";

// The CS-style reel in the pixel world: a strip of skin cards scrolling under a gold marker in
// whole-pixel steps, landing on the rolled skin a random fraction off-centre. onTick fires each
// time a card passes the marker.

export const CARD_W = 30;
const GAP = 2;

/** Strip offset (whole px) and the card index under the marker at reel progress f (0 → 1). */
export function reelPosition(f: number, rectW: number, jitter: number, cardW = CARD_W): { x: number; index: number } {
  const from = rectW / 2;
  const to = WIN_INDEX * cardW + cardW / 2 + jitter * cardW;
  const p = from + f * (to - from);
  return { x: Math.round(rectW / 2 - p), index: Math.floor(p / cardW) };
}

export function makeCard(skins: SkinTextures, skin: SkinDef, w: number, h: number): Container {
  const color = RARITY_INFO[skin.rarity].color;
  const card = new Container();
  card.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x15161d }).rect(0, 0, w, h).fill({ color, alpha: 0.16 }));
  const art = new Sprite(skins.texture(skin));
  art.position.set(Math.floor((w - art.width) / 2), Math.floor((h - 2 - art.height) / 2));
  card.addChild(art, new Graphics().rect(0, h - 2, w, 2).fill({ color }));
  return card;
}

export class Reel extends Container {
  private readonly frame: NineSliceSprite;
  private readonly strip = new Container();
  private readonly clip = new Graphics();
  private readonly marker = new Graphics();
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private items: SkinDef[] = [];
  private jitter = 0;
  private fraction = 0;
  private lastIndex = -1;

  constructor(
    frameSet: SpriteSet,
    private readonly skins: SkinTextures,
    private readonly onTick: () => void,
  ) {
    super();
    this.frame = new NineSliceSprite({ texture: frameSet.frames[0]!, leftWidth: 6, topHeight: 6, rightWidth: 6, bottomHeight: 6 });
    this.addChild(this.frame, this.strip, this.clip, this.marker);
    this.strip.mask = this.clip;
  }

  layout(rect: Rect): void {
    this.rect = rect;
    this.position.set(rect.x, rect.y);
    this.frame.width = rect.w;
    this.frame.height = rect.h;
    this.clip.clear().rect(3, 3, rect.w - 6, rect.h - 6).fill({ color: 0xffffff });
    const mx = Math.floor(rect.w / 2);
    this.marker.clear().rect(mx, 2, 1, rect.h - 4).fill({ color: 0xffd34d }).rect(mx - 1, 2, 3, 1).fill({ color: 0xffd34d }).rect(mx - 1, rect.h - 3, 3, 1).fill({ color: 0xffd34d });
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** A new spin: a fresh strip that ends on `winner`. */
  start(c: CaseDef, winner: SkinDef, rng: Rng): void {
    this.items = buildStrip(c, winner, rng);
    this.jitter = (rng.next() - 0.5) * 0.7;
    this.fraction = 0;
    this.lastIndex = -1;
    this.rebuild();
    this.place(0, false);
  }

  update(motion: ReelMotion | null): void {
    if (!motion) return;
    this.fraction = reelFraction(motion);
    this.place(this.fraction, true);
  }

  private place(f: number, sound: boolean): void {
    const { x, index } = reelPosition(f, this.rect.w, this.jitter);
    this.strip.x = x;
    if (index !== this.lastIndex) {
      if (sound && this.lastIndex >= 0) this.onTick();
      this.lastIndex = index;
    }
  }

  private rebuild(): void {
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    const h = this.rect.h - 6;
    this.items.forEach((skin, i) => {
      const card = makeCard(this.skins, skin, CARD_W - GAP, h);
      card.position.set(i * CARD_W + GAP / 2, 3);
      this.strip.addChild(card);
    });
  }
}
```

- [ ] **Step 6: Write `fx/pixel/Room.ts`**

```ts
import { Container, Graphics, NineSliceSprite, Sprite, TilingSprite } from "pixi.js";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import type { TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// The room and everything on the table that isn't your bench: the backdrop (wall, back layer,
// shelves — nudged 1–2 px with the pointer for parallax), the swaying lamp, the workbench, the felt
// mat, the claim tray, the powered-off auto-seller and the sleeping bot with its dark reel (spec §3).

const WALL = 0x1b1418;
const WOOD = 0x5a3a22;
const WOOD_DARK = 0x3a2416;
const FELT = 0x1f4d3a;

export class Room {
  readonly back = new Container();
  readonly front = new Container();
  private readonly wall = new Graphics();
  private readonly backdrop: Sprite | null;
  private readonly shelves: Sprite | null;
  private readonly lamp: Animated;
  private readonly tableTop: TilingSprite | null;
  private readonly tableBody = new Graphics();
  private readonly mat: Sprite | null;
  private readonly matFallback = new Graphics();
  private readonly tray: Sprite;
  private readonly seller: Sprite;
  private readonly bot: Animated;
  private readonly botReel: NineSliceSprite;
  private l: TableLayout | null = null;

  constructor(lib: SpriteLibrary) {
    // big backgrounds fall back to flat colour, not a placeholder checkerboard
    const optional = (id: string) => (lib.has(id) ? new Sprite(lib.get(id, { w: 1, h: 1 }).frames[0]) : null);
    this.backdrop = optional("room-back");
    this.shelves = optional("room-shelves");
    this.lamp = new Animated(new Actor(lib.get("room-lamp", { w: 16, h: 40 })), ANIMS.lampSway);
    const table = lib.has("table") ? lib.get("table", { w: 1, h: 1 }).frames[0]! : null;
    this.tableTop = table ? new TilingSprite({ texture: table, width: 1, height: table.height }) : null;
    this.mat = optional("mat");
    this.tray = new Sprite(lib.get("tray", { w: 100, h: 18 }).frames[0]);
    this.seller = new Sprite(lib.get("auto-seller", { w: 24, h: 30 }).frames[0]);
    this.seller.tint = 0x666677; // powered off until M2b
    this.bot = new Animated(new Actor(lib.get("bot-sleep", { w: 40, h: 48, frames: 4 })), ANIMS.botSleep);
    const reelFrame = lib.get("reel-frame", { w: 48, h: 24 }).frames[0]!;
    this.botReel = new NineSliceSprite({ texture: reelFrame, leftWidth: 6, topHeight: 6, rightWidth: 6, bottomHeight: 6 });
    this.botReel.tint = 0x444455;
    for (const s of [this.wall, this.backdrop, this.shelves, this.lamp.actor, this.botReel]) if (s) this.back.addChild(s);
    for (const s of [this.tableBody, this.tableTop, this.matFallback, this.mat, this.tray, this.seller, this.bot.actor]) if (s) this.front.addChild(s);
  }

  layout(l: TableLayout): void {
    this.l = l;
    const t = l.table;
    this.wall.clear().rect(0, 0, l.worldW, l.worldH).fill({ color: WALL });
    this.lamp.actor.place(l.lamp.x, 40);
    const topH = this.tableTop ? this.tableTop.height : 6;
    if (this.tableTop) {
      this.tableTop.position.set(t.x, t.y);
      this.tableTop.width = t.w;
    }
    this.tableBody.clear().rect(t.x, t.y, t.w, topH).fill({ color: WOOD }).rect(t.x, t.y + topH, t.w, t.h - topH).fill({ color: WOOD_DARK });
    const m = l.you.mat;
    if (this.mat) this.mat.position.set(Math.round(m.x + (m.w - this.mat.width) / 2), m.y + m.h - this.mat.height);
    else this.matFallback.clear().rect(m.x, m.y, m.w, m.h).fill({ color: FELT });
    this.tray.position.set(Math.round(l.tray.x + (l.tray.w - this.tray.width) / 2), Math.round(l.tray.y + (l.tray.h - this.tray.height) / 2));
    this.seller.position.set(Math.round(l.seller.x - this.seller.width / 2), l.seller.y - this.seller.height);
    this.bot.actor.place(l.bot.spot.x, l.bot.spot.y);
    this.botReel.visible = !!l.bot.reel;
    if (l.bot.reel) {
      this.botReel.position.set(l.bot.reel.x, l.bot.reel.y);
      this.botReel.width = l.bot.reel.w;
      this.botReel.height = l.bot.reel.h;
    }
    this.parallax(0.5);
  }

  /** Back layers follow the pointer by a pixel or two (0 = left edge, 1 = right edge). */
  parallax(pointer01: number): void {
    const l = this.l;
    if (!l) return;
    const shift = (max: number) => Math.round((pointer01 - 0.5) * 2 * max);
    if (this.backdrop) this.backdrop.position.set(Math.round((l.worldW - this.backdrop.width) / 2) + shift(1), 0);
    if (this.shelves) this.shelves.position.set(Math.round((l.worldW - this.shelves.width) / 2) + shift(2), 0);
  }

  update(ms: number): void {
    this.lamp.update(ms);
    this.bot.update(ms);
  }
}
```

- [ ] **Step 7: Write `fx/pixel/Bench.ts`**

```ts
import { Container, Graphics, Sprite } from "pixi.js";
import type { GameController } from "../../game/controller";
import { RARITY_INFO } from "../../sim/rarity";
import type { Bench as BenchState } from "../../sim/run";
import type { Drop, SkinDef } from "../../sim/types";
import type { SkinTextures } from "../skins/pixelSkin";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import { DragTracker, type Grabbable } from "./drag";
import { ITEM_SIZE, type Pt, type Rect, type TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// Your bench: the case on the mat, the key (drag it into the lock), the revealed skin card (drag
// it into the SELL bin) and the bin. Taps work too; a press anywhere while the reel spins brakes.
// Every change goes through controller.act — the one input path.

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (r: Rect, p: Pt) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export class Bench {
  readonly root = new Container();
  private readonly cases = new Map<string, Animated>();
  private caseId: string | null = null;
  private readonly key: Animated;
  private readonly bin: Animated;
  private readonly card = new Container();
  private readonly drag = new DragTracker();
  private keyAtLock = 0;
  private l: TableLayout | null = null;
  private phase: BenchState["phase"] = "empty";

  constructor(
    private readonly lib: SpriteLibrary,
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
  ) {
    this.key = new Animated(new Actor(lib.get("key", { w: 20, h: 24, frames: 4 })), ANIMS.keyIdle);
    this.bin = new Animated(new Actor(lib.get("sell-bin", { w: 26, h: 38, frames: 4 })), ANIMS.binIdle);
    this.card.visible = false;
    this.root.addChild(this.bin.actor, this.card, this.key.actor);
  }

  layout(l: TableLayout): void {
    this.l = l;
    for (const c of this.cases.values()) c.actor.place(l.you.caseSpot.x, l.you.caseSpot.y);
    this.bin.actor.place(l.bin.x, l.bin.y + l.binR);
    this.homeItems();
  }

  /** World centre of the reveal card (coins and sparks start here). */
  revealCentre(): Pt {
    return this.l ? { ...this.l.you.reveal } : { x: 0, y: 0 };
  }

  showCase(caseId: string, dropIn: boolean): void {
    this.hideCase();
    let a = this.cases.get(caseId);
    if (!a) {
      a = new Animated(new Actor(this.lib.get(`case-${caseId}`, { w: 26, h: 34, frames: 4 })), ANIMS.caseIdle);
      this.cases.set(caseId, a);
      this.root.addChildAt(a.actor, 0);
    }
    a.setIdle(ANIMS.caseIdle);
    if (this.l) a.actor.place(this.l.you.caseSpot.x, this.l.you.caseSpot.y);
    a.actor.visible = true;
    if (dropIn) a.play(ANIMS.caseDrop);
    this.caseId = caseId;
  }

  /** The key turns in the lock and the lid lifts (spinStarted). */
  openCase(): void {
    const c = this.caseId ? this.cases.get(this.caseId) : null;
    c?.setIdle(ANIMS.caseOpenIdle);
    c?.play(ANIMS.caseOpen);
    this.keyAtLock = 450; // ms the key stays in the lock
    this.key.play(ANIMS.keyTurn);
    this.homeItems();
  }

  hideCase(): void {
    for (const c of this.cases.values()) c.actor.visible = false;
    this.caseId = null;
  }

  showReveal(skin: SkinDef, drop: Drop): void {
    for (const child of this.card.removeChildren()) child.destroy({ children: true });
    const { w, h } = ITEM_SIZE.reveal;
    const color = RARITY_INFO[drop.rarity].color;
    const frame = new Graphics()
      .rect(0, 0, w, h).fill({ color: 0x120e10 })
      .rect(1, 1, w - 2, h - 2).fill({ color })
      .rect(2, 2, w - 4, h - 4).fill({ color: 0x15161d });
    const art = new Sprite(this.skins.texture(skin));
    art.position.set(Math.floor((w - art.width) / 2), Math.floor((h - art.height) / 2));
    this.card.addChild(frame, art);
    if (drop.statTrak) this.card.addChild(new Graphics().rect(3, 3, 4, 2).fill({ color: 0xff8a00 }));
    this.card.visible = true;
    this.homeItems();
  }

  /** The card leaves; if it was sold the bin swallows it. */
  clearReveal(sold: boolean): void {
    this.card.visible = false;
    this.hideCase();
    if (sold) this.bin.play(ANIMS.binSwallow);
  }

  // ── input, in world px ──────────────────────────────────────────────────────────────────────

  pointerDown(p: Pt): boolean {
    if (this.drag.down(p, this.grabbables())) return true;
    if (this.phase === "spinning") return this.controller.act({ type: "brake" }).ok;
    if (this.phase === "revealed" && this.l && dist(p, this.l.bin) <= this.l.binR + 2) return this.controller.act({ type: "sell" }).ok;
    return false;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const end = this.drag.up(p);
    const l = this.l;
    if (end.kind === "tap") this.controller.act(end.id === "key" ? { type: "insertKey" } : { type: "sell" });
    if (end.kind === "drop" && l) {
      const lock = { x: l.you.caseSpot.x, y: l.you.caseSpot.y - 10 };
      if (end.id === "key" && (dist(end.at, lock) <= 18 || inside(l.you.mat, end.at))) this.controller.act({ type: "insertKey" });
      if (end.id === "card" && dist(end.at, l.bin) <= l.binR + 8) this.controller.act({ type: "sell" });
    }
    this.homeItems();
  }

  /** The viewport changed under a drag: the item goes home and nothing fires. */
  cancelDrag(): void {
    this.drag.cancel();
    this.homeItems();
  }

  update(ms: number, b: BenchState): void {
    this.phase = b.phase;
    if (this.keyAtLock > 0 && (this.keyAtLock -= ms) <= 0) this.homeItems();
    this.key.setIdle(b.phase === "locked" ? ANIMS.keyReady : ANIMS.keyIdle);
    this.bin.setIdle(b.phase === "revealed" ? ANIMS.binHungry : ANIMS.binIdle);
    const pos = this.drag.position;
    if (pos && this.drag.dragging === "key") {
      const m = this.key.actor.meta;
      this.key.actor.place(pos.x + Math.floor(m.frameW / 2), pos.y + m.ground);
    }
    if (pos && this.drag.dragging === "card") this.card.position.set(pos.x, pos.y);
    for (const c of this.cases.values()) if (c.actor.visible) c.update(ms);
    this.key.update(ms);
    this.bin.update(ms);
    this.key.actor.alpha = b.phase === "locked" || this.keyAtLock > 0 ? 1 : 0.45;
  }

  private grabbables(): Grabbable[] {
    const out: Grabbable[] = [];
    if (this.phase === "locked" && this.keyAtLock <= 0) out.push({ id: "key", rect: this.key.actor.box() });
    if (this.phase === "revealed" && this.card.visible) out.push({ id: "card", rect: this.cardRect() });
    return out;
  }

  private cardRect(): Rect {
    const r = this.revealCentre();
    const { w, h } = ITEM_SIZE.reveal;
    return { x: r.x - w / 2, y: r.y - h / 2, w, h };
  }

  private homeItems(): void {
    const l = this.l;
    if (!l) return;
    if (this.keyAtLock > 0) this.key.actor.place(l.you.caseSpot.x + 2, l.you.caseSpot.y - 6);
    else this.key.actor.place(l.you.keyHome.x, l.you.keyHome.y + 5);
    const c = this.cardRect();
    this.card.position.set(c.x, c.y);
  }
}
```

- [ ] **Step 8: Write `fx/labels.ts`**

```ts
import { skinName, wearName, weaponName } from "../i18n/content";
import { getLang, type StringKey } from "../i18n/index";
import { skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import type { Bench } from "../sim/run";
import type { Drop } from "../sim/types";
import { wearOf } from "../sim/wear";

// Text on the canvas, built from state in the current language every frame — so switching the
// language mid-run (reel spinning, card up) updates it at once (Review Focus 2).

export function hintKey(b: Bench, canBrake: boolean): StringKey | null {
  switch (b.phase) {
    case "empty":
      return "hint.buy";
    case "locked":
      return "hint.key";
    case "spinning":
      return canBrake ? "hint.brake" : null;
    case "revealed":
      return "hint.sell";
  }
}

/** The two lines under the reveal card. */
export function revealLines(d: Drop): [string, string] {
  const skin = skinById(d.skinId);
  const st = d.statTrak ? "ST™ " : "";
  return [`${st}${weaponName(skin.weapon)} | ${skinName(skin.id)}`, `${wearName(wearOf(d.float).id)} · ${formatCash(d.value, getLang())}`];
}
```

- [ ] **Step 9: Rewrite `fx/World.ts`**

```ts
import { Container, Text, type Application, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import { getLang, t } from "../i18n/index";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { Bench as BenchState, SimEvent } from "../sim/run";
import type { Drop } from "../sim/types";
import { Sfx } from "./audio";
import { loadPixelFont, pixelStyle } from "./hd/font";
import { HdLayer } from "./hd/HdLayer";
import { setTweenTimeScale } from "./hd/tween";
import { Shake } from "./juice/shake";
import { StageLook } from "./juice/stageLook";
import { TimeScale } from "./juice/timeScale";
import { hintKey, revealLines } from "./labels";
import { Bench } from "./pixel/Bench";
import { tableLayout, type Pt, type TableLayout } from "./pixel/layout";
import { PixelLayer } from "./pixel/PixelLayer";
import { Reel } from "./pixel/Reel";
import { Room } from "./pixel/Room";
import { hdFontSize, toWorld } from "./pixel/screen";
import { spriteIndex, SpriteLibrary } from "./pixel/sprites";
import { pixelViewport, type PixelViewport } from "./pixel/viewport";
import { restorePlan } from "./restore";
import { loadWeaponBases, SkinTextures } from "./skins/pixelSkin";

// Everything drawn on the canvas (spec §2): the pixel world (room, table, your bench, the reel)
// rendered small and scaled up by a whole number, and the HD layer over it (light, dust, glow,
// sparks, coins, text). Sim events drive the juice: sparks, coins, sound, shake, hit-stop on
// Covert, slow-mo + flash on ★, and the look of the intensity stage.

export class World {
  private readonly scene = new Container();
  private readonly pixel = new PixelLayer();
  private readonly hd: HdLayer;
  private readonly room: Room;
  private readonly bench: Bench;
  private readonly reel: Reel;
  private readonly look: StageLook;
  private readonly shake = new Shake(Math.random, 3);
  private readonly time = new TimeScale();
  private readonly sfx = new Sfx();
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xc8cbd6) });
  private readonly label = [new Text({ text: "", style: pixelStyle(8, 0xffffff) }), new Text({ text: "", style: pixelStyle(8, 0xffffff) })];
  private readonly offline = new Text({ text: "", style: pixelStyle(8, 0x6a6f80) });
  private vp: PixelViewport;
  private l: TableLayout;
  private screen = { w: 0, h: 0 };
  private lastStage = 1;
  private readonly off: () => void;
  private readonly unlockAudio = () => this.sfx.unlock();

  static async create(app: Application, controller: GameController): Promise<World> {
    await loadPixelFont();
    const lib = await SpriteLibrary.load();
    const bases = await loadWeaponBases(spriteIndex());
    return new World(app, controller, lib, new SkinTextures(bases));
  }

  private constructor(
    private readonly app: Application,
    private readonly controller: GameController,
    private readonly lib: SpriteLibrary,
    private readonly skins: SkinTextures,
  ) {
    this.room = new Room(lib);
    this.bench = new Bench(lib, skins, controller);
    this.reel = new Reel(lib.get("reel-frame", { w: 48, h: 24 }), skins, () => this.sfx.tick(controller.run.state.combo));
    this.hd = new HdLayer(lib.get("coin", { w: 12, h: 22, frames: 4 }).frames);
    this.pixel.world.addChild(this.room.back, this.room.front, this.reel, this.bench.root);
    this.hd.root.addChild(this.hint, ...this.label, this.offline);
    for (const txt of [this.hint, ...this.label, this.offline]) txt.anchor.set(0.5, 0);
    this.scene.addChild(this.pixel.view, this.hd.root);
    this.look = new StageLook(this.scene);
    app.stage.addChild(this.scene);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e: FederatedPointerEvent) => void this.bench.pointerDown(this.worldPt(e)));
    app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.bench.pointerMove(this.worldPt(e));
      this.room.parallax(Math.min(1, Math.max(0, e.global.x / Math.max(1, this.screen.w))));
    });
    app.stage.on("pointerup", (e: FederatedPointerEvent) => this.bench.pointerUp(this.worldPt(e)));
    app.stage.on("pointerupoutside", (e: FederatedPointerEvent) => this.bench.pointerUp(this.worldPt(e)));
    window.addEventListener("pointerdown", this.unlockAudio);
    this.off = controller.onEvent((e) => this.onEvent(e));

    this.vp = pixelViewport(app.screen.width, app.screen.height);
    this.l = tableLayout(this.vp);
    this.applyLayout();
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.restore();
  }

  /** Redraw a run already in progress (the scene is rebuilt after a trip to the lobby). */
  private restore(): void {
    const plan = restorePlan(this.controller.run.state);
    if (plan.caseId) this.bench.showCase(plan.caseId, false);
    if (plan.spinning) {
      this.reel.start(caseById(plan.spinning.caseId), skinById(plan.spinning.skinId), this.rng);
      this.bench.openCase();
    }
    if (plan.revealed) {
      this.bench.showReveal(skinById(plan.revealed.skinId), plan.revealed);
      this.hd.setGlow(RARITY_INFO[plan.revealed.rarity].color);
    }
    this.look.setStage(plan.stage);
    this.lastStage = plan.stage;
  }

  /** Real seconds → this frame's game-time scale (0 during hit-stop, <1 in slow-mo). */
  timeScale(realSeconds: number): number {
    return this.time.update(realSeconds);
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.screen.w || height !== this.screen.h) {
      this.bench.cancelDrag(); // Review Focus 3: a resize or rotation mid-drag cancels it
      this.vp = pixelViewport(width, height);
      this.l = tableLayout(this.vp);
      this.applyLayout();
    }
    const gameMs = realSeconds * scale * 1000;
    const run = this.controller.run;
    const b = run.state.bench;
    this.reel.update(b.phase === "spinning" ? b : null);
    this.bench.update(gameMs, b);
    this.room.update(realSeconds * 1000);
    this.hd.update(realSeconds);
    this.look.update(realSeconds);
    setTweenTimeScale(scale);
    this.updateText(b, run.canBrake());

    const k = this.vp.scale;
    const s = this.shake.update(realSeconds);
    this.pixel.setOffset(s.x * k, s.y * k);
    this.hd.root.position.set(Math.round(s.x * k), Math.round(s.y * k));
    this.pixel.render(this.app.renderer);
  }

  destroy(): void {
    this.off();
    window.removeEventListener("pointerdown", this.unlockAudio);
    this.app.stage.removeAllListeners();
    this.hd.destroy();
    this.pixel.destroy();
    this.scene.destroy({ children: true });
    this.skins.destroy();
    this.lib.destroy();
    this.sfx.dispose();
  }

  private worldPt(e: FederatedPointerEvent): Pt {
    return toWorld(this.vp, e.global.x, e.global.y);
  }

  private applyLayout(): void {
    const { width, height } = this.app.screen;
    this.screen = { w: width, h: height };
    this.pixel.resize(this.vp);
    this.room.layout(this.l);
    this.bench.layout(this.l);
    this.reel.layout(this.l.you.reel);
    this.hd.layout(this.l, this.vp, width, height);
    const k = this.vp.scale;
    const size = hdFontSize(k);
    for (const txt of [this.hint, ...this.label, this.offline]) txt.style.fontSize = size;
    const r = this.l.you.reel;
    this.hint.position.set((r.x + r.w / 2) * k, (r.y + r.h + 2) * k);
    const card = this.l.you.reveal;
    this.label[0]!.position.set(card.x * k, (card.y + 16) * k);
    this.label[1]!.position.set(card.x * k, (card.y + 16) * k + size * 1.5);
    const br = this.l.bot.reel;
    this.offline.visible = !!br;
    if (br) this.offline.position.set((br.x + br.w / 2) * k, (br.y + br.h / 2) * k - size / 2);
  }

  /** Strings are rebuilt every frame from state, so a language switch shows at once (Review Focus 2). */
  private updateText(b: BenchState, canBrake: boolean): void {
    const key = hintKey(b, canBrake);
    const hint = key ? t(key) : "";
    if (this.hint.text !== hint) this.hint.text = hint;
    const lines = b.phase === "revealed" ? revealLines(b.drop) : ["", ""];
    lines.forEach((text, i) => {
      if (this.label[i]!.text !== text) this.label[i]!.text = text;
    });
    if (b.phase === "revealed") this.label[1]!.style.fill = RARITY_INFO[b.drop.rarity].color;
    const off = t("station.offline");
    if (this.offline.text !== off) this.offline.text = off;
  }

  private screenPt(p: Pt): Pt {
    return this.hd.toScreen(p);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(e.caseId, true);
        this.sfx.click();
        break;
      case "spinStarted":
        this.bench.openCase();
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        this.sfx.click();
        break;
      case "braked":
        this.shake.add(0.12);
        this.sfx.thump(0.35);
        break;
      case "revealed":
        this.onReveal(e.drop);
        break;
      case "sold": {
        const at = this.screenPt(this.bench.revealCentre());
        this.hd.coins.burst(at, { x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }, e.amount);
        this.hd.coins.floatText({ x: at.x, y: at.y - 10 * this.vp.scale }, `+${formatCash(e.amount, getLang())}`);
        this.hd.setGlow(null);
        this.sfx.coin(e.combo);
        this.bench.clearReveal(true);
        break;
      }
      case "caseUnlocked":
      case "upgradeBought":
        this.sfx.click();
        break;
      case "stageChanged":
        this.look.setStage(e.stage);
        if (e.stage > this.lastStage) {
          this.shake.add(0.3);
          this.hd.flash(0xff7ad9, 0.35);
          this.sfx.stageUp();
        }
        this.lastStage = e.stage;
        break;
    }
  }

  private onReveal(d: Drop): void {
    this.bench.showReveal(skinById(d.skinId), d);
    const at = this.screenPt(this.bench.revealCentre());
    const color = RARITY_INFO[d.rarity].color;
    const v = this.vp.scale / 6; // spark speeds were tuned at scale 6 (1080p)
    this.hd.setGlow(color);
    this.sfx.reveal(RARITY_ORDER.indexOf(d.rarity));
    switch (d.rarity) {
      case "milspec":
        this.hd.particles.burst(at, color, 10, 140 * v);
        break;
      case "restricted":
        this.hd.particles.burst(at, color, 24, 220 * v);
        break;
      case "classified":
        this.hd.particles.burst(at, color, 45, 300 * v);
        this.shake.add(0.2);
        break;
      case "covert":
        this.time.hitStop(0.08);
        this.shake.add(0.55);
        this.sfx.thump(1);
        this.hd.particles.burst(at, color, 90, 420 * v);
        break;
      case "gold":
        this.time.slowMo(0.2, 2.2, 0.7);
        this.shake.add(0.8);
        this.hd.flash(0xffd700, 0.7);
        this.sfx.jackpot();
        this.hd.particles.burst(at, color, 220, 520 * v);
        break;
    }
  }
}
```

- [ ] **Step 10: Load before the first frame in `fx/GameScene.ts`, and fake `World.create` in its test**

```diff
--- a/src/modules/casecremental/fx/GameScene.ts
+++ b/src/modules/casecremental/fx/GameScene.ts
@@ -40,15 +40,18 @@ export function createGameScene(controller: GameController): EngineScene {
           autoDensity: true,
           resolution: canvasResolution(window.devicePixelRatio),
         })
-        .then(() => {
+        // sprites, skins and the pixel font load before the first frame
+        .then(() => (app === a ? World.create(a, controller) : null))
+        .then((w) => {
           if (app !== a) {
-            // destroyed (or remounted) while init was running: tear down now that it is safe
+            // destroyed (or remounted) while loading: tear down now that it is safe
+            w?.destroy();
             a.destroy(true);
             return;
           }
           appReady = true;
           host.appendChild(a.canvas);
-          world = new World(a, controller);
+          world = w;
           a.ticker.add(tick);
           if (!running) a.ticker.stop();
           controller.mounted = true;
```

```diff
--- a/src/modules/casecremental/fx/GameScene.test.ts
+++ b/src/modules/casecremental/fx/GameScene.test.ts
@@ -29,6 +29,9 @@ const fake = vi.hoisted(() => {
     }
   }
   class FakeWorld {
+    static async create(): Promise<FakeWorld> {
+      return new FakeWorld();
+    }
     constructor() {
       worlds.push(this);
     }
```

and in `fx/juice/shake.ts`:

```diff
--- a/src/modules/casecremental/fx/juice/shake.ts
+++ b/src/modules/casecremental/fx/juice/shake.ts
@@ -1,4 +1,4 @@
-import type { Point } from "../layout";
+import type { Pt as Point } from "../pixel/layout";
 
 // Trauma-based screen shake: events add trauma (0..1), the offset grows with trauma² and the
 // trauma decays linearly — small hits barely move, big ones rattle.
```

- [ ] **Step 11: Delete the replaced views**

Run: `git rm src/modules/casecremental/fx/BenchView.ts src/modules/casecremental/fx/ReelView.ts src/modules/casecremental/fx/drag.ts src/modules/casecremental/fx/skins/skinTexture.ts`
(`fx/layout.ts` stays until Task 12 — the old HUD and shop still import it.)

- [ ] **Step 12: Run the tests, typecheck and build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds.

- [ ] **Browser check**

Run `npm run dev` and open http://localhost:5180 in Chrome (the user signs in with "Play as guest" — never sign in for them). With DevTools device mode, look at 1920×1080, 800×450 and 390×844:
- the room, table, mat, case, key, bin, tray, seller and sleeping bot sit where the layout puts them; pixels are square and sharp (no blur) at every size;
- drag the key into the case → the key turns, the lid lifts, the reel scrolls in whole-pixel steps; click to brake; the card pops up with its two lines; drag it to SELL → the bin swallows it, coins fly to the top centre, gold "+$" floats up;
- resize the window mid-drag → the item snaps home and nothing happens (Review Focus 3);
- the lamp light flickers, dust drifts, the bot breathes with "z" floating up, the seller's LED blinks; nothing is ever completely still.
(The old HUD and shop still cover parts of the screen until Task 12.)
Fix what is off before committing (keep the tests green). Missing art shows as magenta checkerboards — that is expected until Task 3's sprites exist.

- [ ] **Step 13: Commit**

```bash
git add -A src/modules/casecremental package.json package-lock.json
git commit -m "feat(fx): pixel workbench - room, bench, pixel reel and the two-layer World

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 12: The UI re-skin — HUD, Upgrades board, Case shelf, phone drawer, Settings

**Files:**
- Create: `ui/prefs.ts`, `ui/pixelFrame.ts`, `ui/styles.ts`, `ui/hooks.ts`, `ui/parts.tsx`, `ui/UpgradesBoard.tsx`, `ui/CaseShelf.tsx`, `ui/Drawer.tsx`, `ui/Settings.tsx`
- Rewrite: `ui/Hud.tsx`, `ui/GamePanel.tsx`
- Modify: `module.ts` (`initPrefs()` in setup)
- Delete: `ui/Shop.tsx`, `fx/layout.ts`, `fx/layout.test.ts`
- Test: `ui/prefs.test.ts`, `ui/pixelFrame.test.ts`

**Interfaces:**
- Consumes: `t`, `getLang`, `onLangChange`, `setLang`, `detectLang` (Task 4); content names (Task 5); `pixelViewport`, `tableLayout` (Task 6); `spriteIndex`, `SpriteMeta` (Task 7); `hdFontSize` (Task 9); `PIXEL_FONT`, `springElement`, `popElement` (Task 10); `GameView`, `Action` (existing).
- Produces:
  - `interface Prefs { lang: Lang | null; music: number; sfx: number }`, `PREFS_KEY`, `DEFAULT_PREFS`, `parsePrefs(raw)`, `initPrefs(store?, languages?)`, `getPrefs()`, `setPrefs(patch)`, `onPrefsChange(fn)`
  - `FRAME_SLICE`, `frameCss(url, scale)`, `uiSpriteUrl(id)`, `stripFrameCss(entry, frame, scale)`, `buttonImages()`
  - `useLang()`, `usePrefs()`, `usePixelUi(ref): { vp; l; fs } | null`, `useButtonImages()`
  - `UiEnvContext` (`{ scale; skinnedButtons }` — Task 13 adds `click`), `PxButton`, `Bar`, `Panel`
  - `makeGamePanel(controller): ComponentType`

- [ ] **Step 1: Write the failing tests**

`ui/prefs.test.ts` (blocked or corrupt storage never breaks the game):

```ts
import { afterEach, describe, expect, it } from "vitest";
import { getLang, setLang } from "../i18n/index";
import { DEFAULT_PREFS, getPrefs, initPrefs, parsePrefs, PREFS_KEY, setPrefs } from "./prefs";

afterEach(() => setLang("en"));

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const broken = {
  getItem: (): string | null => {
    throw new Error("SecurityError");
  },
  setItem: (): void => {
    throw new Error("QuotaExceededError");
  },
};

describe("prefs", () => {
  it("cleans up whatever was stored", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{not json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"lang":"de","music":7,"sfx":"loud"}')).toEqual({ lang: null, music: 1, sfx: DEFAULT_PREFS.sfx });
    expect(parsePrefs('{"lang":"ru","music":0.2,"sfx":0}')).toEqual({ lang: "ru", music: 0.2, sfx: 0 });
  });

  it("follows the browser language until the player picks one", () => {
    initPrefs(memory(), ["ru-RU"]);
    expect(getLang()).toBe("ru");
    const s = memory();
    s.setItem(PREFS_KEY, '{"lang":"en"}');
    initPrefs(s, ["ru-RU"]);
    expect(getLang()).toBe("en");
  });

  it("remembers changes", () => {
    const s = memory();
    initPrefs(s, ["en"]);
    setPrefs({ lang: "ru", music: 0.3 });
    expect(getLang()).toBe("ru");
    expect(parsePrefs(s.getItem(PREFS_KEY))).toEqual({ lang: "ru", music: 0.3, sfx: DEFAULT_PREFS.sfx });
  });

  it("keeps working when storage is blocked", () => {
    expect(() => initPrefs(broken, ["en"])).not.toThrow();
    expect(() => setPrefs({ sfx: 0.1 })).not.toThrow();
    expect(getPrefs().sfx).toBe(0.1);
    expect(() => initPrefs(null, [])).not.toThrow();
  });
});
```

`ui/pixelFrame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { frameCss, stripFrameCss } from "./pixelFrame";

describe("pixel frames", () => {
  it("9-slices the frame art at the pixel scale", () => {
    const css = frameCss("/f.png", 4);
    expect(css.borderImage).toBe('url("/f.png") 6 fill / 24px stretch');
    expect(css.borderWidth).toBe(24);
    expect(css.imageRendering).toBe("pixelated");
  });

  it("falls back to a flat pixel bevel without the art", () => {
    const css = frameCss(null, 2);
    expect(css.borderImage).toBeUndefined();
    expect(css.border).toBe("4px solid #4a3328");
  });

  it("shows one frame of a strip", () => {
    const meta = { id: "case", frames: 4, frameW: 26, frameH: 34, ground: 32, eyes: null };
    expect(stripFrameCss({ meta, url: "/c.png" }, 2, 3)).toMatchObject({ width: 78, height: 102, backgroundSize: "312px 102px", backgroundPosition: "-156px 0" });
    expect(stripFrameCss(undefined, 0, 3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/ui`
Expected: FAIL — cannot resolve `./prefs`, `./pixelFrame`.

- [ ] **Step 3: Write `ui/prefs.ts`**

```ts
import { detectLang, setLang, type Lang } from "../i18n/index";

// Per-player conveniences remembered in this browser (spec §8): language and the two volumes.
// Storage may be missing, full or blocked (private windows, embeds) — then the defaults apply and
// the game carries on.

export interface Prefs {
  /** null = follow the browser language. */
  lang: Lang | null;
  music: number;
  sfx: number;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export const PREFS_KEY = "casecremental:prefs";
export const DEFAULT_PREFS: Prefs = { lang: null, music: 0.6, sfx: 0.8 };

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Whatever was stored → valid prefs (unknown fields dropped, bad values replaced by defaults). */
export function parsePrefs(raw: string | null): Prefs {
  let o: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") o = parsed as Record<string, unknown>;
  } catch {
    // corrupt value: start from the defaults
  }
  return {
    lang: o.lang === "en" || o.lang === "ru" ? o.lang : null,
    music: clamp01(o.music, DEFAULT_PREFS.music),
    sfx: clamp01(o.sfx, DEFAULT_PREFS.sfx),
  };
}

function browserStore(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

let current: Prefs = DEFAULT_PREFS;
let store: Store | null = null;
const listeners = new Set<() => void>();

/** Read the stored prefs and apply the language. Call once in the module's setup. */
export function initPrefs(s: Store | null = browserStore(), languages: readonly string[] = typeof navigator !== "undefined" ? navigator.languages : []): Prefs {
  store = s;
  let raw: string | null = null;
  try {
    raw = s?.getItem(PREFS_KEY) ?? null;
  } catch {
    raw = null;
  }
  current = parsePrefs(raw);
  setLang(current.lang ?? detectLang(languages));
  return current;
}

export const getPrefs = (): Prefs => current;

export function setPrefs(patch: Partial<Prefs>): void {
  current = parsePrefs(JSON.stringify({ ...current, ...patch }));
  if (current.lang) setLang(current.lang);
  try {
    store?.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    // not remembered this time; the change still applies
  }
  for (const fn of listeners) fn();
}

export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

- [ ] **Step 4: Write `ui/pixelFrame.ts`**

```ts
import type { CSSProperties } from "react";
import { spriteIndex, type SpriteMeta } from "../fx/pixel/sprites";

// Pixel-art 9-slice frames for the DOM panels (spec §2): the ui-frame sprite as a CSS border-image
// at the pixel world's integer scale, and the 3-state ui-button sheet sliced into per-state images.
// Without the art, a flat pixel bevel in the same palette stands in.

export const FRAME_SLICE = 6;
export const BUTTON_SLICE = 4;

export function frameCss(url: string | null, scale: number): CSSProperties {
  if (!url)
    return {
      background: "#1d1517",
      border: `${2 * scale}px solid #4a3328`,
      boxShadow: `0 0 0 ${scale}px #120e10, inset 0 0 0 ${scale}px #120e10`,
    };
  return {
    borderStyle: "solid",
    borderWidth: FRAME_SLICE * scale,
    borderImage: `url("${url}") ${FRAME_SLICE} fill / ${FRAME_SLICE * scale}px stretch`,
    imageRendering: "pixelated",
  };
}

export const uiSpriteUrl = (id: string): string | null => spriteIndex().get(id)?.url ?? null;

/** One frame of a sprite strip as CSS background (the case icons on the shelf). */
export function stripFrameCss(entry: { meta: SpriteMeta; url: string } | undefined, frame: number, scale: number): CSSProperties | null {
  if (!entry) return null;
  const { meta, url } = entry;
  return {
    width: meta.frameW * scale,
    height: meta.frameH * scale,
    backgroundImage: `url("${url}")`,
    backgroundSize: `${meta.frames * meta.frameW * scale}px ${meta.frameH * scale}px`,
    backgroundPosition: `${-frame * meta.frameW * scale}px 0`,
    imageRendering: "pixelated",
  };
}

/** Slice the ui-button sheet (normal / hover / pressed) into data URLs for border-image. */
export async function buttonImages(): Promise<string[] | null> {
  const entry = spriteIndex().get("ui-button");
  if (!entry || typeof document === "undefined") return null;
  const img = new Image();
  img.src = entry.url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const { frameW, frameH, frames } = entry.meta;
  return Array.from({ length: frames }, (_, i) => {
    const c = document.createElement("canvas");
    c.width = frameW;
    c.height = frameH;
    c.getContext("2d")!.drawImage(img, i * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
    return c.toDataURL();
  });
}
```

- [ ] **Step 5: Write `ui/styles.ts`**

```ts
import { PIXEL_FONT } from "../fx/hd/font";

// The overlay's stylesheet. Sizes come from two CSS variables set on the root: --px (the pixel
// world's integer scale) and --fs (the text size, a multiple of 8). Buttons use the sliced
// ui-button art when it exists (--btn-normal / --btn-hover / --btn-pressed), else a pixel bevel.

export const UI_CSS = `
.cc-root { font-family: ${PIXEL_FONT}; color: #f2e9dc; font-size: var(--fs); line-height: 1.5; -webkit-font-smoothing: none; }
.cc-root * { box-sizing: border-box; }
.cc-panel { position: absolute; pointer-events: auto; display: flex; flex-direction: column; gap: calc(var(--px) * 3px); overflow: hidden; }
.cc-title { color: #ffd34d; text-align: center; text-shadow: 0 calc(var(--px) * 1px) 0 #120e10; }
.cc-dim { color: #a89a8c; }
.cc-scroll { overflow-y: auto; display: flex; flex-direction: column; gap: calc(var(--px) * 3px); min-height: 0; }
.cc-row { display: grid; gap: calc(var(--px) * 1px); padding: calc(var(--px) * 2px); background: rgba(18, 14, 16, 0.55); box-shadow: 0 0 0 var(--px) #120e10 inset; }
.cc-row-line { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--px) * 2px); }
.cc-btn { font: inherit; color: #fff6d5; background: #8a4b2a; border: 0; cursor: pointer; white-space: nowrap;
  padding: calc(var(--px) * 2px) calc(var(--px) * 3px);
  box-shadow: inset 0 calc(var(--px) * -2px) 0 #4a2416, inset 0 var(--px) 0 #c27a4a, 0 0 0 var(--px) #120e10; }
.cc-btn.skinned { background: none; box-shadow: none; border-style: solid; border-width: calc(var(--px) * 4px);
  border-image: var(--btn-normal) 4 fill / calc(var(--px) * 4px) stretch; image-rendering: pixelated; padding: 0 calc(var(--px) * 1px); }
.cc-btn:hover:not(:disabled) { filter: brightness(1.15); }
.cc-btn.skinned:hover:not(:disabled) { filter: none; border-image-source: var(--btn-hover); }
.cc-btn:active:not(:disabled) { transform: translateY(calc(var(--px) * 1px)); }
.cc-btn.skinned:active:not(:disabled) { border-image-source: var(--btn-pressed); }
.cc-btn:disabled { filter: grayscale(1) brightness(0.55); cursor: default; }
.cc-btn.on { color: #120e10; background: #ffd34d; }
.cc-tabs { display: flex; gap: calc(var(--px) * 1px); }
.cc-tabs .cc-btn { flex: 1; padding-left: 0; padding-right: 0; }
.cc-bar { height: calc(var(--px) * 3px); background: #120e10; box-shadow: 0 0 0 var(--px) #120e10; }
.cc-bar > div { height: 100%; background: #ffd34d; transition: width .2s steps(6); }
.cc-bar.done > div { background: #3ddc84; }
.cc-gold { background: linear-gradient(#fff3b0, #ffd34d 55%, #c98a12); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 calc(var(--px) * 1px) 0 #120e10); }
.cc-modal { position: absolute; inset: 0; pointer-events: auto; display: grid; place-items: center; background: rgba(7, 8, 12, 0.6); }
.cc-slider { width: 100%; accent-color: #ffd34d; }
`;
```

- [ ] **Step 6: Write `ui/hooks.ts`**

```ts
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { tableLayout, type TableLayout } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";
import { pixelViewport, type PixelViewport } from "../fx/pixel/viewport";
import { getLang, onLangChange, type Lang } from "../i18n/index";
import { getPrefs, onPrefsChange, type Prefs } from "./prefs";
import { buttonImages } from "./pixelFrame";

/** Re-render on a language switch (strings are read through t() during render). */
export const useLang = (): Lang => useSyncExternalStore(onLangChange, getLang);

export const usePrefs = (): Prefs => useSyncExternalStore(onPrefsChange, getPrefs);

export interface PixelUi {
  vp: PixelViewport;
  l: TableLayout;
  /** Text size in CSS px (a multiple of 8). */
  fs: number;
}

/** The same viewport and table layout the canvas uses, from the overlay's own size. */
export function usePixelUi(ref: RefObject<HTMLElement | null>): PixelUi | null {
  const [ui, setUi] = useState<PixelUi | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const vp = pixelViewport(width, height);
      setUi({ vp, l: tableLayout(vp), fs: hdFontSize(vp.scale) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return ui;
}

/** The ui-button sheet sliced into normal / hover / pressed images (null until ready or missing). */
export function useButtonImages(): string[] | null {
  const [images, setImages] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void buttonImages().then((imgs) => alive && setImages(imgs));
    return () => {
      alive = false;
    };
  }, []);
  return images;
}
```

- [ ] **Step 7: Write `ui/parts.tsx`**

```tsx
import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from "react";
import { springElement } from "../fx/hd/tween";
import type { Rect } from "../fx/pixel/layout";
import { frameCss, uiSpriteUrl } from "./pixelFrame";

// Small building blocks shared by the panels: a pixel button that presses in and springs back,
// a progress bar, and a framed panel placed over a world-pixel rect.

export interface UiEnv {
  scale: number;
  /** The ui-button art was sliced and applied (CSS variables on the root). */
  skinnedButtons: boolean;
}

export const UiEnvContext = createContext<UiEnv>({ scale: 1, skinnedButtons: false });

export function PxButton(props: { onClick?: () => void; disabled?: boolean; on?: boolean; children: ReactNode; style?: CSSProperties; title?: string }): ReactNode {
  const env = useContext(UiEnvContext);
  const ref = useRef<HTMLButtonElement>(null);
  const cls = ["cc-btn", env.skinnedButtons ? "skinned" : "", props.on ? "on" : ""].filter(Boolean).join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      disabled={props.disabled}
      aria-pressed={props.on}
      title={props.title}
      style={props.style}
      onClick={() => {
        if (ref.current) springElement(ref.current);
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Bar({ progress }: { progress: number }): ReactNode {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={p >= 1 ? "cc-bar done" : "cc-bar"}>
      <div style={{ width: `${Math.round(p * 100)}%` }} />
    </div>
  );
}

/** A framed panel over a rect given in world px. */
export function Panel({ rect, children, style }: { rect: Rect; children: ReactNode; style?: CSSProperties }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  return (
    <div
      className="cc-panel"
      style={{
        left: rect.x * scale,
        top: rect.y * scale,
        width: rect.w * scale,
        height: rect.h * scale,
        padding: 2 * scale,
        ...frameCss(uiSpriteUrl("ui-frame"), scale),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 8: Write `ui/UpgradesBoard.tsx`**

```tsx
import { useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { GameView, UpgradeView } from "../game/view";
import { upgradeDesc, upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { PxButton } from "./parts";

// The Upgrades board (left panel, or a drawer tab on phones). Tabs You / Bot / Machines; the bot
// and the machines arrive in later runs, so their tabs show LOCKED for now.

type Act = (a: Action) => void;
type Tab = "you" | "bot" | "machines";

function UpgradeRow({ u, act }: { u: UpgradeView; act: Act }): ReactNode {
  return (
    <div className="cc-row">
      <div className="cc-row-line">
        <span>{upgradeName(u.id)}</span>
        <span className="cc-dim">{t("label.level", { n: u.level })}</span>
      </div>
      <div className="cc-dim">{upgradeDesc(u.id)}</div>
      {u.cost === null ? (
        <PxButton disabled>{t("btn.max")}</PxButton>
      ) : (
        <PxButton disabled={!u.canBuy} onClick={() => act({ type: "buyUpgrade", id: u.id })}>
          {formatCash(u.cost, getLang())}
        </PxButton>
      )}
    </div>
  );
}

export function UpgradesBoard({ view, act, title = true }: { view: GameView; act: Act; title?: boolean }): ReactNode {
  const [tab, setTab] = useState<Tab>("you");
  const tabs: Array<[Tab, string]> = [["you", t("tab.you")], ["bot", t("tab.bot")], ["machines", t("tab.machines")]];
  return (
    <>
      {title ? <div className="cc-title">{t("panel.upgrades")}</div> : null}
      <div className="cc-tabs">
        {tabs.map(([id, label]) => (
          <PxButton key={id} on={tab === id} disabled={id !== "you"} title={id !== "you" ? t("tab.locked") : undefined} onClick={() => setTab(id)}>
            {label}
          </PxButton>
        ))}
      </div>
      <div className="cc-scroll">
        {tab === "you" ? view.upgrades.map((u) => <UpgradeRow key={u.id} u={u} act={act} />) : <div className="cc-dim">{t("tab.locked")}</div>}
      </div>
    </>
  );
}
```

- [ ] **Step 9: Write `ui/CaseShelf.tsx`**

```tsx
import { useContext, type ReactNode } from "react";
import { spriteIndex } from "../fx/pixel/sprites";
import type { Action } from "../game/controller";
import type { CaseView, GameView } from "../game/view";
import { caseName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { PxButton, UiEnvContext } from "./parts";
import { stripFrameCss } from "./pixelFrame";

// The Case shelf (right panel, or a drawer tab on phones): each case with its pixel box, BUY at
// its price or UNLOCK at its unlock cost. Every button sends an Action through the controller.

type Act = (a: Action) => void;

function CaseIcon({ c }: { c: CaseView }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const k = Math.max(1, Math.floor(scale / 2));
  const css = stripFrameCss(spriteIndex().get(`case-${c.id}`), 0, k);
  const style = css ?? { width: 13 * k, height: 10 * k, background: c.color, boxShadow: `0 0 0 ${k}px #120e10` };
  return <div style={{ ...style, flex: "none", opacity: c.unlocked ? 1 : 0.4 }} />;
}

function CaseRow({ c, act }: { c: CaseView; act: Act }): ReactNode {
  return (
    <div className="cc-row">
      <div className="cc-row-line">
        <CaseIcon c={c} />
        <span style={{ flex: 1 }}>{caseName(c.id)}</span>
      </div>
      {c.unlocked ? (
        <PxButton disabled={!c.canBuy} onClick={() => act({ type: "buyCase", caseId: c.id })}>
          {t("btn.buy")} {formatCash(c.price, getLang())}
        </PxButton>
      ) : (
        <PxButton disabled={!c.canUnlock} onClick={() => act({ type: "unlockCase", caseId: c.id })}>
          {t("btn.unlock")} {formatCash(c.unlockCost, getLang())}
        </PxButton>
      )}
    </div>
  );
}

export function CaseShelf({ view, act, title = true }: { view: GameView; act: Act; title?: boolean }): ReactNode {
  return (
    <>
      {title ? <div className="cc-title">{t("panel.cases")}</div> : null}
      <div className="cc-scroll">
        {view.cases.map((c) => (
          <CaseRow key={c.id} c={c} act={act} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 10: Rewrite `ui/Hud.tsx`**

```tsx
import { useContext, useEffect, useRef, type ReactNode } from "react";
import { useAnimatedNumber } from "@idosgames/react/ui";
import { springElement } from "../fx/hd/tween";
import type { GameView } from "../game/view";
import { caseName, stageName, upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { Bar, PxButton, UiEnvContext } from "./parts";

// Top of the screen: the stage, the cash (large, gold), the combo, the next goal (always visible —
// spec §9.2) and the settings button. Height = the layout's HUD band.

function goalName(goal: NonNullable<GameView["nextGoal"]>): string {
  return goal.kind === "unlock" ? caseName(goal.caseId) : `${upgradeName(goal.upgradeId)} ${t("label.level", { n: goal.level })}`;
}

export function Hud({ view, hudH, onSettings }: { view: GameView; hudH: number; onSettings: () => void }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const shown = useAnimatedNumber(view.cash, 350);
  const cashRef = useRef<HTMLDivElement>(null);
  const previous = useRef(view.cash);
  useEffect(() => {
    if (view.cash > previous.current && cashRef.current) springElement(cashRef.current, 0.08);
    previous.current = view.cash;
  }, [view.cash]);
  const lang = getLang();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: hudH * scale,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "start",
        padding: `${scale}px ${3 * scale}px`,
        pointerEvents: "none",
      }}
    >
      <div style={{ color: view.stage >= 2 ? "#ff7ad9" : "#a89a8c" }}>{stageName(view.stage)}</div>
      <div style={{ display: "grid", justifyItems: "center", gap: scale }}>
        <div ref={cashRef} className="cc-gold" style={{ fontSize: "calc(var(--fs) * 2)" }}>
          {formatCash(shown, lang)}
        </div>
        {view.nextGoal ? (
          <div style={{ display: "grid", gap: scale, width: "max-content", minWidth: "50%" }}>
            <div className="cc-dim">{t("hud.next", { name: goalName(view.nextGoal) })}</div>
            <Bar progress={view.nextGoal.progress} />
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "start", gap: 2 * scale }}>
        {view.combo > 1 ? <span style={{ color: "#7affc1" }}>{t("hud.combo", { mult: view.comboMult.toFixed(2).replace(".", lang === "ru" ? "," : ".") })}</span> : null}
        <span style={{ pointerEvents: "auto" }}>
          <PxButton onClick={onSettings} title={t("hud.settings")}>
            ⚙
          </PxButton>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Write `ui/Settings.tsx`**

```tsx
import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import { t } from "../i18n/index";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { PxButton, UiEnvContext } from "./parts";
import { setPrefs } from "./prefs";
import { useLang, usePrefs } from "./hooks";

// Settings: language (EN / RU, remembered) and the music and sound volumes.

export function Settings({ onClose }: { onClose: () => void }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const prefs = usePrefs();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) popElement(box.current);
  }, []);
  const slider = (label: string, value: number, set: (v: number) => void) => (
    <label style={{ display: "grid", gap: scale }}>
      <span>{label}</span>
      <input className="cc-slider" type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => set(Number(e.target.value) / 100)} />
    </label>
  );
  return (
    <div className="cc-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-label={t("settings.title")} style={{ display: "grid", gap: 4 * scale, padding: 4 * scale, minWidth: "min(80vw, 22em)", ...frameCss(uiSpriteUrl("ui-frame"), scale) }}>
        <div className="cc-title">{t("settings.title")}</div>
        <div style={{ display: "grid", gap: scale }}>
          <span>{t("settings.language")}</span>
          <div className="cc-tabs">
            <PxButton on={lang === "en"} onClick={() => setPrefs({ lang: "en" })}>
              EN
            </PxButton>
            <PxButton on={lang === "ru"} onClick={() => setPrefs({ lang: "ru" })}>
              RU
            </PxButton>
          </div>
        </div>
        {slider(t("settings.music"), prefs.music, (music) => setPrefs({ music }))}
        {slider(t("settings.sfx"), prefs.sfx, (sfx) => setPrefs({ sfx }))}
        <PxButton onClick={onClose}>{t("settings.close")}</PxButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Write `ui/Drawer.tsx`**

```tsx
import { useContext, useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { GameView } from "../game/view";
import { t } from "../i18n/index";
import { CaseShelf } from "./CaseShelf";
import { PxButton, UiEnvContext } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { UpgradesBoard } from "./UpgradesBoard";

// Phones (portrait): the pixel world fills the top 60 %; the Case shelf and the Upgrades board
// share a drawer below it as two tabs (spec §3.2).

type Act = (a: Action) => void;

export function Drawer({ view, act, top }: { view: GameView; act: Act; top: number }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const [tab, setTab] = useState<"cases" | "upgrades">("cases");
  return (
    <div
      className="cc-panel"
      style={{
        left: 0,
        right: 0,
        top,
        bottom: 0,
        padding: 2 * scale,
        paddingBottom: `calc(${2 * scale}px + var(--idos-safe-bottom, 0px))`,
        ...frameCss(uiSpriteUrl("ui-frame"), scale),
      }}
    >
      <div className="cc-tabs">
        <PxButton on={tab === "cases"} onClick={() => setTab("cases")}>
          {t("panel.cases")}
        </PxButton>
        <PxButton on={tab === "upgrades"} onClick={() => setTab("upgrades")}>
          {t("panel.upgrades")}
        </PxButton>
      </div>
      {tab === "cases" ? <CaseShelf view={view} act={act} title={false} /> : <UpgradesBoard view={view} act={act} title={false} />}
    </div>
  );
}
```

- [ ] **Step 13: Rewrite `ui/GamePanel.tsx`**

```tsx
import { useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { GameController } from "../game/controller";
import { CaseShelf } from "./CaseShelf";
import { Drawer } from "./Drawer";
import { useButtonImages, useLang, usePixelUi } from "./hooks";
import { Hud } from "./Hud";
import { comboTint } from "./juice";
import { Panel, UiEnvContext } from "./parts";
import { Settings } from "./Settings";
import { UI_CSS } from "./styles";
import { UpgradesBoard } from "./UpgradesBoard";
import { useGameView } from "./useGameView";

// The overlay over the canvas, laid out on the same world-pixel grid as the pixel world: HUD on
// top, Upgrades board left and Case shelf right (or a drawer on phones), Settings on demand. The
// layer lets pointer events through to the canvas; only the panels take them.

export function makeGamePanel(controller: GameController): ComponentType {
  const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    useLang(); // re-render every string on a language switch
    const root = useRef<HTMLDivElement>(null);
    const ui = usePixelUi(root);
    const buttons = useButtonImages();
    const [settings, setSettings] = useState(false);
    const tint = comboTint(view.combo);
    const scale = ui?.vp.scale ?? 1;
    const vars = {
      "--px": scale,
      "--fs": `${ui?.fs ?? 8}px`,
      ...(buttons && buttons.length >= 3 ? { "--btn-normal": `url("${buttons[0]}")`, "--btn-hover": `url("${buttons[1]}")`, "--btn-pressed": `url("${buttons[2]}")` } : {}),
    } as CSSProperties;
    return (
      <div ref={root} className="cc-root" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...vars }}>
        <style>{UI_CSS}</style>
        <div style={{ position: "absolute", inset: 0, background: `hsla(${tint.hue}, 100%, 55%, ${tint.alpha})`, mixBlendMode: "screen", transition: "background .4s" }} />
        {ui ? (
          <UiEnvContext.Provider value={{ scale, skinnedButtons: !!buttons && buttons.length >= 3 }}>
            <Hud view={view} hudH={ui.l.hudH} onSettings={() => setSettings(true)} />
            {ui.l.panelL ? (
              <Panel rect={ui.l.panelL}>
                <UpgradesBoard view={view} act={act} />
              </Panel>
            ) : null}
            {ui.l.panelR ? (
              <Panel rect={ui.l.panelR}>
                <CaseShelf view={view} act={act} />
              </Panel>
            ) : null}
            {ui.vp.portrait ? <Drawer view={view} act={act} top={ui.vp.areaH} /> : null}
            {settings ? <Settings onClose={() => setSettings(false)} /> : null}
          </UiEnvContext.Provider>
        ) : null}
      </div>
    );
  };
}
```

- [ ] **Step 14: Apply the remembered language at startup in `module.ts`**

```diff
--- a/src/modules/casecremental/module.ts
+++ b/src/modules/casecremental/module.ts
@@ -3,6 +3,7 @@ import { createAgentApi } from "./game/agent";
 import { GameController } from "./game/controller";
 import { createGameScene } from "./fx/GameScene";
 import { makeGamePanel } from "./ui/GamePanel";
+import { initPrefs } from "./ui/prefs";
 
 // Casecremental: a Scritchy Scratchy-style incremental where the scratch ticket is a weapon case.
 // One controller for the session; the Pixi scene renders it, the React panel draws HUD and shop,
@@ -17,6 +18,7 @@ export const casecrementalModule: Module = defineModule({
     engine: "dom",
   },
   setup(ctx) {
+    initPrefs(); // language (remembered, else the browser's) and volumes
     const controller = new GameController();
     ctx.registerScene(createGameScene(controller));
     ctx.registerPanel({ id: "game", slot: "overlay", component: makeGamePanel(controller) });
```

- [ ] **Step 15: Delete the old shop and layout**

Run: `git rm src/modules/casecremental/ui/Shop.tsx src/modules/casecremental/fx/layout.ts src/modules/casecremental/fx/layout.test.ts`

- [ ] **Step 16: Run the tests, typecheck and build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds; `grep -rn "fx/layout\"" src` finds nothing.

- [ ] **Browser check**

Run `npm run dev` and open http://localhost:5180 in Chrome (the user signs in with "Play as guest" — never sign in for them). With DevTools device mode, look at 1920×1080, 800×450 and 390×844:
- desktop: Upgrades board left, Case shelf right, HUD on top, all in Press Start 2P, frames lined up with the pixel grid; buttons press in and spring back; buying, unlocking and upgrading work;
- 390×844: the pixel world fills the top 60 %, the drawer below has CASES / UPGRADES tabs;
- Settings: switch EN ↔ RU while the reel spins and while a card is up — every string, the cash ("$12,3K") and the card lines change at once (Review Focus 2); reload — the language is remembered;
- no request goes to fonts.googleapis.com (DevTools → Network).
Fix what is off before committing (keep the tests green). Missing art shows as magenta checkerboards — that is expected until Task 3's sprites exist.

- [ ] **Step 17: Commit**

```bash
git add -A src/modules/casecremental package.json package-lock.json
git commit -m "feat(ui): pixel-framed HUD, Upgrades board, Case shelf, phone drawer and EN/RU settings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 13: The audio engine

**Files:**
- Create: `fx/audio/schedule.ts`, `fx/audio/sounds.ts`, `fx/audio/AudioEngine.ts`
- Modify: `fx/World.ts`, `fx/GameScene.ts`, `fx/GameScene.test.ts`, `module.ts`, `ui/parts.tsx`, `ui/GamePanel.tsx`
- Delete: `fx/audio.ts` (the M1 synth)
- Test: `fx/audio/schedule.test.ts`, `fx/audio/AudioEngine.test.ts`

**Interfaces:**
- Consumes: `getPrefs`, `onPrefsChange` (Task 12); `UiEnvContext` (Task 12); `World.create` (Task 11).
- Produces:
  - `MUSIC_BPM = 120`, `BEATS_PER_BAR = 4`, `pickVariant(count, last, random)`, `jitter(random): { rate; gain }`, `comboPitch(combo)`, `barSeconds()`, `nextBar(now, startedAt, bpm?)`, `crossfade(progress): [out, in]`, `musicFor(stage, available): number | null`
  - `SOUNDS` (id → bus, gain), `type SoundId`, `indexAudio(urls): { sfx: Map<SoundId, string[]>; music: Map<number, string> }`
  - `class AudioEngine { constructor(urls?, deps?); ready: Promise<void>; unlock(); setVolumes(music, sfx); play(id, { rate?, gain?, delay? }?); duck(seconds, depth?); setStage(stage); setMusicOn(on); dispose() }`, `type Ctx`, `interface AudioDeps { createContext; load; random }`
  - `createGameScene(controller, audio)`, `makeGamePanel(controller, audio)`, `World.create(app, controller, audio)`; `UiEnv.click`

- [ ] **Step 1: Write the failing tests**

`fx/audio/schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { barSeconds, comboPitch, crossfade, jitter, musicFor, nextBar, pickVariant } from "./schedule";

describe("mixer schedule", () => {
  it("never repeats a variant back to back", () => {
    let r = 0;
    const random = () => (r = (r + 0.37) % 1);
    let last = -1;
    for (let i = 0; i < 200; i++) {
      const v = pickVariant(4, last, random);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      expect(v).not.toBe(last);
      last = v;
    }
    expect(pickVariant(1, 0, Math.random)).toBe(0);
  });

  it("jitters pitch by at most 4 % and level by at most 2 dB", () => {
    for (const x of [0, 0.5, 0.999]) {
      const j = jitter(() => x);
      expect(Math.abs(j.rate - 1)).toBeLessThanOrEqual(0.04 + 1e-9);
      expect(Math.abs(20 * Math.log10(j.gain))).toBeLessThanOrEqual(2.0001);
    }
  });

  it("raises the pitch with the combo, capped at an octave", () => {
    expect(comboPitch(1)).toBe(1);
    expect(comboPitch(5)).toBeCloseTo(2 ** (1 / 12));
    expect(comboPitch(1000)).toBeCloseTo(2);
  });

  it("changes music on bar lines", () => {
    expect(barSeconds()).toBe(2);
    expect(nextBar(10, 3)).toBe(11);
    expect(nextBar(11, 3)).toBe(11);
    expect(nextBar(1, 3)).toBe(3);
  });

  it("crossfades at equal power", () => {
    expect(crossfade(0)).toEqual([1, 0]);
    const [a, b] = crossfade(0.5);
    expect(a * a + b * b).toBeCloseTo(1);
  });

  it("uses the nearest lower stage loop until a stage has its own", () => {
    expect(musicFor(1, [1, 2])).toBe(1);
    expect(musicFor(4, [1, 2])).toBe(2);
    expect(musicFor(1, [])).toBeNull();
  });
});
```

`fx/audio/AudioEngine.test.ts` (Review Focus 4 — no AudioContext, blocked autoplay, a file that won't decode):

```ts
import { describe, expect, it } from "vitest";
import { AudioEngine, type AudioDeps, type Ctx } from "./AudioEngine";
import { indexAudio } from "./sounds";

const URLS = {
  "/a/reel-tick-1.mp3": "tick1",
  "/a/reel-tick-2.mp3": "tick2",
  "/a/coin-clink-1.mp3": "coin1",
  "/a/music-1.mp3": "m1",
  "/a/music-2.mp3": "m2",
  "/a/not-a-sound-1.mp3": "junk",
};

/** Just enough of an AudioContext to count what starts. */
function fakeContext(state: AudioContextState = "running", failDecode: (url: string) => boolean = () => false) {
  const started: Array<{ url: string; rate: number; loop: boolean }> = [];
  const param = () => ({ value: 1, setTargetAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, setValueAtTime() {} });
  const node = () => ({ gain: param(), connect: (n: unknown) => n });
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    createGain: node,
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBufferSource: () => {
      const s = {
        buffer: null as { url: string } | null,
        loop: false,
        playbackRate: param(),
        connect: (n: unknown) => n,
        start: () => started.push({ url: s.buffer!.url, rate: s.playbackRate.value, loop: s.loop }),
        stop() {},
      };
      return s;
    },
    decodeAudioData: async (data: ArrayBuffer) => {
      const url = new TextDecoder().decode(data);
      if (failDecode(url)) throw new DOMException("EncodingError");
      return { url };
    },
    resume: async () => {},
    close: async () => {},
  };
  return { ctx: ctx as unknown as Ctx, started };
}

const deps = (ctx: Ctx | null, random = () => 0.5): AudioDeps => ({
  createContext: () => ctx,
  load: async (url) => new TextEncoder().encode(url).buffer as ArrayBuffer,
  random,
});

describe("indexAudio", () => {
  it("groups variants and stage loops, ignoring unknown files", () => {
    const files = indexAudio(URLS);
    expect(files.sfx.get("reel-tick")).toEqual(["tick1", "tick2"]);
    expect([...files.music.keys()]).toEqual([1, 2]);
    expect(files.sfx.size).toBe(2);
  });
});

describe("AudioEngine", () => {
  it("plays variants with jitter and the combo pitch once unlocked", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.play("reel-tick"); // before unlock: silent
    a.unlock();
    await a.ready;
    a.play("reel-tick", { rate: 2 });
    a.play("reel-tick");
    const ticks = started.filter((s) => s.url.startsWith("tick"));
    expect(ticks.map((s) => s.url)).toEqual(["tick1", "tick2"]);
    expect(ticks[0]!.rate).toBeCloseTo(2);
  });

  it("starts the stage loop and falls back to the nearest lower stage", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.setStage(4);
    a.unlock();
    await a.ready;
    expect(started.filter((s) => s.loop).map((s) => s.url)).toEqual(["m2"]);
  });

  it("stays silent without an AudioContext (Review Focus 4)", () => {
    const a = new AudioEngine(URLS, deps(null));
    expect(() => {
      a.unlock();
      a.play("coin-clink");
      a.duck(1);
      a.setStage(2);
      a.setVolumes(0.1, 0.1);
      a.dispose();
    }).not.toThrow();
  });

  it("stays silent while autoplay is blocked", async () => {
    const { ctx, started } = fakeContext("suspended");
    const a = new AudioEngine(URLS, deps(ctx));
    a.unlock();
    await a.ready;
    a.play("coin-clink");
    expect(started.filter((s) => !s.loop)).toHaveLength(0);
  });

  it("skips a file that won't decode and plays the rest", async () => {
    const { ctx, started } = fakeContext("running", (url) => url === "/a/coin-clink-1.mp3" || url === "coin1");
    const a = new AudioEngine(URLS, deps(ctx));
    a.unlock();
    await a.ready;
    expect(() => a.play("coin-clink")).not.toThrow();
    a.play("reel-tick");
    expect(started.filter((s) => !s.loop).map((s) => s.url)).toEqual(["tick1"]);
  });

  it("survives a context that throws on creation", () => {
    const a = new AudioEngine(URLS, {
      ...deps(null),
      createContext: () => {
        throw new Error("NotAllowedError");
      },
    });
    expect(() => a.unlock()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/audio`
Expected: FAIL — cannot resolve `./schedule`, `./AudioEngine`, `./sounds`.

- [ ] **Step 3: Write `fx/audio/schedule.ts`**

```ts
// Pure timing and variation for the mixer (spec §9): which variant plays, the per-play pitch and
// level jitter, the combo's rising pitch, bar-aligned music changes and equal-power crossfades.

/** All stage loops share this tempo and a 4/4 bar, so they can swap on bar lines. */
export const MUSIC_BPM = 120;
export const BEATS_PER_BAR = 4;

/** A random variant, never the same one twice in a row when there is a choice. */
export function pickVariant(count: number, last: number, random: () => number): number {
  if (count <= 1) return 0;
  const i = Math.floor(random() * (count - 1));
  return i >= last && last >= 0 ? i + 1 : i;
}

/** ±4 % pitch and ±2 dB level per play, so repeats never sound identical. */
export function jitter(random: () => number): { rate: number; gain: number } {
  const rate = 1 + (random() * 2 - 1) * 0.04;
  const db = (random() * 2 - 1) * 2;
  return { rate, gain: 10 ** (db / 20) };
}

/** Coins and reel ticks climb with the combo: a semitone every 4 combo, up to an octave. */
export function comboPitch(combo: number): number {
  const steps = Math.min(12, Math.max(0, combo - 1) / 4);
  return 2 ** (steps / 12);
}

export const barSeconds = (bpm = MUSIC_BPM, beats = BEATS_PER_BAR): number => (60 / bpm) * beats;

/** The first bar line at or after `now` for music that started at `startedAt`. */
export function nextBar(now: number, startedAt: number, bpm = MUSIC_BPM): number {
  const bar = barSeconds(bpm);
  if (now <= startedAt) return startedAt;
  return startedAt + Math.ceil((now - startedAt) / bar - 1e-9) * bar;
}

/** Equal-power crossfade: [outgoing, incoming] gains at progress 0..1. */
export function crossfade(progress: number): [number, number] {
  const p = Math.min(1, Math.max(0, progress));
  return [Math.cos((p * Math.PI) / 2), Math.sin((p * Math.PI) / 2)];
}

/** The loop for an intensity stage: the stage's own, else the nearest lower one that exists. */
export function musicFor(stage: number, available: readonly number[]): number | null {
  const lower = available.filter((s) => s <= stage);
  return lower.length ? Math.max(...lower) : null;
}
```

- [ ] **Step 4: Write `fx/audio/sounds.ts`**

```ts
// The game's sounds (spec §9): every effect, its bus and level, and how many generated variants it
// has. Files live in assets/audio as <id>-<n>.mp3 (variants) and music-<stage>.mp3 (loops); a
// sound with no files yet simply stays silent.

export type Bus = "sfx" | "ui";

export const SOUNDS = {
  "case-latch": { bus: "sfx", gain: 0.8 },
  "key-turn": { bus: "sfx", gain: 0.8 },
  "lid-creak": { bus: "sfx", gain: 0.6 },
  "reel-tick": { bus: "sfx", gain: 0.35 },
  "brake-thud": { bus: "sfx", gain: 0.9 },
  "reveal-chime": { bus: "sfx", gain: 0.7 },
  "covert-impact": { bus: "sfx", gain: 1 },
  "jackpot-swell": { bus: "sfx", gain: 1 },
  "coin-clink": { bus: "sfx", gain: 0.55 },
  "coin-cascade": { bus: "sfx", gain: 0.8 },
  "cash-register": { bus: "sfx", gain: 0.7 },
  "stage-whoosh": { bus: "sfx", gain: 0.8 },
  "bot-servo": { bus: "sfx", gain: 0.6 },
  "bot-beep": { bus: "sfx", gain: 0.5 },
  "ui-click": { bus: "ui", gain: 0.6 },
  "panel-open": { bus: "ui", gain: 0.6 },
} as const satisfies Record<string, { bus: Bus; gain: number }>;

export type SoundId = keyof typeof SOUNDS;

export interface AudioFiles {
  /** variant URLs per sound */
  sfx: Map<SoundId, string[]>;
  /** loop URL per intensity stage */
  music: Map<number, string>;
}

/** Group file URLs by name: "reel-tick-2.mp3" → reel-tick variant, "music-1.mp3" → stage 1 loop. */
export function indexAudio(urls: Record<string, string>): AudioFiles {
  const sfx = new Map<SoundId, string[]>();
  const music = new Map<number, string>();
  for (const [path, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
    const name = path.split("/").pop()!.replace(/\.mp3$/, "");
    const stage = /^music-(\d+)$/.exec(name);
    if (stage) {
      music.set(Number(stage[1]), url);
      continue;
    }
    const id = name.replace(/-\d+$/, "");
    if (id in SOUNDS) sfx.set(id as SoundId, [...(sfx.get(id as SoundId) ?? []), url]);
  }
  return { sfx, music };
}
```

- [ ] **Step 5: Write `fx/audio/AudioEngine.ts`**

```ts
import { barSeconds, crossfade, jitter, musicFor, nextBar, pickVariant } from "./schedule";
import { indexAudio, SOUNDS, type AudioFiles, type SoundId } from "./sounds";

// The mixer (spec §9): music / SFX / UI buses into a limiter, music that swaps on bar lines when the
// stage changes and ducks under big reveals, per-play pitch and level jitter. Audio unlocks on the
// first user gesture. Anything missing — no AudioContext, autoplay blocked, a file that won't load
// or decode — leaves that sound silent and the game running (Review Focus 4).

const FILES = import.meta.glob("../../assets/audio/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export interface PlayOptions {
  /** Pitch multiplier on top of the jitter (combo pitch, rarity). */
  rate?: number;
  gain?: number;
  /** Seconds from now. */
  delay?: number;
}

export type Ctx = Pick<AudioContext, "createGain" | "createBufferSource" | "createDynamicsCompressor" | "decodeAudioData" | "currentTime" | "destination" | "state" | "resume" | "close">;

export interface AudioDeps {
  createContext: () => Ctx | null;
  load: (url: string) => Promise<ArrayBuffer>;
  random: () => number;
}

const browserDeps: AudioDeps = {
  createContext: () => {
    const AC = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    try {
      return AC ? new AC() : null;
    } catch {
      return null;
    }
  },
  load: async (url) => (await fetch(url)).arrayBuffer(),
  random: Math.random,
};

interface Loop {
  stage: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioEngine {
  private ctx: Ctx | null = null;
  private buses: { music: GainNode; sfx: GainNode; ui: GainNode; duck: GainNode } | null = null;
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly last = new Map<SoundId, number>();
  private readonly files: AudioFiles;
  private volumes = { music: 0.6, sfx: 0.8 };
  private loop: Loop | null = null;
  private loopStartedAt = 0;
  private wantStage = 1;
  private musicOn = true;
  /** Resolves when every file has loaded (or failed to). */
  ready: Promise<void> = Promise.resolve();

  constructor(
    urls: Record<string, string> = FILES,
    private readonly deps: AudioDeps = browserDeps,
  ) {
    this.files = indexAudio(urls);
  }

  /** Call from a user gesture. Safe to call often; does nothing once running. */
  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = this.deps.createContext();
        if (!this.ctx) return;
        this.buildBuses(this.ctx);
        this.ready = this.preload();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      this.updateMusic();
    } catch {
      this.ctx = null;
      this.buses = null;
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.volumes = { music, sfx };
    const b = this.buses;
    if (!b || !this.ctx) return;
    b.music.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
    b.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    b.ui.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  play(id: SoundId, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b || ctx.state !== "running") return;
    const urls = this.files.sfx.get(id);
    if (!urls?.length) return;
    const v = pickVariant(urls.length, this.last.get(id) ?? -1, this.deps.random);
    this.last.set(id, v);
    const buffer = this.buffers.get(urls[v]!);
    if (!buffer) return;
    try {
      const j = jitter(this.deps.random);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = j.rate * (opts.rate ?? 1);
      const g = ctx.createGain();
      g.gain.value = SOUNDS[id].gain * j.gain * (opts.gain ?? 1);
      src.connect(g).connect(SOUNDS[id].bus === "ui" ? b.ui : b.sfx);
      src.start(ctx.currentTime + (opts.delay ?? 0));
    } catch {
      // a node failed to start: skip this one sound
    }
  }

  /** Music under a big moment: down quickly, back up after `seconds`. */
  duck(seconds: number, depth = 0.35): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b) return;
    const now = ctx.currentTime;
    b.duck.gain.cancelScheduledValues(now);
    b.duck.gain.setTargetAtTime(depth, now, 0.03);
    b.duck.gain.setTargetAtTime(1, now + seconds, 0.4);
  }

  /** The intensity stage changed: swap loops on the next bar line. */
  setStage(stage: number): void {
    this.wantStage = stage;
    this.updateMusic();
  }

  /** The scene was suspended (lobby) or resumed. */
  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (!on) this.stopLoop(0.3);
    else this.updateMusic();
  }

  dispose(): void {
    this.stopLoop(0);
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.buses = null;
  }

  private buildBuses(ctx: Ctx): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    const bus = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const duck = bus(1);
    const music = bus(this.volumes.music);
    music.connect(duck).connect(limiter);
    const sfx = bus(this.volumes.sfx);
    sfx.connect(limiter);
    const ui = bus(this.volumes.sfx);
    ui.connect(limiter);
    this.buses = { music, sfx, ui, duck };
  }

  private async preload(): Promise<void> {
    const urls = [...this.files.music.values(), ...[...this.files.sfx.values()].flat()];
    await Promise.all(urls.map((u) => this.loadBuffer(u)));
    this.updateMusic();
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return this.buffers.get(url) ?? null;
    this.buffers.set(url, null);
    try {
      const ctx = this.ctx;
      if (!ctx) return null;
      const buffer = await ctx.decodeAudioData(await this.deps.load(url));
      this.buffers.set(url, buffer);
      return buffer;
    } catch {
      return null; // stays silent
    }
  }

  private updateMusic(): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b || !this.musicOn) return;
    const stage = musicFor(this.wantStage, [...this.files.music.keys()]);
    if (stage === null || this.loop?.stage === stage) return;
    const buffer = this.buffers.get(this.files.music.get(stage)!);
    if (!buffer) return; // not decoded yet — preload() calls again when it is
    try {
      const at = this.loop ? nextBar(ctx.currentTime, this.loopStartedAt) : ctx.currentTime;
      const fade = this.loop ? barSeconds() : 0.5;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, at);
      source.connect(gain).connect(b.music);
      source.start(at);
      const steps = 8;
      for (let i = 1; i <= steps; i++) gain.gain.linearRampToValueAtTime(crossfade(i / steps)[1], at + (fade * i) / steps);
      if (this.loop) {
        const old = this.loop.gain;
        old.gain.setValueAtTime(old.gain.value, at);
        for (let i = 1; i <= steps; i++) old.gain.linearRampToValueAtTime(crossfade(i / steps)[0], at + (fade * i) / steps);
        this.loop.source.stop(at + fade + 0.05);
      }
      this.loopStartedAt = at;
      this.loop = { stage, source, gain };
    } catch {
      // music is optional
    }
  }

  private stopLoop(fade: number): void {
    const l = this.loop;
    const ctx = this.ctx;
    this.loop = null;
    if (!l || !ctx) return;
    try {
      l.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
      l.source.stop(ctx.currentTime + fade + 0.05);
    } catch {
      // already stopped
    }
  }
}
```

- [ ] **Step 6: One engine for the session in `module.ts`** (it outlives the scene; volumes follow Settings; first gesture unlocks)

```diff
--- a/src/modules/casecremental/module.ts
+++ b/src/modules/casecremental/module.ts
@@ -1,9 +1,10 @@
 import { defineModule, type Module } from "@idosgames/module-sdk";
 import { createAgentApi } from "./game/agent";
 import { GameController } from "./game/controller";
+import { AudioEngine } from "./fx/audio/AudioEngine";
 import { createGameScene } from "./fx/GameScene";
 import { makeGamePanel } from "./ui/GamePanel";
-import { initPrefs } from "./ui/prefs";
+import { getPrefs, initPrefs, onPrefsChange } from "./ui/prefs";
 
 // Casecremental: a Scritchy Scratchy-style incremental where the scratch ticket is a weapon case.
 // One controller for the session; the Pixi scene renders it, the React panel draws HUD and shop,
@@ -19,9 +20,17 @@ export const casecrementalModule: Module = defineModule({
   },
   setup(ctx) {
     initPrefs(); // language (remembered, else the browser's) and volumes
+    // one mixer for the session: it outlives the scene (a trip to the lobby only pauses the music)
+    const audio = new AudioEngine();
+    const applyVolumes = () => audio.setVolumes(getPrefs().music, getPrefs().sfx);
+    applyVolumes();
+    onPrefsChange(applyVolumes);
+    // browsers start audio only after a user gesture
+    window.addEventListener("pointerdown", () => audio.unlock());
+    window.addEventListener("keydown", () => audio.unlock());
     const controller = new GameController();
-    ctx.registerScene(createGameScene(controller));
-    ctx.registerPanel({ id: "game", slot: "overlay", component: makeGamePanel(controller) });
+    ctx.registerScene(createGameScene(controller, audio));
+    ctx.registerPanel({ id: "game", slot: "overlay", component: makeGamePanel(controller, audio) });
     ctx.registerRoute({ id: "casecremental", label: "Casecremental", icon: "📦" });
     ctx.exposeToAgent(createAgentApi(controller));
   },
```

- [ ] **Step 7: The scene pauses music while suspended — `fx/GameScene.ts` and its test**

```diff
--- a/src/modules/casecremental/fx/GameScene.ts
+++ b/src/modules/casecremental/fx/GameScene.ts
@@ -1,13 +1,14 @@
 import { Application, type Ticker } from "pixi.js";
 import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
 import type { GameController } from "../game/controller";
+import type { AudioEngine } from "./audio/AudioEngine";
 import { canvasResolution } from "./pixel/screen";
 import { World } from "./World";
 
 // The Pixi scene the host's Mode Router drives: created on mount, ticking only while active
 // (suspend stops the ticker), destroyed for good on destroy.
 
-export function createGameScene(controller: GameController): EngineScene {
+export function createGameScene(controller: GameController, audio: AudioEngine): EngineScene {
   let app: Application | null = null;
   let world: World | null = null;
   let ready: Promise<void> = Promise.resolve();
@@ -41,7 +42,7 @@ export function createGameScene(controller: GameController): EngineScene {
           resolution: canvasResolution(window.devicePixelRatio),
         })
         // sprites, skins and the pixel font load before the first frame
-        .then(() => (app === a ? World.create(a, controller) : null))
+        .then(() => (app === a ? World.create(a, controller, audio) : null))
         .then((w) => {
           if (app !== a) {
             // destroyed (or remounted) while loading: tear down now that it is safe
@@ -64,11 +65,13 @@ export function createGameScene(controller: GameController): EngineScene {
     activate() {
       running = true;
       controller.running = true;
+      audio.setMusicOn(true);
       app?.ticker?.start();
     },
     suspend() {
       running = false;
       controller.running = false;
+      audio.setMusicOn(false);
       app?.ticker?.stop();
     },
     destroy() {
```

```diff
--- a/src/modules/casecremental/fx/GameScene.test.ts
+++ b/src/modules/casecremental/fx/GameScene.test.ts
@@ -48,6 +48,8 @@ vi.mock("pixi.js", () => ({ Application: fake.FakeApplication }));
 vi.mock("./World", () => ({ World: fake.FakeWorld }));
 
 const { createGameScene } = await import("./GameScene");
+const { AudioEngine } = await import("./audio/AudioEngine");
+const silent = () => new AudioEngine({}, { createContext: () => null, load: async () => new ArrayBuffer(0), random: Math.random });
 
 describe("GameScene mount / destroy", () => {
   beforeEach(() => {
@@ -59,7 +61,7 @@ describe("GameScene mount / destroy", () => {
 
   it("mounts a World once Pixi is ready", async () => {
     const controller = new GameController(1);
-    const scene = createGameScene(controller);
+    const scene = createGameScene(controller, silent());
     const host = { appendChild: vi.fn() };
     scene.mount({ host: host as unknown as HTMLElement });
     fake.apps[0]!.resolveInit();
@@ -71,7 +73,7 @@ describe("GameScene mount / destroy", () => {
 
   it("survives destroy during init and tears the app down once init finishes", async () => {
     const controller = new GameController(1);
-    const scene = createGameScene(controller);
+    const scene = createGameScene(controller, silent());
     const host = { appendChild: vi.fn() };
     scene.mount({ host: host as unknown as HTMLElement });
     const pending = scene.ready?.();
```

- [ ] **Step 8: Game events play the generated sounds — `fx/World.ts`**

```diff
--- a/src/modules/casecremental/fx/World.ts
+++ b/src/modules/casecremental/fx/World.ts
@@ -7,7 +7,8 @@ import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
 import { createRng } from "../sim/rng";
 import type { Bench as BenchState, SimEvent } from "../sim/run";
 import type { Drop } from "../sim/types";
-import { Sfx } from "./audio";
+import type { AudioEngine } from "./audio/AudioEngine";
+import { comboPitch } from "./audio/schedule";
 import { loadPixelFont, pixelStyle } from "./hd/font";
 import { HdLayer } from "./hd/HdLayer";
 import { setTweenTimeScale } from "./hd/tween";
@@ -41,7 +42,6 @@ export class World {
   private readonly look: StageLook;
   private readonly shake = new Shake(Math.random, 3);
   private readonly time = new TimeScale();
-  private readonly sfx = new Sfx();
   /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
   private readonly rng = createRng(0x5eed);
   private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xc8cbd6) });
@@ -52,24 +52,24 @@ export class World {
   private screen = { w: 0, h: 0 };
   private lastStage = 1;
   private readonly off: () => void;
-  private readonly unlockAudio = () => this.sfx.unlock();
 
-  static async create(app: Application, controller: GameController): Promise<World> {
+  static async create(app: Application, controller: GameController, audio: AudioEngine): Promise<World> {
     await loadPixelFont();
     const lib = await SpriteLibrary.load();
     const bases = await loadWeaponBases(spriteIndex());
-    return new World(app, controller, lib, new SkinTextures(bases));
+    return new World(app, controller, audio, lib, new SkinTextures(bases));
   }
 
   private constructor(
     private readonly app: Application,
     private readonly controller: GameController,
+    private readonly audio: AudioEngine,
     private readonly lib: SpriteLibrary,
     private readonly skins: SkinTextures,
   ) {
     this.room = new Room(lib);
     this.bench = new Bench(lib, skins, controller);
-    this.reel = new Reel(lib.get("reel-frame", { w: 48, h: 24 }), skins, () => this.sfx.tick(controller.run.state.combo));
+    this.reel = new Reel(lib.get("reel-frame", { w: 48, h: 24 }), skins, () => audio.play("reel-tick", { rate: comboPitch(controller.run.state.combo) }));
     this.hd = new HdLayer(lib.get("coin", { w: 12, h: 22, frames: 4 }).frames);
     this.pixel.world.addChild(this.room.back, this.room.front, this.reel, this.bench.root);
     this.hd.root.addChild(this.hint, ...this.label, this.offline);
@@ -87,7 +87,6 @@ export class World {
     });
     app.stage.on("pointerup", (e: FederatedPointerEvent) => this.bench.pointerUp(this.worldPt(e)));
     app.stage.on("pointerupoutside", (e: FederatedPointerEvent) => this.bench.pointerUp(this.worldPt(e)));
-    window.addEventListener("pointerdown", this.unlockAudio);
     this.off = controller.onEvent((e) => this.onEvent(e));
 
     this.vp = pixelViewport(app.screen.width, app.screen.height);
@@ -111,6 +110,7 @@ export class World {
       this.hd.setGlow(RARITY_INFO[plan.revealed.rarity].color);
     }
     this.look.setStage(plan.stage);
+    this.audio.setStage(plan.stage);
     this.lastStage = plan.stage;
   }
 
@@ -147,14 +147,12 @@ export class World {
 
   destroy(): void {
     this.off();
-    window.removeEventListener("pointerdown", this.unlockAudio);
     this.app.stage.removeAllListeners();
     this.hd.destroy();
     this.pixel.destroy();
     this.scene.destroy({ children: true });
     this.skins.destroy();
     this.lib.destroy();
-    this.sfx.dispose();
   }
 
   private worldPt(e: FederatedPointerEvent): Pt {
@@ -204,16 +202,17 @@ export class World {
     switch (e.type) {
       case "caseBought":
         this.bench.showCase(e.caseId, true);
-        this.sfx.click();
+        this.audio.play("case-latch");
         break;
       case "spinStarted":
         this.bench.openCase();
         this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
-        this.sfx.click();
+        this.audio.play("key-turn");
+        this.audio.play("lid-creak", { delay: 0.12 });
         break;
       case "braked":
         this.shake.add(0.12);
-        this.sfx.thump(0.35);
+        this.audio.play("brake-thud", { gain: 0.6 });
         break;
       case "revealed":
         this.onReveal(e.drop);
@@ -223,20 +222,19 @@ export class World {
         this.hd.coins.burst(at, { x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }, e.amount);
         this.hd.coins.floatText({ x: at.x, y: at.y - 10 * this.vp.scale }, `+${formatCash(e.amount, getLang())}`);
         this.hd.setGlow(null);
-        this.sfx.coin(e.combo);
+        this.audio.play("cash-register");
+        this.audio.play("coin-clink", { rate: comboPitch(e.combo), delay: 0.05 });
+        if (e.amount >= 100) this.audio.play("coin-cascade", { delay: 0.1 });
         this.bench.clearReveal(true);
         break;
       }
-      case "caseUnlocked":
-      case "upgradeBought":
-        this.sfx.click();
-        break;
       case "stageChanged":
         this.look.setStage(e.stage);
+        this.audio.setStage(e.stage);
         if (e.stage > this.lastStage) {
           this.shake.add(0.3);
           this.hd.flash(0xff7ad9, 0.35);
-          this.sfx.stageUp();
+          this.audio.play("stage-whoosh");
         }
         this.lastStage = e.stage;
         break;
@@ -249,7 +247,7 @@ export class World {
     const color = RARITY_INFO[d.rarity].color;
     const v = this.vp.scale / 6; // spark speeds were tuned at scale 6 (1080p)
     this.hd.setGlow(color);
-    this.sfx.reveal(RARITY_ORDER.indexOf(d.rarity));
+    this.audio.play("reveal-chime", { rate: 2 ** (RARITY_ORDER.indexOf(d.rarity) / 6) });
     switch (d.rarity) {
       case "milspec":
         this.hd.particles.burst(at, color, 10, 140 * v);
@@ -264,14 +262,16 @@ export class World {
       case "covert":
         this.time.hitStop(0.08);
         this.shake.add(0.55);
-        this.sfx.thump(1);
+        this.audio.play("covert-impact");
+        this.audio.duck(1.2);
         this.hd.particles.burst(at, color, 90, 420 * v);
         break;
       case "gold":
         this.time.slowMo(0.2, 2.2, 0.7);
         this.shake.add(0.8);
         this.hd.flash(0xffd700, 0.7);
-        this.sfx.jackpot();
+        this.audio.play("jackpot-swell");
+        this.audio.duck(2.6, 0.2);
         this.hd.particles.burst(at, color, 220, 520 * v);
         break;
     }
```

- [ ] **Step 9: Buttons click and Settings opens with a sound — `ui/parts.tsx`, `ui/GamePanel.tsx`**

```diff
--- a/src/modules/casecremental/ui/parts.tsx
+++ b/src/modules/casecremental/ui/parts.tsx
@@ -10,9 +10,11 @@ export interface UiEnv {
   scale: number;
   /** The ui-button art was sliced and applied (CSS variables on the root). */
   skinnedButtons: boolean;
+  /** Button press sound. */
+  click: () => void;
 }
 
-export const UiEnvContext = createContext<UiEnv>({ scale: 1, skinnedButtons: false });
+export const UiEnvContext = createContext<UiEnv>({ scale: 1, skinnedButtons: false, click: () => {} });
 
 export function PxButton(props: { onClick?: () => void; disabled?: boolean; on?: boolean; children: ReactNode; style?: CSSProperties; title?: string }): ReactNode {
   const env = useContext(UiEnvContext);
@@ -29,6 +31,7 @@ export function PxButton(props: { onClick?: () => void; disabled?: boolean; on?:
       style={props.style}
       onClick={() => {
         if (ref.current) springElement(ref.current);
+        env.click();
         props.onClick?.();
       }}
     >
```

```diff
--- a/src/modules/casecremental/ui/GamePanel.tsx
+++ b/src/modules/casecremental/ui/GamePanel.tsx
@@ -1,4 +1,5 @@
 import { useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
+import type { AudioEngine } from "../fx/audio/AudioEngine";
 import type { GameController } from "../game/controller";
 import { CaseShelf } from "./CaseShelf";
 import { Drawer } from "./Drawer";
@@ -15,7 +16,7 @@ import { useGameView } from "./useGameView";
 // top, Upgrades board left and Case shelf right (or a drawer on phones), Settings on demand. The
 // layer lets pointer events through to the canvas; only the panels take them.
 
-export function makeGamePanel(controller: GameController): ComponentType {
+export function makeGamePanel(controller: GameController, audio: AudioEngine): ComponentType {
   const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
   return function GamePanel(): ReactNode {
     const view = useGameView(controller);
@@ -36,8 +37,11 @@ export function makeGamePanel(controller: GameController): ComponentType {
         <style>{UI_CSS}</style>
         <div style={{ position: "absolute", inset: 0, background: `hsla(${tint.hue}, 100%, 55%, ${tint.alpha})`, mixBlendMode: "screen", transition: "background .4s" }} />
         {ui ? (
-          <UiEnvContext.Provider value={{ scale, skinnedButtons: !!buttons && buttons.length >= 3 }}>
-            <Hud view={view} hudH={ui.l.hudH} onSettings={() => setSettings(true)} />
+          <UiEnvContext.Provider value={{ scale, skinnedButtons: !!buttons && buttons.length >= 3, click: () => audio.play("ui-click") }}>
+            <Hud view={view} hudH={ui.l.hudH} onSettings={() => {
+              audio.play("panel-open");
+              setSettings(true);
+            }} />
             {ui.l.panelL ? (
               <Panel rect={ui.l.panelL}>
                 <UpgradesBoard view={view} act={act} />
```

- [ ] **Step 10: Delete the M1 synth**

Run: `git rm src/modules/casecremental/fx/audio.ts`

- [ ] **Step 11: Run the tests, typecheck and build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds. The game is silent until Task 14 adds the files — that is the designed fallback.

- [ ] **Step 12: Commit**

```bash
git add -A src/modules/casecremental package.json package-lock.json
git commit -m "feat(audio): mixer with buses, limiter, ducking, bar-synced stage music and silent fallback

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 14: Generate the sounds and the stage music with ElevenLabs

**Files:**
- Modify: `art/manifest.json` (add the `audio` list — the generation prompt of every sound)
- Create: `src/modules/casecremental/assets/audio/<id>-<n>.mp3` (29 effect files), `music-1.mp3`, `music-2.mp3`
- Test: `fx/audio/manifest.test.ts`

**Interfaces:**
- Consumes: `SOUNDS`, `indexAudio` (Task 13 — file names `<id>-<n>.mp3` and `music-<stage>.mp3`), `MUSIC_BPM = 120`.
- Produces: the audio files the engine picks up through `import.meta.glob`; `manifest.audio: Array<{ id; kind: "sfx"; variants; duration; prompt } | { id; kind: "music"; stage; duration; prompt }>`.

**Spending and downloading are the user's call.** ElevenLabs generation costs the user's credits: first run every generation with `estimate_only`, show the user the total, and wait for an explicit OK. Downloading the results also needs the user's OK — list the file names and the host they come from.

- [ ] **Step 1: Write the failing test**

`fx/audio/manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import manifest from "../../../../../art/manifest.json";
import { SOUNDS } from "./sounds";

// Every sound the game plays has a generation prompt in art/manifest.json, and nothing extra.
describe("audio manifest", () => {
  const sfx = manifest.audio.filter((a) => a.kind === "sfx");
  const music = manifest.audio.filter((a) => a.kind === "music");

  it("lists exactly the game's sound effects, with 1–5 variants each", () => {
    expect(sfx.map((a) => a.id).sort()).toEqual(Object.keys(SOUNDS).sort());
    for (const a of sfx) {
      expect(a.variants, a.id).toBeGreaterThanOrEqual(1);
      expect(a.variants, a.id).toBeLessThanOrEqual(5);
      expect(a.duration, a.id).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("has the Sober and Buzzed loops at the shared tempo", () => {
    expect(music.map((a) => a.stage)).toEqual([1, 2]);
    for (const a of music) expect(a.prompt).toContain("120 BPM");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/audio/manifest.test.ts`
Expected: FAIL — `manifest.audio` is undefined.

- [ ] **Step 3: Add the prompts to `art/manifest.json`**

Add this `audio` key after `assets` (put a comma after the closing `]` of `assets`; the art build ignores `audio`). The prompts follow the brief: tactile, crisp, physical, Scritchy Scratchy-like; never 8/16-bit. Both loops share 120 BPM, 4/4, A minor and 16 bars (32 s) so they can swap on bar lines.

```json
  "audio": [
    {"id":"case-latch","kind":"sfx","variants":2,"duration":0.6,"prompt":"A sturdy plastic weapon case set down on a wooden workbench, its metal latch snapping shut. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"key-turn","kind":"sfx","variants":2,"duration":0.7,"prompt":"A small brass key sliding into a lock and turning with two crisp mechanical clicks. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"lid-creak","kind":"sfx","variants":1,"duration":0.8,"prompt":"A hard case lid lifting open with a short soft hinge creak and a light puff of air. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"reel-tick","kind":"sfx","variants":4,"duration":0.5,"prompt":"One single crisp ratchet tick, like a prize wheel's flapper hitting a peg, right at the start, then silence. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"brake-thud","kind":"sfx","variants":2,"duration":0.6,"prompt":"A rubber brake pad thudding against a spinning wheel: a short deep thump with a tiny squeak. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"reveal-chime","kind":"sfx","variants":3,"duration":1,"prompt":"A bright satisfying reward chime, two rising notes, glassy and clean. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"covert-impact","kind":"sfx","variants":1,"duration":2,"prompt":"A huge cinematic impact: deep sub boom with a sparkling metallic shimmer tail. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"jackpot-swell","kind":"sfx","variants":1,"duration":3.5,"prompt":"A casino jackpot moment: a rising swell into ringing bells and a shower of coins, euphoric. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"coin-clink","kind":"sfx","variants":4,"duration":0.5,"prompt":"A single gold coin dropping onto a small pile of coins, one bright clink. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"coin-cascade","kind":"sfx","variants":1,"duration":1.5,"prompt":"Many coins pouring into a metal tray, rich and shiny. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"cash-register","kind":"sfx","variants":1,"duration":1.2,"prompt":"An old mechanical cash register: ka-ching bell and the drawer sliding open. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"stage-whoosh","kind":"sfx","variants":1,"duration":1.5,"prompt":"A rising whoosh into a deep bass drop with a psychedelic shimmer, a transition sound. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"bot-servo","kind":"sfx","variants":1,"duration":1,"prompt":"A small robot's servo motors whirring smoothly as it moves its arm. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"bot-beep","kind":"sfx","variants":1,"duration":0.5,"prompt":"A friendly little robot double beep, soft and rounded. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"ui-click","kind":"sfx","variants":3,"duration":0.5,"prompt":"A soft, chunky wooden toy button click, very short. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"panel-open","kind":"sfx","variants":1,"duration":0.7,"prompt":"A small wooden drawer sliding open with a soft paper rustle. Crisp, close-miked, tactile foley for a cozy, well-made desktop game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune."},
    {"id":"music-1","kind":"music","stage":1,"duration":32,"prompt":"Cozy lo-fi groove for a calm idle game, exactly 120 BPM, 4/4, A minor, 16 bars: warm Rhodes piano, soft brushed drums, round upright bass, gentle vinyl warmth; steady, loopable start and end, no intro, no outro, no vocals"},
    {"id":"music-2","kind":"music","stage":2,"duration":32,"prompt":"Upbeat neo-soul funk for a game getting exciting, exactly 120 BPM, 4/4, A minor, 16 bars: the same warm Rhodes, round bass and brushed drums as a cozy lo-fi groove, plus clavinet stabs, shaker and a punchier kick; loopable start and end, no intro, no outro, no vocals"}
  ]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/casecremental/fx/audio/manifest.test.ts`
Expected: PASS.

- [ ] **Step 5: Estimate the cost and ask the user**

Load the ElevenLabs tools (`ToolSearch` → `select:mcp__elevenlabs__creative_generate_in_flow,mcp__elevenlabs__creative_get_flow_run_status,mcp__elevenlabs__creative_get_model_schema`) and read the schemas of the `sfx` node (model `eleven_text_to_sound_v2`) and the `music` node (model `eleven_music_v2_5`) with `creative_get_model_schema`. For every manifest entry — one generation per variant, `prompt` and `duration` from the manifest, mp3 output — call `creative_generate_in_flow` with `estimate_only: true`, all in one flow. Tell the user the total (29 effects + 2 loops) and wait for their OK.

- [ ] **Step 6: Generate**

With the OK, run the same calls without `estimate_only`, then poll `creative_get_flow_run_status` (waiting `poll_after_seconds` between calls) until everything is complete or failed. Re-run failed items once; report anything still failing.

- [ ] **Step 7: Download (with the user's OK)**

List the 31 file names (`case-latch-1.mp3` … `ui-click-3.mp3`, `music-1.mp3`, `music-2.mp3`) and the host of the result URLs; after the user's OK save each into `src/modules/casecremental/assets/audio/` with `curl -L -o <path> "<url>"`. Check the sizes: `ls -l src/modules/casecremental/assets/audio` — effects should be tens of KB, each loop under ~1 MB (spec §11: 96–128 kbps). The audio folder must hold only these mp3 files.

- [ ] **Step 8: Listen in the game**

Run `npm run test && npm run build`, then `npm run dev`. The user plays for a minute (first click unlocks audio): case latch on buy, key turn + lid on open, reel ticks rising with the combo, brake thud, chimes by rarity, register + coins on sell, the Sober loop, then Buzzed crossfading in on a bar line at stage 2; Settings volumes work. Re-roll any sound the user dislikes (same estimate → OK → generate → OK → download steps) — never more than they approve.

- [ ] **Step 9: Commit**

```bash
git add art/manifest.json src/modules/casecremental/assets/audio src/modules/casecremental/fx/audio/manifest.test.ts
git commit -m "feat(audio): ElevenLabs sound effects and the Sober/Buzzed loops

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

---

### Task 15: Feature history and the full verification pass

**Files:**
- Create: `docs/feature-history/casecremental-look.md`
- Modify: `docs/feature-history/README.md` (one line; create the file with a title line if it doesn't exist), `IDOS.md` ("This game" — two sentences)

**Interfaces:** none (documentation and checks).

- [ ] **Step 1: Write `docs/feature-history/casecremental-look.md`**

```markdown
# Casecremental — look, layout, animation, EN/RU, audio (M2a)

Spec: docs/superpowers/specs/2026-10-08-casecremental-m2a-look-design.md · Plan: docs/superpowers/plans/2026-10-08-casecremental-m2a-look.md

## Why it is built this way
- **Two layers.** The pixel world (room, table, props, reel, bot) renders at 180 px tall into a render
  texture and is shown at an integer scale with nearest sampling; light, dust, glow, sparks, coins and
  text are an HD layer on top. The user wanted hi-bit pixel *assets* with smooth modern *effects*.
- **Pixel sprites never scale or rotate at runtime.** Motion = drawn frames + whole-pixel nudges with
  per-frame timing (`fx/pixel/anims.ts`). Characters bob in head/body/legs bands; the head band is cut
  one row taller to hide the seam (the user saw a "neck cut" in an early demo).
- **Art pipeline, "v2 recipe".** ChatGPT sources → `npm run art`: area downscale, hard alpha, posterize
  step 48, 1 px #120e10 outline; characters 48 px. The user picked v2 over smoother/lower-res variants.
- **Code eyes.** The painted eyes are erased in the pipeline and redrawn in code (2×3 blocks on a 5×5
  visor patch, level, open/half/closed/happy, blinking) — the user preferred them to painted eyes.
- **Press Start 2P everywhere, bundled** (the embedded game may only reach platform hosts). Monospace,
  so every string has a character budget (`i18n/budgets.ts`), enforced by tests in both languages.
- **EN + RU.** Same K/M/B suffixes, decimal comma in RU. Canvas text is rebuilt from state every frame,
  so a language switch mid-spin shows at once.
- **Audio** is ElevenLabs-generated (not 8/16-bit), prompts in `art/manifest.json`. The engine is
  silent-safe: no AudioContext, blocked autoplay or a broken file never breaks the game.

## Constraints and open items
- Sprites missing from `assets/sprites` render as magenta placeholders (never a crash).
- The bot's hop in `bot-open` is mistimed (crouch → takeoff → peak hold) — re-time it in M3 when the
  bot wakes up.
- Music loops are generated, not hand-looped: if a loop seam clicks, re-roll that loop.
```

- [ ] **Step 2: Index it**

Add to `docs/feature-history/README.md`:

```markdown
- [Casecremental look (M2a)](casecremental-look.md) — pixel world + HD layer, art pipeline, code eyes, EN/RU, ElevenLabs audio
```

- [ ] **Step 3: Describe the game in `IDOS.md`**

Replace `_Not described yet._` under "## This game" with:

```markdown
Casecremental — a Scritchy Scratchy-style incremental where the scratch ticket is a CS-style weapon
case: buy, unlock with the key, watch (or brake) the reel, sell the skin, and escalate from calm to
cyberpsychosis over a 4-run campaign. Pixel-art workbench with HD effects, English and Russian.
```

- [ ] **Step 4: Run every automated check**

Run: `npm run typecheck && npx vitest run && npm run build && npm run art && git status --short`
Expected: typecheck clean; all tests PASS; build succeeds; `npm run art` rebuilds every sprite and `git status` shows no changes under `src/modules/casecremental/assets/sprites` (the build is deterministic).

- [ ] **Step 5: The browser pass (with the user)**

`npm run dev`, the user signs in as guest. In Chrome DevTools, at 1920×1080, 1366×768, 3440×1440, 800×450, 820×1180 and 390×844:
1. Pixels are square and sharp; the table, benches, tray and bins sit inside the table and never under a panel (Review Focus 5).
2. A full loop works by drag and by taps: buy → key → spin → brake → card → sell; coins fly to the cash, which springs.
3. Resize or rotate mid-drag → the item returns home and nothing fires (Review Focus 3).
4. EN ↔ RU mid-spin and with a card up → everything switches, numbers use the comma in RU (Review Focus 2).
5. Every object moves: lamp, dust, bot breathing + z's, key glint, bin bob, case idle, seller LED.
6. Stage 2 (Buzzed): colour and bloom rise, the music crossfades on a bar line; Covert → hit-stop + impact; ★ → slow-mo + gold flash + jackpot.
7. Console has no errors; Network shows no font or asset requests outside the game's own host.
8. Rename one built sprite temporarily (e.g. `key.png` → `key.bak`) → the game starts with a magenta key (Review Focus 1); rename it back.
9. In DevTools, block `*.mp3` → the game runs silently (Review Focus 4).

- [ ] **Step 6: Commit**

```bash
git add docs/feature-history IDOS.md
git commit -m "docs: feature history for the Casecremental M2a look

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014wBjrnrMGCKsQtzVj5GDC3"
```

- [ ] **Step 7: Hand back**

Summarise for the user what changed, what the browser pass showed, and any art or sound they may want to re-roll. Merging into `master` happens only when the user says so.
