/** Single-zero roulette (37 pockets). */
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Color = 'red' | 'black' | 'green';
export const colorOf = (n: number): Color => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

export type BetKind =
  | { kind: 'number'; n: number }
  | { kind: 'red' } | { kind: 'black' }
  | { kind: 'odd' } | { kind: 'even' }
  | { kind: 'low' } | { kind: 'high' }
  | { kind: 'dozen'; d: 0 | 1 | 2 }
  | { kind: 'column'; c: 0 | 1 | 2 };

export function betKey(b: BetKind): string {
  if (b.kind === 'number') return `n${b.n}`;
  if (b.kind === 'dozen') return `d${b.d}`;
  if (b.kind === 'column') return `c${b.c}`;
  return b.kind;
}

export function parseKey(key: string): BetKind {
  if (key[0] === 'n') return { kind: 'number', n: Number(key.slice(1)) };
  if (key[0] === 'd' && key.length === 2) return { kind: 'dozen', d: Number(key[1]) as 0 | 1 | 2 };
  if (key[0] === 'c' && key.length === 2) return { kind: 'column', c: Number(key[1]) as 0 | 1 | 2 };
  return { kind: key } as BetKind;
}

/** Does the bet win on this pocket? */
export function wins(b: BetKind, n: number): boolean {
  if (b.kind === 'number') return b.n === n;
  if (n === 0) return false;
  switch (b.kind) {
    case 'red': return colorOf(n) === 'red';
    case 'black': return colorOf(n) === 'black';
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'dozen': return Math.floor((n - 1) / 12) === b.d;
    case 'column': return (n - 1) % 3 === b.c;
  }
}

/** Winnings ratio (paid on top of the stake). */
export function ratio(b: BetKind): number {
  if (b.kind === 'number') return 35;
  if (b.kind === 'dozen' || b.kind === 'column') return 2;
  return 1;
}

/** Total paid back (stakes of winning bets included) for a set of bets {key: amount}. */
export function payout(bets: Record<string, number>, n: number): number {
  let total = 0;
  for (const [key, amount] of Object.entries(bets)) {
    const b = parseKey(key);
    if (wins(b, n)) total += amount * (ratio(b) + 1);
  }
  return total;
}
