// ---------------------------------------------------------------------------
// main.js — public entry point. `init(container)` builds the game inside any
// element, runs a fixed-timestep loop and drives the screen state machine.
// ---------------------------------------------------------------------------

import { VIEW, LOOP, PALETTE } from './config.js';
import { createDisplay } from './display.js';
import { loadZenyuSprites } from './sprites.js';
import { drawText, BIG } from './font.js';

/**
 * Mount Zenyu's Photo Quest inside `container`.
 * @param {HTMLElement} container  any element with a size (it fills it)
 * @param {object} [options]
 * @param {boolean} [options.autofocus]  focus the game immediately
 * @param {string}  [options.spriteUrl]  override the zenyu.png location
 * @returns {{ destroy(): void }}
 */
export function init(container, options = {}) {
  if (!container) throw new Error('init(container): a container element is required');
  const display = createDisplay(container);
  const { ctx } = display;
  const game = { time: 0, sprites: null };

  // --- State machine --------------------------------------------------------
  const states = {
    BOOT: {
      enter() {
        loadZenyuSprites(options.spriteUrl).then((sprites) => {
          game.sprites = sprites;
          setState('TITLE');
        });
      },
      render() {
        ctx.fillStyle = '#140e1c';
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
        drawText(ctx, 'LOADING...', VIEW.width / 2, 86, { align: 'center', color: PALETTE.cream });
      },
    },
    TITLE: {
      render() {
        ctx.fillStyle = '#E59A6A';
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
        drawText(ctx, "ZENYU'S PHOTO QUEST", VIEW.width / 2, 30, {
          font: BIG,
          align: 'center',
          color: PALETTE.cream,
          shadow: PALETTE.charcoal,
        });
        const s = game.sprites;
        s.draw(ctx, 'idle', s.frameAt('idle', game.time), 160, 120, 1);
      },
    },
  };

  let current = null;
  function setState(name, payload) {
    states[current]?.exit?.();
    current = name;
    states[name].enter?.(payload);
  }

  // --- Fixed-timestep loop ----------------------------------------------------
  // Simulation always advances in LOOP.step increments no matter the display
  // refresh rate (30/60/144 Hz); leftover time carries into the next frame.
  let accumulator = 0;
  let lastTime = performance.now();
  let rafId = 0;

  function update(dt) {
    game.time += dt;
    states[current].update?.(dt);
  }

  function frame(now) {
    const delta = Math.min((now - lastTime) / 1000, LOOP.maxFrameDelta);
    lastTime = now;
    accumulator += delta;
    while (accumulator >= LOOP.step) {
      update(LOOP.step);
      accumulator -= LOOP.step;
    }
    // alpha = how far we are between two simulation steps (for interpolation)
    states[current].render?.(accumulator / LOOP.step);
    rafId = requestAnimationFrame(frame);
  }

  setState('BOOT');
  rafId = requestAnimationFrame(frame);
  if (options.autofocus) display.root.focus({ preventScroll: true });

  // `?debug` exposes a read-only-ish handle for the headless smoke test.
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
    destroy() {
      cancelAnimationFrame(rafId);
      display.destroy();
    },
  };
}
