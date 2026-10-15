// The home is split into rooms by its inner walls: cells that can reach each other without crossing a wall form
// one room. Only one room is shown at a time; doors in the walls lead from one to the next.

import { cellKey, dividerKey, dividerSet, wallEdgesOfItem } from './geometry';
import type { Catalog, PlacementView, RoomView } from './types';

export interface Region {
  id: number;
  cells: [number, number][];
  /** Most of its floor is a garden floor. */
  outdoor: boolean;
}

export interface Regions {
  list: Region[];
  of: Map<string, number>;
}

const cache = new WeakMap<RoomView, Regions>();

export function regionsOf(room: RoomView, outdoorCell: (x: number, y: number) => boolean = () => false): Regions {
  const hit = cache.get(room);
  if (hit) return hit;
  const cells = new Set(room.cells.map(([x, y]) => cellKey(x, y)));
  const walls = dividerSet(room);
  const of = new Map<string, number>();
  const list: Region[] = [];
  const sorted = [...room.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [sx, sy] of sorted) {
    if (of.has(cellKey(sx, sy))) continue;
    const id = list.length;
    const region: Region = { id, cells: [], outdoor: false };
    const queue: [number, number][] = [[sx, sy]];
    of.set(cellKey(sx, sy), id);
    while (queue.length) {
      const [x, y] = queue.pop()!;
      region.cells.push([x, y]);
      for (const [dx, dy, side] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']] as const) {
        const k = cellKey(x + dx, y + dy);
        if (!cells.has(k) || of.has(k) || walls.has(dividerKey(x, y, side))) continue;
        of.set(k, id);
        queue.push([x + dx, y + dy]);
      }
    }
    region.outdoor = region.cells.filter(([x, y]) => outdoorCell(x, y)).length * 2 > region.cells.length;
    list.push(region);
  }
  const out = { list, of };
  cache.set(room, out);
  return out;
}

/** The room as it is drawn when standing in one region: its cells, its own walls and what stands in it. */
export function viewOf(room: RoomView, catalog: Catalog, regions: Regions, id: number): RoomView {
  const inside = (x: number, y: number) => regions.of.get(cellKey(x, y)) === id;
  const keep = new Set<number>();
  const byPid = new Map(room.placements.map((p) => [p.pid, p]));
  const placed = (p: PlacementView): boolean => {
    const def = catalog.items[p.item];
    if (p.on !== null) {
      const host = byPid.get(p.on);
      return !!host && placed(host);
    }
    if (def?.layer === 'wall' && p.wall) {
      // a picture or door shows from both rooms its wall touches
      return wallEdgesOfItem(def, p.x, p.y, p.wall).some(([x, y, side]) => {
        const [dx, dy] = side === 'east' ? [1, 0] : side === 'west' ? [-1, 0] : side === 'south' ? [0, 1] : [0, -1];
        return inside(x, y) || inside(x + dx, y + dy);
      });
    }
    return inside(p.x, p.y);
  };
  for (const p of room.placements) if (placed(p)) keep.add(p.pid);
  return {
    ...room,
    home_cells: room.cells,
    cells: room.cells.filter(([x, y]) => inside(x, y)),
    placements: room.placements.filter((p) => keep.has(p.pid)),
    dividers: room.dividers.filter(([x, y, side]) => inside(x, y) && inside(side === 'east' ? x + 1 : x, side === 'south' ? y + 1 : y)),
  };
}
