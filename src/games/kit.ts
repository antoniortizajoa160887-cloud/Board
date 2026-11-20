import { sfx } from '../audio';
import { buzz } from '../platform';
import { profile } from '../save';
import { fmt, h, toast } from '../ui/dom';
import { bonusDialog } from '../ui/shell';

/** A − amount + stepper for bets. */
export function betStepper(values: number[], start: number, label = 'Bet', onChange?: (v: number) => void, show: (v: number) => string = fmt) {
  let i = Math.max(0, values.indexOf(start));
  const out = h('span.bet-val', {}, show(values[i]));
  const set = (d: number) => {
    i = Math.min(values.length - 1, Math.max(0, i + d));
    out.textContent = show(values[i]);
    sfx('chip');
    onChange?.(values[i]);
  };
  const minus = h('button.step', { 'aria-label': 'Less', onclick: () => set(-1) }, '−');
  const plus = h('button.step', { 'aria-label': 'More', onclick: () => set(1) }, '+');
  const el = h('div.bet-stepper', {}, h('span.bet-lbl', {}, label), minus, out, plus);
  return { el, get: () => values[i], setEnabled: (on: boolean) => { minus.disabled = !on; plus.disabled = !on; } };
}

/** Asks for more chips when the player can't afford a bet. */
export function cantAfford(amount: number): boolean {
  if (profile.wallet.chips >= amount) return false;
  toast(`You need ${fmt(amount)} chips`, 'lose');
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
