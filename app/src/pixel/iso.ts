// The pixel iso grid: a floor tile is 32×16 art pixels; one tile of height is 26 art pixels.

export const TW = 32;
export const TH = 16;
/** Art pixels per hundredth of a tile of height. */
export const ZPX = 0.26;
/** How far the view ray climbs (in tiles of height) per step of t along x and y. */
export const RAY_Z = (TH) / (ZPX * 100);

export interface P {
  x: number;
  y: number;
}

/** Art-pixel position of a world point (x, y in tiles, z in hundredths). */
export function proj(x: number, y: number, z = 0): P {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) - z * ZPX };
}

/** The floor point (z = 0) under an art pixel. */
export function unproj(sx: number, sy: number): P {
  const a = sx / (TW / 2);
  const b = sy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
