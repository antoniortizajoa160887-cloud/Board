import { sfx } from '../audio';
import { cellOf, HOME, isSafeSquare, LANE_CELLS, NEST, NEST_CORNER, newRace, raceApply, raceBot, raceEndTurn, raceMoves, roll, startOf, TRACK_CELLS, type RaceGame, type RaceMove } from '../core/race';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { dieEl, finish, playersSeg, say, SEAT_COLORS, seatFace, seatName } from './tableKit';

export const raceHowTo = () => howToPlay(tr('How to play Lagoon Race', 'Cómo jugar a la Carrera de la Laguna'), [
  [tr('The goal', 'El objetivo'), tr('Each player has 4 tokens in a nest in a corner. Race all four around the board, up your own coloured lane and into the middle.', 'Cada jugador tiene 4 fichas en un nido en una esquina. Lleva las cuatro alrededor del tablero, sube por tu pasillo de color y entra al centro.')],
  [tr('Rolling', 'Tirar'), tr('Tap ROLL to throw two dice. Use each die on a token: the same token or two different ones. Tap a token, then pick which dice it uses.', 'Toca TIRAR para lanzar dos dados. Usa cada dado en una ficha: la misma o dos distintas. Toca una ficha y elige qué dados usa.')],
  [tr('Leaving the nest', 'Salir del nido'), tr('A token leaves the nest with a 5: a die showing 5, or two dice that add up to 5.', 'Una ficha sale del nido con un 5: un dado con 5, o dos dados que sumen 5.')],
  [tr('Capturing', 'Comer'), tr('Land exactly on a single rival token and it goes back to its nest, and you get 10 extra steps. Two rival tokens on one square make a wall you can\'t land on.', 'Si caes justo sobre una ficha rival sola, vuelve a su nido y ganas 10 pasos extra. Dos fichas rivales en una casilla hacen un muro donde no puedes caer.')],
  [tr('Safe squares', 'Casillas seguras'), tr('Start squares and squares with a star are safe: nobody can be captured there.', 'Las casillas de salida y las que tienen estrella son seguras: ahí nadie puede ser comido.')],
  [tr('Home', 'La meta'), tr('You need the exact count to reach the middle. Getting a token home also gives 10 extra steps. Doubles let you roll again.', 'Necesitas el número exacto para llegar al centro. Llevar una ficha a la meta también da 10 pasos extra. Con dobles vuelves a tirar.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Get tokens out early, and park on safe squares when a rival is close behind you.', 'Saca fichas pronto y quédate en casillas seguras cuando un rival te sigue de cerca.')],
]);

let players = 2;

export const raceScreen: Screen = root => {
  root.classList.add('race');
  const rng = makeRng();
  let alive = true, busy = false;
  let g: RaceGame = newRace(players);
  let chosen: number | null = null;
  const status = h('div.result');
  const board = h('div.rc-board');
  const tokensLayer = h('div.rc-tokens');
  const diceEl = h('div.rc-dice');
  const optsEl = h('div.controls.rc-opts');
  const rollBtn = h('button.btn.primary', { onclick: () => void myRoll() }, tr('ROLL', 'TIRAR'));
  const turnEl = h('div.tk-opps');

  const pos = (el: HTMLElement, r: number, c: number, size = 1) => {
    el.style.left = `${((c + (1 - size) / 2) / 15) * 100}%`;
    el.style.top = `${((r + (1 - size) / 2) / 15) * 100}%`;
    el.style.width = el.style.height = `${(size / 15) * 100}%`;
    return el;
  };

  function drawBoard() {
    const cells: HTMLElement[] = [];
    g.seats.forEach((seat, p) => {
      const [r, c] = NEST_CORNER[seat];
      const n = pos(h('div.rc-nest'), r + 2.5, c + 2.5, 6);
      n.style.setProperty('--seat', SEAT_COLORS[p]);
      cells.push(n);
      LANE_CELLS[seat].forEach(([y, x]) => { const l = pos(h('div.rc-cell.lane'), y, x); l.style.setProperty('--seat', SEAT_COLORS[p]); cells.push(l); });
    });
    TRACK_CELLS.forEach(([y, x], sq) => {
      const p = g.seats.findIndex(s => startOf(s) === sq);
      const el = pos(h('div.rc-cell' + (p >= 0 ? '.start' : isSafeSquare(sq) ? '.safe' : '')), y, x);
      if (p >= 0) el.style.setProperty('--seat', SEAT_COLORS[p]);
      cells.push(el);
    });
    cells.push(pos(h('div.rc-home'), 7, 7, 3));
    board.replaceChildren(...cells, tokensLayer);
  }

  function render() {
    const moves = !busy && g.turn === 0 && g.dice.length ? raceMoves(g) : [];
    const counts = new Map<string, number>();
    tokensLayer.replaceChildren(...g.tokens.flatMap((ts, p) => ts.map((rel, t) => {
      const [r, c] = cellOf(g.seats[p], rel, t);
      const k = `${Math.round(r * 4)},${Math.round(c * 4)}`;
      const n = rel === NEST || rel === HOME ? 0 : (counts.get(k) ?? 0);
      counts.set(k, n + 1);
      const can = p === 0 && moves.some(m => m.token === t);
      const el = pos(h('button.rc-token' + (can ? '.can' : '') + (p === 0 && chosen === t ? '.chosen' : '') + (rel === HOME ? '.home' : ''), {
        onclick: () => pick(t), disabled: !can, 'aria-label': tr(`Token ${t + 1}`, `Ficha ${t + 1}`),
      }), r - n * 0.18, c + n * 0.18, rel === HOME ? 0.55 : 0.78);
      el.style.setProperty('--seat', SEAT_COLORS[p]);
      return el;
    })));
    diceEl.replaceChildren(...g.dice.map(d => (d === 10 ? h('div.rc-bonus', {}, '+10') : dieEl(d))));
    rollBtn.disabled = busy || g.turn !== 0 || g.dice.length > 0 || g.winner !== null;
    turnEl.replaceChildren(...g.seats.map((_, p) => h('div.tk-opp' + (g.turn === p && g.winner === null ? '.turn' : ''), {}, seatFace(p),
      h('b', { style: `color:${SEAT_COLORS[p]}` }, seatName(p)), h('span', {}, tr(`${g.tokens[p].filter(r => r === HOME).length}/4 home`, `${g.tokens[p].filter(r => r === HOME).length}/4 en meta`)))));
    optsEl.replaceChildren();
    if (chosen !== null) {
      const ms = moves.filter(m => m.token === chosen);
      optsEl.append(...ms.map(m => h('button.btn.small', { onclick: () => void myMove(m) },
        m.use.map(i => (g.dice[i] === 10 ? '+10' : String(g.dice[i]))).join(' + ') + (m.to === 0 && g.tokens[0][m.token] === NEST ? tr(' · out', ' · salir') : '') + (m.captures ? tr(' · capture!', ' · ¡comer!') : '') + (m.to === HOME ? tr(' · home!', ' · ¡meta!') : ''))));
    }
  }

  function pick(t: number) {
    if (busy) return;
    const ms = raceMoves(g).filter(m => m.token === t);
    if (ms.length === 1) { void myMove(ms[0]); return; }
    chosen = t; sfx('click');
    say(status, tr('Pick the dice for this token', 'Elige los dados para esta ficha'));
    render();
  }

  async function myRoll() {
    if (busy || g.turn !== 0 || g.dice.length) return;
    const r = roll(g, rng); sfx('dice');
    say(status, r[0] === r[1] ? tr(`Doubles! ${r[0]} and ${r[1]}`, `¡Dobles! ${r[0]} y ${r[1]}`) : tr(`You rolled ${r[0]} and ${r[1]}`, `Sacaste ${r[0]} y ${r[1]}`));
    render();
    await checkStuck();
  }

  async function myMove(m: RaceMove) {
    chosen = null;
    const res = raceApply(g, m);
    sfx(res.captured ? 'win' : 'chip');
    if (res.captured) say(status, tr(`Captured ${seatName(res.captured[0])}! +10 steps`, `¡Comiste a ${seatName(res.captured[0])}! +10 pasos`), 'win');
    else if (res.home) say(status, tr('A token is home! +10 steps', '¡Una ficha llegó a la meta! +10 pasos'), 'win');
    render();
    if (ended()) return;
    await checkStuck();
  }

  /** Ends your turn when there is nothing left to move. */
  async function checkStuck() {
    if (g.dice.length && raceMoves(g).length) { if (!status.classList.contains('win')) say(status, tr('Tap a glowing token', 'Toca una ficha que brilla')); return; }
    busy = true;
    if (g.dice.length) say(status, tr('No move possible', 'No hay jugada posible'));
    await sleep(800);
    if (!alive) return;
    const again = raceEndTurn(g);
    busy = false;
    if (again) { say(status, tr('Doubles: roll again!', '¡Dobles: tira otra vez!')); render(); return; }
    await bots();
  }

  async function bots() {
    busy = true;
    while (alive && g.turn !== 0 && g.winner === null) {
      render();
      const who = seatName(g.turn);
      say(status, tr(`${who} rolls…`, `${who} tira…`));
      await sleep(600);
      const r = roll(g, rng); sfx('dice');
      say(status, tr(`${who} rolled ${r[0]} and ${r[1]}`, `${who} sacó ${r[0]} y ${r[1]}`));
      render();
      await sleep(700);
      for (let m = raceBot(g, rng); m && alive; m = raceBot(g, rng)) {
        const res = raceApply(g, m);
        sfx(res.captured ? 'lose' : 'chip');
        if (res.captured?.[0] === 0) say(status, tr(`${who} captured your token!`, `¡${who} se comió tu ficha!`), 'lose');
        render();
        await sleep(550);
      }
      if (!alive || ended()) return;
      raceEndTurn(g);
    }
    busy = false;
    if (!alive) return;
    render();
    say(status, tr('Your turn: ROLL', 'Tu turno: TIRA'));
  }

  function ended(): boolean {
    if (g.winner === null) return false;
    busy = true; render();
    const won = g.winner === 0, prize = 40 * g.seats.length;
    finish({ key: 'race', status, burstFrom: board, won, prize, alive: () => alive, again: reset,
      text: won ? tr(`All four home! +${prize} chips`, `¡Las cuatro en la meta! +${prize} fichas`) : tr(`${seatName(g.winner)} wins the race`, `${seatName(g.winner)} gana la carrera`) });
    return true;
  }

  function reset() {
    g = newRace(players); busy = false; chosen = null;
    drawBoard(); render();
    say(status, tr('Your turn: ROLL', 'Tu turno: TIRA'));
  }

  const pSeg = playersSeg([2, 3, 4], () => players, n => { players = n; reset(); });
  root.append(topBar(tr('Lagoon Race', 'Carrera de la Laguna')), turnEl, h('div.rc-wrap', {}, board), status,
    h('div.rc-bar', {}, diceEl, rollBtn), optsEl,
    h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: raceHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Win: 40 chips for each player in the race', 'Premio: 40 fichas por cada jugador en la carrera')));
  reset();
  return () => { alive = false; };
};
