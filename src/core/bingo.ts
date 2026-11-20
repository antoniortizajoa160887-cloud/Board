import { randInt, shuffle, type Rng } from './rng';

/** A 5x5 card, column B 1-15, I 16-30, N 31-45, G 46-60, O 61-75. Centre (index 12) is free (0). */
export type BingoCard = number[];

export function makeCard(rng: Rng): BingoCard {
  const cols: number[][] = [];
  for (let c = 0; c < 5; c++) {
    const nums = Array.from({ length: 15 }, (_, i) => c * 15 + i + 1);
    cols.push(shuffle(nums, rng).slice(0, 5));
  }
  const card: number[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) card.push(r === 2 && c === 2 ? 0 : cols[c][r]);
  return card;
}

export function drawOrder(rng: Rng): number[] {
  return shuffle(Array.from({ length: 75 }, (_, i) => i + 1), rng);
}

export const LETTERS = 'BINGO';
export const letterOf = (n: number) => LETTERS[Math.floor((n - 1) / 15)];

const LINES_IDX: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < 5; r++) out.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
  for (let c = 0; c < 5; c++) out.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
  out.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return out;
})();
const CORNERS = [0, 4, 20, 24];

export type Prize = 'line' | 'corners' | 'twoLines' | 'full';

/** Prizes per card, paid as times the card's price. Each prize pays once per card. */
export const PRIZE_PAYS: Record<Prize, number> = { line: 1, corners: 2, twoLines: 4, full: 30 };

export function marked(card: BingoCard, called: Set<number>): boolean[] {
  return card.map(n => n === 0 || called.has(n));
}

/** Which prizes the card has right now. */
export function prizes(card: BingoCard, called: Set<number>): Prize[] {
  const m = marked(card, called);
  const lines = LINES_IDX.filter(l => l.every(i => m[i])).length;
  const out: Prize[] = [];
  if (lines >= 1) out.push('line');
  if (CORNERS.every(i => m[i])) out.push('corners');
  if (lines >= 2) out.push('twoLines');
  if (m.every(Boolean)) out.push('full');
  return out;
}

/** Balls drawn in one game. */
export const BALLS_PER_GAME = 39;

export function quickNumber(rng: Rng, max: number) {
  return randInt(rng, max);
}
