import { JACKPOT_SEED } from './core/slots';
import { START_CHIPS, type Wallet } from './core/wallet';
import { DEFAULT_RULES, type Rules } from './core/colors';
import type { Game as TycoonGame } from './core/tycoon';

export interface Settings { sound: boolean; music: boolean; vibration: boolean; voice: boolean; lang: 'en' | 'es' }

export interface Stats { played: Record<string, number>; won: Record<string, number> }

export interface Profile { wallet: Wallet; settings: Settings; stats: Stats; colors: { rules: Rules; opponents: number }; zip: { stars: number[] }; tycoon: TycoonGame | null; pokerBingo: { boards: number[] } }

const KEY = 'lucky-lagoon-v1';

function fresh(): Profile {
  return {
    wallet: { chips: START_CHIPS, lastDaily: '', lastRefill: 0, jackpot: JACKPOT_SEED, biggestWin: 0 },
    settings: { sound: true, music: true, vibration: true, voice: true, lang: typeof navigator !== 'undefined' && /^es/i.test(navigator.language) ? 'es' : 'en' },
    stats: { played: {}, won: {} },
    colors: { rules: { ...DEFAULT_RULES }, opponents: 3 },
    zip: { stars: [] },
    tycoon: null,
    pokerBingo: { boards: [1, 2] },
  };
}

/** Saved Poker Bingo board numbers (1–12, up to 4), or null when the saved value is unusable. */
function pickedBoards(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const ok = [...new Set(v.filter(n => Number.isInteger(n) && n >= 1 && n <= 12))].slice(0, 4);
  return ok.length ? ok : null;
}

function load(): Profile {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      wallet: { ...base.wallet, ...p.wallet },
      settings: { ...base.settings, ...p.settings },
      stats: { played: { ...p.stats?.played }, won: { ...p.stats?.won } },
      colors: { rules: { ...base.colors.rules, ...p.colors?.rules }, opponents: p.colors?.opponents ?? base.colors.opponents },
      zip: { stars: Array.isArray(p.zip?.stars) ? p.zip!.stars : [] },
      tycoon: p.tycoon && Array.isArray(p.tycoon.players) && Array.isArray(p.tycoon.deeds) ? { ...p.tycoon, events: [] } : null,
      pokerBingo: { boards: pickedBoards(p.pokerBingo?.boards) ?? base.pokerBingo.boards },
    };
  } catch {
    return base;
  }
}

export const profile: Profile = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage full or blocked */ }
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onChips(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

/** Changes the chip count (negative = spend). Returns false if the player can't afford it. */
export function addChips(delta: number): boolean {
  if (delta < 0 && profile.wallet.chips + delta < 0) return false;
  profile.wallet.chips += delta;
  if (delta > profile.wallet.biggestWin) profile.wallet.biggestWin = delta;
  save();
  listeners.forEach(l => l());
  return true;
}

export function countPlay(game: string, won: boolean) {
  profile.stats.played[game] = (profile.stats.played[game] ?? 0) + 1;
  if (won) profile.stats.won[game] = (profile.stats.won[game] ?? 0) + 1;
  save();
}

export function resetProfile() {
  Object.assign(profile, fresh());
  save();
  listeners.forEach(l => l());
}
