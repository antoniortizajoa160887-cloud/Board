/**
 * Poker Bingo (a Pokeno-style game): 12 fixed, numbered 5×5 boards of playing cards, like the
 * printed boards of the classic boxed game. Every row and column of a board is a poker hand
 * (pair or better), and every board holds the same set of hands, so no board is better than
 * another. Cards are called from one shuffled 52-card deck; each board
 * pays for its center, its four corners, and its best covered row or column by its poker hand.
 */
import { newDeck, type Card, type Suit } from './cards';
import { categoryOf, score5, type Category } from './holdem';
import { shuffle, type Rng } from './rng';

export const BOARD_COUNT = 12;

export const CALLS = 26; // half the deck is called each game
export const CENTER = 12;
export const CORNERS = [0, 4, 20, 24];

/** The lines that pay: 5 rows and 5 columns. */
export const LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)),
];

/** The 12 boards, row by row (T = 10). Fixed: the same boards every game. On every board the 5 rows and 5 columns make
 *  the same hands: three pairs, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush. */
const BOARD_CODES = [
  // 1
  '5C 5H JC KD AD 2C 2H JH 7D 9D 3C 3H KC KH 3D 4C 4H 4S AH 4D AC AS JS TS JD',
  // 2
  'KC 5C JC 7C 2C 2H 5D 6D 4D 3H 2D 5S 6C 4C 2S 8H 5H 6H 7H 4H JS 9H 9S JD 9D',
  // 3
  '3H KC 8C 3S KS 6D 5S 8D 7D 4D QS 9C QD 9D QH JS 9S 8S 7S TS JH 9H 8H TH 4H',
  // 4
  'KS 9S 7C KC 8S KH TH AH JH QH JD TC AS KD QS 5D TD AD 3D QD 5H TS 7S 2C 5S',
  // 5
  'AD AS 9H AC AH JS 6D 6S 6H JC 8C 6C 7C 9C TC 8D 2D 7D 9D 4D 8H JH 9S 7H TS',
  // 6
  '6H 7D 9D 8C TC 6C 7C 4C 3C AC 5S 7S 9S 8S 6S QD QH 9H QS QC 4H KS 4S TS TD',
  // 7
  '2C JC 3C AC 6C 8S JS KD AH JD 3D 2D 4D AD 5D 8D 2H 6D 8C 8H 3S 2S 4S AS 5H',
  // 8
  '2C KC QC 8C 3C 7D AS 6H AH 5C 2S 3H 4C AC 5H 7C 4S 6S 4H 5S 2D 3D 6D 4D 5D',
  // 9
  'KH TH 8D KD 3C AD 9D QD 2D 3D 2S TS KC 2H JS 9S TD 8H QS JH 9C TC 8C QC JC',
  // 10
  '6C 7C 5S 9C 8C 7H 8H 5H 9H 6H 3C 3H 5C 4S 4C 6S 7D TC 9S TS 6D JD 5D 4D TD',
  // 11
  '8H JH 6H 3H 7H AC 5C 4C 3C 2C AD 5D 4D 3S 5H TH 7S 6D 2S 7C AS 2H 4H 3D 5S',
  // 12
  'QC 2D QD 8D QS 7C 5C 6C 8C 9C 7D 6D JD KD 5D QH 2H 2S 8H 5S 7H TS JH 8S 9D',
];

const parse = (code: string): Card => ({ rank: '23456789TJQKA'.indexOf(code[0]) + 2, suit: code[1] as Suit });
export const BOARDS: Card[][] = BOARD_CODES.map(b => b.split(' ').map(parse));

/** Multipliers of the board price. */
export const PAY = {
  center: 0.4,
  corners: 3,
  /** A covered row or column pays by its poker hand (index = category: high card … straight flush).
   *  Each board holds the same hands, so the prizes rise gently. */
  line: [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5],
};

export const cardKey = (c: Card) => `${c.rank}${c.suit}`;


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
export function simulateReturn(rng: Rng, games: number, board?: number): number {
  let paid = 0;
  for (let g = 0; g < games; g++) {
    const called = new Set(callOrder(rng).map(cardKey));
    paid += judge(BOARDS[board ?? g % BOARDS.length], called).pay;
  }
  return paid / games;
}
