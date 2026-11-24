import { sfx } from '../audio';
import { profile } from '../save';
import { host, imgHtml, img, say } from './assets';
import { fmt, h } from './dom';
import { go, type Screen } from './router';
import { dialog, topBar } from './shell';
import { tr } from '../i18n';
import { slotsScreen } from '../games/slotsPlay';
import { blackjackScreen } from '../games/blackjackPlay';
import { rouletteScreen } from '../games/roulettePlay';
import { videoPokerScreen } from '../games/videoPokerPlay';
import { bingoScreen } from '../games/bingoPlay';
import { colorsScreen } from '../games/colorsPlay';
import { zipScreen } from '../games/zipPlay';
import { baccaratScreen } from '../games/baccaratPlay';
import { crapsScreen } from '../games/crapsPlay';
import { holdemScreen } from '../games/holdemPlay';
import { kenoScreen } from '../games/kenoPlay';
import { tycoonScreen } from '../games/tycoonPlay';
import { pokerBingoScreen } from '../games/pokerBingoPlay';
import { checkersScreen } from '../games/checkersPlay';
import { fourScreen } from '../games/fourPlay';
import { picturesScreen } from '../games/picturesPlay';
import { dominoesScreen } from '../games/dominoesPlay';
import { raceScreen } from '../games/racePlay';
import { starsScreen } from '../games/starsPlay';
import { fiveDiceScreen } from '../games/fiveDicePlay';
import { pearlDiverScreen } from '../games/pearlDiverPlay';
import { memoryScreen } from '../games/memoryPlay';
import { rummyScreen } from '../games/rummyPlay';
import { goFishScreen } from '../games/goFishPlay';
import { fleetScreen } from '../games/fleetPlay';

interface Tile { id: string; name: string; sub: string; icon: string; screen?: Screen }

const icon = (name: string) => imgHtml(`icons/${name}.webp`, 'tile-img');
let welcomed = false;

function tile(t: Tile, big = false) {
  const soon = !t.screen;
  return h('button.tile' + (big ? '.big' : '') + (soon ? '.soon' : ''), {
    onclick: () => {
      sfx('click');
      if (t.screen) go(t.screen);
      else dialog(t.name, h('p', {}, tr('Coming soon. This one is on the list.', 'Muy pronto. Este ya está en la lista.')));
    },
  },
  h('span.tile-icon', { html: t.icon }),
  h('span.tile-text', {}, h('span.tile-name', {}, t.name), h('span.tile-sub', {}, soon ? tr('Coming soon', 'Muy pronto') : t.sub)));
}

function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? tr('Good morning', 'Buenos días') : hr < 18 ? tr('Good afternoon', 'Buenas tardes') : tr('Good evening', 'Buenas noches');
}

export const hallScreen: Screen = root => {
  root.classList.add('hall');
  const ollie = host('wave', tr(`${greeting()}! I'm Ollie. Pick a room.`, `¡${greeting()}! Soy Ollie. Elige una sala.`));
  const hello = () => { if (welcomed) return; welcomed = true; say('welcome'); };
  if (navigator.userActivation?.hasBeenActive) hello(); else root.addEventListener('pointerdown', hello, { once: true });
  root.append(
    topBar('Lucky Lagoon', { showBack: false }),
    h('section.hero', {}, img('ui/logo.webp', 'hero-logo', 'Lucky Lagoon'), ollie.el),
    h('nav.rooms', {},
      tile({ id: 'casino', name: tr('Casino', 'Casino'), sub: tr('Slots, cards, roulette, bingo', 'Tragamonedas, cartas, ruleta, bingo'), icon: icon('casino'), screen: casinoScreen }, true),
      tile({ id: 'arcade', name: tr('Arcade', 'Arcade'), sub: tr('Zip and friends', 'Zip y sus amigos'), icon: icon('arcade'), screen: arcadeScreen }, true),
      tile({ id: 'board', name: tr('Board & Cards', 'Tablero y Cartas'), sub: tr('Board, card and dice games', 'Juegos de tablero, cartas y dados'), icon: icon('board'), screen: boardScreen }, true),
      tile({ id: 'stats', name: tr('Stats', 'Estadísticas'), sub: tr('Your record', 'Tu historial'), icon: icon('stats'), screen: statsScreen }, true)),
  );
};

function section(title: string, ...tiles: HTMLElement[]) {
  return h('section.group', {}, h('h3.group-title', {}, title), h('div.tiles', {}, ...tiles));
}

export const casinoScreen: Screen = root => {
  const jp = h('span.jp-amount', {}, fmt(profile.wallet.jackpot));
  const timer = window.setInterval(() => { jp.textContent = fmt(profile.wallet.jackpot); }, 1000);
  root.classList.add('lobby');
  root.append(
    topBar(tr('Casino', 'Casino')),
    h('div.jackpot-meter', {}, h('span.jp-label', {}, tr('LAGOON JACKPOT', 'PREMIO MAYOR')), jp),
    h('div.scroll', {},
      section(tr('Slots', 'Tragamonedas'),
        tile({ id: 'slots', name: tr('Lagoon Slots', 'Tragamonedas Laguna'), sub: tr('5 reels · 9 lines · jackpot', '5 rodillos · 9 líneas · premio mayor'), icon: icon('g-slots'), screen: slotsScreen })),
      section(tr('Table games', 'Juegos de mesa'),
        tile({ id: 'blackjack', name: 'Blackjack 21', sub: tr('Beat Ollie to 21', 'Gánale a Ollie a 21'), icon: icon('g-blackjack'), screen: blackjackScreen }),
        tile({ id: 'roulette', name: tr('Roulette', 'Ruleta'), sub: tr('Single zero wheel', 'Rueda de un solo cero'), icon: icon('g-roulette'), screen: rouletteScreen }),
        tile({ id: 'baccarat', name: 'Baccarat', sub: tr('Player, banker or tie', 'Jugador, banca o empate'), icon: icon('g-baccarat'), screen: baccaratScreen }),
        tile({ id: 'craps', name: tr('Craps', 'Dados'), sub: tr('Roll the dice', 'Lanza los dados'), icon: icon('g-craps'), screen: crapsScreen })),
      section(tr('Poker', 'Póquer'),
        tile({ id: 'videopoker', name: tr('Video Poker', 'Video Póquer'), sub: tr('Jacks or better', 'Jotas o mejor'), icon: icon('g-videopoker'), screen: videoPokerScreen }),
        tile({ id: 'holdem', name: "Hold'em", sub: tr('Texas poker vs 3 players', 'Póquer Texas contra 3 jugadores'), icon: icon('g-holdem'), screen: holdemScreen })),
      section(tr('Bingo & Keno', 'Bingo y Keno'),
        tile({ id: 'bingo', name: 'Bingo', sub: tr('Up to 4 cards', 'Hasta 4 cartones'), icon: icon('g-bingo'), screen: bingoScreen }),
        tile({ id: 'keno', name: 'Keno', sub: tr('Pick up to 10 numbers', 'Elige hasta 10 números'), icon: icon('g-keno'), screen: kenoScreen }),
        tile({ id: 'pokerbingo', name: tr('Poker Bingo', 'Bingo Póquer'), sub: tr('Bingo with playing cards', 'Bingo con cartas de póquer'), icon: icon('g-pokerbingo'), screen: pokerBingoScreen }),
        tile({ id: 'pictures', name: tr('Picture Bingo', 'Lotería Laguna'), sub: tr('Ollie calls the pictures', 'Ollie canta los dibujos'), icon: icon('g-pictures'), screen: picturesScreen }))),
  );
  return () => clearInterval(timer);
};

export const arcadeScreen: Screen = root => {
  root.classList.add('lobby');
  root.append(topBar(tr('Arcade', 'Arcade')), h('div.scroll', {},
    section(tr('Platformers', 'Plataformas'), tile({ id: 'zip', name: 'Zip', sub: tr('A speedy otter platformer', 'Una nutria veloz de plataformas'), icon: imgHtml('chars/zip.webp', 'tile-img'), screen: zipScreen }))));
};

export const boardScreen: Screen = root => {
  root.classList.add('lobby');
  root.append(topBar(tr('Board & Cards', 'Tablero y Cartas')), h('div.scroll', {},
    section(tr('Board games', 'Juegos de tablero'), tile({ id: 'tycoon', name: tr('Harbor Tycoon', 'Magnate del Puerto'), sub: tr('Buy, build, trade', 'Compra, construye, negocia'), icon: icon('g-tycoon'), screen: tycoonScreen }),
      tile({ id: 'race', name: tr('Lagoon Race', 'Carrera de la Laguna'), sub: tr('Race 4 tokens home, 2-4 players', 'Lleva 4 fichas a la meta, 2-4 jugadores'), icon: icon('g-race'), screen: raceScreen }),
      tile({ id: 'checkers', name: tr('Checkers', 'Damas'), sub: tr('Jump and crown vs the computer', 'Salta y corona contra la computadora'), icon: icon('g-checkers'), screen: checkersScreen }),
      tile({ id: 'stars', name: tr('Star Checkers', 'Damas Estrella'), sub: tr('Hop your marbles across the star', 'Salta tus canicas por la estrella'), icon: icon('g-stars'), screen: starsScreen }),
      tile({ id: 'four', name: tr('Four in a Row', 'Cuatro en Línea'), sub: tr('Drop pearls, line up four', 'Suelta perlas, alinea cuatro'), icon: icon('g-four'), screen: fourScreen }),
      tile({ id: 'dominoes', name: tr('Dominoes', 'Dominó'), sub: tr('Draw or block, 2-4 players', 'Robar o bloqueo, 2-4 jugadores'), icon: icon('g-dominoes'), screen: dominoesScreen }),
      tile({ id: 'fleet', name: tr('Sink the Fleet', 'Hundir la Flota'), sub: tr('Find and sink Ollie\'s boats', 'Encuentra y hunde los barcos de Ollie'), icon: icon('g-fleet'), screen: fleetScreen })),
    section(tr('Card games', 'Juegos de cartas'), tile({ id: 'crazycolors', name: tr('Crazy Colors', 'Colores Locos'), sub: tr('Match colors, with house rules', 'Combina colores, con reglas de la casa'), icon: icon('g-colors'), screen: colorsScreen }),
      tile({ id: 'rummy', name: 'Rummy', sub: tr('Sets and runs', 'Tríos y escaleras'), icon: icon('g-rummy'), screen: rummyScreen }),
      tile({ id: 'gofish', name: tr('Go Fish', 'Ve a Pescar'), sub: tr('Collect books of four', 'Junta libros de cuatro'), icon: icon('g-gofish'), screen: goFishScreen }),
      tile({ id: 'memory', name: tr('Memory Match', 'Memoria'), sub: tr('Find the pairs, solo or vs Ollie', 'Encuentra las parejas, solo o contra Ollie'), icon: icon('g-memory'), screen: memoryScreen })),
    section(tr('Dice games', 'Juegos de dados'), tile({ id: 'fivedice', name: tr('Five Dice', 'Cinco Dados'), sub: tr('Roll, hold, fill 13 boxes', 'Tira, guarda, llena 13 casillas'), icon: icon('g-dice'), screen: fiveDiceScreen }),
      tile({ id: 'pearldiver', name: tr('Pearl Diver', 'Buzo de Perlas'), sub: tr('Push your luck to 100', 'Arriésgate hasta 100'), icon: icon('g-pearl'), screen: pearlDiverScreen }))));
};

const NAMES = (): Record<string, string> => ({ slots: tr('Lagoon Slots', 'Tragamonedas Laguna'), blackjack: 'Blackjack 21', roulette: tr('Roulette', 'Ruleta'), videopoker: tr('Video Poker', 'Video Póquer'), bingo: 'Bingo', colors: tr('Crazy Colors', 'Colores Locos'), zip: 'Zip', baccarat: 'Baccarat', craps: tr('Craps', 'Dados'), holdem: "Hold'em", keno: 'Keno', tycoon: tr('Harbor Tycoon', 'Magnate del Puerto'), checkers: tr('Checkers', 'Damas'), four: tr('Four in a Row', 'Cuatro en Línea'), pokerbingo: tr('Poker Bingo', 'Bingo Póquer'), pictures: tr('Picture Bingo', 'Lotería Laguna'), race: tr('Lagoon Race', 'Carrera de la Laguna'), stars: tr('Star Checkers', 'Damas Estrella'), dominoes: tr('Dominoes', 'Dominó'), fleet: tr('Sink the Fleet', 'Hundir la Flota'), rummy: 'Rummy', gofish: tr('Go Fish', 'Ve a Pescar'), memory: tr('Memory Match', 'Memoria'), fivedice: tr('Five Dice', 'Cinco Dados'), pearldiver: tr('Pearl Diver', 'Buzo de Perlas') });

export const statsScreen: Screen = root => {
  const w = profile.wallet;
  const rows = Object.keys(NAMES()).map(k => {
    const p = profile.stats.played[k] ?? 0, won = profile.stats.won[k] ?? 0;
    return h('tr', {}, h('td', {}, NAMES()[k]), h('td.num', {}, fmt(p)), h('td.num', {}, fmt(won)), h('td.num', {}, p ? Math.round((won / p) * 100) + '%' : '–'));
  });
  root.classList.add('lobby');
  root.append(topBar(tr('Stats', 'Estadísticas')), h('div.scroll', {},
    h('div.stat-cards', {},
      h('div.stat', {}, h('span.stat-num', {}, fmt(w.chips)), h('span.stat-lbl', {}, tr('Chips', 'Fichas'))),
      h('div.stat', {}, h('span.stat-num', {}, fmt(w.biggestWin)), h('span.stat-lbl', {}, tr('Biggest win', 'Mayor premio'))),
      h('div.stat', {}, h('span.stat-num', {}, fmt(w.jackpot)), h('span.stat-lbl', {}, tr('Jackpot now', 'Premio mayor ahora')))),
    h('table.stats-table', {}, h('thead', {}, h('tr', {}, h('th', {}, tr('Game', 'Juego')), h('th', {}, tr('Played', 'Jugadas')), h('th', {}, tr('Won', 'Ganadas')), h('th', {}, tr('Win %', '% ganado')))), h('tbody', {}, ...rows))));
};
