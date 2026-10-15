import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayHoursText, happenings, hoursOf, hoursText, isOpen, layoutAtlas, mapPath, nextChange, openStatus, weekHours, pan, placeIndex, project, search, toAtlas, unproject, walkCells, walkMinutes, walkRoute, zoomAt, type View } from '../src/maps/model';
import type { LocationDef } from '../src/types';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const locations: Record<string, LocationDef> = Object.fromEntries(pack.locations.map((l: LocationDef) => [l.id, l]));
const atlas = layoutAtlas(locations);
const places = placeIndex(atlas, { locations, residents: pack.residents, stations: pack.stations });

describe('the atlas', () => {
  it('lays the town and the maps around it out side by side, none on another', () => {
    for (const id of ['village', 'forest', 'fields', 'farm', 'dump', 'cemetery', 'hippodrome', 'vineyard']) expect(atlas.maps.has(id), id).toBe(true);
    expect(atlas.maps.has('cave')).toBe(false);
    expect(atlas.maps.has('cafe_in')).toBe(false);
    const all = [...atlas.maps.values()];
    for (const a of all)
      for (const b of all) {
        if (a === b) continue;
        const apart = a.ox + a.def.w <= b.ox || b.ox + b.def.w <= a.ox || a.oy + a.def.h <= b.oy || b.oy + b.def.h <= a.oy;
        expect(apart, `${a.def.id} / ${b.def.id}`).toBe(true);
      }
    // the forest is north of the town (its road leaves the top edge), the fields west, the farm east
    const v = atlas.maps.get('village')!;
    expect(atlas.maps.get('forest')!.oy + atlas.maps.get('forest')!.def.h).toBeLessThanOrEqual(v.oy);
    expect(atlas.maps.get('fields')!.ox + atlas.maps.get('fields')!.def.w).toBeLessThanOrEqual(v.ox);
    expect(atlas.maps.get('farm')!.ox).toBeGreaterThanOrEqual(v.ox + v.def.w);
    expect(atlas.roads.length).toBeGreaterThanOrEqual(7);
  });

  it('projects and unprojects, zooms about a point and pans', () => {
    const v: View = { cx: 30, cy: 40, zoom: 6, w: 400, h: 700 };
    const p = project(v, [33, 38]);
    expect(p).toEqual([218, 338]);
    expect(unproject(v, p)).toEqual([33, 38]);
    const z = zoomAt(v, 2, [100, 100]);
    const before = unproject(v, [100, 100]);
    const after = unproject(z, [100, 100]);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
    expect(z.zoom).toBe(12);
    expect(zoomAt(v, 1000, [0, 0]).zoom).toBe(40);
    const moved = pan(v, 60, -30);
    expect(moved.cx).toBe(20);
    expect(moved.cy).toBe(45);
    expect(toAtlas(atlas, 'village', 5, 6)).toEqual([5, 6]);
  });
});

describe('walking routes', () => {
  it('keeps to the streets and goes round the houses, never through the water', () => {
    const v = locations.village;
    const cells = walkCells(v, [10, 26], [58, 74])!;
    expect(cells.length).toBeGreaterThan(40);
    const style = (x: number, y: number) => v.legend[v.tiles[y][x]];
    expect(cells.every(([x, y]) => style(x, y) !== 'floor.water')).toBe(true);
    const paved = cells.filter(([x, y]) => /plaza|cobble|path|gravel|deck/.test(style(x, y))).length;
    expect(paved / cells.length).toBeGreaterThan(0.8);
    const hosp = v.sites!.find((s) => s.id === 'hospital_site')!.building!;
    const inside = (x: number, y: number) => x >= hosp[0] && x < hosp[0] + hosp[2] && y >= hosp[1] && y < hosp[1] + hosp[3];
    expect(cells.slice(1, -1).some(([x, y]) => inside(x, y))).toBe(false);
  });

  it('goes from one map to another by their roads, and from a room out of its door', () => {
    expect(mapPath(locations, 'village', 'hippodrome')).toEqual(['village', 'fields', 'hippodrome']);
    const r = walkRoute(atlas, locations, { loc: 'village', x: 44, y: 22 }, { loc: 'forest', x: 70, y: 60 })!;
    expect(r.lines.length).toBeGreaterThanOrEqual(3);
    expect(r.tiles).toBeGreaterThan(80);
    expect(walkMinutes(r.tiles)).toBeGreaterThanOrEqual(1);
    const fromCafe = walkRoute(atlas, locations, { loc: 'cafe_in', x: 5, y: 7 }, { loc: 'village', x: 44, y: 22 });
    expect(fromCafe && fromCafe.tiles > 10).toBe(true);
  });
});

describe('search, hours and the day', () => {
  it('finds places by name, by what they are, by what is sold there, and people by name', () => {
    expect(search(places, 'кава').some((p) => p.site === 'cafe_site')).toBe(true);
    expect(search(places, 'аптека').some((p) => p.site === 'hospital_site')).toBe(true);
    expect(search(places, 'Кінотеатр')[0].site).toBe('cinema_site');
    expect(search(places, 'Садова').some((p) => p.kind === 'street')).toBe(true);
    expect(search(places, 'вулиця').filter((p) => p.kind === 'street').length).toBeGreaterThanOrEqual(8);
    expect(search(places, 'ліс').some((p) => p.loc === 'forest')).toBe(true);
    const worker = pack.residents.find((r: { job?: [string, string] }) => r.job?.[0] === 'cafe_site');
    const found = search(places, worker.name.split(' ')[0]);
    expect(found.some((p) => p.kind === 'person' && p.site === 'cafe_site')).toBe(true);
    expect(search(places, 'ноутбук').some((p) => p.site === 'post_site')).toBe(true);
    expect(search(places, '   ')).toEqual([]);
  });

  it('tells the hours from who works there', () => {
    const v = locations.village;
    const lib = hoursOf(v.sites!.find((s) => s.id === 'library_site')!);
    expect(hoursText(lib)).toBe('пн–сб 09:00–18:00');
    expect(isOpen(lib, 10 * 60, 0)).toBe(true);
    expect(isOpen(lib, 10 * 60, 6)).toBe(false);
    expect(isOpen(lib, 20 * 60, 2)).toBe(false);
    const hosp = hoursOf(v.sites!.find((s) => s.id === 'hospital_site')!);
    expect(hosp.always).toBe(true);
    expect(hoursText(hosp)).toBe('Цілодобово');
    const park = hoursOf(v.sites!.find((s) => s.id === 'park_site')!);
    expect(isOpen(park, 3 * 60, 3)).toBe(true);
    const bar = hoursOf(v.sites!.find((s) => s.id === 'bar_site')!);
    expect(isOpen(bar, 30, 3)).toBe(true);
    expect(isOpen(bar, 12 * 60, 3)).toBe(false);
  });

  it('lays the hours out day by day, and says when the door opens or closes next', () => {
    const site = (id: string) => locations.village.sites!.find((s) => s.id === id)!;
    const town = weekHours(site('townhall_site'));
    expect(town.slice(0, 5).every((d) => d && d.from === 8 * 60 && d.to === 18 * 60)).toBe(true);
    expect(town[5]).toBeNull();
    expect(town[6]).toBeNull();
    // Friday evening: shut till Monday morning
    expect(nextChange(town, 19 * 60, 4)).toEqual({ open: false, at: 8 * 60, days: 3 });
    expect(nextChange(town, 10 * 60, 2)).toEqual({ open: true, at: 18 * 60, days: 0 });
    expect(nextChange(town, 7 * 60, 2)).toEqual({ open: false, at: 8 * 60, days: 0 });
    // the bar: the evening runs past midnight
    const bar = weekHours(site('bar_site'));
    expect(bar[3]).toEqual({ from: 17 * 60, to: 25 * 60 });
    expect(nextChange(bar, 30, 4)).toEqual({ open: true, at: 60, days: 0 });
    expect(nextChange(bar, 12 * 60, 4)).toEqual({ open: false, at: 17 * 60, days: 0 });
    // day and night: never shuts
    expect(nextChange(weekHours(site('hospital_site')), 3 * 60, 1)).toEqual({ open: true, at: null, days: 0 });
    expect(nextChange(weekHours(site('park_site')), 3 * 60, 1)).toEqual({ open: true, at: null, days: 0 });
    expect(dayHoursText(bar[3])).toBe('17:00–01:00');
    expect(dayHoursText(null)).toBe('Вихідний');
    expect(dayHoursText({ from: 8 * 60, to: 32 * 60 })).toBe('Цілодобово');
    // in words, as the card says it
    expect(openStatus(site('townhall_site'), 19 * 60, 4)).toEqual({ open: false, text: 'відчиниться у понеділок о 08:00' });
    expect(openStatus(site('townhall_site'), 19 * 60, 3)).toEqual({ open: false, text: 'відчиниться завтра о 08:00' });
    expect(openStatus(site('bar_site'), 18 * 60, 0)).toEqual({ open: true, text: 'зачиниться о 01:00' });
    expect(openStatus(site('park_site'), 3 * 60, 0)).toEqual({ open: true, text: 'Завжди відкрито' });
    expect(openStatus(site('hospital_site'), 3 * 60, 0)).toEqual({ open: true, text: 'Цілодобово' });
  });

  it('knows what is on today', () => {
    const sat = happenings(atlas, 10 * 60, 5, 'День міста');
    expect(sat.map((h) => h.key)).toEqual(expect.arrayContaining(['fest', 'market', 'cinema', 'flea', 'races']));
    expect(sat.find((h) => h.key === 'races')!.when).toContain('10:00');
    const late = happenings(atlas, 22 * 60, 2, null);
    expect(late.some((h) => h.key === 'fest' || h.key === 'races' || h.key === 'flea')).toBe(false);
  });
});
