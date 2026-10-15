import { describe, expect, it } from 'vitest';
import { cellsAround, findPath } from '../src/path';
import type { Catalog, ItemDef, RoomView } from '../src/types';

const cells = Array.from({ length: 36 }, (_, i) => [i % 6, Math.floor(i / 6)] as [number, number]);
const box: ItemDef = { id: 'box', name: 'box', category: 'x', tags: [], footprint: { w: 1, d: 1 }, layer: 'floor', rules: { provides_surface: false }, model: [], slots: {}, actions: [], acquire: 'free' };
const catalog = { items: { box } } as unknown as Catalog;
function room(over: Partial<RoomView> = {}): RoomView {
  return { cells, placements: [], dividers: [], floor_paint: {}, wall_paint: {}, settings: {}, styles: {}, style_params: {}, area_budget: 36, area_used: 36, ...over };
}
const at = (x: number, y: number) => ({ pid: x * 10 + y, item: 'box', x, y, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true });

describe('findPath', () => {
  it('walks diagonally across an empty room', () => {
    const p = findPath(room(), catalog, [0, 0], [[3, 3]]);
    expect(p).toEqual([[1.5, 1.5], [2.5, 2.5], [3.5, 3.5]]);
  });

  it('is empty when already there and null when the goal is blocked or outside', () => {
    expect(findPath(room(), catalog, [2, 2], [[2, 2]])).toEqual([]);
    expect(findPath(room({ placements: [at(4, 4)] }), catalog, [0, 0], [[4, 4]])).toBeNull();
    expect(findPath(room(), catalog, [0, 0], [[9, 9]])).toBeNull();
  });

  it('goes around furniture and never cuts its corners', () => {
    const wall = [at(2, 0), at(2, 1), at(2, 2), at(2, 3), at(2, 4)];
    const p = findPath(room({ placements: wall }), catalog, [0, 0], [[4, 0]])!;
    expect(p[p.length - 1]).toEqual([4.5, 0.5]);
    expect(p.some(([x, y]) => x === 2.5 && y === 5.5)).toBe(true);
  });

  it('does not walk through a divider', () => {
    const dividers = Array.from({ length: 6 }, (_, y) => [2, y, 'east'] as [number, number, 'east']);
    expect(findPath(room({ dividers }), catalog, [0, 0], [[5, 0]])).toBeNull();
  });

  it('picks the nearest of several goals', () => {
    const p = findPath(room(), catalog, [0, 0], [[5, 5], [1, 0]]);
    expect(p).toEqual([[1.5, 0.5]]);
  });
});

describe('cellsAround', () => {
  it('lists the ring of cells around a footprint', () => {
    expect(cellsAround(2, 2, 1, 1)).toHaveLength(8);
    expect(cellsAround(2, 2, 2, 1)).toContainEqual([4, 2]);
  });
});
