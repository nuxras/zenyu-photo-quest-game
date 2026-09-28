// ---------------------------------------------------------------------------
// play.js — one playthrough ("run"): the player, the level, the camera and
// everything that happens while the PLAYING state is active.
// ---------------------------------------------------------------------------

import { PLAYER } from './config.js';
import { createLevel } from './level.js';
import { Player } from './player.js';
import { Camera } from './camera.js';

export function createRun() {
  const level = createLevel();
  const player = new Player(level.start.x, level.start.y);
  const camera = new Camera(level.width);
  camera.snapTo(player);

  const run = {
    level,
    player,
    camera,
    time: 0,

    update(dt, input) {
      run.time += dt;
      player.update(dt, input, level.solids, level.width);
      if (player.feetY > PLAYER.fallDeathY) {
        player.respawnAfterFall();
        camera.snapTo(player);
      }
      camera.update(dt, player);
      player.events.length = 0;
    },
  };
  return run;
}
