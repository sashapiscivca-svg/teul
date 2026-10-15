// Paths across the room for tap-to-walk: A* over floor cells, around furniture and through no divider.

import { cellKey, dividerKey, STEP } from './geometry';
import type { Catalog, RoomView } from './types';
import { gridOf } from './world';

type Cell = [number, number];

const STEPS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Whether one step between neighbouring cells is possible (diagonals may not cut a blocked corner or a divider). */
function canStep(free: (x: number, y: number) => boolean, dividers: Set<string>, x: number, y: number, dx: number, dy: number): boolean {
  const nx = x + dx;
  const ny = y + dy;
  if (!free(nx, ny)) return false;
  const crossX = (cx: number, cy: number, sx: number) => dividers.has(dividerKey(cx, cy, sx > 0 ? 'east' : 'west'));
  const crossY = (cx: number, cy: number, sy: number) => dividers.has(dividerKey(cx, cy, sy > 0 ? 'south' : 'north'));
  if (dx !== 0 && dy === 0) return !crossX(x, y, dx);
  if (dy !== 0 && dx === 0) return !crossY(x, y, dy);
  // a diagonal needs both orthogonal routes open
  return free(nx, y) && free(x, ny) && !crossX(x, y, dx) && !crossY(x, y, dy) && !crossX(x, ny, dx) && !crossY(nx, y, dy);
}

/** Cell centres from the start (excluded) to the nearest reachable goal cell, or null when none can be reached. */
export function findPath(room: RoomView, catalog: Catalog, from: Cell, goals: Cell[]): [number, number][] | null {
  const grid = gridOf(room, catalog);
  const free = (x: number, y: number) => grid.cells.has(cellKey(x, y)) && !grid.blocked.has(cellKey(x, y));
  const goalSet = new Set(goals.filter(([x, y]) => free(x, y)).map(([x, y]) => cellKey(x, y)));
  if (goalSet.size === 0) return null;
  const startKey = cellKey(from[0], from[1]);
  if (goalSet.has(startKey)) return [];
  const h = (x: number, y: number) => Math.min(...goals.map(([gx, gy]) => Math.hypot(gx - x, gy - y)));
  const open = new Heap();
  open.push({ k: startKey, x: from[0], y: from[1], g: 0, f: h(from[0], from[1]) });
  const came = new Map<string, string>();
  const best = new Map<string, number>([[startKey, 0]]);
  const done = new Set<string>();
  let guard = 0;
  while (open.size > 0 && guard++ < 40000) {
    const cur = open.pop()!;
    if (done.has(cur.k)) continue;
    done.add(cur.k);
    if (goalSet.has(cur.k)) {
      const out: [number, number][] = [];
      let k: string | undefined = cur.k;
      while (k && k !== startKey) {
        const [x, y] = k.split(',').map(Number);
        out.unshift([x + 0.5, y + 0.5]);
        k = came.get(k);
      }
      return out;
    }
    for (const [dx, dy, cost] of STEPS) {
      if (!canStep(free, grid.dividers, cur.x, cur.y, dx, dy)) continue;
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = cellKey(nx, ny);
      // on the land a path goes up a step at a time (down any way); a cliff wants a hop the path does not take
      if (room.terrain && (room.terrain[nk] ?? 0) - (room.terrain[cur.k] ?? 0) > STEP + 3) continue;
      const g = cur.g + cost;
      if (g >= (best.get(nk) ?? Infinity)) continue;
      best.set(nk, g);
      came.set(nk, cur.k);
      open.push({ k: nk, x: nx, y: ny, g, f: g + h(nx, ny) });
    }
  }
  return null;
}

interface Node {
  k: string;
  x: number;
  y: number;
  g: number;
  f: number;
}

/** A binary min-heap on `f` (ties broken by key, so paths are the same every time). */
class Heap {
  private readonly items: Node[] = [];

  get size(): number {
    return this.items.length;
  }

  private less(a: Node, b: Node): boolean {
    return a.f < b.f || (a.f === b.f && a.k < b.k);
  }

  push(n: Node): void {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): Node | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Free cells around an item (next to its footprint), where the player can stand to use it. */
export function cellsAround(x: number, y: number, w: number, d: number): Cell[] {
  const out: Cell[] = [];
  for (let i = -1; i <= w; i++) {
    out.push([x + i, y - 1], [x + i, y + d]);
  }
  for (let j = 0; j < d; j++) {
    out.push([x - 1, y + j], [x + w, y + j]);
  }
  return out;
}
