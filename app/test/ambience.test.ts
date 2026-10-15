import { describe, expect, it } from 'vitest';
import { heard, rates, seasonal, STEPS, surfaceOf, type Around } from '../src/audio/ambience';

const town: Around = { dark: 0, minute: 12 * 60, season: 'Summer', sky: 'clear', place: 'village', outdoors: true, roofed: false, underground: false, water: 0, ice: 0, fireworks: false, sunday: false, temple: 0 };

describe('the world heard around', () => {
  it('birds sing most at dawn and in spring, barely in winter; crickets only on warm nights', () => {
    const dawn = seasonal({ ...town, minute: 6 * 60, season: 'Spring', dark: 0.2 });
    const noon = seasonal({ ...town, season: 'Spring' });
    const winter = seasonal({ ...town, season: 'Winter' });
    expect(dawn.birds).toBeGreaterThan(noon.birds);
    expect(winter.birds).toBeLessThan(noon.birds * 0.4);
    expect(seasonal({ ...town, dark: 1, minute: 23 * 60, season: 'Summer' }).crickets).toBeGreaterThan(0.2);
    expect(seasonal({ ...town, dark: 1, minute: 23 * 60, season: 'Winter' }).crickets).toBe(0);
    expect(seasonal({ ...town, dark: 0, season: 'Summer' }).crickets).toBe(0);
  });

  it('rain is heard on the leaves out of doors and on the roof inside; nothing of it under the ground', () => {
    const out = seasonal({ ...town, sky: 'rain' });
    const inside = seasonal({ ...town, sky: 'rain', outdoors: false, roofed: true });
    expect(out.leaves).toBeGreaterThan(0.5);
    expect(out.roof).toBe(0);
    expect(inside.roof).toBeGreaterThan(0.3);
    expect(inside.leaves).toBe(0);
    expect(inside.birds).toBe(0);
    const cave = seasonal({ ...town, sky: 'storm', outdoors: false, roofed: false, underground: true });
    expect(cave.roof + cave.leaves + cave.wind).toBe(0);
    expect(seasonal({ ...town, sky: 'storm' }).wind).toBeGreaterThan(seasonal(town).wind);
  });

  it('the town hums by day, not in the forest nor at night', () => {
    expect(seasonal(town).hum).toBeGreaterThan(0);
    expect(seasonal({ ...town, place: 'forest' }).hum).toBe(0);
    expect(seasonal({ ...town, dark: 1, minute: 2 * 60 }).hum).toBeLessThan(seasonal(town).hum);
  });

  it('things happen at their hours: the rooster at dawn, the train now and then, the gong in the temple, the ice in the frost', () => {
    expect(rates({ ...town, minute: 5 * 60 + 40, dark: 0.3 }).rooster).toBeGreaterThan(0);
    expect(rates(town).rooster).toBe(0);
    expect(rates({ ...town, place: 'fields' }).train).toBeGreaterThan(0);
    expect(rates({ ...town, outdoors: false, roofed: true }).train).toBe(0);
    expect(rates({ ...town, place: 'temple', outdoors: false, roofed: true, temple: 1 }).gong).toBeGreaterThan(0);
    expect(rates({ ...town, season: 'Winter', ice: 0.8 }).iceCrack).toBeGreaterThan(0);
    expect(rates(town).iceCrack).toBe(0);
    expect(rates({ ...town, dark: 0.9, minute: 23 * 60 + 59, fireworks: true }).firework).toBeGreaterThan(0);
    expect(rates({ ...town, sunday: true, minute: 9 * 60 + 50 }).peal).toBe(true);
    expect(rates({ ...town, sunday: false, minute: 9 * 60 + 50 }).peal).toBe(false);
    for (const v of Object.values(rates(town))) if (typeof v === 'number') expect(v).toBeGreaterThanOrEqual(0);
  });

  it('footsteps sound of what is underfoot', () => {
    expect(surfaceOf('floor.grass', false)).toBe('grass');
    expect(surfaceOf('floor.grass', true)).toBe('snow');
    expect(surfaceOf('floor.oak', false)).toBe('wood');
    expect(surfaceOf('floor.herring', true)).toBe('wood');
    expect(surfaceOf('floor.gravel', false)).toBe('gravel');
    expect(surfaceOf('floor.cobble', false)).toBe('stone');
    expect(surfaceOf('floor.water', false)).toBe('water');
    expect(surfaceOf('floor.ice', false)).toBe('ice');
    expect(surfaceOf('floor.carpet_rose', false)).toBe('carpet');
    expect(surfaceOf(undefined, false)).toBe('stone');
    for (const s of Object.values(STEPS)) expect(s.gain).toBeLessThanOrEqual(0.3);
  });

  it('a sound from the map is quieter further off and on its side of the screen', () => {
    const near = heard(1, 700, 800);
    const far = heard(10, 700, 800);
    expect(near.volume).toBeGreaterThan(far.volume);
    expect(near.pan).toBeGreaterThan(0.5);
    expect(heard(2, 100, 800).pan).toBeLessThan(-0.5);
    expect(heard(20, 400, 800).volume).toBe(0);
    expect(heard(0, 400, 800).volume).toBeLessThanOrEqual(1);
  });
});
