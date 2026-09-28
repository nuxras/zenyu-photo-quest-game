// ---------------------------------------------------------------------------
// display.js — creates the game's DOM inside any container and keeps the
// 320x180 canvas integer-scaled (in *device* pixels) and letterboxed.
// ---------------------------------------------------------------------------

import { VIEW } from './config.js';

// Component styles are injected once so embedding needs only `init(div)`.
const STYLE_ID = 'zpq-styles';
const COMPONENT_CSS = `
.zpq-root { position: relative; width: 100%; height: 100%; min-height: 180px; overflow: hidden;
  display: flex; align-items: center; justify-content: center; background: #140e1c;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; outline: none; }
.zpq-root:focus-visible { box-shadow: inset 0 0 0 2px #ffd27e; }
.zpq-canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.zpq-touch { position: absolute; inset: 0; pointer-events: none; display: none; }
.zpq-root.zpq-has-touch.zpq-playing .zpq-touch { display: block; }
.zpq-btn { position: absolute; pointer-events: auto; border: 2px solid rgba(244,236,220,.55); border-radius: 50%;
  background: rgba(36,24,48,.42); color: #f4ecdc; font: 700 clamp(14px, 4.2vmin, 26px)/1 monospace;
  width: clamp(48px, 13vmin, 84px); height: clamp(48px, 13vmin, 84px); display: flex; align-items: center;
  justify-content: center; touch-action: none; backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
.zpq-btn.zpq-down { background: rgba(255,210,126,.45); border-color: #ffd27e; transform: scale(.94); }
.zpq-btn-left  { left: max(12px, env(safe-area-inset-left)); bottom: max(14px, env(safe-area-inset-bottom)); }
.zpq-btn-right { left: calc(max(12px, env(safe-area-inset-left)) + clamp(56px, 15vmin, 96px)); bottom: max(14px, env(safe-area-inset-bottom)); }
.zpq-btn-jump  { right: max(12px, env(safe-area-inset-right)); bottom: calc(max(14px, env(safe-area-inset-bottom)) + clamp(30px, 8vmin, 52px)); }
.zpq-btn-photo { right: calc(max(12px, env(safe-area-inset-right)) + clamp(56px, 15vmin, 96px)); bottom: max(14px, env(safe-area-inset-bottom)); }
.zpq-btn-pause { top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  width: clamp(36px, 9vmin, 52px); height: clamp(36px, 9vmin, 52px); border-radius: 12px; font-size: clamp(12px, 3.4vmin, 18px); }
.zpq-btn-pause.zpq-down { transform: translateX(-50%) scale(.94); }
.zpq-rotate { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + clamp(46px, 12vmin, 64px)); left: 50%; transform: translateX(-50%);
  display: none; padding: 6px 12px; border-radius: 999px; background: rgba(36,24,48,.7); color: #f4ecdc;
  font: 600 13px/1.2 system-ui, sans-serif; white-space: nowrap; pointer-events: none; }
@media (orientation: portrait) and (pointer: coarse) { .zpq-rotate { display: block; } }
.zpq-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = COMPONENT_CSS;
  document.head.appendChild(style);
}

/**
 * Build the root element + canvas inside `container`.
 * Returns helpers for scaling and converting pointer positions.
 */
export function createDisplay(container) {
  injectStyles();
  const root = document.createElement('div');
  root.className = 'zpq-root';
  root.tabIndex = 0; // focusable: keyboard input is scoped to the game
  root.setAttribute('role', 'application');
  root.setAttribute(
    'aria-label',
    "Zenyu's Photo Quest. Arrow keys or A and D to move, Space to jump, E to take a photo, P or Escape to pause, M to mute.",
  );

  const canvas = document.createElement('canvas');
  canvas.className = 'zpq-canvas';
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  root.appendChild(canvas);

  // Phones held upright get a gentle nudge to rotate (the game still works).
  const rotateHint = document.createElement('div');
  rotateHint.className = 'zpq-rotate';
  rotateHint.textContent = '↻ Rotate your phone for a bigger view';
  rotateHint.setAttribute('aria-hidden', 'true');
  root.appendChild(rotateHint);

  // Screen-reader live region for important moments (photo taken, win...).
  const live = document.createElement('div');
  live.className = 'zpq-sr';
  live.setAttribute('aria-live', 'polite');
  root.appendChild(live);

  container.appendChild(root);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let scale = 1;

  /** Largest integer device-pixel scale that fits; fractional only if tiny. */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const availW = root.clientWidth * dpr;
    const availH = root.clientHeight * dpr;
    if (!availW || !availH) return;
    const fit = Math.min(availW / VIEW.width, availH / VIEW.height);
    const deviceScale = fit >= 1 ? Math.floor(fit) : fit;
    scale = deviceScale / dpr;
    canvas.style.width = `${VIEW.width * scale}px`;
    canvas.style.height = `${VIEW.height * scale}px`;
  }

  const observer = new ResizeObserver(resize);
  observer.observe(root);
  window.addEventListener('resize', resize);
  resize();

  /** Convert a client (CSS px) position to game pixels. */
  function toGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW.width,
      y: ((clientY - rect.top) / rect.height) * VIEW.height,
    };
  }

  function announce(message) {
    live.textContent = message;
  }

  function destroy() {
    observer.disconnect();
    window.removeEventListener('resize', resize);
    root.remove();
  }

  return { root, canvas, ctx, toGame, announce, destroy };
}
