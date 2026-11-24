import { sfx } from '../audio';
import { allSunk, boatAt, botShot, fire, N, newSea, placeFleet, sunk, type Sea } from '../core/fleet';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { LEVEL_CHIPS } from './checkersPlay';
import { howToPlay } from './howto';
import { finish, levelSeg, prizeLine, say, type Level } from './tableKit';

export const fleetHowTo = () => howToPlay(tr('How to play Sink the Fleet', 'Cómo jugar a Hundir la Flota'), [
  [tr('The idea', 'La idea'), tr('You and Ollie each hide five boats on a 10 × 10 sea: lengths 5, 4, 3, 3 and 2. Boats are straight and never touch.', 'Tú y Ollie esconden cinco barcos en un mar de 10 × 10: de 5, 4, 3, 3 y 2 casillas. Los barcos son rectos y nunca se tocan.')],
  [tr('Your boats', 'Tus barcos'), tr('Your boats are placed for you on the small map. Tap NEW BOATS to move them before the first shot.', 'Tus barcos se colocan solos en el mapa pequeño. Toca BARCOS NUEVOS para moverlos antes del primer disparo.')],
  [tr('Firing', 'Disparar'), tr('Tap a square on Ollie\'s sea to fire. A splash means water. A flame means HIT: fire again! When every square of a boat is hit, it sinks.', 'Toca una casilla del mar de Ollie para disparar. Una salpicadura es agua. Una llama es TOCADO: ¡dispara otra vez! Cuando todas las casillas de un barco están tocadas, se hunde.')],
  [tr('Winning', 'Ganar'), tr('Sink all five of Ollie\'s boats before he sinks yours.', 'Hunde los cinco barcos de Ollie antes de que él hunda los tuyos.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('After a hit, try the squares next to it. Since boats never touch, the squares around a sunk boat are always water.', 'Después de tocar, prueba las casillas de al lado. Como los barcos nunca se tocan, las casillas alrededor de un barco hundido siempre son agua.')],
]);

let level: Level = 2;

export const fleetScreen: Screen = root => {
  root.classList.add('fleet');
  const rng = makeRng();
  let alive = true, busy = false, started = false, over = false;
  let mine: Sea = newSea(placeFleet(rng)), his: Sea = newSea(placeFleet(rng));
  const status = h('div.result');
  const hisEl = h('div.fl-grid.big');
  const mineEl = h('div.fl-grid.small');
  const left = h('div.fl-left');
  const newBtn = h('button.btn.small', { onclick: () => { if (started) return; mine = newSea(placeFleet(rng)); sfx('chip'); render(); } }, tr('NEW BOATS', 'BARCOS NUEVOS'));

  /** Squares around a sunk boat are shown as water (boats never touch). */
  const around = (s: Sea) => {
    const out = new Set<number>();
    s.boats.filter(b => sunk(s, b)).forEach(b => b.cells.forEach(i => {
      const y = Math.floor(i / N), x = i % N;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < N && xx >= 0 && xx < N && !boatAt(s, yy * N + xx)) out.add(yy * N + xx); }
    }));
    return out;
  };

  function cell(s: Sea, i: number, showBoats: boolean, near: Set<number>, onclick?: () => void) {
    const b = boatAt(s, i), shot = s.shots.has(i);
    let cls = '';
    if (shot && b) cls = sunk(s, b) ? '.sunk' : '.hit';
    else if (shot) cls = '.miss';
    else if (near.has(i)) cls = '.near';
    if (showBoats && b && !shot) cls += '.boat';
    return h('button.fl-cell' + cls, { onclick, disabled: !onclick || shot, 'aria-label': `${String.fromCharCode(65 + Math.floor(i / N))}${(i % N) + 1}` });
  }

  function render() {
    const nearHis = around(his), nearMine = around(mine);
    hisEl.replaceChildren(...Array.from({ length: N * N }, (_, i) => cell(his, i, over, nearHis, busy || over ? undefined : () => void shoot(i))));
    mineEl.replaceChildren(...Array.from({ length: N * N }, (_, i) => cell(mine, i, true, nearMine)));
    const afloat = (s: Sea) => s.boats.filter(b => !sunk(s, b)).length;
    left.replaceChildren(h('span', {}, tr(`Ollie's boats left: ${afloat(his)}`, `Barcos de Ollie: ${afloat(his)}`)), h('span', {}, tr(`Yours: ${afloat(mine)}`, `Tuyos: ${afloat(mine)}`)));
    newBtn.hidden = started;
  }

  async function shoot(i: number) {
    if (busy || over || his.shots.has(i)) return;
    started = true;
    const r = fire(his, i);
    if (r === 'miss') { sfx('ball'); say(status, tr('Splash! Water', '¡Agua!')); }
    else if (r === 'hit') { sfx('stomp'); buzz(); say(status, tr('Hit! Fire again', '¡Tocado! Dispara otra vez'), 'win'); }
    else { sfx('win'); buzz(true); say(status, tr('Sunk! Fire again', '¡Hundido! Dispara otra vez'), 'win'); }
    render();
    if (allSunk(his)) { end(true); return; }
    if (r === 'miss') await ollie();
  }

  async function ollie() {
    busy = true; render();
    for (;;) {
      say(status, tr('Ollie is aiming…', 'Ollie está apuntando…'));
      await sleep(700);
      if (!alive) return;
      const smart = level === 3 || (level === 2 && rng() < 0.6);
      let i = botShot(mine, rng);
      if (!smart) { const open = Array.from({ length: N * N }, (_, k) => k).filter(k => !mine.shots.has(k)); i = open[Math.floor(rng() * open.length)]; }
      const r = fire(mine, i);
      render();
      if (r === 'miss') { sfx('ball'); say(status, tr('Ollie missed. Your turn!', 'Ollie falló. ¡Tu turno!')); break; }
      sfx(r === 'sunk' ? 'lose' : 'hurt');
      say(status, r === 'sunk' ? tr('Ollie sank one of your boats!', '¡Ollie hundió uno de tus barcos!') : tr('Ollie hit your boat!', '¡Ollie tocó tu barco!'), 'lose');
      if (allSunk(mine)) { end(false); return; }
      await sleep(600);
    }
    busy = false; render();
  }

  function end(won: boolean) {
    over = true; busy = true; render();
    finish({ key: 'fleet', status, burstFrom: hisEl, won, prize: LEVEL_CHIPS[level], alive: () => alive, again: reset,
      text: won ? tr(`You sank Ollie's fleet! +${LEVEL_CHIPS[level]} chips`, `¡Hundiste la flota de Ollie! +${LEVEL_CHIPS[level]} fichas`) : tr('Ollie sank your whole fleet', 'Ollie hundió toda tu flota') });
  }

  function reset() {
    mine = newSea(placeFleet(rng)); his = newSea(placeFleet(rng));
    started = over = busy = false;
    render();
    say(status, tr('Tap Ollie\'s sea to fire', 'Toca el mar de Ollie para disparar'));
  }

  const lSeg = levelSeg(() => level, l => { level = l; });
  root.append(topBar(tr('Sink the Fleet', 'Hundir la Flota')),
    h('div.fl-label', {}, tr('Ollie\'s sea', 'El mar de Ollie')), h('div.fl-wrap', {}, hisEl), status, left,
    h('div.fl-mine', {}, h('div', {}, h('div.fl-label', {}, tr('Your boats', 'Tus barcos')), mineEl), newBtn),
    h('div.controls.ck-levels', {}, lSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy || over) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: fleetHowTo }, tr('How to play', 'Cómo jugar'))),
    prizeLine());
  reset();
  return () => { alive = false; };
};
