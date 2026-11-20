/** Play chips only: there is no real money anywhere in the app. */
export const START_CHIPS = 5000;
export const DAILY_BONUS = 1000;
export const REFILL_CHIPS = 1000;
export const REFILL_EVERY_MS = 60 * 60 * 1000;

export interface Wallet {
  chips: number;
  lastDaily: string; // YYYY-MM-DD of the last daily bonus
  lastRefill: number; // ms
  jackpot: number;
  biggestWin: number;
}

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function canClaimDaily(w: Wallet, now = new Date()): boolean {
  return w.lastDaily !== today(now);
}

/** A free refill when the player is nearly out of chips, at most once an hour. */
export function refillWaitMs(w: Wallet, now = Date.now()): number {
  return Math.max(0, w.lastRefill + REFILL_EVERY_MS - now);
}
export const needsRefill = (w: Wallet) => w.chips < 100;
