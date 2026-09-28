// ---------------------------------------------------------------------------
// background.js — the golden-hour sky and three parallax skyline layers.
// Everything is generated once with a seeded RNG, then blitted each frame.
// ---------------------------------------------------------------------------

import { VIEW, ENV } from './config.js';
import { makeCanvas, pixelContext, seededRandom } from './pixelgrid.js';

const W = VIEW.width;
const H = VIEW.height;

/** 4x4 Bayer matrix, normalised to [0, 1) — classic ordered dithering. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Sample the sky gradient (ENV.skyStops) at t ∈ [0, 1]. */
function skyColorAt(t) {
  const stops = ENV.skyStops;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const k = (t - p0) / (p1 - p0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

/** Sky as ~26 colour bands with dithered edges — a smooth-but-pixel look. */
function buildSky() {
  const canvas = makeCanvas(W, H);
  const ctx = pixelContext(canvas);
  const image = ctx.createImageData(W, H);
  const bands = 26;
  const palette = [];
  for (let i = 0; i < bands; i++) palette.push(skyColorAt(i / (bands - 1)));
  for (let y = 0; y < H; y++) {
    const p = (y / (H - 1)) * (bands - 1);
    const base = Math.floor(p);
    const frac = p - base;
    for (let x = 0; x < W; x++) {
      const threshold = BAYER[(y & 3) * 4 + (x & 3)];
      const color = palette[Math.min(bands - 1, base + (frac > threshold ? 1 : 0))];
      const o = (y * W + x) * 4;
      image.data[o] = color[0];
      image.data[o + 1] = color[1];
      image.data[o + 2] = color[2];
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** A big low sun with retro stripe cut-outs and a soft glow. */
function buildSun() {
  const r = 19;
  const size = r * 2 + 25;
  const canvas = makeCanvas(size, size);
  const ctx = pixelContext(canvas);
  const c = size / 2;
  // Glow rings
  for (const [radius, alpha] of [[r + 12, 0.08], [r + 7, 0.12], [r + 3, 0.18]]) {
    ctx.fillStyle = `rgba(255, 220, 150, ${alpha})`;
    fillCircle(ctx, c, c, radius);
  }
  ctx.fillStyle = ENV.sun;
  fillCircle(ctx, c, c, r);
  ctx.fillStyle = ENV.sunCore;
  fillCircle(ctx, c - 3, c - 4, r - 7);
  // Stripe gaps across the lower half (the sky shows through)
  ctx.globalCompositeOperation = 'destination-out';
  [[6, 1], [10, 1], [13, 2], [16, 2]].forEach(([dy, h]) => ctx.fillRect(0, c + dy, size, h));
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

/** Pixel-perfect filled circle (no anti-aliasing). */
export function fillCircle(ctx, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

/** Long, flat sunset clouds lit from below. */
function buildClouds(random) {
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const length = 34 + Math.floor(random() * 60);
    const rows = 3 + Math.floor(random() * 4);
    const canvas = makeCanvas(length + 8, rows + 1);
    const ctx = pixelContext(canvas);
    for (let row = 0; row < rows; row++) {
      // Each row is shorter than the one below → a soft, stacked silhouette.
      const inset = Math.floor((rows - 1 - row) * (3 + random() * 5));
      const w = Math.max(6, length - inset * 2 + Math.floor(random() * 6));
      const x = Math.floor((length + 8 - w) / 2 + (random() - 0.5) * 6);
      const t = row / Math.max(1, rows - 1);
      ctx.fillStyle = t > 0.75 ? ENV.cloudLight : t > 0.35 ? ENV.cloudMid : ENV.cloudDark;
      ctx.fillRect(x, row, w, 1);
    }
    clouds.push({
      canvas,
      x: random() * 640,
      y: 14 + Math.floor(random() * 58),
      speed: 1.5 + random() * 2.5, // px/s of wind drift
    });
  }
  return clouds;
}

/**
 * A repeating skyline strip. Returns the silhouette canvas and a list of
 * windows that are drawn each frame so some of them can flicker.
 */
function buildSkyline(random, options) {
  const { width, minTop, maxTop, color, rim, windowColor, windowChance, detailChance } = options;
  const canvas = makeCanvas(width, H);
  const ctx = pixelContext(canvas);
  const windows = [];
  let x = 0;
  while (x < width) {
    const w = 14 + Math.floor(random() * 30);
    const top = minTop + Math.floor(random() * (maxTop - minTop));
    const bw = Math.min(w, width - x);
    ctx.fillStyle = color;
    ctx.fillRect(x, top, bw, H - top);
    // Rooftop silhouettes: antennas, water towers, stepped tops, domes.
    if (random() < detailChance) {
      const kind = Math.floor(random() * 4);
      const cx = x + 3 + Math.floor(random() * Math.max(1, bw - 10));
      if (kind === 0) {
        ctx.fillRect(cx + 2, top - 10 - Math.floor(random() * 10), 1, 12);
      } else if (kind === 1) {
        ctx.fillRect(cx, top - 9, 8, 6);
        ctx.fillRect(cx + 1, top - 3, 1, 3);
        ctx.fillRect(cx + 6, top - 3, 1, 3);
        ctx.fillRect(cx + 1, top - 11, 6, 2);
      } else if (kind === 2) {
        ctx.fillRect(x + 3, top - 5, Math.max(4, bw - 6), 5);
      } else {
        ctx.fillRect(cx, top - 3, 7, 3);
        ctx.fillRect(cx + 1, top - 5, 5, 2);
      }
    }
    // Sunlit rim on the right-hand edge (the sun sets to the right).
    if (rim) {
      ctx.fillStyle = rim;
      ctx.fillRect(x + bw - 1, top, 1, H - top);
      ctx.fillRect(x, top, bw, 1);
    }
    // Window grid
    const cols = Math.floor((bw - 3) / 4);
    for (let wy = top + 4; wy < H - 4; wy += 5) {
      for (let c = 0; c < cols; c++) {
        if (random() < windowChance) {
          windows.push({
            x: x + 2 + c * 4,
            y: wy,
            w: 2,
            h: 2,
            phase: random() * 100,
            flicker: random() < 0.08,
            color: windowColor,
          });
        }
      }
    }
    x += w + (random() < 0.3 ? 2 + Math.floor(random() * 4) : 0);
  }
  return { canvas, windows, width };
}

/** Pseudo-random but stable on/off pattern for window lights over time. */
function windowLit(win, time) {
  const slot = Math.floor(time / 7 + win.phase);
  const n = Math.sin(slot * 12.9898 + win.phase * 78.233) * 43758.5453;
  let lit = n - Math.floor(n) > 0.18;
  if (win.flicker && Math.sin(time * 23 + win.phase) > 0.6) lit = !lit;
  return lit;
}

export function createBackground(seed = 1987) {
  const random = seededRandom(seed);
  const sky = buildSky();
  const sun = buildSun();
  const clouds = buildClouds(random);
  const layers = [
    {
      parallax: 0.12,
      ...buildSkyline(random, {
        width: 520,
        minTop: 92,
        maxTop: 126,
        color: ENV.farCity,
        rim: null,
        windowColor: ENV.farCityWindow,
        windowChance: 0.1,
        detailChance: 0.45,
      }),
    },
    {
      parallax: 0.3,
      ...buildSkyline(random, {
        width: 460,
        minTop: 104,
        maxTop: 142,
        color: ENV.midCity,
        rim: '#7C4A62',
        windowColor: ENV.midCityWindow,
        windowChance: 0.16,
        detailChance: 0.5,
      }),
    },
    {
      parallax: 0.55,
      ...buildSkyline(random, {
        width: 420,
        minTop: 120,
        maxTop: 156,
        color: ENV.nearCity,
        rim: '#6B4052',
        windowColor: ENV.nearCityWindow,
        windowChance: 0.2,
        detailChance: 0.55,
      }),
    },
  ];

  // Stars only appear in the darker upper sky.
  const stars = Array.from({ length: 26 }, () => ({
    x: Math.floor(random() * 700),
    y: 2 + Math.floor(random() * 46),
    phase: random() * Math.PI * 2,
    big: random() < 0.15,
  }));

  // Warm dust motes drifting in the low sunlight (screen space).
  const motes = Array.from({ length: 28 }, () => ({
    x: random() * W,
    y: 40 + random() * 130,
    speed: 2 + random() * 5,
    phase: random() * Math.PI * 2,
    depth: 0.6 + random() * 0.5,
  }));

  /** Where the sun is on screen for a given camera (also used by photo framing). */
  function sunPosition(camX) {
    return { x: Math.round(252 - camX * 0.02), y: 120 };
  }

  function drawLayer(ctx, layer, camX, time) {
    const offset = -Math.floor(camX * layer.parallax) % layer.width;
    for (let x = offset - layer.width; x < W; x += layer.width) {
      if (x + layer.width < 0) continue;
      ctx.drawImage(layer.canvas, x, 0);
      for (const win of layer.windows) {
        const wx = x + win.x;
        if (wx < -2 || wx > W) continue;
        if (!windowLit(win, time)) continue;
        ctx.fillStyle = win.color;
        ctx.fillRect(wx, win.y, win.w, win.h);
      }
    }
  }

  /** Draw the whole backdrop for camera position `camX`. */
  function draw(ctx, camX, time) {
    ctx.drawImage(sky, 0, 0);

    // Twinkling stars
    for (const s of stars) {
      const x = Math.round(s.x - camX * 0.01) % 700;
      if (x < 0 || x >= W) continue;
      const twinkle = Math.sin(time * 2 + s.phase);
      if (twinkle < -0.4) continue;
      ctx.fillStyle = ENV.star;
      ctx.globalAlpha = 0.45 + 0.4 * twinkle;
      ctx.fillRect(x, s.y, 1, 1);
      if (s.big && twinkle > 0.5) {
        ctx.fillRect(x - 1, s.y, 3, 1);
        ctx.fillRect(x, s.y - 1, 1, 3);
      }
    }
    ctx.globalAlpha = 1;

    const sunPos = sunPosition(camX);
    ctx.drawImage(sun, sunPos.x - sun.width / 2, sunPos.y - sun.height / 2);

    // Clouds drift with the wind and a touch of parallax.
    for (const cloud of clouds) {
      const span = 640;
      let x = (cloud.x + time * cloud.speed - camX * 0.05) % span;
      if (x < 0) x += span;
      x -= cloud.canvas.width;
      ctx.drawImage(cloud.canvas, Math.round(x), cloud.y);
      if (x + span < W) ctx.drawImage(cloud.canvas, Math.round(x + span), cloud.y);
    }

    for (const layer of layers) drawLayer(ctx, layer, camX, time);

    // Haze near the street far below: pits between roofs read as deep.
    const haze = ctx.createLinearGradient(0, 138, 0, H);
    haze.addColorStop(0, 'rgba(30, 22, 40, 0)');
    haze.addColorStop(1, 'rgba(24, 16, 32, 0.85)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 138, W, H - 138);
  }

  /** Dust motes are drawn over the world for depth. */
  function drawMotes(ctx, camX, time, reducedMotion) {
    ctx.fillStyle = ENV.windowLit;
    for (const m of motes) {
      const drift = reducedMotion ? 0 : time * m.speed;
      let x = (m.x - camX * m.depth * 0.3 + drift) % W;
      if (x < 0) x += W;
      const y = m.y + Math.sin(time * 0.7 + m.phase) * 6;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 1.3 + m.phase);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  return { draw, drawMotes, sunPosition };
}
