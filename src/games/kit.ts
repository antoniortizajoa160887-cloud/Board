import { tr } from '../i18n';
import { sfx } from '../audio';
import { buzz } from '../platform';
import { profile } from '../save';
import { fmt, h, toast } from '../ui/dom';
import { bonusDialog } from '../ui/shell';
import { chipSvg, CHIP_COLORS } from '../ui/art';

/** A − amount + stepper for bets. */
export function betStepper(values: number[], start: number, label = tr('Bet', 'Apuesta'), onChange?: (v: number) => void, show: (v: number) => string = fmt) {
  let i = Math.max(0, values.indexOf(start));
  const out = h('span.bet-val', {}, show(values[i]));
  const set = (d: number) => {
    i = Math.min(values.length - 1, Math.max(0, i + d));
    out.textContent = show(values[i]);
    sfx('chip');
    onChange?.(values[i]);
  };
  const minus = h('button.step', { 'aria-label': tr('Less', 'Menos'), onclick: () => set(-1) }, '−');
  const plus = h('button.step', { 'aria-label': tr('More', 'Más'), onclick: () => set(1) }, '+');
  const el = h('div.bet-stepper', {}, h('span.bet-lbl', {}, label), minus, out, plus);
  return { el, get: () => values[i], setEnabled: (on: boolean) => { minus.disabled = !on; plus.disabled = !on; } };
}

/** Asks for more chips when the player can't afford a bet. */
export function cantAfford(amount: number): boolean {
  if (profile.wallet.chips >= amount) return false;
  toast(tr(`You need ${fmt(amount)} chips`, `Necesitas ${fmt(amount)} fichas`), 'lose');
  buzz();
  bonusDialog();
  return true;
}

export function resultBanner(el: HTMLElement, text: string, kind: 'win' | 'lose' | 'push' | 'info') {
  el.className = 'result ' + kind;
  el.textContent = text;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

/** A row of chip buttons; the picked value is used when the player taps a betting spot. */
export function chipPicker(values: number[], start: number) {
  let chip = start;
  const el = h('div.chip-bar', {}, ...values.map(v => {
    const b = h('button.chip-btn' + (v === chip ? '.on' : ''), { 'aria-label': `${v}`, html: chipSvg(v, CHIP_COLORS[v]), onclick: () => {
      chip = v; sfx('chip');
      el.querySelectorAll('.chip-btn').forEach(x => x.classList.toggle('on', x === b));
    } });
    return b;
  }));
  return { el, get: () => chip };
}

/** The small stack label shown on a betting spot. */
export const stackLabel = (amt: number) => (amt >= 1000 ? `${+(amt / 1000).toFixed(1)}K` : String(amt));
