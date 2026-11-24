import { sfx } from '../audio';
import { deal, olliePick, SIZES, stars } from '../core/memory';
import { PIC_COUNT } from '../core/pictures';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { img, olliePath } from '../ui/assets';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { LEVEL_CHIPS } from './checkersPlay';
import { howToPlay } from './howto';
import { picImg, picName, picShort } from './picturesPlay';
import { choiceSeg, finish, levelSeg, say, type Level } from './tableKit';

export const memoryHowTo = () => howToPlay(tr('How to play Memory Match', 'Cómo jugar a Memoria'), [
  [tr('The idea', 'La idea'), tr('All the cards are face down. Every picture is on exactly two cards.', 'Todas las cartas están boca abajo. Cada dibujo está en exactamente dos cartas.')],
  [tr('Your turn', 'Tu turno'), tr('Tap two cards to turn them over. If they show the same picture, it\'s a pair: they stay up. If not, they turn back. Try to remember where they were!', 'Toca dos cartas para darles la vuelta. Si muestran el mismo dibujo, es pareja: se quedan arriba. Si no, se voltean otra vez. ¡Intenta recordar dónde estaban!')],
  [tr('Solo', 'Solo'), tr('Find every pair in as few turns as you can. You earn 1 to 3 stars, and more chips for more stars and bigger boards.', 'Encuentra todas las parejas en el menor número de turnos. Ganas de 1 a 3 estrellas, y más fichas con más estrellas y tableros más grandes.')],
  [tr('Against Ollie', 'Contra Ollie'), tr('You and Ollie take turns. Finding a pair gives you another turn. Whoever finds more pairs wins. On Hard, Ollie remembers almost everything!', 'Tú y Ollie se turnan. Encontrar una pareja te da otro turno. Gana quien encuentre más parejas. En Difícil, ¡Ollie lo recuerda casi todo!')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Start with 12 cards. Turn over cards you haven\'t seen yet before guessing.', 'Empieza con 12 cartas. Voltea cartas que todavía no has visto antes de adivinar.')],
]);

let size = 12;
let vs = false;
let level: Level = 2;
const MEMORY: Record<Level, number> = { 1: 0.35, 2: 0.7, 3: 0.95 };

export const memoryScreen: Screen = root => {
  root.classList.add('memory');
  const rng = makeRng();
  let alive = true, busy = false;
  let deck: number[] = [], open: boolean[] = [], up: number[] = [];
  let turns = 0, mine = 0, his = 0, ollieTurn = false;
  let seen = new Map<number, number>();
  const status = h('div.result');
  const grid = h('div.mm-grid');
  const score = h('div.mm-score');
  let cards: HTMLButtonElement[] = [];

  function build() {
    grid.dataset.n = String(size);
    cards = deck.map((p, i) => h('button.mm-card', { onclick: () => void tap(i), 'aria-label': tr('Card', 'Carta') },
      h('div.mm-inner', {}, h('div.mm-back'), h('div.mm-front', {}, picImg(p, 'mm-img'), h('span.mm-label', {}, picShort(p))))));
    grid.replaceChildren(...cards);
  }

  function render() {
    cards.forEach((c, i) => { c.classList.toggle('up', open[i] || up.includes(i)); c.classList.toggle('done', open[i]); });
    score.replaceChildren(vs
      ? h('div.mm-vs', {}, h('span' + (!ollieTurn ? '.turn' : ''), {}, tr(`You: ${mine}`, `Tú: ${mine}`)), img(olliePath(ollieTurn ? 'deal' : 'idle'), 'mm-ollie', 'Ollie'), h('span' + (ollieTurn ? '.turn' : ''), {}, `Ollie: ${his}`))
      : h('div.mm-vs', {}, h('span', {}, tr(`Turns: ${turns}`, `Turnos: ${turns}`)), h('span', {}, tr(`Pairs: ${mine} of ${size / 2}`, `Parejas: ${mine} de ${size / 2}`))));
  }

  const remember = (i: number) => { if (rng() < MEMORY[level]) seen.set(i, deck[i]); };

  async function tap(i: number) {
    if (busy || ollieTurn || open[i] || up.includes(i)) return;
    up.push(i); sfx('card'); remember(i);
    render();
    if (up.length < 2) return;
    turns++;
    busy = true;
    const ok = await check(true);
    busy = false;
    if (!alive || over()) return;
    if (vs && !ok) await ollie();
  }

  /** Looks at the two turned cards. Returns true for a pair. */
  async function check(you: boolean): Promise<boolean> {
    const [a, b] = up;
    render();
    if (deck[a] === deck[b]) {
      await sleep(350);
      open[a] = open[b] = true; up = [];
      seen.delete(a); seen.delete(b);
      if (you) mine++; else his++;
      sfx('win');
      say(status, (you ? tr('A pair! ', '¡Pareja! ') : tr('Ollie found a pair. ', 'Ollie encontró una pareja. ')) + picName(deck[a]), you ? 'win' : '');
      render();
      return true;
    }
    say(status, you ? tr('Not a pair', 'No es pareja') : tr('Ollie missed', 'Ollie falló'));
    await sleep(900);
    up = []; sfx('tick'); render();
    return false;
  }

  async function ollie() {
    ollieTurn = true; busy = true;
    render();
    while (alive && !over()) {
      say(status, tr('Ollie is looking…', 'Ollie está mirando…'));
      await sleep(700);
      const a = olliePick(deck, open, seen, rng);
      up = [a]; sfx('card'); remember(a); render();
      await sleep(700);
      const b = olliePick(deck, open, seen, rng, a);
      up = [a, b]; sfx('card'); remember(b); render();
      await sleep(500);
      if (!alive) return;
      if (!await check(false)) break;
    }
    ollieTurn = false; busy = false;
    if (!alive || over()) return;
    render();
    say(status, tr('Your turn: tap two cards', 'Tu turno: toca dos cartas'));
  }

  function over(): boolean {
    if (!open.every(Boolean)) return false;
    busy = true; render();
    if (vs) {
      const won = mine > his, draw = mine === his, prize = Math.round(LEVEL_CHIPS[level] * size / 12);
      finish({ key: 'memory', status, burstFrom: grid, won, draw, prize, alive: () => alive, again: reset,
        text: won ? tr(`You found ${mine} pairs to ${his}! +${prize} chips`, `¡Encontraste ${mine} parejas contra ${his}! +${prize} fichas`) : draw ? tr(`A tie: ${mine} each`, `Empate: ${mine} cada uno`) : tr(`Ollie wins ${his} to ${mine}`, `Ollie gana ${his} a ${mine}`) });
    } else {
      const s = stars(size / 2, turns), prize = (size / 2) * 2 * s;
      finish({ key: 'memory', status, burstFrom: grid, won: true, prize, alive: () => alive, again: reset,
        text: tr(`${'★'.repeat(s)}${'☆'.repeat(3 - s)} All pairs in ${turns} turns! +${prize} chips`, `${'★'.repeat(s)}${'☆'.repeat(3 - s)} ¡Todas las parejas en ${turns} turnos! +${prize} fichas`) });
    }
    return true;
  }

  function reset() {
    deck = deal(rng, size, PIC_COUNT); open = deck.map(() => false); up = [];
    turns = mine = his = 0; ollieTurn = false; busy = false; seen = new Map();
    build(); render();
    say(status, tr('Tap two cards', 'Toca dos cartas'));
  }

  const sizeSeg = choiceSeg(SIZES, () => size, n => { size = n; reset(); }, n => String(n));
  const modeSeg = choiceSeg([false, true], () => vs, v => { vs = v; levelsRow.hidden = !v; reset(); }, v => (v ? tr('Vs Ollie', 'Contra Ollie') : tr('Solo', 'Solo')));
  const lSeg = levelSeg(() => level, l => { level = l; });
  const levelsRow = h('div.controls.ck-levels', { hidden: !vs }, lSeg.el);
  root.append(topBar(tr('Memory Match', 'Memoria')), score, h('div.mm-wrap', {}, grid), status,
    h('div.controls.ck-levels', {}, h('span.muted', {}, tr('Cards', 'Cartas')), sizeSeg.el), h('div.controls.ck-levels', {}, modeSeg.el), levelsRow,
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: memoryHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Solo: 2 chips per pair for each star · Vs Ollie: a bigger prize on harder levels and bigger boards', 'Solo: 2 fichas por pareja por cada estrella · Contra Ollie: más premio en niveles difíciles y tableros grandes')));
  reset();
  return () => { alive = false; };
};
