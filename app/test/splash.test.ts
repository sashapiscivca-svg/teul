import { describe, expect, it } from 'vitest';
import { lookNow } from '../src/ui/splash/index';
import { DEFAULT_PREFS, sanitize } from '../src/prefs';

describe('the title splash', () => {
  it('takes its light and season from the clock and the calendar', () => {
    expect(lookNow(new Date(2026, 9, 10, 21, 0))).toEqual({ light: 'night', season: 'autumn' });
    expect(lookNow(new Date(2026, 6, 1, 12, 0))).toEqual({ light: 'day', season: 'summer' });
    expect(lookNow(new Date(2026, 2, 1, 19, 0))).toEqual({ light: 'dusk', season: 'spring' });
    expect(lookNow(new Date(2026, 11, 31, 6, 30))).toEqual({ light: 'dusk', season: 'winter' });
    expect(lookNow(new Date(2027, 1, 28, 3, 0))).toEqual({ light: 'night', season: 'winter' });
  });

  it('greets with the rift unless another splash was chosen', () => {
    expect(DEFAULT_PREFS.splash).toBe('rift');
    expect(sanitize({}).splash).toBe('rift');
    expect(sanitize({ splash: 'depth' }).splash).toBe('depth');
    expect(sanitize({ splash: 'nonsense' }).splash).toBe('rift');
  });
});
