// Combat in Neon Bay: fists (F), a pistol with ammo pickups (mouse aim, click
// to fire, auto-aim when the mouse has never moved), and the armed thugs the
// later missions throw at Rex. Bullets are simple tracers; every shot is a
// crime, and every shot sends the pedestrians running.
import { CFG } from './config.js';
import { clamp, dist2, angleDiff } from './random.js';
import { damageCar } from './vehicles.js';

export function spawnEnemy(G, x, y) {
  const e = {
    x, y, angle: G.rng.range(0, Math.PI * 2),
    hp: CFG.combat.enemyHp, speed: 150,
    fireTimer: G.rng.range(0.4, 1.2), down: 0, hitFlash: 0,
  };
  G.enemies.push(e);
  return e;
}

export function spawnPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, amount: kind === 'ammo' ? CFG.combat.pickupAmmo : 40, bob: G.rng.range(0, Math.PI * 2) });
}

export function updateCombat(G, dt) {
  const p = G.player;
  const input = G.input;

  // --- Fists ---
  if (input.wasPressed('KeyF') && !p.driving && p.punchTimer <= 0) {
    p.punchTimer = CFG.player.punchCooldown;
    p.punchAnim = 0.22;
    G.audio.punch();
    const hit = punchHit(G, p.x, p.y, p.angle);
    if (!hit) G.particles.push({ x: p.x + Math.cos(p.angle) * 34, y: p.y + Math.sin(p.angle) * 34, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#ffffff', size: 10, ring: true });
  }

  // --- Pistol ---
  if (p.hasPistol && p.ammo > 0 && !p.driving) {
    if (!G.shotCooldown) G.shotCooldown = 0;
    G.shotCooldown -= dt;
    if ((input.mouse.down || input.wasPressed('KeyQ')) && G.shotCooldown <= 0) {
      G.shotCooldown = CFG.combat.pistolCooldown;
      firePistol(G);
    }
  }

  updateBullets(G, dt);
  updateEnemies(G, dt);
  updatePickups(G, dt);
}

function punchHit(G, x, y, angle) {
  let hitAny = false;
  const targets = [];
  for (const e of G.enemies) if (e.down <= 0) targets.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
  for (const c of G.cops) if (c.down <= 0) targets.push({ x: c.x, y: c.y, kind: 'cop', ref: c });
  for (const ped of G.peds) if (ped.state !== 'down') targets.push({ x: ped.x, y: ped.y, kind: 'ped', ref: ped });
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d > CFG.player.punchRange + 12) continue;
    if (Math.abs(angleDiff(angle, Math.atan2(t.y - y, t.x - x))) > CFG.player.punchArc) continue;
    hitAny = true;
    if (t.kind === 'enemy') damageEnemy(G, t.ref, CFG.player.punchDamage);
    else if (t.kind === 'cop') damageCop(G, t.ref, CFG.player.punchDamage);
    else {
      t.ref.state = 'down'; t.ref.timer = 4;
      G.police.addCrime(G, CFG.wanted.hitPed, 'pedestrian hit');
      G.pedsFleeFrom(G, t.x, t.y, 220);
    }
    G.particles.push({ x: t.x, y: t.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#ffd23c', size: 12, spark: true });
  }
  return hitAny;
}

function aimAngle(G) {
  const p = G.player;
  // The mouse aims when it has moved; otherwise auto-aim the nearest threat.
  if (G.input.mouse.moved || G.input.mouse.down) {
    const wx = G.camera.x + G.input.mouse.x / G.camera.zoom;
    const wy = G.camera.y + G.input.mouse.y / G.camera.zoom;
    return Math.atan2(wy - p.y, wx - p.x);
  }
  let best = null, bestD = 320 * 320;
  for (const e of G.enemies) {
    if (e.down > 0) continue;
    const d = dist2(p.x, p.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  for (const c of G.cops) {
    if (c.down > 0) continue;
    const d = dist2(p.x, p.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best) return Math.atan2(best.y - p.y, best.x - p.x);
  return p.angle;
}

function firePistol(G) {
  const p = G.player;
  p.ammo -= 1;
  const a = aimAngle(G) + (G.rng.next() - 0.5) * CFG.combat.pistolSpread * 2;
  const mx = p.x + Math.cos(a) * 26, my = p.y + Math.sin(a) * 26;
  G.bullets.push({
    x: mx, y: my,
    vx: Math.cos(a) * CFG.combat.bulletSpeed,
    vy: Math.sin(a) * CFG.combat.bulletSpeed,
    life: CFG.combat.pistolRange / CFG.combat.bulletSpeed,
    from: 'player', damage: CFG.combat.pistolDamage,
  });
  G.particles.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.07, max: 0.07, color: '#ffe9a8', size: 16, flash: true });
  G.lastShotAt = { x: p.x, y: p.y };
  G.audio.shot();
  G.police.addCrime(G, CFG.wanted.shoot, 'shots fired');
  G.pedsFleeFrom(G, p.x, p.y, 320);
}

// A hostile shot from a cop or a thug, with a little inaccuracy.
export function enemyShoot(G, x, y, tx, ty, from) {
  const a = Math.atan2(ty - y, tx - x) + (G.rng.next() - 0.5) * 0.16;
  G.bullets.push({
    x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20,
    vx: Math.cos(a) * CFG.combat.bulletSpeed * 0.9,
    vy: Math.sin(a) * CFG.combat.bulletSpeed * 0.9,
    life: CFG.combat.enemyRange / CFG.combat.bulletSpeed,
    from, damage: CFG.combat.enemyDamage,
  });
  G.particles.push({ x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, vx: 0, vy: 0, life: 0.06, max: 0.06, color: '#ffb08a', size: 12, flash: true });
  G.audio.enemyShot();
}

function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && G.world.hitsBuilding(b.x, b.y, 1)) {
      dead = true;
      G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, color: '#ffd23c', size: 8, spark: true });
    }
    if (!dead && b.from === 'player') {
      for (const e of G.enemies) {
        if (e.down > 0) continue;
        if (dist2(b.x, b.y, e.x, e.y) < 16 * 16) { damageEnemy(G, e, b.damage); dead = true; break; }
      }
      if (!dead) for (const c of G.cops) {
        if (c.down > 0) continue;
        if (dist2(b.x, b.y, c.x, c.y) < 15 * 15) { damageCop(G, c, b.damage); dead = true; break; }
      }
      if (!dead) for (const car of G.cars) {
        if (car.wrecked) continue;
        if (dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
          // Shooting a car damages it; shooting a cop car is noticed.
          if (car.driver === 'cop') G.police.addCrime(G, CFG.wanted.shoot, 'police car hit');
          dead = true; break;
        }
      }
    }
    if (!dead && (b.from === 'cop' || b.from === 'enemy')) {
      const px = p.driving ? p.driving.x : p.x;
      const py = p.driving ? p.driving.y : p.y;
      const r = p.driving ? 26 : 14;
      if (dist2(b.x, b.y, px, py) < r * r) {
        if (p.driving) damageCar(G, p.driving, b.damage);
        else hurtPlayerLocal(G, b.damage);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function hurtPlayerLocal(G, amount) {
  // Player damage goes through player.js so death lands in one place.
  G.playerHurt(amount);
}

function damageEnemy(G, e, amount) {
  e.hp -= amount;
  e.hitFlash = 0.15;
  if (e.hp <= 0 && e.down <= 0) {
    e.down = 999; // stays down; the mission counts the body
    G.audio.enemyDown();
    if (G.rng.chance(0.5)) spawnPickup(G, e.x, e.y, 'ammo');
    G.floaters.push({ x: e.x, y: e.y - 18, text: 'DOWN', life: 1.1, color: '#ffd23c' });
    if (G.missions.onEnemyDown) G.missions.onEnemyDown(G, e);
  }
}

function damageCop(G, cop, amount) {
  cop.hp -= amount;
  if (cop.hp <= 0 && cop.down <= 0) {
    cop.down = 999;
    G.police.addCrime(G, CFG.wanted.copKill, 'officer down');
    G.audio.enemyDown();
    G.floaters.push({ x: cop.x, y: cop.y - 18, text: 'OFFICER DOWN', life: 1.2, color: '#ff5a5a' });
  }
}

function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.down > 0) continue;
    const px = p.driving ? p.driving.x : p.x;
    const py = p.driving ? p.driving.y : p.y;
    const dx = px - e.x, dy = py - e.y;
    const d = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    if (d > 70 && d < 620) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
      if (G.world.collideCircle(e.x, e.y, 12)) { e.x -= Math.cos(e.angle) * e.speed * dt; e.y -= Math.sin(e.angle) * e.speed * dt; }
    }
    if (d < CFG.combat.enemyRange) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = CFG.combat.enemyCooldown * G.rng.range(0.9, 1.4);
        enemyShoot(G, e.x, e.y, px, py, 'enemy');
      }
    }
    // A thug who gets close swings instead of shooting.
    if (d < 34 && !p.driving && G.rng.chance(dt * 1.2)) {
      G.playerHurt(CFG.combat.enemyDamage);
      G.audio.punch();
    }
  }
}

function updatePickups(G, dt) {
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.bob += dt * 4;
    if (dist2(pk.x, pk.y, px, py) < 30 * 30) {
      if (pk.kind === 'ammo') {
        p.hasPistol = true;
        p.ammo += pk.amount;
        G.floaters.push({ x: pk.x, y: pk.y - 14, text: `AMMO +${pk.amount}`, life: 1.2, color: '#ffe9a8' });
      } else {
        p.health = clamp(p.health + pk.amount, 0, CFG.player.maxHealth);
        G.floaters.push({ x: pk.x, y: pk.y - 14, text: `HEALTH +${pk.amount}`, life: 1.2, color: '#7ae8a0' });
      }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}

// Keep the streets armed: a pistol cache and a first-aid kit respawn slowly.
export function upkeepPickups(G, dt) {
  G.pickupTimer = (G.pickupTimer || 0) - dt;
  if (G.pickupTimer <= 0) {
    G.pickupTimer = 26;
    const ammoCount = G.pickups.filter((k) => k.kind === 'ammo').length;
    if (ammoCount < 3) {
      const spot = G.world.randomSidewalkPoint();
      spawnPickup(G, spot.x, spot.y, 'ammo');
    }
    const healthCount = G.pickups.filter((k) => k.kind === 'health').length;
    if (healthCount < 2) {
      const spot = G.world.randomSidewalkPoint();
      spawnPickup(G, spot.x, spot.y, 'health');
    }
  }
}
