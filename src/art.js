// ---------------------------------------------------------------------------
// art.js — world artwork: rooftop facades, props, creatures and icons.
// Buildings are pre-rendered once; animated bits (windows, neon, laundry,
// lamps, birds...) are drawn per frame with tiny fillRects.
// ---------------------------------------------------------------------------

import { ENV, PALETTE, PALETTE_EXTRA, VIEW } from './config.js';
import { makeCanvas, pixelContext, gridToCanvas, mirrorCanvas, seededRandom } from './pixelgrid.js';
import { drawText, BIG } from './font.js';
import { fillCircle } from './background.js';

// --- Building facades -----------------------------------------------------------

const BUILDING_STYLES = [
  { wall: '#4A3350', dark: '#38263F', light: '#5C4263', line: '#412C47', roof: '#6A4B5E', brick: true },
  { wall: '#553A3E', dark: '#40292E', light: '#6A4A4C', line: '#4A3236', roof: '#74505A', brick: true },
  { wall: '#3F3A52', dark: '#2E2B3D', light: '#524C66', line: '#37334A', roof: '#5E5670', brick: false },
  { wall: '#5B3E52', dark: '#452D3F', light: '#6F4E64', line: '#4F3547', roof: '#7A5468', brick: true },
];

/**
 * Pre-render one building's facade. Returns the canvas plus the list of
 * window rectangles (in building-local coordinates) for light flicker.
 */
function buildFacade(b) {
  const style = BUILDING_STYLES[b.style % BUILDING_STYLES.length];
  const random = seededRandom(b.seed);
  const h = VIEW.height - b.top + 12;
  const canvas = makeCanvas(b.w, h);
  const ctx = pixelContext(canvas);

  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, b.w, h);

  // Brick courses or concrete panels
  ctx.fillStyle = style.line;
  if (style.brick) {
    for (let y = 8, row = 0; y < h; y += 4, row++) {
      ctx.fillRect(0, y, b.w, 1);
      for (let x = (row % 2) * 4; x < b.w; x += 8) ctx.fillRect(x, y + 1, 1, 3);
    }
  } else {
    for (let y = 18; y < h; y += 14) ctx.fillRect(0, y, b.w, 1);
    for (let x = 16; x < b.w; x += 20) ctx.fillRect(x, 6, 1, h);
  }

  // Shadow side (left) and warm rim light (right, facing the sunset)
  ctx.fillStyle = style.dark;
  ctx.fillRect(0, 0, 2, h);
  ctx.fillStyle = ENV.rim;
  ctx.fillRect(b.w - 1, 4, 1, h);

  // Parapet: sunlit top edge, body, and the shadow line it casts
  ctx.fillStyle = ENV.roofTop;
  ctx.fillRect(0, 0, b.w, 1);
  ctx.fillStyle = style.roof;
  ctx.fillRect(0, 1, b.w, 3);
  ctx.fillStyle = style.light;
  ctx.fillRect(0, 1, b.w, 1);
  ctx.fillStyle = ENV.roofShadow;
  ctx.fillRect(0, 4, b.w, 1);
  ctx.fillStyle = style.dark;
  ctx.fillRect(0, 5, b.w, 1);

  // Windows
  const windows = [];
  const winW = 6;
  const winH = 8;
  const spacingX = 14 + Math.floor(random() * 3);
  const spacingY = 18;
  const cols = Math.max(1, Math.floor((b.w - 10) / spacingX));
  const startX = Math.floor((b.w - (cols - 1) * spacingX - winW) / 2);
  for (let y = 14; y < h - 6; y += spacingY) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * spacingX;
      if (random() < 0.12) continue; // a blank bit of wall now and then
      ctx.fillStyle = ENV.windowFrame;
      ctx.fillRect(x - 1, y - 1, winW + 2, winH + 2);
      ctx.fillStyle = ENV.windowDim;
      ctx.fillRect(x, y, winW, winH);
      ctx.fillStyle = style.light;
      ctx.fillRect(x - 1, y + winH + 1, winW + 2, 1); // sill
      windows.push({ x, y, w: winW, h: winH, phase: random() * 50, flicker: random() < 0.1 });
      // Little extras: an AC box or flower box under some windows
      const extra = random();
      if (extra < 0.08) {
        ctx.fillStyle = ENV.metalDark;
        ctx.fillRect(x - 1, y + winH + 2, 8, 4);
        ctx.fillStyle = ENV.metal;
        ctx.fillRect(x - 1, y + winH + 2, 8, 1);
      } else if (extra < 0.15) {
        ctx.fillStyle = ENV.woodDark;
        ctx.fillRect(x - 1, y + winH + 2, 8, 2);
        ctx.fillStyle = '#6E8F5E';
        ctx.fillRect(x, y + winH + 1, 2, 1);
        ctx.fillRect(x + 3, y + winH + 1, 3, 1);
      }
    }
  }

  // A drainpipe on some buildings
  if (random() < 0.6) {
    const px = random() < 0.5 ? 4 : b.w - 6;
    ctx.fillStyle = ENV.metalDark;
    ctx.fillRect(px, 6, 2, h);
    ctx.fillStyle = ENV.metal;
    for (let y = 12; y < h; y += 16) ctx.fillRect(px - 1, y, 4, 1);
  }
  return { canvas, windows };
}

/** Window light pattern: mostly stable, a few flicker (like real TVs). */
function windowLit(win, time) {
  const slot = Math.floor(time / 9 + win.phase);
  const n = Math.sin(slot * 91.345 + win.phase * 47.853) * 24634.6345;
  let lit = n - Math.floor(n) > 0.45;
  if (win.flicker && Math.sin(time * 19 + win.phase * 3) > 0.7) lit = !lit;
  return lit;
}

// --- Creature & object sprites ----------------------------------------------------

const CREATURE_COLORS = {
  K: PALETTE.charcoal,
  g: '#9C9DB5', // pigeon head
  b: '#8384A0', // pigeon body
  w: '#5F607C', // wing
  n: '#6FA08A', // iridescent neck
  o: '#E6936A', // beak / feet / ginger fur
  O: '#C06A45', // ginger stripes
  e: '#A7E07A', // cat eyes
  C: PALETTE.cream,
  f: '#E6936A',
  W: PALETTE_EXTRA.white,
};

const PIGEON_FRAMES = [
  [
    '......KKK...',
    '.....KgggK..',
    '.....KgKgKoo',
    '.....KnggK..',
    '..KKKKnnK...',
    '.KwwbbbbbK..',
    'KwwwwbbbbbK.',
    '.KKwwbbbbK..',
    '...KKKKKK...',
    '....f..f....',
  ],
  [
    '............',
    '......KKK...',
    '.....KgggK..',
    '.....KgKgKoo',
    '..KKKKnggK..',
    '.KwwbbbnnK..',
    'KwwwwbbbbbK.',
    '.KKwwbbbbK..',
    '...KKKKKK...',
    '.....ff.....',
  ],
  [
    // pecking
    '............',
    '............',
    '............',
    '..KKKKK.....',
    '.KwwbbbKKK..',
    'KwwwwbbnggK.',
    'KwwwwbbbgKoo',
    '.KKwwbbbbK..',
    '...KKKKKK...',
    '....f..f....',
  ],
];

const CAT_FRAMES = [
  [
    '.K...K......',
    'KoK.KoK.....',
    'KooKooK.....',
    'KoeoeoK.....',
    'KooKooK.....',
    '.KoooK......',
    '.KoOooK.....',
    'KooCOooK....',
    'KooCooOK..K.',
    'KoooooooK.K.',
    '.KKKKKKKKK..',
  ],
  [
    '.K...K......',
    'KoK.KoK.....',
    'KooKooK.....',
    'KoeoeoK.....',
    'KooKooK.....',
    '.KoooK......',
    '.KoOooK.....',
    'KooCOooK....',
    'KooCooOK....',
    'KoooooooKKK.',
    '.KKKKKKKKK.K',
  ],
  [
    // blink
    '.K...K......',
    'KoK.KoK.....',
    'KooKooK.....',
    'KoKoKoK.....',
    'KooKooK.....',
    '.KoooK......',
    '.KoOooK.....',
    'KooCOooK....',
    'KooCooOK..K.',
    'KoooooooK.K.',
    '.KKKKKKKKK..',
  ],
];

/** Barrel frames: a round lid with plank lines rotating as it rolls. */
function buildBarrelFrames(radius) {
  const frames = [];
  const size = radius * 2;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI;
    const canvas = makeCanvas(size, size);
    const ctx = pixelContext(canvas);
    const c = radius - 0.5;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        if (d > radius - 0.2) continue;
        let color = ENV.wood;
        if (d > radius - 1.3) color = PALETTE.charcoal;
        else if (d > radius - 2.3) color = ENV.metal;
        else {
          const across = dx * nx + dy * ny;
          if (Math.abs(across) < 0.6 || Math.abs(Math.abs(across) - 2.2) < 0.5) color = ENV.woodDark;
          else if (dx + dy < -2) color = ENV.woodLight;
        }
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    frames.push(canvas);
  }
  return frames;
}

// --- Prop drawing ------------------------------------------------------------------

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Catenary-ish sag between two points (good enough for ropes & wires). */
function sagY(x, x1, x2, y, sag) {
  const t = (x - x1) / (x2 - x1);
  return y + sag * 4 * t * (1 - t);
}

function drawRope(ctx, sx1, sx2, y, sag, color) {
  ctx.fillStyle = color;
  for (let x = sx1; x <= sx2; x++) {
    ctx.fillRect(x, Math.round(sagY(x, sx1, sx2, y, sag)), 1, 1);
  }
}

/** A soft, pixel-stepped glow circle. */
function glow(ctx, cx, cy, r, color, alpha) {
  ctx.fillStyle = color;
  for (const [k, a] of [[1, 0.35], [0.7, 0.6], [0.45, 1]]) {
    ctx.globalAlpha = alpha * a;
    fillCircle(ctx, Math.round(cx), Math.round(cy), Math.round(r * k));
  }
  ctx.globalAlpha = 1;
}

export function createArt() {
  const pigeonRight = PIGEON_FRAMES.map((f) => gridToCanvas(f, CREATURE_COLORS));
  const pigeonLeft = pigeonRight.map(mirrorCanvas);
  const catFrames = CAT_FRAMES.map((f) => gridToCanvas(f, CREATURE_COLORS));
  const barrelFrames = buildBarrelFrames(6);
  const facades = new Map();

  function facadeFor(b) {
    let facade = facades.get(b);
    if (!facade) facades.set(b, (facade = buildFacade(b)));
    return facade;
  }

  function drawBuilding(ctx, b, camX, time) {
    const sx = b.x - camX;
    if (sx > VIEW.width || sx + b.w < 0) return;
    const facade = facadeFor(b);
    ctx.drawImage(facade.canvas, sx, b.top);
    for (const win of facade.windows) {
      if (!windowLit(win, time)) continue;
      const wx = sx + win.x;
      const wy = b.top + win.y;
      rect(ctx, ENV.windowWarm, wx, wy, win.w, win.h);
      rect(ctx, ENV.windowLit, wx, wy, win.w, win.h - 3);
      rect(ctx, ENV.windowWarm, wx + 2, wy, 1, win.h); // window mullion
    }
  }

  // Each drawer gets the prop, its screen x, and the time in seconds.
  const drawers = {
    crate(ctx, p, sx) {
      rect(ctx, PALETTE.charcoal, sx, p.y, 16, 16);
      rect(ctx, ENV.wood, sx + 1, p.y + 1, 14, 14);
      rect(ctx, ENV.woodLight, sx + 1, p.y + 1, 14, 1);
      rect(ctx, ENV.woodDark, sx + 1, p.y + 5, 14, 1);
      rect(ctx, ENV.woodDark, sx + 1, p.y + 10, 14, 1);
      for (let i = 0; i < 12; i++) rect(ctx, ENV.woodDark, sx + 2 + i, p.y + 2 + i, 1, 1);
      rect(ctx, ENV.rim, sx + 15, p.y + 1, 1, 14);
    },

    acUnit(ctx, p, sx, time) {
      rect(ctx, PALETTE.charcoal, sx, p.y, 18, 12);
      rect(ctx, ENV.metal, sx + 1, p.y + 1, 16, 10);
      rect(ctx, ENV.metalLight, sx + 1, p.y + 1, 16, 1);
      rect(ctx, ENV.metalDark, sx + 3, p.y + 3, 8, 7);
      // spinning fan blades
      const f = Math.floor(time * 12) % 2;
      rect(ctx, ENV.metal, sx + (f ? 4 : 6), p.y + 6, f ? 6 : 2, f ? 1 : 1);
      rect(ctx, ENV.metal, sx + 6, p.y + (f ? 4 : 6), 1, f ? 5 : 1);
      for (let y = 3; y < 10; y += 2) rect(ctx, ENV.metalDark, sx + 13, p.y + y, 3, 1);
    },

    chimney(ctx, p, sx, time) {
      rect(ctx, PALETTE.charcoal, sx - 1, p.y - 15, 10, 15);
      rect(ctx, '#7A4A48', sx, p.y - 14, 8, 14);
      rect(ctx, '#5E3838', sx, p.y - 10, 8, 1);
      rect(ctx, '#5E3838', sx, p.y - 5, 8, 1);
      rect(ctx, ENV.rim, sx + 7, p.y - 14, 1, 14);
      rect(ctx, PALETTE.charcoal, sx - 2, p.y - 17, 12, 3);
      rect(ctx, ENV.metal, sx - 1, p.y - 17, 10, 1);
      // lazy smoke puffs
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.5 + i / 3) % 1;
        ctx.globalAlpha = 0.35 * (1 - t);
        rect(ctx, ENV.steam, sx + 3 + Math.sin(t * 5 + i) * 2 + t * 6, p.y - 20 - t * 18, 3, 2);
      }
      ctx.globalAlpha = 1;
    },

    antenna(ctx, p, sx, time) {
      rect(ctx, ENV.metalDark, sx, p.y - p.h, 1, p.h);
      rect(ctx, ENV.metalDark, sx - 4, p.y - p.h + 6, 9, 1);
      rect(ctx, ENV.metalDark, sx - 3, p.y - p.h + 12, 7, 1);
      rect(ctx, ENV.metalDark, sx - 2, p.y - 2, 5, 2);
      if (p.beacon ? Math.floor(time * 1.5) % 2 === 0 : true) {
        rect(ctx, p.beacon ? '#FF5A5A' : ENV.metal, sx, p.y - p.h - 1, 1, 1);
        if (p.beacon) glow(ctx, sx, p.y - p.h - 1, 4, '#FF5A5A', 0.35);
      }
    },

    railing(ctx, p, sx) {
      for (let x = 0; x <= p.w; x += 6) rect(ctx, ENV.metalDark, sx + x, p.y - 9, 1, 9);
      rect(ctx, ENV.metalLight, sx, p.y - 10, p.w + 1, 1);
      rect(ctx, ENV.metalDark, sx, p.y - 5, p.w + 1, 1);
    },

    sign(ctx, p, sx, time, camX, level, env) {
      const lines = env?.touch && p.touchLines ? p.touchLines : p.lines;
      const width = 36;
      const height = 5 + lines.length * 7;
      rect(ctx, ENV.woodDark, sx - 1, p.y - 12, 2, 12);
      rect(ctx, PALETTE.charcoal, sx - width / 2 - 1, p.y - 12 - height - 1, width + 2, height + 2);
      rect(ctx, ENV.uiPaper, sx - width / 2, p.y - 12 - height, width, height);
      rect(ctx, '#D8CCB6', sx - width / 2, p.y - 13, width, 1);
      lines.forEach((line, i) => {
        drawText(ctx, line, sx, p.y - 12 - height + 3 + i * 7, { align: 'center', color: PALETTE.charcoal });
      });
    },

    plants(ctx, p, sx, time) {
      const sway = Math.round(Math.sin(time * 1.5 + p.x) * 0.6);
      for (const [dx, h, leaf] of [[0, 8, '#6E8F5E'], [9, 11, '#7FA06A'], [17, 6, '#5E7F52']]) {
        rect(ctx, '#A85F45', sx + dx, p.y - 5, 7, 5);
        rect(ctx, '#C8795A', sx + dx, p.y - 5, 7, 1);
        rect(ctx, leaf, sx + dx + 2 + sway, p.y - 5 - h, 3, h);
        rect(ctx, leaf, sx + dx + sway, p.y - 5 - h + 3, 2, 2);
        rect(ctx, leaf, sx + dx + 5 + sway, p.y - 5 - h + 5, 2, 2);
      }
    },

    skylight(ctx, p, sx) {
      rect(ctx, PALETTE.charcoal, sx, p.y - 7, 22, 7);
      rect(ctx, '#7FA4B8', sx + 1, p.y - 6, 20, 6);
      rect(ctx, '#B9D6E0', sx + 3, p.y - 6, 3, 6);
      rect(ctx, '#F7C790', sx + 14, p.y - 6, 5, 2);
      rect(ctx, PALETTE.charcoal, sx + 11, p.y - 7, 1, 7);
    },

    dish(ctx, p, sx) {
      rect(ctx, ENV.metalDark, sx + 5, p.y - 8, 1, 8);
      rect(ctx, ENV.metalDark, sx + 3, p.y - 1, 5, 1);
      rect(ctx, ENV.metalLight, sx, p.y - 16, 2, 9);
      rect(ctx, ENV.metalLight, sx + 2, p.y - 17, 2, 11);
      rect(ctx, ENV.metal, sx + 4, p.y - 16, 1, 9);
      rect(ctx, ENV.metalDark, sx + 5, p.y - 13, 4, 1);
      rect(ctx, '#FF7A5A', sx + 9, p.y - 13, 1, 1);
    },

    laundry(ctx, p, sx, time) {
      const x2 = sx + (p.x2 - p.x1);
      const top = p.y - 42;
      rect(ctx, ENV.woodDark, sx, top, 2, 42);
      rect(ctx, ENV.woodDark, x2, top, 2, 42);
      rect(ctx, ENV.woodDark, sx - 2, top, 6, 1);
      rect(ctx, ENV.woodDark, x2 - 2, top, 6, 1);
      drawRope(ctx, sx + 1, x2 + 1, top + 2, 7, PALETTE.cream);
      // Clothes hanging at fixed points along the line, swaying in the breeze.
      const items = [
        [14, 'shirt', PALETTE.cream],
        [30, 'sock', PALETTE.sharkRed],
        [40, 'pants', PALETTE.camo],
        [60, 'shark', PALETTE.deepGreen],
        [80, 'towel', '#E7A077'],
        [96, 'sock', PALETTE.sage],
        [106, 'shirt', PALETTE.sage],
        [124, 'sock', PALETTE.cream],
      ];
      for (const [dx, kind, color] of items) {
        if (dx > p.x2 - p.x1 - 6) continue;
        const hx = sx + 1 + dx;
        const hy = Math.round(sagY(hx, sx + 1, x2 + 1, top + 2, 7)) + 1;
        const sway = Math.round(Math.sin(time * 2.2 + dx * 0.3) * 1.2);
        drawCloth(ctx, kind, color, hx + sway, hy);
      }
    },

    neonBlade(ctx, p, sx, time) {
      const x = sx;
      const top = p.y - 44;
      rect(ctx, ENV.metalDark, x + 3, p.y - 8, 1, 8);
      rect(ctx, ENV.metalDark, x + 9, p.y - 8, 1, 8);
      rect(ctx, PALETTE.charcoal, x, top, 13, 36);
      rect(ctx, '#3A2440', x + 1, top + 1, 11, 34);
      // Neon flickers: mostly on, with the odd stutter.
      const on = Math.sin(time * 13) > -0.92 && Math.floor(time * 3) % 17 !== 0;
      const color = on ? ENV.neonPink : ENV.neonOff;
      if (on) glow(ctx, x + 6, top + 18, 16, ENV.neonPink, 0.18);
      rect(ctx, on ? ENV.neonTeal : ENV.neonOff, x + 1, top + 1, 11, 1);
      rect(ctx, on ? ENV.neonTeal : ENV.neonOff, x + 1, top + 34, 11, 1);
      [...p.text].forEach((ch, i) => {
        drawText(ctx, ch, x + 5, top + 4 + i * 6, { color });
      });
      // A little steaming bowl on top
      rect(ctx, on ? ENV.neonTeal : ENV.neonOff, x + 2, top - 4, 9, 1);
      rect(ctx, on ? ENV.neonTeal : ENV.neonOff, x + 3, top - 3, 7, 2);
      rect(ctx, on ? ENV.neonPink : ENV.neonOff, x + 5, top - 7 + Math.round(Math.sin(time * 3)), 1, 2);
      rect(ctx, on ? ENV.neonPink : ENV.neonOff, x + 8, top - 7 + Math.round(Math.cos(time * 3)), 1, 2);
    },

    waterTower(ctx, p, sx) {
      const tankTop = p.y - 48;
      const catwalk = p.y - 26;
      // legs + cross braces
      for (const lx of [2, 17, 32]) rect(ctx, ENV.woodDark, sx + lx, catwalk, 2, 26);
      for (let i = 0; i < 13; i++) {
        rect(ctx, ENV.woodDark, sx + 3 + i, catwalk + 12 - i, 1, 1);
        rect(ctx, ENV.woodDark, sx + 18 + i, catwalk + 1 + i, 1, 1);
      }
      // tank staves
      rect(ctx, PALETTE.charcoal, sx - 1, tankTop, 38, 23);
      rect(ctx, ENV.wood, sx, tankTop + 1, 36, 21);
      for (let x = 3; x < 36; x += 4) rect(ctx, ENV.woodDark, sx + x, tankTop + 1, 1, 21);
      rect(ctx, ENV.woodLight, sx, tankTop + 1, 36, 1);
      rect(ctx, ENV.metalDark, sx, tankTop + 6, 36, 1);
      rect(ctx, ENV.metalDark, sx, tankTop + 15, 36, 1);
      rect(ctx, ENV.rim, sx + 35, tankTop + 1, 1, 21);
      // flat lid with a little cap
      rect(ctx, PALETTE.charcoal, sx - 2, tankTop - 1, 40, 2);
      rect(ctx, ENV.roofTop, sx - 1, tankTop - 1, 38, 1);
      rect(ctx, ENV.metalDark, sx + 16, tankTop - 4, 4, 3);
      // catwalk with railing
      rect(ctx, ENV.metalDark, sx - 8, catwalk, 52, 3);
      rect(ctx, ENV.metalLight, sx - 8, catwalk, 52, 1);
      for (let x = -8; x <= 44; x += 6) rect(ctx, ENV.metalDark, sx + x, catwalk - 7, 1, 7);
      rect(ctx, ENV.metal, sx - 8, catwalk - 8, 53, 1);
    },

    shed(ctx, p, sx) {
      rect(ctx, PALETTE.charcoal, sx - 1, p.y - 23, 30, 23);
      rect(ctx, '#6B5060', sx, p.y - 22, 28, 22);
      rect(ctx, '#58404F', sx, p.y - 22, 28, 3);
      rect(ctx, ENV.roofTop, sx - 1, p.y - 24, 30, 1);
      rect(ctx, '#1C1422', sx + 5, p.y - 16, 12, 16); // doorway (barrels roll out)
      rect(ctx, '#2C2034', sx + 5, p.y - 16, 12, 2);
      rect(ctx, ENV.windowLit, sx + 21, p.y - 16, 4, 4);
      rect(ctx, ENV.rim, sx + 27, p.y - 22, 1, 22);
    },

    pole(ctx, p, sx) {
      rect(ctx, ENV.woodDark, sx, p.y - 44, 2, 44);
      rect(ctx, ENV.woodDark, sx - 5, p.y - 42, 12, 2);
      rect(ctx, ENV.metalLight, sx - 5, p.y - 43, 1, 1);
      rect(ctx, ENV.metalLight, sx + 6, p.y - 43, 1, 1);
    },

    wire(ctx, p, sx, time, camX) {
      const x2 = p.x2 - camX;
      drawRope(ctx, sx, x2, p.y, 9, PALETTE.charcoal);
      p.birds.forEach((bx, i) => {
        const x = bx - camX;
        const y = Math.round(sagY(x, sx, x2, p.y, 9));
        const bob = Math.floor(time * 1.3 + i * 1.7) % 5 === 0 ? 1 : 0;
        const frame = bob ? pigeonRight[1] : pigeonRight[0];
        const img = i % 2 ? frame : mirrorPigeon(frame);
        ctx.drawImage(img, Math.round(x - 6), y - 9 + bob);
      });
    },

    lamp(ctx, p, sx, time) {
      glow(ctx, sx + 7, p.y - 30, 22, '#FFD27E', 0.16);
      rect(ctx, PALETTE.charcoal, sx, p.y - 34, 2, 34);
      rect(ctx, PALETTE.charcoal, sx, p.y - 34, 8, 2);
      rect(ctx, PALETTE.charcoal, sx + 5, p.y - 33, 5, 3);
      rect(ctx, '#FFF0C2', sx + 6, p.y - 30, 3, 1);
      rect(ctx, PALETTE.charcoal, sx - 2, p.y - 2, 6, 2);
      if (p.moths) {
        for (let i = 0; i < 3; i++) {
          const t = time * (2.1 + i * 0.7) + i * 2;
          rect(ctx, '#F6E7C4', sx + 7 + Math.cos(t) * (5 + i), p.y - 30 + Math.sin(t * 1.3) * 4, 1, 1);
        }
      }
      // pool of light on the roof
      ctx.globalAlpha = 0.18;
      rect(ctx, '#FFD27E', sx - 4, p.y - 1, 24, 1);
      ctx.globalAlpha = 1;
    },

    bridge(ctx, p, sx) {
      const w = p.w;
      // arch truss: a pixel arc with vertical hangers
      ctx.fillStyle = '#6C5A70';
      for (let x = 0; x <= w; x++) {
        const t = x / w;
        const y = Math.round(p.y - 4 - 26 * 4 * t * (1 - t));
        ctx.fillRect(sx + x, y, 1, 2);
        if (x % 10 === 0) ctx.fillRect(sx + x, y, 1, p.y - y);
      }
      ctx.fillStyle = '#8B7890';
      for (let x = 0; x <= w; x++) {
        const t = x / w;
        ctx.fillRect(sx + x, Math.round(p.y - 4 - 26 * 4 * t * (1 - t)), 1, 1);
      }
      // deck
      rect(ctx, PALETTE.charcoal, sx, p.y, w, 6);
      rect(ctx, '#7A6680', sx, p.y + 1, w, 3);
      rect(ctx, ENV.roofTop, sx, p.y, w, 1);
      for (let x = 3; x < w; x += 8) rect(ctx, '#5A4A60', sx + x, p.y + 2, 1, 1);
      // underside girders fading into the dark
      for (let x = 0; x < w; x += 20) {
        for (let i = 0; i < 9; i++) rect(ctx, '#3D2F45', sx + x + i, p.y + 5 + i, 1, 1);
        for (let i = 0; i < 9; i++) rect(ctx, '#3D2F45', sx + x + 19 - i, p.y + 5 + i, 1, 1);
      }
    },

    billboard(ctx, p, sx, time) {
      const top = p.y - 66;
      const w = p.w;
      // legs from catwalk to roof
      for (const lx of [16, w - 18]) {
        rect(ctx, ENV.metalDark, sx + lx, p.y - 26, 3, 26);
        for (let i = 0; i < 8; i++) rect(ctx, ENV.metalDark, sx + lx + 3 + i, p.y - 24 + i * 3, 1, 1);
      }
      // board
      rect(ctx, PALETTE.charcoal, sx - 1, top - 1, w + 2, 38);
      rect(ctx, '#F3D9A6', sx, top, w, 36);
      rect(ctx, '#F7E7C4', sx, top, w, 12);
      rect(ctx, '#E8B982', sx, top + 30, w, 6);
      drawShark(ctx, sx + 10, top + 6, time);
      drawText(ctx, 'SHARK', sx + 108, top + 6, { font: BIG, align: 'center', color: PALETTE.sharkRed });
      drawText(ctx, 'SODA', sx + 108, top + 16, { font: BIG, align: 'center', color: PALETTE.deepGreen });
      drawText(ctx, 'BITE THE DUSK!', sx + 108, top + 27, { align: 'center', color: '#9C6A4B' });
      // soda can
      rect(ctx, PALETTE.charcoal, sx + 70, top + 12, 9, 16);
      rect(ctx, PALETTE.sharkRed, sx + 71, top + 13, 7, 14);
      rect(ctx, PALETTE.cream, sx + 71, top + 18, 7, 3);
      rect(ctx, ENV.metalLight, sx + 71, top + 13, 7, 1);
      // spotlights on the catwalk shining up
      for (const lx of [8, w / 2, w - 10]) {
        rect(ctx, PALETTE.charcoal, sx + lx, p.y - 30, 3, 3);
        ctx.globalAlpha = 0.14;
        rect(ctx, '#FFF0C2', sx + lx - 3, top + 16, 9, 12);
        ctx.globalAlpha = 1;
      }
      // catwalk
      rect(ctx, ENV.metalDark, sx - 4, p.y - 26, w + 8, 3);
      rect(ctx, ENV.metalLight, sx - 4, p.y - 26, w + 8, 1);
    },

    cat(ctx, p, sx, time) {
      const cycle = time % 4;
      const frame = cycle > 3.85 ? 2 : Math.floor(time * 1.2) % 2;
      ctx.drawImage(catFrames[frame], sx - 5, p.y - 11);
    },

    firstStar(ctx, p, sx, time, camX, level) {
      // Parallax: appears at its designed spot when the camera reaches the end.
      const anchor = level.width - VIEW.width;
      const x = Math.round(p.x - anchor + (anchor - camX) * 0.25);
      if (x < -10 || x > VIEW.width + 10) return;
      const pulse = 0.75 + 0.25 * Math.sin(time * 3);
      glow(ctx, x, p.y, 7, '#FFF4D6', 0.3 * pulse);
      rect(ctx, '#FFF4D6', x - 1, p.y - 1, 3, 3);
      ctx.globalAlpha = pulse;
      rect(ctx, '#FFF4D6', x - 4, p.y, 9, 1);
      rect(ctx, '#FFF4D6', x, p.y - 4, 1, 9);
      ctx.globalAlpha = 1;
      rect(ctx, '#FFFFFF', x, p.y, 1, 1);
    },
  };

  const mirroredPigeons = new Map();
  function mirrorPigeon(img) {
    if (!mirroredPigeons.has(img)) mirroredPigeons.set(img, mirrorCanvas(img));
    return mirroredPigeons.get(img);
  }

  /** Screen position of the first star (used to frame the final photo). */
  function starPosition(level, camX) {
    const star = level.props.find((p) => p.type === 'firstStar');
    const anchor = level.width - VIEW.width;
    return { x: Math.round(star.x - anchor + (anchor - camX) * 0.25), y: star.y };
  }

  /** `env` carries render-time context such as { touch } for sign text. */
  function drawProp(ctx, prop, camX, time, level, env) {
    const sx = Math.round((prop.x ?? prop.x1) - camX);
    const right = prop.x2 !== undefined ? prop.x2 - camX : sx + (prop.w || 40);
    if (prop.type !== 'firstStar' && (right < -60 || sx > VIEW.width + 60)) return;
    drawers[prop.type]?.(ctx, prop, sx, time, camX, level, env);
  }

  return {
    drawBuilding,
    drawProp,
    starPosition,
    pigeonFrames: { right: pigeonRight, left: pigeonLeft },
    barrelFrames,
  };
}

/** Tiny laundry items hanging from (x, y). */
function drawCloth(ctx, kind, color, x, y) {
  const K = PALETTE.charcoal;
  if (kind === 'shirt') {
    rect(ctx, color, x - 4, y, 9, 3);
    rect(ctx, color, x - 2, y + 3, 5, 6);
    rect(ctx, 'rgba(0,0,0,0.15)', x - 2, y + 7, 5, 2);
  } else if (kind === 'shark') {
    // Zenyu's spare hoodie, of course.
    rect(ctx, color, x - 4, y, 9, 3);
    rect(ctx, PALETTE.cream, x - 5, y + 1, 2, 4);
    rect(ctx, PALETTE.cream, x + 4, y + 1, 2, 4);
    rect(ctx, color, x - 3, y + 3, 7, 7);
    rect(ctx, PALETTE.sharkRed, x - 1, y + 5, 3, 2);
    rect(ctx, PALETTE_EXTRA.white, x - 1, y + 5, 1, 1);
    rect(ctx, PALETTE_EXTRA.white, x + 1, y + 6, 1, 1);
  } else if (kind === 'pants') {
    rect(ctx, color, x - 3, y, 7, 3);
    rect(ctx, color, x - 3, y + 3, 3, 8);
    rect(ctx, color, x + 1, y + 3, 3, 8);
    rect(ctx, PALETTE_EXTRA.camoDark, x - 2, y + 4, 2, 2);
    rect(ctx, PALETTE_EXTRA.camoDark, x + 2, y + 7, 1, 2);
  } else if (kind === 'towel') {
    rect(ctx, color, x - 3, y, 7, 9);
    rect(ctx, PALETTE.cream, x - 3, y + 6, 7, 1);
  } else {
    rect(ctx, color, x, y, 2, 5);
    rect(ctx, color, x, y + 4, 3, 2);
  }
  rect(ctx, K, x, y - 1, 1, 1); // peg
}

/** The Shark Soda mascot — a friendly shark with Zenyu's toothy grin. */
function drawShark(ctx, x, y, time) {
  const grey = '#7C95A6';
  const light = '#B7CBD6';
  const K = PALETTE.charcoal;
  const bob = Math.round(Math.sin(time * 2) * 1);
  y += bob;
  rect(ctx, K, x + 4, y + 2, 46, 18);
  rect(ctx, grey, x + 5, y + 3, 44, 16);
  rect(ctx, light, x + 5, y + 13, 44, 6);
  rect(ctx, K, x + 22, y - 5, 10, 8); // fin
  rect(ctx, grey, x + 23, y - 4, 8, 7);
  rect(ctx, K, x, y + 6, 6, 10); // tail
  rect(ctx, grey, x + 1, y + 7, 4, 8);
  // mouth: red with white teeth
  rect(ctx, K, x + 30, y + 10, 18, 7);
  rect(ctx, PALETTE.sharkRed, x + 31, y + 11, 16, 5);
  rect(ctx, PALETTE_EXTRA.mouthPink, x + 33, y + 13, 12, 2);
  for (let i = 0; i < 8; i++) {
    rect(ctx, PALETTE_EXTRA.white, x + 31 + i * 2, y + 11, 1, 1);
    rect(ctx, PALETTE_EXTRA.white, x + 32 + i * 2, y + 15, 1, 1);
  }
  rect(ctx, K, x + 38, y + 6, 3, 3); // eye
  rect(ctx, PALETTE_EXTRA.white, x + 38, y + 6, 1, 1);
  // bubbles
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.6 + i / 3) % 1;
    rect(ctx, '#FFFFFF', x + 52 + i * 3, y + 4 - t * 10, 1, 1);
  }
}
