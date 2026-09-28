// ---------------------------------------------------------------------------
// sprites.js — Zenyu's sprite: loads assets/zenyu.png if present, otherwise
// builds a procedural atlas from pixel grids. Both modes produce the same
// "atlas" shape so the renderer never needs to know which one is active.
//
// The procedural Zenyu follows the character reference sheet
// (docs/reference/zenyu-character-sheet.png): a bell-shaped green beanie with
// cream bear ears, a bobble and two cream stripes, long ear-flaps, messy
// white hair, calm dark eyes, the shark-mouth jacket with big cream sleeves,
// baggy camo pants, chunky sneakers and a black camera with a gold lens.
// ---------------------------------------------------------------------------

import { PALETTE, PALETTE_EXTRA, SPRITE_SHEET } from './config.js';
import { makeCanvas, pixelContext, paintGrid, mirrorCanvas } from './pixelgrid.js';

/** Palette keys used in Zenyu's pixel grids. */
const ZENYU_COLORS = {
  K: PALETTE.charcoal, // outline, eyes, camera body
  B: PALETTE.charcoal, // backpack straps
  k: PALETTE_EXTRA.charcoalLight, // camera / strap-toggle highlight
  G: PALETTE.deepGreen, // beanie, flaps, jacket
  D: PALETTE_EXTRA.deepGreenDark, // knit ribs, shadow side
  g: PALETTE.sage, // upper sleeves, beanie sheen
  C: PALETTE.cream, // beanie stripes + ears, sleeves, shark belly, sneakers
  x: PALETTE.warmGrey, // cream shading, knit ribbing, soles
  H: PALETTE_EXTRA.white, // hair
  h: PALETTE_EXTRA.hairShade,
  s: PALETTE_EXTRA.skin,
  S: PALETTE_EXTRA.skinShade, // mouth
  b: PALETTE_EXTRA.blush,
  L: PALETTE_EXTRA.lens, // lower iris, lens glass
  R: PALETTE.sharkRed,
  p: PALETTE_EXTRA.mouthPink, // shark tongue
  W: PALETTE_EXTRA.white, // shark teeth
  M: PALETTE.camo,
  m: PALETTE_EXTRA.camoDark,
  n: PALETTE_EXTRA.camoLight,
  Y: PALETTE_EXTRA.lensGold, // the camera's gold lens ring
};

const FRAME_W = 32;
const FRAME_H = 42;

// --- Parts -----------------------------------------------------------------
// Every part is authored in full-frame columns (32 wide) so parts line up
// without offset bookkeeping. Heads start at frame row 0, torsos at row 22,
// legs at row 35. Each part carries its own 1px outline.

/** Heads (frame rows 0-22). */
const HEADS = {
  // Ear-flaps hanging down, calm face (idle, walk, jump).
  down: [
    '......KCCK.KKKGGGGKKKKCCKK......', // bobble
    '.....KCCCCKGGGGGGGGGGKCCCCK.....', // bear ears + bell-shaped knit dome
    '.....KCxxCGGGGGGGGGgGGCxxCK.....',
    '......KKDDDGGDGGDGGDgGDGKK......',
    '......KDDGDGGDGGDGGDGgDGGK......',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '....KCCCCCCCCCCCCCCCCCCCCCCK....', // wide cream stripe
    '....KCxCCxCCxCCxCCxCCxCCxCCK....',
    '....KGGGGGGGGGGGGGGGGGGGGGGK....', // green line
    '...KDGGCCxCCxCCxCCxCCxCCxGGDK...', // thin cream stripe
    '...KDGGDDDDDDDDDDDDDDDDDDGGDK...', // brim
    '..KDGGGKhHHHHHHHHHHHHHHhKGGGDK..', // jagged white fringe
    '..KDGGKKhHHHHHHHHHHHHHHhKKGGDK..',
    '..KDGGKHhHhshHhHHshshHHhHKGGDK..',
    '.KDGGGKHHHsKKKsHhsKKKhHhHHGGGDK.', // eyes
    '.KDGGKKhHhsKKKshssKKKshhHhKGGDK.',
    '.KDGGKKHhssLLLssssLLLsshHKKGGDK.',
    '.KDGGKKhKsbssssssssssbsKhKKGGDK.', // blush
    '.KDGGK.K.KsssssSSsssssK.K.KGGDK.', // mouth
    '..KDGK....KKssssssssKK....KGDK..',
    '...KK.......KKKKKKKK.......KK...',
  ],
  // Ear-flaps fluttering up and out (falling).
  up: [
    '......KCCK.KKKGGGGKKKKCCKK......',
    '.....KCCCCKGGGGGGGGGGKCCCCK.....',
    '.....KCxxCGGGGGGGGGgGGCxxCK.....',
    '......KKDDDGGDGGDGGDgGDGKK......',
    '......KDDGDGGDGGDGGDGgDGGK......',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '....KCCCCCCCCCCCCCCCCCCCCCCK....',
    '..KKKCxCCxCCxCCxCCxCCxCCxCCKKK..',
    '.KGGGGGGGGGGGGGGGGGGGGGGGGGGGGK.',
    'KGGGGGxCCxCCxCCxCCxCCxCCxCGGGGGK',
    'GGGDDKDDDDDDDDDDDDDDDDDDDDKDDGGG',
    'GDDKK.KKhHHHHHHHHHHHHHHhKK.KKDDG',
    'KKK....KhHHHHHHHHHHHHHHhK....KKK',
    '......KHhHhshHhHHshshHHhHK......',
    '......KHHHsKKKsHhsKKKhHhHHK.....',
    '......KhHhsKKKshssKKKshhHhK.....',
    '......KHhssLLLssssLLLsshHK......',
    '......KhKsbssssssssssbsKhK......',
    '.......K.KsssssSSsssssK.K.......',
    '..........KKssssssssKK..........',
    '............KKKKKKKK............',
  ],
  // Eyes closed for a blink.
  blink: [
    '......KCCK.KKKGGGGKKKKCCKK......',
    '.....KCCCCKGGGGGGGGGGKCCCCK.....',
    '.....KCxxCGGGGGGGGGgGGCxxCK.....',
    '......KKDDDGGDGGDGGDgGDGKK......',
    '......KDDGDGGDGGDGGDGgDGGK......',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '....KCCCCCCCCCCCCCCCCCCCCCCK....',
    '....KCxCCxCCxCCxCCxCCxCCxCCK....',
    '....KGGGGGGGGGGGGGGGGGGGGGGK....',
    '...KDGGCCxCCxCCxCCxCCxCCxGGDK...',
    '...KDGGDDDDDDDDDDDDDDDDDDGGDK...',
    '..KDGGGKhHHHHHHHHHHHHHHhKGGGDK..',
    '..KDGGKKhHHHHHHHHHHHHHHhKKGGDK..',
    '..KDGGKHhHhshHhHHshshHHhHKGGDK..',
    '.KDGGGKHHHssshsHhsssshHhHHGGGDK.',
    '.KDGGKKhHhsKKKshssKKKshhHhKGGDK.',
    '.KDGGKKHhsssssssssssssshHKKGGDK.',
    '.KDGGKKhKsbssssssssssbsKhKKGGDK.',
    '.KDGGK.K.KsssssSSsssssK.K.KGGDK.',
    '..KDGK....KKssssssssKK....KGDK..',
    '...KK.......KKKKKKKK.......KK...',
  ],
  // Left eye squeezed shut behind the camera.
  wink: [
    '......KCCK.KKKGGGGKKKKCCKK......',
    '.....KCCCCKGGGGGGGGGGKCCCCK.....',
    '.....KCxxCGGGGGGGGGgGGCxxCK.....',
    '......KKDDDGGDGGDGGDgGDGKK......',
    '......KDDGDGGDGGDGGDGgDGGK......',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '....KCCCCCCCCCCCCCCCCCCCCCCK....',
    '....KCxCCxCCxCCxCCxCCxCCxCCK....',
    '....KGGGGGGGGGGGGGGGGGGGGGGK....',
    '...KDGGCCxCCxCCxCCxCCxCCxGGDK...',
    '...KDGGDDDDDDDDDDDDDDDDDDGGDK...',
    '..KDGGGKhHHHHHHHHHHHHHHhKGGGDK..',
    '..KDGGKKhHHHHHHHHHHHHHHhKKGGDK..',
    '..KDGGKHhHhshHhHHshshHHhHKGGDK..',
    '.KDGGGKHHHssshsHhsKKKhHhHHGGGDK.',
    '.KDGGKKhHhsKKKshssKKKshhHhKGGDK.',
    '.KDGGKKHhsssssssssLLLsshHKKGGDK.',
    '.KDGGKKhKsbssssssssssbsKhKKGGDK.',
    '.KDGGK.K.KsssssSSsssssK.K.KGGDK.',
    '..KDGK....KKssssssssKK....KGDK..',
    '...KK.......KKKKKKKK.......KK...',
  ],
  // Flaps up and a >_< squint.
  hurt: [
    '......KCCK.KKKGGGGKKKKCCKK......',
    '.....KCCCCKGGGGGGGGGGKCCCCK.....',
    '.....KCxxCGGGGGGGGGgGGCxxCK.....',
    '......KKDDDGGDGGDGGDgGDGKK......',
    '......KDDGDGGDGGDGGDGgDGGK......',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '.....KDDGGDGGDGGDGGDGGDGGDK.....',
    '....KCCCCCCCCCCCCCCCCCCCCCCK....',
    '..KKKCxCCxCCxCCxCCxCCxCCxCCKKK..',
    '.KGGGGGGGGGGGGGGGGGGGGGGGGGGGGK.',
    'KGGGGGxCCxCCxCCxCCxCCxCCxCGGGGGK',
    'GGGDDKDDDDDDDDDDDDDDDDDDDDKDDGGG',
    'GDDKK.KKhHHHHHHHHHHHHHHhKK.KKDDG',
    'KKK....KhHHHHHHHHHHHHHHhK....KKK',
    '......KHhHhshHhHHshshHHhHK......',
    '......KHHHsKshsHhsssKhHhHHK.....',
    '......KhHhssKKshssKKsshhHhK.....',
    '......KHhssKssssssssKsshHK......',
    '......KhKsbssssssssssbsKhK......',
    '.......K.KsssssKKsssssK.K.......',
    '..........KKssssssssKK..........',
    '............KKKKKKKK............',
  ],
};

/** Jacket + arms (frame rows 22-34). */
const TORSOS = {
  // Arms at the sides, camera in the facing-side hand.
  down: [
    '..........KGGGGCGGGGGK..........', // high funnel collar (frame row 22)
    '......KKKKKBGGGCGGGGBKKKKK......', // backpack straps
    '.....KgggDGBGGGCGGGGBGGgggK.....', // sage upper sleeves
    '.....KDggDGBGGGCGGGGBGGggDK.....',
    '.....KDggDGBGGGCGGGGBGGggDK.....',
    '.....KCCCxGBGCCCCCCGBGxCCCK.....', // shark-mouth print
    '....KCCCCxGBCCCCCCCCBGxCCCCK....',
    '....KCCCCxGCCRWRWRWCCGxCCCCK....', // big cream sleeves hide the hands
    '....KCCCCxGCRRRRRRRRCBxCCKK.....',
    '....KxCxCxGCRRRppRRRCBxCKKKKKK..',
    '.....KxxxDGCCWRppRWCCGGxKKkYKK..',
    '......KKKDGCCCCCCCCCCGGKKKKKKK..',
    '........KDGDGDGDGDGDGDGK........', // ribbed hem (frame row 34)
  ],
  // Arms flung out (jump, fall, hurt).
  up: [
    '..........KGGGGCGGGGGK..........',
    '...KK..KKKKBGGGCGGGGBKKKK..KK...',
    '..KCCKKggDGBGGGCGGGGBGGggKKCCK..',
    '..KCCCgggDGBGGGCGGGGBGGgggCCCK..',
    '..KxCCgKKDGBGGGCGGGGBGGKKgCCxK..',
    '...KxxK.KDGBGCCCCCCGBGGK.KxxK...',
    '....KK..KDGBCCCCCCCCBGGK..KK....',
    '........KDGCCRWRWRWCCGGK........',
    '........KDGCRRRRRRRRCBBK........',
    '........KDGCRRRppRRRCBkK........',
    '........KDGCCWRppRWCCGGK........',
    '........KDGCCCCCCCCCCGGK........',
    '........KDGDGDGDGDGDGDGK........',
  ],
  // Camera lifted to the chest with both hands.
  chest: [
    '..........KGGGGCGGGGGK..........',
    '......KKKKKBGGGCGGGGBKKKKK......',
    '.....KgggDGBGGGCGGGGBGGgggK.....',
    '.....KgggDGBGKKKGGGGBGGgggK.....',
    '.....KgggDGBKKKKKKKKBGGgggK.....',
    '......KCCCCBKKkYYYKKBCCCCK......',
    '......KCCCCCKkYLLKYKBCCCCCK.....',
    '.......KxCCCKKkYYYKKCCCCxK......',
    '........KDGCKKKKKKKKCBBKK.......',
    '........KDGCRRRppRRRCBkK........',
    '........KDGCCWRppRWCCGGK........',
    '........KDGCCCCCCCCCCGGK........',
    '........KDGDGDGDGDGDGDGK........',
  ],
  // Sleeves bent up toward the face (camera overlay on top).
  raise: [
    '......KCCKKGGGGCGGGGGK.KCCK.....',
    '......KCCCKBGGGCGGGGBKKCCCK.....',
    '.....KggCCGBGGGCGGGGBGGCCgK.....',
    '.....KgggDGBGGGCGGGGBGGgggK.....',
    '.....KgggDGBGGGCGGGGBGGgggK.....',
    '......KKKDGBGCCCCCCGBGGKKK......',
    '........KDGBCCCCCCCCBGGK........',
    '........KDGCCRWRWRWCCGGK........',
    '........KDGCRRRRRRRRCBBK........',
    '........KDGCRRRppRRRCBkK........',
    '........KDGCCWRppRWCCGGK........',
    '........KDGCCCCCCCCCCGGK........',
    '........KDGDGDGDGDGDGDGK........',
  ],
};

/** Overlays drawn on top of the head. `y` is the first frame row. */
const OVERLAYS = {
  // Camera at the eye, lens facing out: the shutter moment.
  cameraEye: {
    y: 14,
    rows: [
      '..................KKK...........',
      '................KKKKKKKKK.......',
      '...............KCKkYYYKKCK......',
      '...............KCKYLKLYKCK......',
      '...............KCKkYYYKKCK......',
      '...............KCKKKKKKKCK......',
      '................KCCK.KCCK.......',
      '.................KK...KK........',
    ],
  },
  // Camera held up safely while airborne.
  cameraUp: {
    y: 19,
    rows: [
      '..........................KK....',
      '.........................KKKKK..',
      '.........................KKkYK..',
      '.........................KKKKK..',
    ],
  },
};

/** Legs (frame rows 35-41): baggy camo pants and chunky sneakers. */
const LEGS = {
  stand: [
    '........KMmMnMMMmMMmMnMK........',
    '........KMMmMMMMMnMMmMmK........',
    '........KMnMMmMMMMmMMMMK........',
    '........KmMMMMnmmMMnMmMK........',
    '.......KCCCCCCKKKCCCCCCK........',
    '.......KCCCCCCCKKCCCCCCCK.......',
    '.......KxxxxxxxKKxxxxxxxK.......',
  ],
  strideA: [
    '........KMmMnMMMmMMmMnMK........',
    '.......KKMMmMMMMMnMMmMmKK.......',
    '......KMMMnMMmMKKMmMMMMMMK......',
    '......KMMmMMMMnKKMMnMmMMMK......',
    '.....KCCCCCCKKK..KKCCCCCCK......',
    '.....KCCCCCCCK....KCCCCCCCK.....',
    '.....KxxxxxxxK....KxxxxxxxK.....',
  ],
  passA: [
    '........KMmMnMMMmMMmMnMK........',
    '........KMMmMMMMMnMMmMmK........',
    '........KMnMMmMMMMmMMMMK........',
    '........KmMMMMnKKCCCCCCK........',
    '.......KCCCCCCK.KxxxxxxxK.......',
    '.......KCCCCCCCK.KKKKKKK........',
    '.......KxxxxxxxK................',
  ],
  strideB: [
    '........KMnMmMMMnMMnMmMK........',
    '.......KKMMnMMMMMmMMnMnKK.......',
    '......KMMMmMMnMKKMnMMMMMMK......',
    '......KMMnMMMMmKKMMmMnMMMK......',
    '.....KCCCCCCKKK..KKCCCCCCK......',
    '.....KCCCCCCCK....KCCCCCCCK.....',
    '.....KxxxxxxxK....KxxxxxxxK.....',
  ],
  passB: [
    '........KMmMnMMMmMMmMnMK........',
    '........KMMmMMMMMnMMmMmK........',
    '........KMnMMmMMMMmMMMMK........',
    '.......KCCCCCCnKKMMnMmMK........',
    '.......KxxxxxxxKKCCCCCCK........',
    '........KKKKKKK.KCCCCCCCK.......',
    '................KxxxxxxxK.......',
  ],
  tuck: [
    '........KMmMnMMMmMMmMnMK........',
    '........KMMmMMMMMnMMmMmK........',
    '.......KCCCCCCKKKKCCCCCCK.......',
    '.......KxxxxxxxK.KxxxxxxxK......',
    '........KKKKKKK...KKKKKKK.......',
    '................................',
    '................................',
  ],
  dangle: [
    '........KMmMnMMMmMMmMnMK........',
    '........KMMmMMMMMnMMmMmK........',
    '........KMnMMmMMMMmMMMMK........',
    '........KmMMMMnKKMMnMmMK........',
    '........KCCCCCK..KCCCCCK........',
    '........KxxxxxK..KxxxxxK........',
    '.........KKKKK....KKKKK.........',
  ],
};

/**
 * Frame recipes. `bob` shifts the head (and any overlay) down (positive) or
 * up (negative) by whole pixels: idle breathing and the walking bounce.
 */
const RECIPES = {
  idle: [
    { head: 'down', torso: 'down', legs: 'stand', bob: 0 },
    { head: 'down', torso: 'down', legs: 'stand', bob: 1 },
  ],
  walk: [
    { head: 'down', torso: 'down', legs: 'strideA', bob: 0 },
    { head: 'down', torso: 'down', legs: 'passA', bob: -1 },
    { head: 'down', torso: 'down', legs: 'strideB', bob: 0 },
    { head: 'down', torso: 'down', legs: 'passB', bob: -1 },
  ],
  jump: [{ head: 'down', torso: 'up', legs: 'tuck', overlay: 'cameraUp', bob: 0 }],
  fall: [{ head: 'up', torso: 'up', legs: 'dangle', overlay: 'cameraUp', bob: 0 }],
  photo: [
    { head: 'down', torso: 'chest', legs: 'stand', bob: 0 },
    { head: 'wink', torso: 'raise', legs: 'stand', overlay: 'cameraEye', bob: 0 },
  ],
  hurt: [{ head: 'hurt', torso: 'up', legs: 'dangle', bob: 0 }],
  blink: [{ head: 'blink', torso: 'down', legs: 'stand', bob: 0 }],
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

/** Paint one frame recipe into `ctx` at the frame's top-left corner. */
function paintFrame(ctx, recipe, ox, oy) {
  // Draw order: legs → torso → head → overlay, so the camera sits on top.
  paintGrid(ctx, LEGS[recipe.legs], ZENYU_COLORS, ox, oy + 35);
  paintGrid(ctx, TORSOS[recipe.torso], ZENYU_COLORS, ox, oy + 22);
  paintGrid(ctx, HEADS[recipe.head], ZENYU_COLORS, ox, oy + recipe.bob);
  const overlay = OVERLAYS[recipe.overlay];
  if (overlay) paintGrid(ctx, overlay.rows, ZENYU_COLORS, ox, oy + overlay.y + recipe.bob);
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
