// ---------------------------------------------------------------------------
// sprites.js — Zenyu's sprite: loads assets/zenyu.png if present, otherwise
// builds a procedural atlas from pixel grids. Both modes produce the same
// "atlas" shape so the renderer never needs to know which one is active.
// ---------------------------------------------------------------------------

import { PALETTE, PALETTE_EXTRA, SPRITE_SHEET } from './config.js';
import { makeCanvas, pixelContext, paintGrid, mirrorCanvas } from './pixelgrid.js';

/** Palette keys used in Zenyu's pixel grids. */
const ZENYU_COLORS = {
  K: PALETTE.charcoal, // outline, eyes, camera, backpack
  B: PALETTE.charcoal, // backpack body
  b: PALETTE_EXTRA.charcoalLight, // backpack highlight
  G: PALETTE.deepGreen,
  D: PALETTE_EXTRA.deepGreenDark,
  g: PALETTE.sage,
  C: PALETTE.cream,
  x: PALETTE.warmGrey,
  H: PALETTE_EXTRA.white, // hair
  h: PALETTE.cream, // hair shadow
  s: PALETTE_EXTRA.skin,
  S: PALETTE_EXTRA.skinShade,
  R: PALETTE.sharkRed,
  p: PALETTE_EXTRA.mouthPink,
  W: PALETTE_EXTRA.white,
  M: PALETTE.camo,
  m: PALETTE_EXTRA.camoDark,
  L: PALETTE_EXTRA.lens,
};

const FRAME_W = 24;
const FRAME_H = 32;

// --- Parts -----------------------------------------------------------------
// Every part is authored in full-frame coordinates (24 columns wide) so parts
// line up without offset bookkeeping. Rows start at the `y` given with them.

/** Head with ear-flaps hanging down (rows 0–20). */
const HEAD_DOWN = [
  '........................', // 0
  '........................', // 1
  '......KK........KK......', // 2  ears
  '.....KCCKKKKKKKKCCK.....', // 3
  '....KCxKGGDGGDGGKxCK....', // 4
  '....KKGDGGDGGDGgDGKK....', // 5  knit ribs + sunlit highlight
  '....KGGDGGDGGDGgDgGK....', // 6
  '....KGGDGGDGGDGGDgGK....', // 7
  '....KGGDGGDGGDGGDGGK....', // 8
  '....KCCCCCCCCCCCCCCK....', // 9  cream stripe
  '....KxCCCCCCCCCCCCxK....', // 10
  '...KDGGGGGGGGGGGGGGDK...', // 11 brim
  '...KDHHHhHHHHhHHHHHDK...', // 12 messy fringe
  '...KDHhHHHhHHHHhHHhDK...', // 13
  '...KDhHsHKKsHsKKsHhDK...', // 14 eyes (face rows are swappable)
  '...KDGhssKLsssKLssKDK...', // 15
  '...KDGKSssssssSssSKDK...', // 16
  '...KDGKKSssssssssKKDK...', // 17
  '...KDGGKKKKKKKKKKKGDK...', // 18 jaw
  '...KDGK..........KGDK...', // 19 flap tips
  '....KK............KK....', // 20
];

/** Head with ear-flaps fluttering up and out (used while falling / hurt). */
const HEAD_UP = [
  ...HEAD_DOWN.slice(0, 11),
  '..KKDGGGGGGGGGGGGGGDKK..', // 11
  '.KDGKHHHhHHHHhHHHHHKGDK.', // 12
  'KDGKKHhHHHhHHHHhHHhKKGDK', // 13
  'KKK.KhHsHKKsHsKKsHhK.KKK', // 14
  '.....KhssKLsssKLssK.....', // 15
  '......KSssssssSssSK.....', // 16
  '.......KSssssssssK......', // 17
  '.......KKKKKKKKKKK......', // 18
  '........................', // 19
  '........................', // 20
];

/** Face overrides for rows 14–15, columns 6–17 (12 px). */
const FACES = {
  normal: null,
  blink: ['HsHsssHssssH', 'hssKKsssKKss'],
  wink: ['HsHsssHsKKsH', 'hssKKsssKLss'], // left eye squeezed shut behind the camera
  hurt: ['HsHKssHssKsH', 'hsssKsssKsss'],
};

/** Jacket, backpack and shark-mouth print (rows 19–24). */
const TORSO = [
  '....KKKGGGGGCGGGGKK.....', // 19 collar + zip
  '....KBbKGGGGCGGggK......', // 20 sage shoulder
  '....KBbKGWRWRWRWGK......', // 21 shark teeth
  '....KBbKGRpppppRGK......', // 22
  '....KBbKGWRWRWRWGK......', // 23
  '....KBBKDGDGCGDGDK......', // 24 ribbed hem
];

/** Right arm + camera overlays. `y` is the first row. */
const ARMS = {
  // Camera held at the hip (idle / walk).
  hip: {
    y: 19,
    rows: [
      '................KK......',
      '...............ggKK.....',
      '................gCCK....',
      '................KCCKK...',
      '...............KKKKKKK..',
      '...............KsKKLWK..',
      '...............KKKKKKK..',
    ],
  },
  // Camera lifted to the chest — first frame of the photo pose.
  chest: {
    y: 18,
    rows: [
      '................KK......',
      '...............gggK.....',
      '.............KKKKKKKK...',
      '............sKKKKKLWKK..',
      '.............KKKKKKKKK..',
      '..............KsCCK.....',
      '...............KKK......',
    ],
  },
  // Camera at the eye — the shutter moment.
  eye: {
    y: 13,
    rows: [
      '..............KKKK......',
      '.............KKKKKKKK...',
      '.............KKKKKLWKK..',
      '............sKKKKKKKKK..',
      '..............KsKKsK....',
      '...............KCCK.....',
      '...............KCCK.....',
      '..............ggKK......',
    ],
  },
  // Camera raised overhead to keep it safe mid-air.
  up: {
    y: 14,
    rows: [
      '..................KKKK..',
      '.................KKKKKKK',
      '.................KKKKLWK',
      '................sKKKKKKK',
      '................KCCK....',
      '...............KCCK.....',
      '...............gCK......',
    ],
  },
};

/** Legs (rows 25–31). */
const LEGS = {
  stand: [
    '......KMMMmmMMMMMK......',
    '......KMMmmMMMMMmMK.....',
    '......KMMMMMKMmmmmK.....',
    '......KmMMMMKMmMMmK.....',
    '......KMMmMMKMmmmmK.....',
    '.....KCCCCCKKCCCCCCK....',
    '.....KxxxxxxKxxxxxxxK...',
  ],
  // Near leg forward, far leg back.
  strideA: [
    '......KMMMmmMMMMMK......',
    '.....KMMmmMMMMMmMMK.....',
    '.....KMMMMKKMMmmmmMK....',
    '....KmMMMK.KMMmMMmMK....',
    '....KMMmMK..KMmmmmMMK...',
    '...KCCCCCK..KKCCCCCCK...',
    '...KxxxxxK...KxxxxxxxK..',
  ],
  // Legs passing, near foot lifted.
  passA: [
    '......KMMMmmMMMMMK......',
    '......KMMmmMMMMMmMK.....',
    '......KMMMMMKMmmmmK.....',
    '......KmMMMMKMmMMmK.....',
    '......KMMmMMKKCCCCCCK...',
    '.....KCCCCCK.KxxxxxxK...',
    '.....KxxxxxxK...........',
  ],
  // Far leg forward, near leg back (pocket swaps sides).
  strideB: [
    '......KMMMmmMMMMMK......',
    '.....KMMmmMMMMMmMMK.....',
    '.....KMmmmmKKMMMMMMK....',
    '....KMmMMmK.KMMmMMMK....',
    '....KMmmmmK..KMMMmMMK...',
    '...KCCCCCK..KKCCCCCCK...',
    '...KxxxxxK...KxxxxxxxK..',
  ],
  // Legs passing, far foot lifted.
  passB: [
    '......KMMMmmMMMMMK......',
    '......KMMmmMMMMMmMK.....',
    '......KMMMMMKMmmmmK.....',
    '......KmMMMMKMmMMmK.....',
    '.....KCCCCCKKMmmmmK.....',
    '.....KxxxxxK.KCCCCCCK...',
    '.............KxxxxxxxK..',
  ],
  // Knees tucked for the jump.
  tuck: [
    '......KMMMmmMMMMMK......',
    '.....KMMmmMMMMMmMMK.....',
    '....KMMMMMKKMMmmmmMK....',
    '....KCCCCCK.KCCCCCCK....',
    '....KxxxxxK.KxxxxxxK....',
    '........................',
    '........................',
  ],
  // Legs dangling while falling.
  dangle: [
    '......KMMMmmMMMMMK......',
    '.....KMMmmMMMMMmMMK.....',
    '.....KMMMMKKMMmmmmK.....',
    '.....KmMMMK.KMmMMmK.....',
    '....KCCCCCK..KCCCCCK....',
    '....KxxxxxK..KxxxxxK....',
    '........................',
  ],
};

/**
 * Frame recipes. `bob` shifts head + arm down (positive) or up (negative)
 * by whole pixels, which gives the idle breathing and walking bounce.
 */
const RECIPES = {
  idle: [
    { head: 'down', face: 'normal', arm: 'hip', legs: 'stand', bob: 0 },
    { head: 'down', face: 'normal', arm: 'hip', legs: 'stand', bob: 1 },
  ],
  walk: [
    { head: 'down', face: 'normal', arm: 'hip', legs: 'strideA', bob: 0 },
    { head: 'down', face: 'normal', arm: 'hip', legs: 'passA', bob: -1 },
    { head: 'down', face: 'normal', arm: 'hip', legs: 'strideB', bob: 0 },
    { head: 'down', face: 'normal', arm: 'hip', legs: 'passB', bob: -1 },
  ],
  jump: [{ head: 'down', face: 'normal', arm: 'up', legs: 'tuck', bob: 0 }],
  fall: [{ head: 'up', face: 'normal', arm: 'up', legs: 'dangle', bob: 0 }],
  photo: [
    { head: 'down', face: 'normal', arm: 'chest', legs: 'stand', bob: 0 },
    { head: 'down', face: 'wink', arm: 'eye', legs: 'stand', bob: 0 },
  ],
  hurt: [{ head: 'up', face: 'hurt', arm: 'up', legs: 'dangle', bob: 0 }],
  blink: [{ head: 'down', face: 'blink', arm: 'hip', legs: 'stand', bob: 0 }],
};

/** Animation timing for the procedural atlas (rows follow RECIPES order). */
const PROCEDURAL_ANIMS = {
  idle: { fps: 2 },
  walk: { fps: 10 },
  jump: { fps: 1 },
  fall: { fps: 1 },
  photo: { fps: 8 },
  hurt: { fps: 1 },
  blink: { fps: 1 },
};

/** Swap the eye rows of a head for another expression. */
function withFace(head, faceName) {
  const face = FACES[faceName];
  if (!face) return head;
  const rows = head.slice();
  rows[14] = rows[14].slice(0, 6) + face[0] + rows[14].slice(18);
  rows[15] = rows[15].slice(0, 6) + face[1] + rows[15].slice(18);
  return rows;
}

/** Paint one frame recipe into `ctx` at the frame's top-left corner. */
function paintFrame(ctx, recipe, ox, oy) {
  const head = withFace(recipe.head === 'up' ? HEAD_UP : HEAD_DOWN, recipe.face);
  const arm = ARMS[recipe.arm];
  // Draw order: legs → torso → head → arm, so the camera sits on top.
  paintGrid(ctx, LEGS[recipe.legs], ZENYU_COLORS, ox, oy + 25);
  paintGrid(ctx, TORSO, ZENYU_COLORS, ox, oy + 19);
  paintGrid(ctx, head, ZENYU_COLORS, ox, oy + recipe.bob);
  paintGrid(ctx, arm.rows, ZENYU_COLORS, ox, oy + arm.y + recipe.bob);
}

/** Build the procedural atlas: one row per animation, frames left→right. */
function buildProceduralAtlas() {
  const names = Object.keys(RECIPES);
  const columns = Math.max(...names.map((n) => RECIPES[n].length));
  const canvas = makeCanvas(columns * FRAME_W, names.length * FRAME_H);
  const ctx = pixelContext(canvas);
  const animations = {};
  names.forEach((name, row) => {
    RECIPES[name].forEach((recipe, col) => paintFrame(ctx, recipe, col * FRAME_W, row * FRAME_H));
    animations[name] = { row, frames: RECIPES[name].length, fps: PROCEDURAL_ANIMS[name].fps };
  });
  return {
    image: canvas,
    frameWidth: FRAME_W,
    frameHeight: FRAME_H,
    anchorX: FRAME_W / 2,
    anchorY: FRAME_H,
    animations,
  };
}

/** Load an image, resolving to null (never rejecting) if it is missing. */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Check that a loaded sheet is big enough for the configured layout. */
function sheetFitsLayout(img, sheet) {
  return Object.values(sheet.animations).every(
    (a) =>
      (a.row + 1) * sheet.frameHeight <= img.height && a.frames * sheet.frameWidth <= img.width,
  );
}

/**
 * Wrap an atlas (sheet or procedural) with a mirrored copy and a single
 * `draw` function used by every screen.
 */
function createSpriteSet(atlas, mode) {
  const mirrored = mirrorCanvas(atlas.image);
  const anims = atlas.animations;

  /** Resolve optional animations to sensible fallbacks. */
  function resolve(name) {
    if (anims[name]) return anims[name];
    if (name === 'fall') return anims.jump || anims.idle;
    return anims.idle;
  }

  /** Frame index for an animation at `time` seconds (photo/jump don't loop). */
  function frameAt(name, time, loop = true) {
    const anim = resolve(name);
    const index = Math.floor(time * anim.fps);
    return loop ? index % anim.frames : Math.min(index, anim.frames - 1);
  }

  /**
   * Draw a frame with its feet at (x, y). `facing` is 1 (right) or -1 (left).
   * `scaleX/scaleY` implement squash & stretch while keeping feet planted.
   */
  function draw(ctx, name, frame, x, y, facing = 1, scaleX = 1, scaleY = 1) {
    const anim = resolve(name);
    const fw = atlas.frameWidth;
    const fh = atlas.frameHeight;
    const index = Math.max(0, Math.min(frame, anim.frames - 1));
    const flip = facing < 0;
    const image = flip ? mirrored : atlas.image;
    const sx = flip ? atlas.image.width - (index + 1) * fw : index * fw;
    const sy = anim.row * fh;
    const ax = flip ? fw - atlas.anchorX : atlas.anchorX;
    const dw = Math.round(fw * scaleX);
    const dh = Math.round(fh * scaleY);
    const dx = Math.round(x - ax * (dw / fw));
    const dy = Math.round(y - atlas.anchorY * (dh / fh));
    ctx.drawImage(image, sx, sy, fw, fh, dx, dy, dw, dh);
  }

  return { mode, atlas, draw, frameAt, has: (name) => Boolean(anims[name]) };
}

/**
 * Load Zenyu's sprites. Tries the sprite sheet first and falls back to the
 * procedural atlas on any problem. Never throws.
 */
export async function loadZenyuSprites(spriteUrl) {
  const url = spriteUrl || new URL(SPRITE_SHEET.src, import.meta.url).href;
  const img = await loadImage(url);
  if (img && sheetFitsLayout(img, SPRITE_SHEET)) {
    console.info(`[Zenyu] Sprite sheet loaded from ${url} — using sheet mode.`);
    return createSpriteSet({ ...SPRITE_SHEET, image: img }, 'sheet');
  }
  if (img) {
    console.info(
      '[Zenyu] zenyu.png was found but is smaller than SPRITE_SHEET in config.js expects — ' +
        'using the procedural pixel sprite instead.',
    );
  } else {
    console.info(
      '[Zenyu] No assets/zenyu.png found (that is fine!) — drawing Zenyu procedurally from pixel grids.',
    );
  }
  return createSpriteSet(buildProceduralAtlas(), 'procedural');
}

/** Synchronous access to the procedural set (used by the sprite preview tool). */
export function createProceduralSprites() {
  return createSpriteSet(buildProceduralAtlas(), 'procedural');
}
