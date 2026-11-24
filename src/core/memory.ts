/**
 * Memory match: pairs of picture cards face down. Turn two over; a pair stays up, otherwise they flip back.
 * Solo you earn stars for finding every pair in few turns; against Ollie, a pair also earns another turn
 * and whoever finds more pairs wins.
 */
import { shuffle, type Rng } from './rng';

export const SIZES = [12, 16, 20, 24];

/** A shuffled deck of picture indexes, each twice. */
export function deal(rng: Rng, cards: number, pictures: number): number[] {
  const pics = shuffle(Array.from({ length: pictures }, (_, i) => i), rng).slice(0, cards / 2);
  return shuffle([...pics, ...pics], rng);
}

/** Stars for a solo game: 3 when nearly perfect, 2 when good, else 1. */
export function stars(pairs: number, turns: number): 1 | 2 | 3 {
  if (turns <= Math.ceil(pairs * 1.5)) return 3;
  if (turns <= Math.ceil(pairs * 2.2)) return 2;
  return 1;
}

/**
 * Ollie's two picks. `seen` holds what he remembers (card index → picture). He takes a pair he knows,
 * else turns an unknown card and, if he remembers its partner, takes that.
 */
export function olliePick(deck: number[], open: boolean[], seen: Map<number, number>, rng: Rng, first?: number): number {
  const hidden = deck.map((_, i) => i).filter(i => !open[i] && i !== first);
  const known = (i: number) => seen.has(i) && i !== first;
  if (first === undefined) {
    for (const i of hidden) for (const j of hidden) if (i < j && known(i) && known(j) && seen.get(i) === seen.get(j)) return i;
    const unknown = hidden.filter(i => !seen.has(i));
    const pool = unknown.length ? unknown : hidden;
    return pool[Math.floor(rng() * pool.length)];
  }
  const match = hidden.find(i => known(i) && seen.get(i) === deck[first]);
  if (match !== undefined) return match;
  const unknown = hidden.filter(i => !seen.has(i));
  const pool = unknown.length ? unknown : hidden;
  return pool[Math.floor(rng() * pool.length)];
}
