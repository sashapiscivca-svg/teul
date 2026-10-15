import { describe, expect, it } from 'vitest';
import { depthKey, project, TILE, unproject, Z_PER_CENTI } from '../src/iso';

describe('iso projection', () => {
  it('maps the grid axes to the classic 2:1 diamond', () => {
    expect(project(0, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(project(1, 0, 0)).toEqual({ x: TILE.a, y: TILE.b });
    expect(project(0, 1, 0)).toEqual({ x: -TILE.a, y: TILE.b });
    expect(project(1, 1, 0)).toEqual({ x: 0, y: TILE.b * 2 });
  });

  it('raises points on screen with height', () => {
    expect(project(2, 3, 40).y).toBe(project(2, 3, 0).y - 40);
  });

  it('unproject undoes project on the floor and at a height', () => {
    for (const [x, y, z] of [
      [0, 0, 0],
      [3.5, 1.25, 0],
      [7.9, 6.1, 30],
      [-2, 4, 12],
    ]) {
      const p = project(x, y, z);
      const g = unproject(p.x, p.y, z);
      expect(g.x).toBeCloseTo(x, 9);
      expect(g.y).toBeCloseTo(y, 9);
    }
  });

  it('orders by distance from the back corner', () => {
    expect(depthKey(3, 3)).toBeGreaterThan(depthKey(2, 2));
    expect(depthKey(0, 5)).toBe(depthKey(5, 0));
  });

  it('converts hundredths of a tile to pixels of height', () => {
    expect(100 * Z_PER_CENTI).toBeCloseTo(TILE.a * 2, 9);
  });
});
