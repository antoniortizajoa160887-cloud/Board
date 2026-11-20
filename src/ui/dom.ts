import { locale } from '../i18n';
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

/** Tiny element helper: h('div.card#id', {onclick}, children...) */
// Typed loosely as a button so .disabled works on the buttons it makes; cast for other needs.
export function h<T extends HTMLElement = HTMLButtonElement>(tag: string, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): T {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const el = document.createElement(name || 'div');
  for (const part of rest) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') (el as unknown as Record<string, unknown>)[k] = v;
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el as unknown as T;
}

export const fmt = (n: number) => Math.round(n).toLocaleString(locale());

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Shows a short message that floats up and fades. */
export function toast(text: string, kind: 'win' | 'info' | 'lose' = 'info') {
  const el = h('div.toast.' + kind, {}, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

/** Counts a number up in an element. */
export function countUp(el: HTMLElement, from: number, to: number, ms = 700) {
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Gold coin burst from an element (win celebration). */
export function coinBurst(from: Element, count = 18) {
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const c = h('div.coin-fx');
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    c.style.left = cx + 'px';
    c.style.top = cy + 'px';
    c.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    c.style.setProperty('--dy', Math.sin(ang) * dist - 60 + 'px');
    c.style.animationDelay = Math.random() * 120 + 'ms';
    document.body.append(c);
    setTimeout(() => c.remove(), 1300);
  }
}
