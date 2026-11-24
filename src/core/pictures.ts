/**
 * Picture Bingo (Lotería de la Laguna): 36 original picture cards. Ollie turns them from a shuffled
 * deck and calls each one; everyone covers that picture on their 4 × 4 boards.
 *   Line  first to cover a whole row, column or diagonal
 *   Full  first to cover a whole board; this ends the game
 * Players who finish on the same card split the pot.
 */
import { shuffle, type Rng } from './rng';

export const PICS: [id: string, en: string, es: string][] = [
  ['crab', 'The crab', 'El cangrejo'], ['octopus', 'The octopus', 'El pulpo'], ['turtle', 'The sea turtle', 'La tortuga'],
  ['seahorse', 'The seahorse', 'El caballito de mar'], ['starfish', 'The starfish', 'La estrella de mar'], ['dolphin', 'The dolphin', 'El delfín'],
  ['whale', 'The whale', 'La ballena'], ['pelican', 'The pelican', 'El pelícano'], ['flamingo', 'The flamingo', 'El flamenco'],
  ['jellyfish', 'The jellyfish', 'La medusa'], ['puffer', 'The pufferfish', 'El pez globo'], ['shark', 'The shark', 'El tiburón'],
  ['lighthouse', 'The lighthouse', 'El faro'], ['anchor', 'The anchor', 'El ancla'], ['sailboat', 'The sailboat', 'El velero'],
  ['palm', 'The palm tree', 'La palmera'], ['coconut', 'The coconut', 'El coco'], ['pineapple', 'The pineapple', 'La piña'],
  ['shell', 'The seashell', 'La concha'], ['pearl', 'The pearl', 'La perla'], ['chest', 'The treasure chest', 'El cofre'],
  ['parrot', 'The parrot', 'El loro'], ['frog', 'The frog', 'La rana'], ['heron', 'The heron', 'La garza'],
  ['otter', 'The otter', 'La nutria'], ['moon', 'The moon', 'La luna'], ['sun', 'The sun', 'El sol'],
  ['umbrella', 'The beach umbrella', 'La sombrilla'], ['rod', 'The fishing rod', 'La caña de pescar'], ['kite', 'The kite', 'La cometa'],
  ['bucket', 'The bucket', 'La cubeta'], ['sandcastle', 'The sandcastle', 'El castillo de arena'], ['hammock', 'The hammock', 'La hamaca'],
  ['guitar', 'The guitar', 'La guitarra'], ['wave', 'The wave', 'La ola'], ['rainbow', 'The rainbow', 'El arcoíris'],
];
export const PIC_COUNT = PICS.length;
export const SIZE = 4;

/** Rows, columns and the two diagonals of a 4 × 4 board. */
export const PIC_LINES: number[][] = [
  ...[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => r * 4 + c)),
  ...[0, 1, 2, 3].map(c => [0, 1, 2, 3].map(r => r * 4 + c)),
  [0, 5, 10, 15], [3, 6, 9, 12],
];

/** A board: 16 different picture numbers (0-35). */
export const newBoard = (rng: Rng): number[] => shuffle(Array.from({ length: PIC_COUNT }, (_, i) => i), rng).slice(0, 16);

export function picState(board: number[], called: Set<number>) {
  const hit = (i: number) => called.has(board[i]);
  return {
    line: PIC_LINES.find(l => l.every(hit)) ?? null,
    full: board.every(p => called.has(p)),
    covered: board.filter(p => called.has(p)).length,
  };
}

export type PicPot = 'line' | 'full';
export interface PicCall { pic: number; won: Partial<Record<PicPot, number[]>> }
export interface PicRound { calls: PicCall[]; winners: Record<PicPot, number[]> }

/** Plays a whole game for seats that each hold some boards. The screen replays it call by call. */
export function playPictures(rng: Rng, seats: number[][][]): PicRound {
  const deck = shuffle(Array.from({ length: PIC_COUNT }, (_, i) => i), rng);
  const called = new Set<number>();
  const winners: Record<PicPot, number[]> = { line: [], full: [] };
  const calls: PicCall[] = [];
  for (const pic of deck) {
    called.add(pic);
    const won: PicCall['won'] = {};
    for (const pot of ['line', 'full'] as const) {
      if (winners[pot].length) continue;
      const w = seats.flatMap((boards, i) => (boards.some(b => (pot === 'line' ? picState(b, called).line : picState(b, called).full)) ? [i] : []));
      if (w.length) { winners[pot] = w; won[pot] = w; }
    }
    calls.push({ pic, won });
    if (winners.full.length) break;
  }
  return { calls, winners };
}

/** What each seat takes home: every board pays the ante into each pot; ties split, odd chips to the first. */
export function picPayouts(round: PicRound, seats: number[][][], ante: number): number[] {
  const size = ante * seats.reduce((a, s) => a + s.length, 0);
  const pay = seats.map(() => 0);
  for (const pot of ['line', 'full'] as const) {
    const w = round.winners[pot];
    w.forEach((s, k) => { pay[s] += Math.floor(size / w.length) + (k === 0 ? size % w.length : 0); });
  }
  return pay;
}
