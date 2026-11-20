import { describe, expect, it } from 'vitest';
import type { Card } from '../src/core/cards';
import { handTotal, settle } from '../src/core/blackjack';
import { evaluate } from '../src/core/poker';
import { colorOf, payout, WHEEL_ORDER } from '../src/core/roulette';
import { BALLS_PER_GAME, drawOrder, makeCard, PRIZE_PAYS, prizes } from '../src/core/bingo';
import { makeRng } from '../src/core/rng';

const c = (s: string): Card => {
  const r = s.slice(0, -1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return { rank, suit: s.slice(-1) as Card['suit'] };
};
const h = (s: string) => s.split(' ').map(c);

describe('blackjack', () => {
  it('counts aces as 1 or 11', () => {
    expect(handTotal(h('AS 6H'))).toEqual({ total: 17, soft: true });
    expect(handTotal(h('AS 6H 9D'))).toEqual({ total: 16, soft: false });
    expect(handTotal(h('AS AH KD'))).toEqual({ total: 12, soft: false });
  });
  it('pays blackjack 3 to 2, and not after a split', () => {
    expect(settle(h('AS KH'), h('10D 8C'), 10)).toEqual({ outcome: 'blackjack', payout: 25 });
    expect(settle(h('AS KH'), h('10D 8C'), 10, true)).toEqual({ outcome: 'win', payout: 20 });
    expect(settle(h('10S 8H'), h('10D 8C'), 10).outcome).toBe('push');
    expect(settle(h('10S 8H 5C'), h('10D 6C 9S'), 10).outcome).toBe('lose');
  });
});

describe('poker', () => {
  it('ranks hands', () => {
    expect(evaluate(h('10S JS QS KS AS'))).toBe('royal');
    expect(evaluate(h('AS 2D 3C 4H 5S'))).toBe('straight');
    expect(evaluate(h('JS JD 3C 4H 9S'))).toBe('jacks');
    expect(evaluate(h('10S 10D 3C 4H 9S'))).toBe('pair');
    expect(evaluate(h('9S 9D 9C 4H 4S'))).toBe('fullHouse');
  });
});

describe('roulette', () => {
  it('has 37 pockets, one green', () => {
    expect(new Set(WHEEL_ORDER).size).toBe(37);
    expect(WHEEL_ORDER.filter(n => colorOf(n) === 'green')).toEqual([0]);
  });
  it('pays straight up 35 to 1 and loses outside bets on zero', () => {
    expect(payout({ n17: 10, red: 10 }, 17)).toBe(360);
    expect(payout({ red: 10, d0: 10 }, 0)).toBe(0);
    expect(payout({ c0: 10 }, 34)).toBe(30);
  });
});

describe('bingo', () => {
  it('makes valid cards and pays back less than it costs on average', () => {
    const rng = makeRng(9);
    const card = makeCard(rng);
    expect(card[12]).toBe(0);
    expect(new Set(card).size).toBe(25);
    let paid = 0;
    const games = 20000;
    for (let g = 0; g < games; g++) {
      const k = makeCard(rng);
      const called = new Set(drawOrder(rng).slice(0, BALLS_PER_GAME));
      for (const p of prizes(k, called)) paid += PRIZE_PAYS[p];
    }
    const rtp = paid / games;
    console.log('bingo rtp', rtp);
    expect(rtp).toBeGreaterThan(0.8);
    expect(rtp).toBeLessThan(1);
  });
});
