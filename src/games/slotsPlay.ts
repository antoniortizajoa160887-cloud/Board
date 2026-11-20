import { sfx } from '../audio';
import { makeRng } from '../core/rng';
import { evaluateGrid, JACKPOT_SEED, JACKPOT_SHARE, LINES, REELS, SYMBOLS, spin, type Grid, type Sym } from '../core/slots';
import { buzz } from '../platform';
import { addChips, countPlay, profile, save } from '../save';
import { symbolSvg } from '../ui/art';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { betStepper, cantAfford, resultBanner } from './kit';
import { PAYTABLE } from '../core/slots';
import { tr } from '../i18n';
import { howToPlay } from './howto';

export const slotsHowTo = () => howToPlay(tr('How to play Lagoon Slots', 'Cómo jugar a las Tragamonedas'), [
  [tr('The idea', 'La idea'), tr('Spin the 5 reels. When the same symbols line up from the left reel along one of the 9 lines, you win.', 'Gira los 5 rodillos. Cuando símbolos iguales se alinean desde el rodillo de la izquierda en una de las 9 líneas, ganas.')],
  [tr('Your bet', 'Tu apuesta'), tr('Choose the LINE BET with − and +. You play all 9 lines, so a spin costs 9 × the line bet (shown as Total).', 'Elige la APUESTA POR LÍNEA con − y +. Juegas las 9 líneas, así que cada giro cuesta 9 × la apuesta por línea (se ve en Total).')],
  [tr('Spin', 'Girar'), tr('Tap SPIN. Wins light up their line and pay right away. AUTO spins 10 times in a row; tap it again to stop.', 'Toca GIRAR. Las líneas ganadoras se iluminan y pagan al momento. AUTO gira 10 veces seguidas; tócalo de nuevo para parar.')],
  [tr('Symbols', 'Símbolos'), tr('Tap PAYS to see what 3, 4 or 5 of each symbol pays. The WILD replaces any symbol except the crown.', 'Toca PAGOS para ver cuánto paga 3, 4 o 5 de cada símbolo. El COMODÍN reemplaza a cualquier símbolo menos la corona.')],
  [tr('Jackpot', 'Premio mayor'), tr('A small part of every spin feeds the jackpot. Five crowns on a line win all of it!', 'Una pequeña parte de cada giro alimenta el premio mayor. ¡Cinco coronas en una línea se lo llevan todo!')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Start with a small line bet so your chips last longer. It is all luck: no strategy changes the odds.', 'Empieza con una apuesta pequeña para que tus fichas duren más. Todo es suerte: ninguna estrategia cambia las probabilidades.')],
]);

const LINE_BETS = [1, 2, 5, 10, 25, 50, 100];
const CELL = 100; // % of a cell height per symbol (cells are 1/3 of the window)
const LINE_COLORS = ['#f5c542', '#2ef2d0', '#ff5fb7', '#7fa8ff', '#ff8a2a', '#b07bff', '#7dff8a', '#ff6b6b', '#ffe07a'];

export const slotsScreen: Screen = root => {
  const rng = makeRng();
  let busy = false;
  let auto = 0;
  let alive = true;

  const jp = h('div.jackpot-meter.small', {}, h('span.jp-label', {}, tr('JACKPOT', 'PREMIO MAYOR')), h('span.jp-amount', {}, fmt(profile.wallet.jackpot)));
  const reels: HTMLElement[] = [];
  const strips: HTMLElement[] = [];
  const machine = h('div.slot-window');
  for (let r = 0; r < REELS; r++) {
    const strip = h('div.reel-strip');
    const reel = h('div.reel', {}, strip);
    reels.push(reel);
    strips.push(strip);
    machine.append(reel);
  }
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('class', 'line-overlay');
  overlay.setAttribute('viewBox', '0 0 500 300');
  overlay.setAttribute('preserveAspectRatio', 'none');
  machine.append(overlay);

  const result = h('div.result', {}, 'Match 3 or more from the left on any of 9 lines');
  const totalLbl = h('span.total-bet');
  const stepper = betStepper(LINE_BETS, 5, tr('Line bet', 'Por línea'), () => updateTotal());
  const updateTotal = () => { totalLbl.textContent = `${tr('Total', 'Total')} ${fmt(stepper.get() * LINES.length)}`; };
  updateTotal();

  const spinBtn = h('button.btn.spin', { onclick: () => void doSpin() }, tr('SPIN', 'GIRAR'));
  const autoBtn = h('button.btn.small', { onclick: () => {
    if (auto) { auto = 0; autoBtn.textContent = 'AUTO ×10'; return; }
    auto = 10; autoBtn.textContent = tr('Stop', 'Parar'); void doSpin();
  } }, 'AUTO ×10');

  const fill = (strip: HTMLElement, syms: Sym[]) => {
    strip.replaceChildren(...syms.map(s => h('div.cell', { html: symbolSvg(s) })));
  };
  // Start with a random still grid.
  const first = spin(rng).grid;
  strips.forEach((s, i) => fill(s, first[i]));

  async function doSpin() {
    if (busy || !alive) return;
    const lineBet = stepper.get();
    const total = lineBet * LINES.length;
    if (cantAfford(total)) { auto = 0; autoBtn.textContent = 'AUTO ×10'; return; }
    busy = true;
    stepper.setEnabled(false);
    spinBtn.disabled = true;
    addChips(-total);
    profile.wallet.jackpot += Math.round(total * JACKPOT_SHARE * 10) / 10;
    jp.lastElementChild!.textContent = fmt(profile.wallet.jackpot);
    overlay.replaceChildren();
    machine.querySelectorAll('.cell.hit').forEach(c => c.classList.remove('hit'));
    resultBanner(result, tr('Good luck!', '¡Buena suerte!'), 'info');

    const { grid } = spin(rng);
    // Each reel: the current 3, a run of random symbols, then the result. It slides down to the result.
    const anims = strips.map((strip, r) => {
      const current = [...strip.children].slice(-3).map(c => (c.querySelector('svg')?.getAttribute('aria-label') ?? 'pearl') as Sym);
      const filler = Array.from({ length: 14 + r * 5 }, () => SYMBOLS[Math.floor(rng() * 6)]);
      const all = [...grid[r], ...filler, ...current];
      fill(strip, all);
      const travel = (all.length - 3) * CELL / 3;
      strip.style.transition = 'none';
      strip.style.transform = `translateY(-${travel}%)`;
      void strip.offsetWidth;
      const dur = 900 + r * 280;
      strip.style.transition = `transform ${dur}ms cubic-bezier(.25,.9,.3,1.08)`;
      strip.style.transform = 'translateY(0)';
      return sleep(dur).then(() => { if (alive) sfx('stop'); });
    });
    const ticker = window.setInterval(() => sfx('reel'), 90);
    await Promise.all(anims);
    clearInterval(ticker);
    if (!alive) return;
    strips.forEach((s, i) => fill(s, grid[i]));
    await settle(grid, lineBet, total);
    busy = false;
    stepper.setEnabled(true);
    spinBtn.disabled = false;
    if (auto > 0) {
      auto--;
      autoBtn.textContent = auto ? tr(`Stop (${auto})`, `Parar (${auto})`) : 'AUTO ×10';
      if (auto) { await sleep(500); void doSpin(); }
    }
  }

  async function settle(grid: Grid, lineBet: number, total: number) {
    const wins = evaluateGrid(grid, lineBet);
    let pay = wins.reduce((s, w) => s + w.pay, 0);
    const jackpotHit = wins.some(w => w.jackpot);
    if (jackpotHit) pay += Math.round(profile.wallet.jackpot);
    wins.forEach(w => {
      const rows = LINES[w.line];
      const pts = rows.map((row, reel) => `${reel * 100 + 50},${row * 100 + 50}`).join(' ');
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', pts);
      pl.setAttribute('stroke', LINE_COLORS[w.line]);
      overlay.append(pl);
      for (let reel = 0; reel < w.count; reel++) strips[reel].children[rows[reel]]?.classList.add('hit');
    });
    countPlay('slots', pay > 0);
    if (jackpotHit) {
      const amount = Math.round(profile.wallet.jackpot);
      profile.wallet.jackpot = JACKPOT_SEED;
      save();
      jp.lastElementChild!.textContent = fmt(profile.wallet.jackpot);
      addChips(pay);
      sfx('jackpot');
      buzz(true);
      coinBurst(machine, 60);
      resultBanner(result, tr(`JACKPOT! +${fmt(pay)}`, `¡PREMIO MAYOR! +${fmt(pay)}`), 'win');
      dialog('JACKPOT!', h('p.big-win', {}, `You hit the Lagoon Jackpot: ${fmt(amount)} chips!`));
      auto = 0;
    } else if (pay > 0) {
      addChips(pay);
      const big = pay >= total * 10;
      sfx(big ? 'bigwin' : 'win');
      if (big) { buzz(true); coinBurst(machine, 40); }
      else coinBurst(spinBtn, 10);
      resultBanner(result, `${big ? tr('BIG WIN! ', '¡GRAN PREMIO! ') : tr('Win ', 'Ganas ')}+${fmt(pay)}`, 'win');
    } else {
      resultBanner(result, tr('No win this time', 'Esta vez no hubo premio'), 'lose');
    }
    await sleep(pay > 0 ? 700 : 200);
  }

  const payBtn = h('button.btn.small', { onclick: () => {
    const rows = (['jackpot', 'wild', 'seven', 'bar', 'bell', 'shell', 'star', 'pearl'] as Sym[]).map(s =>
      h('div.pay-row', {}, h('span.pay-sym', { html: symbolSvg(s) }), h('span', {}, s === 'jackpot' ? `5: ${tr('JACKPOT', 'PREMIO MAYOR')} · 4: ${PAYTABLE[s][1]} · 3: ${PAYTABLE[s][0]}` : `5: ${PAYTABLE[s][2]} · 4: ${PAYTABLE[s][1]} · 3: ${PAYTABLE[s][0]}`)));
    dialog(tr('Pays (× line bet)', 'Pagos (× apuesta por línea)'), h('div.paytable', {}, ...rows, h('p.muted', {}, tr('Wins count from the leftmost reel. Wild stands in for every symbol except the crown. Five crowns on a line win the jackpot, which grows with every spin.', 'Los premios cuentan desde el rodillo de la izquierda. El comodín reemplaza a todos los símbolos menos la corona. Cinco coronas en una línea ganan el premio mayor, que crece con cada giro.'))));
  } }, tr('Pays', 'Pagos'));

  root.classList.add('slots');
  root.append(topBar(tr('Lagoon Slots', 'Tragamonedas Laguna')), jp,
    h('div.slot-frame', {}, h('div.marquee', {}, tr('LAGOON SLOTS', 'TRAGAMONEDAS LAGUNA')), machine),
    result,
    h('div.controls', {}, stepper.el, totalLbl),
    h('div.controls', {}, payBtn, spinBtn, autoBtn),
    h('div.controls', {}, h('button.btn.small', { onclick: slotsHowTo }, tr('How to play', 'Cómo jugar'))));
  return () => { alive = false; auto = 0; };
};
