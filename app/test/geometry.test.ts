import { describe, expect, it } from 'vitest';
import {
  cellSet,
  dividerKey,
  dividerSet,
  edgeKey,
  isBackFacing,
  isWallEdge,
  rotRect,
  rotXY,
  unrotXY,
  wallEdgesOfItem,
  wallOrientation,
  type View,
} from '../src/geometry';
import type { ItemDef, RoomView } from '../src/types';

const VIEWS: View[] = [0, 1, 2, 3];

function room(cells: [number, number][], dividers: RoomView['dividers'] = []): RoomView {
  return {
    cells, styles: {}, style_params: {}, placements: [], floor_paint: {}, wall_paint: {}, dividers,
    settings: {}, area_budget: cells.length, area_used: cells.length,
  };
}

function block(w: number, d: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) out.push([x, y]);
  return out;
}

describe('view rotation', () => {
  it('rotates points and undoes it', () => {
    for (const v of VIEWS) {
      for (const [x, y] of [[0, 0], [3, 1], [-2, 5.5]]) {
        const [rx, ry] = rotXY(v, x, y);
        const [bx, by] = unrotXY(v, rx, ry);
        expect(bx).toBeCloseTo(x, 9);
        expect(by).toBeCloseTo(y, 9);
      }
    }
  });

  it('view 0 leaves the world as it is', () => {
    expect(rotXY(0, 3, 4)).toEqual([3, 4]);
  });

  it('four quarter turns come back to the start', () => {
    let p: [number, number] = [2, 7];
    for (let i = 0; i < 4; i++) p = rotXY(1, p[0], p[1]);
    expect(p).toEqual([2, 7]);
  });

  it('rotates a rectangle into a rectangle of swapped size on odd views', () => {
    const r1 = rotRect(1, 1, 2, 3, 1);
    expect([r1.w, r1.d]).toEqual([1, 3]);
    const r2 = rotRect(2, 1, 2, 3, 1);
    expect([r2.w, r2.d]).toEqual([3, 1]);
    expect(r2.x).toBe(-4);
    expect(r2.y).toBe(-3);
  });
});

describe('which walls face away from the viewer', () => {
  it('has exactly two adjacent back sides in every view', () => {
    const back = (v: View) => (['north', 'east', 'south', 'west'] as const).filter((s) => isBackFacing(v, s));
    expect(back(0).sort()).toEqual(['north', 'west']);
    expect(back(1).sort()).toEqual(['south', 'west']);
    expect(back(2).sort()).toEqual(['east', 'south']);
    expect(back(3).sort()).toEqual(['east', 'north']);
  });

  it('draws walls like the left or right wall of view 0 depending on how they run on screen', () => {
    expect(wallOrientation(0, 'west')).toBe('left');
    expect(wallOrientation(0, 'north')).toBe('right');
    expect(wallOrientation(1, 'south')).toBe('left');
    expect(wallOrientation(1, 'west')).toBe('right');
  });

  it('back sides are the ones whose outward normal points to negative screen-x or screen-y', () => {
    for (const v of VIEWS) {
      for (const [side, [dx, dy]] of [['north', [0, -1]], ['east', [1, 0]], ['south', [0, 1]], ['west', [-1, 0]]] as const) {
        const [nx, ny] = rotXY(v, dx, dy);
        expect(isBackFacing(v, side)).toBe(nx < 0 || ny < 0);
      }
    }
  });
});

describe('walls on edges', () => {
  it('stand on every boundary edge and nowhere inside', () => {
    const r = room(block(3, 2));
    const cells = cellSet(r);
    const dividers = dividerSet(r);
    expect(isWallEdge(cells, dividers, 0, 0, 'north')).toBe(true);
    expect(isWallEdge(cells, dividers, 0, 0, 'west')).toBe(true);
    expect(isWallEdge(cells, dividers, 2, 1, 'east')).toBe(true);
    expect(isWallEdge(cells, dividers, 2, 1, 'south')).toBe(true);
    expect(isWallEdge(cells, dividers, 1, 0, 'east')).toBe(false);
    expect(isWallEdge(cells, dividers, 9, 9, 'north')).toBe(false);
  });

  it('follow an irregular shape', () => {
    const r = room([[0, 0], [1, 0], [1, 1]]);
    const cells = cellSet(r);
    const d = dividerSet(r);
    expect(isWallEdge(cells, d, 0, 0, 'south')).toBe(true);
    expect(isWallEdge(cells, d, 1, 1, 'west')).toBe(true);
    expect(isWallEdge(cells, d, 1, 0, 'south')).toBe(false);
  });

  it('include dividers on both faces', () => {
    const r = room(block(3, 1), [[0, 0, 'east']]);
    const cells = cellSet(r);
    const d = dividerSet(r);
    expect(isWallEdge(cells, d, 0, 0, 'east')).toBe(true);
    expect(isWallEdge(cells, d, 1, 0, 'west')).toBe(true);
    expect(isWallEdge(cells, d, 1, 0, 'east')).toBe(false);
  });

  it('name a divider the same way from either side', () => {
    expect(dividerKey(2, 1, 'east')).toBe('2,1,e');
    expect(dividerKey(3, 1, 'west')).toBe('2,1,e');
    expect(dividerKey(2, 1, 'south')).toBe('2,1,s');
    expect(dividerKey(2, 2, 'north')).toBe('2,1,s');
    expect(edgeKey(1, 2, 'west')).toBe('1,2,w');
  });

  it('list the faces a wall item covers along its wall', () => {
    const def = { footprint: { w: 2, d: 1 } } as ItemDef;
    expect(wallEdgesOfItem(def, 1, 0, 'north')).toEqual([[1, 0, 'north'], [2, 0, 'north']]);
    expect(wallEdgesOfItem(def, 0, 1, 'west')).toEqual([[0, 1, 'west'], [0, 2, 'west']]);
  });
});
