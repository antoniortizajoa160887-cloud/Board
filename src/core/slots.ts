import { randInt, type Rng } from './rng';

export type Sym = 'pearl' | 'star' | 'shell' | 'bell' | 'bar' | 'seven' | 'wild' | 'jackpot';

export const SYMBOLS: Sym[] = ['pearl', 'star', 'shell', 'bell', 'bar', 'seven', 'wild', 'jackpot'];

/** How many times each symbol sits on a reel strip. */
export const WEIGHTS: Record<Sym, number> = {
  pearl: 11, star: 10, shell: 9, bell: 7, bar: 5, seven: 3, wild: 2, jackpot: 1,
};

/** Line pays for 3, 4 and 5 in a row from the left, times the line bet. */
export const PAYTABLE: Record<Sym, [number, number, number]> = {
  pearl: [5, 14, 45],
  star: [7, 18, 60],
  shell: [9, 26, 90],
  bell: [14, 45, 175],
  bar: [26, 90, 350],
  seven: [50, 200, 900],
  wild: [90, 450, 2500],
  jackpot: [70, 500, 0], // 5 = the progressive jackpot
};

export const REELS = 5;
export const ROWS = 3;

/** 9 paylines, as the row (0 top, 1 middle, 2 bottom) on each reel. */
export const LINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
];

/** One reel strip, the symbols spread out so the same one rarely sits next to itself. */
export function makeStrip(seed = 7): Sym[] {
  const pool: Sym[] = [];
  for (const s of SYMBOLS) for (let i = 0; i < WEIGHTS[s]; i++) pool.push(s);
  // Deterministic interleave: take round-robin from each symbol's bucket.
  const buckets = SYMBOLS.map(s => pool.filter(p => p === s));
  const strip: Sym[] = [];
  let k = seed % SYMBOLS.length;
  while (strip.length < pool.length) {
    const b = buckets[k % buckets.length];
    if (b.length) strip.push(b.pop()!);
    k++;
  }
  return strip;
}

export const STRIPS: Sym[][] = Array.from({ length: REELS }, (_, i) => makeStrip(i * 3 + 1));

/** grid[reel][row] */
export type Grid = Sym[][];

export function spin(rng: Rng): { stops: number[]; grid: Grid } {
  const stops = STRIPS.map(s => randInt(rng, s.length));
  return { stops, grid: gridAt(stops) };
}

export function gridAt(stops: number[]): Grid {
  return stops.map((stop, r) => {
    const s = STRIPS[r];
    return [s[(stop - 1 + s.length) % s.length], s[stop], s[(stop + 1) % s.length]];
  });
}

export interface LineWin { line: number; sym: Sym; count: number; pay: number; jackpot: boolean }

/** Best win on one line (wilds stand in for any symbol except the jackpot). */
export function lineWin(syms: Sym[], lineBet: number, line: number): LineWin | null {
  let best: LineWin | null = null;
  const consider = (sym: Sym, count: number) => {
    if (count < 3) return;
    const jackpot = sym === 'jackpot' && count === 5;
    const pay = jackpot ? 0 : PAYTABLE[sym][count - 3] * lineBet;
    if (!best || jackpot || pay > best.pay) {
      if (best?.jackpot) return;
      best = { line, sym, count, pay, jackpot };
    }
  };
  // Jackpot symbols: only themselves.
  let j = 0;
  while (j < syms.length && syms[j] === 'jackpot') j++;
  consider('jackpot', j);
  // Pure wilds.
  let w = 0;
  while (w < syms.length && syms[w] === 'wild') w++;
  consider('wild', w);
  // Each regular symbol with wilds standing in.
  for (const sym of SYMBOLS) {
    if (sym === 'wild' || sym === 'jackpot') continue;
    let n = 0;
    while (n < syms.length && (syms[n] === sym || syms[n] === 'wild')) n++;
    if (n > w) consider(sym, n);
  }
  return best;
}

export function evaluateGrid(grid: Grid, lineBet: number): LineWin[] {
  const wins: LineWin[] = [];
  LINES.forEach((rows, i) => {
    const syms = rows.map((row, reel) => grid[reel][row]);
    const w = lineWin(syms, lineBet, i);
    if (w) wins.push(w);
  });
  return wins;
}

/** The jackpot starts here and grows by a share of every bet until someone hits it. */
export const JACKPOT_SEED = 25000;
export const JACKPOT_SHARE = 0.02;
