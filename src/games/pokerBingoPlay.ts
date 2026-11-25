import { sfx } from '../audio';
import { isRed, rankLabel, SUIT_GLYPH, type Card } from '../core/cards';
import { CATEGORY_EN, CATEGORY_ES, categoryOf, score5 } from '../core/holdem';
import { BOARD_COUNT, BOARDS, boardState, botBoards, CENTER, CORNERS, cardKey, MAX_BOARDS, payouts, playRound, potSize, SET_SIZE, type Pot, type Seat } from '../core/pokerBingo';
import { makeRng } from '../core/rng';
import { lang, tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile, save } from '../save';
import { cardSvg } from '../ui/art';
import { img, olliePath, sayCard, sayPot } from '../ui/assets';
import { BOTS } from '../ui/colorsArt';
import { coinBurst, fmt, h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { betStepper, cantAfford, resultBanner } from './kit';

const ANTES = [1, 5, 10, 25, 50, 100];
const handName = (c: number) => (lang() === 'es' ? CATEGORY_ES[c] : CATEGORY_EN[c]);
const RANK_EN = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const RANK_ES = ['', '', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Jota', 'Reina', 'Rey', 'As'];
const SUIT_EN: Record<string, string> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
const SUIT_ES: Record<string, string> = { C: 'tréboles', D: 'diamantes', H: 'corazones', S: 'picas' };
const cardName = (c: Card) => (lang() === 'es' ? `${RANK_ES[c.rank]} de ${SUIT_ES[c.suit]}` : `${RANK_EN[c.rank]} of ${SUIT_EN[c.suit]}`);
const potName = (p: Pot) => ({
  center: tr('Center', 'Centro'), corners: tr('Four corners', 'Cuatro esquinas'), five: tr('Five in a row', 'Cinco en línea'), poker: tr('Poker hand', 'Mano de póquer'),
})[p];

export const pokerBingoHowTo = () => howToPlay(tr('How to play Poker Bingo', 'Cómo jugar al Bingo Póquer'), [
  [tr('The idea', 'La idea'), tr('Bingo with playing cards, at a table with Ollie as the dealer and up to three other players. Each board has 25 cards in a 5 × 5 grid. Ollie turns cards from a shuffled deck and calls them out, and every called card on a board gets covered with a chip.', 'Bingo con cartas de póquer, en una mesa con Ollie como crupier y hasta tres jugadores más. Cada tablero tiene 25 cartas en una cuadrícula de 5 × 5. Ollie voltea cartas de una baraja mezclada y las canta, y cada carta cantada que está en un tablero se cubre con una ficha.')],
  [tr('The boards', 'Los tableros'), tr(`There are ${BOARD_COUNT} numbered boards in two sets of ${SET_SIZE}, and they never change. Pick up to ${MAX_BOARDS}: tap a number to add it or take it out. Your favourites are remembered. The other players take boards nobody is using.`, `Hay ${BOARD_COUNT} tableros numerados en dos juegos de ${SET_SIZE}, y nunca cambian. Elige hasta ${MAX_BOARDS}: toca un número para ponerlo o quitarlo. Tus favoritos se recuerdan. Los demás jugadores toman tableros que nadie usa.`)],
  [tr('The four pots', 'Los cuatro botes'), tr('Before the cards are turned, every board at the table puts the ANTE into each of the four pots: Center, Four corners, Five in a row and Poker hand. More boards cost more, and give you more chances.', 'Antes de voltear las cartas, cada tablero de la mesa pone la APUESTA en cada uno de los cuatro botes: Centro, Cuatro esquinas, Cinco en línea y Mano de póquer. Más tableros cuestan más, y dan más oportunidades.')],
  [tr('Center', 'Centro'), tr('The first player to cover the middle card of a board wins the Center pot.', 'El primero en cubrir la carta del medio de un tablero gana el bote del Centro.')],
  [tr('Four corners', 'Cuatro esquinas'), tr('The first player to cover all four corner cards of one board wins the Corners pot.', 'El primero en cubrir las cuatro esquinas de un mismo tablero gana el bote de Esquinas.')],
  [tr('Five in a row', 'Cinco en línea'), tr('The first player to cover five in a row, across, down or corner to corner, wins this pot and the calling stops.', 'El primero en cubrir cinco en línea, horizontal, vertical o de esquina a esquina, gana este bote y se dejan de cantar cartas.')],
  [tr('Poker hand', 'Mano de póquer'), tr('Then Ollie deals every player five cards from a fresh deck. The best poker hand wins the Poker pot. A pot nobody won (center or corners) is added to the Poker pot.', 'Luego Ollie reparte cinco cartas a cada jugador de otra baraja. La mejor mano de póquer gana el bote de Póquer. Un bote que nadie ganó (centro o esquinas) se suma al bote de Póquer.')],
  [tr('Ties', 'Empates'), tr('If two players win a pot on the same card, or have equal poker hands, they split it.', 'Si dos jugadores ganan un bote con la misma carta, o tienen manos de póquer iguales, se lo reparten.')],
  [tr('Poker hands, best to worst', 'Manos de póquer, de mejor a peor'), tr('Straight flush · four of a kind · full house (3 + 2) · flush (same suit) · straight (in a row) · three of a kind · two pair · pair · high card.', 'Escalera de color · póker (4 iguales) · full (3 + 2) · color (mismo palo) · escalera (seguidas) · trío · doble pareja · pareja · carta alta.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Start with one or two boards and a small ante, and just listen to Ollie call the cards. Covering is automatic.', 'Empieza con uno o dos tableros y una apuesta pequeña, y escucha a Ollie cantar las cartas. Las fichas se ponen solas.')],
]);

const mini = (c: Card) => h('span.pb-face' + (isRed(c) ? '.red' : ''), {}, rankLabel(c.rank), h('small', {}, SUIT_GLYPH[c.suit]));

export const pokerBingoScreen: Screen = root => {
  const rng = makeRng();
  const pb = profile.pokerBingo;
  let alive = true, running = false, unpaid = 0;
  let picked = [...pb.boards];
  let called = new Set<string>();
  let seats: Seat[] = [{ boards: picked }];
  let fast = false;
  const won: Record<Pot, number[]> = { center: [], corners: [], five: [], poker: [] };
  const who = (i: number) => (i === 0 ? tr('You', 'Tú') : BOTS[i - 1].name);
  const pic = (i: number) => (i === 0 ? 'chars/ollie.webp' : BOTS[i - 1].pic);

  // Dealer area: Ollie, the deck and the card just turned.
  const dealer = img(olliePath('deal'), 'pb-dealer dealer', 'Ollie');
  const flip = h('div.pb-flip', {}, h('div.pb-flip-in', { html: cardSvg(null, true) }));
  const callText = h('div.pb-calltext', {}, tr('Pick your boards', 'Elige tus tableros'));
  const countEl = h('div.pb-count');
  const potsEl = h('div.pb-pots');
  const botsEl = h('div.pb-bots');
  const handsEl = h('div.pb-hands');
  const boardsBox = h('div.pb-boards');
  const result = h('div.result', {}, tr('Pick up to 4 boards, then tap PLAY', 'Elige hasta 4 tableros y toca JUGAR'));
  const ante = betStepper(ANTES, pb.ante, tr('Ante', 'Apuesta'), v => { pb.ante = v; save(); renderCost(); });
  const costEl = h('div.pb-cost');
  const playBtn = h('button.btn.primary.wide', { onclick: () => void play() }, tr('PLAY', 'JUGAR'));
  const speedBtn = h('button.btn.small', { onclick: () => { fast = !fast; speedBtn.textContent = speedLabel(); } });
  const speedLabel = () => (fast ? tr('Speed: fast', 'Velocidad: rápida') : tr('Speed: normal', 'Velocidad: normal'));
  speedBtn.textContent = speedLabel();
  const oppSeg = h('div.seg');
  const picker = h('div.pb-picker');
  const browseBtn = h('button.btn.small.pb-browse', { onclick: () => browse() }, tr('See every board', 'Ver todos los tableros'));
  const setup = h('div.pb-setup', {}, picker, browseBtn, h('div.pb-opp', {}, h('span', {}, tr('Players', 'Jugadores')), oppSeg), h('div.controls', {}, ante.el), costEl);

  function renderCost() {
    const per = ante.get() * 4 * picked.length;
    costEl.textContent = tr(`${picked.length} board${picked.length > 1 ? 's' : ''} × 4 pots × ${fmt(ante.get())} = ${fmt(per)}`, `${picked.length} tablero${picked.length > 1 ? 's' : ''} × 4 botes × ${fmt(ante.get())} = ${fmt(per)}`);
  }

  function renderOpp() {
    oppSeg.replaceChildren(...[1, 2, 3].map(n => h('button.seg-btn' + (pb.opponents === n ? '.on' : ''), {
      disabled: running, onclick: () => { pb.opponents = n; save(); sfx('click'); renderOpp(); renderBots(); },
    }, h('span.pb-opp-faces', {}, ...BOTS.slice(0, n).map(b => img(b.pic, 'pb-opp-face', b.name))))));
  }

  function renderPicker() {
    const set = (k: number) => h('div.pb-set', {},
      h('span.pb-pick-label', {}, tr(`Set ${k + 1}`, `Juego ${k + 1}`)),
      ...Array.from({ length: SET_SIZE }, (_, i) => {
        const n = k * SET_SIZE + i + 1, on = picked.includes(n);
        return h('button.pb-pick' + (on ? '.on' : ''), { disabled: running, 'aria-pressed': String(on), onclick: () => toggleBoard(n) }, String(n));
      }));
    picker.replaceChildren(set(0), set(1));
  }

  /** Every board with its 25 cards, so the player can pick by what is on it. Tap a board to add it or take it out. */
  function browse() {
    if (running) return;
    const note = h('p.muted.small.center');
    const grid = h('div.pb-gallery');
    const draw = () => {
      note.textContent = tr(`${picked.length} of ${MAX_BOARDS} picked · tap a board to add it or take it out`, `${picked.length} de ${MAX_BOARDS} elegidos · toca un tablero para ponerlo o quitarlo`);
      grid.replaceChildren(...[0, 1].map(k => h('div.pb-gal-set', {},
        h('div.pb-pick-label', {}, tr(`Set ${k + 1}`, `Juego ${k + 1}`)),
        h('div.pb-gal-grid', {}, ...Array.from({ length: SET_SIZE }, (_, i) => {
          const n = k * SET_SIZE + i + 1, on = picked.includes(n);
          return h('button.pb-gal' + (on ? '.on' : ''), { 'aria-pressed': String(on), onclick: () => { toggleBoard(n); draw(); } },
            h('div.pb-gal-num', {}, on ? `#${n} ✓` : `#${n}`),
            h('div.pb-grid', {}, ...BOARDS[n - 1].map((c, j) => h('div.pb-cell' + (j === CENTER ? '.center' : '') + (CORNERS.includes(j) ? '.corner' : ''), {}, mini(c)))));
        })))));
    };
    draw();
    dialog(tr('Pick your boards', 'Elige tus tableros'), h('div', {}, note, grid), [{ label: tr('Done', 'Listo'), primary: true }]);
  }

  function toggleBoard(n: number) {
    if (running) return;
    if (picked.includes(n)) { if (picked.length === 1) return; picked = picked.filter(x => x !== n); }
    else if (picked.length >= MAX_BOARDS) { resultBanner(result, tr('Up to 4 boards: tap one to take it out first', 'Hasta 4 tableros: toca uno para quitarlo primero'), 'info'); return; }
    else picked = [...picked, n].sort((a, b) => a - b);
    pb.boards = picked; save();
    seats = [{ boards: picked }];
    called = new Set();
    sfx('chip');
    renderPicker(); renderCost(); renderBoards(); renderBots();
  }

  function renderPots(size = 0) {
    potsEl.replaceChildren(...(['center', 'corners', 'five', 'poker'] as Pot[]).map(p => {
      const w = won[p];
      return h('div.pb-pot.' + p + (w.length ? '.won' : ''), {},
        h('div.pb-pot-name', {}, potName(p)),
        h('div.pb-pot-amt', {}, size ? fmt(size) : '—'),
        w.length ? h('div.pb-pot-who', {}, ...w.map(i => img(pic(i), 'pb-pot-face', who(i)))) : null);
    }));
  }

  function renderBots() {
    const n = running ? seats.length - 1 : pb.opponents;
    botsEl.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const b = BOTS[k], s = seats[k + 1];
      const best = s ? Math.max(...s.boards.map(x => boardState(BOARDS[x - 1], called).best)) : 0;
      return h('div.pb-bot', { style: `--ring:${b.color}` },
        img(b.pic, 'pb-bot-img', b.name),
        h('div.pb-bot-name', {}, b.name),
        h('div.pb-bot-boards', {}, s ? s.boards.map(x => `#${x}`).join(' ') : ''),
        h('div.pb-bot-meter', {}, ...[0, 1, 2, 3, 4].map(i => h('i' + (i < best ? '.on' : '')))));
    }));
  }

  function renderBoards(just?: string, fiveLine?: { board: number; line: number[] }) {
    boardsBox.dataset.n = String(picked.length);
    boardsBox.replaceChildren(...picked.map(n => h('div.pb-board', {},
      h('div.pb-num', {}, `#${n}`),
      h('div.pb-grid', {}, ...BOARDS[n - 1].map((c, i) => {
        const k = cardKey(c);
        const line = fiveLine && fiveLine.board === n && fiveLine.line.includes(i);
        const el = h('div.pb-cell' + (called.has(k) ? '.on' : '') + (i === CENTER ? '.center' : '') + (CORNERS.includes(i) ? '.corner' : '') + (line ? '.line' : ''), {}, mini(c));
        if (k === just) el.classList.add('daub');
        return el;
      })))));
  }

  function poseDealer(p: 'deal' | 'cheer' | 'shrug' | 'wave') { dealer.src = img(olliePath(p)).src; }

  async function play() {
    if (running) return;
    const a = ante.get();
    const cost = a * 4 * picked.length;
    if (cantAfford(cost)) return;
    addChips(-cost);
    running = true; playBtn.disabled = true; ante.setEnabled(false);
    seats = [{ boards: picked }, ...botBoards(rng, picked, pb.opponents).map(boards => ({ boards }))];
    const round = playRound(rng, seats);
    const pay = payouts(round, seats, a);
    unpaid = pay[0];
    const size = potSize(seats, a);
    (Object.keys(won) as Pot[]).forEach(p => { won[p] = []; });
    called = new Set();
    handsEl.replaceChildren(); handsEl.hidden = true;
    setup.hidden = true;
    renderOpp(); renderPicker(); renderPots(size); renderBots(); renderBoards();
    poseDealer('deal');
    resultBanner(result, tr('Ollie is shuffling…', 'Ollie está mezclando…'), 'info');
    sfx('card'); await sleep(900);
    for (let i = 0; i < round.calls.length; i++) {
      if (!alive) return;
      const { card, won: w } = round.calls[i], k = cardKey(card);
      called.add(k);
      const inner = flip.firstElementChild as HTMLElement;
      inner.innerHTML = cardSvg(card);
      flip.classList.remove('turn'); void flip.offsetWidth; flip.classList.add('turn');
      callText.textContent = cardName(card);
      countEl.textContent = tr(`Card ${i + 1}`, `Carta ${i + 1}`);
      sfx('card');
      if (!fast) sayCard(card.rank, card.suit);
      const mine = picked.some(n => BOARDS[n - 1].some(c => cardKey(c) === k));
      const pots = (['center', 'corners', 'five'] as const).filter(p => w[p]);
      let fiveLine: { board: number; line: number[] } | undefined;
      if (w.five?.includes(0)) {
        const n = picked.find(x => boardState(BOARDS[x - 1], called).five)!;
        fiveLine = { board: n, line: boardState(BOARDS[n - 1], called).five! };
      }
      await sleep(fast ? 250 : 650);
      if (!alive) return;
      if (mine) sfx('daub');
      renderBoards(k, fiveLine); renderBots();
      for (const p of pots) {
        won[p] = w[p]!;
        renderPots(size);
        const iWon = w[p]!.includes(0);
        resultBanner(result, `${potName(p)}: ${w[p]!.map(who).join(' + ')}`, iWon ? 'win' : 'info');
        poseDealer(iWon ? 'cheer' : 'wave');
        if (iWon) { sfx('win'); coinBurst(potsEl.querySelector('.pb-pot.' + p) as HTMLElement, 14); buzz(); }
        await sleep(fast ? 300 : 500);
        sayPot(p);
        await sleep(fast ? 700 : 1300);
        if (!alive) return;
        poseDealer('deal');
      }
      await sleep(fast ? 250 : 750);
    }
    if (!alive) return;
    // The poker hands, from a fresh deck.
    sayPot('poker');
    resultBanner(result, tr('Poker hands!', '¡Manos de póquer!'), 'info');
    handsEl.hidden = false;
    handsEl.replaceChildren();
    for (let s = 0; s < seats.length; s++) {
      const hand = round.hands[s];
      const row = h('div.pb-hand' + (round.winners.poker.includes(s) ? '.best' : ''), {},
        img(pic(s), 'pb-hand-face', who(s)), h('div.pb-hand-name', {}, who(s)),
        h('div.pb-hand-cards', {}, ...hand.map(c => h('div.pb-hand-card.deal-in', { html: cardSvg(c) }))),
        h('div.pb-hand-cat', {}, handName(categoryOf(score5(hand)))));
      row.classList.remove('best');
      handsEl.append(row);
      sfx('card');
      await sleep(fast ? 250 : 600);
      if (!alive) return;
    }
    await sleep(500);
    round.winners.poker.forEach(s => handsEl.children[s].classList.add('best'));
    won.poker = round.winners.poker;
    renderPots(size);
    // Pay out.
    unpaid = 0;
    if (pay[0]) addChips(pay[0]);
    countPlay('pokerbingo', pay[0] > cost);
    const lostPots = (['center', 'corners'] as const).filter(p => !round.winners[p].length);
    const extra = lostPots.length ? tr(` (${lostPots.map(potName).join(' and ')} went to the poker pot)`, ` (${lostPots.map(potName).join(' y ')} pasó al bote de póquer)`) : '';
    if (pay[0] > cost) {
      resultBanner(result, tr(`You won ${fmt(pay[0])}!`, `¡Ganaste ${fmt(pay[0])}!`) + extra, 'win');
      poseDealer('cheer'); sfx(pay[0] >= cost * 4 ? 'bigwin' : 'win'); coinBurst(boardsBox, 24); buzz(true);
    } else if (pay[0]) {
      resultBanner(result, tr(`You got back ${fmt(pay[0])} of ${fmt(cost)}`, `Recuperaste ${fmt(pay[0])} de ${fmt(cost)}`) + extra, 'push');
      sfx('chip');
    } else {
      resultBanner(result, tr(`${round.winners.poker.map(who).join(' + ')} took the poker pot. Next game!`, `${round.winners.poker.map(who).join(' + ')} se llevó el bote de póquer. ¡Otra partida!`), 'lose');
      poseDealer('shrug'); sfx('lose');
    }
    running = false; playBtn.disabled = false; ante.setEnabled(true);
    playBtn.textContent = tr('PLAY AGAIN', 'JUGAR OTRA');
    setup.hidden = false;
    renderOpp(); renderPicker();
  }

  root.classList.add('pokerbingo');
  root.append(topBar(tr('Poker Bingo', 'Bingo Póquer')),
    h('div.pb-table', {},
      h('div.pb-dealer-row', {}, dealer, h('div.pb-deck', {}, h('div.pb-deck-back', { html: cardSvg(null, true) }), flip), h('div.pb-callbox', {}, countEl, callText)),
      potsEl, botsEl),
    handsEl, boardsBox, result,
    setup,
    h('div.controls', {}, h('button.btn.small', { onclick: pokerBingoHowTo }, tr('How to play', 'Cómo jugar')), speedBtn, playBtn));
  handsEl.hidden = true;
  renderOpp(); renderPicker(); renderCost(); renderPots(); renderBots(); renderBoards();
  return () => { alive = false; if (unpaid) addChips(unpaid); };
};
