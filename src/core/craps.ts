/**
 * Craps with the classic bets: Pass Line, Don't Pass (12 is a push), Pass odds (true odds),
 * Field (one roll: 2 and 12 pay double), Any Seven (one roll, 4 to 1) and Any Craps (one roll, 7 to 1).
 */
export type CrapsBet = 'pass' | 'dontPass' | 'odds' | 'field' | 'any7' | 'anyCraps';

export interface CrapsState { point: number | null; bets: Partial<Record<CrapsBet, number>> }

export interface RollResult { returned: Partial<Record<CrapsBet, number>>; lost: CrapsBet[]; newPoint: number | null; message: 'natural' | 'craps' | 'point' | 'hit' | 'seven-out' | 'roll' }

const POINTS = [4, 5, 6, 8, 9, 10];

/** True odds on a point: 4/10 pay 2 to 1, 5/9 pay 3 to 2, 6/8 pay 6 to 5. Returns the winnings (not the stake). */
export function oddsWin(point: number, amount: number): number {
  if (point === 4 || point === 10) return amount * 2;
  if (point === 5 || point === 9) return Math.floor(amount * 3 / 2);
  return Math.floor(amount * 6 / 5);
}

/** Settles one roll. Bets that stay on the table keep their chips in state.bets; settled ones are removed. */
export function roll(state: CrapsState, d1: number, d2: number): RollResult {
  const sum = d1 + d2;
  const bets = state.bets;
  const returned: RollResult['returned'] = {};
  const lost: CrapsBet[] = [];
  const pay = (b: CrapsBet, amt: number) => { returned[b] = amt; delete bets[b]; };
  const lose = (b: CrapsBet) => { if (bets[b]) lost.push(b); delete bets[b]; };

  // One-roll bets.
  if (bets.field) { if ([2, 12].includes(sum)) pay('field', bets.field * 3); else if ([3, 4, 9, 10, 11].includes(sum)) pay('field', bets.field * 2); else lose('field'); }
  if (bets.any7) { if (sum === 7) pay('any7', bets.any7 * 5); else lose('any7'); }
  if (bets.anyCraps) { if ([2, 3, 12].includes(sum)) pay('anyCraps', bets.anyCraps * 8); else lose('anyCraps'); }

  let message: RollResult['message'] = 'roll';
  let newPoint = state.point;
  if (state.point === null) {
    if (sum === 7 || sum === 11) { if (bets.pass) pay('pass', bets.pass * 2); lose('dontPass'); message = 'natural'; }
    else if (sum === 2 || sum === 3) { lose('pass'); if (bets.dontPass) pay('dontPass', bets.dontPass * 2); message = 'craps'; }
    else if (sum === 12) { lose('pass'); if (bets.dontPass) pay('dontPass', bets.dontPass); message = 'craps'; }
    else { newPoint = sum; message = 'point'; }
  } else if (sum === state.point) {
    if (bets.pass) pay('pass', bets.pass * 2);
    if (bets.odds) pay('odds', bets.odds + oddsWin(state.point, bets.odds));
    lose('dontPass');
    newPoint = null; message = 'hit';
  } else if (sum === 7) {
    lose('pass'); lose('odds');
    if (bets.dontPass) pay('dontPass', bets.dontPass * 2);
    newPoint = null; message = 'seven-out';
  }
  state.point = newPoint;
  return { returned, lost, newPoint, message };
}

export const isPoint = (n: number) => POINTS.includes(n);
