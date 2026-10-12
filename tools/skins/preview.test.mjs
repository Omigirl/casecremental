// Dev-only eyeball check of the skin finishes (Plan M3-B): writes PNG contact sheets to art/preview/patterns/
// (gitignored). Skipped in the normal test run; run it on purpose:
//   bash:        SKIN_PREVIEW=1 npx vitest run tools/skins
//   PowerShell:  $env:SKIN_PREVIEW=1; npx vitest run tools/skins; Remove-Item Env:SKIN_PREVIEW
import fs from "node:fs";
import { describe, it } from "vitest";
import { CASES } from "../../src/modules/casecremental/sim/content/cases";
import { renderSkinFrames } from "../../src/modules/casecremental/fx/skins/motion";
import { OWN_MOTION, renderPattern } from "../../src/modules/casecremental/fx/skins/patterns";
import { writePng } from "../art/png.mjs";

const OUT = "art/preview/patterns";
const BG = [40, 40, 48, 255];
/** Demo palettes for the kinds no case uses yet (the M3-A case data replaces them once it lands). */
const DEMO = {
  circuit: ["#04140c", "#0b2a1a", "#1f9d55", "#c9a227", "#9dffb0"],
  hex: ["#05070d", "#1b2433", "#34465e", "#00c2ff", "#d6f6ff"],
  carbon: ["#050505", "#141414", "#2a2a2e", "#55555c", "#9a9aa3"],
  synthgrid: ["#0b0221", "#3a0c5e", "#ff2a6d", "#ff9e00", "#ffe45e"],
  neonline: ["#06020c", "#1a0630", "#ff2a6d", "#05d9e8", "#fff5fd"],
  hueflow: ["#2b0f54", "#ab1f65", "#ff4f69", "#ff8031", "#ffdf6b"],
  starfield: ["#020208", "#141433", "#5a6a9a", "#b8c6ff", "#ffffff"],
  nebula: ["#030010", "#2a0a4a", "#8a1f7a", "#ff6a3d", "#ffd6a0", "#ffffff"],
  aurora: ["#020617", "#2e1065", "#0f9d6e", "#6dffb5", "#eafff4"],
  iridescent: ["#0a0a12", "#3a0ca3", "#4cc9f0", "#80ffdb", "#f72585", "#ffd166"],
  flame: ["#0a0000", "#5a0a00", "#d62800", "#ff8a00", "#ffd84a", "#fff6c8"],
  ember: ["#070504", "#1c1410", "#7a1a00", "#ff5a00", "#ffb347", "#fff0b0"],
  molten: ["#080404", "#1d0f0c", "#8a1600", "#ff4d00", "#ffb000", "#fff1a8"],
};
const OLD = ["camo", "digital", "tiger", "leaves", "bark", "moss", "marble", "granite", "crystal", "lava"];

const image = (w, h) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(BG, i * 4);
  return { w, h, data };
};
/** Nearest-neighbour copy of src into dst at (ox, oy), k× larger; transparent pixels are skipped. */
function blit(dst, src, ox, oy, k) {
  for (let y = 0; y < src.h * k; y++)
    for (let x = 0; x < src.w * k; x++) {
      const si = (Math.floor(y / k) * src.w + Math.floor(x / k)) * 4;
      if (src.data[si + 3] === 0 || ox + x >= dst.w || oy + y >= dst.h) continue;
      dst.data.set(src.data.subarray(si, si + 4), ((oy + y) * dst.w + ox + x) * 4);
    }
}
const pattern = (spec, w, h) => ({ w, h, data: renderPattern(spec, w, h) });
const specOf = (kind) =>
  CASES.flatMap((c) => c.skins).find((s) => s.pattern.kind === kind)?.pattern ?? { kind, palette: DEMO[kind], scale: 4, seed: 101 };
const demoSkin = (spec, motion) => ({
  id: `preview-${spec.kind}`,
  name: spec.kind,
  weapon: "rifle",
  rarity: "covert",
  pattern: spec,
  ...(motion ? { motion } : {}),
});

describe.skipIf(!process.env.SKIN_PREVIEW)("skin preview sheets", () => {
  it("writes kinds.png, loops.png and cases.png", () => {
    fs.mkdirSync(OUT, { recursive: true });

    // every kind: in-game size ×6, a large render, and on a rifle ×4 (cases 1-3 first, to compare)
    const kinds = [...OLD, ...Object.keys(DEMO)];
    const sheet = image(4 * 330 + 10, Math.ceil(kinds.length / 4) * 150 + 10);
    kinds.forEach((kind, i) => {
      const spec = specOf(kind);
      const ox = 10 + (i % 4) * 330;
      const oy = 10 + Math.floor(i / 4) * 150;
      blit(sheet, pattern(spec, 26, 10), ox, oy, 6);
      blit(sheet, pattern(spec, 156, 60), ox + 165, oy, 1);
      blit(sheet, renderSkinFrames(demoSkin(spec))[0], ox, oy + 70, 4);
    });
    writePng(`${OUT}/kinds.png`, sheet);

    // each kind that draws its own motion: its whole loop on a rifle, ×5, one row per kind
    const own = Object.entries(OWN_MOTION);
    const loops = image(10 * 140 + 10, own.length * 60 + 10);
    own.forEach(([kind, motion], r) =>
      renderSkinFrames(demoSkin(specOf(kind), { pattern: motion, frames: 10 })).forEach((f, n) =>
        blit(loops, f, 10 + n * 140, 10 + r * 60, 5),
      ),
    );
    writePng(`${OUT}/loops.png`, loops);

    // every skin of every case as the player sees it: in-game pattern ×4 and frame 0 on its weapon ×4
    const cases = image(13 * 120 + 10, CASES.length * 120 + 10);
    CASES.forEach((c, r) =>
      c.skins.forEach((s, n) => {
        blit(cases, pattern(s.pattern, 26, 10), 10 + n * 120, 10 + r * 120, 4);
        blit(cases, renderSkinFrames(s)[0], 10 + n * 120, 60 + r * 120, 4);
      }),
    );
    writePng(`${OUT}/cases.png`, cases);
  });
});
