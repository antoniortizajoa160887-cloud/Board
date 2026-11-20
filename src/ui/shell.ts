import { applyVolumes, sfx } from '../audio';
import { canClaimDaily, DAILY_BONUS, needsRefill, REFILL_CHIPS, refillWaitMs, today } from '../core/wallet';
import { addChips, onChips, profile, resetProfile, save } from '../save';
import { APP_VERSION, checkForUpdate, RELEASE_PAGE } from '../update';
import { openExternal } from '../platform';
import { coinBurst, countUp, fmt, h, toast } from './dom';
import { back, refresh } from './router';
import { setLang, tr, type Lang } from '../i18n';

/** The top bar every screen shares: back, title, chip balance, daily bonus, settings. */
export function topBar(title: string, opts: { showBack?: boolean } = {}): HTMLElement {
  const chips = h('span.chip-count', {}, fmt(profile.wallet.chips));
  let shown = profile.wallet.chips;
  const off = onChips(() => {
    countUp(chips, shown, profile.wallet.chips, 600);
    shown = profile.wallet.chips;
  });
  const bar = h('header.topbar', {},
    opts.showBack !== false ? h('button.icon-btn.back', { 'aria-label': tr('Back', 'Atrás'), onclick: () => { sfx('click'); back(); } }, '‹') : h('span.logo-dot', {}, '◆'),
    h('div.title', {}, title),
    h('button.chips-pill', { 'aria-label': tr('Chips', 'Fichas'), onclick: () => bonusDialog() }, h('span.coin'), chips, dailyDot()),
    h('button.icon-btn', { 'aria-label': tr('Settings', 'Ajustes'), onclick: () => settingsDialog() }, '⚙'),
  );
  // Stop listening once the bar leaves the page.
  const mo = new MutationObserver(() => { if (!bar.isConnected) { off(); mo.disconnect(); } });
  mo.observe(document.getElementById('app')!, { childList: true, subtree: true });
  return bar;
}

function dailyDot() {
  return canClaimDaily(profile.wallet) || (needsRefill(profile.wallet) && refillWaitMs(profile.wallet) === 0) ? h('span.dot') : null;
}

export function dialog(title: string, body: HTMLElement, buttons: { label: string; primary?: boolean; onclick?: () => void }[] = [{ label: tr('Close', 'Cerrar') }]) {
  const scrim = h('div.dialog-scrim', { onclick: (e: Event) => { if (e.target === scrim) scrim.remove(); } });
  const box = h('div.dialog', {}, h('h2', {}, title), body,
    h('div.dialog-btns', {}, ...buttons.map(b => h('button.btn' + (b.primary ? '.primary' : ''), { onclick: () => { sfx('click'); scrim.remove(); b.onclick?.(); } }, b.label))));
  scrim.append(box);
  document.body.append(scrim);
  return scrim;
}

export function bonusDialog() {
  const w = profile.wallet;
  const body = h('div.bonus');
  body.append(h('p', {}, tr('Play chips only. They have no money value and can\'t be bought.', 'Solo fichas de juego. No tienen valor en dinero y no se pueden comprar.')));
  const daily = canClaimDaily(w);
  body.append(h('div.bonus-row', {}, h('span', {}, tr(`Daily bonus: ${fmt(DAILY_BONUS)} chips`, `Bono diario: ${fmt(DAILY_BONUS)} fichas`)),
    h('button.btn.primary', { disabled: !daily, onclick: (e: Event) => {
      w.lastDaily = today();
      addChips(DAILY_BONUS);
      sfx('bigwin');
      coinBurst(e.target as Element, 26);
      (e.target as HTMLButtonElement).disabled = true;
      (e.target as HTMLButtonElement).textContent = tr('Claimed', 'Cobrado');
      toast(tr(`+${fmt(DAILY_BONUS)} chips`, `+${fmt(DAILY_BONUS)} fichas`), 'win');
    } }, daily ? tr('Claim', 'Cobrar') : tr('Claimed', 'Cobrado'))));
  const wait = refillWaitMs(w);
  const canRefill = needsRefill(w) && wait === 0;
  body.append(h('div.bonus-row', {}, h('span', {}, tr(`Lagoon refill: ${fmt(REFILL_CHIPS)} chips when you're under 100`, `Recarga de la laguna: ${fmt(REFILL_CHIPS)} fichas cuando tienes menos de 100`)),
    h('button.btn', { disabled: !canRefill, onclick: (e: Event) => {
      w.lastRefill = Date.now();
      addChips(REFILL_CHIPS);
      sfx('win');
      coinBurst(e.target as Element);
      (e.target as HTMLButtonElement).disabled = true;
    } }, canRefill ? tr('Refill', 'Recargar') : wait > 0 && needsRefill(w) ? tr(`in ${Math.ceil(wait / 60000)} min`, `en ${Math.ceil(wait / 60000)} min`) : tr('Not needed', 'No hace falta'))));
  body.append(h('p.muted', {}, tr(`Biggest win: ${fmt(w.biggestWin)} chips`, `Mayor premio: ${fmt(w.biggestWin)} fichas`)));
  dialog(tr('Chips', 'Fichas'), body);
}

export function settingsDialog() {
  const s = profile.settings;
  const toggle = (label: string, key: 'sound' | 'music' | 'vibration' | 'voice') => {
    const input = h('input', { type: 'checkbox', onchange: () => { s[key] = input.checked; save(); applyVolumes(); } }) as HTMLInputElement;
    input.checked = s[key];
    return h('label.toggle', {}, h('span', {}, label), input);
  };
  const body = h('div.settings', {},
    h('div.lang-row', {}, h('span', {}, tr('Language', 'Idioma')), h('div.seg', {}, ...(['en', 'es'] as Lang[]).map(l => h('button.seg-btn' + (s.lang === l ? '.on' : ''), { onclick: () => { if (s.lang === l) return; setLang(l); document.querySelectorAll('.dialog-scrim').forEach(d => d.remove()); refresh(); settingsDialog(); } }, l === 'en' ? 'English' : 'Español')))),
    toggle(tr('Music', 'Música'), 'music'), toggle(tr('Sound effects', 'Efectos de sonido'), 'sound'), toggle(tr('Ollie\'s voice', 'Voz de Ollie'), 'voice'), toggle(tr('Vibration', 'Vibración'), 'vibration'),
    h('div.settings-links', {},
      h('button.btn', { onclick: async () => {
        const r = await checkForUpdate(true);
        toast(r === 'new' ? tr('A new version is ready', 'Hay una versión nueva') : r === 'same' ? tr('You have the newest version', 'Tienes la versión más nueva') : tr('Couldn\'t check right now', 'No se pudo comprobar ahora'));
      } }, tr('Check for updates', 'Buscar actualizaciones')),
      h('button.btn', { onclick: () => openExternal(RELEASE_PAGE) }, tr('Open the download page', 'Abrir la página de descarga')),
      h('button.btn.danger', { onclick: () => {
        dialog(tr('Start over?', '¿Empezar de nuevo?'), h('p', {}, tr('This resets your chips, jackpot and stats.', 'Esto reinicia tus fichas, el premio mayor y las estadísticas.')), [
          { label: tr('Cancel', 'Cancelar') },
          { label: tr('Start over', 'Empezar de nuevo'), primary: true, onclick: () => { resetProfile(); toast(tr('Fresh start', 'Comienzo nuevo')); } },
        ]);
      } }, tr('Start over', 'Empezar de nuevo'))),
    h('p.muted', {}, tr(`Lucky Lagoon ${APP_VERSION} · personal, non-commercial · play chips only`, `Lucky Lagoon ${APP_VERSION} · uso personal, no comercial · solo fichas de juego`)));
  dialog(tr('Settings', 'Ajustes'), body);
}
