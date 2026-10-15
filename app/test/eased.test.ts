import { describe, expect, it } from 'vitest';
import { easedHeight } from '../src/world';

// a step of 26 between x < 1 and x >= 1; a cliff of 80 between y < 1 and y >= 1 at x >= 3
const at = (cx: number, cy: number) => (cx < 0 || cy < 0 || cx > 4 || cy > 4 ? undefined : cx >= 3 && cy >= 1 ? 80 : cx >= 1 ? 26 : 0);

describe('the height under one, a step of the land eased', () => {
  it('is the cell’s own in the middle of it', () => {
    expect(easedHeight(at, 0.5, 0.5, 29)).toBe(0);
    expect(easedHeight(at, 1.5, 0.5, 29)).toBe(26);
  });

  it('goes over the edge of a step without a jump: half way at the edge from either side', () => {
    const left = easedHeight(at, 0.999, 0.5, 29);
    const right = easedHeight(at, 1.001, 0.5, 29);
    expect(Math.abs(left - right)).toBeLessThan(1);
    expect(left).toBeGreaterThan(12);
    expect(left).toBeLessThan(14);
  });

  it('rises step by step as one walks over it, never back', () => {
    let last = -1;
    for (let x = 0.4; x <= 1.6; x += 0.02) {
      const h = easedHeight(at, x, 0.5, 29);
      expect(h).toBeGreaterThanOrEqual(last - 1e-9);
      last = h;
    }
  });

  it('leaves a cliff a cliff (to be hopped or fallen from)', () => {
    expect(easedHeight(at, 3.5, 0.999, 29)).toBe(26);
    expect(easedHeight(at, 3.5, 1.001, 29)).toBe(80);
  });
});
