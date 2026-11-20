import { sfx } from '../audio';
import { canSplit, dealerShouldHit, handTotal, isBlackjack, settle, type Outcome } from '../core/blackjack';
import { shuffledDeck, type Card } from '../core/cards';
import { makeRng } from '../core/rng';
import { buzz } from '../platform';
import { addChips, countPlay, profile } from '../save';
import { cardSvg, dealerSvg } from '../ui/art';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { betStepper, cantAfford, resultBanner } from './kit';

const BETS = [10, 25, 50, 100, 250, 500, 1000];
const DECKS = 6;

interface Hand { cards: Card[]; bet: number; done: boolean; split: boolean; doubled: boolean }

export const blackjackScreen: Screen = root => {
  const rng = makeRng();
  let shoe = shuffledDeck(rng, DECKS);
  let alive = true;
  let dealer: Card[] = [];
  let hands: Hand[] = [];
  let active = 0;
  let holeHidden = true;
  let phase: 'bet' | 'play' | 'done' = 'bet';

  const draw = (): Card => {
    if (shoe.length < 52 * DECKS * 0.25) { shoe = shuffledDeck(rng, DECKS); }
    return shoe.pop()!;
  };

  const dealerRow = h('div.cards-row.dealer-row');
  const dealerTotal = h('div.hand-total');
  const handsBox = h('div.hands');
  const result = h('div.result', {}, 'Place your bet');
  const stepper = betStepper(BETS, 50);

  const dealBtn = h('button.btn.primary.wide', { onclick: () => void deal() }, 'DEAL');
  const hitBtn = h('button.btn', { onclick: () => void hit() }, 'Hit');
  const standBtn = h('button.btn', { onclick: () => void stand() }, 'Stand');
  const doubleBtn = h('button.btn', { onclick: () => void doubleDown() }, 'Double');
  const splitBtn = h('button.btn', { onclick: () => void split() }, 'Split');
  const betBar = h('div.controls', {}, stepper.el, dealBtn);
  const playBar = h('div.controls', {}, hitBtn, standBtn, doubleBtn, splitBtn);

  function render(newCard?: Card) {
    dealerRow.replaceChildren(...dealer.map((c, i) => {
      const el = h('div.pcard-wrap', { html: cardSvg(c, i === 1 && holeHidden) });
      if (c === newCard) el.classList.add('deal-in');
      return el;
    }));
    const dt = holeHidden && dealer.length ? handTotal([dealer[0]]).total : handTotal(dealer).total;
    dealerTotal.textContent = dealer.length ? String(dt) : '';
    handsBox.replaceChildren(...hands.map((hd, i) => {
      const t = handTotal(hd.cards);
      return h('div.hand' + (i === active && phase === 'play' && hands.length > 1 ? '.active' : ''), {},
        h('div.cards-row', {}, ...hd.cards.map(c => {
          const el = h('div.pcard-wrap', { html: cardSvg(c) });
          if (c === newCard) el.classList.add('deal-in');
          return el;
        })),
        h('div.hand-total', {}, `${t.soft && t.total < 21 ? 'soft ' : ''}${t.total}`, h('span.hand-bet', {}, ` · bet ${fmt(hd.bet)}`)));
    }));
    betBar.hidden = phase === 'play';
    playBar.hidden = phase !== 'play';
    const hd = hands[active];
    if (phase === 'play' && hd) {
      doubleBtn.disabled = hd.cards.length !== 2 || profile.wallet.chips < hd.bet;
      splitBtn.disabled = !(hands.length === 1 && canSplit(hd.cards) && profile.wallet.chips >= hd.bet);
    }
  }

  async function deal() {
    const bet = stepper.get();
    if (cantAfford(bet)) return;
    addChips(-bet);
    phase = 'play';
    holeHidden = true;
    dealer = [];
    hands = [{ cards: [], bet, done: false, split: false, doubled: false }];
    active = 0;
    resultBanner(result, '', 'info');
    for (const who of ['p', 'd', 'p', 'd']) {
      const c = draw();
      if (who === 'p') hands[0].cards.push(c); else dealer.push(c);
      sfx('card');
      render(c);
      await sleep(260);
      if (!alive) return;
    }
    if (isBlackjack(hands[0].cards) || isBlackjack(dealer)) { await finish(); return; }
    render();
  }

  async function hit() {
    const hd = hands[active];
    const c = draw();
    hd.cards.push(c);
    sfx('card');
    render(c);
    if (handTotal(hd.cards).total >= 21) { await sleep(300); await next(); }
  }

  async function stand() { await next(); }

  async function doubleDown() {
    const hd = hands[active];
    addChips(-hd.bet);
    hd.bet *= 2;
    hd.doubled = true;
    sfx('chip');
    const c = draw();
    hd.cards.push(c);
    sfx('card');
    render(c);
    await sleep(400);
    await next();
  }

  async function split() {
    const hd = hands[0];
    addChips(-hd.bet);
    sfx('chip');
    hands = [
      { cards: [hd.cards[0], draw()], bet: hd.bet, done: false, split: true, doubled: false },
      { cards: [hd.cards[1], draw()], bet: hd.bet, done: false, split: true, doubled: false },
    ];
    sfx('card');
    render();
    // Split aces get one card each.
    if (hd.cards[0].rank === 14) { active = 1; await next(); }
  }

  async function next() {
    hands[active].done = true;
    if (active < hands.length - 1) {
      active++;
      render();
      return;
    }
    await finish();
  }

  async function finish() {
    phase = 'done';
    holeHidden = false;
    sfx('card');
    render();
    await sleep(500);
    const anyAlive = hands.some(hd => handTotal(hd.cards).total <= 21) && !(hands.length === 1 && isBlackjack(hands[0].cards));
    while (anyAlive && dealerShouldHit(dealer) && alive) {
      const c = draw();
      dealer.push(c);
      sfx('card');
      render(c);
      await sleep(550);
    }
    if (!alive) return;
    let paid = 0, staked = 0;
    const outcomes: Outcome[] = [];
    for (const hd of hands) {
      const r = settle(hd.cards, dealer, hd.bet, hd.split);
      outcomes.push(r.outcome);
      paid += r.payout;
      staked += hd.bet;
    }
    if (paid) addChips(paid);
    const net = paid - staked;
    countPlay('blackjack', net > 0);
    const label: Record<Outcome, string> = { blackjack: 'Blackjack!', win: 'You win', push: 'Push', lose: 'Ollie wins' };
    const text = outcomes.map(o => label[o]).join(' · ') + (net > 0 ? `  +${fmt(net)}` : net < 0 ? `  −${fmt(-net)}` : '');
    if (net > 0) { sfx(outcomes.includes('blackjack') ? 'bigwin' : 'win'); coinBurst(handsBox); buzz(); }
    else if (net < 0) sfx('lose');
    resultBanner(result, text, net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
    render();
  }

  const rules = h('button.btn.small', { onclick: () => dialog('Blackjack 21', h('div', {},
    h('p', {}, 'Get closer to 21 than Ollie without going over. Face cards count 10, aces 1 or 11.'),
    h('p', {}, 'Blackjack pays 3 to 2. Ollie stands on every 17. Double on your first two cards, split one pair (split aces get one card each). Six decks, reshuffled when a quarter is left.'))) }, 'Rules');

  root.classList.add('table-game', 'felt');
  root.append(topBar('Blackjack 21'),
    h('div.table', {},
      h('div.dealer-spot', {}, h('div.dealer-mini', { html: dealerSvg() }), h('div', {}, dealerRow, dealerTotal)),
      h('div.felt-text', {}, 'BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17'),
      handsBox),
    result, betBar, playBar, h('div.controls', {}, rules));
  render();
  return () => { alive = false; };
};
