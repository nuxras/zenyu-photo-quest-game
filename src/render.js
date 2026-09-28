// ---------------------------------------------------------------------------
// render.js — draws a run: parallax backdrop, rooftops, props, entities,
// Zenyu, particles and screen effects. The HUD lives in hud.js.
// ---------------------------------------------------------------------------

import { VIEW, PHOTO } from './config.js';
import { createBackground } from './background.js';
import { createArt } from './art.js';

export function createRenderer(sprites) {
  const background = createBackground();
  const art = createArt();

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function drawPlayer(ctx, player, camX, alpha) {
    if (!player.visible) return;
    const x = lerp(player.prevX, player.x, alpha) + player.w / 2;
    const y = lerp(player.prevY, player.y, alpha) + player.h;
    const anim = player.animation(sprites, PHOTO.shutterAt);
    sprites.draw(
      ctx,
      anim.name,
      anim.frame,
      Math.round(x) - camX,
      Math.round(y),
      player.facing,
      player.scaleX,
      player.scaleY,
    );
  }

  /**
   * Draw the world (everything but HUD) for a camera position.
   * `options.forPhoto` skips Zenyu and UI markers — used by photo capture.
   */
  function drawWorld(ctx, run, camX, alpha, options = {}) {
    const { level, time } = run;
    background.draw(ctx, camX, time);
    for (const b of level.buildings) art.drawBuilding(ctx, b, camX, time);
    const env = { touch: run.touch };
    for (const prop of level.props) art.drawProp(ctx, prop, camX, time, level, env);
    if (!options.forPhoto) drawPlayer(ctx, run.player, camX, alpha);
    background.drawMotes(ctx, camX, time, run.reducedMotion);
  }

  function drawRun(ctx, run, alpha) {
    const camX = run.camera.renderX(alpha);
    const shake = run.camera.shakeOffset(run.reducedMotion ? 0.15 : 1);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawWorld(ctx, run, camX, alpha);
    ctx.restore();
  }

  return {
    drawRun,
    drawWorld,
    drawPlayer,
    background,
    art,
    viewWidth: VIEW.width,
  };
}
