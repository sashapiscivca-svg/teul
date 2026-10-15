import { buildOf } from '../src/people/hero';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, lookFromSettings } from '../src/character';
import { lookSettings, randomLook } from '../src/ui/screens';

describe('the first-run hero', () => {
  it('is written as the same look.* settings the studio reads back', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const look = randomLook(rand);
      expect(lookFromSettings(Object.fromEntries(lookSettings(look)))).toEqual(look);
    }
    // (a look without a chosen build is written with the one guessed for it, so the hero keeps it)
    expect(lookFromSettings(Object.fromEntries(lookSettings(DEFAULT_LOOK)))).toEqual({ ...DEFAULT_LOOK, build: buildOf(DEFAULT_LOOK) });
  });

  it('writes the new keys too', () => {
    const keys = lookSettings(DEFAULT_LOOK).map(([k]) => k);
    for (const k of ['look.shoe', 'look.beard', 'look.cheeks']) expect(keys).toContain(k);
  });

  it('only writes settings keys the core accepts', () => {
    for (const [key] of lookSettings(DEFAULT_LOOK)) expect(key).toMatch(/^look\.[a-z0-9_]+$/);
  });
});
