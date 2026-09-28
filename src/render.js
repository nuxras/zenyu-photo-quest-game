// ---------------------------------------------------------------------------
// render.js — draws a run: parallax backdrop, rooftops, props, photo spots,
// entities, Zenyu, particles and screen effects, then the HUD on top.
// ---------------------------------------------------------------------------

import { VIEW, PHOTO, PALETTE, ENV, EFFECTS } from './config.js';
import { createBackground } from './background.js';
import { createArt } from './art.js';
import { makeCanvas, pixelContext } from './pixelgrid.js';
import { drawText } from './font.js';
import { drawHud } from './hud.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** A soft vertical light beam used to mark photo spots. */
function buildBeam() {
  const w = 9;
  const h = 48;
  const canvas = makeCanvas(w, h);
  const ctx = pixelContext(canvas);
  for (let y = 0; y < h; y++) {
    const k = y / (h - 1);
    ctx.fillStyle = `rgba(255, 231, 160, ${0.22 * k * k})`;
    ctx.fillRect(1, y, w - 2, 1);
    ctx.fillStyle = `rgba(255, 244, 214, ${0.3 * k})`;
    ctx.fillRect(3, y, 3, 1);
  }
  return canvas;
}

/** Four corner brackets — the viewfinder motif. */
function brackets(ctx, x, y, w, h, len, color) {
  ctx.fillStyle = color;
  const r = x + w - 1;
  const b = y + h - 1;
  ctx.fillRect(x, y, len, 1);
  ctx.fillRect(x, y, 1, len);
  ctx.fillRect(r - len + 1, y, len, 1);
  ctx.fillRect(r, y, 1, len);
  ctx.fillRect(x, b, len, 1);
  ctx.fillRect(x, b - len + 1, 1, len);
  ctx.fillRect(r - len + 1, b, len, 1);
  ctx.fillRect(r, b - len + 1, 1, len);
}

export function createRenderer(sprites) {
  const background = createBackground();
  const art = createArt();
  const beam = buildBeam();

  function playerScreenPos(player, alpha) {
    return {
      x: Math.round(lerp(player.prevX, player.x, alpha) + player.w / 2),
      y: Math.round(lerp(player.prevY, player.y, alpha) + player.h),
    };
  }

  function drawPlayer(ctx, player, camX, alpha) {
    if (!player.visible) return;
    const pos = playerScreenPos(player, alpha);
    const anim = player.animation(sprites, PHOTO.shutterAt);
    sprites.draw(ctx, anim.name, anim.frame, pos.x - camX, pos.y, player.facing, player.scaleX, player.scaleY);
  }

  function drawSpot(ctx, spot, camX, time) {
    const x = Math.round(spot.x - camX);
    if (x < -20 || x > VIEW.width + 20) return;
    const y = spot.y;
    if (spot.taken) {
      ctx.globalAlpha = 0.55;
      drawText(ctx, '✓', x - 2, y - 8, { color: PALETTE.cream });
      ctx.globalAlpha = 1;
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + spot.id);
    ctx.drawImage(beam, x - 4, y - beam.height);
    // glow on the roof surface
    ctx.fillStyle = ENV.spotGlow;
    ctx.globalAlpha = 0.35 + 0.35 * pulse;
    ctx.fillRect(x - 9, y - 1, 19, 1);
    ctx.globalAlpha = 0.2 + 0.2 * pulse;
    ctx.fillRect(x - 6, y - 2, 13, 1);
    ctx.globalAlpha = 1;
    // rising sparkles
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.6 + i / 3 + spot.id * 0.17) % 1;
      ctx.globalAlpha = 1 - t;
      ctx.fillRect(x - 3 + ((i * 3 + spot.id) % 7), Math.round(y - 4 - t * 34), 1, 1);
    }
    ctx.globalAlpha = 1;
    // Floating viewfinder icon (merged into the "E" prompt while Zenyu is here)
    if (spot === activeSpotShown) return;
    const iy = Math.round(y - 44 + Math.sin(time * 2.2 + spot.id) * 1.5);
    brackets(ctx, x - 5, iy + 1, 11, 9, 3, 'rgba(24,16,34,0.6)');
    brackets(ctx, x - 6, iy, 11, 9, 3, ENV.spotGlow);
    ctx.fillStyle = Math.floor(time * 2) % 2 ? '#FF6B6B' : ENV.spotGlow;
    ctx.fillRect(x - 1, iy + 4, 1, 1);
  }

  /** The spot whose icon is currently replaced by the prompt (if any). */
  let activeSpotShown = null;
  function promptSpot(run) {
    const spot = run.activeSpot;
    return spot && !spot.taken && !run.player.inPhoto && !run.finished ? spot : null;
  }

  /** "E" key cap (or camera icon on touch) in viewfinder brackets over Zenyu. */
  function drawPrompt(ctx, run, camX, alpha) {
    if (!promptSpot(run)) return;
    const pos = playerScreenPos(run.player, alpha);
    const x = pos.x - camX;
    const y = Math.round(pos.y - 42 + Math.sin(run.time * 5) * 1.2);
    const label = run.touch ? '📷' : 'E';
    const w = run.touch ? 11 : 9;
    const bw = w + 7;
    brackets(ctx, x - Math.ceil(bw / 2) + 1, y - 3 + 1, bw, 15, 3, 'rgba(24,16,34,0.6)');
    brackets(ctx, x - Math.ceil(bw / 2), y - 3, bw, 15, 3, ENV.spotGlow);
    ctx.fillStyle = PALETTE.charcoal;
    ctx.fillRect(x - Math.ceil(w / 2), y - 1, w + 1, 10);
    ctx.fillStyle = ENV.uiPaper;
    ctx.fillRect(x - Math.ceil(w / 2) + 1, y, w - 1, 8);
    ctx.fillStyle = '#D8CCB6';
    ctx.fillRect(x - Math.ceil(w / 2) + 1, y + 7, w - 1, 1);
    drawText(ctx, label, x, y + 1, { align: 'center', color: PALETTE.charcoal });
    ctx.fillStyle = PALETTE.charcoal;
    ctx.fillRect(x - 1, y + 9, 3, 1);
    ctx.fillRect(x, y + 10, 1, 1);
  }

  function drawTexts(ctx, run, camX) {
    for (const t of run.texts.list) {
      ctx.globalAlpha = Math.min(1, t.life / 0.3);
      drawText(ctx, t.text, Math.round(t.x - camX), Math.round(t.y), {
        align: 'center',
        color: t.color,
        outline: 'rgba(24,16,34,0.85)',
      });
    }
    ctx.globalAlpha = 1;
  }

  /** Viewfinder brackets close in on the subject, then fade after the shutter. */
  function drawViewfinder(ctx, run) {
    const seq = run.photoSeq;
    if (!seq?.real || !seq.frame) return;
    const f = seq.frame;
    let inset;
    let alpha = 1;
    if (seq.t < PHOTO.shutterAt) inset = Math.round((1 - seq.t / PHOTO.shutterAt) * 14);
    else {
      inset = 0;
      alpha = Math.max(0, 1 - (seq.t - PHOTO.shutterAt) / (seq.duration - PHOTO.shutterAt));
    }
    // Dim everything outside the frame for a moment of focus.
    ctx.fillStyle = `rgba(20, 12, 28, ${0.3 * alpha})`;
    ctx.fillRect(0, 0, VIEW.width, f.y);
    ctx.fillRect(0, f.y + f.h, VIEW.width, VIEW.height - f.y - f.h);
    ctx.fillRect(0, f.y, f.x, f.h);
    ctx.fillRect(f.x + f.w, f.y, VIEW.width - f.x - f.w, f.h);
    ctx.globalAlpha = alpha;
    brackets(ctx, f.x - inset, f.y - inset, f.w + inset * 2, f.h + inset * 2, 6, ENV.uiPaper);
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(f.x + 4, f.y + 4, 2, 2);
    drawText(ctx, 'REC', f.x + 8, f.y + 3, { color: ENV.uiPaper });
    ctx.globalAlpha = 1;
  }

  function drawFlash(ctx, run) {
    if (run.flash <= 0) return;
    const reduced = run.reducedMotion;
    const max = reduced ? EFFECTS.reducedMotionFlashAlpha : 1;
    ctx.fillStyle = reduced ? '#FFF1D8' : '#FFFFFF';
    ctx.globalAlpha = max * Math.pow(run.flash, 1.6);
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
  }

  /**
   * Draw the world (everything but HUD) for a camera position.
   * `options.forPhoto` skips Zenyu and UI markers — used by photo capture.
   */
  function drawWorld(ctx, run, camX, alpha, options = {}) {
    const { level, time } = run;
    const forPhoto = Boolean(options.forPhoto);
    background.draw(ctx, camX, time);
    for (const b of level.buildings) art.drawBuilding(ctx, b, camX, time);
    const env = { touch: run.touch };
    for (const prop of level.props) art.drawProp(ctx, prop, camX, time, level, env);
    activeSpotShown = promptSpot(run);
    if (!forPhoto) for (const spot of run.spots) drawSpot(ctx, spot, camX, time);
    for (const hazard of run.hazards || []) hazard.draw(ctx, camX, art, alpha, time);
    if (!forPhoto) drawPlayer(ctx, run.player, camX, alpha);
    run.particles.draw(ctx, camX);
    background.drawMotes(ctx, camX, time, run.reducedMotion);
    if (!forPhoto) {
      drawPrompt(ctx, run, camX, alpha);
      drawTexts(ctx, run, camX);
    }
  }

  /** `still` (paused / game over) skips screen shake so frozen scenes don't jitter. */
  function drawRun(ctx, run, alpha, still = false) {
    const camX = run.camera.renderX(alpha);
    const shakeScale = still ? 0 : run.reducedMotion ? EFFECTS.reducedMotionShakeScale : 1;
    const shake = run.camera.shakeOffset(shakeScale);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawWorld(ctx, run, camX, alpha);
    ctx.restore();
    drawViewfinder(ctx, run);
    drawFlash(ctx, run);
    drawHud(ctx, run);
  }

  return { drawRun, drawWorld, drawPlayer, background, art };
}
