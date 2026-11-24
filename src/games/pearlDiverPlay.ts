import { sfx } from '../audio';
import { botBanks, diveBank, diveRoll, newDive, PEARL_GOAL, rollDie, type Dive } from '../core/dice';
import { makeRng } from '../core/rng';
import { tr } from '../i18n';
import { img } from '../ui/assets';
import { h, sleep } from '../ui/dom';
import type { Screen } from '../ui/router';
import { topBar } from '../ui/shell';
import { howToPlay } from './howto';
import { dieEl, finish, playersSeg, say, SEAT_COLORS, seatFace, seatName } from './tableKit';

export const pearlHowTo = () => howToPlay(tr('How to play Pearl Diver', 'Cómo jugar al Buzo de Perlas'), [
  [tr('The idea', 'La idea'), tr(`Dive for pearls with one die. The first player to bank ${PEARL_GOAL} pearls wins.`, `Bucea por perlas con un dado. Gana el primero en guardar ${PEARL_GOAL} perlas.`)],
  [tr('Diving', 'Bucear'), tr('Tap DIVE to roll the die. A 2 to 6 adds that many pearls to this dive, and you may dive again.', 'Toca BUCEAR para tirar el dado. Un 2 a 6 suma esas perlas a esta inmersión, y puedes volver a bucear.')],
  [tr('Careful!', '¡Cuidado!'), tr('Roll a 1 and a crab scares you off: you lose every pearl from this dive and your turn ends.', 'Si sale un 1, un cangrejo te asusta: pierdes todas las perlas de esta inmersión y se acaba tu turno.')],
  [tr('Banking', 'Guardar'), tr('Tap BANK to keep this dive\'s pearls safe. Banked pearls can never be lost. Then the next diver plays.', 'Toca GUARDAR para poner a salvo las perlas de esta inmersión. Las perlas guardadas nunca se pierden. Luego juega el siguiente buzo.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Banking at about 20 pearls is a good habit. Take more risks only when you are far behind.', 'Guardar cuando tienes unas 20 perlas es buena costumbre. Arriesga más solo cuando vas muy atrás.')],
]);

let players = 2;

export const pearlDiverScreen: Screen = root => {
  root.classList.add('pearldiver');
  const rng = makeRng();
  let alive = true, busy = false;
  let g: Dive = newDive(players);
  const status = h('div.result');
  const lanes = h('div.pd-lanes');
  const dieBox = h('div.pd-die');
  const diveEl = h('div.pd-dive');
  const diveBtn = h('button.btn.primary', { onclick: () => void myRoll() }, tr('DIVE', 'BUCEAR'));
  const bankBtn = h('button.btn', { onclick: () => void myBank() }, tr('BANK', 'GUARDAR'));

  function render(v?: number) {
    lanes.replaceChildren(...g.banked.map((b, p) => {
      const pct = Math.min(100, (b / PEARL_GOAL) * 100), dive = p === g.turn ? Math.min(100 - pct, (g.dive / PEARL_GOAL) * 100) : 0;
      return h('div.pd-lane' + (p === g.turn && g.winner === null ? '.turn' : ''), {}, seatFace(p),
        h('div.pd-track', {}, h('div.pd-fill', { style: `width:${pct}%;background:${SEAT_COLORS[p]}` }), h('div.pd-risk', { style: `left:${pct}%;width:${dive}%` })),
        h('b.pd-num', {}, `${b}`));
    }));
    if (v) dieBox.replaceChildren(dieEl(v, v === 1 ? '.bad' : ''));
    diveEl.replaceChildren(img('pics/pearl.webp', 'pd-pearl'), h('span', {}, tr(`This dive: ${g.dive}`, `Esta inmersión: ${g.dive}`)));
    const mine = g.turn === 0 && !busy && g.winner === null;
    diveBtn.disabled = !mine; bankBtn.disabled = !mine || g.dive === 0;
  }

  async function myRoll() {
    if (busy || g.turn !== 0) return;
    busy = true;
    const v = await throwDie();
    const r = diveRoll(g, v);
    busy = false;
    if (r === 'lost') {
      sfx('lose'); say(status, tr('A 1! The crab scared you off: dive lost', '¡Un 1! El cangrejo te asustó: inmersión perdida'), 'lose');
      render(v); await sleep(900); await bots(); return;
    }
    sfx('pearl'); say(status, tr(`+${v} pearls. Dive again or bank?`, `+${v} perlas. ¿Bucear otra vez o guardar?`));
    if (g.banked[0] + g.dive >= PEARL_GOAL) say(status, tr('Bank now to win!', '¡Guarda ahora para ganar!'), 'win');
    render(v);
  }

  async function myBank() {
    if (busy || g.turn !== 0 || !g.dive) return;
    const n = g.dive;
    diveBank(g); sfx('chip');
    say(status, tr(`Banked ${n} pearls`, `Guardaste ${n} perlas`));
    render();
    if (ended()) return;
    await sleep(600);
    await bots();
  }

  async function throwDie(): Promise<number> {
    let v = 1;
    sfx('dice');
    for (let k = 0; k < 7; k++) { v = rollDie(rng); dieBox.replaceChildren(dieEl(v)); await sleep(55); }
    return v;
  }

  async function bots() {
    busy = true;
    while (alive && g.turn !== 0 && g.winner === null) {
      const p = g.turn, who = seatName(p);
      say(status, tr(`${who} is diving…`, `${who} está buceando…`));
      render();
      await sleep(500);
      for (;;) {
        if (!alive) return;
        const v = await throwDie();
        const r = diveRoll(g, v);
        render(v);
        if (r === 'lost') { sfx('lose'); say(status, tr(`${who} rolled a 1 and lost the dive`, `${who} sacó un 1 y perdió la inmersión`)); await sleep(900); break; }
        sfx('pearl');
        await sleep(450);
        if (botBanks(g)) { const n = g.dive; diveBank(g); sfx('chip'); say(status, tr(`${who} banked ${n}`, `${who} guardó ${n}`)); render(); await sleep(800); break; }
      }
      if (!alive || ended()) return;
    }
    busy = false;
    if (!alive) return;
    say(status, tr('Your turn: DIVE', 'Tu turno: BUCEA'));
    render();
  }

  function ended(): boolean {
    if (g.winner === null) return false;
    busy = true; render();
    const won = g.winner === 0, prize = 40 * g.banked.length;
    finish({ key: 'pearldiver', status, burstFrom: lanes, won, prize, alive: () => alive, again: reset,
      text: won ? tr(`${PEARL_GOAL} pearls! +${prize} chips`, `¡${PEARL_GOAL} perlas! +${prize} fichas`) : tr(`${seatName(g.winner)} reached ${PEARL_GOAL} first`, `${seatName(g.winner)} llegó a ${PEARL_GOAL} primero`) });
    return true;
  }

  function reset() {
    g = newDive(players); busy = false;
    dieBox.replaceChildren(dieEl(6));
    render();
    say(status, tr('Your turn: DIVE', 'Tu turno: BUCEA'));
  }

  const pSeg = playersSeg([2, 3, 4], () => players, n => { players = n; reset(); });
  root.append(topBar(tr('Pearl Diver', 'Buzo de Perlas')), lanes, h('div.pd-sea', {}, dieBox, diveEl), status,
    h('div.controls', {}, diveBtn, bankBtn),
    h('div.controls.ck-levels', {}, pSeg.el),
    h('div.controls', {}, h('button.btn.small', { onclick: () => { if (!busy) reset(); } }, tr('New game', 'Nueva partida')), h('button.btn.small', { onclick: pearlHowTo }, tr('How to play', 'Cómo jugar'))),
    h('p.muted.small.center', {}, tr('Win: 40 chips for each diver', 'Premio: 40 fichas por cada buzo')));
  reset();
  return () => { alive = false; };
};
