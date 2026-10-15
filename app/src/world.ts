// Movement and interaction rules for the player figure. Pure logic over the engine's room view.

import { cellSet, cellKey, dividerKey, dividerSet, unrotXY, wallEdgesOfItem, type View } from './geometry';
import { unproject } from './iso';
import { footprintCells, worldBoxes } from './models';
import type { Catalog, ItemDef, RoomView } from './types';

export interface Walker {
  /** Position in tiles; the centre of cell (0,0) is (0.5, 0.5). */
  x: number;
  y: number;
  facing: 'left' | 'right';
  /** Screen direction the figure looks in, for the sprite. */
  dir?: 'down' | 'up' | 'left' | 'right';
}

export const WALK_SPEED = 3.0; // tiles per second
export const RADIUS = 0.22; // tiles
const ITEM_REACH = 1.2;
const FIXTURE_REACH = 1.3;

export type Target =
  | { kind: 'item'; pid: number; item: string; action: string }
  | { kind: 'door'; pid: number; item: string; action: string };

const key = cellKey;

export interface Grid {
  cells: Set<string>;
  blocked: Set<string>;
  dividers: Set<string>;
  /** What one actually bumps into in each blocked cell: the part of each thing standing on the ground there. */
  solid: Map<string, Rect[]>;
  /** The height one stands at on things walked over (a root, a rock), by cell, hundredths of a tile. */
  tops: Map<string, number>;
}

/** Something one climbs onto and walks along (a root), rather than goes round. */
function climbable(def: ItemDef): boolean {
  return def.tags.includes('climb');
}

export type Rect = [number, number, number, number];

/** Whatever stands lower than this (hundredths of a tile) is stepped over; what is higher up (a crown, a roof on
 * posts) is walked under; one bumps into the rest, as big as it really is rather than its whole cells. */
const STEP_OVER = 24;
const HEAD = 50;

/** What one bumps into of one thing standing on the floor (none for what is stepped over, walked under or climbed). */
function placementRects(p: { x: number; y: number; rot: number; item: string }, catalog: Catalog): Rect[] {
  const def = catalog.items[p.item];
  if (!def || def.layer !== 'floor' || climbable(def)) return [];
  const boxes = worldBoxes(def, p as Parameters<typeof worldBoxes>[1], 0);
  if (boxes.length > 0 && boxes.every((b) => b.z + b.h <= STEP_OVER)) return [];
  const low = boxes.filter((b) => b.z < HEAD);
  if (low.length === 0) return footprintCells(def, p.rot).map(([dx, dy]) => [p.x + dx, p.y + dy, p.x + dx + 1, p.y + dy + 1] as Rect);
  return [[Math.min(...low.map((b) => b.gx)), Math.min(...low.map((b) => b.gy)), Math.max(...low.map((b) => b.gx + b.gw)), Math.max(...low.map((b) => b.gy + b.gd))]];
}

/** Each of the cells a rectangle covers, with the rectangle (what is bumped into there). */
function rectCells(r: Rect): string[] {
  const out: string[] = [];
  for (let cx = Math.floor(r[0]); cx < Math.ceil(r[2]); cx++) for (let cy = Math.floor(r[1]); cy < Math.ceil(r[3]); cy++) out.push(key(cx, cy));
  return out;
}

/** The ground-standing parts of each floor thing, by cell. */
function solidRects(room: RoomView, catalog: Catalog): Map<string, Rect[]> {
  const out = new Map<string, Rect[]>();
  const add = (r: Rect) => {
    for (const k of rectCells(r)) {
      const list = out.get(k);
      if (list) list.push(r);
      else out.set(k, [r]);
    }
  };
  for (const p of room.placements) for (const r of placementRects(p, catalog)) add(r);
  for (const [x, y] of room.blocked ?? []) add([x, y, x + 1, y + 1]);
  return out;
}

/** Does someone of RADIUS at (x, y) bump into anything standing there? */
function bumps(grid: Grid, x: number, y: number): boolean {
  for (let cx = Math.floor(x - RADIUS); cx <= Math.floor(x + RADIUS); cx++)
    for (let cy = Math.floor(y - RADIUS); cy <= Math.floor(y + RADIUS); cy++) {
      const list = grid.solid.get(key(cx, cy));
      if (!list) continue;
      for (const r of list) if (x + RADIUS > r[0] && x - RADIUS < r[2] && y + RADIUS > r[1] && y - RADIUS < r[3]) return true;
    }
  return false;
}

const memo = new WeakMap<RoomView, Grid>();

export function gridOf(room: RoomView, catalog: Catalog): Grid {
  const cached = memo.get(room);
  if (cached) return cached;
  const dividers = dividerSet(room);
  for (const k of doorways(room, catalog)) dividers.delete(k);
  // the land itself first (hills, terraces), then what stands on it to be walked over (a root on a hill)
  const tops = new Map<string, number>(Object.entries(room.terrain ?? {}));
  for (const p of room.placements) {
    const def = catalog.items[p.item];
    if (!def || def.layer !== 'floor' || !climbable(def)) continue;
    const top = Math.max(0, ...worldBoxes(def, p, 0).map((b) => b.z + b.h));
    for (const [dx, dy] of footprintCells(def, p.rot)) {
      const k = key(p.x + dx, p.y + dy);
      tops.set(k, Math.max(tops.get(k) ?? 0, (room.terrain?.[k] ?? 0) + top));
    }
  }
  const grid = { cells: cellSet(room), blocked: blockedCells(room, catalog), dividers, solid: solidRects(room, catalog), tops };
  memo.set(room, grid);
  return grid;
}

/** Edges with a door on them: inner walls there can be walked through. */
export function doorways(room: RoomView, catalog: Catalog): Set<string> {
  const out = new Set<string>();
  for (const p of room.placements) {
    const def = catalog.items[p.item];
    if (!def || def.layer !== 'wall' || !p.wall || !def.tags.includes('door')) continue;
    for (const [x, y, side] of wallEdgesOfItem(def, p.x, p.y, p.wall)) out.add(dividerKey(x, y, side));
  }
  return out;
}

/** Cells that the player cannot step on: footprints of floor furniture (rugs, wall and surface items do not block). */
export function blockedCells(room: RoomView, catalog: Catalog): Set<string> {
  const out = new Set<string>();
  for (const p of room.placements) {
    const def = catalog.items[p.item];
    if (!def || def.layer !== 'floor' || climbable(def)) continue;
    for (const [dx, dy] of footprintCells(def, p.rot)) out.add(key(p.x + dx, p.y + dy));
  }
  for (const [x, y] of room.blocked ?? []) out.add(key(x, y));
  return out;
}

const CORNERS: [number, number][] = [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]];

/** Can the walker stand at (x, y) after coming from (fromX, fromY)? Divider walls cannot be crossed. */
function fits(grid: Grid, fromX: number, fromY: number, x: number, y: number): boolean {
  for (const [ox, oy] of CORNERS) {
    const cx = Math.floor(x + ox);
    const cy = Math.floor(y + oy);
    const k = key(cx, cy);
    if (!grid.cells.has(k)) return false;
    const px = Math.floor(fromX + ox);
    const py = Math.floor(fromY + oy);
    if (px !== cx && py === cy && grid.dividers.has(dividerKey(px, py, cx > px ? 'east' : 'west'))) return false;
    if (py !== cy && px === cx && grid.dividers.has(dividerKey(px, py, cy > py ? 'south' : 'north'))) return false;
  }
  return !bumps(grid, x, y);
}

/** The height one stands at here (hundredths of a tile): on a root, its top; elsewhere the ground. */
export function groundAt(room: RoomView, catalog: Catalog, x: number, y: number): number {
  return gridOf(room, catalog).tops.get(key(Math.floor(x), Math.floor(y))) ?? 0;
}

/** How near the edge of a cell the land begins to go over into the next one's height (cells). */
const EASE = 0.32;

/**
 * The height under a point with the land's single steps eased: within a little of a cell's edge it goes over into the
 * next cell's height, meeting it half way at the edge itself, so whoever walks a step up or down goes up or down it as
 * they walk (and stands still on it when they stop) instead of jumping at the edge. Only a step one walks (`most`
 * or less); a higher edge stays an edge, to be hopped or fallen from. `at` gives a cell's height (undefined: none).
 */
export function easedHeight(at: (cx: number, cy: number) => number | undefined, x: number, y: number, most: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const h = at(cx, cy) ?? 0;
  let out = h;
  const fx = x - cx;
  const fy = y - cy;
  const lean = (d: number) => {
    // 0 at EASE in from the edge, a half at the edge (smoothly)
    const t = Math.max(0, Math.min(1, (EASE - d) / EASE));
    return 0.5 * t * t * (3 - 2 * t);
  };
  const over = (nx: number, ny: number, d: number) => {
    if (d >= EASE) return;
    const o = at(nx, ny);
    if (o === undefined || o === h || Math.abs(o - h) > most) return;
    out += (o - h) * lean(d);
  };
  over(cx - 1, cy, fx);
  over(cx + 1, cy, 1 - fx);
  over(cx, cy - 1, fy);
  over(cx, cy + 1, 1 - fy);
  return out;
}

/** The height one stands at, its single steps eased (easedHeight over groundAt). */
export function easedGroundAt(room: RoomView, catalog: Catalog, x: number, y: number, most: number): number {
  const tops = gridOf(room, catalog).tops;
  const cells = gridOf(room, catalog).cells;
  return easedHeight((cx, cy) => (cells.has(key(cx, cy)) ? tops.get(key(cx, cy)) ?? 0 : undefined), x, y, most);
}

/** Moves the walker by a screen-space push (unit disc) for `dt` seconds; mutates and returns it. */
export function stepWalker(w: Walker, vx: number, vy: number, dt: number, room: RoomView, catalog: Catalog, view: View = 0): Walker {
  const mag = Math.min(1, Math.hypot(vx, vy));
  if (mag < 1e-6) return w;
  if (vx > 0.05) w.facing = 'right';
  else if (vx < -0.05) w.facing = 'left';
  const u = unproject(vx, vy, 0);
  const [gx, gy] = unrotXY(view, u.x, u.y);
  const g = { x: gx, y: gy };
  const len = Math.hypot(g.x, g.y);
  const dist = WALK_SPEED * mag * dt;
  const dx = (g.x / len) * dist;
  const dy = (g.y / len) * dist;
  const grid = gridOf(room, catalog);
  // Move one axis at a time so the walker slides along walls and furniture.
  const x0 = w.x;
  const y0 = w.y;
  if (fits(grid, w.x, w.y, w.x + dx, w.y)) w.x += dx;
  if (fits(grid, w.x, w.y, w.x, w.y + dy)) w.y += dy;
  // run straight into something: turn a little to one side or the other and go round it
  if (Math.hypot(w.x - x0, w.y - y0) < dist * 0.35 && bumps(grid, x0 + dx, y0 + dy)) {
    for (const a of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
      const ax = dx * Math.cos(a) - dy * Math.sin(a);
      const ay = dx * Math.sin(a) + dy * Math.cos(a);
      if (fits(grid, x0, y0, x0 + ax, y0 + ay)) {
        w.x = x0 + ax;
        w.y = y0 + ay;
        break;
      }
    }
  }
  return w;
}

function distToRect(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

function itemRect(def: ItemDef, x: number, y: number, rot: number): [number, number, number, number] {
  if (def.layer === 'surface') return [x, y, x + 1, y + 1];
  const cells = footprintCells(def, rot);
  const w = Math.max(...cells.map(([cx]) => cx)) + 1;
  const d = Math.max(...cells.map(([, cy]) => cy)) + 1;
  return [x, y, x + w, y + d];
}

/** The segment of wall a wall item hangs on, as a zero-thickness rectangle per covered face. */
function wallRects(def: ItemDef, x: number, y: number, side: NonNullable<RoomView['placements'][number]['wall']>): [number, number, number, number][] {
  return wallEdgesOfItem(def, x, y, side).map(([cx, cy, s]) => {
    switch (s) {
      case 'north':
        return [cx, cy, cx + 1, cy];
      case 'south':
        return [cx, cy + 1, cx + 1, cy + 1];
      case 'west':
        return [cx, cy, cx, cy + 1];
      default:
        return [cx + 1, cy, cx + 1, cy + 1];
    }
  });
}

/** The nearest thing the player could act on, if any is within reach. */
export function nearestInteractable(w: Walker, room: RoomView, catalog: Catalog): Target | null {
  let best: Target | null = null;
  let bestDist = Infinity;
  for (const p of room.placements) {
    const def = catalog.items[p.item];
    // a garden bed or a tub has no action of its own: it is tended (planted, watered, harvested)
    const plot = !!def && def.tags.includes('plot');
    const acts = def ? def.actions.filter((a) => a !== 'harvest') : [];
    if (!def || (acts.length === 0 && !plot)) continue;
    const rects = def.layer === 'wall' && p.wall ? wallRects(def, p.x, p.y, p.wall) : [itemRect(def, p.x, p.y, p.rot)];
    const d = Math.min(...rects.map(([x0, y0, x1, y1]) => distToRect(w.x, w.y, x0, y0, x1, y1)));
    const reach = def.layer === 'wall' ? FIXTURE_REACH : ITEM_REACH;
    if (d <= reach && d < bestDist) {
      const kind = def.tags.includes('door') ? 'door' : 'item';
      best = { kind, pid: p.pid, item: p.item, action: plot ? 'tend' : acts[0] };
      bestDist = d;
    }
  }
  return best;
}


/** Moves a point that is stuck in a removed or blocked cell to the centre of the nearest free cell. */
export function settle(pos: { x: number; y: number }, room: RoomView, catalog: Catalog): void {
  const grid = gridOf(room, catalog);
  const free = (x: number, y: number) => CORNERS.every(([ox, oy]) => {
    const k = key(Math.floor(x + ox), Math.floor(y + oy));
    return grid.cells.has(k) && !grid.blocked.has(k);
  });
  if (free(pos.x, pos.y)) return;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const [cx, cy] of room.cells) {
    const x = cx + 0.5;
    const y = cy + 0.5;
    const d = Math.hypot(x - pos.x, y - pos.y);
    if (d < bestD && free(x, y)) {
      bestD = d;
      best = [x, y];
    }
  }
  if (best) {
    pos.x = best[0];
    pos.y = best[1];
  }
}

/** Can someone stand at (x, y) here (on the floor, clear of furniture)? */
export function canStand(room: RoomView, catalog: Catalog, x: number, y: number): boolean {
  return fits(gridOf(room, catalog), x, y, x, y);
}
