// ---------------------------------------------------------------------------
// Level reachability check — runs in plain Node (no browser needed):
//   node tools/check-level.mjs
//
// It uses the game's real Player physics to simulate thousands of jumps
// (different take-off points, speeds, jump-hold times and air control) from
// every standable surface, builds a "can land on" graph, and then proves:
//   1. every photo spot's surface is reachable from the start, and
//   2. no reachable surface is a dead end (all spots stay reachable from
//      anywhere Zenyu can get to — no soft-locks).
// Moving hazards are ignored: they cost hearts, they never block a path.
// ---------------------------------------------------------------------------

import { createLevel } from '../src/level.js';
import { Player } from '../src/player.js';
import { LOOP, PLAYER, PHYSICS } from '../src/config.js';

const level = createLevel();
const surfaces = level.solids.map((s, i) => ({ ...s, id: i }));

/** A scripted stand-in for input.js. */
function scriptedInput() {
  const state = { left: false, right: false, jump: false, jumpPressed: false };
  return {
    state,
    down: (a) => Boolean(state[a]),
    pressed: (a) => (a === 'jump' ? state.jumpPressed : false),
    isTouch: () => false,
  };
}

/** Which surface is Zenyu standing on (feet exactly on its top)? */
function surfaceUnder(player) {
  const feet = player.y + player.h;
  let best = null;
  for (const s of surfaces) {
    const overlapX = player.x < s.x + s.w && player.x + player.w > s.x;
    if (overlapX && Math.abs(feet - s.y) < 0.5) best = s;
  }
  return best;
}

/**
 * Simulate one attempt: start standing at `x` on `surface`, run in `dir`
 * (optionally already at full speed), jump (hold for `hold` s, or walk off
 * the edge if hold < 0), steer for `steer` s. Returns the surface landed on.
 */
function simulate(surface, x, dir, fast, hold, steer) {
  const player = new Player(x, surface.y);
  const input = scriptedInput();
  player.grounded = true;
  player.coyote = PHYSICS.coyoteTime;
  if (fast) player.vx = dir * PLAYER.maxSpeed;
  const step = LOOP.step;
  let t = 0;
  let leftGround = false;
  while (t < 3) {
    input.state.right = dir > 0 && t < steer;
    input.state.left = dir < 0 && t < steer;
    input.state.jump = hold >= 0 && t < hold;
    input.state.jumpPressed = hold >= 0 && t === 0;
    player.update(step, input, level.solids, level.width);
    t += step;
    if (!player.grounded) leftGround = true;
    if (leftGround && player.grounded) return surfaceUnder(player);
    if (!leftGround && hold < 0 && t > 2) return null; // never walked off
    if (player.y > PLAYER.fallDeathY) return null;
  }
  return null;
}

// --- Build the landing graph ------------------------------------------------------
const edges = new Map(surfaces.map((s) => [s.id, new Set()]));
const holds = [-1, 0.08, 0.16, 0.3, 0.6];
const steers = [3, 0.12, 0.3];
let simulations = 0;

for (const s of surfaces) {
  // Only positions where Zenyu actually fits on top (not inside a wall).
  const standX = [];
  for (let x = s.x + 5; x <= s.x + s.w - 5; x += 6) standX.push(x);
  standX.push(s.x + 5, s.x + s.w - 5);
  for (const x of standX) {
    const probe = new Player(x, s.y);
    const blocked = level.solids.some(
      (o) => o !== s && !o.oneWay && probe.x < o.x + o.w && probe.x + probe.w > o.x && probe.y < o.y + o.h && probe.y + probe.h > o.y,
    );
    if (blocked) continue;
    for (const dir of [-1, 1]) {
      for (const fast of [false, true]) {
        for (const hold of holds) {
          for (const steer of steers) {
            simulations++;
            const landed = simulate(s, x, dir, fast, hold, steer);
            if (landed && landed.id !== s.id) edges.get(s.id).add(landed.id);
          }
        }
      }
    }
  }
}

function reachableFrom(startId) {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    for (const next of edges.get(id)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function surfaceForSpot(spot) {
  return surfaces.find((s) => spot.x >= s.x && spot.x <= s.x + s.w && Math.abs(spot.y - s.y) < 0.5);
}

const start = surfaces.find((s) => level.start.x >= s.x && level.start.x <= s.x + s.w && s.y === level.start.y);
const fromStart = reachableFrom(start.id);
let failures = 0;

console.log(`Simulated ${simulations.toLocaleString()} jumps across ${surfaces.length} surfaces.\n`);
console.log('Photo spots:');
level.spots.forEach((spot, i) => {
  const surface = surfaceForSpot(spot);
  const ok = surface && fromStart.has(surface.id);
  if (!ok) failures++;
  const where = surface ? `${surface.kind} @ x=${surface.x}..${surface.x + surface.w}, y=${surface.y}` : 'NO SURFACE';
  console.log(`  ${ok ? '✓' : '✗'} ${String(i + 1).padStart(2)}. ${spot.name.padEnd(13)} ${where}`);
});

// Soft-lock check: from every surface you can reach, every spot must remain reachable.
const spotSurfaces = level.spots.map(surfaceForSpot).filter(Boolean);
const deadEnds = [];
for (const id of fromStart) {
  const reach = reachableFrom(id);
  const missing = spotSurfaces.filter((s) => !reach.has(s.id));
  if (missing.length) deadEnds.push({ surface: surfaces[id], missing: missing.length });
}
console.log(`\nReachable surfaces: ${fromStart.size}/${surfaces.length}`);
if (deadEnds.length) {
  failures += deadEnds.length;
  for (const d of deadEnds) {
    console.log(`  ✗ dead end: ${d.surface.kind} @ x=${d.surface.x} (${d.missing} spots unreachable from here)`);
  }
} else {
  console.log('  ✓ no dead ends — every spot stays reachable from anywhere Zenyu can stand');
}

if (failures) {
  console.error(`\nLevel check failed (${failures} problem(s)).`);
  process.exit(1);
}
console.log('\nLevel check passed: all 10 photo spots are reachable ✨');
