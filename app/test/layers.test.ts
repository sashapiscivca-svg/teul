import { describe, expect, it } from 'vitest';
import { joinLayers } from '../src/layers';

describe('joining layers', () => {
  it('gives the same list for the same parts, so a sprite is drawn once', () => {
    const a = [{ color: '#fff', path: 'M0 0h1v1h-1z' }];
    const b = [{ color: '#000', path: 'M1 1h1v1h-1z' }];
    const one = joinLayers(a, b);
    expect(one).toEqual([...a, ...b]);
    expect(joinLayers(a, b)).toBe(one);
    expect(joinLayers(a, [])).toBe(a);
    expect(joinLayers(b, a)).not.toBe(one);
  });
});
