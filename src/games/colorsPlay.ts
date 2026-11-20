import { sfx } from '../audio';
import {
  botChoice, botJumpIn, canJumpIn, canPlay, COLORS, drawTurn, isWild, newGame, pass, play, roundPoints, top,
  type CColor, type GameState, type Rules,
} from '../core/colors';
import { makeRng } from '../core/rng';
import { buzz } from '../platform';
import { addChips, countPlay, profile, save } from '../save';
import { BOTS, CC_HEX, ccCardSvg } from '../ui/colorsArt';
import { coinBurst, fmt, h, toast } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { lang, tr } from '../i18n';
import { howToPlay } from './howto';

const RULE_TEXT = (): Record<keyof Rules, [string, string]> => ({
  stacking: [tr('Stacking', 'Acumular'), tr('Answer a +2 with a +2 (or a Rainbow +4) and pass the pile on.', 'Responde a un +2 con otro +2 (o un Arcoíris +4) y pasa el castigo al siguiente.')],
  sevenZero: [tr('Seven-Zero', 'Siete-Cero'), tr('Play a 7 to swap hands with someone. Play a 0 and every hand moves to the next player.', 'Juega un 7 para cambiar tu mano con alguien. Juega un 0 y todas las manos pasan al siguiente jugador.')],
  jumpIn: [tr('Jump-in', 'Colarse'), tr('Have the exact same card as the top one? Play it even when it isn\'t your turn.', '¿Tienes exactamente la misma carta que la de arriba? Juégala aunque no sea tu turno.')],
  drawUntilMatch: [tr('Draw until match', 'Robar hasta poder'), tr('When you draw, keep drawing until you get a card you can play.', 'Cuando robes, sigue robando hasta tener una carta que puedas jugar.')],
});
const COLOR_ES: Record<CColor, string> = { coral: 'coral', teal: 'turquesa', gold: 'dorado', violet: 'violeta' };
const colorName = (c: CColor) => tr(c, COLOR_ES[c]);

export const colorsHowTo = (rules?: Rules) => howToPlay(tr('How to play Crazy Colors', 'Cómo jugar a Colores Locos'), [
  [tr('The goal', 'El objetivo'), tr('Be the first to play all the cards in your hand.', 'Sé el primero en jugar todas las cartas de tu mano.')],
  [tr('Your turn', 'Tu turno'), tr('Tap a glowing card that matches the top card by COLOR or by NUMBER/SYMBOL. Cards you can play are lifted and glow.', 'Toca una carta que brille y que coincida con la de arriba por COLOR o por NÚMERO/SÍMBOLO. Las cartas que puedes jugar se levantan y brillan.')],
  [tr('Can\'t play?', '¿No puedes jugar?'), tr('Tap the deck to draw a card. If the new card fits you can play it, or tap KEEP IT to end your turn.', 'Toca el mazo para robar una carta. Si sirve puedes jugarla, o toca QUEDÁRMELA para terminar tu turno.')],
  [tr('Action cards', 'Cartas de acción'), tr('Freeze: the next player loses a turn. Flip: the turn order reverses. +2: the next player draws 2 and loses a turn.', 'Congelar: el siguiente pierde el turno. Girar: cambia el sentido del juego. +2: el siguiente roba 2 y pierde el turno.')],
  [tr('Rainbow cards', 'Cartas Arcoíris'), tr('A Rainbow can be played on anything: you pick the new color. Rainbow +4 also makes the next player draw 4.', 'Un Arcoíris se puede jugar sobre cualquier carta: tú eliges el nuevo color. Arcoíris +4 además hace robar 4 al siguiente.')],
  [tr('Winning', 'Ganar'), tr('When someone has one card left you\'ll see LAST CARD! Empty your hand first and you win chips for the cards left in the other hands (at least 50).', 'Cuando alguien tiene una sola carta verás ¡ÚLTIMA CARTA! Vacía tu mano primero y ganas fichas por las cartas que quedan en las otras manos (mínimo 50).')],
  [tr('House rules', 'Reglas de la casa'), rules ? tr('On now: ', 'Activas: ') + ((Object.keys(RULE_TEXT()) as (keyof Rules)[]).filter(k => rules[k]).map(k => RULE_TEXT()[k][0]).join(', ') || tr('none', 'ninguna')) : tr('Turn extra rules on or off before you deal: stacking, seven-zero, jump-in and draw until match.', 'Activa o desactiva reglas extra antes de repartir: acumular, siete-cero, colarse y robar hasta poder.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Save your Rainbow cards for when you have nothing else, and play your action cards when a rival is close to winning.', 'Guarda tus Arcoíris para cuando no tengas otra opción, y usa las cartas de acción cuando un rival esté cerca de ganar.')],
]);

export const colorsScreen: Screen = root => {
  root.classList.add('colors');
  let cleanup: (() => void) | undefined;
  const setup = () => {
    cleanup?.();
    root.replaceChildren(topBar(tr('Crazy Colors', 'Colores Locos')));
    const cfg = profile.colors;
    const opp = h('div.seg', {}, ...[1, 2, 3].map(n => h('button.seg-btn' + (cfg.opponents === n ? '.on' : ''), {
      onclick: (e: Event) => {
        cfg.opponents = n; save(); sfx('click');
        opp.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b === e.currentTarget));
      },
    }, `${n}`)));
    const toggles = (Object.keys(RULE_TEXT()) as (keyof Rules)[]).map(k => {
      const input = h<HTMLInputElement>('input', { type: 'checkbox', onchange: () => { cfg.rules[k] = input.checked; save(); sfx('click'); } });
      input.checked = cfg.rules[k];
      return h('label.rule', {}, h('span.rule-text', {}, h('b', {}, RULE_TEXT()[k][0]), h('span', {}, RULE_TEXT()[k][1])), input);
    });
    root.append(h('div.scroll.cc-setup', {},
      h('div.cc-logo', { html: ['coral', 'gold', 'teal', 'violet'].map((c, i) => `<span style="color:${CC_HEX[c as CColor][0]}">${'CRAZY COLORS'.slice(i * 3, i * 3 + 3)}</span>`).join('') }),
      h('p.muted.center', {}, tr('Match the top card by color or symbol. Rainbow cards pick a new color. Empty your hand first to win the round, and you score the cards left in the other hands as chips.', 'Combina la carta de arriba por color o símbolo. Las cartas Arcoíris eligen un color nuevo. Vacía tu mano primero para ganar la ronda y cobra en fichas las cartas que quedan en las otras manos.')),
      h('h3.group-title', {}, tr('Opponents', 'Rivales')), opp,
      h('h3.group-title', {}, tr('House rules', 'Reglas de la casa')), ...toggles,
      h('div.controls', {}, h('button.btn.primary.wide', { onclick: () => { sfx('click'); cleanup = startGame(root, setup, st => { cleanup = st; }); } }, tr('DEAL', 'REPARTIR'))),
      h('div.controls', {}, h('button.btn.small', { onclick: () => colorsHowTo() }, tr('How to play', 'Cómo jugar')))));
  };
  setup();
  return () => cleanup?.();
};

function startGame(root: HTMLElement, backToSetup: () => void, setStop: (stop: () => void) => void): () => void {
  const rng = makeRng();
  const cfg = profile.colors;
  const bots = BOTS.slice(0, cfg.opponents);
  const s: GameState = newGame(rng, ['You', ...bots.map(b => b.name)], { ...cfg.rules });
  let alive = true;
  let busy = false;
  let timer = 0;
  let lastTopId = -1;
  let picking = false;

  const oppRow = h('div.cc-opps');
  const drawPile = h('button.cc-pile', { 'aria-label': tr('Draw a card', 'Robar una carta'), onclick: () => humanDraw() });
  const discardEl = h('div.cc-discard');
  const colorDot = h('div.cc-color');
  const dirEl = h('div.cc-dir');
  const status = h('div.cc-status');
  const handEl = h('div.cc-hand');
  const passBtn = h('button.btn.small', { onclick: () => { pass(s, rng); seen = s.log.length; sfx('click'); render(); schedule(); } }, tr('Keep it', 'Quedármela'));

  const humanTurn = () => s.current === 0 && s.winner === null;

  function render() {
    if (!alive) return;
    oppRow.replaceChildren(...s.players.slice(1).map((p, i) => {
      const seat = i + 1;
      const b = bots[i];
      return h('div.cc-opp' + (s.current === seat && s.winner === null ? '.turn' : ''), {},
        h('div.cc-avatar', { style: `--ring:${b.color}` }, b.face),
        h('div.cc-opp-name', {}, p.name),
        h('div.cc-backs', {}, ...Array.from({ length: Math.min(p.hand.length, 10) }, () => h('span.cc-back'))),
        h('div.cc-count', {}, `${p.hand.length}`),
        p.hand.length === 1 && s.winner === null ? h('div.cc-last', {}, tr('LAST CARD!', '¡ÚLTIMA CARTA!')) : null);
    }));
    const t = top(s);
    const pile = s.discard.slice(-3);
    discardEl.replaceChildren(...pile.map((c, i) => {
      const el = h('div.cc-dcard', { html: ccCardSvg(c, false, i === pile.length - 1 ? s.color : undefined), style: `transform: rotate(${((c.id * 37) % 24) - 12}deg)` });
      if (c === t && c.id !== lastTopId) el.classList.add('cc-land');
      return el;
    }));
    lastTopId = t.id;
    colorDot.style.setProperty('--c', CC_HEX[s.color][1]);
    colorDot.textContent = colorName(s.color).toUpperCase();
    dirEl.textContent = s.dir === 1 ? '↻' : '↺';
    drawPile.innerHTML = ccCardSvg(null, true) + `<span class="cc-pile-n">${s.draw.length}</span>`;
    drawPile.disabled = !humanTurn() || s.drawnPlayable !== null;

    const me = s.players[0].hand;
    // Sort the hand by color then symbol so it reads easily.
    const order = me.map((_, i) => i).sort((a, b) => sortKey(me[a]).localeCompare(sortKey(me[b])));
    handEl.replaceChildren(...order.map(i => {
      const c = me[i];
      const ok = (humanTurn() && canPlay(s, c) && (s.drawnPlayable === null || s.drawnPlayable === i)) || canJumpIn(s, 0, c);
      const el = h('button.cc-hcard' + (ok ? '.ok' : ''), { html: ccCardSvg(c), onclick: () => void humanPlay(i) });
      if (s.drawnPlayable === i && humanTurn()) el.classList.add('drawn');
      return el;
    }));
    handEl.style.setProperty('--n', String(me.length));
    passBtn.hidden = !(humanTurn() && s.drawnPlayable !== null);
    if (s.winner !== null) status.textContent = '';
    else if (humanTurn()) status.textContent = s.pending ? tr(`+${s.pending} waiting: stack it or draw ${s.pending}`, `+${s.pending} pendiente: acumula o roba ${s.pending}`) : s.drawnPlayable !== null ? tr('Play the card you drew, or keep it', 'Juega la carta que robaste o quédatela') : tr('Your turn', 'Tu turno');
    else status.textContent = tr(`${s.players[s.current].name} is thinking…`, `${s.players[s.current].name} está pensando…`);
    status.classList.toggle('mine', humanTurn());
  }

  function sortKey(c: GameState['players'][0]['hand'][0]) {
    return (c.color ? COLORS.indexOf(c.color) : 9) + ':' + c.value.padStart(6, ' ');
  }

  let seen = s.log.length;
  /** Reads an engine log line as plain English ("You plays" → "You play"). */
  const say = (line: string) => {
    const en = line.replace(/^You (play|draw|swap|jump)s/, 'You $1').replace(/with You$/, 'with you');
    if (lang() !== 'es') return en;
    return en
      .replace(/^You swap hands with (.+)$/, 'Cambias tu mano con $1').replace(/^(.+) swaps hands with you$/, '$1 cambia su mano contigo')
      .replace(/^(.+) swaps hands with (.+)$/, '$1 cambia su mano con $2').replace(/^Every hand moves on$/, 'Todas las manos pasan al siguiente')
      .replace(/^You jump in with (.+)$/, 'Te cuelas con $1').replace(/^(.+) jumps in with (.+)$/, '$1 se cuela con $2')
      .replace(/\b(coral|teal|gold|violet)\b/g, m => COLOR_ES[m as CColor]).replace('Freeze', 'Congelar').replace('Flip', 'Girar').replace('Rainbow', 'Arcoíris');
  };

  function afterPlay(byHuman: boolean) {
    const t = top(s);
    sfx(t.value === 'plus2' || t.value === 'wild4' ? 'bigwin' : 'card');
    const fresh = s.log.slice(seen);
    seen = s.log.length;
    const news = fresh.filter(l => /swaps hands|moves on/.test(l) || (!byHuman && /jumps in/.test(l)));
    if (news.length) toast(news.map(say).join(' · '));
    if (s.players.some(p => p.hand.length === 1) && s.winner === null) sfx('ball');
    render();
    if (s.winner !== null) return finish();
    schedule();
  }

  async function humanPlay(i: number) {
    if (busy || picking || s.winner !== null) return;
    const c = s.players[0].hand[i];
    const jump = !humanTurn();
    if (jump ? !canJumpIn(s, 0, c) : !(canPlay(s, c) && (s.drawnPlayable === null || s.drawnPlayable === i))) {
      if (humanTurn()) { sfx('lose'); buzz(); }
      return;
    }
    let color: CColor | undefined;
    let swapWith: number | undefined;
    if (isWild(c) && s.players[0].hand.length > 1) {
      color = await pickColor();
      if (!color) return;
    }
    if (c.value === '7' && s.rules.sevenZero && s.players[0].hand.length > 1) {
      swapWith = await pickPlayer();
      if (swapWith === undefined) return;
    }
    clearTimeout(timer);
    if (play(s, 0, i, rng, { color, swapWith })) afterPlay(true);
  }

  function humanDraw() {
    if (!humanTurn() || busy || s.drawnPlayable !== null) return;
    const got = drawTurn(s, rng);
    sfx('card');
    seen = s.log.length;
    if (got.length > 1) toast(tr(`You draw ${got.length}`, `Robas ${got.length}`));
    render();
    if (s.current !== 0) schedule();
  }

  /** A small choice dialog; closing it any way (Cancel, backdrop, back button) answers undefined. */
  function choose<T>(title: string, cls: string, items: { label: string; value: T; style?: string; btn?: string }[]): Promise<T | undefined> {
    picking = true;
    return new Promise(resolve => {
      let done = false;
      const finish = (v: T | undefined) => { if (done) return; done = true; picking = false; obs.disconnect(); scrim.remove(); resolve(v); };
      const box = h('div.' + cls, {}, ...items.map(it => h('button.' + (it.btn ?? 'btn'), { style: it.style ?? '', onclick: () => finish(it.value) }, it.label)));
      const scrim = dialog(title, box, [{ label: tr('Cancel', 'Cancelar') }]);
      const obs = new MutationObserver(() => { if (!scrim.isConnected) finish(undefined); });
      obs.observe(document.body, { childList: true });
    });
  }
  const pickColor = () => choose<CColor>(tr('Pick a color', 'Elige un color'), 'cc-picker', COLORS.map(c => ({ label: colorName(c), value: c, btn: 'cc-swatch', style: `--c:${CC_HEX[c][1]}` })));
  const pickPlayer = () => choose<number>(tr('Swap hands with', 'Cambiar mano con'), 'cc-picker.one', s.players.slice(1).map((p, i) => ({ label: `${bots[i].face} ${p.name} · ${p.hand.length} ${tr('cards', 'cartas')}`, value: i + 1 })));

  /** Lets computer players jump in, then takes the computer's turn after a short pause. */
  function schedule() {
    clearTimeout(timer);
    if (!alive || s.winner !== null) return;
    timer = window.setTimeout(() => {
      if (!alive || s.winner !== null || picking) { if (picking) schedule(); return; }
      const j = botJumpIn(s, rng);
      if (j && j.p !== s.current) { play(s, j.p, j.idx, rng); afterPlay(false); return; }
      if (humanTurn()) { render(); return; }
      busy = true;
      const choice = botChoice(s, rng);
      if (choice) play(s, s.current, choice.idx, rng, choice.opts);
      else {
        const who = s.current;
        const got = drawTurn(s, rng);
        sfx('card');
        seen = s.log.length;
        if (got.length > 1) toast(tr(`${s.players[who].name} draws ${got.length}`, `${s.players[who].name} roba ${got.length}`));
        if (s.drawnPlayable !== null && s.current === who) {
          const again = botChoice(s, rng);
          if (again) play(s, who, again.idx, rng, again.opts); else pass(s, rng);
        }
      }
      busy = false;
      afterPlay(false);
    }, s.rules.jumpIn ? 1100 : 850);
  }

  function finish() {
    const pts = roundPoints(s);
    const won = s.winner === 0;
    countPlay('colors', won);
    if (won) {
      const prize = Math.max(50, pts);
      addChips(prize);
      sfx('jackpot');
      buzz(true);
      coinBurst(discardEl, 40);
      dialog(tr('You win!', '¡Ganaste!'), h('p.big-win', {}, tr(`Round points: ${fmt(pts)}. You get ${fmt(prize)} chips.`, `Puntos de la ronda: ${fmt(pts)}. Recibes ${fmt(prize)} fichas.`)), [
        { label: tr('Rules', 'Reglas'), onclick: backToSetup }, { label: tr('Play again', 'Jugar otra vez'), primary: true, onclick: () => { stop(); setStop(startGame(root, backToSetup, setStop)); } },
      ]);
    } else {
      sfx('lose');
      dialog(tr(`${s.players[s.winner!].name} wins`, `Gana ${s.players[s.winner!].name}`), h('p', {}, tr(`${s.players[s.winner!].name} went out first with ${fmt(pts)} points. Your hand had ${s.players[0].hand.length} card(s) left.`, `${s.players[s.winner!].name} terminó primero con ${fmt(pts)} puntos. Te quedaron ${s.players[0].hand.length} carta(s).`)), [
        { label: tr('Rules', 'Reglas'), onclick: backToSetup }, { label: tr('Play again', 'Jugar otra vez'), primary: true, onclick: () => { stop(); setStop(startGame(root, backToSetup, setStop)); } },
      ]);
    }
  }

  function stop() { alive = false; clearTimeout(timer); }

  const help = h('button.btn.small', { onclick: () => colorsHowTo(s.rules) }, tr('How to play', 'Cómo jugar'));

  root.replaceChildren(topBar(tr('Crazy Colors', 'Colores Locos')),
    h('div.cc-table', {}, oppRow,
      h('div.cc-center', {}, drawPile, discardEl, h('div.cc-side', {}, colorDot, dirEl)),
      status),
    handEl,
    h('div.controls', {}, help, passBtn));
  render();
  schedule();
  return stop;
}
