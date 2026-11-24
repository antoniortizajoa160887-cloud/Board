/**
 * Poker Bingo, played the traditional way: everyone at the table pays into four pots, a dealer turns
 * cards from a shuffled deck and calls them, and players cover the called cards on their 5 x 5 boards.
 *   Center    first to cover a board's middle card
 *   Corners   first to cover all four corners of a board
 *   Five      first to cover five in a row (row, column or diagonal); this ends the calling
 *   Poker     then the dealer deals each player five cards from a second deck; the best poker hand wins
 * A pot nobody won joins the poker pot. Players who win a pot on the same card split it.
 * 24 fixed, numbered boards in two sets of 12; every board holds 25 different cards.
 */
import { newDeck, type Card, type Suit } from './cards';
import { score5 } from './holdem';
import { shuffle, type Rng } from './rng';

export const SET_SIZE = 12;
export const BOARD_COUNT = 24;
export const MAX_BOARDS = 4;
export const CENTER = 12;
export const CORNERS = [0, 4, 20, 24];

/** Five in a row: 5 rows, 5 columns and the 2 diagonals. */
export const LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)),
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

/** The boards, row by row (T = 10). Set 1 is boards 1-12, set 2 is boards 13-24. */
const BOARD_CODES = [
  // Set 1
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
  // Set 2
  // 13
  '9D 4S 8S QS 9C 8D 5H 8C 4H 6C JS 4D AS 5D AC 7H 6D 4C 2S KD 3H 5S 5C 2C JD',
  // 14
  '9S JC 6H TH 7D TD 3D AH QH 7C KC JH AD QC 3C 6S KH QD 7S 9H 8H TC 3S 2D 2H',
  // 15
  'QD AC QS 4D TC TD 6D 3C 5C AS AH AD JD 4H KH JS 9S 6C 3D KS JC 4C 5H 9D TS',
  // 16
  'KC 2C 6S 3H 8S 9C 8C 8D 2D 7C 4S 9H JH 5S 2H 8H KD 2S QC 7H 6H 7D 5D TH 3S',
  // 17
  '2S 7C JD TC 7S TS 6S 9S AH 6C KS 7D 4S 3S QH 4D 2H AC 3D 9D 5H JS 3H KD AS',
  // 18
  'TD QD 8C 3C 4H QH 2C 6D KS QC 2D QS 5D KC 6H AD 8H 8D 9C JH 9H 8S JC 4C 5C',
  // 19
  '5D 3S AS TC KH 5C 5H 3H 6D JD 7S JH 3C 9D 7H 2C QC 9S 2H KD 8H TS 2S 5S TH',
  // 20
  '7D AH 9C 8C 6S QD JC KS 6C KH 4S TH 7H 8S 8D KC 7C 4C AC AD TD 4D 3D 2D 4H',
  // 21
  '5H TS 8S 4S 3C 5C 7S AS 6S 2S 9H 5S JS QD 6H QC 8D 2D 3D KD QH JD QS TH TD',
  // 22
  '4H 4C 2H AC 8C 3H TC 4D 9D 7D 2C KS 6C JH 9C JS 5D 6H 8H 5S 6D 7C KC TS JC',
  // 23
  '5D JH 5S QS AD 2D 6H JS 6C AH TS KH 9C 7S 8H 9S 6S 3D 7H KS 3S 4H 9H QH 5H',
  // 24
  'QC 4C TD 9H 2C JC TC 7H 8D AD 7S 6D 7C 9D AS 3C 2S AH QD JD AC QS TH 8C 3S',
];

const parse = (code: string): Card => ({ rank: '23456789TJQKA'.indexOf(code[0]) + 2, suit: code[1] as Suit });
export const BOARDS: Card[][] = BOARD_CODES.map(b => b.split(' ').map(parse));

export const cardKey = (c: Card) => `${c.rank}${c.suit}`;

export type Pot = 'center' | 'corners' | 'five' | 'poker';
export const POTS: Pot[] = ['center', 'corners', 'five', 'poker'];

/** What one board has covered so far. */
export function boardState(board: Card[], called: Set<string>) {
  const hit = (i: number) => called.has(cardKey(board[i]));
  return {
    center: hit(CENTER),
    corners: CORNERS.every(hit),
    five: LINES.find(l => l.every(hit)) ?? null,
    /** Most cards covered on any one line: how close the board is to five in a row. */
    best: Math.max(...LINES.map(l => l.filter(hit).length)),
  };
}

/** A player at the table and the board numbers (1-24) they play. */
export interface Seat { boards: number[] }

export interface Call { card: Card; won: Partial<Record<'center' | 'corners' | 'five', number[]>> }
export interface Round {
  calls: Call[];
  /** Each seat's five-card poker hand. */
  hands: Card[][];
  /** Seats that won each pot (empty = nobody; that pot went to the poker winners). */
  winners: Record<Pot, number[]>;
}

/** Plays one game to the end. The screen replays the calls one by one. */
export function playRound(rng: Rng, seats: Seat[]): Round {
  const deck = shuffle(newDeck(), rng);
  const called = new Set<string>();
  const winners: Record<Pot, number[]> = { center: [], corners: [], five: [], poker: [] };
  const calls: Call[] = [];
  for (const card of deck) {
    called.add(cardKey(card));
    const won: Call['won'] = {};
    for (const pot of ['center', 'corners', 'five'] as const) {
      if (winners[pot].length) continue;
      const w = seats.flatMap((s, i) => (s.boards.some(n => !!boardState(BOARDS[n - 1], called)[pot]) ? [i] : []));
      if (w.length) { winners[pot] = w; won[pot] = w; }
    }
    calls.push({ card, won });
    if (winners.five.length) break;
  }
  const second = shuffle(newDeck(), rng);
  const hands = seats.map((_, i) => second.slice(i * 5, i * 5 + 5));
  const scores = hands.map(score5);
  const top = Math.max(...scores);
  winners.poker = scores.flatMap((s, i) => (s === top ? [i] : []));
  return { calls, hands, winners };
}

/** Chips in each pot: every board at the table pays the ante into every pot. */
export function potSize(seats: Seat[], ante: number) {
  return ante * seats.reduce((a, s) => a + s.boards.length, 0);
}

/** What each seat takes home. Unwon pots join the poker pot; a split's odd chips go to the first winner. */
export function payouts(round: Round, seats: Seat[], ante: number): number[] {
  const size = potSize(seats, ante);
  const pay = seats.map(() => 0);
  const share = (amount: number, w: number[]) => w.forEach((s, k) => { pay[s] += Math.floor(amount / w.length) + (k === 0 ? amount % w.length : 0); });
  let poker = size;
  for (const pot of ['center', 'corners', 'five'] as const) {
    if (round.winners[pot].length) share(size, round.winners[pot]); else poker += size;
  }
  share(poker, round.winners.poker);
  return pay;
}

/** Board numbers for the computer players: 1 or 2 each, never one already taken. */
export function botBoards(rng: Rng, taken: number[], bots: number): number[][] {
  const free = shuffle(Array.from({ length: BOARD_COUNT }, (_, i) => i + 1).filter(n => !taken.includes(n)), rng);
  return Array.from({ length: bots }, () => free.splice(0, rng() < 0.5 ? 1 : 2));
}
