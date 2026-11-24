import { sfx } from '../audio';
import type { Card } from '../core/cards';
import { makeRng } from '../core/rng';
import { fits, isMeld, newRummy, rumBot, rumDiscard, rumDraw, rumLayOff, rumMeld, rumScore, same, type Rummy } from '../core/rummy';
import { tr } from '../i18n';
import { cardSvg } from '../ui/art';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { finish, playersSeg, say, seatFace, seatName } from './tableKit';

export const rummyHowTo = () => howToPlay(tr('How to play Rummy', 'Cómo jugar al Rummy'), [
  [tr('The goal', 'El objetivo'), tr('Be the first to get rid of all your cards by putting them on the table in groups called melds.', 'Sé el primero en quedarte sin cartas poniéndolas en la mesa en grupos llamados combinaciones.')],
  [tr('Melds', 'Combinaciones'), tr('A SET is 3 or 4 cards of the same rank (7 7 7). A RUN is 3 or more cards in a row of the same suit (4 5 6 of hearts). Aces are low: A 2 3.', 'Un TRÍO es 3 o 4 cartas del mismo valor (7 7 7). Una ESCALERA es 3 o más cartas seguidas del mismo palo (4 5 6 de corazones). El as va abajo: A 2 3.')],
  [tr('1. Draw', '1. Robar'), tr('Start your turn by taking one card: the top of the deck, or the face-up card on the discard pile.', 'Empieza tu turno tomando una carta: la de arriba del mazo o la carta boca arriba del descarte.')],
  [tr('2. Meld', '2. Bajar'), tr('Tap cards to pick them, then LAY DOWN to put a meld on the table. To add one card to a meld already on the table, pick it and tap that meld.', 'Toca cartas para elegirlas y luego BAJAR para poner una combinación en la mesa. Para añadir una carta a una combinación de la mesa, elígela y toca esa combinación.')],
  [tr('3. Discard', '3. Descartar'), tr('End your turn by picking one card and tapping DISCARD. You can\'t throw back the card you just took from the discard pile.', 'Termina tu turno eligiendo una carta y tocando DESCARTAR. No puedes devolver la carta que acabas de tomar del descarte.')],
  [tr('Winning', 'Ganar'), tr('The first player with no cards wins and scores the cards left in the other hands: picture cards 10, aces 1, others their number. If the deck runs out three times, the lowest hand wins.', 'Gana el primero sin cartas y se anota las cartas que quedan en las otras manos: figuras 10, ases 1, las demás su número. Si el mazo se acaba tres veces, gana la mano más baja.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Throw away high cards that don\'t fit anything, and watch what the others pick up from the discard pile.', 'Tira las cartas altas que no combinan con nada y fíjate en lo que los demás recogen del descarte.')],
]);

let players = 2;

const cardEl = (c: Card | null, cls = '', down = false) => h('div.rm-card' + cls, { html: cardSvg(c, down) });

export const rummyScreen: Screen = root => {
  root.classList.add('rummy');
  const rng = makeRng();
  let alive = true, busy = false;
  let g: Rummy = newRummy(rng, players);
  let picked: Card[] = [];
  const status = h('div.result');
  const opps = h('div.tk-opps');
  const meldsEl = h('div.rm-melds');
  const piles = h('div.rm-piles');
  const handEl = h('div.rm-hand');
  const meldBtn = h('button.btn.small', { onclick: () => layDown() }, tr('LAY DOWN', 'BAJAR'));
  const discardBtn = h('button.btn.small.primary', { onclick: () => void discard() }, tr('DISCARD', 'DESCARTAR'));

  const isPicked = (c: Card) => picked.some(p => same(p, c));
  const myTurn = () => g.turn === 0 && g.winner === null && !busy;

  function render() {
    opps.replaceChildren(...g.hands.flatMap((hd, i) => (i === 0 ? [] : h('div.tk-opp' + (g.turn === i && g.winner === null ? '.turn' : ''), {}, seatFace(i), h('b', {}, seatName(i)), h('span', {}, tr(`${hd.length} cards`, `${hd.length} cartas`))))));
    meldsEl.replaceChildren(...(g.melds.length ? g.melds.map((m, k) => {
      const can = myTurn() && g.drawn && picked.length === 1 && fits(m, picked[0]);
      return h('button.rm-meld' + (can ? '.can' : ''), { onclick: () => layOff(k), disabled: !can }, ...m.map(c => cardEl(c, '.sm')));
    }) : [h('div.muted.small', {}, tr('Melds go here', 'Las combinaciones van aquí'))]));
    const top = g.discard[g.discard.length - 1];
    const canDraw = myTurn() && !g.drawn;
    piles.replaceChildren(
      h('button.rm-pile' + (canDraw ? '.can' : ''), { onclick: () => draw(false), disabled: !canDraw }, cardEl(null, '', true), h('span', {}, tr(`Deck ${g.stock.length}`, `Mazo ${g.stock.length}`))),
      h('button.rm-pile' + (canDraw && top ? '.can' : ''), { onclick: () => draw(true), disabled: !canDraw || !top }, top ? cardEl(top) : h('div.rm-card.empty'), h('span', {}, tr('Discard', 'Descarte'))));
    handEl.replaceChildren(...g.hands[0].map(c => h('button.rm-pick' + (isPicked(c) ? '.on' : '') + (g.took && same(c, g.took) ? '.took' : ''), {
      onclick: () => toggle(c), disabled: !myTurn() || !g.drawn,
    }, cardEl(c))));
    meldBtn.disabled = !(myTurn() && g.drawn && isMeld(picked));
    discardBtn.disabled = !(myTurn() && g.drawn && picked.length === 1 && !(g.took && same(picked[0], g.took) && g.hands[0].length > 1));
  }

  function toggle(c: Card) {
    picked = isPicked(c) ? picked.filter(p => !same(p, c)) : [...picked, c];
    sfx('click');
    const hint = isMeld(picked) ? tr('That\'s a meld: tap LAY DOWN', 'Es una combinación: toca BAJAR')
      : picked.length === 1 && g.melds.some(m => fits(m, picked[0])) ? tr('Tap a glowing meld to add it, or DISCARD', 'Toca una combinación que brilla para añadirla, o DESCARTA')
        : picked.length === 1 ? tr('Tap DISCARD to throw it away', 'Toca DESCARTAR para tirarla') : '';
    if (hint) say(status, hint);
    render();
  }

  function draw(fromDiscard: boolean) {
    if (!myTurn() || g.drawn) return;
    rumDraw(g, fromDiscard); sfx('card');
    if (ended()) return;
    say(status, tr('Lay down melds if you can, then discard one card', 'Baja combinaciones si puedes y luego descarta una carta'));
    render();
  }

  function layDown() {
    if (!myTurn() || !rumMeld(g, picked)) return;
    picked = []; sfx('chip');
    say(status, tr('Nice meld!', '¡Buena combinación!'), 'win');
    render(); ended();
  }

  function layOff(k: number) {
    if (!myTurn() || picked.length !== 1 || !rumLayOff(g, picked[0], k)) return;
    picked = []; sfx('chip');
    render(); ended();
  }

  async function discard() {
    if (!myTurn() || picked.length !== 1 || !rumDiscard(g, picked[0])) return;
    picked = []; sfx('card');
    render();
    if (ended()) return;
    await bots();
  }

  async function bots() {
    busy = true;
    while (alive && g.turn !== 0 && g.winner === null) {
      const who = seatName(g.turn);
      say(status, tr(`${who} is playing…`, `${who} está jugando…`));
      render();
      await sleep(800);
      if (!alive) return;
      const r = rumBot(g);
      sfx(r.melded || r.laidOff ? 'chip' : 'card');
      const bits = [r.fromDiscard ? tr('took the discard', 'tomó el descarte') : tr('drew from the deck', 'robó del mazo')];
      if (r.melded) bits.push(tr(`laid down ${r.melded}`, `bajó ${r.melded}`));
      if (r.laidOff) bits.push(tr(`added ${r.laidOff}`, `añadió ${r.laidOff}`));
      say(status, `${who}: ${bits.join(', ')}`);
      render();
      await sleep(900);
    }
    busy = false;
    if (!alive || ended()) return;
    say(status, tr('Your turn: take a card from the deck or the discard pile', 'Tu turno: toma una carta del mazo o del descarte'));
    render();
  }

  function ended(): boolean {
    if (g.winner === null) return false;
    busy = true; render();
    const won = g.winner === 0, pts = rumScore(g), prize = 30 + pts * 2;
    finish({ key: 'rummy', status, burstFrom: handEl, won, prize, alive: () => alive, again: reset,
      text: won ? tr(`Rummy! You score ${pts}: +${prize} chips`, `¡Rummy! Anotas ${pts}: +${prize} fichas`) : tr(`${seatName(g.winner)} went out first`, `${seatName(g.winner)} se quedó sin cartas primero`) });
    return true;
  }

  function reset() {
    g = newRummy(rng, players); picked = []; busy = false;
    render(); sfx('card');
    say(status, tr('Your turn: take a card from the deck or the discard pile', 'Tu turno: toma una carta del mazo o del descarte'));
  }

  const pSeg = playersSeg([2, 3, 4], () => players, n => { players = n; reset(); });
  root.append(topBar(tr('Rummy', 'Rummy')), opps, h('div.rm-table', {}, piles, meldsEl), status,
    h('div.controls', {}, meldBtn, discardBtn), handEl,
    h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: rummyHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Win: 30 chips + 2 per point left in the other hands', 'Premio: 30 fichas + 2 por cada punto en las otras manos')));
  reset();
  return () => { alive = false; };
};
