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

const RULE_TEXT: Record<keyof Rules, [string, string]> = {
  stacking: ['Stacking', 'Answer a +2 with a +2 (or a Rainbow +4) and pass the pile on.'],
  sevenZero: ['Seven-Zero', 'Play a 7 to swap hands with someone. Play a 0 and every hand moves to the next player.'],
  jumpIn: ['Jump-in', 'Have the exact same card as the top one? Play it even when it isn\'t your turn.'],
  drawUntilMatch: ['Draw until match', 'When you draw, keep drawing until you get a card you can play.'],
};

export const colorsScreen: Screen = root => {
  root.classList.add('colors');
  let cleanup: (() => void) | undefined;
  const setup = () => {
    cleanup?.();
    root.replaceChildren(topBar('Crazy Colors'));
    const cfg = profile.colors;
    const opp = h('div.seg', {}, ...[1, 2, 3].map(n => h('button.seg-btn' + (cfg.opponents === n ? '.on' : ''), {
      onclick: (e: Event) => {
        cfg.opponents = n; save(); sfx('click');
        opp.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b === e.currentTarget));
      },
    }, `${n}`)));
    const toggles = (Object.keys(RULE_TEXT) as (keyof Rules)[]).map(k => {
      const input = h<HTMLInputElement>('input', { type: 'checkbox', onchange: () => { cfg.rules[k] = input.checked; save(); sfx('click'); } });
      input.checked = cfg.rules[k];
      return h('label.rule', {}, h('span.rule-text', {}, h('b', {}, RULE_TEXT[k][0]), h('span', {}, RULE_TEXT[k][1])), input);
    });
    root.append(h('div.scroll.cc-setup', {},
      h('div.cc-logo', { html: ['coral', 'gold', 'teal', 'violet'].map((c, i) => `<span style="color:${CC_HEX[c as CColor][0]}">${'CRAZY COLORS'.slice(i * 3, i * 3 + 3)}</span>`).join('') }),
      h('p.muted.center', {}, 'Match the top card by color or symbol. Rainbow cards pick a new color. Empty your hand first to win the round, and you score the cards left in the other hands as chips.'),
      h('h3.group-title', {}, 'Opponents'), opp,
      h('h3.group-title', {}, 'House rules'), ...toggles,
      h('div.controls', {}, h('button.btn.primary.wide', { onclick: () => { sfx('click'); cleanup = startGame(root, setup, st => { cleanup = st; }); } }, 'DEAL'))));
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
  const drawPile = h('button.cc-pile', { 'aria-label': 'Draw a card', onclick: () => humanDraw() });
  const discardEl = h('div.cc-discard');
  const colorDot = h('div.cc-color');
  const dirEl = h('div.cc-dir');
  const status = h('div.cc-status');
  const handEl = h('div.cc-hand');
  const passBtn = h('button.btn.small', { onclick: () => { pass(s, rng); seen = s.log.length; sfx('click'); render(); schedule(); } }, 'Keep it');

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
        p.hand.length === 1 && s.winner === null ? h('div.cc-last', {}, 'LAST CARD!') : null);
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
    colorDot.textContent = s.color.toUpperCase();
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
    else if (humanTurn()) status.textContent = s.pending ? `+${s.pending} waiting: stack it or draw ${s.pending}` : s.drawnPlayable !== null ? 'Play the card you drew, or keep it' : 'Your turn';
    else status.textContent = `${s.players[s.current].name} is thinking…`;
    status.classList.toggle('mine', humanTurn());
  }

  function sortKey(c: GameState['players'][0]['hand'][0]) {
    return (c.color ? COLORS.indexOf(c.color) : 9) + ':' + c.value.padStart(6, ' ');
  }

  let seen = s.log.length;
  /** Reads an engine log line as plain English ("You plays" → "You play"). */
  const say = (line: string) => line
    .replace(/^You (play|draw|swap|jump)s/, 'You $1')
    .replace(/with You$/, 'with you');

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
    if (got.length > 1) toast(`You draw ${got.length}`);
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
      const scrim = dialog(title, box, [{ label: 'Cancel' }]);
      const obs = new MutationObserver(() => { if (!scrim.isConnected) finish(undefined); });
      obs.observe(document.body, { childList: true });
    });
  }
  const pickColor = () => choose<CColor>('Pick a color', 'cc-picker', COLORS.map(c => ({ label: c, value: c, btn: 'cc-swatch', style: `--c:${CC_HEX[c][1]}` })));
  const pickPlayer = () => choose<number>('Swap hands with', 'cc-picker.one', s.players.slice(1).map((p, i) => ({ label: `${bots[i].face} ${p.name} · ${p.hand.length} cards`, value: i + 1 })));

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
        if (got.length > 1) toast(`${s.players[who].name} draws ${got.length}`);
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
      dialog('You win!', h('p.big-win', {}, `Round points: ${fmt(pts)}. You get ${fmt(prize)} chips.`), [
        { label: 'Rules' , onclick: backToSetup }, { label: 'Play again', primary: true, onclick: () => { stop(); setStop(startGame(root, backToSetup, setStop)); } },
      ]);
    } else {
      sfx('lose');
      dialog(`${s.players[s.winner!].name} wins`, h('p', {}, `${s.players[s.winner!].name} went out first with ${fmt(pts)} points. Your hand had ${s.players[0].hand.length} card(s) left.`), [
        { label: 'Rules', onclick: backToSetup }, { label: 'Play again', primary: true, onclick: () => { stop(); setStop(startGame(root, backToSetup, setStop)); } },
      ]);
    }
  }

  function stop() { alive = false; clearTimeout(timer); }

  const help = h('button.btn.small', { onclick: () => dialog('How to play', h('div', {},
    h('p', {}, 'Play a card that matches the top card\'s color or symbol. If you can\'t, tap the deck to draw.'),
    h('p', {}, 'Freeze skips the next player. Flip turns the direction around. +2 makes the next player draw 2. Rainbow picks a color; Rainbow +4 also makes the next player draw 4.'),
    h('p', {}, 'House rules on: ' + ((Object.keys(RULE_TEXT) as (keyof Rules)[]).filter(k => s.rules[k]).map(k => RULE_TEXT[k][0]).join(', ') || 'none') + '.'))) }, 'How to play');

  root.replaceChildren(topBar('Crazy Colors'),
    h('div.cc-table', {}, oppRow,
      h('div.cc-center', {}, drawPile, discardEl, h('div.cc-side', {}, colorDot, dirEl)),
      status),
    handEl,
    h('div.controls', {}, help, passBtn));
  render();
  schedule();
  return stop;
}
