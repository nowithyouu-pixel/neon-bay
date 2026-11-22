// Neon Bay boot and the one loop. main builds the shared game object G, wires
// every system onto it, spawns the city, and then runs the loop: read input,
// advance the world, paint the frame. Menu states (title / paused / busted /
// wasted / complete) render the world behind a menu; only 'play' simulates.
import { CFG } from './config.js';
import { createRng, clamp } from './random.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { createPlayer, updatePlayerOnFoot, tryEnterCar, exitCar, hurtPlayer } from './player.js';
import { spawnTraffic, spawnParked, updateVehicles } from './vehicles.js';
import { spawnPeds, updatePeds, pedsFleeFrom } from './pedestrians.js';
import { createWanted, addCrime, updateWanted, updatePolice, spawnFootCop, spawnCopCar, levelForPoints } from './police.js';
import { spawnEnemy, spawnPickup, enemyShoot, updateCombat, upkeepPickups } from './combat.js';
import { MISSIONS, createMissionState, startMission, updateMissions, currentTarget, objectiveText, onEnemyDown } from './missions.js';
import { updateCamera, render } from './render.js';
import { createHud, drawHud, drawMenu, menuClick } from './hud.js';
import { AudioEngine } from './audio.js';
import { hasSave, loadGame, saveGame, applySave } from './save.js';
import { parseShotParams, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const { shot, seed: seedParam } = parseShotParams();
const seed = seedParam !== null ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRng(seed);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  G.viewW = window.innerWidth;
  G.viewH = window.innerHeight;
}

const G = {
  canvas, ctx,
  viewW: window.innerWidth, viewH: window.innerHeight,
  rng, seed,
  world: buildWorld(rng),
  input: new Input(canvas),
  audio: new AudioEngine(),
  hud: createHud(),
  state: 'title',
  time: CFG.time.startMinutes,
  elapsed: 0,
  lastDt: 0,
  player: null,
  cars: [], peds: [], cops: [], bullets: [], enemies: [],
  pickups: [], particles: [], floaters: [],
  wanted: createWanted(),
  mission: createMissionState(),
  camera: { x: 0, y: 0, zoom: 1 },
  heli: { x: 0, y: 0, active: false },
  roadblocks: [],
  bustedFine: 0,
  shotMode: false,
  shotCooldown: 0,
  pickupTimer: 0,
  lastShotAt: null,
  lastCrimeAt: 0,
  saveTimer: 0,
};

// Wire the systems onto G so the modules can reach each other through it.
G.police = { addCrime, updateWanted, updatePolice, spawnFootCop, spawnCopCar, levelForPoints };
G.combat = { spawnEnemy, spawnPickup, enemyShoot, updateCombat, upkeepPickups };
G.missions = { startMission, updateMissions, currentTarget, objectiveText, onEnemyDown };
G.save = { saveGame, loadGame, hasSave, applySave };
G.playerHurt = (amount) => hurtPlayer(G, amount);
G.pedsFleeFrom = (x, y, r) => pedsFleeFrom(G, x, y, r);

// --- Setup ---
G.player = createPlayer(G.world.places.start.x, G.world.places.start.y);
spawnTraffic(G, 16);
spawnParked(G, 10);
spawnPeds(G, 26);
upkeepPickups(G, 0.01);
G.mission.index = 0; G.mission.step = 0; // story opens on mission 1; startMission runs on Start, so booting never overwrites a real save
G.camera.x = clamp(G.player.x - G.viewW / 2, 0, Math.max(0, G.world.size - G.viewW));
G.camera.y = clamp(G.player.y - G.viewH / 2, 0, Math.max(0, G.world.size - G.viewH));

applyShot(G, shot);
if (G.shotMode) {
  // Snap the camera onto the staged scene at once.
  updateCamera(G, 10);
  G.audio.muted = true;
}

// A debug handle for playtesting (and for the finalist review to poke at):
// window.__neonBay is the live game object.
window.__neonBay = G;

window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'play') {
    G.state = 'paused';
    saveGame(G);
  }
});

// --- Menu actions ---
function startStory() {
  G.audio.init();
  G.audio.startMusic();
  const saved = loadGame();
  if (saved) {
    applySave(G, saved);
    G.player.health = Math.max(G.player.health, 60);
    G.wanted.points = 0; G.wanted.level = 0;
  } else {
    G.player.cash = 0;
    G.player.health = CFG.player.maxHealth;
    G.missions.startMission(G, 0);
  }
  G.state = 'play';
  announce('Playing Neon Bay.');
}

function startFreeRoam() {
  G.audio.init();
  G.audio.startMusic();
  G.player.cash = 0;
  G.player.health = CFG.player.maxHealth;
  G.mission.index = MISSIONS.length;
  G.mission.done = true;
  G.state = 'play';
  announce('Free roam. Neon Bay is yours.');
}

function doMenuAction(action) {
  if (action === 'start') startStory();
  else if (action === 'freeroam') startFreeRoam();
  else if (action === 'resume') { G.state = 'play'; announce('Playing.'); }
  else if (action === 'restart') { startStory(); }
  else if (action === 'quit') { G.state = 'title'; }
}

function announce(message) {
  if (statusEl) statusEl.textContent = message;
}

// --- Per-frame updates ---
function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += (pt.vx || 0) * dt;
    pt.y += (pt.vy || 0) * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.y -= 26 * dt;
    f.life -= dt;
    if (f.life <= 0) G.floaters.splice(i, 1);
  }
}

function updatePlay(dt) {
  const input = G.input;
  const p = G.player;

  if (input.wasPressed('Escape')) { G.state = 'paused'; saveGame(G); return; }
  if (input.wasPressed('KeyM')) G.audio.toggleMute();
  if (input.wasPressed('KeyE')) {
    if (p.driving) exitCar(G);
    else tryEnterCar(G, G.cars);
  }

  G.time = (G.time + CFG.time.minutesPerSecond * dt) % (24 * 60);
  updatePlayerOnFoot(G, dt);
  updateVehicles(G, dt);
  updatePeds(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  upkeepPickups(G, dt);
  updateParticles(dt);
  if (!p.driving) G.audio.engine(0, false);
  G.audio.setSiren(G.wanted.level > 0);

  G.saveTimer += dt;
  if (G.saveTimer >= CFG.save.autosaveSeconds) {
    G.saveTimer = 0;
    saveGame(G);
  }
}

function updateAmbient(dt) {
  // The title screen's backdrop: traffic and pedestrians move, nobody commits crimes.
  updateVehicles(G, dt);
  updatePeds(G, dt);
  updateParticles(dt);
}

// --- The loop ---
let last = performance.now();
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  G.lastDt = dt;
  G.elapsed += dt;

  // Menu clicks first: a click on a button must not also fire the pistol.
  const click = G.input.takeClick();
  if (click && G.state !== 'play') {
    const action = menuClick(G, click.x, click.y);
    if (action) doMenuAction(action);
  }
  if (G.state === 'title' && G.input.wasPressed('Enter')) doMenuAction('start');
  if (G.state === 'paused' && (G.input.wasPressed('Escape') || G.input.wasPressed('Enter'))) {
    G.input.consume('Escape');
    G.input.consume('Enter');
    G.state = 'play';
    announce('Playing.');
  }
  if ((G.state === 'busted' || G.state === 'wasted' || G.state === 'complete') && G.input.wasPressed('Enter')) {
    doMenuAction(G.state === 'complete' ? 'resume' : 'restart');
  }

  if (G.state === 'play') updatePlay(dt);
  else if (G.state === 'title') updateAmbient(dt);

  updateCamera(G, dt);
  render(G);
  if (G.state === 'play') drawHud(G);
  else drawMenu(G);
  G.input.endFrame();

  frames++;
  if (G.shotMode && frames === 2) window.__shotReady = true;
}

resize();
announce('Neon Bay. Press Enter or click Start to play.');
requestAnimationFrame(frame);
