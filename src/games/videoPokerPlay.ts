import { sfx } from '../audio';
import { shuffledDeck, type Card } from '../core/cards';
import { evaluate, HAND_NAMES, PAY_ORDER, PAYS } from '../core/poker';
import { makeRng } from '../core/rng';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { cardSvg } from '../ui/art';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { betStepper, cantAfford, resultBanner } from './kit';

const BETS = [10, 25, 50, 100, 250, 500];

export const videoPokerScreen: Screen = root => {
  const rng = makeRng();
  let alive = true;
  let deck: Card[] = [];
  let hand: (Card | null)[] = [null, null, null, null, null];
  let held = [false, false, false, false, false];
  let phase: 'bet' | 'draw' = 'bet';
  let bet = 25;

  const result = h('div.result', {}, 'Deal, hold the cards you want, then draw');
  const stepper = betStepper(BETS, 25, 'Bet', v => { bet = v; renderPays(); });
  const pays = h('div.vp-pays');
  const row = h('div.vp-hand');
  const btn = h('button.btn.primary.wide', { onclick: () => void (phase === 'bet' ? deal() : drawCards()) }, 'DEAL');

  function renderPays(hit?: string) {
    pays.replaceChildren(...PAY_ORDER.map(k => h('div.vp-pay' + (k === hit ? '.hit' : ''), {}, h('span', {}, HAND_NAMES[k]), h('span.num', {}, fmt(PAYS[k] * bet)))));
  }

  function render(fresh: number[] = []) {
    row.replaceChildren(...hand.map((c, i) => {
      const el = h('button.vp-card' + (held[i] ? '.held' : ''), {
        html: cardSvg(c, !c),
        onclick: () => { if (phase !== 'draw') return; held[i] = !held[i]; sfx('click'); render(); },
      });
      el.append(h('span.held-tag', {}, 'HELD'));
      if (fresh.includes(i)) el.classList.add('deal-in');
      return el;
    }));
  }

  async function deal() {
    if (cantAfford(bet)) return;
    addChips(-bet);
    stepper.setEnabled(false);
    deck = shuffledDeck(rng);
    held = [false, false, false, false, false];
    hand = [null, null, null, null, null];
    render();
    for (let i = 0; i < 5; i++) {
      hand[i] = deck.pop()!;
      sfx('card');
      render([i]);
      await sleep(120);
      if (!alive) return;
    }
    phase = 'draw';
    btn.textContent = 'DRAW';
    const now = evaluate(hand as Card[]);
    resultBanner(result, PAYS[now] ? `You have ${HAND_NAMES[now]}` : 'Tap cards to hold them', 'info');
    renderPays(PAYS[now] ? now : undefined);
  }

  async function drawCards() {
    phase = 'bet';
    btn.disabled = true;
    const fresh: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (held[i]) continue;
      hand[i] = deck.pop()!;
      fresh.push(i);
      sfx('card');
      render([i]);
      await sleep(140);
      if (!alive) return;
    }
    const kind = evaluate(hand as Card[]);
    const win = PAYS[kind] * bet;
    renderPays(win ? kind : undefined);
    countPlay('videopoker', win > bet);
    if (win) {
      addChips(win);
      sfx(PAYS[kind] >= 25 ? 'bigwin' : 'win');
      if (PAYS[kind] >= 9) { buzz(true); coinBurst(row, 30); } else coinBurst(btn, 10);
      resultBanner(result, `${HAND_NAMES[kind]}  +${fmt(win)}`, win > bet ? 'win' : 'push');
    } else {
      sfx('lose');
      resultBanner(result, HAND_NAMES[kind], 'lose');
    }
    held = [false, false, false, false, false];
    btn.textContent = 'DEAL';
    btn.disabled = false;
    stepper.setEnabled(true);
  }

  root.classList.add('table-game', 'felt', 'vpoker');
  root.append(topBar('Video Poker'), pays, row, result, h('div.controls', {}, stepper.el), h('div.controls', {}, btn));
  renderPays();
  render();
  return () => { alive = false; };
};
