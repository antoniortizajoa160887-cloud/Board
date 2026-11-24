/**
 * Sink the Fleet: each side hides five boats on a 10 × 10 sea (lengths 5, 4, 3, 3, 2), in straight lines,
 * not touching each other. Take turns firing at a square of the other sea: a hit lets you fire again;
 * a miss passes the turn. Sink every boat to win.
 */
import { shuffle, type Rng } from './rng';

export const N = 10;
export const SHIPS = [5, 4, 3, 3, 2];
export interface Boat { cells: number[] }
export interface Sea { boats: Boat[]; shots: Set<number> }

const rc = (i: number) => [Math.floor(i / N), i % N];

/** Random fleet with no two boats touching (not even at a corner). */
export function placeFleet(rng: Rng): Boat[] {
  for (;;) {
    const taken = new Set<number>();
    const boats: Boat[] = [];
    let ok = true;
    for (const len of SHIPS) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const across = rng() < 0.5;
        const r = Math.floor(rng() * (across ? N : N - len + 1)), c = Math.floor(rng() * (across ? N - len + 1 : N));
        const cells = Array.from({ length: len }, (_, k) => (across ? r * N + c + k : (r + k) * N + c));
        if (cells.some(i => taken.has(i))) continue;
        boats.push({ cells });
        cells.forEach(i => { const [y, x] = rc(i); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < N && xx >= 0 && xx < N) taken.add(yy * N + xx); } });
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return boats;
  }
}

export const newSea = (boats: Boat[]): Sea => ({ boats, shots: new Set() });
export const boatAt = (s: Sea, i: number) => s.boats.find(b => b.cells.includes(i)) ?? null;
export const sunk = (s: Sea, b: Boat) => b.cells.every(i => s.shots.has(i));
export const allSunk = (s: Sea) => s.boats.every(b => sunk(s, b));

export type ShotResult = 'miss' | 'hit' | 'sunk';
export function fire(s: Sea, i: number): ShotResult {
  s.shots.add(i);
  const b = boatAt(s, i);
  if (!b) return 'miss';
  return sunk(s, b) ? 'sunk' : 'hit';
}

/** The computer's shot: finish a damaged boat first; otherwise hunt on a checkerboard, by where boats still fit. */
export function botShot(s: Sea, rng: Rng): number {
  const open = (i: number) => i >= 0 && i < N * N && !s.shots.has(i);
  const hits = [...s.shots].filter(i => { const b = boatAt(s, i); return b && !sunk(s, b); });
  if (hits.length) {
    const cand: number[] = [];
    if (hits.length >= 2) {
      const rows = new Set(hits.map(i => rc(i)[0])), cols = new Set(hits.map(i => rc(i)[1]));
      const lo = Math.min(...hits), hi = Math.max(...hits);
      if (rows.size === 1) { if (lo % N > 0) cand.push(lo - 1); if (hi % N < N - 1) cand.push(hi + 1); }
      else if (cols.size === 1) { cand.push(lo - N, hi + N); }
    }
    for (const h of hits) { const x = h % N; if (x > 0) cand.push(h - 1); if (x < N - 1) cand.push(h + 1); cand.push(h - N, h + N); }
    const ok = cand.filter(open);
    if (ok.length) return ok[0];
  }
  // Hunt: count how many ways the remaining boats could cover each open square.
  const left = s.boats.filter(b => !sunk(s, b)).map(b => b.cells.length);
  const blocked = (i: number) => s.shots.has(i);
  const heat = Array(N * N).fill(0);
  for (const len of left) for (let i = 0; i < N * N; i++) for (const across of [true, false]) {
    const [y, x] = rc(i);
    if (across ? x + len > N : y + len > N) continue;
    const cells = Array.from({ length: len }, (_, k) => (across ? i + k : i + k * N));
    if (cells.some(blocked)) continue;
    cells.forEach(c => heat[c]++);
  }
  const pool = shuffle(Array.from({ length: N * N }, (_, i) => i).filter(i => open(i) && (rc(i)[0] + rc(i)[1]) % 2 === 0 && heat[i] > 0), rng);
  const list = pool.length ? pool : Array.from({ length: N * N }, (_, i) => i).filter(open);
  return list.reduce((b, i) => (heat[i] > heat[b] ? i : b), list[0]);
}
