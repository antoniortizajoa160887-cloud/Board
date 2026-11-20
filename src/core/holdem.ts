/** Texas Hold'em: hand ranking for 7 cards, betting rounds, side pots and a simple computer player. */
import { shuffledDeck, type Card } from './cards';
import type { Rng } from './rng';

export type Category = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const CATEGORY_EN = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
export const CATEGORY_ES = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póker', 'Escalera de color'];

/** Score of exactly 5 cards; a bigger number is a better hand. */
export function score5(cs: Card[]): number {
  const ranks = cs.map(c => c.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cs.every(c => c.suit === cs[0].suit);
  let straightHigh = 0;
  if (counts.size === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks.join() === '14,5,4,3,2') straightHigh = 5;
  }
  const pack = (cat: number, ks: number[]) => ks.reduce((a, k) => a * 15 + k, cat) * 15 ** (5 - ks.length);
  if (straightHigh && flush) return pack(8, [straightHigh]);
  if (groups[0][1] === 4) return pack(7, [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return pack(6, [groups[0][0], groups[1][0]]);
  if (flush) return pack(5, ranks);
  if (straightHigh) return pack(4, [straightHigh]);
  if (groups[0][1] === 3) return pack(3, groups.map(g => g[0]));
  if (groups[0][1] === 2 && groups[1][1] === 2) return pack(2, groups.map(g => g[0]));
  if (groups[0][1] === 2) return pack(1, groups.map(g => g[0]));
  return pack(0, ranks);
}

export const categoryOf = (score: number) => Math.floor(score / 15 ** 5) as Category;

/** Best 5 of up to 7 cards. */
export function best(cs: Card[]): { score: number; cards: Card[] } {
  if (cs.length < 5) {
    // Before the flop only pairs count; pad with zero ranks so the score stays comparable.
    const ranks = cs.map(c => c.rank).sort((a, b) => b - a);
    const pair = ranks.length === 2 && ranks[0] === ranks[1];
    return { score: (pair ? 1 : 0) * 15 ** 5 + ranks[0] * 15 ** 4 + (ranks[1] ?? 0) * 15 ** 3, cards: cs };
  }
  if (cs.length === 5) return { score: score5(cs), cards: cs };
  const drop = cs.length - 5;
  let top = -1, pick: Card[] = cs.slice(0, 5);
  const n = cs.length;
  for (let a = 0; a < n; a++) for (let b = drop === 2 ? a + 1 : n; b <= (drop === 2 ? n - 1 : n); b++) {
    const five = cs.filter((_, i) => i !== a && i !== b);
    const sc = score5(five);
    if (sc > top) { top = sc; pick = five; }
  }
  return { score: top, cards: pick };
}

export interface Seat { name: string; stack: number; hole: Card[]; bet: number; total: number; folded: boolean; allIn: boolean; acted: boolean; bot: boolean; out: boolean }
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export interface Hand {
  seats: Seat[]; deck: Card[]; board: Card[]; dealer: number; bb: number;
  street: Street; toAct: number; currentBet: number; minRaise: number;
  results: { seat: number; won: number; score: number }[] | null;
}
export type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number };

const inHand = (s: Seat) => !s.out && !s.folded;
const canAct = (s: Seat) => inHand(s) && !s.allIn;

function nextSeat(h: Hand, from: number, ok: (s: Seat) => boolean): number {
  const n = h.seats.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (ok(h.seats[i])) return i; }
  return -1;
}

function post(h: Hand, i: number, amount: number) {
  const s = h.seats[i];
  const a = Math.min(amount, s.stack);
  s.stack -= a; s.bet += a; s.total += a;
  if (s.stack === 0) s.allIn = true;
}

/** Deals a new hand. Seats with no chips sit out. */
export function newHand(seats: Seat[], dealer: number, bb: number, rng: Rng): Hand {
  for (const s of seats) Object.assign(s, { hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, out: s.stack <= 0 });
  const h: Hand = { seats, deck: shuffledDeck(rng), board: [], dealer, bb, street: 'preflop', toAct: -1, currentBet: bb, minRaise: bb, results: null };
  const live = seats.filter(s => !s.out).length;
  const sb = live === 2 ? dealer : nextSeat(h, dealer, s => !s.out);
  const big = nextSeat(h, sb, s => !s.out);
  post(h, sb, Math.floor(bb / 2));
  post(h, big, bb);
  for (let r = 0; r < 2; r++) for (let k = 1; k <= seats.length; k++) { const s = seats[(dealer + k) % seats.length]; if (!s.out) s.hole.push(h.deck.pop()!); }
  h.toAct = nextSeat(h, big, canAct);
  if (h.toAct < 0 || everyoneAllInOrDone(h)) runOut(h);
  return h;
}

export const pot = (h: Hand) => h.seats.reduce((a, s) => a + s.total, 0);
export const toCall = (h: Hand, i = h.toAct) => Math.max(0, h.currentBet - h.seats[i].bet);

/** Raise limits for the seat to act: the smallest and biggest "raise to" amounts. */
export function raiseRange(h: Hand, i = h.toAct): { min: number; max: number } | null {
  const s = h.seats[i];
  const max = s.bet + s.stack;
  if (max <= h.currentBet) return null;
  return { min: Math.min(max, h.currentBet + h.minRaise), max };
}

function everyoneAllInOrDone(h: Hand) {
  const live = h.seats.filter(inHand);
  if (live.length <= 1) return true;
  const actors = live.filter(s => !s.allIn);
  return actors.length === 0 || (actors.length === 1 && actors[0].bet >= h.currentBet);
}

export function act(h: Hand, a: Action) {
  const i = h.toAct, s = h.seats[i];
  if (i < 0 || h.street === 'showdown') return;
  const owe = toCall(h, i);
  if (a.type === 'fold') s.folded = true;
  else if (a.type === 'check' || (a.type === 'call' && owe === 0)) { /* nothing */ }
  else if (a.type === 'call') post(h, i, owe);
  else {
    const r = raiseRange(h, i);
    const to = r ? Math.max(r.min, Math.min(r.max, a.to)) : h.currentBet;
    const raiseBy = to - h.currentBet;
    post(h, i, to - s.bet);
    if (s.bet > h.currentBet) {
      if (raiseBy >= h.minRaise) h.minRaise = raiseBy;
      h.currentBet = s.bet;
      for (const o of h.seats) if (o !== s) o.acted = false;
    }
  }
  s.acted = true;
  advance(h);
}

function advance(h: Hand) {
  const live = h.seats.filter(inHand);
  if (live.length === 1) { award(h); return; }
  const roundDone = h.seats.every(s => !canAct(s) || (s.acted && s.bet === h.currentBet));
  if (!roundDone) { h.toAct = nextSeat(h, h.toAct, s => canAct(s) && (!s.acted || s.bet < h.currentBet)); return; }
  if (everyoneAllInOrDone(h)) { runOut(h); return; }
  nextStreet(h);
}

function nextStreet(h: Hand) {
  for (const s of h.seats) { s.bet = 0; s.acted = false; }
  h.currentBet = 0; h.minRaise = h.bb;
  if (h.street === 'preflop') { h.board.push(h.deck.pop()!, h.deck.pop()!, h.deck.pop()!); h.street = 'flop'; }
  else if (h.street === 'flop') { h.board.push(h.deck.pop()!); h.street = 'turn'; }
  else if (h.street === 'turn') { h.board.push(h.deck.pop()!); h.street = 'river'; }
  else { award(h); return; }
  h.toAct = nextSeat(h, h.dealer, canAct);
}

function runOut(h: Hand) {
  while (h.board.length < 5 && h.seats.filter(inHand).length > 1) h.board.push(h.deck.pop()!);
  award(h);
}

/** Splits the pot, side pots included, among the best hands still in. */
export function award(h: Hand) {
  h.street = 'showdown'; h.toAct = -1;
  const live = h.seats.map((s, i) => ({ s, i })).filter(x => inHand(x.s));
  const scores = new Map(live.map(x => [x.i, live.length > 1 ? best([...x.s.hole, ...h.board]).score : 0]));
  const won = new Map<number, number>();
  const levels = [...new Set(h.seats.map(s => s.total).filter(t => t > 0))].sort((a, b) => a - b);
  let prev = 0;
  for (const lv of levels) {
    const amount = h.seats.reduce((a, s) => a + Math.max(0, Math.min(s.total, lv) - prev), 0);
    const eligible = live.filter(x => x.s.total >= lv);
    prev = lv;
    if (!amount) continue;
    if (!eligible.length) {
      // Only folded money at this level: it goes back to whoever put it in (an uncalled bet).
      for (const [i, s] of h.seats.entries()) if (s.total >= lv) won.set(i, (won.get(i) ?? 0) + amount);
      continue;
    }
    const top = Math.max(...eligible.map(x => scores.get(x.i)!));
    const winners = eligible.filter(x => scores.get(x.i) === top).map(x => x.i);
    const share = Math.floor(amount / winners.length);
    let rest = amount - share * winners.length;
    for (let k = 1; k <= h.seats.length; k++) {
      const i = (h.dealer + k) % h.seats.length;
      if (!winners.includes(i)) continue;
      won.set(i, (won.get(i) ?? 0) + share + (rest > 0 ? 1 : 0));
      if (rest > 0) rest--;
    }
  }
  for (const [i, amt] of won) h.seats[i].stack += amt;
  h.results = [...won.entries()].map(([seat, w]) => ({ seat, won: w, score: scores.get(seat) ?? 0 }));
}

/** Chance (0..1) that these hole cards win against the given number of opponents, by quick simulation. */
export function equity(hole: Card[], board: Card[], opponents: number, rng: Rng, trials = 160): number {
  const used = new Set([...hole, ...board].map(c => c.rank * 4 + 'SHDC'.indexOf(c.suit)));
  const rest: Card[] = [];
  for (const suit of ['S', 'H', 'D', 'C'] as const) for (let r = 2; r <= 14; r++) if (!used.has(r * 4 + 'SHDC'.indexOf(suit))) rest.push({ rank: r, suit });
  let score = 0;
  for (let t = 0; t < trials; t++) {
    const d = rest.slice();
    const take = () => d.splice(Math.floor(rng() * d.length), 1)[0];
    const b = board.slice();
    while (b.length < 5) b.push(take());
    const mine = best([...hole, ...b]).score;
    let beat = 0, tie = 0;
    for (let o = 0; o < opponents; o++) {
      const theirs = best([take(), take(), ...b]).score;
      if (theirs > mine) beat++; else if (theirs === mine) tie++;
    }
    score += beat ? 0 : 1 / (tie + 1);
  }
  return score / trials;
}

/** A computer player: plays strong hands, calls when the price is right, bluffs now and then. */
export function botAction(h: Hand, rng: Rng): Action {
  const i = h.toAct, s = h.seats[i];
  const opp = h.seats.filter((o, k) => k !== i && inHand(o)).length;
  const eq = equity(s.hole, h.board, Math.max(1, opp), rng, h.street === 'preflop' ? 90 : 140);
  const owe = toCall(h, i);
  const potNow = pot(h);
  const odds = owe / (potNow + owe);
  const r = raiseRange(h, i);
  const strong = eq > 0.62 / Math.sqrt(opp) + 0.08, bluff = rng() < 0.06;
  if (r && (strong || bluff) && rng() < 0.75) {
    const size = Math.round((h.currentBet + Math.max(h.bb, potNow * (0.5 + rng() * 0.5))) / 5) * 5;
    return { type: 'raise', to: Math.max(r.min, Math.min(r.max, eq > 0.85 && rng() < 0.3 ? r.max : size)) };
  }
  if (owe === 0) return { type: 'check' };
  if (eq >= odds + 0.04 || (owe <= h.bb && eq > 0.25)) return { type: 'call' };
  return { type: 'fold' };
}
