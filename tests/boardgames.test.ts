import { describe, expect, it } from 'vitest';
import { aiMove, apply, count, idx, legalMoves, startBoard } from '../src/core/checkers';
import { aiColumn, drop, emptyGrid, landRow, winLine, at } from '../src/core/four';
import { makeRng } from '../src/core/rng';

describe('Checkers', () => {
  it('starts with 12 each and 7 opening moves', () => {
    const b = startBoard();
    expect(count(b, 1)).toBe(12);
    expect(count(b, -1)).toBe(12);
    expect(legalMoves(b, 1).length).toBe(7);
  });
  it('forces captures and chains double jumps', () => {
    const b = Array(64).fill(0);
    b[idx(6, 1)] = 1; b[idx(5, 2)] = -1; b[idx(3, 4)] = -1; b[idx(6, 5)] = 1;
    const m = legalMoves(b, 1);
    expect(m.length).toBe(1);
    expect(m[0].caps.length).toBe(2);
    expect(m[0].path).toEqual([idx(6, 1), idx(4, 3), idx(2, 5)]);
    const nb = apply(b, m[0]);
    expect(count(nb, -1)).toBe(0);
  });
  it('crowns on the far row', () => {
    const b = Array(64).fill(0);
    b[idx(1, 2)] = 1;
    const nb = apply(b, legalMoves(b, 1)[0]);
    expect(nb.some(p => p === 2)).toBe(true);
  });
  it('the computer takes a free piece', () => {
    const b = Array(64).fill(0);
    b[idx(2, 1)] = -1; b[idx(3, 2)] = 1; b[idx(7, 6)] = 1;
    const m = aiMove(b, 3, makeRng(1))!;
    expect(m.caps).toEqual([idx(3, 2)]);
  });
});

describe('Four in a Row', () => {
  it('stacks discs and finds a line', () => {
    let g = emptyGrid();
    expect(landRow(g, 0)).toBe(5);
    for (let c = 0; c < 4; c++) g = drop(g, c, 1)!;
    expect(winLine(g)).toEqual([at(5, 0), at(5, 1), at(5, 2), at(5, 3)]);
  });
  it('the computer wins when it can and blocks you', () => {
    let g = emptyGrid();
    for (let c = 0; c < 3; c++) g = drop(g, c, -1)!;
    expect(aiColumn(g, 3, makeRng(1))).toBe(3);
    let h = emptyGrid();
    for (let k = 0; k < 3; k++) h = drop(h, 6, 1)!;
    expect(aiColumn(h, 2, makeRng(2))).toBe(6);
  });
});
