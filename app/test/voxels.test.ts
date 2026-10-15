import { describe, expect, it } from 'vitest';
import { cellKey, fromBoxes, itemDefOf, newId, normalize, packOf, problemsOf, sizeOf, toBoxes, type Cells, type UserItem } from '../src/workshop/voxels';

const cells = (list: [number, number, number, number?][]): Cells => new Map(list.map(([i, j, k, s]) => [cellKey(i, j, k), s ?? 0] as [string, number]));

describe('toBoxes', () => {
  it('turns one block into one quarter-tile box', () => {
    expect(toBoxes(cells([[0, 0, 0]]))).toEqual([{ box: [0, 0, 0, 25, 25, 25], slot: 'a' }]);
  });

  it('merges a row, a plate and a column into single boxes', () => {
    expect(toBoxes(cells([[0, 0, 0], [1, 0, 0], [2, 0, 0]]))).toHaveLength(1);
    const plate = cells([]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) plate.set(cellKey(i, j, 0), 0);
    expect(toBoxes(plate)).toEqual([{ box: [0, 0, 0, 100, 100, 25], slot: 'a' }]);
    const column = cells([[0, 0, 0], [0, 0, 1], [0, 0, 2]]);
    expect(toBoxes(column)).toEqual([{ box: [0, 0, 0, 25, 25, 75], slot: 'a' }]);
  });

  it('keeps slots apart and moves the model to the origin', () => {
    const boxes = toBoxes(cells([[5, 3, 2, 0], [6, 3, 2, 1]]));
    expect(boxes).toHaveLength(2);
    expect(boxes.map((b) => b.slot).sort()).toEqual(['a', 'b']);
    expect(Math.min(...boxes.map((b) => b.box[0]))).toBe(0);
    expect(Math.min(...boxes.map((b) => b.box[2]))).toBe(0);
  });

  it('round-trips through boxes without losing or inventing blocks', () => {
    const shape = cells([[0, 0, 0], [1, 0, 0], [1, 1, 0, 2], [1, 1, 1, 2], [3, 3, 0, 1], [3, 3, 1, 1], [3, 3, 2, 3]]);
    const back = fromBoxes(toBoxes(shape));
    expect([...back].sort()).toEqual([...normalize(shape)].sort());
  });

  it('is deterministic whatever order the blocks were placed in', () => {
    const a = cells([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]]);
    const b = new Map([...a].reverse());
    expect(toBoxes(a)).toEqual(toBoxes(b));
  });
});

describe('sizeOf', () => {
  it('counts whole tiles and block height', () => {
    expect(sizeOf(cells([[0, 0, 0]]))).toEqual({ w: 1, d: 1, h: 1 });
    expect(sizeOf(cells([[4, 0, 0], [0, 7, 5]]))).toEqual({ w: 2, d: 2, h: 6 });
    expect(sizeOf(new Map())).toEqual({ w: 1, d: 1, h: 0 });
  });
});

describe('items', () => {
  const item: UserItem = { id: 'custom.stool_1', name: ' Мій столик ', layer: 'floor', colors: ['#aa0000', '#00aa00', '#0000aa', '#aaaa00'], blocks: [[0, 0, 0, 0], [0, 0, 1, 1], [1, 0, 1, 1]], surface: true, light: false, action: 'sit' };

  it('builds an item definition the engine accepts', () => {
    const def = itemDefOf(item);
    expect(def.name).toBe('Мій столик');
    expect(def.footprint).toEqual({ w: 1, d: 1 });
    expect(def.rules.provides_surface).toBe(true);
    expect(Object.keys(def.slots).sort()).toEqual(['a', 'b']);
    expect(def.slots.a.default).toBe('#aa0000');
    expect(def.actions).toEqual(['sit']);
    expect(def.acquire).toBe('free');
    expect(Object.values(def.slots).every((s) => s.palette === 'user')).toBe(true);
    expect(JSON.parse(packOf([item])).palettes.user).toContain('#aa0000');
  });

  it('wraps items in a pack and refuses empty or unnamed ones', () => {
    expect(JSON.parse(packOf([item])).items).toHaveLength(1);
    expect(problemsOf({ ...item, blocks: [] })).toContain('empty');
    expect(problemsOf({ ...item, name: '  ' })).toContain('no_name');
    expect(problemsOf(item)).toEqual([]);
  });

  it('only a floor item can offer a surface, and ids stay unique', () => {
    expect(itemDefOf({ ...item, layer: 'surface' }).rules.provides_surface).toBe(false);
    expect(newId([item], 'Лампа')).toMatch(/^custom\./);
    expect(newId([item, { ...item, id: 'custom.item_2' }], '')).not.toBe('custom.item_2');
  });
});
