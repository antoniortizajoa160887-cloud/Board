import type { Card } from './cards';

export type PokerHand =
  | 'royal' | 'straightFlush' | 'four' | 'fullHouse' | 'flush' | 'straight'
  | 'three' | 'twoPair' | 'jacks' | 'pair' | 'high';

/** Evaluates a 5-card hand. 'jacks' = a pair of jacks or better, 'pair' = a lower pair. */
export function evaluate(hand: Card[]): PokerHand {
  const ranks = hand.map(c => c.rank).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = hand.every(c => c.suit === hand[0].suit);
  const unique = counts.size === 5;
  const wheel = unique && ranks.join() === '2,3,4,5,14';
  const straight = unique && (ranks[4] - ranks[0] === 4 || wheel);
  if (straight && flush) return ranks[0] === 10 ? 'royal' : 'straightFlush';
  if (groups[0][1] === 4) return 'four';
  if (groups[0][1] === 3 && groups[1][1] === 2) return 'fullHouse';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (groups[0][1] === 3) return 'three';
  if (groups[0][1] === 2 && groups[1][1] === 2) return 'twoPair';
  if (groups[0][1] === 2) return groups[0][0] >= 11 ? 'jacks' : 'pair';
  return 'high';
}

/** Draw poker pay table (times the bet, stake included in the "returns"). */
export const PAYS: Record<PokerHand, number> = {
  royal: 800, straightFlush: 50, four: 25, fullHouse: 9, flush: 6, straight: 4,
  three: 3, twoPair: 2, jacks: 1, pair: 0, high: 0,
};

export const PAY_ORDER: PokerHand[] = ['royal', 'straightFlush', 'four', 'fullHouse', 'flush', 'straight', 'three', 'twoPair', 'jacks'];

export const HAND_NAMES: Record<PokerHand, string> = {
  royal: 'Royal Flush', straightFlush: 'Straight Flush', four: 'Four of a Kind', fullHouse: 'Full House',
  flush: 'Flush', straight: 'Straight', three: 'Three of a Kind', twoPair: 'Two Pair',
  jacks: 'Jacks or Better', pair: 'Low Pair', high: 'No win',
};
