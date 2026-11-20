import { h } from './dom';

/** A screen draws itself into the app root and may return a cleanup function. */
export type Screen = (root: HTMLElement) => (() => void) | void;

interface Entry { screen: Screen; cleanup?: () => void }
const stack: Entry[] = [];

const root = () => document.getElementById('app')!;

function show(e: Entry) {
  const r = root();
  r.replaceChildren();
  const view = h('div.view');
  r.append(view);
  e.cleanup = e.screen(view) || undefined;
}

export function go(screen: Screen) {
  const top = stack[stack.length - 1];
  top?.cleanup?.();
  stack.push({ screen });
  show(stack[stack.length - 1]);
}

/** Back one screen. Returns false at the hall (so Android can close the app). */
export function back(): boolean {
  if (stack.length <= 1) return false;
  stack.pop()!.cleanup?.();
  show(stack[stack.length - 1]);
  return true;
}

export function home(screen: Screen) {
  while (stack.length) stack.pop()!.cleanup?.();
  go(screen);
}

/** Overlay dialogs close first on Android back. */
export function closeTopDialog(): boolean {
  const d = document.querySelector('.dialog-scrim:last-of-type');
  if (d) { d.remove(); return true; }
  return false;
}
