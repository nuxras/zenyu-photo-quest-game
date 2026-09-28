// ---------------------------------------------------------------------------
// player.js — Zenyu's movement, state and animation selection.
// The player never plays sounds or spawns particles itself; it pushes small
// events ({ type, x, y }) that play.js turns into juice.
// ---------------------------------------------------------------------------

import { PHYSICS, PLAYER } from './config.js';
import { moveX, moveY } from './collision.js';

/** Move `value` toward `target` by at most `amount`. */
function approach(value, target, amount) {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

export class Player {
  constructor(x, y) {
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.reset(x, y, PLAYER.hearts);
  }

  /** Place Zenyu with feet at (x, y). */
  reset(x, y, hearts = this.hearts) {
    this.x = x - this.w / 2; // hitbox top-left
    this.y = y - this.h;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.hearts = hearts;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.photoBuffer = 0;
    this.jumpCutAvailable = false;
    this.invincible = 0;
    this.stun = 0;
    this.dead = false;
    this.inPhoto = false;
    this.photoTime = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.animTime = 0;
    this.walkClock = 0;
    this.stepTimer = 0;
    this.blinkTimer = 2 + Math.random() * 2;
    this.safeSpot = { x: this.x, y: this.y }; // last solid ground for respawns
    this.events = [];
  }

  get centerX() {
    return this.x + this.w / 2;
  }

  get feetY() {
    return this.y + this.h;
  }

  /** Advance one fixed step. `solids` are the level's collision boxes. */
  update(dt, input, solids, levelWidth) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.invincible = Math.max(0, this.invincible - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.animTime += dt;

    const inControl = !this.dead && !this.inPhoto && this.stun === 0;

    // --- Horizontal: accelerate toward the target speed ----------------------
    let move = 0;
    if (inControl) move = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    if (move !== 0) this.facing = move;
    let rate;
    if (this.grounded) rate = move ? PLAYER.groundAccel : PLAYER.groundDecel;
    else rate = move ? PLAYER.airAccel : PLAYER.airDecel;
    if (this.stun > 0) rate = PLAYER.airDecel * 0.5; // let knockback play out
    if (this.inPhoto) rate = PLAYER.groundDecel * 2;
    this.vx = approach(this.vx, move * PLAYER.maxSpeed, rate * dt);

    // --- Jumping: buffer + coyote time make it forgiving -------------------------
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.pressed('jump')) this.jumpBuffer = PHYSICS.jumpBufferTime;
    if (inControl && this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -PHYSICS.jumpVelocity;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumpCutAvailable = true;
      this.scaleX = 0.8; // stretch on take-off
      this.scaleY = 1.2;
      this.emit('jump');
    }
    // Releasing jump early cuts the rise short → variable jump height.
    if (this.jumpCutAvailable && !input.down('jump') && this.vy < 0) {
      this.vy *= PHYSICS.jumpCutMultiplier;
      this.jumpCutAvailable = false;
    }
    if (this.vy >= 0) this.jumpCutAvailable = false;

    // Photo presses are buffered too, so pressing E just before landing works.
    this.photoBuffer = Math.max(0, this.photoBuffer - dt);
    if (inControl && input.pressed('photo')) this.photoBuffer = PLAYER.photoBufferTime;

    // --- Gravity ---------------------------------------------------------------
    const gravity = PHYSICS.gravity * (this.vy > 0 ? PHYSICS.fallGravityMultiplier : 1);
    this.vy = Math.min(this.vy + gravity * dt, PHYSICS.maxFallSpeed);

    // --- Move & collide (X then Y) -------------------------------------------------
    if (moveX(this, this.vx * dt, solids)) this.vx = 0;
    if (this.x < 0) {
      this.x = 0;
      this.vx = Math.max(0, this.vx);
    } else if (this.x + this.w > levelWidth) {
      this.x = levelWidth - this.w;
      this.vx = Math.min(0, this.vx);
    }

    const impactSpeed = this.vy;
    const wasGrounded = this.grounded;
    const hit = moveY(this, this.vy * dt, solids);
    if (hit.bonked) this.vy = 0;
    if (hit.landed) {
      this.vy = 0;
      this.grounded = true;
      this.coyote = PHYSICS.coyoteTime;
      if (!wasGrounded) this.onLand(impactSpeed);
      this.rememberSafeSpot(hit.ground);
    } else {
      this.grounded = false;
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // --- Squash & stretch relax back to 1 ---------------------------------------
    const relax = Math.min(1, dt * 14);
    this.scaleX += (1 - this.scaleX) * relax;
    this.scaleY += (1 - this.scaleY) * relax;

    this.updateFootsteps(dt);
    this.updateAnimationClocks(dt);
  }

  /** Walk-cycle and blink timers advance in fixed steps (frame-rate independent). */
  updateAnimationClocks(dt) {
    if (this.grounded && Math.abs(this.vx) > 8) {
      // Walk cycle speed follows actual speed so slow starts don't moonwalk.
      this.walkClock += (Math.abs(this.vx) / PLAYER.maxSpeed) * dt;
    } else {
      this.walkClock = 0;
    }
    this.blinkTimer -= dt;
    if (this.blinkTimer < -0.14) this.blinkTimer = 2.5 + Math.random() * 3;
  }

  onLand(impactSpeed) {
    if (impactSpeed > PLAYER.landSquashSpeed) {
      const k = Math.min(1, impactSpeed / PHYSICS.maxFallSpeed);
      this.scaleX = 1 + 0.3 * k;
      this.scaleY = 1 - 0.25 * k;
      this.emit('land', { strength: k });
    }
  }

  /** Walking dust + footstep ticks, synced to the walk cycle's contact frames. */
  updateFootsteps(dt) {
    if (!this.grounded || Math.abs(this.vx) < 20) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = 0.2;
      this.emit('step');
    }
  }

  /** Respawn point = where Zenyu last stood, kept away from ledges. */
  rememberSafeSpot(ground) {
    if (!ground || ground.hazard) return;
    const margin = 10;
    const minX = ground.x + margin;
    const maxX = ground.x + ground.w - margin - this.w;
    if (maxX < minX) return;
    this.safeSpot.x = Math.min(Math.max(this.x, minX), maxX);
    this.safeSpot.y = ground.y - this.h;
  }

  /**
   * Take a hit from something at `fromX`. Returns false while invincible.
   * Knockback pushes Zenyu away from the source.
   */
  hurt(fromX) {
    if (this.invincible > 0 || this.dead || this.inPhoto) return false;
    this.hearts -= 1;
    this.invincible = PLAYER.invincibleTime;
    this.stun = PLAYER.hurtStunTime;
    const dir = this.centerX < fromX ? -1 : 1;
    this.vx = dir * PLAYER.knockbackX;
    this.vy = -PLAYER.knockbackY;
    this.grounded = false;
    this.coyote = 0;
    this.scaleX = 0.8;
    this.scaleY = 1.2;
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.dead = true;
    }
    this.emit('hurt');
    return true;
  }

  /** After falling off the roofs: lose a heart and reappear at the safe spot. */
  respawnAfterFall() {
    this.hearts = Math.max(0, this.hearts - 1);
    this.dead = this.hearts === 0;
    if (this.dead) return;
    this.x = this.safeSpot.x;
    this.y = this.safeSpot.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.invincible = PLAYER.invincibleTime;
    this.stun = 0.2;
    this.emit('respawn');
  }

  startPhoto() {
    this.inPhoto = true;
    this.photoTime = 0;
    this.photoBuffer = 0;
    this.vx = 0;
  }

  endPhoto() {
    this.inPhoto = false;
  }

  emit(type, data = {}) {
    this.events.push({ type, x: this.centerX, y: this.feetY, ...data });
  }

  /** Pick the animation + frame to draw right now. */
  animation(sprites, shutterAt) {
    if (this.inPhoto) {
      return { name: 'photo', frame: this.photoTime >= shutterAt * 0.5 ? 1 : 0 };
    }
    if (this.stun > 0 || this.dead) return { name: 'hurt', frame: 0 };
    if (!this.grounded) {
      return { name: this.vy < 40 ? 'jump' : 'fall', frame: 0 };
    }
    if (Math.abs(this.vx) > 8) {
      return { name: 'walk', frame: sprites.frameAt('walk', this.walkClock) };
    }
    if (this.blinkTimer < 0 && sprites.has('blink')) return { name: 'blink', frame: 0 };
    return { name: 'idle', frame: sprites.frameAt('idle', this.animTime) };
  }

  /** Invincibility blink: hide every other few frames. */
  get visible() {
    return this.invincible === 0 || Math.floor(this.invincible * 16) % 2 === 0;
  }
}
