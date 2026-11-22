// Cars: the traffic that fills Neon Bay's roads, the parked cars waiting to be
// stolen, and the player's own ride. Traffic follows road lanes, yields to the
// car ahead and sometimes turns at intersections; the player's car is a simple
// arcade model with acceleration, steering that bites with speed, and a
// handbrake that lets the tail step out.
import { CFG } from './config.js';
import { clamp, angleLerp, dist2 } from './random.js';

let nextId = 1;

export function createVehicle(x, y, angle, opts = {}) {
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,                 // signed forward speed, px/s
    vx: 0, vy: 0,
    len: opts.len || 46,
    wid: opts.wid || 22,
    color: opts.color || '#c23b3b',
    type: opts.type || 'sedan',
    driver: opts.driver || 'traffic', // traffic | none (parked) | player | cop
    hp: CFG.car.wreckHp,
    wrecked: false,
    smoke: 0,
    brakeLight: false,
    // Traffic AI state:
    axis: opts.axis || 'x',   // road the car travels along
    dir: opts.dir || 1,
    lane: opts.lane || 0,     // lateral offset from the road centre line
    cruise: CFG.car.trafficSpeed * (0.85 + Math.random() * 0.3),
    wait: 0,                  // stopped at a junction while traffic crosses
    turnCooldown: 0,
    hitCooldown: 0,
  };
}

// Right-hand traffic: the lane offset for a given axis and direction.
export function laneOffset(axis, dir) {
  const off = 23;
  if (axis === 'x') return dir > 0 ? off : -off;   // eastbound keeps south, westbound north
  return dir > 0 ? -off : off;                      // southbound keeps west, northbound east
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const spot = G.world.randomRoadPoint();
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const axis = spot.vertical ? 'y' : 'x';
    const lane = laneOffset(axis, dir);
    const x = spot.vertical ? spot.x + lane : spot.x;
    const y = spot.vertical ? spot.y : spot.y + lane;
    const angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createVehicle(x, y, angle, {
      color: G.rng.pick(CFG.carColors),
      type: G.rng.chance(0.12) ? 'taxi' : G.rng.chance(0.1) ? 'truck' : 'sedan',
      driver: 'traffic', axis, dir, lane,
    });
    car.speed = car.cruise * G.rng.range(0.7, 1);
    G.cars.push(car);
  }
}

export function spawnParked(G, count) {
  for (let i = 0; i < count; i++) {
    let x, y, angle;
    if (G.rng.chance(0.5) && G.world.lots.length) {
      const lot = G.rng.pick(G.world.lots);
      x = G.rng.range(lot.x + 30, lot.x + lot.w - 30);
      y = G.rng.range(lot.y + 30, lot.y + lot.h - 30);
      angle = G.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    } else {
      const spot = G.world.randomRoadPoint();
      const side = G.rng.chance(0.5) ? 1 : -1;
      const off = CFG.world.roadWidth / 2 - 14;
      x = spot.vertical ? spot.x + side * off : spot.x;
      y = spot.vertical ? spot.y : spot.y + side * off;
      angle = spot.vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    }
    G.cars.push(createVehicle(x, y, angle, {
      color: G.rng.pick(CFG.carColors),
      driver: 'none',
    }));
  }
}

export function nearestCar(G, x, y, maxD) {
  let best = null, bestD = maxD * maxD;
  for (const c of G.cars) {
    if (c.wrecked) continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Keep the streets busy near the player: cars that drift far away respawn
// on a road near the action instead of driving off the map forever.
function recycleFarCars(G) {
  const p = G.player;
  for (const c of G.cars) {
    if (c.driver !== 'traffic') continue;
    if (dist2(c.x, c.y, p.x, p.y) > 1500 * 1500) {
      const spot = G.world.randomRoadPoint();
      const dir = G.rng.chance(0.5) ? 1 : -1;
      const axis = spot.vertical ? 'y' : 'x';
      c.axis = axis; c.dir = dir;
      c.lane = laneOffset(axis, dir);
      c.x = spot.vertical ? spot.x + c.lane : spot.x;
      c.y = spot.vertical ? spot.y : spot.y + c.lane;
      c.angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      c.speed = c.cruise;
    }
  }
}

export function updateVehicles(G, dt) {
  recycleFarCars(G);
  for (const c of G.cars) {
    if (c.hitCooldown > 0) c.hitCooldown -= dt;
    if (c.wrecked) {
      c.speed *= Math.max(0, 1 - 3 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (G.rng.chance(dt * 8)) {
        G.particles.push({ x: c.x, y: c.y - 6, vx: G.rng.range(-12, 12), vy: -34, life: 0.9, max: 0.9, color: '#555', size: 7, smoke: true });
      }
      continue;
    }
    if (c.driver === 'player') updatePlayerCar(G, c, dt);
    else if (c.driver === 'traffic') updateTrafficCar(G, c, dt);
    else if (c.driver === 'cop') updateCopCar(G, c, dt);
    // Parked cars (driver 'none') do not move.
  }
  resolveCarCollisions(G, dt);
}

function updatePlayerCar(G, c, dt) {
  const input = G.input;
  const up = input.isDown('KeyW') || input.isDown('ArrowUp');
  const down = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const handbrake = input.isDown('Space');

  const forward = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
  const speedAlong = c.vx * forward.x + c.vy * forward.y;

  if (up) c.speed += CFG.car.accel * dt;
  else if (down) {
    if (speedAlong > 20) c.speed -= CFG.car.brake * dt;   // braking first
    else c.speed -= CFG.car.reverseAccel * dt;            // then reversing
  } else {
    c.speed -= c.speed * CFG.car.drag * dt;               // coast down
  }
  if (handbrake) c.speed -= c.speed * CFG.car.handbrake * dt * 0.12 + Math.sign(c.speed) * CFG.car.handbrake * dt * 0.25;
  c.speed = clamp(c.speed, -CFG.car.maxReverse, CFG.car.maxSpeed);
  c.brakeLight = down || handbrake;

  // Steering bites with speed and fades at a standstill; reversing flips it.
  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  const speedFactor = clamp(Math.abs(speedAlong) / 140, 0, 1);
  const steer = steerInput * CFG.car.steerRate * speedFactor * (speedAlong < -5 ? -1 : 1);
  c.angle += steer * dt * (handbrake ? 1.35 : 1);

  // Rebuild velocity from heading, keeping a little sideways slide, less
  // while the handbrake is down so the tail can step out.
  const grip = handbrake ? 2.2 : CFG.car.grip;
  const rightVec = { x: -forward.y, y: forward.x };
  const lateral = c.vx * rightVec.x + c.vy * rightVec.y;
  const newLateral = lateral * Math.max(0, 1 - grip * dt);
  const fwd = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
  c.vx = fwd.x * c.speed + rightVec.x * newLateral;
  c.vy = fwd.y * c.speed + rightVec.y * newLateral;

  moveCarWithCollision(G, c, dt);
  checkPedHits(G, c);
  G.audio.engine(c.speed / CFG.car.maxSpeed, handbrake);
}

function updateTrafficCar(G, c, dt) {
  const W = CFG.world;
  const roads = G.world;
  // Approaching an intersection? Maybe turn onto the cross street.
  c.turnCooldown -= dt;
  const lines = c.axis === 'x' ? roads.roadYs : roads.roadXs;
  let nearCross = false;
  for (const line of lines) {
    const along = c.axis === 'x' ? c.x : c.y;
    if (Math.abs(along - line) < 26) { nearCross = true; break; }
  }
  if (nearCross && c.turnCooldown <= 0 && G.rng.chance(dt * 0.9)) {
    const newAxis = c.axis === 'x' ? 'y' : 'x';
    const newDir = G.rng.chance(0.5) ? 1 : -1;
    c.axis = newAxis; c.dir = newDir;
    c.lane = laneOffset(newAxis, newDir);
    c.angle = newAxis === 'x' ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    c.turnCooldown = 4;
  }

  // Yield to the car ahead in the same lane, and to a player car in the way.
  let target = c.cruise;
  const fwd = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
  for (const o of G.cars) {
    if (o === c || o.wrecked) continue;
    const dx = o.x - c.x, dy = o.y - c.y;
    const ahead = dx * fwd.x + dy * fwd.y;
    const side = Math.abs(dx * -fwd.y + dy * fwd.x);
    if (ahead > 0 && ahead < 92 && side < 30) { target = 0; break; }
  }
  if (c.wait > 0) { c.wait -= dt; target = 0; }
  else if (nearCross && G.rng.chance(dt * 0.25)) c.wait = G.rng.range(0.4, 1.4);

  c.speed += clamp(target - c.speed, -260 * dt, 190 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  // Stay glued to the lane: nudge sideways back onto it.
  const lanePos = c.axis === 'x' ? c.y : c.x;
  const centre = (c.axis === 'x' ? nearestRoadY(G, c.y) : nearestRoadX(G, c.x)) + c.lane;
  const correction = clamp(centre - lanePos, -1, 1) * 26 * dt;
  if (c.axis === 'x') c.y += correction; else c.x += correction;
  // Keep inside the map; turn around at the edge instead of leaving town.
  if (c.x < 60 || c.x > W.beachX - 60 || c.y < 60 || c.y > G.world.size - 60) {
    c.dir *= -1;
    c.angle += Math.PI;
    c.lane = laneOffset(c.axis, c.dir);
  }
  checkPedHits(G, c);
}

function updateCopCar(G, c, dt) {
  const p = G.player;
  const tx = p.driving ? p.driving.x : p.x;
  const ty = p.driving ? p.driving.y : p.y;
  const dx = tx - c.x, dy = ty - c.y;
  const want = Math.atan2(dy, dx);
  c.angle = angleLerp(c.angle, want, clamp(2.4 * dt, 0, 1));
  const fwd = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
  const facing = (dx * fwd.x + dy * fwd.y) / Math.max(1, Math.hypot(dx, dy));
  const target = facing > 0.2 ? CFG.police.copCarSpeed : 120;
  c.speed += clamp(target - c.speed, -400 * dt, 320 * dt);
  c.vx = fwd.x * c.speed; c.vy = fwd.y * c.speed;
  moveCarWithCollision(G, c, dt);
  // Ramming the player's car hurts it and counts as a crime witnessed.
  if (p.driving && dist2(c.x, c.y, p.driving.x, p.driving.y) < 46 * 46 && c.hitCooldown <= 0) {
    c.hitCooldown = 0.7;
    damageCar(G, p.driving, CFG.car.ramDamage);
    G.audio.crash();
    G.particles.push({ x: (c.x + p.driving.x) / 2, y: (c.y + p.driving.y) / 2, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffd23c', size: 14, spark: true });
  }
}

// Move a car with axis-separated building collision, like the player on foot.
function moveCarWithCollision(G, c, dt) {
  const nx = c.x + c.vx * dt;
  if (!G.world.collideCircle(nx, c.y, c.wid / 2 + 4)) c.x = nx;
  else { c.vx *= -0.25; c.speed *= 0.6; if (Math.abs(c.speed) > 220) { damageCar(G, c, 8); G.audio.crash(); } }
  const ny = c.y + c.vy * dt;
  if (!G.world.collideCircle(c.x, ny, c.wid / 2 + 4)) c.y = ny;
  else { c.vy *= -0.25; c.speed *= 0.6; if (Math.abs(c.speed) > 220) { damageCar(G, c, 8); G.audio.crash(); } }
  c.x = clamp(c.x, 20, G.world.size - 20);
  c.y = clamp(c.y, 20, G.world.size - 20);
}

// Soft car-car separation: push apart, trade a little speed, spark on a hard hit.
function resolveCarCollisions(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.len + b.len) / 2 - 8;
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
          a.hitCooldown = b.hitCooldown = 0.5;
          damageCar(G, a, impact / 40);
          damageCar(G, b, impact / 40);
          G.audio.crash();
          const playerInvolved = a.driver === 'player' || b.driver === 'player';
          if (playerInvolved) G.police.addCrime(G, CFG.wanted.hitCar, 'traffic collision');
        }
        a.speed *= 0.92; b.speed *= 0.92;
      }
    }
  }
}

function checkPedHits(G, c) {
  if (Math.abs(c.speed) < 60) return;
  for (const ped of G.peds) {
    if (ped.state === 'down' || ped.hitCooldown > 0) continue;
    if (dist2(c.x, c.y, ped.x, ped.y) < 30 * 30) {
      ped.state = 'down'; ped.timer = 5; ped.hitCooldown = 6;
      ped.vx = Math.cos(c.angle) * 160; ped.vy = Math.sin(c.angle) * 160;
      G.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff5a5a', size: 12, spark: true });
      G.audio.thud();
      if (c.driver === 'player') {
        G.police.addCrime(G, CFG.wanted.hitPed, 'pedestrian hit');
        G.pedsFleeFrom(G, ped.x, ped.y, 260);
      }
    }
  }
}

export function damageCar(G, car, amount) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed *= 0.3;
    G.audio.explosion();
    for (let i = 0; i < 14; i++) {
      G.particles.push({ x: car.x, y: car.y, vx: G.rng.range(-140, 140), vy: G.rng.range(-140, 140), life: G.rng.range(0.3, 0.8), max: 0.8, color: G.rng.pick(['#ff9a3c', '#ffd23c', '#888']), size: G.rng.range(3, 7), spark: true });
    }
    if (car.driver === 'player') {
      // The ride is dead: Rex climbs out on foot.
      const p = G.player;
      p.driving = null;
      p.x = car.x + 30; p.y = car.y;
    }
  }
}

function nearestRoadX(G, x) {
  let best = G.world.roadXs[0], bd = Infinity;
  for (const rx of G.world.roadXs) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = rx; } }
  return best;
}
function nearestRoadY(G, y) {
  let best = G.world.roadYs[0], bd = Infinity;
  for (const ry of G.world.roadYs) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = ry; } }
  return best;
}
