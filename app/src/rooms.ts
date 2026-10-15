// Ready-made rooms: where a new rectangle of floor fits next to the home, and which of its edges touch it.

import { cellKey } from './geometry';
import type { WallSide } from './types';

export interface Spot {
  x: number;
  y: number;
  w: number;
  d: number;
  /** Edges between the new cells and the existing ones, seen from the new cells. */
  shared: [number, number, WallSide][];
  score?: number;
}

const LIMIT = 32;

/** The best place for a w×d rectangle: free, inside the grid, touching the home along as many edges as possible. */
export function findSpot(cells: [number, number][], w: number, d: number, bonus: (x: number, y: number) => number = () => 0): Spot | null {
  const taken = new Set(cells.map(([x, y]) => cellKey(x, y)));
  let best: (Spot & { score: number }) | null = null;
  const tried = new Set<string>();
  const consider = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (tried.has(key)) return;
    tried.add(key);
    if (x < 0 || y < 0 || x + w > LIMIT || y + d > LIMIT) return;
    const shared: [number, number, WallSide][] = [];
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) {
        const cx = x + i;
        const cy = y + j;
        if (taken.has(cellKey(cx, cy))) return;
        if (i === 0 && taken.has(cellKey(cx - 1, cy))) shared.push([cx, cy, 'west']);
        if (i === w - 1 && taken.has(cellKey(cx + 1, cy))) shared.push([cx, cy, 'east']);
        if (j === 0 && taken.has(cellKey(cx, cy - 1))) shared.push([cx, cy, 'north']);
        if (j === d - 1 && taken.has(cellKey(cx, cy + 1))) shared.push([cx, cy, 'south']);
      }
    }
    if (shared.length === 0) return;
    const score = shared.length + shared.reduce((a, [sx, sy, side]) => a + bonus(sx + (side === 'east' ? 1 : side === 'west' ? -1 : 0), sy + (side === 'south' ? 1 : side === 'north' ? -1 : 0)), 0);
    const bestScore = best ? best.score : -Infinity;
    const better = score > bestScore || (score === bestScore && best && x + y < best.x + best.y);
    if (better) best = { x, y, w, d, shared, score };
  };
  for (const [cx, cy] of cells) {
    for (let k = 0; k < Math.max(w, d); k++) {
      consider(cx + 1, cy - k);
      consider(cx - w, cy - k);
      consider(cx - k, cy + 1);
      consider(cx - k, cy - d);
    }
  }
  return best;
}

/** Two neighbouring shared edges near the middle of the longest straight run, for a door. */
export function doorwayOf(spot: Spot): [number, number, WallSide] | null {
  const bySide = new Map<WallSide, [number, number, WallSide][]>();
  for (const e of spot.shared) bySide.set(e[2], [...(bySide.get(e[2]) ?? []), e]);
  let run: [number, number, WallSide][] = [];
  for (const list of bySide.values()) if (list.length > run.length) run = list;
  if (run.length < 2) return run[0] ?? null;
  const along = run[0][2] === 'north' || run[0][2] === 'south' ? 0 : 1;
  run.sort((a, b) => a[along] - b[along]);
  const mid = Math.max(0, Math.floor(run.length / 2) - 1);
  return run[mid];
}
