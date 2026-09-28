// ---------------------------------------------------------------------------
// collision.js — simple axis-aligned bounding box (AABB) physics.
//
// Every box is { x, y, w, h } with (x, y) = top-left corner, y pointing down.
// Solids may be `oneWay` (bridges, awnings, crates' tops...): those only stop
// things falling onto them from above and can be jumped through from below.
//
// Movement is resolved one axis at a time (X first, then Y). Moving at most a
// few pixels per 1/60 s step means nothing can tunnel through our solids,
// which are all at least 4px thick.
// ---------------------------------------------------------------------------

/** True when two boxes overlap. Touching edges do NOT count as overlap. */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Move `body` horizontally by `dx` and push it out of any solid it enters.
 * One-way platforms never block sideways movement.
 * Returns true if a wall stopped the body.
 */
export function moveX(body, dx, solids) {
  body.x += dx;
  let blocked = false;
  for (const solid of solids) {
    if (solid.oneWay || !overlaps(body, solid)) continue;
    // Snap the body flush against the side it came from.
    body.x = dx > 0 ? solid.x - body.w : solid.x + solid.w;
    blocked = true;
  }
  return blocked;
}

/**
 * Move `body` vertically by `dy` and resolve collisions.
 * Returns { landed, ground, bonked }:
 *  - landed: the body is now standing on something (only when moving down)
 *  - ground: the solid it landed on (useful for respawn points)
 *  - bonked: the body hit a ceiling while moving up
 */
export function moveY(body, dy, solids) {
  const previousBottom = body.y + body.h;
  body.y += dy;
  const result = { landed: false, ground: null, bonked: false };
  for (const solid of solids) {
    if (!overlaps(body, solid)) continue;
    if (dy > 0) {
      // One-way platforms only catch bodies whose feet were above them
      // before this step — so you can jump up through them.
      if (solid.oneWay && previousBottom > solid.y + 0.01) continue;
      body.y = solid.y - body.h;
      result.landed = true;
      result.ground = solid;
    } else if (dy < 0 && !solid.oneWay) {
      body.y = solid.y + solid.h;
      result.bonked = true;
    }
  }
  return result;
}

/** Does anything solid sit directly under `body` (within 1px)? */
export function isOnGround(body, solids) {
  const probe = { x: body.x, y: body.y + body.h, w: body.w, h: 1 };
  return solids.some((s) => overlaps(probe, s) && Math.abs(s.y - (body.y + body.h)) < 1);
}
