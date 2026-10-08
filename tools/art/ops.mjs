// Pure image operations for the art pipeline (the "v2 recipe"). An image is { w, h, data } (RGBA).

export const createImage = (w, h) => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });
const idx = (img, x, y) => (y * img.w + x) * 4;
const opaque = (img, x, y, thr = 128) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[idx(img, x, y) + 3] >= thr;

export function fillRect(img, x, y, w, h, rgba) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h) continue;
      img.data.set(rgba, idx(img, xx, yy));
    }
}

export function opaqueBounds(img, thr = 128) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (opaque(img, x, y, thr)) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Multi-row sheet → one row, each row aligned on its own ground line (lowest opaque pixel). */
export function reflowRows(img, { minGap = 4, minRowH = 16 } = {}) {
  const has = Array.from({ length: img.h }, (_, y) => {
    for (let x = 0; x < img.w; x++) if (opaque(img, x, y)) return true;
    return false;
  });
  const rows = [];
  for (let y = 0; y < img.h; y++) {
    if (!has[y]) continue;
    let e = y;
    for (;;) {
      let next = -1;
      for (let k = 1; k <= minGap && e + k < img.h; k++)
        if (has[e + k]) {
          next = e + k;
          break;
        }
      if (next < 0) break;
      e = next;
    }
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
  const W = Math.ceil(img.w / factor),
    H = Math.ceil(img.h / factor),
    out = createImage(W, H);
  for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < W; gx++) {
      const x0 = Math.floor(gx * factor),
        x1 = Math.min(img.w, Math.ceil((gx + 1) * factor));
      const y0 = Math.floor(gy * factor),
        y1 = Math.min(img.h, Math.ceil((gy + 1) * factor));
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = idx(img, x, y),
            al = img.data[i + 3] / 255;
          r += img.data[i] * al;
          g += img.data[i + 1] * al;
          b += img.data[i + 2] * al;
          a += al;
          n++;
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
  const owner = new Int16Array(img.w * img.h).fill(-1),
    seen = new Uint8Array(img.w * img.h),
    sliceW = img.w / n;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const i0 = y * img.w + x;
      if (seen[i0] || !opaque(img, x, y)) continue;
      const comp = [],
        q = [i0];
      seen[i0] = 1;
      while (q.length) {
        const i = q.pop();
        comp.push(i);
        const cx = i % img.w,
          cy = (i / img.w) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx,
              ny = cy + dy,
              j = ny * img.w + nx;
            if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen[j] || !opaque(img, nx, ny)) continue;
            seen[j] = 1;
            q.push(j);
          }
      }
      let minX = img.w,
        maxX = 0,
        sx = 0;
      for (const i of comp) {
        const cx = i % img.w;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        sx += cx;
      }
      const wide = maxX - minX + 1 > sliceW * 1.25,
        home = Math.min(n - 1, Math.floor(sx / comp.length / sliceW));
      for (const i of comp) owner[i] = wide ? Math.min(n - 1, Math.floor((i % img.w) / sliceW)) : home;
    }
  return Array.from({ length: n }, (_, f) => {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -1,
      y1 = -1;
    for (let i = 0; i < owner.length; i++)
      if (owner[i] === f) {
        const x = i % img.w,
          y = (i / img.w) | 0;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    if (x1 < 0) return null;
    const out = createImage(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (owner[y * img.w + x] === f) out.data.set(img.data.subarray(idx(img, x, y), idx(img, x, y) + 4), idx(out, x - x0, y - y0));
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
  for (let y = bb.y0; y < yMax; y++)
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = idx(frame, x, y);
      const d = frame.data;
      if (d[i + 3] && isEye(d[i], d[i + 1], d[i + 2])) pts.push([x, y]);
    }
  if (!pts.length) return null;
  const counts = new Map();
  for (const [ex, ey] of pts)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!opaque(frame, ex + dx, ey + dy)) continue;
        const i = idx(frame, ex + dx, ey + dy),
          d = frame.data;
        if (isEye(d[i], d[i + 1], d[i + 2]) || isTint(d[i], d[i + 1], d[i + 2]) || d[i] + d[i + 1] + d[i + 2] > 150) continue;
        const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
  const visor = counts.size
    ? [...counts.entries()]
        .sort((a, b) => b[1] - a[1])[0][0]
        .split(",")
        .map(Number)
    : [13, 20, 24];
  for (const [ex, ey] of pts)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!opaque(frame, ex + dx, ey + dy)) continue;
        const i = idx(frame, ex + dx, ey + dy),
          d = frame.data;
        if (isEye(d[i], d[i + 1], d[i + 2]) || isTint(d[i], d[i + 1], d[i + 2])) d.set([...visor, 255], i);
      }
  const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
  let split = Infinity;
  for (let i = 1; i < xs.length; i++)
    if (xs[i] - xs[i - 1] > 1) {
      split = (xs[i] + xs[i - 1]) / 2;
      break;
    }
  const groups = [pts.filter((p) => p[0] < split), pts.filter((p) => p[0] >= split)].filter((g) => g.length);
  const level = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const eyes = groups.map((g) => [Math.round(g.reduce((s, p) => s + p[0], 0) / g.length), Math.round(level)]);
  return { eyes, level };
}

/** Place a frame in a fixed cell: feet centre on the cell's centre line, the sheet's ground line on `ground`. */
export function placeInCell(frame, { cellW, cellH, ground, sheetGround }) {
  const { img, y0 } = frame;
  const bb = opaqueBounds(img);
  let sx = 0,
    n = 0;
  if (bb) {
    const from = Math.floor(bb.y1 - (bb.y1 - bb.y0 + 1) * 0.2);
    for (let y = from; y <= bb.y1; y++)
      for (let x = 0; x < img.w; x++)
        if (opaque(img, x, y)) {
          sx += x;
          n++;
        }
  }
  const ox = Math.round(cellW / 2 - (n ? sx / n : img.w / 2));
  const oy = y0 + (ground - sheetGround);
  const cell = createImage(cellW, cellH);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (!opaque(img, x, y)) continue;
      const cx = x + ox,
        cy = y + oy;
      if (cx < 0 || cy < 0 || cx >= cellW || cy >= cellH) continue;
      cell.data.set(img.data.subarray(idx(img, x, y), idx(img, x, y) + 4), idx(cell, cx, cy));
    }
  return { cell, ox, oy };
}

export function outline(img, rgb) {
  const src = new Uint8ClampedArray(img.data);
  const was = (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && src[(y * img.w + x) * 4 + 3] >= 128;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (was(x, y)) continue;
      if (was(x - 1, y) || was(x + 1, y) || was(x, y - 1) || was(x, y + 1)) img.data.set([...rgb, 255], idx(img, x, y));
    }
  return img;
}

export function hstack(imgs) {
  const W = imgs.reduce((s, i) => s + i.w, 0),
    H = Math.max(...imgs.map((i) => i.h)),
    out = createImage(W, H);
  let ox = 0;
  for (const im of imgs) {
    for (let y = 0; y < im.h; y++) out.data.set(im.data.subarray(y * im.w * 4, (y + 1) * im.w * 4), idx(out, ox, y));
    ox += im.w;
  }
  return out;
}
