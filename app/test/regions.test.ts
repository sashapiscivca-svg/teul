import { describe, expect, it } from 'vitest';
import { regionsOf, viewOf } from '../src/regions';
import type { Catalog, RoomView } from '../src/types';

const cells = Array.from({ length: 40 }, (_, i) => [i % 8, Math.floor(i / 8)] as [number, number]);
const wall = Array.from({ length: 5 }, (_, y) => [3, y, 'east'] as [number, number, 'east']);
const room = (over: Partial<RoomView> = {}): RoomView => ({ cells, placements: [], dividers: wall, floor_paint: {}, wall_paint: {}, settings: {}, styles: {}, style_params: {}, area_budget: 40, area_used: 40, ...over });
const door = { id: 'door', name: 'd', category: 'x', tags: ['door'], footprint: { w: 2, d: 1 }, layer: 'wall', rules: { provides_surface: false }, model: [], slots: {}, actions: [], acquire: 'free' };
const chair = { ...door, id: 'chair', tags: [], footprint: { w: 1, d: 1 }, layer: 'floor' };
const catalog = { items: { door, chair } } as unknown as Catalog;

describe('regionsOf', () => {
  it('splits the home at inner walls, doors or not', () => {
    const r = regionsOf(room());
    expect(r.list).toHaveLength(2);
    expect(r.list.map((x) => x.cells.length).sort()).toEqual([20, 20]);
    expect(r.of.get('0,0')).not.toBe(r.of.get('7,0'));
  });

  it('marks a mostly garden region as outdoors', () => {
    const r = regionsOf(room({ dividers: [...wall] }), (x) => x >= 4);
    expect(r.list.find((x) => x.cells.some(([cx]) => cx === 7))?.outdoor).toBe(true);
  });
});

describe('viewOf', () => {
  it('keeps only the cells and things of one room, and doors on its walls from both sides', () => {
    const placements = [
      { pid: 1, item: 'chair', x: 1, y: 1, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true },
      { pid: 2, item: 'chair', x: 6, y: 1, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true },
      { pid: 3, item: 'door', x: 4, y: 2, rot: 0, wall: 'west' as const, on: null, colors: {}, props: {}, known: true },
    ];
    const base = room({ placements });
    const r = regionsOf(base);
    const left = viewOf(base, catalog, r, r.of.get('0,0')!);
    expect(left.cells).toHaveLength(20);
    expect(left.placements.map((p) => p.pid).sort()).toEqual([1, 3]);
    expect(left.dividers).toHaveLength(0);
  });
});
