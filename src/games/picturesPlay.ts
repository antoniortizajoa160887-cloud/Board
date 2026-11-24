import { sfx } from '../audio';
import { newBoard, PIC_COUNT, PICS, picPayouts, picState, playPictures, type PicPot } from '../core/pictures';
import { makeRng, type Rng } from '../core/rng';
import { lang, tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay } from '../save';
import { img, olliePath, sayPic } from '../ui/assets';
import { BOTS } from '../ui/colorsArt';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { betStepper, cantAfford, resultBanner } from './kit';

const ANTES = [1, 5, 10, 25, 50, 100];
export const picName = (i: number) => (lang() === 'es' ? PICS[i][2] : PICS[i][1]);
/** The name without "The" / "El" / "La", for small labels. */
export const picShort = (i: number) => picName(i).replace(/^(The|El|La|Los|Las) /, '');
export const picImg = (i: number, cls = 'pic-img') => img(`pics/${PICS[i][0]}.webp`, cls, picName(i));
const potName = (p: PicPot) => (p === 'line' ? tr('Line', 'Línea') : tr('Full board', 'Tabla llena'));

export const picturesHowTo = () => howToPlay(tr('How to play Picture Bingo', 'Cómo jugar a la Lotería de la Laguna'), [
  [tr('The idea', 'La idea'), tr(`Bingo with pictures instead of numbers. There are ${PIC_COUNT} picture cards: animals, boats, fruit and more from the lagoon. Each board has 16 of them in a 4 × 4 grid.`, `Como el bingo, pero con dibujos en vez de números. Hay ${PIC_COUNT} cartas con dibujos: animales, barcos, frutas y más de la laguna. Cada tabla tiene 16 de ellas en una cuadrícula de 4 × 4.`)],
  [tr('Your boards', 'Tus tablas'), tr('Choose how many boards you play, from 1 to 4. Tap NEW BOARDS to get different pictures. Up to three other players join with their own boards.', 'Elige cuántas tablas juegas, de 1 a 4. Toca TABLAS NUEVAS para cambiar los dibujos. Hasta tres jugadores más se unen con sus propias tablas.')],
  [tr('The calls', 'Los cantos'), tr('Ollie turns the cards one at a time and calls each picture out loud. When a called picture is on your board, a bean covers it for you.', 'Ollie voltea las cartas una por una y canta cada dibujo en voz alta. Cuando un dibujo cantado está en tu tabla, un frijol lo cubre solo.')],
  [tr('Two pots', 'Dos botes'), tr('Every board at the table puts the ANTE into each pot. The first to cover a whole LINE (across, down or corner to corner) wins the Line pot. The first to cover a whole board wins the Full board pot, and the game ends.', 'Cada tabla de la mesa pone la APUESTA en cada bote. El primero en cubrir una LÍNEA completa (horizontal, vertical o de esquina a esquina) gana el bote de Línea. El primero en llenar una tabla entera gana el bote de Tabla llena, y se acaba el juego.')],
  [tr('Ties', 'Empates'), tr('If two players finish on the same card, they split the pot.', 'Si dos jugadores terminan con la misma carta, se reparten el bote.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Play two boards with a small ante and listen to Ollie. Turn on fast speed once you know the pictures.', 'Juega dos tablas con una apuesta pequeña y escucha a Ollie. Pon la velocidad rápida cuando ya conozcas los dibujos.')],
]);

export const picturesScreen: Screen = root => {
  const rng: Rng = makeRng();
  let alive = true, running = false, unpaid = 0, fast = false;
  let count = 2, opponents = 3;
  let mine: number[][] = [newBoard(rng), newBoard(rng)];
  let seats: number[][][] = [mine];
  let called = new Set<number>();
  const won: Record<PicPot, number[]> = { line: [], full: [] };
  const who = (i: number) => (i === 0 ? tr('You', 'Tú') : BOTS[i - 1].name);
  const face = (i: number) => (i === 0 ? 'chars/ollie.webp' : BOTS[i - 1].pic);

  const dealer = img(olliePath('deal'), 'pb-dealer dealer', 'Ollie');
  const flip = h('div.pic-flip');
  const callText = h('div.pb-calltext', {}, tr('Get your boards ready', 'Prepara tus tablas'));
  const countEl = h('div.pb-count');
  const potsEl = h('div.pb-pots.two');
  const botsEl = h('div.pb-bots');
  const boardsBox = h('div.pic-boards');
  const recent = h('div.pic-recent');
  const result = h('div.result', {}, tr('Pick your boards, then tap PLAY', 'Elige tus tablas y toca JUGAR'));
  const ante = betStepper(ANTES, 5, tr('Ante', 'Apuesta'), () => renderCost());
  const costEl = h('div.pb-cost');
  const playBtn = h('button.btn.primary.wide', { onclick: () => void play() }, tr('PLAY', 'JUGAR'));
  const speedLabel = () => (fast ? tr('Speed: fast', 'Velocidad: rápida') : tr('Speed: normal', 'Velocidad: normal'));
  const speedBtn = h('button.btn.small', { onclick: () => { fast = !fast; speedBtn.textContent = speedLabel(); } }, speedLabel());
  const countSeg = h('div.seg');
  const oppSeg = h('div.seg');
  const shuffleBtn = h('button.btn.small', { onclick: () => { if (running) return; sfx('card'); mine = mine.map(() => newBoard(rng)); seats = [mine]; called = new Set(); renderBoards(); } }, tr('NEW BOARDS', 'TABLAS NUEVAS'));
  const setup = h('div.pb-setup', {},
    h('div.pb-opp', {}, h('span', {}, tr('Boards', 'Tablas')), countSeg),
    h('div.pb-opp', {}, h('span', {}, tr('Players', 'Jugadores')), oppSeg),
    h('div.controls', {}, shuffleBtn, ante.el), costEl);

  const renderCost = () => { costEl.textContent = tr(`${count} board${count > 1 ? 's' : ''} × 2 pots × ${fmt(ante.get())} = ${fmt(ante.get() * 2 * count)}`, `${count} tabla${count > 1 ? 's' : ''} × 2 botes × ${fmt(ante.get())} = ${fmt(ante.get() * 2 * count)}`); };

  function renderSegs() {
    countSeg.replaceChildren(...[1, 2, 3, 4].map(n => h('button.seg-btn' + (count === n ? '.on' : ''), {
      disabled: running, onclick: () => {
        count = n; sfx('click');
        while (mine.length < n) mine.push(newBoard(rng));
        mine = mine.slice(0, n); seats = [mine]; called = new Set();
        renderSegs(); renderBoards(); renderCost();
      },
    }, String(n))));
    oppSeg.replaceChildren(...[1, 2, 3].map(n => h('button.seg-btn' + (opponents === n ? '.on' : ''), {
      disabled: running, onclick: () => { opponents = n; sfx('click'); renderSegs(); renderBots(); },
    }, h('span.pb-opp-faces', {}, ...BOTS.slice(0, n).map(b => img(b.pic, 'pb-opp-face', b.name))))));
  }

  function renderPots(size = 0) {
    potsEl.replaceChildren(...(['line', 'full'] as PicPot[]).map(p => h('div.pb-pot' + (won[p].length ? '.won' : ''), { 'data-pot': p },
      h('div.pb-pot-name', {}, potName(p)),
      h('div.pb-pot-amt', {}, size ? fmt(size) : '—'),
      won[p].length ? h('div.pb-pot-who', {}, ...won[p].map(i => img(face(i), 'pb-pot-face', who(i)))) : null)));
  }

  function renderBots() {
    const n = running ? seats.length - 1 : opponents;
    botsEl.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const b = BOTS[k], s = seats[k + 1];
      const best = s ? Math.max(...s.map(x => picState(x, called).covered)) : 0;
      return h('div.pb-bot', { style: `--ring:${b.color}` },
        img(b.pic, 'pb-bot-img', b.name),
        h('div.pb-bot-name', {}, b.name),
        h('div.pb-bot-boards', {}, s ? tr(`${s.length} board${s.length > 1 ? 's' : ''}`, `${s.length} tabla${s.length > 1 ? 's' : ''}`) : ''),
        h('div.pb-bot-meter.wide', {}, ...Array.from({ length: 8 }, (_, i) => h('i' + (i * 2 < best ? '.on' : '')))));
    }));
  }

  function renderBoards(just?: number, line?: { board: number; cells: number[] }) {
    boardsBox.dataset.n = String(mine.length);
    boardsBox.replaceChildren(...mine.map((b, bi) => h('div.pic-board', {},
      h('div.pic-grid', {}, ...b.map((p, i) => {
        const el = h('div.pic-cell' + (called.has(p) ? '.on' : '') + (line?.board === bi && line.cells.includes(i) ? '.line' : ''), {}, picImg(p), h('span.pic-label', {}, picShort(p)));
        if (p === just) el.classList.add('daub');
        return el;
      })))));
  }

  const pose = (p: 'deal' | 'cheer' | 'shrug' | 'wave') => { dealer.src = img(olliePath(p)).src; };

  async function play() {
    if (running) return;
    const a = ante.get(), cost = a * 2 * mine.length;
    if (cantAfford(cost)) return;
    addChips(-cost);
    running = true; playBtn.disabled = true; ante.setEnabled(false); shuffleBtn.disabled = true;
    seats = [mine, ...Array.from({ length: opponents }, () => Array.from({ length: 1 + Math.floor(rng() * 2) }, () => newBoard(rng)))];
    const round = playPictures(rng, seats);
    const pay = picPayouts(round, seats, a);
    unpaid = pay[0];
    const size = a * seats.reduce((s, x) => s + x.length, 0);
    won.line = []; won.full = [];
    called = new Set();
    recent.replaceChildren();
    setup.hidden = true;
    renderSegs(); renderPots(size); renderBots(); renderBoards();
    pose('deal');
    resultBanner(result, tr('Ollie is shuffling the cards…', 'Ollie está barajando las cartas…'), 'info');
    sfx('card'); await sleep(900);
    resultBanner(result, tr('Listen to Ollie…', 'Escucha a Ollie…'), 'info');
    for (let i = 0; i < round.calls.length; i++) {
      if (!alive) return;
      const { pic, won: w } = round.calls[i];
      called.add(pic);
      flip.replaceChildren(h('div.pic-card.turn', {}, picImg(pic), h('span.pic-card-name', {}, picName(pic))));
      callText.textContent = picName(pic);
      countEl.textContent = tr(`Card ${i + 1} of ${PIC_COUNT}`, `Carta ${i + 1} de ${PIC_COUNT}`);
      sfx('card');
      if (!fast) sayPic(PICS[pic][0]);
      await sleep(fast ? 300 : 900);
      if (!alive) return;
      const hasIt = mine.some(b => b.includes(pic));
      if (hasIt) sfx('daub');
      recent.prepend(h('div.pic-chip', {}, picImg(pic, 'pic-chip-img')));
      while (recent.children.length > 8) recent.lastElementChild!.remove();
      let line: { board: number; cells: number[] } | undefined;
      const lb = mine.findIndex(b => picState(b, called).line);
      if (lb >= 0) line = { board: lb, cells: picState(mine[lb], called).line! };
      renderBoards(pic, line); renderBots();
      for (const p of (['line', 'full'] as const).filter(p => w[p])) {
        won[p] = w[p]!;
        renderPots(size);
        const iWon = w[p]!.includes(0);
        resultBanner(result, `${potName(p)}: ${w[p]!.map(who).join(' + ')}`, iWon ? 'win' : 'info');
        pose(iWon ? 'cheer' : 'wave');
        if (iWon) { sfx('win'); coinBurst(potsEl.querySelector(`[data-pot="${p}"]`) as HTMLElement, 14); buzz(); }
        await sleep(fast ? 900 : 1800);
        if (!alive) return;
        pose('deal');
      }
      await sleep(fast ? 250 : 900);
    }
    if (!alive) return;
    unpaid = 0;
    if (pay[0]) addChips(pay[0]);
    countPlay('pictures', pay[0] > cost);
    if (pay[0] > cost) {
      resultBanner(result, tr(`You won ${fmt(pay[0])}!`, `¡Ganaste ${fmt(pay[0])}!`), 'win');
      pose('cheer'); sfx(pay[0] >= cost * 3 ? 'bigwin' : 'win'); coinBurst(boardsBox, 24); buzz(true);
    } else if (pay[0]) {
      resultBanner(result, tr(`You got back ${fmt(pay[0])} of ${fmt(cost)}`, `Recuperaste ${fmt(pay[0])} de ${fmt(cost)}`), 'push');
      sfx('chip');
    } else {
      resultBanner(result, tr('No luck this time. Try again!', 'Esta vez no hubo suerte. ¡Otra vez!'), 'lose');
      pose('shrug'); sfx('lose');
    }
    running = false; playBtn.disabled = false; ante.setEnabled(true); shuffleBtn.disabled = false;
    playBtn.textContent = tr('PLAY AGAIN', 'JUGAR OTRA');
    setup.hidden = false;
    renderSegs();
  }

  root.classList.add('pictures');
  root.append(topBar(tr('Picture Bingo', 'Lotería Laguna')),
    h('div.pb-table', {},
      h('div.pb-dealer-row', {}, dealer, h('div.pic-deck', {}, flip), h('div.pb-callbox', {}, countEl, callText)),
      recent, potsEl, botsEl),
    boardsBox, result, setup,
    h('div.controls', {}, h('button.btn.small', { onclick: picturesHowTo }, tr('How to play', 'Cómo jugar')), speedBtn, playBtn));
  renderSegs(); renderCost(); renderPots(); renderBots(); renderBoards();
  return () => { alive = false; if (unpaid) addChips(unpaid); };
};
