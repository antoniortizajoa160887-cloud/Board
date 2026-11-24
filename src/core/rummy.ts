/**
 * Two family card games with a standard 52-card deck (aces low in Rummy).
 *
 * Rummy: 2 players get 10 cards, 3-4 players get 7. On your turn draw one card (from the deck or the top
 * of the discard pile), lay down any melds you like, add cards to melds already on the table, then
 * discard one card. A meld is a SET (3 or 4 cards of the same rank) or a RUN (3 or more in a row in one
 * suit). The first player to get rid of every card wins the round and scores the cards left in the other
 * hands (faces 10, aces 1, others their number).
 *
 * Go Fish: 2-3 players get 7 cards, 4 players get 5. On your turn ask one player for a rank you already
 * hold. If they have any, they hand them all over and you ask again. If not, "Go fish!": draw a card (if it
 * is the rank you asked for, you go again). Four of a rank make a book. Most books when the cards run out wins.
 */
import { newDeck, type Card } from './cards';
import { shuffle, type Rng } from './rng';

export const rumRank = (c: Card) => (c.rank === 14 ? 1 : c.rank);
export const rumValue = (c: Card) => Math.min(10, rumRank(c));
export const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
export const sortHand = (h: Card[]) => h.sort((a, b) => (a.suit === b.suit ? rumRank(a) - rumRank(b) : 'SHCD'.indexOf(a.suit) - 'SHCD'.indexOf(b.suit)));

export function isSet(cs: Card[]) { return cs.length >= 3 && cs.length <= 4 && cs.every(c => c.rank === cs[0].rank); }
export function isRun(cs: Card[]) {
  if (cs.length < 3 || !cs.every(c => c.suit === cs[0].suit)) return false;
  const r = cs.map(rumRank).sort((a, b) => a - b);
  return r.every((v, i) => i === 0 || v === r[i - 1] + 1);
}
export const isMeld = (cs: Card[]) => isSet(cs) || isRun(cs);
/** The meld sorted for display. */
export const meldOrder = (cs: Card[]) => (isRun(cs) ? [...cs].sort((a, b) => rumRank(a) - rumRank(b)) : cs);

export interface Rummy {
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  melds: Card[][];
  turn: number;
  drawn: boolean;
  /** Card taken from the discard pile this turn (it can't go straight back). */
  took: Card | null;
  winner: number | null;
  /** Times the discard pile was turned over into a new deck. The third time ends the round (lowest hand wins). */
  turns: number;
}

export function newRummy(rng: Rng, players: number): Rummy {
  const deck = shuffle(newDeck(), rng);
  const n = players === 2 ? 10 : 7;
  const hands = Array.from({ length: players }, (_, i) => sortHand(deck.slice(i * n, i * n + n)));
  const rest = deck.slice(players * n);
  return { hands, stock: rest.slice(1), discard: [rest[0]], melds: [], turn: 0, drawn: false, took: null, winner: null, turns: 0 };
}

export function rumDraw(g: Rummy, fromDiscard: boolean) {
  if (g.drawn) return;
  if (!fromDiscard && !g.stock.length) {
    if (++g.turns >= 3 || g.discard.length < 2) { g.winner = lowestHand(g); g.drawn = true; return; }
    const top = g.discard.pop()!; g.stock = g.discard.reverse(); g.discard = [top];
  }
  const c = fromDiscard ? g.discard.pop()! : g.stock.pop()!;
  g.took = fromDiscard ? c : null;
  g.hands[g.turn].push(c);
  sortHand(g.hands[g.turn]);
  g.drawn = true;
}

const take = (hand: Card[], cs: Card[]) => cs.forEach(c => hand.splice(hand.findIndex(x => same(x, c)), 1));

/** Lay down a new meld from the hand. You must keep a card to discard unless it empties your hand. */
export function rumMeld(g: Rummy, cs: Card[]): boolean {
  if (!g.drawn || !isMeld(cs)) return false;
  take(g.hands[g.turn], cs);
  g.melds.push(meldOrder(cs));
  if (!g.hands[g.turn].length) g.winner = g.turn;
  return true;
}

/** Can this card be added to a meld on the table? */
export const fits = (m: Card[], c: Card) => isMeld([...m, c]);
export function rumLayOff(g: Rummy, c: Card, meld: number): boolean {
  if (!g.drawn || !fits(g.melds[meld], c)) return false;
  take(g.hands[g.turn], [c]);
  g.melds[meld] = meldOrder([...g.melds[meld], c]);
  if (!g.hands[g.turn].length) g.winner = g.turn;
  return true;
}

export function rumDiscard(g: Rummy, c: Card): boolean {
  if (!g.drawn) return false;
  if (g.took && same(c, g.took) && g.hands[g.turn].length > 1) return false;
  take(g.hands[g.turn], [c]);
  g.discard.push(c);
  if (!g.hands[g.turn].length) { g.winner = g.turn; return true; }
  g.turn = (g.turn + 1) % g.hands.length;
  g.drawn = false; g.took = null;
  return true;
}

/** The player holding the fewest points (used when the deck runs out too often). */
export const lowestHand = (g: Rummy) => g.hands.reduce((b, h, i) => (handValue(h) < handValue(g.hands[b]) ? i : b), 0);
export const handValue = (h: Card[]) => h.reduce((a, c) => a + rumValue(c), 0);

/** Points the winner collects: the other hands (less the winner's own cards when the round ran out). */
export const rumScore = (g: Rummy) => Math.max(0, g.hands.reduce((s, h, i) => (i === g.winner ? s - handValue(h) : s + handValue(h)), 0));

/** All melds that can be made from a hand (sets of 3-4, runs of 3+), largest first. */
export function findMelds(hand: Card[]): Card[][] {
  const out: Card[][] = [];
  const byRank = new Map<number, Card[]>();
  hand.forEach(c => byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]));
  byRank.forEach(cs => { if (cs.length >= 3) out.push(cs.slice(0, 4)); });
  for (const s of ['S', 'H', 'D', 'C']) {
    const cs = hand.filter(c => c.suit === s).sort((a, b) => rumRank(a) - rumRank(b));
    let i = 0;
    while (i < cs.length) {
      let j = i;
      while (j + 1 < cs.length && rumRank(cs[j + 1]) === rumRank(cs[j]) + 1) j++;
      if (j - i >= 2) out.push(cs.slice(i, j + 1));
      i = j + 1;
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

/** Cards that are part of a meld or close to one (pairs, near-runs): the computer keeps these. */
function keepValue(hand: Card[], c: Card): number {
  let v = 0;
  for (const o of hand) {
    if (same(o, c)) continue;
    if (o.rank === c.rank) v += 3;
    if (o.suit === c.suit && Math.abs(rumRank(o) - rumRank(c)) <= 2) v += 2;
  }
  return v * 10 - rumValue(c);
}

/** One full computer turn. Returns what it did, for the screen. */
export function rumBot(g: Rummy): { fromDiscard: boolean; melded: number; laidOff: number; discarded: Card | null } {
  const hand = () => g.hands[g.turn];
  const top = g.discard[g.discard.length - 1];
  const useful = top && (findMelds([...hand(), top]).some(m => m.some(c => same(c, top))) || g.melds.some(m => fits(m, top)));
  rumDraw(g, !!useful);
  let melded = 0, laidOff = 0;
  for (let again = true; again && g.winner === null;) {
    again = false;
    const m = findMelds(hand())[0];
    if (m) { rumMeld(g, m); melded++; again = true; continue; }
    for (const c of [...hand()]) {
      if (hand().length === 1) { const k = g.melds.findIndex(x => fits(x, c)); if (k >= 0) { rumLayOff(g, c, k); laidOff++; } break; }
      const k = g.melds.findIndex(x => fits(x, c));
      if (k >= 0) { rumLayOff(g, c, k); laidOff++; again = true; break; }
    }
  }
  if (g.winner !== null) return { fromDiscard: !!useful, melded, laidOff, discarded: null };
  const pick = [...hand()].filter(c => !(g.took && same(c, g.took)) || hand().length === 1).sort((a, b) => keepValue(hand(), a) - keepValue(hand(), b))[0];
  rumDiscard(g, pick);
  return { fromDiscard: !!useful, melded, laidOff, discarded: pick };
}

// ---- Go Fish ----
export interface Fish { hands: Card[][]; pond: Card[]; books: number[][]; turn: number; over: boolean; asked: Map<number, Set<number>> }

export function newFish(rng: Rng, players: number): Fish {
  const deck = shuffle(newDeck(), rng);
  const n = players >= 4 ? 5 : 7;
  const g: Fish = { hands: Array.from({ length: players }, (_, i) => deck.slice(i * n, i * n + n)), pond: deck.slice(players * n), books: Array.from({ length: players }, () => []), turn: 0, over: false, asked: new Map() };
  g.hands.forEach((_, p) => collectBooks(g, p));
  return g;
}

/** Moves any four-of-a-kind out of a hand into books. Returns the new book ranks. */
export function collectBooks(g: Fish, p: number): number[] {
  const got: number[] = [];
  for (let r = 2; r <= 14; r++) if (g.hands[p].filter(c => c.rank === r).length === 4) { g.hands[p] = g.hands[p].filter(c => c.rank !== r); g.books[p].push(r); got.push(r); }
  g.hands[p].sort((a, b) => a.rank - b.rank || 'SHCD'.indexOf(a.suit) - 'SHCD'.indexOf(b.suit));
  return got;
}

export type AskResult = { got: number; drew: Card | null; again: boolean; books: number[] };

/** The current player asks another player for a rank. */
export function fishAsk(g: Fish, target: number, rank: number): AskResult {
  const p = g.turn;
  if (!g.asked.has(p)) g.asked.set(p, new Set());
  g.asked.get(p)!.add(rank);
  const given = g.hands[target].filter(c => c.rank === rank);
  let drew: Card | null = null, again: boolean;
  if (given.length) {
    g.hands[target] = g.hands[target].filter(c => c.rank !== rank);
    g.asked.get(target)?.delete(rank);
    g.hands[p].push(...given);
    again = true;
  } else {
    drew = g.pond.pop() ?? null;
    if (drew) g.hands[p].push(drew);
    again = !!drew && drew.rank === rank;
  }
  const books = collectBooks(g, p);
  if (books.length) g.asked.get(p)!.delete(rank);
  fishRefill(g);
  if (!again || !g.hands[p].length) fishNext(g);
  return { got: given.length, drew, again: again && g.turn === p, books };
}

/** A player with an empty hand draws a card (if any are left); the game ends when every card is in a book. */
function fishRefill(g: Fish) {
  g.hands.forEach((h, i) => { if (!h.length && g.pond.length) { h.push(g.pond.pop()!); collectBooks(g, i); } });
  if (g.books.reduce((a, b) => a + b.length, 0) === 13) g.over = true;
}
function fishNext(g: Fish) {
  if (g.over) return;
  for (let k = 1; k <= g.hands.length; k++) {
    const n = (g.turn + k) % g.hands.length;
    if (g.hands[n].length) { g.turn = n; return; }
  }
  g.over = true;
}

/** The computer asks for a rank someone has been seen asking for, else its most common rank, from a random player. */
export function fishBot(g: Fish, rng: Rng): [number, number] {
  const p = g.turn, hand = g.hands[p];
  const others = g.hands.map((_, i) => i).filter(i => i !== p && g.hands[i].length);
  for (const r of new Set(hand.map(c => c.rank))) {
    const who = others.find(i => g.asked.get(i)?.has(r));
    if (who !== undefined) return [who, r];
  }
  const counts = new Map<number, number>();
  hand.forEach(c => counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1));
  const top = Math.max(...counts.values());
  const ranks = [...counts.keys()].filter(r => counts.get(r) === top);
  const rank = ranks[Math.floor(rng() * ranks.length)];
  // Anyone could hold it: pick a player at random, more likely the ones with more cards.
  const weights = others.map(i => g.hands[i].length);
  let pick = rng() * weights.reduce((a, b) => a + b, 0);
  const target = others.find((_, k) => (pick -= weights[k]) < 0) ?? others[0];
  return [target, rank];
}
