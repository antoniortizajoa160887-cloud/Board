import { sfx } from '../audio';
import { rankLabel, type Card } from '../core/cards';
import { makeRng } from '../core/rng';
import { fishAsk, fishBot, newFish, type Fish } from '../core/rummy';
import { tr } from '../i18n';
import { cardSvg } from '../ui/art';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { finish, playersSeg, say, seatFace, seatName } from './tableKit';

const RANK_NAME: Record<number, [string, string]> = { 11: ['Jacks', 'Jotas'], 12: ['Queens', 'Reinas'], 13: ['Kings', 'Reyes'], 14: ['Aces', 'Ases'] };
const rankName = (r: number) => (RANK_NAME[r] ? tr(...RANK_NAME[r]) : tr(`${r}s`, `${r}`));

export const goFishHowTo = () => howToPlay(tr('How to play Go Fish', 'Cómo jugar a Ve a Pescar'), [
  [tr('The goal', 'El objetivo'), tr('Collect BOOKS: all four cards of one rank (four 7s, four Kings…). The player with the most books at the end wins.', 'Junta LIBROS: las cuatro cartas de un mismo valor (cuatro 7, cuatro Reyes…). Gana quien tenga más libros al final.')],
  [tr('Asking', 'Pedir'), tr('Tap a card in your hand to choose its rank, then tap a player to ask them for that rank. You can only ask for a rank you already hold.', 'Toca una carta de tu mano para elegir su valor y luego toca a un jugador para pedírselo. Solo puedes pedir un valor que ya tienes.')],
  [tr('They have it', 'Si lo tiene'), tr('They must give you every card of that rank, and you ask again.', 'Te tiene que dar todas las cartas de ese valor, y vuelves a pedir.')],
  [tr('Go fish!', '¡Ve a pescar!'), tr('If they have none, you draw a card from the pond. If it is the rank you asked for, you go again; otherwise the turn passes.', 'Si no tiene ninguna, robas una carta del estanque. Si es el valor que pediste, vuelves a jugar; si no, pasa el turno.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Remember what the others ask for: if Coral asked for Queens, she has at least one!', 'Recuerda lo que piden los demás: si Coral pidió Reinas, ¡tiene al menos una!')],
]);

let players = 3;

export const goFishScreen: Screen = root => {
  root.classList.add('gofish');
  const rng = makeRng();
  let alive = true, busy = false;
  let g: Fish = newFish(rng, players);
  let rank: number | null = null;
  const status = h('div.result');
  const opps = h('div.gf-opps');
  const pond = h('div.gf-pond');
  const myBooks = h('div.gf-books');
  const handEl = h('div.rm-hand.gf-hand');

  const myTurn = () => g.turn === 0 && !g.over && !busy;

  function render() {
    opps.replaceChildren(...g.hands.flatMap((hd, i) => (i === 0 ? [] : h('button.gf-opp' + (g.turn === i && !g.over ? '.turn' : '') + (myTurn() && rank !== null && hd.length ? '.can' : ''), {
      onclick: () => void ask(i), disabled: !(myTurn() && rank !== null && hd.length),
    }, seatFace(i), h('b', {}, seatName(i)), h('span', {}, tr(`${hd.length} cards · ${g.books[i].length} books`, `${hd.length} cartas · ${g.books[i].length} libros`))))));
    pond.replaceChildren(h('div.rm-card', { html: cardSvg(null, true) }), h('span', {}, tr(`Pond: ${g.pond.length}`, `Estanque: ${g.pond.length}`)));
    myBooks.replaceChildren(h('b', {}, tr(`Your books: ${g.books[0].length}`, `Tus libros: ${g.books[0].length}`)), ...g.books[0].map(r => h('span.gf-book', {}, rankLabel(r))));
    handEl.replaceChildren(...g.hands[0].map((c: Card) => h('button.rm-pick' + (c.rank === rank ? '.on' : ''), { onclick: () => choose(c.rank), disabled: !myTurn() }, h('div.rm-card', { html: cardSvg(c) }))));
  }

  function choose(r: number) {
    if (!myTurn()) return;
    rank = r; sfx('click');
    say(status, tr(`Ask a player for ${rankName(r)}: tap them`, `Pide ${rankName(r)} a un jugador: tócalo`));
    render();
  }

  async function ask(target: number) {
    if (!myTurn() || rank === null) return;
    const r = rank;
    rank = null;
    const res = fishAsk(g, target, r);
    if (res.got) { sfx('win'); say(status, tr(`${seatName(target)} had it! You get ${res.got} × ${rankLabel(r)}`, `¡${seatName(target)} lo tenía! Recibes ${res.got} × ${rankLabel(r)}`), 'win'); }
    else if (res.drew) { sfx('card'); say(status, tr(`Go fish! You drew a ${rankLabel(res.drew.rank)}`, `¡Ve a pescar! Robaste un ${rankLabel(res.drew.rank)}`) + (res.again ? tr(': lucky, go again!', ': ¡suerte, juega otra vez!') : '')); }
    else say(status, tr('Go fish! The pond is empty', '¡Ve a pescar! El estanque está vacío'));
    if (res.books.length) { sfx('jackpot'); say(status, tr(`A book of ${rankName(res.books[0])}!`, `¡Un libro de ${rankName(res.books[0])}!`), 'win'); }
    render();
    if (ended()) return;
    if (g.turn !== 0) { busy = true; await sleep(1000); await bots(); }
  }

  async function bots() {
    busy = true;
    while (alive && g.turn !== 0 && !g.over) {
      const p = g.turn, who = seatName(p);
      render();
      await sleep(700);
      if (!alive) return;
      const [t, r] = fishBot(g, rng);
      const res = fishAsk(g, t, r);
      const from = t === 0 ? tr('you', 'a ti') : seatName(t);
      let line = tr(`${who} asks ${from} for ${rankName(r)}: `, `${who} pide ${rankName(r)} ${t === 0 ? 'a ti' : 'a ' + seatName(t)}: `);
      line += res.got ? tr(`gets ${res.got} × ${rankLabel(r)}`, `recibe ${res.got} × ${rankLabel(r)}`) : tr('go fish!', '¡a pescar!');
      if (res.books.length) line += tr(` · book of ${rankName(res.books[0])}`, ` · libro de ${rankName(res.books[0])}`);
      sfx(res.got ? (t === 0 ? 'lose' : 'chip') : 'card');
      say(status, line);
      render();
      await sleep(1100);
      if (ended()) return;
    }
    busy = false;
    if (!alive) return;
    say(status, tr('Your turn: tap a card, then a player', 'Tu turno: toca una carta y luego un jugador'));
    render();
  }

  function ended(): boolean {
    if (!g.over) return false;
    busy = true; render();
    const n = g.books.map(b => b.length), best = Math.max(...n);
    const won = n[0] === best && n.filter(x => x === best).length === 1, draw = n[0] === best && !won;
    const prize = 30 * g.hands.length;
    finish({ key: 'gofish', status, burstFrom: myBooks, won, draw, prize, alive: () => alive, again: reset,
      text: won ? tr(`${n[0]} books! You win +${prize} chips`, `¡${n[0]} libros! Ganaste +${prize} fichas`) : draw ? tr(`A tie with ${best} books`, `Empate con ${best} libros`) : tr(`${seatName(n.indexOf(best))} wins with ${best} books (you: ${n[0]})`, `Gana ${seatName(n.indexOf(best))} con ${best} libros (tú: ${n[0]})`) });
    return true;
  }

  function reset() {
    g = newFish(rng, players); rank = null; busy = false;
    render(); sfx('card');
    say(status, tr('Your turn: tap a card, then a player', 'Tu turno: toca una carta y luego un jugador'));
  }

  const pSeg = playersSeg([2, 3, 4], () => players, n => { players = n; reset(); });
  root.append(topBar(tr('Go Fish', 'Ve a Pescar')), opps, h('div.gf-mid', {}, pond, myBooks), status, handEl,
    h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: goFishHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Win: 30 chips for each player', 'Premio: 30 fichas por cada jugador')));
  reset();
  return () => { alive = false; };
};
