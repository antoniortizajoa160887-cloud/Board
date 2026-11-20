import { sfx } from '../audio';
import { dieSvg } from './crapsPlay';
import { makeRng, randInt } from '../core/rng';
import {
  applyOffer, BOARD, botAccepts, botPrepare, botWantsToBuy, build, buy, canBuild, canMortgage, canSellBuilding,
  CARD_TEXT, endTurn, FOG_FEE, GROUP_COLORS, GROUP_EN, GROUP_ES, groupLots, leaveFog, MAX_LEVEL, mortgage, netWorth,
  newGame, ownsGroup, pass, rentFor, roll, sellBuilding, unmortgage, unmortgageCost, FERRY_RENT, type Game, type Offer, type TEvent,
} from '../core/tycoon';
import { lang, tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile, save } from '../save';
import { coinBurst, fmt, h, sleep, toast } from '../ui/dom';
import type { Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { howToPlay } from './howto';

const TOKEN_COLORS = ['#ff5fa2', '#2ef2d0', '#f5c542', '#b07bff'];
const BOT_NAMES = ['Pip', 'Coral', 'Moe'];
const WIN_CHIPS = 500;

const TOKENS = [
  // sailboat
  `<path d="M50 14 L50 66 L22 66 Z" fill="#fff"/><path d="M55 22 L55 66 L80 66 Z" fill="#ffffffcc"/><path d="M14 72 H86 L76 86 H24 Z" fill="currentColor"/>`,
  // anchor
  `<circle cx="50" cy="20" r="8" fill="none" stroke="#fff" stroke-width="7"/><path d="M50 28 V82 M32 42 H68" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M18 58 Q22 84 50 84 Q78 84 82 58" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  // fish
  `<ellipse cx="44" cy="50" rx="28" ry="18" fill="#fff"/><path d="M68 50 L90 32 L90 68 Z" fill="#fff"/><circle cx="32" cy="46" r="4" fill="currentColor"/>`,
  // star shell
  `<path d="M50 12 L60 38 L88 40 L66 58 L74 86 L50 70 L26 86 L34 58 L12 40 L40 38 Z" fill="#fff"/>`,
];
const tokenSvg = (k: number) => `<svg viewBox="0 0 100 100" style="color:${TOKEN_COLORS[k]}"><circle cx="50" cy="50" r="48" fill="${TOKEN_COLORS[k]}" stroke="#fff" stroke-width="4"/><g transform="translate(15 15) scale(.7)">${TOKENS[k]}</g></svg>`;

const ICON: Record<string, string> = {
  start: `<svg viewBox="0 0 40 40"><path d="M16 36 L18 12 H22 L24 36 Z" fill="#fff"/><path d="M17 20 H23 M16.5 28 H23.5" stroke="#ff4d6d" stroke-width="3"/><rect x="15" y="6" width="10" height="7" rx="2" fill="#f5c542"/><path d="M25 9 L38 4 V14 Z M15 9 L2 4 V14 Z" fill="#fff3b088"/></svg>`,
  fog: `<svg viewBox="0 0 40 40"><path d="M6 16 Q12 10 20 14 Q28 8 34 16 M4 24 Q12 18 20 22 Q28 16 36 24 M8 32 Q16 26 24 30 Q30 26 34 32" fill="none" stroke="#c9d3ff" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  cove: `<svg viewBox="0 0 40 40"><rect x="7" y="16" width="26" height="18" rx="3" fill="#a8641c"/><path d="M7 18 Q20 4 33 18 Z" fill="#c87b2a"/><rect x="7" y="20" width="26" height="4" fill="#f5c542"/><rect x="17" y="19" width="6" height="8" rx="1" fill="#fff3b0"/></svg>`,
  whirl: `<svg viewBox="0 0 40 40"><path d="M20 20 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 6 a9 9 0 1 1 -9 -9 a12 12 0 1 1 12 12" fill="none" stroke="#2ef2d0" stroke-width="3" stroke-linecap="round"/></svg>`,
  ferry: `<svg viewBox="0 0 40 40"><path d="M6 24 H34 L29 32 H11 Z" fill="#4d8dff"/><rect x="12" y="16" width="16" height="8" rx="2" fill="#fff"/><rect x="18" y="10" width="4" height="7" fill="#ff4d6d"/><path d="M4 35 Q10 32 16 35 T28 35 T38 35" stroke="#2ef2d0" stroke-width="2" fill="none"/></svg>`,
  yard: `<svg viewBox="0 0 40 40"><path d="M10 34 V8 H30 M10 8 L30 8 L26 14 M30 8 V18" stroke="#f5c542" stroke-width="3" fill="none"/><path d="M30 18 V24" stroke="#fff" stroke-width="1.5"/><rect x="25" y="24" width="10" height="6" fill="#ff8a2a"/><rect x="5" y="32" width="30" height="3" fill="#fff"/></svg>`,
  bottle: `<svg viewBox="0 0 40 40"><g transform="rotate(35 20 20)"><rect x="14" y="12" width="12" height="22" rx="5" fill="#2ef2d088" stroke="#fff" stroke-width="1.5"/><rect x="17" y="5" width="6" height="8" fill="#2ef2d088" stroke="#fff" stroke-width="1.5"/><rect x="16.5" y="3" width="7" height="4" fill="#a8641c"/><rect x="16" y="18" width="8" height="10" fill="#fff3b0"/></g></svg>`,
  fee: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" fill="#f5c542" stroke="#a86b12" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="16" font-weight="900" fill="#7a4a00">$</text></svg>`,
};

const sName = (i: number) => (lang() === 'es' ? BOARD[i].es : BOARD[i].en);
const gName = (g: number) => (lang() === 'es' ? GROUP_ES[g] : GROUP_EN[g]);

/** 32 spaces around a 9×9 grid, Lighthouse at the bottom right, moving clockwise to the left. */
function cellPos(i: number): [number, number] {
  if (i <= 8) return [8, 8 - i];
  if (i <= 16) return [16 - i, 0];
  if (i <= 24) return [0, i - 16];
  return [i - 24, 8];
}

export const tycoonHowTo = () => howToPlay(tr('How to play Harbor Tycoon', 'Cómo jugar a Magnate del Puerto'), [
  [tr('The goal', 'El objetivo'), tr('Sail around the harbor buying lots, docks and shipyards. Collect rent from the others. When the last round ends (or everyone else runs out of money), the richest player wins: cash plus everything you own.', 'Navega por el puerto comprando terrenos, muelles y astilleros. Cobra renta a los demás. Al terminar la última ronda (o cuando los demás se quedan sin dinero), gana el jugador más rico: efectivo más todo lo que tienes.')],
  [tr('Your turn', 'Tu turno'), tr('Tap ROLL. Your token moves by the total of the two dice. Every time you pass the Lighthouse you collect 200.', 'Toca TIRAR. Tu ficha avanza la suma de los dos dados. Cada vez que pasas por el Faro cobras 200.')],
  [tr('Buying', 'Comprar'), tr('Land on a free lot, ferry or shipyard and you may BUY it for its price. If you pass, nobody owns it yet.', 'Si caes en un terreno, ferri o astillero libre puedes COMPRARLO por su precio. Si pasas, sigue sin dueño.')],
  [tr('Rent', 'Renta'), tr('Land on someone else\'s place and you pay them rent. Owning all 3 lots of one color doubles their rent. Ferries pay more the more of them you own. Shipyards charge 4× the dice (10× if you own both).', 'Si caes en la propiedad de otro, le pagas renta. Tener los 3 terrenos de un color duplica su renta. Los ferris pagan más cuantos más tengas. Los astilleros cobran 4× los dados (10× si tienes los dos).')],
  [tr('Building', 'Construir'), tr('Own a whole color and you can build beach huts (up to 3) and then a resort with MY HARBOR. Each building raises the rent a lot. Build evenly: every lot of the color must have the same number before adding another.', 'Si tienes un color completo puedes construir cabañas (hasta 3) y luego un resort desde MI PUERTO. Cada construcción sube mucho la renta. Construye parejo: cada terreno del color debe tener lo mismo antes de añadir otra.')],
  [tr('Doubles', 'Dobles'), tr('Roll a pair and you roll again. Three pairs in a row and you get lost in the fog!', 'Si sacas dobles vuelves a tirar. ¡Tres dobles seguidos y te pierdes en la niebla!')],
  [tr('The Fog Bank', 'El Banco de Niebla'), tr('While in the fog you don\'t move. Pay 50, use a Fog Horn card, or try to roll doubles. After 3 tries you pay 50 and move.', 'En la niebla no te mueves. Paga 50, usa una carta de Sirena o intenta sacar dobles. Tras 3 intentos pagas 50 y avanzas.')],
  [tr('Special spaces', 'Casillas especiales'), tr('Message in a Bottle: draw a surprise card. Taxes and fines go into the Treasure Cove; land on the Cove to take it all. The Whirlpool spins you to a random ferry dock.', 'Mensaje en una Botella: saca una carta sorpresa. Impuestos y multas van a la Cala del Tesoro; cae en la Cala y te llevas todo. El Remolino te lanza a un ferri al azar.')],
  [tr('Trading and cash', 'Intercambios y dinero'), tr('Tap TRADE to offer lots and cash to another player. Short on cash? In MY HARBOR you can mortgage a place for half its price (no rent while mortgaged). If you can\'t pay, the bank sells and mortgages for you; if that\'s not enough, you\'re out.', 'Toca CAMBIAR para ofrecer terrenos y dinero a otro jugador. ¿Te falta dinero? En MI PUERTO puedes hipotecar una propiedad por la mitad de su precio (no cobra renta mientras está hipotecada). Si no puedes pagar, el banco vende e hipoteca por ti; si no alcanza, quedas fuera.')],
  [tr('Beginner tip', 'Consejo para empezar'), tr('Buy almost everything early, try to complete a color, then build huts on it. Orange and pink lots get landed on a lot!', 'Compra casi todo al principio, intenta completar un color y luego construye cabañas. ¡En los naranjas y rosados se cae mucho!')],
]);

let game: Game | null = profile.tycoon;

export const tycoonScreen: Screen = root => {
  root.classList.add('tycoon');
  let alive = true;
  const rng = makeRng();
  root.append(topBar(tr('Harbor Tycoon', 'Magnate del Puerto')));
  const body = h('div.ty-body');
  root.append(body);

  if (!game || game.phase === 'over') setup(); else play(game);

  function setup() {
    let opp = 3, rounds = 30;
    const seg = (vals: number[], start: number, label: (v: number) => string, set: (v: number) => void) => {
      const wrap = h('div.seg');
      const bs = vals.map(v => h('button.seg-btn' + (v === start ? '.on' : ''), { onclick: () => { sfx('click'); set(v); bs.forEach((b, k) => b.classList.toggle('on', vals[k] === v)); } }, label(v)));
      wrap.append(...bs);
      return wrap;
    };
    body.replaceChildren(h('div.ty-setup', {},
      h('div.ty-logo', { html: `<svg viewBox="0 0 120 120">${[0, 1, 2, 3].map(k => `<g transform="translate(${8 + k * 26} ${k % 2 ? 46 : 34}) scale(.3)">${tokenSvg(k).replace(/<\/?svg[^>]*>/g, '')}</g>`).join('')}</svg>` }),
      h('div.deco-title', {}, tr('HARBOR TYCOON', 'MAGNATE DEL PUERTO')),
      h('p.muted', {}, tr('Buy the harbor, build resorts, and out-earn Pip, Coral and Moe.', 'Compra el puerto, construye resorts y gana más que Pip, Coral y Moe.')),
      h('div.ty-opt', {}, h('span', {}, tr('Opponents', 'Rivales')), seg([1, 2, 3], opp, v => String(v), v => { opp = v; })),
      h('div.ty-opt', {}, h('span', {}, tr('Game length', 'Duración')), seg([20, 30, 45], rounds, v => (v === 20 ? tr('Short', 'Corta') : v === 30 ? tr('Normal', 'Normal') : tr('Long', 'Larga')), v => { rounds = v; })),
      h('p.muted.small', {}, tr(`Win the game to earn ${WIN_CHIPS} chips.`, `Gana la partida y llévate ${WIN_CHIPS} fichas.`)),
      h('div.controls', {},
        h('button.btn.small', { onclick: tycoonHowTo }, tr('How to play', 'Cómo jugar')),
        h('button.btn.primary.wide', {
          onclick: () => {
            sfx('chip');
            game = newGame([{ name: '', token: '0', bot: false }, ...BOT_NAMES.slice(0, opp).map((n, k) => ({ name: n, token: String(k + 1), bot: true }))], rng, rounds);
            game.current = 0;
            persist();
            play(game);
          },
        }, tr('START', 'EMPEZAR')))));
  }

  function persist() { profile.tycoon = game; save(); }

  function play(g: Game) {
    const pname = (p: number) => (p === 0 ? tr('You', 'Tú') : g.players[p].name);
    const vis = g.players.map(p => p.pos);
    const asked = new Set<number>();
    let busy = false;

    // ——— Board ———
    const cells: HTMLElement[] = BOARD.map((s, i) => {
      const [r, c] = cellPos(i);
      const side = i <= 8 ? 'b' : i <= 16 ? 'l' : i <= 24 ? 't' : 'r';
      const corner = i % 8 === 0;
      const el = h('button.ty-cell.' + side + (corner ? '.corner' : ''), { style: `grid-row:${r + 1};grid-column:${c + 1}`, onclick: () => deedInfo(i) });
      if (s.kind === 'lot') el.append(h('span.ty-band', { style: `background:${GROUP_COLORS[s.group!]}` }));
      else el.append(h('span.ty-ico', { html: ICON[s.kind] }));
      el.append(h('span.ty-name', {}, sName(i)));
      if (s.price) el.append(h('span.ty-price', {}, fmt(s.price)));
      el.append(h('span.ty-bld'));
      return el;
    });
    const tokens = g.players.map((_, k) => h('div.ty-token', { html: tokenSvg(k) }));
    const d1 = h('div.die', { html: dieSvg(g.dice[0], '#4d8dff') }), d2 = h('div.die', { html: dieSvg(g.dice[1], '#ff5fa2') });
    const msg = h('div.ty-msg');
    const roundEl = h('div.ty-round');
    const coveEl = h('div.ty-cove');
    const center = h('div.ty-center', {}, h('div.ty-title', {}, tr('HARBOR TYCOON', 'MAGNATE DEL PUERTO')), roundEl, h('div.ty-dice', {}, d1, d2), msg, coveEl);
    const board = h('div.ty-board', {}, ...cells, center, ...tokens);
    const players = h('div.ty-players');
    const actions = h('div.ty-actions');
    body.replaceChildren(board, players, actions);

    function say(t: string) { msg.textContent = t; msg.classList.remove('pop'); void msg.offsetWidth; msg.classList.add('pop'); }

    function placeTokens() {
      g.players.forEach((p, k) => {
        const [r, c] = cellPos(vis[k]);
        const here = g.players.map((_, j) => j).filter(j => !g.players[j].out && vis[j] === vis[k]);
        const slot = here.indexOf(k), n = here.length;
        const off = n > 1 ? (slot - (n - 1) / 2) * 1.6 : 0;
        const vertical = c === 0 || c === 8;
        const x = (c + 0.5) * (100 / 9) + (vertical ? 0 : off), y = (r + 0.62) * (100 / 9) + (vertical ? off : 0);
        tokens[k].style.left = x + '%';
        tokens[k].style.top = y + '%';
        tokens[k].style.display = p.out ? 'none' : '';
        tokens[k].classList.toggle('now', k === g.current);
      });
    }

    function renderCells() {
      BOARD.forEach((_, i) => {
        const d = g.deeds[i], el = cells[i];
        el.classList.toggle('owned', !!d);
        el.classList.toggle('mort', !!d?.mortgaged);
        el.style.setProperty('--own', d ? TOKEN_COLORS[d.owner] : 'transparent');
        const bld = el.querySelector('.ty-bld')!;
        bld.innerHTML = !d || d.level === 0 ? '' : d.level === MAX_LEVEL ? '<i class="resort"></i>' : '<i></i>'.repeat(d.level);
      });
      roundEl.textContent = tr(`Round ${Math.min(g.round, g.maxRounds)} of ${g.maxRounds}`, `Ronda ${Math.min(g.round, g.maxRounds)} de ${g.maxRounds}`);
      coveEl.innerHTML = g.cove ? `${ICON.cove}<span>${fmt(g.cove)}</span>` : '';
    }

    const pCards = g.players.map((_, k) => h('div.ty-p', {}, h('span.ty-p-tok', { html: tokenSvg(k) }), h('span.ty-p-name', {}, pname(k)), h('span.ty-p-cash')));
    players.append(...pCards);
    function renderPlayers() {
      g.players.forEach((p, k) => {
        pCards[k].classList.toggle('now', k === g.current && g.phase !== 'over');
        pCards[k].classList.toggle('out', p.out);
        pCards[k].querySelector('.ty-p-cash')!.textContent = p.out ? tr('Out', 'Fuera') : fmt(p.cash) + (p.fog ? ' ☁' : '') + (p.horns ? ' ♪' : '');
      });
    }

    function float(p: number, text: string, good: boolean) {
      const f = h('span.ty-float' + (good ? '.good' : ''), {}, text);
      pCards[p].append(f);
      setTimeout(() => f.remove(), 1300);
    }

    function renderAll() { renderCells(); renderPlayers(); placeTokens(); renderActions(); }

    // ——— Events ———
    const delay = (ms: number) => sleep(g.current === 0 ? ms : ms * 0.75);
    async function flush() {
      while (g.events.length && alive) {
        const e = g.events.shift()!;
        await show(e);
      }
      renderCells(); renderPlayers(); placeTokens();
    }

    async function show(e: TEvent) {
      switch (e.t) {
        case 'dice': {
          sfx('dice');
          d1.classList.add('tumble'); d2.classList.add('tumble');
          for (let k = 0; k < 7; k++) { d1.innerHTML = dieSvg(randInt(rng, 6) + 1, '#4d8dff'); d2.innerHTML = dieSvg(randInt(rng, 6) + 1, '#ff5fa2'); await sleep(60); }
          d1.innerHTML = dieSvg(e.d[0], '#4d8dff'); d2.innerHTML = dieSvg(e.d[1], '#ff5fa2');
          d1.classList.remove('tumble'); d2.classList.remove('tumble');
          say(tr(`${pname(e.p)} rolled ${e.d[0] + e.d[1]}${e.d[0] === e.d[1] ? ' (doubles!)' : ''}`, `${pname(e.p)} sacó ${e.d[0] + e.d[1]}${e.d[0] === e.d[1] ? ' (¡dobles!)' : ''}`));
          await delay(350);
          break;
        }
        case 'move':
          for (const pos of e.path) {
            vis[e.p] = pos; placeTokens();
            tokens[e.p].classList.remove('hop'); void tokens[e.p].offsetWidth; tokens[e.p].classList.add('hop');
            sfx('tick');
            await delay(150);
          }
          await delay(150);
          break;
        case 'jump':
          vis[e.p] = e.to; placeTokens(); sfx('spring');
          if (BOARD[e.to].kind === 'ferry') say(tr(`${pname(e.p)} spins to ${sName(e.to)}!`, `¡${pname(e.p)} gira hasta ${sName(e.to)}!`));
          await delay(500);
          break;
        case 'pay':
          if (!e.amount) break;
          sfx('chip');
          float(e.from, '−' + fmt(e.amount), false);
          if (e.to !== null) float(e.to, '+' + fmt(e.amount), true);
          say(e.why === 'rent' && e.to !== null
            ? tr(`${pname(e.from)} paid ${fmt(e.amount)} rent to ${pname(e.to)}`, `${pname(e.from)} pagó ${fmt(e.amount)} de renta a ${pname(e.to)}`)
            : e.to !== null ? tr(`${pname(e.from)} paid ${pname(e.to)} ${fmt(e.amount)}`, `${pname(e.from)} pagó ${fmt(e.amount)} a ${pname(e.to)}`)
              : tr(`${pname(e.from)} paid ${fmt(e.amount)} to the Treasure Cove`, `${pname(e.from)} pagó ${fmt(e.amount)} a la Cala del Tesoro`));
          renderPlayers(); renderCells();
          await delay(650);
          break;
        case 'get':
          sfx(e.why === 'cove' ? 'jackpot' : 'pearl');
          float(e.p, '+' + fmt(e.amount), true);
          say(e.why === 'start' ? tr(`${pname(e.p)} passed the Lighthouse: +200`, `${pname(e.p)} pasó por el Faro: +200`)
            : e.why === 'cove' ? tr(`${pname(e.p)} found the Treasure Cove: +${fmt(e.amount)}!`, `¡${pname(e.p)} encontró la Cala del Tesoro: +${fmt(e.amount)}!`)
              : tr(`${pname(e.p)} collects ${fmt(e.amount)}`, `${pname(e.p)} cobra ${fmt(e.amount)}`));
          if (e.why === 'cove') coinBurst(pCards[e.p], 24);
          renderPlayers();
          await delay(500);
          break;
        case 'card': {
          sfx('card');
          const text = tr(CARD_TEXT[e.card][0], CARD_TEXT[e.card][1]);
          if (e.p === 0) await cardDialog(text);
          else { say(`${pname(e.p)}: ${text}`); await delay(1500); }
          break;
        }
        case 'fog':
          sfx('lose');
          say(tr(`${pname(e.p)} is lost in the Fog Bank`, `${pname(e.p)} se perdió en el Banco de Niebla`));
          await delay(700);
          break;
        case 'buy':
          sfx('chip');
          cells[e.space].classList.add('flash'); setTimeout(() => cells[e.space].classList.remove('flash'), 900);
          say(tr(`${pname(e.p)} bought ${sName(e.space)}`, `${pname(e.p)} compró ${sName(e.space)}`));
          renderCells(); renderPlayers();
          await delay(600);
          break;
        case 'build':
          sfx('daub');
          cells[e.space].classList.add('flash'); setTimeout(() => cells[e.space].classList.remove('flash'), 900);
          say(e.level === MAX_LEVEL ? tr(`${pname(e.p)} built a resort on ${sName(e.space)}!`, `¡${pname(e.p)} construyó un resort en ${sName(e.space)}!`)
            : tr(`${pname(e.p)} built a hut on ${sName(e.space)}`, `${pname(e.p)} construyó una cabaña en ${sName(e.space)}`));
          renderCells();
          await delay(e.p === 0 ? 150 : 450);
          break;
        case 'bankrupt':
          sfx('lose');
          say(tr(`${pname(e.p)} ran out of money!`, `¡${pname(e.p)} se quedó sin dinero!`));
          toast(tr(`${pname(e.p)} is out`, `${pname(e.p)} queda fuera`), 'lose');
          renderPlayers(); placeTokens();
          await delay(1000);
          break;
      }
    }

    function cardDialog(text: string) {
      return new Promise<void>(res => {
        const d = dialog(tr('Message in a Bottle', 'Mensaje en una Botella'), h('div.ty-card', {}, h('span.ty-card-ico', { html: ICON.bottle }), h('p', {}, text)), [{ label: 'OK', primary: true, onclick: res }]);
        d.addEventListener('click', e => { if (e.target === d) res(); });
      });
    }

    // ——— Actions ———
    const btn = (label: string, fn: () => void, cls = '', disabled = false) => {
      const b = h('button.btn' + cls, { onclick: () => { if (busy) return; sfx('click'); fn(); } }, label);
      b.disabled = disabled;
      return b;
    };

    function renderActions() {
      if (g.phase === 'over') { actions.replaceChildren(btn(tr('New game', 'Nueva partida'), () => { game = null; persist(); setup(); }, '.primary')); return; }
      if (g.current !== 0 || busy) {
        actions.replaceChildren(h('div.muted.ty-wait', {}, g.current !== 0 ? tr(`${pname(g.current)} is playing…`, `${pname(g.current)} está jugando…`) : '…'));
        return;
      }
      const me = g.players[0];
      const row1: HTMLElement[] = [], row2: HTMLElement[] = [];
      if (g.phase === 'roll') {
        if (me.fog) {
          row1.push(btn(tr('Roll for doubles', 'Tirar por dobles'), doRoll, '.primary'));
          row1.push(btn(tr(`Pay ${FOG_FEE}`, `Pagar ${FOG_FEE}`), () => { leaveFog(g, false); void after(); }, '', me.cash < FOG_FEE));
          if (me.horns) row1.push(btn(tr('Use Fog Horn', 'Usar Sirena'), () => { leaveFog(g, true); void after(); }));
        } else row1.push(btn(tr('ROLL', 'TIRAR'), doRoll, '.primary.spin'));
      } else if (g.phase === 'buy') {
        const i = me.pos, price = BOARD[i].price!;
        row1.push(btn(tr(`Buy for ${fmt(price)}`, `Comprar por ${fmt(price)}`), () => { buy(g); void after(); }, '.primary', me.cash < price));
        row1.push(btn(tr('Pass', 'Pasar'), () => { pass(g); void after(); }));
        if (me.cash < price) say(tr(`Not enough cash for ${sName(i)}. Mortgage something in My harbor, or pass.`, `No te alcanza para ${sName(i)}. Hipoteca algo en Mi puerto o pasa.`));
      } else row1.push(btn(tr('End turn', 'Terminar turno'), () => { endTurn(g); void after(); }, '.primary'));
      row2.push(btn(tr('My harbor', 'Mi puerto'), manage, '.small'), btn(tr('Trade', 'Cambiar'), trade, '.small'), btn(tr('How to play', 'Cómo jugar'), tycoonHowTo, '.small'));
      actions.replaceChildren(h('div.controls', {}, ...row1), h('div.controls', {}, ...row2));
    }

    function doRoll() {
      busy = true; renderActions();
      roll(g, rng);
      void after();
    }

    async function after() {
      busy = true; renderActions();
      await flush();
      busy = false;
      if (!alive) return;
      persist();
      if (g.phase === 'over' || g.players[0].out) return finish();
      if (g.current === 0 && g.phase === 'buy') say(tr(`${sName(g.players[0].pos)} is for sale: ${fmt(BOARD[g.players[0].pos].price!)}`, `${sName(g.players[0].pos)} está en venta: ${fmt(BOARD[g.players[0].pos].price!)}`));
      if (g.current === 0 && g.phase === 'roll' && g.dice[0] !== g.dice[1]) say(tr('Your turn: roll the dice', 'Tu turno: tira los dados'));
      if (g.current === 0 && g.phase === 'roll' && g.dice[0] === g.dice[1] && g.players[0].doubles) say(tr('Doubles! Roll again', '¡Dobles! Tira otra vez'));
      renderAll();
      if (g.current !== 0) void botLoop();
    }

    async function botLoop() {
      busy = true; renderActions();
      await sleep(500);
      let guard = 0;
      while (alive && g.phase !== 'over' && g.current !== 0 && guard++ < 50) {
        renderPlayers(); placeTokens();
        if (g.phase === 'roll') {
          botPrepare(g); await flush();
          await maybeOfferToYou();
          roll(g, rng);
        } else if (g.phase === 'buy') {
          if (botWantsToBuy(g)) buy(g); else pass(g);
        } else endTurn(g);
        await flush();
        if (g.players[0].out) break;
        persist();
      }
      busy = false;
      if (!alive) return;
      persist();
      if (g.phase === 'over' || g.players[0].out) return finish();
      say(g.players[0].fog ? tr('Your turn: you are in the Fog Bank', 'Tu turno: estás en el Banco de Niebla') : tr('Your turn: roll the dice', 'Tu turno: tira los dados'));
      buzz();
      renderAll();
    }

    /** A bot that needs one of your lots to finish a color may ask to buy it. */
    async function maybeOfferToYou() {
      const b = g.current;
      for (let grp = 0; grp < GROUP_COLORS.length; grp++) {
        const lots = groupLots(grp);
        const mine = lots.filter(i => g.deeds[i]?.owner === b).length;
        const yours = lots.filter(i => g.deeds[i]?.owner === 0 && g.deeds[i]!.level === 0 && !g.deeds[i]!.mortgaged);
        if (mine !== 2 || yours.length !== 1 || asked.has(yours[0])) continue;
        const i = yours[0];
        const cash = Math.min(Math.round(BOARD[i].price! * 1.7 / 10) * 10, g.players[b].cash - 100);
        if (cash < BOARD[i].price!) continue;
        asked.add(i);
        const ok = await new Promise<boolean>(res => {
          const d = dialog(tr(`${pname(b)} wants to trade`, `${pname(b)} quiere negociar`),
            h('div.ty-offer', {}, h('span.ty-p-tok', { html: tokenSvg(b) }),
              h('p', {}, tr(`"I'll pay you ${fmt(cash)} for ${sName(i)}." That would complete their ${gName(grp)}.`, `"Te pago ${fmt(cash)} por ${sName(i)}." Así completaría su ${gName(grp)}.`))),
            [{ label: tr('No thanks', 'No, gracias'), onclick: () => res(false) }, { label: tr('Deal', 'Trato hecho'), primary: true, onclick: () => res(true) }]);
          d.addEventListener('click', e => { if (e.target === d) res(false); });
        });
        if (ok && applyOffer(g, { from: b, to: 0, give: [], get: [i], cash })) {
          sfx('win'); float(0, '+' + fmt(cash), true); say(tr(`You sold ${sName(i)} to ${pname(b)}`, `Vendiste ${sName(i)} a ${pname(b)}`));
          renderCells(); renderPlayers();
          await sleep(700);
        }
        return;
      }
    }

    function finish() {
      renderAll();
      const order = g.players.map((_, k) => k).sort((a, b) => (g.players[a].out ? 1 : 0) - (g.players[b].out ? 1 : 0) || netWorth(g, b) - netWorth(g, a));
      const won = !g.players[0].out && order[0] === 0;
      countPlay('tycoon', won);
      if (won) { addChips(WIN_CHIPS); sfx('jackpot'); coinBurst(pCards[0], 40); buzz(); } else sfx('lose');
      const table = h('div.ty-standings', {}, ...order.map((k, n) => h('div.ty-st' + (k === 0 ? '.me' : ''), {},
        h('b', {}, String(n + 1)), h('span.ty-p-tok', { html: tokenSvg(k) }), h('span', {}, pname(k)),
        h('span.num', {}, g.players[k].out ? tr('Out', 'Fuera') : fmt(netWorth(g, k))))));
      dialog(won ? tr('You are the Harbor Tycoon!', '¡Eres el Magnate del Puerto!') : tr('Game over', 'Fin de la partida'),
        h('div', {}, won ? h('p', {}, tr(`+${WIN_CHIPS} chips`, `+${WIN_CHIPS} fichas`)) : null, table),
        [{ label: tr('Close', 'Cerrar') }, { label: tr('New game', 'Nueva partida'), primary: true, onclick: () => { game = null; persist(); setup(); } }]);
      game = g; g.phase = 'over'; persist();
      renderActions();
    }

    // ——— Info, managing and trading ———
    function deedInfo(i: number) {
      const s = BOARD[i], d = g.deeds[i];
      const rows: HTMLElement[] = [];
      if (s.kind === 'lot') {
        const names = [tr('Rent', 'Renta'), tr('1 hut', '1 cabaña'), tr('2 huts', '2 cabañas'), tr('3 huts', '3 cabañas'), tr('Resort', 'Resort')];
        s.rent!.forEach((r, k) => rows.push(h('div.ty-row' + (d && d.level === k ? '.on' : ''), {}, h('span', {}, names[k]), h('b', {}, fmt(r)))));
        rows.push(h('div.ty-row.muted', {}, h('span', {}, tr('Full color, no buildings', 'Color completo, sin construir')), h('b', {}, fmt(s.rent![0] * 2))));
        rows.push(h('div.ty-row.muted', {}, h('span', {}, tr('Each building costs', 'Cada construcción cuesta')), h('b', {}, fmt(s.build!))));
      } else if (s.kind === 'ferry') FERRY_RENT.slice(1).forEach((r, k) => rows.push(h('div.ty-row', {}, h('span', {}, tr(`${k + 1} ferr${k ? 'ies' : 'y'} owned`, `${k + 1} ferri${k ? 's' : ''}`)), h('b', {}, fmt(r)))));
      else if (s.kind === 'yard') rows.push(h('p', {}, tr('Rent is 4 × the dice, or 10 × the dice if the owner has both shipyards.', 'La renta es 4 × los dados, o 10 × los dados si el dueño tiene los dos astilleros.')));
      else {
        const text: Record<string, [string, string]> = {
          start: ['Collect 200 every time you pass.', 'Cobra 200 cada vez que pases.'],
          fog: ['Lost boats wait here. Pay 50, use a Fog Horn, or roll doubles to leave.', 'Los barcos perdidos esperan aquí. Paga 50, usa una Sirena o saca dobles para salir.'],
          cove: ['Land here to take every coin paid in taxes and fines.', 'Cae aquí y llévate todo lo pagado en impuestos y multas.'],
          whirl: ['Spins you to a random ferry dock.', 'Te lanza a un ferri al azar.'],
          bottle: ['Draw a surprise card.', 'Saca una carta sorpresa.'],
          fee: [`Pay ${s.fee} into the Treasure Cove.`, `Paga ${s.fee} a la Cala del Tesoro.`],
        };
        rows.push(h('p', {}, tr(...text[s.kind])));
      }
      const head = s.kind === 'lot' ? h('div.ty-deed-head', { style: `background:${GROUP_COLORS[s.group!]}` }, gName(s.group!)) : h('div.ty-deed-ico', { html: ICON[s.kind] });
      const owner = s.price ? h('p.muted', {}, d ? tr(`Owner: ${pname(d.owner)}${d.mortgaged ? ' (mortgaged)' : ''}`, `Dueño: ${pname(d.owner)}${d.mortgaged ? ' (hipotecado)' : ''}`) : tr(`For sale: ${fmt(s.price)}`, `En venta: ${fmt(s.price)}`)) : null;
      dialog(sName(i), h('div.ty-deed', {}, head, owner, ...rows));
    }

    function manage() {
      const list = h('div.ty-manage');
      const draw = () => {
        const mine = g.deeds.map((d, i) => (d?.owner === 0 ? i : -1)).filter(i => i >= 0);
        list.replaceChildren(h('p.muted', {}, tr(`Cash: ${fmt(g.players[0].cash)} · Worth: ${fmt(netWorth(g, 0))}`, `Efectivo: ${fmt(g.players[0].cash)} · Valor: ${fmt(netWorth(g, 0))}`)));
        if (!mine.length) list.append(h('p', {}, tr('You don\'t own anything yet. Land on a free place and buy it!', 'Aún no tienes nada. ¡Cae en una propiedad libre y cómprala!')));
        for (const i of mine) {
          const s = BOARD[i], d = g.deeds[i]!;
          const act = (label: string, ok: boolean, fn: () => void) => {
            const b = h('button.btn.small', { onclick: () => { sfx('chip'); fn(); void flush().then(() => { persist(); draw(); }); } }, label);
            b.disabled = !ok;
            return b;
          };
          const status = d.mortgaged ? tr('Mortgaged', 'Hipotecado') : s.kind === 'lot'
            ? (d.level === MAX_LEVEL ? tr('Resort', 'Resort') : d.level ? tr(`${d.level} hut${d.level > 1 ? 's' : ''}`, `${d.level} cabaña${d.level > 1 ? 's' : ''}`) : ownsGroup(g, 0, s.group!) ? tr('Full color', 'Color completo') : '')
            : '';
          const btns: HTMLElement[] = [];
          if (s.kind === 'lot' && ownsGroup(g, 0, s.group!)) {
            btns.push(act(tr(`Build ${fmt(s.build!)}`, `Construir ${fmt(s.build!)}`), canBuild(g, 0, i), () => build(g, 0, i)));
            if (d.level) btns.push(act(tr(`Sell +${fmt(s.build! / 2)}`, `Vender +${fmt(s.build! / 2)}`), canSellBuilding(g, 0, i), () => sellBuilding(g, 0, i)));
          }
          if (d.mortgaged) btns.push(act(tr(`Unmortgage ${fmt(unmortgageCost(i))}`, `Deshipotecar ${fmt(unmortgageCost(i))}`), g.players[0].cash >= unmortgageCost(i), () => unmortgage(g, 0, i)));
          else btns.push(act(tr(`Mortgage +${fmt(s.price! / 2)}`, `Hipotecar +${fmt(s.price! / 2)}`), canMortgage(g, 0, i), () => mortgage(g, 0, i)));
          list.append(h('div.ty-mrow', {},
            h('span.ty-sw', { style: `background:${s.kind === 'lot' ? GROUP_COLORS[s.group!] : '#c9d3ff'}` }),
            h('div.ty-mname', {}, h('b', {}, sName(i)), h('small.muted', {}, [status, tr(`rent ${fmt(rentFor(g, i, 7))}`, `renta ${fmt(rentFor(g, i, 7))}`)].filter(Boolean).join(' · '))),
            h('div.ty-mbtns', {}, ...btns)));
        }
        renderCells(); renderPlayers();
      };
      draw();
      dialog(tr('My harbor', 'Mi puerto'), list, [{ label: tr('Done', 'Listo'), primary: true, onclick: () => renderAll() }]);
    }

    function trade() {
      const rivals = g.players.map((_, k) => k).filter(k => k !== 0 && !g.players[k].out);
      if (!rivals.length) return;
      let to = rivals[0];
      let give = new Set<number>(), get = new Set<number>(), cash = 0;
      const wrap = h('div.ty-trade');
      const tradeable = (p: number) => g.deeds.map((d, i) => (d?.owner === p && d.level === 0 ? i : -1)).filter(i => i >= 0);
      const chip = (i: number, set: Set<number>) => {
        const b = h('button.ty-deedchip' + (set.has(i) ? '.on' : ''), { onclick: () => { sfx('click'); if (set.has(i)) set.delete(i); else set.add(i); draw(); } },
          h('span.ty-sw', { style: `background:${BOARD[i].kind === 'lot' ? GROUP_COLORS[BOARD[i].group!] : '#c9d3ff'}` }), sName(i) + (g.deeds[i]!.mortgaged ? ' ⚓' : ''));
        return b;
      };
      const draw = () => {
        const mine = tradeable(0), theirs = tradeable(to);
        const step = (v: number) => { cash = Math.max(-g.players[to].cash, Math.min(g.players[0].cash, cash + v)); draw(); };
        wrap.replaceChildren(
          h('div.seg', {}, ...rivals.map(k => h('button.seg-btn' + (k === to ? '.on' : ''), { onclick: () => { to = k; give = new Set(); get = new Set(); cash = 0; draw(); } }, h('span.ty-p-tok.sm', { html: tokenSvg(k) }), pname(k)))),
          h('div.ty-tcol-title', {}, tr('You give', 'Tú das')),
          h('div.ty-chips', {}, ...(mine.length ? mine.map(i => chip(i, give)) : [h('span.muted', {}, tr('Nothing to trade (no buildings allowed)', 'Nada que cambiar (sin construcciones)'))])),
          h('div.ty-tcol-title', {}, tr(`You get from ${pname(to)}`, `Recibes de ${pname(to)}`)),
          h('div.ty-chips', {}, ...(theirs.length ? theirs.map(i => chip(i, get)) : [h('span.muted', {}, tr('They have nothing to trade', 'No tiene nada que cambiar'))])),
          h('div.ty-tcol-title', {}, tr('Cash', 'Dinero')),
          h('div.bet', {},
            h('button.step', { onclick: () => step(-50) }, '−'),
            h('span.bet-val.ty-cashval', {}, cash > 0 ? tr(`You pay ${fmt(cash)}`, `Pagas ${fmt(cash)}`) : cash < 0 ? tr(`They pay ${fmt(-cash)}`, `Te paga ${fmt(-cash)}`) : '0'),
            h('button.step', { onclick: () => step(50) }, '+')),
          h('p.muted.small', {}, tr('Tip: computer players say yes when the deal is good for them, especially if it completes a color.', 'Consejo: los rivales aceptan cuando el trato les conviene, sobre todo si completa un color.')));
      };
      draw();
      dialog(tr('Trade', 'Cambiar'), wrap, [
        { label: tr('Cancel', 'Cancelar') },
        {
          label: tr('Offer', 'Ofrecer'), primary: true, onclick: () => {
            const o: Offer = { from: 0, to, give: [...give], get: [...get], cash };
            if (botAccepts(g, o) && applyOffer(g, o)) {
              sfx('win'); toast(tr(`${pname(to)} accepted!`, `¡${pname(to)} aceptó!`), 'win');
              say(tr(`Trade done with ${pname(to)}`, `Intercambio hecho con ${pname(to)}`));
              persist(); renderAll();
            } else { sfx('lose'); toast(tr(`${pname(to)} said no`, `${pname(to)} dijo que no`), 'lose'); }
          },
        },
      ]);
    }

    renderAll();
    if (g.phase === 'over') finish();
    else if (g.current !== 0) void botLoop();
    else say(g.phase === 'buy' ? tr(`${sName(g.players[0].pos)} is for sale`, `${sName(g.players[0].pos)} está en venta`) : tr('Your turn: roll the dice', 'Tu turno: tira los dados'));
  }

  return () => { alive = false; };
};
