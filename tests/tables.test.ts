import { describe, expect, it } from 'vitest';
import { bacPayout, bankerDraws, playCoup, total } from '../src/core/baccarat';
import { shuffledDeck, type Card } from '../src/core/cards';
import { roll, type CrapsState } from '../src/core/craps';
import { makeRng, randInt } from '../src/core/rng';

const c = (rank: number): Card => ({ rank, suit: 'S' });

describe('baccarat', () => {
  it('counts pictures and tens as 0 and keeps the last digit', () => {
    expect(total([c(13), c(9)])).toBe(9);
    expect(total([c(7), c(8)])).toBe(5);
    expect(total([c(14), c(10)])).toBe(1);
  });
  it('follows the banker drawing table', () => {
    expect(bankerDraws(3, c(8))).toBe(false);
    expect(bankerDraws(3, c(9))).toBe(true);
    expect(bankerDraws(4, c(14))).toBe(false);
    expect(bankerDraws(6, c(6))).toBe(true);
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(5, null)).toBe(true);
    expect(bankerDraws(7, c(2))).toBe(false);
  });
  it('stands on a natural', () => {
    const cards = [c(8), c(2), c(13), c(3), c(5), c(5)];
    const coup = playCoup(() => cards.shift()!);
    expect(coup.natural).toBe(true);
    expect(coup.player).toHaveLength(2);
    expect(coup.winner).toBe('player');
  });
  it('pays like a casino: banker about 98.9%, player about 98.8%', () => {
    const rng = makeRng(7);
    let deck = shuffledDeck(rng, 8);
    const next = () => { if (deck.length < 20) deck = shuffledDeck(rng, 8); return deck.pop()!; };
    let bank = 0, play = 0, tie = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const w = playCoup(next).winner;
      bank += bacPayout('banker', 100, w); play += bacPayout('player', 100, w); tie += bacPayout('tie', 100, w);
    }
    expect(bank / (N * 100)).toBeGreaterThan(0.98); expect(bank / (N * 100)).toBeLessThan(1);
    expect(play / (N * 100)).toBeGreaterThan(0.98); expect(play / (N * 100)).toBeLessThan(1);
    expect(tie / (N * 100)).toBeGreaterThan(0.8); expect(tie / (N * 100)).toBeLessThan(0.92);
  });
});

describe('craps', () => {
  it('pass wins on 7 at come-out and loses on 2', () => {
    const s: CrapsState = { point: null, bets: { pass: 10, dontPass: 10 } };
    const r = roll(s, 3, 4);
    expect(r.returned.pass).toBe(20);
    expect(r.lost).toContain('dontPass');
    const s2: CrapsState = { point: null, bets: { pass: 10, dontPass: 10 } };
    const r2 = roll(s2, 1, 1);
    expect(r2.lost).toContain('pass');
    expect(r2.returned.dontPass).toBe(20);
  });
  it("don't pass pushes on 12", () => {
    const s: CrapsState = { point: null, bets: { dontPass: 10 } };
    expect(roll(s, 6, 6).returned.dontPass).toBe(10);
  });
  it('sets a point, pays pass and true odds when it repeats', () => {
    const s: CrapsState = { point: null, bets: { pass: 10 } };
    expect(roll(s, 2, 2).newPoint).toBe(4);
    s.bets.odds = 20;
    expect(roll(s, 5, 1).newPoint).toBe(4);
    const r = roll(s, 1, 3);
    expect(r.returned.pass).toBe(20);
    expect(r.returned.odds).toBe(60);
    expect(s.point).toBe(null);
  });
  it('seven-out loses pass and odds', () => {
    const s: CrapsState = { point: 6, bets: { pass: 10, odds: 10, dontPass: 5 } };
    const r = roll(s, 3, 4);
    expect(r.message).toBe('seven-out');
    expect(r.lost).toEqual(expect.arrayContaining(['pass', 'odds']));
    expect(r.returned.dontPass).toBe(10);
  });
  it('pass line returns about 98.6%', () => {
    const rng = makeRng(3);
    let back = 0, games = 0;
    for (let i = 0; i < 300000; i++) {
      const s: CrapsState = { point: null, bets: { pass: 10 } };
      games++;
      for (;;) {
        const r = roll(s, randInt(rng, 6) + 1, randInt(rng, 6) + 1);
        if (!s.bets.pass) { back += r.returned.pass ?? 0; break; }
      }
    }
    const rtp = back / (games * 10);
    expect(rtp).toBeGreaterThan(0.98);
    expect(rtp).toBeLessThan(0.992);
  });
});
