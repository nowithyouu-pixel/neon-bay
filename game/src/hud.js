// The HUD and the menus: health, cash, wanted stars, the live minimap, the
// mission objective, speed and clock — plus the title, pause, busted, wasted
// and story-complete screens, all drawn on the same canvas and clicked with
// the same mouse. Buttons register themselves while drawing so a click can
// find the one under the cursor.
import { CFG } from './config.js';
import { clamp } from './random.js';

export function createHud() {
  const hud = {
    bannerText: '', bannerColor: '#ffd23c', bannerT: 0,
    objectiveNote: '', objectiveNoteT: 0,
    savedFlash: 0,
    buttons: [],
    banner(text, color) {
      hud.bannerText = text;
      hud.bannerColor = color || '#ffd23c';
      hud.bannerT = 2.6;
    },
    setObjective(text) {
      hud.objectiveNote = text;
      hud.objectiveNoteT = 5;
    },
    flashSaved() { hud.savedFlash = 2.2; },
  };
  return hud;
}

function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function districtName(G) {
  const p = G.player;
  const d = G.world.districtAt(p.x, p.y);
  if (G.world.isWaterAt(p.x, p.y)) return 'Neon Bay';
  return d ? d.name : 'Neon Bay';
}

function dayPart(minutes) {
  const h = minutes / 60;
  if (h >= 6 && h < 12) return 'MORNING';
  if (h >= 12 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 19) return 'SUNSET';
  return 'NIGHT';
}

export function drawHud(G) {
  const ctx = G.ctx;
  const p = G.player;
  const W = G.viewW, H = G.viewH;
  if (G.hud.bannerT > 0) G.hud.bannerT -= G.lastDt;
  if (G.hud.objectiveNoteT > 0) G.hud.objectiveNoteT -= G.lastDt;
  if (G.hud.savedFlash > 0) G.hud.savedFlash -= G.lastDt;

  // --- Top-left: health, cash, ammo ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(10,12,20,0.55)';
  roundRect(ctx, 14, 12, 250, 74, 10); ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('REX MARLOWE', 26, 32);
  // Health bar.
  ctx.fillStyle = '#3a1518';
  ctx.fillRect(26, 40, 150, 12);
  const hpFrac = clamp(p.health / CFG.player.maxHealth, 0, 1);
  ctx.fillStyle = hpFrac > 0.5 ? '#5ec95e' : hpFrac > 0.25 ? '#e8b23c' : '#e5484d';
  ctx.fillRect(26, 40, 150 * hpFrac, 12);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 182, 51);
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#7ae8a0';
  ctx.fillText(fmtCash(p.cash), 26, 76);
  if (p.hasPistol) {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`PISTOL  ${p.ammo} rounds`, 130, 76);
  }

  // --- Top-right: wanted stars ---
  const stars = G.wanted.level;
  ctx.fillStyle = 'rgba(10,12,20,0.55)';
  roundRect(ctx, W - 218, 12, 204, 44, 10); ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#c9ced8';
  ctx.fillText('WANTED', W - 206, 41);
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, W - 132 + i * 26, 33, 11, i < stars ? '#ffd23c' : 'rgba(255,255,255,0.22)');
  }

  // --- Top-centre: objective ---
  const objective = G.missions.objectiveText(G);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(objective).width + 28;
  ctx.fillStyle = 'rgba(10,12,20,0.6)';
  roundRect(ctx, (W - ow) / 2, 12, ow, 34, 10); ctx.fill();
  ctx.fillStyle = '#ffd23c';
  ctx.textAlign = 'center';
  ctx.fillText(objective, W / 2, 35);
  ctx.textAlign = 'left';
  if (G.hud.objectiveNoteT > 0) {
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#c9ced8';
    ctx.textAlign = 'center';
    ctx.fillText(G.hud.objectiveNote, W / 2, 62);
    ctx.textAlign = 'left';
  }

  // --- Mission banner, big and centred ---
  if (G.hud.bannerT > 0) {
    const a = clamp(G.hud.bannerT, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = G.hud.bannerColor;
    ctx.fillText(G.hud.bannerText, W / 2, 130);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // --- Bottom-left: speed, clock, district ---
  ctx.fillStyle = 'rgba(10,12,20,0.55)';
  roundRect(ctx, 14, H - 64, 272, 50, 10); ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 16px system-ui, sans-serif';
  if (p.driving) {
    const kmh = Math.round(Math.abs(p.driving.speed) * 0.36);
    ctx.fillText(`${kmh} km/h`, 26, H - 40);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#c9ced8';
    ctx.fillText(p.driving.wrecked ? 'WRECKED — press E to leave' : 'E exit   SPACE handbrake', 96, H - 40);
  } else {
    ctx.fillText('ON FOOT', 26, H - 40);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#c9ced8';
    ctx.fillText('E enter car   F punch', 106, H - 40);
  }
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`${fmtClock(G.time)}  •  ${districtName(G)}  •  ${dayPart(G.time)}`, 26, H - 22);

  // --- Saved indicator ---
  if (G.hud.savedFlash > 0) {
    ctx.globalAlpha = clamp(G.hud.savedFlash, 0, 1);
    ctx.fillStyle = '#7ae8a0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓ SAVED', W / 2, H - 22);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawMinimap(G);
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(G) {
  const ctx = G.ctx;
  const w = 196, h = 158;
  const x0 = G.viewW - w - 14, y0 = G.viewH - h - 14;
  const scale = w / G.world.size;
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  roundRect(ctx, x0 - 4, y0 - 4, w + 8, h + 8, 10); ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  // Water and land.
  ctx.fillStyle = '#2f6f9e';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(x0, y0, (CFG.world.waterX) * scale, h);
  // Roads.
  ctx.strokeStyle = '#6a707c';
  ctx.lineWidth = 2;
  for (const rx of G.world.roadXs) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * scale, y0); ctx.lineTo(x0 + rx * scale, y0 + h); ctx.stroke();
  }
  for (const ry of G.world.roadYs) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * scale); ctx.lineTo(x0 + w, y0 + ry * scale); ctx.stroke();
  }
  // Mission target.
  const target = G.missions.currentTarget(G);
  if (target) {
    const pulse = 3 + Math.sin(G.elapsed * 5) * 1.5;
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(x0 + target.x * scale, y0 + target.y * scale, pulse + 2, 0, Math.PI * 2); ctx.fill();
  }
  // Cars, cops, player.
  for (const car of G.cars) {
    ctx.fillStyle = car.driver === 'cop' ? '#3b82ff' : car.driver === 'player' ? '#7ae8a0' : '#c9ced8';
    ctx.fillRect(x0 + car.x * scale - 1.5, y0 + car.y * scale - 1.5, 3, 3);
  }
  for (const cop of G.cops) {
    ctx.fillStyle = '#3b82ff';
    ctx.fillRect(x0 + cop.x * scale - 1.5, y0 + cop.y * scale - 1.5, 3, 3);
  }
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + px * scale, y0 + py * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3fae6a';
  ctx.beginPath();
  ctx.arc(x0 + px * scale, y0 + py * scale, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c9ced8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('NEON BAY', x0 + 2, y0 + h - 4);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Menus ---

function drawButton(G, x, y, w, h, label, action, primary) {
  const ctx = G.ctx;
  ctx.fillStyle = primary ? '#ffd23c' : 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = primary ? '#1a1a1a' : '#e8e8e8';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  ctx.textAlign = 'left';
  G.hud.buttons.push({ x, y, w, h, action });
}

export function drawMenu(G) {
  const ctx = G.ctx;
  const W = G.viewW, H = G.viewH;
  G.hud.buttons = [];
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.fillRect(0, 0, W, H);

  if (G.state === 'title') {
    // Sunset gradient strip behind the title.
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#ff7a3c');
    grad.addColorStop(0.5, '#ff3c7a');
    grad.addColorStop(1, '#3c7aff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H / 2 - 168, W, 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('NEON BAY', W / 2, H / 2 - 84);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('A sun-soaked open-world crime story', W / 2, H / 2 - 44);
    ctx.fillStyle = '#c9ced8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Rex Marlowe is back in Neon Bay with nothing but a grudge and a fast pair of legs.', W / 2, H / 2 + 8);
    ctx.fillText('Steal cars, lose the cops, run five jobs — and take the Marina Heights Bank.', W / 2, H / 2 + 32);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#8b93a3';
    ctx.fillText('WASD move  •  E enter / exit car  •  F punch  •  Mouse aim, click to shoot  •  SPACE handbrake', W / 2, H / 2 + 72);
    ctx.fillText('SHIFT run  •  ESC pause  •  M mute  •  Progress saves automatically', W / 2, H / 2 + 96);
    ctx.textAlign = 'left';
    const bw = 260, bh = 52;
    drawButton(G, W / 2 - bw - 10, H / 2 + 128, bw, bh, G.save.hasSave() ? 'CONTINUE' : 'START STORY', 'start', true);
    drawButton(G, W / 2 + 10, H / 2 + 128, bw, bh, 'FREE ROAM', 'freeroam', false);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b93a3';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('An original game. No real city, no real people, no borrowed names.', W / 2, H - 24);
    ctx.textAlign = 'left';
  } else if (G.state === 'paused') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2 - 60);
    ctx.fillStyle = '#c9ced8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Neon Bay waits for no one — except right now.', W / 2, H / 2 - 20);
    ctx.textAlign = 'left';
    drawButton(G, W / 2 - 130, H / 2 + 10, 260, 50, 'RESUME', 'resume', true);
    drawButton(G, W / 2 - 130, H / 2 + 72, 260, 50, 'QUIT TO TITLE', 'quit', false);
  } else if (G.state === 'busted') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3b82ff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('BUSTED', W / 2, H / 2 - 60);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`The NBPD took $${G.bustedFine || 0} off you and dropped you at the safehouse.`, W / 2, H / 2 - 14);
    ctx.textAlign = 'left';
    drawButton(G, W / 2 - 160, H / 2 + 24, 320, 52, 'BACK ON THE STREET', 'resume', true);
  } else if (G.state === 'wasted') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('WASTED', W / 2, H / 2 - 60);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Rex went down. The city keeps moving without him.', W / 2, H / 2 - 14);
    ctx.textAlign = 'left';
    drawButton(G, W / 2 - 160, H / 2 + 24, 320, 52, 'TRY AGAIN (FROM SAVE)', 'restart', true);
  } else if (G.state === 'complete') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.fillText('THE BIG SCORE', W / 2, H / 2 - 70);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(`The bank is empty, the cops are lost, and Rex walks away with $${G.player.cash.toLocaleString('en-US')}.`, W / 2, H / 2 - 24);
    ctx.fillText('Story complete — Neon Bay is yours to roam.', W / 2, H / 2 + 6);
    ctx.textAlign = 'left';
    drawButton(G, W / 2 - 160, H / 2 + 40, 320, 52, 'KEEP ROAMING', 'resume', true);
  }
}

// Returns the action of the button under (x, y), or null.
export function menuClick(G, x, y) {
  for (const b of G.hud.buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.action;
  }
  return null;
}
