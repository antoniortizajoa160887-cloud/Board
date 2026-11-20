/**
 * Checkers (8×8, captures are a must, jumps chain, men crown on the far row).
 * Board cells: 0 empty, 1 / 2 = your man / king (moving up), -1 / -2 = the computer's.
 */
export type Board = number[];
export interface Move { path: number[]; caps: number[] }

export const idx = (r: number, c: number) => r * 8 + c;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function startBoard(): Board {
  const b = Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 0) continue;
    if (r < 3) b[idx(r, c)] = -1;
    else if (r > 4) b[idx(r, c)] = 1;
  }
  return b;
}

const dirsFor = (piece: number) => (Math.abs(piece) === 2 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : piece > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);

function jumps(b: Board, from: number, piece: number, path: number[], caps: number[], out: Move[]) {
  const r = Math.floor(from / 8), c = from % 8;
  let found = false;
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
    if (!inside(tr, tc)) continue;
    const mid = idx(mr, mc), to = idx(tr, tc);
    if (b[mid] * piece >= 0 || b[to] !== 0 || caps.includes(mid)) continue;
    found = true;
    const crowned = Math.abs(piece) === 1 && (piece > 0 ? tr === 0 : tr === 7);
    if (crowned) out.push({ path: [...path, to], caps: [...caps, mid] });
    else {
      const nb = b.slice(); nb[from] = 0; nb[to] = piece;
      jumps(nb, to, piece, [...path, to], [...caps, mid], out);
    }
  }
  if (!found && caps.length) out.push({ path, caps });
}

/** Every legal move for a side (1 = you, -1 = computer). Captures are compulsory. */
export function legalMoves(b: Board, side: 1 | -1): Move[] {
  const caps: Move[] = [], steps: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p * side <= 0) continue;
    jumps(b, i, p, [i], [], caps);
    const r = Math.floor(i / 8), c = i % 8;
    for (const [dr, dc] of dirsFor(p)) {
      const tr = r + dr, tc = c + dc;
      if (inside(tr, tc) && b[idx(tr, tc)] === 0) steps.push({ path: [i, idx(tr, tc)], caps: [] });
    }
  }
  return caps.length ? caps : steps;
}

export function apply(b: Board, m: Move): Board {
  const nb = b.slice();
  const from = m.path[0], to = m.path[m.path.length - 1];
  let piece = nb[from];
  nb[from] = 0;
  for (const c of m.caps) nb[c] = 0;
  const r = Math.floor(to / 8);
  if (piece === 1 && r === 0) piece = 2;
  if (piece === -1 && r === 7) piece = -2;
  nb[to] = piece;
  return nb;
}

/** Score from the computer's side. */
function evaluate(b: Board): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const r = Math.floor(i / 8), c = i % 8;
    let v = Math.abs(p) === 2 ? 175 : 100;
    if (Math.abs(p) === 1) v += (p < 0 ? r : 7 - r) * 4; // advance
    if (c > 1 && c < 6 && r > 1 && r < 6) v += 6; // centre
    if ((p === -1 && r === 0) || (p === 1 && r === 7)) v += 8; // back row guard
    s += p < 0 ? v : -v;
  }
  return s;
}

function search(b: Board, depth: number, side: 1 | -1, alpha: number, beta: number): number {
  const moves = legalMoves(b, side);
  if (!moves.length) return side === -1 ? -100000 - depth : 100000 + depth;
  if (depth === 0) return evaluate(b);
  if (side === -1) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(b, m), depth - 1, 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(b, m), depth - 1, -1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move. Level 1 (easy) to 3 (hard); easy sometimes plays a random move. */
export function aiMove(b: Board, level: 1 | 2 | 3, rng: () => number): Move | null {
  const moves = legalMoves(b, -1);
  if (!moves.length) return null;
  if (level === 1 && rng() < 0.35) return moves[Math.floor(rng() * moves.length)];
  const depth = level === 1 ? 2 : level === 2 ? 4 : 6;
  let best = -Infinity, pick: Move[] = [];
  for (const m of moves) {
    const v = search(apply(b, m), depth - 1, 1, -Infinity, Infinity);
    if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m);
  }
  return pick[Math.floor(rng() * pick.length)];
}

export function count(b: Board, side: 1 | -1) { return b.filter(p => p * side > 0).length; }
