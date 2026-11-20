import { describe, expect, it } from 'vitest';
import { botChoice, botJumpIn, canPlay, drawTurn, newDeck, newGame, pass, play, roundPoints, type GameState, type Rules } from '../src/core/colors';
import { makeRng } from '../src/core/rng';

const total = (s: GameState) => s.draw.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);

function playOut(s: GameState, seed: number) {
  const rng = makeRng(seed);
  for (let turn = 0; turn < 5000 && s.winner === null; turn++) {
    const j = botJumpIn(s, rng);
    if (j) { expect(play(s, j.p, j.idx, rng)).toBe(true); continue; }
    const choice = botChoice(s, rng);
    if (choice) expect(play(s, s.current, choice.idx, rng, choice.opts)).toBe(true);
    else {
      const before = s.current;
      drawTurn(s, rng);
      if (s.drawnPlayable !== null && s.current === before) {
        const again = botChoice(s, rng);
        if (again) play(s, s.current, again.idx, rng, again.opts); else pass(s, rng);
      }
    }
    expect(total(s)).toBe(108);
  }
  return s;
}

describe('crazy colors', () => {
  it('has 108 cards', () => {
    expect(newDeck()).toHaveLength(108);
  });

  const combos: Rules[] = [];
  for (let m = 0; m < 16; m++) combos.push({ stacking: !!(m & 1), sevenZero: !!(m & 2), jumpIn: !!(m & 4), drawUntilMatch: !!(m & 8) });

  it('finishes games with every mix of house rules and 2 to 4 players', () => {
    let seed = 1;
    for (const rules of combos) for (const n of [2, 3, 4]) {
      const names = ['A', 'B', 'C', 'D'].slice(0, n);
      const s = playOut(newGame(makeRng(seed), names, rules, []), seed++);
      expect(s.winner).not.toBeNull();
      expect(s.players[s.winner!].hand).toHaveLength(0);
      expect(roundPoints(s)).toBeGreaterThan(0);
    }
  });

  it('only lets a +2 or +4 answer a waiting +2 when stacking', () => {
    const rng = makeRng(3);
    const s = newGame(rng, ['A', 'B'], { stacking: true, sevenZero: false, jumpIn: false, drawUntilMatch: false }, []);
    s.discard.push({ id: 900, color: 'teal', value: 'plus2' });
    s.color = 'teal';
    s.pending = 2;
    expect(canPlay(s, { id: 901, color: 'teal', value: '5' })).toBe(false);
    expect(canPlay(s, { id: 902, color: 'coral', value: 'plus2' })).toBe(true);
    expect(canPlay(s, { id: 903, color: null, value: 'wild4' })).toBe(true);
  });

  it('without stacking, the next player draws 2 and is skipped', () => {
    const rng = makeRng(5);
    const s = newGame(rng, ['A', 'B', 'C'], { stacking: false, sevenZero: false, jumpIn: false, drawUntilMatch: false }, []);
    s.players[0].hand.push({ id: 950, color: s.color, value: 'plus2' });
    const bHand = s.players[1].hand.length;
    expect(play(s, 0, s.players[0].hand.length - 1, rng)).toBe(true);
    expect(s.players[1].hand.length).toBe(bHand + 2);
    expect(s.current).toBe(2);
  });

  it('7 swaps hands with the chosen player', () => {
    const rng = makeRng(8);
    const s = newGame(rng, ['A', 'B', 'C'], { stacking: false, sevenZero: true, jumpIn: false, drawUntilMatch: false }, []);
    s.players[0].hand.push({ id: 960, color: s.color, value: '7' });
    const cHand = [...s.players[2].hand];
    play(s, 0, s.players[0].hand.length - 1, rng, { swapWith: 2 });
    expect(s.players[0].hand).toEqual(cHand);
  });
});
