// ---------------------------------------------------------------------------
// camera.js — horizontal follow camera with look-ahead and screen shake.
// The world is exactly one screen tall, so the camera only scrolls in X.
// ---------------------------------------------------------------------------

import { CAMERA, VIEW } from './config.js';

/** Frame-rate independent exponential smoothing factor. */
function smoothing(sharpness, dt) {
  return 1 - Math.exp(-sharpness * dt);
}

export class Camera {
  constructor(levelWidth) {
    this.levelWidth = levelWidth;
    this.x = 0;
    this.prevX = 0;
    this.lookAhead = 0;
    this.shakeTime = 0;
    this.shakeDuration = 1;
    this.shakeStrength = 0;
  }

  clamp(x) {
    return Math.max(0, Math.min(x, this.levelWidth - VIEW.width));
  }

  /** Jump straight to the player (new run / respawn). */
  snapTo(player) {
    this.lookAhead = player.facing * CAMERA.lookAhead;
    this.x = this.clamp(player.centerX + this.lookAhead - VIEW.width / 2);
    this.prevX = this.x;
  }

  update(dt, player) {
    this.prevX = this.x;
    // Look further ahead in the direction Zenyu faces, eased so turning
    // around doesn't whip the view.
    const targetLook = player.facing * CAMERA.lookAhead;
    this.lookAhead += (targetLook - this.lookAhead) * smoothing(CAMERA.lookAheadSharpness, dt);
    const target = this.clamp(player.centerX + this.lookAhead - VIEW.width / 2);
    this.x += (target - this.x) * smoothing(CAMERA.followSharpness, dt);
    this.shakeTime = Math.max(0, this.shakeTime - dt);
  }

  shake(strength, duration) {
    this.shakeStrength = Math.max(this.shakeStrength * (this.shakeTime > 0 ? 1 : 0), strength);
    this.shakeTime = duration;
    this.shakeDuration = duration;
  }

  /** Current shake offset in whole pixels (decays over the shake duration). */
  shakeOffset(scale = 1) {
    if (this.shakeTime <= 0 || scale <= 0) return { x: 0, y: 0 };
    const k = (this.shakeTime / this.shakeDuration) * this.shakeStrength * scale;
    return {
      x: Math.round((Math.random() * 2 - 1) * k),
      y: Math.round((Math.random() * 2 - 1) * k),
    };
  }

  /** Interpolated, pixel-snapped X for rendering between fixed steps. */
  renderX(alpha) {
    return Math.round(this.prevX + (this.x - this.prevX) * alpha);
  }
}
