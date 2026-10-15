import { describe, expect, it } from 'vitest';
import { drop, fits, move, newBlocks, tick as fall, turn, WELL_H, WELL_W } from '../src/arcade/blocks';
import { MAZE, newMaze, open, steer, tick } from '../src/arcade/maze';

describe('Цеглинки', () => {
  it('a piece falls, lands and the next one appears', () => {
    const g = newBlocks(42);
    const first = g.piece.shape;
    const y0 = g.piece.y;
    fall(g);
    expect(g.piece.y).toBe(y0 + 1);
    drop(g);
    expect(g.well.some((row) => row.some((c) => c === first + 1))).toBe(true);
    expect(g.piece.y).toBe(0);
  });

  it('a full row vanishes and scores', () => {
    const g = newBlocks(1);
    g.well[WELL_H - 1] = Array(WELL_W).fill(1);
    g.well[WELL_H - 1][0] = 0;
    // a vertical bar dropped into the gap at the left
    g.piece = { shape: 0, cells: [[0, 0], [0, 1], [0, 2], [0, 3]], x: 0, y: 0 };
    const cleared = drop(g);
    expect(cleared).toBe(1);
    expect(g.lines).toBe(1);
    expect(g.score).toBeGreaterThanOrEqual(100);
    expect(g.well[WELL_H - 1].filter((c) => c !== 0).length).toBe(1);
  });

  it('walls stop the piece and turning keeps it inside', () => {
    const g = newBlocks(7);
    for (let i = 0; i < 12; i++) move(g, -1, 0);
    expect(fits(g, g.piece)).toBe(true);
    for (let i = 0; i < 4; i++) turn(g);
    expect(fits(g, g.piece)).toBe(true);
    expect(g.piece.cells.every(([x]) => g.piece.x + x >= 0)).toBe(true);
  });

  it('the game ends when the well is full', () => {
    const g = newBlocks(3);
    for (let i = 0; i < 200 && !g.over; i++) drop(g);
    expect(g.over).toBe(true);
  });

  it('the same seed gives the same pieces', () => {
    const a = newBlocks(99);
    const b = newBlocks(99);
    for (let i = 0; i < 10; i++) {
      drop(a);
      drop(b);
    }
    expect(a.well).toEqual(b.well);
  });
});

describe('Котик у лабіринті', () => {
  it('the maze is a closed rectangle with crumbs, fish and a den', () => {
    expect(new Set(MAZE.map((r) => r.length)).size).toBe(1);
    const m = newMaze(5);
    expect(m.crumbs.size).toBeGreaterThan(100);
    expect(m.fish.size).toBe(4);
    expect(m.den.length).toBe(3);
  });

  it('every crumb can be reached by the cat', () => {
    const m = newMaze(5);
    const seen = new Set([`${m.start[0]},${m.start[1]}`]);
    const queue = [m.start];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const d of [0, 1, 2, 3] as const) {
        if (!open(m, x, y, d)) continue;
        const nx = (x + [0, 1, 0, -1][d] + m.w) % m.w;
        const ny = y + [-1, 0, 1, 0][d];
        if (!seen.has(`${nx},${ny}`)) {
          seen.add(`${nx},${ny}`);
          queue.push([nx, ny]);
        }
      }
    }
    for (const c of [...m.crumbs, ...m.fish]) expect(seen.has(c), c).toBe(true);
  });

  it('the cat eats crumbs as it walks and turns where asked', () => {
    const m = newMaze(5);
    const crumbs = m.crumbs.size;
    for (let i = 0; i < 20; i++) tick(m);
    expect(m.crumbs.size).toBeLessThan(crumbs);
    expect(m.score).toBeGreaterThan(0);
    steer(m, 0);
    const x = m.cat.x;
    for (let i = 0; i < 12; i++) tick(m);
    expect(m.cat.x !== x || m.cat.dir === 0).toBe(true);
  });

  it('the dogs come out of the den one by one', () => {
    const m = newMaze(11);
    const out = new Set<number>([0]);
    for (let i = 0; i < 400; i++) {
      m.dogs[0].wait = 99; // the first one dozes outside, so the cat is never caught
      tick(m);
      m.dogs.forEach((d, j) => d.y !== 9 && out.add(j));
    }
    expect(out.size).toBe(4);
  });

  it('a cat left standing is caught three times and the game ends', () => {
    const m = newMaze(11);
    for (let i = 0; i < 4000 && !m.over; i++) tick(m);
    expect(m.over).toBe(true);
    expect(m.lives).toBe(0);
  });
});
