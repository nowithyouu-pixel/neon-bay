// Saving to localStorage: cash, health, ammo, the mission Rex is on, where he
// stands and what time it is. Nothing leaves the browser, and a missing or
// corrupt save just starts a new story.
import { CFG } from './config.js';

export function hasSave() {
  try {
    return !!localStorage.getItem(CFG.save.key);
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.save.key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(G) {
  if (G.shotMode) return; // staged screenshots never write a save
  const p = G.player;
  const data = {
    version: 1,
    cash: Math.floor(p.cash),
    health: Math.round(p.health),
    ammo: p.ammo,
    hasPistol: p.hasPistol,
    missionIndex: G.mission.index,
    missionStep: G.mission.step,
    x: Math.round(p.driving ? p.driving.x : p.x),
    y: Math.round(p.driving ? p.driving.y : p.y),
    time: Math.round(G.time),
    muted: G.audio.muted,
  };
  try {
    localStorage.setItem(CFG.save.key, JSON.stringify(data));
    G.hud.flashSaved();
  } catch {
    // Private mode or a full store: the game plays on without saving.
  }
}

export function applySave(G, data) {
  const p = G.player;
  p.cash = data.cash || 0;
  p.health = data.health || CFG.player.maxHealth;
  p.ammo = data.ammo || 0;
  p.hasPistol = !!data.hasPistol;
  p.x = data.x || G.world.places.start.x;
  p.y = data.y || G.world.places.start.y;
  G.time = data.time || CFG.time.startMinutes;
  if (typeof data.muted === 'boolean') {
    G.audio.muted = data.muted;
    if (G.audio.master) G.audio.master.gain.value = data.muted ? 0 : 0.5;
  }
  const idx = data.missionIndex || 0;
  if (idx >= 5) {
    // Story already finished: free roam with everything open.
    G.mission.index = 5;
    G.mission.done = true;
  } else {
    G.missions.startMission(G, idx);
    G.mission.step = data.missionStep || 0;
  }
}
