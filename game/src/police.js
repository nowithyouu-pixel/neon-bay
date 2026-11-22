// The law in Neon Bay: a wanted system that rises with every crime and cools
// off when nobody can see Rex, plus the response — foot cops who chase and
// arrest, police cars that hunt and ram, roadblocks at three stars, and a
// helicopter spotlight at four.
import { CFG } from './config.js';
import { clamp, dist2 } from './random.js';
import { createVehicle } from './vehicles.js';

export function createWanted() {
  return { points: 0, level: 0 };
}

export function levelForPoints(points) {
  const t = CFG.wanted.pointsPerLevel;
  let level = 0;
  for (let i = 1; i < t.length; i++) if (points >= t[i]) level = i;
  return level;
}

export function addCrime(G, points, reason) {
  const w = G.wanted;
  const before = w.level;
  w.points = clamp(w.points + points, 0, CFG.wanted.maxPoints);
  w.level = levelForPoints(w.points);
  G.lastCrimeAt = G.elapsed;
  if (w.level > before) {
    G.hud.banner(`WANTED — ${w.level} STAR${w.level > 1 ? 'S' : ''}`, '#ff5a5a');
    G.audio.sirenBurst();
    if (w.level >= CFG.police.heliAt) G.heli.active = true;
    if (w.level >= 2) spawnCopCar(G);
    if (w.level >= 1) spawnFootCop(G);
  }
}

function anyCopSeesPlayer(G) {
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  for (const cop of G.cops) {
    if (dist2(cop.x, cop.y, px, py) < CFG.police.sightRange * CFG.police.sightRange) return true;
  }
  for (const c of G.cars) {
    if (c.driver === 'cop' && dist2(c.x, c.y, px, py) < 700 * 700) return true;
  }
  if (G.heli.active) return true;
  return false;
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  if (w.points <= 0) { w.level = 0; return; }
  const seen = anyCopSeesPlayer(G);
  if (!seen) {
    const hidden = G.player.driving == null && w.level <= 2;
    w.points = Math.max(0, w.points - CFG.wanted.decayPerSec * (hidden ? CFG.wanted.decayHiddenMult : 1) * dt);
    const newLevel = levelForPoints(w.points);
    if (newLevel < w.level) {
      w.level = newLevel;
      if (w.level === 0) {
        G.hud.banner('YOU LOST THE HEAT', '#7ae8a0');
        G.audio.lostHeat();
      }
    }
  }
}

export function spawnFootCop(G) {
  if (G.cops.length >= CFG.police.maxFootCops) return;
  const p = G.player;
  const spot = G.world.randomSidewalkPoint();
  // Prefer a spawn near the player so the response feels immediate.
  let x = spot.x, y = spot.y;
  if (dist2(x, y, p.x, p.y) > 900 * 900) {
    const a = G.rng.range(0, Math.PI * 2);
    x = p.x + Math.cos(a) * G.rng.range(320, 520);
    y = p.y + Math.sin(a) * G.rng.range(320, 520);
    const road = G.world.nearestRoadPoint(x, y);
    x = road.x; y = road.y;
  }
  G.cops.push({
    x, y, angle: 0, speed: CFG.police.footCopSpeed,
    hp: 50, arrest: 0, fireTimer: G.rng.range(0.5, 1.5),
    hitCooldown: 0, down: 0,
  });
}

export function spawnCopCar(G) {
  const existing = G.cars.filter((c) => c.driver === 'cop' && !c.wrecked).length;
  if (existing >= CFG.police.maxCopCars) return;
  const p = G.player;
  const spot = G.world.randomRoadPoint();
  let x = spot.x;
  let y = spot.y;
  if (dist2(x, y, p.x, p.y) > 1100 * 1100) {
    const a = G.rng.range(0, Math.PI * 2);
    x = p.x + Math.cos(a) * 650;
    y = p.y + Math.sin(a) * 650;
    const road = G.world.nearestRoadPoint(x, y);
    x = road.x; y = road.y;
  }
  const car = createVehicle(x, y, 0, {
    color: '#1c2733', type: 'cop', driver: 'cop',
  });
  car.cruise = CFG.police.copCarSpeed;
  G.cars.push(car);
  G.audio.sirenBurst();
}

function updateRoadblocks(G, dt) {
  const want = G.wanted.level >= CFG.police.roadblockAt;
  if (want && G.roadblocks.length === 0 && G.player.driving) {
    // Two cruisers parked across the road ahead of the player's car.
    const car = G.player.driving;
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    for (const side of [-1, 1]) {
      const bx = car.x + fx * 340 + -fy * side * 26;
      const by = car.y + fy * 340 + fx * side * 26;
      if (G.world.collideCircle(bx, by, 30)) continue;
      const block = createVehicle(bx, by, car.angle + Math.PI / 2 + side * 0.35, {
        color: '#1c2733', type: 'cop', driver: 'none',
      });
      G.cars.push(block);
      G.roadblocks.push(block);
    }
    if (G.roadblocks.length) G.hud.banner('ROADBLOCK AHEAD', '#ff9a3c');
  }
  if (!want && G.roadblocks.length) {
    // Heat's off: the block clears and the cruisers drive away.
    for (const b of G.roadblocks) {
      b.driver = 'traffic';
      b.axis = G.world.onVerticalRoad(b.x, b.y) ? 'y' : 'x';
      b.dir = G.rng.chance(0.5) ? 1 : -1;
    }
    G.roadblocks = [];
  }
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  updateRoadblocks(G, dt);

  // Helicopter joins at four stars and never leaves while the heat is on.
  G.heli.active = w.level >= CFG.police.heliAt;
  if (G.heli.active) {
    const p = G.player;
    const tx = p.driving ? p.driving.x : p.x;
    const ty = p.driving ? p.driving.y : p.y;
    G.heli.x += (tx - G.heli.x) * clamp(1.6 * dt, 0, 1);
    G.heli.y += (ty - G.heli.y) * clamp(1.6 * dt, 0, 1);
  }

  // Reinforcements trickle in while wanted, and stand down when it clears.
  if (w.level >= 1) {
    if (G.cops.length < Math.min(w.level + 1, CFG.police.maxFootCops) && G.rng.chance(dt * 0.5)) spawnFootCop(G);
    if (w.level >= 2 && G.rng.chance(dt * 0.35)) spawnCopCar(G);
  } else {
    // No heat: cops wander off and cop cars cruise away.
    for (const cop of G.cops) cop.leaving = true;
    for (const c of G.cars) {
      if (c.driver === 'cop' && !c.wrecked) { c.driver = 'traffic'; c.cruise = CFG.car.trafficSpeed; }
    }
  }

  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    if (cop.hitCooldown > 0) cop.hitCooldown -= dt;
    if (cop.down > 0) {
      cop.down -= dt;
      if (cop.down <= 0) G.cops.splice(i, 1);
      continue;
    }
    if (cop.leaving) {
      // Walk away from the player and despawn at a distance.
      const dx = cop.x - px, dy = cop.y - py;
      const d = Math.hypot(dx, dy) || 1;
      cop.x += (dx / d) * 120 * dt;
      cop.y += (dy / d) * 120 * dt;
      if (d > 800) G.cops.splice(i, 1);
      continue;
    }
    const dx = px - cop.x, dy = py - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (p.driving) {
      // On foot cops cannot catch a car: they run at it anyway, then give up.
      if (d > 60) {
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
      }
      continue;
    }
    if (d > CFG.police.arrestRange) {
      cop.arrest = 0;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      // Three stars and up: cops open fire instead of only chasing.
      if (w.level >= 3 && d < CFG.combat.enemyRange) {
        cop.fireTimer -= dt;
        if (cop.fireTimer <= 0) {
          cop.fireTimer = CFG.combat.enemyCooldown * 1.4;
          G.combat.enemyShoot(G, cop.x, cop.y, p.x, p.y, 'cop');
        }
      }
    } else {
      cop.arrest += dt;
      if (cop.arrest >= CFG.police.arrestHold) {
        bustPlayer(G);
        return;
      }
    }
  }
}

function bustPlayer(G) {
  const p = G.player;
  const fine = Math.min(p.cash, Math.max(100, Math.floor(p.cash * 0.15)));
  p.cash -= fine;
  G.wanted.points = 0;
  G.wanted.level = 0;
  G.cops = [];
  G.roadblocks = [];
  for (const c of G.cars) if (c.driver === 'cop') c.driver = 'traffic';
  if (p.driving) { p.driving.driver = 'none'; p.driving = null; }
  p.x = G.world.places.safehouse.x;
  p.y = G.world.places.safehouse.y;
  p.health = Math.max(p.health, 50);
  G.bustedFine = fine;
  G.state = 'busted';
  G.audio.busted();
  G.save.saveGame(G);
}
