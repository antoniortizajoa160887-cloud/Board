import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { CALLS, CENTER, CORNERS, cardKey, judge, makeBoard, PAY, simulateReturn } from '../src/core/pokerBingo';

describe('Poker Bingo', () => {
  it('boards hold 25 different cards', () => {
    const b = makeBoard(makeRng(3));
    expect(new Set(b.map(cardKey)).size).toBe(25);
    expect(CALLS).toBe(26);
  });
  it('pays center, corners and the best covered line', () => {
    const b = makeBoard(makeRng(4));
    const row = [10, 11, 12, 13, 14];
    const called = new Set([...row, ...CORNERS].map(i => cardKey(b[i])));
    const r = judge(b, called);
    expect(r.center).toBe(true);
    expect(r.corners).toBe(true);
    expect(r.line).not.toBeNull();
    expect(r.pay).toBe(PAY.center + PAY.corners + PAY.line[r.hand!]);
    expect(judge(b, new Set([cardKey(b[CENTER])])).pay).toBe(PAY.center);
  });
  it('returns about 94% over many games', () => {
    const rtp = simulateReturn(makeRng(11), 120000);
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(0.98);
  });
});
