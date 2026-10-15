import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { worldBoxes } from '../src/models';
import { parseSeason, seasonBoxes } from '../src/pixel/seasons';
import type { ItemDef, PlacementView } from '../src/types';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const items: Record<string, ItemDef> = Object.fromEntries(pack.items.map((i: ItemDef) => [i.id, { ...i, tags: i.tags ?? [], actions: i.actions ?? [] }]));
const at: PlacementView = { pid: 1, item: '', x: 0, y: 0, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true };
const model = (id: string, season: string) => seasonBoxes(items[id], worldBoxes(items[id], { ...at, item: id }, 0), parseSeason(season), 1);
const slots = (id: string, season: string) => new Set(model(id, season).map((b) => b.slot));

describe('the year outdoors', () => {
  it('broad-leaved trees are bare in winter, with snow on their branches', () => {
    for (const tree of ['tree_oak', 'tree_birch', 'tree_maple', 'tree_apple']) {
      expect(slots(tree, 'Winter:2').has('leaf')).toBe(false);
      expect(model(tree, 'Winter:2').filter((b) => b.slot === 'trunk').length).toBeGreaterThan(3);
      expect(slots(tree, 'Winter:2').has('snow')).toBe(true);
    }
    // a pine keeps its needles
    expect(slots('tree_pine', 'Winter:2').has('leaf')).toBe(true);
  });

  it('in autumn leaves turn, thin out and lie on the ground, and by its end the trees are nearly bare', () => {
    const summer = model('tree_oak', 'Summer:1').filter((b) => b.slot === 'leaf');
    const late = model('tree_oak', 'Autumn:2').filter((b) => b.slot === 'leaf');
    expect(late.reduce((a, b) => a + b.gw, 0)).toBeLessThan(summer.reduce((a, b) => a + b.gw, 0));
    expect(slots('tree_oak', 'Autumn:2').has('litter')).toBe(true);
    expect(model('tree_oak', 'Autumn:3').filter((b) => b.slot === 'leaf').every((b) => b.gw < 0.2)).toBe(true);
  });

  it('fruit trees blossom in spring, and apples ripen in late summer', () => {
    const blossom = model('tree_apple', 'Spring:1').filter((b) => b.slot === 'leaf');
    expect(blossom.some((b) => b.color === '#fbf2f6' || b.color === '#f6c8dc')).toBe(true);
    expect(slots('tree_apple', 'Spring:1').has('fruit')).toBe(false);
    expect(slots('tree_apple', 'Summer:3').has('fruit')).toBe(true);
  });

  it('flowers bloom in their season and are gone under the snow', () => {
    expect(slots('tulips', 'Winter:1').has('f1')).toBe(false);
    expect(slots('tulips', 'Spring:2').has('f1')).toBe(true);
    expect(slots('sunflowers', 'Summer:2').has('flower')).toBe(true);
    expect(slots('sunflowers', 'Spring:2').has('flower')).toBe(false);
    expect(slots('rose_bush', 'Autumn:3').has('flower')).toBe(false);
    expect(model('flower_bed', 'Winter:2').every((b) => b.snow)).toBe(true);
  });

  it('the wheat is cut to stubble after the harvest', () => {
    expect(slots('wheat_a', 'Summer:2').has('ear')).toBe(true);
    expect(slots('wheat_a', 'Autumn:2').has('ear')).toBe(false);
  });

  it('things the year does not touch stay as they are', () => {
    expect(model('cottage_cream', 'Winter:2')).toEqual(worldBoxes(items.cottage_cream, { ...at, item: 'cottage_cream' }, 0));
  });
});
