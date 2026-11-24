/** Shared pieces for the board, card and dice games played against the computer. */
import { sfx } from '../audio';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { img } from '../ui/assets';
import { BOTS } from '../ui/colorsArt';
import { coinBurst, h } from '../ui/dom';
import { dialog } from '../ui/shell';
import { LEVEL_CHIPS } from './checkersPlay';

export type Level = 1 | 2 | 3;
export const levelName = (l: Level) => (l === 1 ? tr('Easy', 'Fácil') : l === 2 ? tr('Normal', 'Normal') : tr('Hard', 'Difícil'));

/** A row of choice buttons. `label` turns a value into its text. */
export function choiceSeg<T>(values: T[], get: () => T, set: (v: T) => void, label: (v: T) => string, cls = '') {
  const el = h('div.seg' + cls);
  const draw = () => el.replaceChildren(...values.map(v => h('button.seg-btn' + (v === get() ? '.on' : ''), {
    onclick: () => { if (v === get()) return; sfx('click'); set(v); draw(); },
  }, label(v))));
  draw();
  return { el, draw, setEnabled: (on: boolean) => el.querySelectorAll('button').forEach(b => { (b as HTMLButtonElement).disabled = !on; }) };
}

export const levelSeg = (get: () => Level, set: (l: Level) => void) => choiceSeg<Level>([1, 2, 3], get, set, levelName);
export const playersSeg = (values: number[], get: () => number, set: (n: number) => void) =>
  choiceSeg(values, get, set, n => tr(`${n} players`, `${n} jugadores`));

export const prizeLine = (prizes: Record<Level, number> = LEVEL_CHIPS as unknown as Record<Level, number>) => h('p.muted.small.center', {},
  tr(`Win: Easy +${prizes[1]} · Normal +${prizes[2]} · Hard +${prizes[3]} chips`, `Premio: Fácil +${prizes[1]} · Normal +${prizes[2]} · Difícil +${prizes[3]} fichas`));

/** You plus up to three computer players: name, face picture and colour. */
export const seatName = (i: number) => (i === 0 ? tr('You', 'Tú') : BOTS[i - 1].name);
/** Computer players show their picture; you get a gold star badge. */
export const seatFace = (i: number, cls = 'tk-face'): HTMLElement => (i === 0 ? h('div.tk-you.' + cls, { 'aria-label': seatName(0) }, '★') : img(BOTS[i - 1].pic, cls, seatName(i)));
export const SEAT_COLORS = ['#f5c542', BOTS[0].color, BOTS[1].color, BOTS[2].color];

/** Ends a game: pays the prize when the player won, counts the play, and offers another game. */
export function finish(opts: { key: string; status: HTMLElement; burstFrom: Element; won: boolean; draw?: boolean; prize: number; text: string; again: () => void; alive: () => boolean }) {
  const { key, status, burstFrom, won, draw, prize, text, again, alive } = opts;
  countPlay(key, won);
  if (won && prize > 0) { addChips(prize); sfx('jackpot'); coinBurst(burstFrom, 30); buzz(); }
  else if (draw) sfx('chip');
  else sfx('lose');
  status.className = 'result ' + (won ? 'win' : draw ? 'push' : 'lose');
  status.textContent = text;
  setTimeout(() => {
    if (!alive()) return;
    dialog(won ? tr('You win!', '¡Ganaste!') : draw ? tr('Draw', 'Empate') : tr('Game over', 'Fin del juego'), h('p', {}, text),
      [{ label: tr('Close', 'Cerrar') }, { label: tr('Play again', 'Jugar otra vez'), primary: true, onclick: again }]);
  }, 900);
}

export const say = (status: HTMLElement, text: string, kind = '') => { status.className = 'result' + (kind ? ' ' + kind : ''); status.textContent = text; };

/** Draws dice faces (1-6) as pips in a 3 × 3 grid. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function dieEl(v: number, cls = '') {
  return h('div.tk-die' + cls, { 'aria-label': String(v) }, ...Array.from({ length: 9 }, (_, i) => h('i' + (PIPS[v]?.includes(i) ? '.on' : ''))));
}
