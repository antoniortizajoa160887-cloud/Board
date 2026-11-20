import { sfx } from '../audio';
import { drawKeno, KENO_PAYS, kenoPay, quickPick } from '../core/keno';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { coinBurst, fmt, h, sleep, toast } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { betStepper, cantAfford, resultBanner } from './kit';

export const kenoHowTo = () => howToPlay(tr('How to play Keno', 'Cómo jugar al Keno'), [
  [tr('Pick numbers', 'Elige números'), tr('Tap 1 to 10 numbers on the board (or tap QUICK PICK and choose how many).', 'Toca de 1 a 10 números del tablero (o toca ELEGIR AL AZAR y escoge cuántos).')],
  [tr('Choose your bet', 'Elige tu apuesta'), tr('Use − and + to set how many chips to bet.', 'Usa − y + para elegir cuántas fichas apostar.')],
  [tr('Play', 'Jugar'), tr('Tap PLAY. The machine draws 20 of the 80 numbers.', 'Toca JUGAR. La máquina saca 20 de los 80 números.')],
  [tr('Hits', 'Aciertos'), tr('Every drawn number you picked is a hit and glows gold. The more hits, the bigger the prize.', 'Cada número sacado que elegiste es un acierto y brilla en dorado. Más aciertos, mayor premio.')],
  [tr('Pay table', 'Tabla de pagos'), tr('The table on the right shows what each number of hits pays for how many numbers you picked. Picking more numbers means bigger prizes but you need more hits.', 'La tabla muestra lo que paga cada cantidad de aciertos según cuántos números elegiste. Más números dan premios más grandes, pero necesitas más aciertos.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Start with 4 to 6 numbers: you win small prizes more often. Keep your numbers and press PLAY again to replay them.', 'Empieza con 4 a 6 números: ganarás premios pequeños más seguido. Tus números se quedan; pulsa JUGAR otra vez para repetir.')],
]);

export const kenoScreen: Screen = root => {
  const rng = makeRng();
  let picks = new Set<number>();
  let busy = false, alive = true;
  const cells: HTMLElement[] = [];
  const board = h('div.keno-board', {}, ...Array.from({ length: 80 }, (_, i) => {
    const n = i + 1;
    const el = h('button.keno-cell', { onclick: () => toggle(n) }, String(n));
    cells[n] = el;
    return el;
  }));
  const pays = h('div.keno-pays');
  const hitsEl = h('div.keno-hits');
  const ballEl = h('div.keno-ball');
  const stepper = betStepper([5, 10, 25, 50, 100, 250, 500], 25, tr('Bet', 'Apuesta'));
  const result = h('div.result', {}, tr('Pick 1 to 10 numbers', 'Elige de 1 a 10 números'));

  function renderPays() {
    const n = picks.size;
    const t = KENO_PAYS[n];
    pays.replaceChildren(h('div.keno-pays-title', {}, n ? tr(`${n} picked`, `${n} elegidos`) : tr('Pick numbers', 'Elige números')),
      ...(t ? Object.entries(t).reverse().map(([hit, m]) => h('div.keno-pay-row', { 'data-hit': hit }, h('span', {}, tr(`${hit} hits`, `${hit} aciertos`)), h('b', {}, `×${m}`))) : []));
  }
  function clearMarks() { cells.forEach(c => c?.classList.remove('drawn', 'hit')); hitsEl.textContent = ''; ballEl.textContent = ''; }
  function toggle(n: number) {
    if (busy) return;
    clearMarks();
    if (picks.has(n)) picks.delete(n);
    else if (picks.size >= 10) { toast(tr('Up to 10 numbers', 'Hasta 10 números')); return; }
    else picks.add(n);
    cells[n].classList.toggle('picked', picks.has(n));
    sfx('daub');
    renderPays();
  }
  function setPicks(list: number[]) {
    clearMarks();
    picks = new Set(list);
    cells.forEach((c, i) => c?.classList.toggle('picked', picks.has(i)));
    renderPays();
  }
  async function play() {
    if (busy) return;
    if (!picks.size) { toast(tr('Pick at least one number', 'Elige al menos un número')); return; }
    const bet = stepper.get();
    if (cantAfford(bet)) return;
    addChips(-bet);
    busy = true; playBtn.disabled = true; stepper.setEnabled(false);
    clearMarks();
    resultBanner(result, '', 'info');
    const drawn = drawKeno(rng);
    let hits = 0;
    for (const n of drawn) {
      if (!alive) return;
      const hit = picks.has(n);
      if (hit) hits++;
      cells[n].classList.add(hit ? 'hit' : 'drawn');
      ballEl.textContent = String(n);
      ballEl.classList.remove('roll'); void ballEl.offsetWidth; ballEl.classList.add('roll');
      hitsEl.textContent = tr(`Hits ${hits}`, `Aciertos ${hits}`);
      pays.querySelectorAll('.keno-pay-row').forEach(r => r.classList.toggle('on', Number((r as HTMLElement).dataset.hit) === hits));
      sfx(hit ? 'pearl' : 'tick');
      await sleep(hit ? 260 : 130);
    }
    const won = kenoPay(picks.size, hits, bet);
    if (won) addChips(won);
    countPlay('keno', won > bet);
    if (won) {
      resultBanner(result, tr(`${hits} of ${picks.size} hit · +${fmt(won)}`, `${hits} de ${picks.size} aciertos · +${fmt(won)}`), won > bet ? 'win' : 'push');
      sfx(won >= bet * 20 ? 'jackpot' : won > bet ? 'win' : 'chip'); coinBurst(hitsEl, won >= bet * 20 ? 50 : 18); if (won > bet) buzz();
    } else {
      resultBanner(result, tr(`${hits} of ${picks.size} hit`, `${hits} de ${picks.size} aciertos`), 'lose'); sfx('lose');
    }
    busy = false; playBtn.disabled = false; stepper.setEnabled(true);
  }

  const qp = (n: number) => h('button.btn.small', { onclick: () => { if (!busy) { setPicks(quickPick(n, rng)); sfx('daub'); } } }, String(n));
  const playBtn = h('button.btn.primary', { onclick: () => void play() }, tr('PLAY', 'JUGAR'));
  root.classList.add('keno');
  root.append(topBar('Keno'),
    h('div.keno-top', {}, h('div.keno-left', {}, ballEl, hitsEl), pays),
    board,
    h('div.controls.keno-qp', {}, h('span.muted', {}, tr('Quick pick', 'Al azar')), qp(4), qp(6), qp(8), qp(10),
      h('button.btn.small', { onclick: () => { if (!busy) setPicks([]); } }, tr('Clear', 'Borrar'))),
    result,
    h('div.controls', {}, stepper.el, playBtn),
    h('div.controls', {}, h('button.btn.small', { onclick: kenoHowTo }, tr('How to play', 'Cómo jugar'))));
  renderPays();
  return () => { alive = false; };
};
