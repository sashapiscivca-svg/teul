import { describe, expect, it } from 'vitest';
import { mixFor } from '../src/audio';
import { DEFAULT_PREFS, sanitize } from '../src/prefs';

const scene = { dark: 0, weather: 'none', backdrop: 'sky', moving: false, fire: false, active: true };

describe('mixFor', () => {
  it('plays birds by day and crickets by night, never both at full', () => {
    const day = mixFor(scene);
    const night = mixFor({ ...scene, dark: 1 });
    expect(day.birds).toBeGreaterThan(night.birds);
    expect(night.crickets).toBeGreaterThan(day.crickets);
  });

  it('rain silences the birds and brings the rain', () => {
    const rain = mixFor({ ...scene, weather: 'rain' });
    expect(rain.rain).toBeGreaterThan(0.5);
    expect(rain.birds).toBe(0);
    expect(mixFor(scene).rain).toBe(0);
  });

  it('a room with no view hears no outdoors and a fire crackles only when lit', () => {
    const void_ = mixFor({ ...scene, backdrop: 'void' });
    expect(void_.birds).toBe(0);
    expect(void_.wind).toBeLessThan(0.1);
    expect(mixFor({ ...scene, fire: true }).fire).toBeGreaterThan(0);
    expect(mixFor(scene).fire).toBe(0);
  });

  it('keeps every level between 0 and 1', () => {
    for (const weather of ['none', 'rain', 'snow', 'fog', 'fireflies', 'petals'])
      for (const backdrop of ['void', 'sky', 'forest', 'city', 'sea', 'mountains', 'space'])
        for (const dark of [0, 0.5, 1]) for (const v of Object.values(mixFor({ ...scene, weather, backdrop, dark }))) expect(v >= 0 && v <= 1).toBe(true);
  });
});

describe('sound in the background', () => {
  const fake = () => {
    const calls: string[] = [];
    return { calls, ctx: { state: 'running', suspend: async () => void calls.push('suspend'), resume: async () => void calls.push('resume') } };
  };

  it('falls silent while the app is hidden and comes back when it is shown', async () => {
    const { Sound } = await import('../src/audio');
    const s = new Sound(DEFAULT_PREFS);
    const f = fake();
    (s as unknown as { ctx: unknown }).ctx = f.ctx;
    s.setHidden(true);
    s.setHidden(false);
    expect(f.calls).toEqual(['suspend', 'resume']);
  });

  it('stays silent on the goodbye screen even when the app is shown again', async () => {
    const { Sound } = await import('../src/audio');
    const s = new Sound(DEFAULT_PREFS);
    const f = fake();
    (s as unknown as { ctx: unknown }).ctx = f.ctx;
    s.hush(true);
    s.setHidden(true);
    s.setHidden(false);
    expect(f.calls.filter((c) => c === 'resume')).toEqual([]);
    s.hush(false);
    expect(f.calls.at(-1)).toBe('resume');
  });
});

describe('the ambience around', () => {
  const around = { dark: 0, minute: 13 * 60, season: 'Summer', sky: 'rain', place: 'cafe_in', outdoors: false, roofed: true, underground: false, water: 0, ice: 0, fireworks: false, sunday: false, temple: 0 };
  it('inside in the rain: the roof drums, no rain on leaves, no birds', async () => {
    const { mixAround } = await import('../src/audio');
    const m = mixAround({ ...scene, around });
    expect(m.roof).toBeGreaterThan(0.3);
    expect(m.rain).toBe(0);
    expect(m.birds).toBe(0);
    // without the detail the old mix stands
    expect(mixAround(scene)).toEqual(mixFor(scene));
  });
  it('keeps the sound levels among the preferences', () => {
    expect(sanitize({ ambience: 2 }).ambience).toBe(1);
    expect(sanitize({}).ambience).toBe(DEFAULT_PREFS.ambience);
  });
});
