import { describe, expect, it } from 'vitest';
import { riteFigures, templeFigures, faithLine } from '../src/faiths';

const grove = { id: 'grove_site', name: 'Старе коло', kind: 'grove', x: 96, y: 51, area: [94, 49, 7, 4] as [number, number, number, number] };

describe('the forest circle on the full moon', () => {
  it('gathers round the fire on the full-moon night only, in the forest', () => {
    const night = riteFigures({ location: 'forest', grove, fullTonight: true, fullLastNight: false, minuteOfDay: 22 * 60, time: 10 });
    expect(night.length).toBeGreaterThanOrEqual(7);
    // a ring round the hearth: every one of them a few steps from the middle, facing in
    const cx = grove.area[0] + grove.area[2] / 2;
    const cy = grove.area[1] + grove.area[3] / 2;
    for (const f of night) {
      const r = Math.hypot(f.x - cx, f.y - cy);
      expect(r).toBeGreaterThan(1.5);
      expect(r).toBeLessThan(4);
    }
    expect(night.some((f) => f.pose === 'pray')).toBe(true);
    expect(riteFigures({ location: 'forest', grove, fullTonight: true, fullLastNight: false, minuteOfDay: 12 * 60, time: 10 })).toEqual([]);
    expect(riteFigures({ location: 'forest', grove, fullTonight: false, fullLastNight: false, minuteOfDay: 22 * 60, time: 10 })).toEqual([]);
    expect(riteFigures({ location: 'village', grove, fullTonight: true, fullLastNight: false, minuteOfDay: 22 * 60, time: 10 })).toEqual([]);
    // past midnight it is still the full-moon night
    expect(riteFigures({ location: 'forest', grove, fullTonight: false, fullLastNight: true, minuteOfDay: 30, time: 10 }).length).toBeGreaterThan(0);
  });

  it('turns slowly round the fire', () => {
    const a = riteFigures({ location: 'forest', grove, fullTonight: true, fullLastNight: false, minuteOfDay: 22 * 60, time: 0 });
    const b = riteFigures({ location: 'forest', grove, fullTonight: true, fullLastNight: false, minuteOfDay: 22 * 60, time: 8 });
    expect(a[0].x).not.toBeCloseTo(b[0].x, 2);
  });
});

describe('the temple', () => {
  it('has people at their offerings on the days the bowls are filled, by day', () => {
    const on = templeFigures({ location: 'temple_in', offerings: true, minuteOfDay: 10 * 60, day: 3 });
    expect(on.length).toBeGreaterThanOrEqual(2);
    expect(on.every((f) => f.pose === 'pray' || f.pose === 'lotus')).toBe(true);
    expect(templeFigures({ location: 'temple_in', offerings: false, minuteOfDay: 10 * 60, day: 3 })).toEqual([]);
    expect(templeFigures({ location: 'temple_in', offerings: true, minuteOfDay: 23 * 60, day: 3 })).toEqual([]);
  });

  it('has its own words when tapped', () => {
    expect(faithLine('rite', 1)).toMatch(/\S/);
    expect(faithLine('devotee', 2)).toMatch(/\S/);
  });
});
