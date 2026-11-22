// The story of Neon Bay: five chained jobs for Rex Marlowe, from his first
// stolen car to the big score. Each mission is a small state machine —
// startMission sets the scene, updateMissions watches the steps — and every
// completion pays cash, shows a banner and saves the game.
import { CFG } from './config.js';
import { dist2 } from './random.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: '1 — First Wheels',
    brief: 'Fresh out of the old life, Rex needs wheels. Take any car on the street and bring it to the garage on Coral Row.',
  },
  {
    id: 'courier-run', title: '2 — Courier Run',
    brief: 'A fixer named Delia pays for fast hands. Three drops across the city, one clock. Do not keep her waiting.',
  },
  {
    id: 'getaway', title: '3 — Getaway',
    brief: 'The job went loud and the whole precinct is awake. Lose the heat, then slip back to the safehouse.',
  },
  {
    id: 'dockside-deal', title: '4 — Dockside Deal',
    brief: 'A trade at the piers, and a rival crew that wants the goods for free. Hold the dock, then get Marco out alive.',
  },
  {
    id: 'big-score', title: '5 — The Big Score',
    brief: 'Marina Heights Bank. One vault, one clean crack, and every cop in Neon Bay on your tail. Make it count.',
  },
];

export function createMissionState() {
  return { index: 0, step: 0, timer: 0, hold: 0, data: {}, done: false };
}

export function startMission(G, index) {
  const m = G.mission;
  m.index = index; m.step = 0; m.timer = 0; m.hold = 0; m.data = {}; m.done = false;
  const def = MISSIONS[index];
  G.hud.banner(def.title, '#ffd23c');
  G.hud.setObjective(def.brief);
  G.audio.missionStart();
  if (index === 2) {
    // The getaway opens hot: two stars before Rex has moved a step.
    G.wanted.points = CFG.wanted.pointsPerLevel[2];
    G.wanted.level = 2;
    m.timer = CFG.missions.getawaySurvive;
  }
  if (index === 1) m.timer = CFG.missions.courierTime;
  G.save.saveGame(G);
}

export function currentTarget(G) {
  const m = G.mission;
  const places = G.world.places;
  if (m.done || m.index >= MISSIONS.length) return null;
  if (m.index === 0) {
    if (m.step === 0) return null; // any car will do — no marker yet
    return { x: places.garage.x, y: places.garage.y, label: 'Garage' };
  }
  if (m.index === 1) {
    const stops = [places.courierA, places.courierB, places.courierC];
    const s = stops[Math.min(m.step, 2)];
    return { x: s.x, y: s.y, label: `Drop ${m.step + 1}/3` };
  }
  if (m.index === 2) {
    if (m.step === 0) return null; // survive — no place to go yet
    return { x: places.safehouse.x, y: places.safehouse.y, label: 'Safehouse' };
  }
  if (m.index === 3) {
    if (m.step === 0) return { x: places.dealSpot.x, y: places.dealSpot.y, label: 'The Deal' };
    if (m.step === 1) return { x: places.dealSpot.x, y: places.dealSpot.y, label: 'Defend the deal' };
    return { x: places.safehouse.x, y: places.safehouse.y, label: 'Safehouse' };
  }
  if (m.index === 4) {
    if (m.step === 0) return { x: places.bank.x, y: places.bank.y, label: 'Marina Heights Bank' };
    if (m.step === 1) return { x: places.bank.x, y: places.bank.y, label: 'Crack the vault' };
    return { x: places.safehouse.x, y: places.safehouse.y, label: 'Safehouse' };
  }
  return null;
}

export function objectiveText(G) {
  const m = G.mission;
  if (m.done || m.index >= MISSIONS.length) return 'Free roam — Neon Bay is yours. More work coming soon.';
  const p = G.player;
  if (m.index === 0) {
    return m.step === 0
      ? 'Steal a car — walk up to one and press E'
      : 'Drive to Rex’s Garage on Coral Row';
  }
  if (m.index === 1) {
    return `Deliver the package — drop ${m.step + 1} of 3 — ${Math.ceil(m.timer)}s left`;
  }
  if (m.index === 2) {
    return m.step === 0
      ? `Lose the heat — survive ${Math.ceil(m.timer)}s`
      : 'Heat’s off. Get to the Safehouse';
  }
  if (m.index === 3) {
    if (m.step === 0) return 'Get to the deal at Dockside Pier';
    if (m.step === 1) {
      const left = G.enemies.filter((e) => e.down <= 0).length;
      return `Defend the deal — ${left} of the rival crew still standing`;
    }
    return 'Get Marco to the Safehouse — drive, don’t walk';
  }
  if (m.index === 4) {
    if (m.step === 0) return 'Get to Marina Heights Bank';
    if (m.step === 1) return `Crack the vault — hold position ${Math.ceil(m.hold)}s`;
    return 'Run! Get to the Safehouse with the money';
  }
  return '';
}

function reach(G, target, radius) {
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  return dist2(px, py, target.x, target.y) < radius * radius;
}

function completeMission(G) {
  const m = G.mission;
  const reward = CFG.missions.rewards[m.index];
  G.player.cash += reward;
  G.player.health = Math.min(G.player.health + 20, CFG.player.maxHealth); // patched up between jobs
  G.hud.banner(`JOB DONE — +$${reward}`, '#7ae8a0');
  G.floaters.push({ x: G.player.x, y: G.player.y - 30, text: `+$${reward}`, life: 1.6, color: '#7ae8a0' });
  G.audio.missionDone();
  m.done = true;
  G.save.saveGame(G);
  // The next job opens after a breath.
  m.nextTimer = 2.5;
}

function failMission(G, reason) {
  G.hud.banner(reason, '#ff5a5a');
  G.audio.missionFail();
  startMission(G, G.mission.index);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.done) {
    m.nextTimer = (m.nextTimer || 0) - dt;
    if (m.nextTimer <= 0) {
      if (m.index + 1 < MISSIONS.length) startMission(G, m.index + 1);
      else {
        m.index = MISSIONS.length;
        G.state = 'complete';
        G.audio.missionDone();
        G.save.saveGame(G);
      }
    }
    return;
  }
  if (m.index >= MISSIONS.length) return;
  const p = G.player;
  const places = G.world.places;

  if (m.index === 0) {
    if (m.step === 0 && p.driving) {
      m.step = 1;
      G.hud.setObjective('Drive to Rex’s Garage on Coral Row');
    } else if (m.step === 1 && reach(G, places.garage, 60)) {
      completeMission(G);
    }
  } else if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'TOO SLOW — DELIA FOUND ANOTHER DRIVER'); return; }
    const stops = [places.courierA, places.courierB, places.courierC];
    const s = stops[Math.min(m.step, 2)];
    if (reach(G, s, 52)) {
      G.player.cash += 50;
      G.floaters.push({ x: p.x, y: p.y - 30, text: '+$50 drop', life: 1.2, color: '#7ae8a0' });
      G.audio.pickup();
      m.step += 1;
      if (m.step >= 3) completeMission(G);
    }
  } else if (m.index === 2) {
    if (m.step === 0) {
      m.timer -= dt;
      if (G.wanted.level === 0) {
        m.step = 1;
        G.hud.setObjective('Heat’s off. Get to the Safehouse');
      } else if (m.timer <= 0) {
        m.step = 1;
        G.hud.setObjective('Time’s up — get to the Safehouse, heat or not');
      }
    } else if (reach(G, places.safehouse, 60)) {
      completeMission(G);
    }
  } else if (m.index === 3) {
    if (m.step === 0 && reach(G, places.dealSpot, 70)) {
      m.step = 1;
      G.hud.setObjective('Defend the deal — take down the rival crew');
      const spots = [
        { x: places.dealSpot.x - 120, y: places.dealSpot.y - 60 },
        { x: places.dealSpot.x + 130, y: places.dealSpot.y - 40 },
        { x: places.dealSpot.x - 90, y: places.dealSpot.y + 110 },
        { x: places.dealSpot.x + 100, y: places.dealSpot.y + 120 },
      ];
      for (const s of spots) G.combat.spawnEnemy(G, s.x, s.y);
      G.combat.spawnPickup(G, places.dealSpot.x - 40, places.dealSpot.y + 40, 'ammo');
      G.audio.missionStart();
    } else if (m.step === 1) {
      if (G.enemies.filter((e) => e.down <= 0).length === 0) {
        m.step = 2;
        G.hud.setObjective('Get Marco to the Safehouse — drive, don’t walk');
        G.hud.banner('CREW DOWN — MOVE MARCO', '#7ae8a0');
      }
    } else if (m.step === 2 && p.driving && reach(G, places.safehouse, 60)) {
      completeMission(G);
    }
  } else if (m.index === 4) {
    if (m.step === 0 && reach(G, places.bank, 70)) {
      m.step = 1;
      m.hold = CFG.missions.bankHold;
      G.wanted.points = Math.max(G.wanted.points, CFG.wanted.pointsPerLevel[3]);
      G.wanted.level = 3;
      G.hud.setObjective('Crack the vault — hold position');
      G.hud.banner('ALARM TRIPPED — 3 STARS', '#ff5a5a');
      G.audio.sirenBurst();
    } else if (m.step === 1) {
      if (reach(G, places.bank, 70)) {
        m.hold -= dt;
        if (m.hold <= 0) {
          m.step = 2;
          G.hud.setObjective('Run! Get to the Safehouse with the money');
          G.hud.banner('VAULT CRACKED — RUN', '#ffd23c');
        }
      } else {
        m.hold = CFG.missions.bankHold;
      }
    } else if (m.step === 2 && reach(G, places.safehouse, 60)) {
      completeMission(G);
    }
  }
}

// Called by combat when an enemy goes down; the deal mission watches the count.
export function onEnemyDown(G, enemy) {
  if (G.mission.index === 3 && G.mission.step === 1) {
    const left = G.enemies.filter((e) => e.down <= 0).length;
    if (left === 0) G.hud.banner('CREW DOWN — MOVE MARCO', '#7ae8a0');
  }
}
