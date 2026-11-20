import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import {
  applyOffer, BOARD, botAccepts, botTurn, build, buy, canBuild, endTurn, FOG, groupLots, leaveFog, mortgage,
  netWorth, newGame, pass, PASS_START, rentFor, roll, START_CASH,
} from '../src/core/tycoon';

const four = () => newGame([
  { name: 'You', token: 'a', bot: false }, { name: 'B1', token: 'b', bot: true },
  { name: 'B2', token: 'c', bot: true }, { name: 'B3', token: 'd', bot: true },
], makeRng(1));

describe('Harbor Tycoon board', () => {
  it('has 32 spaces, 6 districts of 3 lots, 4 ferries', () => {
    expect(BOARD.length).toBe(32);
    for (let g = 0; g < 6; g++) expect(groupLots(g).length).toBe(3);
    expect(BOARD.filter(s => s.kind === 'ferry').length).toBe(4);
    expect(BOARD[FOG].kind).toBe('fog');
  });
});

describe('Harbor Tycoon rules', () => {
  it('moves, buys and charges rent; full district doubles rent', () => {
    const g = four(), rng = makeRng(2);
    roll(g, rng, [1, 2]); // to space 3? 0+3 = bottle; use 1+0 instead
    expect(g.players[0].pos).toBe(3);
    const g2 = four();
    roll(g2, rng, [1, 1]); // doubles to 2 → Driftwood Lane
    expect(g2.phase).toBe('buy');
    expect(buy(g2)).toBe(true);
    expect(g2.players[0].cash).toBe(START_CASH - 60);
    expect(g2.phase).toBe('roll'); // doubles → roll again
    g2.deeds[1] = { owner: 0, level: 0, mortgaged: false };
    g2.deeds[4] = { owner: 0, level: 0, mortgaged: false };
    expect(rentFor(g2, 2, 7)).toBe(BOARD[2].rent![0] * 2);
    expect(canBuild(g2, 0, 2)).toBe(true);
    expect(build(g2, 0, 2)).toBe(true);
    expect(canBuild(g2, 0, 2)).toBe(false); // must build evenly
    expect(rentFor(g2, 2, 7)).toBe(BOARD[2].rent![1]);
  });

  it('pays salary when passing the Lighthouse', () => {
    const g = four();
    g.players[0].pos = 30;
    roll(g, makeRng(3), [2, 1]);
    expect(g.players[0].pos).toBe(1);
    expect(g.players[0].cash).toBe(START_CASH + PASS_START);
    pass(g);
  });

  it('three doubles sends you to the Fog Bank, and you can pay out', () => {
    const g = four(), rng = makeRng(4);
    g.players[0].doubles = 2;
    roll(g, rng, [3, 3]);
    expect(g.players[0].pos).toBe(FOG);
    expect(g.players[0].fog).toBeGreaterThan(0);
    endTurn(g); for (let k = 0; k < 3; k++) { g.current = (g.current + 1) % 4; } g.current = 0; g.phase = 'roll';
    expect(leaveFog(g, false)).toBe(true);
    expect(g.players[0].fog).toBe(0);
  });

  it('mortgage stops rent', () => {
    const g = four();
    g.deeds[1] = { owner: 1, level: 0, mortgaged: false };
    expect(mortgage(g, 1, 1)).toBe(true);
    expect(rentFor(g, 1, 5)).toBe(0);
  });

  it('bots value completing a district and trades move deeds', () => {
    const g = four();
    g.deeds[1] = { owner: 1, level: 0, mortgaged: false };
    g.deeds[2] = { owner: 1, level: 0, mortgaged: false };
    g.deeds[4] = { owner: 0, level: 0, mortgaged: false };
    g.deeds[31] = { owner: 1, level: 0, mortgaged: false };
    expect(botAccepts(g, { from: 0, to: 1, give: [4], get: [], cash: 0 })).toBe(true);
    expect(botAccepts(g, { from: 0, to: 1, give: [], get: [31], cash: 10 })).toBe(false);
    expect(applyOffer(g, { from: 0, to: 1, give: [4], get: [], cash: -100 })).toBe(true);
    expect(g.deeds[4]!.owner).toBe(1);
    expect(g.players[0].cash).toBe(START_CASH + 100);
  });

  it('a full bot game finishes with a winner and no negative cash', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame([1, 2, 3, 4].map(i => ({ name: `B${i}`, token: 'x', bot: true })), makeRng(seed), 40);
      const rng = makeRng(seed * 7);
      let guard = 0;
      while (g.phase !== 'over' && guard++ < 1000) {
        botTurn(g, rng);
        for (const p of g.players) expect(p.cash).toBeGreaterThanOrEqual(0);
      }
      expect(g.phase).toBe('over');
      expect(g.winner).not.toBeNull();
      expect(netWorth(g, g.winner!)).toBeGreaterThan(0);
    }
  });
});
