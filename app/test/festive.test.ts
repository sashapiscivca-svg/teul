import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { festiveKinds, festiveProps, festiveStage } from '../src/festive';
import type { Catalog, ItemDef, LocationDef } from '../src/types';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const items: Record<string, ItemDef> = Object.fromEntries(pack.items.map((i: ItemDef) => [i.id, i]));
const catalog = { items } as unknown as Catalog;
const village = pack.locations.find((l: LocationDef) => l.id === 'village') as LocationDef;

describe('the feasts of the year', () => {
  it('put out what belongs to the day', () => {
    expect(festiveKinds(12, 25)).toContain('winter');
    expect(festiveKinds(1, 10)).toContain('winter');
    expect(festiveKinds(1, 20)).toEqual([]);
    expect(festiveKinds(10, 31)).toEqual(['halloween']);
    expect(festiveKinds(8, 24)).toEqual(['flags']);
    expect(festiveKinds(6, 24, { festival: { id: 'kupala', phase: 'day', ready: 1000 } })).toEqual(['kupala']);
    expect(festiveKinds(2, 17, { festival: { id: 'lunar_new_year', phase: 'day', ready: 1000 } })).toEqual(['lunar']);
    expect(festiveKinds(5, 10, { holiday: 'mothers_day' })).toEqual(['flowers']);
    expect(festiveKinds(12, 5, { npp: 'protest' })).toEqual(['protest']);
    // the church's feasts are not dressed up by the town
    expect(festiveKinds(4, 5, { holiday: 'easter' })).toEqual([]);
    expect(festiveKinds(10, 11)).toEqual([]);
  });

  it('stand on free grass or paving, never on a road, the water or anything else', () => {
    const all = ['winter', 'newyear', 'halloween', 'flags', 'kupala', 'lunar', 'hearts', 'flowers', 'carnival', 'earth', 'kids', 'townday', 'cinema', 'harvest', 'lanterns', 'protest', 'hearing'] as const;
    for (const kinds of all.map((k) => [k])) {
      const props = festiveProps(village, catalog, [...kinds]);
      expect(props.length).toBeGreaterThan(0);
      const taken = new Set<string>();
      const mark = (item: string, x: number, y: number, rot = 0) => {
        const f = items[item].footprint;
        const [w, d] = rot % 2 ? [f.d, f.w] : [f.w, f.d];
        const cells: string[] = [];
        for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) cells.push(`${x + i},${y + j}`);
        return cells;
      };
      for (const p of village.props) for (const c of mark(p.item, p.x, p.y, p.rot ?? 0)) taken.add(c);
      for (const p of props) {
        for (const c of mark(p.item, p.x, p.y, p.rot ?? 0)) {
          expect(taken.has(c), `${p.item} on top of something at ${c}`).toBe(false);
          const [x, y] = c.split(',').map(Number);
          expect(['floor.grass', 'floor.meadow', 'floor.plaza', 'floor.moss']).toContain(village.legend[village.tiles[y][x]]);
          taken.add(c);
        }
      }
    }
  });

  it('a celebration is got ready over days, held, and cleared up after', () => {
    const at = (phase: 'prep' | 'day' | 'after', ready: number) => festiveProps(village, catalog, ['townday'], festiveStage({ festival: { id: 'town_day', phase, ready } }));
    const early = at('prep', 125);
    const late = at('prep', 875);
    const day = at('day', 1000);
    const after = at('after', 1000);
    const count = (ps: { item: string }[], item: string) => ps.filter((p) => p.item === item).length;
    // a stage in scaffolding first, posters up; the stage itself on the day
    expect(count(early, 'stage_frame')).toBe(1);
    expect(count(early, 'poster_board')).toBeGreaterThan(0);
    expect(count(day, 'town_stage')).toBe(1);
    expect(count(day, 'poster_board')).toBe(0);
    // more garlands each day, all of them on the day, stalls only once they are built
    expect(count(late, 'bunting')).toBeGreaterThan(count(early, 'bunting'));
    expect(count(day, 'bunting')).toBeGreaterThanOrEqual(count(late, 'bunting'));
    expect(count(early, 'festival_stall')).toBe(0);
    expect(count(day, 'festival_stall')).toBeGreaterThan(0);
    // the morning after: rubbish bags, no stalls
    expect(count(after, 'rubbish_bags')).toBeGreaterThan(0);
    expect(count(after, 'festival_stall')).toBe(0);
  });

  it('the winter feasts bring a fir to the square', () => {
    expect(festiveProps(village, catalog, ['winter']).some((p) => p.item === 'festive_tree')).toBe(true);
  });

  it('nothing is put out indoors', () => {
    const inside = pack.locations.find((l: LocationDef) => l.inside) as LocationDef;
    expect(festiveProps(inside, catalog, ['winter'])).toEqual([]);
  });
});
