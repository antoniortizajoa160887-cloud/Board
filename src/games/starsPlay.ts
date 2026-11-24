import { sfx } from '../audio';
import { makeRng } from '../core/rng';
import { HOLES, newStars, opposite, POINTS, reach, starBot, starMove, target, type StarGame } from '../core/stars';
import { tr } from '../i18n';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { LEVEL_CHIPS } from './checkersPlay';
import { howToPlay } from './howto';
import { choiceSeg, finish, levelSeg, prizeLine, say, SEAT_COLORS, seatFace, seatName, type Level } from './tableKit';

export const starsHowTo = () => howToPlay(tr('How to play Star Checkers', 'Cómo jugar a las Damas Estrella'), [
  [tr('The goal', 'El objetivo'), tr('The board is a six-pointed star. Your 10 gold marbles start in the bottom point. Move all of them into the point at the top, across the star.', 'El tablero es una estrella de seis puntas. Tus 10 canicas doradas empiezan en la punta de abajo. Llévalas todas a la punta de arriba, al otro lado de la estrella.')],
  [tr('Moving', 'Mover'), tr('Tap one of your marbles: the holes it can reach light up. Tap one to move there.', 'Toca una de tus canicas: se iluminan los huecos a los que puede ir. Toca uno para moverla.')],
  [tr('Steps', 'Pasos'), tr('A marble can step to any empty hole right next to it.', 'Una canica puede avanzar a cualquier hueco vacío que esté justo al lado.')],
  [tr('Jumps', 'Saltos'), tr('Or it can jump over one marble (yours or a rival\'s) into the empty hole right behind it, and keep jumping in one turn as long as it can. Nothing is captured.', 'O puede saltar sobre una canica (tuya o rival) al hueco vacío justo detrás, y seguir saltando en el mismo turno mientras pueda. No se come nada.')],
  [tr('Winning', 'Ganar'), tr('The first player to move all ten marbles into the opposite point wins. If a rival leaves marbles there to block you, 7 of yours in a full point is enough.', 'Gana el primero que lleve sus diez canicas a la punta de enfrente. Si un rival deja canicas ahí para bloquearte, basta con 7 tuyas en una punta llena.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Build "ladders": line your marbles up with gaps so later marbles can jump far in one go. Don\'t leave one marble behind.', 'Haz "escaleras": alinea tus canicas con huecos para que las demás salten lejos de una vez. No dejes una canica atrás.')],
]);

let level: Level = 2;
let players: 2 | 3 = 2;

export const starsScreen: Screen = root => {
  root.classList.add('stars');
  const rng = makeRng();
  let alive = true, busy = false;
  let g: StarGame = newStars(players);
  let sel: number | null = null;
  let reachable = new Map<number, number[]>();
  const status = h('div.result');
  const board = h('div.st-board');
  const who = h('div.tk-opps');
  const holes: HTMLButtonElement[] = HOLES.map(({ q, r }, i) => {
    const el = h('button.st-hole', { onclick: () => tap(i) });
    el.style.left = `${((q + r / 2 + 8.5) / 17) * 100}%`;
    el.style.top = `${((r + 8.5) / 17) * 100}%`;
    return el;
  });
  board.append(...holes);

  function paintPoints() {
    holes.forEach(x => x.style.removeProperty('--pt'));
    g.homes.forEach((home, p) => {
      POINTS[home].forEach(i => holes[i].style.setProperty('--pt', SEAT_COLORS[p] + '44'));
      POINTS[opposite(home)].forEach(i => holes[i].style.setProperty('--pt', SEAT_COLORS[p] + '44'));
    });
  }

  function render() {
    holes.forEach((el, i) => {
      el.replaceChildren();
      const o = g.board[i];
      if (o >= 0) { const m = h('div.st-marble'); m.style.setProperty('--seat', SEAT_COLORS[o]); el.append(m); }
      el.classList.toggle('sel', i === sel);
      el.classList.toggle('to', reachable.has(i));
      el.classList.toggle('mine', o === 0 && g.turn === 0 && !busy && g.winner === null);
    });
    who.replaceChildren(...g.homes.map((_, p) => h('div.tk-opp' + (g.turn === p && g.winner === null ? '.turn' : ''), {}, seatFace(p),
      h('b', { style: `color:${SEAT_COLORS[p]}` }, seatName(p)),
      h('span', {}, tr(`${target(g, p).filter(i => g.board[i] === p).length}/10 across`, `${target(g, p).filter(i => g.board[i] === p).length}/10 llegaron`)))));
  }

  function tap(i: number) {
    if (busy || g.turn !== 0 || g.winner !== null) return;
    if (g.board[i] === 0) {
      sel = i; reachable = reach(g, i); sfx('click');
      say(status, reachable.size ? tr('Tap a glowing hole', 'Toca un hueco que brilla') : tr('That marble can\'t move', 'Esa canica no se puede mover'));
      render(); return;
    }
    const path = sel !== null ? reachable.get(i) : undefined;
    if (!path) return;
    void move(path);
  }

  async function hop(path: number[]) {
    const owner = g.board[path[0]];
    for (let k = 1; k < path.length; k++) {
      g.board[path[k - 1]] = -1; g.board[path[k]] = owner;
      sfx(k === 1 && path.length === 2 ? 'chip' : 'jump');
      render();
      await sleep(path.length === 2 ? 120 : 260);
      if (!alive) return;
    }
    g.board[path[path.length - 1]] = -1; g.board[path[0]] = owner;
    starMove(g, path[0], path[path.length - 1]);
  }

  async function move(path: number[]) {
    busy = true; sel = null; reachable = new Map();
    await hop(path);
    if (!alive || ended()) return;
    while (alive && g.turn !== 0 && g.winner === null) {
      say(status, tr(`${seatName(g.turn)} is thinking…`, `${seatName(g.turn)} está pensando…`));
      render();
      await sleep(450);
      const m = starBot(g, rng, level);
      if (!m) { g.turn = (g.turn + 1) % g.homes.length; continue; }
      await hop(reach(g, m[0]).get(m[1])!);
      if (!alive || ended()) return;
    }
    busy = false;
    say(status, tr('Your turn: tap a gold marble', 'Tu turno: toca una canica dorada'));
    render();
  }

  function ended(): boolean {
    if (g.winner === null) return false;
    busy = true; render();
    const won = g.winner === 0, prize = LEVEL_CHIPS[level] * (players === 3 ? 2 : 1);
    finish({ key: 'stars', status, burstFrom: board, won, prize, alive: () => alive, again: reset,
      text: won ? tr(`All across! +${prize} chips`, `¡Todas al otro lado! +${prize} fichas`) : tr(`${seatName(g.winner)} got across first`, `${seatName(g.winner)} llegó primero`) });
    return true;
  }

  function reset() {
    g = newStars(players); busy = false; sel = null; reachable = new Map();
    paintPoints(); render();
    say(status, tr('Your turn: tap a gold marble', 'Tu turno: toca una canica dorada'));
  }

  const lSeg = levelSeg(() => level, l => { level = l; });
  const pSeg = choiceSeg<2 | 3>([2, 3], () => players, n => { players = n; reset(); }, n => tr(`${n} players`, `${n} jugadores`));
  root.append(topBar(tr('Star Checkers', 'Damas Estrella')), who, h('div.st-wrap', {}, board), status,
    h('div.controls.ck-levels', {}, lSeg.el), h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: starsHowTo }, tr('How to play', 'Cómo jugar'))),
    prizeLine(), h('p.muted.small.center', {}, tr('Double prize with 3 players', 'Premio doble con 3 jugadores')));
  reset();
  return () => { alive = false; };
};
