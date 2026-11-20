import { sfx } from '../audio';
import { say } from '../ui/assets';
import { roll, type CrapsBet, type CrapsState } from '../core/craps';
import { makeRng, randInt } from '../core/rng';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile } from '../save';
import { coinBurst, fmt, h, sleep, toast } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { chipPicker, resultBanner, stackLabel } from './kit';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

/** A glossy die face. */
export function dieSvg(n: number, color = '#ff4d6d'): string {
  return `<svg viewBox="0 0 100 100"><defs><linearGradient id="dg${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
  <rect x="4" y="4" width="92" height="92" rx="20" fill="${color}" stroke="#fff" stroke-width="3"/>
  <rect x="10" y="8" width="80" height="40" rx="16" fill="#ffffff33"/>
  ${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fff"/><circle cx="${x - 2}" cy="${y - 2}" r="3" fill="#ffffffaa"/>`).join('')}</svg>`;
}

export const crapsHowTo = () => howToPlay(tr('How to play Craps', 'Cómo jugar a los Dados (Craps)'), [
  [tr('The idea', 'La idea'), tr('You roll two dice and bet on what comes up. Start with the PASS LINE: it is the simplest bet.', 'Lanzas dos dados y apuestas a lo que sale. Empieza con la LÍNEA DE PASE: es la apuesta más sencilla.')],
  [tr('First roll (come-out)', 'Primer tiro (salida)'), tr('7 or 11: PASS wins. 2, 3 or 12: PASS loses. Any other number (4, 5, 6, 8, 9, 10) becomes the POINT.', '7 u 11: gana PASE. 2, 3 o 12: pierde PASE. Cualquier otro número (4, 5, 6, 8, 9, 10) se vuelve el PUNTO.')],
  [tr('After the point', 'Después del punto'), tr('Keep rolling. If the point comes again before a 7, PASS wins. If a 7 comes first, PASS loses. The white ON puck shows the point.', 'Sigue tirando. Si sale el punto otra vez antes que un 7, gana PASE. Si sale primero un 7, pierde PASE. La ficha ON muestra el punto.')],
  [tr("Don't Pass", 'No pase'), tr("The opposite of PASS. 12 on the first roll is a tie (you get your bet back).", 'Lo contrario de PASE. Un 12 en el primer tiro es empate (te devuelven la apuesta).')],
  [tr('Odds', 'Apuesta de probabilidades'), tr('Once there is a point and you have a PASS bet, you can add ODDS. It pays the fair price: 2 to 1 on 4 or 10, 3 to 2 on 5 or 9, 6 to 5 on 6 or 8. It\'s the best bet in the casino.', 'Cuando hay punto y tienes apuesta de PASE, puedes añadir PROBABILIDADES. Paga el precio justo: 2 a 1 con 4 o 10, 3 a 2 con 5 o 9, 6 a 5 con 6 u 8. Es la mejor apuesta del casino.')],
  [tr('One-roll bets', 'Apuestas de un tiro'), tr('FIELD wins on 2, 3, 4, 9, 10, 11 or 12 (2 and 12 pay double). ANY 7 pays 4 to 1. ANY CRAPS (2, 3 or 12) pays 7 to 1. They are decided on the next roll.', 'CAMPO gana con 2, 3, 4, 9, 10, 11 o 12 (2 y 12 pagan doble). CUALQUIER 7 paga 4 a 1. CUALQUIER CRAPS (2, 3 o 12) paga 7 a 1. Se deciden en el siguiente tiro.')],
  [tr('How to bet', 'Cómo apostar'), tr('Pick a chip, tap a bet on the table, then tap ROLL. PASS and DON\'T PASS stay on the table until they win or lose.', 'Elige una ficha, toca una apuesta en la mesa y luego TIRAR. PASE y NO PASE se quedan en la mesa hasta que ganan o pierden.')],
]);

export const crapsScreen: Screen = root => {
  const rng = makeRng();
  const state: CrapsState = { point: null, bets: {} };
  let busy = false;
  const picker = chipPicker([10, 25, 100, 500, 1000], 25);
  const names: Record<CrapsBet, string> = {
    pass: tr('PASS LINE', 'LÍNEA DE PASE'), dontPass: tr("DON'T PASS", 'NO PASE'), odds: tr('ODDS', 'PROBABILIDADES'),
    field: tr('FIELD · 2 3 4 9 10 11 12', 'CAMPO · 2 3 4 9 10 11 12'), any7: tr('ANY 7 · 4:1', 'CUALQUIER 7 · 4:1'), anyCraps: tr('ANY CRAPS · 7:1', 'CUALQUIER CRAPS · 7:1'),
  };
  const spots = {} as Record<CrapsBet, HTMLElement>;
  const spot = (k: CrapsBet) => (spots[k] = h('button.cr-spot.' + k, { onclick: () => place(k) }, h('span', {}, names[k])));
  const pointRow = h('div.cr-points', {}, ...[4, 5, 6, 8, 9, 10].map(n => h('div.cr-pt', { 'data-n': String(n) }, String(n === 6 ? tr('SIX', 'SEIS') : n === 9 ? tr('NINE', 'NUEVE') : n))));
  const puck = h('div.cr-puck', {}, 'OFF');
  const d1 = h('div.die', { html: dieSvg(5) }), d2 = h('div.die', { html: dieSvg(2) });
  const sumEl = h('div.cr-sum');
  const hist = h('div.cr-hist');
  const result = h('div.result', {}, tr('Bet the PASS LINE, then ROLL', 'Apuesta a la LÍNEA DE PASE y luego TIRA'));

  const onTable = () => Object.values(state.bets).reduce((a, b) => a + (b ?? 0), 0);
  function render() {
    (Object.keys(spots) as CrapsBet[]).forEach(k => {
      spots[k].querySelector('.rchip')?.remove();
      if (state.bets[k]) spots[k].append(h('span.rchip', {}, stackLabel(state.bets[k]!)));
    });
    spots.odds.classList.toggle('off', !(state.point && state.bets.pass));
    puck.textContent = state.point ? 'ON' : 'OFF';
    puck.classList.toggle('on', !!state.point);
    pointRow.querySelectorAll('.cr-pt').forEach(el => el.classList.toggle('on', Number((el as HTMLElement).dataset.n) === state.point));
    rollBtn.textContent = state.point ? tr(`ROLL · point ${state.point}`, `TIRAR · punto ${state.point}`) : tr('ROLL', 'TIRAR');
  }
  function place(k: CrapsBet) {
    if (busy) return;
    if ((k === 'pass' || k === 'dontPass') && state.point) { toast(tr('Line bets go down before the point is set', 'Las apuestas de línea se hacen antes del punto')); return; }
    if (k === 'odds' && !(state.point && state.bets.pass)) { toast(tr('Odds need a point and a PASS bet', 'Las probabilidades necesitan punto y apuesta de PASE')); return; }
    const v = picker.get();
    if (k === 'odds' && (state.bets.odds ?? 0) + v > (state.bets.pass ?? 0) * 3) { toast(tr('Odds can be up to 3 times your PASS bet', 'Las probabilidades pueden ser hasta 3 veces tu apuesta de PASE')); return; }
    if (profile.wallet.chips < v) { toast(tr('Not enough chips', 'No tienes fichas suficientes'), 'lose'); return; }
    addChips(-v); state.bets[k] = (state.bets[k] ?? 0) + v; sfx('chip'); render();
  }
  function clear() {
    if (busy) return;
    // Pass / don't pass stay once a point is on; everything else comes back.
    let back = 0;
    for (const k of Object.keys(state.bets) as CrapsBet[]) {
      if (state.point && (k === 'pass' || k === 'dontPass')) continue;
      back += state.bets[k]!; delete state.bets[k];
    }
    if (back) addChips(back);
    render();
  }

  async function doRoll() {
    if (busy) return;
    if (!onTable()) { toast(tr('Place a bet first', 'Primero haz una apuesta')); return; }
    busy = true; rollBtn.disabled = true;
    const before = onTable();
    const a = randInt(rng, 6) + 1, b = randInt(rng, 6) + 1;
    sfx('dice'); say('dice');
    d1.classList.add('tumble'); d2.classList.add('tumble');
    sumEl.textContent = '';
    for (let i = 0; i < 9; i++) { d1.innerHTML = dieSvg(randInt(rng, 6) + 1); d2.innerHTML = dieSvg(randInt(rng, 6) + 1); await sleep(70); }
    d1.innerHTML = dieSvg(a); d2.innerHTML = dieSvg(b);
    d1.classList.remove('tumble'); d2.classList.remove('tumble');
    sfx('stop');
    sumEl.textContent = String(a + b);
    const pointBefore = state.point;
    const r = roll(state, a, b);
    let back = 0;
    for (const v of Object.values(r.returned)) back += v ?? 0;
    if (back) addChips(back);
    const settledStake = before - onTable();
    const net = back - settledStake;
    hist.prepend(h('span.cr-h' + (a + b === 7 ? '.seven' : ''), {}, String(a + b)));
    while (hist.children.length > 12) hist.lastChild!.remove();
    const msg: Record<typeof r.message, string> = {
      natural: tr(`${a + b}! Natural: PASS wins`, `¡${a + b}! Natural: gana PASE`),
      craps: tr(`Craps ${a + b}: PASS loses`, `Craps ${a + b}: pierde PASE`),
      point: tr(`The point is ${a + b}`, `El punto es ${a + b}`),
      hit: tr(`${a + b}! Point made: PASS wins`, `¡${a + b}! Punto logrado: gana PASE`),
      'seven-out': tr('Seven out: PASS loses', 'Siete: pierde PASE'),
      roll: tr(`Rolled ${a + b}. Point is ${pointBefore}`, `Salió ${a + b}. El punto es ${pointBefore}`),
    };
    const money = net > 0 ? `  +${fmt(net)}` : net < 0 ? `  −${fmt(-net)}` : '';
    resultBanner(result, msg[r.message] + money, net > 0 ? 'win' : net < 0 ? 'lose' : 'info');
    if (net > 0) { sfx(r.returned.odds || (r.returned.anyCraps ?? 0) > 0 ? 'bigwin' : 'win'); coinBurst(d1); buzz(); } else if (net < 0) sfx('lose');
    if (settledStake > 0) countPlay('craps', net > 0);
    busy = false; rollBtn.disabled = false;
    render();
  }

  const rollBtn = h('button.btn.primary', { onclick: () => void doRoll() }, tr('ROLL', 'TIRAR'));
  root.classList.add('table-game', 'felt', 'craps');
  root.append(topBar(tr('Craps', 'Dados (Craps)')),
    h('div.table.cr-table', {},
      h('div.cr-top', {}, puck, pointRow),
      h('div.cr-dice', {}, d1, d2, sumEl),
      hist,
      h('div.cr-grid', {}, spot('field'), spot('any7'), spot('anyCraps'), spot('dontPass'), spot('odds'), spot('pass'))),
    result, picker.el,
    h('div.controls', {},
      h('button.btn.small', { onclick: clear }, tr('Take back', 'Retirar')),
      rollBtn,
      h('button.btn.small', { onclick: crapsHowTo }, tr('How to play', 'Cómo jugar'))));
  render();
  return () => {
    // Leaving the table returns every bet still on it.
    const t = onTable();
    if (t && !busy) addChips(t);
  };
};
