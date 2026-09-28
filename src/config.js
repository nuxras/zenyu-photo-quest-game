// ---------------------------------------------------------------------------
// config.js — every tunable number and colour lives here.
// Units: pixels (native 320x180 resolution), seconds, pixels/second.
// This module is pure data (no DOM access) so Node tools can import it too.
// ---------------------------------------------------------------------------

/** Native render resolution. The canvas is integer-scaled to fit the window. */
export const VIEW = {
  width: 320,
  height: 180,
};

/** Zenyu's palette — the exact brand colours from the character sheet. */
export const PALETTE = {
  deepGreen: '#2F4F45',
  sage: '#7A8F82',
  cream: '#E8E2D2',
  warmGrey: '#B5AC9F',
  sharkRed: '#A83A3A',
  charcoal: '#2B2B2B',
  camo: '#6B7A62',
};

/**
 * A few derived shades the pixel art needs that the brand palette lacks
 * (skin, a darker knit rib, camo shadow...). Kept tiny and close to PALETTE.
 */
export const PALETTE_EXTRA = {
  deepGreenDark: '#223A33', // knit ribs / shadow side of the jacket
  charcoalLight: '#46464A', // backpack highlight
  camoDark: '#4F5C49', // camo blotches
  skin: '#F1DCCB',
  skinShade: '#D8B9A6',
  mouthPink: '#D9837A', // inside of the shark mouth
  white: '#F7F4EC', // teeth, eye glint, lens glint
  lens: '#56656B',
};

/** Environment colours for the golden-hour → dusk city. */
export const ENV = {
  skyStops: [
    // [position 0..1 from top of the view, colour]
    [0.0, '#241C3A'],
    [0.22, '#3E2A55'],
    [0.42, '#74406A'],
    [0.6, '#C35F66'],
    [0.76, '#EE8D5A'],
    [0.9, '#F8B865'],
    [1.0, '#FBD58A'],
  ],
  sun: '#FFE3A3',
  sunCore: '#FFF3D2',
  sunGlow: 'rgba(255, 214, 140, 0.18)',
  star: '#FFF1D8',
  cloudLight: '#F9C08E',
  cloudMid: '#D98A7F',
  cloudDark: '#9A5A74',
  farCity: '#8C5775',
  farCityWindow: '#E7A874',
  midCity: '#5E3D5E',
  midCityWindow: '#F0B870',
  nearCity: '#3D2A45',
  nearCityWindow: '#FFCB7A',
  alley: '#1E1628', // the street far below the rooftops
  alleyGlow: '#4A2E3E',
  // Foreground rooftops
  wall: '#46324A',
  wallDark: '#34253A',
  wallLight: '#5A4058',
  brickLine: '#3C2B41',
  rim: '#F2A56B', // sunlit rim on the side facing the sun
  roof: '#6A4B5E',
  roofTop: '#E7A077',
  roofShadow: '#2A1E30',
  windowLit: '#FFD27E',
  windowWarm: '#F6A45E',
  windowDim: '#5B4262',
  windowFrame: '#2B1F31',
  metal: '#8A7E86',
  metalDark: '#554B58',
  metalLight: '#C9B8B2',
  wood: '#9C6A4B',
  woodDark: '#6B4535',
  woodLight: '#C8905F',
  lampGlow: 'rgba(255, 210, 130, 0.22)',
  neonPink: '#FF7AA8',
  neonTeal: '#7FF0E0',
  neonOff: '#6B4A62',
  steam: '#EDE6F0',
  spotGlow: '#FFE7A0',
  spotGlowDim: 'rgba(255, 231, 160, 0.35)',
  uiInk: '#2B2B2B',
  uiPaper: '#F4ECDC',
  uiShadow: 'rgba(20, 12, 28, 0.55)',
  uiDim: 'rgba(24, 16, 34, 0.72)',
  uiAccent: '#FFD27E',
};

/** Fixed-timestep loop. Physics always advances in `step` increments. */
export const LOOP = {
  step: 1 / 60,
  maxFrameDelta: 0.25, // clamp huge gaps (tab switches) to avoid a spiral of death
};

/** World physics (px/s and px/s²). */
export const PHYSICS = {
  gravity: 900,
  fallGravityMultiplier: 1.3, // heavier on the way down = snappier jumps
  maxFallSpeed: 360,
  jumpVelocity: 300, // ≈50px apex with the button held
  jumpCutMultiplier: 0.45, // releasing jump early keeps this fraction of upward speed
  coyoteTime: 0.1, // grace period to jump after walking off a ledge
  jumpBufferTime: 0.12, // jump pressed slightly before landing still counts
};

/** Zenyu's body and movement. */
export const PLAYER = {
  width: 10, // hitbox — narrower than the sprite so near misses feel fair
  height: 22,
  maxSpeed: 88,
  groundAccel: 850,
  groundDecel: 1100,
  airAccel: 560,
  airDecel: 300,
  hearts: 3,
  invincibleTime: 1.4,
  hurtStunTime: 0.28, // input is ignored briefly after a hit
  knockbackX: 120,
  knockbackY: 170,
  fallDeathY: 210, // falling below this (world y) counts as falling off the roofs
  landSquashSpeed: 180, // landing faster than this triggers squash + dust
  photoBufferTime: 0.15, // photo pressed mid-air still counts on landing
};

/** Camera follow behaviour. */
export const CAMERA = {
  lookAhead: 30, // px shown ahead of Zenyu in the walking direction
  followSharpness: 5, // higher = snappier (exponential smoothing)
  lookAheadSharpness: 2.5,
};

/** Hazard tuning. */
export const HAZARDS = {
  pigeon: {
    speed: 16,
    width: 10,
    height: 8,
    pauseTime: 0.9, // pecks the floor at each end of its patrol
  },
  barrel: {
    speed: 58,
    radius: 6,
    interval: 3.2, // seconds between barrels from one spawner
    gravity: 700,
  },
  steam: {
    idleTime: 1.9,
    warnTime: 0.8, // small puffs + hiss: the tell before a burst
    burstTime: 1.0,
    columnHeight: 40,
    columnWidth: 10,
  },
};

/** Photo spots and the camera mechanic. */
export const PHOTO = {
  total: 10,
  triggerWidth: 26, // horizontal range around a spot where E works
  freezeTime: 0.7, // world pauses for this long while the shutter fires
  shutterAt: 0.18, // seconds into the sequence when the flash happens
  flashTime: 0.32,
  captureWidth: 104, // world pixels framed by the camera...
  captureHeight: 60,
  thumbScale: 0.5, // ...downsampled into a 52x30 album photo
  popupTime: 1.5, // polaroid pop + fly-to-HUD animation length
};

/** Juice & effects. */
export const EFFECTS = {
  damageShake: 3.5, // px amplitude
  damageShakeTime: 0.3,
  landShake: 0,
  reducedMotionShakeScale: 0.15,
  reducedMotionFlashAlpha: 0.3,
  transitionTime: 0.35,
};

/** Win/lose timing. */
export const FLOW = {
  deathDelay: 1.3, // time between last heart lost and the game-over screen
  winDelay: 1.9, // time after the 10th photo before the album appears
};

/**
 * Optional sprite sheet. If this file loads, it replaces the procedural
 * Zenyu. Each animation is one row of equally sized frames facing RIGHT.
 * `anchorX/anchorY` is the point in a frame that sits on Zenyu's feet.
 */
export const SPRITE_SHEET = {
  src: '../assets/zenyu.png', // resolved relative to this module
  frameWidth: 24,
  frameHeight: 32,
  anchorX: 12,
  anchorY: 32,
  animations: {
    idle: { row: 0, frames: 2, fps: 2 },
    walk: { row: 1, frames: 4, fps: 10 },
    jump: { row: 2, frames: 1, fps: 1 },
    photo: { row: 3, frames: 2, fps: 8 },
    // Optional rows — if missing, `jump` (fall) and `idle` (hurt) are used.
    // fall: { row: 4, frames: 1, fps: 1 },
    // hurt: { row: 5, frames: 1, fps: 1 },
  },
};

/** localStorage keys (all access is wrapped in try/catch — see storage.js). */
export const STORAGE_KEYS = {
  muted: 'zenyu-photo-quest:muted',
  bestTime: 'zenyu-photo-quest:best-time',
  mostPhotos: 'zenyu-photo-quest:most-photos',
};
