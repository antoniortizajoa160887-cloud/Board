import { describe, expect, it } from 'vitest';
import { chipsFor, makeWorld, reachable, starsFor, step, type Input, type World } from '../src/core/platformer';
import { LEVELS, levelRows } from '../src/core/zipLevels';

const idle: Input = { left: false, right: false, jump: false, jumpPressed: false };
const run = (w: World, inp: Partial<Input>, secs: number) => { for (let t = 0; t < secs; t += 1 / 120) step(w, { ...idle, ...inp }, 1 / 120); };

describe('Zip levels', () => {
  for (const def of LEVELS) {
    it(`${def.name} is rectangular, has a start and a goal that can be reached`, () => {
      const rows = levelRows(def);
      expect(rows).toHaveLength(12);
      expect(new Set(rows.map(r => r.length)).size).toBe(1);
      expect(rows.join('')).toContain('S');
      expect(rows.join('')).toContain('G');
      const r = reachable(def);
      expect(r.goal).toBe(true);
      expect(r.pearlsNear).toBe(r.pearls);
    });
  }
});

describe('Zip physics', () => {
  it('falls onto the ground and stands', () => {
    const w = makeWorld(LEVELS[0]);
    run(w, {}, 1);
    expect(w.p.onGround).toBe(true);
    expect(w.p.y + w.p.h).toBeCloseTo(10, 2);
  });
  it('runs right and picks up pearls on the way', () => {
    const w = makeWorld(LEVELS[0]);
    run(w, {}, 0.5);
    const x0 = w.p.x;
    run(w, { right: true }, 1);
    expect(w.p.x).toBeGreaterThan(x0 + 4);
  });
  it('jumps about 2.6 tiles, and the jet jump adds more', () => {
    const w = makeWorld(LEVELS[0]);
    run(w, {}, 0.5);
    const y0 = w.p.y;
    step(w, { ...idle, jump: true, jumpPressed: true }, 1 / 120);
    let top = w.p.y;
    for (let i = 0; i < 200 && w.p.vy < 0; i++) { step(w, { ...idle, jump: true }, 1 / 120); top = Math.min(top, w.p.y); }
    expect(y0 - top).toBeGreaterThan(2.3);
    expect(y0 - top).toBeLessThan(2.9);
    step(w, { ...idle, jump: true, jumpPressed: true }, 1 / 120);
    for (let i = 0; i < 80; i++) { step(w, { ...idle, jump: true }, 1 / 120); top = Math.min(top, w.p.y); }
    expect(y0 - top).toBeGreaterThan(4.2);
  });
  it('stomps a crab from above and gets hurt from the side', () => {
    const w = makeWorld(LEVELS[0]);
    run(w, {}, 0.5);
    w.enemies = [{ kind: 'crab', x: w.p.x, y: w.p.y + 2, w: 0.8, h: 0.65, vx: 0, vy: 0, alive: true, deadT: 0, baseY: 0, t: 0 }];
    w.p.y -= 3; w.p.vy = 5;
    w.enemies[0].y = w.p.y + 2.5;
    run(w, {}, 0.3);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.hearts).toBe(3);
    const w2 = makeWorld(LEVELS[0]);
    run(w2, {}, 0.5);
    w2.enemies = [{ kind: 'crab', x: w2.p.x + 0.5, y: w2.p.y + 0.25, w: 0.8, h: 0.65, vx: 0, vy: 0, alive: true, deadT: 0, baseY: 0, t: 0 }];
    run(w2, {}, 0.05);
    expect(w2.hearts).toBe(2);
  });
  it('falling out costs a heart and puts Zip back at the checkpoint', () => {
    const w = makeWorld(LEVELS[0]);
    run(w, {}, 0.3);
    w.p.y = 20; w.p.x = 3;
    run(w, {}, 0.05);
    expect(w.hearts).toBe(2);
    expect(w.p.y).toBeLessThan(12);
  });
  it('reaching the goal wins and gives stars and chips', () => {
    const w = makeWorld(LEVELS[0]);
    run(w, {}, 0.3);
    const gx = levelRows(LEVELS[0])[9].indexOf('G');
    w.p.x = gx; w.p.y = 9;
    run(w, {}, 0.05);
    expect(w.state).toBe('won');
    expect(starsFor(w)).toBe(2);
    expect(chipsFor(w, 0)).toBe(25 + 100);
  });
});
