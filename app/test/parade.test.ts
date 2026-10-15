import { describe, expect, it } from 'vitest';
import { dragonAt, paradeClock } from '../src/parade';

describe('the dragon dance', () => {
  const street: [number, number][] = [[0, 0], [10, 0], [10, 10]];

  it('goes only on the Lunar New Year, at its hours', () => {
    expect(paradeClock({ id: 'lunar_new_year', phase: 'day' }, 11 * 60 + 5)).toBe(300);
    expect(paradeClock({ id: 'lunar_new_year', phase: 'day' }, 14 * 60)).toBeNull();
    expect(paradeClock({ id: 'lunar_new_year', phase: 'prep' }, 11 * 60 + 5)).toBeNull();
    expect(paradeClock({ id: 'town_day', phase: 'day' }, 11 * 60 + 5)).toBeNull();
  });

  it('a head leads a string of segments along the street, a step apart', () => {
    const d = dragonAt(street, 30);
    expect(d[0].item).toBe('dragon_head');
    expect(d.length).toBe(9);
    expect(d.slice(1).every((p) => p.item === 'dragon_body')).toBe(true);
    for (let i = 1; i < d.length; i++) expect(Math.hypot(d[i].x - d[i - 1].x, d[i].y - d[i - 1].y)).toBeLessThan(1.4);
    // it moves on with time and comes back along the same street
    expect(dragonAt(street, 31)[0].x).not.toBe(d[0].x);
    const back = dragonAt(street, 60);
    expect(back[0].y).toBeLessThan(10.5);
  });
});
