import { sfx } from '../audio';
import { domBot, domDraw, domMoves, domPass, domPlay, domScore, ends, handPips, isDouble, newDomGame, type DomGame, type DomMode, type DomMove, type Tile } from '../core/dominoes';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { choiceSeg, finish, playersSeg, say, seatFace, seatName } from './tableKit';

export const dominoesHowTo = () => howToPlay(tr('How to play Dominoes', 'Cómo jugar al Dominó'), [
  [tr('The tiles', 'Las fichas'), tr('A set has 28 tiles. Each tile has two ends with 0 to 6 dots. Everyone gets 7 tiles.', 'Un juego tiene 28 fichas. Cada ficha tiene dos lados con 0 a 6 puntos. Cada jugador recibe 7 fichas.')],
  [tr('Starting', 'La salida'), tr('The player with the highest double (both ends the same) goes first.', 'Empieza el jugador con el doble más alto (los dos lados iguales).')],
  [tr('Your turn', 'Tu turno'), tr('Play one tile that matches a free end of the line: tap it in your hand. If it fits both ends, choose which side.', 'Pon una ficha que coincida con un extremo libre de la fila: tócala en tu mano. Si cabe en los dos extremos, elige el lado.')],
  [tr('Can\'t play?', '¿No puedes jugar?'), tr('In DRAW, take tiles from the pile until one fits (or the pile is empty, then pass). In BLOCK, you simply pass.', 'En ROBAR, toma fichas del montón hasta que una sirva (o se acabe, y entonces pasas). En BLOQUEO, simplemente pasas.')],
  [tr('Winning', 'Ganar'), tr('The first to play every tile wins. If nobody can play, the game is blocked: the hand with the fewest dots wins.', 'Gana el primero en poner todas sus fichas. Si nadie puede jugar, se cierra el juego: gana la mano con menos puntos.')],
  [tr('Prize', 'Premio'), tr('Win and you get 40 chips plus 2 chips for every dot left in the other hands.', 'Si ganas recibes 40 fichas más 2 fichas por cada punto que quede en las otras manos.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Get rid of heavy tiles (lots of dots) early, and keep a mix of numbers so you always have something that fits.', 'Suelta pronto las fichas pesadas (con muchos puntos) y guarda números variados para que siempre tengas algo que sirva.')],
]);

let mode: DomMode = 'draw';
let players = 2;

/** A domino tile drawn with dots. */
export function tileEl(t: Tile, cls = '') {
  const half = (n: number) => h('div.dm-half', {}, ...Array.from({ length: 9 }, (_, i) => h('i' + (PIPS[n].includes(i) ? '.on' : ''))));
  return h('div.dm-tile' + cls + (isDouble(t) ? '.double' : ''), { 'aria-label': `${t[0]}-${t[1]}` }, half(t[0]), h('div.dm-bar'), half(t[1]));
}
const PIPS: Record<number, number[]> = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export const dominoesScreen: Screen = root => {
  root.classList.add('dominoes');
  const rng = makeRng();
  let alive = true, busy = false;
  let g: DomGame = newDomGame(rng, players, mode);
  const status = h('div.result');
  const opps = h('div.tk-opps');
  const lineEl = h('div.dm-line');
  const yardEl = h('div.dm-yard');
  const handEl = h('div.dm-hand');
  const sideBox = h('div.controls');
  const drawBtn = h('button.btn.small', { onclick: () => void drawTile() }, tr('Draw a tile', 'Robar ficha'));
  const passBtn = h('button.btn.small', { onclick: () => void pass() }, tr('Pass', 'Pasar'));

  function render() {
    opps.replaceChildren(...g.hands.flatMap((hd, i) => i === 0 ? [] : h('div.tk-opp' + (g.turn === i && g.winner === null ? '.turn' : ''), {}, seatFace(i), h('b', {}, seatName(i)),
      h('span', {}, tr(`${hd.length} tiles`, `${hd.length} fichas`)))));
    lineEl.replaceChildren(...(g.line.length ? g.line.map((t, k) => tileEl(t, '.sm' + (k === 0 || k === g.line.length - 1 ? '.end' : ''))) : [h('div.muted.small', {}, tr('The first tile goes here', 'La primera ficha va aquí'))]));
    yardEl.textContent = g.mode === 'draw' ? tr(`Pile: ${g.yard.length}`, `Montón: ${g.yard.length}`) : tr('Block game: no pile', 'Bloqueo: sin montón');
    const mine = g.turn === 0 && g.winner === null && !busy;
    const moves = mine ? domMoves(g, 0) : [];
    handEl.replaceChildren(...g.hands[0].map((t, i) => {
      const ok = moves.some(m => m.tile === i);
      return h('button.dm-pick' + (ok ? '.ok' : ''), { onclick: () => tap(i), disabled: !ok }, tileEl(t));
    }));
    drawBtn.hidden = !(mine && !moves.length && g.mode === 'draw' && g.yard.length > 0);
    passBtn.hidden = !(mine && !moves.length && (g.mode === 'block' || !g.yard.length));
    sideBox.replaceChildren();
  }

  function tap(i: number) {
    const ms = domMoves(g, 0).filter(m => m.tile === i);
    if (!ms.length) return;
    if (ms.length === 1) { void play(ms[0]); return; }
    const e = ends(g)!;
    sfx('click');
    sideBox.replaceChildren(h('span.muted', {}, tr('Which end?', '¿En qué lado?')),
      h('button.btn.small', { onclick: () => void play(ms.find(m => m.side === 'L')!) }, tr(`Left (${e[0]})`, `Izquierda (${e[0]})`)),
      h('button.btn.small', { onclick: () => void play(ms.find(m => m.side === 'R')!) }, tr(`Right (${e[1]})`, `Derecha (${e[1]})`)));
  }

  async function play(m: DomMove) {
    if (busy) return;
    domPlay(g, m); sfx('chip');
    await after();
  }
  async function drawTile() {
    if (busy || !domDraw(g)) return;
    sfx('card');
    say(status, domMoves(g, 0).length ? tr('That one fits! Play it.', '¡Esa sirve! Ponla.') : tr('Still nothing: draw again', 'Todavía nada: roba otra'));
    render();
  }
  async function pass() {
    if (busy) return;
    domPass(g); sfx('tick');
    await after();
  }

  async function after() {
    render();
    if (await ended()) return;
    await bots();
  }

  async function bots() {
    busy = true;
    while (alive && g.winner === null && g.turn !== 0) {
      render();
      say(status, tr(`${seatName(g.turn)} is playing…`, `${seatName(g.turn)} está jugando…`));
      await sleep(700);
      if (!alive) return;
      let m = domBot(g), drew = 0;
      while (!m && domDraw(g)) { drew++; m = domBot(g); }
      if (drew) { sfx('card'); say(status, tr(`${seatName(g.turn)} drew ${drew}`, `${seatName(g.turn)} robó ${drew}`)); render(); await sleep(500); }
      if (m) { domPlay(g, m); sfx('chip'); }
      else { say(status, tr(`${seatName(g.turn)} passes`, `${seatName(g.turn)} pasa`)); domPass(g); await sleep(500); }
    }
    busy = false;
    if (!alive || await ended()) return;
    render();
    say(status, domMoves(g, 0).length ? tr('Your turn: tap a tile', 'Tu turno: toca una ficha') : g.mode === 'draw' && g.yard.length ? tr('No tile fits: draw one', 'Ninguna sirve: roba una') : tr('No tile fits: pass', 'Ninguna sirve: pasa'));
  }

  async function ended(): Promise<boolean> {
    if (g.winner === null) return false;
    render();
    const won = g.winner === 0, pts = domScore(g);
    const why = g.blocked ? tr('The game is blocked. ', 'El juego se cerró. ') : '';
    finish({ key: 'dominoes', status, burstFrom: handEl, won, prize: 40 + pts * 2, alive: () => alive, again: reset,
      text: won ? why + tr(`You win! +${40 + pts * 2} chips`, `¡Ganaste! +${40 + pts * 2} fichas`) : why + tr(`${seatName(g.winner)} wins (your hand: ${handPips(g.hands[0])} dots)`, `Gana ${seatName(g.winner)} (tu mano: ${handPips(g.hands[0])} puntos)`) });
    return true;
  }

  function reset() {
    g = newDomGame(rng, players, mode);
    busy = false;
    render();
    sfx('card');
    if (g.turn !== 0) void bots();
    else say(status, tr('You have the highest double: you start', 'Tienes el doble más alto: empiezas tú'));
  }

  const modeSeg = choiceSeg<DomMode>(['draw', 'block'], () => mode, v => { mode = v; reset(); }, v => (v === 'draw' ? tr('Draw', 'Robar') : tr('Block', 'Bloqueo')));
  const pSeg = playersSeg([2, 3, 4], () => players, n => { players = n; reset(); });
  root.append(topBar(tr('Dominoes', 'Dominó')), opps,
    h('div.dm-table', {}, lineEl, yardEl), status, sideBox,
    h('div.controls', {}, drawBtn, passBtn), handEl,
    h('div.controls.ck-levels', {}, modeSeg.el), h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: dominoesHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Win: 40 chips + 2 per dot left in the other hands', 'Premio: 40 fichas + 2 por cada punto en las otras manos')));
  reset();
  return () => { alive = false; };
};
