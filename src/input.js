// ---------------------------------------------------------------------------
// input.js — turns keyboard, touch buttons and taps into abstract actions.
// The game only ever asks: is `jump` held? was `photo` pressed this step?
//
// Keyboard listeners live on the game's root element, so keys are only
// captured while the game has focus (important when embedded in a page).
// ---------------------------------------------------------------------------

/** Physical key → actions. One key can drive several actions (menus + play). */
const KEY_ACTIONS = {
  ArrowLeft: ['left'],
  KeyA: ['left'],
  ArrowRight: ['right'],
  KeyD: ['right'],
  ArrowUp: ['jump', 'up'],
  KeyW: ['jump', 'up'],
  ArrowDown: ['down'],
  KeyS: ['down'],
  Space: ['jump', 'confirm'],
  KeyE: ['photo'],
  Enter: ['photo', 'confirm'],
  NumpadEnter: ['photo', 'confirm'],
  KeyP: ['pause'],
  Escape: ['pause', 'back'],
  KeyM: ['mute'],
};

/** On-screen touch buttons: [css modifier, label, actions, accessible name]. */
const TOUCH_BUTTONS = [
  ['left', '◀', ['left'], 'Move left'],
  ['right', '▶', ['right'], 'Move right'],
  ['jump', '▲', ['jump'], 'Jump'],
  ['photo', '📷', ['photo'], 'Take photo'],
  ['pause', 'II', ['pause'], 'Pause'],
];

export function createInput(root, toGame) {
  const held = new Map(); // action -> Set of sources holding it
  const pressed = new Set(); // actions pressed since the last simulation step
  const taps = []; // pointer taps in game coordinates (menus)
  const firstInteraction = [];
  let interacted = false;
  let touchMode = false; // true while the player is using touch (affects prompts)

  function press(action, source) {
    let sources = held.get(action);
    if (!sources) held.set(action, (sources = new Set()));
    if (sources.size === 0) pressed.add(action);
    sources.add(source);
  }

  function release(action, source) {
    held.get(action)?.delete(source);
  }

  function releaseAll() {
    held.forEach((sources) => sources.clear());
    root.querySelectorAll('.zpq-down').forEach((el) => el.classList.remove('zpq-down'));
  }

  /** Browsers only allow audio after a user gesture — let audio.js hook in. */
  function noteInteraction() {
    if (interacted) return;
    interacted = true;
    firstInteraction.forEach((fn) => fn());
  }

  // --- Keyboard -------------------------------------------------------------
  function onKeyDown(event) {
    const actions = KEY_ACTIONS[event.code];
    if (!actions) return;
    event.preventDefault(); // stop arrows/space from scrolling the page
    noteInteraction();
    touchMode = false;
    if (event.repeat) return;
    actions.forEach((a) => press(a, event.code));
  }

  function onKeyUp(event) {
    const actions = KEY_ACTIONS[event.code];
    if (!actions) return;
    actions.forEach((a) => release(a, event.code));
  }

  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);
  root.addEventListener('blur', releaseAll);

  // --- Pointer taps on the canvas (menus / "tap to start") -------------------
  function onPointerDown(event) {
    touchMode = event.pointerType === 'touch';
    if (touchMode) root.classList.add('zpq-has-touch');
    noteInteraction();
    root.focus({ preventScroll: true });
    if (event.target.closest('.zpq-btn')) return;
    taps.push(toGame(event.clientX, event.clientY));
  }
  root.addEventListener('pointerdown', onPointerDown);

  // --- Touch buttons ----------------------------------------------------------
  const layer = document.createElement('div');
  layer.className = 'zpq-touch';
  for (const [name, label, actions, aria] of TOUCH_BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `zpq-btn zpq-btn-${name}`;
    button.textContent = label;
    button.setAttribute('aria-label', aria);
    button.tabIndex = -1; // keyboard users have real keys
    const pointers = new Set();
    const down = (id) => {
      pointers.add(id);
      button.classList.add('zpq-down');
      actions.forEach((a) => press(a, `${name}:${id}`));
    };
    const up = (id) => {
      pointers.delete(id);
      if (pointers.size === 0) button.classList.remove('zpq-down');
      actions.forEach((a) => release(a, `${name}:${id}`));
    };
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Release implicit capture so a thumb can slide from ◀ to ▶.
      if (button.hasPointerCapture?.(e.pointerId)) button.releasePointerCapture(e.pointerId);
      down(e.pointerId);
    });
    button.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch' && e.buttons) down(e.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      button.addEventListener(type, (e) => up(e.pointerId));
    }
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    // Never let a button take focus away from the game root (that would pause).
    button.addEventListener('mousedown', (e) => e.preventDefault());
    layer.appendChild(button);
  }
  root.appendChild(layer);

  // Coarse pointers (phones/tablets) get the buttons straight away.
  if (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) {
    root.classList.add('zpq-has-touch');
    touchMode = true;
  }

  return {
    /** True while any source holds the action. */
    down: (action) => (held.get(action)?.size ?? 0) > 0,
    /** True only during the simulation step right after the press. */
    pressed: (action) => pressed.has(action),
    /** Any meaningful press this step (for "press start"). */
    anyPressed: () =>
      ['confirm', 'jump', 'photo'].some((a) => pressed.has(a)) || taps.length > 0,
    /** Pointer taps in game pixels since the last step. */
    taps: () => taps,
    /** Must be called after every fixed simulation step. */
    endStep() {
      pressed.clear();
      taps.length = 0;
    },
    releaseAll,
    onFirstInteraction: (fn) => firstInteraction.push(fn),
    isTouch: () => touchMode,
    destroy() {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('keyup', onKeyUp);
      root.removeEventListener('blur', releaseAll);
      root.removeEventListener('pointerdown', onPointerDown);
      layer.remove();
    },
  };
}
