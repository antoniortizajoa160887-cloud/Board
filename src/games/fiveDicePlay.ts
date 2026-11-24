import { sfx } from '../audio';
import { BOXES, bonus, botBox, botKeep, boxScore, done, rollDie, score, total, upperSum, type Box, type Sheet } from '../core/dice';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { dieEl, finish, playersSeg, say, seatFace, seatName } from './tableKit';

const BOX_NAME: Record<Box, [string, string]> = {
  ones: ['Ones', 'Unos'], twos: ['Twos', 'Doses'], threes: ['Threes', 'Treses'], fours: ['Fours', 'Cuatros'], fives: ['Fives', 'Cincos'], sixes: ['Sixes', 'Seises'],
  three: ['3 of a kind', 'Trío'], four: ['4 of a kind', 'Póquer'], full: ['Full house', 'Full'], small: ['Small straight', 'Escalera corta'],
  large: ['Large straight', 'Escalera larga'], five: ['Five of a kind', 'Cinco iguales'], chance: ['Chance', 'Suerte'],
};
const boxName = (b: Box) => tr(...BOX_NAME[b]);

export const fiveDiceHowTo = () => howToPlay(tr('How to play Five Dice', 'Cómo jugar a los Cinco Dados'), [
  [tr('Your turn', 'Tu turno'), tr('Tap ROLL to throw five dice. You may roll up to three times. Between rolls, tap dice to HOLD them (they stay); the rest are thrown again.', 'Toca TIRAR para lanzar cinco dados. Puedes tirar hasta tres veces. Entre tiradas, toca dados para GUARDARLOS (se quedan); los demás se lanzan otra vez.')],
  [tr('Scoring', 'Anotar'), tr('After any roll, tap an empty box in your column to score the dice there. The grey number shows what you would get. Each box is used once, so sometimes you must score a 0.', 'Después de cualquier tirada, toca una casilla vacía de tu columna para anotar los dados. El número gris muestra cuánto sacarías. Cada casilla se usa una vez, así que a veces toca anotar un 0.')],
  [tr('Top boxes', 'Casillas de arriba'), tr('Ones to Sixes: add up only the dice of that number. 63 or more in these six boxes gives a 35-point bonus.', 'Unos a Seises: suma solo los dados de ese número. 63 o más en estas seis casillas da 35 puntos de bonificación.')],
  [tr('Bottom boxes', 'Casillas de abajo'), tr('3 or 4 of a kind: the total of all dice. Full house (3 + 2 the same): 25. Small straight (4 in a row): 30. Large straight (5 in a row): 40. Five of a kind: 50. Chance: the total of all dice.', 'Trío o Póquer: el total de todos los dados. Full (3 + 2 iguales): 25. Escalera corta (4 seguidos): 30. Escalera larga (5 seguidos): 40. Cinco iguales: 50. Suerte: el total de todos los dados.')],
  [tr('Winning', 'Ganar'), tr('After 13 turns every box is full. The highest total wins. Each extra five of a kind after scoring 50 is worth 100 more.', 'Tras 13 turnos todas las casillas están llenas. Gana el total más alto. Cada cinco iguales extra, después de anotar 50, vale 100 más.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Aim for three or more of the same number early to build the top bonus, and keep Chance for a bad turn.', 'Busca tres o más del mismo número al principio para la bonificación de arriba, y guarda Suerte para un mal turno.')],
]);

let players = 2;

export const fiveDiceScreen: Screen = root => {
  root.classList.add('fivedice');
  const rng = makeRng();
  let alive = true, busy = false;
  let sheets: Sheet[] = [];
  let turn = 0, rolls = 0;
  let dice = [1, 2, 3, 4, 5];
  let hold = [false, false, false, false, false];
  const status = h('div.result');
  const diceRow = h('div.fd-dice');
  const rollBtn = h('button.btn.primary', { onclick: () => void myRoll() }, tr('ROLL', 'TIRAR'));
  const table = h('table.fd-sheet');

  function renderDice() {
    diceRow.replaceChildren(...dice.map((v, i) => h('button.fd-die' + (hold[i] ? '.held' : ''), {
      onclick: () => { if (busy || turn !== 0 || !rolls || rolls >= 3) return; hold[i] = !hold[i]; sfx('click'); renderDice(); },
      disabled: !rolls, 'aria-label': `${v}`,
    }, dieEl(v), h('span.fd-hold', {}, hold[i] ? tr('HOLD', 'GUARDA') : ''))));
    rollBtn.disabled = busy || turn !== 0 || rolls >= 3;
    rollBtn.textContent = rolls === 0 ? tr('ROLL', 'TIRAR') : tr(`ROLL AGAIN (${3 - rolls})`, `TIRAR OTRA (${3 - rolls})`);
  }

  function renderSheet() {
    const mine = turn === 0 && rolls > 0 && !busy;
    const head = h('tr', {}, h('th'), ...sheets.map((_, p) => h('th' + (p === turn ? '.turn' : ''), {}, seatFace(p, 'fd-face'), h('div', {}, seatName(p)))));
    const row = (b: Box) => h('tr', {}, h('td.fd-name', {}, boxName(b)), ...sheets.map((s, p) => {
      if (s[b] !== undefined) return h('td.fd-val', {}, String(s[b]));
      if (p === 0 && mine) return h('td.fd-open', {}, h('button.fd-pick', { onclick: () => void scoreBox(b) }, String(boxScore(b, dice))));
      return h('td.fd-val.empty', {}, '');
    }));
    const line = (label: string, f: (s: Sheet) => string, cls = '') => h('tr' + cls, {}, h('td.fd-name', {}, label), ...sheets.map(s => h('td.fd-val', {}, f(s))));
    table.replaceChildren(head, ...BOXES.slice(0, 6).map(row),
      line(tr('Bonus (63+)', 'Bono (63+)'), s => (bonus(s) ? '+35' : `${upperSum(s)}/63`), '.fd-sub'),
      ...BOXES.slice(6).map(row), line(tr('Total', 'Total'), s => String(total(s)), '.fd-total'));
  }

  async function myRoll() {
    if (busy || turn !== 0 || rolls >= 3) return;
    busy = true;
    for (let k = 0; k < 6; k++) { dice = dice.map((v, i) => (hold[i] ? v : rollDie(rng))); renderDice(); if (k === 0) sfx('dice'); await sleep(60); }
    rolls++; busy = false;
    if (!alive) return;
    renderDice(); renderSheet();
    say(status, rolls < 3 ? tr('Tap dice to hold them, roll again, or tap a box to score', 'Toca dados para guardarlos, tira otra vez o toca una casilla para anotar') : tr('Tap a box to score', 'Toca una casilla para anotar'));
  }

  async function scoreBox(b: Box) {
    if (busy || turn !== 0) return;
    const v = boxScore(b, dice);
    score(sheets[0], b, dice);
    sfx(v ? 'chip' : 'tick');
    say(status, tr(`${boxName(b)}: ${v} points`, `${boxName(b)}: ${v} puntos`), v >= 25 ? 'win' : '');
    await next();
  }

  async function next() {
    turn = (turn + 1) % sheets.length; rolls = 0; hold = hold.map(() => false);
    renderDice(); renderSheet();
    while (alive && turn !== 0) {
      busy = true;
      const s = sheets[turn];
      renderSheet();
      say(status, tr(`${seatName(turn)} is rolling…`, `${seatName(turn)} está tirando…`));
      dice = dice.map(() => rollDie(rng)); sfx('dice'); renderDice();
      await sleep(650);
      for (let r = 0; r < 2 && alive; r++) {
        const k = botKeep(s, dice);
        if (k.every(Boolean)) break;
        hold = k; renderDice(); await sleep(450);
        dice = dice.map((v, i) => (k[i] ? v : rollDie(rng))); sfx('dice'); renderDice();
        await sleep(650);
      }
      if (!alive) return;
      const b = botBox(s, dice);
      score(s, b, dice);
      say(status, tr(`${seatName(turn)}: ${boxName(b)} for ${s[b]}`, `${seatName(turn)}: ${boxName(b)} por ${s[b]}`));
      hold = hold.map(() => false);
      await sleep(900);
      turn = (turn + 1) % sheets.length;
    }
    busy = false;
    if (!alive) return;
    if (sheets.every(done)) { end(); return; }
    renderDice(); renderSheet();
    say(status, tr('Your turn: ROLL', 'Tu turno: TIRA'));
  }

  function end() {
    busy = true; renderDice(); renderSheet();
    const totals = sheets.map(total), best = Math.max(...totals);
    const won = totals[0] === best && totals.filter(t => t === best).length === 1;
    const draw = totals[0] === best && !won;
    const prize = 50 * sheets.length;
    finish({ key: 'fivedice', status, burstFrom: table, won, draw, prize, alive: () => alive, again: reset,
      text: won ? tr(`You win with ${totals[0]}! +${prize} chips`, `¡Ganaste con ${totals[0]}! +${prize} fichas`) : draw ? tr(`A tie at ${best}`, `Empate a ${best}`)
        : tr(`${seatName(totals.indexOf(best))} wins with ${best} (you: ${totals[0]})`, `Gana ${seatName(totals.indexOf(best))} con ${best} (tú: ${totals[0]})`) });
  }

  function reset() {
    sheets = Array.from({ length: players }, () => ({})); turn = 0; rolls = 0; busy = false; hold = hold.map(() => false);
    renderDice(); renderSheet();
    say(status, tr('Your turn: ROLL', 'Tu turno: TIRA'));
  }

  const pSeg = playersSeg([2, 3, 4], () => players, n => { players = n; reset(); });
  root.append(topBar(tr('Five Dice', 'Cinco Dados')), diceRow, h('div.controls', {}, rollBtn), status, h('div.fd-wrap', {}, table),
    h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: fiveDiceHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Win: 50 chips for each player at the table', 'Premio: 50 fichas por cada jugador en la mesa')));
  reset();
  return () => { alive = false; };
};
