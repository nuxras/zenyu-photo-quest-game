// ---------------------------------------------------------------------------
// ui.js — title, pause, game-over and win (photo album) screens, plus a tiny
// menu helper that works with keys, taps and mouse clicks.
// ---------------------------------------------------------------------------

import { VIEW, PALETTE, ENV, PHOTO } from './config.js';
import { drawText, textWidth, BIG, SMALL } from './font.js';
import { formatTime } from './hud.js';
import { POLAROID } from './photo.js';

const W = VIEW.width;
const H = VIEW.height;
const INK_OUTLINE = 'rgba(24, 16, 34, 0.9)';
const TITLE_GRADIENT = ['#FFF4D6', '#FFF4D6', '#FFE3A3', '#FFD27E', '#F7B267', '#EE8D5A', '#E07A5F'];

// --- Menu --------------------------------------------------------------------------

export class Menu {
  /** @param {{label: string, action: string}[]} items */
  constructor(items, y, spacing = 11) {
    this.items = items;
    this.y = y;
    this.spacing = spacing;
    this.index = 0;
  }

  itemRect(i) {
    const w = textWidth(this.items[i].label) + 24;
    return { x: W / 2 - w / 2, y: this.y + i * this.spacing - 3, w, h: this.spacing };
  }

  /** Returns the chosen action (or null). `sound` gets menu blips. */
  update(input, sound) {
    if (input.pressed('up') || input.pressed('left')) {
      this.index = (this.index + this.items.length - 1) % this.items.length;
      sound('menuMove');
    }
    if (input.pressed('down') || input.pressed('right')) {
      this.index = (this.index + 1) % this.items.length;
      sound('menuMove');
    }
    for (const tap of input.taps()) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.itemRect(i);
        if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) {
          this.index = i;
          sound('menuSelect');
          return this.items[i].action;
        }
      }
    }
    if (input.pressed('confirm')) {
      sound('menuSelect');
      return this.items[this.index].action;
    }
    return null;
  }

  draw(ctx, time) {
    this.items.forEach((item, i) => {
      const selected = i === this.index;
      const y = this.y + i * this.spacing;
      if (selected) {
        const r = this.itemRect(i);
        ctx.fillStyle = 'rgba(255, 210, 126, 0.16)';
        ctx.fillRect(r.x, r.y + 1, r.w, r.h - 2);
        const nudge = Math.floor(time * 3) % 2;
        drawText(ctx, '▶', r.x + 4 + nudge, y, { color: ENV.uiAccent });
        drawText(ctx, '◀', r.x + r.w - 7 - nudge, y, { color: ENV.uiAccent });
      }
      drawText(ctx, item.label, W / 2, y, {
        align: 'center',
        color: selected ? ENV.uiAccent : PALETTE.cream,
        outline: INK_OUTLINE,
      });
    });
  }
}

// --- Shared bits ----------------------------------------------------------------------

function dim(ctx, alpha = 0.72) {
  ctx.fillStyle = `rgba(20, 12, 30, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function heading(ctx, text, y, scale = 1) {
  drawText(ctx, text, W / 2 + scale, y + scale, { font: BIG, align: 'center', color: '#3A1F33', scale });
  drawText(ctx, text, W / 2, y, {
    font: BIG,
    align: 'center',
    color: TITLE_GRADIENT,
    outline: INK_OUTLINE,
    scale,
  });
}

/** Ten little slots showing which photos are in the bag. */
function photoSlots(ctx, run, y) {
  const size = 7;
  const gap = 3;
  const total = PHOTO.total * (size + gap) - gap;
  const x0 = Math.round(W / 2 - total / 2);
  run.spots.forEach((spot, i) => {
    const x = x0 + i * (size + gap);
    ctx.fillStyle = PALETTE.charcoal;
    ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
    ctx.fillStyle = spot.taken ? ENV.uiAccent : '#4A3552';
    ctx.fillRect(x, y, size, size);
    if (spot.taken) {
      ctx.fillStyle = PALETTE.charcoal;
      ctx.fillRect(x + 2, y + 2, 3, 3);
    }
  });
}

function controlsLine(touch) {
  return touch
    ? '◀ ▶ MOVE   ▲ JUMP   📷 PHOTO   II PAUSE'
    : '←→/AD MOVE  SPACE JUMP  E PHOTO  P PAUSE  M SOUND';
}

// --- Title -------------------------------------------------------------------------------

export function drawTitle(ctx, env) {
  const { renderer, sprites, level, time, records, touch, muted } = env;
  const camX = 40 + Math.sin(time * 0.05) * 30;
  renderer.background.draw(ctx, camX + time * 6, time);
  renderer.art.drawBuilding(ctx, level.buildings[0], 60, time);
  for (const prop of level.props) {
    if (prop.type === 'railing' || prop.type === 'plants' || prop.type === 'chimney') {
      renderer.art.drawProp(ctx, prop, 60 + (prop.type === 'railing' ? 100 : 0), time, level, {});
    }
  }
  renderer.background.drawMotes(ctx, camX, time, env.reducedMotion);

  // Logo with viewfinder brackets
  const bob = env.reducedMotion ? 0 : Math.round(Math.sin(time * 1.6) * 1.5);
  heading(ctx, "ZENYU'S", 14 + bob, 2);
  heading(ctx, 'PHOTO QUEST', 34 + bob, 2);
  ctx.fillStyle = ENV.uiPaper;
  const bx = 70;
  const by = 8 + bob;
  const bw = W - 140;
  const bh = 46;
  for (const [x, y, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
    ctx.fillRect(Math.min(x, x + dx * 7), y, 7, 1);
    ctx.fillRect(x, Math.min(y, y + dy * 7), 1, 7);
  }
  drawText(ctx, 'A GOLDEN-HOUR PIXEL ADVENTURE', W / 2, 60 + bob, {
    align: 'center',
    color: '#FBD58A',
    outline: INK_OUTLINE,
  });

  // Zenyu idles on the roof and snaps a photo every few seconds.
  const cycle = time % 5;
  const posing = cycle > 3.6 && cycle < 4.6;
  if (posing) {
    sprites.draw(ctx, 'photo', cycle > 3.75 ? 1 : 0, 160, 132, 1);
  } else {
    const idle = cycle % 2.7 > 2.55 && sprites.has('blink') ? 'blink' : 'idle';
    sprites.draw(ctx, idle, sprites.frameAt('idle', time), 160, 132, 1);
  }
  if (cycle > 3.8 && cycle < 4.05 && !env.reducedMotion) {
    // a little camera flash sparkle
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(164, 107, 1, 1);
    ctx.fillRect(162, 107, 5, 1);
    ctx.fillRect(164, 105, 1, 5);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(158, 101, 13, 13);
    ctx.globalAlpha = 1;
  }

  // A soft band so the text reads over the lit windows
  ctx.fillStyle = 'rgba(20, 12, 30, 0.55)';
  ctx.fillRect(0, 136, W, H - 136);
  ctx.fillStyle = 'rgba(20, 12, 30, 0.35)';
  ctx.fillRect(0, 135, W, 1);

  // Blinking prompt
  if (Math.floor(time * (env.reducedMotion ? 1 : 2)) % 2 === 0) {
    drawText(ctx, touch ? 'TAP TO START' : 'PRESS ENTER OR SPACE', W / 2, 140, {
      align: 'center',
      color: ENV.uiAccent,
      outline: INK_OUTLINE,
    });
  }

  const best = records.bestTime ? formatTime(records.bestTime) : '--:--.-';
  drawText(ctx, `BEST TIME ${best}   MOST PHOTOS ${records.mostPhotos}/${PHOTO.total}`, W / 2, 152, {
    align: 'center',
    color: PALETTE.cream,
    outline: INK_OUTLINE,
  });
  drawText(ctx, controlsLine(touch), W / 2, 166, { align: 'center', color: '#D8CCB6', outline: INK_OUTLINE });
  drawText(ctx, muted ? 'SOUND OFF' : 'SOUND ON', W - 4, 4, {
    align: 'right',
    color: muted ? '#B5AC9F' : PALETTE.cream,
    outline: INK_OUTLINE,
  });
}

// --- Pause -------------------------------------------------------------------------------

export function drawPause(ctx, env) {
  const { run, menu, time, touch, muted, focused } = env;
  dim(ctx, 0.66);
  heading(ctx, 'PAUSED', 34, 2);
  drawText(ctx, `PHOTOS ${run.photos.length}/${PHOTO.total}`, W / 2, 58, {
    align: 'center',
    color: PALETTE.cream,
    outline: INK_OUTLINE,
  });
  photoSlots(ctx, run, 68);
  menu.draw(ctx, time);
  const hint = touch ? 'TAP RESUME TO KEEP SNAPPING' : `P/ESC RESUME   M SOUND ${muted ? 'OFF' : 'ON'}`;
  drawText(ctx, hint, W / 2, 146, { align: 'center', color: '#D8CCB6', outline: INK_OUTLINE });
  if (!focused && !touch) {
    drawText(ctx, 'CLICK THE GAME TO GIVE IT FOCUS', W / 2, 158, {
      align: 'center',
      color: ENV.uiAccent,
      outline: INK_OUTLINE,
    });
  }
}

// --- Game over ------------------------------------------------------------------------------

export function drawGameOver(ctx, env) {
  const { run, menu, time, sprites, records } = env;
  dim(ctx, 0.74);
  heading(ctx, 'OUT OF HEARTS', 26, 2);
  sprites.draw(ctx, 'hurt', 0, W / 2, 86, 1);
  drawText(ctx, `YOU SNAPPED ${run.photos.length} OF ${PHOTO.total} PHOTOS`, W / 2, 94, {
    align: 'center',
    color: PALETTE.cream,
    outline: INK_OUTLINE,
  });
  photoSlots(ctx, run, 104);
  const recordText = records.newMostPhotos ? 'NEW RECORD: MOST PHOTOS!' : `MOST PHOTOS ${records.mostPhotos}/${PHOTO.total}`;
  drawText(ctx, recordText, W / 2, 116, {
    align: 'center',
    color: records.newMostPhotos ? ENV.uiAccent : '#D8CCB6',
    outline: INK_OUTLINE,
  });
  menu.draw(ctx, time);
}

// --- Win: the photo album ------------------------------------------------------------------

export function drawWin(ctx, env) {
  const { run, menu, time, renderer, records, since } = env;
  renderer.background.draw(ctx, 3580, time);
  dim(ctx, 0.45);
  heading(ctx, 'PHOTO ALBUM', 5);

  const cols = 5;
  const gap = 3;
  const gridW = cols * POLAROID.width + (cols - 1) * gap;
  const x0 = Math.round((W - gridW) / 2);
  run.photos.forEach((photo, i) => {
    // Polaroids are dealt onto the page one by one.
    const appear = since - 0.25 - i * 0.12;
    if (appear <= 0) return;
    const k = Math.min(1, appear / 0.2);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = x0 + col * (POLAROID.width + gap);
    const y = 16 + row * (POLAROID.height + 3) + (col % 2 ? 1 : 0) - Math.round((1 - k) * 8);
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(20, 12, 28, 0.4)';
    ctx.fillRect(x + 2, y + 2, POLAROID.width, POLAROID.height);
    ctx.drawImage(photo.polaroid, x, y);
    ctx.globalAlpha = 1;
  });

  const statsY = 16 + 2 * (POLAROID.height + 3) + 2;
  if (since > 1.6) {
    const time1 = `TIME ${formatTime(run.clock)}`;
    const hearts = `♥ ${run.player.hearts}/3`;
    drawText(ctx, `${time1}    ${hearts}`, W / 2, statsY, {
      align: 'center',
      color: PALETTE.cream,
      outline: INK_OUTLINE,
    });
    const best = records.newBestTime
      ? '★ NEW BEST TIME! ★'
      : `BEST ${records.bestTime ? formatTime(records.bestTime) : formatTime(run.clock)}`;
    const blink = !records.newBestTime || Math.floor(time * 3) % 2 === 0;
    if (blink) {
      drawText(ctx, best, W / 2, statsY + 8, {
        align: 'center',
        color: records.newBestTime ? ENV.uiAccent : '#D8CCB6',
        outline: INK_OUTLINE,
      });
    }
    menu.draw(ctx, time);
  }
}

// --- Toasts -------------------------------------------------------------------------------------

/** Brief message in the lower middle of the screen (e.g. SOUND OFF). */
export function drawToast(ctx, toast) {
  if (!toast || toast.t <= 0) return;
  ctx.globalAlpha = Math.min(1, toast.t / 0.25);
  const w = textWidth(toast.text, SMALL) + 10;
  ctx.fillStyle = 'rgba(20, 12, 30, 0.8)';
  ctx.fillRect(Math.round(W / 2 - w / 2), H - 34, w, 11);
  drawText(ctx, toast.text, W / 2, H - 31, { align: 'center', color: PALETTE.cream });
  ctx.globalAlpha = 1;
}
