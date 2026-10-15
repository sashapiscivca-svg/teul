import { describe, expect, it } from 'vitest';
import { daylight, lerpColor } from '../src/daylight';

describe('lerpColor', () => {
  it('interpolates channels', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpColor('#102030', '#102030', 0.3)).toBe('#102030');
    expect(lerpColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(lerpColor('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });
});

describe('daylight', () => {
  it('is bright at midday and dark in the middle of the night', () => {
    const noon = daylight(12 * 60);
    expect(noon.dark).toBe(0);
    expect(noon.tintAlpha).toBe(0);
    const night = daylight(2 * 60);
    expect(night.dark).toBe(1);
    expect(night.tintAlpha).toBeGreaterThan(0.3);
  });

  it('turns warm in the evening', () => {
    const evening = daylight(18 * 60 + 30);
    expect(evening.dark).toBeGreaterThan(0);
    expect(evening.dark).toBeLessThan(0.5);
  });

  it('changes smoothly through the day', () => {
    let prev = daylight(0);
    for (let m = 1; m <= 1440; m += 1) {
      const cur = daylight(m);
      expect(Math.abs(cur.dark - prev.dark)).toBeLessThan(0.06);
      expect(Math.abs(cur.tintAlpha - prev.tintAlpha)).toBeLessThan(0.06);
      prev = cur;
    }
  });

  it('wraps around midnight and tolerates any minute count', () => {
    expect(daylight(0)).toEqual(daylight(1440));
    expect(daylight(12 * 60)).toEqual(daylight(12 * 60 + 1440 * 7));
    expect(daylight(-60)).toEqual(daylight(23 * 60));
  });

  it('gives valid hex colours', () => {
    for (let m = 0; m < 1440; m += 37) {
      expect(daylight(m).sky).toMatch(/^#[0-9a-f]{6}$/);
      expect(daylight(m).tint).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
