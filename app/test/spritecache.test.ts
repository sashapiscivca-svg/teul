import { describe, expect, it } from 'vitest';
import { SpriteCache } from '../src/pixel/spritecache';

const pic = (w: number, h: number) => ({ w, h });

describe('the sprite cache', () => {
  it('keeps what was drawn lately when it fills, and lets the longest unused go first', () => {
    const c = new SpriteCache<{ w: number; h: number }>(1000);
    c.set('a', pic(10, 10));
    c.set('b', pic(10, 10));
    c.set('c', pic(10, 10));
    c.get('a'); // looked at again: now the freshest
    c.set('d', pic(30, 30)); // 900 + 300 > 1000: the oldest unused go until it fits
    expect(c.get('a')).toBeTruthy();
    expect(c.get('d')).toBeTruthy();
    expect(c.get('b')).toBeUndefined();
    expect(c.area).toBeLessThanOrEqual(1000);
  });

  it('never throws everything out at once when a big place has many kinds of things', () => {
    const c = new SpriteCache<{ w: number; h: number }>(2_000_000);
    for (let i = 0; i < 3000; i++) c.set(`k${i}`, pic(20, 20));
    // all 3000 fit (1.2M pixels): none was lost
    expect(c.size).toBe(3000);
    expect(c.get('k0')).toBeTruthy();
  });

  it('holds a picture bigger than the whole budget only until the next one comes', () => {
    const c = new SpriteCache<{ w: number; h: number }>(100);
    c.set('big', pic(50, 50));
    expect(c.get('big')).toBeTruthy();
    c.set('small', pic(5, 5));
    expect(c.get('big')).toBeUndefined();
    expect(c.get('small')).toBeTruthy();
  });
});
