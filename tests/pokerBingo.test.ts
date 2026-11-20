import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { BOARD_COUNT, BOARDS, CALLS, CENTER, CORNERS, LINES, cardKey, judge, PAY, simulateReturn } from '../src/core/pokerBingo';
import { categoryOf, score5 } from '../src/core/holdem';

describe('Poker Bingo', () => {
  it('has 12 fixed boards of 25 different real cards', () => {
    expect(BOARDS.length).toBe(BOARD_COUNT);
    expect(CALLS).toBe(26);
    for (const b of BOARDS) {
      expect(b.length).toBe(25);
      expect(new Set(b.map(cardKey)).size).toBe(25);
      for (const c of b) { expect(c.rank).toBeGreaterThanOrEqual(2); expect(c.rank).toBeLessThanOrEqual(14); expect('SHDC').toContain(c.suit); }
    }
    expect(new Set(BOARDS.map(b => b.map(cardKey).join())).size).toBe(BOARD_COUNT);
  });
  it('every board: rows and columns make the same hands, a pair or better', () => {
    for (const b of BOARDS) {
      const cats = LINES.map(l => categoryOf(score5(l.map(i => b[i]))));
      expect(cats.sort((a, b) => a - b)).toEqual([1, 1, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });
  it('pays center, corners and the best covered line', () => {
    const b = BOARDS[3];
    const row = [10, 11, 12, 13, 14];
    const called = new Set([...row, ...CORNERS].map(i => cardKey(b[i])));
    const r = judge(b, called);
    expect(r.center).toBe(true);
    expect(r.corners).toBe(true);
    expect(r.line).not.toBeNull();
    expect(r.pay).toBe(PAY.center + PAY.corners + PAY.line[r.hand!]);
    expect(judge(b, new Set([cardKey(b[CENTER])])).pay).toBe(PAY.center);
  });
  it('returns about 94% over many games, and no board is much better than another', () => {
    const rtp = simulateReturn(makeRng(11), 120000);
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(0.98);
    for (let n = 0; n < BOARD_COUNT; n++) {
      const r = simulateReturn(makeRng(100 + n), 40000, n);
      expect(r).toBeGreaterThan(0.88);
      expect(r).toBeLessThan(1);
    }
  });
});
