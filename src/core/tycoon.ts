/**
 * Harbor Tycoon: an original property-trading board game around a lagoon harbor.
 * 32 spaces, 6 districts of 3 lots, 4 ferry docks, 2 shipyards, message bottles, fees,
 * the Fog Bank, the Treasure Cove and the Whirlpool. No UI here.
 */
import { shuffle, type Rng } from './rng';

export type Kind = 'start' | 'lot' | 'ferry' | 'yard' | 'bottle' | 'fee' | 'fog' | 'cove' | 'whirl';

export interface Space { kind: Kind; en: string; es: string; group?: number; price?: number; rent?: number[]; build?: number; fee?: number }

export const GROUP_COLORS = ['#ff8fb1', '#2ef2d0', '#f5c542', '#ff8a2a', '#b07bff', '#4d8dff'];
export const GROUP_EN = ['Shell Row', 'Kelp Lane', 'Coral Street', 'Sunset Pier', "Mariner's Quay", 'Pearl Heights'];
export const GROUP_ES = ['Hilera de Conchas', 'Calle del Alga', 'Calle del Coral', 'Muelle del Ocaso', 'Malecón del Marinero', 'Alturas de Perlas'];

const lot = (group: number, en: string, es: string, price: number): Space => {
  const base = Math.round(price * 0.07);
  return { kind: 'lot', en, es, group, price, rent: [base, base * 4, base * 11, base * 26, base * 38], build: [50, 50, 100, 100, 150, 150][group] };
};

export const BOARD: Space[] = [
  { kind: 'start', en: 'Lighthouse', es: 'Faro' },
  lot(0, 'Sandpiper Way', 'Paso del Playero', 60),
  lot(0, 'Driftwood Lane', 'Calle de la Madera', 60),
  { kind: 'bottle', en: 'Message in a Bottle', es: 'Mensaje en una Botella' },
  lot(0, 'Clamshell Court', 'Patio de la Almeja', 80),
  { kind: 'ferry', en: 'North Ferry', es: 'Ferri Norte', price: 200 },
  lot(1, 'Seagrass Row', 'Hilera de Pastos', 100),
  { kind: 'fee', en: 'Dock Tax', es: 'Impuesto del Muelle', fee: 150 },
  { kind: 'fog', en: 'Fog Bank', es: 'Banco de Niebla' },
  lot(1, 'Kelp Garden', 'Jardín de Algas', 100),
  { kind: 'yard', en: 'Tidewater Shipyard', es: 'Astillero de la Marea', price: 150 },
  lot(1, 'Otter Bend', 'Recodo de la Nutria', 120),
  lot(2, 'Reef Market', 'Mercado del Arrecife', 140),
  { kind: 'ferry', en: 'East Ferry', es: 'Ferri Este', price: 200 },
  lot(2, 'Anemone Plaza', 'Plaza Anémona', 140),
  lot(2, 'Starfish Square', 'Plaza de la Estrella', 160),
  { kind: 'cove', en: 'Treasure Cove', es: 'Cala del Tesoro' },
  lot(3, 'Gull Wharf', 'Embarcadero Gaviota', 180),
  { kind: 'bottle', en: 'Message in a Bottle', es: 'Mensaje en una Botella' },
  lot(3, 'Lantern Walk', 'Paseo de Faroles', 180),
  lot(3, 'Sunset Boardwalk', 'Malecón del Ocaso', 200),
  { kind: 'ferry', en: 'South Ferry', es: 'Ferri Sur', price: 200 },
  lot(4, 'Anchor Street', 'Calle del Ancla', 220),
  lot(4, 'Compass Row', 'Hilera de la Brújula', 220),
  { kind: 'whirl', en: 'Whirlpool', es: 'Remolino' },
  lot(4, 'Captain\'s Landing', 'Desembarco del Capitán', 240),
  { kind: 'yard', en: 'Moonbay Shipyard', es: 'Astillero Bahía Luna', price: 150 },
  lot(5, 'Moonstone Drive', 'Avenida Piedra Luna', 280),
  { kind: 'ferry', en: 'West Ferry', es: 'Ferri Oeste', price: 200 },
  lot(5, 'Coral Crown', 'Corona de Coral', 300),
  { kind: 'fee', en: 'Pier Fee', es: 'Tarifa del Muelle', fee: 100 },
  lot(5, 'Pearl Palace', 'Palacio de Perlas', 350),
];

export const START_CASH = 1500, PASS_START = 200, FOG = 8, FOG_FEE = 50, MAX_LEVEL = 4;
export const FERRY_RENT = [0, 25, 50, 100, 200];

export type CardId = 'toStart' | 'ahead3' | 'back3' | 'chest' | 'contest' | 'repairs' | 'ferry' | 'fog' | 'keeper' | 'party' | 'fine' | 'tide' | 'horn' | 'toPalace' | 'toFirst' | 'refund';
export const CARDS: CardId[] = ['toStart', 'ahead3', 'back3', 'chest', 'contest', 'repairs', 'ferry', 'fog', 'keeper', 'party', 'fine', 'tide', 'horn', 'toPalace', 'toFirst', 'refund'];
export const CARD_TEXT: Record<CardId, [string, string]> = {
  toStart: ['Sail home to the Lighthouse and collect 200.', 'Navega al Faro y cobra 200.'],
  ahead3: ['A tailwind! Move ahead 3 spaces.', '¡Viento a favor! Avanza 3 casillas.'],
  back3: ['A strong current pulls you back 3 spaces.', 'Una corriente fuerte te hace retroceder 3 casillas.'],
  chest: ['You found a sunken chest. Collect 150.', 'Encontraste un cofre hundido. Cobra 150.'],
  contest: ['You won the fishing contest. Collect 100.', 'Ganaste el concurso de pesca. Cobra 100.'],
  repairs: ['Storm repairs: pay 25 for each hut and 100 for each resort.', 'Reparaciones por tormenta: paga 25 por cada cabaña y 100 por cada resort.'],
  ferry: ['Sail to the next ferry dock. If someone owns it, pay them double.', 'Navega al siguiente ferri. Si tiene dueño, págale el doble.'],
  fog: ['Lost in the fog! Go straight to the Fog Bank.', '¡Perdido en la niebla! Ve directo al Banco de Niebla.'],
  keeper: ['The lighthouse keeper thanks you: every player pays you 25.', 'El guardián del faro te agradece: cada jugador te paga 25.'],
  party: ['You throw a harbor party: pay every player 25.', 'Organizas una fiesta en el puerto: paga 25 a cada jugador.'],
  fine: ['Fishing without a permit: pay 50 into the Treasure Cove.', 'Pescaste sin permiso: paga 50 a la Cala del Tesoro.'],
  tide: ['A lucky tide brings coins ashore. Collect 50.', 'Una marea de suerte trae monedas. Cobra 50.'],
  horn: ['Fog horn! Keep this card to leave the Fog Bank for free.', '¡Sirena de niebla! Guarda esta carta para salir gratis del Banco de Niebla.'],
  toPalace: ['Sail to Pearl Palace.', 'Navega al Palacio de Perlas.'],
  toFirst: ['Sail to Sandpiper Way. Collect 200 if you pass the Lighthouse.', 'Navega a Paso del Playero. Cobra 200 si pasas por el Faro.'],
  refund: ['Your boat insurance pays out. Collect 75.', 'Tu seguro del barco paga. Cobra 75.'],
};

export interface Player { name: string; token: string; cash: number; pos: number; fog: number; horns: number; out: boolean; bot: boolean; doubles: number }
export interface Deed { owner: number; level: number; mortgaged: boolean }

export type TEvent =
  | { t: 'move'; p: number; path: number[] }
  | { t: 'jump'; p: number; to: number }
  | { t: 'pay'; from: number; to: number | null; amount: number; why: string }
  | { t: 'get'; p: number; amount: number; why: string }
  | { t: 'card'; p: number; card: CardId }
  | { t: 'fog'; p: number }
  | { t: 'buy'; p: number; space: number }
  | { t: 'build'; p: number; space: number; level: number }
  | { t: 'bankrupt'; p: number; to: number | null }
  | { t: 'dice'; p: number; d: [number, number] };

export interface Game {
  players: Player[]; deeds: (Deed | null)[]; current: number; round: number; maxRounds: number;
  phase: 'roll' | 'buy' | 'end' | 'over'; dice: [number, number]; cove: number;
  deck: CardId[]; events: TEvent[]; winner: number | null;
}

export function newGame(players: { name: string; token: string; bot: boolean }[], rng: Rng, maxRounds = 30): Game {
  return {
    players: players.map(p => ({ ...p, cash: START_CASH, pos: 0, fog: 0, horns: 0, out: false, doubles: 0 })),
    deeds: BOARD.map(s => (s.price ? null : null)),
    current: 0, round: 1, maxRounds, phase: 'roll', dice: [1, 1], cove: 0,
    deck: shuffle(CARDS.slice(), rng), events: [], winner: null,
  };
}

export const ownable = (i: number) => !!BOARD[i].price;
export const groupLots = (g: number) => BOARD.map((s, i) => (s.kind === 'lot' && s.group === g ? i : -1)).filter(i => i >= 0);
export const ownsGroup = (g: Game, p: number, group: number) => groupLots(group).every(i => g.deeds[i]?.owner === p);
const countOwned = (g: Game, p: number, kind: Kind) => BOARD.reduce((a, s, i) => a + (s.kind === kind && g.deeds[i]?.owner === p ? 1 : 0), 0);

/** Rent owed for landing on a space (dice total needed for shipyards). */
export function rentFor(g: Game, i: number, diceTotal: number): number {
  const d = g.deeds[i], s = BOARD[i];
  if (!d || d.mortgaged) return 0;
  if (s.kind === 'lot') {
    const r = s.rent![d.level];
    return d.level === 0 && ownsGroup(g, d.owner, s.group!) ? r * 2 : r;
  }
  if (s.kind === 'ferry') return FERRY_RENT[countOwned(g, d.owner, 'ferry')];
  if (s.kind === 'yard') return diceTotal * (countOwned(g, d.owner, 'yard') === 2 ? 10 : 4);
  return 0;
}

export function netWorth(g: Game, p: number): number {
  let v = g.players[p].cash;
  g.deeds.forEach((d, i) => {
    if (d?.owner !== p) return;
    const s = BOARD[i];
    v += d.mortgaged ? s.price! / 2 : s.price!;
    v += d.level * (s.build ?? 0);
  });
  return v;
}

/** Can this lot get one more building? Districts must be complete, unmortgaged, and built evenly. */
export function canBuild(g: Game, p: number, i: number): boolean {
  const s = BOARD[i], d = g.deeds[i];
  if (s.kind !== 'lot' || !d || d.owner !== p || d.level >= MAX_LEVEL) return false;
  if (!ownsGroup(g, p, s.group!)) return false;
  const lots = groupLots(s.group!);
  if (lots.some(j => g.deeds[j]!.mortgaged)) return false;
  return d.level <= Math.min(...lots.map(j => g.deeds[j]!.level)) && g.players[p].cash >= s.build!;
}

export function build(g: Game, p: number, i: number): boolean {
  if (!canBuild(g, p, i)) return false;
  g.players[p].cash -= BOARD[i].build!;
  g.deeds[i]!.level++;
  g.events.push({ t: 'build', p, space: i, level: g.deeds[i]!.level });
  return true;
}

export function canSellBuilding(g: Game, p: number, i: number): boolean {
  const s = BOARD[i], d = g.deeds[i];
  if (!d || d.owner !== p || d.level === 0) return false;
  return d.level >= Math.max(...groupLots(s.group!).map(j => g.deeds[j]!.level));
}

export function sellBuilding(g: Game, p: number, i: number): boolean {
  if (!canSellBuilding(g, p, i)) return false;
  g.deeds[i]!.level--;
  g.players[p].cash += BOARD[i].build! / 2;
  return true;
}

export function canMortgage(g: Game, p: number, i: number): boolean {
  const d = g.deeds[i], s = BOARD[i];
  if (!d || d.owner !== p || d.mortgaged) return false;
  if (s.kind === 'lot' && groupLots(s.group!).some(j => (g.deeds[j]?.level ?? 0) > 0)) return false;
  return true;
}
export function mortgage(g: Game, p: number, i: number): boolean {
  if (!canMortgage(g, p, i)) return false;
  g.deeds[i]!.mortgaged = true;
  g.players[p].cash += BOARD[i].price! / 2;
  return true;
}
export const unmortgageCost = (i: number) => Math.ceil(BOARD[i].price! * 0.55);
export function unmortgage(g: Game, p: number, i: number): boolean {
  const d = g.deeds[i];
  if (!d || d.owner !== p || !d.mortgaged || g.players[p].cash < unmortgageCost(i)) return false;
  g.players[p].cash -= unmortgageCost(i);
  d.mortgaged = false;
  return true;
}

/** Sells buildings, then mortgages, cheapest first, until the player has at least `need` cash. */
function raise(g: Game, p: number, need: number) {
  const pl = g.players[p];
  const mine = () => g.deeds.map((d, i) => (d?.owner === p ? i : -1)).filter(i => i >= 0).sort((a, b) => BOARD[a].price! - BOARD[b].price!);
  let guard = 0;
  while (pl.cash < need && guard++ < 100) {
    const sell = mine().filter(i => canSellBuilding(g, p, i));
    if (sell.length) { sellBuilding(g, p, sell[sell.length - 1]); continue; }
    const mort = mine().find(i => canMortgage(g, p, i));
    if (mort !== undefined) { mortgage(g, p, mort); continue; }
    break;
  }
}

function bankrupt(g: Game, p: number, to: number | null) {
  const pl = g.players[p];
  pl.out = true;
  g.events.push({ t: 'bankrupt', p, to });
  g.deeds.forEach((d, i) => {
    if (d?.owner !== p) return;
    if (to === null) g.deeds[i] = null;
    else { d.owner = to; d.level = 0; }
  });
  if (to !== null) { g.players[to].cash += Math.max(0, pl.cash); g.players[to].horns += pl.horns; }
  pl.cash = 0; pl.horns = 0;
  if (g.players.filter(x => !x.out).length === 1) end(g);
}

/** Moves money. `to` null = the bank; 'cove' sends it to the Treasure Cove. Raises cash or goes bankrupt when short. */
export function pay(g: Game, from: number, to: number | null | 'cove', amount: number, why: string) {
  const pl = g.players[from];
  if (amount <= 0 || pl.out) return;
  if (pl.cash < amount) raise(g, from, amount);
  if (pl.cash < amount) {
    const left = pl.cash;
    if (typeof to === 'number') g.players[to].cash += left;
    else if (to === 'cove') g.cove += left;
    g.events.push({ t: 'pay', from, to: typeof to === 'number' ? to : null, amount: left, why });
    pl.cash = 0;
    bankrupt(g, from, typeof to === 'number' ? to : null);
    return;
  }
  pl.cash -= amount;
  if (typeof to === 'number') g.players[to].cash += amount;
  else if (to === 'cove') g.cove += amount;
  g.events.push({ t: 'pay', from, to: typeof to === 'number' ? to : null, amount, why });
}

const get = (g: Game, p: number, amount: number, why: string) => { g.players[p].cash += amount; g.events.push({ t: 'get', p, amount, why }); };

function moveSteps(g: Game, p: number, steps: number) {
  const pl = g.players[p];
  const path: number[] = [];
  for (let k = 1; k <= Math.abs(steps); k++) {
    pl.pos = (pl.pos + Math.sign(steps) + BOARD.length) % BOARD.length;
    path.push(pl.pos);
    if (pl.pos === 0 && steps > 0) get(g, p, PASS_START, 'start');
  }
  g.events.push({ t: 'move', p, path });
}

function sailTo(g: Game, p: number, target: number) {
  const steps = (target - g.players[p].pos + BOARD.length) % BOARD.length;
  moveSteps(g, p, steps);
}

function toFog(g: Game, p: number) {
  const pl = g.players[p];
  pl.pos = FOG; pl.fog = 1; pl.doubles = 0;
  g.events.push({ t: 'jump', p, to: FOG }, { t: 'fog', p });
}

function drawCard(g: Game, p: number, rng: Rng, diceTotal: number) {
  if (!g.deck.length) g.deck = shuffle(CARDS.filter(c => c !== 'horn' || !g.players.some(x => x.horns)), rng);
  const card = g.deck.shift()!;
  g.events.push({ t: 'card', p, card });
  const others = g.players.map((_, i) => i).filter(i => i !== p && !g.players[i].out);
  switch (card) {
    case 'toStart': sailTo(g, p, 0); break;
    case 'ahead3': moveSteps(g, p, 3); land(g, p, rng, diceTotal); break;
    case 'back3': moveSteps(g, p, -3); land(g, p, rng, diceTotal); break;
    case 'chest': get(g, p, 150, 'card'); break;
    case 'contest': get(g, p, 100, 'card'); break;
    case 'repairs': {
      let cost = 0;
      g.deeds.forEach(d => { if (d?.owner === p) cost += d.level === MAX_LEVEL ? 100 : d.level * 25; });
      pay(g, p, 'cove', cost, 'repairs'); break;
    }
    case 'ferry': {
      let t = g.players[p].pos;
      do t = (t + 1) % BOARD.length; while (BOARD[t].kind !== 'ferry');
      sailTo(g, p, t);
      const d = g.deeds[t];
      if (d && d.owner !== p && !d.mortgaged) pay(g, p, d.owner, rentFor(g, t, diceTotal) * 2, 'rent');
      else if (!d) g.phase = 'buy';
      break;
    }
    case 'fog': toFog(g, p); break;
    case 'keeper': for (const o of others) pay(g, o, p, 25, 'card'); break;
    case 'party': for (const o of others) pay(g, p, o, 25, 'card'); break;
    case 'fine': pay(g, p, 'cove', 50, 'fine'); break;
    case 'tide': get(g, p, 50, 'card'); break;
    case 'horn': g.players[p].horns++; break;
    case 'toPalace': sailTo(g, p, BOARD.length - 1); land(g, p, rng, diceTotal); break;
    case 'toFirst': sailTo(g, p, 1); land(g, p, rng, diceTotal); break;
    case 'refund': get(g, p, 75, 'card'); break;
  }
}

/** Resolves the space the player is on. */
function land(g: Game, p: number, rng: Rng, diceTotal: number) {
  const pl = g.players[p];
  const i = pl.pos, s = BOARD[i];
  if (pl.out) return;
  if (ownable(i)) {
    const d = g.deeds[i];
    if (!d) g.phase = 'buy';
    else if (d.owner !== p) pay(g, p, d.owner, rentFor(g, i, diceTotal), 'rent');
    return;
  }
  switch (s.kind) {
    case 'fee': pay(g, p, 'cove', s.fee!, 'fee'); break;
    case 'bottle': drawCard(g, p, rng, diceTotal); break;
    case 'cove': if (g.cove > 0) { get(g, p, g.cove, 'cove'); g.cove = 0; } break;
    case 'whirl': {
      const docks = BOARD.map((x, k) => (x.kind === 'ferry' ? k : -1)).filter(k => k >= 0);
      const to = docks[Math.floor(rng() * docks.length)];
      pl.pos = to;
      g.events.push({ t: 'jump', p, to });
      land(g, p, rng, diceTotal);
      break;
    }
  }
}

/** Rolls and plays the current player's move. */
export function roll(g: Game, rng: Rng, forced?: [number, number]): [number, number] {
  if (g.phase !== 'roll') return g.dice;
  const p = g.current, pl = g.players[p];
  const d: [number, number] = forced ?? [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  g.dice = d;
  g.events.push({ t: 'dice', p, d });
  const dbl = d[0] === d[1];
  g.phase = 'end';
  if (pl.fog > 0) {
    if (dbl) pl.fog = 0;
    else if (pl.fog >= 3) { pay(g, p, 'cove', FOG_FEE, 'fog'); pl.fog = 0; }
    else { pl.fog++; return d; }
    if (pl.out) return d;
    moveSteps(g, p, d[0] + d[1]);
    land(g, p, rng, d[0] + d[1]);
    return d;
  }
  if (dbl) { pl.doubles++; if (pl.doubles === 3) { toFog(g, p); return d; } } else pl.doubles = 0;
  moveSteps(g, p, d[0] + d[1]);
  land(g, p, rng, d[0] + d[1]);
  if (dbl && g.phase === 'end' && !pl.out && pl.fog === 0) g.phase = 'roll';
  return d;
}

/** Leaving the Fog Bank before rolling: pay the fee or use a fog horn card. */
export function leaveFog(g: Game, useHorn: boolean): boolean {
  const pl = g.players[g.current];
  if (pl.fog === 0 || g.phase !== 'roll') return false;
  if (useHorn) { if (!pl.horns) return false; pl.horns--; }
  else { if (pl.cash < FOG_FEE) return false; pay(g, g.current, 'cove', FOG_FEE, 'fog'); }
  pl.fog = 0;
  return true;
}

export function buy(g: Game): boolean {
  const p = g.current, i = g.players[p].pos;
  if (g.phase !== 'buy' || g.deeds[i] || g.players[p].cash < BOARD[i].price!) return false;
  g.players[p].cash -= BOARD[i].price!;
  g.deeds[i] = { owner: p, level: 0, mortgaged: false };
  g.events.push({ t: 'buy', p, space: i });
  g.phase = afterBuy(g);
  return true;
}

export function pass(g: Game) {
  if (g.phase !== 'buy') return;
  g.phase = afterBuy(g);
}

const afterBuy = (g: Game): Game['phase'] => {
  const pl = g.players[g.current];
  return pl.doubles > 0 && pl.fog === 0 && g.dice[0] === g.dice[1] ? 'roll' : 'end';
};

function end(g: Game) {
  g.phase = 'over';
  const alive = g.players.map((_, i) => i).filter(i => !g.players[i].out);
  g.winner = alive.sort((a, b) => netWorth(g, b) - netWorth(g, a))[0];
}

export function endTurn(g: Game) {
  if (g.phase === 'over') return;
  g.players[g.current].doubles = 0;
  const n = g.players.length;
  let next = g.current;
  do {
    next = (next + 1) % n;
    if (next === 0) g.round++;
  } while (g.players[next].out);
  g.current = next;
  g.phase = 'roll';
  if (g.round > g.maxRounds) end(g);
}

// ——— Trading ———

export interface Offer { from: number; to: number; give: number[]; get: number[]; cash: number }

/** What a deed is worth to a player, counting how close it brings them to a full district. */
export function deedValue(g: Game, p: number, i: number, gaining: boolean): number {
  const s = BOARD[i];
  let v = s.price! * (g.deeds[i]?.mortgaged ? 0.6 : 1) + (g.deeds[i]?.level ?? 0) * (s.build ?? 0);
  if (s.kind === 'lot') {
    const lots = groupLots(s.group!);
    const mine = lots.filter(j => g.deeds[j]?.owner === p && j !== i).length;
    if (gaining && mine === lots.length - 1) v *= 2.6;
    else if (gaining && mine >= 1) v *= 1.4;
    if (!gaining && mine >= 1) v *= 1.5;
  }
  if (s.kind === 'ferry') v *= 1 + 0.25 * countOwned(g, p, 'ferry');
  return v;
}

export function validOffer(g: Game, o: Offer): boolean {
  if (o.from === o.to || g.players[o.from].out || g.players[o.to].out) return false;
  if (!o.give.length && !o.get.length && !o.cash) return false;
  if (o.give.some(i => g.deeds[i]?.owner !== o.from || (g.deeds[i]?.level ?? 0) > 0)) return false;
  if (o.get.some(i => g.deeds[i]?.owner !== o.to || (g.deeds[i]?.level ?? 0) > 0)) return false;
  if (o.cash > 0 && g.players[o.from].cash < o.cash) return false;
  if (o.cash < 0 && g.players[o.to].cash < -o.cash) return false;
  return true;
}

/** A computer player accepts when it comes out ahead. Positive cash = paid to the bot. */
export function botAccepts(g: Game, o: Offer): boolean {
  if (!validOffer(g, o)) return false;
  const gain = o.give.reduce((a, i) => a + deedValue(g, o.to, i, true), 0) + o.cash;
  const loss = o.get.reduce((a, i) => a + deedValue(g, o.to, i, false), 0);
  return gain >= loss * 1.1 + 20;
}

export function applyOffer(g: Game, o: Offer): boolean {
  if (!validOffer(g, o)) return false;
  for (const i of o.give) g.deeds[i]!.owner = o.to;
  for (const i of o.get) g.deeds[i]!.owner = o.from;
  g.players[o.from].cash -= o.cash;
  g.players[o.to].cash += o.cash;
  return true;
}

// ——— Computer players ———

const RESERVE = 150;

/** Before rolling: pay out of the fog early, unmortgage, build. */
export function botPrepare(g: Game) {
  const p = g.current, pl = g.players[p];
  if (pl.fog > 0 && g.phase === 'roll') {
    if (pl.horns) leaveFog(g, true);
    else if (g.round < 12 && pl.cash > 400) leaveFog(g, false);
  }
  for (let guard = 0; guard < 30; guard++) {
    const m = g.deeds.map((d, i) => (d?.owner === p && d.mortgaged ? i : -1)).filter(i => i >= 0)
      .find(i => pl.cash - unmortgageCost(i) > RESERVE * 2);
    if (m === undefined) break;
    unmortgage(g, p, m);
  }
  for (let guard = 0; guard < 40; guard++) {
    const opts = g.deeds.map((_, i) => i).filter(i => canBuild(g, p, i) && pl.cash - BOARD[i].build! > RESERVE + 50);
    if (!opts.length) break;
    build(g, p, opts.sort((a, b) => g.deeds[a]!.level - g.deeds[b]!.level || BOARD[b].price! - BOARD[a].price!)[0]);
  }
}

export function botWantsToBuy(g: Game): boolean {
  const p = g.current, i = g.players[p].pos, s = BOARD[i];
  const cash = g.players[p].cash - s.price!;
  if (cash < 0) return false;
  if (s.kind === 'lot' && groupLots(s.group!).some(j => g.deeds[j]?.owner === p)) return cash >= 20;
  return cash >= RESERVE;
}

/** Plays a whole computer turn (all rolls). */
export function botTurn(g: Game, rng: Rng) {
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 10) {
    if (g.phase === 'roll') { botPrepare(g); roll(g, rng); continue; }
    if (g.phase === 'buy') { if (botWantsToBuy(g)) buy(g); else pass(g); continue; }
    if (g.phase === 'end') { endTurn(g); return; }
  }
}
