// Room geometry shared by the renderer and the walking rules: cells, wall edges and the four views.

import type { ItemDef, RoomView, WallSide } from './types';

/** Height units in a step of the land. */
export const STEP = 26;

export const SIDES: WallSide[] = ['north', 'east', 'south', 'west'];

/** The neighbouring cell's offset across a side (also the wall's outward normal). */
export const DELTA: Record<WallSide, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
/** The direction a multi-cell wall item extends in. */
export const ALONG: Record<WallSide, [number, number]> = { north: [1, 0], south: [1, 0], east: [0, 1], west: [0, 1] };
export const LETTER: Record<WallSide, string> = { north: 'n', east: 'e', south: 's', west: 'w' };

export const cellKey = (x: number, y: number): string => `${x},${y}`;
export const edgeKey = (x: number, y: number, side: WallSide): string => `${x},${y},${LETTER[side]}`;

/** A divider is named once, by the east or south side of the cell with the smaller coordinate. */
export function dividerKey(x: number, y: number, side: WallSide): string {
  switch (side) {
    case 'east':
      return `${x},${y},e`;
    case 'south':
      return `${x},${y},s`;
    case 'west':
      return `${x - 1},${y},e`;
    default:
      return `${x},${y - 1},s`;
  }
}

export function cellSet(room: RoomView): Set<string> {
  return new Set(room.cells.map(([x, y]) => cellKey(x, y)));
}

export function dividerSet(room: RoomView): Set<string> {
  return new Set(room.dividers.map(([x, y, side]) => dividerKey(x, y, side)));
}

/** Whether a wall stands on this side of this cell: the room's boundary, or a divider. */
export function isWallEdge(cells: Set<string>, dividers: Set<string>, x: number, y: number, side: WallSide): boolean {
  if (!cells.has(cellKey(x, y))) return false;
  const [dx, dy] = DELTA[side];
  if (!cells.has(cellKey(x + dx, y + dy))) return true;
  return dividers.has(dividerKey(x, y, side));
}

/** The wall faces a wall item covers. */
export function wallEdgesOfItem(def: ItemDef, x: number, y: number, side: WallSide): [number, number, WallSide][] {
  const [ax, ay] = ALONG[side];
  return Array.from({ length: def.footprint.w }, (_, i) => [x + ax * i, y + ay * i, side] as [number, number, WallSide]);
}

// ---- views: the room can be seen from four corners -------------------------------------------------

export type View = 0 | 1 | 2 | 3;

/** Rotates a world point by the view before it is projected. View 0 is the unrotated room. */
export function rotXY(view: View, x: number, y: number): [number, number] {
  switch (view) {
    case 0:
      return [x, y];
    case 1:
      return [-y, x];
    case 2:
      return [-x, -y];
    default:
      return [y, -x];
  }
}

export function unrotXY(view: View, x: number, y: number): [number, number] {
  switch (view) {
    case 0:
      return [x, y];
    case 1:
      return [y, -x];
    case 2:
      return [-x, -y];
    default:
      return [-y, x];
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** An axis-aligned rectangle after the view rotation is still axis-aligned. */
export function rotRect(view: View, x: number, y: number, w: number, d: number): Rect {
  const [ax, ay] = rotXY(view, x, y);
  const [bx, by] = rotXY(view, x + w, y + d);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), d: Math.abs(by - ay) };
}

/** A wall whose outward normal points away from the viewer shows its inside to us: a "back" wall. */
export function isBackFacing(view: View, side: WallSide): boolean {
  const [dx, dy] = DELTA[side];
  const [nx, ny] = rotXY(view, dx, dy);
  return nx < 0 || ny < 0;
}

/** 'left' walls run along the screen's y axis (like the west wall in view 0), 'right' walls along x. */
export function wallOrientation(view: View, side: WallSide): 'left' | 'right' {
  const [dx, dy] = DELTA[side];
  const [nx] = rotXY(view, dx, dy);
  return nx !== 0 ? 'left' : 'right';
}

/** A canonical key for any edge of a cell, so the same wall seen from both sides collapses to one. */
export function dedupeKey(x: number, y: number, side: WallSide): string {
  return dividerKey(x, y, side);
}
