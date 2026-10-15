import { describe, expect, it } from 'vitest';
import { doorwayOf, findSpot } from '../src/rooms';

const square = (n: number) => Array.from({ length: n * n }, (_, i) => [i % n, Math.floor(i / n)] as [number, number]);

describe('findSpot', () => {
  it('puts a new room flush against the home, touching it along a whole side', () => {
    const s = findSpot(square(10), 6, 10)!;
    expect(s).not.toBeNull();
    expect(s.shared).toHaveLength(10);
    expect([s.x, s.y]).toEqual([10, 0]);
  });

  it('never overlaps existing cells and stays inside the grid', () => {
    const s = findSpot(square(10), 30, 30);
    expect(s).toBeNull();
    const t = findSpot(square(10), 6, 6)!;
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) expect(t.x + i >= 10 || t.y + j >= 10).toBe(true);
  });

  it('prefers the spot that touches the most', () => {
    const l = [...square(10), ...Array.from({ length: 60 }, (_, i) => [10 + (i % 6), Math.floor(i / 6)] as [number, number])];
    const s = findSpot(l, 6, 6)!;
    expect(s.shared.length).toBeGreaterThanOrEqual(6);
  });
});

describe('doorwayOf', () => {
  it('picks an edge in the middle of the longest shared side', () => {
    const s = findSpot(square(10), 6, 10)!;
    const door = doorwayOf(s)!;
    expect(door[2]).toBe('west');
    expect(door[1]).toBe(4);
  });
});
