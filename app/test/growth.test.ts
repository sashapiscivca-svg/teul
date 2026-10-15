import { describe, expect, it } from 'vitest';
import { cartStop, growthFigures, withCartFlag } from '../src/growth';
import type { GrowthDef } from '../src/types';

const G: GrowthDef = {
  sites: [{ id: 'grow.a', name: 'Дім', location: 'village', x: 5, y: 6, kind: 'house' }],
  abandon: [{ id: 'home_old1', name: 'Старий дім', location: 'village', x: 2, y: 3 }],
  wear: [{ id: 'bakery', name: 'Пекарня', location: 'village', x: 9, y: 9, kinds: ['crack'] }],
  cart: { location: 'village', months: [6], hours: [11, 20], spots: [{ name: 'Парк', x: 1, y: 1 }, { name: 'Пірс', x: 4, y: 4 }, { name: 'Площа', x: 8, y: 8 }] },
};

describe('the ice-cream cart', () => {
  it('stands only on its days and in its hours, three hours at each stop in turn', () => {
    expect(cartStop(G, [], 12 * 60)).toBeNull();
    expect(cartStop(G, ['icecream'], 10 * 60 + 59)).toBeNull();
    expect(cartStop(G, ['icecream'], 11 * 60)).toBe(0);
    expect(cartStop(G, ['icecream'], 14 * 60)).toBe(1);
    expect(cartStop(G, ['icecream'], 17 * 60 + 30)).toBe(2);
    expect(cartStop(G, ['icecream'], 20 * 60)).toBeNull();
    expect(withCartFlag(G, ['icecream', 'storm'], 15 * 60)).toEqual(['icecream', 'storm', 'cart:1']);
    expect(withCartFlag(G, ['storm'], 15 * 60)).toEqual(['storm']);
  });

  it('has its seller and a queue of children while it is out', () => {
    const f = growthFigures(G, 'village', ['icecream'], 15 * 60, 3);
    expect(f.filter((x) => x.role === 'seller')).toHaveLength(1);
    expect(f.filter((x) => x.role === 'kid' && x.child).length).toBeGreaterThanOrEqual(2);
    expect(growthFigures(G, 'forest', ['icecream'], 15 * 60, 3)).toHaveLength(0);
  });
});

describe('people at work on the buildings', () => {
  it('builders work by day on a site being built, rest at lunch and at night, and never on a stalled one', () => {
    const at = (flags: string[], minute: number) => growthFigures(G, 'village', flags, minute, 1).filter((x) => x.role === 'builder');
    expect(at(['grow:grow.a:walls', 'grow:grow.a:work'], 10 * 60)).toHaveLength(2);
    expect(at(['grow:grow.a:walls', 'grow:grow.a:work'], 12 * 60 + 30)).toHaveLength(0);
    expect(at(['grow:grow.a:walls', 'grow:grow.a:work'], 22 * 60)).toHaveLength(0);
    expect(at(['grow:grow.a:stalled'], 10 * 60)).toHaveLength(0);
  });

  it('a mender stands by the ladder while a worn building is mended, workers by an empty house being mended', () => {
    const f = growthFigures(G, 'village', ['wear:bakery:crack', 'fix:bakery', 'abandon:home_old1', 'mend:home_old1'], 10 * 60, 1);
    expect(f.find((x) => x.role === 'mender')?.pose).toBe('work');
    expect(f.filter((x) => x.id.startsWith('mend:home_old1'))).toHaveLength(2);
    expect(growthFigures(G, 'village', ['wear:bakery:crack'], 10 * 60, 1).some((x) => x.role === 'mender')).toBe(false);
  });

  it('movers carry boxes from the van in the first days', () => {
    expect(growthFigures(G, 'village', ['grow:grow.a:built', 'grow:grow.a:moving'], 11 * 60, 1).filter((x) => x.role === 'mover')).toHaveLength(2);
  });
});
