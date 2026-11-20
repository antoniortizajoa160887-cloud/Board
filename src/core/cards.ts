import { shuffle, type Rng } from './rng';

export type Suit = 'S' | 'H' | 'D' | 'C';
/** Rank 2..14 (11 J, 12 Q, 13 K, 14 A). */
export interface Card { rank: number; suit: Suit }

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function newDeck(decks = 1): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) out.push({ rank, suit });
  return out;
}

export function shuffledDeck(rng: Rng, decks = 1): Card[] {
  return shuffle(newDeck(decks), rng);
}

export function rankLabel(rank: number): string {
  return rank <= 10 ? String(rank) : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[rank];
}

export function isRed(c: Card): boolean {
  return c.suit === 'H' || c.suit === 'D';
}

export const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
