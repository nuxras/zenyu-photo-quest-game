// ---------------------------------------------------------------------------
// photo.js — Zenyu's camera. A "photo" is a real capture of the game world:
// the scene is re-rendered off-screen without Zenyu or UI, the subject is
// framed, downsampled 2x (a soft, photographic look) and given a warm film
// tone + vignette. Photos are then mounted as little polaroids.
// ---------------------------------------------------------------------------

import { VIEW, PHOTO, PALETTE, ENV } from './config.js';
import { makeCanvas, pixelContext } from './pixelgrid.js';
import { drawText } from './font.js';

const THUMB_W = Math.round(PHOTO.captureWidth * PHOTO.thumbScale);
const THUMB_H = Math.round(PHOTO.captureHeight * PHOTO.thumbScale);

/** Polaroid size: photo + 4px frame + a caption strip. */
export const POLAROID = { width: THUMB_W + 8, height: THUMB_H + 16, photoX: 4, photoY: 4 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Where on screen (current camera) the photo should be centred. */
function frameCentre(spot, camX, renderer, level) {
  const shot = spot.shot || {};
  if (shot.target === 'sun') {
    const sun = renderer.background.sunPosition(camX);
    return { x: sun.x - 8, y: sun.y - 10 };
  }
  if (shot.target === 'star') {
    const star = renderer.art.starPosition(level, camX);
    return { x: star.x - 14, y: star.y + 22 };
  }
  return { x: (shot.x ?? spot.x) - camX, y: shot.y ?? spot.y - 30 };
}

/** Film look: warm highlights, slightly lifted blacks, soft vignette. */
function developPixel(r, g, b, nx, ny) {
  const vignette = 1 - 0.38 * (nx * nx + ny * ny);
  r = (r * 1.05 + 10) * vignette;
  g = (g * 1.0 + 6) * vignette;
  b = (b * 0.9 + 14) * vignette;
  // Gentle posterisation keeps the photo feeling like pixel art.
  const q = (v) => Math.round(clamp(v, 0, 255) / 12) * 12;
  return [q(r), q(g), q(b)];
}

export function createPhotographer(renderer) {
  const scene = makeCanvas(VIEW.width, VIEW.height);
  const sceneCtx = pixelContext(scene);

  /** Screen-space rectangle the camera will capture for `spot` right now. */
  function frameRect(run, spot) {
    const camX = Math.round(run.camera.x);
    const centre = frameCentre(spot, camX, renderer, run.level);
    const w = PHOTO.captureWidth;
    const h = PHOTO.captureHeight;
    return {
      x: clamp(Math.round(centre.x - w / 2), 0, VIEW.width - w),
      y: clamp(Math.round(centre.y - h / 2), 0, VIEW.height - h),
      w,
      h,
    };
  }

  /**
   * Photograph `spot` as it looks right now. Returns a THUMB_W x THUMB_H
   * canvas. Falls back to a generated postcard if reading pixels fails.
   */
  function capture(run, spot) {
    try {
      renderer.drawWorld(sceneCtx, run, Math.round(run.camera.x), 1, { forPhoto: true });
      const { x: x0, y: y0, w, h } = frameRect(run, spot);
      const source = sceneCtx.getImageData(x0, y0, w, h).data;

      const thumb = makeCanvas(THUMB_W, THUMB_H);
      const tctx = pixelContext(thumb);
      const out = tctx.createImageData(THUMB_W, THUMB_H);
      const step = Math.round(1 / PHOTO.thumbScale);
      for (let ty = 0; ty < THUMB_H; ty++) {
        for (let tx = 0; tx < THUMB_W; tx++) {
          // Box filter: average each step x step block of source pixels.
          let r = 0;
          let g = 0;
          let b = 0;
          for (let dy = 0; dy < step; dy++) {
            for (let dx = 0; dx < step; dx++) {
              const i = ((ty * step + dy) * w + (tx * step + dx)) * 4;
              r += source[i];
              g += source[i + 1];
              b += source[i + 2];
            }
          }
          const n = step * step;
          const nx = (tx / (THUMB_W - 1)) * 2 - 1;
          const ny = (ty / (THUMB_H - 1)) * 2 - 1;
          const [pr, pg, pb] = developPixel(r / n, g / n, b / n, nx, ny);
          const o = (ty * THUMB_W + tx) * 4;
          out.data[o] = pr;
          out.data[o + 1] = pg;
          out.data[o + 2] = pb;
          out.data[o + 3] = 255;
        }
      }
      tctx.putImageData(out, 0, 0);
      // Tiny orange date-stamp dots in the corner, like an old film camera.
      tctx.fillStyle = '#FF9A3C';
      tctx.fillRect(THUMB_W - 7, THUMB_H - 3, 1, 1);
      tctx.fillRect(THUMB_W - 5, THUMB_H - 3, 2, 1);
      tctx.fillRect(THUMB_W - 2, THUMB_H - 3, 1, 1);
      return thumb;
    } catch (err) {
      console.warn('[Zenyu] Photo capture failed, using a postcard instead.', err);
      return postcard(spot.id);
    }
  }

  return { capture, frameRect };
}

/** Generated fallback photo: a sky gradient, a sun and a skyline. */
export function postcard(index) {
  const thumb = makeCanvas(THUMB_W, THUMB_H);
  const ctx = pixelContext(thumb);
  const skies = ENV.skyStops.map(([, c]) => c);
  for (let y = 0; y < THUMB_H; y++) {
    ctx.fillStyle = skies[Math.min(skies.length - 1, Math.floor((y / THUMB_H) * skies.length))];
    ctx.fillRect(0, y, THUMB_W, 1);
  }
  ctx.fillStyle = ENV.sun;
  ctx.fillRect(8 + ((index * 9) % 30), 14, 6, 6);
  ctx.fillStyle = ENV.nearCity;
  for (let x = 0; x < THUMB_W; x += 6) {
    const h = 6 + ((x * 7 + index * 13) % 11);
    ctx.fillRect(x, THUMB_H - h, 5, h);
  }
  return thumb;
}

/** Mount a photo in a polaroid with a handwritten-ish caption. */
export function makePolaroid(photo, caption) {
  const card = makeCanvas(POLAROID.width, POLAROID.height);
  const ctx = pixelContext(card);
  ctx.fillStyle = PALETTE.charcoal;
  ctx.fillRect(0, 0, card.width, card.height);
  ctx.fillStyle = ENV.uiPaper;
  ctx.fillRect(1, 1, card.width - 2, card.height - 2);
  ctx.fillStyle = '#E2D6BF';
  ctx.fillRect(1, card.height - 2, card.width - 2, 1);
  ctx.fillStyle = PALETTE.charcoal;
  ctx.fillRect(POLAROID.photoX - 1, POLAROID.photoY - 1, THUMB_W + 2, THUMB_H + 2);
  ctx.drawImage(photo, POLAROID.photoX, POLAROID.photoY);
  drawText(ctx, caption, card.width / 2, THUMB_H + 8, { align: 'center', color: PALETTE.charcoal });
  return card;
}
