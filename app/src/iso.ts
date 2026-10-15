// Isometric (2:1) projection. World coordinates are in tiles; heights are in pixels.

export const TILE = { a: 28, b: 14 } as const;

/** Pixels of height per hundredth of a tile (model heights are authored in hundredths). */
export const Z_PER_CENTI = (TILE.a * 2) / 100;

export interface Pt {
  x: number;
  y: number;
}

export function project(x: number, y: number, z = 0): Pt {
  return { x: (x - y) * TILE.a, y: (x + y) * TILE.b - z };
}

/** The grid point under a screen point, assuming the point lies on the horizontal plane at height `z`. */
export function unproject(sx: number, sy: number, z = 0): Pt {
  const yy = sy + z;
  return { x: (sx / TILE.a + yy / TILE.b) / 2, y: (yy / TILE.b - sx / TILE.a) / 2 };
}

/** Larger means nearer the viewer; draw in ascending order. */
export function depthKey(x: number, y: number): number {
  return x + y;
}
