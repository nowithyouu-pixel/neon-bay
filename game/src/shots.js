// Screenshot staging: ?shot=start|play|chase|mission&seed=1 puts the game in a
// fixed, complete scene so every screenshot shows the real game at its best.
// Positions are fixed, the world seed is fixed, and nothing here touches the
// network or the save file.
import { CFG } from './config.js';
import { createVehicle } from './vehicles.js';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seedRaw = q.get('seed');
  const seed = seedRaw ? (parseInt(seedRaw, 10) || 1) : null;
  return { shot, seed };
}

// Put a car under the player and hand him the keys.
function putPlayerInCar(G, x, y, angle, color) {
  const car = createVehicle(x, y, angle, { color: color || '#c23b3b', driver: 'player' });
  G.cars.push(car);
  G.player.driving = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

function putCopCar(G, x, y, angle) {
  const car = createVehicle(x, y, angle, { color: '#1c2733', type: 'cop', driver: 'cop' });
  car.cruise = CFG.police.copCarSpeed;
  G.cars.push(car);
  return car;
}

export function applyShot(G, shot) {
  if (!shot) return;
  G.shotMode = true;
  const p = G.player;
  const places = G.world.places;

  if (shot === 'start') {
    G.state = 'title';
    G.time = 17 * 60 + 40; // golden hour behind the title
    return;
  }

  if (shot === 'play') {
    G.state = 'play';
    G.time = 10 * 60 + 5;
    putPlayerInCar(G, 1000, 1400, 0, '#e0b13c');
    G.mission.index = 0;
    G.mission.step = 1;
    G.mission.done = false;
    return;
  }

  if (shot === 'chase') {
    G.state = 'play';
    G.time = 18 * 60 + 20; // sunset: the cover's amber light
    putPlayerInCar(G, 1400, 1800, Math.PI / 2, '#c23b3b');
    // Wanted, four stars: roadblocks, helicopter, the works.
    G.wanted.points = CFG.wanted.pointsPerLevel[4];
    G.wanted.level = 4;
    G.heli.x = 1400; G.heli.y = 1800; G.heli.active = true;
    putCopCar(G, 1400, 1520, Math.PI / 2);
    putCopCar(G, 1140, 1800, 0);
    putCopCar(G, 1660, 1800, Math.PI);
    putCopCar(G, 1400, 2080, -Math.PI / 2);
    G.cops.push(
      { x: 1330, y: 1740, angle: 0, speed: CFG.police.footCopSpeed, hp: 50, arrest: 0, fireTimer: 1, hitCooldown: 0, down: 0 },
      { x: 1470, y: 1870, angle: 0, speed: CFG.police.footCopSpeed, hp: 50, arrest: 0, fireTimer: 1, hitCooldown: 0, down: 0 },
    );
    G.mission.index = 2;
    G.mission.step = 0;
    G.mission.timer = 32;
    G.mission.done = false;
    G.hud.banner('WANTED — 4 STARS', '#ff5a5a');
    return;
  }

  if (shot === 'mission') {
    G.state = 'play';
    G.time = 14 * 60;
    // The Big Score, mid-crack: Rex on foot at the vault, crew closing in.
    p.x = places.bank.x; p.y = places.bank.y + 40;
    p.angle = -Math.PI / 2;
    p.hasPistol = true;
    p.ammo = 18;
    p.cash = 1250; // four jobs banked before the big one
    G.wanted.points = CFG.wanted.pointsPerLevel[3];
    G.wanted.level = 3;
    G.mission.index = 4;
    G.mission.step = 1;
    G.mission.hold = 4.2;
    G.mission.done = false;
    G.combat.spawnEnemy(G, places.bank.x - 110, places.bank.y - 80);
    G.combat.spawnEnemy(G, places.bank.x + 120, places.bank.y - 60);
    G.combat.spawnPickup(G, places.bank.x - 50, places.bank.y + 90, 'ammo');
    putCopCar(G, places.bank.x + 190, places.bank.y + 130, Math.PI);
    G.hud.banner('THE BIG SCORE', '#ffd23c');
  }
}
