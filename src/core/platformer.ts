/** Zip's platformer rules: tile map, physics, enemies, pickups. No drawing here. Units are tiles; y grows downward. */
import type { LevelDef } from './zipLevels';
import { levelRows } from './zipLevels';

export const GRAVITY = 40;
export const MAX_FALL = 18;
export const RUN = 7.5;
export const JUMP_V = 14.5;
export const JET_V = 12.5;
export const SPRING_V = 22;
export const STOMP_V = 11;
const ACCEL_GROUND = 60, ACCEL_AIR = 35, FRICTION = 50, COYOTE = 0.1, BUFFER = 0.12;

export interface Input { left: boolean; right: boolean; jump: boolean; jumpPressed: boolean }

export interface Box { x: number; y: number; w: number; h: number }

export interface Player extends Box {
  vx: number; vy: number; onGround: boolean; coyote: number; buffer: number; jets: number;
  facing: 1 | -1; hurtT: number; jetT: number; landT: number; runPhase: number; cut: boolean;
}

export interface Enemy extends Box { kind: 'crab' | 'jelly'; vx: number; vy: number; alive: boolean; deadT: number; baseY: number; t: number }

export type GameEvent = 'jump' | 'jet' | 'pearl' | 'stomp' | 'hurt' | 'fall' | 'flag' | 'bonus' | 'spring' | 'win' | 'lose' | 'land';

export interface World {
  def: LevelDef;
  tiles: string[][];
  w: number; h: number;
  p: Player;
  enemies: Enemy[];
  collected: number; total: number;
  hearts: number; hits: number;
  checkpoint: { x: number; y: number };
  time: number;
  state: 'play' | 'won' | 'lost';
  events: { e: GameEvent; x: number; y: number }[];
  springT: Map<string, number>;
}

export const SOLID = new Set(['#', '?', '!']);
const isSolid = (c: string | undefined) => c !== undefined && SOLID.has(c);

export function makeWorld(def: LevelDef): World {
  const rows = levelRows(def);
  const h = rows.length, w = rows[0].length;
  const tiles = rows.map(r => r.split(''));
  const enemies: Enemy[] = [];
  let start = { x: 1, y: h - 3 };
  let total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = tiles[y][x];
    if (c === 'S') { start = { x, y }; tiles[y][x] = ' '; }
    else if (c === 'C') { enemies.push({ kind: 'crab', x: x + 0.1, y: y + 0.35, w: 0.8, h: 0.65, vx: -2, vy: 0, alive: true, deadT: 0, baseY: y, t: 0 }); tiles[y][x] = ' '; }
    else if (c === 'J') { enemies.push({ kind: 'jelly', x: x + 0.1, y, w: 0.8, h: 0.8, vx: 0, vy: 0, alive: true, deadT: 0, baseY: y, t: x * 0.7 }); tiles[y][x] = ' '; }
    else if (c === 'o') total++;
    else if (c === '?') total += 3;
  }
  const p = newPlayer(start.x, start.y);
  return { def, tiles, w, h, p, enemies, collected: 0, total, hearts: 3, hits: 0, checkpoint: start, time: 0, state: 'play', events: [], springT: new Map() };
}

function newPlayer(tx: number, ty: number): Player {
  return { x: tx + 0.15, y: ty + 0.1, w: 0.7, h: 0.9, vx: 0, vy: 0, onGround: false, coyote: 0, buffer: 0, jets: 1, facing: 1, hurtT: 0, jetT: 0, landT: 0, runPhase: 0, cut: false };
}

export const tileAt = (wd: World, x: number, y: number) => (y < 0 ? ' ' : wd.tiles[y]?.[x] ?? (x < 0 || x >= wd.w ? '#' : ' '));

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Moves a box by dx then dy against solid tiles. Returns which sides hit. */
function moveBox(wd: World, b: Box & { vx: number; vy: number }, dt: number, oneWay: boolean) {
  const hit = { left: false, right: false, top: false, bottom: false, headTiles: [] as [number, number][] };
  b.x += b.vx * dt;
  const y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-6);
  if (b.vx > 0) {
    const tx = Math.floor(b.x + b.w);
    for (let y = y0; y <= y1; y++) if (isSolid(tileAt(wd, tx, y))) { b.x = tx - b.w; b.vx = 0; hit.right = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x);
    for (let y = y0; y <= y1; y++) if (isSolid(tileAt(wd, tx, y))) { b.x = tx + 1; b.vx = 0; hit.left = true; break; }
  }
  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6);
  if (b.vy > 0) {
    const ty = Math.floor(b.y + b.h);
    for (let x = x0; x <= x1; x++) {
      const c = tileAt(wd, x, ty);
      if (isSolid(c) || (oneWay && c === '=' && prevBottom <= ty + 0.02)) { b.y = ty - b.h; b.vy = 0; hit.bottom = true; break; }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y);
    for (let x = x0; x <= x1; x++) if (isSolid(tileAt(wd, x, ty))) { hit.headTiles.push([x, ty]); }
    if (hit.headTiles.length) { b.y = ty + 1; b.vy = 0; hit.top = true; }
  }
  return hit;
}

function hurt(wd: World, from: number) {
  const p = wd.p;
  if (p.hurtT > 0 || wd.state !== 'play') return;
  wd.hearts--; wd.hits++;
  p.hurtT = 1.3;
  p.vx = from < p.x + p.w / 2 ? 6 : -6;
  p.vy = -9;
  wd.events.push({ e: 'hurt', x: p.x, y: p.y });
  if (wd.hearts <= 0) { wd.state = 'lost'; wd.events.push({ e: 'lose', x: p.x, y: p.y }); }
}

export function step(wd: World, inp: Input, dt: number) {
  if (wd.state !== 'play') return;
  wd.time += dt;
  const p = wd.p;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.jetT = Math.max(0, p.jetT - dt);
  p.landT = Math.max(0, p.landT - dt * 4);
  for (const [k, v] of wd.springT) { if (v - dt <= 0) wd.springT.delete(k); else wd.springT.set(k, v - dt); }

  // Run.
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const accel = p.onGround ? ACCEL_GROUND : ACCEL_AIR;
  if (dir) {
    p.vx += dir * accel * dt;
    p.vx = Math.max(-RUN, Math.min(RUN, p.vx));
    p.facing = dir as 1 | -1;
  } else if (p.onGround) {
    const f = FRICTION * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  p.runPhase += Math.abs(p.vx) * dt * 2.2;

  // Jump: buffered press, coyote time, then one jet jump in the air.
  if (inp.jumpPressed) p.buffer = BUFFER; else p.buffer = Math.max(0, p.buffer - dt);
  p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
  if (p.buffer > 0) {
    if (p.coyote > 0) {
      p.vy = -JUMP_V; p.coyote = 0; p.buffer = 0; p.cut = false; p.onGround = false;
      wd.events.push({ e: 'jump', x: p.x, y: p.y + p.h });
    } else if (p.jets > 0 && inp.jumpPressed) {
      p.vy = -JET_V; p.jets--; p.buffer = 0; p.jetT = 0.35; p.cut = false;
      wd.events.push({ e: 'jet', x: p.x + p.w / 2, y: p.y + p.h });
    }
  }
  // Letting go of jump early makes a short hop.
  const g = p.vy < 0 && !inp.jump ? GRAVITY * 2.2 : GRAVITY;
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);

  const wasGround = p.onGround;
  const fallV = p.vy;
  const hit = moveBox(wd, p, dt, true);
  p.x = Math.max(0, Math.min(wd.w - p.w, p.x));
  p.onGround = hit.bottom;
  if (p.onGround) {
    p.jets = 1;
    if (!wasGround && fallV > 6) { p.landT = Math.min(1, fallV / MAX_FALL); wd.events.push({ e: 'land', x: p.x + p.w / 2, y: p.y + p.h }); }
  }
  for (const [tx, ty] of hit.headTiles) {
    if (wd.tiles[ty]?.[tx] === '?') {
      wd.tiles[ty][tx] = '!';
      wd.collected += 3;
      wd.events.push({ e: 'bonus', x: tx + 0.5, y: ty });
    }
  }

  // Tiles the player touches.
  const x0 = Math.floor(p.x), x1 = Math.floor(p.x + p.w), y0 = Math.floor(p.y), y1 = Math.floor(p.y + p.h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = tileAt(wd, x, y);
    if (c === 'o' && overlap(p, { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6 })) {
      wd.tiles[y][x] = ' '; wd.collected++; wd.events.push({ e: 'pearl', x: x + 0.5, y: y + 0.5 });
    } else if (c === '^' && overlap(p, { x: x + 0.1, y: y + 0.45, w: 0.8, h: 0.55 })) {
      hurt(wd, x + 0.5);
    } else if (c === 'B' && p.vy >= 0 && overlap(p, { x: x + 0.1, y: y + 0.55, w: 0.8, h: 0.45 })) {
      p.vy = -SPRING_V; p.y = y + 0.55 - p.h; p.jets = 1; p.onGround = false; p.cut = false;
      wd.springT.set(`${x},${y}`, 0.3);
      wd.events.push({ e: 'spring', x: x + 0.5, y: y + 0.5 });
    } else if (c === 'F' && (wd.checkpoint.x !== x || wd.checkpoint.y !== y) && overlap(p, { x, y: y - 1, w: 1, h: 2 })) {
      wd.checkpoint = { x, y }; wd.events.push({ e: 'flag', x: x + 0.5, y });
    } else if (c === 'G' && overlap(p, { x: x - 0.3, y: y - 1.5, w: 1.6, h: 2.5 })) {
      wd.state = 'won'; wd.events.push({ e: 'win', x: x + 0.5, y });
      return;
    }
  }

  // Enemies.
  for (const e of wd.enemies) {
    if (!e.alive) { e.deadT += dt; e.y += dt * 6; continue; }
    e.t += dt;
    if (e.kind === 'crab') {
      e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
      const before = e.vx;
      const h2 = moveBox(wd, e, dt, true);
      if (h2.left || h2.right) e.vx = -before;
      if (h2.bottom) {
        // Turn at ledges.
        const ahead = e.vx > 0 ? Math.floor(e.x + e.w + 0.05) : Math.floor(e.x - 0.05);
        const below = tileAt(wd, ahead, Math.floor(e.y + e.h + 0.1));
        if (!isSolid(below) && below !== '=') e.vx = -e.vx;
        if (tileAt(wd, ahead, Math.floor(e.y + e.h - 0.1)) === '^') e.vx = -e.vx;
      }
      if (e.y > wd.h + 2) e.alive = false;
    } else {
      e.y = e.baseY + Math.sin(e.t * 2) * 1.0;
    }
    if (!overlap(p, e)) continue;
    const fromAbove = p.vy > 0 && p.y + p.h - e.y < 0.55;
    if (e.kind === 'crab' && fromAbove) {
      e.alive = false;
      p.vy = -(inp.jump ? JUMP_V : STOMP_V);
      p.jets = 1;
      wd.events.push({ e: 'stomp', x: e.x + e.w / 2, y: e.y });
    } else hurt(wd, e.x + e.w / 2);
  }

  // Falling out of the level.
  if (p.y > wd.h + 1 && wd.state === 'play') {
    wd.hearts--; wd.hits++;
    wd.events.push({ e: 'fall', x: p.x, y: wd.h });
    if (wd.hearts <= 0) { wd.state = 'lost'; wd.events.push({ e: 'lose', x: p.x, y: p.y }); return; }
    Object.assign(p, newPlayer(wd.checkpoint.x, wd.checkpoint.y), { hurtT: 1.3 });
  }
}

/** Stars: 1 for finishing, 1 for every pearl, 1 for no hits. */
export function starsFor(wd: World): number {
  if (wd.state !== 'won') return 0;
  return 1 + (wd.collected >= wd.total ? 1 : 0) + (wd.hits === 0 ? 1 : 0);
}

/** Chips for a finished level: 2 per pearl, 50 per new star, 25 for finishing. */
export function chipsFor(wd: World, oldStars: number): number {
  if (wd.state !== 'won') return 0;
  return 25 + wd.collected * 2 + Math.max(0, starsFor(wd) - oldStars) * 50;
}

/**
 * Rough reachability check used by the tests: from each standing spot, Zip can reach
 * spots up to 4 tiles higher (jump + jet) within a few tiles sideways, or any lower spot nearby.
 */
export function reachable(def: LevelDef): { goal: boolean; pearlsNear: number; pearls: number } {
  const rows = levelRows(def);
  const H = rows.length, W = rows[0].length;
  const at = (x: number, y: number) => (y < 0 || y >= H || x < 0 || x >= W ? ' ' : rows[y][x]);
  const support = (c: string) => SOLID.has(c) || c === '=' || c === 'B';
  const stand: [number, number][] = [];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
    if (!SOLID.has(at(x, y)) && at(x, y) !== '^' && support(at(x, y + 1))) stand.push([x, y]);
    if (at(x, y) === 'B') stand.push([x, y]);
  }
  const key = (x: number, y: number) => `${x},${y}`;
  let start: [number, number] = [1, 9];
  rows.forEach((r, y) => { const x = r.indexOf('S'); if (x >= 0) start = [x, y]; });
  const seen = new Set([key(...start)]);
  const queue: [number, number][] = [start];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const isSpring = at(x, y) === 'B';
    const maxRise = isSpring ? 6 : 4;
    for (const [nx, ny] of stand) {
      if (seen.has(key(nx, ny))) continue;
      const rise = y - ny, dx = Math.abs(nx - x);
      const ok = rise > 0 ? rise <= maxRise && dx <= (rise <= 2 ? 5 : 4) : dx <= 6 - rise;
      if (ok) { seen.add(key(nx, ny)); queue.push([nx, ny]); }
    }
  }
  let goal = false, pearls = 0, near = 0;
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === 'G' && seen.has(key(x, y))) goal = true;
    if (c === 'o' || c === '?') {
      pearls++;
      // A pearl counts as reachable if a reached spot is under it within jump range.
      if ([...seen].some(k => { const [sx, sy] = k.split(',').map(Number); return Math.abs(sx - x) <= 3 && sy - y >= -1 && sy - y <= (at(sx, sy) === 'B' ? 7 : 5); })) near++;
    }
  }));
  return { goal, pearlsNear: near, pearls };
}
