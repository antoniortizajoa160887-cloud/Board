import { sfx } from '../audio';
import { bacPayout, playCoup, total, type BacBet, type Coup } from '../core/baccarat';
import { shuffledDeck, type Card } from '../core/cards';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile } from '../save';
import { cardSvg, dealerSvg } from '../ui/art';
import { coinBurst, fmt, h, sleep, toast } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { chipPicker, resultBanner, stackLabel } from './kit';

export const baccaratHowTo = () => howToPlay(tr('How to play Baccarat', 'Cómo jugar al Baccarat'), [
  [tr('The idea', 'La idea'), tr('Two hands are dealt: PLAYER and BANKER. You bet on which one ends closer to 9, or on a tie. You don\'t make any choices once the cards are dealt.', 'Se reparten dos manos: JUGADOR y BANCA. Apuestas a cuál queda más cerca de 9, o a un empate. Después del reparto no tienes que decidir nada.')],
  [tr('Card values', 'Valor de las cartas'), tr('Ace = 1, 2 to 9 = their number, 10, J, Q and K = 0.', 'As = 1, del 2 al 9 = su número, 10, J, Q y K = 0.')],
  [tr('Only the last digit counts', 'Solo cuenta el último dígito'), tr('7 + 8 = 15, so the hand is worth 5. The best hand is 9.', '7 + 8 = 15, así que la mano vale 5. La mejor mano es 9.')],
  [tr('Third cards', 'Tercera carta'), tr('The dealer gives a third card by fixed rules (for example, PLAYER draws on 0 to 5). It\'s all automatic.', 'El crupier da una tercera carta según reglas fijas (por ejemplo, JUGADOR pide con 0 a 5). Todo es automático.')],
  [tr('Betting', 'Apostar'), tr('Pick a chip, tap PLAYER, BANKER or TIE, then tap DEAL. You can bet on more than one.', 'Elige una ficha, toca JUGADOR, BANCA o EMPATE y luego REPARTIR. Puedes apostar a más de uno.')],
  [tr('Payouts', 'Pagos'), tr('PLAYER pays 1 to 1. BANKER pays 1 to 1 minus a 5% fee. TIE pays 8 to 1. On a tie, PLAYER and BANKER bets come back to you.', 'JUGADOR paga 1 a 1. BANCA paga 1 a 1 menos una comisión del 5%. EMPATE paga 8 a 1. Si hay empate, te devuelven las apuestas a JUGADOR y BANCA.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('BANKER wins a little more often, so it\'s the safest bet. TIE pays a lot but rarely hits.', 'BANCA gana un poco más seguido, así que es la apuesta más segura. EMPATE paga mucho pero sale poco.')],
]);

export const baccaratScreen: Screen = root => {
  const rng = makeRng();
  let shoe = shuffledDeck(rng, 8);
  const next = (): Card => { if (shoe.length < 30) shoe = shuffledDeck(rng, 8); return shoe.pop()!; };
  let alive = true, busy = false;
  let bets: Partial<Record<BacBet, number>> = {};
  let lastBets: typeof bets = {};
  const road: Coup['winner'][] = [];
  const picker = chipPicker([10, 25, 100, 500, 1000], 25);

  const label: Record<BacBet, string> = { player: tr('PLAYER', 'JUGADOR'), banker: tr('BANKER', 'BANCA'), tie: tr('TIE', 'EMPATE') };
  const pays: Record<BacBet, string> = { player: '1:1', banker: tr('1:1 − 5%', '1:1 − 5%'), tie: '8:1' };
  const spots = {} as Record<BacBet, HTMLElement>;
  const spotRow = h('div.bac-spots', {}, ...(['player', 'tie', 'banker'] as BacBet[]).map(k => {
    spots[k] = h('button.bac-spot.' + k, { onclick: () => place(k) }, h('span.bac-spot-name', {}, label[k]), h('span.bac-spot-pay', {}, pays[k]));
    return spots[k];
  }));
  const pRow = h('div.cards-row'), bRow = h('div.cards-row');
  const pTot = h('div.bac-total'), bTot = h('div.bac-total');
  const roadEl = h('div.bac-road');
  const result = h('div.result', {}, tr('Pick a chip and tap a bet', 'Elige una ficha y toca una apuesta'));
  const sum = () => Object.values(bets).reduce((a, b) => a + (b ?? 0), 0);

  function renderBets() {
    (Object.keys(spots) as BacBet[]).forEach(k => {
      spots[k].querySelector('.rchip')?.remove();
      if (bets[k]) spots[k].append(h('span.rchip', {}, stackLabel(bets[k]!)));
    });
  }
  function renderRoad() {
    roadEl.replaceChildren(...road.slice(-36).map(w => h('span.bead.' + w, {}, w === 'player' ? tr('P', 'J') : w === 'banker' ? tr('B', 'B') : tr('T', 'E'))));
  }
  function place(k: BacBet) {
    if (busy) return;
    const v = picker.get();
    if (profile.wallet.chips < v) { toast(tr('Not enough chips', 'No tienes fichas suficientes'), 'lose'); return; }
    addChips(-v); bets[k] = (bets[k] ?? 0) + v; sfx('chip'); renderBets();
  }
  function clear() { if (busy) return; const t = sum(); if (t) addChips(t); bets = {}; renderBets(); }
  function rebet() {
    if (busy) return;
    const t = Object.values(lastBets).reduce((a, b) => a + (b ?? 0), 0);
    if (!t) return;
    clear();
    if (profile.wallet.chips < t) { toast(tr('Not enough chips', 'No tienes fichas suficientes'), 'lose'); return; }
    addChips(-t); bets = { ...lastBets }; sfx('chip'); renderBets();
  }
  const show = (row: HTMLElement, cards: Card[], tot: HTMLElement) => {
    row.replaceChildren(...cards.map((c, i) => h('div.pcard-wrap' + (i === 2 ? '.third' : ''), { html: cardSvg(c) })));
    tot.textContent = cards.length ? String(total(cards)) : '';
  };

  async function deal() {
    if (busy) return;
    if (!sum()) { toast(tr('Place a bet first', 'Primero haz una apuesta')); return; }
    busy = true; dealBtn.disabled = true;
    lastBets = { ...bets };
    resultBanner(result, '', 'info');
    pTot.className = bTot.className = 'bac-total';
    const coup = playCoup(next);
    const p: Card[] = [], b: Card[] = [];
    const order: [Card[], Card, HTMLElement, HTMLElement][] = [
      [p, coup.player[0], pRow, pTot], [b, coup.banker[0], bRow, bTot], [p, coup.player[1], pRow, pTot], [b, coup.banker[1], bRow, bTot]];
    if (coup.player[2]) order.push([p, coup.player[2], pRow, pTot]);
    if (coup.banker[2]) order.push([b, coup.banker[2], bRow, bTot]);
    show(pRow, [], pTot); show(bRow, [], bTot);
    for (const [arr, c, row, tot] of order) {
      if (arr.length === 2) await sleep(450);
      arr.push(c); sfx('card'); show(row, arr, tot);
      row.lastElementChild?.classList.add('deal-in');
      await sleep(420);
      if (!alive) return;
    }
    (coup.winner === 'player' ? pTot : coup.winner === 'banker' ? bTot : null)?.classList.add('win');
    if (coup.winner === 'tie') { pTot.classList.add('win'); bTot.classList.add('win'); }
    let back = 0;
    for (const k of Object.keys(bets) as BacBet[]) back += bacPayout(k, bets[k]!, coup.winner);
    const staked = sum();
    if (back) addChips(back);
    const net = back - staked;
    countPlay('baccarat', net > 0);
    road.push(coup.winner); renderRoad();
    const who = coup.winner === 'tie' ? tr('Tie', 'Empate') : coup.winner === 'player' ? tr('Player wins', 'Gana el jugador') : tr('Banker wins', 'Gana la banca');
    const nat = coup.natural ? tr(' · natural', ' · natural') : '';
    resultBanner(result, `${who} ${total(coup.player)}–${total(coup.banker)}${nat}${net > 0 ? `  +${fmt(net)}` : net < 0 ? `  −${fmt(-net)}` : ''}`, net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
    if (net > 0) { sfx(coup.winner === 'tie' ? 'bigwin' : 'win'); coinBurst(spots[coup.winner]); buzz(); } else if (net < 0) sfx('lose');
    bets = {}; renderBets();
    busy = false; dealBtn.disabled = false;
  }

  const dealBtn = h('button.btn.primary', { onclick: () => void deal() }, tr('DEAL', 'REPARTIR'));
  root.classList.add('table-game', 'felt');
  root.append(topBar('Baccarat'),
    h('div.table.bac-table', {},
      h('div.dealer-spot', {}, h('div.dealer-mini', { html: dealerSvg() }), roadEl),
      h('div.bac-hands', {},
        h('div.bac-hand', {}, h('div.bac-label', {}, label.player), pRow, pTot),
        h('div.bac-hand', {}, h('div.bac-label', {}, label.banker), bRow, bTot)),
      h('div.felt-text', {}, tr('BANKER PAYS 19 TO 20 · TIE PAYS 8 TO 1', 'BANCA PAGA 19 A 20 · EMPATE PAGA 8 A 1')),
      spotRow),
    result, picker.el,
    h('div.controls', {},
      h('button.btn.small', { onclick: clear }, tr('Clear', 'Quitar')),
      h('button.btn.small', { onclick: rebet }, tr('Rebet', 'Repetir')),
      dealBtn,
      h('button.btn.small', { onclick: baccaratHowTo }, tr('How to play', 'Cómo jugar'))));
  return () => { alive = false; if (!busy) { const t = sum(); if (t) addChips(t); } };
};
