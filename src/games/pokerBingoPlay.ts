import { sfx } from '../audio';
import { isRed, rankLabel, SUIT_GLYPH, type Card } from '../core/cards';
import { CATEGORY_EN, CATEGORY_ES } from '../core/holdem';
import { CALLS, CENTER, CORNERS, callOrder, cardKey, judge, makeBoard, PAY } from '../core/pokerBingo';
import { makeRng } from '../core/rng';
import { lang, tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { cardSvg } from '../ui/art';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { betStepper, cantAfford, resultBanner } from './kit';

const PRICES = [5, 10, 25, 50, 100, 250];
const handName = (c: number) => (lang() === 'es' ? CATEGORY_ES[c] : CATEGORY_EN[c]);

export const pokerBingoHowTo = () => howToPlay(tr('How to play Poker Bingo', 'Cómo jugar al Bingo Póquer'), [
  [tr('The idea', 'La idea'), tr('Bingo with playing cards. Each board has 25 cards in a 5 × 5 grid. Cards are called from one shuffled deck, and every called card on your board gets covered with a chip.', 'Bingo con cartas de póquer. Cada tablero tiene 25 cartas en una cuadrícula de 5 × 5. Se cantan cartas de una baraja mezclada, y cada carta cantada que está en tu tablero se cubre con una ficha.')],
  [tr('Get ready', 'Prepárate'), tr(`Choose how many BOARDS (1 to 4) and the PRICE of each, then tap PLAY. ${CALLS} cards (half the deck) are called each game.`, `Elige cuántos TABLEROS (1 a 4) y el PRECIO de cada uno, y toca JUGAR. En cada partida se cantan ${CALLS} cartas (media baraja).`)],
  [tr('Center', 'Centro'), tr('The middle card is called: you win a little back.', 'Si cantan la carta del centro: recuperas un poco.')],
  [tr('Four corners', 'Cuatro esquinas'), tr(`All four corner cards are called: ${PAY.corners}× the board price.`, `Si cantan las cuatro esquinas: ${PAY.corners}× el precio del tablero.`)],
  [tr('Five in a row', 'Cinco en línea'), tr('Cover a whole row, column or diagonal and it pays by the POKER HAND those five cards make. A pair pays a little; a flush, full house or four of a kind pays a lot. Only your best line counts.', 'Cubre una fila, columna o diagonal completa y paga según la MANO DE PÓQUER que forman esas cinco cartas. Una pareja paga poco; un color, un full o un póker pagan mucho. Solo cuenta tu mejor línea.')],
  [tr('Poker hands, best to worst', 'Manos de póquer, de mejor a peor'), tr('Straight flush · four of a kind · full house (3 + 2) · flush (same suit) · straight (in a row) · three of a kind · two pair · pair · high card.', 'Escalera de color · póker (4 iguales) · full (3 + 2) · color (mismo palo) · escalera (seguidas) · trío · doble pareja · pareja · carta alta.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Just watch the cards fall! Every board is a different mix, so two cheap boards give you more chances than one expensive one.', '¡Solo mira caer las cartas! Cada tablero es distinto, así que dos tableros baratos te dan más oportunidades que uno caro.')],
]);

const mini = (c: Card) => h('span.pb-face' + (isRed(c) ? '.red' : ''), {}, rankLabel(c.rank), h('small', {}, SUIT_GLYPH[c.suit]));

export const pokerBingoScreen: Screen = root => {
  const rng = makeRng();
  let alive = true, running = false;
  let boards: Card[][] = [makeBoard(rng), makeBoard(rng)];
  let called = new Set<string>();
  const callEl = h('div.pb-call', { html: cardSvg({ rank: 14, suit: 'S' }, true) });
  const countEl = h('div.ball-count', {}, `0 / ${CALLS}`);
  const recent = h('div.pb-recent');
  const boardsBox = h('div.pb-boards');
  const result = h('div.result', {}, tr('Pick how many boards and their price, then play', 'Elige cuántos tableros y su precio, y juega'));
  const price = betStepper(PRICES, 10, tr('Board price', 'Precio'));
  const count = betStepper([1, 2, 3, 4], 2, tr('Boards', 'Tableros'), n => newBoards(n), v => String(v));
  const playBtn = h('button.btn.primary.wide', { onclick: () => void play() }, tr('PLAY', 'JUGAR'));

  function newBoards(n: number) {
    if (running) return;
    boards = Array.from({ length: n }, () => makeBoard(rng));
    called = new Set();
    render();
  }

  function render(just?: string, lines: (number[] | null)[] = []) {
    boardsBox.dataset.n = String(boards.length);
    boardsBox.replaceChildren(...boards.map((b, bi) => h('div.pb-board', {},
      h('div.pb-grid', {}, ...b.map((c, i) => {
        const k = cardKey(c);
        const el = h('div.pb-cell' + (called.has(k) ? '.on' : '') + (i === CENTER ? '.center' : '') + (CORNERS.includes(i) ? '.corner' : '') + (lines[bi]?.includes(i) ? '.line' : ''), {}, mini(c));
        if (k === just) el.classList.add('daub');
        return el;
      })))));
  }

  async function play() {
    if (running) return;
    const cost = price.get() * boards.length;
    if (cantAfford(cost)) return;
    addChips(-cost);
    running = true; playBtn.disabled = true; price.setEnabled(false); count.setEnabled(false);
    boards = boards.map(() => makeBoard(rng));
    called = new Set();
    recent.replaceChildren();
    render();
    resultBanner(result, tr('Here come the cards!', '¡Ahí vienen las cartas!'), 'info');
    const order = callOrder(rng);
    for (let i = 0; i < order.length; i++) {
      if (!alive) return;
      const c = order[i], k = cardKey(c);
      called.add(k);
      callEl.innerHTML = cardSvg(c);
      callEl.classList.remove('deal-in'); void callEl.offsetWidth; callEl.classList.add('deal-in');
      countEl.textContent = `${i + 1} / ${CALLS}`;
      recent.prepend(h('span.pb-chip', {}, mini(c)));
      while (recent.children.length > 8) recent.lastChild!.remove();
      const onBoard = boards.some(b => b.some(x => cardKey(x) === k));
      sfx(onBoard ? 'daub' : 'card');
      render(k);
      await sleep(onBoard ? 420 : 260);
    }
    const results = boards.map(b => judge(b, called));
    render(undefined, results.map(r => r.line));
    const bet = price.get();
    const won = results.reduce((a, r) => a + Math.round(r.pay * bet), 0);
    if (won) addChips(won);
    countPlay('pokerbingo', won > cost);
    const parts: string[] = [];
    results.forEach((r, i) => {
      const bits = [r.hand !== null ? handName(r.hand) : '', r.corners ? tr('corners', 'esquinas') : '', r.center ? tr('center', 'centro') : ''].filter(Boolean);
      if (bits.length) parts.push(`${boards.length > 1 ? `#${i + 1} ` : ''}${bits.join(' + ')}`);
    });
    if (won > cost) {
      resultBanner(result, `${parts.join(' · ')}  +${fmt(won)}`, 'win');
      const big = results.some(r => r.hand !== null && r.hand >= 4) || won >= cost * 5;
      sfx(big ? 'jackpot' : 'win'); coinBurst(boardsBox, big ? 40 : 16); buzz(big);
    } else if (won) { resultBanner(result, `${parts.join(' · ')}  +${fmt(won)}`, 'push'); sfx('chip'); }
    else { resultBanner(result, tr('No prize this time', 'Esta vez sin premio'), 'lose'); sfx('lose'); }
    running = false; playBtn.disabled = false; price.setEnabled(true); count.setEnabled(true);
  }

  const pays = h('div.pb-pays', {},
    ...[...PAY.line.map((m, c) => [handName(c), m] as [string, number])].reverse().map(([n, m]) => h('span', {}, `${n} ×${m}`)),
    h('span', {}, tr(`Corners ×${PAY.corners}`, `Esquinas ×${PAY.corners}`)), h('span', {}, tr(`Center ×${PAY.center}`, `Centro ×${PAY.center}`)));

  root.classList.add('pokerbingo');
  root.append(topBar(tr('Poker Bingo', 'Bingo Póquer')),
    h('div.pb-top', {}, callEl, h('div.pb-side', {}, countEl, recent)),
    boardsBox, result,
    h('div.controls', {}, count.el, price.el),
    h('div.controls', {}, h('button.btn.small', { onclick: pokerBingoHowTo }, tr('How to play', 'Cómo jugar')), playBtn),
    h('details.pb-paybox', {}, h('summary', {}, tr('Prizes (× board price)', 'Premios (× precio del tablero)')), pays));
  render();
  return () => { alive = false; };
};
