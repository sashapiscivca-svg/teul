import { describe, expect, it } from 'vitest';
import { inkPrint } from '../src/paperphoto';

describe('the paper prints its photos', () => {
  it('in three tones of two inks, the same picture the same way', () => {
    const w = 16;
    const h = 8;
    const make = () => {
      const d = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        const v = (i % w) * 16;
        d.set([v, v * 0.8, 255 - v, 255], i * 4);
      }
      return d;
    };
    const a = make();
    inkPrint(a, w, h);
    const tones = new Set<string>();
    for (let i = 0; i < w * h; i++) tones.add(`${a[i * 4]},${a[i * 4 + 1]},${a[i * 4 + 2]}`);
    expect(tones.size).toBeLessThanOrEqual(3);
    expect(tones.size).toBeGreaterThanOrEqual(2);
    const b = make();
    inkPrint(b, w, h);
    expect([...b]).toEqual([...a]);
    // dark on the left, light on the right
    expect(a[0]).toBeLessThan(a[(w - 1) * 4]);
  });
});
