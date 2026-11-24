/**
 * Lagoon Race: a race game in the Parcheesi family for 2 to 4 players, on a cross-shaped board.
 * Each player has 4 tokens in their nest. Roll two dice and use each die on one token (the same or
 * different tokens).
 *   - A 5 on a die (or two dice that add up to 5) brings a token out of the nest onto your start square.
 *   - Land on a lone rival token on a plain square and it goes back to its nest; you get 10 extra steps.
 *   - Start squares and the star squares are safe: nobody can be captured there.
 *   - After 51 squares a token turns into your home lane; it needs the exact count to reach home.
 *     Getting a token home gives 10 extra steps too.
 *   - Doubles roll again (but the third double in a row ends the turn).
 * First to bring all four tokens home wins.
 */
import type { Rng } from './rng';

export const TRACK = 52, LANE = 5, HOME = 56, NEST = -1;
/** Seat k starts on track square 1 + 13k; seat 0 is the left arm, then clockwise. */
export const startOf = (seat: number) => 1 + 13 * seat;
const SAFE_REL = [0, 8, 13, 21, 26, 34, 39, 47];
/** Track square (0-51) of a relative position (0-50), or -1 if in the nest, lane or home. */
export const trackSquare = (seat: number, rel: number) => (rel >= 0 && rel <= 50 ? (startOf(seat) + rel) % TRACK : -1);
export const isSafeSquare = (sq: number) => SAFE_REL.some(r => (1 + r) % TRACK === sq);

export interface RaceGame {
  seats: number[];          // board seat (0-3) of each player
  tokens: number[][];       // per player, 4 relative positions: -1 nest, 0-50 track, 51-55 lane, 56 home
  turn: number;
  dice: number[];           // dice values still to use this turn (bonus steps appear as 10)
  rolled: [number, number] | null;
  doubles: number;
  winner: number | null;
}

export function newRace(players: number): RaceGame {
  const seats = players === 2 ? [0, 2] : players === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  return { seats, tokens: seats.map(() => [NEST, NEST, NEST, NEST]), turn: 0, dice: [], rolled: null, doubles: 0, winner: null };
}

export function roll(g: RaceGame, rng: Rng): [number, number] {
  const r: [number, number] = [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  g.rolled = r;
  g.dice = [r[0], r[1]];
  g.doubles = r[0] === r[1] ? g.doubles + 1 : 0;
  return r;
}

/** A move: which token, and which dice (indexes into g.dice) it uses. */
export interface RaceMove { token: number; use: number[]; to: number; captures: [number, number] | null }

function occupantsAt(g: RaceGame, sq: number): [number, number][] {
  const out: [number, number][] = [];
  g.tokens.forEach((ts, p) => ts.forEach((rel, t) => { if (trackSquare(g.seats[p], rel) === sq) out.push([p, t]); }));
  return out;
}

export function raceMoves(g: RaceGame): RaceMove[] {
  if (g.winner !== null) return [];
  const p = g.turn, seat = g.seats[p];
  const out: RaceMove[] = [];
  const add = (token: number, use: number[], to: number) => {
    const sq = trackSquare(seat, to);
    let captures: [number, number] | null = null;
    if (sq >= 0 && !isSafeSquare(sq)) {
      const occ = occupantsAt(g, sq).filter(([q]) => q !== p);
      if (occ.length === 1) captures = occ[0];
      else if (occ.length > 1) return; // two rival tokens make a wall
    }
    if (out.some(m => m.token === token && m.to === to && m.use.length === use.length)) return;
    out.push({ token, use, to, captures });
  };
  g.tokens[p].forEach((rel, t) => {
    g.dice.forEach((d, i) => {
      if (rel === NEST) { if (d === 5) add(t, [i], 0); return; }
      if (rel === HOME) return;
      if (rel + d <= HOME) add(t, [i], rel + d);
    });
    if (rel === NEST && g.dice.length === 2 && g.dice[0] + g.dice[1] === 5 && g.dice[0] !== 10 && g.dice[1] !== 10) add(t, [0, 1], 0);
  });
  return out;
}

/** Applies a move. Returns what happened, for the screen. */
export function raceApply(g: RaceGame, m: RaceMove): { captured: [number, number] | null; home: boolean } {
  const p = g.turn;
  g.tokens[p][m.token] = m.to;
  g.dice = g.dice.filter((_, i) => !m.use.includes(i));
  if (m.captures) { g.tokens[m.captures[0]][m.captures[1]] = NEST; g.dice.push(10); }
  const home = m.to === HOME;
  if (home) {
    if (g.tokens[p].every(r => r === HOME)) { g.winner = p; g.dice = []; }
    else g.dice.push(10);
  }
  return { captured: m.captures, home };
}

/** Ends the turn: the same player rolls again after doubles (up to two times). */
export function raceEndTurn(g: RaceGame): boolean {
  g.dice = [];
  const again = g.winner === null && !!g.rolled && g.rolled[0] === g.rolled[1] && g.doubles < 3;
  if (!again) { g.turn = (g.turn + 1) % g.seats.length; g.doubles = 0; }
  g.rolled = null;
  return again;
}

/** The computer's choice: capture, then home, then out of the nest, then safety, then the leader moves on. */
export function raceBot(g: RaceGame, rng: Rng): RaceMove | null {
  const ms = raceMoves(g);
  if (!ms.length) return null;
  const p = g.turn, seat = g.seats[p];
  const danger = (rel: number) => {
    const sq = trackSquare(seat, rel);
    if (sq < 0 || isSafeSquare(sq)) return 0;
    let d = 0;
    g.tokens.forEach((ts, q) => { if (q !== p) ts.forEach(r => { const s = trackSquare(g.seats[q], r); if (s >= 0) { const gap = (sq - s + TRACK) % TRACK; if (gap > 0 && gap <= 6) d++; } }); });
    return d;
  };
  const score = (m: RaceMove) => {
    const from = g.tokens[p][m.token];
    let s = 0;
    if (m.captures) s += 100;
    if (m.to === HOME) s += 80;
    if (from === NEST) s += 60;
    if (m.to > 50 && from <= 50) s += 40;
    s -= danger(m.to) * 25;
    if (from >= 0 && from <= 50) s += danger(from) * 20;
    s += m.to * 0.3 + (m.use.length === 2 ? 1 : 0) + rng() * 2;
    return s;
  };
  return ms.reduce((b, m) => (score(m) > score(b) ? m : b));
}

/** Screen layout: (row, col) on a 15 × 15 grid for each track square, each seat's lane and nest. */
export const TRACK_CELLS: [number, number][] = (() => {
  const c: [number, number][] = [];
  for (let x = 0; x <= 5; x++) c.push([6, x]);
  for (let y = 5; y >= 0; y--) c.push([y, 6]);
  c.push([0, 7]);
  for (let y = 0; y <= 5; y++) c.push([y, 8]);
  for (let x = 9; x <= 14; x++) c.push([6, x]);
  c.push([7, 14]);
  for (let x = 14; x >= 9; x--) c.push([8, x]);
  for (let y = 9; y <= 14; y++) c.push([y, 8]);
  c.push([14, 7]);
  for (let y = 14; y >= 9; y--) c.push([y, 6]);
  for (let x = 5; x >= 0; x--) c.push([8, x]);
  c.push([7, 0]);
  return c;
})();
export const LANE_CELLS: [number, number][][] = [
  [1, 2, 3, 4, 5].map(x => [7, x] as [number, number]),
  [1, 2, 3, 4, 5].map(y => [y, 7] as [number, number]),
  [13, 12, 11, 10, 9].map(x => [7, x] as [number, number]),
  [13, 12, 11, 10, 9].map(y => [y, 7] as [number, number]),
];
/** Top-left corner of each seat's 6 × 6 nest: seat 0 top-left, then clockwise. */
export const NEST_CORNER: [number, number][] = [[0, 0], [0, 9], [9, 9], [9, 0]];

/** Where a token is drawn: [row, col] (nest slots are spread in the seat's corner). */
export function cellOf(seat: number, rel: number, token: number): [number, number] {
  if (rel === NEST) { const [r, c] = NEST_CORNER[seat]; return [r + 1.5 + (token >> 1) * 2, c + 1.5 + (token & 1) * 2]; }
  if (rel === HOME) { const [r, c] = [[7, 6.35], [6.35, 7], [7, 7.65], [7.65, 7]][seat]; return [r + ((token >> 1) - 0.5) * 0.3, c + ((token & 1) - 0.5) * 0.3]; }
  if (rel > 50) return LANE_CELLS[seat][rel - 51];
  return TRACK_CELLS[trackSquare(seat, rel)];
}
