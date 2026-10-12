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
      let lr = 0,
        lg = 0,
        lb = 0,
        ln = 0; // coloured pixels
      let dr = 0,
        dg = 0,
        db = 0,
        dn = 0; // outline pixels
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          area++;
          const i = (sy * img.w + sx) * 4;
          if (img.data[i + 3]! < 128) continue;
          solid++;
          const r = img.data[i]!,
            g = img.data[i + 1]!,
            b = img.data[i + 2]!;
          if ((r + g + b) / 3 < OUTLINE_LUM) {
            dr += r;
            dg += g;
            db += b;
            dn++;
          } else {
            lr += r;
            lg += g;
            lb += b;
            ln++;
          }
        }
      if (solid * 3 < area) continue;
      const o = (y * w + x) * 4;
      const [r, g, b, n] = ln ? [lr, lg, lb, ln] : [dr, dg, db, dn];
      data.set([Math.round(r / n), Math.round(g / n), Math.round(b / n), 255], o);
    }
  }
  return { w, h, data };
}
