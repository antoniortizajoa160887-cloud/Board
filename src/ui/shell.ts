import { applyVolumes, sfx } from '../audio';
import { canClaimDaily, DAILY_BONUS, needsRefill, REFILL_CHIPS, refillWaitMs, today } from '../core/wallet';
import { addChips, onChips, profile, resetProfile, save } from '../save';
import { APP_VERSION, checkForUpdate, RELEASE_PAGE } from '../update';
import { openExternal } from '../platform';
import { coinBurst, countUp, fmt, h, toast } from './dom';
import { back } from './router';

/** The top bar every screen shares: back, title, chip balance, daily bonus, settings. */
export function topBar(title: string, opts: { showBack?: boolean } = {}): HTMLElement {
  const chips = h('span.chip-count', {}, fmt(profile.wallet.chips));
  let shown = profile.wallet.chips;
  const off = onChips(() => {
    countUp(chips, shown, profile.wallet.chips, 600);
    shown = profile.wallet.chips;
  });
  const bar = h('header.topbar', {},
    opts.showBack !== false ? h('button.icon-btn.back', { 'aria-label': 'Back', onclick: () => { sfx('click'); back(); } }, '‹') : h('span.logo-dot', {}, '◆'),
    h('div.title', {}, title),
    h('button.chips-pill', { 'aria-label': 'Chips', onclick: () => bonusDialog() }, h('span.coin'), chips, dailyDot()),
    h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => settingsDialog() }, '⚙'),
  );
  // Stop listening once the bar leaves the page.
  const mo = new MutationObserver(() => { if (!bar.isConnected) { off(); mo.disconnect(); } });
  mo.observe(document.getElementById('app')!, { childList: true, subtree: true });
  return bar;
}

function dailyDot() {
  return canClaimDaily(profile.wallet) || (needsRefill(profile.wallet) && refillWaitMs(profile.wallet) === 0) ? h('span.dot') : null;
}

export function dialog(title: string, body: HTMLElement, buttons: { label: string; primary?: boolean; onclick?: () => void }[] = [{ label: 'Close' }]) {
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
  body.append(h('p', {}, 'Play chips only. They have no money value and can\'t be bought.'));
  const daily = canClaimDaily(w);
  body.append(h('div.bonus-row', {}, h('span', {}, `Daily bonus: ${fmt(DAILY_BONUS)} chips`),
    h('button.btn.primary', { disabled: !daily, onclick: (e: Event) => {
      w.lastDaily = today();
      addChips(DAILY_BONUS);
      sfx('bigwin');
      coinBurst(e.target as Element, 26);
      (e.target as HTMLButtonElement).disabled = true;
      (e.target as HTMLButtonElement).textContent = 'Claimed';
      toast(`+${fmt(DAILY_BONUS)} chips`, 'win');
    } }, daily ? 'Claim' : 'Claimed')));
  const wait = refillWaitMs(w);
  const canRefill = needsRefill(w) && wait === 0;
  body.append(h('div.bonus-row', {}, h('span', {}, `Lagoon refill: ${fmt(REFILL_CHIPS)} chips when you're under 100`),
    h('button.btn', { disabled: !canRefill, onclick: (e: Event) => {
      w.lastRefill = Date.now();
      addChips(REFILL_CHIPS);
      sfx('win');
      coinBurst(e.target as Element);
      (e.target as HTMLButtonElement).disabled = true;
    } }, canRefill ? 'Refill' : wait > 0 && needsRefill(w) ? `in ${Math.ceil(wait / 60000)} min` : 'Not needed')));
  body.append(h('p.muted', {}, `Biggest win: ${fmt(w.biggestWin)} chips`));
  dialog('Chips', body);
}

export function settingsDialog() {
  const s = profile.settings;
  const toggle = (label: string, key: keyof typeof s) => {
    const input = h('input', { type: 'checkbox', onchange: () => { s[key] = input.checked; save(); applyVolumes(); } }) as HTMLInputElement;
    input.checked = s[key];
    return h('label.toggle', {}, h('span', {}, label), input);
  };
  const body = h('div.settings', {},
    toggle('Music', 'music'), toggle('Sound effects', 'sound'), toggle('Vibration', 'vibration'),
    h('div.settings-links', {},
      h('button.btn', { onclick: async () => {
        const r = await checkForUpdate(true);
        toast(r === 'new' ? 'A new version is ready' : r === 'same' ? 'You have the newest version' : 'Couldn\'t check right now');
      } }, 'Check for updates'),
      h('button.btn', { onclick: () => openExternal(RELEASE_PAGE) }, 'Open the download page'),
      h('button.btn.danger', { onclick: () => {
        dialog('Start over?', h('p', {}, 'This resets your chips, jackpot and stats.'), [
          { label: 'Cancel' },
          { label: 'Start over', primary: true, onclick: () => { resetProfile(); toast('Fresh start'); } },
        ]);
      } }, 'Start over')),
    h('p.muted', {}, `Lucky Lagoon ${APP_VERSION} · personal, non-commercial · play chips only`));
  dialog('Settings', body);
}
