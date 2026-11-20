import { sfx } from '../audio';
import { profile } from '../save';
import { ICONS, dealerSvg } from './art';
import { fmt, h } from './dom';
import { go, type Screen } from './router';
import { dialog, topBar } from './shell';
import { slotsScreen } from '../games/slotsPlay';
import { blackjackScreen } from '../games/blackjackPlay';
import { rouletteScreen } from '../games/roulettePlay';
import { videoPokerScreen } from '../games/videoPokerPlay';
import { bingoScreen } from '../games/bingoPlay';

interface Tile { id: string; name: string; sub: string; icon: string; screen?: Screen }

function tile(t: Tile, big = false) {
  const soon = !t.screen;
  return h('button.tile' + (big ? '.big' : '') + (soon ? '.soon' : ''), {
    onclick: () => {
      sfx('click');
      if (t.screen) go(t.screen);
      else dialog(t.name, h('p', {}, 'Coming soon. This one is on the list.'));
    },
  },
  h('span.tile-icon', { html: t.icon }),
  h('span.tile-text', {}, h('span.tile-name', {}, t.name), h('span.tile-sub', {}, soon ? 'Coming soon' : t.sub)));
}

function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

export const hallScreen: Screen = root => {
  root.classList.add('hall');
  root.append(
    topBar('Lucky Lagoon', { showBack: false }),
    h('section.hero', {},
      h('div.hero-dealer', { html: dealerSvg() }),
      h('div.hero-text', {},
        h('div.deco-title', {}, 'LUCKY LAGOON'),
        h('div.hero-line', {}, `${greeting()}! I'm Ollie. Pick a room.`))),
    h('nav.rooms', {},
      tile({ id: 'casino', name: 'Casino', sub: 'Slots, cards, roulette, bingo', icon: ICONS.casino, screen: casinoScreen }, true),
      tile({ id: 'arcade', name: 'Arcade', sub: 'Zip and friends', icon: ICONS.arcade, screen: arcadeScreen }, true),
      tile({ id: 'board', name: 'Board & Cards', sub: 'Property trading and more', icon: ICONS.board, screen: boardScreen }, true),
      tile({ id: 'stats', name: 'Stats', sub: 'Your record', icon: ICONS.keno, screen: statsScreen }, true)),
  );
};

function section(title: string, ...tiles: HTMLElement[]) {
  return h('section.group', {}, h('h3.group-title', {}, title), h('div.tiles', {}, ...tiles));
}

export const casinoScreen: Screen = root => {
  const jp = h('span.jp-amount', {}, fmt(profile.wallet.jackpot));
  const timer = window.setInterval(() => { jp.textContent = fmt(profile.wallet.jackpot); }, 1000);
  root.append(
    topBar('Casino'),
    h('div.jackpot-meter', {}, h('span.jp-label', {}, 'LAGOON JACKPOT'), jp),
    h('div.scroll', {},
      section('Slots',
        tile({ id: 'slots', name: 'Lagoon Slots', sub: '5 reels · 9 lines · jackpot', icon: ICONS.slots, screen: slotsScreen })),
      section('Table games',
        tile({ id: 'blackjack', name: 'Blackjack 21', sub: 'Beat Ollie to 21', icon: ICONS.cards, screen: blackjackScreen }),
        tile({ id: 'roulette', name: 'Roulette', sub: 'Single zero wheel', icon: ICONS.roulette, screen: rouletteScreen }),
        tile({ id: 'baccarat', name: 'Baccarat', sub: '', icon: ICONS.cards }),
        tile({ id: 'craps', name: 'Craps', sub: '', icon: ICONS.dice })),
      section('Poker',
        tile({ id: 'videopoker', name: 'Video Poker', sub: 'Jacks or better', icon: ICONS.poker, screen: videoPokerScreen }),
        tile({ id: 'holdem', name: "Hold'em", sub: '', icon: ICONS.poker })),
      section('Bingo & Keno',
        tile({ id: 'bingo', name: 'Bingo', sub: 'Up to 4 cards', icon: ICONS.bingo, screen: bingoScreen }),
        tile({ id: 'keno', name: 'Keno', sub: '', icon: ICONS.keno }))),
  );
  return () => clearInterval(timer);
};

export const arcadeScreen: Screen = root => {
  root.append(topBar('Arcade'), h('div.scroll', {},
    section('Platformers', tile({ id: 'zip', name: 'Zip', sub: 'A speedy otter platformer', icon: ICONS.zip }))));
};

export const boardScreen: Screen = root => {
  root.append(topBar('Board & Cards'), h('div.scroll', {},
    section('Board games', tile({ id: 'tycoon', name: 'Harbor Tycoon', sub: 'Buy, build, trade', icon: ICONS.board })),
    section('Card games', tile({ id: 'crazycolors', name: 'Crazy Colors', sub: 'Match colors, with house rules', icon: ICONS.cards }))));
};

const NAMES: Record<string, string> = { slots: 'Lagoon Slots', blackjack: 'Blackjack 21', roulette: 'Roulette', videopoker: 'Video Poker', bingo: 'Bingo' };

export const statsScreen: Screen = root => {
  const w = profile.wallet;
  const rows = Object.keys(NAMES).map(k => {
    const p = profile.stats.played[k] ?? 0, won = profile.stats.won[k] ?? 0;
    return h('tr', {}, h('td', {}, NAMES[k]), h('td.num', {}, fmt(p)), h('td.num', {}, fmt(won)), h('td.num', {}, p ? Math.round((won / p) * 100) + '%' : '–'));
  });
  root.append(topBar('Stats'), h('div.scroll', {},
    h('div.stat-cards', {},
      h('div.stat', {}, h('span.stat-num', {}, fmt(w.chips)), h('span.stat-lbl', {}, 'Chips')),
      h('div.stat', {}, h('span.stat-num', {}, fmt(w.biggestWin)), h('span.stat-lbl', {}, 'Biggest win')),
      h('div.stat', {}, h('span.stat-num', {}, fmt(w.jackpot)), h('span.stat-lbl', {}, 'Jackpot now'))),
    h('table.stats-table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Game'), h('th', {}, 'Played'), h('th', {}, 'Won'), h('th', {}, 'Win %'))), h('tbody', {}, ...rows))));
};
