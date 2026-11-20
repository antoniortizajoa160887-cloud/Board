import { tr } from '../i18n';
import { art, olliePath, say, type Pose } from './assets';
import { h } from './dom';

/**
 * Ollie reacts to how a round ends. Games already report it (resultBanner and the big win sounds);
 * this listens for those reports, speaks a line and shows Ollie. At a table with a dealer seat
 * the dealer changes pose; elsewhere Ollie pops up from the corner for a moment.
 */

let pop: HTMLElement | null = null;
let popImg: HTMLImageElement;
let popText: HTMLElement;
let hideAt = 0;
let loseCount = 0;
let bigAt = 0;

function scene() { return document.getElementById('app')?.dataset.scene ?? ''; }

function showPop(pose: Pose, text: string) {
  if (!pop) {
    popImg = h('img.pop-ollie-img', { alt: 'Ollie', draggable: 'false' }) as HTMLImageElement;
    popText = h('div.host-bubble');
    pop = h('div.pop-ollie', {}, popText, popImg);
    document.body.append(pop);
  }
  popImg.src = art(olliePath(pose));
  popText.textContent = text;
  pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
  clearTimeout(hideAt);
  hideAt = window.setTimeout(() => pop?.classList.remove('show'), 2200);
}

/** Shows a reaction: on the dealer seat when the screen has one, else as a pop-up. */
export function react(pose: Pose, text: string) {
  const seat = document.querySelector<HTMLImageElement>('.view img.dealer');
  if (seat) {
    seat.src = art(olliePath(pose));
    seat.classList.remove('hopping'); void seat.offsetWidth; seat.classList.add('hopping');
    clearTimeout(Number(seat.dataset.t));
    seat.dataset.t = String(window.setTimeout(() => { seat.src = art(olliePath('idle')); }, 2600));
    return;
  }
  showPop(pose, text);
}

const WIN = () => [tr('Nice one!', '¡Muy bien!'), tr('You win!', '¡Ganaste!'), tr('Lucky you!', '¡Qué suerte!')];
const LOSE = () => [tr('So close!', '¡Casi!'), tr('Next one!', '¡La próxima!')];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

export function startReactions() {
  window.addEventListener('ll-result', e => {
    const kind = (e as CustomEvent<string>).detail;
    // Wait a moment: a big win sound right after the result takes over.
    window.setTimeout(() => {
      if (document.querySelector('.dialog-scrim') || Date.now() - bigAt < 1500) return;
      if (kind === 'win') { say('win'); react('cheer', pick(WIN())); }
      else if (kind === 'lose') { if (++loseCount % 3 === 1) { say('lose'); react('shrug', pick(LOSE())); } }
    }, 150);
  });
  window.addEventListener('ll-big', e => {
    if (document.querySelector('.dialog-scrim')) return;
    const what = (e as CustomEvent<string>).detail;
    bigAt = Date.now();
    const s = scene();
    if (s === 'zip-view') { say('level', { interrupt: true }); return; }
    say(what === 'jackpot' && s === 'slots' ? 'jackpot' : 'bigwin', { interrupt: true });
    react('cheer', what === 'jackpot' && s === 'slots' ? tr('JACKPOT!', '¡PREMIO MAYOR!') : tr('Big win!', '¡Gran premio!'));
  });
}
