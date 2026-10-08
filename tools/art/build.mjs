// Art build: art/manifest.json → src/modules/casecremental/assets/sprites/<id>.png + .json.
// Applies the "v2 recipe": smooth downscale, hard alpha, posterize, eyes → code eyes, 1 px outline.
// usage: npm run art            (all assets whose source exists)
//        npm run art -- <id>    (one asset)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "./png.mjs";
import {
  areaDownscale,
  createImage,
  eraseEyes,
  hardAlpha,
  hstack,
  opaqueBounds,
  outline,
  ownFrames,
  placeInCell,
  posterize,
  reflowRows,
} from "./ops.mjs";

export function buildAsset(def, src, globals) {
  const step = def.posterize === false ? 0 : globals.posterize;
  const wantOutline = def.outline !== false;
  if (def.kind === "static") {
    const bb = opaqueBounds(src) ?? { x0: 0, y0: 0, x1: src.w - 1, y1: src.h - 1 };
    const w = bb.x1 - bb.x0 + 1,
      h = bb.y1 - bb.y0 + 1;
    const factor = def.targetW ? w / def.targetW : h / def.targetH;
    const crop = createImage(w, h);
    for (let y = 0; y < h; y++)
      crop.data.set(src.data.subarray(((bb.y0 + y) * src.w + bb.x0) * 4, ((bb.y0 + y) * src.w + bb.x0 + w) * 4), y * w * 4);
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
  const cellW = def.cellW ?? Math.max(Math.ceil(def.targetH * 1.05), widest + 6),
    cellH = def.targetH + 14,
    ground = cellH - 2;
  const cells = [],
    eyes = [];
  for (const f of frames) {
    if (!f) {
      cells.push(createImage(cellW, cellH));
      eyes.push(null);
      continue;
    }
    const found = def.eyes ? eraseEyes(f.img) : null;
    const { cell, ox, oy } = placeInCell(f, { cellW, cellH, ground, sheetGround });
    if (wantOutline) outline(cell, globals.outline);
    cells.push(cell);
    eyes.push(found ? found.eyes.map(([x, y]) => [x + ox, y + oy]) : null);
  }
  return {
    strip: hstack(cells),
    meta: { id: def.id, frames: def.frames, frameW: cellW, frameH: cellH, ground, eyes: def.eyes ? eyes : null },
  };
}

function preview(img, scale) {
  const out = createImage(img.w * scale, img.h * scale);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const si = (((y / scale) | 0) * img.w + ((x / scale) | 0)) * 4,
        di = (y * out.w + x) * 4;
      if (img.data[si + 3]) out.data.set(img.data.subarray(si, si + 4), di);
      else out.data.set([30, 24, 20, 255], di);
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
  let built = 0,
    skipped = 0;
  for (const def of manifest.assets) {
    if (only && def.id !== only) continue;
    const srcPath = path.join(root, "art/source", def.source);
    if (!fs.existsSync(srcPath)) {
      console.warn(`skip ${def.id}: art/source/${def.source} not found`);
      skipped++;
      continue;
    }
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
