import { lang } from '../i18n';
import { profile } from '../save';
import { h } from './dom';

/** Painted artwork and recorded voice that ship inside the app (public/art). */

const BASE = import.meta.env.BASE_URL ?? '/';
export const art = (path: string) => `${BASE}art/${path}`;

/** An <img> of a piece of art. If the file is ever missing, the image hides itself instead of showing a broken icon. */
export function img(path: string, cls = '', alt = ''): HTMLImageElement {
  const el = h('img' + (cls ? '.' + cls.split(' ').join('.') : ''), { src: art(path), alt, draggable: 'false', decoding: 'async' }) as HTMLImageElement;
  el.addEventListener('error', () => { el.style.visibility = 'hidden'; }, { once: true });
  return el;
}
export const imgHtml = (path: string, cls = '', alt = '') => `<img class="${cls}" src="${art(path)}" alt="${alt}" draggable="false" decoding="async">`;

/** Ollie the otter host. */
export type Pose = 'idle' | 'wave' | 'cheer' | 'deal' | 'shrug';
export const olliePath = (p: Pose) => (p === 'idle' ? 'chars/ollie.webp' : `chars/ollie-${p}.webp`);

/** Ollie on screen, with a speech bubble. react() swaps the pose with a little hop. */
export function host(pose: Pose = 'idle', line = '') {
  const pic = img(olliePath(pose), 'host-img', 'Ollie');
  const bubble = h('div.host-bubble' + (line ? '' : '.hidden'), {}, line);
  const el = h('div.host', {}, pic, bubble);
  let back = 0;
  return {
    el,
    react(p: Pose, text?: string, hold = 2600) {
      pic.src = art(olliePath(p));
      el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
      if (text !== undefined) { bubble.textContent = text; bubble.classList.toggle('hidden', !text); }
      clearTimeout(back);
      if (p !== pose) back = window.setTimeout(() => { pic.src = art(olliePath(pose)); }, hold);
    },
  };
}

/** Computer players' portraits. */
export const AVATARS: Record<string, string> = { Pip: 'chars/pip.webp', Coral: 'chars/coral.webp', Moe: 'chars/moe.webp' };

// ---- Voice -------------------------------------------------------------------------------------------

export type Line = 'welcome' | 'bets' | 'nomore' | 'blackjack' | 'win' | 'bigwin' | 'jackpot' | 'bust' | 'dealerbust' | 'tie' | 'lose' | 'bingo' | 'dice' | 'shuffle' | 'level' | 'turn' | 'gameover';

let current: HTMLAudioElement | null = null;
let lastAt = 0;

function play(path: string, opts: { interrupt?: boolean } = {}) {
  if (!profile.settings.sound || profile.settings.voice === false) return;
  if (current && !current.ended && !current.paused && !opts.interrupt) return;
  current?.pause();
  const a = new Audio(art(path));
  a.volume = 0.95;
  current = a;
  void a.play().catch(() => { /* not allowed yet, or missing: stay quiet */ });
}

/** Ollie says a line in the player's language. Lines close together don't pile up. */
export function say(line: Line, opts: { interrupt?: boolean } = {}) {
  const now = Date.now();
  if (!opts.interrupt && now - lastAt < 700) return;
  lastAt = now;
  play(`voice/${lang()}/${line}.mp3`, opts);
}

/** A bingo number call (1 to 75), e.g. "B 7". */
export function sayCall(n: number) {
  play(`voice/${lang()}/n/${n}.mp3`, { interrupt: true });
}

export function stopVoice() { current?.pause(); current = null; }

/** The dealer calls a playing card, e.g. "Seven of hearts" (rank 2-14, suit C D H S). */
export function sayCard(rank: number, suit: string) {
  play(`voice/${lang()}/c/${rank}${suit}.mp3`, { interrupt: true });
}

/** A Poker Bingo pot is won: center, corners, five in a row, or the poker hands. */
export function sayPot(pot: 'center' | 'corners' | 'five' | 'poker') {
  play(`voice/${lang()}/pot/${pot}.mp3`, { interrupt: true });
}
