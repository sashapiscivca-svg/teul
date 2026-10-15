import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { taxiTrips } from '../src/life';
import { HORSES, raceAt, raceMovers, raceNews, TRACK } from '../src/races';
import type { Catalog, LocationDef, RoomView } from '../src/types';
import { locationRoom } from '../src/village';

const day = 1440 * 40;

describe('races at the racecourse', () => {
  it('run every half hour through the day and not at night', () => {
    expect(raceAt(day + 14 * 60 + 2)).not.toBeNull();
    expect(raceAt(day + 14 * 60 + 12)).toBeNull();
    expect(raceAt(day + 3 * 60 + 2)).toBeNull();
  });

  it('six horses go round the oval and the one with the best time wins', () => {
    const start = day + 15 * 60;
    const race = raceAt(start)!;
    expect(race.order).toHaveLength(HORSES.length);
    const winner = race.order[0];
    expect(Math.min(...race.times)).toBe(race.times[winner]);
    // mid-race they are out on the track, all six
    const mid = raceMovers(start + 1 + 45 / 60);
    expect(mid).toHaveLength(6);
    for (const m of mid) {
      const r = ((m.x - TRACK.cx) / TRACK.rx) ** 2 + ((m.y - TRACK.cy) / TRACK.ry) ** 2;
      expect(r).toBeGreaterThan(0.75);
      expect(r).toBeLessThan(1.3);
    }
    expect(raceNews(start + 0.5)?.text).toContain('старт');
    expect(raceNews(start + 4)?.text).toContain(HORSES[winner]);
  });

  it('the same race for everyone', () => {
    expect(raceAt(day + 10 * 60)).toEqual(raceAt(day + 10 * 60 + 1));
  });
});

describe('taxis', () => {
  it('take fares between different doors', () => {
    const trips = taxiTrips(1000, ['a', 'b', 'c', 'd']);
    expect(trips.length).toBe(2);
    for (const t of trips) {
      expect(t.from).not.toBe(t.to);
      expect(t.depart).toBeLessThanOrEqual(1000);
    }
  });
});

describe('the cave', () => {
  const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
  const catalog = {
    items: Object.fromEntries(pack.items.map((i: { id: string }) => [i.id, { tags: [], actions: [], rules: { provides_surface: false }, ...i }])),
    styles: Object.fromEntries(pack.styles.map((s: { id: string }) => [s.id, s])),
  } as unknown as Catalog;
  const home = { settings: {}, style_params: { weather: { kind: 'rain' } } } as unknown as RoomView;
  const cave: LocationDef = pack.locations.find((l: LocationDef) => l.id === 'cave');

  it('is only its hollow, with rock walls, dark and dry', () => {
    const { room } = locationRoom(cave, catalog, home);
    expect(room.cells.length).toBeLessThan(cave.w * cave.h * 0.66);
    expect(room.style_params.wall).toBeDefined();
    expect(room.style_params.weather).toBeUndefined();
    expect(room.settings.time_mode).toBe('fixed');
  });
});
