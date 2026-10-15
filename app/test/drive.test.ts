import { describe, expect, it } from 'vitest';
import { CAR_MAX, couponPlaces, examRoute, needle, nextSpeed, RoadWatch, rotOf, SCHOOL_LIMIT, targetSpeed, TOWN_LIMIT, type RoadSample } from '../src/drive/rules';
import { couponLine } from '../src/drive/desk';

const calm: RoadSample = { dt: 0.1, speed: 3, floor: 'floor.cobble', nearSchool: false, zebraBusy: false, nearestPerson: 9, bumped: false };

function run(w: RoadWatch, s: Partial<RoadSample>, seconds: number): string[] {
  const out: string[] = [];
  for (let t = 0; t < seconds; t += 0.1) out.push(...w.step({ ...calm, ...s }));
  return out;
}

describe('the car', () => {
  it('keys hold a town pace unless hurried; the stick pushes up to the top speed', () => {
    expect(targetSpeed(1, true, false)).toBeLessThan(TOWN_LIMIT);
    expect(targetSpeed(1, true, true)).toBe(CAR_MAX);
    expect(targetSpeed(0.5, false, false)).toBeCloseTo(CAR_MAX / 2);
    expect(targetSpeed(0, false, false)).toBe(0);
  });

  it('gathers speed gently and brakes quickly', () => {
    let v = 0;
    for (let i = 0; i < 10; i++) v = nextSpeed(v, CAR_MAX, 0.1);
    expect(v).toBeGreaterThan(3);
    expect(v).toBeLessThan(CAR_MAX);
    const up = v;
    v = nextSpeed(v, 0, 0.1);
    expect(up - v).toBeGreaterThan(0.5);
    expect(nextSpeed(0.2, 0, 1)).toBe(0);
  });

  it('faces the way it goes', () => {
    expect(rotOf(1, 0.1, 3)).toBe(0);
    expect(rotOf(0, 1, 0)).toBe(1);
    expect(rotOf(-1, 0, 0)).toBe(2);
    expect(rotOf(0, -1, 0)).toBe(3);
    expect(rotOf(0, 0, 2)).toBe(2);
  });

  it('the needle sweeps with the speed and stays on the dial', () => {
    expect(needle(0)).toBe(0);
    expect(needle(CAR_MAX * 5)).toBe(1);
    expect(needle(TOWN_LIMIT)).toBeGreaterThan(0.3);
  });
});

describe('the road watches', () => {
  it('a calm drive in town is no fault', () => {
    expect(run(new RoadWatch(), {}, 30)).toEqual([]);
  });

  it('speeding counts only when it lasts, and once in a while', () => {
    const w = new RoadWatch();
    expect(run(w, { speed: TOWN_LIMIT * 1.5 }, 1)).toEqual([]);
    expect(run(w, { speed: TOWN_LIMIT * 1.5 }, 2)).toEqual(['speeding']);
    expect(run(w, { speed: TOWN_LIMIT * 1.5 }, 5)).toEqual([]);
    expect(run(w, { speed: TOWN_LIMIT * 1.5 }, 6)).toEqual(['speeding']);
  });

  it('near the school the limit is the school’s', () => {
    const w = new RoadWatch();
    expect(run(w, { speed: SCHOOL_LIMIT * 1.6, nearSchool: true }, 2)).toEqual(['school_zone']);
    expect(run(new RoadWatch(), { speed: SCHOOL_LIMIT * 1.6 }, 2)).toEqual([]);
  });

  it('the pavement, a busy zebra, people too close and a knock are faults', () => {
    expect(run(new RoadWatch(), { floor: 'floor.plaza' }, 1)).toEqual(['sidewalk']);
    expect(run(new RoadWatch(), { floor: 'floor.gravel' }, 2)).toEqual([]);
    expect(run(new RoadWatch(), { zebraBusy: true }, 0.2)).toEqual(['zebra']);
    expect(run(new RoadWatch(), { nearestPerson: 0.4 }, 0.2)).toEqual(['pedestrian']);
    expect(run(new RoadWatch(), { nearestPerson: 0.4, speed: 1 }, 0.5)).toEqual([]);
    expect(run(new RoadWatch(), { bumped: true }, 0.1)).toEqual(['crash']);
    expect(run(new RoadWatch(), { bumped: true, speed: 1 }, 0.5)).toEqual([]);
  });
});

describe('the exam and the licence', () => {
  it('the route has three points apart and comes back to the start', () => {
    const roads: [number, number][] = [];
    for (let x = 0; x < 60; x++) roads.push([x, 10], [x, 40]);
    for (let y = 0; y < 50; y++) roads.push([20, y]);
    const r = examRoute(roads, [5, 10], 3);
    expect(r).toHaveLength(4);
    expect(r[3]).toEqual([5, 10]);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.abs(r[i][0] - r[j][0]) + Math.abs(r[i][1] - r[j][1])).toBeGreaterThanOrEqual(8);
    expect(examRoute(roads, [5, 10], 3)).toEqual(r);
    expect(examRoute([], [0, 0], 1)).toEqual([]);
  });

  it('the coupon shows its holes, no numbers', () => {
    expect(couponPlaces(2, 5)).toEqual([true, true, false, false, false]);
    expect(couponLine(0, 5)).toBe('▣ ▣ ▣ ▣ ▣');
    expect(couponLine(3, 5)).toBe('○ ○ ○ ▣ ▣');
    expect(couponLine(3, 5)).not.toMatch(/\d/);
  });
});
