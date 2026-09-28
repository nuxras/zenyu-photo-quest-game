// ---------------------------------------------------------------------------
// Headless smoke test (Playwright + Chromium).
//   npm run serve          # in one terminal (or any static server on :8080)
//   npm run test:smoke     # in another
// Loads the game, fails on any JS error, and saves screenshots to
// tools/screenshots/. BASE_URL overrides the default http://127.0.0.1:8080/.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080/';
const OUT = new URL('./screenshots/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const errors = [];
const infos = [];

function isExpectedNoise(text) {
  // Probing for the optional assets/zenyu.png produces a 404 network log
  // when the file is absent. That is the documented fallback path.
  return /zenyu\.png/.test(text) || /Failed to load resource.*404/.test(text);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && !isExpectedNoise(text)) errors.push(text);
  if (msg.type() === 'info' || msg.type() === 'log') infos.push(text);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname });
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    errors.push(`${name}: ${err.message}`);
    console.log(`✗ ${name}: ${err.message}`);
  }
}

await step('page loads and reaches the title screen', async () => {
  await page.goto(`${BASE_URL}?debug`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zenyu?.state === 'TITLE', null, { timeout: 5000 });
  await page.waitForTimeout(600);
  await shot('01-title');
});

await step('sprite mode is reported', async () => {
  const mode = await page.evaluate(() => window.__zenyu.spriteMode);
  if (!['sheet', 'procedural'].includes(mode)) throw new Error(`unexpected sprite mode ${mode}`);
  console.log(`  sprite mode: ${mode}`);
});

const player = () => page.evaluate(() => {
  const p = window.__zenyu.game.run.player;
  return { x: p.x, y: p.y, grounded: p.grounded, hearts: p.hearts, vx: p.vx };
});

await step('title → playing on Enter', async () => {
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__zenyu.state === 'PLAYING', null, { timeout: 3000 });
  await page.waitForTimeout(400);
});

await step('walks right with the arrow key', async () => {
  const before = await player();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await shot('02-walking');
  await page.keyboard.up('ArrowRight');
  const after = await player();
  if (after.x - before.x < 30) throw new Error(`moved only ${after.x - before.x}px`);
});

await step('jumps and lands again', async () => {
  await page.waitForTimeout(300);
  const before = await player();
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  const mid = await player();
  await shot('03-jumping');
  await page.keyboard.up('Space');
  await page.waitForTimeout(900);
  const after = await player();
  if (before.y - mid.y < 12) throw new Error(`rose only ${before.y - mid.y}px`);
  if (!after.grounded) throw new Error('did not land');
});

await step('camera follows across the city', async () => {
  for (const [i, x] of [[4, 1180], [5, 2330], [6, 3700]]) {
    await page.evaluate((targetX) => {
      const { run } = window.__zenyu.game;
      run.player.reset(targetX, 40, run.player.hearts);
      run.camera.snapTo(run.player);
    }, x);
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => ({
      cam: window.__zenyu.game.run.camera.x,
      px: window.__zenyu.game.run.player.x,
    }));
    if (Math.abs(state.cam + 160 - state.px) > 90 && state.cam > 0 && state.cam < 3580) {
      throw new Error(`camera ${state.cam} too far from player ${state.px}`);
    }
    await shot(`0${i}-city-${x}`);
  }
});

/** Teleport Zenyu onto photo spot `index` (debug helper). */
async function goToSpot(index, { shield = false } = {}) {
  await page.evaluate(
    ([i, shieldOn]) => {
      const { run } = window.__zenyu.game;
      const spot = run.spots[i];
      run.player.reset(spot.x, spot.y, run.player.hearts);
      if (shieldOn) run.player.invincible = 3; // hazards can't interrupt the test
      run.camera.snapTo(run.player);
    },
    [index, shield],
  );
  await page.waitForTimeout(250);
}

const state = () => page.evaluate(() => window.__zenyu.state);

await step('snaps a photo at a glowing spot', async () => {
  await goToSpot(0);
  await shot('07-at-spot');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(110);
  await shot('08-viewfinder');
  await page.waitForTimeout(520);
  await shot('09-polaroid');
  const n = await page.evaluate(() => window.__zenyu.game.run.photos.length);
  if (n !== 1) throw new Error(`expected 1 photo, got ${n}`);
});

await step('pressing E away from a spot does not count', async () => {
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const { run } = window.__zenyu.game;
    run.player.reset(120, 132, run.player.hearts);
  });
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const n = await page.evaluate(() => window.__zenyu.game.run.photos.length);
  if (n !== 1) throw new Error(`expected still 1 photo, got ${n}`);
});

await step('bumping a pigeon costs a heart (knockback + blink)', async () => {
  await page.evaluate(() => {
    const { run } = window.__zenyu.game;
    const pigeon = run.hazards.find((h) => h.kind === 'pigeon');
    run.player.reset(pigeon.x, pigeon.y, 3);
    run.camera.snapTo(run.player);
  });
  await page.waitForTimeout(120);
  await shot('10-hurt');
  const p = await page.evaluate(() => {
    const pl = window.__zenyu.game.run.player;
    return { hearts: pl.hearts, invincible: pl.invincible };
  });
  if (p.hearts !== 2) throw new Error(`expected 2 hearts, got ${p.hearts}`);
  if (!(p.invincible > 0)) throw new Error('no invincibility after the hit');
});

await step('steam vents and barrels are active', async () => {
  const kinds = await page.evaluate(() => {
    const { run } = window.__zenyu.game;
    return {
      vents: run.hazards.filter((h) => h.kind === 'steam').length,
      barrels: run.hazards.filter((h) => h.kind === 'barrel').length,
    };
  });
  if (kinds.vents < 4) throw new Error(`expected steam vents, got ${kinds.vents}`);
  if (kinds.barrels < 1) throw new Error('no barrels have spawned');
  await page.evaluate(() => {
    const { run } = window.__zenyu.game;
    run.player.reset(1700, 140, run.player.hearts);
    run.player.invincible = 2;
    run.camera.snapTo(run.player);
  });
  await page.waitForTimeout(900);
  await shot('11-barrels');
});

await step('falling between roofs costs a heart and respawns safely', async () => {
  await page.evaluate(() => {
    const { run } = window.__zenyu.game;
    run.player.reset(456, 100, 2);
    run.player.safeSpot = { x: 400, y: 132 - run.player.h };
  });
  await page.waitForTimeout(1300);
  const p = await player();
  if (p.hearts !== 1) throw new Error(`expected 1 heart, got ${p.hearts}`);
  if (!p.grounded) throw new Error('not standing after respawn');
});

await step('P pauses and resumes', async () => {
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  if ((await state()) !== 'PAUSED') throw new Error(`state is ${await state()}`);
  await shot('12-paused');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  if ((await state()) !== 'PLAYING') throw new Error(`state is ${await state()}`);
});

await step('M toggles sound and remembers it', async () => {
  const key = 'zenyu-photo-quest:muted';
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(100);
  const muted = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(100);
  const unmuted = await page.evaluate((k) => localStorage.getItem(k), key);
  if (muted !== '1' || unmuted !== '0') throw new Error(`mute flags ${muted} → ${unmuted}`);
});

await step('all 10 photo spots can be photographed → album', async () => {
  await page.evaluate(() => {
    window.__zenyu.game.run.player.hearts = 3;
  });
  const count = await page.evaluate(() => window.__zenyu.game.run.spots.length);
  if (count !== 10) throw new Error(`level has ${count} spots`);
  for (let i = 0; i < count; i++) {
    const taken = await page.evaluate((j) => window.__zenyu.game.run.spots[j].taken, i);
    if (taken) continue;
    await goToSpot(i, { shield: true });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(i === 4 ? 150 : 850);
    if (i === 4) {
      await shot('13-tower-photo');
      await page.waitForTimeout(700);
    }
  }
  const n = await page.evaluate(() => window.__zenyu.game.run.photos.length);
  if (n !== 10) throw new Error(`expected 10 photos, got ${n}`);
  await page.waitForFunction(() => window.__zenyu.state === 'WIN', null, { timeout: 8000 });
  await page.waitForTimeout(2600);
  await shot('14-album');
  const best = await page.evaluate(() => localStorage.getItem('zenyu-photo-quest:best-time'));
  if (!best) throw new Error('best time was not saved');
});

await step('play again, then losing every heart shows game over', async () => {
  await page.keyboard.press('Enter'); // PLAY AGAIN
  await page.waitForFunction(
    () => window.__zenyu.state === 'PLAYING' && window.__zenyu.game.run.clock < 1,
    null,
    { timeout: 3000 },
  );
  await page.evaluate(() => {
    const { run } = window.__zenyu.game;
    run.player.reset(456, 100, 1);
  });
  await page.waitForFunction(() => window.__zenyu.state === 'GAME_OVER', null, { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot('15-game-over');
});

await step('game over → title via the menu', async () => {
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__zenyu.state === 'TITLE', null, { timeout: 3000 });
  await page.waitForTimeout(500);
  await shot('16-title-with-records');
});

await step('audio unlocked after the first key press', async () => {
  const audioState = await page.evaluate(() => window.__zenyu.audioState);
  console.log(`  audio context: ${audioState}`);
  if (audioState === 'locked') throw new Error('AudioContext was never created');
});

await step('touch controls work on a phone (landscape + portrait)', async () => {
  const phone = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const m = await phone.newPage();
  m.on('pageerror', (err) => errors.push(`phone pageerror: ${err.message}`));
  await m.goto(`${BASE_URL}?debug`, { waitUntil: 'load' });
  await m.waitForFunction(() => window.__zenyu?.state === 'TITLE', null, { timeout: 5000 });
  await m.waitForTimeout(400);
  await m.screenshot({ path: new URL('18-phone-title.png', OUT).pathname });
  await m.tap('canvas');
  await m.waitForFunction(() => window.__zenyu.state === 'PLAYING', null, { timeout: 3000 });
  await m.waitForTimeout(500);
  const display = await m.evaluate(() => getComputedStyle(document.querySelector('.zpq-touch')).display);
  if (display !== 'block') throw new Error(`touch buttons hidden (${display})`);
  const x0 = await m.evaluate(() => window.__zenyu.game.run.player.x);
  const press = (type) =>
    m.evaluate((t) => {
      const b = document.querySelector('.zpq-btn-right');
      b.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true }));
    }, type);
  await press('pointerdown');
  await m.waitForTimeout(600);
  await m.screenshot({ path: new URL('19-phone-play.png', OUT).pathname });
  await press('pointerup');
  const x1 = await m.evaluate(() => window.__zenyu.game.run.player.x);
  if (x1 - x0 < 20) throw new Error(`▶ moved Zenyu only ${x1 - x0}px`);
  await m.setViewportSize({ width: 390, height: 844 });
  await m.waitForTimeout(400);
  await m.screenshot({ path: new URL('20-phone-portrait.png', OUT).pathname });
  await phone.close();
});

await step('prefers-reduced-motion: softer flash, no errors', async () => {
  const calm = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' });
  const r = await calm.newPage();
  r.on('pageerror', (err) => errors.push(`reduced-motion pageerror: ${err.message}`));
  await r.goto(`${BASE_URL}?debug`, { waitUntil: 'load' });
  await r.waitForFunction(() => window.__zenyu?.state === 'TITLE', null, { timeout: 5000 });
  await r.keyboard.press('Enter');
  await r.waitForFunction(() => window.__zenyu.state === 'PLAYING', null, { timeout: 3000 });
  const reduced = await r.evaluate(() => window.__zenyu.game.run.reducedMotion);
  if (!reduced) throw new Error('run did not pick up prefers-reduced-motion');
  // Input is ignored while the transition opens; wait for the run to start.
  await r.waitForFunction(() => window.__zenyu.game.run.clock > 0.2, null, { timeout: 3000 });
  await r.evaluate(() => {
    const { run } = window.__zenyu.game;
    run.player.reset(run.spots[1].x, run.spots[1].y, 3);
    run.camera.snapTo(run.player);
  });
  await r.waitForTimeout(250);
  await r.keyboard.press('KeyE');
  await r.waitForTimeout(200);
  await r.screenshot({ path: new URL('21-reduced-motion-flash.png', OUT).pathname });
  await r.waitForTimeout(400);
  const photos = await r.evaluate(() => window.__zenyu.game.run.photos.length);
  if (photos !== 1) throw new Error(`expected a photo, got ${photos}`);
  await calm.close();
});

await step('embeds inside a small portfolio card and scales crisply', async () => {
  const embed = await browser.newPage({ viewport: { width: 800, height: 700 } });
  embed.on('pageerror', (err) => errors.push(`embed pageerror: ${err.message}`));
  await embed.goto(`${BASE_URL}examples/embed.html`, { waitUntil: 'load' });
  await embed.waitForTimeout(800);
  const size = await embed.evaluate(() => {
    const c = document.querySelector('#zenyu-game canvas');
    return { w: c.clientWidth, h: c.clientHeight, dpr: devicePixelRatio };
  });
  const scale = (size.w * size.dpr) / 320;
  if (!Number.isInteger(scale)) throw new Error(`non-integer scale ${scale}`);
  await embed.screenshot({ path: new URL('17-embed.png', OUT).pathname });
  await embed.close();
});

await browser.close();

console.log(infos.filter((t) => t.startsWith('[Zenyu]')).join('\n'));
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('\nSmoke test passed ✨');
