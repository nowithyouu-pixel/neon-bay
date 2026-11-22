// Rex Marlowe on foot: walking, running, entering and leaving cars, and the
// health and cash he carries. Driving lives in vehicles.js; this file only
// moves the man himself and hands him over to a car (or takes him back).
import { CFG } from './config.js';
import { clamp } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,   // facing north to start
    vx: 0, vy: 0,
    health: CFG.player.maxHealth,
    cash: 0,
    ammo: 0,               // pistol rounds; 0 means fists only
    hasPistol: false,
    driving: null,         // the vehicle object while behind the wheel
    punchTimer: 0,
    punchAnim: 0,
    hurtFlash: 0,
    invulnerable: 0,
  };
}

// Move on foot with axis-separated collision so Rex slides along walls.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  // Timers tick even while driving (hurt flash, brief invulnerability).
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.driving) return;
  const axis = input.moveAxis();
  const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = running ? CFG.player.runSpeed : CFG.player.walkSpeed;
  let mx = axis.x, my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
  }
  const nx = p.x + mx * speed * dt;
  if (!G.world.collideCircle(nx, p.y, CFG.player.radius)) p.x = nx;
  const ny = p.y + my * speed * dt;
  if (!G.world.collideCircle(p.x, ny, CFG.player.radius)) p.y = ny;
  p.x = clamp(p.x, 16, G.world.size - 16);
  p.y = clamp(p.y, 16, G.world.size - 16);
  p.vx = mx * speed; p.vy = my * speed;
}

// E near a car: steal it (traffic cars lose their driver, parked cars are free).
// Returns the car taken, or null.
export function tryEnterCar(G, cars) {
  const p = G.player;
  if (p.driving) return null;
  let best = null, bestD = 78 * 78;
  for (const c of cars) {
    if (c.wrecked) continue;
    const dx = c.x - p.x, dy = c.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return null;
  if (best.driver === 'traffic') {
    // Jacking a moving car: the driver bails out onto the sidewalk and the
    // law notices. Parked cars (driver 'none') are a quieter crime.
    best.driver = 'player';
    G.police.addCrime(G, CFG.wanted.stealCar, 'car stolen');
    G.audio.carjack();
    spawnFleeingDriver(G, best);
  } else if (best.driver === 'none') {
    best.driver = 'player';
    // A parked car is the same charge — the owner reports it either way.
    G.police.addCrime(G, CFG.wanted.stealCar, 'car taken');
  } else {
    return null;
  }
  best.speed = 0;
  p.driving = best;
  p.x = best.x; p.y = best.y;
  return best;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.driving;
  if (!car) return;
  car.driver = 'none';
  car.speed = 0;
  // Step out on the car's left side, clear of traffic.
  const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  if (!G.world.collideCircle(sx, sy, CFG.player.radius)) { p.x = sx; p.y = sy; }
  else { p.x = car.x; p.y = car.y; }
  p.driving = null;
  p.angle = car.angle;
}

// A jacked driver runs for the nearest sidewalk, shouting.
function spawnFleeingDriver(G, car) {
  const spot = G.world.randomSidewalkPoint();
  G.peds.push({
    x: car.x, y: car.y, angle: 0, speed: 210,
    state: 'flee', tx: spot.x, ty: spot.y,
    color: '#e8c87a', timer: 6, down: 0, hp: 100,
  });
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.invulnerable > 0 || G.state !== 'play') return;
  p.health -= amount;
  p.hurtFlash = 0.35;
  p.invulnerable = 0.25;
  if (p.health <= 0) {
    p.health = 0;
    G.state = 'wasted';
    G.audio.wasted();
  }
}
