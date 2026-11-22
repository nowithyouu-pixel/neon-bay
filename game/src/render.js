// Drawing only: game state in, pixels out. A top-down camera follows Rex,
// the city draws in layers (ground, roads, parks, beach, buildings, then
// everything that moves), and a time-of-day tint warms the sunset and cools
// the night. Nothing here changes state — it only reads it.
import { CFG } from './config.js';
import { clamp, lerp } from './random.js';
import { shade } from './world.js';

export function updateCamera(G, dt) {
  const cam = G.camera;
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  const zoom = p.driving ? CFG.camera.driveZoom : CFG.camera.footZoom;
  cam.zoom = lerp(cam.zoom, zoom, clamp(2 * dt, 0, 1));
  const vw = G.viewW / cam.zoom, vh = G.viewH / cam.zoom;
  const tx = clamp(px - vw / 2, 0, Math.max(0, G.world.size - vw));
  const ty = clamp(py - vh / 2, 0, Math.max(0, G.world.size - vh));
  const k = 1 - Math.exp(-CFG.camera.lerp * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

export function render(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, G.viewW, G.viewH);
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawGround(G, ctx);
  drawMissionMarker(G, ctx);
  drawPickups(G, ctx);
  drawCars(G, ctx);
  drawPeds(G, ctx);
  drawCops(G, ctx);
  drawEnemies(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);
  drawHeli(G, ctx);
  drawLighting(G, ctx);
  ctx.restore();
  drawWaypointArrow(G, ctx);
}

function drawGround(G, ctx) {
  const w = G.world;
  const size = w.size;
  // Base: dry grass and dirt lots between the blocks.
  ctx.fillStyle = '#7d8f5a';
  ctx.fillRect(0, 0, size, size);
  // Beach sand, then the bay itself.
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(CFG.world.beachX, 0, CFG.world.waterX - CFG.world.beachX, size);
  ctx.fillStyle = '#2f6f9e';
  ctx.fillRect(CFG.world.waterX, 0, size - CFG.world.waterX, size);
  // Gentle wave lines on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = 60; y < size; y += 130) {
    ctx.beginPath();
    for (let x = CFG.world.waterX + 12; x < size - 10; x += 46) {
      ctx.moveTo(x, y + Math.sin((x + G.elapsed * 22) * 0.02) * 4);
      ctx.lineTo(x + 22, y + Math.sin((x + 22 + G.elapsed * 22) * 0.02) * 4);
    }
    ctx.stroke();
  }
  // Beach umbrellas.
  for (const u of w.umbrellas) {
    ctx.fillStyle = u.color;
    ctx.beginPath(); ctx.arc(u.x, u.y, 12, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#8a6f4d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x, u.y + 12); ctx.stroke();
  }
  // City blocks read through the sidewalk rims and the road grid below.
  // Roads: asphalt ribbons with dashed centre lines.
  ctx.fillStyle = '#3a3f47';
  for (const rx of w.roadXs) ctx.fillRect(rx - CFG.world.roadWidth / 2, 0, CFG.world.roadWidth, size);
  for (const ry of w.roadYs) ctx.fillRect(0, ry - CFG.world.roadWidth / 2, size, CFG.world.roadWidth);
  ctx.strokeStyle = '#d8c95a';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of w.roadXs) { ctx.moveTo(rx, 0); ctx.lineTo(rx, size); }
  for (const ry of w.roadYs) { ctx.moveTo(0, ry); ctx.lineTo(size, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalk rims around each block.
  ctx.strokeStyle = '#b9bec6';
  ctx.lineWidth = 3;
  for (let i = 0; i < w.roadXs.length; i++) {
    for (let j = 0; j < w.roadYs.length; j++) {
      const x0 = w.roadXs[i] + CFG.world.roadWidth / 2;
      const x1 = (i + 1 < w.roadXs.length ? w.roadXs[i + 1] : CFG.world.beachX) - CFG.world.roadWidth / 2;
      const y0 = w.roadYs[j] + CFG.world.roadWidth / 2;
      const y1 = (j + 1 < w.roadYs.length ? w.roadYs[j + 1] : size) - CFG.world.roadWidth / 2;
      if (x1 - x0 < 40 || y1 - y0 < 40) continue;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Parks: lawn, pond, trees.
  for (const park of w.parks) {
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (park.pond) {
      ctx.fillStyle = '#4a90c2';
      ctx.beginPath();
      ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, park.w / 4, park.h / 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const t of w.trees) {
    ctx.fillStyle = '#3f7038';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#548c46';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // Empty lots: cracked asphalt with parking bays.
  ctx.fillStyle = '#55585e';
  for (const lot of w.lots) {
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 34; x < lot.x + lot.w - 20; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, lot.y + 8); ctx.lineTo(x, lot.y + 30); ctx.stroke();
    }
  }
  // Marina piers.
  ctx.fillStyle = '#8a6f4d';
  for (const pier of w.piers) ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  // Buildings: shaded south-east face for height, roof, windows, door.
  for (const b of w.buildings) {
    const h = b.height * 5;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + h, b.y + h, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.windows && b.w > 40 && b.h > 40) {
      ctx.fillStyle = 'rgba(255,244,180,0.75)';
      const cols = Math.floor((b.w - 16) / 22), rows = Math.floor((b.h - 16) / 22);
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if ((cx + cy * 2) % 3 === 0) continue; // a third of the windows stay dark
          ctx.fillRect(b.x + 10 + cx * 22, b.y + 10 + cy * 22, 10, 12);
        }
      }
    }
    ctx.fillStyle = shade(b.color, -50);
    ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h - 4, 12, 6);
  }
}

function drawMissionMarker(G, ctx) {
  const target = G.missions.currentTarget(G);
  if (!target) return;
  const pulse = 1 + Math.sin(G.elapsed * 5) * 0.12;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,60,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  // A light beam so the marker reads from across the block.
  ctx.fillStyle = 'rgba(255,210,60,0.10)';
  ctx.fillRect(-7, -260, 14, 260);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(target.label, 0, -44);
  ctx.restore();
}

function drawPickups(G, ctx) {
  for (const pk of G.pickups) {
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'ammo') {
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#ffd23c';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#2b2f38';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', 0, 4);
    } else {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    }
    ctx.restore();
  }
}

function drawCarShape(G, ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.len, wid = car.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Roof and glass.
  ctx.fillStyle = car.wrecked ? '#2c2c2c' : shade(car.color, -26);
  roundRect(ctx, -len / 6, -wid / 2 + 3, len / 3, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(len / 4, -wid / 2 + 4, 5, wid - 8);
  ctx.fillRect(-len / 4 - 5, -wid / 2 + 4, 5, wid - 8);
  // Cop livery: white doors and a light bar.
  if (car.type === 'cop') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-len / 6, -wid / 2 + 2, len / 3, wid - 4);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NBPD', 0, 3);
    const blink = Math.floor(G.elapsed * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-4, -wid / 2 - 2, 8, 4);
    ctx.fillStyle = blink ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-4, wid / 2 - 2, 8, 4);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(-len / 6, -wid / 2 + 2, len / 3, 5);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -wid / 2 + 10);
  }
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c2';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2d2d' : '#a33';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 3, 3, 5);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 8, 3, 5);
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, -len / 2 - 5, -wid / 2 - 5, len + 10, wid + 10, 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
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

function drawCars(G, ctx) {
  for (const car of G.cars) {
    drawCarShape(G, ctx, car, G.player.driving === car);
  }
}

function drawPerson(G, ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.down) {
    // Lying flat.
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8b58a';
    ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  // Shadow, body, head, and a swinging arm while punching.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8b58a';
  ctx.beginPath(); ctx.arc(9, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2f38';
  ctx.beginPath(); ctx.arc(10, -2, 6, Math.PI, Math.PI * 2); ctx.fill();
  if (opts.punch > 0) {
    ctx.strokeStyle = '#d8b58a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(26, 0); ctx.stroke();
  }
  if (opts.flash > 0) {
    ctx.strokeStyle = 'rgba(255,60,60,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.driving) return; // the car drawing carries him
  if (p.invulnerable > 0 && Math.floor(G.elapsed * 12) % 2 === 0) return; // hurt blink
  drawPerson(G, ctx, p.x, p.y, p.angle, '#3fae6a', {
    punch: p.punchAnim, flash: p.hurtFlash,
    bob: Math.sin(G.elapsed * 9) * 1.5,
  });
  // Pistol in hand when armed.
  if (p.hasPistol && p.ammo > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 12, 4);
    ctx.restore();
  }
}

function drawPeds(G, ctx) {
  for (const ped of G.peds) {
    drawPerson(G, ctx, ped.x, ped.y, ped.angle, ped.color, {
      down: ped.state === 'down',
      bob: Math.sin(ped.walkPhase) * 1.5,
    });
  }
}

function drawCops(G, ctx) {
  for (const cop of G.cops) {
    if (cop.down > 0) {
      drawPerson(G, ctx, cop.x, cop.y, cop.angle, '#1c2733', { down: true });
      continue;
    }
    drawPerson(G, ctx, cop.x, cop.y, cop.angle, '#274b8f', {});
    // Cap brim and badge.
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#101c2e';
    ctx.fillRect(6, -7, 8, 14);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(-4, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    // Arrest progress ring while closing in.
    if (cop.arrest > 0) {
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + (cop.arrest / CFG.police.arrestHold) * Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEnemies(G, ctx) {
  for (const e of G.enemies) {
    if (e.down > 0) {
      drawPerson(G, ctx, e.x, e.y, e.angle, '#8a2f2f', { down: true });
      continue;
    }
    drawPerson(G, ctx, e.x, e.y, e.angle, e.hitFlash > 0 ? '#ff8a8a' : '#a33327', {});
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 13, 4);
    ctx.restore();
  }
}

function drawBullets(G, ctx) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2.5;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(G, ctx) {
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.max, 0, 1);
    if (pt.smoke) {
      ctx.fillStyle = `rgba(90,90,90,${a * 0.55})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
    } else if (pt.flash) {
      ctx.fillStyle = `rgba(255,233,168,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a + 4, 0, Math.PI * 2); ctx.fill();
    } else if (pt.ring) {
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }
  }
  // Floating score text.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}

function drawHeli(G, ctx) {
  if (!G.heli.active) return;
  const h = G.heli;
  // Spotlight on the ground, tracking the player.
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  const grad = ctx.createRadialGradient(px, py, 10, px, py, 150);
  grad.addColorStop(0, 'rgba(255,250,200,0.30)');
  grad.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(px, py, 150, 0, Math.PI * 2); ctx.fill();
  // The helicopter itself, hovering just north of the spotlight so it never
  // covers the player it is hunting.
  const hx = h.x, hy = h.y - 130;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(hx + 26, hy + 30, 26, 12, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(G.elapsed * 0.4);
  ctx.fillStyle = '#222';
  ctx.fillRect(-30, -2, 60, 4);
  ctx.rotate(-G.elapsed * 0.4);
  ctx.fillStyle = '#3a3f47';
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7ab8e8';
  ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Time-of-day tint: noon is clear, sunset goes amber, night goes deep blue.
function drawLighting(G, ctx) {
  const mins = G.time % (24 * 60);
  let color = null, alpha = 0;
  if (mins >= 17 * 60 && mins < 19 * 60) { color = '255,140,60'; alpha = 0.16; }
  else if (mins >= 19 * 60 || mins < 6 * 60) { color = '20,30,80'; alpha = 0.30; }
  else if (mins >= 6 * 60 && mins < 8 * 60) { color = '255,180,120'; alpha = 0.10; }
  if (!color) return;
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(G.camera.x - 10, G.camera.y - 10, G.viewW / G.camera.zoom + 20, G.viewH / G.camera.zoom + 20);
}

// An arrow at the screen edge pointing at the mission target, with distance.
function drawWaypointArrow(G, ctx) {
  const target = G.missions.currentTarget(G);
  if (!target) return;
  const cam = G.camera;
  const sx = (target.x - cam.x) * cam.zoom;
  const sy = (target.y - cam.y) * cam.zoom;
  if (sx > 40 && sx < G.viewW - 40 && sy > 40 && sy < G.viewH - 40) return; // on screen already
  const cx = G.viewW / 2, cy = G.viewH / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ax = cx + Math.cos(ang) * (Math.min(G.viewW, G.viewH) / 2 - 70);
  const ay = cy + Math.sin(ang) * (Math.min(G.viewW, G.viewH) / 2 - 70);
  const p = G.player;
  const px = p.driving ? p.driving.x : p.x;
  const py = p.driving ? p.driving.y : p.y;
  const dist = Math.round(Math.hypot(target.x - px, target.y - py));
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
  ctx.closePath(); ctx.fill();
  ctx.rotate(-ang);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${dist}m`, 0, 30);
  ctx.restore();
}
