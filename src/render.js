// ---------------------------------------------------------------------------
// render.js — draws a run: world, entities, Zenyu, effects and HUD.
// (Placeholder world art while movement is being tuned.)
// ---------------------------------------------------------------------------

import { VIEW, PHOTO } from './config.js';

export function createRenderer(sprites) {
  function drawPlayer(ctx, player, camX, alpha) {
    if (!player.visible) return;
    const x = player.prevX + (player.x - player.prevX) * alpha + player.w / 2;
    const y = player.prevY + (player.y - player.prevY) * alpha + player.h;
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

  function drawRun(ctx, run, alpha) {
    const camX = run.camera.renderX(alpha);
    ctx.fillStyle = '#C35F66';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const s of run.level.solids) {
      ctx.fillStyle = s.kind === 'roof' ? '#46324A' : '#9C6A4B';
      ctx.fillRect(s.x - camX, s.y, s.w, s.h);
    }
    drawPlayer(ctx, run.player, camX, alpha);
  }

  return { drawRun };
}
