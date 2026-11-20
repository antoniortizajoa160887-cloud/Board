/** Punto banco baccarat. Card values: ace 1, 2–9 face value, 10 and pictures 0. Totals keep only the last digit. */
import type { Card } from './cards';

export const point = (c: Card) => (c.rank === 14 ? 1 : c.rank >= 10 ? 0 : c.rank);
export const total = (cs: Card[]) => cs.reduce((a, c) => a + point(c), 0) % 10;

export interface Coup { player: Card[]; banker: Card[]; winner: 'player' | 'banker' | 'tie'; natural: boolean }

/** Whether the banker draws a third card, given the banker's total and the player's third card (null if the player stood). */
export function bankerDraws(bankerTotal: number, playerThird: Card | null): boolean {
  if (playerThird === null) return bankerTotal <= 5;
  const p = point(playerThird);
  switch (bankerTotal) {
    case 0: case 1: case 2: return true;
    case 3: return p !== 8;
    case 4: return p >= 2 && p <= 7;
    case 5: return p >= 4 && p <= 7;
    case 6: return p === 6 || p === 7;
    default: return false;
  }
}

/** Plays one coup from the shoe (draws with next()). Cards go player, banker, player, banker. */
export function playCoup(next: () => Card): Coup {
  const player = [next()], banker = [next()];
  player.push(next()); banker.push(next());
  let natural = total(player) >= 8 || total(banker) >= 8;
  if (!natural) {
    let third: Card | null = null;
    if (total(player) <= 5) { third = next(); player.push(third); }
    if (bankerDraws(total(banker), third)) banker.push(next());
  }
  const p = total(player), b = total(banker);
  return { player, banker, winner: p > b ? 'player' : b > p ? 'banker' : 'tie', natural };
}

export type BacBet = 'player' | 'banker' | 'tie';

/** Chips returned for a bet (stake included). Banker pays 19 to 20 (5% fee). Player and banker bets push on a tie. */
export function bacPayout(bet: BacBet, amount: number, winner: Coup['winner']): number {
  if (bet === 'tie') return winner === 'tie' ? amount * 9 : 0;
  if (winner === 'tie') return amount;
  if (bet !== winner) return 0;
  return bet === 'banker' ? amount + Math.floor(amount * 0.95) : amount * 2;
}
