import { sfx } from '../audio';
import { BALLS_PER_GAME, drawOrder, LETTERS, letterOf, makeCard, PRIZE_PAYS, prizes, type BingoCard, type Prize } from '../core/bingo';
import { makeRng } from '../core/rng';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { betStepper, cantAfford, resultBanner } from './kit';

const PRICES = [10, 25, 50, 100, 250];
const PRIZE_NAMES: Record<Prize, string> = { line: 'Line', corners: 'Four corners', twoLines: 'Two lines', full: 'Full card' };

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
  const result = h('div.result', {}, 'Pick how many cards and their price, then play');
  const price = betStepper(PRICES, 25, 'Card price');
  const count = betStepper([1, 2, 3, 4], 1, 'Cards', n => newCards(n), v => String(v));
  const playBtn = h('button.btn.primary.wide', { onclick: () => void play() }, 'PLAY');

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
      h('div.bingo-prizes', {}, ...[...paidPrizes[ci]].map(p => h('span.prize-tag', {}, PRIZE_NAMES[p]))))));
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
    resultBanner(result, 'Here we go!', 'info');
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
      sfx('ball');
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
          buzz(p === 'full');
          coinBurst(cardsBox.children[ci], p === 'full' ? 50 : 12);
          resultBanner(result, `${p === 'full' ? 'BINGO! ' : ''}${PRIZE_NAMES[p]} +${fmt(amount)}`, 'win');
          render();
        }
      });
      if (cards.every((_, ci) => paidPrizes[ci].has('full'))) break;
    }
    countPlay('bingo', won > cost);
    resultBanner(result, won ? `Game over · you won ${fmt(won)}` : 'Game over · no prize this time', won > cost ? 'win' : won ? 'push' : 'lose');
    running = false;
    playBtn.disabled = false;
    price.setEnabled(true);
    count.setEnabled(true);
  }

  const rules = h('button.btn.small', { onclick: () => dialog('Bingo', h('div', {},
    h('p', {}, `${BALLS_PER_GAME} balls are called. Your cards mark themselves.`),
    h('p', {}, `Each card pays once per prize, times its price: line (row, column or diagonal) ${PRIZE_PAYS.line}× · four corners ${PRIZE_PAYS.corners}× · two lines ${PRIZE_PAYS.twoLines}× · full card ${PRIZE_PAYS.full}×.`))) }, 'Rules');

  root.classList.add('bingo');
  root.append(topBar('Bingo'),
    h('div.caller', {}, ballEl, h('div', {}, countEl, recent)),
    cardsBox, result,
    h('div.controls', {}, count.el, price.el),
    h('div.controls', {}, rules, playBtn));
  render();
  return () => { alive = false; };
};
