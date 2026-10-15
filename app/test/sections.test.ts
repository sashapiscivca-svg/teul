import { describe, expect, it } from 'vitest';
import { dividerKey } from '../src/geometry';
import { connected, growCells, guessKind, newWalls, nameKeyFor, sectionAt, sectionsOf, shrinkCells } from '../src/sections';
import type { WallSide } from '../src/types';

const rect = (x: number, y: number, w: number, d: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j]);
  return out;
};

/** A 4×3 living room with a 2×3 kitchen east of it behind a wall, and a garden 3×2 south of the living room. */
function home() {
  const cells = [...rect(0, 0, 4, 3), ...rect(4, 0, 2, 3), ...rect(0, 3, 3, 2)];
  const dividers = new Set<string>();
  for (let y = 0; y < 3; y++) dividers.add(dividerKey(3, y, 'east'));
  for (let x = 0; x < 3; x++) dividers.add(dividerKey(x, 2, 'south'));
  const garden = new Set(rect(0, 3, 3, 2).map(([x, y]) => `${x},${y}`));
  return { cells, dividers, outdoor: (x: number, y: number) => (garden.has(`${x},${y}`) ? 'garden' : null) };
}

describe('the parts of a home', () => {
  it('are the floor split by walls, each with its bounds and kind', () => {
    const h = home();
    const parts = sectionsOf(h.cells, h.dividers, {}, h.outdoor);
    expect(parts.map((p) => [p.id, p.x, p.y, p.w, p.d, p.kind])).toEqual([
      ['0,0', 0, 0, 4, 3, 'room'],
      ['4,0', 4, 0, 2, 3, 'room'],
      ['0,3', 0, 3, 3, 2, 'garden'],
    ]);
    expect(sectionAt(parts, 5, 2)?.id).toBe('4,0');
  });

  it('take their name and kind from any of their cells', () => {
    const h = home();
    const parts = sectionsOf(h.cells, h.dividers, { 'room.5_1.name': 'Кухня', 'room.5_1.kind': 'kitchen', 'room.9_9.name': 'нічия' }, h.outdoor);
    expect(parts[1]).toMatchObject({ name: 'Кухня', kind: 'kitchen', nameKey: '5_1' });
    expect(parts[0].name).toBeNull();
  });

  it('grow a row outward only into free ground inside the grid', () => {
    const h = home();
    const all = new Set(h.cells.map(([x, y]) => `${x},${y}`));
    const [living, kitchen] = sectionsOf(h.cells, h.dividers, {}, h.outdoor);
    expect(growCells(kitchen, 'east', all)).toEqual([[6, 0], [6, 1], [6, 2]]);
    expect(growCells(living, 'east', all), 'the kitchen is in the way').toEqual([]);
    expect(growCells(living, 'north', all), 'the edge of the grid').toEqual([]);
    expect(growCells(kitchen, 'south', all)).toEqual([[4, 3], [5, 3]]);
  });

  it('shrink by their last row, never to nothing', () => {
    const h = home();
    const [, kitchen, garden] = sectionsOf(h.cells, h.dividers, {}, h.outdoor);
    expect(shrinkCells(kitchen, 'east')).toEqual([[5, 0], [5, 1], [5, 2]]);
    expect(shrinkCells(garden, 'south')).toEqual([[0, 4], [1, 4], [2, 4]]);
    const thin = sectionsOf(rect(0, 0, 1, 3), new Set(), {}, () => null)[0];
    expect(shrinkCells(thin, 'west')).toEqual([]);
  });

  it('put a wall between new floor and the other parts it touches', () => {
    const h = home();
    const all = new Set(h.cells.map(([x, y]) => `${x},${y}`));
    const [, , garden] = sectionsOf(h.cells, h.dividers, {}, h.outdoor);
    const added = growCells(garden, 'east', all);
    expect(added).toEqual([[3, 3], [3, 4]]);
    const walls = newWalls(added, new Set(garden.cells.map(([x, y]) => `${x},${y}`)), all).map(([x, y, s]) => `${x},${y},${s}`);
    expect(walls).toEqual(['3,3,north' as `${number},${number},${WallSide}`]);
  });

  it('move their name to a cell that stays when the named one goes', () => {
    const h = home();
    const [, kitchen] = sectionsOf(h.cells, h.dividers, { 'room.5_1.name': 'Кухня' }, h.outdoor);
    expect(nameKeyFor(kitchen, shrinkCells(kitchen, 'east'))).toBe('4_0');
    expect(nameKeyFor(kitchen, shrinkCells(kitchen, 'west'))).toBe('5_1');
  });

  it('stay in one piece when one is taken away, or the taking is refused', () => {
    expect(connected([...rect(0, 0, 3, 1), [1, 1]])).toBe(true);
    expect(connected([[0, 0], [2, 0]])).toBe(false);
  });

  it('tell what they are by what stands in them, when nobody named them', () => {
    expect(guessKind(['bed', 'nightstand'])).toBe('bedroom');
    expect(guessKind(['fridge', 'stove'])).toBe('kitchen');
    expect(guessKind(['bathtub'])).toBe('bath');
    expect(guessKind(['sofa3', 'wall_tv'])).toBe('lounge');
    expect(guessKind(['chair'])).toBeNull();
  });
});
