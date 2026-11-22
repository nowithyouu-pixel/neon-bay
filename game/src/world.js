// Neon Bay itself: a seeded grid city with four districts, a beach and a marina.
// buildWorld lays out roads, blocks, buildings, parks and the story places;
// the query helpers below are what players, cars, peds and cops all collide with.
import { CFG } from './config.js';
import { clamp } from './random.js';

export function buildWorld(rng) {
  const W = CFG.world;
  const size = W.size;
  const halfRoad = W.roadWidth / 2;

  // Road centre lines. The coast road stops short of the sand so the beach
  // stays a beach instead of swallowing the last avenue.
  const roadXs = [200, 600, 1000, 1400, 1800, 2200, 2600, 2900];
  const roadYs = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];

  const buildings = [];
  const parks = [];
  const lots = [];       // empty blocks: car parks and plazas
  const trees = [];

  function districtAt(x, y) {
    for (const d of CFG.districts) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
    }
    return null;
  }

  // Blocks are the rectangles between neighbouring roads.
  for (let i = 0; i < roadXs.length; i++) {
    for (let j = 0; j < roadYs.length; j++) {
      const x0 = roadXs[i] + halfRoad + W.sidewalk;
      const x1 = (i + 1 < roadXs.length ? roadXs[i + 1] : W.beachX) - halfRoad - W.sidewalk;
      const y0 = roadYs[j] + halfRoad + W.sidewalk;
      const y1 = (j + 1 < roadYs.length ? roadYs[j + 1] : size) - halfRoad - W.sidewalk;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roll = rng.next();
      if (roll < 0.16) {
        // A park: grass, a few trees, a pond if the block is big enough.
        const park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, pond: (x1 - x0) > 180 && rng.chance(0.5) };
        parks.push(park);
        const n = 3 + rng.int(0, 4);
        for (let t = 0; t < n; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      if (roll < 0.32) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // Buildings: one big block or a row of two or three smaller ones.
      const count = rng.chance(0.45) ? 1 : rng.chance(0.6) ? 2 : 3;
      const vertical = (x1 - x0) > (y1 - y0) ? rng.chance(0.5) : true;
      for (let b = 0; b < count; b++) {
        let bx, by, bw, bh;
        if (count === 1) {
          bx = x0 + 6; by = y0 + 6; bw = x1 - x0 - 12; bh = y1 - y0 - 12;
        } else if (vertical) {
          bw = (x1 - x0) / count - 10;
          bx = x0 + 5 + b * ((x1 - x0) / count);
          by = y0 + 6; bh = y1 - y0 - 12;
        } else {
          bh = (y1 - y0) / count - 10;
          by = y0 + 5 + b * ((y1 - y0) / count);
          bx = x0 + 6; bw = x1 - x0 - 12;
        }
        const color = district ? rng.pick(district.palette) : '#777777';
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color,
          roof: shade(color, -28),
          height: rng.int(1, 4),      // storeys, drawn as a shaded south-east face
          district: district ? district.name : 'Neon Bay',
          windows: rng.chance(0.7),
        });
      }
    }
  }

  // Beach umbrellas along the sand: the bay's postcard corner.
  const umbrellas = [];
  for (let i = 0; i < 9; i++) {
    umbrellas.push({
      x: rng.range(W.beachX + 24, W.waterX - 26),
      y: rng.range(120, size - 120),
      color: rng.pick(['#ff5a5a', '#ffd23c', '#3b82ff', '#ff8ac2']),
    });
  }

  // Marina piers reaching into the bay.
  const piers = [
    { x: W.waterX - 6, y: 2140, w: 190, h: 16 },
    { x: W.waterX - 6, y: 2580, w: 240, h: 16 },
  ];

  // Story places: all on or beside a road so a car can actually reach them.
  const places = {
    garage:    { x: 622,  y: 2400, name: 'Rex’s Garage', district: 'Coral Row' },
    safehouse: { x: 1012, y: 2988, name: 'Safehouse', district: 'Coral Row' },
    bank:      { x: 2212, y: 588,  name: 'Marina Heights Bank', district: 'Marina Heights' },
    docks:     { x: 2888, y: 2600, name: 'Dockside Pier', district: 'Dockside' },
    dealSpot:  { x: 2588, y: 2212, name: 'Dockside Deal', district: 'Dockside' },
    courierA:  { x: 612,  y: 612,  name: 'Old Mill Drop', district: 'Old Mill' },
    courierB:  { x: 2612, y: 1012, name: 'Heights Drop', district: 'Marina Heights' },
    courierC:  { x: 1412, y: 2988, name: 'Coral Drop', district: 'Coral Row' },
    start:     { x: 620,  y: 1800, name: 'Coral Row', district: 'Coral Row' },
  };

  function isRoadAt(x, y) {
    if (x < 0 || y < 0 || x > size || y > size) return false;
    for (const rx of roadXs) if (Math.abs(x - rx) <= halfRoad) return true;
    for (const ry of roadYs) if (Math.abs(y - ry) <= halfRoad) return true;
    return false;
  }

  // True when the point sits on a vertical (north-south) road.
  function onVerticalRoad(x, y) {
    for (const rx of roadXs) if (Math.abs(x - rx) <= halfRoad) return true;
    return false;
  }

  function isWaterAt(x, y) {
    return x >= W.waterX && y >= 0 && y <= size;
  }

  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  // Circle vs world: buildings, the bay, and the map edge. Returns a hit or null.
  function collideCircle(x, y, r) {
    if (x - r < 0 || x + r > size || y - r < 0 || y + r > size) return { kind: 'edge' };
    if (x + r > W.waterX) return { kind: 'water' };
    const b = hitsBuilding(x, y, r);
    if (b) return { kind: 'building', building: b };
    return null;
  }

  // Nearest point on any road centre line, for spawning traffic and peds.
  function nearestRoadPoint(x, y) {
    let best = null, bestD = Infinity;
    for (const rx of roadXs) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 0, size) }; }
    }
    for (const ry of roadYs) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x: clamp(x, 0, size), y: ry }; }
    }
    return best;
  }

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      return { x: rng.pick(roadXs), y: rng.range(60, size - 60), vertical: true };
    }
    return { x: rng.range(60, W.beachX - 60), y: rng.pick(roadYs), vertical: false };
  }

  // A sidewalk point beside a road, where pedestrians belong.
  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    const off = halfRoad + W.sidewalk / 2 + rng.range(0, 6);
    if (p.vertical) return { x: p.x + (rng.chance(0.5) ? off : -off), y: p.y };
    return { x: p.x, y: p.y + (rng.chance(0.5) ? off : -off) };
  }

  return {
    size, roadXs, roadYs, buildings, parks, lots, trees, piers, umbrellas, places,
    districtAt, isRoadAt, onVerticalRoad, isWaterAt, hitsBuilding,
    collideCircle, nearestRoadPoint, randomRoadPoint, randomSidewalkPoint,
  };
}

// Darken (negative amt) or lighten a #rrggbb colour by amt steps.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
