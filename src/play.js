// ---------------------------------------------------------------------------
// play.js — one playthrough ("run"): the player, the level, the camera,
// photo spots and everything that happens while the PLAYING state is active.
// Rendering and audio stay outside: the run only exposes state and calls
// `env.sound(name)` / `env.announce(text)` hooks.
// ---------------------------------------------------------------------------

import { VIEW, PHOTO, PLAYER, FLOW, EFFECTS } from './config.js';
import { createLevel } from './level.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { overlaps } from './collision.js';
import { Particles, FloatingTexts, createHazards } from './entities.js';
import { makePolaroid } from './photo.js';

const noop = () => {};

/**
 * @param {object} env
 * @param {boolean} env.reducedMotion
 * @param {{ capture: Function, frameRect: Function }} env.photographer
 * @param {(name: string, data?: object) => void} [env.sound]
 * @param {(text: string) => void} [env.announce]
 */
export function createRun(env) {
  const sound = env.sound || noop;
  const announce = env.announce || noop;
  const level = createLevel();
  const player = new Player(level.start.x, level.start.y);
  const camera = new Camera(level.width);
  const particles = new Particles();
  const texts = new FloatingTexts();
  camera.snapTo(player);

  const run = {
    level,
    player,
    camera,
    particles,
    texts,
    spots: level.spots.map((s) => ({ ...s, taken: false })),
    hazards: createHazards(level.hazards),
    photos: [],
    photosShown: 0, // counter value (ticks up when the polaroid lands)
    time: 0, // world animation time (pauses during photo freezes)
    clock: 0, // the run timer shown in the HUD
    reducedMotion: Boolean(env.reducedMotion),
    touch: false,
    activeSpot: null,
    photoSeq: null,
    popup: null,
    flash: 0,
    counterBump: 0,
    heartWobble: 0,
    outcome: null, // 'won' | 'lost' once the run is over
    outcomeTimer: 0,
    finished: false,
    cheerTimer: 0.5, // victory hops after the final photo
    cheerFlip: false,

    get frozen() {
      return Boolean(run.photoSeq?.real);
    },

    /** Hooks used by hazards. */
    sound,
    addHazard(hazard) {
      run.hazards.push(hazard);
    },
    isOnScreen(x) {
      return Math.abs(x - (camera.x + VIEW.width / 2)) < VIEW.width / 2 + 24;
    },

    update(dt, input) {
      run.touch = input.isTouch();
      if (!run.finished) run.clock += dt;
      if (!run.frozen) {
        // The world holds its breath while the shutter fires.
        run.time += dt;
        updateHazards(dt);
      }

      player.update(dt, input, level.solids, level.width);
      checkHazardHits();
      handlePlayerEvents();
      checkFall();
      updateActiveSpot();
      tryStartPhoto();
      if (run.photoSeq) updatePhotoSequence(dt);

      camera.update(dt, player);
      particles.update(dt);
      texts.update(dt);
      updateEffects(dt);
      updateOutcome(dt);
    },
  };

  // --- Hazards -------------------------------------------------------------------------
  function updateHazards(dt) {
    for (const hazard of run.hazards) hazard.update(dt, run);
    run.hazards = run.hazards.filter((h) => h.alive !== false);
  }

  /** A slightly shrunken player box — near misses should feel fair. */
  function playerHurtbox() {
    return { x: player.x + 1, y: player.y + 3, w: player.w - 2, h: player.h - 4 };
  }

  function checkHazardHits() {
    if (player.dead || player.invincible > 0 || player.inPhoto) return;
    const box = playerHurtbox();
    for (const hazard of run.hazards) {
      const hit = hazard.hitbox;
      if (!hit || !overlaps(box, hit)) continue;
      if (player.hurt(hazard.centerX)) {
        if (hazard.kind === 'pigeon') {
          particles.feathers(hazard.centerX, hazard.y - 6);
          sound('flap');
        } else if (hazard.kind === 'steam') {
          for (let i = 0; i < 6; i++) particles.steam(player.centerX, player.y + 8, 0.6);
        }
      }
      break;
    }
  }

  // --- Player feedback -----------------------------------------------------------
  function handlePlayerEvents() {
    for (const e of player.events) {
      if (e.type === 'jump') {
        particles.dust(e.x, e.y, 3, 20);
        sound('jump');
      } else if (e.type === 'land') {
        particles.dust(e.x, e.y, 4 + Math.round(e.strength * 4), 30 + e.strength * 30);
        sound('land');
      } else if (e.type === 'step') {
        particles.dust(e.x - player.facing * 3, e.y, 1, 10);
        sound('step');
      } else if (e.type === 'hurt') {
        camera.shake(EFFECTS.damageShake, EFFECTS.damageShakeTime);
        run.heartWobble = 0.4;
        sound('hurt');
        if (player.dead) sound('gameOver');
      } else if (e.type === 'respawn') {
        particles.sparkle(e.x, e.y - 10, 8);
      }
    }
    player.events.length = 0;
  }

  function checkFall() {
    if (player.feetY <= PLAYER.fallDeathY || player.dead) return;
    camera.shake(EFFECTS.damageShake, EFFECTS.damageShakeTime);
    run.heartWobble = 0.4;
    sound('hurt');
    player.respawnAfterFall();
    if (player.dead) {
      sound('gameOver');
      player.y = PLAYER.fallDeathY; // stay hidden below the roofs
      player.vy = 0;
    } else {
      camera.snapTo(player);
      handlePlayerEvents();
    }
  }

  // --- Photo spots -------------------------------------------------------------------
  function updateActiveSpot() {
    run.activeSpot = null;
    if (!player.grounded) return;
    for (const spot of run.spots) {
      const near = Math.abs(player.centerX - spot.x) <= PHOTO.triggerWidth / 2;
      if (near && Math.abs(player.feetY - spot.y) < 2) run.activeSpot = spot;
    }
  }

  function tryStartPhoto() {
    if (player.photoBuffer <= 0 || !player.grounded || player.inPhoto || player.dead) return;
    if (run.finished) {
      player.photoBuffer = 0; // the album is full — nothing left to shoot
      return;
    }
    const spot = run.activeSpot;
    const real = Boolean(spot && !spot.taken);
    player.startPhoto();
    run.photoSeq = {
      t: 0,
      spot,
      real,
      fired: false,
      duration: real ? PHOTO.freezeTime : 0.4,
      frame: real ? env.photographer.frameRect(run, spot) : null,
    };
    sound(real ? 'raise' : 'click');
  }

  function updatePhotoSequence(dt) {
    const seq = run.photoSeq;
    seq.t += dt;
    player.photoTime = seq.t;
    if (!seq.fired && seq.t >= PHOTO.shutterAt) {
      seq.fired = true;
      if (seq.real) takePhoto(seq.spot);
      else texts.add(seq.spot ? 'ALREADY SNAPPED!' : 'NO SHOT HERE...', player.centerX, player.y - 20);
    }
    if (seq.t >= seq.duration) {
      player.endPhoto();
      run.photoSeq = null;
    }
  }

  function takePhoto(spot) {
    const image = env.photographer.capture(run, spot);
    spot.taken = true;
    const photo = { spot, image, polaroid: makePolaroid(image, spot.name) };
    run.photos.push(photo);
    run.flash = 1;
    run.popup = { photo, t: 0, index: run.photos.length };
    particles.sparkle(spot.x, spot.y - 20, 14);
    sound('shutter');
    announce(`Photo ${run.photos.length} of ${PHOTO.total}: ${spot.name.toLowerCase()}.`);
    if (run.photos.length === PHOTO.total) {
      run.finished = true; // stop the clock on the final shutter
      run.outcomeTimer = FLOW.winDelay;
    }
  }

  // --- Effects & outcome ---------------------------------------------------------------
  function updateEffects(dt) {
    run.flash = Math.max(0, run.flash - dt / PHOTO.flashTime);
    run.counterBump = Math.max(0, run.counterBump - dt);
    run.heartWobble = Math.max(0, run.heartWobble - dt);
    if (run.popup) {
      run.popup.t += dt;
      if (run.popup.t >= PHOTO.popupTime) {
        run.photosShown = run.popup.index;
        run.counterBump = 0.35;
        run.popup = null;
        sound('collect');
      }
    }
  }

  function updateOutcome(dt) {
    if (run.outcome) return;
    if (run.finished && run.photos.length === PHOTO.total) {
      run.outcomeTimer -= dt;
      // Victory hops with a shower of sparkles while the album is prepared.
      run.cheerTimer -= dt;
      if (run.cheerTimer <= 0 && !run.photoSeq) {
        run.cheerTimer = 0.55;
        player.cheer();
        particles.sparkle(player.centerX, player.y - 4, 8, run.cheerFlip ? '#FF9AA2' : undefined);
        run.cheerFlip = !run.cheerFlip;
      }
      if (run.outcomeTimer <= 0 && !run.popup) run.outcome = 'won';
    } else if (player.dead) {
      if (!run.finished) {
        run.finished = true;
        run.outcomeTimer = FLOW.deathDelay;
      }
      run.outcomeTimer -= dt;
      if (run.outcomeTimer <= 0) run.outcome = 'lost';
    }
  }

  return run;
}
