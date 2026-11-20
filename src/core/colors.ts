import { shuffle, type Rng } from './rng';

/**
 * Crazy Colors: an original color-matching card game.
 * Match the top card by color or by symbol; wild cards change the color. First to empty their hand wins the round.
 */

export type CColor = 'coral' | 'teal' | 'gold' | 'violet';
export const COLORS: CColor[] = ['coral', 'teal', 'gold', 'violet'];
export type CValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'freeze' | 'flip' | 'plus2' | 'wild' | 'wild4';

export interface CCard { id: number; color: CColor | null; value: CValue }

export interface Rules {
  stacking: boolean; // +2 on a +2, +4 on a +2 or +4: the pile of draws passes on
  sevenZero: boolean; // 7: swap hands with someone · 0: every hand moves to the next player
  jumpIn: boolean; // play an identical card out of turn
  drawUntilMatch: boolean; // keep drawing until you get a card you can play
}
export const DEFAULT_RULES: Rules = { stacking: true, sevenZero: false, jumpIn: false, drawUntilMatch: false };

export interface Player { name: string; hand: CCard[]; bot: boolean }

export interface GameState {
  players: Player[];
  draw: CCard[];
  discard: CCard[];
  current: number;
  dir: 1 | -1;
  color: CColor; // color in play (a wild's chosen color)
  pending: number; // cards waiting to be drawn from +2 / +4
  rules: Rules;
  winner: number | null;
  /** Index in the current player's hand of the card they just drew and may play. */
  drawnPlayable: number | null;
  log: string[];
}

export const NUMBERS: CValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function newDeck(): CCard[] {
  const cards: CCard[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, color, value: '0' });
    for (const v of [...NUMBERS.slice(1), 'freeze', 'flip', 'plus2'] as CValue[]) {
      cards.push({ id: id++, color, value: v }, { id: id++, color, value: v });
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id++, color: null, value: 'wild' }, { id: id++, color: null, value: 'wild4' });
  return cards; // 108
}

export const isWild = (c: CCard) => c.value === 'wild' || c.value === 'wild4';
export const top = (s: GameState) => s.discard[s.discard.length - 1];

export function newGame(rng: Rng, names: string[], rules: Rules, humanSeats = [0]): GameState {
  const deck = shuffle(newDeck(), rng);
  const players: Player[] = names.map((name, i) => ({ name, hand: deck.splice(0, 7), bot: !humanSeats.includes(i) }));
  // The first face-up card is a number, so the round starts plainly.
  let i = deck.findIndex(c => NUMBERS.includes(c.value));
  const first = deck.splice(i, 1)[0];
  return {
    players, draw: deck, discard: [first], current: 0, dir: 1, color: first.color!,
    pending: 0, rules, winner: null, drawnPlayable: null, log: [],
  };
}

export function canPlay(s: GameState, c: CCard): boolean {
  const t = top(s);
  if (s.pending > 0) {
    if (!s.rules.stacking) return false;
    if (c.value === 'wild4') return true;
    return c.value === 'plus2' && t.value === 'plus2';
  }
  if (isWild(c)) return true;
  return c.color === s.color || c.value === t.value;
}

/** Can this player jump in with this card right now (identical color and symbol, out of turn)? */
export function canJumpIn(s: GameState, p: number, c: CCard): boolean {
  if (!s.rules.jumpIn || s.winner !== null || p === s.current || s.pending > 0) return false;
  const t = top(s);
  return !isWild(c) && c.color === t.color && c.value === t.value;
}

export const nextSeat = (s: GameState, from = s.current, steps = 1) => {
  const n = s.players.length;
  return (((from + s.dir * steps) % n) + n) % n;
};

function refill(s: GameState, rng: Rng) {
  if (s.draw.length) return;
  const keep = s.discard.pop()!;
  s.draw = shuffle(s.discard, rng);
  s.discard = [keep];
}

function drawCards(s: GameState, p: number, n: number, rng: Rng): CCard[] {
  const got: CCard[] = [];
  for (let i = 0; i < n; i++) {
    refill(s, rng);
    const c = s.draw.pop();
    if (!c) break; // every card is in someone's hand
    s.players[p].hand.push(c);
    got.push(c);
  }
  return got;
}

/** Moves on to the next player; without stacking, a +2/+4 is drawn at once and that player loses the turn. */
function advance(s: GameState, steps: number, rng: Rng) {
  s.current = nextSeat(s, s.current, steps);
  s.drawnPlayable = null;
  if (s.pending > 0 && !s.rules.stacking) {
    drawCards(s, s.current, s.pending, rng);
    s.log.push(`${s.players[s.current].name} draws ${s.pending}`);
    s.pending = 0;
    s.current = nextSeat(s);
  }
}

export interface PlayOpts { color?: CColor; swapWith?: number }

/** Plays card `idx` from player `p`'s hand (in turn, or a jump-in). Returns false if not allowed. */
export function play(s: GameState, p: number, idx: number, rng: Rng, opts: PlayOpts = {}): boolean {
  if (s.winner !== null) return false;
  const hand = s.players[p].hand;
  const c = hand[idx];
  if (!c) return false;
  const jump = p !== s.current;
  if (jump ? !canJumpIn(s, p, c) : !canPlay(s, c)) return false;
  if (!jump && s.drawnPlayable !== null && s.drawnPlayable !== idx) return false;
  hand.splice(idx, 1);
  s.discard.push(c);
  s.current = p;
  s.color = c.color ?? opts.color ?? 'coral';
  s.log.push(`${s.players[p].name} ${jump ? 'jumps in with' : 'plays'} ${label(c)}`);
  if (hand.length === 0) {
    s.winner = p;
    return true;
  }
  const two = s.players.length === 2;
  switch (c.value) {
    case 'freeze': advance(s, 2, rng); break;
    case 'flip': s.dir = (s.dir * -1) as 1 | -1; advance(s, two ? 2 : 1, rng); break;
    case 'plus2': s.pending += 2; advance(s, 1, rng); break;
    case 'wild4': s.pending += 4; advance(s, 1, rng); break;
    case '7':
      if (s.rules.sevenZero) {
        const t = opts.swapWith ?? fewestOther(s, p);
        if (t !== p) [s.players[p].hand, s.players[t].hand] = [s.players[t].hand, s.players[p].hand];
        s.log.push(`${s.players[p].name} swaps hands with ${s.players[t].name}`);
      }
      advance(s, 1, rng);
      break;
    case '0':
      if (s.rules.sevenZero) {
        const hands = s.players.map(pl => pl.hand);
        s.players.forEach((pl, i) => { pl.hand = hands[nextSeat(s, i, -1)]; });
        s.log.push('Every hand moves on');
      }
      advance(s, 1, rng);
      break;
    default: advance(s, 1, rng);
  }
  return true;
}

function fewestOther(s: GameState, p: number): number {
  let best = -1;
  s.players.forEach((pl, i) => { if (i !== p && (best < 0 || pl.hand.length < s.players[best].hand.length)) best = i; });
  return best < 0 ? p : best;
}

/**
 * The current player draws. With cards waiting from +2/+4 they take them all and lose the turn.
 * Otherwise they draw one (or until a playable card with that rule); if it can be played, it waits in
 * `drawnPlayable` for play() or pass().
 */
export function drawTurn(s: GameState, rng: Rng): CCard[] {
  if (s.winner !== null) return [];
  const p = s.current;
  if (s.pending > 0) {
    const got = drawCards(s, p, s.pending, rng);
    s.log.push(`${s.players[p].name} draws ${s.pending}`);
    s.pending = 0;
    advance(s, 1, rng);
    return got;
  }
  const got: CCard[] = [];
  for (;;) {
    const c = drawCards(s, p, 1, rng)[0];
    if (!c) break;
    got.push(c);
    if (canPlay(s, c) || !s.rules.drawUntilMatch) break;
  }
  s.log.push(`${s.players[p].name} draws ${got.length}`);
  const last = got[got.length - 1];
  if (last && canPlay(s, last)) s.drawnPlayable = s.players[p].hand.length - 1;
  else advance(s, 1, rng);
  return got;
}

/** Keep the drawn card and end the turn. */
export function pass(s: GameState, rng: Rng) {
  if (s.drawnPlayable === null) return;
  advance(s, 1, rng);
}

export function label(c: CCard): string {
  const v = { freeze: 'Freeze', flip: 'Flip', plus2: '+2', wild: 'Rainbow', wild4: 'Rainbow +4' }[c.value as string] ?? c.value;
  return c.color ? `${c.color} ${v}` : v;
}

export function cardPoints(c: CCard): number {
  if (isWild(c)) return 50;
  if (NUMBERS.includes(c.value)) return Number(c.value);
  return 20;
}

/** Points the winner scores: the cards left in everyone else's hands. */
export function roundPoints(s: GameState): number {
  return s.players.reduce((sum, p, i) => (i === s.winner ? sum : sum + p.hand.reduce((a, c) => a + cardPoints(c), 0)), 0);
}

// ---------- Computer player ----------

export function bestColor(hand: CCard[], rng: Rng): CColor {
  const counts = new Map<CColor, number>();
  for (const c of hand) if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  let best: CColor = COLORS[Math.floor(rng() * 4)];
  let n = 0;
  counts.forEach((v, k) => { if (v > n) { n = v; best = k; } });
  return best;
}

/** What a computer player does on its turn: a card to play (with its choices), or null to draw. */
export function botChoice(s: GameState, rng: Rng): { idx: number; opts: PlayOpts } | null {
  const p = s.current;
  const hand = s.players[p].hand;
  const options = hand.map((c, i) => ({ c, i })).filter(({ c, i }) => canPlay(s, c) && (s.drawnPlayable === null || s.drawnPlayable === i));
  if (!options.length) return null;
  const nextLow = s.players[nextSeat(s)].hand.length <= 2;
  const score = (c: CCard) => {
    let v = 0;
    if (isWild(c)) v -= 30; // save wilds
    if (c.value === 'wild4') v -= 10;
    if (['freeze', 'flip', 'plus2', 'wild4'].includes(c.value) && nextLow) v += 60; // stop someone about to win
    if (c.color === s.color) v += 5;
    if (c.color) v += hand.filter(h => h.color === c.color).length * 2; // stay in a color we have lots of
    v += rng() * 4;
    return v;
  };
  options.sort((a, b) => score(b.c) - score(a.c));
  const pick = options[0];
  const rest = hand.filter((_, i) => i !== pick.i);
  return { idx: pick.i, opts: { color: bestColor(rest, rng) } };
}

/** A computer player that could jump in does so about half the time. */
export function botJumpIn(s: GameState, rng: Rng): { p: number; idx: number } | null {
  if (!s.rules.jumpIn) return null;
  for (let p = 0; p < s.players.length; p++) {
    if (!s.players[p].bot) continue;
    const idx = s.players[p].hand.findIndex(c => canJumpIn(s, p, c));
    if (idx >= 0 && rng() < 0.5) return { p, idx };
  }
  return null;
}
