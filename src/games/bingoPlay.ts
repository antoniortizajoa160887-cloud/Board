import { sfx } from '../audio';
import { say, sayCall } from '../ui/assets';
import { BALLS_PER_GAME, drawOrder, LETTERS, letterOf, makeCard, PRIZE_PAYS, prizes, type BingoCard, type Prize } from '../core/bingo';
import { makeRng } from '../core/rng';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { betStepper, cantAfford, resultBanner } from './kit';
import { tr } from '../i18n';
import { howToPlay } from './howto';

const PRICES = [10, 25, 50, 100, 250];
const PRIZE_NAMES = (): Record<Prize, string> => ({ line: tr('Line', 'Línea'), corners: tr('Four corners', 'Cuatro esquinas'), twoLines: tr('Two lines', 'Dos líneas'), full: tr('Full card', 'Cartón lleno') });

export const bingoHowTo = () => howToPlay(tr('How to play Bingo', 'Cómo jugar al Bingo'), [
  [tr('The idea', 'La idea'), tr(`Balls with numbers are called one by one (${BALLS_PER_GAME} per game). When a called number is on your card it gets marked for you.`, `Se cantan bolas con números una por una (${BALLS_PER_GAME} por partida). Si un número cantado está en tu cartón, se marca solo.`)],
  [tr('Get ready', 'Prepárate'), tr('Choose how many CARDS to play (1 to 4) and the PRICE of each card, then tap PLAY. More cards = more chances, but each one costs its price.', 'Elige cuántos CARTONES jugar (1 a 4) y el PRECIO de cada uno, y toca JUGAR. Más cartones = más oportunidades, pero cada uno cuesta su precio.')],
  [tr('Prizes', 'Premios'), tr(`Each card can win each prize once, times its price: a line (row, column or diagonal) ${PRIZE_PAYS.line}× · four corners ${PRIZE_PAYS.corners}× · two lines ${PRIZE_PAYS.twoLines}× · full card (BINGO!) ${PRIZE_PAYS.full}×.`, `Cada cartón puede ganar cada premio una vez, por su precio: una línea (fila, columna o diagonal) ${PRIZE_PAYS.line}× · cuatro esquinas ${PRIZE_PAYS.corners}× · dos líneas ${PRIZE_PAYS.twoLines}× · cartón lleno (¡BINGO!) ${PRIZE_PAYS.full}×.`)],
  [tr('Free space', 'Espacio libre'), tr('The star in the middle is free: it counts as already marked.', 'La estrella del centro es gratis: cuenta como ya marcada.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Just sit back and watch! Two cheap cards are a fun way to start.', '¡Solo relájate y mira! Dos cartones baratos son una buena forma de empezar.')],
]);

export const bingoScreen: Screen = root => {
  const rng = makeRng();
  let alive = true;
  let running = false;
  let cards: BingoCard[] = [makeCard(rng)];
  let paidPrizes: Set<Prize>[] = [new Set()];
  let called = new Set<number>();

  const ballEl = h('div.bingo-ball', {}, h('span.bl', {}, ''), h('span.bn', {}, '–'));
  const countEl = h('div.ball-count', {}, `0 / ${BALLS_PER_GAME}`);
  const recent = h('div.recent-balls');
  const cardsBox = h('div.bingo-cards');
  const result = h('div.result', {}, tr('Pick how many cards and their price, then play', 'Elige cuántos cartones y su precio, y juega'));
  const price = betStepper(PRICES, 25, tr('Card price', 'Precio'));
  const count = betStepper([1, 2, 3, 4], 1, tr('Cards', 'Cartones'), n => newCards(n), v => String(v));
  const playBtn = h('button.btn.primary.wide', { onclick: () => void play() }, tr('PLAY', 'JUGAR'));

  function newCards(n: number) {
    if (running) return;
    cards = Array.from({ length: n }, () => makeCard(rng));
    paidPrizes = cards.map(() => new Set());
    called = new Set();
    render();
  }

  function render(justCalled?: number) {
    cardsBox.dataset.n = String(cards.length);
    cardsBox.replaceChildren(...cards.map((card, ci) => h('div.bingo-card', {},
      h('div.bingo-head', {}, ...LETTERS.split('').map(l => h('span', {}, l))),
      h('div.bingo-grid', {}, ...card.map(n => {
        const hit = n === 0 || called.has(n);
        const el = h('div.bcell' + (hit ? '.on' : '') + (n === 0 ? '.free' : ''), {}, n === 0 ? '★' : String(n));
        if (n === justCalled) el.classList.add('daub');
        return el;
      })),
      h('div.bingo-prizes', {}, ...[...paidPrizes[ci]].map(p => h('span.prize-tag', {}, PRIZE_NAMES()[p]))))));
  }

  async function play() {
    if (running) return;
    const cost = price.get() * cards.length;
    if (cantAfford(cost)) return;
    addChips(-cost);
    running = true;
    playBtn.disabled = true;
    price.setEnabled(false);
    count.setEnabled(false);
    cards = cards.map(() => makeCard(rng));
    paidPrizes = cards.map(() => new Set());
    called = new Set();
    recent.replaceChildren();
    render();
    resultBanner(result, tr('Here we go!', '¡Allá vamos!'), 'info');
    const order = drawOrder(rng).slice(0, BALLS_PER_GAME);
    let won = 0;
    for (let i = 0; i < order.length; i++) {
      await sleep(i === 0 ? 400 : 650);
      if (!alive) return;
      const n = order[i];
      called.add(n);
      ballEl.className = 'bingo-ball col-' + letterOf(n);
      ballEl.firstElementChild!.textContent = letterOf(n);
      ballEl.lastElementChild!.textContent = String(n);
      ballEl.classList.remove('roll');
      void ballEl.offsetWidth;
      ballEl.classList.add('roll');
      countEl.textContent = `${i + 1} / ${BALLS_PER_GAME}`;
      recent.prepend(h('span.mini-ball.col-' + letterOf(n), {}, String(n)));
      while (recent.children.length > 8) recent.lastElementChild!.remove();
      sfx('ball'); sayCall(n);
      const onCard = cards.some(c => c.includes(n));
      if (onCard) setTimeout(() => sfx('daub'), 150);
      render(n);
      cards.forEach((card, ci) => {
        for (const p of prizes(card, called)) {
          if (paidPrizes[ci].has(p)) continue;
          paidPrizes[ci].add(p);
          const amount = PRIZE_PAYS[p] * price.get();
          won += amount;
          addChips(amount);
          sfx(p === 'full' ? 'jackpot' : 'win');
          if (p === 'full') say('bingo', { interrupt: true });
          buzz(p === 'full');
          coinBurst(cardsBox.children[ci], p === 'full' ? 50 : 12);
          resultBanner(result, `${p === 'full' ? tr('BINGO! ', '¡BINGO! ') : ''}${PRIZE_NAMES()[p]} +${fmt(amount)}`, 'win');
          render();
        }
      });
      if (cards.every((_, ci) => paidPrizes[ci].has('full'))) break;
    }
    countPlay('bingo', won > cost);
    resultBanner(result, won ? tr(`Game over · you won ${fmt(won)}`, `Fin del juego · ganaste ${fmt(won)}`) : tr('Game over · no prize this time', 'Fin del juego · esta vez sin premio'), won > cost ? 'win' : won ? 'push' : 'lose');
    running = false;
    playBtn.disabled = false;
    price.setEnabled(true);
    count.setEnabled(true);
  }

  const rules = h('button.btn.small', { onclick: bingoHowTo }, tr('How to play', 'Cómo jugar'));

  root.classList.add('bingo');
  root.append(topBar('Bingo'),
    h('div.caller', {}, ballEl, h('div', {}, countEl, recent)),
    cardsBox, result,
    h('div.controls', {}, count.el, price.el),
    h('div.controls', {}, rules, playBtn));
  render();
  return () => { alive = false; };
};
