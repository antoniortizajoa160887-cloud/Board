import { describe, expect, it } from 'vitest';
import { drawKeno, kenoReturn } from '../src/core/keno';
import { makeRng } from '../src/core/rng';

describe('keno', () => {
  it('draws 20 different numbers from 1 to 80', () => {
    const d = drawKeno(makeRng(4));
    expect(new Set(d).size).toBe(20);
    expect(Math.min(...d)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...d)).toBeLessThanOrEqual(80);
  });
  for (let p = 1; p <= 10; p++) {
    it(`${p} picks returns 88–96%`, () => {
      const r = kenoReturn(p);
      expect(r).toBeGreaterThan(0.88);
      expect(r).toBeLessThan(0.96);
    });
  }
});
