/** Keno: pick 1 to 10 numbers from 1–80, the machine draws 20. Pay depends on how many of your picks are drawn. */
import { shuffle, type Rng } from './rng';

export const KENO_MAX = 80, KENO_DRAW = 20;

/** PAYS[picks][hits] = what comes back per chip bet (stake included). */
export const KENO_PAYS: Record<number, Record<number, number>> = {
  1: { 1: 3.7 },
  2: { 2: 15 },
  3: { 2: 2, 3: 45 },
  4: { 2: 1, 3: 6, 4: 150 },
  5: { 3: 3.5, 4: 18, 5: 600 },
  6: { 3: 2, 4: 6, 5: 80, 6: 1700 },
  7: { 3: 1, 4: 3.5, 5: 19, 6: 340, 7: 5600 },
  8: { 4: 2, 5: 13, 6: 100, 7: 1400, 8: 10900 },
  9: { 4: 1, 5: 6.5, 6: 43, 7: 320, 8: 4300, 9: 26700 },
  10: { 5: 4.5, 6: 23, 7: 140, 8: 1150, 9: 5800, 10: 57800 },
};

export function drawKeno(rng: Rng): number[] {
  return shuffle(Array.from({ length: KENO_MAX }, (_, i) => i + 1), rng).slice(0, KENO_DRAW);
}

export const kenoPay = (picks: number, hits: number, bet: number) => Math.floor((KENO_PAYS[picks]?.[hits] ?? 0) * bet);

const choose = (n: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return r; };

/** Exact chance of hitting `hits` of `picks` numbers. */
export const hitChance = (picks: number, hits: number) => (choose(KENO_DRAW, hits) * choose(KENO_MAX - KENO_DRAW, picks - hits)) / choose(KENO_MAX, picks);

/** Exact return for a pick count (1.0 = break even). */
export const kenoReturn = (picks: number) => Object.entries(KENO_PAYS[picks]).reduce((a, [h, m]) => a + hitChance(picks, +h) * m, 0);

/** Random picks for "Quick pick". */
export const quickPick = (n: number, rng: Rng) => shuffle(Array.from({ length: KENO_MAX }, (_, i) => i + 1), rng).slice(0, n).sort((a, b) => a - b);
