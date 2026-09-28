// ---------------------------------------------------------------------------
// pixelgrid.js — tiny helpers for pixel art stored as arrays of strings.
// Each character is a palette key; '.' (or ' ') is transparent.
// ---------------------------------------------------------------------------

/** Create an offscreen canvas (works in any browser, no DOM attachment). */
export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Get a 2D context with smoothing disabled — the golden rule of pixel art. */
export function pixelContext(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Paint a grid of palette keys onto `ctx` at (ox, oy).
 * Rows may have different lengths; missing cells are transparent.
 */
export function paintGrid(ctx, rows, colors, ox = 0, oy = 0, flip = false) {
  const width = rows.reduce((w, row) => Math.max(w, row.length), 0);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === '.' || key === ' ') continue;
      const color = colors[key];
      if (!color) continue;
      ctx.fillStyle = color;
      const px = flip ? ox + (width - 1 - x) : ox + x;
      ctx.fillRect(px, oy + y, 1, 1);
    }
  }
}

/** Rasterise a grid into its own canvas (handy for small reusable sprites). */
export function gridToCanvas(rows, colors, flip = false) {
  const width = rows.reduce((w, row) => Math.max(w, row.length), 0);
  const canvas = makeCanvas(width, rows.length);
  paintGrid(pixelContext(canvas), rows, colors, 0, 0, flip);
  return canvas;
}

/** Return a horizontally mirrored copy of a canvas. */
export function mirrorCanvas(source) {
  const canvas = makeCanvas(source.width, source.height);
  const ctx = pixelContext(canvas);
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/** Deterministic PRNG (mulberry32) so procedural scenery is identical every run. */
export function seededRandom(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
