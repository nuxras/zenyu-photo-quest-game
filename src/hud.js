// ---------------------------------------------------------------------------
// hud.js — hearts, photo counter, timer, the flying polaroid and hints.
// Drawn in screen space on top of the world (never shaken).
// ---------------------------------------------------------------------------

import { VIEW, PHOTO, PALETTE, ENV } from './config.js';
import { gridToCanvas } from './pixelgrid.js';
import { drawText, textWidth } from './font.js';

const ICON_COLORS = {
  K: PALETTE.charcoal,
  R: '#E0485A',
  r: '#FF9AA2',
  d: '#4A2E3E',
  C: PALETTE.cream,
  L: PALETTE.warmGrey,
  Y: ENV.uiAccent,
};

const HEART_FULL = gridToCanvas(
  ['.KK.KK.', 'KrRKRRK', 'KRRRRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'],
  ICON_COLORS,
);
const HEART_EMPTY = gridToCanvas(
  ['.KK.KK.', 'KddKddK', 'KdddddK', 'KdddddK', '.KdddK.', '..KdK..', '...K...'],
  ICON_COLORS,
);
const CAMERA_ICON = gridToCanvas(
  ['.CCC.....', 'CCCCCCCYC', 'CKKKKKKKC', 'CKKCCCKKC', 'CKKCLCKKC', 'CKKCCCKKC', 'CCCCCCCCC'],
  ICON_COLORS,
);

/** mm:ss.t */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const t = Math.floor((seconds * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`;
}

function pill(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(24, 16, 34, 0.6)';
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
}

function easeOutBack(t) {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

function easeInCubic(t) {
  return t * t * t;
}

/** Where the photo counter sits (the polaroid flies here). */
export const COUNTER_POS = { x: VIEW.width - 26, y: 9 };

export function drawHud(ctx, run) {
  const { player } = run;

  // Hearts (the one just lost wobbles for a moment)
  pill(ctx, 3, 3, 3 + 9 * 3, 11);
  for (let i = 0; i < 3; i++) {
    const full = i < player.hearts;
    let dy = 0;
    if (i === player.hearts && run.heartWobble > 0) {
      dy = Math.round(Math.sin(run.heartWobble * 40) * 1.5);
    }
    ctx.drawImage(full ? HEART_FULL : HEART_EMPTY, 5 + i * 9, 5 + dy);
  }

  // Timer under the hearts
  drawText(ctx, formatTime(run.clock), 5, 17, { color: PALETTE.cream, outline: 'rgba(24,16,34,0.8)' });

  // Photo counter (bumps when a polaroid lands)
  const label = `${run.photosShown}/${PHOTO.total}`;
  const w = 16 + textWidth(label);
  const x = VIEW.width - w - 4;
  pill(ctx, x, 3, w, 11);
  const bump = run.counterBump > 0 ? -1 : 0;
  ctx.drawImage(CAMERA_ICON, x + 3, 5 + bump);
  drawText(ctx, label, x + 14, 6 + bump, {
    color: run.counterBump > 0 ? ENV.uiAccent : PALETTE.cream,
  });

  // Keyboard pause hint (touch players get a real pause button instead)
  if (!run.touch) {
    ctx.globalAlpha = 0.6;
    drawText(ctx, 'P ∥ PAUSE', VIEW.width / 2, 5, { align: 'center', color: PALETTE.cream, outline: 'rgba(24,16,34,0.7)' });
    ctx.globalAlpha = 1;
  }

  // Opening hint banner
  if (run.clock < 5.5 && run.photosShown === 0) {
    const alpha = Math.min(1, (5.5 - run.clock) / 0.8, run.clock / 0.4);
    ctx.globalAlpha = Math.max(0, alpha);
    const msg = 'FIND 10 GLOWING PHOTO SPOTS ★';
    const bw = textWidth(msg) + 12;
    pill(ctx, (VIEW.width - bw) / 2, VIEW.height - 20, bw, 12);
    drawText(ctx, msg, VIEW.width / 2, VIEW.height - 17, { align: 'center', color: ENV.uiAccent });
    ctx.globalAlpha = 1;
  }

  drawPopup(ctx, run);
}

/**
 * The polaroid pops up, lingers, then flies into the counter.
 * Timeline (seconds): 0–0.25 pop, 0.25–0.95 hold, 0.95–PHOTO.popupTime fly.
 */
function drawPopup(ctx, run) {
  const popup = run.popup;
  if (!popup) return;
  const card = popup.photo.polaroid;
  const t = popup.t;
  const home = { x: VIEW.width / 2, y: 64 };
  let scale;
  let x = home.x;
  let y = home.y;
  if (t < 0.25) {
    scale = 0.3 + 0.7 * easeOutBack(t / 0.25);
  } else if (t < 0.95) {
    scale = 1;
  } else {
    const k = easeInCubic(Math.min(1, (t - 0.95) / (PHOTO.popupTime - 0.95)));
    scale = 1 - 0.85 * k;
    x = home.x + (COUNTER_POS.x - home.x) * k;
    y = home.y + (COUNTER_POS.y - home.y) * k;
  }
  const w = Math.max(1, Math.round(card.width * scale));
  const h = Math.max(1, Math.round(card.height * scale));
  ctx.fillStyle = 'rgba(20, 12, 28, 0.35)';
  ctx.fillRect(Math.round(x - w / 2) + 2, Math.round(y - h / 2) + 2, w, h);
  ctx.drawImage(card, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  if (t > 0.2 && t < 0.95) {
    drawText(ctx, `PHOTO ${popup.index}/${PHOTO.total}!`, home.x, home.y + card.height / 2 + 4, {
      align: 'center',
      color: ENV.uiAccent,
      outline: 'rgba(24,16,34,0.85)',
    });
  }
}
