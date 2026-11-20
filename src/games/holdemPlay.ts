import { sfx } from '../audio';
import type { Card } from '../core/cards';
import { act, best, botAction, CATEGORY_EN, CATEGORY_ES, categoryOf, newHand, pot, raiseRange, toCall, type Action, type Hand, type Seat } from '../core/holdem';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile } from '../save';
import { cardSvg } from '../ui/art';
import { BOTS } from '../ui/colorsArt';
import { img, say } from '../ui/assets';
import { coinBurst, fmt, h, sleep, toast } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { resultBanner } from './kit';

const BUY_IN = 1000, BB = 20;
const handName = (score: number) => tr(CATEGORY_EN[categoryOf(score)], CATEGORY_ES[categoryOf(score)]);

export const holdemHowTo = () => howToPlay(tr("How to play Hold'em", "Cómo jugar Hold'em"), [
  [tr('The goal', 'La meta'), tr('Win chips from the other players by having the best five-card hand, or by making everyone else fold.', 'Gana fichas a los demás teniendo la mejor mano de cinco cartas, o haciendo que todos se retiren.')],
  [tr('Your cards', 'Tus cartas'), tr('You get 2 private cards. Then 5 shared cards are dealt face up in the middle: 3 (the flop), 1 (the turn), 1 (the river).', 'Recibes 2 cartas privadas. Luego se reparten 5 cartas comunes boca arriba en el centro: 3 (el flop), 1 (el turn) y 1 (el river).')],
  [tr('Your hand', 'Tu mano'), tr('Use any 5 of your 7 cards (your 2 + the 5 shared). The game shows you what you have.', 'Usa 5 cualquiera de tus 7 cartas (tus 2 + las 5 comunes). El juego te muestra lo que tienes.')],
  [tr('Hand ranking, best first', 'Valor de las manos, de mayor a menor'), tr('Straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.', 'Escalera de color, póker, full, color, escalera, trío, doble pareja, pareja, carta alta.')],
  [tr('Blinds', 'Ciegas'), tr('Two players put in a small forced bet (10 and 20) before the cards, so there is always something to win.', 'Dos jugadores ponen una apuesta obligatoria pequeña (10 y 20) antes de las cartas, así siempre hay algo que ganar.')],
  [tr('Your turn', 'Tu turno'), tr('FOLD gives up the hand. CHECK passes when nobody has bet. CALL matches the bet. RAISE bets more (use the slider). ALL IN bets every chip you have at the table.', 'RETIRARSE abandona la mano. PASAR sigue sin apostar si nadie apostó. IGUALAR iguala la apuesta. SUBIR apuesta más (usa la barra). TODO apuesta todas tus fichas de la mesa.')],
  [tr('Showdown', 'Enseñar cartas'), tr('If two or more players are left after the river, the best hand wins the pot. Ties split it.', 'Si quedan dos o más jugadores después del river, la mejor mano gana el bote. Si empatan, se reparte.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Fold most weak starting cards. Play pairs, two high cards (A, K, Q, J) and cards of the same suit that are close together.', 'Retírate con la mayoría de las cartas débiles. Juega parejas, dos cartas altas (A, K, Q, J) y cartas del mismo palo que estén seguidas.')],
]);

export const holdemScreen: Screen = root => {
  if (profile.wallet.chips < BUY_IN) {
    root.append(topBar("Hold'em"), h('div.scroll', {}, h('p.center', {}, tr(`You need ${fmt(BUY_IN)} chips to sit at this table.`, `Necesitas ${fmt(BUY_IN)} fichas para sentarte en esta mesa.`))));
    return;
  }
  addChips(-BUY_IN);
  const rng = makeRng();
  const seats: Seat[] = [
    { name: tr('You', 'Tú'), stack: BUY_IN, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, bot: false, out: false },
    ...BOTS.map(b => ({ name: b.name, stack: BUY_IN, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, bot: true, out: false })),
  ];
  let dealer = Math.floor(rng() * 4);
  let hand: Hand | null = null;
  let alive = true, waiting = false;
  const says = new Map<number, string>();

  const seatEls = seats.map((_, i) => h('div.he-seat.s' + i));
  const boardEl = h('div.he-board');
  const potEl = h('div.he-pot');
  const result = h('div.result', {}, '');
  const myHand = h('div.he-myhand');
  const slider = h<HTMLInputElement>('input.he-slider', { type: 'range', step: '10', oninput: () => { raiseBtn.textContent = tr(`Raise to ${fmt(+slider.value)}`, `Subir a ${fmt(+slider.value)}`); } });
  const foldBtn = h('button.btn', { onclick: () => human({ type: 'fold' }) }, tr('Fold', 'Retirarse'));
  const callBtn = h('button.btn', { onclick: () => human(toCall(hand!) ? { type: 'call' } : { type: 'check' }) });
  const raiseBtn = h('button.btn.primary', { onclick: () => human({ type: 'raise', to: +slider.value }) });
  const allInBtn = h('button.btn.small', { onclick: () => { const r = raiseRange(hand!); if (r) human({ type: 'raise', to: r.max }); else human({ type: 'call' }); } }, tr('All in', 'Todo'));
  const actBar = h('div.he-actions', {}, h('div.controls', {}, foldBtn, callBtn, allInBtn), h('div.he-raise', {}, slider, raiseBtn));
  const nextBtn = h('button.btn.primary.wide', { onclick: () => void startHand() }, tr('NEXT HAND', 'SIGUIENTE MANO'));
  const nextBar = h('div.controls', {}, nextBtn);

  const cardsHtml = (cs: Card[], hidden: boolean, small = false) => cs.map(c => `<div class="he-card${small ? ' sm' : ''}">${cardSvg(c, hidden)}</div>`).join('');

  let wasMyTurn = false;
  function render() {
    const hd = hand;
    seats.forEach((s, i) => {
      const el = seatEls[i];
      const showCards = hd && (i === 0 || (hd.street === 'showdown' && !s.folded && hd.seats.filter(x => !x.folded && !x.out).length > 1));
      const bot = i > 0 ? BOTS[i - 1] : null;
      const winner = hd?.results?.find(r => r.seat === i);
      el.className = 'he-seat s' + i + (hd && hd.toAct === i ? ' turn' : '') + (s.folded ? ' folded' : '') + (s.out ? ' out' : '') + (winner ? ' won' : '');
      el.replaceChildren(...[
        h('div.he-avatar', { style: `--ring:${bot?.color ?? '#f5c542'}` }, img(bot?.pic ?? 'chars/ollie.webp', 'av-img', bot?.name ?? 'Ollie')),
        h('div.he-name', {}, s.name, hd && hd.dealer === i ? h('span.he-dealer', {}, 'D') : ''),
        h('div.he-stack', {}, fmt(s.stack)),
        i > 0 && hd && s.hole.length ? h('div.he-hole', { html: cardsHtml(s.hole, !showCards, true) }) : null,
        s.bet > 0 && hd?.street !== 'showdown' ? h('div.he-bet', {}, fmt(s.bet)) : null,
        says.get(i) ? h('div.he-say', {}, says.get(i)!) : null,
        winner && winner.won > 0 ? h('div.he-win', {}, '+' + fmt(winner.won)) : null].filter((x): x is HTMLButtonElement => !!x));
    });
    boardEl.innerHTML = hd ? cardsHtml(hd.board, false) + '<div class="he-card ghost"></div>'.repeat(5 - hd.board.length) : '';
    potEl.textContent = hd ? tr(`Pot ${fmt(pot(hd))}`, `Bote ${fmt(pot(hd))}`) : '';
    const me = seats[0];
    myHand.innerHTML = hd && me.hole.length ? cardsHtml(me.hole, false) : '';
    if (hd && me.hole.length && !me.folded) myHand.append(h('div.he-myname', {}, handName(best([...me.hole, ...hd.board]).score)));
    const myTurn = !!hd && hd.toAct === 0 && hd.street !== 'showdown';
    if (myTurn && !wasMyTurn) say('turn');
    wasMyTurn = myTurn;
    actBar.hidden = !myTurn;
    nextBar.hidden = !hd || hd.street !== 'showdown';
    if (myTurn) {
      const owe = toCall(hd);
      callBtn.textContent = owe ? tr(`Call ${fmt(Math.min(owe, me.stack))}`, `Igualar ${fmt(Math.min(owe, me.stack))}`) : tr('Check', 'Pasar');
      const r = raiseRange(hd);
      raiseBtn.disabled = slider.disabled = !r;
      if (r) {
        slider.min = String(r.min); slider.max = String(r.max);
        slider.value = String(Math.min(r.max, Math.max(r.min, Math.round((hd.currentBet + pot(hd) * 0.6) / 10) * 10)));
        raiseBtn.textContent = tr(`Raise to ${fmt(+slider.value)}`, `Subir a ${fmt(+slider.value)}`);
      } else raiseBtn.textContent = tr('Raise', 'Subir');
    }
  }

  const label = (a: Action, owe: number) => a.type === 'fold' ? tr('Fold', 'Me retiro') : a.type === 'check' || (a.type === 'call' && !owe) ? tr('Check', 'Paso') : a.type === 'call' ? tr('Call', 'Igualo') : tr(`Raise ${fmt(a.to)}`, `Subo ${fmt(a.to)}`);

  function human(a: Action) {
    if (!hand || hand.toAct !== 0) return;
    says.set(0, label(a, toCall(hand)));
    sfx(a.type === 'fold' ? 'card' : 'chip');
    act(hand, a);
    void loop();
  }

  async function loop() {
    if (waiting) return;
    waiting = true;
    let street = hand!.street;
    render();
    while (alive && hand && hand.street !== 'showdown' && hand.toAct > 0) {
      await sleep(750);
      if (!alive || !hand) return;
      const i = hand.toAct;
      const owe = toCall(hand);
      const a = botAction(hand, rng);
      says.set(i, label(a, owe));
      sfx(a.type === 'fold' ? 'card' : a.type === 'raise' ? 'chip' : 'tick');
      act(hand, a);
      if (hand.street !== street) { await streetChange(); street = hand.street; }
      render();
    }
    if (hand && hand.street !== street) await streetChange();
    waiting = false;
    render();
    if (hand?.street === 'showdown') finish();
  }

  async function streetChange() {
    says.clear();
    render();
    sfx('card');
    await sleep(400);
  }

  function finish() {
    const hd = hand!;
    const res = hd.results ?? [];
    const mine = res.find(r => r.seat === 0)?.won ?? 0;
    const net = mine - seats[0].total;
    if (seats[0].hole.length) countPlay('holdem', net > 0);
    const winners = res.filter(r => r.won > 0);
    const showdown = hd.seats.filter(s => !s.folded && !s.out).length > 1;
    const text = winners.map(r => `${seats[r.seat].name}${showdown ? ` · ${handName(r.score)}` : ''}`).join(' & ');
    resultBanner(result, tr(`${text} wins ${fmt(pot(hd))}`, `${text} gana ${fmt(pot(hd))}`), net > 0 ? 'win' : net < 0 ? 'lose' : 'info');
    if (net > 0) { sfx('win'); coinBurst(seatEls[0]); buzz(); } else if (net < 0) sfx('lose');
    // Computer players who run out buy back in, so the table stays full.
    seats.forEach((s, i) => { if (i > 0 && s.stack <= 0) { s.stack = BUY_IN; says.set(i, tr('Buys back in', 'Vuelve a comprar')); } });
    render();
    if (seats[0].stack <= 0) {
      dialog(tr('Out of chips at the table', 'Sin fichas en la mesa'), h('p', {}, tr(`Buy back in for ${fmt(BUY_IN)} chips?`, `¿Volver a comprar por ${fmt(BUY_IN)} fichas?`)), [
        { label: tr('Leave', 'Salir') },
        { label: tr('Buy in', 'Comprar'), primary: true, onclick: () => { if (profile.wallet.chips < BUY_IN) { toast(tr('Not enough chips', 'No tienes fichas suficientes'), 'lose'); return; } addChips(-BUY_IN); seats[0].stack = BUY_IN; render(); } },
      ]);
    }
  }

  async function startHand() {
    if (seats[0].stack <= 0) { toast(tr('Buy back in to keep playing', 'Vuelve a comprar para seguir jugando')); return; }
    says.clear();
    resultBanner(result, '', 'info');
    do dealer = (dealer + 1) % seats.length; while (seats[dealer].stack <= 0);
    hand = newHand(seats, dealer, BB, rng);
    sfx('card');
    render();
    await loop();
  }

  root.classList.add('table-game', 'felt', 'holdem');
  root.append(topBar("Hold'em"),
    h('div.table.he-table', {}, ...seatEls.slice(1), h('div.he-center', {}, potEl, boardEl), seatEls[0]),
    myHand, result, actBar, nextBar,
    h('div.controls', {}, h('button.btn.small', { onclick: holdemHowTo }, tr('How to play', 'Cómo jugar')),
      h('span.muted', {}, tr(`Blinds 10 / 20 · buy-in ${fmt(BUY_IN)}`, `Ciegas 10 / 20 · entrada ${fmt(BUY_IN)}`))));
  render();
  nextBtn.textContent = tr('DEAL', 'REPARTIR');
  nextBar.hidden = false;
  nextBtn.addEventListener('click', () => { nextBtn.textContent = tr('NEXT HAND', 'SIGUIENTE MANO'); }, { once: true });
  return () => {
    alive = false;
    // Leaving the table: chips in the current hand are lost, the rest of the stack comes back.
    if (seats[0].stack > 0) { addChips(seats[0].stack); toast(tr(`Cashed out ${fmt(seats[0].stack)} chips`, `Cobraste ${fmt(seats[0].stack)} fichas`), 'win'); }
  };
};
