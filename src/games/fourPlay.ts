import { sfx } from '../audio';
import { aiColumn, at, COLS, drop, emptyGrid, full, landRow, ROWS, winLine, type Grid } from '../core/four';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { coinBurst, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { LEVEL_CHIPS } from './checkersPlay';
import { howToPlay } from './howto';

export const fourHowTo = () => howToPlay(tr('How to play Four in a Row', 'Cómo jugar a Cuatro en Línea'), [
  [tr('The goal', 'El objetivo'), tr('Be the first to line up 4 of your pearls: across, up and down, or diagonally.', 'Sé el primero en alinear 4 de tus perlas: en horizontal, en vertical o en diagonal.')],
  [tr('Your turn', 'Tu turno'), tr('Tap a column. Your gold pearl drops to the lowest empty spot in it. Then the computer drops a coral pearl.', 'Toca una columna. Tu perla dorada cae al lugar libre más bajo. Luego la computadora suelta una perla coral.')],
  [tr('Blocking', 'Bloquear'), tr('Watch for three coral pearls in a line with an empty spot next to them: drop yours there to block.', 'Atento a tres perlas coral en línea con un espacio libre al lado: suelta la tuya ahí para bloquear.')],
  [tr('Draw', 'Empate'), tr('If the board fills up and nobody has four, it\'s a draw.', 'Si el tablero se llena y nadie tiene cuatro, es empate.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('The middle column is the strongest: it is part of the most lines. Try to build two threats at once!', 'La columna del medio es la más fuerte: forma parte de más líneas. ¡Intenta crear dos amenazas a la vez!')],
]);

let level: 1 | 2 | 3 = 2;
let first: 1 | -1 = 1;

export const fourScreen: Screen = root => {
  root.classList.add('four');
  const rng = makeRng();
  let alive = true, busy = false, over = false;
  let g: Grid = emptyGrid();
  const holes: HTMLElement[] = [];
  const board = h('div.f4-board');
  const cols = Array.from({ length: COLS }, (_, c) => {
    const col = h('button.f4-col', { onclick: () => void play(c), 'aria-label': tr(`Column ${c + 1}`, `Columna ${c + 1}`) });
    for (let r = 0; r < ROWS; r++) { const hole = h('div.f4-hole'); holes[at(r, c)] = hole; col.append(hole); }
    return col;
  });
  board.append(...cols);
  const status = h('div.result');

  function reset() {
    g = emptyGrid(); over = false; busy = false;
    holes.forEach(x => x.replaceChildren());
    holes.forEach(x => x.classList.remove('win'));
    status.className = 'result';
    if (first === -1) { status.textContent = tr('The computer goes first…', 'La computadora empieza…'); void aiTurn(); }
    else status.textContent = tr('Your turn: tap a column', 'Tu turno: toca una columna');
    first = first === 1 ? -1 : 1; // take turns starting
    cols.forEach(c => c.classList.remove('off'));
  }

  function disc(r: number, c: number, side: 1 | -1) {
    const d = h('div.f4-disc' + (side === 1 ? '.me' : '.ai'));
    d.style.setProperty('--fall', String(r + 1));
    holes[at(r, c)].append(d);
    sfx('chip');
    setTimeout(() => sfx('tick'), 160 + r * 45);
  }

  async function play(c: number) {
    if (busy || over) return;
    const r = landRow(g, c);
    if (r < 0) return;
    busy = true;
    g = drop(g, c, 1)!;
    disc(r, c, 1);
    await sleep(380);
    if (!alive) return;
    if (check()) return;
    await aiTurn();
  }

  async function aiTurn() {
    busy = true;
    status.textContent = tr('Thinking…', 'Pensando…');
    await sleep(350);
    if (!alive) return;
    const c = aiColumn(g, level, rng);
    const r = landRow(g, c);
    g = drop(g, c, -1)!;
    disc(r, c, -1);
    await sleep(380);
    if (!alive || check()) return;
    busy = false;
    status.textContent = tr('Your turn', 'Tu turno');
    cols.forEach((col, k) => col.classList.toggle('off', landRow(g, k) < 0));
  }

  function check(): boolean {
    const w = winLine(g);
    if (!w && !full(g)) return false;
    over = true; busy = false;
    const won = !!w && g[w[0]] === 1;
    w?.forEach(i => holes[i].classList.add('win'));
    countPlay('four', won);
    let text: string;
    if (won) {
      const prize = LEVEL_CHIPS[level];
      addChips(prize); sfx('jackpot'); coinBurst(board, 30); buzz();
      status.className = 'result win';
      text = tr(`Four in a row! +${prize} chips`, `¡Cuatro en línea! +${prize} fichas`);
    } else if (w) { sfx('lose'); status.className = 'result lose'; text = tr('The computer made four', 'La computadora hizo cuatro'); }
    else { sfx('chip'); status.className = 'result push'; text = tr('Draw: the board is full', 'Empate: el tablero está lleno'); }
    status.textContent = text;
    setTimeout(() => {
      if (!alive) return;
      dialog(won ? tr('You win!', '¡Ganaste!') : w ? tr('Game over', 'Fin del juego') : tr('Draw', 'Empate'), h('p', {}, text),
        [{ label: tr('Close', 'Cerrar') }, { label: tr('Play again', 'Jugar otra vez'), primary: true, onclick: reset }]);
    }, 900);
    return true;
  }

  const levels = h('div.seg', {}, ...([1, 2, 3] as const).map(l => h('button.seg-btn' + (l === level ? '.on' : ''), {
    onclick: (e: Event) => {
      level = l; sfx('click');
      levels.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b === e.currentTarget));
    },
  }, l === 1 ? tr('Easy', 'Fácil') : l === 2 ? tr('Normal', 'Normal') : tr('Hard', 'Difícil'))));

  root.append(topBar(tr('Four in a Row', 'Cuatro en Línea')), h('div.f4-wrap', {}, board), status,
    h('div.controls.ck-levels', {}, levels),
    h('div.controls', {},
      h('button.btn.small', { onclick: () => { sfx('click'); if (!busy) reset(); } }, tr('New game', 'Nueva partida')),
      h('button.btn.small', { onclick: fourHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr(`Win: Easy +${LEVEL_CHIPS[1]} · Normal +${LEVEL_CHIPS[2]} · Hard +${LEVEL_CHIPS[3]} chips`, `Premio: Fácil +${LEVEL_CHIPS[1]} · Normal +${LEVEL_CHIPS[2]} · Difícil +${LEVEL_CHIPS[3]} fichas`)));
  first = 1;
  reset();
  return () => { alive = false; };
};
