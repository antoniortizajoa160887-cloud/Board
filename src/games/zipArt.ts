/** Canvas drawing for Zip: the otter, enemies, tiles and the parallax lagoon backgrounds. */
import type { Enemy, Player, World } from '../core/platformer';

export interface Theme { sky: [string, string, string]; orb: string; orbR: number; rock: string; rockTop: string; far: string; water: string; stars: boolean }

export const THEMES: Theme[] = [
  { sky: ['#2b1450', '#c2427a', '#ffb35c'], orb: '#ffd47a', orbR: 1.6, rock: '#3a2347', rockTop: '#ff9f6b', far: '#5a2457', water: '#7a2f63', stars: false },
  { sky: ['#0b2a4a', '#1c6e8c', '#5fd3c4'], orb: '#fff1c1', orbR: 1.2, rock: '#1d3550', rockTop: '#ff7a8a', far: '#174260', water: '#1a5a74', stars: false },
  { sky: ['#160f3a', '#3b1f6e', '#7a3aa8'], orb: '#e9d8ff', orbR: 1.1, rock: '#2a1f4f', rockTop: '#c48bff', far: '#2e2160', water: '#3c2a7a', stars: true },
  { sky: ['#06263a', '#0c4f5e', '#23a08f'], orb: '#ffe9a8', orbR: 1.3, rock: '#14363f', rockTop: '#2ef2d0', far: '#0f3f4a', water: '#136070', stars: false },
  { sky: ['#050a22', '#0f1a48', '#273a7a'], orb: '#f4f0d0', orbR: 1.4, rock: '#1a2140', rockTop: '#f5c542', far: '#141c3c', water: '#1c2a5a', stars: true },
  { sky: ['#0a0420', '#2a0b4a', '#5a127a'], orb: '#ff6bd5', orbR: 1.2, rock: '#22103a', rockTop: '#2ef2d0', far: '#2b0f48', water: '#3d1466', stars: true },
];

const rand = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

/** Sky, orb, stars, far islands with palms, and a shimmering water band. camX in tiles, s = px per tile. */
export function drawBackground(ctx: CanvasRenderingContext2D, th: Theme, camX: number, s: number, W: number, H: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (th.stars) {
    for (let i = 0; i < 70; i++) {
      const x = ((rand(i) * W * 2 - camX * s * 0.05) % W + W) % W, y = rand(i + 99) * H * 0.55;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // Sun or moon with a glow.
  const ox = W * 0.72 - camX * s * 0.03, oy = H * 0.28, r = th.orbR * s;
  const og = ctx.createRadialGradient(ox, oy, r * 0.2, ox, oy, r * 3);
  og.addColorStop(0, th.orb); og.addColorStop(0.3, th.orb + '88'); og.addColorStop(1, th.orb + '00');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(ox, oy, r * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = th.orb; ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
  // Far islands with palms (slow parallax).
  const horizon = H * 0.62;
  ctx.fillStyle = th.far;
  const span = W * 1.6, off = -((camX * s * 0.25) % span);
  for (let k = -1; k < 3; k++) {
    const bx = off + k * span;
    ctx.beginPath(); ctx.moveTo(bx, horizon);
    ctx.quadraticCurveTo(bx + span * 0.15, horizon - s * 2.2, bx + span * 0.3, horizon);
    ctx.quadraticCurveTo(bx + span * 0.55, horizon - s * 1.2, bx + span * 0.75, horizon);
    ctx.lineTo(bx, horizon); ctx.fill();
    palm(ctx, bx + span * 0.13, horizon - s * 1.9, s * 0.9, t + k);
    palm(ctx, bx + span * 0.2, horizon - s * 1.5, s * 0.7, t + k + 1);
    palm(ctx, bx + span * 0.6, horizon - s * 1.0, s * 0.8, t + k + 2);
  }
  // Water band with moving glints.
  ctx.fillStyle = th.water; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = th.orb + '55'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = horizon + 6 + rand(i + 7) * (H - horizon);
    const x = ((rand(i + 3) * W * 1.5 - camX * s * 0.5 + Math.sin(t + i) * 10) % W + W) % W;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 + rand(i) * 30, y); ctx.stroke();
  }
}

function palm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.2, -s, s * 0.05, -s * 1.8); ctx.stroke();
  ctx.translate(s * 0.05, -s * 1.8);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 1.3 + i) * 0.05;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6 - s * 0.2, Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1 + s * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws every tile in view. */
export function drawTiles(ctx: CanvasRenderingContext2D, wd: World, th: Theme, camX: number, s: number, W: number, t: number, flagOn: (x: number, y: number) => boolean) {
  const x0 = Math.max(0, Math.floor(camX) - 1), x1 = Math.min(wd.w, Math.ceil(camX + W / s) + 1);
  for (let y = 0; y < wd.h; y++) for (let x = x0; x < x1; x++) {
    const c = wd.tiles[y][x];
    if (c === ' ') continue;
    const px = (x - camX) * s, py = y * s;
    switch (c) {
      case '#': {
        ctx.fillStyle = th.rock; ctx.fillRect(px, py, s + 1, s + 1);
        ctx.fillStyle = '#ffffff10';
        ctx.fillRect(px + s * 0.15, py + s * 0.35, s * 0.25, s * 0.18);
        ctx.fillRect(px + s * 0.55, py + s * 0.7, s * 0.3, s * 0.15);
        if (wd.tiles[y - 1]?.[x] !== '#') {
          ctx.fillStyle = th.rockTop; ctx.fillRect(px, py, s + 1, s * 0.18);
          ctx.fillStyle = '#ffffff55'; ctx.fillRect(px, py, s + 1, s * 0.05);
          ctx.shadowColor = th.rockTop; ctx.shadowBlur = 8; ctx.fillStyle = th.rockTop; ctx.fillRect(px, py, s + 1, 1); ctx.shadowBlur = 0;
        }
        break;
      }
      case '=': {
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px, py, s + 1, s * 0.28);
        ctx.fillStyle = '#c08446'; ctx.fillRect(px, py, s + 1, s * 0.08);
        ctx.fillStyle = '#5a3818'; ctx.fillRect(px + s * 0.48, py, 2, s * 0.28);
        break;
      }
      case '^': {
        ctx.fillStyle = '#ff5a7a';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.moveTo(px + k * s / 3, py + s); ctx.lineTo(px + (k + 0.5) * s / 3, py + s * 0.42); ctx.lineTo(px + (k + 1) * s / 3, py + s); ctx.fill();
        }
        ctx.fillStyle = '#ffd0da';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(px + (k + 0.5) * s / 3, py + s * 0.47, s * 0.04, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'o': pearl(ctx, px + s / 2, py + s / 2 + Math.sin(t * 3 + x) * s * 0.06, s * 0.22, t + x); break;
      case '?': case '!': {
        const used = c === '!';
        const g = ctx.createLinearGradient(px, py, px, py + s);
        g.addColorStop(0, used ? '#6b5a3a' : '#ffe08a'); g.addColorStop(1, used ? '#3d321f' : '#d99a1e');
        ctx.fillStyle = g; roundRect(ctx, px + 1, py + 1, s - 2, s - 2, s * 0.12); ctx.fill();
        ctx.strokeStyle = used ? '#2a2216' : '#7a4a00'; ctx.lineWidth = 2; ctx.stroke();
        if (!used) {
          ctx.fillStyle = '#7a4a00'; ctx.font = `900 ${s * 0.6}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('?', px + s / 2, py + s * 0.55 + Math.sin(t * 4) * 1.5);
        }
        break;
      }
      case 'B': {
        const sq = (wd.springT.get(`${x},${y}`) ?? 0) > 0.15 ? 0.25 : 0;
        ctx.strokeStyle = '#f5c542'; ctx.lineWidth = s * 0.07;
        ctx.beginPath();
        for (let k = 0; k <= 4; k++) { const yy = py + s - s * 0.1 - k * s * (0.1 + (0.25 - sq) * 0.2); ctx.lineTo(px + s * (k % 2 ? 0.25 : 0.75), yy); }
        ctx.stroke();
        ctx.fillStyle = '#ff6b81'; roundRect(ctx, px + s * 0.1, py + s * (0.42 + sq), s * 0.8, s * 0.16, s * 0.08); ctx.fill();
        break;
      }
      case 'F': {
        const on = flagOn(x, y);
        ctx.fillStyle = '#cfd6e6'; ctx.fillRect(px + s * 0.3, py - s, s * 0.08, s * 2);
        ctx.fillStyle = on ? '#2ef2d0' : '#6b7593';
        ctx.beginPath(); ctx.moveTo(px + s * 0.38, py - s); ctx.quadraticCurveTo(px + s * 0.75, py - s * 0.85 + Math.sin(t * 6) * s * 0.08, px + s * 1.0, py - s * 0.7); ctx.lineTo(px + s * 0.38, py - s * 0.45); ctx.fill();
        if (on) { ctx.shadowColor = '#2ef2d0'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0; }
        break;
      }
      case 'G': shellGate(ctx, px + s / 2, py + s, s, t); break;
    }
  }
}

export function pearl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const sx = 0.75 + 0.25 * Math.abs(Math.cos(t * 2));
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  ctx.shadowColor = '#bff8ff'; ctx.shadowBlur = 10;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#e6f0ff'); g.addColorStop(1, '#a9b7e8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function shellGate(ctx: CanvasRenderingContext2D, cx: number, by: number, s: number, t: number) {
  ctx.save(); ctx.translate(cx, by);
  const glow = 14 + Math.sin(t * 3) * 6;
  ctx.shadowColor = '#f5c542'; ctx.shadowBlur = glow;
  const g = ctx.createLinearGradient(0, -s * 2.4, 0, 0);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#f5c542'); g.addColorStop(1, '#b07a12');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-s * 0.25, 0);
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    ctx.lineTo(Math.cos(a) * s * 1.15, -s * 1.1 + Math.sin(a) * s * 1.2 + (i % 2 ? s * 0.08 : 0));
  }
  ctx.lineTo(s * 0.25, 0); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a06a0a'; ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.lineTo(Math.cos(a) * s * 1.05, -s * 1.1 + Math.sin(a) * s * 1.1); ctx.stroke();
  }
  pearl(ctx, 0, -s * 1.15, s * 0.3, t);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Zip the otter: teal fur, orange scarf, red jet sneakers. (x, y) = feet centre in px. */
export function drawZip(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, s: number, t: number) {
  if (p.hurtT > 0 && Math.floor(t * 14) % 2 === 0) return;
  const moving = Math.abs(p.vx) > 0.5;
  const air = !p.onGround;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing * (1 + p.landT * 0.2), 1 - p.landT * 0.22);
  const k = s * 0.9;
  const ph = p.runPhase * Math.PI;
  // Jet flames.
  if (p.jetT > 0) {
    for (const fx of [-0.14, 0.12]) {
      const len = k * (0.35 + Math.random() * 0.2) * (p.jetT / 0.35 + 0.3);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.4, '#ff8a2a'); g.addColorStop(1, '#ff3b3b00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx * k - k * 0.07, 0); ctx.lineTo(fx * k, len); ctx.lineTo(fx * k + k * 0.07, 0); ctx.fill();
    }
  }
  // Tail.
  ctx.fillStyle = '#138c80';
  ctx.beginPath(); ctx.ellipse(-k * 0.42, -k * 0.3 + Math.sin(t * 8) * k * 0.03, k * 0.28, k * 0.09, -0.5 + (moving ? Math.sin(ph) * 0.2 : 0), 0, Math.PI * 2); ctx.fill();
  // Legs with sneakers.
  const legs = air ? [[-0.12, -0.05], [0.14, -0.12]] : moving ? [[-0.12 + Math.sin(ph) * 0.12, -Math.max(0, Math.cos(ph)) * 0.08], [0.12 - Math.sin(ph) * 0.12, -Math.max(0, -Math.cos(ph)) * 0.08]] : [[-0.13, 0], [0.13, 0]];
  for (const [lx, ly] of legs) {
    ctx.fillStyle = '#138c80'; ctx.fillRect((lx - 0.05) * k, (ly - 0.22) * k, 0.1 * k, 0.2 * k);
    ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.ellipse((lx + 0.04) * k, (ly - 0.05) * k, 0.12 * k, 0.07 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect((lx - 0.07) * k, (ly - 0.01) * k, 0.23 * k, 0.025 * k);
  }
  // Body.
  const bob = moving && !air ? Math.abs(Math.sin(ph)) * k * 0.04 : Math.sin(t * 3) * k * 0.015;
  ctx.translate(0, -bob);
  ctx.fillStyle = '#1fb5a6'; ctx.beginPath(); ctx.ellipse(0, -k * 0.45, k * 0.3, k * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9f7ee'; ctx.beginPath(); ctx.ellipse(k * 0.06, -k * 0.4, k * 0.17, k * 0.21, 0, 0, Math.PI * 2); ctx.fill();
  // Arm.
  ctx.strokeStyle = '#178f83'; ctx.lineWidth = k * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(k * 0.05, -k * 0.5); ctx.lineTo(k * (0.22 + (moving ? Math.cos(ph) * 0.08 : 0)), -k * (air ? 0.7 : 0.35)); ctx.stroke();
  // Scarf trailing behind.
  const wave = Math.sin(t * 12) * k * 0.05, trail = 0.25 + Math.min(1, Math.abs(p.vx) / 7.5) * 0.35;
  ctx.fillStyle = '#ff8a2a';
  ctx.beginPath(); ctx.ellipse(0, -k * 0.7, k * 0.25, k * 0.075, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-k * 0.15, -k * 0.74);
  ctx.quadraticCurveTo(-k * (0.3 + trail / 2), -k * 0.78 + wave, -k * (0.2 + trail), -k * 0.7 - wave);
  ctx.lineTo(-k * (0.2 + trail), -k * 0.6 - wave); ctx.quadraticCurveTo(-k * (0.3 + trail / 2), -k * 0.66 + wave, -k * 0.15, -k * 0.64); ctx.fill();
  ctx.fillStyle = '#ffb36b'; ctx.fillRect(-k * 0.05, -k * 0.73, k * 0.05, k * 0.07);
  // Head.
  ctx.fillStyle = '#1fb5a6'; ctx.beginPath(); ctx.arc(k * 0.08, -k * 0.95, k * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-k * 0.1, -k * 1.15, k * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(k * 0.22, -k * 1.17, k * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9f7ee'; ctx.beginPath(); ctx.ellipse(k * 0.2, -k * 0.88, k * 0.14, k * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10213a'; ctx.beginPath(); ctx.ellipse(k * 0.3, -k * 0.92, k * 0.05, k * 0.035, 0, 0, Math.PI * 2); ctx.fill();
  // Eye with blink.
  const blink = Math.sin(t * 0.9) > 0.97;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(k * 0.14, -k * 1.0, k * 0.065, blink ? k * 0.01 : k * 0.075, 0, 0, Math.PI * 2); ctx.fill();
  if (!blink) { ctx.fillStyle = '#10213a'; ctx.beginPath(); ctx.arc(k * 0.16, -k * 1.0, k * 0.04, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(k * 0.165, -k * 1.03, k * 0.015, k * 0.015); }
  ctx.fillStyle = '#ff9aa8'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(k * 0.07, -k * 0.86, k * 0.04, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, s: number, t: number) {
  const x = (e.x + e.w / 2 - camX) * s, y = (e.y + e.h) * s;
  ctx.save(); ctx.translate(x, y);
  if (!e.alive) { ctx.globalAlpha = Math.max(0, 1 - e.deadT * 2); ctx.scale(1, -1); ctx.translate(0, s * 0.6); }
  if (e.kind === 'crab') {
    const k = s;
    const step = Math.sin(t * 14 + e.x);
    ctx.strokeStyle = '#c23a3a'; ctx.lineWidth = k * 0.05; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * k * 0.15, -k * 0.2); ctx.lineTo(sd * k * (0.35 + i * 0.05), -k * 0.05 + (i % 2 ? step : -step) * k * 0.03); ctx.lineTo(sd * k * (0.4 + i * 0.05), 0); ctx.stroke();
    }
    ctx.fillStyle = '#ff5a4f'; ctx.beginPath(); ctx.ellipse(0, -k * 0.28, k * 0.36, k * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8a7f'; ctx.beginPath(); ctx.ellipse(0, -k * 0.34, k * 0.22, k * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    const snap = Math.abs(Math.sin(t * 5 + e.x)) * 0.4;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#ff5a4f';
      ctx.beginPath(); ctx.arc(sd * k * 0.42, -k * 0.5, k * 0.12, sd > 0 ? -Math.PI * 0.9 + snap : Math.PI * -0.1 - snap, sd > 0 ? Math.PI * 0.9 - snap : Math.PI * 1.1 + snap); ctx.lineTo(sd * k * 0.42, -k * 0.5); ctx.fill();
      ctx.strokeStyle = '#ff5a4f'; ctx.lineWidth = k * 0.06; ctx.beginPath(); ctx.moveTo(sd * k * 0.25, -k * 0.35); ctx.lineTo(sd * k * 0.38, -k * 0.45); ctx.stroke();
      ctx.strokeStyle = '#c23a3a'; ctx.lineWidth = k * 0.03; ctx.beginPath(); ctx.moveTo(sd * k * 0.08, -k * 0.42); ctx.lineTo(sd * k * 0.1, -k * 0.6); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sd * k * 0.1, -k * 0.62, k * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sd * k * 0.1 + (e.vx > 0 ? 1 : -1) * k * 0.02, -k * 0.62, k * 0.03, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    const k = s;
    ctx.translate(0, -k * 0.45);
    ctx.shadowColor = '#ff7ad9'; ctx.shadowBlur = 16;
    const g = ctx.createRadialGradient(0, -k * 0.1, k * 0.05, 0, 0, k * 0.45);
    g.addColorStop(0, '#ffd6f4'); g.addColorStop(1, '#ff7ad9aa');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, k * 0.4, k * 0.32, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff9ae4aa'; ctx.lineWidth = k * 0.05; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * k * 0.13, 0);
      ctx.quadraticCurveTo(i * k * 0.13 + Math.sin(t * 4 + i) * k * 0.1, k * 0.25, i * k * 0.12 + Math.sin(t * 4 + i + 1) * k * 0.08, k * 0.45); ctx.stroke();
    }
    ctx.fillStyle = '#3a0a30'; ctx.beginPath(); ctx.arc(-k * 0.12, -k * 0.1, k * 0.04, 0, Math.PI * 2); ctx.arc(k * 0.12, -k * 0.1, k * 0.04, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
