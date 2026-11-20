import { sfx } from '../audio';
import { aiMove, apply, count, legalMoves, startBoard, type Board, type Move } from '../core/checkers';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { coinBurst, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { howToPlay } from './howto';

export const LEVEL_CHIPS = [0, 50, 100, 250];

export const checkersHowTo = () => howToPlay(tr('How to play Checkers', 'Cómo jugar a las Damas'), [
  [tr('The goal', 'El objetivo'), tr('Take all of the other side\'s pieces, or leave them with no move. You play the gold pieces and move first.', 'Captura todas las piezas del rival o déjalo sin movimientos. Tú juegas con las piezas doradas y empiezas.')],
  [tr('Moving', 'Mover'), tr('Tap one of your pieces, then tap a glowing square. Pieces move one square diagonally forward, only on the dark squares.', 'Toca una de tus piezas y luego una casilla que brille. Las piezas avanzan una casilla en diagonal, solo por las casillas oscuras.')],
  [tr('Jumping', 'Saltar'), tr('If an enemy piece is next to you with an empty square behind it, jump over it to capture it. Jumping is required when you can! If you can jump again from where you land, keep going.', 'Si una pieza rival está a tu lado y detrás hay una casilla vacía, sáltala para capturarla. ¡Si puedes saltar, es obligatorio! Si desde donde caes puedes volver a saltar, sigue saltando.')],
  [tr('Crowns', 'Coronar'), tr('Reach the far row and your piece is crowned a king. Kings move and jump forward and backward.', 'Llega a la última fila y tu pieza se corona como dama. Las damas se mueven y saltan hacia adelante y hacia atrás.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Keep your pieces together and your back row filled as long as you can, so the computer can\'t crown easily. Start on Easy.', 'Mantén tus piezas juntas y tu fila de atrás ocupada el mayor tiempo posible, así el rival no corona fácil. Empieza en Fácil.')],
]);

let level: 1 | 2 | 3 = 2;

export const checkersScreen: Screen = root => {
  root.classList.add('checkers');
  const rng = makeRng();
  let alive = true, busy = false;
  let board: Board = startBoard();
  let ids: number[] = [];
  let sel: number[] = []; // partial path being built
  let over = false;
  const pieceEls = new Map<number, HTMLElement>();
  const squares: HTMLElement[] = [];
  const grid = h('div.ck-board');
  const layer = h('div.ck-layer');
  const status = h('div.result');
  const score = h('div.ck-score');

  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), c = i % 8;
    const sq = h('button.ck-sq' + ((r + c) % 2 ? '.dark' : '.light'), { onclick: () => tap(i) });
    squares.push(sq);
    grid.append(sq);
  }
  grid.append(layer);

  function place(el: HTMLElement, i: number) {
    el.style.left = `${(i % 8) * 12.5}%`;
    el.style.top = `${Math.floor(i / 8) * 12.5}%`;
  }

  function reset() {
    board = startBoard(); sel = []; over = false; busy = false;
    layer.replaceChildren(); pieceEls.clear();
    let next = 1;
    ids = board.map(p => (p ? next++ : 0));
    board.forEach((p, i) => {
      if (!p) return;
      const el = h('div.ck-piece' + (p > 0 ? '.me' : '.ai'));
      place(el, i);
      pieceEls.set(ids[i], el);
      layer.append(el);
    });
    status.className = 'result';
    status.textContent = tr('Your move: tap a gold piece', 'Tu turno: toca una pieza dorada');
    render();
  }

  function myMoves(): Move[] { return legalMoves(board, 1); }

  function render() {
    const moves = myMoves().filter(m => sel.every((s, k) => m.path[k] === s));
    const starts = new Set(myMoves().map(m => m.path[0]));
    const targets = new Set(sel.length ? moves.map(m => m.path[sel.length]).filter(x => x !== undefined) : []);
    squares.forEach((sq, i) => {
      sq.classList.toggle('can', !busy && !over && !sel.length && starts.has(i));
      sq.classList.toggle('sel', sel.includes(i));
      sq.classList.toggle('target', targets.has(i));
    });
    board.forEach((p, i) => { const el = ids[i] ? pieceEls.get(ids[i]) : null; if (el) el.classList.toggle('king', Math.abs(p) === 2); });
    score.innerHTML = '';
    score.append(h('span.ck-chip.me'), h('b', {}, String(count(board, 1))), h('span.muted', {}, ' vs '), h('span.ck-chip.ai'), h('b', {}, String(count(board, -1))));
  }

  async function animate(m: Move) {
    const id = ids[m.path[0]];
    const el = pieceEls.get(id)!;
    el.classList.add('moving');
    for (let k = 1; k < m.path.length; k++) {
      place(el, m.path[k]);
      sfx(m.caps.length ? 'stomp' : 'chip');
      if (m.caps[k - 1] !== undefined) {
        const cap = pieceEls.get(ids[m.caps[k - 1]]);
        if (cap) { setTimeout(() => cap.classList.add('gone'), 120); setTimeout(() => cap.remove(), 520); }
      }
      await sleep(260);
    }
    el.classList.remove('moving');
    const nids = ids.slice();
    nids[m.path[m.path.length - 1]] = id;
    nids[m.path[0]] = 0;
    for (const c of m.caps) nids[c] = 0;
    ids = nids;
    const before = board[m.path[0]];
    board = apply(board, m);
    if (Math.abs(board[m.path[m.path.length - 1]]) === 2 && Math.abs(before) === 1) { sfx('win'); el.classList.add('crown'); }
  }

  async function tap(i: number) {
    if (busy || over) return;
    const all = myMoves();
    const matching = all.filter(m => sel.every((s, k) => m.path[k] === s));
    if (!sel.length || (board[i] > 0 && !matching.some(m => m.path[sel.length] === i))) {
      if (all.some(m => m.path[0] === i)) { sel = [i]; sfx('click'); }
      else if (board[i] > 0) { status.textContent = all.some(m => m.caps.length) ? tr('You must jump!', '¡Tienes que saltar!') : tr('That piece can\'t move', 'Esa pieza no se puede mover'); sel = []; }
      else sel = [];
      render();
      return;
    }
    const next = matching.filter(m => m.path[sel.length] === i);
    if (!next.length) { sel = []; render(); return; }
    sel = [...sel, i];
    const done = next.find(m => m.path.length === sel.length);
    if (!done) { sfx('click'); render(); return; }
    busy = true; sel = [];
    render();
    await animate(done);
    if (!alive) return;
    if (!legalMoves(board, -1).length) return finish(true);
    status.textContent = tr('Thinking…', 'Pensando…');
    render();
    await sleep(350);
    const m = aiMove(board, level, rng);
    if (!m) return finish(true);
    await animate(m);
    if (!alive) return;
    busy = false;
    if (!legalMoves(board, 1).length) return finish(false);
    status.textContent = legalMoves(board, 1).some(x => x.caps.length) ? tr('Your move: you must jump!', 'Tu turno: ¡tienes que saltar!') : tr('Your move', 'Tu turno');
    render();
  }

  function finish(won: boolean) {
    over = true; busy = false;
    render();
    countPlay('checkers', won);
    if (won) {
      const prize = LEVEL_CHIPS[level];
      addChips(prize); sfx('jackpot'); coinBurst(grid, 30); buzz();
      status.className = 'result win';
      status.textContent = tr(`You win! +${prize} chips`, `¡Ganaste! +${prize} fichas`);
    } else {
      sfx('lose');
      status.className = 'result lose';
      status.textContent = tr('The computer wins this time', 'Esta vez gana la computadora');
    }
    dialog(won ? tr('You win!', '¡Ganaste!') : tr('Game over', 'Fin del juego'), h('p', {}, status.textContent ?? ''),
      [{ label: tr('Close', 'Cerrar') }, { label: tr('Play again', 'Jugar otra vez'), primary: true, onclick: reset }]);
  }

  const levels = h('div.seg', {}, ...([1, 2, 3] as const).map(l => h('button.seg-btn' + (l === level ? '.on' : ''), {
    onclick: (e: Event) => {
      level = l; sfx('click');
      levels.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b === e.currentTarget));
    },
  }, l === 1 ? tr('Easy', 'Fácil') : l === 2 ? tr('Normal', 'Normal') : tr('Hard', 'Difícil'))));

  root.append(topBar(tr('Checkers', 'Damas')), score, grid, status,
    h('div.controls.ck-levels', {}, levels),
    h('div.controls', {},
      h('button.btn.small', { onclick: () => { sfx('click'); reset(); } }, tr('New game', 'Nueva partida')),
      h('button.btn.small', { onclick: checkersHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr(`Win: Easy +${LEVEL_CHIPS[1]} · Normal +${LEVEL_CHIPS[2]} · Hard +${LEVEL_CHIPS[3]} chips`, `Premio: Fácil +${LEVEL_CHIPS[1]} · Normal +${LEVEL_CHIPS[2]} · Difícil +${LEVEL_CHIPS[3]} fichas`)));
  reset();
  return () => { alive = false; };
};
