import type { Card } from './cards';

/** Card value in blackjack: faces 10, ace 11 (soft) or 1. */
export function cardValue(c: Card): number {
  if (c.rank === 14) return 11;
  return Math.min(c.rank, 10);
}

export interface HandTotal { total: number; soft: boolean }

export function handTotal(cards: Card[]): HandTotal {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === 14) aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: Card[]) => cards.length === 2 && handTotal(cards).total === 21;
export const isBust = (cards: Card[]) => handTotal(cards).total > 21;

/** The dealer draws to 17 and stands on every 17, soft or hard. */
export function dealerShouldHit(cards: Card[]): boolean {
  return handTotal(cards).total < 17;
}

export function canSplit(cards: Card[]): boolean {
  return cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);
}

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose';

/**
 * Result of one player hand against the dealer. A blackjack only counts on an unsplit hand.
 * Returns the outcome and the amount paid back (stake included).
 */
export function settle(player: Card[], dealer: Card[], bet: number, fromSplit = false): { outcome: Outcome; payout: number } {
  const p = handTotal(player).total;
  const d = handTotal(dealer).total;
  const pBj = !fromSplit && isBlackjack(player);
  const dBj = isBlackjack(dealer);
  if (p > 21) return { outcome: 'lose', payout: 0 };
  if (pBj && !dBj) return { outcome: 'blackjack', payout: bet + Math.floor(bet * 1.5) };
  if (dBj && !pBj) return { outcome: 'lose', payout: 0 };
  if (pBj && dBj) return { outcome: 'push', payout: bet };
  if (d > 21 || p > d) return { outcome: 'win', payout: bet * 2 };
  if (p === d) return { outcome: 'push', payout: bet };
  return { outcome: 'lose', payout: 0 };
}
