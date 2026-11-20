/**
 * Poker Bingo (a Pokeno-style game): 5×5 boards of playing cards, cards are called from one
 * shuffled 52-card deck, and each board pays for its center, its four corners, and its
 * best covered line (row, column or diagonal) by the poker hand that line makes.
 */
import { newDeck, type Card } from './cards';
import { categoryOf, score5, type Category } from './holdem';
import { shuffle, type Rng } from './rng';

export const CALLS = 26; // half the deck is called each game
export const CENTER = 12;
export const CORNERS = [0, 4, 20, 24];

/** Every line of the board: 5 rows, 5 columns, 2 diagonals. */
export const LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)),
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

/** Multipliers of the board price. */
export const PAY = {
  center: 0.4,
  corners: 3.5,
  /** A covered line pays by its poker hand (index = category: high card … straight flush). */
  line: [1, 2, 5, 8, 15, 20, 40, 150, 1000],
};

export const cardKey = (c: Card) => `${c.rank}${c.suit}`;

/** A board: 25 different cards from one deck. */
export function makeBoard(rng: Rng): Card[] {
  return shuffle(newDeck(), rng).slice(0, 25);
}

export function callOrder(rng: Rng): Card[] {
  return shuffle(newDeck(), rng).slice(0, CALLS);
}

export type PrizeKind = 'center' | 'corners' | 'line';
export interface BoardResult { center: boolean; corners: boolean; line: number[] | null; hand: Category | null; pay: number }

/** What a board wins once the called cards are known (pay is a multiple of the board price). */
export function judge(board: Card[], called: Set<string>): BoardResult {
  const hit = (i: number) => called.has(cardKey(board[i]));
  const center = hit(CENTER);
  const corners = CORNERS.every(hit);
  let line: number[] | null = null, bestScore = -1;
  for (const l of LINES) {
    if (!l.every(hit)) continue;
    const s = score5(l.map(i => board[i]));
    if (s > bestScore) { bestScore = s; line = l; }
  }
  const hand = line ? categoryOf(bestScore) : null;
  const pay = (center ? PAY.center : 0) + (corners ? PAY.corners : 0) + (hand !== null ? PAY.line[hand] : 0);
  return { center, corners, line, hand, pay };
}

/** Average return per 1 chip of board price, by simulation. */
export function simulateReturn(rng: Rng, games: number): number {
  let paid = 0;
  for (let g = 0; g < games; g++) {
    const called = new Set(callOrder(rng).map(cardKey));
    paid += judge(makeBoard(rng), called).pay;
  }
  return paid / games;
}
