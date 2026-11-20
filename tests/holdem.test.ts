import { describe, expect, it } from 'vitest';
import type { Card } from '../src/core/cards';
import { act, award, best, botAction, categoryOf, newHand, pot, score5, type Hand, type Seat } from '../src/core/holdem';
import { makeRng } from '../src/core/rng';

const P = (s: string): Card[] => s.split(' ').map(t => ({ rank: '23456789TJQKA'.indexOf(t[0]) + 2, suit: t[1] as Card['suit'] }));
const seat = (name: string, stack: number, bot = true): Seat => ({ name, stack, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, bot, out: false });

describe("hold'em hand ranking", () => {
  it('orders the categories', () => {
    const hands = ['2S 3D 5H 9C KD', '2S 2D 5H 9C KD', '2S 2D 5H 5C KD', '2S 2D 2H 9C KD', 'AS 2D 3H 4C 5D', '2S 7S 5S 9S KS', '2S 2D 2H 9C 9D', '2S 2D 2H 2C KD', '5S 6S 7S 8S 9S']
      .map(x => score5(P(x)));
    for (let i = 1; i < hands.length; i++) expect(hands[i]).toBeGreaterThan(hands[i - 1]);
    expect(hands.map(categoryOf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('uses kickers and the wheel', () => {
    expect(score5(P('AS AD KH 4C 3D'))).toBeGreaterThan(score5(P('AH AC QH JC TD')));
    expect(score5(P('6S 2D 3H 4C 5D'))).toBeGreaterThan(score5(P('AS 2D 3H 4C 5D')));
  });
  it('finds the best 5 of 7 and of 6', () => {
    expect(categoryOf(best(P('AS KS 2D 7S 9S 4H 3S')).score)).toBe(5);
    expect(categoryOf(best(P('AS AD 2D 7S 9S 4H')).score)).toBe(1);
  });
});

describe("hold'em betting", () => {
  it('posts blinds and pays the last player when everyone folds', () => {
    const seats = [seat('You', 1000, false), seat('A', 1000), seat('B', 1000)];
    const h = newHand(seats, 0, 20, makeRng(1));
    expect(pot(h)).toBe(30);
    act(h, { type: 'fold' });
    act(h, { type: 'fold' });
    expect(h.street).toBe('showdown');
    expect(seats.reduce((a, s) => a + s.stack, 0)).toBe(3000);
  });
  it('splits side pots: a short all-in can only win what it matched', () => {
    const seats = [seat('A', 100), seat('B', 500), seat('C', 500)];
    const h: Hand = { seats, deck: [], board: P('2S 7D 9C JH 3S'), dealer: 0, bb: 20, street: 'river', toAct: -1, currentBet: 0, minRaise: 20, results: null };
    seats[0].hole = P('AS AD'); seats[1].hole = P('KS KD'); seats[2].hole = P('4C 5C');
    seats[0].total = 100; seats[1].total = 400; seats[2].total = 400;
    seats.forEach(s => { s.stack -= s.total; });
    award(h);
    expect(seats[0].stack).toBe(300);
    expect(seats[1].stack).toBe(100 + 600);
    expect(seats[2].stack).toBe(100);
  });
  it('bots play many hands without losing or making chips', () => {
    const rng = makeRng(9);
    const seats = [seat('A', 1000), seat('B', 1000), seat('C', 1000), seat('D', 1000)];
    let dealer = 0;
    for (let n = 0; n < 150; n++) {
      if (seats.filter(s => s.stack > 0).length < 2) break;
      const h = newHand(seats, dealer, 20, rng);
      let guard = 0;
      while (h.street !== 'showdown' && guard++ < 200) act(h, botAction(h, rng));
      expect(h.street).toBe('showdown');
      expect(seats.reduce((a, s) => a + s.stack, 0)).toBe(4000);
      do dealer = (dealer + 1) % 4; while (seats[dealer].stack <= 0);
    }
  });
});
