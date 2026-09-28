// ---------------------------------------------------------------------------
// level.js — the hand-placed rooftop city, as plain data.
//
// The city is a strip of buildings (solid down to the street), gaps between
// them (fall = lose a heart), props you can stand on (crates, AC units,
// the water tower, a bridge, a billboard catwalk), decorations, 10 photo
// spots and hazard placements. No DOM access: tools/check-level.mjs imports
// this file in Node to prove every photo spot is reachable.
// ---------------------------------------------------------------------------

/** Solids extend this far down so nothing can slip under a rooftop. */
const WORLD_BOTTOM = 400;

/** Small builder so the layout below reads top-to-bottom like a script. */
function createBuilder() {
  const level = {
    width: 0,
    start: { x: 0, y: 0 },
    buildings: [],
    solids: [],
    props: [],
    spots: [],
    hazards: [],
  };

  const api = {
    level,

    /** A building whose flat roof is at `top`. Style picks colours/windows. */
    building(x, w, top, style = 0) {
      level.buildings.push({ x, w, top, style, seed: level.buildings.length * 7919 + 13 });
      level.solids.push({ x, y: top, w, h: WORLD_BOTTOM - top, kind: 'roof' });
      level.width = Math.max(level.width, x + w);
      return api;
    },

    /** A one-way platform (land on it from above, jump through from below). */
    ledge(x, y, w, kind = 'ledge') {
      level.solids.push({ x, y, w, h: 4, kind, oneWay: true });
      return api;
    },

    /** A wooden crate standing on the surface at `y` (fully solid). */
    crate(x, y) {
      level.solids.push({ x, y: y - 16, w: 16, h: 16, kind: 'crate' });
      level.props.push({ type: 'crate', x, y: y - 16 });
      return api;
    },

    /** An air-conditioning box you can hop onto. */
    acUnit(x, y) {
      level.props.push({ type: 'acUnit', x, y: y - 12 });
      return api.ledge(x, y - 12, 18, 'ac');
    },

    prop(type, data) {
      level.props.push({ type, ...data });
      return api;
    },

    /** A tutorial sign on a post (with alternative text for touch screens). */
    sign(x, y, lines, touchLines = lines) {
      level.props.push({ type: 'sign', x, y, lines, touchLines });
      return api;
    },

    /**
     * A photo spot where Zenyu stands at (x, y). `shot` frames the photo:
     * a world-space centre { x, y }, or { target: 'sun' } for the sunset.
     */
    spot(x, y, name, shot) {
      level.spots.push({ id: level.spots.length, x, y, name, shot });
      return api;
    },

    hazard(type, data) {
      level.hazards.push({ type, ...data });
      return api;
    },
  };
  return api;
}

export function createLevel() {
  const b = createBuilder();

  // --- 1 · Home roof (tutorial) ------------------------------------------------
  b.building(0, 440, 132, 0)
    .sign(58, 132, ['← → MOVE'], ['◀ ▶ MOVE'])
    .prop('chimney', { x: 112, y: 132 })
    .sign(170, 132, ['SPACE', 'JUMP'], ['TAP ▲', 'TO JUMP'])
    .crate(206, 132)
    .prop('plants', { x: 236, y: 132 })
    .acUnit(262, 132)
    .sign(306, 132, ['E  SNAP', 'PHOTO'], ['📷 SNAP', 'PHOTO'])
    .spot(352, 132, 'GOLDEN HOUR', { target: 'sun' })
    .prop('railing', { x: 384, y: 132, w: 56 });

  // --- 2 · The rooftop cat --------------------------------------------------------
  b.building(472, 248, 120, 1)
    .hazard('pigeon', { x1: 494, x2: 586, y: 120 })
    .spot(624, 120, 'ROOFTOP CAT', { x: 664, y: 98 })
    .acUnit(652, 120)
    .prop('cat', { x: 660, y: 108 })
    .prop('antenna', { x: 704, y: 120, h: 34 });

  // --- 3 · Laundry day + first steam vent ------------------------------------------
  b.building(752, 300, 138, 2)
    .prop('skylight', { x: 772, y: 138 })
    .hazard('steam', { x: 816, y: 138, offset: 0 })
    .prop('laundry', { x1: 872, x2: 1010, y: 138 })
    .spot(944, 138, 'LAUNDRY DAY', { x: 944, y: 110 })
    .prop('plants', { x: 1026, y: 138 });

  // --- 4 · Neon noodles (step up onto the tall block) --------------------------------
  b.building(1090, 150, 128, 0)
    .prop('dish', { x: 1106, y: 128 })
    .spot(1196, 128, 'NEON NOODLES', { x: 1250, y: 82 })
    .building(1240, 180, 96, 1)
    .prop('neonBlade', { x: 1246, y: 96, text: 'RAMEN' })
    .hazard('steam', { x: 1318, y: 96, offset: 1.3 })
    .acUnit(1372, 96)
    .prop('antenna', { x: 1400, y: 96, h: 26 });

  // --- 5 · The water tower + barrel alley ----------------------------------------------
  b.building(1450, 330, 140, 2)
    .prop('waterTower', { x: 1558, y: 140 })
    .ledge(1550, 114, 52, 'catwalk')
    .ledge(1558, 92, 36, 'tank')
    .spot(1576, 92, 'TOWER VIEW', { x: 1586, y: 86 })
    .prop('shed', { x: 1746, y: 140 })
    .hazard('barrels', { x: 1752, y: 140, dir: -1, offset: 0.6 });

  // --- 6 · Pigeons on the wire ------------------------------------------------------------
  b.building(1812, 262, 124, 3)
    .prop('pole', { x: 1834, y: 124 })
    .prop('pole', { x: 2052, y: 124 })
    .prop('wire', { x1: 1835, x2: 2053, y: 82, birds: [1880, 1900, 1932, 1990, 2004] })
    .hazard('pigeon', { x1: 1846, x2: 1922, y: 124 })
    .spot(1956, 124, 'WIRE PIGEONS', { x: 1950, y: 88 })
    .hazard('pigeon', { x1: 1990, x2: 2060, y: 124 });

  // --- 7 · The old bridge ---------------------------------------------------------------------
  b.building(2100, 120, 116, 1)
    .prop('lamp', { x: 2150, y: 116 })
    .prop('bridge', { x: 2220, w: 200, y: 116 })
    .ledge(2220, 116, 200, 'bridge')
    .spot(2320, 116, 'OLD BRIDGE', { x: 2320, y: 104 })
    .building(2420, 220, 116, 0)
    .prop('shed', { x: 2604, y: 116 })
    .hazard('barrels', { x: 2610, y: 116, dir: -1, offset: 1.8, interval: 3.8 });

  // --- 8 · Lamplight & the steam gauntlet ---------------------------------------------------------
  b.building(2676, 340, 132, 2)
    .prop('lamp', { x: 2716, y: 132 })
    .hazard('steam', { x: 2780, y: 132, offset: 0.4 })
    .prop('chimney', { x: 2822, y: 132 })
    .spot(2872, 132, 'LAMPLIGHT', { x: 2890, y: 104 })
    .prop('lamp', { x: 2890, y: 132, moths: true })
    .hazard('steam', { x: 2944, y: 132, offset: 1.6 })
    .prop('railing', { x: 2970, y: 132, w: 46 });

  // --- 9 · Shark Soda billboard ---------------------------------------------------------------------
  b.building(3056, 300, 128, 3)
    .hazard('pigeon', { x1: 3080, x2: 3130, y: 128 })
    .prop('billboard', { x: 3136, y: 128, w: 136 })
    .ledge(3132, 102, 144, 'catwalk')
    .spot(3204, 102, 'SHARK SODA', { x: 3204, y: 82 })
    .hazard('pigeon', { x1: 3150, x2: 3260, y: 128 })
    .hazard('steam', { x: 3316, y: 128, offset: 0.9 });

  // --- 10 · The final climb to the first star ----------------------------------------------------------
  b.building(3388, 140, 136, 0)
    .prop('plants', { x: 3420, y: 136 })
    .building(3528, 100, 110, 1)
    .building(3628, 272, 88, 2)
    .prop('antenna', { x: 3834, y: 88, h: 50, beacon: true })
    .spot(3780, 88, 'FIRST STAR', { target: 'star' })
    .prop('firstStar', { x: 3806, y: 30 })
    .prop('shed', { x: 3868, y: 88 })
    .hazard('barrels', { x: 3872, y: 88, dir: -1, offset: 0.2, interval: 4.2 });

  b.level.start = { x: 36, y: 132 };
  return b.level;
}
