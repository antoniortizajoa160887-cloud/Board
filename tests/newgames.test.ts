import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { newBoard, PICS, picPayouts, picState, playPictures } from '../src/core/pictures';
import { domBot, domDraw, domMoves, domPass, domPlay, domScore, fullSet, handPips, newDomGame } from '../src/core/dominoes';
import { HOME, NEST, newRace, raceApply, raceBot, raceEndTurn, raceMoves, roll, TRACK_CELLS, LANE_CELLS } from '../src/core/race';
import { HOLES, POINTS, newStars, reach, starBot, starMove, NEIGHBOURS, at } from '../src/core/stars';
import { BOXES, boxScore, botBox, botKeep, done, newDive, diveRoll, diveBank, botBanks, rollDie, score, total, type Sheet } from '../src/core/dice';
import { allSunk, botShot, fire, newSea, placeFleet, N } from '../src/core/fleet';
import { rumScore, findMelds, fishAsk, fishBot, isRun, isSet, newFish, newRummy, rumBot } from '../src/core/rummy';

describe('Picture Bingo', () => {
  it('has 36 pictures and boards of 16 different ones', () => {
    expect(PICS.length).toBe(36);
    expect(new Set(PICS.map(p => p[0])).size).toBe(36);
    const b = newBoard(makeRng(1));
    expect(new Set(b).size).toBe(16);
  });
  it('ends on a full board and pays out every chip', () => {
    const rng = makeRng(4);
    for (let g = 0; g < 100; g++) {
      const seats = [[newBoard(rng), newBoard(rng)], [newBoard(rng)], [newBoard(rng)]];
      const r = playPictures(rng, seats);
      const called = new Set(r.calls.map(c => c.pic));
      expect(r.winners.full.length).toBeGreaterThan(0);
      expect(r.winners.line.length).toBeGreaterThan(0);
      for (const w of r.winners.full) expect(seats[w].some(b => picState(b, called).full)).toBe(true);
      expect(picPayouts(r, seats, 5).reduce((a, b) => a + b, 0)).toBe(5 * 4 * 2);
    }
  });
});

describe('Dominoes', () => {
  it('has 28 tiles and deals 7 each', () => {
    expect(fullSet().length).toBe(28);
    const g = newDomGame(makeRng(2), 4, 'block');
    expect(g.hands.every(h => h.length === 7)).toBe(true);
    expect(g.yard.length).toBe(0);
  });
  it('bots finish every game with a matching line', () => {
    const rng = makeRng(9);
    for (let n = 0; n < 200; n++) {
      const g = newDomGame(rng, 2 + (n % 3), n % 2 ? 'draw' : 'block');
      let guard = 0;
      while (g.winner === null && guard++ < 500) {
        const m = domBot(g);
        if (m) domPlay(g, m);
        else if (!domDraw(g)) domPass(g);
      }
      expect(g.winner).not.toBeNull();
      for (let i = 1; i < g.line.length; i++) expect(g.line[i - 1][1]).toBe(g.line[i][0]);
      expect(domScore(g)).toBe(g.hands.reduce((s, h, i) => (i === g.winner ? s : s + handPips(h)), 0));
      if (!g.blocked) expect(g.hands[g.winner!].length).toBe(0);
    }
  });
  it('offers both ends when a tile fits either side', () => {
    const g = newDomGame(makeRng(1), 2, 'block');
    g.line = [[3, 5]]; g.turn = 0; g.hands[0] = [[3, 5]];
    expect(domMoves(g, 0).map(m => m.side).sort()).toEqual(['L', 'R']);
  });
});

describe('Lagoon Race', () => {
  it('lays out 52 track squares and 4 lanes without overlap', () => {
    const all = [...TRACK_CELLS, ...LANE_CELLS.flat()].map(([r, c]) => `${r},${c}`);
    expect(TRACK_CELLS.length).toBe(52);
    expect(new Set(all).size).toBe(all.length);
  });
  it('bots play whole games to the end', () => {
    const rng = makeRng(5);
    for (let n = 0; n < 40; n++) {
      const g = newRace(2 + (n % 3));
      let turns = 0;
      while (g.winner === null && turns++ < 5000) {
        roll(g, rng);
        for (let m = raceBot(g, rng); m; m = raceBot(g, rng)) raceApply(g, m);
        raceEndTurn(g);
      }
      expect(g.winner).not.toBeNull();
      expect(g.tokens[g.winner!].every(t => t === HOME)).toBe(true);
    }
  });
  it('needs a 5 to leave the nest', () => {
    const g = newRace(2);
    g.dice = [3, 4];
    expect(raceMoves(g).length).toBe(0);
    g.dice = [2, 3];
    expect(raceMoves(g).some(m => m.use.length === 2 && m.to === 0)).toBe(true);
    expect(g.tokens[0][0]).toBe(NEST);
  });
});

describe('Star Checkers', () => {
  it('has 121 holes and six points of 10', () => {
    expect(HOLES.length).toBe(121);
    expect(POINTS.every(p => p.length === 10)).toBe(true);
    expect(new Set(POINTS.flat()).size).toBe(60);
    expect(NEIGHBOURS[at(0, 0)].every(n => n >= 0)).toBe(true);
  });
  it('jumps chain over marbles', () => {
    const g = newStars(2);
    g.board.fill(-1);
    const a = at(0, 0), b = at(1, 0), c = at(3, 0);
    g.board[a] = 0; g.board[b] = 1; g.board[c] = 1;
    const r = reach(g, a);
    expect(r.get(at(4, 0))).toEqual([a, at(2, 0), at(4, 0)]);
  });
  it('computer players finish a game', () => {
    for (const n of [2, 3] as const) {
      const g = newStars(n);
      const rng = makeRng(n);
      let guard = 0;
      while (g.winner === null && guard++ < 3000) { const m = starBot(g, rng, 3); if (!m) break; starMove(g, m[0], m[1]); }
      expect(g.winner).not.toBeNull();
    }
  });
});

describe('Five Dice and Pearl Diver', () => {
  it('scores the boxes', () => {
    expect(boxScore('full', [2, 2, 3, 3, 3])).toBe(25);
    expect(boxScore('small', [1, 2, 3, 4, 6])).toBe(30);
    expect(boxScore('large', [2, 3, 4, 5, 6])).toBe(40);
    expect(boxScore('four', [5, 5, 5, 5, 2])).toBe(22);
    expect(boxScore('five', [6, 6, 6, 6, 6])).toBe(50);
    expect(boxScore('threes', [3, 3, 1, 3, 2])).toBe(9);
  });
  it('a bot fills a whole sheet', () => {
    const rng = makeRng(3);
    const s: Sheet = {};
    for (let t = 0; t < 13; t++) {
      let d = Array.from({ length: 5 }, () => rollDie(rng));
      for (let r = 0; r < 2; r++) { const k = botKeep(s, d); d = d.map((v, i) => (k[i] ? v : rollDie(rng))); }
      score(s, botBox(s, d), d);
    }
    expect(done(s)).toBe(true);
    expect(BOXES.every(b => s[b] !== undefined)).toBe(true);
    expect(total(s)).toBeGreaterThan(50);
  });
  it('Pearl Diver: a 1 loses the dive, banking adds it', () => {
    const g = newDive(2);
    diveRoll(g, 6); diveRoll(g, 5);
    expect(g.dive).toBe(11);
    diveBank(g);
    expect(g.banked[0]).toBe(11);
    expect(g.turn).toBe(1);
    diveRoll(g, 4); diveRoll(g, 1);
    expect(g.banked[1]).toBe(0);
    expect(g.turn).toBe(0);
    g.dive = 25; expect(botBanks(g)).toBe(true);
  });
});

describe('Sink the Fleet', () => {
  it('places five boats that never touch', () => {
    const rng = makeRng(8);
    for (let n = 0; n < 50; n++) {
      const boats = placeFleet(rng);
      expect(boats.map(b => b.cells.length)).toEqual([5, 4, 3, 3, 2]);
      const owner = new Map<number, number>();
      boats.forEach((b, k) => b.cells.forEach(c => owner.set(c, k)));
      for (const [c, k] of owner) for (const d of [-N - 1, -N, -N + 1, -1, 1, N - 1, N, N + 1]) {
        const o = owner.get(c + d);
        if (o !== undefined && Math.abs(((c + d) % N) - (c % N)) <= 1) expect(o).toBe(k);
      }
    }
  });
  it('the computer sinks a fleet in a sensible number of shots', () => {
    const rng = makeRng(2);
    let shots = 0;
    for (let n = 0; n < 20; n++) {
      const s = newSea(placeFleet(rng));
      while (!allSunk(s)) { fire(s, botShot(s, rng)); shots++; }
    }
    expect(shots / 20).toBeLessThan(70);
  });
});

describe('Rummy and Go Fish', () => {
  it('knows sets and runs (aces low)', () => {
    expect(isSet([{ rank: 7, suit: 'S' }, { rank: 7, suit: 'H' }, { rank: 7, suit: 'D' }])).toBe(true);
    expect(isRun([{ rank: 14, suit: 'S' }, { rank: 2, suit: 'S' }, { rank: 3, suit: 'S' }])).toBe(true);
    expect(isRun([{ rank: 13, suit: 'S' }, { rank: 14, suit: 'S' }, { rank: 2, suit: 'S' }])).toBe(false);
    expect(findMelds([{ rank: 4, suit: 'H' }, { rank: 5, suit: 'H' }, { rank: 6, suit: 'H' }, { rank: 9, suit: 'C' }]).length).toBe(1);
  });
  it('bots play Rummy rounds to the end without losing cards', () => {
    const rng = makeRng(6);
    for (let n = 0; n < 60; n++) {
      const g = newRummy(rng, 2 + (n % 3));
      let guard = 0;
      while (g.winner === null && guard++ < 2000) rumBot(g);
      expect(g.winner).not.toBeNull();
      const cards = g.hands.flat().length + g.stock.length + g.discard.length + g.melds.flat().length;
      expect(cards).toBe(52);
      expect(rumScore(g)).toBeGreaterThanOrEqual(0);
    }
  });
  it('bots play Go Fish until all 13 books are made', () => {
    const rng = makeRng(7);
    for (let n = 0; n < 60; n++) {
      const g = newFish(rng, 2 + (n % 3));
      let guard = 0;
      while (!g.over && guard++ < 2000) { const [t, r] = fishBot(g, rng); fishAsk(g, t, r); }
      expect(g.over).toBe(true);
      expect(g.books.flat().length).toBe(13);
    }
  });
});

describe('Memory match', () => {
  it('deals pairs and Ollie with a perfect memory clears the board', async () => {
    const { deal, olliePick, stars } = await import('../src/core/memory');
    const rng = makeRng(3);
    const deck = deal(rng, 24, 36);
    expect(deck.length).toBe(24);
    expect(new Set(deck).size).toBe(12);
    const open = deck.map(() => false), seen = new Map<number, number>();
    let turns = 0;
    while (open.some(o => !o) && turns < 200) {
      turns++;
      const a = olliePick(deck, open, seen, rng); seen.set(a, deck[a]);
      const b = olliePick(deck, open, seen, rng, a); seen.set(b, deck[b]);
      if (deck[a] === deck[b]) { open[a] = open[b] = true; seen.delete(a); seen.delete(b); }
    }
    expect(open.every(Boolean)).toBe(true);
    expect(turns).toBeLessThan(40);
    expect(stars(6, 9)).toBe(3);
    expect(stars(6, 30)).toBe(1);
  });
});
