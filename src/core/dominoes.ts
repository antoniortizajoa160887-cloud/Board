/**
 * Dominoes with a double-six set (28 tiles), 2 to 4 players, 7 tiles each.
 *   Draw   when you can't play, draw from the boneyard until you can (or it runs out, then pass)
 *   Block  when you can't play, you pass
 * The first player to empty their hand wins the round and scores the pips left in every other hand.
 * If nobody can play, the round is blocked: the lowest hand wins and scores the other hands' pips.
 */
import { shuffle, type Rng } from './rng';

export type Tile = [number, number];
export type DomMode = 'draw' | 'block';

export interface DomGame {
  mode: DomMode;
  hands: Tile[][];
  yard: Tile[];
  /** The line of play, left to right; each tile is oriented so touching ends match. */
  line: Tile[];
  turn: number;
  passes: number;
  winner: number | null;
  blocked: boolean;
}

export const fullSet = (): Tile[] => {
  const out: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b]);
  return out;
};

export const pips = (t: Tile) => t[0] + t[1];
export const handPips = (h: Tile[]) => h.reduce((s, t) => s + pips(t), 0);
export const isDouble = (t: Tile) => t[0] === t[1];
export const ends = (g: DomGame): [number, number] | null => (g.line.length ? [g.line[0][0], g.line[g.line.length - 1][1]] : null);

/** The player holding the highest double starts (if no doubles, the heaviest tile). */
export function newDomGame(rng: Rng, players: number, mode: DomMode): DomGame {
  const set = shuffle(fullSet(), rng);
  const hands = Array.from({ length: players }, (_, i) => set.slice(i * 7, i * 7 + 7));
  const yard = set.slice(players * 7);
  let turn = 0, best = -1;
  hands.forEach((h, i) => h.forEach(t => { const v = (isDouble(t) ? 100 : 0) + pips(t); if (v > best) { best = v; turn = i; } }));
  return { mode, hands, yard, line: [], turn, passes: 0, winner: null, blocked: false };
}

export interface DomMove { tile: number; side: 'L' | 'R' }

/** Every way the player can play a tile from their hand. */
export function domMoves(g: DomGame, p: number): DomMove[] {
  const e = ends(g);
  const out: DomMove[] = [];
  g.hands[p].forEach((t, i) => {
    if (!e) { out.push({ tile: i, side: 'R' }); return; }
    if (t[0] === e[0] || t[1] === e[0]) out.push({ tile: i, side: 'L' });
    if ((t[0] === e[1] || t[1] === e[1]) && !(e[0] === e[1] && out.some(m => m.tile === i))) out.push({ tile: i, side: 'R' });
  });
  return out;
}

function next(g: DomGame) { g.turn = (g.turn + 1) % g.hands.length; }

export function domPlay(g: DomGame, m: DomMove) {
  const t = g.hands[g.turn].splice(m.tile, 1)[0];
  const e = ends(g);
  if (!e) g.line.push(t);
  else if (m.side === 'L') g.line.unshift(t[1] === e[0] ? t : [t[1], t[0]]);
  else g.line.push(t[0] === e[1] ? t : [t[1], t[0]]);
  g.passes = 0;
  if (!g.hands[g.turn].length) { g.winner = g.turn; return; }
  next(g);
}

/** Draw-mode: take one tile from the boneyard. Returns false if it is empty. */
export function domDraw(g: DomGame): boolean {
  if (g.mode !== 'draw' || !g.yard.length) return false;
  g.hands[g.turn].push(g.yard.pop()!);
  return true;
}

export function domPass(g: DomGame) {
  g.passes++;
  if (g.passes >= g.hands.length) {
    g.blocked = true;
    const totals = g.hands.map(handPips);
    const low = Math.min(...totals);
    g.winner = totals.indexOf(low);
    return;
  }
  next(g);
}

/** Points for the round winner: every other hand's pips. */
export const domScore = (g: DomGame) => (g.winner === null ? 0 : g.hands.reduce((s, h, i) => (i === g.winner ? s : s + handPips(h)), 0));

/** The computer: play the heaviest tile it can, keeping doubles moving early. */
export function domBot(g: DomGame): DomMove | null {
  const ms = domMoves(g, g.turn);
  if (!ms.length) return null;
  const h = g.hands[g.turn];
  return ms.reduce((b, m) => (pips(h[m.tile]) + (isDouble(h[m.tile]) ? 3 : 0) > pips(h[b.tile]) + (isDouble(h[b.tile]) ? 3 : 0) ? m : b));
}
