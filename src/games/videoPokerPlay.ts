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
import { lang, tr } from '../i18n';
import { howToPlay } from './howto';
import type { PokerHand } from '../core/poker';

const NAMES_ES: Record<PokerHand, string> = {
  royal: 'Escalera Real', straightFlush: 'Escalera de Color', four: 'Póquer', fullHouse: 'Full',
  flush: 'Color', straight: 'Escalera', three: 'Trío', twoPair: 'Doble Pareja',
  jacks: 'Jotas o Mejor', pair: 'Pareja Baja', high: 'Sin premio',
};
const handName = (k: PokerHand) => (lang() === 'es' ? NAMES_ES[k] : HAND_NAMES[k]);

export const videoPokerHowTo = () => howToPlay(tr('How to play Video Poker', 'Cómo jugar al Video Póquer'), [
  [tr('The goal', 'El objetivo'), tr('Make the best 5-card poker hand you can. A pair of jacks or better pays; better hands pay more (see the table at the top).', 'Forma la mejor mano de póquer de 5 cartas. Una pareja de jotas o mejor paga; las manos mejores pagan más (mira la tabla de arriba).')],
  [tr('Deal', 'Repartir'), tr('Choose your bet and tap DEAL. You get 5 cards.', 'Elige tu apuesta y toca REPARTIR. Recibes 5 cartas.')],
  [tr('Hold', 'Guardar'), tr('Tap the cards you want to keep: they show HELD. Tap again to let one go.', 'Toca las cartas que quieres conservar: muestran GUARDADA. Toca otra vez para soltarla.')],
  [tr('Draw', 'Cambiar'), tr('Tap DRAW. Every card you did not hold is replaced. Your final hand is paid from the table.', 'Toca CAMBIAR. Las cartas que no guardaste se reemplazan. Tu mano final se paga según la tabla.')],
  [tr('Hands, best to worst', 'Manos, de mejor a peor'), tr('Royal flush (A K Q J 10 same suit) · straight flush · four of a kind · full house (3 + 2) · flush (same suit) · straight (in a row) · three of a kind · two pair · jacks or better (pair of J, Q, K or A).', 'Escalera real (A K Q J 10 del mismo palo) · escalera de color · póquer (4 iguales) · full (3 + 2) · color (mismo palo) · escalera (seguidas) · trío · doble pareja · jotas o mejor (pareja de J, Q, K o A).')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Always keep a pair. With nothing, keep any jack, queen, king or ace. Keep four cards of the same suit to try for a flush.', 'Guarda siempre una pareja. Si no tienes nada, guarda cualquier J, Q, K o A. Guarda cuatro cartas del mismo palo para buscar color.')],
]);

const BETS = [10, 25, 50, 100, 250, 500];

export const videoPokerScreen: Screen = root => {
  const rng = makeRng();
  let alive = true;
  let deck: Card[] = [];
  let hand: (Card | null)[] = [null, null, null, null, null];
  let held = [false, false, false, false, false];
  let phase: 'bet' | 'draw' = 'bet';
  let bet = 25;

  const result = h('div.result', {}, tr('Deal, hold the cards you want, then draw', 'Reparte, guarda las cartas que quieras y cambia'));
  const stepper = betStepper(BETS, 25, tr('Bet', 'Apuesta'), v => { bet = v; renderPays(); });
  const pays = h('div.vp-pays');
  const row = h('div.vp-hand');
  const btn = h('button.btn.primary.wide', { onclick: () => void (phase === 'bet' ? deal() : drawCards()) }, tr('DEAL', 'REPARTIR'));

  function renderPays(hit?: string) {
    pays.replaceChildren(...PAY_ORDER.map(k => h('div.vp-pay' + (k === hit ? '.hit' : ''), {}, h('span', {}, handName(k)), h('span.num', {}, fmt(PAYS[k] * bet)))));
  }

  function render(fresh: number[] = []) {
    row.replaceChildren(...hand.map((c, i) => {
      const el = h('button.vp-card' + (held[i] ? '.held' : ''), {
        html: cardSvg(c, !c),
        onclick: () => { if (phase !== 'draw') return; held[i] = !held[i]; sfx('click'); render(); },
      });
      el.append(h('span.held-tag', {}, tr('HELD', 'GUARDADA')));
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
    btn.textContent = tr('DRAW', 'CAMBIAR');
    const now = evaluate(hand as Card[]);
    resultBanner(result, PAYS[now] ? tr(`You have ${handName(now)}`, `Tienes ${handName(now)}`) : tr('Tap cards to hold them', 'Toca las cartas para guardarlas'), 'info');
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
      resultBanner(result, `${handName(kind)}  +${fmt(win)}`, win > bet ? 'win' : 'push');
    } else {
      sfx('lose');
      resultBanner(result, handName(kind), 'lose');
    }
    held = [false, false, false, false, false];
    btn.textContent = tr('DEAL', 'REPARTIR');
    btn.disabled = false;
    stepper.setEnabled(true);
  }

  root.classList.add('table-game', 'felt', 'vpoker');
  root.append(topBar(tr('Video Poker', 'Video Póquer')), pays, row, result, h('div.controls', {}, stepper.el), h('div.controls', {}, btn),
    h('div.controls', {}, h('button.btn.small', { onclick: videoPokerHowTo }, tr('How to play', 'Cómo jugar'))));
  renderPays();
  render();
  return () => { alive = false; };
};
