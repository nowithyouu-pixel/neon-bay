// Pedestrians: the people of Neon Bay. They stroll the sidewalks, cross at
// corners, run from gunfire and crashes, and go down hard when a car clips
// them. Nobody here is a target — hitting one is a crime the police notice.
import { CFG } from './config.js';
import { clamp, dist2 } from './random.js';

const SHIRTS = ['#e8c87a', '#7ab8e8', '#e87a9a', '#9ae87a', '#c9a0e8',
                '#e8e8e8', '#e8a05a', '#5ad0c2', '#d05a5a', '#8a9ab8'];

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i++) {
    const spot = G.world.randomSidewalkPoint();
    const target = G.world.randomSidewalkPoint();
    G.peds.push({
      x: spot.x, y: spot.y, angle: G.rng.range(0, Math.PI * 2),
      speed: G.rng.range(42, 78),
      state: 'walk',           // walk | flee | down
      tx: target.x, ty: target.y,
      color: G.rng.pick(SHIRTS),
      timer: G.rng.range(2, 8),
      idle: 0,
      down: 0, hp: 100, hitCooldown: 0,
      vx: 0, vy: 0,
      walkPhase: G.rng.range(0, Math.PI * 2),
    });
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.hitCooldown > 0) ped.hitCooldown -= dt;
    if (ped.state === 'down') {
      ped.timer -= dt;
      ped.x += ped.vx * dt; ped.y += ped.vy * dt;
      ped.vx *= Math.max(0, 1 - 4 * dt); ped.vy *= Math.max(0, 1 - 4 * dt);
      if (ped.timer <= 0) { ped.state = 'flee'; ped.timer = 5; }
      continue;
    }
    ped.walkPhase += dt * 9;
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d > 12) {
        ped.angle = Math.atan2(dy, dx);
        const sp = ped.speed * 2.6;
        movePed(G, ped, Math.cos(ped.angle) * sp * dt, Math.sin(ped.angle) * sp * dt);
      }
      if (ped.timer <= 0) { ped.state = 'walk'; pickNewTarget(G, ped); }
      continue;
    }
    // Walking: head for the target sidewalk point, then pick a new one.
    // Sometimes a pedestrian just stops — checking a phone, watching the bay.
    if (ped.idle > 0) { ped.idle -= dt; continue; }
    ped.timer -= dt;
    const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 14 || ped.timer <= 0) {
      if (G.rng.chance(0.25)) ped.idle = G.rng.range(2, 5);
      pickNewTarget(G, ped);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    movePed(G, ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt);
    // A gunshot nearby sends everyone on the block running.
    if (G.lastShotAt && dist2(ped.x, ped.y, G.lastShotAt.x, G.lastShotAt.y) < 300 * 300) {
      fleeFromPoint(G, ped, G.lastShotAt.x, G.lastShotAt.y);
    }
  }
  // Keep the crowd near the player: recycle peds that wandered far away.
  for (const ped of G.peds) {
    if (dist2(ped.x, ped.y, p.x, p.y) > 1400 * 1400) {
      const spot = G.world.randomSidewalkPoint();
      ped.x = spot.x; ped.y = spot.y;
      ped.state = 'walk';
      pickNewTarget(G, ped);
    }
  }
}

function pickNewTarget(G, ped) {
  const t = G.world.randomSidewalkPoint();
  ped.tx = t.x; ped.ty = t.y;
  ped.timer = G.rng.range(6, 16);
}

function movePed(G, ped, dx, dy) {
  const nx = ped.x + dx;
  if (!G.world.collideCircle(nx, ped.y, 10)) ped.x = nx;
  const ny = ped.y + dy;
  if (!G.world.collideCircle(ped.x, ny, 10)) ped.y = ny;
  ped.x = clamp(ped.x, 16, G.world.size - 16);
  ped.y = clamp(ped.y, 16, G.world.size - 16);
}

function fleeFromPoint(G, ped, x, y) {
  const dx = ped.x - x, dy = ped.y - y;
  const d = Math.hypot(dx, dy) || 1;
  ped.state = 'flee';
  ped.tx = ped.x + (dx / d) * 320;
  ped.ty = ped.y + (dy / d) * 320;
  ped.timer = 4;
  ped.tx = clamp(ped.tx, 20, G.world.size - 20);
  ped.ty = clamp(ped.ty, 20, G.world.size - 20);
}

// Every pedestrian in range runs from the given point.
export function pedsFleeFrom(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) fleeFromPoint(G, ped, x, y);
  }
}
