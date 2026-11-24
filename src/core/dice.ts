/**
 * Two dice games.
 *
 * Five Dice: roll five dice up to three times a turn, keeping any you like between rolls, then score the
 * dice in one of 13 boxes. Each box is used once; after 13 turns the highest total wins.
 *   Ones … Sixes: the sum of that number (63 or more in these six boxes earns a 35-point bonus)
 *   Three / Four of a kind: the sum of all five dice     Full house (3 + 2): 25
 *   Small straight (4 in a row): 30     Large straight (5 in a row): 40
 *   Five of a kind: 50 (each extra one later is a 100 bonus)     Chance: the sum of all five dice
 *
 * Pearl Diver (a push-your-luck game): roll one die as often as you like, adding each roll to this
 * dive. Roll a 1 and the dive is lost. Bank to keep it. First to 100 wins.
 */
import type { Rng } from './rng';

export const BOXES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'five', 'chance'] as const;
export type Box = typeof BOXES[number];
export type Sheet = Partial<Record<Box, number>> & { extra?: number };

export const rollDie = (rng: Rng) => 1 + Math.floor(rng() * 6);
const counts = (d: number[]) => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach(x => c[x]++); return c; };
const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
function run(d: number[]) {
  const s = new Set(d);
  let best = 0, cur = 0;
  for (let v = 1; v <= 6; v++) { cur = s.has(v) ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

export function boxScore(box: Box, d: number[]): number {
  const c = counts(d), top = Math.max(...c);
  switch (box) {
    case 'ones': return c[1]; case 'twos': return c[2] * 2; case 'threes': return c[3] * 3;
    case 'fours': return c[4] * 4; case 'fives': return c[5] * 5; case 'sixes': return c[6] * 6;
    case 'three': return top >= 3 ? sum(d) : 0;
    case 'four': return top >= 4 ? sum(d) : 0;
    case 'full': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'small': return run(d) >= 4 ? 30 : 0;
    case 'large': return run(d) === 5 ? 40 : 0;
    case 'five': return top === 5 ? 50 : 0;
    case 'chance': return sum(d);
  }
}

export const UPPER: Box[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const upperSum = (s: Sheet) => UPPER.reduce((a, b) => a + (s[b] ?? 0), 0);
export const bonus = (s: Sheet) => (upperSum(s) >= 63 ? 35 : 0);
export const total = (s: Sheet) => BOXES.reduce((a, b) => a + (s[b] ?? 0), 0) + bonus(s) + (s.extra ?? 0);
export const done = (s: Sheet) => BOXES.every(b => s[b] !== undefined);

/** Scores the dice in a box (and adds a 100 bonus for another five of a kind once that box holds 50). */
export function score(s: Sheet, box: Box, d: number[]) {
  if (Math.max(...counts(d)) === 5 && s.five === 50) s.extra = (s.extra ?? 0) + 100;
  s[box] = boxScore(box, d);
}

const SACRIFICE: Record<Box, number> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6, three: 8, four: 6, full: 9, small: 10, large: 12, five: 4, chance: 20 };

/** The computer's box choice for final dice: highest value, saving Chance and big boxes for later. */
export function botBox(s: Sheet, d: number[]): Box {
  const open = BOXES.filter(b => s[b] === undefined);
  let best = open[0], bestV = -Infinity;
  for (const b of open) {
    const v = boxScore(b, d);
    let w = v;
    if (UPPER.includes(b)) { const face = UPPER.indexOf(b) + 1; w = v - face * 3 + (v >= face * 3 ? 6 : 0); }
    if (b === 'chance') w = v - 22;
    if (v === 0) w = -SACRIFICE[b];
    if (w > bestV) { bestV = w; best = b; }
  }
  return best;
}

/** Which dice the computer keeps before the next roll (true = keep). */
export function botKeep(s: Sheet, d: number[]): boolean[] {
  const c = counts(d);
  const open = (b: Box) => s[b] === undefined;
  if ((open('large') || open('small')) && run(d) >= 3) {
    const seq = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [3, 4, 5, 6], [2, 3, 4, 5], [1, 2, 3, 4]].find(q => q.filter(v => c[v]).length >= 3)!;
    const used = new Set<number>();
    return d.map(v => (seq.includes(v) && !used.has(v) ? (used.add(v), true) : false));
  }
  let face = 6, n = 0;
  for (let v = 6; v >= 1; v--) if (c[v] > n) { n = c[v]; face = v; }
  if (n === 1) face = Math.max(...d);
  return d.map(v => v === face);
}

// ---- Pearl Diver ----
export const PEARL_GOAL = 100;
export interface Dive { banked: number[]; dive: number; turn: number; winner: number | null }
export const newDive = (players: number): Dive => ({ banked: Array(players).fill(0), dive: 0, turn: 0, winner: null });

/** Rolls for the current diver. A 1 loses the dive and passes the turn. */
export function diveRoll(g: Dive, v: number): 'lost' | 'ok' {
  if (v === 1) { g.dive = 0; g.turn = (g.turn + 1) % g.banked.length; return 'lost'; }
  g.dive += v;
  return 'ok';
}
export function diveBank(g: Dive) {
  g.banked[g.turn] += g.dive;
  g.dive = 0;
  if (g.banked[g.turn] >= PEARL_GOAL) { g.winner = g.turn; return; }
  g.turn = (g.turn + 1) % g.banked.length;
}
/** The computer banks at 20 (less when it can win, more when far behind). */
export function botBanks(g: Dive): boolean {
  const me = g.banked[g.turn];
  if (me + g.dive >= PEARL_GOAL) return true;
  const lead = Math.max(...g.banked.filter((_, i) => i !== g.turn));
  const aim = lead >= 80 ? 30 : lead - me > 30 ? 25 : 20;
  return g.dive >= aim;
}
