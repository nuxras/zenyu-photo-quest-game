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

await browser.close();

console.log(infos.filter((t) => t.startsWith('[Zenyu]')).join('\n'));
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('\nSmoke test passed ✨');
