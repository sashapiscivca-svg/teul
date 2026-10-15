// The camera: fits the room into the canvas and applies the player's zoom and pan.

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CameraInput {
  cssW: number;
  cssH: number;
  bounds: Bounds;
  zoom: number;
  /** Pan in CSS pixels, added after centring. */
  panX: number;
  panY: number;
  padTop: number;
  padBottom: number;
  padSide: number;
}

export interface Camera {
  scale: number;
  ox: number;
  oy: number;
}

export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 3;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

/** Scale and offset that centre `bounds` (in unscaled pixels) in the free area of the canvas. */
export function fitCamera(i: CameraInput): Camera {
  const bw = Math.max(1, i.bounds.maxX - i.bounds.minX);
  const bh = Math.max(1, i.bounds.maxY - i.bounds.minY);
  const freeW = Math.max(1, i.cssW - i.padSide * 2);
  const freeH = Math.max(1, i.cssH - i.padTop - i.padBottom);
  const fit = Math.max(0.2, Math.min(2.6, Math.min(freeW / bw, freeH / bh)));
  const scale = fit * clampZoom(i.zoom);
  const ox = (i.cssW - bw * scale) / 2 - i.bounds.minX * scale + i.panX;
  const oy = i.padTop + (freeH - bh * scale) / 2 - i.bounds.minY * scale + i.panY;
  return { scale, ox, oy };
}

/** The pan that puts world point (px, py) (unscaled pixels) at the centre of the free area. */
export function panToCentre(i: Omit<CameraInput, 'panX' | 'panY'>, px: number, py: number): { x: number; y: number } {
  const base = fitCamera({ ...i, panX: 0, panY: 0 });
  const targetX = i.cssW / 2;
  const targetY = i.padTop + (i.cssH - i.padTop - i.padBottom) / 2;
  return { x: targetX - (px * base.scale + base.ox), y: targetY - (py * base.scale + base.oy) };
}

/** Keeps the pan from throwing the room off screen: at least `keep` pixels of it stay visible. */
export function clampPan(pan: { x: number; y: number }, limit: number): { x: number; y: number } {
  return { x: Math.max(-limit, Math.min(limit, pan.x)), y: Math.max(-limit, Math.min(limit, pan.y)) };
}
