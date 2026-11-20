/**
 * Four in a Row: 7 columns × 6 rows, drop discs, line up four.
 * Cells: 0 empty, 1 you, -1 computer. Row 0 is the top.
 */
export const COLS = 7, ROWS = 6;
export type Grid = number[];

export const emptyGrid = (): Grid => Array(COLS * ROWS).fill(0);
export const at = (r: number, c: number) => r * COLS + c;

/** Row the disc lands on, or -1 if the column is full. */
export function landRow(g: Grid, c: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!g[at(r, c)]) return r;
  return -1;
}

export function drop(g: Grid, c: number, side: 1 | -1): Grid | null {
  const r = landRow(g, c);
  if (r < 0) return null;
  const n = g.slice(); n[at(r, c)] = side;
  return n;
}

const LINES: number[][] = (() => {
  const out: number[][] = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of dirs) {
    const cells: number[] = [];
    for (let k = 0; k < 4; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
      cells.push(at(rr, cc));
    }
    if (cells.length === 4) out.push(cells);
  }
  return out;
})();

/** The winning four cells, or null. */
export function winLine(g: Grid): number[] | null {
  for (const l of LINES) { const s = g[l[0]]; if (s && l.every(i => g[i] === s)) return l; }
  return null;
}
export const full = (g: Grid) => g.every(v => v !== 0);

function score(g: Grid): number {
  let s = 0;
  for (const l of LINES) {
    let me = 0, you = 0;
    for (const i of l) { if (g[i] === -1) me++; else if (g[i] === 1) you++; }
    if (me && you) continue;
    if (me === 3) s += 50; else if (me === 2) s += 6;
    if (you === 3) s -= 60; else if (you === 2) s -= 6;
  }
  for (let r = 0; r < ROWS; r++) { if (g[at(r, 3)] === -1) s += 4; else if (g[at(r, 3)] === 1) s -= 4; }
  return s;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];

function negamax(g: Grid, depth: number, side: 1 | -1, alpha: number, beta: number): number {
  const w = winLine(g);
  if (w) return g[w[0]] === side ? 100000 + depth : -100000 - depth;
  if (full(g)) return 0;
  if (depth === 0) return side === -1 ? score(g) : -score(g);
  let best = -Infinity;
  for (const c of ORDER) {
    const n = drop(g, c, side);
    if (!n) continue;
    best = Math.max(best, -negamax(n, depth - 1, (-side) as 1 | -1, -beta, -alpha));
    alpha = Math.max(alpha, best);
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's column. Level 1 (easy) to 3 (hard). */
export function aiColumn(g: Grid, level: 1 | 2 | 3, rng: () => number): number {
  const open = ORDER.filter(c => landRow(g, c) >= 0);
  // Always take a win; easy mode doesn't always block.
  for (const c of open) if (winLine(drop(g, c, -1)!)) return c;
  if (level > 1 || rng() < 0.6) for (const c of open) if (winLine(drop(g, c, 1)!)) return c;
  if (level === 1 && rng() < 0.4) return open[Math.floor(rng() * open.length)];
  const depth = level === 1 ? 2 : level === 2 ? 4 : 7;
  let best = -Infinity, pick: number[] = [];
  for (const c of open) {
    const v = -negamax(drop(g, c, -1)!, depth - 1, 1, -Infinity, Infinity);
    if (v > best) { best = v; pick = [c]; } else if (v === best) pick.push(c);
  }
  return pick[Math.floor(rng() * pick.length)];
}
