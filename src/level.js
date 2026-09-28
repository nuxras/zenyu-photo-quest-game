// ---------------------------------------------------------------------------
// level.js — the hand-placed rooftop city, as plain data.
// (Temporary layout for movement testing; the full city arrives next step.)
// ---------------------------------------------------------------------------

/** Solids extend this far down so nothing can slip under a rooftop. */
const WORLD_BOTTOM = 400;

export function createLevel() {
  const buildings = [
    { x: 0, w: 430, top: 132 },
    { x: 462, w: 230, top: 120 },
    { x: 726, w: 250, top: 138 },
  ];
  const solids = buildings.map((b) => ({
    x: b.x,
    y: b.top,
    w: b.w,
    h: WORLD_BOTTOM - b.top,
    kind: 'roof',
  }));
  solids.push({ x: 200, y: 116, w: 16, h: 16, kind: 'crate' });
  solids.push({ x: 560, y: 96, w: 40, h: 4, kind: 'ledge', oneWay: true });
  return {
    width: 976,
    start: { x: 40, y: 132 },
    buildings,
    solids,
  };
}
