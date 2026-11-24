import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { BOARD_COUNT, BOARDS, CENTER, CORNERS, LINES, boardState, botBoards, cardKey, payouts, playRound, potSize, type Round, type Seat } from '../src/core/pokerBingo';

describe('Poker Bingo', () => {
  it('has 24 fixed boards of 25 different real cards', () => {
    expect(BOARDS.length).toBe(BOARD_COUNT);
    for (const b of BOARDS) {
      expect(b.length).toBe(25);
      expect(new Set(b.map(cardKey)).size).toBe(25);
      for (const c of b) { expect(c.rank).toBeGreaterThanOrEqual(2); expect(c.rank).toBeLessThanOrEqual(14); expect('SHDC').toContain(c.suit); }
    }
    expect(new Set(BOARDS.map(b => b.map(cardKey).join())).size).toBe(BOARD_COUNT);
    expect(LINES.length).toBe(12);
  });

  it('reads center, corners and five in a row', () => {
    const b = BOARDS[0];
    const called = new Set([CENTER, ...CORNERS].map(i => cardKey(b[i])));
    const s = boardState(b, called);
    expect(s.center).toBe(true);
    expect(s.corners).toBe(true);
    expect(s.five).toBe(null);
    [6, 18].forEach(i => called.add(cardKey(b[i])));
    expect(boardState(b, called).five).toEqual([0, 6, 12, 18, 24]);
  });

  it('stops calling at five in a row and the winner really has it', () => {
    const rng = makeRng(7);
    for (let g = 0; g < 200; g++) {
      const seats: Seat[] = [{ boards: [1, 13] }, ...botBoards(rng, [1, 13], 3).map(boards => ({ boards }))];
      const r = playRound(rng, seats);
      const called = new Set(r.calls.map(c => cardKey(c.card)));
      expect(r.winners.five.length).toBeGreaterThan(0);
      for (const w of r.winners.five) expect(seats[w].boards.some(n => boardState(BOARDS[n - 1], called).five)).toBe(true);
      const before = new Set(r.calls.slice(0, -1).map(c => cardKey(c.card)));
      for (const s of seats) expect(s.boards.some(n => boardState(BOARDS[n - 1], before).five)).toBe(false);
      expect(r.hands.every(h => h.length === 5)).toBe(true);
    }
  });

  it('pays out every chip in the pots', () => {
    const rng = makeRng(3);
    for (let g = 0; g < 200; g++) {
      const seats: Seat[] = [{ boards: [2] }, ...botBoards(rng, [2], 2).map(boards => ({ boards }))];
      const r = playRound(rng, seats);
      const pay = payouts(r, seats, 5);
      expect(pay.reduce((a, b) => a + b, 0)).toBe(potSize(seats, 5) * 4);
    }
  });

  it('a pot nobody won goes to the poker pot, splits share it', () => {
    const seats: Seat[] = [{ boards: [1] }, { boards: [2] }];
    const r: Round = { calls: [], hands: [[], []], winners: { center: [0, 1], corners: [], five: [1], poker: [0] } };
    // pot = 2 boards x 10 = 20: center split 10/10, five 20 to seat 1, corners 20 + poker 20 to seat 0
    expect(payouts(r, seats, 10)).toEqual([50, 30]);
  });

  it('bots never take a board that is already in play', () => {
    const rng = makeRng(1);
    for (let g = 0; g < 100; g++) {
      const mine = [3, 4, 15, 22];
      const all = [...mine, ...botBoards(rng, mine, 3).flat()];
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
