import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { evaluateGrid, LINES, lineWin, spin } from '../src/core/slots';

describe('slots', () => {
  it('pays wilds as any symbol but never as the jackpot', () => {
    expect(lineWin(['wild', 'bell', 'bell', 'pearl', 'star'], 1, 0)).toMatchObject({ sym: 'bell', count: 3, pay: 14 });
    expect(lineWin(['jackpot', 'wild', 'jackpot', 'jackpot', 'jackpot'], 1, 0)).toBeNull();
    expect(lineWin(['jackpot', 'jackpot', 'jackpot', 'jackpot', 'jackpot'], 1, 0)).toMatchObject({ jackpot: true });
  });

  it('returns between 88% and 99% of what is bet over many spins (jackpot left out)', () => {
    const rng = makeRng(42);
    let bet = 0, won = 0;
    for (let i = 0; i < 200000; i++) {
      const { grid } = spin(rng);
      bet += LINES.length;
      for (const w of evaluateGrid(grid, 1)) won += w.pay;
    }
    const rtp = won / bet;
    expect(rtp).toBeGreaterThan(0.88);
    expect(rtp).toBeLessThan(0.99);
  });
});
