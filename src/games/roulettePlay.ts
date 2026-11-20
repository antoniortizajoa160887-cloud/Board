import { sfx } from '../audio';
import { say } from '../ui/assets';
import { betKey, colorOf, payout, WHEEL_ORDER, type BetKind } from '../core/roulette';
import { makeRng, randInt } from '../core/rng';
import { buzz } from '../platform';
import { addChips, countPlay, profile } from '../save';
import { chipSvg, CHIP_COLORS } from '../ui/art';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { resultBanner } from './kit';
import { toast } from '../ui/dom';
import { tr } from '../i18n';
import { howToPlay } from './howto';

export const rouletteHowTo = () => howToPlay(tr('How to play Roulette', 'Cómo jugar a la Ruleta'), [
  [tr('The idea', 'La idea'), tr('The ball lands in one of 37 pockets: 0 to 36. You bet on where it will land.', 'La bola cae en una de 37 casillas: del 0 al 36. Apuestas a dónde caerá.')],
  [tr('Placing bets', 'Apostar'), tr('Pick a chip value at the bottom, then tap the table. Tap again to add more chips. CLEAR removes your bets; REBET repeats the last ones.', 'Elige el valor de la ficha abajo y toca la mesa. Toca otra vez para añadir más. BORRAR quita tus apuestas; REPETIR vuelve a poner las anteriores.')],
  [tr('Inside bets', 'Apuestas a números'), tr('A single number pays 35 to 1. Big prize, small chance.', 'Un solo número paga 35 a 1. Gran premio, poca probabilidad.')],
  [tr('Outside bets', 'Apuestas exteriores'), tr('Red or black, odd or even, 1–18 or 19–36 pay 1 to 1. A dozen (1st, 2nd, 3rd 12) or a column (2:1) pays 2 to 1. If the ball lands on 0, every outside bet loses.', 'Rojo o negro, par o impar, 1–18 o 19–36 pagan 1 a 1. Una docena (1ª, 2ª, 3ª 12) o una columna (2:1) paga 2 a 1. Si la bola cae en 0, pierden todas las apuestas exteriores.')],
  [tr('Spin', 'Girar'), tr('Tap SPIN. The winning number glows and the history row shows the last results.', 'Toca GIRAR. El número ganador brilla y la fila de historial muestra los últimos resultados.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Start with red or black: you win almost half the time. Past numbers do not change what comes next.', 'Empieza con rojo o negro: ganas casi la mitad de las veces. Los números anteriores no cambian lo que sale después.')],
]);

const CHIPS = [10, 25, 100, 500, 1000];
const COLOR_HEX = { red: '#d42a2a', black: '#141a33', green: '#0f9a5c' };

export const rouletteScreen: Screen = root => {
  const rng = makeRng();
  let alive = true;
  let busy = false;
  let chip = 25;
  let bets: Record<string, number> = {};
  let lastBets: Record<string, number> = {};
  const history: number[] = [];

  // Wheel drawn on a canvas, turned with CSS; a ball orbits on a second layer.
  const size = 280;
  const canvas = h('canvas.wheel-canvas', { width: size * 2, height: size * 2 }) as HTMLCanvasElement;
  drawWheel(canvas);
  const ball = h('div.ball');
  const ballArm = h('div.ball-arm', {}, ball);
  const wheel = h('div.wheel', {}, canvas, ballArm, h('div.wheel-hub'));
  let wheelAngle = 0;

  const result = h('div.result', {}, tr('Tap a chip, then tap the table', 'Toca una ficha y luego la mesa'));
  const totalEl = h('span.total-bet', {}, 'Bets 0');
  const histEl = h('div.history');

  const cells = new Map<string, HTMLElement>();
  const cell = (b: BetKind, label: string, cls = '') => {
    const key = betKey(b);
    const el = h('button.rcell' + cls, { onclick: () => place(key) }, h('span.rlabel', {}, label));
    cells.set(key, el);
    return el;
  };

  const grid = h('div.rgrid');
  grid.append(cell({ kind: 'number', n: 0 }, '0', '.green.zero'));
  for (let row = 0; row < 12; row++) for (let col = 0; col < 3; col++) {
    const n = row * 3 + col + 1;
    grid.append(cell({ kind: 'number', n }, String(n), '.' + colorOf(n)));
  }
  grid.append(cell({ kind: 'column', c: 0 }, '2:1', '.out'), cell({ kind: 'column', c: 1 }, '2:1', '.out'), cell({ kind: 'column', c: 2 }, '2:1', '.out'));
  const outside = h('div.routside', {},
    cell({ kind: 'dozen', d: 0 }, tr('1st 12', '1ª 12'), '.out'), cell({ kind: 'dozen', d: 1 }, tr('2nd 12', '2ª 12'), '.out'), cell({ kind: 'dozen', d: 2 }, tr('3rd 12', '3ª 12'), '.out'),
    cell({ kind: 'low' }, '1–18', '.out'), cell({ kind: 'even' }, tr('Even', 'Par'), '.out'), cell({ kind: 'red' }, '◆', '.out.red'),
    cell({ kind: 'black' }, '◆', '.out.black'), cell({ kind: 'odd' }, tr('Odd', 'Impar'), '.out'), cell({ kind: 'high' }, '19–36', '.out'));

  const chipBar = h('div.chip-bar', {}, ...CHIPS.map(v => {
    const b = h('button.chip-btn' + (v === chip ? '.on' : ''), { 'aria-label': tr(`${v} chip`, `ficha de ${v}`), html: chipSvg(v, CHIP_COLORS[v]), onclick: () => {
      chip = v; sfx('chip');
      chipBar.querySelectorAll('.chip-btn').forEach(x => x.classList.toggle('on', x === b));
    } });
    return b;
  }));

  const total = () => Object.values(bets).reduce((a, b) => a + b, 0);

  function renderBets() {
    cells.forEach((el, key) => {
      el.querySelector('.rchip')?.remove();
      const amt = bets[key];
      if (amt) el.append(h('span.rchip', {}, amt >= 1000 ? `${amt / 1000}K` : String(amt)));
    });
    totalEl.textContent = tr(`Bets ${fmt(total())}`, `Apuestas ${fmt(total())}`);
  }

  function place(key: string) {
    if (busy) return;
    if (profile.wallet.chips < chip) { toast(tr('Not enough chips', 'No tienes fichas suficientes'), 'lose'); return; }
    addChips(-chip);
    bets[key] = (bets[key] ?? 0) + chip;
    sfx('chip');
    renderBets();
  }

  function clear() {
    if (busy) return;
    const t = total();
    if (t) addChips(t);
    bets = {};
    renderBets();
  }

  function rebet() {
    if (busy || !Object.keys(lastBets).length) return;
    clear();
    const t = Object.values(lastBets).reduce((a, b) => a + b, 0);
    if (profile.wallet.chips < t) { toast(tr('Not enough chips', 'No tienes fichas suficientes'), 'lose'); return; }
    addChips(-t);
    bets = { ...lastBets };
    sfx('chip');
    renderBets();
  }

  async function spinWheel() {
    if (busy) return;
    if (!total()) { toast(tr('Place a bet first', 'Primero haz una apuesta')); return; }
    busy = true;
    spinBtn.disabled = true;
    lastBets = { ...bets };
    const n = WHEEL_ORDER[randInt(rng, WHEEL_ORDER.length)];
    const idx = WHEEL_ORDER.indexOf(n);
    const seg = 360 / 37;
    // Wheel turns clockwise; the ball runs the other way and lands on the pocket at the top.
    wheelAngle += 360 * 4 + randInt(rng, 360);
    const pocketAt = (wheelAngle + idx * seg + seg / 2) % 360; // where the pocket ends up (deg from top)
    const ballEnd = -360 * 6 + pocketAt;
    canvas.style.transition = 'transform 5s cubic-bezier(.15,.7,.25,1)';
    canvas.style.transform = `rotate(${wheelAngle}deg)`;
    ballArm.style.transition = 'none';
    ballArm.style.transform = 'rotate(0deg)';
    ball.classList.remove('settled');
    void ballArm.offsetWidth;
    ballArm.style.transition = 'transform 5s cubic-bezier(.2,.65,.2,1)';
    ballArm.style.transform = `rotate(${ballEnd}deg)`;
    resultBanner(result, tr('No more bets', 'No va más'), 'info');
    say('nomore', { interrupt: true });
    const ticks = window.setInterval(() => sfx('tick'), 120);
    await sleep(4200);
    clearInterval(ticks);
    ball.classList.add('settled');
    sfx('ball');
    await sleep(900);
    if (!alive) return;
    const won = payout(bets, n);
    const staked = total();
    history.unshift(n);
    histEl.replaceChildren(...history.slice(0, 12).map(x => h('span.hist.' + colorOf(x), {}, String(x))));
    cells.get(betKey({ kind: 'number', n }))?.classList.add('hit');
    if (won) {
      addChips(won);
      sfx(won >= staked * 10 ? 'bigwin' : 'win');
      buzz();
      coinBurst(wheel, won >= staked * 10 ? 40 : 16);
    } else sfx('lose');
    countPlay('roulette', won > staked);
    resultBanner(result, `${n} ${tr(colorOf(n).toUpperCase(), { red: 'ROJO', black: 'NEGRO', green: 'VERDE' }[colorOf(n)] ?? '')} · ${won ? tr(`you get ${fmt(won)}`, `recibes ${fmt(won)}`) : tr('no win', 'sin premio')}`, won > staked ? 'win' : won ? 'push' : 'lose');
    await sleep(1400);
    cells.get(betKey({ kind: 'number', n }))?.classList.remove('hit');
    bets = {};
    renderBets();
    busy = false;
    spinBtn.disabled = false;
  }

  const spinBtn = h('button.btn.primary.spin', { onclick: () => void spinWheel() }, tr('SPIN', 'GIRAR'));
  const rules = h('button.btn.small', { onclick: rouletteHowTo }, tr('How to play', 'Cómo jugar'));

  window.setTimeout(() => say('bets'), 600);
  root.classList.add('roulette', 'felt');
  root.append(topBar(tr('Roulette', 'Ruleta')),
    h('div.wheel-zone', {}, h('div.pointer'), wheel), histEl, result,
    h('div.rtable', {}, grid, outside),
    chipBar,
    h('div.controls', {}, h('button.btn.small', { onclick: clear }, tr('Clear', 'Borrar')), h('button.btn.small', { onclick: rebet }, tr('Rebet', 'Repetir')), totalEl, spinBtn, rules));
  return () => { alive = false; if (!busy) clear(); };
};

function drawWheel(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  const R = c.width / 2;
  const seg = (Math.PI * 2) / 37;
  ctx.translate(R, R);
  // Gold rim
  const rim = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
  rim.addColorStop(0, '#a86b12'); rim.addColorStop(0.5, '#fff3b0'); rim.addColorStop(1, '#a86b12');
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  WHEEL_ORDER.forEach((n, i) => {
    // Pocket i is centred at angle i*seg measured clockwise from the top.
    const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R * 0.9, a0, a1);
    ctx.closePath();
    ctx.fillStyle = COLOR_HEX[colorOf(n)];
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.rotate(a0 + seg / 2 + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${R * 0.075}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(n), 0, -R * 0.78);
    ctx.restore();
  });
  const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.62);
  inner.addColorStop(0, '#1d2c66'); inner.addColorStop(1, '#0b1030');
  ctx.fillStyle = inner;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate((i * Math.PI) / 4);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath(); ctx.moveTo(0, -R * 0.58); ctx.lineTo(R * 0.04, -R * 0.2); ctx.lineTo(-R * 0.04, -R * 0.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
