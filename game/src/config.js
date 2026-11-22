// Neon Bay tuning: every number the game balances on lives here so a single
// edit retunes driving, the wanted system, missions and combat together.
export const CFG = {
  world: {
    size: 3400,            // world is size x size pixels
    roadSpacing: 400,      // distance between parallel road centre lines
    roadOffset: 200,       // first road centre line from the west / north edge
    roadWidth: 92,
    sidewalk: 16,          // pavement strip around each block
    waterX: 3180,          // east of this the bay begins
    beachX: 3060,          // sand strip between the last road and the water
  },
  player: {
    walkSpeed: 195,
    runSpeed: 265,         // holding Shift while on foot
    radius: 13,
    maxHealth: 100,
    punchDamage: 22,
    punchRange: 46,
    punchArc: 1.15,        // radians either side of facing
    punchCooldown: 0.38,
  },
  car: {
    accel: 430,
    reverseAccel: 300,
    maxSpeed: 470,
    maxReverse: 170,
    brake: 620,
    handbrake: 900,
    drag: 0.55,            // per-second velocity damping while coasting
    grip: 7.5,             // how fast lateral velocity is killed (higher = less slide)
    steerRate: 2.6,        // radians per second at full lock, scaled by speed
    trafficSpeed: 150,
    trafficMax: 210,
    ramDamage: 14,         // damage a police ram deals to the player's car
    wreckHp: 100,
  },
  wanted: {
    pointsPerLevel: [0, 30, 80, 160, 280, 450], // points needed to reach each star
    stealCar: 34,         // just over the 1-star line, so one theft holds its star
    hitPed: 34,
    hitCar: 8,
    shoot: 18,
    copKill: 70,
    decayPerSec: 2.2,      // points lost while no officer can see the player
    decayHiddenMult: 3.0,  // faster decay while fully hidden (indoors / far away)
    maxPoints: 600,
  },
  police: {
    footCopSpeed: 205,
    copCarSpeed: 500,
    arrestRange: 26,
    arrestHold: 0.9,       // seconds a cop must stay in range to make the arrest
    sightRange: 520,
    maxFootCops: 6,
    maxCopCars: 5,
    roadblockAt: 3,        // stars
    heliAt: 4,             // stars
  },
  missions: {
    rewards: [250, 400, 600, 900, 2500],
    courierTime: 150,      // seconds for the three deliveries
    getawaySurvive: 45,    // seconds to survive the heat before the safehouse opens
    bankHold: 6,           // seconds inside the vault marker to crack it
  },
  combat: {
    pistolDamage: 34,
    pistolRange: 460,
    pistolCooldown: 0.22,
    pistolSpread: 0.045,
    bulletSpeed: 900,
    enemyHp: 70,
    enemyDamage: 9,
    enemyRange: 380,
    enemyCooldown: 0.9,
    pickupAmmo: 24,
  },
  camera: {
    lerp: 5.0,             // how fast the camera catches the player
    driveZoom: 0.92,       // pull back a little while driving
    footZoom: 1.0,
  },
  time: {
    startMinutes: 10 * 60 + 5, // story opens just after ten in the morning
    minutesPerSecond: 0.55,    // a full day takes about 43 real minutes
  },
  save: {
    key: 'neon-bay-save-v1',
    autosaveSeconds: 20,
  },
  districts: [
    { name: 'Old Mill', x0: 0, y0: 0, x1: 1700, y1: 1700,
      palette: ['#8a6f5c', '#7d6a72', '#6e6257', '#93755a'] },
    { name: 'Marina Heights', x0: 1700, y0: 0, x1: 3100, y1: 1700,
      palette: ['#5f7fa8', '#7a8ba0', '#4f6f92', '#8fa3b8'] },
    { name: 'Coral Row', x0: 0, y0: 1700, x1: 1700, y1: 3400,
      palette: ['#c96f5e', '#d98a6b', '#b85a6e', '#e0a061'] },
    { name: 'Dockside', x0: 1700, y0: 1700, x1: 3100, y1: 3400,
      palette: ['#5e7d6a', '#74855c', '#4e6a72', '#8a7d55'] },
  ],
  carColors: ['#c23b3b', '#3b6ec2', '#e0b13c', '#3fae6a', '#8a4fc2',
              '#d8d8d8', '#2b2f38', '#e07b39', '#39b8c2', '#b8c23b'],
};
