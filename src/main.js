// ---------------------------------------------------------------------------
// main.js — public entry point. `init(container)` builds the game inside any
// element, runs a fixed-timestep loop and drives the screen state machine:
//
//   BOOT ─► TITLE ─► PLAYING ⇄ PAUSED
//                       ├─► GAME_OVER ─► PLAYING | TITLE
//                       └─► WIN ───────► PLAYING | TITLE
// ---------------------------------------------------------------------------

import { VIEW, LOOP, PALETTE, EFFECTS } from './config.js';
import { createDisplay } from './display.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { storage } from './storage.js';
import { loadZenyuSprites } from './sprites.js';
import { createRenderer } from './render.js';
import { createPhotographer } from './photo.js';
import { createLevel } from './level.js';
import { createRun } from './play.js';
import { drawText } from './font.js';
import { Menu, drawTitle, drawPause, drawGameOver, drawWin, drawToast } from './ui.js';

/**
 * Mount Zenyu's Photo Quest inside `container`.
 * @param {HTMLElement} container  any element with a size (the game fills it)
 * @param {object} [options]
 * @param {boolean} [options.autofocus]  focus the game immediately
 * @param {string}  [options.spriteUrl]  override the assets/zenyu.png location
 * @param {boolean} [options.debug]      expose window.__zenyu (also via ?debug)
 * @returns {{ destroy(): void, pause(): void }}
 */
export function init(container, options = {}) {
  if (!container) throw new Error('init(container): a container element is required');
  const display = createDisplay(container);
  const { ctx, root } = display;
  const input = createInput(root, display.toGame);
  const audio = createAudio();
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => Boolean(motionQuery?.matches);
  const titleLevel = createLevel();

  const game = {
    time: 0,
    sprites: null,
    renderer: null,
    photographer: null,
    run: null,
    menu: null,
    records: null,
    stateTime: 0, // seconds since the current state began
    toast: null,
  };

  input.onFirstInteraction(() => audio.unlock());

  const sound = (name) => audio.play(name);

  function newRun() {
    game.run = createRun({
      reducedMotion: reducedMotion(),
      photographer: game.photographer,
      sound,
      announce: display.announce,
    });
  }

  function records(extra = {}) {
    return { bestTime: storage.bestTime(), mostPhotos: storage.mostPhotos(), ...extra };
  }

  function uiEnv() {
    return {
      ...game,
      level: titleLevel,
      time: game.time,
      since: game.stateTime,
      touch: input.isTouch(),
      muted: audio.isMuted(),
      focused: document.activeElement === root,
      reducedMotion: reducedMotion(),
    };
  }

  // --- States -----------------------------------------------------------------
  const states = {
    BOOT: {
      enter() {
        loadZenyuSprites(options.spriteUrl).then((sprites) => {
          game.sprites = sprites;
          game.renderer = createRenderer(sprites);
          game.photographer = createPhotographer(game.renderer);
          setState('TITLE');
        });
      },
      render() {
        ctx.fillStyle = '#140e1c';
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
        const dots = '.'.repeat(1 + (Math.floor(game.time * 3) % 3));
        drawText(ctx, `LOADING${dots}`, VIEW.width / 2 - 16, 86, { color: PALETTE.cream });
      },
    },

    TITLE: {
      enter() {
        game.records = records();
        root.classList.remove('zpq-playing');
      },
      update() {
        if (input.anyPressed()) {
          sound('start');
          transitionTo('PLAYING', { fresh: true });
        }
      },
      render() {
        drawTitle(ctx, uiEnv());
      },
    },

    PLAYING: {
      enter(payload = {}) {
        if (payload.fresh || !game.run) newRun();
        root.classList.add('zpq-playing');
        audio.duck(false);
      },
      update(dt) {
        if (input.pressed('pause')) {
          setState('PAUSED');
          return;
        }
        game.run.update(dt, input);
        if (game.run.outcome === 'won') transitionTo('WIN');
        else if (game.run.outcome === 'lost') setState('GAME_OVER');
      },
      render(alpha) {
        game.renderer.drawRun(ctx, game.run, alpha);
      },
    },

    PAUSED: {
      enter() {
        game.menu = new Menu(
          [
            { label: 'RESUME', action: 'resume' },
            { label: 'RESTART', action: 'restart' },
            { label: 'QUIT TO TITLE', action: 'title' },
          ],
          88,
        );
        sound('pause');
        audio.duck(true);
        input.releaseAll();
        root.classList.remove('zpq-playing');
      },
      update() {
        if (input.pressed('pause')) {
          setState('PLAYING');
          return;
        }
        const action = game.menu.update(input, sound);
        if (action === 'resume') setState('PLAYING');
        if (action === 'restart') transitionTo('PLAYING', { fresh: true });
        if (action === 'title') transitionTo('TITLE');
      },
      render() {
        game.renderer.drawRun(ctx, game.run, 1);
        drawPause(ctx, uiEnv());
      },
    },

    GAME_OVER: {
      enter() {
        const result = storage.recordRun({ photos: game.run.photos.length, time: game.run.clock, won: false });
        game.records = records(result);
        game.menu = new Menu(
          [
            { label: 'TRY AGAIN', action: 'retry' },
            { label: 'TITLE', action: 'title' },
          ],
          130,
        );
        root.classList.remove('zpq-playing');
        audio.duck(true);
      },
      update() {
        if (game.stateTime < 0.6) return; // don't skip the screen by accident
        const action = game.menu.update(input, sound);
        if (action === 'retry') transitionTo('PLAYING', { fresh: true });
        if (action === 'title') transitionTo('TITLE');
      },
      render() {
        game.renderer.drawRun(ctx, game.run, 1);
        drawGameOver(ctx, uiEnv());
      },
    },

    WIN: {
      enter() {
        const result = storage.recordRun({ photos: game.run.photos.length, time: game.run.clock, won: true });
        game.records = records(result);
        game.menu = new Menu(
          [
            { label: 'PLAY AGAIN', action: 'retry' },
            { label: 'TITLE', action: 'title' },
          ],
          141,
          10,
        );
        root.classList.remove('zpq-playing');
        sound('win');
        display.announce(
          `All ten photos collected in ${Math.round(game.run.clock)} seconds! Your photo album is complete.`,
        );
      },
      update() {
        if (game.stateTime < 1.6) return;
        const action = game.menu.update(input, sound);
        if (action === 'retry') transitionTo('PLAYING', { fresh: true });
        if (action === 'title') transitionTo('TITLE');
      },
      render() {
        drawWin(ctx, uiEnv());
      },
    },
  };

  let current = null;
  function setState(name, payload) {
    states[current]?.exit?.();
    current = name;
    game.stateTime = 0;
    states[name].enter?.(payload);
  }

  // --- Shutter transition --------------------------------------------------------
  // Two bars close like a camera shutter, the state swaps, then they open.
  let transition = null;
  function transitionTo(name, payload) {
    if (transition) return;
    transition = { name, payload, t: 0, swapped: false };
  }

  function updateTransition(dt) {
    if (!transition) return;
    const half = EFFECTS.transitionTime;
    transition.t += dt;
    if (!transition.swapped && transition.t >= half) {
      transition.swapped = true;
      setState(transition.name, transition.payload);
    }
    if (transition.t >= half * 2) transition = null;
  }

  function drawTransition() {
    if (!transition) return;
    const half = EFFECTS.transitionTime;
    const k = transition.t < half ? transition.t / half : 1 - (transition.t - half) / half;
    const eased = k * k * (3 - 2 * k);
    ctx.fillStyle = '#140e1c';
    if (reducedMotion()) {
      ctx.globalAlpha = eased;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.globalAlpha = 1;
    } else {
      const bar = Math.ceil((VIEW.height / 2) * eased);
      ctx.fillRect(0, 0, VIEW.width, bar);
      ctx.fillRect(0, VIEW.height - bar, VIEW.width, bar);
    }
  }

  // --- Global keys (any state) ------------------------------------------------------
  function handleGlobalInput() {
    if (input.pressed('mute')) {
      audio.unlock();
      audio.toggleMute();
      game.toast = { text: audio.isMuted() ? 'SOUND OFF' : 'SOUND ON', t: 1.2 };
    }
  }

  // Losing focus or hiding the tab pauses the action (never lose a run).
  function autoPause() {
    input.releaseAll();
    if (current === 'PLAYING' && !transition) setState('PAUSED');
  }
  const onBlur = (event) => {
    if (event.relatedTarget && root.contains(event.relatedTarget)) return;
    autoPause();
  };
  const onVisibility = () => document.hidden && autoPause();
  root.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  // --- Fixed-timestep loop ------------------------------------------------------------
  // The simulation always advances in LOOP.step increments no matter the
  // display's refresh rate (30/60/144 Hz); leftover time carries over and is
  // used to interpolate positions when drawing.
  let accumulator = 0;
  let lastTime = performance.now();
  let rafId = 0;

  function update(dt) {
    game.time += dt;
    game.stateTime += dt;
    if (game.toast) game.toast.t -= dt;
    handleGlobalInput();
    if (!transition) states[current].update?.(dt);
    updateTransition(dt);
    input.endStep(); // presses count for exactly one simulation step
  }

  function frame(now) {
    const delta = Math.min((now - lastTime) / 1000, LOOP.maxFrameDelta);
    lastTime = now;
    accumulator += delta;
    while (accumulator >= LOOP.step) {
      update(LOOP.step);
      accumulator -= LOOP.step;
    }
    const alpha = accumulator / LOOP.step; // 0..1 between two simulation steps
    states[current].render?.(alpha);
    drawTransition();
    drawToast(ctx, game.toast);
    rafId = requestAnimationFrame(frame);
  }

  setState('BOOT');
  rafId = requestAnimationFrame(frame);
  if (options.autofocus) root.focus({ preventScroll: true });

  // `?debug` exposes a handle for the headless smoke test.
  if (options.debug ?? new URLSearchParams(location.search).has('debug')) {
    window.__zenyu = {
      get state() {
        return current;
      },
      get spriteMode() {
        return game.sprites?.mode ?? null;
      },
      game,
      setState,
    };
  }

  return {
    /** Pause gameplay (e.g. when the portfolio page opens a modal). */
    pause: autoPause,
    /** Stop the loop, audio and listeners, and remove the game's DOM. */
    destroy() {
      cancelAnimationFrame(rafId);
      root.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      audio.destroy();
      input.destroy();
      display.destroy();
    },
  };
}
