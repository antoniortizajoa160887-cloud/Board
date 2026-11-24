/**
 * Chinese checkers ("Star Checkers"): a six-pointed star of 121 holes. Each player starts with 10 marbles
 * in one point and races them all into the opposite point.
 *   - Move a marble one step to an empty neighbouring hole, or
 *   - jump over one marble (anyone's) to the empty hole right behind it, and keep jumping as long as you can.
 * Jumped marbles stay on the board. First to move all ten into the opposite point wins (or 7 when the
 * point is full because a rival's marbles never left it).
 * Holes use axial coordinates (q, r); s = -q - r.
 */
import type { Rng } from './rng';

export interface Hole { q: number; r: number }
export const HOLES: Hole[] = [];
const key = (q: number, r: number) => `${q},${r}`;
const INDEX = new Map<string, number>();
for (let r = -8; r <= 8; r++) for (let q = -8; q <= 8; q++) {
  const s = -q - r;
  const up = q >= -4 && r >= -4 && s >= -4, down = q <= 4 && r <= 4 && s <= 4;
  if (up || down) { INDEX.set(key(q, r), HOLES.length); HOLES.push({ q, r }); }
}
export const at = (q: number, r: number) => INDEX.get(key(q, r)) ?? -1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
export const NEIGHBOURS: number[][] = HOLES.map(({ q, r }) => DIRS.map(([dq, dr]) => at(q + dq, r + dr)));

/** The six points, in order around the star: 0 top, then clockwise. Point k is opposite point (k + 3) % 6. */
const POINT_TEST: ((h: Hole) => boolean)[] = [
  h => h.r < -4, h => h.q > 4, h => -h.q - h.r < -4, h => h.r > 4, h => h.q < -4, h => -h.q - h.r > 4,
];
export const POINTS: number[][] = POINT_TEST.map(t => HOLES.map((h, i) => (t(h) ? i : -1)).filter(i => i >= 0));
/** The tip hole of each point (farthest from the middle). */
export const TIPS: number[] = POINTS.map(p => p.reduce((b, i) => (dist(i, -1) > dist(b, -1) ? i : b)));
export const opposite = (k: number) => (k + 3) % 6;

/** Distance between two holes (steps); -1 means the centre. */
export function dist(a: number, b: number): number {
  const A = HOLES[a], B = b < 0 ? { q: 0, r: 0 } : HOLES[b];
  const dq = A.q - B.q, dr = A.r - B.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export interface StarGame {
  /** Each player's starting point (0-5). */
  homes: number[];
  board: number[]; // -1 empty, else player index
  turn: number;
  winner: number | null;
  moves: number;
}

export function newStars(players: 2 | 3): StarGame {
  const homes = players === 2 ? [3, 0] : [3, 1, 5];
  const board = HOLES.map(() => -1);
  homes.forEach((pt, p) => POINTS[pt].forEach(i => { board[i] = p; }));
  return { homes, board, turn: 0, winner: null, moves: 0 };
}

/** Every hole a marble can reach this turn: steps, and chains of jumps (with the path). */
export function reach(g: StarGame, from: number): Map<number, number[]> {
  const out = new Map<number, number[]>();
  NEIGHBOURS[from].forEach(n => { if (n >= 0 && g.board[n] < 0) out.set(n, [from, n]); });
  const seen = new Set([from]);
  const stack: number[][] = [[from]];
  while (stack.length) {
    const path = stack.pop()!;
    const cur = path[path.length - 1];
    const { q, r } = HOLES[cur];
    for (const [dq, dr] of DIRS) {
      const over = at(q + dq, r + dr), land = at(q + 2 * dq, r + 2 * dr);
      if (over < 0 || land < 0 || g.board[over] < 0 || (g.board[land] >= 0 && land !== from) || seen.has(land)) continue;
      seen.add(land);
      const p = [...path, land];
      if (land !== from) out.set(land, p);
      stack.push(p);
    }
  }
  return out;
}

export const target = (g: StarGame, p: number) => POINTS[opposite(g.homes[p])];

export function starMove(g: StarGame, from: number, to: number) {
  const p = g.board[from];
  g.board[to] = p; g.board[from] = -1;
  g.moves++;
  const goal = target(g, p), mine = goal.filter(i => g.board[i] === p).length;
  // All ten across wins. So that a rival can't block forever by staying put, a full point with at least 7 of yours also wins.
  if (mine === 10 || (mine >= 7 && goal.every(i => g.board[i] >= 0))) g.winner = p;
  else g.turn = (g.turn + 1) % g.homes.length;
}

/** Total distance of a player's marbles from the tip of their target point (lower is better). */
export function spread(g: StarGame, p: number): number {
  const tip = TIPS[opposite(g.homes[p])];
  let s = 0;
  g.board.forEach((o, i) => { if (o === p) s += dist(i, tip); });
  return s;
}

/** The computer: the move that brings its marbles closest to the far point, nudging the last ones along. */
export function starBot(g: StarGame, rng: Rng, level: 1 | 2 | 3 = 2): [number, number] | null {
  const p = g.turn, tip = TIPS[opposite(g.homes[p])];
  const goal = new Set(target(g, p));
  let best: [number, number] | null = null, bestV = -Infinity;
  const mine = g.board.map((o, i) => (o === p ? i : -1)).filter(i => i >= 0);
  const back = Math.max(...mine.map(i => dist(i, tip)));
  for (const from of mine) {
    for (const [to] of reach(g, from)) {
      const gain = dist(from, tip) - dist(to, tip);
      let v = gain * 10;
      if (goal.has(to) && !goal.has(from)) v += 4;
      if (goal.has(from) && !goal.has(to)) v -= 30;
      if (dist(from, tip) === back) v += 3; // don't leave stragglers
      v -= Math.abs(HOLES[to].q - HOLES[tip].q + (HOLES[to].r - HOLES[tip].r) / 2) * 0.4; // stay near the centre line
      v += rng() * (level === 1 ? 14 : level === 2 ? 4 : 1);
      if (v > bestV) { bestV = v; best = [from, to]; }
    }
  }
  return best;
}
