import { sfx } from '../audio';
import { isRed, rankLabel, SUIT_GLYPH, type Card } from '../core/cards';
import { CATEGORY_EN, CATEGORY_ES } from '../core/holdem';
import { BOARD_COUNT, BOARDS, CALLS, CENTER, CORNERS, callOrder, cardKey, judge, PAY } from '../core/pokerBingo';
import { makeRng } from '../core/rng';
import { lang, tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile, save } from '../save';
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
  [tr('The boards', 'Los tableros'), tr(`Like the printed boards of the boxed game, there are ${BOARD_COUNT} numbered boards and they never change. Every row and column on a board is already a poker hand, and each board has the same mix of hands, so no board is luckier than another. Keep your favourite numbers: the game remembers them.`, `Como los tableros impresos del juego de caja, hay ${BOARD_COUNT} tableros numerados y nunca cambian. Cada fila y columna de un tablero ya es una mano de póquer, y todos tienen la misma mezcla de manos, así que ningún tablero tiene más suerte que otro. Quédate con tus números favoritos: el juego los recuerda.`)],
  [tr('Get ready', 'Prepárate'), tr(`Tap the numbers of up to 4 BOARDS, choose the PRICE of each, then tap PLAY. ${CALLS} cards (half the deck) are called each game.`, `Toca los números de hasta 4 TABLEROS, elige el PRECIO de cada uno y toca JUGAR. En cada partida se cantan ${CALLS} cartas (media baraja).`)],
  [tr('Center', 'Centro'), tr('The middle card is called: you win a little back.', 'Si cantan la carta del centro: recuperas un poco.')],
  [tr('Four corners', 'Cuatro esquinas'), tr(`All four corner cards are called: ${PAY.corners}× the board price.`, `Si cantan las cuatro esquinas: ${PAY.corners}× el precio del tablero.`)],
  [tr('Five in a row', 'Cinco en línea'), tr('Cover a whole row or column and it pays by the POKER HAND those five cards make. A pair gives your price back; the better the hand, the bigger the prize. Only your best line counts.', 'Cubre una fila o columna completa y paga según la MANO DE PÓQUER que forman esas cinco cartas. Una pareja te devuelve el precio; cuanto mejor la mano, mayor el premio. Solo cuenta tu mejor línea.')],
  [tr('Poker hands, best to worst', 'Manos de póquer, de mejor a peor'), tr('Straight flush · four of a kind · full house (3 + 2) · flush (same suit) · straight (in a row) · three of a kind · two pair · pair · high card.', 'Escalera de color · póker (4 iguales) · full (3 + 2) · color (mismo palo) · escalera (seguidas) · trío · doble pareja · pareja · carta alta.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Just watch the cards fall! Two cheap boards give you more chances than one expensive one.', '¡Solo mira caer las cartas! Dos tableros baratos te dan más oportunidades que uno caro.')],
]);

const mini = (c: Card) => h('span.pb-face' + (isRed(c) ? '.red' : ''), {}, rankLabel(c.rank), h('small', {}, SUIT_GLYPH[c.suit]));

export const pokerBingoScreen: Screen = root => {
  const rng = makeRng();
  let alive = true, running = false;
  let picked = [...profile.pokerBingo.boards];
  let boards: Card[][] = picked.map(n => BOARDS[n - 1]);
  let called = new Set<string>();
  const callEl = h('div.pb-call', { html: cardSvg({ rank: 14, suit: 'S' }, true) });
  const countEl = h('div.ball-count', {}, `0 / ${CALLS}`);
  const recent = h('div.pb-recent');
  const boardsBox = h('div.pb-boards');
  const result = h('div.result', {}, tr('Pick up to 4 boards and their price, then play', 'Elige hasta 4 tableros y su precio, y juega'));
  const price = betStepper(PRICES, 10, tr('Board price', 'Precio'));
  const playBtn = h('button.btn.primary.wide', { onclick: () => void play() }, tr('PLAY', 'JUGAR'));
  const picker = h('div.pb-picker');

  function renderPicker() {
    picker.replaceChildren(h('span.pb-pick-label', {}, tr('Boards', 'Tableros')), ...Array.from({ length: BOARD_COUNT }, (_, i) => {
      const n = i + 1, on = picked.includes(n);
      return h('button.pb-pick' + (on ? '.on' : ''), { disabled: running, 'aria-pressed': String(on), onclick: () => toggleBoard(n) }, String(n));
    }));
  }

  function toggleBoard(n: number) {
    if (running) return;
    if (picked.includes(n)) { if (picked.length === 1) return; picked = picked.filter(x => x !== n); }
    else if (picked.length >= 4) { resultBanner(result, tr('Up to 4 boards: tap one to take it out first', 'Hasta 4 tableros: toca uno para quitarlo primero'), 'info'); return; }
    else picked = [...picked, n].sort((a, b) => a - b);
    profile.pokerBingo.boards = picked; save();
    boards = picked.map(x => BOARDS[x - 1]);
    called = new Set();
    sfx('chip');
    renderPicker(); render();
  }

  function render(just?: string, lines: (number[] | null)[] = []) {
    boardsBox.dataset.n = String(boards.length);
    boardsBox.replaceChildren(...boards.map((b, bi) => h('div.pb-board', {},
      h('div.pb-num', {}, `#${picked[bi]}`),
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
    running = true; playBtn.disabled = true; price.setEnabled(false); renderPicker();
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
      if (bits.length) parts.push(`${boards.length > 1 ? `#${picked[i]} ` : ''}${bits.join(' + ')}`);
    });
    if (won > cost) {
      resultBanner(result, `${parts.join(' · ')}  +${fmt(won)}`, 'win');
      const big = results.some(r => r.hand !== null && r.hand >= 4) || won >= cost * 5;
      sfx(big ? 'jackpot' : 'win'); coinBurst(boardsBox, big ? 40 : 16); buzz(big);
    } else if (won) { resultBanner(result, `${parts.join(' · ')}  +${fmt(won)}`, 'push'); sfx('chip'); }
    else { resultBanner(result, tr('No prize this time', 'Esta vez sin premio'), 'lose'); sfx('lose'); }
    running = false; playBtn.disabled = false; price.setEnabled(true); renderPicker();
  }

  const pays = h('div.pb-pays', {},
    ...PAY.line.map((m, c) => [handName(c), m] as [string, number]).filter(([, m]) => m > 0).reverse().map(([n, m]) => h('span', {}, `${n} ×${m}`)),
    h('span', {}, tr(`Corners ×${PAY.corners}`, `Esquinas ×${PAY.corners}`)), h('span', {}, tr(`Center ×${PAY.center}`, `Centro ×${PAY.center}`)));

  root.classList.add('pokerbingo');
  root.append(topBar(tr('Poker Bingo', 'Bingo Póquer')),
    h('div.pb-top', {}, callEl, h('div.pb-side', {}, countEl, recent)),
    boardsBox, result, picker,
    h('div.controls', {}, price.el),
    h('div.controls', {}, h('button.btn.small', { onclick: pokerBingoHowTo }, tr('How to play', 'Cómo jugar')), playBtn),
    h('details.pb-paybox', {}, h('summary', {}, tr('Prizes (× board price)', 'Premios (× precio del tablero)')), pays));
  renderPicker(); render();
  return () => { alive = false; };
};
