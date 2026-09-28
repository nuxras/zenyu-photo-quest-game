// ---------------------------------------------------------------------------
// entities.js — hazards (pigeons, barrels, steam vents), particles and
// floating text. Hazards expose `hitbox` (or null when harmless) and draw
// themselves with sprites from art.js.
// ---------------------------------------------------------------------------

import { ENV, PALETTE, HAZARDS } from './config.js';
import { moveX, moveY } from './collision.js';

// --- Hazards ---------------------------------------------------------------------

/** A pigeon strutting between x1 and x2, pausing to peck at each end. */
export class Pigeon {
  constructor({ x1, x2, y }) {
    this.kind = 'pigeon';
    this.x1 = x1;
    this.x2 = x2;
    this.y = y; // feet
    this.x = (x1 + x2) / 2;
    this.prevX = this.x;
    this.dir = 1;
    this.pause = 0;
    this.anim = Math.random();
  }

  update(dt, run) {
    const cfg = HAZARDS.pigeon;
    this.prevX = this.x;
    this.anim += dt;
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.dir = -this.dir;
      return;
    }
    this.x += this.dir * cfg.speed * dt;
    if (this.x >= this.x2 || this.x <= this.x1) {
      this.x = Math.max(this.x1, Math.min(this.x2, this.x));
      this.pause = cfg.pauseTime;
      if (run.isOnScreen(this.x)) run.sound('coo');
    }
  }

  get centerX() {
    return this.x;
  }

  get hitbox() {
    const { width, height } = HAZARDS.pigeon;
    return { x: this.x - width / 2, y: this.y - height, w: width, h: height };
  }

  draw(ctx, camX, art, alpha) {
    const x = Math.round(this.prevX + (this.x - this.prevX) * alpha - camX);
    let frame = Math.floor(this.anim * 6) % 2;
    if (this.pause > 0) frame = Math.floor(this.anim * 4) % 2 ? 2 : 0;
    const set = this.dir > 0 ? art.pigeonFrames.right : art.pigeonFrames.left;
    ctx.drawImage(set[frame], x - 6, this.y - 10);
  }
}

/** A barrel rolling along the roofs; it drops off ledges and breaks on walls. */
export class Barrel {
  constructor(x, y, dir) {
    this.kind = 'barrel';
    const r = HAZARDS.barrel.radius;
    this.r = r;
    this.body = { x: x - r, y: y - r * 2, w: r * 2, h: r * 2 };
    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.vx = dir * HAZARDS.barrel.speed;
    this.vy = 0;
    this.angle = 0;
    this.alive = true;
  }

  update(dt, run) {
    const cfg = HAZARDS.barrel;
    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.vy = Math.min(this.vy + cfg.gravity * dt, 320);
    if (moveX(this.body, this.vx * dt, run.level.solids)) {
      this.alive = false;
      run.particles.dust(this.centerX, this.body.y + this.r * 2, 8, 50);
      return;
    }
    const impact = this.vy;
    const hit = moveY(this.body, this.vy * dt, run.level.solids);
    if (hit.landed) {
      // A little bounce after a drop between roofs.
      this.vy = impact > 120 ? -impact * 0.3 : 0;
      if (impact > 120) {
        run.particles.dust(this.centerX, this.body.y + this.r * 2, 4, 30);
        if (run.isOnScreen(this.centerX)) run.sound('thud');
      }
    }
    this.angle += (this.vx * dt) / this.r;
    if (this.body.y > 260) this.alive = false;
  }

  get centerX() {
    return this.body.x + this.r;
  }

  get hitbox() {
    const b = this.body;
    return { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 3 };
  }

  draw(ctx, camX, art, alpha) {
    const x = Math.round(this.prevX + (this.body.x - this.prevX) * alpha - camX);
    const y = Math.round(this.prevY + (this.body.y - this.prevY) * alpha);
    const frames = art.barrelFrames;
    const index = ((Math.floor((-this.angle / Math.PI) * frames.length) % frames.length) + frames.length) % frames.length;
    ctx.drawImage(frames[index], x, y);
  }
}

/** Spawns a barrel every `interval` seconds from a rooftop doorway. */
export class BarrelSpawner {
  constructor({ x, y, dir, offset = 0, interval = HAZARDS.barrel.interval }) {
    this.kind = 'spawner';
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.interval = interval;
    this.timer = offset;
  }

  update(dt, run) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer += this.interval;
      run.addHazard(new Barrel(this.x, this.y, this.dir));
      if (run.isOnScreen(this.x)) run.sound('barrel');
    }
  }

  get hitbox() {
    return null;
  }

  draw() {}
}

/** A roof vent: idle → warning puffs → a scalding burst of steam. */
export class SteamVent {
  constructor({ x, y, offset = 0 }) {
    this.kind = 'steam';
    this.x = x;
    this.y = y;
    this.clock = offset;
    this.phase = 'idle';
    this.phaseTime = 0;
    this.puffTimer = 0;
  }

  update(dt, run) {
    const { idleTime, warnTime, burstTime } = HAZARDS.steam;
    this.clock += dt;
    const t = this.clock % (idleTime + warnTime + burstTime);
    const phase = t < idleTime ? 'idle' : t < idleTime + warnTime ? 'warn' : 'burst';
    if (phase !== this.phase) {
      this.phase = phase;
      if (run.isOnScreen(this.x)) {
        if (phase === 'warn') run.sound('hiss');
        if (phase === 'burst') run.sound('steam');
      }
    }
    this.phaseTime = phase === 'idle' ? t : phase === 'warn' ? t - idleTime : t - idleTime - warnTime;
    this.puffTimer -= dt;
    if (this.puffTimer <= 0) {
      if (phase === 'warn') {
        run.particles.steam(this.x, this.y - 6, 0.35);
        this.puffTimer = 0.12;
      } else if (phase === 'burst') {
        run.particles.steam(this.x, this.y - 8, 1.2);
        run.particles.steam(this.x, this.y - 20, 1);
        this.puffTimer = 0.03;
      }
    }
  }

  /** Current column height (grows fast at the start of a burst). */
  get columnHeight() {
    if (this.phase !== 'burst') return 0;
    return HAZARDS.steam.columnHeight * Math.min(1, this.phaseTime / 0.12);
  }

  get centerX() {
    return this.x;
  }

  get hitbox() {
    const h = this.columnHeight;
    if (h < 6) return null;
    const w = HAZARDS.steam.columnWidth;
    return { x: this.x - w / 2, y: this.y - 6 - h, w, h };
  }

  draw(ctx, camX, art, alpha, time) {
    const x = Math.round(this.x - camX);
    // The vent pipe
    ctx.fillStyle = PALETTE.charcoal;
    ctx.fillRect(x - 4, this.y - 7, 9, 7);
    ctx.fillStyle = ENV.metal;
    ctx.fillRect(x - 3, this.y - 6, 7, 6);
    ctx.fillStyle = ENV.metalLight;
    ctx.fillRect(x - 3, this.y - 6, 7, 1);
    ctx.fillStyle = this.phase === 'idle' ? ENV.metalDark : '#FF8A5A';
    ctx.fillRect(x - 2, this.y - 4, 5, 1); // grate glows when it's about to blow
    // The scalding column
    const h = Math.round(this.columnHeight);
    if (h > 0) {
      ctx.fillStyle = ENV.steam;
      for (let y = 0; y < h; y += 3) {
        const wobble = Math.round(Math.sin(time * 20 + y * 0.7) * 1.5);
        const width = 6 + Math.round((y / h) * 5);
        ctx.globalAlpha = 0.85 - (y / h) * 0.45;
        ctx.fillRect(x - Math.floor(width / 2) + wobble, this.y - 8 - y, width, 3);
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** Instantiate hazards from the level's placement data. */
export function createHazards(placements) {
  return placements.map((p) => {
    if (p.type === 'pigeon') return new Pigeon(p);
    if (p.type === 'barrels') return new BarrelSpawner(p);
    if (p.type === 'steam') return new SteamVent(p);
    throw new Error(`Unknown hazard type: ${p.type}`);
  });
}

// --- Particles -------------------------------------------------------------------

/**
 * A tiny particle system. Each particle is a plain object; dead ones are
 * swapped out so the array never grows without bound.
 */
export class Particles {
  constructor(max = 260) {
    this.max = max;
    this.list = [];
  }

  spawn(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 0,
      size: 1,
      kind: 'dot',
      ...p,
      life: p.life ?? 0.5,
      maxLife: p.life ?? 0.5,
    });
  }

  /** Soft dust puff at someone's feet (landing, jumping, walking). */
  dust(x, y, count = 5, spread = 40) {
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      this.spawn({
        x: x + dir * (1 + Math.random() * 3),
        y: y - 1,
        vx: dir * (10 + Math.random() * spread),
        vy: -8 - Math.random() * 18,
        drag: 4,
        gravity: 30,
        life: 0.3 + Math.random() * 0.25,
        color: i % 3 ? PALETTE.warmGrey : PALETTE.cream,
        size: Math.random() < 0.4 ? 2 : 1,
      });
    }
  }

  /** Golden sparkles bursting outward (photo taken, respawn). */
  sparkle(x, y, count = 10, color = ENV.spotGlow) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 25 + Math.random() * 45;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        drag: 2.5,
        gravity: 20,
        life: 0.5 + Math.random() * 0.4,
        color,
        kind: Math.random() < 0.35 ? 'star' : 'dot',
      });
    }
  }

  /** Grey feathers when Zenyu bumps into a pigeon. */
  feathers(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -30 - Math.random() * 30,
        drag: 3,
        gravity: 40,
        life: 0.9 + Math.random() * 0.5,
        color: i % 2 ? '#9C9DB5' : '#D9D9E6',
        kind: 'feather',
        phase: Math.random() * 6,
      });
    }
  }

  /** A puff of steam that grows as it rises. */
  steam(x, y, strength = 1) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 4,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: -40 * strength - Math.random() * 30 * strength,
      drag: 1.2,
      life: 0.5 + Math.random() * 0.4 * strength,
      color: ENV.steam,
      kind: 'steam',
      size: 1 + Math.random() * 1.5,
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
        continue;
      }
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx, camX) {
    for (const p of this.list) {
      const t = p.life / p.maxLife; // 1 → 0
      const x = Math.round(p.x - camX);
      const y = Math.round(p.y);
      ctx.fillStyle = p.color;
      if (p.kind === 'steam') {
        const r = Math.round(p.size + (1 - t) * 3);
        ctx.globalAlpha = 0.55 * t;
        ctx.fillRect(x - r, y - r + 1, r * 2 + 1, r * 2 - 1);
        ctx.fillRect(x - r + 1, y - r, r * 2 - 1, r * 2 + 1);
      } else if (p.kind === 'star') {
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillRect(x, y, 1, 1);
        if (t > 0.4) {
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
        }
      } else if (p.kind === 'feather') {
        ctx.globalAlpha = Math.min(1, t * 2);
        const sway = Math.round(Math.sin(p.life * 8 + p.phase) * 1.5);
        ctx.fillRect(x + sway, y, 2, 1);
        ctx.fillRect(x + sway + 1, y - 1, 1, 1);
      } else {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillRect(x, y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// --- Floating text ---------------------------------------------------------------

/** Small world-anchored messages ("NO SHOT HERE", "+1") that drift up and fade. */
export class FloatingTexts {
  constructor() {
    this.list = [];
  }

  add(text, x, y, color = PALETTE.cream, life = 1.1) {
    this.list = this.list.filter((t) => t.text !== text); // no stacking duplicates
    this.list.push({ text, x, y, color, life, maxLife: life });
  }

  update(dt) {
    for (const t of this.list) {
      t.life -= dt;
      t.y -= 12 * dt;
    }
    this.list = this.list.filter((t) => t.life > 0);
  }
}
